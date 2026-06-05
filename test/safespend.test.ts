import { describe, expect, it } from "vitest";
import { SafeSpend } from "../lib/safespend";

describe("SafeSpend", () => {
  it("blocks duplicate queries and budget overflow", () => {
    const safeSpend = new SafeSpend({ budgetCapUsd: 0.02, maxPaidCalls: 4 });

    const first = safeSpend.beforePaidCall({
      agent: "Market",
      query: "Vendor pricing reviews",
      spentUsd: 0,
      projectedCostUsd: 0.01,
      paidCalls: 0,
    });
    const duplicate = safeSpend.beforePaidCall({
      agent: "Evidence",
      query: "Vendor pricing reviews",
      spentUsd: 0.01,
      projectedCostUsd: 0.01,
      paidCalls: 1,
    });
    const overflow = safeSpend.beforePaidCall({
      agent: "Counter",
      query: "Vendor complaints",
      spentUsd: 0.02,
      projectedCostUsd: 0.01,
      paidCalls: 2,
    });

    expect(first.status).toBe("allowed");
    expect(duplicate.status).toBe("blocked");
    expect(overflow.status).toBe("blocked");
  });

  it("blocks duplicate queries seeded from prior records", () => {
    const safeSpend = new SafeSpend({ budgetCapUsd: 0.05, maxPaidCalls: 4 });
    safeSpend.seedFromRecords([
      {
        normalizedQuery: "apollo io lawsuit compliance",
        receipt: "mock:counter",
      },
    ]);

    const duplicate = safeSpend.beforePaidCall({
      agent: "Counter",
      query: "apollo io lawsuit compliance",
      spentUsd: 0.03,
      projectedCostUsd: 0.01,
      paidCalls: 3,
    });

    expect(duplicate.status).toBe("blocked");
    expect(duplicate.reason).toContain("Duplicate query");
  });

  it("blocks sensitive queries and over-budget batch plans", () => {
    const safeSpend = new SafeSpend({ budgetCapUsd: 0.02, maxPaidCalls: 4 });

    const batch = safeSpend.batchPreflight({
      agents: ["Market", "Evidence", "Counter"],
      queries: ["Apollo pricing", "Apollo reviews", "Apollo complaints"],
      spentUsd: 0,
      projectedCostUsdPerCall: 0.01,
      paidCalls: 0,
    });

    const pii = safeSpend.beforePaidCall({
      agent: "Market",
      query: "apollo.io owner email test@example.com",
      spentUsd: 0,
      projectedCostUsd: 0.01,
      paidCalls: 0,
    });

    expect(batch.status).toBe("blocked");
    expect(pii.status).toBe("blocked");
  });
});
