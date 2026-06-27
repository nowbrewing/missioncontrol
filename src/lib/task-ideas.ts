/** Ideas are undated capture items — excluded from calendar and mission prioritization. */
export function isIdeaTask(task: { is_idea?: number | boolean | null | unknown }): boolean {
  return Number(task.is_idea) === 1 || task.is_idea === true;
}

export function isScheduledTask(task: { is_idea?: number | boolean | null | unknown }): boolean {
  return !isIdeaTask(task);
}
