export type ChatMode = "copilot" | "general" | "correction";

export type ForcedSkillId =
  | "general"
  | "life-pillar"
  | "correction"
  | "create-task"
  | "edit-task";

const SLASH_SKILL_MAP: { pattern: RegExp; skill: ForcedSkillId }[] = [
  { pattern: /^\/general\b/i, skill: "general" },
  { pattern: /^\/life-pillar\b/i, skill: "life-pillar" },
  { pattern: /^\/pillar\b/i, skill: "life-pillar" },
  { pattern: /^\/correction\b/i, skill: "correction" },
  { pattern: /^\/create-task\b/i, skill: "create-task" },
  { pattern: /^\/add-task\b/i, skill: "create-task" },
  { pattern: /^\/edit-task\b/i, skill: "edit-task" },
  { pattern: /^\/update-task\b/i, skill: "edit-task" },
];

export function parseChatSlashCommand(input: string): {
  modeSwitch?: ChatMode;
  forcedSkill?: ForcedSkillId;
  message: string;
  navigate?: string;
} {
  const trimmed = input.trim();
  if (!trimmed) return { message: "" };

  if (/^\/refelction\b/i.test(trimmed) || /^\/reflection\b/i.test(trimmed)) {
    return {
      navigate: "/reflection",
      message: trimmed.replace(/^\/refelction\b/i, "").replace(/^\/reflection\b/i, "").trim(),
    };
  }

  for (const { pattern, skill } of SLASH_SKILL_MAP) {
    if (pattern.test(trimmed)) {
      const message = trimmed.replace(pattern, "").trim();
      if (skill === "general") {
        return { modeSwitch: "general", forcedSkill: "general", message };
      }
      if (skill === "correction") {
        return { modeSwitch: "correction", forcedSkill: "correction", message };
      }
      return { forcedSkill: skill, message };
    }
  }

  if (/^\/(?:copilot|co-pilot|mission|coach)\b/i.test(trimmed)) {
    return {
      modeSwitch: "copilot",
      message: trimmed.replace(/^\/(?:copilot|co-pilot|mission|coach)\b/i, "").trim(),
    };
  }

  return { message: trimmed };
}

/** @deprecated Use orchestrator routing; kept for API compat. */
export function normalizeChatMode(mode: string | undefined): ChatMode {
  if (mode === "general") return "general";
  if (mode === "correction") return "correction";
  return "copilot";
}
