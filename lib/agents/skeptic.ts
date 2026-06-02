import type { AgentDefinition } from "./shared";

export const skepticAgent: AgentDefinition = {
  name: "Skeptic",
  query(subject) {
    return `${subject} risks hidden fees failed deployments negative press`;
  },
};
