import { config } from "../config";
import { OpenAICompatibleProvider } from "./openai-compatible";

export const huggingFaceProvider = new OpenAICompatibleProvider({
  name: "huggingface",
  apiKey: config.hfToken,
  baseURL: config.hfBaseUrl,
  summaryModel: config.hfModelSummary,
  analystModel: config.hfModelAnalyst,
});
