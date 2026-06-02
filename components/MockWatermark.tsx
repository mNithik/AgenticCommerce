import type { PaymentMode } from "../lib/types";

export function MockWatermark({ mode }: { mode: PaymentMode | null }) {
  if (mode !== "mock") {
    return null;
  }

  return (
    <section
      style={{
        marginTop: 20,
        background: "rgba(217, 119, 6, 0.12)",
        border: "1px solid rgba(217, 119, 6, 0.28)",
        borderRadius: 20,
        padding: 16,
        color: "#92400e",
      }}
    >
      Simulated receipts: this run is in mock mode and no on-chain Base payments were made.
    </section>
  );
}
