import { describe, expect, it } from "vitest";
import { deserializeRunSnapshot, parseRunSnapshot, serializeRunSnapshot } from "../lib/run-sharing";
import type { DiligenceRun } from "../lib/types";
import { makeDiligenceRun } from "./fixtures";

const run: DiligenceRun = {
  ...makeDiligenceRun({
    id: "run_snapshot",
    confidence: 0.5,
    proofScore: 63,
  }),
};

describe("run snapshot sharing", () => {
  it("round-trips a completed run", async () => {
    const encoded = await serializeRunSnapshot(run);
    const decoded = deserializeRunSnapshot(encoded);
    const envelope = parseRunSnapshot(encoded);

    expect(decoded?.id).toBe(run.id);
    expect(decoded?.subject).toBe(run.subject);
    expect(decoded?.policyProfile).toBe("standard");
    expect(envelope?.attestation.digest).toBeTruthy();
  });
});
