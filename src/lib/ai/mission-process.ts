import { generateObject } from "ai";
import type { Client } from "@libsql/client";
import { z } from "zod";
import { ensureLifeSchema } from "../../db/life";
import { isYyyyMmDd } from "../date";
import { inferDeadlineFromText, upcomingWeekReference } from "../mission-dates";
import {
  inferScheduleTypeFromText,
  inferWindowStart,
  normalizeScheduleType,
  type ScheduleType,
} from "../task-schedule";
import {
  isRunTask,
  prefersNoDuplicateRuns,
  spreadRunsAcrossDays,
} from "../workout-schedule";
import { fridayOfWeekContaining } from "../mission-dates";
import { reconcileIntakeTasks } from "../task-reconcile";
import { getAiModel } from "./provider";
import { getUserContext } from "./get-user-context";

const extractedTaskSchema = z.object({
  title: z.string(),
  pillar_id: z.number().nullable(),
  milestone_id: z.number().nullable(),
  deadline: z.string().nullable(),
  schedule_type: z.enum(["flexible", "complete_by", "fixed", "window"]),
  window_start: z.string().nullable(),
  priority: z.number().int().min(1).max(20),
  rationale: z.string().optional(),
});

const processResultSchema = z.object({
  new_tasks: z.array(extractedTaskSchema),
  promote_to_today: z.array(z.number().int()),
});

export type ProcessedTask = z.infer<typeof extractedTaskSchema>;

export async function extractTasksFromIntake(
  wentWellYesterday: string,
  topOfMindToday: string,
  userId: number,
  turso: Client,
  referenceDate?: string
) {
  const ctx = await getUserContext(turso, userId);
  const planToday =
    referenceDate && isYyyyMmDd(referenceDate) ? referenceDate : ctx.today;

  const pillarRows = ctx.pillars as Record<string, unknown>[];
  const milestoneRows = ctx.milestones as Record<string, unknown>[];
  const taskRows = ctx.tasks as Record<string, unknown>[];

  const pillarList = pillarRows
    .map((p) => `- id=${p.id} name="${p.name}" rank=${p.rank}`)
    .join("\n");

  const milestoneList = milestoneRows
    .filter((m) => !m.completed_at)
    .map(
      (m) =>
        `- id=${m.id} title="${m.title}" pillar_id=${m.pillar_id ?? "null"} target=${m.target_date ?? "none"}`
    )
    .join("\n");

  const openTasks = taskRows
    .filter((t) => !t.completed_at)
    .map(
      (t) =>
        `- id=${t.id} title="${t.title}" pillar_id=${t.pillar_id ?? "null"} deadline=${t.deadline ?? "none"}`
    )
    .join("\n");

  const weekRef = upcomingWeekReference(planToday)
    .map((d) => `- ${d.label}: ${d.date}`)
    .join("\n");

  const { object } = await generateObject({
    model: getAiModel(),
    schema: processResultSchema,
    prompt: `You are a personal mission control assistant. Parse the user's morning check-in into actionable tasks.

The user is planning for ${planToday} (treat this as "today" when resolving relative dates).

UPCOMING DATES (use these to resolve "Monday", "tomorrow", etc.):
${weekRef}

PILLARS (assign pillar_id when a task clearly relates):
${pillarList || "(none)"}

OPEN MILESTONES (assign milestone_id when a task advances a specific milestone):
${milestoneList || "(none)"}

EXISTING OPEN TASKS (reconcile against these — use their id when promoting, never recreate):
${openTasks || "(none)"}

USER PREFERENCES & PLANNING RULES (follow these when scheduling):
${ctx.preferences || "(none — default: do not plan two runs on the same day)"}

WHAT WENT WELL YESTERDAY:
${wentWellYesterday || "(not provided)"}

TOP OF MIND TODAY:
${topOfMindToday}

Instructions:
1. RECONCILE FIRST: Compare every item in the check-in to EXISTING OPEN TASKS before creating anything new.
   - If the user mentions continuing, finishing, focusing on, or picking back up something that matches an existing task, put that task's id in promote_to_today — do NOT add a new_tasks entry.
   - Phrases like "continue working on X", "focus on X today", "need to finish X", "still need to do X", or "work on the app" when a similar open task exists → promote_to_today only.
   - Only add to new_tasks when the work is genuinely new and not already represented by an open task.
2. new_tasks: concrete, actionable tasks that are NOT already open. Tag each with pillar_id and milestone_id when clear; use null if unsure.
3. promote_to_today: existing open task ids the user wants prioritized for ${planToday}. Empty array if none.
4. SCHEDULE TYPES (critical — pick exactly one per new task):
   - fixed: Event or appointment happening ON a specific day/time ("Dexa scan Monday", "meeting at 3pm"). Must be done that day, not earlier.
   - complete_by: Latest acceptable completion ("finish report by Friday", "due before the 12th"). Can be done earlier; lower urgency while still far from the date.
   - window: Flexible range ("sometime next week", "when I can"). Set window_start and deadline to the range bounds.
   - flexible: No date mentioned.
5. DEADLINES: Resolve named days/dates to YYYY-MM-DD from the reference above. "This week" means complete by Friday (${fridayOfWeekContaining(planToday)}) — use schedule_type complete_by, not window. For fixed events, deadline is the event day. For complete_by, deadline is the last acceptable day. For window, deadline is the end of the range.
6. WORKOUTS & RUNS: Each run is one task on ONE specific day. Use schedule_type fixed with that day's deadline — never window or complete_by for individual runs. Spread runs across different weekdays; check existing open run deadlines and avoid duplicate run days. Never put two runs on the same day unless the user explicitly asks.
7. Tasks meant for a future day get higher priority numbers (less urgent for today).
8. Keep new task titles short — omit dates already captured in deadline/schedule fields.
9. Return at most 12 new_tasks and promote_to_today combined.`,
  });

  const intakeText = `${wentWellYesterday}\n${topOfMindToday}`;
  const openTaskList = taskRows
    .filter((t) => !t.completed_at)
    .map((t) => ({
      id: Number(t.id),
      title: String(t.title),
      completed_at: t.completed_at as string | null | undefined,
    }));

  const reconciled = reconcileIntakeTasks(
    object.new_tasks,
    object.promote_to_today,
    openTaskList
  );

  const tasks = reconciled.tasks.map((task) => {
    const blob = `${task.title} ${task.rationale || ""} ${intakeText}`;
    let deadline = task.deadline && isYyyyMmDd(task.deadline) ? task.deadline : null;
    if (!deadline) deadline = inferDeadlineFromText(blob, planToday);

    let schedule_type = normalizeScheduleType(task.schedule_type) as ScheduleType;
    if (schedule_type === "flexible") {
      schedule_type = inferScheduleTypeFromText(blob);
    }

    let window_start =
      task.window_start && isYyyyMmDd(task.window_start) ? task.window_start : null;
    if (schedule_type === "window" && !window_start) {
      window_start = inferWindowStart(blob, planToday, deadline);
    }

    return { ...task, deadline, schedule_type, window_start };
  });

  let finalTasks = tasks;
  if (prefersNoDuplicateRuns(ctx.preferences_raw)) {
    const existingRunDates = new Set(
      taskRows
        .filter((t) => !t.completed_at && isRunTask(String(t.title)))
        .map((t) => String(t.deadline || planToday))
    );
    finalTasks = spreadRunsAcrossDays([...tasks], planToday, existingRunDates);
  }

  finalTasks = finalTasks.map((task) => {
    if (isRunTask(task.title) && task.deadline && isYyyyMmDd(task.deadline)) {
      return { ...task, schedule_type: "fixed" as const, window_start: null };
    }
    return task;
  });

  return {
    tasks: finalTasks,
    promote_to_today: reconciled.promote_to_today,
  };
}

