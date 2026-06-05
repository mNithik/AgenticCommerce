import type {
  AgentName,
  ConfidenceAgentSignal,
  ConfidenceBreakdown,
  ConfidenceCeiling,
  ConfidenceFactor,
  ConfidenceGap,
  ConfidenceGapTheme,
  CounterRecordSignal,
  DiligenceBrief,
  MemoClaim,
  PolicyAdjustment,
  PolicyProfile,
  ProofScoreComponents,
  Recommendation,
  SafeSpendEvent,
} from "./types";
import type { QuestionParse } from "./question-parse";
import { clamp, makeId, unique } from "./text-utils";

type ComputeConfidenceParams = {
  agentSignals: ConfidenceAgentSignal[];
  memoClaims: MemoClaim[];
  nextStepClaims?: MemoClaim[];
  safeSpendLog: SafeSpendEvent[];
  recordCount: number;
  subject?: string;
  policyProfile: PolicyProfile;
  recommendationBeforePolicy: Recommendation;
  recommendationAfterPolicy: Recommendation;
  skepticEligible: boolean;
  skepticRan: boolean;
  skepticSkippedReason?: string;
  questionParse?: QuestionParse;
  diligenceBrief?: DiligenceBrief;
  counterSignals?: CounterRecordSignal[];
};

type ConfidenceModelResult = {
  overall: number;
  citationCoverage: number;
  runCompleteness: number;
  confidenceBreakdown: ConfidenceBreakdown;
  proofScore: number;
  proofScoreComponents: ProofScoreComponents;
  confidenceGaps: ConfidenceGap[];
  effectiveCounterRisk: number;
  confidenceCeiling: ConfidenceCeiling | null;
  hasValidationEvidence: boolean;
  hasLegalResolutionEvidence: boolean;
  hasCompetitiveEvidence: boolean;
  hasFitEvidence: boolean;
};

function findSignal(signals: ConfidenceAgentSignal[], agent: AgentName) {
  return signals.find((signal) => signal.agent === agent);
}

function definedStrings(values: Array<string | undefined>) {
  return values.filter((value): value is string => typeof value === "string");
}

