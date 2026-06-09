"use client";

import { useEffect, useRef, useState } from "react";

function stopDndPropagation(e: React.SyntheticEvent) {
  e.stopPropagation();
}

export default function TaskTitleEditor({
  title,
  onChange,
  completed = false,
  className = "",
}: {
  title: string;
  onChange: (title: string) => void | Promise<void>;
  completed?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [displayTitle, setDisplayTitle] = useState(title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayTitle(title);
    if (!editing) setDraft(title);
  }, [title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function commit() {
    if (saving) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(displayTitle);
      setEditing(false);
      return;
    }
    if (trimmed === displayTitle) {
      setEditing(false);
      return;
    }

    setEditing(false);
    setDisplayTitle(trimmed);
    setSaving(true);
    try {
      await onChange(trimmed);
    } catch {
      setDisplayTitle(title);
      setDraft(title);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(displayTitle);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className={`taskTitleInput ${className}`}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onPointerDown={stopDndPropagation}
        onMouseDown={stopDndPropagation}
        onClick={stopDndPropagation}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
          if (e.key === "Escape") cancel();
        }}
        aria-label="Edit task title"
      />
    );
  }

  return (
    <button
      type="button"
      className={`taskTitleBtn ${completed ? "taskDone" : ""} ${className}`}
      onPointerDown={stopDndPropagation}
      onMouseDown={stopDndPropagation}
      onClick={(e) => {
        stopDndPropagation(e);
        setEditing(true);
      }}
      title="Click to rewrite"
      disabled={saving}
    >
      {displayTitle}
    </button>
  );
}
