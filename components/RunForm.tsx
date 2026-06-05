"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ProofSpendDashboard } from "./proofspend/Dashboard";
import type { RaiseConfidenceRunRequest } from "./proofspend/Dashboard";
import { useDemoPlayback } from "./proofspend/DemoPlaybackProvider";
import {
  analystToMemoView,
  paymentModeToUi,
  runEventsToTimeline,
  runToCompareVendor,
  runToEvidenceRows,
  runToHistoryRow,
  safeSpendToRows,
} from "../lib/dashboard-adapters";
import { DEMO_QUESTION, EXAMPLE_QUESTIONS } from "../lib/example-questions";
import {
  buildProofPacketFilename,
  buildProofPacketJson,
  buildProofPacketMarkdown,
} from "../lib/proof-packet";
import {
  deserializeRunSnapshot,
  parseRunSnapshot,
  serializeRunSnapshot,
} from "../lib/run-sharing";
import {
  buildFailureSummary,
  healthToUiHealth,
  historyRowToUi,
  memoViewToUiMemo,
  observabilityToUiEvent,
  scheduleToUiSchedule,
  webhookToUiEvent,
} from "../lib/dashboard-ui-bridge";
import {
  buildApiHeaders,
  getStoredApiKey,
  setStoredApiKey,
} from "../lib/api-client-headers";
import { DEMO_EVIDENCE, DEMO_MEMO, DEMO_SAFESPEND, DEMO_TIMELINE } from "../lib/demo-fixtures";
import type {
  DiligenceRun,
  HealthStatusResponse,
  ObservabilityEvent,
  PolicyProfile,
  ProofAttestation,
  RunEvent,
  ScheduleTemplate,
} from "../lib/types";

const HISTORY_KEY = "proofspend.runHistory.v1";

