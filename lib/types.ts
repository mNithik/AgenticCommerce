export type AgentName = "Market" | "Evidence" | "Counter" | "Skeptic";

export type PaymentMode = "mock" | "live";

export type LLMProviderName = "nvidia" | "openai" | "huggingface" | "deterministic";

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
  action: "preflight" | "receipt";
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

export type DiligenceRun = {
  id: string;
  input: string;
  subject: string;
  budgetCapUsd: number;
  spentUsd: number;
  paidCalls: number;
  paymentMode: PaymentMode;
  llmProvider: LLMProviderName;
  recommendation: Recommendation;
  confidence: number;
  records: EvidenceRecord[];
  memo: string;
  analystOutput: AnalystOutput;
  safeSpendLog: SafeSpendEvent[];
};

export type RunEvent =
  | {
      type: "run_started";
      runId: string;
      paymentMode: PaymentMode;
      llmProvider: LLMProviderName;
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
      type: "complete";
      run: DiligenceRun;
    };
