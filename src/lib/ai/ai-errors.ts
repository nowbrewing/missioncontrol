import { getAiProviderName } from "./provider";

export function formatAiUserMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";

  if (/denied access/i.test(raw)) {
    return [
      "Google blocked this API key / project (403).",
      "Fix: new key at aistudio.google.com/apikey (new Gmail/project),",
      "or set AI_PROVIDER=openai + OPENAI_API_KEY in .env.development.local",
      "Check /api/ai/health for a full diagnosis.",
    ].join(" ");
  }

  if (/quota|rate.?limit|limit:\s*0/i.test(raw)) {
    return [
      "Google quota exceeded for this model.",
      "Try GEMINI_MODEL=gemini-2.0-flash-lite, enable billing, wait for reset,",
      "or use AI_PROVIDER=openai with OPENAI_API_KEY.",
    ].join(" ");
  }

  if (/not found|not supported for generateContent/i.test(raw)) {
    return "Model not found. Set GEMINI_MODEL (e.g. gemini-2.0-flash-lite) — see /api/ai/health.";
  }

  if (/Missing OPENAI_API_KEY/i.test(raw)) {
    return "Set OPENAI_API_KEY in .env.development.local (AI_PROVIDER=openai).";
  }

  if (/Missing GOOGLE_GENERATIVE_AI_API_KEY/i.test(raw)) {
    return "Set GOOGLE_GENERATIVE_AI_API_KEY in .env.development.local (or switch to OpenAI).";
  }

  if (/API key|API_KEY|invalid.*key/i.test(raw)) {
    return getAiProviderName() === "openai"
      ? "Invalid OpenAI API key."
      : "Invalid Google API key (AIzaSy… or AQ.… from AI Studio).";
  }

  return raw;
}

export function describeGoogleKeyFormat(key: string | undefined) {
  const k = key?.trim() ?? "";
  if (!k) return "missing" as const;
  if (k.startsWith("AIza")) return "AIza" as const;
  if (k.startsWith("AQ.")) return "AQ" as const;
  return "unexpected" as const;
}

export function googleKeyLooksValid(key: string | undefined) {
  const fmt = describeGoogleKeyFormat(key);
  return fmt === "AIza" || fmt === "AQ";
}
