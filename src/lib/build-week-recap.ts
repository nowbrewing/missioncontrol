import {
  combineEntryText,
  groupEntriesByKind,
  listDailyLogEntriesInRange,
  type DailyLogEntry,
} from "./daily-log-entries";
import { dateInRange } from "./reflection-week";
import { loadRecurringWeekSnapshot } from "./recurring-events";
import type { RecurringWeekItem } from "./recurring-events";
import { listTasks } from "./mongodb/store/tasks";
import { listPillars } from "./mongodb/store/users";

export type WeekRecapTask = {
  id: number;
  title: string;
  pillar: string;
  pillar_id: number | null;
  deadline: string | null;
  completed_at: string | null;
  recurring_event_id: number | null;
  recurring_week_monday: string | null;
};

export type WeekRecapPillarLogs = {
  went_well: string[];
  went_poorly: string[];
  daily_focus: string[];
};

export type WeekRecapPillar = {
  id: number;
  name: string;
  rank: number;
  scheduled: WeekRecapTask[];
  completed: WeekRecapTask[];
  missed: WeekRecapTask[];
  logs: WeekRecapPillarLogs;
};

export type WeekRecap = {
  week_monday: string;
  week_end: string;
  routines: RecurringWeekItem[];
  pillars: WeekRecapPillar[];
  /** Tasks and log lines not tied to a specific pillar */
  general: {
    scheduled: WeekRecapTask[];
    completed: WeekRecapTask[];
    missed: WeekRecapTask[];
    logs: WeekRecapPillarLogs;
  };
  scheduled: WeekRecapTask[];
  completed: WeekRecapTask[];
  missed: WeekRecapTask[];
  daily_logs: {
    went_well: string | null;
    went_poorly: string | null;
    daily_focus: string | null;
  };
};

function emptyPillarLogs(): WeekRecapPillarLogs {
  return { went_well: [], went_poorly: [], daily_focus: [] };
}

function tasksForPillar(tasks: WeekRecapTask[], pillarId: number): WeekRecapTask[] {
  return tasks.filter((t) => t.pillar_id === pillarId);
}

function distributeLogEntry(
  entry: DailyLogEntry,
  pillarLogs: Map<number, WeekRecapPillarLogs>,
  generalLogs: WeekRecapPillarLogs
) {
  const line = `[${entry.log_date}] ${entry.content}`;
  const kind = entry.kind;
  if (kind !== "went_well" && kind !== "went_poorly" && kind !== "daily_focus") return;

  const targets =
    entry.pillar_ids.length > 0 ? entry.pillar_ids : ([null] as (number | null)[]);

  for (const pillarId of targets) {
    const bucket =
      pillarId == null ? generalLogs : (pillarLogs.get(pillarId) ?? emptyPillarLogs());
    if (pillarId != null && !pillarLogs.has(pillarId)) {
      pillarLogs.set(pillarId, bucket);
    }
    bucket[kind].push(line);
  }
}

function pillarHadActivity(pillar: WeekRecapPillar): boolean {
  return (
    pillar.scheduled.length > 0 ||
    pillar.completed.length > 0 ||
    pillar.missed.length > 0 ||
    pillar.logs.went_well.length > 0 ||
    pillar.logs.went_poorly.length > 0 ||
    pillar.logs.daily_focus.length > 0
  );
}

export function pillarsWithActivity(recap: WeekRecap): WeekRecapPillar[] {
  return recap.pillars.filter(pillarHadActivity);
}

export function quietPillars(recap: WeekRecap): WeekRecapPillar[] {
  return recap.pillars.filter((p) => !pillarHadActivity(p));
}

export { pillarHadActivity };

