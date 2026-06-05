import type { LLMProvider } from "../llm/provider";
import type { AnalystOutput, EvidenceRecord, MemoClaim } from "../types";

function renderClaim(claim: MemoClaim, records: EvidenceRecord[]) {
  const sources = claim.recordIds
    .map((recordId) => records.find((record) => record.id === recordId))
    .filter(Boolean)
    .map((record) => {
      const matchedUrls = claim.sourceUrls.filter((url) =>
        record?.sources.some((source) => source.url === url),
      );
      const receiptLabel =
        record?.paymentMode === "live" ? `[receipt](${`https://basescan.org/tx/${record.receipt}`})` : "simulated receipt";
      return `- ${record?.agent}: ${matchedUrls.join(", ")} (${receiptLabel})`;
    })
    .join("\n");

  return `- ${claim.claimText}\n${sources}`;
}

export async function synthesizeMemo(params: {
  question: string;
  subject: string;
  records: EvidenceRecord[];
  provider: LLMProvider;
  paymentMode: EvidenceRecord["paymentMode"];
  serverRecommendation?: AnalystOutput["recommendation"];
  decisionFactors?: { label: string }[];
  confidenceCeiling?: { reason: string; value?: number } | null;
  openGapTitles?: string[];
  diligenceBrief?: import("../types").DiligenceBrief;
}): Promise<{ analystOutput: AnalystOutput; memo: string }> {
  const analystOutput = await params.provider.synthesizeAnalystOutput({
    question: params.question,
    subject: params.subject,
    serverRecommendation: params.serverRecommendation,
    decisionFactors: params.decisionFactors?.map((factor, index) => ({
      id: `decision_factor_${index}`,
      label: factor.label,
      impact: "blocking",
    })),
    confidenceCeiling: params.confidenceCeiling
      ? {
          value: params.confidenceCeiling.value ?? 0,
          reason: params.confidenceCeiling.reason,
        }
      : null,
    openGapTitles: params.openGapTitles,
    diligenceBrief: params.diligenceBrief,
    requiredSections: params.diligenceBrief?.requestedSections,
    records: params.records.map((record) => ({
      id: record.id,
      agent: record.agent,
      finding: record.finding,
      findingMeta: record.findingMeta,
      sources: record.sources,
    })),
  });

  const sections = [
    `# ProofSpend memo`,
    ``,
    ...(params.diligenceBrief
      ? [
          `Question recap: **${params.diligenceBrief.subject}**${params.diligenceBrief.useCaseContext ? ` for ${params.diligenceBrief.useCaseContext}` : ""}`,
          ``,
        ]
      : []),
    `Recommendation: **${analystOutput.recommendation}**`,
    `Confidence: **${Math.round(analystOutput.confidence * 100)}%**`,
    ``,
    `## Rationale`,
    renderClaim(analystOutput.rationale, params.records),
    ``,
    `## Strengths`,
    ...analystOutput.strengths.map((claim) => renderClaim(claim, params.records)),
    ``,
    `## Concerns`,
    ...analystOutput.concerns.map((claim) => renderClaim(claim, params.records)),
    ``,
    `## Next steps`,
    ...analystOutput.nextSteps.map((claim) => renderClaim(claim, params.records)),
    ``,
    `## Receipt verification`,
    params.paymentMode === "live"
      ? `${params.records.length} paid searches settled on Base. Verify the transaction links in the evidence table or proof packet.`
      : `This run used simulated receipts in mock mode. Switch to live mode to produce on-chain Base receipts.`,
  ];

  return {
    analystOutput,
    memo: sections.join("\n"),
  };
}
