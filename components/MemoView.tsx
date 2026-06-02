import type { AnalystOutput, EvidenceRecord } from "../lib/types";

function ReceiptLink({ record }: { record: EvidenceRecord | undefined }) {
  if (!record) {
    return null;
  }

  if (record.paymentMode === "live") {
    return (
      <a href={`https://basescan.org/tx/${record.receipt}`} target="_blank" rel="noreferrer">
        receipt
      </a>
    );
  }

  return <span>simulated receipt</span>;
}

export function MemoView({
  analystOutput,
  records,
  activeRecordIds = [],
  onClaimSelect,
}: {
  analystOutput: AnalystOutput | null;
  records: EvidenceRecord[];
  activeRecordIds?: string[];
  onClaimSelect?: (recordIds: string[]) => void;
}) {
  if (!analystOutput) {
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
        <div style={{ color: "var(--muted)" }}>
          The analyst memo will appear here after the evidence records are collected.
        </div>
      </section>
    );
  }

  const renderClaims = (claims: AnalystOutput["strengths"]) =>
    claims.map((claim) => (
      <li
        key={claim.id}
        style={{
          marginBottom: 12,
          listStyle: "none",
          border: activeRecordIds.some((recordId) => claim.recordIds.includes(recordId))
            ? "1px solid rgba(37, 99, 235, 0.35)"
            : "1px solid transparent",
          borderRadius: 16,
          padding: 12,
          background: activeRecordIds.some((recordId) => claim.recordIds.includes(recordId))
            ? "rgba(37, 99, 235, 0.08)"
            : "transparent",
        }}
      >
        <button
          type="button"
          onClick={() => onClaimSelect?.(claim.recordIds)}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            textAlign: "left",
            width: "100%",
            cursor: claim.recordIds.length ? "pointer" : "default",
            color: "inherit",
            font: "inherit",
          }}
        >
          <div>{claim.claimText}</div>
        </button>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
          {claim.recordIds.map((recordId) => {
            const record = records.find((item) => item.id === recordId);
            return (
              <span key={recordId} style={{ marginRight: 12 }}>
                {record?.agent ?? recordId}: <ReceiptLink record={record} />
              </span>
            );
          })}
        </div>
      </li>
    ));

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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Recommendation
          </div>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{analystOutput.recommendation}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Confidence
          </div>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{Math.round(analystOutput.confidence * 100)}%</div>
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <h3>Rationale</h3>
        <p style={{ lineHeight: 1.6 }}>{analystOutput.rationale.claimText}</p>
      </div>

      <div style={{ marginTop: 22 }}>
        <h3>Strengths</h3>
        <ul>{renderClaims(analystOutput.strengths)}</ul>
      </div>

      <div style={{ marginTop: 22 }}>
        <h3>Concerns</h3>
        <ul>{renderClaims(analystOutput.concerns)}</ul>
      </div>

      <div style={{ marginTop: 22 }}>
        <h3>Next steps</h3>
        <ul>{renderClaims(analystOutput.nextSteps)}</ul>
      </div>

      <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--line)", color: "var(--muted)" }}>
        {records.some((record) => record.paymentMode === "live")
          ? `${records.length} paid searches settled on Base. Click any claim to trace back to the evidence row and receipt.`
          : "Mock mode watermark: these receipts are simulated and not on-chain."}
      </div>
    </section>
  );
}