function hasRecordCoverage(claim: MemoClaim) {
  return Array.isArray(claim.recordIds) && claim.recordIds.length > 0;
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function inferSubjectFromClaims(memoClaims: MemoClaim[]) {
  const firstClaim = memoClaims[0]?.claimText ?? "";
  const match = firstClaim.match(/\b([A-Z][A-Za-z0-9.+-]*(?:\s+[A-Z][A-Za-z0-9.+-]*){0,2})\b/);
  return match?.[1] ?? "the vendor";
}

function themeFromText(text: string): ConfidenceGapTheme {
  const lower = text.toLowerCase();
  if (/(lawsuit|legal|privacy|compliance|regulator|settlement)/.test(lower)) {
    return "legal_resolution";
  }
  if (/(pricing|contract|roi|worth|payback|budget)/.test(lower)) {
    return "pricing_validation";
  }
  if (/(implement|onboard|deployment|reference|customer story)/.test(lower)) {
    return "implementation_validation";
  }
  if (/(deliverability|bounce|accuracy|data quality|email)/.test(lower)) {
    return "deliverability_validation";
  }
  return "general_validation";
}

function titleFromTheme(subject: string, theme: ConfidenceGapTheme, questionParse?: QuestionParse) {
  switch (theme) {
    case "legal_resolution":
      return `Validate ${subject} legal and compliance resolution`;
    case "pricing_validation":
      return `Validate ${questionParse?.spendSignal ?? subject} ROI and contract terms`;
    case "implementation_validation":
      return `Validate implementation references for ${questionParse?.companyStage ?? "the target use case"}`;
    case "deliverability_validation":
      return `Validate deliverability and data-quality performance`;
    default:
      return `Validate the next highest-confidence evidence gap`;
  }
}

function buildCoverageFactors(
  memoClaims: MemoClaim[],
  safeSpendLog: SafeSpendEvent[],
  recordCount: number,
) {
  const factors: ConfidenceFactor[] = [];
  const uncoveredClaims = memoClaims.filter((claim) => !hasRecordCoverage(claim));
  const blockedEvents = safeSpendLog.filter((event) => event.status === "blocked");

  if (uncoveredClaims.length > 0) {
    factors.push({
      id: "coverage-claims",
      label: `${uncoveredClaims.length} memo claim${uncoveredClaims.length === 1 ? "" : "s"} lack direct record coverage`,
      impact: clamp(-0.06 * uncoveredClaims.length, -0.18, -0.06),
      recordIds: [],
    });
  }

  if (blockedEvents.length > 0) {
    factors.push({
      id: "coverage-blocked",
      label: `${blockedEvents.length} search block${blockedEvents.length === 1 ? "" : "s"} reduced evidence coverage`,
      impact: clamp(-0.04 * blockedEvents.length, -0.16, -0.04),
      recordIds: [],
    });
  }

  if (recordCount < 2) {
    factors.push({
      id: "coverage-thin",
      label: "Fewer than two evidence records completed",
      impact: -0.12,
      recordIds: [],
    });
  }

  return factors;
}

function buildAgreementFactors(signals: ConfidenceAgentSignal[], effectiveCounterRisk: number) {
  const market = findSignal(signals, "Market")?.confidence ?? 0;
  const evidence = findSignal(signals, "Evidence")?.confidence ?? 0;
  const factors: ConfidenceFactor[] = [];

  if (market >= 0.65 && evidence >= 0.65 && effectiveCounterRisk <= 0.35) {
    factors.push({
      id: "agreement-positive",
      label: "Core agents align on a positive evidence picture",
      impact: 0.08,
      recordIds: unique(
        definedStrings([
          findSignal(signals, "Market")?.recordId,
          findSignal(signals, "Evidence")?.recordId,
        ]),
      ),
    });
  } else {
    const spread = Math.abs(market - evidence) + effectiveCounterRisk;
    if (spread >= 0.4) {
      factors.push({
        id: "agreement-disagreement",
        label: "Agent disagreement or elevated downside evidence lowered certainty",
        impact: -0.08,
        recordIds: unique(
          definedStrings([
            findSignal(signals, "Market")?.recordId,
            findSignal(signals, "Evidence")?.recordId,
            findSignal(signals, "Counter")?.recordId,
            findSignal(signals, "Skeptic")?.recordId,
          ]),
        ),
      });
    }
  }

  return factors;
}

function buildPolicyAdjustments(
  policyProfile: PolicyProfile,
  recommendationBeforePolicy: Recommendation,
  recommendationAfterPolicy: Recommendation,
) {
  const adjustments: PolicyAdjustment[] = [];
  if (
    policyProfile === "strict" &&
    recommendationBeforePolicy === "buy" &&
    recommendationAfterPolicy !== "buy"
  ) {
    adjustments.push({
      rule: "strict_buy_gate",
      delta: -0.08,
      reason: "Strict policy suppressed a buy recommendation.",
    });
  }
  return adjustments;
}

function buildAgentFactors(signals: ConfidenceAgentSignal[], effectiveCounterRisk: number) {
  const factors: ConfidenceFactor[] = [];
  const market = findSignal(signals, "Market");
  const evidence = findSignal(signals, "Evidence");
  const counter = findSignal(signals, "Counter");
  const skeptic = findSignal(signals, "Skeptic");

  if (market?.confidence !== undefined) {
    factors.push({
      id: "agent-market",
      label: `Market confidence ${Math.round(market.confidence * 100)}%`,
      impact: market.confidence * 0.25,
      recordIds: market.recordId ? [market.recordId] : [],
    });
  }
  if (evidence?.confidence !== undefined) {
    factors.push({
      id: "agent-evidence",
      label: `Evidence confidence ${Math.round(evidence.confidence * 100)}%`,
      impact: evidence.confidence * 0.35,
      recordIds: evidence.recordId ? [evidence.recordId] : [],
    });
  }
  if (counter?.negativity !== undefined) {
    factors.push({
      id: "agent-counter",
      label: `Counter risk ${Math.round(effectiveCounterRisk * 100)}%`,
      impact: -effectiveCounterRisk * 0.2,
      recordIds: counter.recordId ? [counter.recordId] : [],
    });
  }
  if (skeptic?.negativity !== undefined) {
    factors.push({
      id: "agent-skeptic",
      label: `Skeptic risk ${Math.round(skeptic.negativity * 100)}%`,
      impact: -skeptic.negativity * 0.1,
      recordIds: skeptic.recordId ? [skeptic.recordId] : [],
    });
  }

  return factors;
}

function computeCitationCoverage(memoClaims: MemoClaim[]) {
  if (memoClaims.length === 0) {
    return 0;
  }
  const covered = memoClaims.filter(hasRecordCoverage).length;
  return clamp(covered / memoClaims.length, 0, 1);
}

function computeRunCompleteness(
  signals: ConfidenceAgentSignal[],
  skepticEligible: boolean,
  skepticRan: boolean,
) {
  const coreAgents = ["Market", "Evidence", "Counter"] as const;
  const coreCompleted = coreAgents.filter((agent) => findSignal(signals, agent)?.ran).length;
  const coreRatio = coreCompleted / coreAgents.length;

  if (!skepticEligible) {
    return clamp(coreRatio, 0, 1);
  }

  return clamp(coreRatio * 0.85 + (skepticRan ? 0.15 : 0), 0, 1);
}

function buildPaidSearchQuery(subject: string, claimText: string, questionParse?: QuestionParse) {
  const theme = themeFromText(claimText);
  const title = titleFromTheme(subject, theme, questionParse);
  return {
    theme,
    title,
    query:
      theme === "legal_resolution"
        ? `${subject} lawsuit settlement status privacy compliance 2026`
        : theme === "pricing_validation"
          ? `${subject} ${questionParse?.spendSignal ?? ""} pricing contract terms ROI implementation references`
          : theme === "implementation_validation"
            ? `${subject} implementation references onboarding case study results`
            : theme === "deliverability_validation"
              ? `${subject} deliverability bounce rate data accuracy customer reviews`
              : `${subject} competitive fit pricing developer workflow`,
  };
}

function gapFromBlockedEvent(
  event: SafeSpendEvent,
  subject: string,
  questionParse?: QuestionParse,
): ConfidenceGap | null {
  if (event.status !== "blocked") {
    return null;
  }

  const queryText =
    event.queryPreview ??
    `${subject} ${event.agent.toLowerCase()} validation follow-up evidence`;
  const built = buildPaidSearchQuery(subject, queryText, questionParse);

  return {
    id: makeId("gap", `${event.agent}_${event.reason}`),
    title: titleFromTheme(subject, built.theme, questionParse),
    detail: `A blocked ${event.agent.toLowerCase()} search prevented this uncertainty from closing.`,
    estimatedConfidenceGain: 0.08,
    estimatedCostUsd: event.projectedSpendUsd ?? 0.01,
    suggestedQuery: event.queryPreview ?? built.query,
    actionType: "paid_search",
    recordIds: [],
    focusAgent: event.agent,
    theme: built.theme,
    priority: 90,
  };
}

function gapFromNextStep(
  claim: MemoClaim,
  subject: string,
  questionParse?: QuestionParse,
): ConfidenceGap | null {
  const lower = claim.claimText.toLowerCase();
  const actionType =
    lower.includes("trial")
      ? "trial"
      : lower.includes("internal") || lower.includes("crm") || lower.includes("pipeline")
        ? "internal_data"
        : "paid_search";

  const built = buildPaidSearchQuery(subject, claim.claimText, questionParse);

  return {
    id: makeId("gap", claim.id),
    title: built.title,
    detail: claim.claimText,
    estimatedConfidenceGain: actionType === "trial" ? 0.1 : 0.06,
    estimatedCostUsd: actionType === "paid_search" ? 0.02 : 0,
    suggestedQuery: actionType === "paid_search" ? built.query : undefined,
    actionType,
    recordIds: claim.recordIds,
    focusAgent: built.theme === "legal_resolution" ? "Counter" : "Evidence",
    theme: built.theme,
    priority: built.theme === "legal_resolution" ? 85 : 65,
  };
}

function computeEffectiveCounterRisk(
  agentSignals: ConfidenceAgentSignal[],
  counterSignals: CounterRecordSignal[] | undefined,
) {
  const directCounter = findSignal(agentSignals, "Counter")?.negativity ?? 0;
  const skeptic = findSignal(agentSignals, "Skeptic")?.negativity ?? 0;
  const perRecord = counterSignals?.map((signal) => signal.negativity) ?? [];
  return Math.max(directCounter, skeptic, ...perRecord, 0);
}

function hasTheme(counterSignals: CounterRecordSignal[] | undefined, theme: ConfidenceGapTheme) {
  return Boolean(counterSignals?.some((signal) => signal.theme === theme));
}

function computeConfidenceCeiling(params: {
  effectiveCounterRisk: number;
  hasLegalResolutionEvidence: boolean;
  hasValidationEvidence: boolean;
  parsedQuestion?: QuestionParse;
  counterSignals?: CounterRecordSignal[];
}) {
  if (params.effectiveCounterRisk >= 0.65 && !params.hasLegalResolutionEvidence) {
    return {
      value: 0.4,
      reason: "Unresolved legal or compliance risk is still capping confidence.",
      recordIds: params.counterSignals?.map((signal) => signal.recordId) ?? [],
    } satisfies ConfidenceCeiling;
  }

  if (params.parsedQuestion?.spendSensitive && !params.hasValidationEvidence) {
    return {
      value: 0.5,
      reason: "Spend-sensitive diligence still lacks direct pricing or ROI validation evidence.",
      recordIds: [],
    } satisfies ConfidenceCeiling;
  }

  return null;
}

export function computeConfidenceModel(
  params: ComputeConfidenceParams,
): ConfidenceModelResult {
  const subject = params.subject ?? inferSubjectFromClaims(params.memoClaims);
  const effectiveCounterRisk = computeEffectiveCounterRisk(params.agentSignals, params.counterSignals);
  const hasValidationEvidence = params.memoClaims.some((claim) =>
    /(pricing|contract|roi|reference|implementation|deliverability|bounce)/i.test(claim.claimText),
  );
  const hasCompetitiveEvidence = params.memoClaims.some((claim) =>
    /(competitor|competitive|vs |cursor|codeium|alternative)/i.test(claim.claimText),
  );
  const hasFitEvidence = params.memoClaims.some((claim) =>
    /(use case|developer|workflow|dashboard|react|typescript|fit)/i.test(claim.claimText),
  );
  const hasLegalResolutionEvidence =
    params.memoClaims.some((claim) => /(settlement|resolved|dismissed|compliance update)/i.test(claim.claimText)) ||
    hasTheme(params.counterSignals, "legal_resolution");

  const agentFactors = buildAgentFactors(params.agentSignals, effectiveCounterRisk);
  const coverageFactors = buildCoverageFactors(
    params.memoClaims,
    params.safeSpendLog,
    params.recordCount,
  );
  const agreementFactors = buildAgreementFactors(params.agentSignals, effectiveCounterRisk);
  const policyAdjustments = buildPolicyAdjustments(
    params.policyProfile,
    params.recommendationBeforePolicy,
    params.recommendationAfterPolicy,
  );

  const baselineFloor = params.recordCount >= 3 ? 0.18 : params.recordCount >= 2 ? 0.1 : 0;
  const rawOverall =
    [...agentFactors, ...coverageFactors, ...agreementFactors].reduce(
      (sum, factor) => sum + factor.impact,
      baselineFloor,
    ) + policyAdjustments.reduce((sum, adjustment) => sum + adjustment.delta, 0);
  const clampedRawOverall = clamp(rawOverall, 0, 1);
  const confidenceCeiling = computeConfidenceCeiling({
    effectiveCounterRisk,
    hasLegalResolutionEvidence,
    hasValidationEvidence,
    parsedQuestion: params.questionParse,
    counterSignals: params.counterSignals,
  });
  const overall = confidenceCeiling
    ? Math.min(clampedRawOverall, confidenceCeiling.value)
    : clampedRawOverall;

  const citationCoverage = computeCitationCoverage(params.memoClaims);
  const runCompleteness = computeRunCompleteness(
    params.agentSignals,
    params.skepticEligible,
    params.skepticRan,
  );
  const proofScore = Math.round(
    clamp(overall * 0.7 + citationCoverage * 0.2 + runCompleteness * 0.1, 0, 1) * 100,
  );

  const allGaps = [
    ...params.safeSpendLog
      .map((event) => gapFromBlockedEvent(event, subject, params.questionParse))
      .filter(Boolean),
    ...(params.nextStepClaims ?? []).map((claim) => gapFromNextStep(claim, subject, params.questionParse)).filter(Boolean),
    !params.skepticRan && params.skepticEligible
      ? ({
          id: "gap-skeptic",
          title:
            params.skepticSkippedReason ??
            "Run skeptic evidence to test optimistic assumptions",
          detail: params.skepticSkippedReason,
          estimatedConfidenceGain: 0.07,
          estimatedCostUsd: 0.01,
          suggestedQuery: `${subject} risks hidden fees failed deployments negative press`,
          actionType: "paid_search" as const,
          recordIds: [],
          focusAgent: "Skeptic" as const,
          theme: "general_validation" as const,
          priority: 60,
        })
      : null,
    effectiveCounterRisk >= 0.7
      ? ({
          id: "gap-counter-deep-dive",
          title: `Validate ${subject} legal and complaint resolution`,
          detail: "High unresolved downside evidence still needs a distinct legal or complaint resolution check.",
          estimatedConfidenceGain: 0.09,
          estimatedCostUsd: 0.01,
          suggestedQuery: `${subject} lawsuit settlement status customer complaints deliverability 2026`,
          actionType: "paid_search" as const,
          recordIds: unique(definedStrings([findSignal(params.agentSignals, "Counter")?.recordId])),
          focusAgent: "Counter" as const,
          theme: "legal_resolution" as const,
          priority: 95,
        })
      : null,
    params.questionParse?.spendSensitive && !hasValidationEvidence
      ? ({
          id: "gap-pricing-validation",
          title: titleFromTheme(subject, "pricing_validation", params.questionParse),
          detail: "The run still needs direct pricing, contract, or ROI validation before a spend-sensitive verdict can firm up.",
          estimatedConfidenceGain: 0.08,
          estimatedCostUsd: 0.02,
          suggestedQuery: `${subject} ${params.questionParse.spendSignal ?? ""} pricing contract terms ROI implementation references`,
          actionType: "paid_search" as const,
          recordIds: [],
          focusAgent: "Evidence" as const,
          theme: "pricing_validation" as const,
          priority: 88,
        })
      : null,
    params.diligenceBrief?.requestedSections.includes("competitive") && !hasCompetitiveEvidence
      ? ({
          id: "gap-competitive-breakdown",
          title: `Validate ${subject} competitive breakdown`,
          detail: "The run still needs direct competitor evidence to answer the question faithfully.",
          estimatedConfidenceGain: 0.08,
          estimatedCostUsd: 0.02,
          suggestedQuery: `${subject} vs Cursor vs Codeium pricing comparison developer tools 2026`,
          actionType: "paid_search" as const,
          recordIds: [],
          focusAgent: "Market" as const,
          theme: "pricing_validation" as const,
          priority: 95,
        })
      : null,
    params.diligenceBrief?.requestedSections.includes("fit") && !hasFitEvidence
      ? ({
          id: "gap-use-case-fit",
          title: `Validate ${subject} fit for the requested use case`,
          detail: "The run still needs use-case-specific implementation or productivity evidence.",
          estimatedConfidenceGain: 0.07,
          estimatedCostUsd: 0.02,
          suggestedQuery: `${subject} ${params.diligenceBrief.useCaseContext ?? ""} TypeScript React developer productivity`,
          actionType: "paid_search" as const,
          recordIds: [],
          focusAgent: "Evidence" as const,
          theme: "implementation_validation" as const,
          priority: 92,
        })
      : null,
  ].filter((gap): gap is ConfidenceGap => Boolean(gap));

  const confidenceGaps = unique(allGaps.map((gap) => gap.id))
    .map((id) => allGaps.find((gap) => gap.id === id)!)
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
    .slice(0, 4);

  const factors = [...agentFactors, ...coverageFactors, ...agreementFactors];
  if (confidenceCeiling) {
    factors.push({
      id: "confidence-ceiling",
      label: confidenceCeiling.reason,
      impact: -(clampedRawOverall - overall),
      recordIds: confidenceCeiling.recordIds ?? [],
    });
  }

  return {
    overall,
    citationCoverage,
    runCompleteness,
    confidenceBreakdown: {
      overall,
      agentSignals: params.agentSignals,
      factors,
      policyAdjustments,
      effectiveCounterRisk,
      confidenceCeiling,
    },
    proofScore,
    proofScoreComponents: {
      overall,
      citationCoverage,
      runCompleteness,
    },
    confidenceGaps,
    effectiveCounterRisk,
    confidenceCeiling,
    hasValidationEvidence,
    hasLegalResolutionEvidence,
    hasCompetitiveEvidence,
    hasFitEvidence,
  };
}
