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
