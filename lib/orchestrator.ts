import { evidenceAgent } from "./agents/evidence";
import { marketAgent } from "./agents/market";
import { skepticAgent } from "./agents/skeptic";
import { counterAgent } from "./agents/counter";
import { synthesizeMemo } from "./agents/analyst";
import type { AgentDefinition } from "./agents/shared";
import { assertLiveModeConfigured, resolvePaymentMode, resolvePolicyProfile } from "./config";
import { getLLMProvider } from "./llm";
import { SafeSpend } from "./safespend";
import { extractSubject } from "./subject";
import {
  annotateGapsWithParent,
  counterSignalsFromParent,
  nextContinuationDepth,
  resolveContinuationGap,
  resolveParentRun,
} from "./run-continuation";
import type {
  ConfidenceAgentSignal,
  ConfidenceGap,
  DiligenceRun,
  EvidenceRecord,
  MemoClaim,
  PolicyProfile,
  Recommendation,
  RunEvent,
  ConfidenceGapTheme,
} from "./types";
import { makeId, normalizeQuery } from "./text-utils";
import { estimatePaidSearchCostUsd, paidSearch } from "./x402-search";
import { computeConfidenceModel } from "./confidence-model";
import { parseQuestion } from "./question-parse";
import { buildDiligenceBrief } from "./diligence-brief";
import { buildAgentQuery, buildGapQuery } from "./query-builder";
import { resolveSearchDomains } from "./search-domains";
import { selectFollowUps } from "./follow-up-selection";
import { computeDecision } from "./decision-engine";
import type { CounterRecordSignal, DecisionFactor } from "./types";

type RunOptions = {
  question: string;
  budgetCapUsd: number;
  policyProfile?: PolicyProfile;
  parentRunId?: string;
  parentRun?: DiligenceRun;
  gapId?: string;
  suggestedQuery?: string;
  emit: (event: RunEvent) => void;
};

type MutableState = {
  spentUsd: number;
  paidCalls: number;
  records: EvidenceRecord[];
  agentSignals: ConfidenceAgentSignal[];
  counterSignals: CounterRecordSignal[];
};

function setAgentSignal(
  signals: ConfidenceAgentSignal[],
  next: ConfidenceAgentSignal,
) {
  const index = signals.findIndex((signal) => signal.agent === next.agent);
  if (index >= 0) {
    signals[index] = next;
    return;
  }
  signals.push(next);
}

function baseSignals(): ConfidenceAgentSignal[] {
  return [
    { agent: "Market", ran: false },
    { agent: "Evidence", ran: false },
    { agent: "Counter", ran: false },
    { agent: "Skeptic", ran: false },
  ];
}

function searchOptionsFor(
  agent: AgentDefinition["name"],
  subject: string,
  theme?: ConfidenceGapTheme,
) {
  if (agent === "Market") {
    return {
      include_domains: resolveSearchDomains({ subject, agent, theme }),
    };
  }

  if (agent === "Counter" || theme === "legal_resolution") {
    return {
      search_depth: "advanced" as const,
      include_domains: resolveSearchDomains({ subject, agent, theme }),
      time_range: "year" as const,
    };
  }

  if (theme) {
    return {
      search_depth: "advanced" as const,
      include_domains: resolveSearchDomains({ subject, agent, theme }),
    };
  }

  return {
    search_depth: "advanced" as const,
    include_domains: resolveSearchDomains({ subject, agent, theme }),
  };
}

function allMemoClaims(memoClaims: {
  rationale: MemoClaim;
  strengths: MemoClaim[];
  concerns: MemoClaim[];
  nextSteps: MemoClaim[];
}) {
  return [
    memoClaims.rationale,
    ...memoClaims.strengths,
    ...memoClaims.concerns,
    ...memoClaims.nextSteps,
  ];
}

