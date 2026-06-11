import { z } from "zod";
import { isLifeAdminPillarName } from "../life-admin";

const pillarContextItemSchema = z.object({
  pillar: z.string(),
  nickname: z.string().optional(),
  context: z.string(),
});

const pillarContextArraySchema = z.array(pillarContextItemSchema);

export type ParsedPillarContextExtract = {
  pillar_id: number;
  pillar_name: string;
  nickname: string | null;
  context: string;
};

function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }

  return [];
}

function resolvePillarId(
  pillarName: string,
  pillars: { id: unknown; name: unknown }[]
): number | null {
  const normalized = pillarName.trim().toLowerCase();
  if (!normalized) return null;
  const match = pillars.find(
    (p) => String(p.name).trim().toLowerCase() === normalized
  );
  return match ? Number(match.id) : null;
}

export function parsePillarContextExtractFromResponse(
  fullText: string,
  pillars: { id: unknown; name: unknown }[]
): ParsedPillarContextExtract[] {
  let parsed: unknown = [];
  try {
    parsed = extractJsonArray(fullText);
  } catch {
    parsed = [];
  }

  let rows: z.infer<typeof pillarContextItemSchema>[] = [];
  try {
    rows = pillarContextArraySchema.parse(parsed);
  } catch {
    rows = [];
  }

  const out: ParsedPillarContextExtract[] = [];
  const seen = new Set<number>();

  for (const row of rows) {
    const context = row.context.trim();
    if (!context) continue;

    const pillarName = row.pillar.trim();
    if (!pillarName || isLifeAdminPillarName(pillarName)) continue;

    const pillarId = resolvePillarId(pillarName, pillars);
    if (pillarId == null || seen.has(pillarId)) continue;
    seen.add(pillarId);

    const nickname = row.nickname?.trim() || null;
    out.push({
      pillar_id: pillarId,
      pillar_name: pillarName,
      nickname,
      context,
    });
  }

  return out;
}
