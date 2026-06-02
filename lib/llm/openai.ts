import { config } from "../config";
import { OpenAICompatibleProvider } from "./openai-compatible";

export const openaiProvider = new OpenAICompatibleProvider({
  name: "openai",
  apiKey: config.openaiApiKey,
  summaryModel: config.openaiModelSummary,
  analystModel: config.openaiModelAnalyst,
});
