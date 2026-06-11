import type { DailyLogKind } from "./daily-log-entries";

/** Check-in saves two log blobs per session — backward reflection and forward brain dump. */
export const CHECK_IN_LOG_KINDS = ["went_well", "daily_focus"] as const;
export type CheckInLogKind = (typeof CHECK_IN_LOG_KINDS)[number];

export function isCheckInLogKind(kind: DailyLogKind): kind is CheckInLogKind {
  return kind === "went_well" || kind === "daily_focus";
}

export const CHECK_IN_ENTRY_META: Record<
  CheckInLogKind,
  { title: string; direction: "back" | "forward"; hint: string }
> = {
  went_well: {
    title: "Looking back",
    direction: "back",
    hint: "Wins and reflections",
  },
  daily_focus: {
    title: "Looking ahead",
    direction: "forward",
    hint: "Brain dump and priorities",
  },
};

export const CHECK_IN_KIND_ORDER: CheckInLogKind[] = ["went_well", "daily_focus"];

export function checkInEntryLabel(kind: CheckInLogKind): string {
  return CHECK_IN_ENTRY_META[kind].title;
}
