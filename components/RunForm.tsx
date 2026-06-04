"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ProofSpendDashboard } from "./proofspend/Dashboard";
import {
  analystToMemoView,
  paymentModeToUi,
  runEventsToTimeline,
  runToCompareVendor,
  runToEvidenceRows,
  runToHistoryRow,
  safeSpendToRows,
} from "../lib/dashboard-adapters";
import {
  buildProofPacketFilename,
  buildProofPacketJson,
  buildProofPacketMarkdown,
} from "../lib/proof-packet";
import { deserializeRunSnapshot, serializeRunSnapshot } from "../lib/run-sharing";
import type { DiligenceRun, PolicyProfile, RunEvent } from "../lib/types";

const HISTORY_KEY = "proofspend.runHistory.v1";

const EXAMPLE_QUESTIONS = [
  {
    short: "Apollo.io lead gen",
    full: "Should I spend $500 per month on Apollo.io for B2B lead generation for my early-stage SaaS startup?",
  },
  {
    short: "HubSpot Enterprise",
    full: "Should I buy HubSpot Enterprise for our 20-person sales team?",
  },
  {
    short: "LeadMagic",
    full: "Should we switch to LeadMagic for AI-powered lead enrichment at $99/seat?",
  },
];

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

      onEvent(JSON.parse(line.slice(6)) as RunEvent);
    }
  }
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
  const [question, setQuestion] = useState(EXAMPLE_QUESTIONS[0].full);
  const [budgetCapUsd, setBudgetCapUsd] = useState(0.25);
  const [policyProfile, setPolicyProfile] = useState<PolicyProfile>("standard");
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [run, setRun] = useState<DiligenceRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [history, setHistory] = useState<DiligenceRun[]>([]);
  const [compareRunId, setCompareRunId] = useState("");

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
      (events.find((event) => event.type === "run_started")?.paymentMode ?? null),
  );

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

      setRun(restoredRun);
      setQuestion(restoredRun.input);
      setBudgetCapUsd(restoredRun.budgetCapUsd);
      setPolicyProfile(restoredRun.policyProfile);
      saveRunToHistory(restoredRun);
      url.searchParams.delete("snapshot");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // Ignore malformed snapshot links and keep the local app usable.
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
    setCompareRunId(history.find((item) => item.id !== selectedRun.id)?.id ?? "");
  }

  async function handleRun() {
    setError(null);
    if (!question.trim()) {
      setError("Enter a diligence question first.");
      return;
    }
    if (budgetCapUsd <= 0) {
      setError("Budget cap must be greater than $0.");
      return;
    }

    setIsRunning(true);
    setEvents([]);
    setRun(null);
    setSelectedRecordId(null);

    try {
      const response = await fetch("/api/run-diligence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          budgetCapUsd,
          policyProfile,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await consumeSSE(response, (incomingEvent) => {
        setEvents((current) => [...current, incomingEvent]);

        if (incomingEvent.type === "complete") {
          setRun(incomingEvent.run);
          saveRunToHistory(incomingEvent.run);
        }

        if (incomingEvent.type === "run_error") {
          setError(incomingEvent.message);
        }
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unknown run error.",
      );
    } finally {
      setIsRunning(false);
    }
  }

  const historyRows = useMemo(() => history.map(runToHistoryRow), [history]);
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

  async function handleShareLink() {
    if (!run) {
      return;
    }

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("snapshot", serializeRunSnapshot(run));
      await navigator.clipboard.writeText(url.toString());
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy the share link on this device");
    }
  }

  return (
    <ProofSpendDashboard
      question={question}
      onQuestionChange={setQuestion}
      budgetCapUsd={budgetCapUsd}
      onBudgetChange={setBudgetCapUsd}
      policyProfile={policyProfile}
      onPolicyChange={setPolicyProfile}
      isRunning={isRunning}
      onRun={() => void handleRun()}
      error={error}
      mode={mode}
      spentUsd={spentUsd}
      paidCalls={paidCalls}
      timelineEvents={runEventsToTimeline(events)}
      evidenceRows={runToEvidenceRows(run)}
      memo={analystToMemoView(run?.analystOutput)}
      safeSpendRows={safeSpendToRows(run?.safeSpendLog ?? [])}
      historyRows={historyRows}
      selectedRunId={run?.id ?? null}
      onSelectHistory={loadHistoryRun}
      currentVendor={run ? runToCompareVendor(run) : null}
      compareVendor={compareRun ? runToCompareVendor(compareRun) : null}
      compareOptions={compareOptions}
      compareRunId={compareRun?.id ?? ""}
      onCompareRunChange={setCompareRunId}
      selectedRecordId={selectedRecordId}
      onSelectRecord={setSelectedRecordId}
      showExport={Boolean(run)}
      onShareLink={handleShareLink}
      onExportJson={() => {
        if (!run) {
          return;
        }
        downloadFile(
          buildProofPacketFilename(run, "json"),
          JSON.stringify(buildProofPacketJson(run), null, 2),
          "application/json",
        );
      }}
      onExportMarkdown={() => {
        if (!run) {
          return;
        }
        downloadFile(
          buildProofPacketFilename(run, "md"),
          buildProofPacketMarkdown(run),
          "text/markdown;charset=utf-8",
        );
      }}
      runIdLabel={run ? `run_id | ${run.id}` : undefined}
    />
  );
}
