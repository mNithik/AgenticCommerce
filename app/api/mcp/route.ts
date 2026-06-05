import { assertRunApiAuthorized } from "../../../lib/api-auth";
import { buildHealthStatus } from "../../../lib/health";
import { proofSpendOpenApi } from "../../../lib/openapi";
import { applyRateLimit } from "../../../lib/rate-limit";
import { getRecentRuns } from "../../../lib/recent-runs";
import { executeRun } from "../../../lib/run-service";
import { parseRunSnapshot } from "../../../lib/run-sharing";
import { verifyRunAttestation } from "../../../lib/trust";
import type { DiligenceRun, PolicyProfile, ProofAttestation, ProofPacketJson } from "../../../lib/types";
import { config } from "../../../lib/config";
import { recordObservabilityEvent } from "../../../lib/observability";

export const runtime = "nodejs";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function result(id: JsonRpcRequest["id"], payload: unknown) {
  return Response.json({
    jsonrpc: "2.0",
    id: id ?? null,
    result: payload,
  });
}

function unauthorizedMcpResponse(id: JsonRpcRequest["id"]) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? null,
      error: {
        code: -32001,
        message: "Unauthorized.",
      },
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Bearer realm="ProofSpend"',
      },
    },
  );
}

function errorResponse(
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
) {
  return Response.json(
    {
      jsonrpc: "2.0",
      id: id ?? null,
      error: {
        code,
        message,
      },
    },
    { status: 400 },
  );
}

