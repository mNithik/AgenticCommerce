import type {
  DiligenceRun,
  EvidenceRecord,
  MemoClaim,
  ProofAttestation,
  ProofPacketJson,
  ProofPacketMetadata,
  SafeSpendEvent,
} from "./types";
import { buildRunAttestation } from "./trust";

const APP_NAME = "ProofSpend";
const EXPORT_FORMAT_VERSION = 2;

function escapeMarkdown(value: string) {
  return value.replace(/\|/g, "\\|");
}

function toCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function verificationLine(attestation: ProofAttestation) {
  return attestation.signingMode === "hmac-sha256"
    ? `Server-signed (${attestation.keyId ?? "proofspend-local"})`
    : "Digest-only (tamper-evident)";
}

async function buildMetadata(
  run: DiligenceRun,
  attestationOverride?: ProofAttestation,
): Promise<ProofPacketMetadata> {
  const attestation = attestationOverride ?? (await buildRunAttestation(run));
  return {
    exportedAt: new Date().toISOString(),
    appName: APP_NAME,
    exportFormatVersion: EXPORT_FORMAT_VERSION,
    attestation,
  };
}

function claimTrace(claim: MemoClaim) {
  return [
    `record ids: ${claim.recordIds.join(", ") || "none"}`,
    `sources: ${claim.sourceUrls.join(", ") || "none"}`,
  ].join(" | ");
}

function receiptUrl(record: EvidenceRecord) {
  return record.paymentMode === "live"
    ? `https://basescan.org/tx/${record.receipt}`
    : null;
}

function receiptLabel(record: EvidenceRecord) {
  if (record.paymentMode === "live") {
    return `[${record.receipt}](${receiptUrl(record)})`;
  }

  return `simulated receipt (${record.receipt})`;
}

function renderClaimList(title: string, claims: MemoClaim[]) {
  if (claims.length === 0) {
    return `## ${title}\n\n- None.\n`;
  }

  return [
    `## ${title}`,
    "",
    ...claims.map((claim) => `- ${claim.claimText}\n  - ${claimTrace(claim)}`),
    "",
  ].join("\n");
}

function renderEvidenceRow(record: EvidenceRecord) {
  const sources =
    record.sources.length > 0
      ? record.sources
          .map((source) => `[${escapeMarkdown(source.title)}](${source.url})`)
          .join("<br />")
      : "None";

  return [
    escapeMarkdown(record.agent),
    escapeMarkdown(record.query),
    escapeMarkdown(record.finding),
    receiptLabel(record),
    toCurrency(record.costUsd),
    sources,
  ].join(" | ");
}

function renderSafeSpendEvent(event: SafeSpendEvent) {
  const projected =
    typeof event.projectedSpendUsd === "number"
      ? ` | projected spend: ${toCurrency(event.projectedSpendUsd)}`
      : "";
  const queryPreview = event.queryPreview
    ? ` | query: ${event.queryPreview}`
    : "";

  return `- ${event.agent} ${event.action} ${event.status}: ${event.reason}${projected}${queryPreview}`;
}

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function buildProofPacketFilename(
  run: DiligenceRun,
  extension: "json" | "md",
) {
  const subject = sanitizeSegment(run.subject);
  const stem = subject ? `proofspend-${subject}` : "proofspend-run";
  return `${stem}-run_${run.id}.${extension}`;
}

export async function buildProofPacketJson(
  run: DiligenceRun,
  attestationOverride?: ProofAttestation,
): Promise<ProofPacketJson> {
  return {
    metadata: await buildMetadata(run, attestationOverride),
    run,
  };
}

