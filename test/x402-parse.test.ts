import { describe, it, expect } from "vitest";
import { parseAwalJson } from "@/lib/x402-search";

// Real awal `x402 pay --json` output shape captured from a live Tavily x402 search.
// The settlement tx hash lives in the base64 `PAYMENT-RESPONSE` response header,
// NOT in a top-level payment/settlement object.
const PAYMENT_RESPONSE_B64 = Buffer.from(
  JSON.stringify({
    success: true,
    payer: "0xaAC20Dc8aC90050DF0cEC6d3Ca624d779Dd7BB34",
    transaction: "0xf0a9f5bac3b0ed3d6b3a04d9a0a5c62bf8f680b76788b07d1a9d73e546e77c87",
    network: "eip155:8453",
  }),
).toString("base64");

const REAL_OUTPUT = JSON.stringify({
  status: 200,
  statusText: "OK",
  data: {
    query: "pet telehealth market size 2026",
    answer: null,
    results: [
      {
        url: "https://www.precedenceresearch.com/veterinary-telehealth-market",
        title: "Veterinary Telehealth Market Size to Hit USD 1,955.44 Mn by 2034",
        content: "The veterinary telehealth market is growing rapidly.",
        score: 0.9998,
        raw_content: null,
      },
    ],
  },
  headers: {
    "PAYMENT-RESPONSE": PAYMENT_RESPONSE_B64,
  },
});

describe("parseAwalJson", () => {
  it("decodes the receipt from the base64 PAYMENT-RESPONSE header", () => {
    const parsed = parseAwalJson(REAL_OUTPUT);
    expect(parsed.receipt).toBe(
      "0xf0a9f5bac3b0ed3d6b3a04d9a0a5c62bf8f680b76788b07d1a9d73e546e77c87",
    );
  });

  it("maps results from data.results with snippet from content", () => {
    const parsed = parseAwalJson(REAL_OUTPUT);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0]).toMatchObject({
      url: "https://www.precedenceresearch.com/veterinary-telehealth-market",
      title: "Veterinary Telehealth Market Size to Hit USD 1,955.44 Mn by 2034",
      snippet: "The veterinary telehealth market is growing rapidly.",
    });
  });

  it("defaults cost to $0.01 when no amount is present", () => {
    const parsed = parseAwalJson(REAL_OUTPUT);
    expect(parsed.costUsd).toBe(0.01);
  });

  it("returns an empty receipt when the payment header is missing (fails closed)", () => {
    const noHeader = JSON.stringify({ status: 200, data: { results: [] }, headers: {} });
    const parsed = parseAwalJson(noHeader);
    expect(parsed.receipt).toBe("");
    expect(parsed.results).toEqual([]);
  });
});
