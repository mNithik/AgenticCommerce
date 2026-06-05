import { describe, expect, it } from "vitest";
import { computeDecision } from "../lib/decision-engine";
import type { ConfidenceAgentSignal } from "../lib/types";

function signals(overrides: Partial<ConfidenceAgentSignal>[] = []): ConfidenceAgentSignal[] {
  const base: ConfidenceAgentSignal[] = [
    { agent: "Market", ran: true, confidence: 0.7, recordId: "rec_market" },
    { agent: "Evidence", ran: true, confidence: 0.68, recordId: "rec_evidence" },
    { agent: "Counter", ran: true, negativity: 0.2, recordId: "rec_counter" },
    { agent: "Skeptic", ran: false },
  ];
  for (const override of overrides) {
    const index = base.findIndex((signal) => signal.agent === override.agent);
    if (index >= 0) {
      base[index] = { ...base[index], ...override };
    }
  }
  return base;
}

const parsedQuestion = {
  subject: "Apollo.io",
  spendSignal: "$500/month",
  companyStage: "early-stage" as const,
  intents: ["pricing", "roi"] as const,
  riskThemes: ["pricing_validation"] as const,
  spendSensitive: true,
};

describe("computeDecision", () => {
  it("returns buy only when validation and low counter risk are both present", () => {
    const result = computeDecision({
      overall: 0.62,
      proofScore: 79,
      effectiveCounterRisk: 0.2,
      agentSignals: signals(),
      parsedQuestion,
      recordCount: 4,
      policyProfile: "standard",
      hasValidationEvidence: true,
      hasLegalResolutionEvidence: true,
      skepticRan: true,
      confidenceCeiling: null,
    });

    expect(result.recommendation).toBe("buy");
  });

  it("returns need_more_evidence when spend validation is missing", () => {
    const result = computeDecision({
      overall: 0.58,
      proofScore: 70,
      effectiveCounterRisk: 0.22,
      agentSignals: signals(),
      parsedQuestion,
      recordCount: 4,
      policyProfile: "standard",
      hasValidationEvidence: false,
      hasLegalResolutionEvidence: true,
      skepticRan: true,
      confidenceCeiling: null,
    });

    expect(result.recommendation).toBe("need_more_evidence");
  });

  it("returns do_not_buy when unresolved legal risk is extreme", () => {
    const result = computeDecision({
      overall: 0.22,
      proofScore: 36,
      effectiveCounterRisk: 0.82,
      agentSignals: signals([{ agent: "Counter", negativity: 0.82 }]),
      parsedQuestion,
      recordCount: 4,
      policyProfile: "standard",
      hasValidationEvidence: true,
      hasLegalResolutionEvidence: false,
      skepticRan: false,
      confidenceCeiling: {
        value: 0.4,
        reason: "Unresolved legal or compliance risk is still capping confidence.",
      },
    });

    expect(result.recommendation).toBe("do_not_buy");
  });

  it("returns do_not_buy for very low overall with moderate counter risk", () => {
    const result = computeDecision({
      overall: 0.22,
      proofScore: 36,
      effectiveCounterRisk: 0.6,
      agentSignals: signals([{ agent: "Counter", negativity: 0.6 }]),
      parsedQuestion,
      recordCount: 4,
      policyProfile: "standard",
      hasValidationEvidence: true,
      hasLegalResolutionEvidence: true,
      skepticRan: false,
      confidenceCeiling: null,
    });

    expect(result.recommendation).toBe("do_not_buy");
  });

  it("applies the strict policy buy gate", () => {
    const result = computeDecision({
      overall: 0.62,
      proofScore: 78,
      effectiveCounterRisk: 0.24,
      agentSignals: signals(),
      parsedQuestion,
      recordCount: 4,
      policyProfile: "strict",
      hasValidationEvidence: true,
      hasLegalResolutionEvidence: true,
      skepticRan: false,
      confidenceCeiling: null,
    });

    expect(result.recommendation).toBe("need_more_evidence");
    expect(result.decisionFactors.some((factor) => factor.id === "strict-policy")).toBe(true);
  });
});
