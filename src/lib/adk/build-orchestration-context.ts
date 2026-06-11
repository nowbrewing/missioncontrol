import { formatPillarContextForPrompt } from "../pillar-context";
import { addDaysIsoYyyyMmDd } from "../date";
import { ensureLifeAdminSetup } from "../life-admin-setup";
import {
  computeLifeAdminStats,
  formatLifeAdminBlock,
} from "../life-admin";
import { listGoals } from "../mongodb/store/goals";
import { getMissionLayout } from "../mongodb/store/daily-logs";
import { listMilestones } from "../mongodb/store/milestones";
import { listActiveRoutines } from "../mongodb/store/routines";
import { listTasks } from "../mongodb/store/tasks";
import { listPillars } from "../mongodb/store/users";

export type OrchestrationContext = Awaited<ReturnType<typeof loadOrchestrationContext>>;

export async function loadOrchestrationContext(userId: number, planDate: string) {
  await ensureLifeAdminSetup(userId);

  const since = addDaysIsoYyyyMmDd(planDate, -7);
  const yesterday = addDaysIsoYyyyMmDd(planDate, -1);
  const [pillars, goals, milestones, tasks, routines, yesterdayLayout] =
    await Promise.all([
      listPillars(userId),
      listGoals(userId),
      listMilestones(userId),
      listTasks(userId),
      listActiveRoutines(userId),
      getMissionLayout(userId, yesterday),
    ]);

  const openTasks = tasks.filter((t) => !t.completed_at);
  const completedRecent = tasks.filter((t) => {
    if (!t.completed_at) return false;
    const d = String(t.completed_at).slice(0, 10);
    return d >= since && d <= planDate;
  });

  return {
    since,
    planDate,
    yesterday,
    pillars,
    goals,
    milestones: milestones.filter((m) => !m.completed_at),
    allTasks: tasks,
    openTasks,
    completedRecent,
    routines,
    yesterdayLayout,
  };
}

function toLifeAdminTaskRow(t: {
  id: unknown;
  title: unknown;
  deadline: unknown;
  pillar_id?: unknown;
  completed_at?: unknown;
  created_at?: unknown;
}) {
  return {
    id: Number(t.id),
    title: String(t.title),
    deadline: t.deadline ? String(t.deadline) : null,
    pillar_id: normalizeTaskPillarId(t.pillar_id),
    completed_at: t.completed_at ? String(t.completed_at) : null,
    created_at: t.created_at ? String(t.created_at) : null,
  };
}

function formatTaskLine(t: {
  id: unknown;
  title: unknown;
  deadline: unknown;
  schedule_type?: unknown;
  date_locked?: unknown;
  milestone_id?: unknown;
}) {
  const locked = Number(t.date_locked) === 1 ? " date_locked=true" : "";
  const schedule = t.schedule_type ? ` schedule=${t.schedule_type}` : "";
  return `- id=${t.id} title="${t.title}" deadline=${t.deadline ?? "none"}${schedule}${locked}`;
}

export function buildPillarSpecialistPrompt(
  ctx: OrchestrationContext,
  pillar: { id: unknown; name: unknown; rank: unknown },
  mode: "check_in" | "prioritize",
  brainDump?: string
) {
  const pillarId = Number(pillar.id);
  const pillarTasks = ctx.openTasks.filter((t) => Number(t.pillar_id) === pillarId);
  const pillarRoutines = ctx.routines.filter(
    (r) => Number(r.pillarId) === pillarId
  );
  const pillarGoals = ctx.goals.filter((g) => Number(g.pillar_id) === pillarId);
  const pillarMilestones = ctx.milestones.filter(
    (m) => Number(m.pillar_id) === pillarId
  );
  const pillarCompletions = ctx.completedRecent.filter(
    (t) => Number(t.pillar_id) === pillarId
  );

  const brainDumpBlock =
    mode === "check_in" && brainDump?.trim()
      ? `\nUSER BRAIN DUMP (extract new tasks for this pillar only if mentioned):\n${brainDump.trim()}`
      : "";

  const pillarContext = formatPillarContextForPrompt(
    (pillar as { description?: string | null }).description
  );
  const contextBlock = pillarContext
    ? `\nPILLAR CONTEXT (resolve shorthand like project nicknames against this):\n${pillarContext}`
    : "";

  return `Planning date: ${ctx.planDate}
Pillar: ${pillar.name} (id=${pillar.id}, rank=${pillar.rank})
${contextBlock}

GOALS:
${pillarGoals.map((g) => `- ${g.title} status=${g.status}`).join("\n") || "(none)"}

MILESTONES:
${pillarMilestones.map((m) => `- id=${m.id} ${m.title} target=${m.target_date ?? "none"}`).join("\n") || "(none)"}

ROUTINES (weekly habits — spread across the week, avoid back-to-back overload):
${pillarRoutines.map((r) => `- id=${r.tursoId} ${r.title} target=${r.targetFrequency}/week kind=${r.kind}`).join("\n") || "(none)"}

OPEN TASKS:
${pillarTasks.map(formatTaskLine).join("\n") || "(none)"}

COMPLETIONS (last 7 days):
${pillarCompletions.map((t) => `- ${String(t.completed_at).slice(0, 10)}: ${t.title}`).join("\n") || "(none)"}
${brainDumpBlock}`;
}

