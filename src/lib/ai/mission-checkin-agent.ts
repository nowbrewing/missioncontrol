import { generateObject } from "ai";
import type { Client } from "@libsql/client";
import { z } from "zod";
import { addDaysIsoYyyyMmDd, isYyyyMmDd } from "../date";
import {
  buildDailyLogAggregate,
  combineEntryText,
  formatEntriesForPrompt,
  groupEntriesByKind,
  listRecentDailyLogEntries,
} from "../daily-log-entries";
import { fridayOfWeekContaining, upcomingWeekReference } from "../mission-dates";
import {
  computePillarMovement,
  computeTaskPriorityStreaks,
} from "../mission-checkin-history";
import { formatUserPreferencesForPrompt } from "../user-preferences";
import { isHealthTask, isRunTask } from "../workout-schedule";
import { getAiModel } from "./provider";

const bucketRefSchema = z.object({
  kind: z.enum(["task", "milestone"]),
  id: z.number().int(),
});

const prioritizationSchema = z.object({
  reflection: z.string(),
  buckets: z.object({
    today: z.array(bucketRefSchema),
    tomorrow: z.array(bucketRefSchema),
    this_week: z.array(bucketRefSchema),
    later: z.array(bucketRefSchema),
  }),
  flags: z.array(z.string()),
  deadline_updates: z
    .array(
      z.object({
        task_id: z.number().int(),
        deadline: z.string().nullable(),
      })
    )
    .optional(),
});

export type PrioritizationBucketRef = z.infer<typeof bucketRefSchema>;
export type PrioritizationResult = z.infer<typeof prioritizationSchema>;

type OpenTaskRow = {
  id: number;
  title: string;
  deadline: string | null;
  schedule_type: string;
  window_start: string | null;
  pillar_id: number | null;
  pillar_name: string | null;
  pillar_rank: number | null;
  milestone_id: number | null;
  milestone_title: string | null;
  milestone_target: string | null;
};

type OpenMilestoneRow = {
  id: number;
  title: string;
  target_date: string | null;
  pillar_id: number | null;
  pillar_name: string | null;
  pillar_rank: number | null;
};

function refKey(ref: PrioritizationBucketRef) {
  return `${ref.kind}-${ref.id}`;
}

function enforceBucketCoverage(
  result: PrioritizationResult,
  openTasks: OpenTaskRow[],
  openMilestones: OpenMilestoneRow[]
): PrioritizationResult {
  const assigned = new Set<string>();
  const buckets = {
    today: [] as PrioritizationBucketRef[],
    tomorrow: [] as PrioritizationBucketRef[],
    this_week: [] as PrioritizationBucketRef[],
    later: [] as PrioritizationBucketRef[],
  };

  for (const name of Object.keys(buckets) as (keyof typeof buckets)[]) {
    for (const ref of result.buckets[name]) {
      const key = refKey(ref);
      if (assigned.has(key)) continue;
      assigned.add(key);
      buckets[name].push(ref);
    }
  }

  for (const task of openTasks) {
    const key = refKey({ kind: "task", id: task.id });
    if (!assigned.has(key)) {
      buckets.later.push({ kind: "task", id: task.id });
      assigned.add(key);
    }
  }

  for (const milestone of openMilestones) {
    const key = refKey({ kind: "milestone", id: milestone.id });
    if (!assigned.has(key)) {
      buckets.this_week.push({ kind: "milestone", id: milestone.id });
      assigned.add(key);
    }
  }

  return { ...result, buckets };
}

function enforceHealthRules(
  result: PrioritizationResult,
  tasksById: Map<number, OpenTaskRow>,
  planDate: string
): PrioritizationResult {
  const tomorrow = addDaysIsoYyyyMmDd(planDate, 1);
  const buckets = { ...result.buckets };
  const flags = [...result.flags];

  const todayTasks = buckets.today.filter((r) => r.kind === "task");
  const healthToday = todayTasks.filter((r) => {
    const t = tasksById.get(r.id);
    return t && isHealthTask(t.title);
  });

  if (healthToday.length > 1) {
    const keep = healthToday[0];
    for (const ref of healthToday.slice(1)) {
      buckets.today = buckets.today.filter(
        (r) => !(r.kind === "task" && r.id === ref.id)
      );
      buckets.tomorrow.push(ref);
    }
    flags.push(
      "Spread health tasks — only one fitness/health item in Today."
    );
    void keep;
  }

  const runDates = new Map<string, number>();
  for (const bucketName of ["today", "tomorrow"] as const) {
    for (const ref of buckets[bucketName]) {
      if (ref.kind !== "task") continue;
      const task = tasksById.get(ref.id);
      if (!task || !isRunTask(task.title)) continue;
      const date = bucketName === "today" ? planDate : tomorrow;
      const count = runDates.get(date) ?? 0;
      if (count >= 1) {
        buckets[bucketName] = buckets[bucketName].filter(
          (r) => !(r.kind === "task" && r.id === ref.id)
        );
        buckets.this_week.push(ref);
        flags.push(`Moved extra run off ${date} — one run per day.`);
      } else {
        runDates.set(date, count + 1);
      }
    }
  }

  const todayTaskRefs = buckets.today.filter((r) => r.kind === "task");
  if (todayTaskRefs.length > 5) {
    const overflow = todayTaskRefs.slice(5);
    for (const ref of overflow) {
      buckets.today = buckets.today.filter(
        (r) => !(r.kind === "task" && r.id === ref.id)
      );
      buckets.tomorrow.push(ref);
    }
    flags.push("Today trimmed to 5 tasks — overflow moved to Tomorrow.");
  }

  return { ...result, buckets, flags: [...new Set(flags)] };
}

