import { getMissionLayout, upsertMissionLayout } from "./mongodb/store/daily-logs";
import { updateTask } from "./mongodb/store/tasks";
import type { MissionLayout, MissionLayoutRef } from "./mission-layout";
import { shouldSurfaceOverdueOnToday } from "./task-schedule";
import type {
  OrchestrationLayout,
  OrchestrationReschedule,
} from "./adk/parse-orchestration-result";

type TaskRow = {
  id: number;
  deadline: string | null;
  date_locked?: number;
};

function isDateLockedTask(task: TaskRow) {
  return Number(task.date_locked) === 1;
}

function taskRef(id: number, pinned = false) {
  return { kind: "task" as const, id, ...(pinned ? { pinned: true as const } : {}) };
}

function milestoneRefs(refs: MissionLayout["today"] | undefined) {
  return (refs ?? []).filter((r) => r.kind === "milestone");
}

function promoteOverdueFromComingUp(
  today: MissionLayoutRef[],
  coming_up: MissionLayoutRef[],
  deferLaterIds: Set<number>,
  taskById: Map<number, TaskRow>,
  planDate: string
) {
  const todayTaskIds = new Set(
    today.filter((r) => r.kind === "task").map((r) => r.id)
  );
  const kept: MissionLayoutRef[] = [];

  for (const ref of coming_up) {
    if (ref.kind !== "task") {
      kept.push(ref);
      continue;
    }
    const task = taskById.get(ref.id);
    if (
      task &&
      !deferLaterIds.has(ref.id) &&
      shouldSurfaceOverdueOnToday(task, planDate)
    ) {
      if (!todayTaskIds.has(ref.id)) {
        today.push(taskRef(ref.id, true));
        todayTaskIds.add(ref.id);
      }
      continue;
    }
    kept.push(ref);
  }

  coming_up.splice(0, coming_up.length, ...kept);
}

export async function applyOrchestrationReschedules(
  userId: number,
  reschedules: OrchestrationReschedule[],
  openTasks: TaskRow[]
) {
  const taskById = new Map(openTasks.map((t) => [Number(t.id), t]));

  for (const item of reschedules) {
    const task = taskById.get(item.task_id);
    if (!task || isDateLockedTask(task)) continue;
    if (!item.deadline) continue;
    await updateTask(userId, item.task_id, { deadline: item.deadline });
    task.deadline = item.deadline;
  }
}

export async function applyOrchestrationLayout(
  userId: number,
  planDate: string,
  layout: OrchestrationLayout,
  openTasks: TaskRow[],
  reschedules: OrchestrationReschedule[] = []
) {
  await applyOrchestrationReschedules(userId, reschedules, openTasks);

  const taskById = new Map(openTasks.map((t) => [Number(t.id), t]));
  const rescheduleBucket = new Map(
    reschedules.map((r) => [r.task_id, r.bucket] as const)
  );
  const used = new Set<number>();

  const today: MissionLayoutRef[] = [];
  const coming_up: MissionLayoutRef[] = [];
  const laterRefs: MissionLayoutRef[] = [];

  function placeTask(id: number, bucket: "today" | "this_week" | "later") {
    const task = taskById.get(id);
    if (!task || used.has(id)) return;

    if (isDateLockedTask(task)) {
      if (task.deadline === planDate) {
        today.push(taskRef(id, true));
      } else if (task.deadline && task.deadline > planDate) {
        coming_up.push(taskRef(id));
      } else {
        laterRefs.push(taskRef(id));
      }
      used.add(id);
      return;
    }

    if (bucket === "today") {
      today.push(taskRef(id, true));
    } else if (bucket === "later") {
      laterRefs.push(taskRef(id));
    } else {
      coming_up.push(taskRef(id));
    }
    used.add(id);
  }

  for (const id of layout.today) {
    const bucket = rescheduleBucket.get(id) ?? "today";
    placeTask(id, bucket === "later" ? "later" : bucket === "this_week" ? "this_week" : "today");
  }
  for (const id of layout.this_week) {
    const bucket = rescheduleBucket.get(id) ?? "this_week";
    placeTask(id, bucket === "today" ? "today" : bucket === "later" ? "later" : "this_week");
  }
  for (const id of layout.later) {
    placeTask(id, "later");
  }

  for (const task of openTasks) {
    if (used.has(task.id)) continue;
    if (!shouldSurfaceOverdueOnToday(task, planDate)) continue;
    today.push(taskRef(task.id, true));
    used.add(task.id);
  }

  for (const task of openTasks) {
    if (!isDateLockedTask(task) || task.deadline !== planDate) continue;
    if (used.has(task.id)) continue;
    today.push(taskRef(task.id, true));
    used.add(task.id);
  }

  for (const task of openTasks) {
    if (used.has(task.id)) continue;
    coming_up.push(taskRef(task.id));
    used.add(task.id);
  }

  promoteOverdueFromComingUp(
    today,
    coming_up,
    new Set(layout.later),
    taskById,
    planDate
  );

  const existing = await getMissionLayout(userId, planDate);
  today.push(...milestoneRefs(existing?.today));
  coming_up.push(...milestoneRefs(existing?.coming_up));
  laterRefs.push(...milestoneRefs(existing?.later));

  await upsertMissionLayout(userId, planDate, {
    today,
    coming_up,
    later: laterRefs,
    today_user_ordered: false,
    reflection: existing?.reflection,
  });
}
