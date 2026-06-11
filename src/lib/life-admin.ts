import { addDaysIsoYyyyMmDd } from "./date";
import { weekMondayFor } from "./recurring-week";
import type { OrchestrationLayout } from "./adk/parse-orchestration-result";

export const LIFE_ADMIN_PILLAR_NAME = "Life Admin";
export const LIFE_ADMIN_ROUTINE_TITLE = "Life admin";

const LIFE_ADMIN_PILLAR_ALIASES = new Set([
  "life admin",
  "life admin / misc",
  "misc",
  "miscellaneous",
  "general",
]);

export type LifeAdminTaskRow = {
  id: number;
  title: string;
  deadline: string | null;
  pillar_id?: number | null;
  completed_at?: string | null;
  created_at?: string | null;
};

export type LifeAdminPillarRow = {
  id: number;
  name: string;
};

export type LifeAdminPace = "finding_pace" | "ahead" | "steady" | "idle";

export type LifeAdminStats = {
  openCount: number;
  completedThisWeek: number;
  addedThisWeek: number;
  completedToday: number;
  netThisWeek: number;
  pace: LifeAdminPace;
  paceHint: string | null;
  shouldPlaceOneToday: boolean;
  suggestedTaskId: number | null;
  nudgeText: string | null;
};

export function deriveLifeAdminPace(stats: {
  openCount: number;
  completedThisWeek: number;
  addedThisWeek: number;
  netThisWeek: number;
}): LifeAdminPace {
  if (stats.addedThisWeek === 0 && stats.completedThisWeek === 0) {
    return stats.openCount > 0 ? "idle" : "idle";
  }
  if (stats.netThisWeek > 0) return "ahead";
  if (stats.netThisWeek === 0 && stats.completedThisWeek > 0) return "steady";
  // More captured than cleared — normal while ramping up on the tracker
  return "finding_pace";
}

export function lifeAdminPaceHint(pace: LifeAdminPace): string | null {
  switch (pace) {
    case "finding_pace":
      return "Backlog may grow as you capture more — one small clear a day helps you find your pace.";
    case "ahead":
      return "You're clearing faster than you're adding. Nice rhythm.";
    case "steady":
      return "Adding and clearing are balanced this week.";
    case "idle":
      return null;
  }
}

export function lifeAdminNetLabel(pace: LifeAdminPace, netThisWeek: number): string {
  if (pace === "finding_pace") return "finding pace";
  if (netThisWeek > 0) return `${netThisWeek} ahead`;
  if (netThisWeek < 0) return `${Math.abs(netThisWeek)} behind`;
  return "even";
}

export function isLifeAdminRoutineTitle(title: string): boolean {
  const lower = title.trim().toLowerCase();
  return (
    lower === LIFE_ADMIN_ROUTINE_TITLE.toLowerCase() ||
    lower.includes("life admin")
  );
}

export function isLifeAdminPillarName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return (
    lower === LIFE_ADMIN_PILLAR_NAME.toLowerCase() ||
    LIFE_ADMIN_PILLAR_ALIASES.has(lower) ||
    lower.includes("life admin")
  );
}

export function findLifeAdminPillar(
  pillars: LifeAdminPillarRow[]
): LifeAdminPillarRow | null {
  return pillars.find((p) => isLifeAdminPillarName(String(p.name))) ?? null;
}

export type PillarDisplayRow = {
  id: number;
  name: string;
  abbreviation?: string | null;
  color?: string | null;
};

/** Null pillar_id tasks belong in the Life Admin pillar group. */
export function taskBelongsToPillarGroup(
  task: { pillar_id?: number | null },
  pillar: { id: number; name: string }
): boolean {
  if (task.pillar_id != null && Number(task.pillar_id) === Number(pillar.id)) {
    return true;
  }
  return task.pillar_id == null && isLifeAdminPillarName(pillar.name);
}

