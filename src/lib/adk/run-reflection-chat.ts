import { buildWeekRecap } from "../build-week-recap";
import { mostRecentCompletedWeek } from "../reflection-week";
import { buildGeneralChatOrientation } from "./build-general-chat-orientation";
import {
  formatReflectionKickoff,
  formatWeekRecapForPrompt,
} from "./build-reflection-context";
import { REFLECTION_CHAT_INSTRUCTION } from "./reflection-prompt";
import { generateGeminiChat, type GeminiChatTurn } from "./gemini-text";
import type { LifeAgentMessage } from "./run-life-agent";

export async function buildReflectionSystemContext(
  userId: number,
  planDate: string,
  weekMonday?: string,
  weekEnd?: string
) {
  const range =
    weekMonday && weekEnd
      ? { week_monday: weekMonday, week_end: weekEnd }
      : mostRecentCompletedWeek(planDate);

  const [recap, orientation] = await Promise.all([
    buildWeekRecap(userId, range.week_monday, range.week_end),
    buildGeneralChatOrientation(userId, planDate),
  ]);

  return {
    range,
    recap,
    kickoff: formatReflectionKickoff(recap),
    systemInstruction: `${REFLECTION_CHAT_INSTRUCTION}

${formatWeekRecapForPrompt(recap)}

${orientation}`,
  };
}

export async function runReflectionChat(params: {
  userId: number;
  planDate: string;
  message: string;
  history?: LifeAgentMessage[];
  weekMonday?: string;
  weekEnd?: string;
}): Promise<string> {
  const { systemInstruction } = await buildReflectionSystemContext(
    params.userId,
    params.planDate,
    params.weekMonday,
    params.weekEnd
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
