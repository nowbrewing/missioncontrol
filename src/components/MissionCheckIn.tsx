"use client";

import { useState } from "react";
import { addDaysIsoYyyyMmDd } from "../lib/date";
import { formatRelativeDateLabel } from "../lib/mission-dates";

export default function MissionCheckIn({
  planDate,
  calendarToday,
  onPlanDateChange,
  onProcessed,
}: {
  planDate: string;
  calendarToday: string;
  onPlanDateChange: (date: string) => void;
  onProcessed: (data: { brief: Record<string, unknown> }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [wentWellYesterday, setWentWellYesterday] = useState("");
  const [topOfMindToday, setTopOfMindToday] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  const dayBeforePlan = addDaysIsoYyyyMmDd(planDate, -1);
  const planDateLabel = formatRelativeDateLabel(planDate, calendarToday);
  const wentWellDateLabel =
    dayBeforePlan === calendarToday
      ? "today"
      : dayBeforePlan === addDaysIsoYyyyMmDd(calendarToday, -1)
        ? "yesterday"
        : dayBeforePlan;

  function closeDialog() {
    if (processing) return;
    setOpen(false);
    setProcessError(null);
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

      onProcessed({ brief: data.brief });
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
        <button
          type="button"
          className="chatSendBtn missionCheckInBtn"
          onClick={() => setOpen(true)}
        >
          Morning check-in
        </button>
        <span className="sectionHint missionCheckInPlanHint">
          Planning for {planDateLabel}
          {planDate !== calendarToday ? ` (${planDate})` : ""}
        </span>
      </div>

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
              Morning check-in
            </h2>
            <p className="modalNote">
              Jot what went well and what&apos;s top of mind. Notes are timestamped on
              the Daily tab. We&apos;ll reflect on your week, prioritize open tasks, and
              extract any new work.
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
                  disabled={processing}
                />
                {planDate !== calendarToday && (
                  <p className="sectionHint missionIntakeDateHint">
                    Planning ahead for {planDateLabel} ({planDate}).
                  </p>
                )}
              </div>
              <div className="modalField">
                <label className="modalLabel" htmlFor="went-well">
                  What went well on {wentWellDateLabel}?
                </label>
                <p className="sectionHint missionIntakeDateHint">{dayBeforePlan}</p>
                <textarea
                  id="went-well"
                  className="chatInput"
                  rows={3}
                  value={wentWellYesterday}
                  onChange={(e) => setWentWellYesterday(e.target.value)}
                  placeholder="Wins, progress, things you're grateful for..."
                  disabled={processing}
                  autoFocus
                />
              </div>
              <div className="modalField">
                <label className="modalLabel" htmlFor="top-of-mind">
                  What&apos;s top of mind for {planDateLabel}?
                </label>
                <textarea
                  id="top-of-mind"
                  className="chatInput missionIntakeMain"
                  rows={5}
                  value={topOfMindToday}
                  onChange={(e) => setTopOfMindToday(e.target.value)}
                  placeholder="Dump everything here — errands, work, health, relationships, worries, ideas..."
                  disabled={processing}
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
                disabled={processing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="chatSendBtn"
                onClick={processMorning}
                disabled={
                  processing || (!wentWellYesterday.trim() && !topOfMindToday.trim())
                }
              >
                {processing ? "Processing..." : "Process my day"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
