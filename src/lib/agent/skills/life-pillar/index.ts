import { generateGeminiText } from "../../../adk/gemini-text";
import type { LifeAgentMessage } from "../../../adk/run-life-agent";
import { buildLightAgentContext } from "../../context/light-context";
import type { SkillContext } from "../../types";
import {
  fetchPillarSkillContext,
  resolvePillarIdFromHint,
} from "./fetch-context";
import { LIFE_PILLAR_SKILL_INSTRUCTION } from "./instructions";

function formatHistory(history: LifeAgentMessage[]) {
  if (history.length === 0) return "";
  return history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

export async function runLifePillarSkill(
  ctx: SkillContext,
  pillarHint?: string | null
): Promise<string> {
  const { pillars, block: lightBlock } = await buildLightAgentContext(ctx.userId);
  const pillarId = resolvePillarIdFromHint(pillarHint ?? null, pillars, ctx.message);

  if (!pillarId) {
    return "Which pillar should I focus on? Name one of your pillars (e.g. Health, Career) and ask again.";
  }

  const pillarCtx = await fetchPillarSkillContext(ctx.userId, ctx.planDate, pillarId);
  if (!pillarCtx) {
    return "I couldn't load that pillar. Try naming one of your configured pillars.";
  }

  const historyBlock = formatHistory(ctx.history);

  return generateGeminiText(
    `${LIFE_PILLAR_SKILL_INSTRUCTION}

${lightBlock}

Planning date: ${ctx.planDate}

${pillarCtx.block}
${historyBlock ? `\nConversation:\n${historyBlock}\n` : ""}

User message:
${ctx.message.trim()}`,
    { retries: 1 }
  );
}
