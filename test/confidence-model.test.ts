import { describe, expect, it } from "vitest";
import { computeConfidenceModel } from "../lib/confidence-model";
import type { ConfidenceAgentSignal, MemoClaim, SafeSpendEvent } from "../lib/types";

function baseSignals(overrides: Partial<ConfidenceAgentSignal>[] = []): ConfidenceAgentSignal[] {
  const signals: ConfidenceAgentSignal[] = [
    { agent: "Market", confidence: 0.8, ran: true, recordId: "record_market" },
    { agent: "Evidence", confidence: 0.75, ran: true, recordId: "record_evidence" },
    { agent: "Counter", negativity: 0.2, ran: true, recordId: "record_counter" },
    { agent: "Skeptic", ran: false },
  ];

  for (const next of overrides) {
    const index = signals.findIndex((signal) => signal.agent === next.agent);
    if (index >= 0) {
      signals[index] = { ...signals[index], ...next };
    }
  }

  return signals;
}

function baseClaims(overrides: Partial<MemoClaim>[] = []): MemoClaim[] {
  return [
    {
      id: "claim_rationale",
      claimText: "Apollo.io has evidence-backed upside for outbound use cases.",
      recordIds: ["record_market", "record_evidence"],
      sourceUrls: ["https://example.com/market"],
      ...overrides[0],
    },
    {
      id: "claim_next",
      claimText: "Run a focused trial before committing to full spend.",
      recordIds: ["record_evidence"],
      sourceUrls: ["https://example.com/evidence"],
      ...overrides[1],
    },
  ];
}

function baseSafeSpend(events: SafeSpendEvent[] = []): SafeSpendEvent[] {
  return events;
}

describe("computeConfidenceModel", () => {
  it("scores strong positive evidence higher than mixed evidence", () => {
    const strong = computeConfidenceModel({
      agentSignals: baseSignals(),
      memoClaims: baseClaims(),
      safeSpendLog: baseSafeSpend(),
      recordCount: 3,
      subject: "Apollo.io",
      policyProfile: "standard",
      recommendationBeforePolicy: "buy",
      recommendationAfterPolicy: "buy",
      skepticEligible: true,
      skepticRan: false,
      skepticSkippedReason: "Skeptic skipped because the remaining budget would be exceeded.",
    });

    const mixed = computeConfidenceModel({
      agentSignals: baseSignals([
        { agent: "Evidence", confidence: 0.52 },
        { agent: "Counter", negativity: 0.45 },
      ]),
      memoClaims: baseClaims([{ recordIds: [] }]),
      safeSpendLog: baseSafeSpend([
        {
          agent: "Evidence",
          action: "preflight",
          status: "blocked",
          reason: "Budget cap exceeded.",
          projectedSpendUsd: 0.01,
        },
      ]),
      recordCount: 2,
      subject: "Apollo.io",
      policyProfile: "standard",
      recommendationBeforePolicy: "need_more_evidence",
      recommendationAfterPolicy: "need_more_evidence",
      skepticEligible: false,
      skepticRan: false,
    });

    expect(strong.proofScore).toBeGreaterThan(mixed.proofScore);
    expect(strong.overall).toBeGreaterThan(mixed.overall);
  });

  it("penalizes counter-heavy runs", () => {
    const result = computeConfidenceModel({
      agentSignals: baseSignals([
        { agent: "Counter", negativity: 0.85 },
        { agent: "Evidence", confidence: 0.5 },
      ]),
      memoClaims: baseClaims(),
      safeSpendLog: baseSafeSpend(),
      recordCount: 3,
      subject: "Apollo.io",
      policyProfile: "standard",
      recommendationBeforePolicy: "do_not_buy",
      recommendationAfterPolicy: "do_not_buy",
      skepticEligible: true,
      skepticRan: true,
    });

    expect(result.overall).toBeLessThan(0.5);
    expect(result.confidenceBreakdown.factors.some((factor) => factor.label.includes("Counter"))).toBe(true);
  });

  it("records strict-policy downgrades as policy adjustments", () => {
    const result = computeConfidenceModel({
      agentSignals: baseSignals(),
      memoClaims: baseClaims(),
      safeSpendLog: baseSafeSpend(),
      recordCount: 3,
      subject: "Apollo.io",
      policyProfile: "strict",
      recommendationBeforePolicy: "buy",
      recommendationAfterPolicy: "need_more_evidence",
      skepticEligible: true,
      skepticRan: false,
      skepticSkippedReason: "Skeptic skipped because the remaining budget would be exceeded.",
    });

    expect(result.confidenceBreakdown.policyAdjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "strict_buy_gate",
        }),
      ]),
    );
  });

  it("generates actionable paid-search gaps for counter-heavy Apollo-style runs", () => {
    const result = computeConfidenceModel({
      agentSignals: baseSignals([
        { agent: "Market", confidence: 0.5 },
        { agent: "Evidence", confidence: 0.6 },
        { agent: "Counter", negativity: 0.8 },
      ]),
      memoClaims: baseClaims([
        {
          id: "claim_rationale",
          claimText: "Apollo.io has evidence-backed upside for outbound use cases.",
          recordIds: ["record_market", "record_evidence"],
          sourceUrls: ["https://example.com/market"],
        },
        {
          claimText: "Investigate legal complaints and deliverability issues before committing.",
          recordIds: ["record_counter"],
        },
      ]),
      safeSpendLog: baseSafeSpend(),
      recordCount: 3,
      subject: "Apollo.io",
      policyProfile: "standard",
      recommendationBeforePolicy: "need_more_evidence",
      recommendationAfterPolicy: "need_more_evidence",
      skepticEligible: false,
      skepticRan: false,
    });

    expect(result.overall).toBeGreaterThan(0);
    expect(result.confidenceGaps.some((gap) => gap.actionType === "paid_search")).toBe(true);
    expect(
      result.confidenceGaps
        .filter((gap) => gap.actionType === "paid_search")
        .every((gap) => typeof gap.suggestedQuery === "string" && gap.suggestedQuery.length > 0),
    ).toBe(true);
  });
});
