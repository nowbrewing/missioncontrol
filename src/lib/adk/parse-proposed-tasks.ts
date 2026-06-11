import { z } from "zod";
import { isYyyyMmDd } from "../date";

const bucketSchema = z.enum(["Today", "This Week", "Later"]);

const proposedTaskSchema = z.object({
  title: z.string(),
  pillar: z.string().optional(),
  deadline: z.string().nullable().optional(),
  bucket: bucketSchema.optional(),
});

const proposedTasksArraySchema = z.array(proposedTaskSchema);

export type ParsedProposedTask = {
  title: string;
  pillar: string;
  pillar_id: number | null;
  deadline: string | null;
  bucket: "Today" | "This Week" | "Later";
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

export function splitSummaryAndProposedJson(fullText: string) {
  const fenceIndex = fullText.search(/```(?:json)?/i);
  const summary =
    fenceIndex >= 0 ? fullText.slice(0, fenceIndex).trim() : fullText.trim();
  return { summary, jsonSource: fullText };
}

function resolvePillarId(
  pillarName: string | undefined,
  pillars: { id: unknown; name: unknown }[]
): { pillar: string; pillar_id: number | null } {
  const pillar = pillarName?.trim() || "";
  if (!pillar) return { pillar: "", pillar_id: null };

  const match = pillars.find(
    (p) => String(p.name).trim().toLowerCase() === pillar.toLowerCase()
  );
  return {
    pillar: match ? String(match.name) : pillar,
    pillar_id: match ? Number(match.id) : null,
  };
}

export function parseProposedTasksFromResponse(
  fullText: string,
  pillars: { id: unknown; name: unknown }[]
): { summary: string; proposedTasks: ParsedProposedTask[] } {
  const { summary, jsonSource } = splitSummaryAndProposedJson(fullText);

  let parsed: unknown = [];
  try {
    parsed = extractJsonArray(jsonSource);
  } catch {
    parsed = [];
  }

  let rows: z.infer<typeof proposedTaskSchema>[] = [];
  try {
    rows = proposedTasksArraySchema.parse(parsed);
  } catch {
    rows = [];
  }

  const proposedTasks: ParsedProposedTask[] = [];

  for (const row of rows) {
    const title = row.title.trim();
    if (!title) continue;

    const { pillar, pillar_id } = resolvePillarId(row.pillar, pillars);
    const deadline =
      row.deadline && isYyyyMmDd(row.deadline) ? row.deadline : null;

    proposedTasks.push({
      title,
      pillar,
      pillar_id,
      deadline,
      bucket: row.bucket ?? "Later",
    });
  }

  return { summary, proposedTasks };
}
