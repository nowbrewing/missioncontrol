import { generateGeminiChat, type GeminiChatTurn } from "../../adk/gemini-text";
import type { LifeAgentMessage } from "../../adk/run-life-agent";
import { buildLightAgentContext } from "../context/light-context";
import { routeSkill } from "./route-skill";
import { LIFE_AGENT_DIRECT_INSTRUCTION } from "./instructions";
import { runGeneralSkill } from "../skills/general";
import { runLifePillarSkill } from "../skills/life-pillar";
import { runCorrectionSkillChat } from "../skills/correction";
import { runCreateTaskSkill } from "../skills/create-task";
import { runEditTaskSkill } from "../skills/edit-task";
import {
  EMPTY_ORCHESTRATOR_RESULT,
  type OrchestratorResult,
  type SkillContext,
  type SkillId,
} from "../types";

function formatHandoffBlock(summary: string | null | undefined) {
  if (!summary?.trim()) return "";
  return `\n\nGENERAL CHAT HANDOFF (relevant context from /general — do not recite verbatim):\n${summary.trim()}`;
}

function toSkillContext(params: {
  userId: number;
  planDate: string;
  message: string;
  history?: LifeAgentMessage[];
  generalHandoffSummary?: string | null;
}): SkillContext {
  return {
    userId: params.userId,
    planDate: params.planDate,
    message: params.message,
    history: params.history ?? [],
    generalHandoffSummary: params.generalHandoffSummary,
  };
}

async function runDirectResponse(ctx: SkillContext): Promise<string> {
  const { block } = await buildLightAgentContext(ctx.userId);
  const handoff = formatHandoffBlock(ctx.generalHandoffSummary);

  const turns: GeminiChatTurn[] = [];
  for (const entry of ctx.history) {
    turns.push({
      role: entry.role === "assistant" ? "model" : "user",
      text: entry.content,
    });
  }
  turns.push({ role: "user", text: ctx.message.trim() });

  const systemInstruction = `${LIFE_AGENT_DIRECT_INSTRUCTION}

Planning date: ${ctx.planDate}

${block}${handoff}`;

  return generateGeminiChat(turns, { systemInstruction });
}

async function dispatchSkill(
  skill: SkillId,
  ctx: SkillContext,
  pillarHint?: string | null
): Promise<OrchestratorResult> {
  switch (skill) {
    case "general": {
      const reply = await runGeneralSkill(ctx);
      return { routed: "general", reply, ...EMPTY_ORCHESTRATOR_RESULT };
    }
    case "life-pillar": {
      const reply = await runLifePillarSkill(ctx, pillarHint);
      return { routed: "life-pillar", reply, ...EMPTY_ORCHESTRATOR_RESULT };
    }
    case "correction": {
      const reply = await runCorrectionSkillChat(ctx);
      return { routed: "correction", reply, ...EMPTY_ORCHESTRATOR_RESULT };
    }
    case "create-task": {
      const result = await runCreateTaskSkill(ctx);
      return {
        routed: "create-task",
        reply: result.reply,
        proposed_tasks: result.proposedTasks,
        task_edits: [],
        correction_proposals: [],
      };
    }
    case "edit-task": {
      const result = await runEditTaskSkill(ctx);
      return {
        routed: "edit-task",
        reply: result.reply,
        proposed_tasks: [],
        task_edits: result.taskEdits,
        correction_proposals: [],
      };
    }
    default: {
      const reply = await runDirectResponse(ctx);
      return { routed: "direct", reply, ...EMPTY_ORCHESTRATOR_RESULT };
    }
  }
}

/**
 * Life Agent orchestrator — routes each turn to a skill or direct response.
 *
 * Two-phase contract for mutating skills:
 * - Phase 1 (interpret): LLM extracts structure → returned as proposed_* for UI confirmation
 * - Phase 2 (execute): deterministic DB writes only after user confirms (existing API routes)
 */
export async function runLifeAgentOrchestrator(params: {
  userId: number;
  planDate: string;
  message: string;
  history?: LifeAgentMessage[];
  generalHandoffSummary?: string | null;
  forcedSkill?: SkillId | null;
}): Promise<OrchestratorResult> {
  const ctx = toSkillContext(params);

  const { skill, pillarHint } = await routeSkill({
    userId: params.userId,
    planDate: params.planDate,
    message: params.message,
    history: ctx.history,
    forcedSkill: params.forcedSkill ?? null,
  });

  if (skill === "direct") {
    const reply = await runDirectResponse(ctx);
    return { routed: "direct", reply, ...EMPTY_ORCHESTRATOR_RESULT };
  }

  return dispatchSkill(skill, ctx, pillarHint);
}

export type { SkillId, OrchestratorResult } from "../types";
