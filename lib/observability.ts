import { makeId } from "./text-utils";
import type { ObservabilityEvent } from "./types";

const events: ObservabilityEvent[] = [];

export function recordObservabilityEvent(
  event: Omit<ObservabilityEvent, "id" | "timestamp"> & { timestamp?: string },
) {
  const recorded: ObservabilityEvent = {
    id: makeId("obs", `${event.category}_${event.relatedId ?? "none"}_${Date.now()}_${event.message}`),
    timestamp: event.timestamp ?? new Date().toISOString(),
    ...event,
  };

  events.unshift(recorded);
  if (events.length > 100) {
    events.length = 100;
  }

  return recorded;
}

export function getObservabilityEvents(limit = 50) {
  return events.slice(0, limit);
}
