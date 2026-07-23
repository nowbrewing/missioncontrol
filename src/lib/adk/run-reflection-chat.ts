import { buildWeekRecap, filterWeekRecapToPillar } from "../build-week-recap";
import { mostRecentCompletedWeek } from "../reflection-week";
import { buildGeneralChatOrientation } from "./build-general-chat-orientation";
import { buildJournalPillarContext } from "./build-journal-pillar-context";
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
  weekEnd?: string,
  pillarId?: number | null
) {
  const range =
    weekMonday && weekEnd
      ? { week_monday: weekMonday, week_end: weekEnd }
      : mostRecentCompletedWeek(planDate);

  const fullRecap = await buildWeekRecap(userId, range.week_monday, range.week_end);
  const scopedPillarId =
    pillarId != null && Number.isFinite(pillarId) ? Number(pillarId) : null;

  if (scopedPillarId == null) {
    const orientation = await buildGeneralChatOrientation(userId, planDate);
    return {
      range,
      recap: fullRecap,
      pillar_id: null as number | null,
      pillar_name: null as string | null,
      kickoff: formatReflectionKickoff(fullRecap),
      systemInstruction: `${REFLECTION_CHAT_INSTRUCTION}

${formatWeekRecapForPrompt(fullRecap)}

${orientation}`,
    };
  }

  const recap = filterWeekRecapToPillar(fullRecap, scopedPillarId);
  const pillarCtx = await buildJournalPillarContext(userId, planDate, scopedPillarId);
  const pillarName =
    pillarCtx?.pillarName ??
    recap.pillars[0]?.name ??
    `Pillar ${scopedPillarId}`;

  return {
    range,
    recap,
    pillar_id: scopedPillarId,
    pillar_name: pillarName,
    kickoff: formatReflectionKickoff(recap, pillarName),
    systemInstruction: `${REFLECTION_CHAT_INSTRUCTION}

You are journaling with the user about one life pillar: ${pillarName}.
Prefer this pillar's context notes, milestones (open and historical), and week activity over other pillars.

${pillarCtx?.block ?? `(Pillar ${scopedPillarId} not found.)`}

${formatWeekRecapForPrompt(recap)}`,
  };
}

export async function runReflectionChat(params: {
  userId: number;
  planDate: string;
  message: string;
  history?: LifeAgentMessage[];
  weekMonday?: string;
  weekEnd?: string;
  pillarId?: number | null;
}): Promise<string> {
  const { systemInstruction } = await buildReflectionSystemContext(
    params.userId,
    params.planDate,
    params.weekMonday,
    params.weekEnd,
    params.pillarId
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
