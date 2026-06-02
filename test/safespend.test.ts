import { describe, expect, it } from "vitest";
import { SafeSpend } from "@/lib/safespend";

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
});
