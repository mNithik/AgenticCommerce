import type {
  AgentName,
  AnalystOutput,
  DiligenceRun,
  EvidenceRecord,
  PaymentMode,
  PolicyProfile,
  Recommendation,
  RunEvent,
  SafeSpendEvent,
} from "./types";

export type AgentKey = "market" | "evidence" | "counter";
export type TimelineAgentKey = AgentKey | "skeptic";

export type TimelineEventType =
  | "run_started"
  | "agent_started"
  | "payment_settled"
  | "agent_completed"
  | "policy_blocked"
  | "search_failed"
  | "run_error"
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
  spendUsd: number;
  records: number;
  rationale: string;
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
  confidence: number;
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
    case "payment_settled":
      return `${event.agent} settled $${event.costUsd.toFixed(2)} with receipt ${event.receipt}`;
    case "agent_completed":
      return `${event.agent} completed with finding: ${event.record.finding}`;
    case "policy_blocked":
      return `${event.agent} blocked: ${event.reason}`;
    case "search_failed":
      return `${event.agent} search failed for "${event.query}": ${event.reason}`;
    case "run_error":
      return `Run error: ${event.message}`;
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
  return {
    id: run.id,
    subject: run.subject,
    mode: run.paymentMode,
    policy: run.policyProfile,
    recommendation: run.recommendation,
    confidence: Math.round(run.confidence * 100),
    spendUsd: run.spentUsd,
    records: run.records.length,
    rationale: run.analystOutput.rationale.claimText,
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
  analyst: AnalystOutput | null | undefined,
  records: EvidenceRecord[] = [],
): MemoViewModel | null {
  if (!analyst) {
    return null;
  }

  const mapClaims = (claims: AnalystOutput["strengths"]) =>
    claims.map((claim) => claimToView(claim, records));

  return {
    verdict: analyst.recommendation,
    confidence: Math.round(analyst.confidence * 100),
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
