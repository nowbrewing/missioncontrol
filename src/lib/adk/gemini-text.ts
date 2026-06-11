import {
  createGoogleGenAI,
  defaultGeminiModel,
  ensureGenAiEnv,
  withRateLimitRetry,
} from "./genai-config";

export {
  createGoogleGenAI,
  defaultGeminiModel,
  ensureGenAiEnv,
  ensureAdkApiKey,
} from "./genai-config";

export async function generateGeminiText(
  prompt: string,
  options?: { model?: string; retries?: number }
): Promise<string> {
  ensureGenAiEnv();
  const model = options?.model ?? defaultGeminiModel();
  const maxAttempts = (options?.retries ?? 2) + 1;

  return withRateLimitRetry(async () => {
    const ai = createGoogleGenAI();
    const response = await ai.models.generateContent({ model, contents: prompt });
    const text = response.text?.trim() ?? "";
    if (!text) {
      throw new Error("Model returned an empty response");
    }
    return text;
  }, maxAttempts);
}