export function enrichTaskPillarDisplay(
  pillarId: number | null | undefined,
  pillars: PillarDisplayRow[],
  resolveAbbreviation: (name: string, abbreviation?: string | null) => string
): {
  pillar_name: string;
  pillar_abbreviation: string;
  pillar_color: string;
} {
  if (pillarId != null) {
    const pillar = pillars.find((p) => Number(p.id) === Number(pillarId));
    if (pillar) {
      return {
        pillar_name: String(pillar.name),
        pillar_abbreviation: resolveAbbreviation(
          String(pillar.name),
          pillar.abbreviation
        ),
        pillar_color: String(pillar.color ?? "#D87093"),
      };
    }
  }

  const lifeAdmin = pillars.find((p) => isLifeAdminPillarName(String(p.name)));
  if (lifeAdmin) {
    return {
      pillar_name: String(lifeAdmin.name),
      pillar_abbreviation: resolveAbbreviation(
        String(lifeAdmin.name),
        lifeAdmin.abbreviation
      ),
      pillar_color: String(lifeAdmin.color ?? "#D87093"),
    };
  }

  return {
    pillar_name: LIFE_ADMIN_PILLAR_NAME,
    pillar_abbreviation: "ADMIN",
    pillar_color: "#D87093",
  };
}

export function selectablePillars<T extends { name: string }>(pillars: T[]): T[] {
  return pillars.filter((p) => !isLifeAdminPillarName(String(p.name)));
}

/** Unpillared tasks and Life Admin pillar tasks count as miscellaneous life admin. */
export function isLifeAdminTask(
  task: { pillar_id?: number | null | unknown },
  pillars: LifeAdminPillarRow[]
): boolean {
  const pillarId = task.pillar_id;
  if (pillarId == null || pillarId === "") return true;
  const id = Number(pillarId);
  if (!Number.isFinite(id) || id <= 0) return true;
  const pillar = pillars.find((p) => Number(p.id) === id);
  if (!pillar) return true;
  return isLifeAdminPillarName(String(pillar.name));
}

function taskCreatedOn(task: LifeAdminTaskRow): string | null {
  if (!task.created_at) return null;
  return String(task.created_at).slice(0, 10);
}

function taskCompletedOn(task: LifeAdminTaskRow): string | null {
  if (!task.completed_at) return null;
  return String(task.completed_at).slice(0, 10);
}

function inWeekRange(date: string, weekMonday: string, planDate: string) {
  return date >= weekMonday && date <= planDate;
}

export function computeLifeAdminStats(params: {
  allTasks: LifeAdminTaskRow[];
  pillars: LifeAdminPillarRow[];
  planDate: string;
  todayTaskIds?: number[];
}): LifeAdminStats {
  const { allTasks, pillars, planDate, todayTaskIds = [] } = params;

  const weekMonday = weekMondayFor(planDate);
  const lifeAdminTasks = allTasks.filter((t) => isLifeAdminTask(t, pillars));
  const openLifeAdmin = lifeAdminTasks.filter((t) => !taskCompletedOn(t));

  let completedThisWeek = 0;
  let addedThisWeek = 0;
  let completedToday = 0;

  for (const task of lifeAdminTasks) {
    const createdOn = taskCreatedOn(task);
    if (createdOn && inWeekRange(createdOn, weekMonday, planDate)) {
      addedThisWeek += 1;
    }

    const completedOn = taskCompletedOn(task);
    if (!completedOn || !inWeekRange(completedOn, weekMonday, planDate)) continue;
    completedThisWeek += 1;
    if (completedOn === planDate) completedToday += 1;
  }

  const netThisWeek = completedThisWeek - addedThisWeek;

  const alreadyOnToday = openLifeAdmin.some((t) =>
    todayTaskIds.includes(Number(t.id))
  );

  const shouldPlaceOneToday =
    openLifeAdmin.length > 0 && completedToday === 0 && !alreadyOnToday;

  const suggestedTaskId = shouldPlaceOneToday
    ? pickLifeAdminTaskId(openLifeAdmin)
    : null;

  const pace = deriveLifeAdminPace({
    openCount: openLifeAdmin.length,
    completedThisWeek,
    addedThisWeek,
    netThisWeek,
  });
  const paceHint = lifeAdminPaceHint(pace);

  let nudgeText: string | null = null;
  if (openLifeAdmin.length > 0 && completedToday === 0) {
    if (pace === "finding_pace") {
      nudgeText =
        "You're capturing more life stuff as you use the tracker — a growing list is normal. One small errand today helps you find a steady pace.";
    } else if (pace === "ahead") {
      nudgeText =
        "You're clearing more than you're adding — keep that rhythm with one more if you have a gap.";
    } else if (pace === "steady") {
      nudgeText =
        "Life admin is moving at a steady clip — one more small win today keeps the pace.";
    } else if (completedThisWeek === 0 && openLifeAdmin.length > 0) {
      nudgeText =
        "There's life admin waiting — one small errand today is enough to start finding your pace.";
    }
  }

  return {
    openCount: openLifeAdmin.length,
    completedThisWeek,
    addedThisWeek,
    completedToday,
    netThisWeek,
    pace,
    paceHint,
    shouldPlaceOneToday,
    suggestedTaskId,
    nudgeText,
  };
}

