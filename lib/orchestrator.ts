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
import type { DiligenceRun, EvidenceRecord, PolicyProfile, RunEvent } from "./types";
import { makeId, normalizeQuery } from "./utils";
import { estimatePaidSearchCostUsd, paidSearch } from "./x402-search";

type RunOptions = {
  question: string;
  budgetCapUsd: number;
  policyProfile?: PolicyProfile;
  emit: (event: RunEvent) => void;
};

type MutableState = {
  spentUsd: number;
  paidCalls: number;
  records: EvidenceRecord[];
};

async function runAgent(params: {
  definition: AgentDefinition;
  question: string;
  subject: string;
  runId: string;
  safeSpend: SafeSpend;
  provider: ReturnType<typeof getLLMProvider>;
  state: MutableState;
  emit: (event: RunEvent) => void;
  projectedCostUsd: number;
}) {
  const query = params.definition.query(params.subject);
  const preflight = params.safeSpend.beforePaidCall({
    agent: params.definition.name,
    query,
    spentUsd: params.state.spentUsd,
    projectedCostUsd: params.projectedCostUsd,
    paidCalls: params.state.paidCalls,
  });

  params.emit({
    type: "agent_started",
    agent: params.definition.name,
    queryPreview: preflight.queryPreview ?? query,
    projectedSpendUsd: preflight.projectedSpendUsd ?? params.state.spentUsd,
  });

  if (preflight.status === "blocked") {
    params.emit({
      type: "policy_blocked",
      agent: params.definition.name,
      reason: preflight.reason,
      spentUsd: params.state.spentUsd,
    });
    return undefined;
  }

  const payment = await paidSearch({
    agent: params.definition.name,
    query,
    runId: params.runId,
    callIndex: params.state.paidCalls + 1,
    subject: params.subject,
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
    throw new Error(`Duplicate receipt detected for ${params.definition.name}.`);
  }

  params.emit({
    type: "payment_settled",
    agent: params.definition.name,
    receipt: payment.receipt,
    costUsd: payment.costUsd,
    paymentMode: payment.paymentMode,
  });

  const finding = await params.provider.summarizeFinding({
    agent: params.definition.name,
    subject: params.subject,
    query,
    sources: payment.sources,
  });

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
    sources: payment.sources,
    policyStatus: "allowed",
  };

  params.state.records.push(record);
  params.state.spentUsd += payment.costUsd;
  params.state.paidCalls += 1;

  params.emit({
    type: "agent_completed",
    agent: params.definition.name,
    record,
    spentUsd: params.state.spentUsd,
    paidCalls: params.state.paidCalls,
  });

  return record;
}

export async function runDiligence({
  question,
  budgetCapUsd,
  policyProfile: requestedPolicyProfile,
  emit,
}: RunOptions): Promise<DiligenceRun> {
  assertLiveModeConfigured();

  const paymentMode = resolvePaymentMode();
  const policyProfile = resolvePolicyProfile(requestedPolicyProfile);
  const provider = getLLMProvider();
  const runId = makeId("run", `${question}_${Date.now()}`);
  const maxPaidCalls = policyProfile === "strict" ? 3 : 4;
  const projectedCostUsd = estimatePaidSearchCostUsd();
  const safeSpend = new SafeSpend({ budgetCapUsd, maxPaidCalls });
  const subject = await extractSubject(question, provider);
  const state: MutableState = {
    spentUsd: 0,
    paidCalls: 0,
    records: [],
  };

  emit({
    type: "run_started",
    runId,
    paymentMode,
    llmProvider: provider.name,
    policyProfile,
    budgetCapUsd,
  });

  const primaryAgents = [marketAgent, evidenceAgent, counterAgent];
  const primaryResults: Partial<Record<"Market" | "Evidence" | "Counter", EvidenceRecord>> = {};
  const plannedPrimaryQueries = primaryAgents.map((definition) => definition.query(subject));
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
    throw new Error(batchPreflight.reason);
  }

  for (const definition of primaryAgents) {
    const record = await runAgent({
      definition,
      question,
      subject,
      runId,
      safeSpend,
      provider,
      state,
      emit,
      projectedCostUsd,
    });

    if (record && definition.name !== "Skeptic") {
      primaryResults[definition.name as "Market" | "Evidence" | "Counter"] = record;
    }
  }

  const marketFinding = primaryResults.Market?.finding ?? "";
  const evidenceFinding = primaryResults.Evidence?.finding ?? "";
  const counterFinding = primaryResults.Counter?.finding ?? "";

  const marketConfidence = await provider.scoreConfidence(marketFinding);
  const evidenceConfidence = await provider.scoreConfidence(evidenceFinding);
  const counterSeverity = await provider.scoreNegativity(counterFinding);
  const shouldRunSkeptic =
    marketConfidence + evidenceConfidence >= 1.3 &&
    counterSeverity < 0.5 &&
    state.spentUsd + projectedCostUsd <= budgetCapUsd;

  if (shouldRunSkeptic) {
    await runAgent({
      definition: skepticAgent,
      question,
      subject,
      runId,
      safeSpend,
      provider,
      state,
      emit,
      projectedCostUsd,
    });
  }

  const { analystOutput, memo } = await synthesizeMemo({
    question,
    subject,
    records: state.records,
    provider,
    paymentMode,
  });

  const finalRecommendation =
    policyProfile === "strict" &&
    analystOutput.recommendation === "buy" &&
    (analystOutput.confidence < 0.8 || state.records.some((record) => record.agent === "Counter"))
      ? "need_more_evidence"
      : analystOutput.recommendation;
  const finalAnalystOutput =
    finalRecommendation === analystOutput.recommendation
      ? analystOutput
      : { ...analystOutput, recommendation: finalRecommendation };
  const finalMemo =
    finalRecommendation === analystOutput.recommendation
      ? memo
      : memo.replace(
          `Recommendation: **${analystOutput.recommendation}**`,
          `Recommendation: **${finalRecommendation}**`,
        );

  const run: DiligenceRun = {
    id: runId,
    input: question,
    subject,
    budgetCapUsd,
    spentUsd: state.spentUsd,
    paidCalls: state.paidCalls,
    paymentMode,
    llmProvider: provider.name,
    policyProfile,
    recommendation: finalRecommendation,
    confidence: analystOutput.confidence,
    records: state.records,
    memo: finalMemo,
    analystOutput: finalAnalystOutput,
    safeSpendLog: safeSpend.getEvents(),
  };

  emit({
    type: "complete",
    run,
  });

  return run;
}
