import type {
  AgentName,
  AnalystOutput,
  ConfidenceBreakdown,
  ConfidenceCeiling,
  ConfidenceGap,
  DecisionFactor,
  DiligenceRun,
  EvidenceRecord,
  PaymentMode,
  PolicyProfile,
  ProofScoreComponents,
  Recommendation,
  RunEvent,
  SafeSpendEvent,
} from "./types";

export type AgentKey = "market" | "evidence" | "counter";
export type TimelineAgentKey = AgentKey | "skeptic";

export type TimelineEventType =
  | "run_started"
  | "agent_started"
  | "follow_up_started"
  | "payment_settled"
  | "agent_completed"
  | "follow_up_completed"
  | "policy_blocked"
  | "search_failed"
  | "run_error"
  | "confidence_updated"
  | "webhook_delivery"
  | "complete";

export interface TimelineEvent {
  t: string;
  agent: TimelineAgentKey | "system";
  type: TimelineEventType;
  text: string;
  cost?: number;
  receipt?: string;
}

export interface EvidenceRow {
  id: string;
  agent: AgentKey;
  query: string;
  finding: string;
  sources: { label: string; url: string }[];
  receipt: string;
  cost: number;
  paymentMode: PaymentMode;
}

export interface HistoryRow {
  id: string;
  subject: string;
  question: string;
  budget: number;
  policy: PolicyProfile;
  paidCalls: number;
  records: number;
  spendUsd: number;
  confidence: number;
  proofScore: number;
  recommendation: Recommendation;
  mode: PaymentMode;
  webhookStatus?: "delivered" | "failed" | "skipped";
}

export interface SafeSpendRow {
  kind: SafeSpendEvent["action"];
  agent: AgentKey | "system";
  action: string;
  status: "allowed" | "blocked";
  reason: string;
  queryPreview?: string;
  projectedSpendUsd: number;
}

export interface CompareVendor {
  id: string;
  subject: string;
  mode: PaymentMode;
  policy: PolicyProfile;
  recommendation: Recommendation;
  confidence: number;
  proofScore: number;
  spendUsd: number;
  records: number;
  rationale: string;
  topFactors: string[];
  decisionFactors: string[];
  continuationDepth?: number;
  parentRunId?: string;
  confidenceBreakdown: ConfidenceBreakdown;
  confidenceGaps: ConfidenceGap[];
  confidenceCeiling?: ConfidenceCeiling | null;
}

export interface MemoCitationView {
  recordId: string;
  agent: AgentKey;
  receipt: string;
  paymentMode: PaymentMode;
}

export interface MemoClaimView {
  text: string;
  recordIds: string[];
  citations: MemoCitationView[];
}

export interface MemoViewModel {
  verdict: Recommendation;
  decisionLabel?: string;
  questionRecap?: string;
  confidence: number;
  proofScore: number;
  proofScoreComponents: ProofScoreComponents;
  confidenceBreakdown: ConfidenceBreakdown;
  confidenceGaps: ConfidenceGap[];
  decisionFactors: DecisionFactor[];
  confidenceCeiling?: ConfidenceCeiling | null;
  rationale: MemoClaimView;
  strengths: MemoClaimView[];
  concerns: MemoClaimView[];
  nextSteps: MemoClaimView[];
}

const AGENT_KEY: Record<AgentName, AgentKey | "skeptic"> = {
  Market: "market",
  Evidence: "evidence",
  Counter: "counter",
  Skeptic: "skeptic",
};

function fallbackConfidenceBreakdown(run: DiligenceRun): ConfidenceBreakdown {
  return {
    overall: typeof run.confidence === "number" ? run.confidence : 0,
    agentSignals: [
      { agent: "Market", ran: run.records.some((record) => record.agent === "Market") },
      { agent: "Evidence", ran: run.records.some((record) => record.agent === "Evidence") },
      { agent: "Counter", ran: run.records.some((record) => record.agent === "Counter") },
      { agent: "Skeptic", ran: run.records.some((record) => record.agent === "Skeptic") },
    ],
    factors: [],
    policyAdjustments: [],
  };
}

function fallbackProofScoreComponents(run: DiligenceRun): ProofScoreComponents {
  const overall = typeof run.confidence === "number" ? run.confidence : 0;
  return {
    overall,
    citationCoverage: 0,
    runCompleteness: run.records.length > 0 ? 1 : 0,
  };
}

