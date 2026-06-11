import { generateGeminiText } from "./gemini-text";
import { WENT_WELL_TAGGING_INSTRUCTION } from "./went-well-prompt";
import {
  fallbackWentWellStatement,
  parseWentWellStatementsFromResponse,
  type ParsedWentWellStatement,
} from "./parse-went-well-statements";

export async function tagWentWellStatements(
  rawText: string,
  pillars: { id: unknown; name: unknown }[]
): Promise<ParsedWentWellStatement[]> {
  const text = rawText.trim();
  if (!text) return [];

  const pillarList = pillars
    .map((p) => `- ${String(p.name)}`)
    .join("\n");

  const prompt = `${WENT_WELL_TAGGING_INSTRUCTION}

USER PILLARS:
${pillarList || "(none — use empty pillars array for all items)"}

USER TEXT:
${text}`;

  try {
    const output = await generateGeminiText(prompt);
    const parsed = parseWentWellStatementsFromResponse(output, pillars);
    if (parsed.length > 0) return parsed;
  } catch (e) {
    console.error("[went-well-tagger]", e);
  }

  return fallbackWentWellStatement(text);
}
