import { OPEN_CHAT_INSTRUCTION } from "./open-chat-prompt";
import { OPEN_CHAT_TASK_ACTIONS_INSTRUCTION } from "./open-chat-task-prompt";
import { buildOpenChatContext } from "./build-open-chat-context";
import { planOpenChatContext } from "./classify-open-chat-context";
import { generateGeminiText } from "./gemini-text";
import { parseChatTaskActions } from "./parse-chat-task-actions";
import { listPillars } from "../mongodb/store/users";
import type { LifeAgentMessage } from "./run-life-agent";
import type { ParsedProposedTask } from "./parse-proposed-tasks";
import type { ParsedTaskEdit } from "./parse-chat-task-actions";

export type OpenChatResult = {
  reply: string;
  proposedTasks: ParsedProposedTask[];
  taskEdits: ParsedTaskEdit[];
};

function formatHistory(history: LifeAgentMessage[]) {
  if (history.length === 0) return "";
  const lines = history.map((m) => {
    const label = m.role === "user" ? "User" : "Assistant";
    return `${label}: ${m.content}`;
  });
  return `\n\nCONVERSATION SO FAR:\n${lines.join("\n\n")}`;
}

function formatHandoffBlock(summary: string | null | undefined) {
  if (!summary?.trim()) return "";
  return `\n\nGENERAL CHAT HANDOFF (user returned from plain model — relevant context to keep in mind; don't recite verbatim):\n${summary.trim()}`;
}

export async function runOpenChat(params: {
  userId: number;
  planDate: string;
  message: string;
  history?: LifeAgentMessage[];
  generalHandoffSummary?: string | null;
}): Promise<OpenChatResult> {
  const history = params.history ?? [];
  const pillars = await listPillars(params.userId);
  const pillarRows = pillars.map((p) => ({
    id: Number(p.id),
    name: String(p.name),
    abbreviation: p.abbreviation ? String(p.abbreviation) : null,
    description: p.description ? String(p.description) : null,
  }));

  const plan = await planOpenChatContext({
    message: params.message,
    history,
    pillars: pillarRows,
    planDate: params.planDate,
  });

  const systemContext = await buildOpenChatContext(
    params.userId,
    params.planDate,
    plan
  );
  const historyBlock = formatHistory(history);
  const handoffBlock = formatHandoffBlock(params.generalHandoffSummary);

  const prompt = `${OPEN_CHAT_INSTRUCTION}

${OPEN_CHAT_TASK_ACTIONS_INSTRUCTION}

${systemContext}${handoffBlock}${historyBlock}

USER MESSAGE:
${params.message.trim()}`;

  const raw = await generateGeminiText(prompt);
  const parsed = parseChatTaskActions(raw, pillars);

  return {
    reply: parsed.reply || raw.trim(),
    proposedTasks: parsed.proposedTasks,
    taskEdits: parsed.taskEdits,
  };
}