async function runAgent(params: {
  definition: AgentDefinition;
  subject: string;
  runId: string;
  safeSpend: SafeSpend;
  provider: ReturnType<typeof getLLMProvider>;
  state: MutableState;
  emit: (event: RunEvent) => void;
  projectedCostUsd: number;
  emitConfidence: (reason: string, agent?: ConfidenceAgentSignal["agent"], recordId?: string) => void;
  query: string;
  searchOptions?: Parameters<typeof paidSearch>[0]["options"];
  followUpGapId?: string;
}) {
  const query = params.query;
  const preflight = params.safeSpend.beforePaidCall({
    agent: params.definition.name,
    query,
    spentUsd: params.state.spentUsd,
    projectedCostUsd: params.projectedCostUsd,
    paidCalls: params.state.paidCalls,
  });

  if (params.followUpGapId) {
    params.emit({
      type: "follow_up_started",
      agent: params.definition.name,
      queryPreview: preflight.queryPreview ?? query,
      gapId: params.followUpGapId,
      projectedSpendUsd: preflight.projectedSpendUsd ?? params.state.spentUsd,
    });
  } else {
    params.emit({
      type: "agent_started",
      agent: params.definition.name,
      queryPreview: preflight.queryPreview ?? query,
      projectedSpendUsd: preflight.projectedSpendUsd ?? params.state.spentUsd,
    });
  }

  if (preflight.status === "blocked") {
    params.emit({
      type: "policy_blocked",
      agent: params.definition.name,
      reason: preflight.reason,
      spentUsd: params.state.spentUsd,
    });
    return undefined;
  }

  try {
    const payment = await paidSearch({
      agent: params.definition.name,
      query,
      runId: params.runId,
      callIndex: params.state.paidCalls + 1,
      subject: params.subject,
      options: params.searchOptions,
    });

    const receiptCheck = params.safeSpend.recordReceipt(
      params.definition.name,
      payment.receipt,
    );

    if (receiptCheck.status === "blocked") {
      params.emit({
        type: "policy_blocked",
        agent: params.definition.name,
        reason: receiptCheck.reason,
        spentUsd: params.state.spentUsd,
      });
      return undefined;
    }

    params.emit({
      type: "payment_settled",
      agent: params.definition.name,
      receipt: payment.receipt,
      costUsd: payment.costUsd,
      paymentMode: payment.paymentMode,
    });

    const summaryInput = {
      agent: params.definition.name,
      subject: params.subject,
      query,
      sources: payment.sources,
    };
    const findingMeta = params.provider.summarizeFindingStructured
      ? await params.provider.summarizeFindingStructured(summaryInput)
      : undefined;
    const finding = findingMeta?.summary ?? (await params.provider.summarizeFinding(summaryInput));

    const record: EvidenceRecord = {
      id: makeId("rec", `${params.runId}_${params.definition.name}_${query}`),
      agent: params.definition.name,
      query,
      normalizedQuery: normalizeQuery(query),
      provider: payment.provider,
      paymentMode: payment.paymentMode,
      costUsd: payment.costUsd,
      receipt: payment.receipt,
      finding,
      findingMeta,
      sources: payment.sources,
      policyStatus: "allowed",
    };

    if (record.sources.length === 0) {
      params.emit({
        type: "search_failed",
        agent: params.definition.name,
        query,
        reason: "no_sources",
      });
      return undefined;
    }

    params.state.records.push(record);
    params.state.spentUsd += payment.costUsd;
    params.state.paidCalls += 1;
    setAgentSignal(params.state.agentSignals, {
      agent: params.definition.name,
      ran: true,
      recordId: record.id,
    });

    if (params.followUpGapId) {
      params.emit({
        type: "follow_up_completed",
        agent: params.definition.name,
        gapId: params.followUpGapId,
        record,
        spentUsd: params.state.spentUsd,
        paidCalls: params.state.paidCalls,
      });
    } else {
      params.emit({
        type: "agent_completed",
        agent: params.definition.name,
        record,
        spentUsd: params.state.spentUsd,
        paidCalls: params.state.paidCalls,
      });
    }
    return record;
  } catch (error) {
    params.emit({
      type: "search_failed",
      agent: params.definition.name,
      query,
      reason: error instanceof Error ? error.message : "Unknown search failure.",
    });
    setAgentSignal(params.state.agentSignals, {
      agent: params.definition.name,
      ran: false,
    });
    return undefined;
  }
}

