import { generateGeminiText } from "../../adk/gemini-text";
import type { LifeAgentMessage } from "../../adk/run-life-agent";
import { buildLightAgentContext } from "../context/light-context";
import { SKILL_REGISTRY, type SkillDefinition } from "../skills/registry";
import type { RoutedTarget, SkillId } from "../types";

function formatHistory(history: LifeAgentMessage[]) {
  if (history.length === 0) return "";
  const lines = history.map((m) => {
    const label = m.role === "user" ? "User" : "Assistant";
    return `${label}: ${m.content}`;
  });
  return `\nRecent conversation:\n${lines.join("\n\n")}`;
}

function skillListForRouter(): string {
  return SKILL_REGISTRY.map(
    (s: SkillDefinition) =>
      `- "${s.id}": ${s.description}`
  ).join("\n");
}

function parseRouteJson(raw: string): { skill: RoutedTarget; pillar_hint: string | null } {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? raw).trim();
  try {
    const parsed = JSON.parse(body) as {
      skill?: unknown;
      pillar_hint?: unknown;
    };
    const skillRaw = typeof parsed.skill === "string" ? parsed.skill.trim() : "direct";
    const validSkills: RoutedTarget[] = [
      "direct",
      "general",
      "life-pillar",
      "correction",
      "create-task",
      "edit-task",
    ];
    const skill = validSkills.includes(skillRaw as RoutedTarget)
      ? (skillRaw as RoutedTarget)
      : "direct";
    const pillar_hint =
      typeof parsed.pillar_hint === "string" && parsed.pillar_hint.trim()
        ? parsed.pillar_hint.trim()
        : null;
    return { skill, pillar_hint };
  } catch {
    return { skill: "direct", pillar_hint: null };
  }
}

export type RouteResult = {
  skill: RoutedTarget;
  pillarHint: string | null;
};

/**
 * Phase 1 (interpretation): decide which skill handles this turn.
 * Slash-forced skills bypass the router.
 */
export async function routeSkill(params: {
  userId: number;
  planDate: string;
  message: string;
  history: LifeAgentMessage[];
  forcedSkill?: SkillId | null;
}): Promise<RouteResult> {
  if (params.forcedSkill) {
    return { skill: params.forcedSkill, pillarHint: null };
  }

  const { block } = await buildLightAgentContext(params.userId);
  const historyBlock = formatHistory(params.history);

  const raw = await generateGeminiText(
    `You are the routing layer for Mission Control's Life Agent orchestrator.

${block}

Planning date: ${params.planDate}
${historyBlock}

User message:
${params.message.trim()}

Choose exactly ONE handler for this turn:

SKILLS (invoke when the message clearly matches — one only):
${skillListForRouter()}

- "direct": Life Agent answers conversationally with light pillar context only. No database reads beyond pillars, no task creation, no corrections. Use for general chat, emotional processing, prioritization talk, or anything that does not clearly match a skill above.

Rules:
- Pick a skill only when intent is clear. If unsure, use "direct".
- Never pick both create-task and edit-task.
- correction is only for fixing existing stored records, not new work items.
- life-pillar is only when a specific pillar is the subject.
- If life-pillar, set pillar_hint to the pillar name or nickname mentioned.

Return ONLY JSON:
\`\`\`json
{ "skill": "direct", "pillar_hint": null }
\`\`\``,
    { retries: 1 }
  );

  const { skill, pillar_hint } = parseRouteJson(raw);
  return { skill, pillarHint: pillar_hint };
}
