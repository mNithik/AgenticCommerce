import { buildSnapshotEnvelope, isDiligenceRun, isSnapshotEnvelope } from "./trust";
import type { DiligenceRun, SnapshotEnvelope } from "./types";

function encodeUtf8(value: string) {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return window
      .btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeUtf8(value: string) {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const normalized = value
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = window.atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(value, "base64url").toString("utf8");
}

export async function serializeRunSnapshot(run: DiligenceRun) {
  const envelope = await buildSnapshotEnvelope(run);
  return encodeUtf8(JSON.stringify(envelope));
}

export function deserializeRunSnapshot(value: string) {
  try {
    const parsed = JSON.parse(decodeUtf8(value)) as unknown;

    if (isSnapshotEnvelope(parsed)) {
      return parsed.run;
    }

    if (isDiligenceRun(parsed)) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

export function parseRunSnapshot(value: string): SnapshotEnvelope | null {
  try {
    const parsed = JSON.parse(decodeUtf8(value)) as unknown;
    return isSnapshotEnvelope(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
