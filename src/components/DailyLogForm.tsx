"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonthsToDate,
  formatLogDateLabel,
  monthBoundsFor,
  monthLabelFor,
} from "../lib/date";
import {
  CHECK_IN_ENTRY_META,
  CHECK_IN_KIND_ORDER,
  checkInEntryLabel,
  isCheckInLogKind,
} from "../lib/check-in-log";
import {
  assistantChatEntryLabel,
  isAssistantChatLogKind,
  logKindShowsPillarTags,
} from "../lib/assistant-chat-log";
import PillarChip from "./PillarChip";

type Pillar = {
  id: number;
  name: string;
  abbreviation?: string | null;
  color: string;
  rank: number;
};

type DailyLogEntry = {
  id: number;
  log_date: string;
  kind: "went_well" | "went_poorly" | "daily_focus" | "assistant_chat";
  content: string;
  pillar_ids?: number[];
  created_at: string;
};

const LEGACY_KIND_LABELS: Record<"went_poorly", string> = {
  went_poorly: "What didn't go well",
};

function entryKindLabel(kind: DailyLogEntry["kind"]): string {
  if (isCheckInLogKind(kind)) return checkInEntryLabel(kind);
  if (isAssistantChatLogKind(kind)) return assistantChatEntryLabel();
  return LEGACY_KIND_LABELS[kind];
}

const KIND_ORDER: DailyLogEntry["kind"][] = [
  ...CHECK_IN_KIND_ORDER,
  "assistant_chat",
  "went_poorly",
];

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

function groupEntriesByDate(entries: DailyLogEntry[]) {
  const byDate = new Map<string, DailyLogEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.log_date) ?? [];
    list.push(entry);
    byDate.set(entry.log_date, list);
  }
  return [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a));
}

function EntryPillarTags({
  entry,
  pillars,
}: {
  entry: DailyLogEntry;
  pillars: Pillar[];
}) {
  if (!logKindShowsPillarTags(entry.kind)) return null;

  const ids = entry.pillar_ids ?? [];
  const tagged = ids
    .map((id) => pillars.find((p) => p.id === id))
    .filter((p): p is Pillar => p != null);

  return (
    <div className="dailyLogEntryTags" aria-label="Pillar alignment">
      <span className="dailyLogEntryTagsLabel">Aligns to</span>
      {tagged.length === 0 ? (
        <span className="pill pillSubtle" title="No specific pillar — applies broadly">
          General
        </span>
      ) : (
        tagged.map((pillar) => (
          <PillarChip
            key={pillar.id}
            name={pillar.name}
            abbreviation={pillar.abbreviation}
            color={pillar.color}
            compact
          />
        ))
      )}
    </div>
  );
}

