import { sortComingUpByDate, type BoardItem } from "./mission-layout";
import type { MissionTask } from "./mission-prioritize";

export type TaskBriefPatch = {
  title?: string;
  pillar_id?: number | null;
  milestone_id?: number | null;
  milestone_title?: string | null;
  deadline?: string | null;
  schedule_type?: string | null;
  window_start?: string | null;
  pillar_name?: string | null;
  pillar_abbreviation?: string | null;
  pillar_color?: string | null;
};

type BriefSlice = {
  tasks: MissionTask[];
  today_priorities: MissionTask[];
  board_today: BoardItem[];
  board_coming_up: BoardItem[];
};

export function patchTaskInBrief<T extends BriefSlice>(
  brief: T,
  id: number,
  patch: TaskBriefPatch
): T {
  const applyTask = (task: MissionTask) =>
    task.id === id ? { ...task, ...patch } : task;

  const applyBoard = (item: BoardItem) => {
    if (item.kind !== "task" || item.id !== id) return item;
    const next = { ...item };
    if (patch.title !== undefined) next.title = patch.title;
    if (patch.pillar_id !== undefined) next.pillar_id = patch.pillar_id;
    if (patch.milestone_id !== undefined) next.milestone_id = patch.milestone_id;
    if (patch.milestone_title !== undefined) next.milestone_title = patch.milestone_title;
    if (patch.deadline !== undefined) next.date = patch.deadline;
    if (patch.schedule_type !== undefined) next.schedule_type = patch.schedule_type;
    if (patch.window_start !== undefined) next.window_start = patch.window_start;
    if (patch.pillar_name !== undefined) next.pillar_name = patch.pillar_name;
    if (patch.pillar_abbreviation !== undefined) {
      next.pillar_abbreviation = patch.pillar_abbreviation;
    }
    if (patch.pillar_color !== undefined) next.pillar_color = patch.pillar_color;
    return next;
  };

  return {
    ...brief,
    tasks: brief.tasks.map(applyTask),
    today_priorities: brief.today_priorities.map(applyTask),
    board_today: brief.board_today.map(applyBoard),
    board_coming_up: sortComingUpByDate(brief.board_coming_up.map(applyBoard)),
  };
}
