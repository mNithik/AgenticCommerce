import type { AgentName, SafeSpendEvent } from "./types";
import { asMoney, normalizeQuery } from "./utils";

function redactQuery(query: string) {
  return query
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .slice(0, 140);
}

type SafeSpendOptions = {
  budgetCapUsd: number;
  maxPaidCalls?: number;
};

const sensitiveQueryPatterns = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b(?:\d[ -]*?){13,16}\b/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
];

export class SafeSpend {
  private readonly budgetCapUsd: number;
  private readonly maxPaidCalls: number;
  private readonly querySet = new Set<string>();
  private readonly receiptSet = new Set<string>();
  private readonly events: SafeSpendEvent[] = [];

  constructor(options: SafeSpendOptions) {
    this.budgetCapUsd = options.budgetCapUsd;
    this.maxPaidCalls = options.maxPaidCalls ?? 4;
  }

  batchPreflight(params: {
    agents: AgentName[];
    queries: string[];
    spentUsd: number;
    projectedCostUsdPerCall: number;
    paidCalls: number;
  }) {
    const queryPreview = params.queries.map(redactQuery).join(" | ");
    const projectedSpendUsd = asMoney(
      params.spentUsd + params.projectedCostUsdPerCall * params.queries.length,
    );

    let event: SafeSpendEvent;

    if (params.paidCalls + params.queries.length > this.maxPaidCalls) {
      event = {
        agent: params.agents[0] ?? "Market",
        action: "batch_preflight",
        status: "blocked",
        reason: "Planned run exceeds the paid call cap for this policy profile.",
        queryPreview,
        projectedSpendUsd,
      };
    } else if (projectedSpendUsd > this.budgetCapUsd) {
      event = {
        agent: params.agents[0] ?? "Market",
        action: "batch_preflight",
        status: "blocked",
        reason: "Planned run would exceed the budget cap before payment starts.",
        queryPreview,
        projectedSpendUsd,
      };
    } else if (params.queries.some((query) => this.containsSensitiveQuery(query))) {
      event = {
        agent: params.agents[0] ?? "Market",
        action: "batch_preflight",
        status: "blocked",
        reason: "Sensitive query content is blocked before payment.",
        queryPreview,
        projectedSpendUsd,
      };
    } else {
      event = {
        agent: params.agents[0] ?? "Market",
        action: "batch_preflight",
        status: "allowed",
        reason: "Planned run cleared batch SafeSpend checks.",
        queryPreview,
        projectedSpendUsd,
      };
    }

    this.events.push(event);
    return event;
  }

  private containsSensitiveQuery(query: string) {
    return sensitiveQueryPatterns.some((pattern) => pattern.test(query));
  }

  beforePaidCall(params: {
    agent: AgentName;
    query: string;
    spentUsd: number;
    projectedCostUsd: number;
    paidCalls: number;
  }) {
    const normalizedQuery = normalizeQuery(params.query);
    const queryPreview = redactQuery(params.query);
    const projectedSpendUsd = asMoney(params.spentUsd + params.projectedCostUsd);

    let event: SafeSpendEvent;

    if (params.paidCalls >= this.maxPaidCalls) {
      event = {
        agent: params.agent,
        action: "preflight",
        status: "blocked",
        reason: "Paid call cap reached for this run.",
        queryPreview,
        projectedSpendUsd,
      };
    } else if (projectedSpendUsd > this.budgetCapUsd) {
      event = {
        agent: params.agent,
        action: "preflight",
        status: "blocked",
        reason: "Budget cap would be exceeded.",
        queryPreview,
        projectedSpendUsd,
      };
    } else if (this.querySet.has(normalizedQuery)) {
      event = {
        agent: params.agent,
        action: "preflight",
        status: "blocked",
        reason: "Duplicate query blocked.",
        queryPreview,
        projectedSpendUsd,
      };
    } else if (this.containsSensitiveQuery(params.query)) {
      event = {
        agent: params.agent,
        action: "preflight",
        status: "blocked",
        reason: "Sensitive query content blocked before payment.",
        queryPreview,
        projectedSpendUsd,
      };
    } else {
      this.querySet.add(normalizedQuery);
      event = {
        agent: params.agent,
        action: "preflight",
        status: "allowed",
        reason: "Query cleared SafeSpend checks.",
        queryPreview,
        projectedSpendUsd,
      };
    }

    this.events.push(event);
    return event;
  }

  recordReceipt(agent: AgentName, receipt: string) {
    let event: SafeSpendEvent;

    if (this.receiptSet.has(receipt)) {
      event = {
        agent,
        action: "receipt",
        status: "blocked",
        reason: "Duplicate receipt detected.",
      };
    } else {
      this.receiptSet.add(receipt);
      event = {
        agent,
        action: "receipt",
        status: "allowed",
        reason: "Receipt accepted.",
      };
    }

    this.events.push(event);
    return event;
  }

  getEvents() {
    return [...this.events];
  }
}
