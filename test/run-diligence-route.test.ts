import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiligenceRun } from "../lib/types";
import { makeDiligenceRun } from "./fixtures";

const fakeRun: DiligenceRun = {
  ...makeDiligenceRun({
    id: "run_test",
    confidence: 0.6,
    proofScore: 68,
  }),
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
    expect(body.proofScore).toBe(68);
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

  it("accepts continuation run request fields", async () => {
    const { POST } = await loadRoute(undefined);
    const request = new Request("http://localhost:3000/api/run-diligence?stream=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "Should I buy Apollo.io?",
        budgetCapUsd: 0.35,
        stream: false,
        parentRunId: "run_parent",
        gapId: "gap-counter-deep-dive",
        suggestedQuery: "Apollo.io lawsuit compliance legal response customer complaints deliverability",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("run_test");
  });
});
