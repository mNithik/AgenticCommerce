import { config } from "@/lib/config";
import { OpenAICompatibleProvider } from "@/lib/llm/openai-compatible";

export const huggingFaceProvider = new OpenAICompatibleProvider({
  name: "huggingface",
  apiKey: config.hfToken,
  baseURL: config.hfBaseUrl,
  summaryModel: config.hfModelSummary,
  analystModel: config.hfModelAnalyst,
});
