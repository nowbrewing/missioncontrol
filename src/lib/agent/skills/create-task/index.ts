import { generateGeminiText } from "../../../adk/gemini-text";
import { parseChatTaskActions } from "../../../adk/parse-chat-task-actions";
import { listTasks } from "../../../mongodb/store/tasks";
import { listPillars } from "../../../mongodb/store/users";
import type { LifeAgentMessage } from "../../../adk/run-life-agent";
import type { ParsedProposedTask } from "../../../adk/parse-proposed-tasks";
import type { ParsedTaskEdit } from "../../../adk/parse-chat-task-actions";
import { buildLightAgentContext } from "../../context/light-context";
import type { SkillContext } from "../../types";
import { CREATE_TASK_SKILL_INSTRUCTION } from "./instructions";

function formatHistory(history: LifeAgentMessage[]) {
  if (history.length === 0) return "";
  return history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

function formatOpenTasksForPrompt(
  tasks: Awaited<ReturnType<typeof listTasks>>,
  pillarById: Map<number, string>
) {
  const open = tasks.filter((t) => !t.completed_at);
  if (open.length === 0) return "(no open tasks)";
  return open
    .map((t) => {
      const pillar =
        pillarById.get(Number(t.pillar_id)) ?? "Unassigned";
      return `- id=${t.id} "${t.title}" (${pillar})${t.deadline ? ` due ${t.deadline}` : ""}`;
    })
    .join("\n");
}

export type CreateTaskSkillResult = {
  reply: string;
  proposedTasks: ParsedProposedTask[];
};

/**
 * /create-task — interpret phase → structured drafts for confirmation (no DB write).
 */
export async function runCreateTaskSkill(ctx: SkillContext): Promise<CreateTaskSkillResult> {
  const [{ block }, pillars, tasks] = await Promise.all([
    buildLightAgentContext(ctx.userId),
    listPillars(ctx.userId),
    listTasks(ctx.userId),
  ]);

  const pillarById = new Map(pillars.map((p) => [Number(p.id), String(p.name)]));
  const historyBlock = formatHistory(ctx.history);

  const raw = await generateGeminiText(
    `${CREATE_TASK_SKILL_INSTRUCTION}

${block}

Planning date: ${ctx.planDate}

OPEN TASKS (dedupe — do not recreate):
${formatOpenTasksForPrompt(tasks, pillarById)}
${historyBlock ? `\nConversation:\n${historyBlock}\n` : ""}

User message:
${ctx.message.trim()}`,
    { retries: 1 }
  );

  const parsed = parseChatTaskActions(raw, pillars);
  return {
    reply: parsed.reply || raw.trim(),
    proposedTasks: parsed.proposedTasks,
  };
}