function resourceText(uri: string, value: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function toolDefinitions() {
  return [
    {
      name: "proofspend.run_diligence",
      description: "Run a ProofSpend diligence workflow and return the final run object.",
      inputSchema: {
        type: "object",
        required: ["question", "budgetCapUsd"],
        properties: {
          question: { type: "string" },
          budgetCapUsd: { type: "number" },
          policyProfile: { type: "string", enum: ["standard", "strict"] },
          callbackUrl: { type: "string" },
          parentRunId: { type: "string" },
          gapId: { type: "string" },
          suggestedQuery: { type: "string" },
        },
      },
    },
    {
      name: "proofspend.verify_proof",
      description: "Verify a proof packet, snapshot, or run attestation.",
      inputSchema: {
        type: "object",
        properties: {
          snapshot: { type: "string" },
          proofPacket: { type: "object" },
          run: { type: "object" },
          attestation: { type: "object" },
        },
      },
    },
    {
      name: "proofspend.get_health",
      description: "Fetch the current ProofSpend health and diagnostics payload.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "proofspend.get_openapi",
      description: "Fetch the ProofSpend OpenAPI document.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "proofspend.explain_confidence",
      description: "Return the confidence breakdown, proof score, and gaps for a run payload.",
      inputSchema: {
        type: "object",
        required: ["run"],
        properties: {
          run: { type: "object" },
        },
      },
    },
  ];
}

function resourceDefinitions() {
  return [
    {
      uri: "proofspend://health",
      name: "ProofSpend Health",
      description: "Current health and diagnostics snapshot.",
      mimeType: "application/json",
    },
    {
      uri: "proofspend://openapi",
      name: "ProofSpend OpenAPI",
      description: "Machine-readable API contract.",
      mimeType: "application/json",
    },
    {
      uri: "proofspend://runs/recent",
      name: "Recent Runs",
      description: "Recent completed diligence runs stored in this server process.",
      mimeType: "application/json",
    },
  ];
}

async function verifyProof(params: Record<string, unknown>) {
  let run: DiligenceRun | null = null;
  let attestation: ProofAttestation | null = null;

  if (typeof params.snapshot === "string") {
    const envelope = parseRunSnapshot(params.snapshot);
    if (!envelope) {
      throw new Error("snapshot could not be parsed.");
    }
    run = envelope.run;
    attestation = envelope.attestation;
  } else if (params.proofPacket && typeof params.proofPacket === "object") {
    const packet = params.proofPacket as ProofPacketJson;
    run = packet.run;
    attestation = packet.metadata?.attestation ?? null;
  } else if (params.run && typeof params.run === "object") {
    run = params.run as DiligenceRun;
    attestation = (params.attestation as ProofAttestation | undefined) ?? null;
  }

  if (!run || typeof run.id !== "string") {
    throw new Error("Provide snapshot, proofPacket, or run + attestation.");
  }

  return verifyRunAttestation(run, attestation, {
    secret: config.proofSigningSecret,
  });
}

async function callTool(
  request: Request,
  name: string,
  args: Record<string, unknown>,
) {
  switch (name) {
    case "proofspend.run_diligence": {
      const rateLimited = applyRateLimit(request, "runDiligence");
      if (rateLimited) {
        throw Object.assign(new Error("Rate limit exceeded."), { status: 429 });
      }

      const question = typeof args.question === "string" ? args.question.trim() : "";
      const budgetCapUsd =
        typeof args.budgetCapUsd === "number"
          ? args.budgetCapUsd
          : Number(args.budgetCapUsd);
      const callbackUrl =
        typeof args.callbackUrl === "string" ? args.callbackUrl.trim() : undefined;
      const parentRunId =
        typeof args.parentRunId === "string" ? args.parentRunId.trim() : undefined;
      const gapId = typeof args.gapId === "string" ? args.gapId.trim() : undefined;
      const suggestedQuery =
        typeof args.suggestedQuery === "string"
          ? args.suggestedQuery.trim()
          : undefined;
      const policyProfile =
        args.policyProfile === "standard" || args.policyProfile === "strict"
          ? (args.policyProfile as PolicyProfile)
          : undefined;

      if (!question) {
        throw new Error("question is required.");
      }
      if (!Number.isFinite(budgetCapUsd) || budgetCapUsd <= 0) {
        throw new Error("budgetCapUsd must be a positive number.");
      }

      return executeRun({
        question,
        budgetCapUsd,
        policyProfile,
        callbackUrl,
        parentRunId,
        gapId,
        suggestedQuery,
      });
    }
    case "proofspend.verify_proof": {
      const rateLimited = applyRateLimit(request, "verifyProof");
      if (rateLimited) {
        throw Object.assign(new Error("Rate limit exceeded."), { status: 429 });
      }
      return verifyProof(args);
    }
    case "proofspend.get_health":
      return buildHealthStatus();
    case "proofspend.get_openapi":
      return proofSpendOpenApi;
    case "proofspend.explain_confidence": {
      const run =
        args.run && typeof args.run === "object" ? (args.run as DiligenceRun) : null;
      if (!run) {
        throw new Error("run is required.");
      }

      return {
        runId: run.id,
        subject: run.subject,
        confidence: run.confidence,
        proofScore: run.proofScore,
        confidenceBreakdown: run.confidenceBreakdown,
        confidenceGaps: run.confidenceGaps,
        decisionFactors: run.decisionFactors ?? [],
        confidenceCeiling: run.confidenceCeiling ?? run.confidenceBreakdown?.confidenceCeiling ?? null,
        effectiveCounterRisk: run.confidenceBreakdown?.effectiveCounterRisk ?? null,
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function POST(request: Request) {
  let body: JsonRpcRequest;

  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return errorResponse(null, -32700, "Invalid JSON body.");
  }

  const id = body.id ?? null;
  const method = body.method;
  const params = body.params ?? {};

  if (!method) {
    return errorResponse(id, -32600, "method is required.");
  }

  if (method === "initialize") {
    recordObservabilityEvent({
      category: "mcp",
      status: "info",
      message: "MCP initialize called.",
    });
    return result(id, {
      protocolVersion: "2024-11-05",
      serverInfo: {
        name: "ProofSpend MCP",
        version: "0.1.0",
      },
      capabilities: {
        tools: {},
        resources: {},
      },
    });
  }

  if (method === "tools/list") {
    recordObservabilityEvent({
      category: "mcp",
      status: "info",
      message: "MCP tools listed.",
    });
    return result(id, {
      tools: toolDefinitions(),
    });
  }

  if (method === "resources/list") {
    recordObservabilityEvent({
      category: "mcp",
      status: "info",
      message: "MCP resources listed.",
    });
    return result(id, {
      resources: resourceDefinitions(),
    });
  }

  if (method === "resources/read") {
    const unauthorized = assertRunApiAuthorized(request);
    if (unauthorized) {
      return unauthorizedMcpResponse(id);
    }

    const uri = typeof params.uri === "string" ? params.uri : "";
    switch (uri) {
      case "proofspend://health":
        recordObservabilityEvent({
          category: "mcp",
          status: "info",
          message: "MCP resource read: health.",
        });
        return result(id, resourceText(uri, buildHealthStatus()));
      case "proofspend://openapi":
        recordObservabilityEvent({
          category: "mcp",
          status: "info",
          message: "MCP resource read: openapi.",
        });
        return result(id, resourceText(uri, proofSpendOpenApi));
      case "proofspend://runs/recent":
        recordObservabilityEvent({
          category: "mcp",
          status: "info",
          message: "MCP resource read: recent runs.",
        });
        return result(id, resourceText(uri, getRecentRuns()));
      default:
        return errorResponse(id, -32004, `Unknown resource: ${uri}`);
    }
  }

  if (method === "tools/call") {
    const unauthorized = assertRunApiAuthorized(request);
    if (unauthorized) {
      return unauthorizedMcpResponse(id);
    }

    const name = typeof params.name === "string" ? params.name : "";
    const args =
      params.arguments && typeof params.arguments === "object"
        ? (params.arguments as Record<string, unknown>)
        : {};

    try {
      const toolResult = await callTool(request, name, args);
      recordObservabilityEvent({
        category: "mcp",
        status: "success",
        message: `MCP tool call succeeded: ${name}.`,
      });
      return result(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(toolResult, null, 2),
          },
        ],
        structuredContent: toolResult,
      });
    } catch (error) {
      recordObservabilityEvent({
        category: "mcp",
        status: "error",
        message: `MCP tool call failed: ${name}.`,
        metadata: {
          error: error instanceof Error ? error.message : "Tool call failed.",
        },
      });
      const status = (error as { status?: number }).status;
      return Response.json(
        {
          jsonrpc: "2.0",
          id,
          error: {
            code: status === 429 ? -32029 : -32000,
            message: error instanceof Error ? error.message : "Tool call failed.",
          },
        },
        { status: status ?? 400 },
      );
    }
  }

  if (method === "ping") {
    return result(id, { ok: true });
  }

  return errorResponse(id, -32601, `Unsupported method: ${method}`);
}
