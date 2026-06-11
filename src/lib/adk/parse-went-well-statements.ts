import { z } from "zod";

const wentWellStatementSchema = z.object({
  content: z.string(),
  pillars: z.array(z.string()).optional(),
});

const wentWellArraySchema = z.array(wentWellStatementSchema);

export type ParsedWentWellStatement = {
  content: string;
  pillar_ids: number[];
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

function resolvePillarIds(
  pillarNames: string[] | undefined,
  pillars: { id: unknown; name: unknown }[]
): number[] {
  if (!pillarNames?.length) return [];

  const ids = new Set<number>();
  for (const name of pillarNames) {
    const normalized = name.trim().toLowerCase();
    if (!normalized || normalized === "general") continue;
    const match = pillars.find(
      (p) => String(p.name).trim().toLowerCase() === normalized
    );
    if (match) ids.add(Number(match.id));
  }
  return [...ids].sort((a, b) => a - b);
}

export function parseWentWellStatementsFromResponse(
  fullText: string,
  pillars: { id: unknown; name: unknown }[]
): ParsedWentWellStatement[] {
  let parsed: unknown = [];
  try {
    parsed = extractJsonArray(fullText);
  } catch {
    parsed = [];
  }

  let rows: z.infer<typeof wentWellStatementSchema>[] = [];
  try {
    rows = wentWellArraySchema.parse(parsed);
  } catch {
    rows = [];
  }

  const statements: ParsedWentWellStatement[] = [];
  for (const row of rows) {
    const content = row.content.trim();
    if (!content) continue;
    statements.push({
      content,
      pillar_ids: resolvePillarIds(row.pillars, pillars),
    });
  }

  return statements;
}

export function fallbackWentWellStatement(rawText: string): ParsedWentWellStatement[] {
  const content = rawText.trim();
  if (!content) return [];
  return [{ content, pillar_ids: [] }];
}