function getConfidenceBreakdown(run: DiligenceRun): ConfidenceBreakdown {
  return run.confidenceBreakdown ?? fallbackConfidenceBreakdown(run);
}

function getProofScoreComponents(run: DiligenceRun): ProofScoreComponents {
  return run.proofScoreComponents ?? fallbackProofScoreComponents(run);
}

function getProofScore(run: DiligenceRun): number {
  if (typeof run.proofScore === "number") {
    return run.proofScore;
  }

  const components = getProofScoreComponents(run);
  return Math.round(
    Math.max(
      0,
      Math.min(
        100,
        (components.overall * 0.7 +
          components.citationCoverage * 0.2 +
          components.runCompleteness * 0.1) *
          100,
      ),
    ),
  );
}

function getConfidenceGaps(run: DiligenceRun): ConfidenceGap[] {
  return run.confidenceGaps ?? [];
}

function toSafeSpendAgent(agent: AgentName): AgentKey {
  const key = AGENT_KEY[agent];
  return key === "skeptic" ? "counter" : key;
}

function formatTimelineStamp(index: number) {
  const seconds = index * 2;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}.${index % 10}`;
}

function renderRunEventText(event: RunEvent): string {
  switch (event.type) {
    case "run_started":
      return `Run started in ${event.paymentMode} mode with ${event.llmProvider} using the ${event.policyProfile} policy profile.`;
    case "agent_started":
      return `${event.agent} researching: ${event.queryPreview}`;
    case "follow_up_started":
      return `${event.agent} bought a follow-up search for ${event.gapId}: ${event.queryPreview}`;
    case "payment_settled":
      return `${event.agent} settled $${event.costUsd.toFixed(2)} with receipt ${event.receipt}`;
    case "agent_completed":
      return `${event.agent} completed with finding: ${event.record.finding}`;
    case "follow_up_completed":
      return `${event.agent} follow-up completed for ${event.gapId}: ${event.record.finding}`;
    case "policy_blocked":
      return `${event.agent} blocked: ${event.reason}`;
    case "search_failed":
      return `${event.agent} search failed for "${event.query}": ${event.reason}`;
    case "run_error":
      return `Run error: ${event.message}`;
    case "confidence_updated":
      return `${event.reason} Score ${Math.round(event.overall * 100)}%, proof ${event.proofScore}.`;
    case "webhook_delivery":
      return `Webhook ${event.delivery.status} after ${event.delivery.attempts} attempt${event.delivery.attempts === 1 ? "" : "s"} for ${event.delivery.callbackUrl}`;
    case "complete":
      return `Run complete with ${event.run.records.length} evidence records.`;
  }
}

function timelineAgent(event: RunEvent): TimelineEvent["agent"] {
  if ("agent" in event && event.agent) {
    return AGENT_KEY[event.agent];
  }
  return "system";
}

export function runEventsToTimeline(events: RunEvent[]): TimelineEvent[] {
  return events.map((event, index) => ({
    t: formatTimelineStamp(index),
    agent: timelineAgent(event),
    type: event.type,
    text: renderRunEventText(event),
    cost: event.type === "payment_settled" ? event.costUsd : undefined,
    receipt: event.type === "payment_settled" ? event.receipt : undefined,
  }));
}

export function recordToEvidenceRow(record: EvidenceRecord): EvidenceRow | null {
  const agent = AGENT_KEY[record.agent];
  if (agent === "skeptic") {
    return null;
  }

  return {
    id: record.id,
    agent,
    query: record.query,
    finding: record.finding,
    sources: record.sources.map((source) => ({
      label: source.title,
      url: source.url,
    })),
    receipt: record.receipt,
    cost: record.costUsd,
    paymentMode: record.paymentMode,
  };
}

export function runToEvidenceRows(run: DiligenceRun | null): EvidenceRow[] {
  if (!run) {
    return [];
  }

  return run.records
    .map(recordToEvidenceRow)
    .filter((row): row is EvidenceRow => row !== null);
}

export function runToHistoryRow(run: DiligenceRun): HistoryRow {
  return {
    id: run.id,
    subject: run.subject,
    question: run.input,
    budget: run.budgetCapUsd,
    policy: run.policyProfile,
    paidCalls: run.paidCalls,
    records: run.records.length,
    spendUsd: run.spentUsd,
    confidence: Math.round(run.confidence * 100),
    proofScore: getProofScore(run),
    recommendation: run.recommendation,
    mode: run.paymentMode,
    webhookStatus: run.webhookDelivery?.status,
  };
}

export function safeSpendToRows(events: SafeSpendEvent[]): SafeSpendRow[] {
  return events.map((event) => ({
    kind: event.action,
    agent: toSafeSpendAgent(event.agent),
    action: event.action,
    status: event.status,
    reason: event.reason,
    queryPreview: event.queryPreview,
    projectedSpendUsd: event.projectedSpendUsd ?? 0,
  }));
}

export function runToCompareVendor(run: DiligenceRun): CompareVendor {
  const confidenceBreakdown = getConfidenceBreakdown(run);
  return {
    id: run.id,
    subject: run.subject,
    mode: run.paymentMode,
    policy: run.policyProfile,
    recommendation: run.recommendation,
    confidence: Math.round(run.confidence * 100),
    proofScore: getProofScore(run),
    spendUsd: run.spentUsd,
    records: run.records.length,
    rationale: run.analystOutput.rationale.claimText,
    topFactors: confidenceBreakdown.factors
      .slice()
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .slice(0, 2)
      .map((factor) => factor.label),
    decisionFactors: (run.decisionFactors ?? []).slice(0, 3).map((factor) => factor.label),
    continuationDepth: run.continuationDepth,
    parentRunId: run.parentRunId,
    confidenceBreakdown,
    confidenceGaps: getConfidenceGaps(run),
    confidenceCeiling: run.confidenceCeiling ?? confidenceBreakdown.confidenceCeiling ?? null,
  };
}

function claimToView(
  claim: AnalystOutput["rationale"],
  records: EvidenceRecord[],
): MemoClaimView {
  const citations = claim.recordIds
    .map((recordId) => records.find((record) => record.id === recordId))
    .filter((record): record is EvidenceRecord => Boolean(record))
    .map((record) => ({
      recordId: record.id,
      agent: AGENT_KEY[record.agent] === "skeptic" ? "counter" : (AGENT_KEY[record.agent] as AgentKey),
      receipt: record.receipt,
      paymentMode: record.paymentMode,
    }));

  return {
    text: claim.claimText,
    recordIds: claim.recordIds,
    citations,
  };
}

export function analystToMemoView(
  run: DiligenceRun | null | undefined,
): MemoViewModel | null {
  if (!run?.analystOutput) {
    return null;
  }

  const analyst = run.analystOutput;
  const records = run.records;
  const confidenceBreakdown = getConfidenceBreakdown(run);
  const proofScoreComponents = getProofScoreComponents(run);

  const mapClaims = (claims: AnalystOutput["strengths"]) =>
    claims.map((claim) => claimToView(claim, records));

  return {
    verdict: analyst.recommendation,
    decisionLabel:
      run.diligenceBrief?.decisionFrame === "wait"
        ? analyst.recommendation === "need_more_evidence"
          ? "WAIT"
          : analyst.recommendation === "buy"
            ? "BUY"
            : "AVOID"
        : undefined,
    questionRecap: run.diligenceBrief?.useCaseContext
      ? `${run.subject} for ${run.diligenceBrief.useCaseContext}`
      : run.subject,
    confidence: Math.round(confidenceBreakdown.overall * 100),
    proofScore: getProofScore(run),
    proofScoreComponents,
    confidenceBreakdown,
    confidenceGaps: getConfidenceGaps(run),
    decisionFactors: run.decisionFactors ?? [],
    confidenceCeiling: run.confidenceCeiling ?? confidenceBreakdown.confidenceCeiling ?? null,
    rationale: claimToView(analyst.rationale, records),
    strengths: mapClaims(analyst.strengths),
    concerns: mapClaims(analyst.concerns),
    nextSteps: mapClaims(analyst.nextSteps),
  };
}

export function paymentModeToUi(mode: PaymentMode | null): "mock" | "live" | "waiting" {
  if (mode === "mock" || mode === "live") {
    return mode;
  }
  return "waiting";
}
