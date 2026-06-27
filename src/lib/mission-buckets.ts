import { z } from "zod";
import { addDaysIsoYyyyMmDd } from "./date";
import {
  isDateLocked,
  shouldSurfaceOverdueOnToday,
  taskBelongsInTodayPriorities,
  type TaskPlacementFields,
} from "./task-schedule";

export const AGENT_BUCKET_TODAY = "Today" as const;
export const AGENT_BUCKET_NEXT_7 = "Next 7 days" as const;
export const AGENT_BUCKET_LATER = "Later" as const;

export const AGENT_BUCKETS = [
  AGENT_BUCKET_TODAY,
  AGENT_BUCKET_NEXT_7,
  AGENT_BUCKET_LATER,
] as const;

export type AgentBucket = (typeof AGENT_BUCKETS)[number];

/** Last calendar day in the rolling next-7-days window (exclusive of overdue/today). */
export function next7DaysEnd(today: string): string {
  return addDaysIsoYyyyMmDd(today, 7);
}

export function isInNext7Days(deadline: string, today: string): boolean {
  return deadline > today && deadline <= next7DaysEnd(today);
}

export function normalizeAgentBucket(raw: string | undefined | null): AgentBucket {
  const value = raw?.trim();
  if (value === AGENT_BUCKET_TODAY) return AGENT_BUCKET_TODAY;
  if (value === AGENT_BUCKET_LATER) return AGENT_BUCKET_LATER;
  if (value === AGENT_BUCKET_NEXT_7 || value === "This Week") return AGENT_BUCKET_NEXT_7;
  return AGENT_BUCKET_LATER;
}

export const agentBucketSchema = z
  .enum(["Today", "Next 7 days", "Later", "This Week"])
  .transform((v) => normalizeAgentBucket(v));

export type TaskBucketFields = Pick<
  TaskPlacementFields,
  "deadline" | "date_locked" | "schedule_type" | "window_start" | "title" | "recurring_event_id" | "recurring_slot"
>;

/** Agent may not postpone a deadline that is due today or overdue. */
export function canAgentPostponeDeadline(
  task: TaskBucketFields,
  newDeadline: string | null,
  planDate: string
): boolean {
  if (isDateLocked(task)) return false;
  if (!task.deadline || !newDeadline) return true;
  if (task.deadline <= planDate && newDeadline > task.deadline) return false;
  return true;
}

export function inferDefaultOrchestrationBucket(
  task: TaskBucketFields,
  planDate: string
): "today" | "this_week" | "later" {
  if (shouldSurfaceOverdueOnToday(task, planDate)) return "today";

  if (isDateLocked(task)) {
    if (task.deadline === planDate) return "today";
    if (task.deadline && isInNext7Days(task.deadline, planDate)) return "this_week";
    return "later";
  }

  if (taskBelongsInTodayPriorities(task, planDate)) return "today";
  if (!task.deadline) return "this_week";
  if (isInNext7Days(task.deadline, planDate)) return "this_week";
  if (task.deadline > planDate) return "later";
  return "today";
}

export function enforceOrchestrationBucketRules(
  layout: { today: number[]; this_week: number[]; later: number[] },
  openTasks: ({ id: number } & TaskBucketFields)[],
  planDate: string
): { today: number[]; this_week: number[]; later: number[] } {
  const taskById = new Map(openTasks.map((t) => [Number(t.id), t]));
  const today = new Set(layout.today);
  const this_week = new Set(layout.this_week);
  const later = new Set(layout.later);
  const windowEnd = next7DaysEnd(planDate);

  for (const id of [...today, ...this_week, ...later]) {
    const task = taskById.get(id);
    if (!task) {
      today.delete(id);
      this_week.delete(id);
      later.delete(id);
      continue;
    }

    const mustToday =
      shouldSurfaceOverdueOnToday(task, planDate) ||
      (isDateLocked(task) && task.deadline === planDate);

    if (mustToday) {
      today.add(id);
      this_week.delete(id);
      later.delete(id);
      continue;
    }

    if (isDateLocked(task) && task.deadline && task.deadline !== planDate) {
      today.delete(id);
      if (isInNext7Days(task.deadline, planDate)) {
        this_week.add(id);
        later.delete(id);
      } else {
        later.add(id);
        this_week.delete(id);
      }
      continue;
    }

    if (task.deadline && task.deadline > windowEnd && (today.has(id) || this_week.has(id))) {
      today.delete(id);
      this_week.delete(id);
      later.add(id);
    }
  }

  return {
    today: [...today],
    this_week: [...this_week],
    later: [...later],
  };
}

export function agentBucketRulesForPrompt(planDate: string): string {
  const windowEnd = next7DaysEnd(planDate);
  return `Bucket rules (planning date ${planDate}):
- today: due today, overdue, or highest-priority work for ${planDate}
- this_week ("Next 7 days"): deadlines after ${planDate} through ${windowEnd} (rolling 7-day horizon), plus undated items worth planning soon
- later: deadlines after ${windowEnd}, or backlog not needed in the next week
- Tasks with a deadline on or before ${planDate} (due/overdue) MUST stay in today — never push their deadline later unless the user edits the date manually
- date_locked=true: only on the exact deadline day in today; never reschedule or move to another day
- Flexible dated tasks may surface before their deadline, but once due/overdue they cannot be postponed by the agent`;
}