export function buildLifeSynthesisPrompt(
  ctx: OrchestrationContext,
  pillarReports: { pillarName: string; pillarRank: number; report: string }[],
  mode: "check_in" | "prioritize",
  openTaskIds: number[] = []
) {
  const pillarRankList = ctx.pillars
    .map((p) => {
      const context = formatPillarContextForPrompt(p.description);
      const contextNote = context
        ? ` — context: ${context.split("\n")[0]?.slice(0, 120) ?? context}`
        : "";
      return `- rank=${p.rank} ${p.name} (id=${p.id})${contextNote}`;
    })
    .join("\n");

  const allTaskIds =
    openTaskIds.length > 0
      ? openTaskIds.join(", ")
      : ctx.openTasks.map((t) => t.id).join(", ");

  const reportsBlock = pillarReports
    .map(
      (r) =>
        `### ${r.pillarName} (rank ${r.pillarRank})\n${r.report}`
    )
    .join("\n\n");

  return `Planning date: ${ctx.planDate}
Mode: ${mode === "check_in" ? "check-in (may include new tasks)" : "prioritize (existing tasks only)"}

${buildDayCoachingBlock(ctx)}

ALL OPEN TASK IDS (each must appear exactly once in today, this_week, or later):
[${allTaskIds || "none"}]

PILLAR RANKING (lower rank = higher priority):
${pillarRankList}

PILLAR SPECIALIST REPORTS (JSON only):
${reportsBlock}`;
}

function formatPillarBlock(
  ctx: OrchestrationContext,
  pillar: { id: unknown; name: unknown; rank: unknown; description?: string | null }
) {
  const pillarId = Number(pillar.id);
  const pillarTasks = ctx.openTasks.filter((t) => Number(t.pillar_id) === pillarId);
  const pillarRoutines = ctx.routines.filter((r) => Number(r.pillarId) === pillarId);
  const pillarGoals = ctx.goals.filter((g) => Number(g.pillar_id) === pillarId);
  const pillarMilestones = ctx.milestones.filter(
    (m) => Number(m.pillar_id) === pillarId
  );
  const pillarCompletions = ctx.completedRecent.filter(
    (t) => Number(t.pillar_id) === pillarId
  );
  const pillarContext = formatPillarContextForPrompt(pillar.description);

  return `### ${pillar.name} (rank ${pillar.rank}, id=${pillar.id})
Context: ${pillarContext ? pillarContext.replace(/\n/g, " | ") : "(none)"}
Goals: ${pillarGoals.map((g) => g.title).join("; ") || "(none)"}
Milestones: ${pillarMilestones.map((m) => `${m.title} (${m.target_date ?? "no date"})`).join("; ") || "(none)"}
Routines: ${pillarRoutines.map((r) => `${r.title} ${r.targetFrequency}/wk`).join("; ") || "(none)"}
Open tasks:
${pillarTasks.map(formatTaskLine).join("\n") || "(none)"}
Recent completions: ${pillarCompletions.map((t) => t.title).join("; ") || "(none)"}`;
}

