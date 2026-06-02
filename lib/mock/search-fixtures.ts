import type { AgentName, PaymentMode, SearchSource } from "@/lib/types";
import { hashText, slugify } from "@/lib/utils";

type MockSearchResult = {
  results: SearchSource[];
  costUsd: number;
  provider: "Tavily x402 (mock)";
  paymentMode: PaymentMode;
  receipt: string;
};

const templates: Record<AgentName, Array<(subject: string) => SearchSource>> = {
  Market: [
    (subject) => ({
      title: `${subject} category growth outpaces legacy tools`,
      url: `https://example.com/${slugify(subject)}/market-growth`,
      snippet: `${subject} sits in a category with rising budget allocation, recurring spend, and several funded competitors proving demand.`,
    }),
    (subject) => ({
      title: `${subject} competitor pricing shows premium willingness`,
      url: `https://example.com/${slugify(subject)}/pricing`,
      snippet: `Customers already pay for adjacent products, with pricing anchored around workflow savings and compliance confidence.`,
    }),
    (subject) => ({
      title: `${subject} buyers prioritize measurable ROI`,
      url: `https://example.com/${slugify(subject)}/roi`,
      snippet: `Case studies emphasize time savings, audit readiness, and faster decision cycles when buyers can trace evidence.`,
    }),
  ],
  Evidence: [
    (subject) => ({
      title: `${subject} user reviews highlight fast onboarding`,
      url: `https://example.com/${slugify(subject)}/reviews`,
      snippet: `Users praise simple setup, clarity of outputs, and better stakeholder trust when evidence is linked to decisions.`,
    }),
    (subject) => ({
      title: `${subject} implementation stories show steady adoption`,
      url: `https://example.com/${slugify(subject)}/adoption`,
      snippet: `Reference customers report adoption when the product fits an existing review workflow instead of creating net-new process overhead.`,
    }),
    (subject) => ({
      title: `${subject} legitimacy signals from buyer checklists`,
      url: `https://example.com/${slugify(subject)}/legitimacy`,
      snippet: `Buyers look for transparent sourcing, clear pricing, and verifiable evidence before committing to longer contracts.`,
    }),
  ],
  Counter: [
    (subject) => ({
      title: `${subject} complaints focus on overpromising automation`,
      url: `https://example.com/${slugify(subject)}/complaints`,
      snippet: `Skeptical reviewers warn that some vendors overstate coverage and leave teams to verify important details manually.`,
    }),
    (subject) => ({
      title: `${subject} failed rollouts cite weak process fit`,
      url: `https://example.com/${slugify(subject)}/failures`,
      snippet: `Failed deployments often stem from unclear ownership, thin ROI measurement, and weak integration with existing procurement steps.`,
    }),
    (subject) => ({
      title: `${subject} churn risk rises when evidence quality slips`,
      url: `https://example.com/${slugify(subject)}/churn`,
      snippet: `Retention drops when teams stop trusting the underlying evidence trail or when outputs become too generic to defend internally.`,
    }),
  ],
  Skeptic: [
    (subject) => ({
      title: `${subject} negative press questions hidden implementation costs`,
      url: `https://example.com/${slugify(subject)}/negative-press`,
      snippet: `Some buyers report hidden service costs and stretched deployment timelines even when the initial research looked compelling.`,
    }),
    (subject) => ({
      title: `${subject} risk review flags thin differentiation`,
      url: `https://example.com/${slugify(subject)}/risk-review`,
      snippet: `Analysts note that strong narratives can mask weak defensibility if the product does not own proprietary workflow data or trusted distribution.`,
    }),
    (subject) => ({
      title: `${subject} failed deployments trace back to evidence drift`,
      url: `https://example.com/${slugify(subject)}/evidence-drift`,
      snippet: `Operational trust erodes when claims are not refreshed or when evidence links stop mapping clearly to the final recommendation.`,
    }),
  ],
};

export async function mockPaidSearch(params: {
  agent: AgentName;
  query: string;
  runId: string;
  callIndex: number;
  subject: string;
}): Promise<MockSearchResult> {
  const offset = Number.parseInt(hashText(params.query).slice(0, 2), 16) % 3;
  const builders = templates[params.agent];
  const results = [0, 1, 2].map((index) => builders[(index + offset) % builders.length](params.subject));

  await new Promise((resolve) => setTimeout(resolve, 120));

  return {
    results,
    costUsd: 0.01,
    provider: "Tavily x402 (mock)",
    paymentMode: "mock",
    receipt: `mock:0x${params.runId.slice(0, 8)}${params.callIndex.toString(16).padStart(2, "0")}`,
  };
}
