import { addDaysIsoYyyyMmDd } from "./date";
import { taskBelongsInTodayPriorities } from "./task-schedule";
import { normalizeScheduleType, schedulePriorityBoost } from "./task-schedule";
import type { TaskNoteImage } from "./task-note-images";
import type { PillarNoteFieldValues } from "./pillar-note-fields";

export type MissionTask = {
  id: number;
  title: string;
  description?: string | null;
  note?: string | null;
  note_images?: TaskNoteImage[];
  note_field_values?: PillarNoteFieldValues;
  deadline: string | null;
  schedule_type?: string | null;
  window_start?: string | null;
  recurring_event_id?: number | null;
  recurring_slot?: string | null;
  completed_at: string | null;
  rank: number;
  pillar_id: number | null;
  milestone_id: number | null;
  created_at: string;
  is_new?: boolean;
  date_locked?: boolean;
  pillar_name?: string | null;
  pillar_abbreviation?: string | null;
  pillar_color?: string | null;
  milestone_title?: string | null;
};

export type MissionMilestone = {
  id: number;
  title: string;
  target_date: string | null;
  completed_at: string | null;
  pillar_id: number | null;
  pillar_name?: string | null;
  pillar_abbreviation?: string | null;
  pillar_color?: string | null;
};

export type ComingUpItem =
  | {
      kind: "task";
      id: number;
      title: string;
      date: string;
      pillar_name?: string | null;
      pillar_abbreviation?: string | null;
      pillar_color?: string | null;
      milestone_title?: string | null;
    }
  | {
      kind: "milestone";
      id: number;
      title: string;
      date: string;
      pillar_name?: string | null;
      pillar_abbreviation?: string | null;
      pillar_color?: string | null;
    };

function taskPriorityScore(
  task: MissionTask,
  today: string,
  pillarRankById: Map<number, number>
): number {
  if (task.completed_at) return -1;

  let score = 1000 - task.rank;

  score += schedulePriorityBoost(task, today);

  const type = normalizeScheduleType(task.schedule_type);
  if (type === "complete_by" && task.deadline) {
    if (task.deadline > today && task.deadline <= addDaysIsoYyyyMmDd(today, 3)) {
      score += 120;
    }
  }

  if (task.pillar_id != null) {
    const pillarRank = pillarRankById.get(task.pillar_id);
    if (pillarRank != null) score += (100 - pillarRank) * 3;
  }

  if (
    task.created_at.startsWith(today) && taskBelongsInTodayPriorities(task, today)
  ) {
    score += 150;
  }

  return score;
}

export function sortTasksForToday(
  tasks: MissionTask[],
  today: string,
  pillarRankById: Map<number, number>
) {
  return [...tasks]
    .filter((t) => !t.completed_at && taskBelongsInTodayPriorities(t, today))
    .sort(
      (a, b) =>
        taskPriorityScore(b, today, pillarRankById) -
        taskPriorityScore(a, today, pillarRankById)
    );
}

export function getComingUpNext(
  tasks: MissionTask[],
  milestones: MissionMilestone[],
  today: string,
  horizonDays = 7
): ComingUpItem[] {
  const end = addDaysIsoYyyyMmDd(today, horizonDays);
  const items: ComingUpItem[] = [];

  for (const task of tasks) {
    if (task.completed_at || !task.deadline) continue;
    if (taskBelongsInTodayPriorities(task, today)) continue;
    if (!task.deadline || task.deadline > end) continue;
    items.push({
      kind: "task",
      id: task.id,
      title: task.title,
      date: task.deadline,
      pillar_name: task.pillar_name,
      pillar_abbreviation: task.pillar_abbreviation,
      pillar_color: task.pillar_color,
      milestone_title: task.milestone_title,
    });
  }

  for (const milestone of milestones) {
    if (milestone.completed_at || !milestone.target_date) continue;
    if (milestone.target_date <= today || milestone.target_date > end) continue;
    items.push({
      kind: "milestone",
      id: milestone.id,
      title: milestone.title,
      date: milestone.target_date,
      pillar_name: milestone.pillar_name,
      pillar_abbreviation: milestone.pillar_abbreviation,
      pillar_color: milestone.pillar_color,
    });
  }

  return items.sort((a, b) => a.date.localeCompare(b.date));
}
