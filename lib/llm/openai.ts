import { config } from "@/lib/config";
import { OpenAICompatibleProvider } from "@/lib/llm/openai-compatible";

export const openaiProvider = new OpenAICompatibleProvider({
  name: "openai",
  apiKey: config.openaiApiKey,
  summaryModel: config.openaiModelSummary,
  analystModel: config.openaiModelAnalyst,
});
