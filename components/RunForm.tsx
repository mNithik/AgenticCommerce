"use client";

import { useState } from "react";
import { AgentTimeline } from "@/components/AgentTimeline";
import { EvidenceTable } from "@/components/EvidenceTable";
import { MemoView } from "@/components/MemoView";
import { ModeBadge } from "@/components/ModeBadge";
import { SpendTracker } from "@/components/SpendTracker";
import type { DiligenceRun, RunEvent } from "@/lib/types";

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

export function RunForm() {
  const [question, setQuestion] = useState("Should I buy a vendor that promises receipt-backed AI research for procurement diligence?");
  const [budgetCapUsd, setBudgetCapUsd] = useState(0.25);
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [run, setRun] = useState<DiligenceRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spentUsd =
    run?.spentUsd ??
    events.reduce((sum, event) => {
      return event.type === "payment_settled" ? sum + event.costUsd : sum;
    }, 0);
  const paidCalls =
    run?.paidCalls ??
    events.filter((event) => event.type === "payment_settled").length;
  const mode =
    run?.paymentMode ??
    (events.find((event) => event.type === "run_started")?.paymentMode ?? null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRunning(true);
    setEvents([]);
    setRun(null);
    setError(null);

    try {
      const response = await fetch("/api/run-diligence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          budgetCapUsd,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await consumeSSE(response, (incomingEvent) => {
        setEvents((current) => [...current, incomingEvent]);

        if (incomingEvent.type === "complete") {
          setRun(incomingEvent.run);
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

  return (
    <div
      style={{
        width: "min(1180px, calc(100vw - 32px))",
        margin: "0 auto",
        padding: "28px 0 56px",
      }}
    >
      <section
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: 32,
          padding: 28,
          boxShadow: "var(--shadow)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div
              style={{
                fontSize: 12,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              ProofSpend
            </div>
            <h1 style={{ margin: "10px 0 12px", fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 1 }}>
              Receipt-backed research for autonomous agents.
            </h1>
            <p style={{ margin: 0, maxWidth: 720, color: "var(--muted)", fontSize: 18, lineHeight: 1.5 }}>
              Run controlled diligence, cap spend before every paid search, and trace each memo claim back to a source and receipt.
            </p>
          </div>
          <ModeBadge mode={mode} />
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 28 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            Diligence question
          </label>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={4}
            style={{
              width: "100%",
              borderRadius: 20,
              border: "1px solid var(--line)",
              padding: 18,
              background: "rgba(255,255,255,0.72)",
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", gap: 16, alignItems: "end", flexWrap: "wrap", marginTop: 18 }}>
            <label style={{ display: "block" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Budget cap (USD)</div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={budgetCapUsd}
                onChange={(event) => setBudgetCapUsd(Number(event.target.value))}
                style={{
                  width: 140,
                  borderRadius: 14,
                  border: "1px solid var(--line)",
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.72)",
                }}
              />
            </label>

            <button
              type="submit"
              disabled={isRunning}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "14px 24px",
                background: "linear-gradient(135deg, var(--accent), #2563eb)",
                color: "#fff",
                fontWeight: 700,
                cursor: isRunning ? "wait" : "pointer",
              }}
            >
              {isRunning ? "Running..." : "Run diligence"}
            </button>
          </div>

          {error ? (
            <div style={{ marginTop: 16, color: "var(--danger)", fontWeight: 700 }}>{error}</div>
          ) : null}
        </form>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
          marginTop: 20,
        }}
      >
        <SpendTracker spentUsd={spentUsd} budgetCapUsd={budgetCapUsd} paidCalls={paidCalls} />
        <AgentTimeline events={events} />
      </div>

      <div style={{ display: "grid", gap: 20, marginTop: 20 }}>
        <MemoView analystOutput={run?.analystOutput ?? null} records={run?.records ?? []} />
        <EvidenceTable records={run?.records ?? []} />
      </div>
    </div>
  );
}
