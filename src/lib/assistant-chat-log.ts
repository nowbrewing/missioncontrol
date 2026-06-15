import type { DailyLogKind } from "./daily-log-entries";
import { isWeeklySummaryLogKind } from "./weekly-summary-log";

export const ASSISTANT_CHAT_LOG_KIND = "assistant_chat" as const satisfies DailyLogKind;

export function isAssistantChatLogKind(
  kind: DailyLogKind
): kind is typeof ASSISTANT_CHAT_LOG_KIND {
  return kind === ASSISTANT_CHAT_LOG_KIND;
}

export function assistantChatEntryLabel(): string {
  return "Assistant chat";
}

export function logKindShowsPillarTags(kind: DailyLogKind): boolean {
  return (
    kind === "went_well" ||
    kind === "daily_focus" ||
    kind === ASSISTANT_CHAT_LOG_KIND ||
    isWeeklySummaryLogKind(kind)
  );
}
