import type { MemoViewModel, HistoryRow as AdapterHistoryRow } from "./dashboard-adapters";
import type {
  ConfidenceBreakdown,
  ConfidenceGap,
  HealthStatusResponse,
  ObservabilityEvent as ApiObservabilityEvent,
  ProofScoreComponents,
  RunEvent,
  ScheduleTemplate,
  WebhookDeliveryStatus,
} from "./types";
import type {
  ConfidenceBreakdownView,
  ConfidenceGapView,
  FailureSummary,
  Health,
  Memo,
  ObservabilityEvent as UiObservabilityEvent,
  Schedule,
  WebhookEvent,
} from "../components/proofspend/Dashboard";

function claimToUiClaim(claim: MemoViewModel["strengths"][number]) {
  return {
    text: claim.text,
    citations: claim.citations.map((citation) => ({
      agent: citation.agent,
      receipt: citation.receipt,
      recordId: citation.recordId,
    })),
  };
}

export function memoViewToUiMemo(memo: MemoViewModel | null): Memo | null {
  if (!memo) {
    return null;
  }

  return {
    verdict: memo.verdict,
    decisionLabel: memo.decisionLabel,
    questionRecap: memo.questionRecap,
    confidence: memo.confidence,
    proofScore: memo.proofScore,
    proofScoreComponents: memo.proofScoreComponents,
    confidenceBreakdown: toUiConfidenceBreakdown(memo.confidenceBreakdown),
    confidenceGaps: memo.confidenceGaps.map(toUiConfidenceGap),
    decisionFactors: memo.decisionFactors.map((factor) => ({
      id: factor.id,
      label: factor.label,
      impact: factor.impact,
      recordIds: factor.recordIds ?? [],
    })),
    confidenceCeiling: memo.confidenceCeiling
      ? {
          value: Math.round(memo.confidenceCeiling.value * 100),
          reason: memo.confidenceCeiling.reason,
          recordIds: memo.confidenceCeiling.recordIds ?? [],
        }
      : null,
    rationale: memo.rationale.text,
    strengths: memo.strengths.map(claimToUiClaim),
    concerns: memo.concerns.map(claimToUiClaim),
    nextSteps: memo.nextSteps.map(claimToUiClaim),
  };
}

function toUiConfidenceBreakdown(
  breakdown: ConfidenceBreakdown,
): ConfidenceBreakdownView {
  return {
    overall: Math.round(breakdown.overall * 100),
    agentSignals: breakdown.agentSignals.map((signal) => ({
      agent: signal.agent,
      ran: signal.ran,
      confidence:
        typeof signal.confidence === "number"
          ? Math.round(signal.confidence * 100)
          : undefined,
      negativity:
        typeof signal.negativity === "number"
          ? Math.round(signal.negativity * 100)
          : undefined,
      recordId: signal.recordId,
    })),
    factors: breakdown.factors.map((factor) => ({
      id: factor.id,
      label: factor.label,
      impact: Math.round(factor.impact * 100),
      recordIds: factor.recordIds ?? [],
    })),
    policyAdjustments: breakdown.policyAdjustments.map((adjustment) => ({
      ...adjustment,
      delta: Math.round(adjustment.delta * 100),
    })),
    effectiveCounterRisk:
      typeof breakdown.effectiveCounterRisk === "number"
        ? Math.round(breakdown.effectiveCounterRisk * 100)
        : undefined,
    confidenceCeiling: breakdown.confidenceCeiling
      ? {
          value: Math.round(breakdown.confidenceCeiling.value * 100),
          reason: breakdown.confidenceCeiling.reason,
          recordIds: breakdown.confidenceCeiling.recordIds ?? [],
        }
      : null,
  };
}

function toUiConfidenceGap(gap: ConfidenceGap): ConfidenceGapView {
  return {
    ...gap,
    estimatedConfidenceGain: Math.round(gap.estimatedConfidenceGain * 100),
  };
}

