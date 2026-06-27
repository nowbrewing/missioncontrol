import type { RecurringWeekItem } from "./recurring-events";
import { routineProgressScore } from "./recurring-events";
import type { WeekRecapTask } from "./build-week-recap";

function formatRoutineAccomplishmentLine(item: RecurringWeekItem): string | null {
  const score = routineProgressScore(item);
  if (score.done <= 0 && !item.spawn_task_cards) return null;
  if (score.done <= 0) return null;
  if (score.target > 0 && score.done >= score.target) {
    return `- ${item.title} — ${score.label} (on track)`;
  }
  return `- ${item.title} — ${score.label}`;
}

function formatRoutineMissLine(item: RecurringWeekItem): string | null {
  const score = routineProgressScore(item);
  if (score.target <= 0) return null;
  if (score.done >= score.target) return null;
  if (score.done === 0) {
    return `- ${item.title} — no progress (${score.label})`;
  }
  return `- ${item.title} — partial (${score.label})`;
}

function pillarRoutines(
  routines: RecurringWeekItem[],
  pillarId: number | null,
  weekMonday: string
): RecurringWeekItem[] {
  return routines.filter(
    (r) => r.pillar_id === pillarId && r.week_monday === weekMonday
  );
}

export function collapsePillarTaskLines(
  tasks: WeekRecapTask[],
  routines: RecurringWeekItem[],
  weekMonday: string,
  pillarId: number | null,
  field: "completed" | "missed"
): string[] {
  const pillarRoutineList = pillarRoutines(routines, pillarId, weekMonday);
  const routinesById = new Map(pillarRoutineList.map((r) => [r.event_id, r]));
  const routineIdsWithTasks = new Set<number>();
  const standalone: WeekRecapTask[] = [];

  for (const task of tasks) {
    if (
      task.recurring_event_id != null &&
      task.recurring_week_monday === weekMonday &&
      task.pillar_id === pillarId
    ) {
      routineIdsWithTasks.add(task.recurring_event_id);
    } else {
      standalone.push(task);
    }
  }

  const lines: string[] = [];

  for (const routineId of [...routineIdsWithTasks].sort((a, b) => a - b)) {
    const routine = routinesById.get(routineId);
    if (!routine) continue;
    const line =
      field === "completed"
        ? formatRoutineAccomplishmentLine(routine)
        : formatRoutineMissLine(routine);
    if (line) lines.push(line);
  }

  for (const routine of pillarRoutineList) {
    if (routine.spawn_task_cards) continue;
    if (routineIdsWithTasks.has(routine.event_id)) continue;
    const line =
      field === "completed"
        ? formatRoutineAccomplishmentLine(routine)
        : formatRoutineMissLine(routine);
    if (line) lines.push(line);
  }

  for (const routine of pillarRoutineList) {
    if (!routine.spawn_task_cards) continue;
    if (routineIdsWithTasks.has(routine.event_id)) continue;
    const line =
      field === "completed"
        ? formatRoutineAccomplishmentLine(routine)
        : formatRoutineMissLine(routine);
    if (line) lines.push(line);
  }

  for (const task of standalone) {
    lines.push(`- ${task.title}`);
  }

  return lines;
}

export function formatRoutineSynthesis(routines: RecurringWeekItem[]): string | null {
  const active = routines
    .map((item) => ({ item, score: routineProgressScore(item) }))
    .filter(({ score }) => score.done > 0);

  if (active.length === 0) return null;

  const parts = active.map(({ item, score }) => `${item.title} (${score.label})`);
  return `Routines: ${parts.join(", ")}.`;
}
