import { isYyyyMmDd } from "../date";
import { getMaxTaskRank, insertTask, updateTask } from "../mongodb/store/tasks";
import { listPillars } from "../mongodb/store/users";

function resolvePillarId(pillarName: string, pillars: { id: unknown; name: unknown }[]) {
  const normalized = pillarName.trim().toLowerCase();
  if (!normalized) return null;
  const match = pillars.find((p) => String(p.name).trim().toLowerCase() === normalized);
  return match ? Number(match.id) : null;
}

export async function saveTasksForUser(
  userId: number,
  tasks: {
    title: string;
    pillar?: string;
    deadline?: string | null;
    is_new?: boolean;
  }[]
) {
  const pillars = await listPillars(userId);
  let nextRank = (await getMaxTaskRank(userId)) + 1;
  const created: Record<string, unknown>[] = [];

  for (const task of tasks) {
    const title = task.title.trim();
    if (!title) continue;

    const deadline =
      task.deadline && isYyyyMmDd(task.deadline) ? task.deadline : null;
    const pillarId = task.pillar ? resolvePillarId(task.pillar, pillars) : null;

    const row = await insertTask(userId, {
      title,
      deadline,
      rank: nextRank++,
      pillarId,
      scheduleType: "flexible",
      isNew: task.is_new ?? true,
    });
    created.push(row);
  }

  return created;
}

export async function completeTaskForUser(
  userId: number,
  taskId: number,
  completed: boolean
) {
  await updateTask(userId, taskId, {
    completedAt: completed ? new Date().toISOString() : null,
  });
  return { ok: true, task_id: taskId, completed };
}
