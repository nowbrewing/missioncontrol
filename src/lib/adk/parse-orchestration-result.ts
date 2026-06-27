import { z } from "zod";
import { isYyyyMmDd } from "../date";
import {
  agentBucketSchema,
  canAgentPostponeDeadline,
  enforceOrchestrationBucketRules,
  inferDefaultOrchestrationBucket,
  type AgentBucket,
} from "../mission-buckets";
import { shouldSurfaceOverdueOnToday } from "../task-schedule";

const proposedTaskSchema = z.object({
  title: z.string(),
  pillar: z.string().optional(),
  deadline: z.string().nullable().optional(),
  bucket: agentBucketSchema.optional(),
});

const rescheduleSchema = z.object({
  task_id: z.number(),
  deadline: z.string().optional(),
  bucket: z.enum(["today", "this_week", "later"]).optional(),
  reason: z.string().optional(),
});

const synthesisSchema = z.object({
  kickoff: z.string().optional(),
  rest_of_day: z.string().optional(),
  flags: z.array(z.string()).optional(),
  today: z.array(z.number()).optional(),
  this_week: z.array(z.number()).optional(),
  later: z.array(z.number()).optional(),
  reschedule: z.array(rescheduleSchema).optional(),
  proposed_new_tasks: z.array(proposedTaskSchema).optional(),
});

export type OrchestrationLayout = {
  today: number[];
  this_week: number[];
  later: number[];
};

export type OrchestrationReschedule = {
  task_id: number;
  deadline: string | null;
  bucket: "today" | "this_week" | "later";
};

export type DayGuide = {
  kickoff: string;
  rest_of_day: string;
  flags: string[];
};

export type ParsedProposedTaskFromOrchestration = {
  title: string;
  pillar: string;
  pillar_id: number | null;
  deadline: string | null;
  bucket: AgentBucket;
};

export type ParsedOrchestrationResult = {
  dayGuide: DayGuide;
  layout: OrchestrationLayout;
  reschedules: OrchestrationReschedule[];
  proposedTasks: ParsedProposedTaskFromOrchestration[];
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

  return {};
}

function resolvePillarId(
  pillarName: string | undefined,
  pillars: { id: unknown; name: unknown }[]
) {
  const pillar = pillarName?.trim() || "";
  if (!pillar) return { pillar: "", pillar_id: null as number | null };
  const match = pillars.find(
    (p) => String(p.name).trim().toLowerCase() === pillar.toLowerCase()
  );
  return {
    pillar: match ? String(match.name) : pillar,
    pillar_id: match ? Number(match.id) : null,
  };
}

export function completeLayoutForOpenTasks(
  layout: OrchestrationLayout,
  openTaskIds: number[],
  openTasks: { id: number; deadline: string | null; date_locked?: number }[] = [],
  planDate?: string
): OrchestrationLayout {
  const used = new Set([
    ...layout.today,
    ...layout.this_week,
    ...layout.later,
  ]);
  const missing = openTaskIds.filter((id) => !used.has(id));
  if (missing.length === 0) return layout;

  const taskById = new Map(openTasks.map((t) => [Number(t.id), t]));
  const overdueMissing: number[] = [];
  const weekMissing: number[] = [];
  const laterMissing: number[] = [];

  for (const id of missing) {
    const task = taskById.get(id);
    if (!task || !planDate) {
      weekMissing.push(id);
      continue;
    }
    const bucket = inferDefaultOrchestrationBucket(task, planDate);
    if (bucket === "today") overdueMissing.push(id);
    else if (bucket === "later") laterMissing.push(id);
    else weekMissing.push(id);
  }

  return {
    ...layout,
    today: [...layout.today, ...overdueMissing],
    this_week: [...layout.this_week, ...weekMissing],
    later: [...layout.later, ...laterMissing],
  };
}

export function parseSynthesisResult(
  raw: string,
  pillars: { id: unknown; name: unknown }[],
  openTaskIds: number[] = [],
  openTasks: { id: number; deadline: string | null; date_locked?: number }[] = [],
  planDate?: string
): ParsedOrchestrationResult {
  let parsed: z.infer<typeof synthesisSchema> = {};

  try {
    parsed = synthesisSchema.parse(extractJsonObject(raw));
  } catch {
    parsed = {};
  }

  const proposedTasks: ParsedProposedTaskFromOrchestration[] = [];
  for (const row of parsed.proposed_new_tasks ?? []) {
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

  const reschedules: OrchestrationReschedule[] = [];
  for (const row of parsed.reschedule ?? []) {
    const deadline =
      row.deadline && isYyyyMmDd(row.deadline) ? row.deadline : null;
    const task = openTasks.find((t) => Number(t.id) === row.task_id);
    if (task && deadline && !canAgentPostponeDeadline(task, deadline, planDate ?? "")) {
      continue;
    }
    reschedules.push({
      task_id: row.task_id,
      deadline,
      bucket: row.bucket ?? "later",
    });
  }

  let layout = completeLayoutForOpenTasks(
    {
      today: parsed.today ?? [],
      this_week: parsed.this_week ?? [],
      later: parsed.later ?? [],
    },
    openTaskIds,
    openTasks,
    planDate
  );

  if (planDate) {
    layout = enforceOrchestrationBucketRules(layout, openTasks, planDate);
  }

  const laterIds = new Set(layout.later);
  const overdueInWeek = layout.this_week.filter((id) => {
    if (laterIds.has(id)) return false;
    const task = openTasks.find((t) => Number(t.id) === id);
    return !!(planDate && task && shouldSurfaceOverdueOnToday(task, planDate));
  });
  if (overdueInWeek.length > 0) {
    layout.today = [...layout.today, ...overdueInWeek];
    layout.this_week = layout.this_week.filter((id) => !overdueInWeek.includes(id));
  }

  const flags = (parsed.flags ?? [])
    .map((f) => sanitizeDayGuideText(f.trim()))
    .filter(Boolean)
    .filter((f) => !isBoardDuplicateFlag(f))
    .slice(0, 2);

  return {
    dayGuide: {
      kickoff: sanitizeDayGuideText((parsed.kickoff ?? "").trim()),
      rest_of_day: sanitizeDayGuideText((parsed.rest_of_day ?? "").trim()),
      flags,
    },
    layout,
    reschedules,
    proposedTasks,
  };
}

export function formatDayGuideForStorage(guide: DayGuide): string {
  const parts: string[] = [];
  if (guide.kickoff) parts.push(guide.kickoff);
  if (guide.rest_of_day) parts.push(guide.rest_of_day);
  return parts.join("\n\n");
}

function sanitizeDayGuideText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\(\s*id\s*=\s*\d+\s*\)/gi, "")
    .replace(/\bid\s*=\s*\d+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isBoardDuplicateFlag(flag: string): boolean {
  const lower = flag.toLowerCase();
  return (
    lower.includes("fixed to today") ||
    lower.includes("date-locked") ||
    lower.includes("date locked") ||
    lower.includes("scheduled for today")
  );
}
