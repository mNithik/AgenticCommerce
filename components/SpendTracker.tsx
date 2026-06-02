export function SpendTracker({
  spentUsd,
  budgetCapUsd,
  paidCalls,
}: {
  spentUsd: number;
  budgetCapUsd: number;
  paidCalls: number;
}) {
  const ratio = Math.min(spentUsd / budgetCapUsd, 1);

  return (
    <section
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 24,
        padding: 20,
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Spend
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>${spentUsd.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Budget cap
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>${budgetCapUsd.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Paid calls
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{paidCalls}</div>
        </div>
      </div>
      <div
        style={{
          marginTop: 18,
          width: "100%",
          height: 12,
          borderRadius: 999,
          background: "rgba(24, 33, 27, 0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${ratio * 100}%`,
            height: "100%",
            background: ratio > 0.85 ? "#b45309" : "linear-gradient(90deg, #0f766e, #3b82f6)",
          }}
        />
      </div>
    </section>
  );
}
