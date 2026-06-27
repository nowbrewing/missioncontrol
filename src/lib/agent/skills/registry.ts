import type { SkillId } from "../types";

export type SkillDefinition = {
  id: SkillId;
  slash: string[];
  /** Mutually exclusive description for the orchestrator router. */
  description: string;
};

/**
 * Registered skills on the Life Agent — callable tools, not sub-agents.
 * Descriptions are written so the router can pick exactly one per turn.
 */
export const SKILL_REGISTRY: SkillDefinition[] = [
  {
    id: "general",
    slash: ["/general"],
    description:
      "Plain, direct assistant — brainstorming, factual Q&A, or anything not tied to a specific pillar, task board change, or record correction. No database writes. Use when the user wants a neutral model or typed /general.",
  },
  {
    id: "life-pillar",
    slash: ["/life-pillar", "/pillar"],
    description:
      "Deep dive on ONE life pillar: synthesize milestones, routines, tagged logs, and open work for that pillar. Use when the user asks about a specific pillar by name or wants pillar-focused planning — NOT for adding tasks or fixing records.",
  },
  {
    id: "correction",
    slash: ["/correction"],
    description:
      "Fix something recorded wrong or ambiguous in logs, pillar context, task notes, or preferences. Use when the user says a stored entry is wrong, vague, or mislabeled — NOT for creating new tasks.",
  },
  {
    id: "create-task",
    slash: ["/create-task", "/add-task"],
    description:
      "Create a new task, routine, or milestone from what the user said. Use when they want to ADD something to the board. Always surfaces assumed pillar for confirmation — never silent writes.",
  },
  {
    id: "edit-task",
    slash: ["/edit-task", "/update-task"],
    description:
      "Change an existing open task or routine (title, deadline, pillar, note). Use when they refer to something already on the board. Presents matched record + proposed changes for confirmation.",
  },
];

export function skillById(id: SkillId): SkillDefinition {
  const skill = SKILL_REGISTRY.find((s) => s.id === id);
  if (!skill) throw new Error(`Unknown skill: ${id}`);
  return skill;
}

export function parseForcedSkillFromSlash(input: string): {
  skill: SkillId | null;
  message: string;
} {
  const trimmed = input.trim();
  for (const def of SKILL_REGISTRY) {
    for (const slash of def.slash) {
      const re = new RegExp(`^${slash.replace("/", "\\/")}\\b`, "i");
      if (re.test(trimmed)) {
        return {
          skill: def.id,
          message: trimmed.replace(re, "").trim(),
        };
      }
    }
  }
  return { skill: null, message: trimmed };
}