function normalizeTaskPillarId(pillarId: unknown): number | null {
  if (pillarId == null) return null;
  const id = Number(pillarId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function pillarNameById(
  pillars: { id: unknown; name: unknown }[],
  pillarId: number | null | undefined
) {
  if (pillarId == null) return "General";
  const match = pillars.find((p) => Number(p.id) === pillarId);
  return match ? String(match.name) : "General";
}

function buildDayCoachingBlock(ctx: OrchestrationContext) {
  const openById = new Map(ctx.openTasks.map((t) => [Number(t.id), t]));
  const rolledOver = new Map<string, number>();

  for (const task of ctx.openTasks) {
    const deadline = task.deadline ? String(task.deadline) : null;
    if (deadline && deadline < ctx.planDate) {
      const pillar = pillarNameById(ctx.pillars, Number(task.pillar_id));
      rolledOver.set(pillar, (rolledOver.get(pillar) ?? 0) + 1);
    }
  }

  for (const ref of ctx.yesterdayLayout?.today ?? []) {
    if (ref.kind !== "task") continue;
    const task = openById.get(ref.id);
    if (!task) continue;
    const pillar = pillarNameById(ctx.pillars, Number(task.pillar_id));
    rolledOver.set(pillar, (rolledOver.get(pillar) ?? 0) + 1);
  }

  const rolledLines =
    rolledOver.size > 0
      ? [...rolledOver.entries()]
          .map(([pillar, count]) => `- ${pillar}: ${count} item(s) carried over`)
          .join("\n")
      : "(none)";

  const momentumSince = addDaysIsoYyyyMmDd(ctx.planDate, -3);
  const momentumByPillar = new Map<string, number>();
  for (const task of ctx.completedRecent) {
    const completedOn = String(task.completed_at).slice(0, 10);
    if (completedOn < momentumSince || completedOn > ctx.planDate) continue;
    const pillar = pillarNameById(ctx.pillars, Number(task.pillar_id));
    momentumByPillar.set(pillar, (momentumByPillar.get(pillar) ?? 0) + 1);
  }

  const momentumLines =
    [...momentumByPillar.entries()]
      .filter(([, count]) => count >= 2)
      .map(([pillar, count]) => `- ${pillar}: ${count} completions in last 3 days`)
      .join("\n") || "(none)";

  return `DAY COACHING (use for tone in kickoff/rest_of_day — do not copy verbatim as task lists):
Rolled over / unfinished from before today:
${rolledLines}

Momentum (recent wins — acknowledge briefly if present):
${momentumLines}

${formatLifeAdminBlock(
  computeLifeAdminStats({
    allTasks: ctx.allTasks.map(toLifeAdminTaskRow),
    pillars: ctx.pillars.map((p) => ({
      id: Number(p.id),
      name: String(p.name),
    })),
    planDate: ctx.planDate,
  })
)}`;
}

/** Single-call context for prioritize — avoids N pillar API requests. */
export function buildDirectPrioritizePrompt(
  ctx: OrchestrationContext,
  openTaskIds: number[]
) {
  const pillarRankList = ctx.pillars
    .map((p) => {
      const context = formatPillarContextForPrompt(p.description);
      const contextNote = context
        ? ` — context: ${context.split("\n")[0]?.slice(0, 120) ?? context}`
        : "";
      return `- rank=${p.rank} ${p.name} (id=${p.id})${contextNote}`;
    })
    .join("\n");

  const pillarBlocks = ctx.pillars
    .map((p) => formatPillarBlock(ctx, p))
    .join("\n\n");

  const miscTasks = ctx.openTasks.filter(
    (t) => normalizeTaskPillarId(t.pillar_id) == null
  );
  const miscBlock =
    miscTasks.length > 0
      ? `### Life Admin (unassigned tasks — no pillar_id)
Open tasks:
${miscTasks.map(formatTaskLine).join("\n")}`
      : "";

  const allTaskIds = openTaskIds.join(", ");

  return `Planning date: ${ctx.planDate}
Mode: prioritize (existing tasks only — no new tasks)

${buildDayCoachingBlock(ctx)}

ALL OPEN TASK IDS (each must appear exactly once in today, this_week, or later):
[${allTaskIds || "none"}]

PILLAR RANKING (lower rank = higher priority):
${pillarRankList}

PILLAR CONTEXT:
${pillarBlocks}${miscBlock ? `\n\n${miscBlock}` : ""}`;
}

/** Single-call context for check-in — brain dump + board in one synthesis request. */
export function buildDirectCheckInPrompt(
  ctx: OrchestrationContext,
  openTaskIds: number[],
  brainDump: string
) {
  const base = buildDirectPrioritizePrompt(ctx, openTaskIds);
  return base.replace(
    "Mode: prioritize (existing tasks only — no new tasks)",
    `Mode: check-in (re-prioritize board + extract new tasks from brain dump)

USER BRAIN DUMP (resolve shorthand using pillar context; dedupe against existing tasks):
${brainDump.trim()}`
  );
}
