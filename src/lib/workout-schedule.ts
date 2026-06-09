import { addDaysIsoYyyyMmDd } from "./date";

export function isRunTask(title: string): boolean {
  return /\b(run|running|jog|jogging|5k|10k|marathon|easy run|long run|tempo)\b/i.test(
    title
  );
}

export function isHealthTask(title: string): boolean {
  return (
    isRunTask(title) ||
    /\b(walk|walking|gym|workout|yoga|stretch|lift|weights|cardio|swim|bike|cycling|hike|pilates|crossfit|strength)\b/i.test(
      title
    )
  );
}

export function prefersNoDuplicateRuns(preferencesText: string | null | undefined): boolean {
  if (!preferencesText) return true;
  const lower = preferencesText.toLowerCase();
  if (/\b(two|2)\s+runs?\s+(on\s+)?(the\s+)?same\s+day\b/.test(lower)) return true;
  if (/\bno\s+(two|2)\s+runs?\b/.test(lower)) return true;
  if (/\bone\s+run\s+per\s+day\b/.test(lower)) return true;
  return false;
}

type TaskWithDeadline = {
  title: string;
  deadline: string | null;
  schedule_type?: string;
  window_start?: string | null;
};

export function spreadRunsAcrossDays<T extends TaskWithDeadline>(
  tasks: T[],
  today: string,
  existingRunDates: Set<string> = new Set()
): T[] {
  const occupied = new Set(existingRunDates);

  for (const task of tasks) {
    if (!isRunTask(task.title)) continue;

    let date = task.deadline ?? today;
    while (occupied.has(date)) {
      date = addDaysIsoYyyyMmDd(date, 1);
    }

    task.deadline = date;
    task.schedule_type = "fixed";
    task.window_start = null;

    occupied.add(date);
  }

  return tasks;
}
