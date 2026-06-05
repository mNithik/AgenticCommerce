import { addRecentRun, getRecentRunById } from "./recent-runs";
import type { ConfidenceGap, CounterRecordSignal, DiligenceRun } from "./types";

export function resolveParentRun(
  parentRunId?: string | null,
  fallback?: DiligenceRun | null,
) {
  if (!parentRunId) {
    return null;
  }

  const cached = getRecentRunById(parentRunId);
  if (cached) {
    return cached;
  }

  if (fallback?.id === parentRunId) {
    addRecentRun(fallback);
    return fallback;
  }

  throw new Error(
    "The parent run could not be found in recent history. Reopen the original run and try again.",
  );
}

export function counterSignalsFromParent(parentRun: DiligenceRun): CounterRecordSignal[] {
  const negativityByRecordId = new Map<string, number>();

  for (const signal of parentRun.confidenceBreakdown.agentSignals) {
    if (
      (signal.agent === "Counter" || signal.agent === "Skeptic") &&
      signal.recordId &&
      typeof signal.negativity === "number"
    ) {
      negativityByRecordId.set(signal.recordId, signal.negativity);
    }
  }

  return parentRun.records
    .filter((record) => record.agent === "Counter" || record.agent === "Skeptic")
    .map((record) => ({
      recordId: record.id,
      negativity: negativityByRecordId.get(record.id) ?? 0,
      theme: record.findingMeta?.theme,
    }));
}

export function resolveContinuationGap(
  parentRun: DiligenceRun,
  gapId?: string | null,
) {
  if (!gapId) {
    return null;
  }

  const gap = parentRun.confidenceGaps.find((candidate) => candidate.id === gapId);
  if (!gap) {
    throw new Error(
      "The requested confidence gap is no longer available on the parent run.",
    );
  }

  return gap;
}

export function nextContinuationDepth(parentRun: DiligenceRun) {
  return (parentRun.continuationDepth ?? 0) + 1;
}

export function annotateGapsWithParent(
  gaps: ConfidenceGap[],
  parentRunId: string | undefined,
) {
  if (!parentRunId) {
    return gaps;
  }

  return gaps.map((gap) => ({
    ...gap,
    parentRunId,
  }));
}
