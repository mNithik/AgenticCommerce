import type { AgentDefinition } from "@/lib/agents/shared";

export const marketAgent: AgentDefinition = {
  name: "Market",
  query(subject) {
    return `${subject} market size category competitors pricing`;
  },
};