export function healthToUiHealth(health: HealthStatusResponse | null): Health | null {
  if (!health) {
    return null;
  }

  return {
    paymentMode: health.paymentMode,
    paymentConfigured: health.liveConfigured,
    policyProfile: health.policyProfile,
    llmProvider: health.llmProvider,
    snapshotSigningAvailable: health.snapshotSigningAvailable,
    apiAuthRequired: health.apiAuthRequired,
    uptimeSeconds: health.uptimeSeconds,
    rateLimits: {
      runDiligence: { limit: health.rateLimits.runDiligence?.limit ?? 8 },
    },
    readinessSummary: health.readinessSummary,
    ready: health.paymentMode === "mock" || health.liveConfigured,
    estimatedConfidenceRange: {
      baselineMin: Math.round(health.estimatedConfidenceRange.baselineMin * 100),
      baselineMax: Math.round(health.estimatedConfidenceRange.baselineMax * 100),
      upperBoundWithSkeptic: Math.round(
        health.estimatedConfidenceRange.upperBoundWithSkeptic * 100,
      ),
    },
  };
}

export function scheduleToUiSchedule(schedule: ScheduleTemplate): Schedule {
  return {
    id: schedule.id,
    name: schedule.label,
    cron: `every ${schedule.intervalMinutes}m`,
    question: schedule.question,
    budgetCapUsd: schedule.budgetCapUsd,
    policyProfile: schedule.policyProfile,
    enabled: schedule.enabled,
    lastRunAt: schedule.lastRunAt
      ? new Date(schedule.lastRunAt).toLocaleString()
      : undefined,
    nextRunAt: schedule.enabled
      ? new Date(schedule.nextRunAt).toLocaleString()
      : "Paused",
  };
}

export function webhookToUiEvent(delivery: WebhookDeliveryStatus): WebhookEvent {
  return {
    id: delivery.id,
    url: delivery.callbackUrl,
    status:
      delivery.status === "skipped"
        ? "pending"
        : delivery.status === "delivered"
          ? "delivered"
          : "failed",
    attempts: delivery.attempts,
    lastAt: new Date(delivery.deliveredAt).toLocaleString(),
    statusCode: delivery.httpStatus,
    error: delivery.error,
  };
}

export function observabilityToUiEvent(
  event: ApiObservabilityEvent,
): UiObservabilityEvent {
  return {
    id: event.id,
    t: new Date(event.timestamp).toLocaleString(),
    level:
      event.status === "error"
        ? "error"
        : event.status === "success"
          ? "info"
          : "warn",
    source: event.category,
    message: event.message,
  };
}

export function historyRowToUi(row: AdapterHistoryRow, index: number) {
  return {
    id: row.id,
    subject: row.subject,
    question: row.question,
    budget: row.budget,
    policy: row.policy,
    records: row.records,
    spendUsd: row.spendUsd,
    confidence: row.confidence,
    proofScore: row.proofScore,
    recommendation: row.recommendation,
    mode: row.mode,
    at: index === 0 ? "latest" : `run ${row.id.slice(0, 8)}`,
  };
}

export function buildFailureSummary(
  events: RunEvent[],
  runComplete: boolean,
): FailureSummary {
  const searchFailed = events.filter((event) => event.type === "search_failed").length;
  const policyBlocked = events.filter((event) => event.type === "policy_blocked").length;
  const runErrors = events.filter((event) => event.type === "run_error").length;
  const webhookFailed = events.filter(
    (event) => event.type === "webhook_delivery" && event.delivery.status === "failed",
  ).length;

  const byType = [
    searchFailed > 0 ? { type: "search_failed", count: searchFailed } : null,
    policyBlocked > 0 ? { type: "policy_blocked", count: policyBlocked } : null,
    runErrors > 0 ? { type: "run_error", count: runErrors } : null,
    webhookFailed > 0 ? { type: "webhook_failed", count: webhookFailed } : null,
  ].filter((entry): entry is { type: string; count: number } => entry !== null);

  return {
    windowLabel: runComplete ? "completed run" : "current run",
    total: searchFailed + policyBlocked + runErrors + webhookFailed,
    byType,
  };
}
