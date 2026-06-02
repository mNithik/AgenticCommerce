import type { AgentDefinition } from "@/lib/agents/shared";

export const counterAgent: AgentDefinition = {
  name: "Counter",
  query(subject) {
    return `${subject} complaints scam refund churn lawsuit bad reviews`;
  },
};
