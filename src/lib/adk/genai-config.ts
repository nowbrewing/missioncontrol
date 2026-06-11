import { GoogleGenAI } from "@google/genai";

export type GenAiBackend = "vertex" | "api_key";

export type GenAiEnvConfig =
  | { backend: "vertex"; project: string; location: string }
  | { backend: "api_key"; apiKey: string };

function truthyEnv(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true";
}

export function resolveGenAiBackend(): GenAiBackend {
  if (
    truthyEnv(process.env.GOOGLE_GENAI_USE_VERTEXAI) ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim()
  ) {
    return "vertex";
  }
  return "api_key";
}

function resolveApiKey(): string {
  if (process.env.GEMINI_API_KEY?.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    return process.env.GOOGLE_GENERATIVE_AI_API_KEY.trim();
  }
  if (process.env.GOOGLE_GENAI_API_KEY?.trim()) {
    return process.env.GOOGLE_GENAI_API_KEY.trim();
  }
  return "";
}

function googleAuthOptionsFromEnv() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return undefined;
  try {
    return { credentials: JSON.parse(raw) as object };
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is set but is not valid JSON"
    );
  }
}

/** Validates config and sets env vars consumed by @google/adk. */
export function ensureGenAiEnv(): GenAiEnvConfig {
  const backend = resolveGenAiBackend();

  if (backend === "vertex") {
    const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
    const location =
      process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1";

    if (!project) {
      throw new Error(
        "Vertex AI requires GOOGLE_CLOUD_PROJECT (and billing enabled on that GCP project)"
      );
    }

    process.env.GOOGLE_GENAI_USE_VERTEXAI = "true";
    process.env.GOOGLE_CLOUD_PROJECT = project;
    process.env.GOOGLE_CLOUD_LOCATION = location;

    return { backend: "vertex", project, location };
  }

  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error(
      "Missing Gemini credentials. For Vertex AI set GOOGLE_CLOUD_PROJECT (+ ADC or GOOGLE_SERVICE_ACCOUNT_JSON). For AI Studio set GEMINI_API_KEY."
    );
  }

  process.env.GEMINI_API_KEY = apiKey;
  return { backend: "api_key", apiKey };
}

export function createGoogleGenAI(): GoogleGenAI {
  const config = ensureGenAiEnv();
  const googleAuthOptions = googleAuthOptionsFromEnv();

  if (config.backend === "vertex") {
    return new GoogleGenAI({
      vertexai: true,
      project: config.project,
      location: config.location,
      ...(googleAuthOptions ? { googleAuthOptions } : {}),
    });
  }

  return new GoogleGenAI({ apiKey: config.apiKey });
}

export function defaultGeminiModel() {
  return (
    process.env.GOOGLE_GENAI_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.5-flash"
  );
}

export function describeGenAiBackend(): string {
  const config = ensureGenAiEnv();
  if (config.backend === "vertex") {
    return `Vertex AI (project=${config.project}, location=${config.location})`;
  }
  return "Gemini AI Studio API key (free tier — ~20 requests/day per model)";
}

function parseRetryDelayMs(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/retry in ([0-9.]+)s/i);
  if (!match) return null;
  return Math.ceil(Number(match[1]) * 1000) + 500;
}

export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("429") || msg.includes("resource_exhausted") || msg.includes("quota");
}

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 4
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (!isRateLimitError(e) || attempt >= maxAttempts - 1) break;
      const delay = parseRetryDelayMs(e) ?? 8000 * (attempt + 1);
      console.warn(`[genai] rate limited — retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
  const backend = describeGenAiBackend();
  const hint =
    backend.startsWith("Vertex")
      ? "Check GCP billing and Vertex AI quotas."
      : "Use 1 API call per Prioritize (already optimized). For check-in, switch to Vertex AI (GOOGLE_GENAI_USE_VERTEXAI + GOOGLE_CLOUD_PROJECT) or wait for daily quota reset.";
  const base =
    lastError instanceof Error ? lastError.message : "Gemini request failed";
  throw new Error(`${base}\n\nBackend: ${backend}. ${hint}`);
}

/** @deprecated use ensureGenAiEnv */
export function ensureAdkApiKey() {
  ensureGenAiEnv();
}
