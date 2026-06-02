import type { AgentDefinition } from "@/lib/agents/shared";

export const evidenceAgent: AgentDefinition = {
  name: "Evidence",
  queries(subject) {
    return [
      `${subject} reviews and ratings`,
      `${subject} case studies and proof of legitimacy`,
    ];
  },
};
