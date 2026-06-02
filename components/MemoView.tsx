import type { AnalystOutput, EvidenceRecord } from "@/lib/types";

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
}: {
  analystOutput: AnalystOutput | null;
  records: EvidenceRecord[];
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
      <li key={claim.id} style={{ marginBottom: 12 }}>
        <div>{claim.claimText}</div>
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
    </section>
  );
}
