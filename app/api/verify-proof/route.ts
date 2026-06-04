import { config } from "../../../lib/config";
import { recordObservabilityEvent } from "../../../lib/observability";
import { applyRateLimit } from "../../../lib/rate-limit";
import { parseRunSnapshot } from "../../../lib/run-sharing";
import { verifyRunAttestation } from "../../../lib/trust";
import type {
  DiligenceRun,
  ProofAttestation,
  ProofPacketJson,
} from "../../../lib/types";

export const runtime = "nodejs";

type VerifyBody = {
  snapshot?: unknown;
  proofPacket?: unknown;
  run?: unknown;
  attestation?: unknown;
};

export async function POST(request: Request) {
  const rateLimited = applyRateLimit(request, "verifyProof");
  if (rateLimited) {
    return rateLimited;
  }

  let body: VerifyBody;

  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }

  let run: DiligenceRun | null = null;
  let attestation: ProofAttestation | null = null;

  if (typeof body.snapshot === "string") {
    const envelope = parseRunSnapshot(body.snapshot);
    if (!envelope) {
      return new Response("snapshot could not be parsed.", { status: 400 });
    }
    run = envelope.run;
    attestation = envelope.attestation;
  } else if (body.proofPacket && typeof body.proofPacket === "object") {
    const packet = body.proofPacket as ProofPacketJson;
    run = packet.run;
    attestation = packet.metadata?.attestation ?? null;
  } else if (body.run && typeof body.run === "object") {
    run = body.run as DiligenceRun;
    attestation = (body.attestation as ProofAttestation | undefined) ?? null;
  }

  if (!run || typeof run.id !== "string") {
    return new Response("Provide a snapshot, proofPacket, or run + attestation.", {
      status: 400,
    });
  }

  const result = await verifyRunAttestation(run, attestation, {
    secret: config.proofSigningSecret,
  });

  recordObservabilityEvent({
    category: "verify",
    status: result.verified ? "success" : "error",
    message: `Proof verification ${result.verified ? "passed" : "failed"} for ${run.subject}.`,
    relatedId: run.id,
    metadata: {
      signingMode: result.signingMode,
      digestMatch: result.digestMatch,
      signatureMatch: result.signatureMatch,
    },
  });

  return Response.json(result);
}
