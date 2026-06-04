import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiligenceRun } from "../lib/types";

const executeRunMock = vi.fn();
const recentRunsMock = vi.fn();
const verifyRunAttestationMock = vi.fn();

const fakeRun: DiligenceRun = {
  id: "run_mcp",
  input: "Should I buy Apollo.io?",
  subject: "Apollo.io",
  budgetCapUsd: 0.25,
  spentUsd: 0.03,
  paidCalls: 3,
  paymentMode: "mock",
  llmProvider: "deterministic",
  policyProfile: "standard",
  recommendation: "need_more_evidence",
  confidence: 0.6,
  records: [],
  memo: "memo",
  analystOutput: {
    recommendation: "need_more_evidence",
    confidence: 0.6,
    rationale: {
      id: "claim_rationale",
      claimText: "Mixed evidence.",
      recordIds: [],
      sourceUrls: [],
    },
    strengths: [],
    concerns: [],
    nextSteps: [],
  },
  safeSpendLog: [],
};

describe("POST /api/mcp", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    executeRunMock.mockResolvedValue(fakeRun);
    recentRunsMock.mockReturnValue([fakeRun]);
    verifyRunAttestationMock.mockResolvedValue({
      ok: true,
      verified: true,
      digestMatch: true,
      signatureMatch: null,
      signingMode: "digest-only",
      runId: fakeRun.id,
      subject: fakeRun.subject,
      message: "Digest verified.",
    });
  });

  async function loadRoute(apiAuthKey?: string) {
    vi.doMock("../lib/config", async () => {
      const actual = await vi.importActual<typeof import("../lib/config")>("../lib/config");
      return {
        ...actual,
        config: {
          ...actual.config,
          apiAuthKey,
          proofSigningSecret: undefined,
        },
      };
    });
    vi.doMock("../lib/health", () => ({
      buildHealthStatus: () => ({
        ok: true,
        app: "ProofSpend",
        paymentMode: "mock",
        policyProfile: "standard",
        llmProvider: "deterministic",
        mockX402: true,
        liveConfigured: false,
        walletConfigured: false,
        searchReady: true,
        snapshotSigningAvailable: false,
        readinessSummary: "Ready",
        estimatedPaidCallCostUsd: 0.01,
        estimatedBaselineCalls: 3,
        estimatedMaxCalls: 4,
        uptimeSeconds: 12,
        rateLimits: {
          runDiligence: { limit: 8, windowMs: 60000 },
        },
        recentWebhookDeliveries: [],
      }),
    }));
    vi.doMock("../lib/run-service", () => ({
      executeRun: executeRunMock,
    }));
    vi.doMock("../lib/recent-runs", () => ({
      getRecentRuns: recentRunsMock,
    }));
    vi.doMock("../lib/trust", async () => {
      const actual = await vi.importActual<typeof import("../lib/trust")>("../lib/trust");
      return {
        ...actual,
        verifyRunAttestation: verifyRunAttestationMock,
      };
    });

    return import("../app/api/mcp/route");
  }

  it("initializes the MCP endpoint", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.serverInfo.name).toBe("ProofSpend MCP");
  });

  it("lists MCP tools and resources", async () => {
    const { POST } = await loadRoute();
    const toolsResponse = await POST(
      new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      }),
    );
    const resourcesResponse = await POST(
      new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "resources/list" }),
      }),
    );

    const toolsBody = await toolsResponse.json();
    const resourcesBody = await resourcesResponse.json();

    expect(toolsBody.result.tools.map((tool: { name: string }) => tool.name)).toContain(
      "proofspend.run_diligence",
    );
    expect(
      resourcesBody.result.resources.map((resource: { uri: string }) => resource.uri),
    ).toContain("proofspend://runs/recent");
  });

  it("runs diligence through the MCP tool surface", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: {
            name: "proofspend.run_diligence",
            arguments: {
              question: "Should I buy Apollo.io?",
              budgetCapUsd: 0.25,
            },
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.structuredContent.id).toBe(fakeRun.id);
    expect(executeRunMock).toHaveBeenCalledTimes(1);
  });

  it("requires auth for tool calls when an API key is configured", async () => {
    const { POST } = await loadRoute("secret_key");
    const response = await POST(
      new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: {
            name: "proofspend.get_health",
            arguments: {},
          },
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("requires auth for protected resource reads when an API key is configured", async () => {
    const { POST } = await loadRoute("secret_key");
    const response = await POST(
      new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 7,
          method: "resources/read",
          params: {
            uri: "proofspend://runs/recent",
          },
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("reads recent runs as an MCP resource", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 6,
          method: "resources/read",
          params: {
            uri: "proofspend://runs/recent",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.contents[0].text).toContain(fakeRun.id);
    expect(recentRunsMock).toHaveBeenCalledTimes(1);
  });
});