function taskDatePart(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

type TaskScheduleFields = {
  deadline: string | null;
  window_start: string | null;
  recurring_week_monday: string | null;
  completed_at: string | null;
};

function wasScheduledForWeek(
  task: TaskScheduleFields,
  weekMonday: string,
  weekEnd: string
): boolean {
  if (task.recurring_week_monday === weekMonday) return true;

  const deadline = task.deadline ? String(task.deadline).slice(0, 10) : null;
  if (deadline && dateInRange(deadline, weekMonday, weekEnd)) return true;

  const windowStart = task.window_start ? String(task.window_start).slice(0, 10) : null;
  if (windowStart && deadline) {
    if (windowStart <= weekEnd && deadline >= weekMonday) return true;
  }

  return false;
}

function wasCompletedInWeek(completedAt: string | null, weekMonday: string, weekEnd: string) {
  const completed = taskDatePart(completedAt);
  return completed != null && dateInRange(completed, weekMonday, weekEnd);
}

function wasMissed(task: TaskScheduleFields, weekMonday: string, weekEnd: string): boolean {
  if (!wasScheduledForWeek(task, weekMonday, weekEnd)) return false;

  const completed = taskDatePart(task.completed_at);
  if (!completed) return true;
  return completed > weekEnd;
}

export async function buildWeekRecap(
  userId: number,
  weekMonday: string,
  weekEnd: string
): Promise<WeekRecap> {
  const [tasks, pillars, logEntries, routines] = await Promise.all([
    listTasks(userId),
    listPillars(userId),
    listDailyLogEntriesInRange(userId, weekMonday, weekEnd),
    loadRecurringWeekSnapshot(userId, weekMonday),
  ]);

  const pillarName = new Map(pillars.map((p) => [Number(p.id), String(p.name)]));

  const toRecapTask = (t: (typeof tasks)[number]): WeekRecapTask => ({
    id: Number(t.id),
    title: String(t.title),
    pillar: t.pillar_id != null ? pillarName.get(Number(t.pillar_id)) ?? "Unassigned" : "Unassigned",
    pillar_id: t.pillar_id != null ? Number(t.pillar_id) : null,
    deadline: t.deadline ? String(t.deadline).slice(0, 10) : null,
    completed_at: t.completed_at,
    recurring_event_id:
      t.recurring_event_id != null ? Number(t.recurring_event_id) : null,
    recurring_week_monday: t.recurring_week_monday
      ? String(t.recurring_week_monday).slice(0, 10)
      : null,
  });

  const scheduled: WeekRecapTask[] = [];
  const completed: WeekRecapTask[] = [];
  const missed: WeekRecapTask[] = [];

  for (const task of tasks) {
    const recap = toRecapTask(task);
    const inWeek = wasScheduledForWeek(task, weekMonday, weekEnd);
    const doneInWeek = wasCompletedInWeek(task.completed_at, weekMonday, weekEnd);

    if (doneInWeek) {
      completed.push(recap);
    }
    if (inWeek) {
      scheduled.push(recap);
      if (wasMissed(task, weekMonday, weekEnd)) {
        missed.push(recap);
      }
    }
  }

  const byKind = groupEntriesByKind(logEntries);

  const generalLogs = emptyPillarLogs();
  const pillarLogMap = new Map<number, WeekRecapPillarLogs>();
  for (const entry of logEntries) {
    distributeLogEntry(entry, pillarLogMap, generalLogs);
  }

  const sortedPillars = [...pillars].sort((a, b) => a.rank - b.rank);
  const pillarRecaps: WeekRecapPillar[] = sortedPillars.map((p) => {
    const id = Number(p.id);
    return {
      id,
      name: String(p.name),
      rank: Number(p.rank),
      scheduled: tasksForPillar(scheduled, id),
      completed: tasksForPillar(completed, id),
      missed: tasksForPillar(missed, id),
      logs: pillarLogMap.get(id) ?? emptyPillarLogs(),
    };
  });

  const general = {
    scheduled: scheduled.filter((t) => t.pillar_id == null),
    completed: completed.filter((t) => t.pillar_id == null),
    missed: missed.filter((t) => t.pillar_id == null),
    logs: generalLogs,
  };

  return {
    week_monday: weekMonday,
    week_end: weekEnd,
    routines,
    pillars: pillarRecaps,
    general,
    scheduled,
    completed,
    missed,
    daily_logs: {
      went_well: combineEntryText(byKind.went_well) || null,
      went_poorly: combineEntryText(byKind.went_poorly) || null,
      daily_focus: combineEntryText(byKind.daily_focus) || null,
    },
  };
}

/** Narrow a full week recap to one pillar (for Journal pillar mode). */
export function filterWeekRecapToPillar(recap: WeekRecap, pillarId: number): WeekRecap {
  const pillar = recap.pillars.find((p) => p.id === pillarId);
  const pillars = pillar ? [pillar] : [];
  const routines = recap.routines.filter((r) => r.pillar_id === pillarId);
  const scheduled = pillar?.scheduled ?? [];
  const completed = pillar?.completed ?? [];
  const missed = pillar?.missed ?? [];

  return {
    ...recap,
    pillars,
    routines,
    scheduled,
    completed,
    missed,
    general: {
      scheduled: [],
      completed: [],
      missed: [],
      logs: emptyPillarLogs(),
    },
    daily_logs: {
      went_well: pillar?.logs.went_well.join("\n") || null,
      went_poorly: pillar?.logs.went_poorly.join("\n") || null,
      daily_focus: pillar?.logs.daily_focus.join("\n") || null,
    },
  };
}

