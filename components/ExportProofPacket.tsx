"use client";

import {
  buildProofPacketFilename,
  buildProofPacketJson,
  buildProofPacketMarkdown,
} from "../lib/proof-packet";
import type { DiligenceRun } from "../lib/types";

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExportProofPacket({ run }: { run: DiligenceRun | null }) {
  if (!run) {
    return null;
  }

  return (
    <section
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 24,
        padding: 20,
        boxShadow: "var(--shadow)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Proof Packet Export
        </div>
        <div style={{ marginTop: 6, color: "var(--muted)", lineHeight: 1.5 }}>
          Download this completed run as structured JSON or a judge-friendly Markdown packet.
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() =>
            downloadFile(
              buildProofPacketFilename(run, "json"),
              JSON.stringify(buildProofPacketJson(run), null, 2),
              "application/json",
            )
          }
          style={{
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "12px 18px",
            background: "rgba(255,255,255,0.8)",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() =>
            downloadFile(
              buildProofPacketFilename(run, "md"),
              buildProofPacketMarkdown(run),
              "text/markdown;charset=utf-8",
            )
          }
          style={{
            border: "none",
            borderRadius: 999,
            padding: "12px 18px",
            background: "linear-gradient(135deg, var(--accent), #2563eb)",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Export Markdown
        </button>
      </div>
    </section>
  );
}
