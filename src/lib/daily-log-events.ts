export const DAILY_LOG_CHANGED_EVENT = "mission:daily-log-changed";

export function notifyDailyLogChanged(logDate?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DAILY_LOG_CHANGED_EVENT, {
      detail: logDate ? { log_date: logDate } : undefined,
    })
  );
}
