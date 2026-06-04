import type {
  DiligenceRun,
  ProofAttestation,
  ProofVerificationResult,
  SnapshotEnvelope,
} from "./types";

function bytesToBase64Url(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`);

  return `{${entries.join(",")}}`;
}

async function digestSha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToBase64Url(new Uint8Array(hash));
}

async function hmacSha256(secret: string, value: string) {
  const keyBytes = new TextEncoder().encode(secret);
  const payloadBytes = new TextEncoder().encode(value);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, payloadBytes);
  return bytesToBase64Url(new Uint8Array(signature));
}

export function canonicalizeRun(run: DiligenceRun) {
  return stableStringify(run);
}

export async function buildRunAttestation(
  run: DiligenceRun,
  options?: {
    secret?: string;
    keyId?: string;
    signedAt?: string;
  },
): Promise<ProofAttestation> {
  const canonical = canonicalizeRun(run);
  const digest = await digestSha256(canonical);
  const signedAt = options?.signedAt ?? new Date().toISOString();

  if (options?.secret) {
    const signature = await hmacSha256(options.secret, `${digest}.${signedAt}`);
    return {
      formatVersion: 1,
      canonicalizer: "proofspend.run.v1",
      digestAlgorithm: "SHA-256",
      digest,
      signedAt,
      signingMode: "hmac-sha256",
      signature,
      keyId: options.keyId ?? "proofspend-local",
    };
  }

  return {
    formatVersion: 1,
    canonicalizer: "proofspend.run.v1",
    digestAlgorithm: "SHA-256",
    digest,
    signedAt,
    signingMode: "digest-only",
  };
}

export async function verifyRunAttestation(
  run: DiligenceRun,
  attestation: ProofAttestation | null | undefined,
  options?: { secret?: string },
): Promise<ProofVerificationResult> {
  if (!attestation) {
    return {
      ok: true,
      verified: false,
      digestMatch: false,
      signatureMatch: null,
      signingMode: "unknown",
      runId: run.id,
      subject: run.subject,
      message: "No attestation was supplied for this run.",
    };
  }

  const expectedDigest = await digestSha256(canonicalizeRun(run));
  const digestMatch = expectedDigest === attestation.digest;

  if (attestation.signingMode === "hmac-sha256") {
    if (!options?.secret) {
      return {
        ok: true,
        verified: false,
        digestMatch,
        signatureMatch: null,
        signingMode: attestation.signingMode,
        runId: run.id,
        subject: run.subject,
        message: digestMatch
          ? "Digest matched, but the signing secret is unavailable for signature verification."
          : "Digest mismatch; the run content no longer matches the attestation.",
      };
    }

    const expectedSignature = await hmacSha256(
      options.secret,
      `${attestation.digest}.${attestation.signedAt}`,
    );
    const signatureMatch = expectedSignature === attestation.signature;
    const verified = digestMatch && signatureMatch;

    return {
      ok: true,
      verified,
      digestMatch,
      signatureMatch,
      signingMode: attestation.signingMode,
      runId: run.id,
      subject: run.subject,
      message: verified
        ? "Digest and signature both verified."
        : digestMatch
          ? "Digest matched, but the signature did not verify."
          : "Digest mismatch; the run content no longer matches the attestation.",
    };
  }

  return {
    ok: true,
    verified: digestMatch,
    digestMatch,
    signatureMatch: null,
    signingMode: attestation.signingMode,
    runId: run.id,
    subject: run.subject,
    message: digestMatch
      ? "Digest verified. This proof packet is tamper-evident but not server-signed."
      : "Digest mismatch; the run content no longer matches the attestation.",
  };
}

export async function buildSnapshotEnvelope(
  run: DiligenceRun,
  options?: { secret?: string; keyId?: string; createdAt?: string },
): Promise<SnapshotEnvelope> {
  const createdAt = options?.createdAt ?? new Date().toISOString();
  return {
    version: 2,
    createdAt,
    run,
    attestation: await buildRunAttestation(run, {
      secret: options?.secret,
      keyId: options?.keyId,
      signedAt: createdAt,
    }),
  };
}

export function isSnapshotEnvelope(value: unknown): value is SnapshotEnvelope {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as SnapshotEnvelope).version === 2 &&
    typeof (value as SnapshotEnvelope).createdAt === "string" &&
    typeof (value as SnapshotEnvelope).run?.id === "string" &&
    typeof (value as SnapshotEnvelope).attestation?.digest === "string"
  );
}

export function isDiligenceRun(value: unknown): value is DiligenceRun {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as DiligenceRun).id === "string" &&
    typeof (value as DiligenceRun).input === "string" &&
    Array.isArray((value as DiligenceRun).records)
  );
}
