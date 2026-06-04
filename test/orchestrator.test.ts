import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RunEvent } from "../lib/types";

const paidSearchMock = vi.fn();
const summarizeFindingMock = vi.fn();
const scoreConfidenceMock = vi.fn();
const scoreNegativityMock = vi.fn();
const synthesizeAnalystOutputMock = vi.fn();

vi.mock("../lib/config", () => ({
  assertLiveModeConfigured: vi.fn(),
  resolvePaymentMode: vi.fn(() => "mock"),
  resolvePolicyProfile: vi.fn((value?: string) => value ?? "standard"),
}));

vi.mock("../lib/subject", () => ({
  extractSubject: vi.fn(async () => "Apollo.io"),
}));

vi.mock("../lib/x402-search", () => ({
  estimatePaidSearchCostUsd: vi.fn(() => 0.01),
  paidSearch: (...args: unknown[]) => paidSearchMock(...args),
}));

vi.mock("../lib/llm", () => ({
  getLLMProvider: () => ({
    name: "deterministic",
    summarizeFinding: (...args: unknown[]) => summarizeFindingMock(...args),
    scoreConfidence: (...args: unknown[]) => scoreConfidenceMock(...args),
    scoreNegativity: (...args: unknown[]) => scoreNegativityMock(...args),
    synthesizeAnalystOutput: (...args: unknown[]) => synthesizeAnalystOutputMock(...args),
  }),
}));

describe("runDiligence hybrid resilience", () => {
  beforeEach(() => {
    paidSearchMock.mockReset();
    summarizeFindingMock.mockReset();
    scoreConfidenceMock.mockReset();
    scoreNegativityMock.mockReset();
    synthesizeAnalystOutputMock.mockReset();

    summarizeFindingMock.mockImplementation(async ({ agent }: { agent: string }) => `${agent} finding`);
    scoreConfidenceMock.mockResolvedValue(0.7);
    scoreNegativityMock.mockResolvedValue(0.4);
    synthesizeAnalystOutputMock.mockResolvedValue({
      recommendation: "buy",
      confidence: 0.72,
      rationale: {
        id: "claim_rationale",
        claimText: "Mixed but promising evidence.",
        recordIds: ["rec1", "rec2"],
        sourceUrls: ["https://example.com/1"],
      },
      strengths: [],
      concerns: [],
      nextSteps: [],
    });
  });

  it("continues after one agent search fails and emits search_failed", async () => {
    const { runDiligence } = await import("../lib/orchestrator");
    const events: RunEvent[] = [];

    paidSearchMock
      .mockResolvedValueOnce({
        sources: [{ title: "Market source", url: "https://example.com/1", snippet: "ok" }],
        receipt: "mock:market",
        costUsd: 0.01,
        paymentMode: "mock",
        provider: "Tavily x402 (mock)",
      })
      .mockRejectedValueOnce(new Error("Evidence provider timeout"))
      .mockResolvedValueOnce({
        sources: [{ title: "Counter source", url: "https://example.com/2", snippet: "risk" }],
        receipt: "mock:counter",
        costUsd: 0.01,
        paymentMode: "mock",
        provider: "Tavily x402 (mock)",
      });

    const run = await runDiligence({
      question: "Should I spend $500 per month on Apollo.io?",
      budgetCapUsd: 0.25,
      emit: (event) => events.push(event),
    });

    expect(events.some((event) => event.type === "search_failed" && event.agent === "Evidence")).toBe(true);
    expect(run.records).toHaveLength(2);
    expect(run.recommendation).toBe("buy");
  });

  it("fails the run when every paid search fails", async () => {
    const { runDiligence } = await import("../lib/orchestrator");

    paidSearchMock.mockRejectedValue(new Error("wallet offline"));

    await expect(
      runDiligence({
        question: "Should I spend $500 per month on Apollo.io?",
        budgetCapUsd: 0.25,
        emit: () => undefined,
      }),
    ).rejects.toThrow("No evidence could be gathered");
  });
});
