import { executeRun } from "./run-service";
import { makeId } from "./text-utils";
import { recordObservabilityEvent } from "./observability";
import type { PolicyProfile, ScheduleTemplate } from "./types";

type ScheduleCreateInput = {
  label?: string;
  question: string;
  budgetCapUsd: number;
  policyProfile: PolicyProfile;
  callbackUrl?: string;
  intervalMinutes: number;
};

const schedules: ScheduleTemplate[] = [];
let workerStarted = false;

function computeNextRun(intervalMinutes: number, from = Date.now()) {
  return new Date(from + intervalMinutes * 60_000).toISOString();
}

function scheduleLabel(question: string, label?: string) {
  return label?.trim() || question.trim().slice(0, 48) || "Scheduled diligence";
}

async function executeScheduledRun(schedule: ScheduleTemplate) {
  try {
    const run = await executeRun({
      question: schedule.question,
      budgetCapUsd: schedule.budgetCapUsd,
      policyProfile: schedule.policyProfile,
      callbackUrl: schedule.callbackUrl,
    });
    schedule.lastRunAt = new Date().toISOString();
    schedule.lastRunId = run.id;
    schedule.lastStatus = "success";
    schedule.lastError = undefined;
    schedule.updatedAt = new Date().toISOString();
    schedule.nextRunAt = computeNextRun(schedule.intervalMinutes);
    recordObservabilityEvent({
      category: "schedule",
      status: "success",
      message: `Scheduled run completed for ${schedule.label}.`,
      relatedId: schedule.id,
      metadata: {
        runId: run.id,
        intervalMinutes: schedule.intervalMinutes,
      },
    });
  } catch (error) {
    schedule.lastRunAt = new Date().toISOString();
    schedule.lastStatus = "failed";
    schedule.lastError = error instanceof Error ? error.message : "Scheduled run failed.";
    schedule.updatedAt = new Date().toISOString();
    schedule.nextRunAt = computeNextRun(schedule.intervalMinutes);
    recordObservabilityEvent({
      category: "schedule",
      status: "error",
      message: `Scheduled run failed for ${schedule.label}.`,
      relatedId: schedule.id,
      metadata: {
        error: schedule.lastError,
      },
    });
  }
}

async function dispatchDueSchedules() {
  const now = Date.now();
  const dueSchedules = schedules.filter(
    (schedule) => schedule.enabled && new Date(schedule.nextRunAt).getTime() <= now,
  );

  for (const schedule of dueSchedules) {
    schedule.nextRunAt = computeNextRun(schedule.intervalMinutes, now);
    await executeScheduledRun(schedule);
  }
}

export function ensureScheduleWorker() {
  if (workerStarted || process.env.NODE_ENV === "test") {
    return;
  }

  workerStarted = true;
  setInterval(() => {
    void dispatchDueSchedules();
  }, 30_000);
}

export function listSchedules() {
  ensureScheduleWorker();
  return schedules.slice();
}

export function createSchedule(input: ScheduleCreateInput) {
  ensureScheduleWorker();
  const createdAt = new Date().toISOString();
  const schedule: ScheduleTemplate = {
    id: makeId("sched", `${input.question}_${createdAt}`),
    label: scheduleLabel(input.question, input.label),
    question: input.question.trim(),
    budgetCapUsd: input.budgetCapUsd,
    policyProfile: input.policyProfile,
    callbackUrl: input.callbackUrl?.trim() || undefined,
    intervalMinutes: input.intervalMinutes,
    enabled: true,
    createdAt,
    updatedAt: createdAt,
    nextRunAt: computeNextRun(input.intervalMinutes),
  };

  schedules.unshift(schedule);
  recordObservabilityEvent({
    category: "schedule",
    status: "info",
    message: `Created schedule ${schedule.label}.`,
    relatedId: schedule.id,
    metadata: {
      intervalMinutes: schedule.intervalMinutes,
    },
  });
  return schedule;
}

export function deleteSchedule(id: string) {
  const index = schedules.findIndex((schedule) => schedule.id === id);
  if (index === -1) {
    return null;
  }
  const [removed] = schedules.splice(index, 1);
  recordObservabilityEvent({
    category: "schedule",
    status: "info",
    message: `Deleted schedule ${removed.label}.`,
    relatedId: removed.id,
  });
  return removed;
}

export function toggleSchedule(id: string, enabled: boolean) {
  const schedule = schedules.find((item) => item.id === id);
  if (!schedule) {
    return null;
  }
  schedule.enabled = enabled;
  schedule.updatedAt = new Date().toISOString();
  schedule.nextRunAt = computeNextRun(schedule.intervalMinutes);
  recordObservabilityEvent({
    category: "schedule",
    status: "info",
    message: `${enabled ? "Enabled" : "Paused"} schedule ${schedule.label}.`,
    relatedId: schedule.id,
  });
  return schedule;
}

export async function runScheduleNow(id: string) {
  const schedule = schedules.find((item) => item.id === id);
  if (!schedule) {
    return null;
  }
  await executeScheduledRun(schedule);
  return schedule;
}
