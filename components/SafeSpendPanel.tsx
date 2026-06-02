import type { SafeSpendEvent } from "../lib/types";

export function SafeSpendPanel({ events }: { events: SafeSpendEvent[] }) {
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
        SafeSpend Panel
      </div>
      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {events.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>SafeSpend events will appear after a completed run.</div>
        ) : (
          events.map((event, index) => (
            <div
              key={`${event.action}_${index}`}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 16,
                padding: 14,
                background: event.status === "blocked" ? "rgba(185, 28, 28, 0.06)" : "rgba(37, 99, 235, 0.06)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{event.agent}</strong>
                <span style={{ color: "var(--muted)" }}>
                  {event.action} · {event.status}
                </span>
              </div>
              <div style={{ marginTop: 6, lineHeight: 1.5 }}>{event.reason}</div>
              {event.queryPreview ? (
                <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
                  Query: {event.queryPreview}
                </div>
              ) : null}
              {typeof event.projectedSpendUsd === "number" ? (
                <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 13 }}>
                  Projected spend: ${event.projectedSpendUsd.toFixed(2)}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
