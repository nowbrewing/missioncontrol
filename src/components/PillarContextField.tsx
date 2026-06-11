"use client";

import { useState } from "react";
import { todayIsoYyyyMmDd } from "../lib/date";
import { parsePillarContext } from "../lib/pillar-context";

const CONTEXT_TOOLTIP =
  "Stack notes about active projects and what this pillar means. Use nicknames you'll say in check-in (e.g. \"Hackathon — portfolio + learning for digital consultancy\"). Mission Control uses this to understand shorthand like \"hackathon\" later.";

function truncateForConfirm(text: string, maxLen = 120) {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

function AddContextDialog({
  draft,
  saving,
  onDraftChange,
  onSubmit,
  onClose,
}: {
  draft: string;
  saving: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-context-title"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="modalCard">
        <h2 id="add-context-title" className="modalTitle">
          Add context
        </h2>
        <p className="modalNote">
          Notes are saved with today&apos;s date ({todayIsoYyyyMmDd()}) and stack over
          time — older notes are never overwritten.
        </p>
        <div className="modalForm">
          <div className="modalField">
            <label className="modalLabel" htmlFor="pillar-context-draft">
              Note
            </label>
            <textarea
              id="pillar-context-draft"
              className="chatInput"
              rows={4}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="e.g. Hackathon — learning + portfolio boost for digital consultancy"
              disabled={saving}
              autoFocus
            />
          </div>
        </div>
        <div className="modalActions">
          <button type="button" className="outlineButton" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="chatSendBtn"
            onClick={onSubmit}
            disabled={saving || !draft.trim()}
          >
            {saving ? "Saving..." : "Add context"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PillarContextField({
  description,
  onAppend,
  onRemoveEntry,
  inputId,
  compact = false,
  stackExpanded = true,
  addDialogOpen: addDialogOpenProp,
  onAddDialogOpenChange,
  stackId,
}: {
  description: string | null;
  onAppend: (text: string) => void | Promise<void>;
  onRemoveEntry: (index: number) => void;
  inputId: string;
  compact?: boolean;
  stackExpanded?: boolean;
  addDialogOpen?: boolean;
  onAddDialogOpenChange?: (open: boolean) => void;
  stackId?: string;
}) {
  const [showAddDialogInternal, setShowAddDialogInternal] = useState(false);
  const showAddDialog = addDialogOpenProp ?? showAddDialogInternal;
  const setShowAddDialog = onAddDialogOpenChange ?? setShowAddDialogInternal;
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const entries = parsePillarContext(description);

  async function submitEntry() {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await onAppend(text);
      setDraft("");
      setShowAddDialog(false);
    } finally {
      setSaving(false);
    }
  }

  function closeDialog() {
    if (saving) return;
    setShowAddDialog(false);
    setDraft("");
  }

  function handleRemoveEntry(index: number) {
    const entry = entries[index];
    if (!entry) return;

    const label = truncateForConfirm(entry.text);
    const datePart = entry.at ? ` (${entry.at})` : "";
    const ok = window.confirm(
      `Forget this context note${datePart}?\n\n"${label}"\n\nOnly this line will be removed. Other notes stay.`
    );
    if (ok) onRemoveEntry(index);
  }

  const showStack = !compact || stackExpanded;

  return (
    <div className={`pillarContextField ${compact ? "pillarContextFieldCompact" : ""}`}>
      {!compact && (
        <>
          <div className="pillarContextLabelRow">
            <span className="modalLabel" id={inputId}>
              Context
            </span>
            <button
              type="button"
              className="infoTooltip"
              title={CONTEXT_TOOLTIP}
              aria-label={CONTEXT_TOOLTIP}
            >
              ⓘ
            </button>
          </div>
          <p className="sectionHint pillarContextHint">
            Each note is date-stamped. Use Remove on a specific line to forget just that note.
          </p>
        </>
      )}

      {showStack && entries.length > 0 && (
        <ul
          id={stackId}
          className="pillarContextStack"
          aria-labelledby={compact ? undefined : inputId}
        >
          {entries.map((entry, idx) => (
            <li key={`${entry.at}-${idx}-${entry.text}`} className="pillarContextEntry">
              <div className="pillarContextEntryHeader">
                {entry.at ? (
                  <span className="pillarContextDate">{entry.at}</span>
                ) : (
                  <span className="pillarContextDate">Note {idx + 1}</span>
                )}
                <button
                  type="button"
                  className="pillarContextRemove"
                  onClick={() => handleRemoveEntry(idx)}
                  aria-label={`Remove context note: ${entry.text}`}
                  title={`Remove: ${truncateForConfirm(entry.text, 60)}`}
                >
                  Remove
                </button>
              </div>
              <p className="pillarContextText">{entry.text}</p>
            </li>
          ))}
        </ul>
      )}

      {!compact && (
        <button
          type="button"
          className="outlineButton"
          onClick={() => setShowAddDialog(true)}
        >
          Add context
        </button>
      )}

      {showAddDialog && (
        <AddContextDialog
          draft={draft}
          saving={saving}
          onDraftChange={setDraft}
          onSubmit={submitEntry}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
