import type { RunEvent } from "@/lib/types";

function renderEvent(event: RunEvent) {
  switch (event.type) {
    case "run_started":
      return `Run started in ${event.paymentMode} mode with ${event.llmProvider}.`;
    case "agent_started":
      return `${event.agent} researching: ${event.queryPreview}`;
    case "payment_settled":
      return `${event.agent} settled ${event.costUsd.toFixed(2)} with receipt ${event.receipt}`;
    case "agent_completed":
      return `${event.agent} completed with finding: ${event.record.finding}`;
    case "policy_blocked":
      return `${event.agent} blocked: ${event.reason}`;
    case "run_error":
      return `Run error: ${event.message}`;
    case "complete":
      return `Run complete with ${event.run.records.length} evidence records.`;
  }
}

export function AgentTimeline({ events }: { events: RunEvent[] }) {
  return (
    <section
      style={{
        background: "#18211b",
        color: "#f8f5ee",
        borderRadius: 24,
        padding: 20,
        minHeight: 280,
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.72 }}>
        Live timeline
      </div>
      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {events.length === 0 ? (
          <div style={{ color: "rgba(248, 245, 238, 0.72)" }}>
            Timeline events will appear here once the run starts.
          </div>
        ) : (
          events.map((event, index) => (
            <div
              key={`${event.type}_${index}`}
              style={{
                borderTop: "1px solid rgba(248, 245, 238, 0.12)",
                paddingTop: 12,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.64, textTransform: "uppercase" }}>{event.type}</div>
              <div style={{ marginTop: 4, lineHeight: 1.45 }}>{renderEvent(event)}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
