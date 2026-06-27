export const PLANNING_IDEA_DRAG_MIME = "application/x-planning-idea";
export const PLANNING_TASK_DRAG_MIME = "application/x-planning-task";

export function readPlanningIdeaDragId(dataTransfer: DataTransfer): number | null {
  const raw = dataTransfer.getData(PLANNING_IDEA_DRAG_MIME);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

export function readPlanningTaskDragId(dataTransfer: DataTransfer): number | null {
  const raw = dataTransfer.getData(PLANNING_TASK_DRAG_MIME);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

export type PlanningCalendarDrop =
  | { kind: "idea"; id: number }
  | { kind: "task"; id: number };

export function readPlanningCalendarDrop(dataTransfer: DataTransfer): PlanningCalendarDrop | null {
  const taskId = readPlanningTaskDragId(dataTransfer);
  if (taskId != null) return { kind: "task", id: taskId };
  const ideaId = readPlanningIdeaDragId(dataTransfer);
  if (ideaId != null) return { kind: "idea", id: ideaId };
  return null;
}
