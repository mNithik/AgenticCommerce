import type { AgentName, AnalystOutput, FindingClaim, LLMProviderName, SearchSource } from "@/lib/types";

export type FindingResult = {
  text: string;
  claims: FindingClaim[];
};

export type SummaryInput = {
  agent: AgentName;
  subject: string;
  query: string;
  sources: SearchSource[];
};

export type AnalystInput = {
  question: string;
  subject: string;
  records: Array<{
    id: string;
    agent: AgentName;
    finding: string;
    sources: SearchSource[];
  }>;
};

export interface LLMProvider {
  readonly name: LLMProviderName;
  isConfigured(): boolean;
  extractSubject(question: string): Promise<string>;
  summarizeFinding(input: SummaryInput): Promise<FindingResult>;
  scoreConfidence(text: string): Promise<number>;
  scoreNegativity(text: string): Promise<number>;
  synthesizeAnalystOutput(input: AnalystInput): Promise<AnalystOutput>;
}
