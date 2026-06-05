import type {
  ConfidenceAgentSignal,
  ConfidenceCeiling,
  DecisionFactor,
  DiligenceBrief,
  PolicyProfile,
  Recommendation,
} from "./types";
import type { QuestionParse } from "./question-parse";

export type DecisionInput = {
  overall: number;
  proofScore: number;
  effectiveCounterRisk: number;
  agentSignals: ConfidenceAgentSignal[];
  parsedQuestion: QuestionParse;
  recordCount: number;
  policyProfile: PolicyProfile;
  hasValidationEvidence: boolean;
  hasLegalResolutionEvidence: boolean;
  hasCompetitiveEvidence?: boolean;
  hasFitEvidence?: boolean;
  skepticRan: boolean;
  confidenceCeiling?: ConfidenceCeiling | null;
  analystRecommendation?: Recommendation;
  diligenceBrief?: DiligenceBrief;
};

export type DecisionResult = {
  recommendation: Recommendation;
  decisionFactors: DecisionFactor[];
  confidenceCeiling?: ConfidenceCeiling | null;
  analystRecommendation?: Recommendation;
};

function findSignal(signals: ConfidenceAgentSignal[], agent: ConfidenceAgentSignal["agent"]) {
  return signals.find((signal) => signal.agent === agent);
}

export function computeDecision(input: DecisionInput): DecisionResult {
  const market = findSignal(input.agentSignals, "Market")?.confidence ?? 0;
  const evidence = findSignal(input.agentSignals, "Evidence")?.confidence ?? 0;
  const factors: DecisionFactor[] = [];

  if (input.effectiveCounterRisk >= 0.65) {
    factors.push({
      id: "counter-elevated",
      label: "Elevated unresolved downside evidence is still capping conviction.",
      impact: "blocking",
      recordIds: input.agentSignals
        .filter((signal) => signal.agent === "Counter" || signal.agent === "Skeptic")
        .flatMap((signal) => (signal.recordId ? [signal.recordId] : [])),
    });
  }

  if (input.parsedQuestion.spendSensitive && !input.hasValidationEvidence) {
    factors.push({
      id: "validation-missing",
      label: "This spend-sensitive question still lacks direct pricing or ROI validation evidence.",
      impact: "blocking",
    });
  }

  if (input.diligenceBrief?.requestedSections.includes("competitive") && !input.hasCompetitiveEvidence) {
    factors.push({
      id: "competitive-unanswered",
      label: "The question asked for a competitive breakdown, but the run still lacks direct competitor evidence.",
      impact: "blocking",
    });
  }

  if (input.diligenceBrief?.requestedSections.includes("fit") && !input.hasFitEvidence) {
    factors.push({
      id: "fit-unanswered",
      label: "The run has not yet validated fit for the requested use case.",
      impact: "blocking",
    });
  }

  if (market >= 0.55) {
    factors.push({
      id: "market-positive",
      label: "Market evidence supports real demand and category fit.",
      impact: "positive",
      recordIds: input.agentSignals
        .filter((signal) => signal.agent === "Market")
        .flatMap((signal) => (signal.recordId ? [signal.recordId] : [])),
    });
  }

  if (evidence >= 0.55) {
    factors.push({
      id: "evidence-positive",
      label: "Implementation and customer evidence show meaningful upside.",
      impact: "positive",
      recordIds: input.agentSignals
        .filter((signal) => signal.agent === "Evidence")
        .flatMap((signal) => (signal.recordId ? [signal.recordId] : [])),
    });
  }

  let recommendation: Recommendation = "need_more_evidence";

  const legalGapUnresolved = input.effectiveCounterRisk >= 0.65 && !input.hasLegalResolutionEvidence;

  if (
    legalGapUnresolved &&
    input.effectiveCounterRisk >= 0.75 &&
    input.overall < 0.4
  ) {
    recommendation = "do_not_buy";
  } else if (
    input.overall >= 0.55 &&
    input.effectiveCounterRisk < 0.35 &&
    market >= 0.55 &&
    evidence >= 0.55 &&
    (!input.parsedQuestion.spendSensitive || input.hasValidationEvidence) &&
    !input.confidenceCeiling
  ) {
    recommendation = "buy";
  } else if (input.overall < 0.25 && input.effectiveCounterRisk >= 0.55) {
    recommendation = "do_not_buy";
  } else if (
    input.overall < 0.4 ||
    input.effectiveCounterRisk >= 0.65 ||
    input.recordCount < 3 ||
    (input.parsedQuestion.spendSensitive && !input.hasValidationEvidence)
  ) {
    recommendation = "need_more_evidence";
  }

  if (
    input.policyProfile === "strict" &&
    recommendation === "buy" &&
    (input.overall < 0.65 || (!input.skepticRan && input.effectiveCounterRisk >= 0.25))
  ) {
    recommendation = "need_more_evidence";
    factors.push({
      id: "strict-policy",
      label: "Strict policy requires stronger certainty before allowing a buy recommendation.",
      impact: "blocking",
    });
  }

  return {
    recommendation,
    decisionFactors: factors.slice(0, 4),
    confidenceCeiling: input.confidenceCeiling,
    analystRecommendation: input.analystRecommendation,
  };
}
