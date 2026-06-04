import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiligenceRun } from "../lib/types";

const fakeRun: DiligenceRun = {
  id: "run_test",
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

describe("POST /api/run-diligence", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadRoute(apiAuthKey?: string) {
    vi.doMock("../lib/config", async () => {
      const actual = await vi.importActual<typeof import("../lib/config")>("../lib/config");
      return {
        ...actual,
        config: {
          ...actual.config,
          apiAuthKey,
        },
      };
    });
    vi.doMock("../lib/orchestrator", () => ({
      runDiligence: vi.fn(async () => fakeRun),
    }));
    vi.doMock("../lib/webhooks", () => ({
      deliverRunWebhook: vi.fn(async () => undefined),
    }));

    return import("../app/api/run-diligence/route");
  }

  it("allows open access when auth is not configured", async () => {
    const { POST } = await loadRoute(undefined);
    const request = new Request("http://localhost:3000/api/run-diligence?stream=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Should I buy Apollo.io?",
        budgetCapUsd: 0.25,
        stream: false,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("run_test");
  });

  it("returns 401 when auth is configured and the bearer token is missing", async () => {
    const { POST } = await loadRoute("secret_key");
    const request = new Request("http://localhost:3000/api/run-diligence?stream=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Should I buy Apollo.io?",
        budgetCapUsd: 0.25,
        stream: false,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 401 when the bearer token is wrong", async () => {
    const { POST } = await loadRoute("secret_key");
    const request = new Request("http://localhost:3000/api/run-diligence?stream=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer wrong",
      },
      body: JSON.stringify({
        question: "Should I buy Apollo.io?",
        budgetCapUsd: 0.25,
        stream: false,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("allows the request when the bearer token matches", async () => {
    const { POST } = await loadRoute("secret_key");
    const request = new Request("http://localhost:3000/api/run-diligence?stream=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret_key",
      },
      body: JSON.stringify({
        question: "Should I buy Apollo.io?",
        budgetCapUsd: 0.25,
        stream: false,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("run_test");
  });
});
