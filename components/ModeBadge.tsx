import type { PaymentMode } from "@/lib/types";

export function ModeBadge({ mode }: { mode: PaymentMode | null }) {
  const label = mode === "live" ? "Live x402" : mode === "mock" ? "Mock" : "Waiting";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 999,
        background: mode === "live" ? "rgba(15, 118, 110, 0.12)" : "rgba(180, 83, 9, 0.12)",
        color: mode === "live" ? "#0f766e" : "#9a5a0c",
        border: "1px solid rgba(24, 33, 27, 0.08)",
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: mode === "live" ? "#0f766e" : "#d97706",
        }}
      />
      {label}
    </div>
  );
}
