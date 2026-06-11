import { addDaysIsoYyyyMmDd, todayIsoYyyyMmDd } from "./date";
import { resolvePillarAbbreviation } from "./pillar-abbreviation";
import { isRunTask } from "./workout-schedule";
import {
  dailyTallyTotal,
  parseDailyDays,
  serializeDailyDays,
  weekDatesFromMonday,
  weekMondayFor,
  type RecurringKind,
  type RecurringProgress,
} from "./recurring-week";
import { listMilestones } from "./mongodb/store/milestones";
import {
  getMaxTaskRank,
  insertTask,
  listTasksByRecurring,
  normalizeRecurringTaskSchedules,
  updateTask,
} from "./mongodb/store/tasks";
import {
  getOrCreateRoutineProgress,
  listActiveRoutines,
  markRoutineTasksSpawned,
  updateRoutineProgress,
} from "./mongodb/store/routines";
import type { MongoRoutine } from "./mongodb/schemas";
import { listPillars } from "./mongodb/store/users";

export type RecurringEventRow = {
  id: number;
  user_id: number;
  title: string;
  kind: RecurringKind;
  target_count: number;
  daily_days: string | null;
  tally_enabled: number;
  pillar_id: number | null;
  milestone_id: number | null;
  spawn_task_cards: number;
  active: number;
  rank: number;
  created_at: string;
};

export type RecurringWeekItem = {
  event_id: number;
  progress_id: number;
  title: string;
  kind: RecurringKind;
  target_count: number;
  daily_days: ReturnType<typeof parseDailyDays>;
  tally_enabled: boolean;
  pillar_id: number | null;
  milestone_id: number | null;
  pillar_name: string | null;
  pillar_color: string | null;
  pillar_abbreviation: string | null;
  milestone_title: string | null;
  spawn_task_cards: boolean;
  week_monday: string;
  week_dates: string[];
  progress: RecurringProgress;
  tasks_spawned: boolean;
};

function routineToEventRow(r: MongoRoutine): RecurringEventRow {
  return {
    id: r.tursoId,
    user_id: r.tursoUserId,
    title: r.title,
    kind: r.kind,
    target_count: r.targetFrequency,
    daily_days: serializeDailyDays(r.dailyDays as ReturnType<typeof parseDailyDays>),
    tally_enabled: r.tallyEnabled ? 1 : 0,
    pillar_id: r.pillarId,
    milestone_id: r.milestoneId,
    spawn_task_cards: r.spawnTaskCards ? 1 : 0,
    active: r.active ? 1 : 0,
    rank: r.rank,
    created_at: r.createdAt.toISOString().replace("T", " ").slice(0, 19),
  };
}

function weekEnd(weekMonday: string): string {
  return addDaysIsoYyyyMmDd(weekMonday, 6);
}

function tallyTaskDescription(total: number, targetCount: number): string {
  if (targetCount > 0) return `${total} / ${targetCount} this week`;
  return `Week total: ${total}`;
}

async function spawnWeeklyTasks(
  userId: number,
  event: RecurringEventRow,
  weekMonday: string,
  progressId: number
) {
  const weekDates = weekDatesFromMonday(weekMonday);
  const dailyDays = parseDailyDays(event.daily_days);
  const end = weekEnd(weekMonday);
  const tally = !!event.tally_enabled;

  let nextRank = (await getMaxTaskRank(userId)) + 1;

  if (event.kind === "daily" && tally) {
    await insertTask(userId, {
      title: event.title,
      description: tallyTaskDescription(0, event.target_count),
      deadline: end,
      rank: nextRank++,
      pillarId: event.pillar_id,
      milestoneId: event.milestone_id,
      scheduleType: "window",
      recurringEventId: event.id,
      recurringWeekMonday: weekMonday,
      recurringSlot: "tally",
    });
  } else if (event.kind === "daily") {
    for (let i = 0; i < 7; i++) {
      if (!dailyDays[i]) continue;
      await insertTask(userId, {
        title: event.title,
        deadline: weekDates[i],
        rank: nextRank++,
        pillarId: event.pillar_id,
        milestoneId: event.milestone_id,
        scheduleType: "fixed",
        recurringEventId: event.id,
        recurringWeekMonday: weekMonday,
        recurringSlot: weekDates[i],
      });
    }
  } else if (event.kind === "count") {
    const occupied = new Set<string>();
    for (let i = 0; i < event.target_count; i++) {
      let deadline = addDaysIsoYyyyMmDd(weekMonday, i);
      if (isRunTask(event.title)) {
        while (occupied.has(deadline) && deadline <= end) {
          deadline = addDaysIsoYyyyMmDd(deadline, 1);
        }
        occupied.add(deadline);
      } else {
        const step = Math.max(1, Math.floor(7 / event.target_count));
        deadline = addDaysIsoYyyyMmDd(weekMonday, Math.min(i * step, 6));
      }
      if (deadline > end) deadline = end;

      await insertTask(userId, {
        title: `${event.title} (${i + 1}/${event.target_count})`,
        deadline,
        rank: nextRank++,
        pillarId: event.pillar_id,
        milestoneId: event.milestone_id,
        scheduleType: "fixed",
        recurringEventId: event.id,
        recurringWeekMonday: weekMonday,
        recurringSlot: String(i),
      });
    }
  }

  await markRoutineTasksSpawned(userId, progressId);
}

