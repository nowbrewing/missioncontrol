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

export type GeminiChatTurn = {
  role: "user" | "model";
  text: string;
};

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

export async function generateGeminiChat(
  turns: GeminiChatTurn[],
  options?: { model?: string; retries?: number; systemInstruction?: string }
): Promise<string> {
  if (turns.length === 0) {
    throw new Error("At least one chat turn is required");
  }

  ensureGenAiEnv();
  const model = options?.model ?? defaultGeminiModel();
  const maxAttempts = (options?.retries ?? 2) + 1;
  const systemInstruction = options?.systemInstruction?.trim();

  return withRateLimitRetry(async () => {
    const ai = createGoogleGenAI();
    const response = await ai.models.generateContent({
      model,
      contents: turns.map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      })),
      ...(systemInstruction ? { systemInstruction } : {}),
    });
    const text = response.text?.trim() ?? "";
    if (!text) {
      throw new Error("Model returned an empty response");
    }
    return text;
  }, maxAttempts);
}