export async function persistProcessedTasks(
  turso: Client,
  userId: number,
  tasks: ProcessedTask[],
  intakeText = "",
  referenceDate?: string
) {
  await ensureLifeSchema(turso);

  const maxRank = await turso.execute({
    sql: `SELECT COALESCE(MAX(rank), -1) AS max_rank FROM tasks WHERE user_id = ?;`,
    args: [userId],
  });
  let nextRank = Number((maxRank.rows[0] as Record<string, unknown>).max_rank) + 1;

  const sorted = [...tasks].sort((a, b) => a.priority - b.priority);
  const created: Record<string, unknown>[] = [];

  const ctx = await getUserContext(turso, userId);
  const today =
    referenceDate && isYyyyMmDd(referenceDate) ? referenceDate : ctx.today;

  for (const task of sorted) {
    let deadline =
      task.deadline && isYyyyMmDd(task.deadline) ? task.deadline : null;
    if (!deadline && intakeText) {
      deadline = inferDeadlineFromText(
        `${task.title} ${task.rationale || ""} ${intakeText}`,
        today
      );
    }

    let schedule_type = normalizeScheduleType(task.schedule_type);
    if (schedule_type === "flexible" && intakeText) {
      schedule_type = inferScheduleTypeFromText(
        `${task.title} ${task.rationale || ""} ${intakeText}`
      );
    }
    let window_start =
      task.window_start && isYyyyMmDd(task.window_start) ? task.window_start : null;
    if (schedule_type === "window" && !window_start) {
      window_start = inferWindowStart(
        `${task.title} ${task.rationale || ""} ${intakeText}`,
        today,
        deadline
      );
    }

    if (isRunTask(task.title) && deadline) {
      schedule_type = "fixed";
      window_start = null;
    }

    const result = await turso.execute({
      sql: `INSERT INTO tasks (user_id, title, description, deadline, rank, pillar_id, milestone_id, schedule_type, window_start)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id, title, description, deadline, completed_at, rank, pillar_id, milestone_id, schedule_type, window_start, created_at;`,
      args: [
        userId,
        task.title.trim(),
        task.rationale?.trim() || null,
        deadline,
        nextRank++,
        task.pillar_id,
        task.milestone_id,
        schedule_type,
        window_start,
      ],
    });
    created.push(result.rows[0] as Record<string, unknown>);
  }

  return created;
}
