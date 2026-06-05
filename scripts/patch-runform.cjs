const fs = require("fs");
const path = "C:/Users/nithi/OneDrive/Documents/MICROSOFTTECHWEEK/components/RunForm.tsx";
let c = fs.readFileSync(path, "utf8");

c = c.replace(
  `import { ProofSpendDashboard } from "./proofspend/Dashboard";`,
  `import { ProofSpendDashboard } from "./proofspend/Dashboard";
import { useDemoPlayback } from "./proofspend/DemoPlaybackProvider";`
);

c = c.replace(
  `} from "../lib/run-sharing";`,
  `} from "../lib/run-sharing";
import {
  buildFailureSummary,
  healthToUiHealth,
  historyRowToUi,
  memoViewToUiMemo,
  observabilityToUiEvent,
  scheduleToUiSchedule,
  webhookToUiEvent,
} from "../lib/dashboard-ui-bridge";
import { DEMO_EVIDENCE, DEMO_MEMO, DEMO_SAFESPEND, DEMO_TIMELINE } from "../lib/demo-fixtures";`
);

c = c.replace(
  `function summarizeFailure(events: RunEvent[], run: DiligenceRun | null) {
  if (run || events.length === 0) {
    return null;
  }

  const failed = events.filter((event) => event.type === "search_failed");
  const blocked = events.filter((event) => event.type === "policy_blocked");
  const runError = [...events].reverse().find((event) => event.type === "run_error");

  if (failed.length === 0 && blocked.length === 0 && !runError) {
    return null;
  }

  const parts = [
    failed.length > 0 ? \`\${failed.length} search failure\${failed.length === 1 ? "" : "s"}\` : null,
    blocked.length > 0 ? \`\${blocked.length} policy block\${blocked.length === 1 ? "" : "s"}\` : null,
  ].filter((part): part is string => Boolean(part));

  if (runError) {
    return runError.message;
  }

  const firstReason =
    failed[0]?.reason ??
    blocked[0]?.reason ??
    "No evidence records were collected for this run.";

  return \`\${parts.join(" and ")} prevented evidence collection. \${firstReason}\`;
}

`,
  ``
);

if (!c.includes("useDemoPlayback")) {
  throw new Error("import failed");
}

c = c.replace(
  `  const [observabilityEvents, setObservabilityEvents] = useState<ObservabilityEvent[]>([]);`,
  `  const [observabilityEvents, setObservabilityEvents] = useState<ObservabilityEvent[]>([]);

  const demoPlayback = useDemoPlayback({
    fullTimeline: DEMO_TIMELINE,
    fullMemo: DEMO_MEMO,
  });`
);

c = c.replace(
  `  async function handleDemoRun() {
    if (!health) {
      toast.error("Wait for system status to load before starting the demo run.");
      return;
    }

    if ((health?.paymentMode ?? mode) === "live") {
      toast.error("Demo run is only available while mock mode is enabled.");
      setQuestion(DEMO_QUESTION);
      return;
    }

    await submitRun(DEMO_QUESTION);
  }`,
  `  function handleDemoRun() {
    if (!health) {
      toast.error("Wait for system status to load before starting the demo run.");
      return;
    }

    if ((health?.paymentMode ?? mode) === "live") {
      toast.error("Demo run is only available while mock mode is enabled.");
      setQuestion(DEMO_QUESTION);
      return;
    }

    setQuestion(DEMO_QUESTION);
    setError(null);
    setSelectedRecordId(null);
    demoPlayback.start();
  }`
);

c = c.replace(
  `  const historyRows = useMemo(() => history.map(runToHistoryRow), [history]);`,
  `  const historyRows = useMemo(
    () => history.map((item, index) => historyRowToUi(runToHistoryRow(item), index)),
    [history],
  );`
);

c = c.replace(
  `  const failureSummary = summarizeFailure(events, run);`,
  `  const failureSummary = buildFailureSummary(events, Boolean(run));

  const liveMemo = memoViewToUiMemo(analystToMemoView(run?.analystOutput, run?.records ?? []));
  const demoActive = demoPlayback.demoMode;
  const displayTimeline = demoActive ? demoPlayback.timelineEvents : runEventsToTimeline(events);
  const displayMemo = demoActive ? demoPlayback.memo : liveMemo;
  const displayRunning = demoActive ? demoPlayback.isRunning : isRunning;
  const displayEvidence = demoActive && demoPlayback.memo ? DEMO_EVIDENCE : runToEvidenceRows(run).map(({ paymentMode: _pm, ...row }) => row);
  const displaySafeSpend = demoActive && demoPlayback.memo ? DEMO_SAFESPEND : safeSpendToRows(run?.safeSpendLog ?? []);
  const displaySpentUsd = demoActive
    ? displayTimeline.filter((event) => event.type === "payment_settled").length * 0.01
    : spentUsd;
  const displayPaidCalls = demoActive
    ? displayTimeline.filter((event) => event.type === "payment_settled").length
    : paidCalls;
  const displayShowExport = demoActive ? Boolean(demoPlayback.memo) : Boolean(run);`
);

// Replace ProofSpendDashboard props block key fields
c = c.replace(`      demoRunDisabled={!health || health.paymentMode === "live"}
      isRunning={isRunning}
      onRun={() => void submitRun()}`, `      demoRunDisabled={!health || health.paymentMode === "live"}
      isRunning={displayRunning}
      onRun={() => void submitRun()}`);

c = c.replace(`      spentUsd={spentUsd}
      paidCalls={paidCalls}
      timelineEvents={runEventsToTimeline(events)}
      evidenceRows={runToEvidenceRows(run)}
      memo={analystToMemoView(run?.analystOutput, run?.records ?? [])}
      safeSpendRows={safeSpendToRows(run?.safeSpendLog ?? [])}`, `      spentUsd={displaySpentUsd}
      paidCalls={displayPaidCalls}
      timelineEvents={displayTimeline}
      evidenceRows={displayEvidence}
      memo={displayMemo}
      safeSpendRows={displaySafeSpend}
      demoMode={demoActive}
      justCompleted={demoPlayback.justCompleted}
      onReplayDemo={demoPlayback.replay}`);

c = c.replace(`      compareRunId={compareRun?.id ?? ""}`, `      compareRunId={compareRun?.id ?? null}`);

c = c.replace(`      showExport={Boolean(run)}`, `      showExport={displayShowExport}`);

c = c.replace(`      health={health}
      healthUnavailable={healthUnavailable}
      estimate={estimate}
      schedules={schedules}
      onCreateSchedule={(intervalMinutes) => void handleCreateSchedule(intervalMinutes)}`, `      health={healthToUiHealth(health)}
      healthUnavailable={healthUnavailable}
      estimate={estimate}
      schedules={schedules.map(scheduleToUiSchedule)}
      onCreateSchedule={() => void handleCreateSchedule(60)}`);

c = c.replace(`      onToggleSchedule={(scheduleId, enabled) => void handleToggleSchedule(scheduleId, enabled)}`, `      onToggleSchedule={(scheduleId) => {
        const schedule = schedules.find((item) => item.id === scheduleId);
        if (schedule) {
          void handleToggleSchedule(scheduleId, !schedule.enabled);
        }
      }}`);

c = c.replace(`      observabilityEvents={observabilityEvents}
      failureSummary={failureSummary}`, `      webhookEvents={(health?.recentWebhookDeliveries ?? []).map(webhookToUiEvent)}
      observabilityEvents={observabilityEvents.map(observabilityToUiEvent)}
      failureSummary={failureSummary}`);

fs.writeFileSync(path, c, "utf8");
console.log("RunForm patched");
