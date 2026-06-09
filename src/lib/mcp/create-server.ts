import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { getMongoDb } from "./mongodb";

const taskInputSchema = z.object({
  title: z.string(),
  pillar: z.string(),
  bucket: z.string(),
  is_new: z.boolean(),
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
        "Save an array of tasks to MongoDB. Each task has title, pillar, bucket, and is_new fields.",
      inputSchema: {
        tasks: z
          .array(taskInputSchema)
          .describe("Array of tasks to insert into MongoDB"),
      },
    },
    async ({ tasks }) => {
      const db = await getMongoDb();
      const docs = tasks.map((task) => ({
        title: task.title,
        pillar: task.pillar,
        bucket: task.bucket,
        is_new: task.is_new,
        created_at: new Date(),
      }));

      const result = await db.collection("tasks").insertMany(docs);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ok: true,
              insertedCount: result.insertedCount,
              insertedIds: Object.values(result.insertedIds),
            }),
          },
        ],
      };
    }
  );

  return server;
}
