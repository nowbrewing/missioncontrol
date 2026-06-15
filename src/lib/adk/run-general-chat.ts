import { buildGeneralChatOrientation } from "./build-general-chat-orientation";
import { GENERAL_CHAT_INSTRUCTION } from "./general-chat-prompt";
import { generateGeminiChat, type GeminiChatTurn } from "./gemini-text";
import type { LifeAgentMessage } from "./run-life-agent";

export async function runGeneralChat(params: {
  userId: number;
  planDate: string;
  message: string;
  history?: LifeAgentMessage[];
}): Promise<string> {
  const orientation = await buildGeneralChatOrientation(params.userId, params.planDate);
  const systemInstruction = `${GENERAL_CHAT_INSTRUCTION}\n\n${orientation}`;

  const turns: GeminiChatTurn[] = [];

  for (const entry of params.history ?? []) {
    turns.push({
      role: entry.role === "assistant" ? "model" : "user",
      text: entry.content,
    });
  }

  turns.push({ role: "user", text: params.message.trim() });

  return generateGeminiChat(turns, { systemInstruction });
}