async function consumeSSE(
  response: Response,
  onEvent: (event: RunEvent) => void,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response stream was returned.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .find((candidate) => candidate.startsWith("data: "));

      if (!line) {
        continue;
      }

      const event = JSON.parse(line.slice(6)) as RunEvent;
      if (event.type === "complete") {
        completed = true;
      }
      onEvent(event);
    }
  }

  return completed;
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RunForm() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [question, setQuestion] = useState<string>(DEMO_QUESTION);
  const [budgetCapUsd, setBudgetCapUsd] = useState(0.25);
  const [policyProfile, setPolicyProfile] = useState<PolicyProfile>("standard");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [run, setRun] = useState<DiligenceRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [history, setHistory] = useState<DiligenceRun[]>([]);
  const [compareRunId, setCompareRunId] = useState("");
  const [health, setHealth] = useState<HealthStatusResponse | null>(null);
  const [healthUnavailable, setHealthUnavailable] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleTemplate[]>([]);
  const [observabilityEvents, setObservabilityEvents] = useState<ObservabilityEvent[]>([]);
  const [apiKey, setApiKey] = useState("");

  const demoPlayback = useDemoPlayback({
    fullTimeline: DEMO_TIMELINE,
    fullMemo: DEMO_MEMO,
  });

  const spentUsd =
    run?.spentUsd ??
    events.reduce((sum, event) => {
      return event.type === "payment_settled" ? sum + event.costUsd : sum;
    }, 0);
  const paidCalls =
    run?.paidCalls ??
    events.filter((event) => event.type === "payment_settled").length;
  const mode = paymentModeToUi(
    run?.paymentMode ??
      (events.find((event) => event.type === "run_started")?.paymentMode ??
        health?.paymentMode ??
        null),
  );
  const activePolicyProfile =
    run?.policyProfile ??
    events.find((event) => event.type === "run_started")?.policyProfile ??
    health?.policyProfile ??
    null;
  const latestConfidenceUpdate = [...events]
    .reverse()
    .find((event) => event.type === "confidence_updated");

  async function refreshHealth() {
    try {
      const response = await fetch("/api/health");
      if (!response.ok) {
        throw new Error("Health request failed.");
      }

      const payload = (await response.json()) as HealthStatusResponse;
      setHealth(payload);
      setHealthUnavailable(false);
    } catch {
      setHealthUnavailable(true);
    }
  }

  async function refreshSchedules() {
    try {
      const response = await fetch("/api/schedules", {
        headers: buildApiHeaders(""),
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as ScheduleTemplate[];
      setSchedules(payload);
    } catch {
      // Keep schedules best-effort for local UI.
    }
  }

  async function refreshObservability() {
    try {
      const response = await fetch("/api/observability", {
        headers: buildApiHeaders(""),
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as ObservabilityEvent[];
      setObservabilityEvents(payload);
    } catch {
      // Keep observability best-effort for local UI.
    }
  }

  useEffect(() => {
    setApiKey(getStoredApiKey());
    void refreshHealth();
    void refreshSchedules();
    void refreshObservability();
  }, []);

  function handleApiKeyChange(value: string) {
    setApiKey(value);
    setStoredApiKey(value);
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshHealth();
      void refreshSchedules();
      void refreshObservability();
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as DiligenceRun[];
      if (Array.isArray(parsed)) {
        setHistory(parsed);
      }
    } catch {
      window.localStorage.removeItem(HISTORY_KEY);
    }
  }, []);

  function saveRunToHistory(completedRun: DiligenceRun) {
    setHistory((current) => {
      const next = [
        completedRun,
        ...current.filter((item) => item.id !== completedRun.id),
      ].slice(0, 10);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      if (!compareRunId) {
        const defaultCompare = next.find((item) => item.id !== completedRun.id)?.id ?? "";
        setCompareRunId(defaultCompare);
      }
      return next;
    });
  }

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const snapshot = url.searchParams.get("snapshot");
      if (!snapshot) {
        return;
      }

      const restoredRun = deserializeRunSnapshot(snapshot);
      if (!restoredRun) {
        return;
      }

      const envelope = parseRunSnapshot(snapshot);
      if (envelope) {
        void (async () => {
          try {
            const response = await fetch("/api/verify-proof", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ snapshot }),
            });
            if (!response.ok) {
              return;
            }
            const payload = (await response.json()) as {
              verified: boolean;
              message: string;
            };
            if (payload.verified) {
              toast.success(`Shared snapshot verified: ${payload.message}`);
            } else {
              setError(`Shared snapshot failed verification: ${payload.message}`);
            }
          } catch {
            // Keep restored runs usable even if verification is unavailable.
          }
        })();
      }

      setRun(restoredRun);
      setQuestion(restoredRun.input);
      setBudgetCapUsd(restoredRun.budgetCapUsd);
      setPolicyProfile(restoredRun.policyProfile);
      setCallbackUrl("");
      saveRunToHistory(restoredRun);
      url.searchParams.delete("snapshot");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // Ignore malformed snapshot links and keep the local app usable.
    }
  }, []);

  function loadHistoryRun(runId: string) {
    const selectedRun = history.find((item) => item.id === runId);
    if (!selectedRun) {
      return;
    }

    setRun(selectedRun);
    setEvents([]);
    setError(null);
    setSelectedRecordId(null);
    setQuestion(selectedRun.input);
    setBudgetCapUsd(selectedRun.budgetCapUsd);
    setPolicyProfile(selectedRun.policyProfile);
    setCallbackUrl("");
    setCompareRunId(history.find((item) => item.id !== selectedRun.id)?.id ?? "");
  }

  function clearHistory() {
    window.localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
    setCompareRunId("");
    toast.success("Local run history cleared");
  }

  async function requestSnapshotSigning(currentRun: DiligenceRun) {
    const response = await fetch("/api/sign-snapshot", {
      method: "POST",
      headers: buildApiHeaders(),
      body: JSON.stringify({ run: currentRun }),
    });

    if (!response.ok) {
      throw new Error("Snapshot signing failed.");
    }

    return (await response.json()) as {
      snapshot: string;
      attestation: ProofAttestation;
      signingAvailable: boolean;
    };
  }

  async function submitRun(
    questionOverride?: string,
    budgetOverride?: number,
    continuation?: RaiseConfidenceRunRequest,
  ) {
    const effectiveQuestion = (questionOverride ?? question).trim();
    const effectiveBudget = budgetOverride ?? budgetCapUsd;
    setError(null);

    if (!effectiveQuestion) {
      setError("Enter a diligence question first.");
      return;
    }
    if (effectiveBudget <= 0) {
      setError("Budget cap must be greater than $0.");
      return;
    }
    if (callbackUrl) {
      try {
        const parsed = new URL(callbackUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          setError("Callback URL must use http or https.");
          return;
        }
      } catch {
        setError("Callback URL must be a valid URL.");
        return;
      }
    }

    const parentRunForContinuation =
      continuation?.parentRunId && run?.id === continuation.parentRunId
        ? run
        : continuation?.parentRunId
          ? history.find((item) => item.id === continuation.parentRunId)
          : undefined;

    setIsRunning(true);
    setEvents([]);
    setRun(null);
    setSelectedRecordId(null);
    abortControllerRef.current = new AbortController();

    if (questionOverride) {
      setQuestion(questionOverride);
    }
    if (budgetOverride !== undefined) {
      setBudgetCapUsd(budgetOverride);
    }

    try {
      const response = await fetch("/api/run-diligence", {
        method: "POST",
        signal: abortControllerRef.current.signal,
        headers: buildApiHeaders(),
        body: JSON.stringify({
          question: effectiveQuestion,
          budgetCapUsd: effectiveBudget,
          policyProfile,
          callbackUrl: callbackUrl || undefined,
          parentRunId: continuation?.parentRunId,
          parentRun: parentRunForContinuation,
          gapId: continuation?.gapId,
          suggestedQuery: continuation?.suggestedQuery,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const completed = await consumeSSE(response, (incomingEvent) => {
        setEvents((current) => [...current, incomingEvent]);

        if (incomingEvent.type === "complete") {
          setRun(incomingEvent.run);
          saveRunToHistory(incomingEvent.run);
          void refreshHealth();
          void refreshObservability();
        }

        if (incomingEvent.type === "run_error") {
          setError(incomingEvent.message);
          void refreshObservability();
        }
      });

      if (!completed && !abortControllerRef.current?.signal.aborted) {
        setError("The diligence stream ended before a final result was returned.");
      }
    } catch (submissionError) {
      if (submissionError instanceof DOMException && submissionError.name === "AbortError") {
        toast.success("Run canceled");
        setEvents((current) => [
          ...current,
          {
            type: "run_error",
            message: "Run canceled from the dashboard before completion.",
          },
        ]);
        return;
      }
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unknown run error.",
      );
    } finally {
      abortControllerRef.current = null;
      setIsRunning(false);
    }
  }

  function handleCancelRun() {
    abortControllerRef.current?.abort();
  }

  function handleRaiseConfidenceRun(request: RaiseConfidenceRunRequest) {
    setBudgetCapUsd(request.budgetCapUsd);
    void submitRun(undefined, request.budgetCapUsd, request);
  }

  async function handleCreateSchedule(intervalMinutes: number) {
    const effectiveQuestion = question.trim();
    if (!effectiveQuestion) {
      toast.error("Enter a diligence question before saving a schedule.");
      return;
    }

    const response = await fetch("/api/schedules", {
      method: "POST",
      headers: buildApiHeaders(),
      body: JSON.stringify({
        question: effectiveQuestion,
        budgetCapUsd,
        policyProfile,
        callbackUrl: callbackUrl || undefined,
        intervalMinutes,
      }),
    });

    if (!response.ok) {
      toast.error(await response.text());
      return;
    }

    toast.success("Schedule created");
    await refreshSchedules();
    await refreshObservability();
  }

  async function handleDeleteSchedule(scheduleId: string) {
    const response = await fetch(`/api/schedules/${scheduleId}`, {
      method: "DELETE",
      headers: buildApiHeaders(""),
    });
    if (!response.ok) {
      toast.error(await response.text());
      return;
    }
    toast.success("Schedule deleted");
    await refreshSchedules();
    await refreshObservability();
  }

  async function handleToggleSchedule(scheduleId: string, enabled: boolean) {
    const response = await fetch(`/api/schedules/${scheduleId}`, {
      method: "PATCH",
      headers: buildApiHeaders(),
      body: JSON.stringify({ enabled }),
    });
    if (!response.ok) {
      toast.error(await response.text());
      return;
    }
    toast.success(enabled ? "Schedule enabled" : "Schedule paused");
    await refreshSchedules();
    await refreshObservability();
  }

  async function handleRunScheduleNow(scheduleId: string) {
    const response = await fetch(`/api/schedules/${scheduleId}/run`, {
      method: "POST",
      headers: buildApiHeaders(""),
    });
    if (!response.ok) {
      toast.error(await response.text());
      return;
    }
    toast.success("Scheduled diligence dispatched");
    await refreshSchedules();
    await refreshHealth();
    await refreshObservability();
  }

  async function handleRetryWebhook(deliveryId: string) {
    const response = await fetch("/api/webhooks/retry", {
      method: "POST",
      headers: buildApiHeaders(),
      body: JSON.stringify({ deliveryId }),
    });
    if (!response.ok) {
      toast.error(await response.text());
      return;
    }
    toast.success("Webhook retry dispatched");
    await refreshHealth();
    await refreshObservability();
  }

  function handleDemoRun() {
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
  }

  const historyRows = useMemo(
    () => history.map((item, index) => historyRowToUi(runToHistoryRow(item), index)),
    [history],
  );
  const compareCandidates = useMemo(
    () => (run ? history.filter((item) => item.id !== run.id) : []),
    [history, run],
  );
  const compareRun =
    compareCandidates.find((item) => item.id === compareRunId) ??
    compareCandidates[0] ??
    null;
  const compareOptions = compareCandidates.map((candidate) => ({
    id: candidate.id,
    label: `${candidate.subject} | ${candidate.recommendation.replaceAll("_", " ")} | $${candidate.spentUsd.toFixed(2)}`,
  }));

  useEffect(() => {
    if (compareCandidates.length === 0) {
      if (compareRunId) {
        setCompareRunId("");
      }
      return;
    }

    const stillValid = compareCandidates.some((candidate) => candidate.id === compareRunId);
    if (!stillValid) {
      setCompareRunId(compareCandidates[0]?.id ?? "");
    }
  }, [compareCandidates, compareRunId]);

  async function handleShareLink() {
    if (!run) {
      return;
    }

    try {
      const url = new URL(window.location.href);
      let snapshot: string;
      let copiedMessage = "Share link copied";
      try {
        const payload = await requestSnapshotSigning(run);
        snapshot = payload.snapshot;
        if (!payload.signingAvailable) {
          copiedMessage = "Share link copied with digest-only attestation";
        }
      } catch {
        snapshot = await serializeRunSnapshot(run);
        copiedMessage = "Share link copied with local digest attestation";
      }

      url.searchParams.set("snapshot", snapshot);
      await navigator.clipboard.writeText(url.toString());
      toast.success(copiedMessage);
    } catch {
      toast.error("Could not copy the share link on this device");
    }
  }

  const estimate = {
    estimatedPaidCallCostUsd: health?.estimatedPaidCallCostUsd ?? 0.01,
    estimatedBaselineCalls: health?.estimatedBaselineCalls ?? 3,
    estimatedMaxCalls: health?.estimatedMaxCalls ?? 4,
    estimatedConfidenceRange: health?.estimatedConfidenceRange
      ? {
          baselineMin: Math.round(health.estimatedConfidenceRange.baselineMin * 100),
          baselineMax: Math.round(health.estimatedConfidenceRange.baselineMax * 100),
          upperBoundWithSkeptic: Math.round(
            health.estimatedConfidenceRange.upperBoundWithSkeptic * 100,
          ),
        }
      : undefined,
  };

  const failureSummary = buildFailureSummary(events, Boolean(run));

  const liveMemo = memoViewToUiMemo(analystToMemoView(run));
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
  const displayShowExport = demoActive ? Boolean(demoPlayback.memo) : Boolean(run);

  return (
    <ProofSpendDashboard
      question={question}
      onQuestionChange={setQuestion}
      budgetCapUsd={budgetCapUsd}
      onBudgetChange={setBudgetCapUsd}
      policyProfile={policyProfile}
      onPolicyChange={setPolicyProfile}
      callbackUrl={callbackUrl}
      onCallbackUrlChange={setCallbackUrl}
      exampleQuestions={EXAMPLE_QUESTIONS.map((questionOption) => ({
        short: questionOption.short,
        full: questionOption.full,
      }))}
      onDemoRun={() => void handleDemoRun()}
      demoRunDisabled={!health || health.paymentMode === "live"}
      isRunning={displayRunning}
      onRun={() => void submitRun()}
      onCancelRun={handleCancelRun}
      error={error}
      mode={mode}
      activePolicyProfile={activePolicyProfile}
      spentUsd={displaySpentUsd}
      paidCalls={displayPaidCalls}
      timelineEvents={displayTimeline}
      evidenceRows={displayEvidence}
      memo={displayMemo}
      safeSpendRows={displaySafeSpend}
      demoMode={demoActive}
      justCompleted={demoPlayback.justCompleted}
      onReplayDemo={demoPlayback.replay}
      historyRows={historyRows}
      selectedRunId={run?.id ?? null}
      onSelectHistory={loadHistoryRun}
      onClearHistory={clearHistory}
      currentVendor={run ? runToCompareVendor(run) : null}
      compareVendor={compareRun ? runToCompareVendor(compareRun) : null}
      compareOptions={compareOptions}
      compareRunId={compareRun?.id ?? null}
      onCompareRunChange={setCompareRunId}
      selectedRecordId={selectedRecordId}
      onSelectRecord={setSelectedRecordId}
      showExport={displayShowExport}
      onShareLink={handleShareLink}
      onExportJson={() => {
        if (!run) {
          return;
        }
        void (async () => {
          let attestation: ProofAttestation | undefined;
          try {
            const payload = await requestSnapshotSigning(run);
            attestation = payload.attestation;
          } catch {
            attestation = undefined;
          }
          downloadFile(
            buildProofPacketFilename(run, "json"),
            JSON.stringify(await buildProofPacketJson(run, attestation), null, 2),
            "application/json",
          );
        })();
      }}
      onExportMarkdown={() => {
        if (!run) {
          return;
        }
        void (async () => {
          let attestation: ProofAttestation | undefined;
          try {
            const payload = await requestSnapshotSigning(run);
            attestation = payload.attestation;
          } catch {
            attestation = undefined;
          }
          downloadFile(
            buildProofPacketFilename(run, "md"),
            await buildProofPacketMarkdown(run, attestation),
            "text/markdown;charset=utf-8",
          );
        })();
      }}
      health={healthToUiHealth(health)}
      healthUnavailable={healthUnavailable}
      estimate={estimate}
      schedules={schedules.map(scheduleToUiSchedule)}
      onCreateSchedule={() => void handleCreateSchedule(60)}
      onDeleteSchedule={(scheduleId) => void handleDeleteSchedule(scheduleId)}
      onToggleSchedule={(scheduleId) => {
        const schedule = schedules.find((item) => item.id === scheduleId);
        if (schedule) {
          void handleToggleSchedule(scheduleId, !schedule.enabled);
        }
      }}
      onRunScheduleNow={(scheduleId) => void handleRunScheduleNow(scheduleId)}
      onRetryWebhook={(deliveryId) => void handleRetryWebhook(deliveryId)}
      webhookEvents={(health?.recentWebhookDeliveries ?? []).map(webhookToUiEvent)}
      observabilityEvents={observabilityEvents.map(observabilityToUiEvent)}
      failureSummary={failureSummary}
      runIdLabel={run ? `run_id | ${run.id}` : undefined}
      liveConfidence={
        latestConfidenceUpdate?.type === "confidence_updated"
          ? {
              confidence: Math.round(latestConfidenceUpdate.overall * 100),
              proofScore: latestConfidenceUpdate.proofScore,
              reason: latestConfidenceUpdate.reason,
            }
          : null
      }
      onRaiseConfidenceRun={handleRaiseConfidenceRun}
      apiKey={apiKey}
      onApiKeyChange={handleApiKeyChange}
    />
  );
}
