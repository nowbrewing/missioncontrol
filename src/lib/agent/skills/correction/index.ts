import { runCorrectionChat } from "../../../adk/run-correction-chat";
import { proposeCorrections } from "../../../adk/propose-corrections";
import { buildCorrectionCorpus } from "../../../correction-records";
import type { ProposedCorrection } from "../../../adk/propose-corrections";
import type { SkillContext } from "../../types";

/**
 * /correction — interpretation phase: conversational clarification.
 */
export async function runCorrectionSkillChat(ctx: SkillContext): Promise<string> {
  return runCorrectionChat({
    userId: ctx.userId,
    planDate: ctx.planDate,
    message: ctx.message,
    history: ctx.history,
  });
}

/**
 * /correction — execution phase (after user confirms): propose structured fixes.
 * Still requires explicit apply confirmation in the UI.
 */
export async function proposeCorrectionSkill(
  ctx: SkillContext
): Promise<ProposedCorrection[]> {
  const { scope, records } = await buildCorrectionCorpus(ctx.userId, ctx.planDate);
  const messages = [...ctx.history];
  if (ctx.message.trim()) {
    messages.push({ role: "user", content: ctx.message });
  }
  return proposeCorrections({ scope, records, messages });
}
