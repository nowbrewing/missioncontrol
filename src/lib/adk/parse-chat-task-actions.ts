import { z } from "zod";
import { isYyyyMmDd } from "../date";
import { agentBucketSchema, type AgentBucket } from "../mission-buckets";
import type { ParsedProposedTask } from "./parse-proposed-tasks";

const proposedTaskSchema = z.object({
  title: z.string(),
  pillar: z.string().optional(),
  deadline: z.string().nullable().optional(),
  bucket: agentBucketSchema.optional(),
});

const taskEditSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  pillar: z.string().optional(),
  deadline: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

const actionsSchema = z.object({
  new_tasks: z.array(proposedTaskSchema).optional(),
  task_edits: z.array(taskEditSchema).optional(),
});

export type ParsedTaskEdit = {
  task_id: number;
  title?: string;
  pillar: string;
  pillar_id: number | null;
  deadline?: string | null;
  note?: string | null;
};

export type ParsedChatTaskActions = {
  reply: string;
  proposedTasks: ParsedProposedTask[];
  taskEdits: ParsedTaskEdit[];
};

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }

  return null;
}

function splitReplyAndJson(fullText: string) {
  const fenceIndex = fullText.search(/```(?:json)?/i);
  const reply =
    fenceIndex >= 0 ? fullText.slice(0, fenceIndex).trim() : fullText.trim();
  return { reply, jsonSource: fullText };
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

export function parseChatTaskActions(
  fullText: string,
  pillars: { id: unknown; name: unknown }[]
): ParsedChatTaskActions {
  const { reply, jsonSource } = splitReplyAndJson(fullText);

  let parsed: z.infer<typeof actionsSchema> | null = null;
  try {
    const raw = extractJsonObject(jsonSource);
    if (raw && typeof raw === "object") {
      parsed = actionsSchema.parse(raw);
    }
  } catch {
    parsed = null;
  }

  const proposedTasks: ParsedProposedTask[] = [];
  for (const row of parsed?.new_tasks ?? []) {
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

  const taskEdits: ParsedTaskEdit[] = [];
  for (const row of parsed?.task_edits ?? []) {
    const taskId = Number(row.id);
    if (!Number.isFinite(taskId) || taskId <= 0) continue;

    const edit: ParsedTaskEdit = {
      task_id: taskId,
      pillar: "",
      pillar_id: null,
    };

    if (row.title?.trim()) {
      edit.title = row.title.trim();
    }
    if (row.deadline !== undefined) {
      edit.deadline =
        row.deadline && isYyyyMmDd(row.deadline) ? row.deadline : null;
    }
    if (row.note !== undefined) {
      edit.note = row.note?.trim() ? row.note.trim() : null;
    }
    if (row.pillar !== undefined) {
      const { pillar, pillar_id } = resolvePillarId(row.pillar, pillars);
      edit.pillar = pillar;
      edit.pillar_id = pillar_id;
    }

    if (
      edit.title !== undefined ||
      edit.deadline !== undefined ||
      edit.note !== undefined ||
      row.pillar !== undefined
    ) {
      taskEdits.push(edit);
    }
  }

  return { reply, proposedTasks, taskEdits };
}
