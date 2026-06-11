"use client";

import { useState } from "react";
import {
  addDaysIsoYyyyMmDd,
  shouldAskPrioritizeDayChoice,
  tomorrowIsoYyyyMmDd,
} from "../lib/date";
import { formatRelativeDateLabel } from "../lib/mission-dates";
import { CHECK_IN_ENTRY_META } from "../lib/check-in-log";

export default function MissionCheckIn({
  planDate,
  calendarToday,
  onPlanDateChange,
  onProcessed,
}: {
  planDate: string;
  calendarToday: string;
  onPlanDateChange: (date: string) => void;
  onProcessed: (data: {
    brief: Record<string, unknown>;
    proposed_tasks?: {
      title: string;
      pillar: string;
      pillar_id: number | null;
      deadline: string | null;
      bucket: "Today" | "This Week" | "Later";
    }[];
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prioritizeDayOpen, setPrioritizeDayOpen] = useState(false);
  const [wentWellYesterday, setWentWellYesterday] = useState("");
  const [topOfMindToday, setTopOfMindToday] = useState("");
  const [processing, setProcessing] = useState(false);
  const [prioritizing, setPrioritizing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [prioritizeError, setPrioritizeError] = useState<string | null>(null);

  const busy = processing || prioritizing;
  const tomorrow = tomorrowIsoYyyyMmDd();
  const tomorrowLabel = formatRelativeDateLabel(tomorrow, calendarToday);

  const dayBeforePlan = addDaysIsoYyyyMmDd(planDate, -1);
  const planDateLabel = formatRelativeDateLabel(planDate, calendarToday);
  const wentWellDateLabel =
    dayBeforePlan === calendarToday
      ? "today"
      : dayBeforePlan === addDaysIsoYyyyMmDd(calendarToday, -1)
        ? "yesterday"
        : dayBeforePlan;

  function closeDialog() {
    if (busy) return;
    setOpen(false);
    setProcessError(null);
  }

  function closePrioritizeDayDialog() {
    if (busy) return;
    setPrioritizeDayOpen(false);
  }

  function onPrioritizeClick() {
    if (shouldAskPrioritizeDayChoice(calendarToday, planDate)) {
      setPrioritizeDayOpen(true);
      return;
    }
    void runPrioritize(planDate);
  }

  async function runPrioritize(forDate: string) {
    setPrioritizing(true);
    setPrioritizeError(null);
    setPrioritizeDayOpen(false);
    try {
      const res = await fetch("/api/mission/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_date: forDate }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Prioritization failed");
      }

      if (forDate !== planDate) {
        onPlanDateChange(forDate);
      }

      onProcessed({
        brief: data.brief,
        proposed_tasks: [],
      });
    } catch (e) {
      setPrioritizeError(e instanceof Error ? e.message : "Prioritization failed");
    } finally {
      setPrioritizing(false);
    }
  }

  async function processMorning() {
    const wentWell = wentWellYesterday.trim();
    const topOfMind = topOfMindToday.trim();
    if (!wentWell && !topOfMind) return;

    setProcessing(true);
    setProcessError(null);
    try {
      const res = await fetch("/api/mission/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          went_well_yesterday: wentWell,
          top_of_mind_today: topOfMind,
          plan_date: planDate,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Processing failed");
      }

      onProcessed({
        brief: data.brief,
        proposed_tasks: data.proposed_tasks ?? [],
      });
      setWentWellYesterday("");
      setTopOfMindToday("");
      setOpen(false);
    } catch (e) {
      setProcessError(e instanceof Error ? e.message : "Processing failed");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <>
      <div className="missionCheckInBar">
        <div className="missionCheckInActions">
          <button
            type="button"
            className="chatSendBtn missionCheckInBtn"
            onClick={() => setOpen(true)}
            disabled={busy}
          >
            Check In
          </button>
          <button
            type="button"
            className="outlineButton missionPrioritizeBtn"
            onClick={onPrioritizeClick}
            disabled={busy}
          >
            {prioritizing ? "Prioritizing..." : "Prioritize"}
          </button>
        </div>
        <span className="sectionHint missionCheckInPlanHint">
          Planning for {planDateLabel}
          {planDate !== calendarToday ? ` (${planDate})` : ""}
        </span>
      </div>

      {prioritizeError && (
        <div className="chatErrorBox missionBarError">
          <strong>Could not prioritize</strong>
          <p className="chatError">{prioritizeError}</p>
        </div>
      )}

      {prioritizeDayOpen && (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prioritize-day-title"
          onClick={(e) => e.target === e.currentTarget && closePrioritizeDayDialog()}
        >
          <div className="modalCard missionPrioritizeDayModal">
            <h2 id="prioritize-day-title" className="modalTitle">
              Reprioritize for when?
            </h2>
            <p className="modalNote">
              It&apos;s past 3pm — do you want to reshuffle what&apos;s left of today, or
              start planning {tomorrowLabel}?
            </p>
            <div className="modalActions missionPrioritizeDayActions">
              <button
                type="button"
                className="outlineButton"
                onClick={closePrioritizeDayDialog}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="outlineButton"
                onClick={() => void runPrioritize(calendarToday)}
                disabled={busy}
              >
                Rest of today
              </button>
              <button
                type="button"
                className="chatSendBtn"
                onClick={() => void runPrioritize(tomorrow)}
                disabled={busy}
              >
                {tomorrowLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mission-check-in-title"
          onClick={(e) => e.target === e.currentTarget && closeDialog()}
        >
          <div className="modalCard missionCheckInModal">
            <h2 id="mission-check-in-title" className="modalTitle">
              Check In
            </h2>
            <p className="modalNote">
              Two entries per check-in: {CHECK_IN_ENTRY_META.went_well.title.toLowerCase()}{" "}
              (wins) and {CHECK_IN_ENTRY_META.daily_focus.title.toLowerCase()} (brain dump).
              New projects you mention are auto-saved to the matching pillar&apos;s context.
            </p>

            <div className="modalForm missionIntakeFields">
              <div className="modalField missionIntakeDateField">
                <label className="modalLabel" htmlFor="plan-date">
                  Planning for
                </label>
                <input
                  id="plan-date"
                  className="invInput invInputDate"
                  type="date"
                  value={planDate}
                  onChange={(e) => onPlanDateChange(e.target.value)}
                  disabled={busy}
                />
                {planDate !== calendarToday && (
                  <p className="sectionHint missionIntakeDateHint">
                    Planning ahead for {planDateLabel} ({planDate}).
                  </p>
                )}
              </div>
              <div className="modalField">
                <label className="modalLabel" htmlFor="went-well">
                  {CHECK_IN_ENTRY_META.went_well.title} — what went well on{" "}
                  {wentWellDateLabel}?
                </label>
                <p className="sectionHint missionIntakeFieldHint">
                  {CHECK_IN_ENTRY_META.went_well.hint}
                </p>
                <textarea
                  id="went-well"
                  className="chatInput"
                  rows={3}
                  value={wentWellYesterday}
                  onChange={(e) => setWentWellYesterday(e.target.value)}
                  placeholder="Wins, progress, things you're grateful for..."
                  disabled={busy}
                  autoFocus
                />
              </div>
              <div className="modalField">
                <label className="modalLabel" htmlFor="top-of-mind">
                  {CHECK_IN_ENTRY_META.daily_focus.title} — what&apos;s top of mind for{" "}
                  {planDateLabel}?
                </label>
                <p className="sectionHint missionIntakeFieldHint">
                  {CHECK_IN_ENTRY_META.daily_focus.hint}. The agent uses this for new tasks.
                </p>
                <textarea
                  id="top-of-mind"
                  className="chatInput missionIntakeMain"
                  rows={5}
                  value={topOfMindToday}
                  onChange={(e) => setTopOfMindToday(e.target.value)}
                  placeholder="Dump everything here — errands, work, health, relationships, worries, ideas..."
                  disabled={busy}
                />
              </div>
            </div>

            {processError && (
              <div className="chatErrorBox">
                <strong>Could not process</strong>
                <p className="chatError">{processError}</p>
              </div>
            )}

            <div className="modalActions">
              <button
                type="button"
                className="outlineButton"
                onClick={closeDialog}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="chatSendBtn"
                onClick={processMorning}
                disabled={busy || (!wentWellYesterday.trim() && !topOfMindToday.trim())}
              >
                {processing
                  ? "Saving..."
                  : topOfMindToday.trim()
                    ? "Process brain dump"
                    : "Save wins"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
