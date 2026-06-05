import type {
  ConfidenceBreakdown,
  DiligenceRun,
  HealthStatusResponse,
  ProofScoreComponents,
} from "../lib/types";

export function makeConfidenceBreakdown(
  overrides: Partial<ConfidenceBreakdown> = {},
): ConfidenceBreakdown {
  return {
    overall: 0.62,
    agentSignals: [
      {
        agent: "Market",
        confidence: 0.74,
        ran: true,
        recordId: "record_market",
      },
      {
        agent: "Evidence",
        confidence: 0.68,
        ran: true,
        recordId: "record_evidence",
      },
      {
        agent: "Counter",
        negativity: 0.31,
        ran: true,
        recordId: "record_counter",
      },
      {
        agent: "Skeptic",
        ran: false,
      },
    ],
    factors: [
      {
        id: "agent-market",
        label: "Market confidence 74%",
        impact: 0.19,
        recordIds: ["record_market"],
      },
      {
        id: "agent-evidence",
        label: "Evidence confidence 68%",
        impact: 0.24,
        recordIds: ["record_evidence"],
      },
      {
        id: "agent-counter",
        label: "Counter risk 31%",
        impact: -0.06,
        recordIds: ["record_counter"],
      },
    ],
    policyAdjustments: [],
    ...overrides,
  };
}

export function makeProofScoreComponents(
  overrides: Partial<ProofScoreComponents> = {},
): ProofScoreComponents {
  return {
    overall: 0.62,
    citationCoverage: 0.85,
    runCompleteness: 1,
    ...overrides,
  };
}

export function makeDiligenceRun(
  overrides: Partial<DiligenceRun> = {},
): DiligenceRun {
  const confidenceBreakdown = makeConfidenceBreakdown(
    overrides.confidenceBreakdown,
  );
  const proofScoreComponents = makeProofScoreComponents(
    overrides.proofScoreComponents,
  );

  return {
    id: "run_fixture",
    input: "Should I buy Apollo.io?",
    subject: "Apollo.io",
    budgetCapUsd: 0.25,
    spentUsd: 0.03,
    paidCalls: 3,
    paymentMode: "mock",
    llmProvider: "deterministic",
    policyProfile: "standard",
    recommendation: "need_more_evidence",
    confidence: confidenceBreakdown.overall,
    confidenceBreakdown,
    proofScore: 71,
    proofScoreComponents,
    confidenceGaps: [
      {
        id: "gap-trial",
        title: "Validate list quality with a focused trial",
        estimatedConfidenceGain: 0.08,
        estimatedCostUsd: 0,
        actionType: "trial",
        recordIds: ["record_market"],
      },
    ],
    records: [
      {
        id: "record_market",
        agent: "Market",
        query: "Apollo.io market size category competitors pricing",
        normalizedQuery: "apollo io market size category competitors pricing",
        provider: "Tavily x402 (mock)",
        paymentMode: "mock",
        costUsd: 0.01,
        receipt: "mock:market",
        finding: "Apollo.io is an established sales-intelligence vendor.",
        policyStatus: "allowed",
        sources: [
          {
            title: "Apollo pricing",
            url: "https://www.apollo.io/pricing",
            snippet: "Apollo.io pricing details",
          },
        ],
      },
      {
        id: "record_evidence",
        agent: "Evidence",
        query: "Apollo.io reviews case studies proof legitimacy",
        normalizedQuery: "apollo io reviews case studies proof legitimacy",
        provider: "Tavily x402 (mock)",
        paymentMode: "mock",
        costUsd: 0.01,
        receipt: "mock:evidence",
        finding: "Customer reviews are mixed, with upside for outbound teams.",
        policyStatus: "allowed",
        sources: [
          {
            title: "Apollo reviews",
            url: "https://example.com/reviews",
            snippet: "Mixed but useful reviews",
          },
        ],
      },
      {
        id: "record_counter",
        agent: "Counter",
        query: "Apollo.io lawsuits privacy complaints alternatives",
        normalizedQuery: "apollo io lawsuits privacy complaints alternatives",
        provider: "Tavily x402 (mock)",
        paymentMode: "mock",
        costUsd: 0.01,
        receipt: "mock:counter",
        finding: "Privacy concerns and alternative vendors keep the decision mixed.",
        policyStatus: "allowed",
        sources: [
          {
            title: "Apollo concerns",
            url: "https://example.com/concerns",
            snippet: "Mixed signals on privacy and fit",
          },
        ],
      },
    ],
    memo: "Apollo.io appears promising, but the team should validate list quality first.",
    analystOutput: {
      recommendation: "need_more_evidence",
      confidence: 0.62,
      rationale: {
        id: "claim_rationale",
        claimText:
          "Apollo.io has category fit, but ROI remains mixed until list quality is validated.",
        recordIds: ["record_market", "record_evidence", "record_counter"],
        sourceUrls: [
          "https://www.apollo.io/pricing",
          "https://example.com/reviews",
          "https://example.com/concerns",
        ],
      },
      strengths: [
        {
          id: "claim_strength_1",
          claimText: "Apollo.io is a known vendor in a proven category.",
          recordIds: ["record_market"],
          sourceUrls: ["https://www.apollo.io/pricing"],
        },
      ],
      concerns: [
        {
          id: "claim_concern_1",
          claimText: "Privacy concerns and alternatives reduce certainty.",
          recordIds: ["record_counter"],
          sourceUrls: ["https://example.com/concerns"],
        },
      ],
      nextSteps: [
        {
          id: "claim_next_1",
          claimText: "Run a narrow trial before committing to an annual spend.",
          recordIds: ["record_evidence"],
          sourceUrls: ["https://example.com/reviews"],
        },
      ],
    },
    safeSpendLog: [
      {
        agent: "Market",
        action: "preflight",
        status: "allowed",
        reason: "Within budget.",
        queryPreview: "Apollo.io market size category competitors pricing",
        projectedSpendUsd: 0.01,
      },
    ],
    ...overrides,
  };
}

export function makeHealthStatus(
  overrides: Partial<HealthStatusResponse> = {},
): HealthStatusResponse {
  return {
    ok: true,
    app: "ProofSpend",
    paymentMode: "mock",
    policyProfile: "standard",
    llmProvider: "deterministic",
    mockX402: true,
    liveConfigured: false,
    walletConfigured: false,
    searchReady: true,
    snapshotSigningAvailable: false,
    apiAuthRequired: false,
    readinessSummary: "Ready",
    estimatedPaidCallCostUsd: 0.01,
    estimatedBaselineCalls: 3,
    estimatedMaxCalls: 4,
    estimatedConfidenceRange: {
      baselineMin: 0.55,
      baselineMax: 0.7,
      upperBoundWithSkeptic: 0.78,
    },
    uptimeSeconds: 12,
    rateLimits: {
      runDiligence: { limit: 8, windowMs: 60000 },
    },
    recentWebhookDeliveries: [],
    ...overrides,
  };
}
