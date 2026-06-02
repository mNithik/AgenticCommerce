import type { AgentDefinition } from "@/lib/agents/shared";

export const counterAgent: AgentDefinition = {
  name: "Counter",
  queries(subject) {
    return [
      `${subject} complaints and bad reviews`,
      `${subject} refund problems churn lawsuit scam`,
    ];
  },
};
