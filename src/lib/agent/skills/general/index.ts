import { buildGeneralChatOrientation } from "../../../adk/build-general-chat-orientation";
import { generateGeminiChat, type GeminiChatTurn } from "../../../adk/gemini-text";
import type { LifeAgentMessage } from "../../../adk/run-life-agent";
import type { SkillContext } from "../../types";
import { GENERAL_SKILL_INSTRUCTION } from "./instructions";

/**
 * /general — interpretation only, no execution phase.
 */
export async function runGeneralSkill(ctx: SkillContext): Promise<string> {
  const orientation = await buildGeneralChatOrientation(ctx.userId, ctx.planDate);
  const systemInstruction = `${GENERAL_SKILL_INSTRUCTION}\n\n${orientation}`;

  const turns: GeminiChatTurn[] = [];
  for (const entry of ctx.history) {
    turns.push({
      role: entry.role === "assistant" ? "model" : "user",
      text: entry.content,
    });
  }
  turns.push({ role: "user", text: ctx.message.trim() });

  return generateGeminiChat(turns, { systemInstruction });
}
