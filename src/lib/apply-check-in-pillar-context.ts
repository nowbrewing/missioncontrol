import { PILLAR_CONTEXT_EXTRACT_INSTRUCTION } from "./adk/pillar-context-extract-prompt";
import { generateGeminiText } from "./adk/gemini-text";
import { parsePillarContextExtractFromResponse } from "./adk/parse-pillar-context-extract";
import { isLifeAdminPillarName } from "./life-admin";
import {
  appendPillarContext,
  formatPillarContextForPrompt,
  parsePillarContext,
} from "./pillar-context";
import { updatePillar } from "./mongodb/store/users";

export type AppliedPillarContext = {
  pillar_id: number;
  pillar_name: string;
  text: string;
};

type PillarRow = {
  id: number;
  name: string;
  description: string | null;
};

function formatContextEntry(nickname: string | null, context: string): string {
  const base = context.trim().replace(/\s+/g, " ");
  const nick = nickname?.trim();
  if (!nick) return base.endsWith(".") ? base : `${base}.`;
  if (base.toLowerCase().includes(nick.toLowerCase())) {
    return base.endsWith(".") ? base : `${base}.`;
  }
  return `${base} Nickname: "${nick}".`;
}

function pillarContextAlreadyCovers(
  description: string | null | undefined,
  nickname: string | null,
  context: string
): boolean {
  const entries = parsePillarContext(description);
  if (entries.length === 0) return false;

  const normalizedContext = context.trim().toLowerCase();
  const normalizedNick = nickname?.trim().toLowerCase() ?? "";

  return entries.some((entry) => {
    const text = entry.text.toLowerCase();
    if (text === normalizedContext) return true;
    if (normalizedNick.length >= 3 && text.includes(normalizedNick)) return true;
    if (normalizedContext.length >= 24 && text.includes(normalizedContext.slice(0, 24))) {
      return true;
    }
    return false;
  });
}

function buildExtractPrompt(
  input: { brainDump?: string; wins?: string },
  pillars: PillarRow[]
) {
  const pillarBlocks = pillars
    .filter((p) => !isLifeAdminPillarName(p.name))
    .map((p) => {
      const existing = formatPillarContextForPrompt(p.description);
      return `- ${p.name}\n  Existing context:\n${
        existing
          ? existing
              .split("\n")
              .map((line) => `    ${line}`)
              .join("\n")
          : "    (none)"
      }`;
    })
    .join("\n");

  const sections: string[] = [];
  if (input.brainDump?.trim()) {
    sections.push(`LOOKING AHEAD (brain dump):\n${input.brainDump.trim()}`);
  }
  if (input.wins?.trim()) {
    sections.push(`LOOKING BACK (wins):\n${input.wins.trim()}`);
  }

  return `${PILLAR_CONTEXT_EXTRACT_INSTRUCTION}

USER PILLARS:
${pillarBlocks || "(none)"}

CHECK-IN:
${sections.join("\n\n")}`;
}

export async function extractAndApplyPillarContextFromCheckIn(
  userId: number,
  planDate: string,
  input: { brainDump?: string; wins?: string },
  pillars: PillarRow[]
): Promise<AppliedPillarContext[]> {
  const hasText = input.brainDump?.trim() || input.wins?.trim();
  if (!hasText || pillars.length === 0) return [];

  try {
    const prompt = buildExtractPrompt(input, pillars);
    const output = await generateGeminiText(prompt);
    const extracted = parsePillarContextExtractFromResponse(output, pillars);
    if (extracted.length === 0) return [];

    const pillarById = new Map(pillars.map((p) => [p.id, p]));
    const applied: AppliedPillarContext[] = [];

    for (const item of extracted) {
      const pillar = pillarById.get(item.pillar_id);
      if (!pillar) continue;

      if (
        pillarContextAlreadyCovers(
          pillar.description,
          item.nickname,
          item.context
        )
      ) {
        continue;
      }

      const text = formatContextEntry(item.nickname, item.context);
      const description = appendPillarContext(pillar.description, text, planDate);
      await updatePillar(userId, item.pillar_id, { description });
      pillar.description = description;
      applied.push({
        pillar_id: item.pillar_id,
        pillar_name: item.pillar_name,
        text,
      });
    }

    return applied;
  } catch (e) {
    console.error("[apply-check-in-pillar-context]", e);
    return [];
  }
}
