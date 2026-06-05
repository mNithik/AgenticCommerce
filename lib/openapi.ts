export const proofSpendOpenApi = {
  openapi: "3.1.0",
  info: {
    title: "ProofSpend API",
    version: "0.1.0",
    description:
      "Receipt-backed diligence API for running paid-search research with SSE or final JSON responses.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key",
        description:
          "Optional bearer token. Required only when PROOFSPEND_API_KEY is configured on the server.",
      },
    },
    schemas: {
      RunDiligenceRequest: {
        type: "object",
        required: ["question", "budgetCapUsd"],
        properties: {
          question: { type: "string" },
          budgetCapUsd: { type: "number", minimum: 0 },
          parentRunId: { type: "string" },
          gapId: { type: "string" },
          suggestedQuery: { type: "string" },
          policyProfile: {
            type: "string",
            enum: ["standard", "strict"],
          },
          callbackUrl: {
            type: "string",
            format: "uri",
          },
          stream: {
            type: "boolean",
            description:
              "Set false to receive the final DiligenceRun JSON instead of text/event-stream.",
          },
        },
      },
      SearchSource: {
        type: "object",
        required: ["title", "url", "snippet"],
        properties: {
          title: { type: "string" },
          url: { type: "string", format: "uri" },
          snippet: { type: "string" },
          score: { type: "number" },
        },
      },
      StructuredFindingMeta: {
        type: "object",
        required: ["summary", "riskFlags", "positiveSignals"],
        properties: {
          summary: { type: "string" },
          riskFlags: { type: "array", items: { type: "string" } },
          positiveSignals: { type: "array", items: { type: "string" } },
          theme: {
            type: "string",
            enum: [
              "legal_resolution",
              "pricing_validation",
              "implementation_validation",
              "deliverability_validation",
              "general_validation",
            ],
          },
        },
      },
      EvidenceRecord: {
        type: "object",
        required: [
          "id",
          "agent",
          "query",
          "normalizedQuery",
          "provider",
          "paymentMode",
          "costUsd",
          "receipt",
          "finding",
          "sources",
          "policyStatus",
        ],
        properties: {
          id: { type: "string" },
          agent: { type: "string", enum: ["Market", "Evidence", "Counter", "Skeptic"] },
          query: { type: "string" },
          normalizedQuery: { type: "string" },
          provider: { type: "string" },
          paymentMode: { type: "string", enum: ["mock", "live"] },
          costUsd: { type: "number" },
          receipt: { type: "string" },
          finding: { type: "string" },
          findingMeta: { $ref: "#/components/schemas/StructuredFindingMeta" },
          sources: {
            type: "array",
            items: { $ref: "#/components/schemas/SearchSource" },
          },
          policyStatus: { type: "string", enum: ["allowed", "blocked"] },
        },
      },
      MemoClaim: {
        type: "object",
        required: ["id", "claimText", "recordIds", "sourceUrls"],
        properties: {
          id: { type: "string" },
          claimText: { type: "string" },
          recordIds: {
            type: "array",
            items: { type: "string" },
          },
          sourceUrls: {
            type: "array",
            items: { type: "string", format: "uri" },
          },
        },
      },
      AnalystOutput: {
        type: "object",
        required: ["recommendation", "confidence", "rationale", "strengths", "concerns", "nextSteps"],
        properties: {
          recommendation: {
            type: "string",
            enum: ["buy", "do_not_buy", "need_more_evidence"],
          },
          confidence: { type: "number" },
          rationale: { $ref: "#/components/schemas/MemoClaim" },
          strengths: {
            type: "array",
            items: { $ref: "#/components/schemas/MemoClaim" },
          },
          concerns: {
            type: "array",
            items: { $ref: "#/components/schemas/MemoClaim" },
          },
          nextSteps: {
            type: "array",
            items: { $ref: "#/components/schemas/MemoClaim" },
          },
        },
      },
      ConfidenceAgentSignal: {
        type: "object",
        required: ["agent", "ran"],
        properties: {
          agent: { type: "string", enum: ["Market", "Evidence", "Counter", "Skeptic"] },
          confidence: { type: "number" },
          negativity: { type: "number" },
          ran: { type: "boolean" },
          recordId: { type: "string" },
        },
      },
      ConfidenceFactor: {
        type: "object",
        required: ["id", "label", "impact"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          impact: { type: "number" },
          recordIds: { type: "array", items: { type: "string" } },
        },
      },
      PolicyAdjustment: {
        type: "object",
        required: ["rule", "delta", "reason"],
        properties: {
          rule: { type: "string" },
          delta: { type: "number" },
          reason: { type: "string" },
        },
      },
      ConfidenceBreakdown: {
        type: "object",
        required: ["overall", "agentSignals", "factors", "policyAdjustments"],
        properties: {
          overall: { type: "number" },
          agentSignals: {
            type: "array",
            items: { $ref: "#/components/schemas/ConfidenceAgentSignal" },
          },
          factors: {
            type: "array",
            items: { $ref: "#/components/schemas/ConfidenceFactor" },
          },
          policyAdjustments: {
            type: "array",
            items: { $ref: "#/components/schemas/PolicyAdjustment" },
          },
          effectiveCounterRisk: { type: "number" },
          confidenceCeiling: { $ref: "#/components/schemas/ConfidenceCeiling" },
        },
      },
      ConfidenceCeiling: {
        type: "object",
        required: ["value", "reason"],
        properties: {
          value: { type: "number" },
          reason: { type: "string" },
          recordIds: { type: "array", items: { type: "string" } },
        },
      },
      DecisionFactor: {
        type: "object",
        required: ["id", "label", "impact"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          impact: { type: "string", enum: ["positive", "negative", "blocking"] },
          recordIds: { type: "array", items: { type: "string" } },
        },
      },
      ProofScoreComponents: {
        type: "object",
        required: ["overall", "citationCoverage", "runCompleteness"],
        properties: {
          overall: { type: "number" },
          citationCoverage: { type: "number" },
          runCompleteness: { type: "number" },
        },
      },
      ConfidenceGap: {
        type: "object",
        required: ["id", "title", "estimatedConfidenceGain", "estimatedCostUsd", "actionType"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          estimatedConfidenceGain: { type: "number" },
          estimatedCostUsd: { type: "number" },
          suggestedQuery: { type: "string" },
          focusAgent: {
            type: "string",
            enum: ["Market", "Evidence", "Counter", "Skeptic"],
          },
          parentRunId: { type: "string" },
          theme: {
            type: "string",
            enum: [
              "legal_resolution",
              "pricing_validation",
              "implementation_validation",
              "deliverability_validation",
              "general_validation",
            ],
          },
          priority: { type: "number" },
          detail: { type: "string" },
          actionType: {
            type: "string",
            enum: ["paid_search", "trial", "internal_data"],
          },
          recordIds: { type: "array", items: { type: "string" } },
        },
      },
      SafeSpendEvent: {
        type: "object",
        required: ["agent", "action", "status", "reason"],
        properties: {
          agent: { type: "string", enum: ["Market", "Evidence", "Counter", "Skeptic"] },
          action: { type: "string", enum: ["batch_preflight", "preflight", "receipt"] },
          status: { type: "string", enum: ["allowed", "blocked"] },
          reason: { type: "string" },
          queryPreview: { type: "string" },
          projectedSpendUsd: { type: "number" },
        },
      },
      DiligenceRun: {
        type: "object",
        required: [
          "id",
          "input",
          "subject",
          "budgetCapUsd",
          "spentUsd",
          "paidCalls",
          "paymentMode",
          "llmProvider",
          "policyProfile",
          "recommendation",
          "confidence",
          "confidenceBreakdown",
          "proofScore",
          "proofScoreComponents",
          "confidenceGaps",
          "records",
          "memo",
          "analystOutput",
          "safeSpendLog",
        ],
        properties: {
          id: { type: "string" },
          input: { type: "string" },
          subject: { type: "string" },
          parentRunId: { type: "string" },
          continuedFromGapId: { type: "string" },
          continuationDepth: { type: "number" },
          budgetCapUsd: { type: "number" },
          spentUsd: { type: "number" },
          paidCalls: { type: "number" },
          paymentMode: { type: "string", enum: ["mock", "live"] },
          llmProvider: { type: "string", enum: ["nvidia", "openai", "huggingface", "deterministic"] },
          policyProfile: { type: "string", enum: ["standard", "strict"] },
          recommendation: { type: "string", enum: ["buy", "do_not_buy", "need_more_evidence"] },
          confidence: { type: "number" },
          confidenceBreakdown: { $ref: "#/components/schemas/ConfidenceBreakdown" },
          proofScore: { type: "number" },
          proofScoreComponents: { $ref: "#/components/schemas/ProofScoreComponents" },
          confidenceGaps: {
            type: "array",
            items: { $ref: "#/components/schemas/ConfidenceGap" },
          },
          decisionFactors: {
            type: "array",
            items: { $ref: "#/components/schemas/DecisionFactor" },
          },
          confidenceCeiling: { $ref: "#/components/schemas/ConfidenceCeiling" },
          records: {
            type: "array",
            items: { $ref: "#/components/schemas/EvidenceRecord" },
          },
          memo: { type: "string" },
          analystOutput: { $ref: "#/components/schemas/AnalystOutput" },
          safeSpendLog: {
            type: "array",
            items: { $ref: "#/components/schemas/SafeSpendEvent" },
          },
          webhookDelivery: { $ref: "#/components/schemas/WebhookDeliveryStatus" },
        },
      },
      WebhookDeliveryStatus: {
        type: "object",
        required: ["id", "callbackUrl", "status", "attempts", "deliveredAt"],
        properties: {
          id: { type: "string" },
          callbackUrl: { type: "string", format: "uri" },
          status: { type: "string", enum: ["delivered", "failed", "skipped"] },
          attempts: { type: "number" },
          deliveredAt: { type: "string", format: "date-time" },
          httpStatus: { type: "number" },
          error: { type: "string" },
        },
      },
      HealthStatusResponse: {
        type: "object",
        required: [
          "ok",
          "app",
          "paymentMode",
          "policyProfile",
          "llmProvider",
          "mockX402",
          "liveConfigured",
          "walletConfigured",
          "searchReady",
          "snapshotSigningAvailable",
          "readinessSummary",
          "estimatedPaidCallCostUsd",
          "estimatedBaselineCalls",
          "estimatedMaxCalls",
          "estimatedConfidenceRange",
          "uptimeSeconds",
          "rateLimits",
          "recentWebhookDeliveries",
        ],
        properties: {
          ok: { type: "boolean", const: true },
          app: { type: "string", const: "ProofSpend" },
          paymentMode: { type: "string", enum: ["mock", "live"] },
          policyProfile: { type: "string", enum: ["standard", "strict"] },
          llmProvider: { type: "string", enum: ["nvidia", "openai", "huggingface", "deterministic"] },
          mockX402: { type: "boolean" },
          liveConfigured: { type: "boolean" },
          walletConfigured: { type: "boolean" },
          searchReady: { type: "boolean" },
          snapshotSigningAvailable: { type: "boolean" },
          readinessSummary: { type: "string" },
          estimatedPaidCallCostUsd: { type: "number" },
          estimatedBaselineCalls: { type: "number" },
          estimatedMaxCalls: { type: "number" },
          estimatedConfidenceRange: {
            type: "object",
            required: ["baselineMin", "baselineMax", "upperBoundWithSkeptic"],
            properties: {
              baselineMin: { type: "number" },
              baselineMax: { type: "number" },
              upperBoundWithSkeptic: { type: "number" },
            },
          },
          uptimeSeconds: { type: "number" },
          rateLimits: {
            type: "object",
            additionalProperties: {
              type: "object",
              required: ["limit", "windowMs"],
              properties: {
                limit: { type: "number" },
                windowMs: { type: "number" },
              },
            },
          },
          recentWebhookDeliveries: {
            type: "array",
            items: { $ref: "#/components/schemas/WebhookDeliveryStatus" },
          },
        },
      },
      ProofAttestation: {
        type: "object",
        required: [
          "formatVersion",
          "canonicalizer",
          "digestAlgorithm",
          "digest",
          "signedAt",
          "signingMode",
        ],
        properties: {
          formatVersion: { type: "number", const: 1 },
          canonicalizer: { type: "string", const: "proofspend.run.v1" },
          digestAlgorithm: { type: "string", const: "SHA-256" },
          digest: { type: "string" },
          signedAt: { type: "string", format: "date-time" },
          signingMode: { type: "string", enum: ["digest-only", "hmac-sha256"] },
          signature: { type: "string" },
          keyId: { type: "string" },
        },
      },
      SnapshotEnvelope: {
        type: "object",
        required: ["version", "createdAt", "run", "attestation"],
        properties: {
          version: { type: "number", const: 2 },
          createdAt: { type: "string", format: "date-time" },
          run: { $ref: "#/components/schemas/DiligenceRun" },
          attestation: { $ref: "#/components/schemas/ProofAttestation" },
        },
      },
      ProofPacketJson: {
        type: "object",
        required: ["metadata", "run"],
        properties: {
          metadata: {
            type: "object",
            required: ["exportedAt", "appName", "exportFormatVersion", "attestation"],
            properties: {
              exportedAt: { type: "string", format: "date-time" },
              appName: { type: "string", const: "ProofSpend" },
              exportFormatVersion: { type: "number", const: 2 },
              attestation: { $ref: "#/components/schemas/ProofAttestation" },
            },
          },
          run: { $ref: "#/components/schemas/DiligenceRun" },
        },
      },
      ProofVerificationResult: {
        type: "object",
        required: [
          "ok",
          "verified",
          "digestMatch",
          "signatureMatch",
          "signingMode",
          "runId",
          "subject",
          "message",
        ],
        properties: {
          ok: { type: "boolean", const: true },
          verified: { type: "boolean" },
          digestMatch: { type: "boolean" },
          signatureMatch: { type: ["boolean", "null"] },
          signingMode: {
            type: "string",
            enum: ["digest-only", "hmac-sha256", "unknown"],
          },
          runId: { type: ["string", "null"] },
          subject: { type: ["string", "null"] },
          message: { type: "string" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/api/run-diligence": {
      post: {
        summary: "Run a diligence workflow",
        description:
          "Defaults to SSE text/event-stream. Set `?stream=false` or body `stream: false` to receive the final DiligenceRun JSON.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RunDiligenceRequest" },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Either text/event-stream (default) or application/json DiligenceRun when stream=false.",
            content: {
              "text/event-stream": {
                schema: {
                  type: "string",
                  description:
                    "Server-sent events that emit RunEvent payloads and end with a complete.run payload.",
                },
              },
              "application/json": {
                schema: { $ref: "#/components/schemas/DiligenceRun" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "text/plain": {
                schema: { type: "string" },
              },
            },
          },
          "401": {
            description: "Unauthorized when PROOFSPEND_API_KEY is configured",
            content: {
              "text/plain": {
                schema: { type: "string" },
              },
            },
          },
          "500": {
            description: "Run failed before completion",
            content: {
              "text/plain": {
                schema: { type: "string" },
              },
            },
          },
          "429": {
            description: "Rate limit exceeded",
            content: {
              "text/plain": {
                schema: { type: "string" },
              },
            },
          },
        },
      },
    },
    "/api/health": {
      get: {
        summary: "Get local runtime status",
        responses: {
          "200": {
            description: "Current payment, provider, and readiness status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthStatusResponse" },
              },
            },
          },
        },
      },
    },
    "/api/openapi": {
      get: {
        summary: "Get the OpenAPI document",
        responses: {
          "200": {
            description: "OpenAPI JSON document for the ProofSpend API",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                },
              },
            },
          },
        },
      },
    },
    "/api/mcp": {
      post: {
        summary: "Call the ProofSpend MCP JSON-RPC endpoint",
        description:
          "Supports initialize, ping, tools/list, tools/call, resources/list, and resources/read for agent-facing integrations.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["method"],
                properties: {
                  jsonrpc: { type: "string", enum: ["2.0"] },
                  id: { type: ["string", "number", "null"] },
                  method: { type: "string" },
                  params: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "JSON-RPC success response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                },
              },
            },
          },
          "400": {
            description: "JSON-RPC error response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized when PROOFSPEND_API_KEY is configured for tool calls",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                },
              },
            },
          },
          "429": {
            description: "Rate limit exceeded for delegated tool calls",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                },
              },
            },
          },
        },
      },
    },
    "/api/schedules": {
      get: {
        summary: "List in-memory diligence schedules",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Current schedules",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { type: "object" },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create a new diligence schedule",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["question", "budgetCapUsd", "intervalMinutes"],
                properties: {
                  label: { type: "string" },
                  question: { type: "string" },
                  budgetCapUsd: { type: "number" },
                  policyProfile: { type: "string", enum: ["standard", "strict"] },
                  callbackUrl: { type: "string", format: "uri" },
                  intervalMinutes: { type: "number" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Created schedule" },
        },
      },
    },
    "/api/schedules/{id}": {
      patch: {
        summary: "Enable or pause a schedule",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Updated schedule" },
        },
      },
      delete: {
        summary: "Delete a schedule",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Deleted schedule" },
        },
      },
    },
    "/api/schedules/{id}/run": {
      post: {
        summary: "Run a saved schedule immediately",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Triggered scheduled run" },
        },
      },
    },
    "/api/webhooks/retry": {
      post: {
        summary: "Retry a recent webhook delivery",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["deliveryId"],
                properties: {
                  deliveryId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Retried delivery status" },
        },
      },
    },
    "/api/observability": {
      get: {
        summary: "Get recent observability events",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Recent observability events",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { type: "object" },
                },
              },
            },
          },
        },
      },
    },
    "/api/sign-snapshot": {
      post: {
        summary: "Create an attested snapshot link payload",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["run"],
                properties: {
                  run: { $ref: "#/components/schemas/DiligenceRun" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Encoded snapshot plus attestation details",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["snapshot", "attestation", "signingAvailable"],
                  properties: {
                    snapshot: { type: "string" },
                    attestation: { $ref: "#/components/schemas/ProofAttestation" },
                    signingAvailable: { type: "boolean" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized when PROOFSPEND_API_KEY is configured",
            content: {
              "text/plain": {
                schema: { type: "string" },
              },
            },
          },
          "429": {
            description: "Rate limit exceeded",
            content: {
              "text/plain": {
                schema: { type: "string" },
              },
            },
          },
        },
      },
    },
    "/api/verify-proof": {
      post: {
        summary: "Verify a proof packet, snapshot, or run attestation",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  snapshot: { type: "string" },
                  proofPacket: { $ref: "#/components/schemas/ProofPacketJson" },
                  run: { $ref: "#/components/schemas/DiligenceRun" },
                  attestation: { $ref: "#/components/schemas/ProofAttestation" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Verification result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProofVerificationResult" },
              },
            },
          },
          "400": {
            description: "Missing or malformed proof input",
            content: {
              "text/plain": {
                schema: { type: "string" },
              },
            },
          },
          "429": {
            description: "Rate limit exceeded",
            content: {
              "text/plain": {
                schema: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;
