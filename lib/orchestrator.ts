import { evidenceAgent } from "./agents/evidence";
import { marketAgent } from "./agents/market";
import { skepticAgent } from "./agents/skeptic";
import { counterAgent } from "./agents/counter";
import { synthesizeMemo } from "./agents/analyst";
import type { AgentDefinition } from "./agents/shared";
import { assertLiveModeConfigured, resolvePaymentMode } from "./config";
import { getLLMProvider } from "./llm";
import { SafeSpend } from "./safespend";
import { extractSubject } from "./subject";
import type { DiligenceRun, EvidenceRecord, RunEvent } from "./types";
import { makeId, normalizeQuery } from "./utils";
import { paidSearch } from "./x402-search";

type RunOptions = {
  question: string;
  budgetCapUsd: number;
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
}) {
  const query = params.definition.query(params.subject);
  const preflight = params.safeSpend.beforePaidCall({
    agent: params.definition.name,
    query,
    spentUsd: params.state.spentUsd,
    projectedCostUsd: 0.01,
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
  emit,
}: RunOptions): Promise<DiligenceRun> {
  assertLiveModeConfigured();

  const paymentMode = resolvePaymentMode();
  const provider = getLLMProvider();
  const runId = makeId("run", `${question}_${Date.now()}`);
  const safeSpend = new SafeSpend({ budgetCapUsd });
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
    budgetCapUsd,
  });

  const primaryAgents = [marketAgent, evidenceAgent, counterAgent];
  const primaryResults: Partial<Record<"Market" | "Evidence" | "Counter", EvidenceRecord>> = {};

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
    state.spentUsd + 0.01 <= budgetCapUsd;

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
    });
  }

  const { analystOutput, memo } = await synthesizeMemo({
    question,
    subject,
    records: state.records,
    provider,
  });

  const run: DiligenceRun = {
    id: runId,
    input: question,
    subject,
    budgetCapUsd,
    spentUsd: state.spentUsd,
    paidCalls: state.paidCalls,
    paymentMode,
    llmProvider: provider.name,
    recommendation: analystOutput.recommendation,
    confidence: analystOutput.confidence,
    records: state.records,
    memo,
    analystOutput,
    safeSpendLog: safeSpend.getEvents(),
  };

  emit({
    type: "complete",
    run,
  });

  return run;
}
