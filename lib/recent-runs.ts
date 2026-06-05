import type { DiligenceRun } from "./types";

const recentRuns: DiligenceRun[] = [];

export function addRecentRun(run: DiligenceRun) {
  recentRuns.unshift(run);
  if (recentRuns.length > 10) {
    recentRuns.length = 10;
  }
}

export function getRecentRuns() {
  return recentRuns.slice();
}

export function getRecentRunById(id: string) {
  return recentRuns.find((run) => run.id === id) ?? null;
}

export function clearRecentRuns() {
  recentRuns.length = 0;
}
