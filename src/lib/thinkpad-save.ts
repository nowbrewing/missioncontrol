import { appendPillarContext } from "./pillar-context";
import { appendTaskNote } from "./task-notes";
import { appendUserPreference } from "./user-preferences";
import { todayIsoYyyyMmDd } from "./date";
import { listMilestones } from "./mongodb/store/milestones";
import { listTasks, updateTask } from "./mongodb/store/tasks";
import {
  getUserPreferences,
  listPillars,
  setUserPreferences,
  updatePillar,
} from "./mongodb/store/users";

export type ThinkpadSaveTarget = "task" | "milestone" | "pillar" | "general";

export async function saveThinkpadNotes(params: {
  userId: number;
  planDate: string;
  target: ThinkpadSaveTarget;
  targetId?: number | null;
  summary: string;
}) {
  const summary = params.summary.trim();
  if (!summary) {
    throw new Error("Summary is required");
  }

  const at = params.planDate || todayIsoYyyyMmDd();

  if (params.target === "general") {
    const existing = await getUserPreferences(params.userId);
    const next = appendUserPreference(existing, summary, at);
    await setUserPreferences(params.userId, next);
    return { target: "general" as const };
  }

  if (params.target === "task") {
    const taskId = params.targetId;
    if (!taskId) throw new Error("Task is required");
    const tasks = await listTasks(params.userId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new Error("Task not found");
    const note = appendTaskNote(task.note, summary, at);
    await updateTask(params.userId, taskId, { note });
    return { target: "task" as const, id: taskId };
  }

  if (params.target === "pillar") {
    const pillarId = params.targetId;
    if (!pillarId) throw new Error("Pillar is required");
    const pillars = await listPillars(params.userId);
    const pillar = pillars.find((p) => p.id === pillarId);
    if (!pillar) throw new Error("Pillar not found");
    const description = appendPillarContext(pillar.description, summary, at);
    await updatePillar(params.userId, pillarId, { description });
    return { target: "pillar" as const, id: pillarId };
  }

  if (params.target === "milestone") {
    const milestoneId = params.targetId;
    if (!milestoneId) throw new Error("Milestone is required");
    const milestones = await listMilestones(params.userId);
    const milestone = milestones.find((m) => m.id === milestoneId);
    if (!milestone) throw new Error("Milestone not found");
    const line = `[Thinkpad · ${milestone.title}] ${summary}`;
    const pillarId = milestone.pillar_id != null ? Number(milestone.pillar_id) : null;

    if (pillarId) {
      const pillars = await listPillars(params.userId);
      const pillar = pillars.find((p) => p.id === pillarId);
      if (!pillar) throw new Error("Pillar not found for milestone");
      const description = appendPillarContext(pillar.description, line, at);
      await updatePillar(params.userId, pillarId, { description });
      return { target: "milestone" as const, id: milestoneId, pillar_id: pillarId };
    }

    const existing = await getUserPreferences(params.userId);
    const next = appendUserPreference(existing, line, at);
    await setUserPreferences(params.userId, next);
    return { target: "milestone" as const, id: milestoneId, saved_to: "general" as const };
  }

  throw new Error("Invalid save target");
}
