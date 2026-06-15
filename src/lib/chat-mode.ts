export type ChatMode = "copilot" | "general" | "reflection";

export function parseChatSlashCommand(input: string): {
  modeSwitch?: ChatMode;
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

  if (/^\/correction\b/i.test(trimmed)) {
    return {
      navigate: "/correction",
      message: trimmed.replace(/^\/correction\b/i, "").trim(),
    };
  }

  if (/^\/general\b/i.test(trimmed)) {
    return {
      modeSwitch: "general",
      message: trimmed.replace(/^\/general\b/i, "").trim(),
    };
  }

  if (/^\/(?:copilot|co-pilot|mission|coach)\b/i.test(trimmed)) {
    return {
      modeSwitch: "copilot",
      message: trimmed.replace(/^\/(?:copilot|co-pilot|mission|coach)\b/i, "").trim(),
    };
  }

  return { message: trimmed };
}

export function normalizeChatMode(mode: string | undefined): ChatMode {
  return mode === "general" ? "general" : "copilot";
}
