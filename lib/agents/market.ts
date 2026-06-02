import type { AgentDefinition } from "@/lib/agents/shared";

export const marketAgent: AgentDefinition = {
  name: "Market",
  queries(subject) {
    return [
      `${subject} market size and growth 2026`,
      `${subject} top competitors and pricing`,
    ];
  },
};
