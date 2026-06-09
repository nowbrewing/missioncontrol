import { generateText } from "ai";
import { formatAiUserMessage, googleKeyLooksValid } from "../../../../src/lib/ai/ai-errors";
import {
  pickWorkingGoogleModel,
  probeGoogleModels,
} from "../../../../src/lib/ai/diagnose-google";
import {
  assertChatProviderConfigured,
  getActiveModelId,
  getAiModel,
  getAiProviderName,
} from "../../../../src/lib/ai/provider";

export const dynamic = "force-dynamic";

/** GET /api/ai/health — test configured AI provider + Google model probe. */
export async function GET() {
  const provider = getAiProviderName();
  const modelId = getActiveModelId();

  try {
    assertChatProviderConfigured();
  } catch (e) {
    return Response.json(
      {
        ok: false,
        provider,
        model: modelId,
        error: e instanceof Error ? e.message : "Not configured",
      },
      { status: 500 }
    );
  }

  if (provider === "openai") {
    try {
      const { text } = await generateText({
        model: getAiModel(),
        prompt: "Reply with exactly: ok",
        maxOutputTokens: 16,
      });
      return Response.json({
        ok: true,
        provider,
        model: modelId,
        sample: text.trim().slice(0, 32),
      });
    } catch (e) {
      return Response.json(
        {
          ok: false,
          provider,
          model: modelId,
          error: formatAiUserMessage(e),
          raw: e instanceof Error ? e.message : String(e),
        },
        { status: 502 }
      );
    }
  }

  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY!.trim();
  if (!googleKeyLooksValid(key)) {
    return Response.json(
      {
        ok: false,
        provider: "google",
        model: modelId,
        error:
          "Key format unexpected (expected AIzaSy… or AQ.… from aistudio.google.com/apikey)",
        googleProbe: [],
      },
      { status: 400 }
    );
  }

  const googleProbe = await probeGoogleModels(key);
  const workingModel = pickWorkingGoogleModel(googleProbe);

  if (workingModel && workingModel !== modelId) {
    return Response.json(
      {
        ok: false,
        provider: "google",
        model: modelId,
        error: `Configured model "${modelId}" fails, but "${workingModel}" works. Set GEMINI_MODEL=${workingModel} in .env.local`,
        googleProbe,
        suggestedModel: workingModel,
      },
      { status: 502 }
    );
  }

  try {
    const { text } = await generateText({
      model: getAiModel(),
      prompt: "Reply with exactly: ok",
      maxOutputTokens: 16,
    });

    return Response.json({
      ok: true,
      provider: "google",
      model: modelId,
      sample: text.trim().slice(0, 32),
      googleProbe,
    });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        provider: "google",
        model: modelId,
        error: formatAiUserMessage(e),
        raw: e instanceof Error ? e.message : String(e),
        googleProbe,
        suggestedModel: workingModel,
        hint:
          workingModel === null
            ? "No probed Google model worked. Use a new AI Studio key (new Google account) or AI_PROVIDER=openai + OPENAI_API_KEY."
            : undefined,
      },
      { status: 502 }
    );
  }
}
