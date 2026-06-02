import type { RunEvent } from "./types";

const encoder = new TextEncoder();

export function serializeSSE(event: RunEvent) {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}
