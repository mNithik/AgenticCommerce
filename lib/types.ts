export type AgentName = "Market" | "Evidence" | "Counter" | "Skeptic";

export type PaymentMode = "mock" | "live";

export type LLMProviderName = "nvidia" | "openai" | "huggingface" | "deterministic";

export type PolicyProfile = "standard" | "strict";

export type PolicyStatus = "allowed" | "blocked";

export type Recommendation = "buy" | "do_not_buy" | "need_more_evidence";

export type SearchSource = {
  title: string;
  url: string;
  snippet: string;
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
  readinessSummary: string;
  estimatedPaidCallCostUsd: number;
  estimatedBaselineCalls: number;
  estimatedMaxCalls: number;
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
  budgetCapUsd: number;
  spentUsd: number;
  paidCalls: number;
  paymentMode: PaymentMode;
  llmProvider: LLMProviderName;
  policyProfile: PolicyProfile;
  recommendation: Recommendation;
  confidence: number;
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
  ok: true;
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