export async function ensureRecurringWeek(
  userId: number,
  today = todayIsoYyyyMmDd()
): Promise<{ week_monday: string; items: RecurringWeekItem[] }> {
  await normalizeRecurringTaskSchedules(userId);
  const weekMonday = weekMondayFor(today);
  const weekDates = weekDatesFromMonday(weekMonday);

  const events = await listActiveRoutines(userId);
  const [pillars, milestones] = await Promise.all([
    listPillars(userId),
    listMilestones(userId),
  ]);

  const pillarById = new Map(pillars.map((p) => [Number(p.id), p]));
  const milestoneById = new Map(milestones.map((m) => [Number(m.id), m]));

  const items: RecurringWeekItem[] = [];

  for (const event of events) {
    const row = routineToEventRow(event);
    const tallyEnabled = !!event.tallyEnabled;

    const pr = await getOrCreateRoutineProgress(
      userId,
      event.tursoId,
      weekMonday,
      event.kind,
      event.targetFrequency,
      tallyEnabled
    );

    if (event.spawnTaskCards && !pr.tasks_spawned) {
      await spawnWeeklyTasks(userId, row, weekMonday, pr.progress_id);
    }

    const pillar = event.pillarId ? pillarById.get(event.pillarId) : null;
    const milestone = event.milestoneId ? milestoneById.get(event.milestoneId) : null;

    items.push({
      event_id: event.tursoId,
      progress_id: pr.progress_id,
      title: event.title,
      kind: event.kind,
      target_count: event.targetFrequency,
      daily_days: parseDailyDays(serializeDailyDays(event.dailyDays as ReturnType<typeof parseDailyDays>)),
      tally_enabled: tallyEnabled,
      pillar_id: event.pillarId,
      milestone_id: event.milestoneId,
      pillar_name: pillar ? String(pillar.name) : null,
      pillar_color: pillar ? String(pillar.color) : null,
      pillar_abbreviation: pillar
        ? resolvePillarAbbreviation(
            String(pillar.name),
            pillar.abbreviation as string | null | undefined
          )
        : null,
      milestone_title: milestone ? String(milestone.title) : null,
      spawn_task_cards: event.spawnTaskCards,
      week_monday: weekMonday,
      week_dates: weekDates,
      progress: pr.progress,
      tasks_spawned: event.spawnTaskCards ? true : pr.tasks_spawned,
    });
  }

  return { week_monday: weekMonday, items };
}

export async function updateRecurringProgress(
  userId: number,
  progressId: number,
  progress: RecurringProgress,
  kind: RecurringKind,
  targetCount: number,
  eventId: number,
  weekMonday: string,
  spawnTaskCards: boolean,
  tallyEnabled = false
) {
  await updateRoutineProgress(userId, progressId, progress);

  if (!spawnTaskCards) return;

  const taskRows = await listTasksByRecurring(userId, eventId, weekMonday);

  if (kind === "daily" && tallyEnabled && "values" in progress) {
    const total = dailyTallyTotal(progress);
    const done = targetCount > 0 ? total >= targetCount : false;
    for (const row of taskRows) {
      await updateTask(userId, Number(row.id), {
        description: tallyTaskDescription(total, targetCount),
        completedAt: done ? new Date().toISOString() : null,
      });
    }
  } else if (kind === "daily" && "days" in progress) {
    for (const row of taskRows) {
      const slot = String(row.recurring_slot);
      const done = !!progress.days[slot];
      await updateTask(userId, Number(row.id), {
        completedAt: done ? new Date().toISOString() : null,
      });
    }
  } else if (kind === "count" && "slots" in progress) {
    for (const row of taskRows) {
      const idx = Number(row.recurring_slot);
      const done = !!progress.slots[idx];
      await updateTask(userId, Number(row.id), {
        completedAt: done ? new Date().toISOString() : null,
      });
    }
  }
}
