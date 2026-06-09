import { tool } from "ai";
import { z } from "zod";
import { ensureLifeSchema } from "../../db/life";
import { appendDailyLogEntry } from "../daily-log-entries";
import { requireTursoClient } from "../turso";
import { formatUserContextForPrompt, getUserContext } from "./get-user-context";

export function createMissionTools(userId: number) {
  return {
    getTodayContext: tool({
      description:
        "Fetch the user's full context for today: pillars, goals, milestones, tasks, today's daily log, and recent logs.",
      inputSchema: z.object({}),
      execute: async () => {
        const turso = requireTursoClient();
        const ctx = await getUserContext(turso, userId);
        return { ok: true, context: ctx };
      },
    }),

    completeTask: tool({
      description: "Mark a task as completed or uncompleted by task id.",
      inputSchema: z.object({
        task_id: z.number().describe("The task id to update"),
        completed: z.boolean().describe("true to mark complete, false to reopen"),
      }),
      execute: async ({ task_id, completed }) => {
        const turso = requireTursoClient();
        await ensureLifeSchema(turso);
        const completedAt = completed ? new Date().toISOString() : null;
        await turso.execute({
          sql: `UPDATE tasks SET completed_at = ? WHERE id = ? AND user_id = ?;`,
          args: [completedAt, task_id, userId],
        });
        return { ok: true, task_id, completed };
      },
    }),

    updateDailyFocus: tool({
      description: "Set or update today's daily focus in the daily log.",
      inputSchema: z.object({
        daily_focus: z.string().describe("The key focus for today"),
      }),
      execute: async ({ daily_focus }) => {
        const turso = requireTursoClient();
        const ctx = await getUserContext(turso, userId);
        await appendDailyLogEntry(turso, userId, ctx.today, "daily_focus", daily_focus);
        return { ok: true, daily_focus };
      },
    }),
  };
}

export function buildMissionContextBlock(userId: number, contextJson: string) {
  return `User ID: ${userId}\n\nCurrent user data:\n${contextJson}`;
}

export async function loadMissionContextBlock(userId: number) {
  const turso = requireTursoClient();
  const ctx = await getUserContext(turso, userId);
  return buildMissionContextBlock(userId, formatUserContextForPrompt(ctx));
}
