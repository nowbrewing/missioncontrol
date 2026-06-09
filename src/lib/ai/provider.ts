import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type AiProviderName = "google" | "openai";

/** Models to probe when diagnosing a Google key (newest first). */
export const GOOGLE_MODELS_TO_PROBE = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
] as const;

const DEFAULT_GOOGLE_MODEL = "gemini-2.0-flash-lite";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export function getAiProviderName(): AiProviderName {
  const p = process.env.AI_PROVIDER?.trim().toLowerCase();
  return p === "openai" ? "openai" : "google";
}

export function getGoogleModelId() {
  return (
    process.env.GEMINI_MODEL?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_MODEL?.trim() ||
    DEFAULT_GOOGLE_MODEL
  );
}

export function getOpenAiModelId() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export function getAiModel(): LanguageModel {
  if (getAiProviderName() === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY (set AI_PROVIDER=openai)");
    }
    const openai = createOpenAI({ apiKey });
    return openai(getOpenAiModelId());
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
  }
  const google = createGoogleGenerativeAI({ apiKey });
  return google(getGoogleModelId());
}

export function getActiveModelId() {
  return getAiProviderName() === "openai"
    ? getOpenAiModelId()
    : getGoogleModelId();
}

export function assertChatProviderConfigured() {
  if (getAiProviderName() === "openai") {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error("Missing OPENAI_API_KEY");
    }
    return;
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
  }
}
