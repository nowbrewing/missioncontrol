import { OPEN_CHAT_INSTRUCTION } from "./open-chat-prompt";
import { buildOpenChatContext } from "./build-open-chat-context";
import { planOpenChatContext } from "./classify-open-chat-context";
import { generateGeminiText } from "./gemini-text";
import { listPillars } from "../mongodb/store/users";
import type { LifeAgentMessage } from "./run-life-agent";

function formatHistory(history: LifeAgentMessage[]) {
  if (history.length === 0) return "";
  const lines = history.map((m) => {
    const label = m.role === "user" ? "User" : "Assistant";
    return `${label}: ${m.content}`;
  });
  return `\n\nCONVERSATION SO FAR:\n${lines.join("\n\n")}`;
}

export async function runOpenChat(params: {
  userId: number;
  planDate: string;
  message: string;
  history?: LifeAgentMessage[];
}): Promise<string> {
  const history = params.history ?? [];
  const pillars = await listPillars(params.userId);
  const plan = await planOpenChatContext({
    message: params.message,
    history,
    pillars: pillars.map((p) => ({
      id: Number(p.id),
      name: String(p.name),
      abbreviation: p.abbreviation ? String(p.abbreviation) : null,
      description: p.description ? String(p.description) : null,
    })),
    planDate: params.planDate,
  });

  const systemContext = await buildOpenChatContext(
    params.userId,
    params.planDate,
    plan
  );
  const historyBlock = formatHistory(history);

  const prompt = `${OPEN_CHAT_INSTRUCTION}

${systemContext}${historyBlock}

USER MESSAGE:
${params.message.trim()}`;

  return generateGeminiText(prompt);
}
