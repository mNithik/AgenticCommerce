import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiligenceRun } from "../lib/types";

const run: DiligenceRun = {
  id: "run_snapshot_route",
  input: "Should I buy Apollo.io?",
  subject: "Apollo.io",
  budgetCapUsd: 0.25,
  spentUsd: 0.03,
  paidCalls: 3,
  paymentMode: "mock",
  llmProvider: "deterministic",
  policyProfile: "standard",
  recommendation: "need_more_evidence",
  confidence: 0.5,
  records: [],
  memo: "memo",
  analystOutput: {
    recommendation: "need_more_evidence",
    confidence: 0.5,
    rationale: { id: "claim_1", claimText: "Mixed.", recordIds: [], sourceUrls: [] },
    strengths: [],
    concerns: [],
    nextSteps: [],
  },
  safeSpendLog: [],
};

function buildRequest(authorization?: string) {
  return new Request("http://localhost:3000/api/sign-snapshot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify({ run }),
  });
}

describe("POST /api/sign-snapshot", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns an attested snapshot when auth is open", async () => {
    vi.doMock("../lib/config", async () => {
      const actual = await vi.importActual<typeof import("../lib/config")>("../lib/config");
      return {
        ...actual,
        config: {
          ...actual.config,
          apiAuthKey: undefined,
          proofSigningSecret: undefined,
        },
      };
    });

    const { POST } = await import("../app/api/sign-snapshot/route");
    const response = await POST(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.snapshot).toBeTruthy();
    expect(payload.attestation.signingMode).toBe("digest-only");
  });

  it("requires auth when the API key is configured", async () => {
    vi.doMock("../lib/config", async () => {
      const actual = await vi.importActual<typeof import("../lib/config")>("../lib/config");
      return {
        ...actual,
        config: {
          ...actual.config,
          apiAuthKey: "secret_key",
          proofSigningSecret: "proof_secret",
        },
      };
    });

    const { POST } = await import("../app/api/sign-snapshot/route");
    const unauthorized = await POST(buildRequest());
    const authorized = await POST(buildRequest("Bearer secret_key"));
    const payload = await authorized.json();

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
    expect(payload.attestation.signingMode).toBe("hmac-sha256");
  });
});
