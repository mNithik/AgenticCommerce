import { assertRunApiAuthorized } from "../../../lib/api-auth";
import { config } from "../../../lib/config";
import { applyRateLimit } from "../../../lib/rate-limit";
import { buildSnapshotEnvelope } from "../../../lib/trust";
import type { DiligenceRun } from "../../../lib/types";

export const runtime = "nodejs";

function encodeUtf8(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

export async function POST(request: Request) {
  const unauthorized = assertRunApiAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }
  const rateLimited = applyRateLimit(request, "signSnapshot");
  if (rateLimited) {
    return rateLimited;
  }

  let body: { run?: unknown };

  try {
    body = (await request.json()) as { run?: unknown };
  } catch {
    return new Response("Invalid JSON body.", { status: 400 });
  }

  const run = body.run as DiligenceRun | undefined;
  if (!run || typeof run !== "object" || typeof run.id !== "string") {
    return new Response("run is required.", { status: 400 });
  }

  const envelope = await buildSnapshotEnvelope(run, {
    secret: config.proofSigningSecret,
  });

  return Response.json({
    snapshot: encodeUtf8(JSON.stringify(envelope)),
    attestation: envelope.attestation,
    signingAvailable: Boolean(config.proofSigningSecret),
  });
}
