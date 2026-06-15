"use client";

import { useEffect, useState } from "react";

function stopDndPropagation(e: React.SyntheticEvent) {
  e.stopPropagation();
}

export default function TaskNoteEditor({
  note,
  onChange,
  taskTitle,
  className = "",
}: {
  note: string | null;
  onChange: (note: string | null) => void | Promise<void>;
  taskTitle?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) setDraft(note ?? "");
  }, [note, open]);

  function openModal(e: React.MouseEvent) {
    stopDndPropagation(e);
    setDraft(note ?? "");
    setSaveError(null);
    setSaved(false);
    setOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setOpen(false);
    setSaveError(null);
    setSaved(false);
  }

  async function save() {
    if (saving) return;
    const value = draft.trim() || null;
    if (value === (note?.trim() || null)) {
      closeModal();
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await onChange(value);
      setSaved(true);
      window.setTimeout(() => {
        setOpen(false);
        setSaved(false);
      }, 700);
    } catch {
      setSaveError("Could not save note");
    } finally {
      setSaving(false);
    }
  }

  const hasNote = !!note?.trim();

  return (
    <>
      <button
        type="button"
        className={`taskNoteBtn ${hasNote ? "taskNoteBtnHasNote" : ""} ${className}`.trim()}
        onPointerDown={stopDndPropagation}
        onMouseDown={stopDndPropagation}
        onClick={openModal}
        title={hasNote ? "View or edit note" : "Add a note"}
        aria-label={hasNote ? "View or edit note" : "Add a note"}
      >
        {hasNote ? "Note" : "+ Note"}
      </button>

      {open ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-note-title"
          onClick={(e) => e.target === e.currentTarget && !saving && closeModal()}
        >
          <div className="modalCard taskNoteModal">
            <h2 id="task-note-title" className="modalTitle">
              Task note
            </h2>
            {taskTitle ? (
              <p className="modalNote taskNoteModalTaskTitle">{taskTitle}</p>
            ) : null}
            <textarea
              className="invInput taskNoteModalInput"
              value={draft}
              disabled={saving}
              placeholder="Leave a note for yourself…"
              rows={5}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeModal();
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void save();
                }
              }}
              aria-label="Task note"
            />
            {saveError ? <p className="chatError">{saveError}</p> : null}
            {saved ? (
              <p className="taskNoteSavedNotice" role="status">
                Saved
              </p>
            ) : null}
            <div className="modalActions">
              <button
                type="button"
                className="outlineButton"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="chatSendBtn"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save note"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
