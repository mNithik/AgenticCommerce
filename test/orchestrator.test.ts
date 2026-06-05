import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiligenceRun, RunEvent } from "../lib/types";
import { addRecentRun, clearRecentRuns } from "../lib/recent-runs";

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
    clearRecentRuns();
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
    expect(events.some((event) => event.type === "confidence_updated")).toBe(true);
    expect(run.records).toHaveLength(2);
    expect(run.recommendation).toBe("need_more_evidence");
    expect(run.proofScore).toBeGreaterThan(0);
    expect(run.confidenceBreakdown.agentSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agent: "Market", confidence: 0.7 }),
        expect.objectContaining({ agent: "Evidence", ran: false }),
        expect.objectContaining({ agent: "Counter", negativity: 0.4 }),
      ]),
    );
    expect(run.confidenceGaps.length).toBeGreaterThan(0);
    expect(events.filter((event) => event.type === "confidence_updated").at(-1)).toEqual(
      expect.objectContaining({
        type: "confidence_updated",
        proofScore: run.proofScore,
      }),
    );
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

  it("continues from a parent run and recomputes confidence after one follow-up search", async () => {
    const { runDiligence } = await import("../lib/orchestrator");

    const parentRun: DiligenceRun = {
      id: "run_parent",
      input: "Should I spend $500 per month on Apollo.io?",
      subject: "Apollo.io",
      budgetCapUsd: 0.25,
      spentUsd: 0.03,
      paidCalls: 3,
      paymentMode: "mock",
      llmProvider: "deterministic",
      policyProfile: "standard",
      recommendation: "need_more_evidence",
      confidence: 0.28,
      confidenceBreakdown: {
        overall: 0.28,
        agentSignals: [
          { agent: "Market", confidence: 0.5, ran: true, recordId: "rec_market" },
          { agent: "Evidence", confidence: 0.6, ran: true, recordId: "rec_evidence" },
          { agent: "Counter", negativity: 0.8, ran: true, recordId: "rec_counter" },
          { agent: "Skeptic", ran: false },
        ],
        factors: [],
        policyAdjustments: [],
      },
      proofScore: 37,
      proofScoreComponents: {
        overall: 0.28,
        citationCoverage: 0.67,
        runCompleteness: 1,
      },
      confidenceGaps: [
        {
          id: "gap-counter-deep-dive",
          title: "Run a deeper legal and complaint check to confirm the downside case",
          estimatedConfidenceGain: 0.09,
          estimatedCostUsd: 0.01,
          suggestedQuery: "Apollo.io lawsuit compliance legal response customer complaints deliverability",
          actionType: "paid_search",
          focusAgent: "Counter",
          recordIds: ["rec_counter"],
        },
      ],
      records: [
        {
          id: "rec_market",
          agent: "Market",
          query: "Apollo.io market size category competitors pricing",
          normalizedQuery: "apollo io market size category competitors pricing",
          provider: "Tavily x402 (mock)",
          paymentMode: "mock",
          costUsd: 0.01,
          receipt: "mock:market",
          finding: "Market finding",
          sources: [],
          policyStatus: "allowed",
        },
        {
          id: "rec_evidence",
          agent: "Evidence",
          query: "Apollo.io reviews case studies proof legitimacy",
          normalizedQuery: "apollo io reviews case studies proof legitimacy",
          provider: "Tavily x402 (mock)",
          paymentMode: "mock",
          costUsd: 0.01,
          receipt: "mock:evidence",
          finding: "Evidence finding",
          sources: [],
          policyStatus: "allowed",
        },
        {
          id: "rec_counter",
          agent: "Counter",
          query: "Apollo.io risks complaints lawsuit deliverability",
          normalizedQuery: "apollo io risks complaints lawsuit deliverability",
          provider: "Tavily x402 (mock)",
          paymentMode: "mock",
          costUsd: 0.01,
          receipt: "mock:counter",
          finding: "Counter finding",
          sources: [],
          policyStatus: "allowed",
        },
      ],
      memo: "Recommendation: **need_more_evidence**",
      analystOutput: {
        recommendation: "need_more_evidence",
        confidence: 0.28,
        rationale: {
          id: "claim_rationale",
          claimText: "Mixed evidence with unresolved downside risk.",
          recordIds: ["rec_market", "rec_evidence", "rec_counter"],
          sourceUrls: [],
        },
        strengths: [],
        concerns: [],
        nextSteps: [],
      },
      safeSpendLog: [],
    };
    addRecentRun(parentRun);

    paidSearchMock.mockResolvedValueOnce({
      sources: [{ title: "Follow-up source", url: "https://example.com/followup", snippet: "resolved" }],
      receipt: "mock:followup",
      costUsd: 0.01,
      paymentMode: "mock",
      provider: "Tavily x402 (mock)",
    });
    summarizeFindingMock.mockResolvedValueOnce("Counter follow-up finding with clearer downside resolution");
    scoreNegativityMock.mockResolvedValueOnce(0.3);
    synthesizeAnalystOutputMock.mockResolvedValueOnce({
      recommendation: "need_more_evidence",
      confidence: 0.4,
      rationale: {
        id: "claim_rationale_followup",
        claimText: "The follow-up reduced uncertainty around the downside case.",
        recordIds: ["rec_counter", "rec_followup"],
        sourceUrls: [],
      },
      strengths: [],
      concerns: [],
      nextSteps: [],
    });

    const events: RunEvent[] = [];
    const run = await runDiligence({
      question: parentRun.input,
      budgetCapUsd: 0.4,
      parentRunId: parentRun.id,
      gapId: "gap-counter-deep-dive",
      suggestedQuery: "Apollo.io lawsuit compliance legal response customer complaints deliverability",
      emit: (event) => events.push(event),
    });

    expect(run.parentRunId).toBe(parentRun.id);
    expect(run.continuedFromGapId).toBe("gap-counter-deep-dive");
    expect(run.records).toHaveLength(4);
    expect(run.proofScore).toBeGreaterThan(parentRun.proofScore);
    expect(events.some((event) => event.type === "follow_up_started")).toBe(true);
    expect(events.some((event) => event.type === "follow_up_completed")).toBe(true);
  });

  it("automatically buys targeted follow-up evidence when confidence is low and budget allows", async () => {
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
      .mockResolvedValueOnce({
        sources: [{ title: "Evidence source", url: "https://example.com/2", snippet: "mixed" }],
        receipt: "mock:evidence",
        costUsd: 0.01,
        paymentMode: "mock",
        provider: "Tavily x402 (mock)",
      })
      .mockResolvedValueOnce({
        sources: [{ title: "Counter source", url: "https://example.com/3", snippet: "risk" }],
        receipt: "mock:counter",
        costUsd: 0.01,
        paymentMode: "mock",
        provider: "Tavily x402 (mock)",
      })
      .mockResolvedValueOnce({
        sources: [{ title: "Counter follow-up", url: "https://example.com/4", snippet: "clarity" }],
        receipt: "mock:counter-followup",
        costUsd: 0.01,
        paymentMode: "mock",
        provider: "Tavily x402 (mock)",
      });

    summarizeFindingMock
      .mockResolvedValueOnce("Market finding")
      .mockResolvedValueOnce("Evidence finding")
      .mockResolvedValueOnce("Counter finding")
      .mockResolvedValueOnce("Counter follow-up finding");

    scoreConfidenceMock.mockResolvedValue(0.5);
    scoreNegativityMock
      .mockResolvedValueOnce(0.8)
      .mockResolvedValueOnce(0.35);

    synthesizeAnalystOutputMock
      .mockResolvedValueOnce({
        recommendation: "need_more_evidence",
        confidence: 0.32,
        rationale: {
          id: "interim_rationale",
          claimText: "Mixed evidence with unresolved risk.",
          recordIds: ["rec1"],
          sourceUrls: [],
        },
        strengths: [],
        concerns: [],
        nextSteps: [
          {
            id: "next_legal",
            claimText: "Investigate legal complaints and deliverability issues before committing.",
            recordIds: ["rec1"],
            sourceUrls: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        recommendation: "need_more_evidence",
        confidence: 0.4,
        rationale: {
          id: "final_rationale",
          claimText: "Follow-up evidence improved the downside picture but not enough for a buy.",
          recordIds: ["rec1"],
          sourceUrls: [],
        },
        strengths: [],
        concerns: [],
        nextSteps: [],
      });

    const run = await runDiligence({
      question: "Should I spend $500 per month on Apollo.io?",
      budgetCapUsd: 0.5,
      emit: (event) => events.push(event),
    });

    expect(events.some((event) => event.type === "follow_up_started")).toBe(true);
    expect(events.some((event) => event.type === "follow_up_completed")).toBe(true);
    expect(run.paidCalls).toBeGreaterThanOrEqual(4);
    expect(run.records.length).toBeGreaterThanOrEqual(4);
  });
});
