import type { AgentName, EvidenceRecord } from "../types";

export type AgentDefinition = {
  name: AgentName;
  query(subject: string): string;
};

export function buildRecordInput(record: EvidenceRecord) {
  return {
    id: record.id,
    agent: record.agent,
    finding: record.finding,
    sources: record.sources,
  };
}
