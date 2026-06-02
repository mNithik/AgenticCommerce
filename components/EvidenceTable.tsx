import type { EvidenceRecord } from "@/lib/types";

export function EvidenceTable({ records }: { records: EvidenceRecord[] }) {
  return (
    <section
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 24,
        padding: 24,
        boxShadow: "var(--shadow)",
        overflowX: "auto",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Evidence records
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 18, minWidth: 720 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
            <th style={{ padding: "0 0 12px" }}>Agent</th>
            <th style={{ padding: "0 0 12px" }}>Query</th>
            <th style={{ padding: "0 0 12px" }}>Finding</th>
            <th style={{ padding: "0 0 12px" }}>Receipt</th>
            <th style={{ padding: "0 0 12px" }}>Cost</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} style={{ borderBottom: "1px solid var(--line)", verticalAlign: "top" }}>
              <td style={{ padding: "14px 12px 14px 0", fontWeight: 700 }}>{record.agent}</td>
              <td style={{ padding: "14px 12px 14px 0" }}>{record.query}</td>
              <td style={{ padding: "14px 12px 14px 0", lineHeight: 1.5 }}>
                <div>{record.finding}</div>
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                  {record.sources.slice(0, 2).map((source) => (
                    <div key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.title}
                      </a>
                    </div>
                  ))}
                </div>
              </td>
              <td style={{ padding: "14px 12px 14px 0" }}>
                {record.paymentMode === "live" ? (
                  <a href={`https://basescan.org/tx/${record.receipt}`} target="_blank" rel="noreferrer">
                    {record.receipt.slice(0, 14)}...
                  </a>
                ) : (
                  <span>{record.receipt}</span>
                )}
              </td>
              <td style={{ padding: "14px 0 14px 0" }}>${record.costUsd.toFixed(2)}</td>
            </tr>
          ))}
          {records.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ paddingTop: 18, color: "var(--muted)" }}>
                No evidence records yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
