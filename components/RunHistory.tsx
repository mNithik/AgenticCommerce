"use client";

import type { DiligenceRun } from "../lib/types";

export function RunHistory({
  runs,
  onSelect,
}: {
  runs: DiligenceRun[];
  onSelect: (run: DiligenceRun) => void;
}) {
  return (
    <section
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 24,
        padding: 24,
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Local Run History
      </div>
      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {runs.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>Completed runs will be saved locally on this browser.</div>
        ) : (
          runs.map((run) => (
            <button
              key={run.id}
              type="button"
              onClick={() => onSelect(run)}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 18,
                padding: 14,
                background: "rgba(255,255,255,0.72)",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{run.subject}</strong>
                <span style={{ color: "var(--muted)" }}>
                  {run.paymentMode} · {run.recommendation}
                </span>
              </div>
              <div style={{ marginTop: 6, color: "var(--muted)", lineHeight: 1.5 }}>
                {run.input}
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
                Spend ${run.spentUsd.toFixed(2)} · {run.records.length} records · {Math.round(run.confidence * 100)}% confidence
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