export async function buildProofPacketMarkdown(
  run: DiligenceRun,
  attestationOverride?: ProofAttestation,
) {
  const metadata = await buildMetadata(run, attestationOverride);
  const sourcesByClaim = (claim: MemoClaim) =>
    claim.sourceUrls.length > 0 ? claim.sourceUrls.map((url) => `- ${url}`).join("\n") : "- none";

  const claimSections = [
    renderClaimList("Strengths", run.analystOutput.strengths),
    renderClaimList("Concerns", run.analystOutput.concerns),
    renderClaimList("Next Steps", run.analystOutput.nextSteps),
  ].join("\n");

  const evidenceRows =
    run.records.length > 0
      ? run.records.map(renderEvidenceRow).join("\n")
      : "No evidence records collected.";

  const safeSpendRows =
    run.safeSpendLog.length > 0
      ? run.safeSpendLog.map(renderSafeSpendEvent).join("\n")
      : "- No SafeSpend events recorded.";

  return [
    `# ProofSpend Proof Packet`,
    "",
    `- Run ID: ${run.id}`,
    `- Question: ${run.input}`,
    `- Subject: ${run.subject}`,
    `- Recommendation: ${run.recommendation}`,
    `- Confidence: ${Math.round(run.confidence * 100)}%`,
    `- Proof Score: ${run.proofScore}/100`,
    `- Payment mode: ${run.paymentMode}`,
    `- LLM provider: ${run.llmProvider}`,
    `- Policy profile: ${run.policyProfile}`,
    `- Spend: ${toCurrency(run.spentUsd)} of ${toCurrency(run.budgetCapUsd)}`,
    `- Paid calls: ${run.paidCalls}`,
    "",
    "## Verification",
    "",
    `- Exported at: ${metadata.exportedAt}`,
    `- Export format version: ${metadata.exportFormatVersion}`,
    `- Digest: ${metadata.attestation.digest}`,
    `- Signing mode: ${verificationLine(metadata.attestation)}`,
    metadata.attestation.signature
      ? `- Signature: ${metadata.attestation.signature}`
      : "- Signature: none",
    `- Verify endpoint: POST /api/verify-proof`,
    "",
    "## Confidence Breakdown",
    "",
    `- Overall confidence: ${Math.round(run.confidenceBreakdown.overall * 100)}%`,
    `- Proof Score: ${run.proofScore}/100`,
    `- Citation coverage: ${Math.round(run.proofScoreComponents.citationCoverage * 100)}%`,
    `- Run completeness: ${Math.round(run.proofScoreComponents.runCompleteness * 100)}%`,
    "",
    ...run.confidenceBreakdown.agentSignals.map(
      (signal) =>
        `- ${signal.agent}: ${signal.confidence !== undefined ? `${Math.round(signal.confidence * 100)}% confidence` : signal.negativity !== undefined ? `${Math.round(signal.negativity * 100)}% risk` : signal.ran ? "completed" : "skipped"}`
    ),
    "",
    ...run.confidenceBreakdown.factors.map(
      (factor) =>
        `- ${factor.label} (${factor.impact >= 0 ? "+" : ""}${Math.round(factor.impact * 100)} pts)${factor.recordIds?.length ? ` | records: ${factor.recordIds.join(", ")}` : ""}`
    ),
    "",
    ...(run.confidenceBreakdown.policyAdjustments.length > 0
      ? [
          "### Policy Adjustments",
          "",
          ...run.confidenceBreakdown.policyAdjustments.map(
            (adjustment) =>
              `- ${adjustment.rule}: ${adjustment.reason} (${adjustment.delta >= 0 ? "+" : ""}${Math.round(adjustment.delta * 100)} pts)`,
          ),
          "",
        ]
      : []),
    ...(run.confidenceGaps.length > 0
      ? [
          "## Confidence Gaps",
          "",
          ...run.confidenceGaps.map(
            (gap) =>
              `- ${gap.title} | +${Math.round(gap.estimatedConfidenceGain * 100)} pts | ${toCurrency(gap.estimatedCostUsd)} | ${gap.actionType}${gap.suggestedQuery ? ` | query: ${gap.suggestedQuery}` : ""}`,
          ),
          "",
        ]
      : []),
    ...(run.decisionFactors?.length
      ? [
          "## Why This Verdict",
          "",
          ...run.decisionFactors.map((factor) => `- ${factor.label}`),
          "",
        ]
      : []),
    ...(run.confidenceCeiling
      ? [
          "## Confidence Ceiling",
          "",
          `- Capped at ${Math.round(run.confidenceCeiling.value * 100)}%`,
          `- Reason: ${run.confidenceCeiling.reason}`,
          "",
        ]
      : []),
    "## Rationale",
    "",
    `${run.analystOutput.rationale.claimText}`,
    "",
    `Trace: ${claimTrace(run.analystOutput.rationale)}`,
    `${sourcesByClaim(run.analystOutput.rationale)}`,
    "",
    claimSections,
    "## Evidence Records",
    "",
    "| Agent | Query | Finding | Receipt | Cost | Sources |",
    "| --- | --- | --- | --- | --- | --- |",
    evidenceRows,
    "",
    "## SafeSpend Log",
    "",
    safeSpendRows,
    "",
    "## Raw Memo",
    "",
    run.memo,
    "",
  ].join("\n");
}
