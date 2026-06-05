import type { EvidenceRow, Memo, SafeSpendEvent, TimelineEvent } from "../components/proofspend/Dashboard";

export const DEMO_TIMELINE: TimelineEvent[] = [
  { t: "00:00.1", agent: "system", type: "run_started", text: "Run started in mock mode with nvidia using the standard policy profile." },
  { t: "00:02.8", agent: "market", type: "payment_settled", text: "search.x402 settled on Base · Apollo.io pricing tiers", cost: 0.01, receipt: "mock:0xrun_956001" },
  { t: "00:03.3", agent: "market", type: "confidence_updated", text: "Market raised confidence to 57% and proof score to 59." },
  { t: "00:05.1", agent: "evidence", type: "payment_settled", text: "reports.x402 settled on Base · ZoomInfo benchmark", cost: 0.01, receipt: "mock:0xrun_956002" },
  { t: "00:05.6", agent: "evidence", type: "confidence_updated", text: "Evidence raised confidence to 68% and proof score to 71." },
  { t: "00:06.0", agent: "counter", type: "policy_blocked", text: "Gartner full report blocked · projected $0.034 exceeds per-call cap" },
  { t: "00:06.3", agent: "counter", type: "confidence_updated", text: "Blocked counter search reduced expected coverage; confidence adjusted to 64% and proof score to 67." },
  { t: "00:08.0", agent: "counter", type: "payment_settled", text: "reviews.x402 settled on Base · accuracy complaints", cost: 0.01, receipt: "mock:0xrun_956003" },
  { t: "00:09.0", agent: "counter", type: "confidence_updated", text: "Counter evidence reduced confidence to 61% and proof score to 65." },
  { t: "00:12.6", agent: "system", type: "complete", text: "Synthesis complete · confidence 61% · need_more_evidence" },
];

export const DEMO_EVIDENCE: EvidenceRow[] = [
  { id: "rec_001", agent: "market", query: "Apollo.io pricing tiers", finding: "Pro $79/seat annual; $500/mo fits 5-6 seats with overage risk.", sources: [{ label: "apollo.io/pricing", url: "#" }], receipt: "mock:0xrun_956001", cost: 0.01 },
  { id: "rec_002", agent: "evidence", query: "Pipeline lift benchmarks", finding: "Median 1.4-2.1x SQL volume in months 2-4 with enrichment hygiene.", sources: [{ label: "g2.com/apollo", url: "#" }], receipt: "mock:0xrun_956002", cost: 0.01 },
  { id: "rec_003", agent: "counter", query: "Accuracy complaints", finding: "31% of G2 reviews cite stale mobile numbers.", sources: [{ label: "trustradius.com", url: "#" }], receipt: "mock:0xrun_956003", cost: 0.01 },
];

export const DEMO_MEMO: Memo = {
  verdict: "need_more_evidence",
  confidence: 61,
  proofScore: 65,
  proofScoreComponents: {
    overall: 61,
    citationCoverage: 100,
    runCompleteness: 95,
  },
  confidenceBreakdown: {
    overall: 61,
    agentSignals: [
      { agent: "Market", ran: true, confidence: 74, recordId: "rec_001" },
      { agent: "Evidence", ran: true, confidence: 78, recordId: "rec_002" },
      { agent: "Counter", ran: true, negativity: 44, recordId: "rec_003" },
      { agent: "Skeptic", ran: false },
    ],
    factors: [
      { id: "market-fit", label: "Market signal supports Apollo.io category fit", impact: 18, recordIds: ["rec_001"] },
      { id: "trial-upside", label: "Evidence suggests pipeline upside if hygiene is strong", impact: 22, recordIds: ["rec_002"] },
      { id: "accuracy-risk", label: "Accuracy complaints reduce dialing certainty", impact: -15, recordIds: ["rec_003"] },
      { id: "blocked-depth", label: "Blocked premium counter-search left one gap open", impact: -6, recordIds: [] },
    ],
    policyAdjustments: [],
    effectiveCounterRisk: 44,
    confidenceCeiling: null,
  },
  confidenceGaps: [
    {
      id: "gap-gartner",
      title: "Buy one premium counter-signal search or benchmark report",
      estimatedConfidenceGain: 0.09,
      estimatedCostUsd: 0.03,
      actionType: "paid_search",
      suggestedQuery: "Apollo.io enterprise benchmark report ROI",
      recordIds: [],
    },
    {
      id: "gap-trial",
      title: "Run a 14-day trial with two SDR seats and measure connect rate",
      estimatedConfidenceGain: 0.11,
      estimatedCostUsd: 0,
      actionType: "trial",
      recordIds: ["rec_002"],
    },
  ],
  decisionFactors: [
    { id: "validation-needed", label: "Pricing and upside are promising, but validation is still required before a firm spend decision.", impact: "blocking", recordIds: ["rec_001", "rec_002"] },
    { id: "counter-risk", label: "Accuracy complaints still introduce unresolved dialing risk.", impact: "negative", recordIds: ["rec_003"] },
  ],
  confidenceCeiling: null,
  rationale: "Pricing fits a 5-6 seat plan and pipeline lift is attested, but stale-mobile complaints and churn signals force a trial before commitment.",
  strengths: [{ text: "1.4-2.1x SQL lift is attested across two sources.", citations: [{ agent: "evidence", receipt: "mock:0xrun_956002", recordId: "rec_002" }] }],
  concerns: [{ text: "31% stale mobile data complaints undermine dialing ROI.", citations: [{ agent: "counter", receipt: "mock:0xrun_956003", recordId: "rec_003" }] }],
  nextSteps: [{ text: "Run a 14-day Pro trial on 2 seats before committing.", citations: [{ agent: "evidence", receipt: "mock:0xrun_956002", recordId: "rec_002" }] }],
};

export const DEMO_SAFESPEND: SafeSpendEvent[] = [
  { kind: "batch_preflight", agent: "system", action: "batch.dispatch(3)", status: "allowed", reason: "Projection $0.03 within $0.25 cap", projectedSpendUsd: 0.03 },
  { kind: "preflight", agent: "market", action: "search.x402", status: "allowed", reason: "Per-call cap cleared", queryPreview: "Apollo.io pricing", projectedSpendUsd: 0.012 },
];
