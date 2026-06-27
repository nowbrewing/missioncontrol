import { generateGeminiText } from "../../../adk/gemini-text";
import { parseChatTaskActions } from "../../../adk/parse-chat-task-actions";
import { listTasks } from "../../../mongodb/store/tasks";
import { listPillars } from "../../../mongodb/store/users";
import type { ParsedTaskEdit } from "../../../adk/parse-chat-task-actions";
import { buildLightAgentContext } from "../../context/light-context";
import type { SkillContext } from "../../types";
import { EDIT_TASK_SKILL_INSTRUCTION } from "./instructions";

function formatHistory(history: import("../../../adk/run-life-agent").LifeAgentMessage[]) {
  if (history.length === 0) return "";
  return history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

export type EditTaskSkillResult = {
  reply: string;
  taskEdits: ParsedTaskEdit[];
};

/**
 * /edit-task — interpret phase → structured edits for confirmation (no DB write).
 */
export async function runEditTaskSkill(ctx: SkillContext): Promise<EditTaskSkillResult> {
  const [{ block }, pillars, tasks] = await Promise.all([
    buildLightAgentContext(ctx.userId),
    listPillars(ctx.userId),
    listTasks(ctx.userId),
  ]);

  const pillarById = new Map(pillars.map((p) => [Number(p.id), String(p.name)]));
  const open = tasks.filter((t) => !t.completed_at);
  const openBlock = open.length
    ? open
        .map((t) => {
          const pillar = pillarById.get(Number(t.pillar_id)) ?? "Unassigned";
          const notePart = t.note?.trim()
            ? `\n  note: ${t.note.trim().slice(0, 120)}`
            : "";
          return `- id=${t.id} "${t.title}" (${pillar})${t.deadline ? ` due ${t.deadline}` : ""}${notePart}`;
        })
        .join("\n")
    : "(no open tasks)";

  const historyBlock = formatHistory(ctx.history);

  const raw = await generateGeminiText(
    `${EDIT_TASK_SKILL_INSTRUCTION}

${block}

Planning date: ${ctx.planDate}

OPEN TASKS:
${openBlock}
${historyBlock ? `\nConversation:\n${historyBlock}\n` : ""}

User message:
${ctx.message.trim()}`,
    { retries: 1 }
  );

  const parsed = parseChatTaskActions(raw, pillars);
  return {
    reply: parsed.reply || raw.trim(),
    taskEdits: parsed.taskEdits,
  };
}
