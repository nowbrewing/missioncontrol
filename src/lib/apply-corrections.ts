import { pillarIdsForLogText } from "./daily-log-pillar-tags";
import { updateDailyLogEntry } from "./daily-log-entries";
import type { ProposedCorrection } from "./adk/propose-corrections";
import { updatePillarContextAt } from "./pillar-context";
import { replaceTaskNoteLine } from "./task-notes";
import { updateUserPreferencesAt } from "./user-preferences";
import { listTasks, updateTask } from "./mongodb/store/tasks";
import { getUserPreferences, listPillars, setUserPreferences, updatePillar } from "./mongodb/store/users";

export type AppliedCorrection = ProposedCorrection & {
  kind: string;
  ok: boolean;
  error?: string;
};

function parseRecordId(recordId: string) {
  if (recordId.startsWith("daily_log:")) {
    return { kind: "daily_log" as const, id: Number(recordId.slice("daily_log:".length)) };
  }
  if (recordId.startsWith("pillar:")) {
    const [, pillarId, index] = recordId.split(":");
    return {
      kind: "pillar_context" as const,
      pillarId: Number(pillarId),
      index: Number(index),
    };
  }
  if (recordId.startsWith("task_note:")) {
    const [, taskId, index] = recordId.split(":");
    return {
      kind: "task_note" as const,
      taskId: Number(taskId),
      index: Number(index),
    };
  }
  if (recordId.startsWith("preference:")) {
    return {
      kind: "user_preference" as const,
      index: Number(recordId.slice("preference:".length)),
    };
  }
  return { kind: "unknown" as const };
}

export async function applyCorrections(
  userId: number,
  corrections: ProposedCorrection[]
): Promise<AppliedCorrection[]> {
  const results: AppliedCorrection[] = [];
  const pillars = await listPillars(userId);

  for (const correction of corrections) {
    const parsed = parseRecordId(correction.record_id);
    const base = { ...correction, kind: parsed.kind, ok: false };

    try {
      if (parsed.kind === "daily_log") {
        const pillarIds = await pillarIdsForLogText(correction.after, pillars);
        await updateDailyLogEntry(userId, parsed.id, correction.after, pillarIds);
        results.push({ ...base, ok: true });
        continue;
      }

      if (parsed.kind === "pillar_context") {
        const pillar = pillars.find((p) => Number(p.id) === parsed.pillarId);
        if (!pillar) throw new Error("Pillar not found");
        const description = updatePillarContextAt(
          pillar.description,
          parsed.index,
          correction.after
        );
        await updatePillar(userId, parsed.pillarId, { description });
        results.push({ ...base, ok: true });
        continue;
      }

      if (parsed.kind === "task_note") {
        const tasks = await listTasks(userId);
        const task = tasks.find((t) => Number(t.id) === parsed.taskId);
        if (!task) throw new Error("Task not found");
        const note = replaceTaskNoteLine(task.note, parsed.index, correction.after);
        await updateTask(userId, parsed.taskId, { note });
        results.push({ ...base, ok: true });
        continue;
      }

      if (parsed.kind === "user_preference") {
        const existing = await getUserPreferences(userId);
        const description = updateUserPreferencesAt(existing, parsed.index, correction.after);
        await setUserPreferences(userId, description);
        results.push({ ...base, ok: true });
        continue;
      }

      results.push({ ...base, error: "Unknown record type" });
    } catch (e) {
      results.push({
        ...base,
        error: e instanceof Error ? e.message : "Apply failed",
      });
    }
  }

  return results;
}
