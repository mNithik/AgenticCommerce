import type { AgentDefinition } from "@/lib/agents/shared";

export const skepticAgent: AgentDefinition = {
  name: "Skeptic",
  queries(subject) {
    return [
      `${subject} risks and hidden fees`,
      `${subject} failed deployments and negative press`,
    ];
  },
};