export async function runDiligence({
  question,
  budgetCapUsd,
  policyProfile: requestedPolicyProfile,
  parentRunId,
  parentRun: parentRunFallback,
  gapId,
  suggestedQuery,
  emit,
}: RunOptions): Promise<DiligenceRun> {
  assertLiveModeConfigured();

  const paymentMode = resolvePaymentMode();
  const policyProfile = resolvePolicyProfile(requestedPolicyProfile);
  const provider = getLLMProvider();
  const runId = makeId("run", `${question}_${Date.now()}`);
  const projectedCostUsd = estimatePaidSearchCostUsd();
  const policyMaxCalls = policyProfile === "strict" ? 5 : 6;
  const budgetDerivedCalls = Math.max(3, Math.floor(budgetCapUsd / projectedCostUsd));
  const maxPaidCalls = Math.min(policyMaxCalls, budgetDerivedCalls);
  const safeSpend = new SafeSpend({ budgetCapUsd, maxPaidCalls });
  const parentRun = resolveParentRun(parentRunId, parentRunFallback);
  if (parentRun) {
    safeSpend.seedFromRecords(parentRun.records);
  }
  const parentGap = parentRun ? resolveContinuationGap(parentRun, gapId) : null;
  const subject = parentRun?.subject ?? (await extractSubject(question, provider));
  const parsedQuestion = parseQuestion(question, subject);
  const diligenceBrief = parentRun?.diligenceBrief ?? buildDiligenceBrief(question, parsedQuestion);
  const state: MutableState = {
    spentUsd: parentRun?.spentUsd ?? 0,
    paidCalls: parentRun?.paidCalls ?? 0,
    records: parentRun ? [...parentRun.records] : [],
    agentSignals: parentRun?.confidenceBreakdown?.agentSignals
      ? [...parentRun.confidenceBreakdown.agentSignals]
      : baseSignals(),
    counterSignals: parentRun ? counterSignalsFromParent(parentRun) : [],
  };
  const combinedSafeSpendLog = () =>
    parentRun ? [...parentRun.safeSpendLog, ...safeSpend.getEvents()] : safeSpend.getEvents();

  let finalRecommendationBeforePolicy: Recommendation = "need_more_evidence";
  let finalRecommendationAfterPolicy: Recommendation = "need_more_evidence";
  let finalDecisionFactors: DecisionFactor[] = [];
  let skepticEligible = false;
  let skepticRan = false;
  let skepticSkippedReason: string | undefined;

  const emitConfidence = (
    reason: string,
    agent?: ConfidenceAgentSignal["agent"],
    recordId?: string,
  ) => {
    const snapshot = computeConfidenceModel({
      agentSignals: state.agentSignals,
      memoClaims: [],
      safeSpendLog: combinedSafeSpendLog(),
      recordCount: state.records.length,
      subject,
      policyProfile,
      recommendationBeforePolicy: finalRecommendationBeforePolicy,
      recommendationAfterPolicy: finalRecommendationAfterPolicy,
      skepticEligible,
      skepticRan,
      skepticSkippedReason,
      questionParse: parsedQuestion,
      diligenceBrief,
      counterSignals: state.counterSignals,
    });

    emit({
      type: "confidence_updated",
      overall: snapshot.overall,
      proofScore: snapshot.proofScore,
      reason,
      agent,
      recordId,
    });
  };

  emit({
    type: "run_started",
    runId,
    paymentMode,
    llmProvider: provider.name,
    policyProfile,
    budgetCapUsd,
  });

  const applySignalFromRecord = async (
    agent: ConfidenceAgentSignal["agent"],
    record: EvidenceRecord | undefined,
  ) => {
    if (!record) {
      setAgentSignal(state.agentSignals, {
        agent,
        ran: false,
      });
      return;
    }

    if (agent === "Market" || agent === "Evidence") {
      const confidence = await provider.scoreConfidence(record.finding);
      setAgentSignal(state.agentSignals, {
        agent,
        ran: true,
        confidence,
        recordId: record.id,
      });
      return;
    }

    const negativity = await provider.scoreNegativity(record.finding);
    setAgentSignal(state.agentSignals, {
      agent,
      ran: true,
      negativity,
      recordId: record.id,
    });
    state.counterSignals.push({
      recordId: record.id,
      negativity,
      theme: record.findingMeta?.theme,
    });
  };

  const runGapFollowUp = async (gap: ConfidenceGap) => {
    const definition =
      gap.focusAgent === "Market"
        ? marketAgent
        : gap.focusAgent === "Counter"
          ? counterAgent
          : gap.focusAgent === "Skeptic"
            ? skepticAgent
            : evidenceAgent;
    const followUpRecord = await runAgent({
      definition,
      subject,
      runId,
      safeSpend,
      provider,
      state,
      emit,
      projectedCostUsd,
      emitConfidence,
      query: buildGapQuery(parsedQuestion, gap, diligenceBrief),
      searchOptions: searchOptionsFor(definition.name, subject, gap.theme),
      followUpGapId: gap.id,
    });
    await applySignalFromRecord(definition.name, followUpRecord);
    if (followUpRecord) {
      emitConfidence(
        `${definition.name} follow-up evidence updated the confidence model.`,
        definition.name,
        followUpRecord.id,
      );
    }
    return followUpRecord;
  };

  if (parentRun) {
    const continuationGap = parentGap ?? {
      id: gapId ?? "gap-manual",
      title: "Continuation follow-up",
      estimatedConfidenceGain: 0.06,
      estimatedCostUsd: projectedCostUsd,
      suggestedQuery,
      actionType: "paid_search" as const,
      recordIds: [],
      focusAgent: "Evidence" as const,
    };
    const continuationQuery = suggestedQuery ?? continuationGap.suggestedQuery;

    if (continuationGap.actionType !== "paid_search" || !continuationQuery) {
      throw new Error("This confidence gap cannot be continued as a paid follow-up search.");
    }

    await runGapFollowUp({
      ...continuationGap,
      suggestedQuery: continuationQuery,
      parentRunId: parentRun.id,
    });

    const firstPass = await synthesizeMemo({
      question,
      subject,
      records: state.records,
      provider,
      paymentMode,
      diligenceBrief,
    });
    const firstModel = computeConfidenceModel({
      agentSignals: state.agentSignals,
      memoClaims: allMemoClaims(firstPass.analystOutput),
      nextStepClaims: firstPass.analystOutput.nextSteps,
      safeSpendLog: combinedSafeSpendLog(),
      recordCount: state.records.length,
      subject,
      policyProfile,
      recommendationBeforePolicy: firstPass.analystOutput.recommendation,
      recommendationAfterPolicy: firstPass.analystOutput.recommendation,
      skepticEligible,
      skepticRan,
      skepticSkippedReason,
      questionParse: parsedQuestion,
      diligenceBrief,
      counterSignals: state.counterSignals,
    });
    const decision = computeDecision({
      overall: firstModel.overall,
      proofScore: firstModel.proofScore,
      effectiveCounterRisk: firstModel.effectiveCounterRisk,
      agentSignals: state.agentSignals,
      parsedQuestion,
      recordCount: state.records.length,
      policyProfile,
      hasValidationEvidence: firstModel.hasValidationEvidence,
      hasLegalResolutionEvidence: firstModel.hasLegalResolutionEvidence,
      hasCompetitiveEvidence: firstModel.hasCompetitiveEvidence,
      hasFitEvidence: firstModel.hasFitEvidence,
      skepticRan,
      confidenceCeiling: firstModel.confidenceCeiling,
      analystRecommendation: firstPass.analystOutput.recommendation,
      diligenceBrief,
    });
    finalRecommendationBeforePolicy = firstPass.analystOutput.recommendation;
    finalRecommendationAfterPolicy = decision.recommendation;
    finalDecisionFactors = decision.decisionFactors;

    const { analystOutput: finalAnalystOutput, memo: finalMemo } = await synthesizeMemo({
      question,
      subject,
      records: state.records,
      provider,
      paymentMode,
      serverRecommendation: decision.recommendation,
      decisionFactors: decision.decisionFactors,
      confidenceCeiling: decision.confidenceCeiling,
      openGapTitles: firstModel.confidenceGaps.map((gap) => gap.title),
      diligenceBrief,
    });

    const confidenceModel = computeConfidenceModel({
      agentSignals: state.agentSignals,
      memoClaims: allMemoClaims(finalAnalystOutput),
      nextStepClaims: finalAnalystOutput.nextSteps,
      safeSpendLog: combinedSafeSpendLog(),
      recordCount: state.records.length,
      subject,
      policyProfile,
      recommendationBeforePolicy: firstPass.analystOutput.recommendation,
      recommendationAfterPolicy: decision.recommendation,
      skepticEligible,
      skepticRan,
      skepticSkippedReason,
      questionParse: parsedQuestion,
      diligenceBrief,
      counterSignals: state.counterSignals,
    });

    emit({
      type: "confidence_updated",
      overall: confidenceModel.overall,
      proofScore: confidenceModel.proofScore,
      reason: "Continuation follow-up completed and confidence was recomputed.",
    });

    return {
      id: runId,
      input: question,
      subject,
      diligenceBrief,
      parentRunId: parentRun.id,
      continuedFromGapId: continuationGap.id,
      continuationDepth: nextContinuationDepth(parentRun),
      budgetCapUsd,
      spentUsd: state.spentUsd,
      paidCalls: state.paidCalls,
      paymentMode,
      llmProvider: provider.name,
      policyProfile,
      recommendation: decision.recommendation,
      confidence: confidenceModel.confidenceBreakdown.overall,
      confidenceBreakdown: confidenceModel.confidenceBreakdown,
      proofScore: confidenceModel.proofScore,
      proofScoreComponents: confidenceModel.proofScoreComponents,
      confidenceGaps: confidenceModel.confidenceGaps.map((gap) => ({
        ...gap,
        parentRunId: parentRun.id,
      })),
      decisionFactors: decision.decisionFactors,
      confidenceCeiling: confidenceModel.confidenceCeiling,
      records: state.records,
      memo: finalMemo,
      analystOutput: finalAnalystOutput,
      safeSpendLog: combinedSafeSpendLog(),
    };
  }

  const primaryAgents = [marketAgent, evidenceAgent, counterAgent];
  const primaryResults: Partial<Record<"Market" | "Evidence" | "Counter", EvidenceRecord>> = {};
  const plannedPrimaryQueries = primaryAgents.map((definition) => buildAgentQuery(parsedQuestion, definition.name, diligenceBrief));
  const batchPreflight = safeSpend.batchPreflight({
    agents: primaryAgents.map((definition) => definition.name),
    queries: plannedPrimaryQueries,
    spentUsd: state.spentUsd,
    projectedCostUsdPerCall: projectedCostUsd,
    paidCalls: state.paidCalls,
  });

  if (batchPreflight.status === "blocked") {
    emit({
      type: "policy_blocked",
      agent: primaryAgents[0].name,
      reason: batchPreflight.reason,
      spentUsd: state.spentUsd,
    });
    emitConfidence(batchPreflight.reason, primaryAgents[0].name);
    throw new Error(batchPreflight.reason);
  }

  for (const definition of primaryAgents) {
    const record = await runAgent({
      definition,
      subject,
      runId,
      safeSpend,
      provider,
      state,
      emit,
      projectedCostUsd,
      emitConfidence,
      query: buildAgentQuery(parsedQuestion, definition.name, diligenceBrief),
      searchOptions: searchOptionsFor(definition.name, subject),
    });

    if (record && definition.name !== "Skeptic") {
      primaryResults[definition.name as "Market" | "Evidence" | "Counter"] = record;
    }
  }

  if (state.records.length === 0) {
    throw new Error(
      "No evidence could be gathered because every paid search failed or was blocked.",
    );
  }

  await applySignalFromRecord("Market", primaryResults.Market);
  await applySignalFromRecord("Evidence", primaryResults.Evidence);
  await applySignalFromRecord("Counter", primaryResults.Counter);
  emitConfidence("Core agent confidence signals updated after primary evidence collection.");

  let marketConfidence = state.agentSignals.find((signal) => signal.agent === "Market")?.confidence ?? 0;
  let evidenceConfidence = state.agentSignals.find((signal) => signal.agent === "Evidence")?.confidence ?? 0;
  let counterSeverity = state.agentSignals.find((signal) => signal.agent === "Counter")?.negativity ?? 0;

  const interimMemo = await synthesizeMemo({
    question,
    subject,
    records: state.records,
    provider,
    paymentMode,
    diligenceBrief,
  });
  const interimConfidenceModel = computeConfidenceModel({
    agentSignals: state.agentSignals,
    memoClaims: allMemoClaims(interimMemo.analystOutput),
    nextStepClaims: interimMemo.analystOutput.nextSteps,
    safeSpendLog: combinedSafeSpendLog(),
    recordCount: state.records.length,
    subject,
    policyProfile,
    recommendationBeforePolicy: interimMemo.analystOutput.recommendation,
    recommendationAfterPolicy: interimMemo.analystOutput.recommendation,
    skepticEligible: false,
    skepticRan: false,
    skepticSkippedReason,
    questionParse: parsedQuestion,
    diligenceBrief,
    counterSignals: state.counterSignals,
  });

  const remainingCallHeadroom = Math.max(0, maxPaidCalls - state.paidCalls);
  const remainingBudget = budgetCapUsd - state.spentUsd;
  const followUpCandidates = selectFollowUps({
    records: state.records,
    gaps: interimConfidenceModel.confidenceGaps,
    parsedQuestion,
    remainingBudget,
    remainingPaidCallSlots: remainingCallHeadroom,
    estimatedPaidCallCostUsd: projectedCostUsd,
  });

  if (
    remainingCallHeadroom > 0 &&
    remainingBudget >= projectedCostUsd &&
    (interimConfidenceModel.overall < 0.45 ||
      interimMemo.analystOutput.recommendation === "need_more_evidence")
  ) {
    for (const gap of followUpCandidates) {
      if (state.paidCalls >= maxPaidCalls || state.spentUsd + projectedCostUsd > budgetCapUsd) {
        break;
      }
      await runGapFollowUp(gap);
    }
    marketConfidence = state.agentSignals.find((signal) => signal.agent === "Market")?.confidence ?? marketConfidence;
    evidenceConfidence = state.agentSignals.find((signal) => signal.agent === "Evidence")?.confidence ?? evidenceConfidence;
    counterSeverity = state.agentSignals.find((signal) => signal.agent === "Counter")?.negativity ?? counterSeverity;
  }

  const shouldRunSkeptic =
    Boolean(primaryResults.Market) &&
    Boolean(primaryResults.Evidence) &&
    marketConfidence + evidenceConfidence >= 1.3 &&
    counterSeverity < 0.5 &&
    state.spentUsd + projectedCostUsd <= budgetCapUsd &&
    state.paidCalls < maxPaidCalls;
  skepticEligible = shouldRunSkeptic;

  if (shouldRunSkeptic) {
    const skepticRecord = await runAgent({
      definition: skepticAgent,
      subject,
      runId,
      safeSpend,
      provider,
      state,
      emit,
      projectedCostUsd,
      emitConfidence,
      query: buildAgentQuery(parsedQuestion, "Skeptic", diligenceBrief),
      searchOptions: searchOptionsFor("Skeptic", subject),
    });
    skepticRan = Boolean(skepticRecord);
    if (skepticRecord) {
      await applySignalFromRecord("Skeptic", skepticRecord);
      emitConfidence("Skeptic evidence adjusted the confidence trajectory.", "Skeptic", skepticRecord.id);
    }
  } else {
    skepticSkippedReason =
      state.spentUsd + projectedCostUsd > budgetCapUsd
        ? "Skeptic skipped because the remaining budget would be exceeded."
        : "Skeptic skipped because primary evidence was not strong and consistent enough.";
    emitConfidence(skepticSkippedReason, "Skeptic");
  }

  const firstPass = await synthesizeMemo({
    question,
    subject,
    records: state.records,
    provider,
    paymentMode,
    diligenceBrief,
  });
  const firstModel = computeConfidenceModel({
    agentSignals: state.agentSignals,
    memoClaims: allMemoClaims(firstPass.analystOutput),
    nextStepClaims: firstPass.analystOutput.nextSteps,
    safeSpendLog: combinedSafeSpendLog(),
    recordCount: state.records.length,
    subject,
    policyProfile,
    recommendationBeforePolicy: firstPass.analystOutput.recommendation,
    recommendationAfterPolicy: firstPass.analystOutput.recommendation,
    skepticEligible,
    skepticRan,
    skepticSkippedReason,
    questionParse: parsedQuestion,
    diligenceBrief,
    counterSignals: state.counterSignals,
  });
  const decision = computeDecision({
    overall: firstModel.overall,
    proofScore: firstModel.proofScore,
    effectiveCounterRisk: firstModel.effectiveCounterRisk,
    agentSignals: state.agentSignals,
    parsedQuestion,
    recordCount: state.records.length,
    policyProfile,
      hasValidationEvidence: firstModel.hasValidationEvidence,
      hasLegalResolutionEvidence: firstModel.hasLegalResolutionEvidence,
      hasCompetitiveEvidence: firstModel.hasCompetitiveEvidence,
      hasFitEvidence: firstModel.hasFitEvidence,
      skepticRan,
      confidenceCeiling: firstModel.confidenceCeiling,
      analystRecommendation: firstPass.analystOutput.recommendation,
      diligenceBrief,
    });
  finalRecommendationBeforePolicy = firstPass.analystOutput.recommendation;
  finalRecommendationAfterPolicy = decision.recommendation;
  finalDecisionFactors = decision.decisionFactors;
  const { analystOutput: finalAnalystOutput, memo: finalMemo } = await synthesizeMemo({
    question,
    subject,
    records: state.records,
    provider,
    paymentMode,
    serverRecommendation: decision.recommendation,
    decisionFactors: decision.decisionFactors,
    confidenceCeiling: decision.confidenceCeiling,
    openGapTitles: firstModel.confidenceGaps.map((gap) => gap.title),
    diligenceBrief,
  });

  const confidenceModel = computeConfidenceModel({
    agentSignals: state.agentSignals,
    memoClaims: allMemoClaims(finalAnalystOutput),
    nextStepClaims: finalAnalystOutput.nextSteps,
    safeSpendLog: combinedSafeSpendLog(),
    recordCount: state.records.length,
    subject,
    policyProfile,
    recommendationBeforePolicy: firstPass.analystOutput.recommendation,
    recommendationAfterPolicy: decision.recommendation,
    skepticEligible,
    skepticRan,
    skepticSkippedReason,
    questionParse: parsedQuestion,
    diligenceBrief,
    counterSignals: state.counterSignals,
  });

  emit({
    type: "confidence_updated",
    overall: confidenceModel.overall,
    proofScore: confidenceModel.proofScore,
    reason:
      decision.recommendation !== firstPass.analystOutput.recommendation
        ? "Server decision rules adjusted the final verdict after evidence review."
        : "Final analyst synthesis finalized the confidence score.",
  });

  const run: DiligenceRun = {
    id: runId,
    input: question,
    subject,
    diligenceBrief,
    budgetCapUsd,
    spentUsd: state.spentUsd,
    paidCalls: state.paidCalls,
    paymentMode,
    llmProvider: provider.name,
    policyProfile,
    recommendation: decision.recommendation,
    confidence: confidenceModel.confidenceBreakdown.overall,
    confidenceBreakdown: confidenceModel.confidenceBreakdown,
    proofScore: confidenceModel.proofScore,
    proofScoreComponents: confidenceModel.proofScoreComponents,
    confidenceGaps: annotateGapsWithParent(confidenceModel.confidenceGaps, runId),
    decisionFactors: finalDecisionFactors,
    confidenceCeiling: confidenceModel.confidenceCeiling,
    records: state.records,
    memo: finalMemo,
    analystOutput: finalAnalystOutput,
    safeSpendLog: combinedSafeSpendLog(),
  };

  return run;
}