function pickLifeAdminTaskId(tasks: LifeAdminTaskRow[]): number | null {
  if (tasks.length === 0) return null;
  const sorted = [...tasks].sort((a, b) => {
    const dateA = a.deadline ?? "9999-12-31";
    const dateB = b.deadline ?? "9999-12-31";
    const byDate = dateA.localeCompare(dateB);
    if (byDate !== 0) return byDate;
    return a.title.localeCompare(b.title);
  });
  return Number(sorted[0].id);
}

export function applyLifeAdminToLayout(
  layout: OrchestrationLayout,
  stats: LifeAdminStats
): OrchestrationLayout {
  if (!stats.shouldPlaceOneToday || stats.suggestedTaskId == null) {
    return layout;
  }

  const id = stats.suggestedTaskId;
  const today = layout.today.includes(id) ? layout.today : [...layout.today, id];
  const this_week = layout.this_week.filter((taskId) => taskId !== id);
  const later = layout.later.filter((taskId) => taskId !== id);

  return { today, this_week, later };
}

export function formatLifeAdminBlock(stats: LifeAdminStats): string {
  const status =
    stats.openCount === 0
      ? "No open life-admin tasks."
      : `${stats.openCount} open; ${stats.completedThisWeek} cleared this week; ${stats.addedThisWeek} added this week (net ${stats.netThisWeek >= 0 ? "+" : ""}${stats.netThisWeek}); ${stats.completedToday} cleared today.`;

  const placement = stats.shouldPlaceOneToday
    ? `Place exactly one life-admin task (id=${stats.suggestedTaskId}) in today if not already there. No weekly cap — steady progress matters.`
    : stats.completedToday > 0
      ? "Already cleared life admin today — no forced placement."
      : "No forced placement today.";

  const nudge = stats.nudgeText
    ? `Gentle nudge for day guide (do not list task names): ${stats.nudgeText}`
    : "No life-admin nudge needed.";

  const rampNote =
    stats.pace === "finding_pace"
      ? "User is likely ramping up on the tracker — backlog growing (more added than cleared) is EXPECTED while they capture existing errands. Goal is finding a sustainable pace (~1 small task/day), NOT clearing the whole list quickly. Never shame a growing backlog."
      : stats.pace === "ahead"
        ? "User is ahead on life admin this week — acknowledge lightly, no pressure to add more."
        : "";

  return `LIFE ADMIN (misc errands — no weekly cap; track added vs cleared):
${status}
Pace: ${stats.pace}${stats.paceHint ? ` — ${stats.paceHint}` : ""}
${rampNote}
${placement}
${nudge}`;
}

export function formatLifeAdminCounterLabel(stats: LifeAdminStats): string {
  if (stats.openCount === 0 && stats.completedThisWeek === 0) {
    return "Life admin: nothing on the list";
  }

  return `Life admin · ${stats.openCount} open · ${stats.completedThisWeek} completed this week`;
}

export function weekDatesContaining(planDate: string) {
  const weekMonday = weekMondayFor(planDate);
  return { weekMonday, weekEnd: addDaysIsoYyyyMmDd(weekMonday, 6) };
}
