import type {
  AgentName,
  AnalystOutput,
  ConfidenceCeiling,
  DecisionFactor,
  DiligenceBrief,
  LLMProviderName,
  Recommendation,
  SearchSource,
  StructuredFindingMeta,
} from "../types";

export type SummaryInput = {
  agent: AgentName;
  subject: string;
  query: string;
  sources: SearchSource[];
};

export type AnalystInput = {
  question: string;
  subject: string;
  serverRecommendation?: Recommendation;
  decisionFactors?: DecisionFactor[];
  confidenceCeiling?: ConfidenceCeiling | null;
  openGapTitles?: string[];
  diligenceBrief?: DiligenceBrief;
  requiredSections?: string[];
  records: Array<{
    id: string;
    agent: AgentName;
    finding: string;
    findingMeta?: StructuredFindingMeta;
    sources: SearchSource[];
  }>;
};

export interface LLMProvider {
  readonly name: LLMProviderName;
  isConfigured(): boolean;
  extractSubject(question: string): Promise<string>;
  summarizeFinding(input: SummaryInput): Promise<string>;
  summarizeFindingStructured?(input: SummaryInput): Promise<StructuredFindingMeta>;
  scoreConfidence(text: string): Promise<number>;
  scoreNegativity(text: string): Promise<number>;
  synthesizeAnalystOutput(input: AnalystInput): Promise<AnalystOutput>;
}
