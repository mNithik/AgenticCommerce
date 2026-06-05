export type AgentName = "Market" | "Evidence" | "Counter" | "Skeptic";

export type PaymentMode = "mock" | "live";

export type LLMProviderName = "nvidia" | "openai" | "huggingface" | "deterministic";

export type PolicyProfile = "standard" | "strict";

export type PolicyStatus = "allowed" | "blocked";

export type Recommendation = "buy" | "do_not_buy" | "need_more_evidence";

export type ConfidenceGapActionType = "paid_search" | "trial" | "internal_data";
export type ConfidenceGapTheme =
  | "legal_resolution"
  | "pricing_validation"
  | "implementation_validation"
  | "deliverability_validation"
  | "general_validation";

export type DiligenceRequestedSection =
  | "competitive"
  | "pricing"
  | "roi"
  | "legal"
  | "implementation"
  | "fit";

export type DiligenceBrief = {
  rawQuestion: string;
  subject: string;
  useCaseContext?: string;
  decisionFrame?: "buy" | "wait" | "avoid" | "spend";
  requestedSections: DiligenceRequestedSection[];
  spendSignal?: string;
  companyStage?: string;
};

export type SearchSource = {
  title: string;
  url: string;
  snippet: string;
  score?: number;
};

export type StructuredFindingMeta = {
  summary: string;
  riskFlags: string[];
  positiveSignals: string[];
  theme?: ConfidenceGapTheme;
};

export type EvidenceRecord = {
  id: string;
  agent: AgentName;
  query: string;
  normalizedQuery: string;
  provider: "Tavily x402" | "Tavily x402 (mock)";
  paymentMode: PaymentMode;
  costUsd: number;
  receipt: string;
  finding: string;
  findingMeta?: StructuredFindingMeta;
  sources: SearchSource[];
  policyStatus: PolicyStatus;
};

export type SafeSpendEvent = {
  agent: AgentName;
  action: "batch_preflight" | "preflight" | "receipt";
  status: PolicyStatus;
  reason: string;
  queryPreview?: string;
  projectedSpendUsd?: number;
};

export type MemoClaim = {
  id: string;
  claimText: string;
  recordIds: string[];
  sourceUrls: string[];
};

export type AnalystOutput = {
  recommendation: Recommendation;
  confidence: number;
  rationale: MemoClaim;
  strengths: MemoClaim[];
  concerns: MemoClaim[];
  nextSteps: MemoClaim[];
};

export type ConfidenceAgentSignal = {
  agent: AgentName;
  confidence?: number;
  negativity?: number;
  ran: boolean;
  recordId?: string;
};

export type ConfidenceFactor = {
  id: string;
  label: string;
  impact: number;
  recordIds?: string[];
};

export type DecisionFactor = {
  id: string;
  label: string;
  impact: "positive" | "negative" | "blocking";
  recordIds?: string[];
};

export type PolicyAdjustment = {
  rule: string;
  delta: number;
  reason: string;
};

export type ConfidenceCeiling = {
  value: number;
  reason: string;
  recordIds?: string[];
};

export type CounterRecordSignal = {
  recordId: string;
  negativity: number;
  theme?: ConfidenceGapTheme;
};

export type ConfidenceBreakdown = {
  overall: number;
  agentSignals: ConfidenceAgentSignal[];
  factors: ConfidenceFactor[];
  policyAdjustments: PolicyAdjustment[];
  effectiveCounterRisk?: number;
  confidenceCeiling?: ConfidenceCeiling | null;
};

export type ProofScoreComponents = {
  overall: number;
  citationCoverage: number;
  runCompleteness: number;
};

export type ConfidenceGap = {
  id: string;
  title: string;
  detail?: string;
  estimatedConfidenceGain: number;
  estimatedCostUsd: number;
  suggestedQuery?: string;
  actionType: ConfidenceGapActionType;
  recordIds?: string[];
  focusAgent?: AgentName;
  parentRunId?: string;
  theme?: ConfidenceGapTheme;
  priority?: number;
};

export type HealthStatusResponse = {
  ok: true;
  app: "ProofSpend";
  paymentMode: PaymentMode;
  policyProfile: PolicyProfile;
  llmProvider: LLMProviderName;
  mockX402: boolean;
  liveConfigured: boolean;
  walletConfigured: boolean;
  searchReady: boolean;
  snapshotSigningAvailable: boolean;
  apiAuthRequired: boolean;
  readinessSummary: string;
  estimatedPaidCallCostUsd: number;
  estimatedBaselineCalls: number;
  estimatedMaxCalls: number;
  estimatedConfidenceRange: {
    baselineMin: number;
    baselineMax: number;
    upperBoundWithSkeptic: number;
  };
  uptimeSeconds: number;
  rateLimits: Record<string, { limit: number; windowMs: number }>;
  recentWebhookDeliveries: WebhookDeliveryStatus[];
};

