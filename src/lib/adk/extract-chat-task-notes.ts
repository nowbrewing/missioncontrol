import { z } from "zod";
import { generateGeminiText } from "./gemini-text";
import { planOpenChatContext } from "./classify-open-chat-context";
import { agentBucketSchema, type AgentBucket } from "../mission-buckets";
import { listPillars } from "../mongodb/store/users";
import { listTasks } from "../mongodb/store/tasks";
import { isYyyyMmDd } from "../date";
import type { LifeAgentMessage } from "./run-life-agent";

const bucketSchema = agentBucketSchema;

const extractSchema = z.object({
  task_note_updates: z
    .array(
      z.object({
        task_id: z.number(),
        note: z.string(),
      })
    )
    .optional(),
  new_tasks: z
    .array(
      z.object({
        title: z.string(),
        pillar: z.string().optional(),
        note: z.string().optional(),
        deadline: z.string().nullable().optional(),
        bucket: bucketSchema.optional(),
      })
    )
    .optional(),
});

export type ExtractedTaskNoteUpdate = {
  task_id: number;
  task_title: string;
  existing_note: string | null;
  note: string;
};

export type ExtractedNewTaskWithNote = {
  title: string;
  pillar: string;
  pillar_id: number | null;
  note: string;
  deadline: string | null;
  bucket: AgentBucket;
};

export type ExtractChatTaskNotesResult = {
  task_note_updates: ExtractedTaskNoteUpdate[];
  new_tasks: ExtractedNewTaskWithNote[];
};

function formatTranscript(messages: LifeAgentMessage[]) {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim()}`)
    .join("\n\n");
}

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

export async function extractChatTaskNotes(params: {
  userId: number;
  planDate: string;
  messages: LifeAgentMessage[];
}): Promise<ExtractChatTaskNotesResult | null> {
  const messages = params.messages.filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim()
  );
  if (!messages.some((m) => m.role === "user")) return null;

  const [pillars, tasks] = await Promise.all([
    listPillars(params.userId),
    listTasks(params.userId),
  ]);
  const pillarRows = pillars.map((p) => ({
    id: Number(p.id),
    name: String(p.name),
    abbreviation: p.abbreviation ? String(p.abbreviation) : null,
    description: p.description ? String(p.description) : null,
  }));

  const openTasks = tasks.filter((t) => !t.completed_at);
  const taskById = new Map(openTasks.map((t) => [Number(t.id), t]));

  const openTasksBlock = openTasks.length
    ? openTasks
        .map((t) => {
          const pillarName =
            pillarRows.find((p) => p.id === Number(t.pillar_id))?.name ?? "Unassigned";
          const notePart = t.note?.trim() ? `\n  existing note: ${t.note.trim()}` : "";
          return `- id=${t.id} "${t.title}" (${pillarName})${
            t.deadline ? ` due ${t.deadline}` : ""
          }${notePart}`;
        })
        .join("\n")
    : "(no open tasks)";

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const plan = await planOpenChatContext({
    message: lastUser?.content ?? messages[messages.length - 1]!.content,
    history: messages.slice(0, -1),
    pillars: pillarRows,
    planDate: params.planDate,
  });

  const transcript = formatTranscript(messages);
  const raw = await generateGeminiText(
    `You are reviewing a chat (Mission Control co-pilot or general plain-AI mode) to save durable notes onto the user's task board.

Planning date: ${params.planDate}
Pillars: ${pillarRows.map((p) => `${p.name} (id=${p.id})`).join(", ") || "none"}

OPEN TASKS — use task_id when the chat clearly relates to one of these:
${openTasksBlock}

Extract notes worth keeping on tasks. For each distinct decision, insight, or action item from the chat:
- If it clearly belongs on an existing open task, add a task_note_update with that task_id.
- If it is a new actionable item not represented on the board, add a new_task with title, pillar, and note.
- Write notes in first person, 1–3 sentences, factual — for future-you, not a transcript.
- Do NOT repeat content already in an existing task note.
- Skip small talk, generic encouragement, and assistant meta-commentary.
- If nothing actionable belongs on the board, return empty arrays.

Transcript:
${transcript}

Return ONLY JSON:
\`\`\`json
{
  "task_note_updates": [{"task_id": 42, "note": "Decided to push launch to next week after reviewing scope."}],
  "new_tasks": [{"title": "Book dentist", "pillar": "Health", "note": "Need cleaning before trip.", "deadline": null, "bucket": "Next 7 days"}]
}
\`\`\``,
    { retries: 1 }
  );

  let parsed: z.infer<typeof extractSchema> | null = null;
  try {
    const rawJson = extractJsonObject(raw);
    if (rawJson && typeof rawJson === "object") {
      parsed = extractSchema.parse(rawJson);
    }
  } catch {
    return null;
  }

  const task_note_updates: ExtractedTaskNoteUpdate[] = [];
  for (const row of parsed?.task_note_updates ?? []) {
    const taskId = Number(row.task_id);
    const note = row.note?.trim();
    if (!Number.isFinite(taskId) || taskId <= 0 || !note) continue;

    const task = taskById.get(taskId);
    if (!task) continue;

    task_note_updates.push({
      task_id: taskId,
      task_title: String(task.title),
      existing_note: task.note?.trim() ? String(task.note) : null,
      note,
    });
  }

  const new_tasks: ExtractedNewTaskWithNote[] = [];
  for (const row of parsed?.new_tasks ?? []) {
    const title = row.title?.trim();
    const note = row.note?.trim() ?? "";
    if (!title) continue;

    const { pillar, pillar_id } = resolvePillarId(row.pillar, pillarRows);
    const deadline =
      row.deadline && isYyyyMmDd(row.deadline) ? row.deadline : null;

    new_tasks.push({
      title,
      pillar,
      pillar_id,
      note,
      deadline,
      bucket: row.bucket ?? "Later",
    });
  }

  if (task_note_updates.length === 0 && new_tasks.length === 0) return null;

  return { task_note_updates, new_tasks };
}
