import { config } from "../config";
import { OpenAICompatibleProvider } from "./openai-compatible";

export const nvidiaProvider = new OpenAICompatibleProvider({
  name: "nvidia",
  apiKey: config.nvidiaApiKey,
  baseURL: config.nvidiaBaseUrl,
  summaryModel: config.nvidiaModelSummary,
  analystModel: config.nvidiaModelAnalyst,
});
