import { GOOGLE_MODELS_TO_PROBE } from "./provider";

type ProbeResult = {
  model: string;
  ok: boolean;
  status?: number;
  message: string;
};

export async function probeGoogleModels(apiKey: string): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];

  for (const model of GOOGLE_MODELS_TO_PROBE) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Reply with exactly: ok" }] }],
            generationConfig: { maxOutputTokens: 8 },
          }),
        }
      );

      const body = (await res.json()) as {
        candidates?: unknown[];
        error?: { message?: string };
      };

      if (res.ok && body.candidates?.length) {
        results.push({ model, ok: true, status: res.status, message: "ok" });
      } else {
        results.push({
          model,
          ok: false,
          status: res.status,
          message: body.error?.message ?? `HTTP ${res.status}`,
        });
      }
    } catch (e) {
      results.push({
        model,
        ok: false,
        message: e instanceof Error ? e.message : "Request failed",
      });
    }
  }

  return results;
}

export function pickWorkingGoogleModel(probes: ProbeResult[]): string | null {
  const hit = probes.find((p) => p.ok);
  return hit?.model ?? null;
}
