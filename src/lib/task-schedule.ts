import { addDaysIsoYyyyMmDd, isYyyyMmDd } from "./date";
import { formatRelativeDateLabel } from "./mission-dates";
import { isRunTask } from "./workout-schedule";

export const SCHEDULE_TYPES = ["flexible", "complete_by", "fixed", "window"] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export type TaskScheduleFields = {
  deadline: string | null;
  schedule_type?: string | null;
  window_start?: string | null;
};

export type TaskPlacementFields = TaskScheduleFields & {
  title?: string | null;
  recurring_event_id?: number | null;
  recurring_slot?: string | null;
  date_locked?: boolean | number | null;
};

export function isDateLocked(task: { date_locked?: boolean | number | null }): boolean {
  return Number(task.date_locked) === 1;
}

/** Runs and recurring spawn cards belong on exactly one calendar day (their deadline). */
export function isDaySpecificScheduled(task: TaskPlacementFields): boolean {
  if (!task.deadline || !isYyyyMmDd(task.deadline)) return false;

  if (task.recurring_event_id != null) {
    const slot = task.recurring_slot;
    if (!slot || slot === "counter" || slot === "tally") return false;
    return true;
  }

  return !!(task.title && isRunTask(task.title));
}

export function normalizeScheduleType(raw: string | null | undefined): ScheduleType {
  if (raw === "complete_by" || raw === "fixed" || raw === "window") return raw;
  return "flexible";
}

export function scheduleTypeLabel(type: ScheduleType): string {
  switch (type) {
    case "complete_by":
      return "Complete by";
    case "fixed":
      return "On this day";
    case "window":
      return "Flexible window";
    default:
      return "Flexible";
  }
}

export function inferScheduleTypeFromText(text: string): ScheduleType {
  const lower = text.toLowerCase();

  if (
    /\b(appointment|scan|meeting|class|flight|interview|happening|scheduled|at \d|@\d|\bon (mon|tue|wed|thu|fri|sat|sun)\b)/i.test(
      lower
    ) ||
    /\b(dexa|dentist|doctor|therapy)\b/.test(lower)
  ) {
    return "fixed";
  }

  if (/\b(by|before|due|deadline|no later than|complete by|this week)\b/.test(lower)) {
    return "complete_by";
  }

  if (
    /\b(next week|sometime|when i can|whenever|any day|anytime|flexible|in the next)\b/.test(
      lower
    )
  ) {
    return "window";
  }

  return "flexible";
}

export function inferWindowStart(
  text: string,
  today: string,
  deadline: string | null
): string | null {
  if (!deadline || !isYyyyMmDd(deadline)) return null;
  const lower = text.toLowerCase();

  if (/\bnext week\b/.test(lower)) {
    const day = new Date(today).getDay();
    const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
    return addDaysIsoYyyyMmDd(today, daysUntilNextMonday);
  }

  return today;
}

export function daysBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const a = new Date(sy, sm - 1, sd);
  const b = new Date(ey, em - 1, ed);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export type WindowUrgency = "early" | "mid" | "late" | "overdue";

export function windowUrgency(
  windowStart: string | null,
  deadline: string | null,
  today: string
): WindowUrgency | null {
  if (!deadline) return null;
  const start = windowStart && windowStart <= deadline ? windowStart : today;
  if (today > deadline) return "overdue";
  if (today < start) return null;

  const total = Math.max(daysBetween(start, deadline), 1);
  const elapsed = daysBetween(start, today);
  const ratio = elapsed / total;

  if (ratio <= 0.35) return "early";
  if (ratio >= 0.75) return "late";
  return "mid";
}

export function isOverdueTask(
  task: TaskPlacementFields,
  today: string
): boolean {
  if (!task.deadline || !isYyyyMmDd(task.deadline)) return false;
  return task.deadline < today;
}

/** Open tasks past deadline should surface on Today until resolved (unless date-locked to another day). */
export function shouldSurfaceOverdueOnToday(
  task: TaskPlacementFields,
  today: string
): boolean {
  if (isDateLocked(task) && task.deadline !== today) return false;
  return isOverdueTask(task, today);
}

export function taskBelongsInTodayPriorities(
  task: TaskPlacementFields,
  today: string
): boolean {
  if (shouldSurfaceOverdueOnToday(task, today)) return true;

  if (isDateLocked(task)) {
    return task.deadline === today;
  }

  if (isDaySpecificScheduled(task)) {
    return task.deadline === today;
  }

  const type = normalizeScheduleType(task.schedule_type);

  if (type === "flexible" && !task.deadline) return true;

  if (type === "fixed") {
    return task.deadline === today;
  }

  if (type === "complete_by") {
    if (!task.deadline) return true;
    return task.deadline <= today;
  }

  if (type === "window") {
    if (!task.deadline) return true;
    const start =
      task.window_start && task.window_start <= task.deadline
        ? task.window_start
        : today;
    if (today > task.deadline) return true;
    return today >= start && today <= task.deadline;
  }

  if (!task.deadline) return true;
  return task.deadline <= today;
}

export function schedulePriorityBoost(
  task: TaskPlacementFields,
  today: string
): number {
  if (isDaySpecificScheduled(task)) {
    return task.deadline === today ? 700 : 0;
  }

  const type = normalizeScheduleType(task.schedule_type);
  if (!task.deadline) return 0;

  if (type === "fixed" && task.deadline === today) return 700;

  if (type === "complete_by") {
    if (task.deadline < today) return 800;
    if (task.deadline === today) return 500;
    return 0;
  }

  if (type === "window") {
    const urgency = windowUrgency(task.window_start ?? null, task.deadline, today);
    if (urgency === "overdue") return 800;
    if (urgency === "late") return 450;
    if (urgency === "mid") return 220;
    if (urgency === "early") return 40;
  }

  return 0;
}

export function formatScheduleDateLabel(
  task: TaskScheduleFields,
  today: string
): string {
  const type = normalizeScheduleType(task.schedule_type);
  if (!task.deadline) return "No date";

  const rel = formatRelativeDateLabel(task.deadline, today);

  if (type === "window" && task.window_start && task.window_start < task.deadline) {
    const startRel = formatRelativeDateLabel(task.window_start, today);
    if (startRel === rel) return rel;
    return `${startRel} → ${rel}`;
  }
  if (type === "complete_by") return `By ${rel}`;
  if (type === "fixed") return rel === task.deadline ? `On ${rel}` : rel;
  return rel;
}
