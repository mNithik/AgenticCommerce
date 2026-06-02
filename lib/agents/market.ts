import type { AgentDefinition } from "./shared";

export const marketAgent: AgentDefinition = {
  name: "Market",
  query(subject) {
    return `${subject} market size category competitors pricing`;
  },
};
