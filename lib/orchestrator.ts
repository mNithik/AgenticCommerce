import { evidenceAgent } from "@/lib/agents/evidence";
import { marketAgent } from "@/lib/agents/market";
import { skepticAgent } from "@/lib/agents/skeptic";
import { counterAgent } from "@/lib/agents/counter";
import { synthesizeMemo } from "@/lib/agents/analyst";
import type { AgentDefinition } from "@/lib/agents/shared";
import { assertLiveModeConfigured, config, resolvePaymentMode } from "@/lib/config";
import { getLLMProvider } from "@/lib/llm";
import { SafeSpend } from "@/lib/safespend";
import { extractSubject } from "@/lib/subject";
import type { AgentName, DiligenceRun, EvidenceRecord, RunEvent } from "@/lib/types";
import { makeId, normalizeQuery } from "@/lib/utils";
import { paidSearch } from "@/lib/x402-search";

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
}): Promise<EvidenceRecord[]> {
  const queries = params.definition.queries(params.subject);
  const produced: EvidenceRecord[] = [];

  params.emit({
    type: "agent_started",
    agent: params.definition.name,
    queryPreview: queries[0] ?? params.subject,
    projectedSpendUsd: params.state.spentUsd + 0.01,
  });

  // Probe the angle from several directions; each sub-query is its own paid
  // search and its own evidence record.
  for (const query of queries) {
    const preflight = params.safeSpend.beforePaidCall({
      agent: params.definition.name,
      query,
      spentUsd: params.state.spentUsd,
      projectedCostUsd: 0.01,
      paidCalls: params.state.paidCalls,
    });

    if (preflight.status === "blocked") {
      params.emit({
        type: "policy_blocked",
        agent: params.definition.name,
        reason: preflight.reason,
        spentUsd: params.state.spentUsd,
      });
      continue;
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
      continue;
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
    produced.push(record);

    params.emit({
      type: "agent_completed",
      agent: params.definition.name,
      record,
      spentUsd: params.state.spentUsd,
      paidCalls: params.state.paidCalls,
    });
  }

  return produced;
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
  const safeSpend = new SafeSpend({ budgetCapUsd, maxPaidCalls: config.maxPaidCalls });
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

  for (const definition of primaryAgents) {
    await runAgent({
      definition,
      question,
      subject,
      runId,
      safeSpend,
      provider,
      state,
      emit,
    });
  }

  // Aggregate every record an agent produced (now multiple per agent) before scoring.
  const findingFor = (agent: AgentName) =>
    state.records
      .filter((record) => record.agent === agent)
      .map((record) => record.finding)
      .join("\n\n");

  const marketConfidence = await provider.scoreConfidence(findingFor("Market"));
  const evidenceConfidence = await provider.scoreConfidence(findingFor("Evidence"));
  const counterSeverity = await provider.scoreNegativity(findingFor("Counter"));
  const skepticCostUsd = skepticAgent.queries(subject).length * 0.01;
  const shouldRunSkeptic =
    marketConfidence + evidenceConfidence >= 1.3 &&
    counterSeverity < 0.5 &&
    state.spentUsd + skepticCostUsd <= budgetCapUsd;

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
