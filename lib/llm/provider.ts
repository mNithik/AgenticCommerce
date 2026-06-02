import type { AgentName, AnalystOutput, LLMProviderName, SearchSource } from "../types";

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
  summarizeFinding(input: SummaryInput): Promise<string>;
  scoreConfidence(text: string): Promise<number>;
  scoreNegativity(text: string): Promise<number>;
  synthesizeAnalystOutput(input: AnalystInput): Promise<AnalystOutput>;
}
