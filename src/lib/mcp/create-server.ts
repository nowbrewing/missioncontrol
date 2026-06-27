import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { completeTaskForUser, saveTasksForUser } from "./persist-tasks";
import { saveDayPlanForUser } from "./save-day-plan";

const taskInputSchema = z.object({
  title: z.string(),
  pillar: z.string().optional(),
  deadline: z.string().nullable().optional(),
  is_new: z.boolean().optional(),
});

export function createMcpServer() {
  const server = new McpServer(
    {
      name: "mission-control-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.registerTool(
    "save_tasks",
    {
      title: "Save Tasks",
      description:
        "Create new tasks for a user after they confirm the plan. Requires user_id from SYSTEM CONTEXT. Each task needs a title; pillar is a pillar name string.",
      inputSchema: {
        user_id: z.number().describe("Turso user id from SYSTEM CONTEXT"),
        tasks: z.array(taskInputSchema).describe("Tasks to create"),
      },
    },
    async ({ user_id, tasks }) => {
      const created = await saveTasksForUser(user_id, tasks);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, created_count: created.length, tasks: created }),
          },
        ],
      };
    }
  );

  server.registerTool(
    "complete_task",
    {
      title: "Complete Task",
      description: "Mark a task complete or reopen it. Requires user_id and task_id.",
      inputSchema: {
        user_id: z.number(),
        task_id: z.number(),
        completed: z.boolean(),
      },
    },
    async ({ user_id, task_id, completed }) => {
      const result = await completeTaskForUser(user_id, task_id, completed);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  server.registerTool(
    "save_day_plan",
    {
      title: "Save Day Plan",
      description:
        "Persist the confirmed daily plan: reflection text plus optional task id buckets (Today, Next 7 days, Later). Call after user confirms.",
      inputSchema: {
        user_id: z.number(),
        plan_date: z.string().describe("YYYY-MM-DD planning date"),
        reflection: z.string(),
        today_task_ids: z.array(z.number()).optional(),
        this_week_task_ids: z.array(z.number()).optional(),
        later_task_ids: z.array(z.number()).optional(),
        flags: z.array(z.string()).optional(),
      },
    },
    async (input) => {
      const result = await saveDayPlanForUser(input.user_id, input.plan_date, input);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }
  );

  return server;
}