export type WebhookDeliveryStatus = {
  id: string;
  runId?: string;
  callbackUrl: string;
  status: "delivered" | "failed" | "skipped";
  attempts: number;
  deliveredAt: string;
  httpStatus?: number;
  error?: string;
};

export type ScheduleTemplate = {
  id: string;
  label: string;
  question: string;
  budgetCapUsd: number;
  policyProfile: PolicyProfile;
  callbackUrl?: string;
  intervalMinutes: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  nextRunAt: string;
  lastRunAt?: string;
  lastRunId?: string;
  lastStatus?: "success" | "failed";
  lastError?: string;
};

export type ObservabilityEvent = {
  id: string;
  category: "run" | "webhook" | "schedule" | "verify" | "mcp";
  status: "info" | "success" | "error";
  message: string;
  timestamp: string;
  relatedId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type DiligenceRun = {
  id: string;
  input: string;
  subject: string;
  diligenceBrief?: DiligenceBrief;
  parentRunId?: string;
  continuedFromGapId?: string;
  continuationDepth?: number;
  budgetCapUsd: number;
  spentUsd: number;
  paidCalls: number;
  paymentMode: PaymentMode;
  llmProvider: LLMProviderName;
  policyProfile: PolicyProfile;
  recommendation: Recommendation;
  confidence: number;
  confidenceBreakdown: ConfidenceBreakdown;
  proofScore: number;
  proofScoreComponents: ProofScoreComponents;
  confidenceGaps: ConfidenceGap[];
  decisionFactors?: DecisionFactor[];
  confidenceCeiling?: ConfidenceCeiling | null;
  records: EvidenceRecord[];
  memo: string;
  analystOutput: AnalystOutput;
  safeSpendLog: SafeSpendEvent[];
  webhookDelivery?: WebhookDeliveryStatus;
};

export type ProofPacketMetadata = {
  exportedAt: string;
  appName: "ProofSpend";
  exportFormatVersion: 2;
  attestation: ProofAttestation;
};

export type ProofPacketJson = {
  metadata: ProofPacketMetadata;
  run: DiligenceRun;
};

export type ProofAttestation = {
  formatVersion: 1;
  canonicalizer: "proofspend.run.v1";
  digestAlgorithm: "SHA-256";
  digest: string;
  signedAt: string;
  signingMode: "digest-only" | "hmac-sha256";
  signature?: string;
  keyId?: string;
};

export type SnapshotEnvelope = {
  version: 2;
  createdAt: string;
  run: DiligenceRun;
  attestation: ProofAttestation;
};

export type ProofVerificationResult = {
  ok: boolean;
  verified: boolean;
  digestMatch: boolean;
  signatureMatch: boolean | null;
  signingMode: ProofAttestation["signingMode"] | "unknown";
  runId: string | null;
  subject: string | null;
  message: string;
};

export type RunEvent =
  | {
      type: "run_started";
      runId: string;
      paymentMode: PaymentMode;
      llmProvider: LLMProviderName;
      policyProfile: PolicyProfile;
      budgetCapUsd: number;
    }
  | {
      type: "agent_started";
      agent: AgentName;
      queryPreview: string;
      projectedSpendUsd: number;
    }
  | {
      type: "payment_settled";
      agent: AgentName;
      receipt: string;
      costUsd: number;
      paymentMode: PaymentMode;
    }
  | {
      type: "agent_completed";
      agent: AgentName;
      record: EvidenceRecord;
      spentUsd: number;
      paidCalls: number;
    }
  | {
      type: "policy_blocked";
      agent: AgentName;
      reason: string;
      spentUsd: number;
    }
  | {
      type: "confidence_updated";
      overall: number;
      proofScore: number;
      reason: string;
      agent?: AgentName;
      recordId?: string;
    }
  | {
      type: "follow_up_started";
      agent: AgentName;
      queryPreview: string;
      gapId: string;
      projectedSpendUsd: number;
    }
  | {
      type: "follow_up_completed";
      agent: AgentName;
      gapId: string;
      record: EvidenceRecord;
      spentUsd: number;
      paidCalls: number;
    }
  | {
      type: "search_failed";
      agent: AgentName;
      query: string;
      reason: string;
    }
  | {
      type: "run_error";
      message: string;
      agent?: AgentName;
    }
  | {
      type: "webhook_delivery";
      delivery: WebhookDeliveryStatus;
    }
  | {
      type: "complete";
      run: DiligenceRun;
    };
