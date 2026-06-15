import {
  buildCorrectionCorpus,
  formatCorpusForPrompt,
  type CorrectionRecord,
} from "../correction-records";
import { CORRECTION_CHAT_INSTRUCTION } from "./correction-prompt";
import { generateGeminiChat, type GeminiChatTurn } from "./gemini-text";
import type { LifeAgentMessage } from "./run-life-agent";

export async function buildCorrectionSystemContext(userId: number, planDate: string) {
  const { scope, records } = await buildCorrectionCorpus(userId, planDate);
  return {
    scope,
    records,
    systemInstruction: `${CORRECTION_CHAT_INSTRUCTION}

${formatCorpusForPrompt(records, scope)}`,
  };
}

export async function runCorrectionChat(params: {
  userId: number;
  planDate: string;
  message: string;
  history?: LifeAgentMessage[];
}): Promise<string> {
  const { systemInstruction } = await buildCorrectionSystemContext(
    params.userId,
    params.planDate
  );

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

export type { CorrectionRecord };
