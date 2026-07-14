import { addDaysIsoYyyyMmDd, isYyyyMmDd, todayIsoYyyyMmDd } from "./date";
import {
  habitCalendarHorizonEnd,
  weekMondaysThrough,
} from "./habit-calendar-horizon";
import { resolvePillarAbbreviation } from "./pillar-abbreviation";
import { isRunTask } from "./workout-schedule";
import {
  countProgressDone,
  dailyCheckDone,
  dailyTallyTotal,
  emptyProgress,
  parseDailyDays,
  parseProgress,
  selectedDayIndices,
  serializeDailyDays,
  weekDatesFromMonday,
  weekMondayFor,
  hasDailyTallyValue,
  type CountProgress,
  type DailyCheckProgress,
  type DailyTallyProgress,
  type RecurringKind,
  type RecurringProgress,
} from "./recurring-week";
import { getMongoDb } from "./mongodb/client";
import { COLLECTIONS } from "./mongodb/schemas";
import { listMilestones } from "./mongodb/store/milestones";
import {
  getMaxTaskRank,
  insertTask,
  listTasksByRecurring,
  normalizeRecurringTaskSchedules,
  deleteRecurringTasksForEvent,
  pruneOpenRecurringTasksAfterDate,
  updateTask,
} from "./mongodb/store/tasks";
import {
  getOrCreateRoutineProgress,
  findRoutine,
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
  end_date: string | null;
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
    end_date: r.endDate ?? null,
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

function isTallyWeekSlot(slot: string): boolean {
  return slot === "tally";
}

async function spawnWeeklyTasks(
  userId: number,
  event: RecurringEventRow,
  weekMonday: string,
  progressId: number,
  horizonEnd: string,
  minDate?: string
) {
  const weekDates = weekDatesFromMonday(weekMonday);
  const dailyDays = parseDailyDays(event.daily_days);
  const end = weekEnd(weekMonday);
  const tally = !!event.tally_enabled;

  const existing = await listTasksByRecurring(userId, event.id, weekMonday);
  if (existing.length > 0) {
    await markRoutineTasksSpawned(userId, progressId);
    return;
  }

  let nextRank = (await getMaxTaskRank(userId)) + 1;
  let spawned = false;

  function includeDate(date: string): boolean {
    if (date > horizonEnd) return false;
    if (minDate && date < minDate) return false;
    return true;
  }

  if (event.kind === "daily" && tally) {
    for (let i = 0; i < 7; i++) {
      if (!dailyDays[i]) continue;
      if (!includeDate(weekDates[i])) continue;
      await insertTask(userId, {
        title: event.title,
        description:
          event.target_count > 0 ? tallyTaskDescription(0, event.target_count) : null,
        deadline: weekDates[i],
        rank: nextRank++,
        pillarId: event.pillar_id,
        milestoneId: event.milestone_id,
        scheduleType: "fixed",
        recurringEventId: event.id,
        recurringWeekMonday: weekMonday,
        recurringSlot: weekDates[i],
      });
      spawned = true;
    }
  } else if (event.kind === "daily") {
    for (let i = 0; i < 7; i++) {
      if (!dailyDays[i]) continue;
      if (!includeDate(weekDates[i])) continue;
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
      spawned = true;
    }
  } else if (event.kind === "count") {
    const dayIndices = selectedDayIndices(dailyDays);
    const useCalendarDays = dayIndices.length > 0;

    for (let i = 0; i < event.target_count; i++) {
      let deadline: string;

      if (useCalendarDays && dayIndices[i] !== undefined) {
        deadline = weekDates[dayIndices[i]];
      } else {
        const occupied = new Set<string>();
        deadline = addDaysIsoYyyyMmDd(weekMonday, i);
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
      }

      if (!includeDate(deadline)) continue;

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
      spawned = true;
    }
  }

  if (spawned) {
    await markRoutineTasksSpawned(userId, progressId);
  }
}

async function ensureRoutineCalendarTasks(
  userId: number,
  event: MongoRoutine,
  today: string,
  fromDate?: string
) {
  if (!event.spawnTaskCards) return;

  const horizonEnd = habitCalendarHorizonEnd(today, event.endDate ?? null);
  const spawnFrom = fromDate ?? today;
  if (horizonEnd < spawnFrom) return;

  const row = routineToEventRow(event);
  const tallyEnabled = !!event.tallyEnabled;
  const startMonday = weekMondayFor(spawnFrom);

  for (const weekMonday of weekMondaysThrough(startMonday, horizonEnd)) {
    const pr = await getOrCreateRoutineProgress(
      userId,
      event.tursoId,
      weekMonday,
      event.kind,
      event.targetFrequency,
      tallyEnabled
    );

    if (!pr.tasks_spawned) {
      await spawnWeeklyTasks(
        userId,
        row,
        weekMonday,
        pr.progress_id,
        horizonEnd,
        fromDate
      );
    }
  }
}

export async function ensureHabitCalendarTasks(userId: number, today = todayIsoYyyyMmDd()) {
  const events = await listActiveRoutines(userId);
  for (const event of events) {
    await ensureRoutineCalendarTasks(userId, event, today);
  }
}

export async function pruneRecurringTasksAfterEndDate(
  userId: number,
  eventId: number,
  endDate: string | null
) {
  if (!endDate) return;
  await pruneOpenRecurringTasksAfterDate(userId, eventId, endDate);
}

/** Drop open calendar tasks from today onward and allow respawn after schedule changes. */
export async function resetFutureRoutineCalendarTasks(
  userId: number,
  eventId: number,
  today = todayIsoYyyyMmDd()
) {
  await pruneOpenRecurringTasksAfterDate(userId, eventId, addDaysIsoYyyyMmDd(today, -1));

  const db = await getMongoDb();
  const weekMonday = weekMondayFor(today);
  await db.collection(COLLECTIONS.routine_progress).updateMany(
    { tursoUserId: userId, routineId: eventId, weekMonday: { $gte: weekMonday } },
    { $set: { tasksSpawned: false, updatedAt: new Date() } }
  );
}

/** Remove all habit calendar tasks and respawn from a start date with current schedule. */
export async function regenerateHabitCalendarTasks(
  userId: number,
  eventId: number,
  fromDate: string,
  today = todayIsoYyyyMmDd()
) {
  if (!isYyyyMmDd(fromDate)) throw new Error("Invalid from_date");

  const routine = await findRoutine(userId, eventId);
  if (!routine?.spawnTaskCards) return;

  await deleteRecurringTasksForEvent(userId, eventId);

  const db = await getMongoDb();
  const startMonday = weekMondayFor(fromDate);
  await db.collection(COLLECTIONS.routine_progress).updateMany(
    { tursoUserId: userId, routineId: eventId, weekMonday: { $gte: startMonday } },
    { $set: { tasksSpawned: false, updatedAt: new Date() } }
  );

  await ensureRoutineCalendarTasks(userId, routine, today, fromDate);
}

export async function ensureRecurringWeek(
  userId: number,
  today = todayIsoYyyyMmDd()
): Promise<{ week_monday: string; items: RecurringWeekItem[] }> {
  await normalizeRecurringTaskSchedules(userId);
  await ensureHabitCalendarTasks(userId, today);
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
    const tallyEnabled = !!event.tallyEnabled;

    const pr = await getOrCreateRoutineProgress(
      userId,
      event.tursoId,
      weekMonday,
      event.kind,
      event.targetFrequency,
      tallyEnabled
    );

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
    const weekDone = targetCount > 0 ? total >= targetCount : false;
    for (const row of taskRows) {
      const slot = String(row.recurring_slot);
      if (isTallyWeekSlot(slot)) {
        await updateTask(userId, Number(row.id), {
          description: tallyTaskDescription(total, targetCount),
          completedAt: weekDone ? new Date().toISOString() : null,
        });
        continue;
      }
      const dayValue = progress.values[slot];
      const hasValue = hasDailyTallyValue(progress, slot);
      await updateTask(userId, Number(row.id), {
        description: hasValue
          ? String(dayValue)
          : targetCount > 0
            ? tallyTaskDescription(total, targetCount)
            : null,
        completedAt: hasValue ? new Date().toISOString() : null,
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

export type RoutineProgressScore = {
  done: number;
  target: number;
  label: string;
};

export function routineProgressScore(item: RecurringWeekItem): RoutineProgressScore {
  if (item.kind === "daily" && item.tally_enabled) {
    const total = dailyTallyTotal(item.progress as DailyTallyProgress);
    const target = item.target_count > 0 ? item.target_count : total;
    return {
      done: total,
      target,
      label: item.target_count > 0 ? `${total}/${item.target_count}` : String(total),
    };
  }
  if (item.kind === "daily") {
    const done = dailyCheckDone(item.progress as DailyCheckProgress);
    const target = item.daily_days.filter(Boolean).length;
    return { done, target, label: `${done}/${target}` };
  }
  const done = countProgressDone(item.progress as CountProgress);
  return { done, target: item.target_count, label: `${done}/${item.target_count}` };
}

/** Read routine progress for a past or current week without spawning task cards. */
export async function loadRecurringWeekSnapshot(
  userId: number,
  weekMonday: string
): Promise<RecurringWeekItem[]> {
  const db = await getMongoDb();
  const events = await listActiveRoutines(userId);
  const [pillars, milestones] = await Promise.all([
    listPillars(userId),
    listMilestones(userId),
  ]);

  const pillarById = new Map(pillars.map((p) => [Number(p.id), p]));
  const milestoneById = new Map(milestones.map((m) => [Number(m.id), m]));
  const weekDates = weekDatesFromMonday(weekMonday);

  const items: RecurringWeekItem[] = [];

  for (const event of events) {
    const tallyEnabled = !!event.tallyEnabled;
    const progressRow = await db
      .collection(COLLECTIONS.routine_progress)
      .findOne({ tursoUserId: userId, routineId: event.tursoId, weekMonday });

    const progress: RecurringProgress = progressRow
      ? parseProgress(
          JSON.stringify(progressRow.progress),
          event.kind,
          event.targetFrequency,
          tallyEnabled
        )
      : emptyProgress(event.kind, event.targetFrequency, tallyEnabled);

    const pillar = event.pillarId ? pillarById.get(event.pillarId) : null;
    const milestone = event.milestoneId ? milestoneById.get(event.milestoneId) : null;

    items.push({
      event_id: event.tursoId,
      progress_id: progressRow?.tursoId ?? 0,
      title: event.title,
      kind: event.kind,
      target_count: event.targetFrequency,
      daily_days: parseDailyDays(
        serializeDailyDays(event.dailyDays as ReturnType<typeof parseDailyDays>)
      ),
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
      progress,
      tasks_spawned: !!progressRow?.tasksSpawned,
    });
  }

  return items.sort((a, b) => {
    const ar = events.find((e) => e.tursoId === a.event_id)?.rank ?? 0;
    const br = events.find((e) => e.tursoId === b.event_id)?.rank ?? 0;
    return ar - br;
  });
}