function LogEntryRow({
  entry,
  pillars,
  onChanged,
}: {
  entry: DailyLogEntry;
  pillars: Pillar[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(entry.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(entry.content);
    setEditing(false);
    setError(null);
  }, [entry.id, entry.content]);

  async function save() {
    const text = content.trim();
    if (!text) {
      setError("Entry cannot be empty — delete it instead.");
      return;
    }

    setSaving(true);
    setError(null);
    const res = await fetch(`/api/daily-log/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setEditing(false);
      onChanged();
    } else {
      setError(data.error || "Could not save");
    }
  }

  async function remove() {
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;

    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/daily-log/entries/${entry.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeleting(false);
    if (data.ok) {
      onChanged();
    } else {
      setError(data.error || "Could not delete");
    }
  }

  const busy = saving || deleting;
  const checkInMeta = isCheckInLogKind(entry.kind) ? CHECK_IN_ENTRY_META[entry.kind] : null;

  return (
    <li className="dailyLogEntry">
      <div className="dailyLogEntryHead">
        <div className="dailyLogEntryKindWrap">
          {checkInMeta ? (
            <>
              <span
                className={`dailyLogEntryDirection dailyLogEntryDirection${checkInMeta.direction === "back" ? "Back" : "Forward"}`}
              >
                {checkInMeta.direction === "back" ? "Backward" : "Forward"}
              </span>
              <span className="dailyLogEntryKind">{checkInMeta.title}</span>
              <span className="dailyLogEntryKindHint">{checkInMeta.hint}</span>
            </>
          ) : (
            <span className="dailyLogEntryKind">{entryKindLabel(entry.kind)}</span>
          )}
        </div>
        <time className="dailyLogEntryTime" dateTime={entry.created_at}>
          {formatEntryTime(entry.created_at)}
        </time>
      </div>
      <EntryPillarTags entry={entry} pillars={pillars} />
      {editing ? (
        <>
          <textarea
            className="chatInput dailyLogEntryInput"
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={busy}
          />
          <div className="dailyLogEntryActions">
            <button
              type="button"
              className="btnCompact chatSendBtn"
              onClick={() => void save()}
              disabled={busy || content.trim() === entry.content}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="btnCompact outlineButton"
              onClick={() => {
                setContent(entry.content);
                setEditing(false);
                setError(null);
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btnCompact outlineButton"
              onClick={() => void remove()}
              disabled={busy}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="dailyLogEntryBody">{entry.content}</p>
          <div className="dailyLogEntryActions">
            <button
              type="button"
              className="btnCompact outlineButton"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          </div>
        </>
      )}
      {error ? <span className="pill pillWarn">{error}</span> : null}
    </li>
  );
}

function DayGroup({
  logDate,
  entries,
  pillars,
  onChanged,
}: {
  logDate: string;
  entries: DailyLogEntry[];
  pillars: Pillar[];
  onChanged: () => void;
}) {
  const sorted = [...entries].sort((a, b) => {
    const kindA = KIND_ORDER.indexOf(a.kind);
    const kindB = KIND_ORDER.indexOf(b.kind);
    if (kindA !== kindB) return kindA - kindB;
    return a.created_at.localeCompare(b.created_at);
  });
  const hasCheckIn = sorted.some((e) => isCheckInLogKind(e.kind));

  return (
    <section className="dailyLogDayGroup">
      <div className="dailyLogDayHead">
        <h2 className="dailyLogDayTitle">{formatLogDateLabel(logDate)}</h2>
        {hasCheckIn ? (
          <p className="sectionHint dailyLogDaySubtitle">
            Check-in — looking back and looking ahead
          </p>
        ) : null}
      </div>
      <ul className="dailyLogEntryList">
        {sorted.map((entry) => (
          <LogEntryRow
            key={entry.id}
            entry={entry}
            pillars={pillars}
            onChanged={onChanged}
          />
        ))}
      </ul>
    </section>
  );
}

export default function DailyLogForm() {
  const now = new Date();
  const defaultBounds = monthBoundsFor(now);
  const [viewMonth, setViewMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [customRange, setCustomRange] = useState(false);
  const [fromDate, setFromDate] = useState(defaultBounds.from);
  const [toDate, setToDate] = useState(defaultBounds.to);
  const [draftFrom, setDraftFrom] = useState(defaultBounds.from);
  const [draftTo, setDraftTo] = useState(defaultBounds.to);
  const [entries, setEntries] = useState<DailyLogEntry[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(true);

  const periodLabel = useMemo(() => {
    if (customRange) {
      const fromLabel = formatLogDateLabel(fromDate);
      const toLabel = formatLogDateLabel(toDate);
      return fromDate === toDate ? fromLabel : `${fromLabel} – ${toLabel}`;
    }
    return monthLabelFor(viewMonth);
  }, [customRange, fromDate, toDate, viewMonth]);

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true);
    const res = await fetch(
      `/api/daily-log?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
    const data = await res.json();
    setEntries(data.ok ? (data.entries ?? []) : []);
    setPillars(data.ok ? (data.pillars ?? []) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(fromDate, toDate);
  }, [fromDate, toDate, load]);

  function goToMonth(monthStart: Date) {
    const bounds = monthBoundsFor(monthStart);
    setViewMonth(monthStart);
    setCustomRange(false);
    setFromDate(bounds.from);
    setToDate(bounds.to);
    setDraftFrom(bounds.from);
    setDraftTo(bounds.to);
  }

  function shiftMonth(delta: number) {
    goToMonth(addMonthsToDate(viewMonth, delta));
  }

  function applyCustomRange() {
    if (draftFrom > draftTo) return;
    setCustomRange(true);
    setFromDate(draftFrom);
    setToDate(draftTo);
  }

  const grouped = groupEntriesByDate(entries);

  return (
    <div className="sections">
      <div className="dailyLogPeriodBar">
        <div className="dailyLogPeriodNav">
          <button
            type="button"
            className="btnCompact outlineButton dailyLogPeriodBtn"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            ←
          </button>
          <h2 className="dailyLogPeriodLabel">{periodLabel}</h2>
          <button
            type="button"
            className="btnCompact outlineButton dailyLogPeriodBtn"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
          >
            →
          </button>
        </div>
        {!customRange && (
          <button
            type="button"
            className="btnCompact outlineButton"
            onClick={() => {
              setDraftFrom(fromDate);
              setDraftTo(toDate);
              setCustomRange(true);
            }}
          >
            Change date range
          </button>
        )}
      </div>

      {customRange && (
        <div className="dailyLogRangeForm card">
          <div className="dailyLogRangeFields">
            <div className="modalField">
              <label className="modalLabel" htmlFor="log-from">
                From
              </label>
              <input
                id="log-from"
                className="invInput invInputDate"
                type="date"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
              />
            </div>
            <div className="modalField">
              <label className="modalLabel" htmlFor="log-to">
                To
              </label>
              <input
                id="log-to"
                className="invInput invInputDate"
                type="date"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
              />
            </div>
          </div>
          <div className="dailyLogEntryActions">
            <button
              type="button"
              className="btnCompact chatSendBtn"
              onClick={applyCustomRange}
              disabled={draftFrom > draftTo}
            >
              Apply
            </button>
            <button
              type="button"
              className="btnCompact outlineButton"
              onClick={() => goToMonth(viewMonth)}
            >
              Back to {monthLabelFor(viewMonth)}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="subtitle">Loading...</p>
      ) : grouped.length === 0 ? (
        <div className="card">
          <p className="sectionHint" style={{ margin: 0 }}>
            Nothing saved for this period. Entries appear here after you check in on Mission
            Control.
          </p>
        </div>
      ) : (
        grouped.map(([logDate, dayEntries]) => (
          <DayGroup
            key={logDate}
            logDate={logDate}
            entries={dayEntries}
            pillars={pillars}
            onChanged={() => load(fromDate, toDate)}
          />
        ))
      )}
    </div>
  );
}
