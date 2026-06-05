import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/config", () => ({
  config: {
    agentWalletKey: undefined,
    tavilyX402Url: "https://x402.tavily.com/search",
    llmProvider: "nvidia",
    mockX402: true,
    policyProfile: "standard",
  },
  resolvePaymentMode: () => "mock",
  resolvePolicyProfile: () => "standard",
}));

vi.mock("../lib/x402-search", () => ({
  estimatePaidSearchCostUsd: () => 0.01,
}));

import { GET } from "../app/api/health/route";

describe("GET /api/health", () => {
  it("returns status without requiring auth", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      app: "ProofSpend",
      paymentMode: "mock",
      policyProfile: "standard",
      llmProvider: "nvidia",
      estimatedConfidenceRange: expect.objectContaining({
        baselineMin: expect.any(Number),
        baselineMax: expect.any(Number),
        upperBoundWithSkeptic: expect.any(Number),
      }),
      uptimeSeconds: expect.any(Number),
      rateLimits: expect.objectContaining({
        runDiligence: expect.objectContaining({
          limit: expect.any(Number),
          windowMs: expect.any(Number),
        }),
      }),
      recentWebhookDeliveries: expect.any(Array),
    });
  });
});