export async function reflectAndPrioritize(
  turso: Client,
  userId: number,
  planDate: string,
  checkIn: { went_well: string; top_of_mind: string }
): Promise<PrioritizationResult> {
  const tomorrow = addDaysIsoYyyyMmDd(planDate, 1);
  const weekEnd = fridayOfWeekContaining(planDate);

  const [pillars, milestones, tasks, todayLog, recentLogs, userRow, pillarMovement] =
    await Promise.all([
      turso.execute({
        sql: `SELECT id, name, rank FROM pillars WHERE user_id = ? ORDER BY rank ASC;`,
        args: [userId],
      }),
      turso.execute({
        sql: `SELECT m.id, m.title, m.target_date, m.pillar_id, p.name AS pillar_name, p.rank AS pillar_rank
              FROM milestones m
              LEFT JOIN pillars p ON p.id = m.pillar_id
              WHERE m.user_id = ? AND m.completed_at IS NULL
              ORDER BY m.rank ASC;`,
        args: [userId],
      }),
      turso.execute({
        sql: `SELECT t.id, t.title, t.deadline, t.schedule_type, t.window_start,
                     t.pillar_id, p.name AS pillar_name, p.rank AS pillar_rank,
                     t.milestone_id, m.title AS milestone_title, m.target_date AS milestone_target
              FROM tasks t
              LEFT JOIN pillars p ON p.id = t.pillar_id
              LEFT JOIN milestones m ON m.id = t.milestone_id
              WHERE t.user_id = ? AND t.completed_at IS NULL
              ORDER BY t.rank ASC;`,
        args: [userId],
      }),
      buildDailyLogAggregate(turso, userId, planDate),
      listRecentDailyLogEntries(turso, userId, planDate, 7),
      turso.execute({
        sql: `SELECT preferences FROM users WHERE id = ?;`,
        args: [userId],
      }),
      computePillarMovement(turso, userId, planDate),
    ]);

  const openTaskIds = (tasks.rows as Record<string, unknown>[]).map((r) =>
    Number(r.id)
  );
  const taskStreaks = await computeTaskPriorityStreaks(
    turso,
    userId,
    planDate,
    openTaskIds
  );

  const openTasks: OpenTaskRow[] = (tasks.rows as Record<string, unknown>[]).map(
    (t) => ({
      id: Number(t.id),
      title: String(t.title),
      deadline: t.deadline ? String(t.deadline) : null,
      schedule_type: String(t.schedule_type || "flexible"),
      window_start: t.window_start ? String(t.window_start) : null,
      pillar_id: t.pillar_id != null ? Number(t.pillar_id) : null,
      pillar_name: t.pillar_name ? String(t.pillar_name) : null,
      pillar_rank: t.pillar_rank != null ? Number(t.pillar_rank) : null,
      milestone_id: t.milestone_id != null ? Number(t.milestone_id) : null,
      milestone_title: t.milestone_title ? String(t.milestone_title) : null,
      milestone_target: t.milestone_target ? String(t.milestone_target) : null,
    })
  );

  const openMilestones: OpenMilestoneRow[] = (
    milestones.rows as Record<string, unknown>[]
  ).map((m) => ({
    id: Number(m.id),
    title: String(m.title),
    target_date: m.target_date ? String(m.target_date) : null,
    pillar_id: m.pillar_id != null ? Number(m.pillar_id) : null,
    pillar_name: m.pillar_name ? String(m.pillar_name) : null,
    pillar_rank: m.pillar_rank != null ? Number(m.pillar_rank) : null,
  }));

  const tasksById = new Map(openTasks.map((t) => [t.id, t]));

  const pillarBlocks = (pillars.rows as Record<string, unknown>[])
    .map((p) => {
      const pid = Number(p.id);
      const ms = openMilestones
        .filter((m) => m.pillar_id === pid)
        .map((m) => `    - milestone id=${m.id} "${m.title}" target=${m.target_date ?? "none"}`)
        .join("\n");
      const mv = pillarMovement.get(pid);
      return `- rank=${p.rank} id=${p.id} "${p.name}"${
        mv ? ` (${mv.completed} tasks completed last 3 days)` : " (no completions last 3 days)"
      }${ms ? `\n${ms}` : ""}`;
    })
    .join("\n");

  const taskList = openTasks
    .map((t) => {
      const streak = taskStreaks.get(t.id);
      const streakNote =
        streak && streak.days_in_priorities >= 3
          ? ` [in Today ${streak.days_in_priorities} days running]`
          : "";
      return `- id=${t.id} "${t.title}" pillar=${t.pillar_name ?? "none"} rank=${t.pillar_rank ?? "?"} deadline=${t.deadline ?? "open"} schedule=${t.schedule_type}${t.milestone_title ? ` milestone="${t.milestone_title}"` : ""}${streakNote}`;
    })
    .join("\n");

  const milestoneList = openMilestones
    .map(
      (m) =>
        `- id=${m.id} "${m.title}" pillar=${m.pillar_name ?? "none"} target=${m.target_date ?? "none"}`
    )
    .join("\n");

  const todayByKind = groupEntriesByKind(todayLog.entries);
  const todayCheckIn = [
    checkIn.went_well && `Wins/dropped (yesterday): ${checkIn.went_well}`,
    checkIn.top_of_mind && `Brain dump (today): ${checkIn.top_of_mind}`,
    combineEntryText(todayByKind.went_well) &&
      `Earlier wins today: ${combineEntryText(todayByKind.went_well)}`,
    combineEntryText(todayByKind.went_poorly) &&
      `What didn't go well: ${combineEntryText(todayByKind.went_poorly)}`,
    combineEntryText(todayByKind.daily_focus) &&
      `Earlier focus notes: ${combineEntryText(todayByKind.daily_focus)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const recentCheckIns = recentLogs
    .map(({ log_date, entries }) => {
      const byKind = groupEntriesByKind(entries);
      const parts = [
        formatEntriesForPrompt(byKind.went_well),
        formatEntriesForPrompt(byKind.went_poorly),
        formatEntriesForPrompt(byKind.daily_focus),
      ].filter(Boolean);
      if (parts.length === 0) return null;
      return `${log_date}:\n${parts.join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const preferences = formatUserPreferencesForPrompt(
    (userRow.rows[0] as Record<string, unknown> | undefined)?.preferences as
      | string
      | null
      | undefined
  );

  const weekRef = upcomingWeekReference(planDate)
    .map((d) => `- ${d.label}: ${d.date}`)
    .join("\n");

  const { object } = await generateObject({
    model: getAiModel(),
    schema: prioritizationSchema,
    prompt: `You are a daily check-in reflection and task prioritization agent. Plan date: ${planDate} (today). Tomorrow: ${tomorrow}. This week ends: ${weekEnd}.

UPCOMING DATES:
${weekRef}

PILLARS (ranked) WITH MILESTONES:
${pillarBlocks || "(none)"}

OPEN MILESTONES:
${milestoneList || "(none)"}

OPEN TASKS (assign each task id to exactly one bucket):
${taskList || "(none)"}

TODAY'S CHECK-IN:
${todayCheckIn || "(not provided)"}

LAST 7 DAYS OF CHECK-INS:
${recentCheckIns || "(none)"}

USER PREFERENCES:
${preferences || "(default: one run per day, max one health/fitness task in Today)"}

REFLECTION (2-3 sentences at top of your reasoning):
- Brief honest read on yesterday — what moved, what got dropped, patterns worth naming
- Do NOT restate the user's dump verbatim
- No hollow praise ("great progress", "keep it up")
- Plain language, no filler

PRIORITIZATION — assign every open TASK to exactly one bucket (milestones optional in buckets):
- Today (${planDate}): due today, overdue (pick only the most important 3-5 — do NOT pack everything overdue), or highest-ranked-pillar undated low-effort work. Max 3-5 meaningful tasks. Max 1 fitness/health task. Never 2 runs same day. Never cluster run+walk+gym same day.
- Tomorrow (${tomorrow}): logical next items given Today, or tasks dated tomorrow
- This week (through ${weekEnd}): dated this week, or undated from high-ranked pillars not in Today/Tomorrow
- Later: beyond this week, or low-priority undated tasks

RULES:
- Milestone deadlines beat undated tasks regardless of pillar rank
- Flexible tasks slot by pillar rank, not arbitrarily
- Tasks may start before their date if Today/Tomorrow are light
- If a task shows [in Today N days running] with N>=3, add a flags entry: "This has appeared N days running — still a priority or should it be removed?" (use the task title)
- Flag pillars with no movement in 3+ days (see pillar completion notes)
- Flag milestones at risk (deadline vs pace)
- deadline_updates: for flexible/undated tasks placed in Tomorrow, set deadline to ${tomorrow}; for Today flexible tasks due today, set deadline to ${planDate}

FLAGS section: repetition warnings, stagnant pillars, at-risk milestones. No filler.

Return reflection as 2-3 sentences only. Every open task id must appear in exactly one bucket.`,
  });

  let result = enforceBucketCoverage(object, openTasks, openMilestones);
  result = enforceHealthRules(result, tasksById, planDate);

  if (result.deadline_updates) {
    result.deadline_updates = result.deadline_updates.filter(
      (u) => u.deadline === null || isYyyyMmDd(u.deadline)
    );
  }

  return result;
}
