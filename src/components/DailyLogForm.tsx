"use client";

import { useCallback, useEffect, useState } from "react";

type DailyLogEntry = {
  id: number;
  log_date: string;
  kind: "went_well" | "went_poorly" | "daily_focus";
  content: string;
  created_at: string;
};

type DailyLogByKind = Record<
  "went_well" | "went_poorly" | "daily_focus",
  DailyLogEntry[]
>;

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatEntryTime(createdAt: string) {
  const d = new Date(createdAt.includes("T") ? createdAt : `${createdAt.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return createdAt;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function EntryHistory({
  title,
  entries,
}: {
  title: string;
  entries: DailyLogEntry[];
}) {
  if (entries.length === 0) {
    return (
      <div className="dailyLogHistory">
        <h3 className="dailyLogHistoryTitle">{title}</h3>
        <p className="sectionHint dailyLogHistoryEmpty">No notes yet.</p>
      </div>
    );
  }

  return (
    <div className="dailyLogHistory">
      <h3 className="dailyLogHistoryTitle">
        {title}
        <span className="pill pillSubtle dailyLogCount">{entries.length}</span>
      </h3>
      <ul className="dailyLogEntryList">
        {entries.map((entry) => (
          <li key={entry.id} className="dailyLogEntry">
            <time className="dailyLogEntryTime" dateTime={entry.created_at}>
              {formatEntryTime(entry.created_at)}
            </time>
            <p className="dailyLogEntryBody">{entry.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DailyLogForm() {
  const [date, setDate] = useState(todayIso());
  const [byKind, setByKind] = useState<DailyLogByKind>({
    went_well: [],
    went_poorly: [],
    daily_focus: [],
  });
  const [addWentWell, setAddWentWell] = useState("");
  const [addWentPoorly, setAddWentPoorly] = useState("");
  const [addDailyFocus, setAddDailyFocus] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    const res = await fetch(`/api/daily-log?date=${encodeURIComponent(d)}`);
    const data = await res.json();
    if (data.ok) {
      setByKind(
        data.by_kind ?? {
          went_well: [],
          went_poorly: [],
          daily_focus: [],
        }
      );
    } else {
      setByKind({ went_well: [], went_poorly: [], daily_focus: [] });
    }
    setLoading(false);
    setSaved(false);
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  async function save() {
    const payload = {
      log_date: date,
      went_well: addWentWell,
      went_poorly: addWentPoorly,
      daily_focus: addDailyFocus,
    };
    if (!addWentWell.trim() && !addWentPoorly.trim() && !addDailyFocus.trim()) {
      return;
    }

    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/daily-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setByKind(data.by_kind);
      setAddWentWell("");
      setAddWentPoorly("");
      setAddDailyFocus("");
      setSaved(true);
    }
  }

  return (
    <div className="sections">
      <div className="inlineForm">
        <label className="modalLabel" htmlFor="log-date">
          Date
        </label>
        <input
          id="log-date"
          className="invInput invInputDate"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="subtitle">Loading...</p>
      ) : (
        <>
          <EntryHistory title="What went well" entries={byKind.went_well} />
          <EntryHistory title="What didn't go well" entries={byKind.went_poorly} />
          <EntryHistory title="Key focus for the day" entries={byKind.daily_focus} />

          <section className="section dailyLogAddOn">
            <h2 className="sectionTitle">Add notes</h2>
            <p className="sectionHint">
              New entries are appended with a timestamp — previous notes stay as-is.
            </p>

            <div className="modalField">
              <label className="modalLabel" htmlFor="add-went-well">
                What went well
              </label>
              <textarea
                id="add-went-well"
                className="chatInput"
                rows={3}
                value={addWentWell}
                onChange={(e) => setAddWentWell(e.target.value)}
                placeholder="Add another win or highlight..."
              />
            </div>

            <div className="modalField">
              <label className="modalLabel" htmlFor="add-went-poorly">
                What didn&apos;t go well
              </label>
              <textarea
                id="add-went-poorly"
                className="chatInput"
                rows={3}
                value={addWentPoorly}
                onChange={(e) => setAddWentPoorly(e.target.value)}
                placeholder="Add a challenge or setback..."
              />
            </div>

            <div className="modalField">
              <label className="modalLabel" htmlFor="add-daily-focus">
                Key focus for the day
              </label>
              <textarea
                id="add-daily-focus"
                className="chatInput"
                rows={3}
                value={addDailyFocus}
                onChange={(e) => setAddDailyFocus(e.target.value)}
                placeholder="Add another priority or thought..."
              />
            </div>

            <div className="inlineForm">
              <button
                type="button"
                className="chatSendBtn"
                onClick={save}
                disabled={
                  saving ||
                  (!addWentWell.trim() &&
                    !addWentPoorly.trim() &&
                    !addDailyFocus.trim())
                }
              >
                {saving ? "Saving..." : "Add notes"}
              </button>
              {saved && <span className="pill pillSubtle">Saved</span>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
