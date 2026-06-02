import type { AgentDefinition } from "@/lib/agents/shared";

export const evidenceAgent: AgentDefinition = {
  name: "Evidence",
  query(subject) {
    return `${subject} reviews case studies proof legitimacy`;
  },
};
