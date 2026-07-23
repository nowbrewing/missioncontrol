"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ActionIconButton, { DeleteIcon } from "../ActionIconButton";
import TaskPillarSelect from "../TaskPillarSelect";
import TaskPillarNoteFields from "./TaskPillarNoteFields";
import {
  compressImageFileToDataUrl,
  MAX_TASK_NOTE_IMAGES,
  newTaskNoteImageId,
  type TaskNoteImage,
} from "../../lib/task-note-images";
import type { PillarNoteFieldDef, PillarNoteFieldValues } from "../../lib/pillar-note-fields";
import type { PlanningIdeaTask } from "./PlanningIdeas";

export type PlanningIdeaModalPillar = {
  id: number;
  name: string;
  abbreviation?: string | null;
  note_fields?: PillarNoteFieldDef[];
};

export type PlanningIdeaModalPatch = {
  title: string;
  note: string | null;
  note_images: TaskNoteImage[];
  note_field_values: PillarNoteFieldValues;
  deadline: string | null;
  pillar_id: number | null;
  completed?: boolean;
};

type Props = {
  idea: PlanningIdeaTask;
  pillars: PlanningIdeaModalPillar[];
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: PlanningIdeaModalPatch) => Promise<void>;
  onDelete: () => Promise<void>;
};

function isScheduledTask(idea: PlanningIdeaTask) {
  return !!idea.deadline || Number(idea.is_idea) === 0;
}

export default function PlanningIdeaModal({
  idea,
  pillars,
  open,
  busy,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [title, setTitle] = useState(idea.title);
  const [note, setNote] = useState(idea.note ?? "");
  const [images, setImages] = useState<TaskNoteImage[]>(idea.note_images ?? []);
  const [noteFieldValues, setNoteFieldValues] = useState<PillarNoteFieldValues>(
    idea.note_field_values ?? {}
  );
  const [deadline, setDeadline] = useState(idea.deadline ?? "");
  const [pillarId, setPillarId] = useState<number | null>(idea.pillar_id ?? null);
  const [completed, setCompleted] = useState(!!idea.completed_at);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addingImage, setAddingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(idea.title);
    setNote(idea.note ?? "");
    setImages(idea.note_images ?? []);
    setNoteFieldValues(idea.note_field_values ?? {});
    setDeadline(idea.deadline ?? "");
    setPillarId(idea.pillar_id ?? null);
    setCompleted(!!idea.completed_at);
    setSaveError(null);
    setAddingImage(false);
  }, [open, idea]);

  const noteFields = useMemo(
    () =>
      pillarId != null
        ? (pillars.find((p) => p.id === pillarId)?.note_fields ?? [])
        : [],
    [pillars, pillarId]
  );

  if (!open) return null;

  const scheduled = isScheduledTask(idea);
  const modalBusy = busy || addingImage;

  async function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;

    const room = MAX_TASK_NOTE_IMAGES - images.length;
    if (room <= 0) {
      setSaveError(`You can attach up to ${MAX_TASK_NOTE_IMAGES} images.`);
      return;
    }

    setAddingImage(true);
    setSaveError(null);
    try {
      const next = [...images];
      for (const file of files.slice(0, room)) {
        const src = await compressImageFileToDataUrl(file);
        next.push({ id: newTaskNoteImageId(), src });
      }
      setImages(next);
      if (files.length > room) {
        setSaveError(`Only ${room} more image${room === 1 ? "" : "s"} fit (max ${MAX_TASK_NOTE_IMAGES}).`);
      }
    } catch {
      setSaveError("Could not add image");
    } finally {
      setAddingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  function onPaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData.items);
    const imageFiles = items
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => !!f);
    if (imageFiles.length === 0) return;
    e.preventDefault();
    void addFiles(imageFiles);
  }

  async function save() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || modalBusy) return;

    setSaveError(null);
    try {
      await onSave({
        title: trimmedTitle,
        note: note.trim() || null,
        note_images: images,
        note_field_values: noteFieldValues,
        deadline: deadline.trim() || null,
        pillar_id: pillarId,
        ...(scheduled ? { completed } : {}),
      });
      onClose();
    } catch {
      setSaveError("Could not save idea");
    }
  }

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="planning-idea-modal-title"
      onClick={(e) => e.target === e.currentTarget && !modalBusy && onClose()}
    >
      <div className="modalCard planningIdeaModal" onPaste={onPaste}>
        <div className="planningIdeaModalHeader">
          <h2 id="planning-idea-modal-title" className="modalTitle">
            {scheduled ? "Task" : "Idea"}
          </h2>
          <ActionIconButton
            label={`Delete idea: ${idea.title}`}
            onClick={() => void onDelete()}
            disabled={modalBusy}
            variant="danger"
          >
            <DeleteIcon />
          </ActionIconButton>
        </div>

        <div className="modalForm planningIdeaModalForm">
          <div className="modalField">
            <label className="modalLabel" htmlFor="planning-idea-title">
              Title
            </label>
            <input
              id="planning-idea-title"
              className="invInput"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={modalBusy}
              autoFocus
            />
          </div>

          <div className="modalField">
            <label className="modalLabel" htmlFor="planning-idea-pillar">
              Pillar
            </label>
            <TaskPillarSelect
              pillars={pillars}
              value={pillarId}
              onChange={setPillarId}
            />
          </div>

          <div className="modalField">
            <label className="modalLabel" htmlFor="planning-idea-note">
              Note
            </label>
            <textarea
              id="planning-idea-note"
              className="invInput planningIdeaModalNoteInput"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Leave a note for yourself… Paste or attach images below."
              rows={10}
              disabled={modalBusy}
            />
          </div>

          <TaskPillarNoteFields
            fields={noteFields}
            values={noteFieldValues}
            disabled={modalBusy}
            onChange={setNoteFieldValues}
          />

          <div className="taskNoteImagesSection">
            <div className="taskNoteImagesHeader">
              <span className="modalLabel">Images</span>
              <button
                type="button"
                className="outlineButton btnCompact"
                disabled={modalBusy || images.length >= MAX_TASK_NOTE_IMAGES}
                onClick={() => fileInputRef.current?.click()}
              >
                {addingImage ? "Adding…" : "Add image"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) void addFiles(e.target.files);
                }}
              />
            </div>
            {images.length > 0 ? (
              <ul className="taskNoteImagesList">
                {images.map((img) => (
                  <li key={img.id} className="taskNoteImageThumb">
                    <img src={img.src} alt="" />
                    <ActionIconButton
                      label="Remove image"
                      onClick={() => removeImage(img.id)}
                      disabled={modalBusy}
                      variant="danger"
                      className="taskNoteImageRemove"
                    >
                      <DeleteIcon />
                    </ActionIconButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sectionHint taskNoteImagesEmpty">
                Paste a screenshot or add up to {MAX_TASK_NOTE_IMAGES} images.
              </p>
            )}
          </div>

          <div className="modalField">
            <label className="modalLabel" htmlFor="planning-idea-date">
              Schedule on
            </label>
            <input
              id="planning-idea-date"
              type="date"
              className="invInput invInputDate planningIdeaModalDateInput"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={modalBusy}
            />
            <p className="sectionHint planningIdeaModalDateHint">
              {scheduled
                ? "Change the date to move it on the calendar, or clear the date to move it back to Ideas."
                : "Adding a date moves this to the calendar. You can also drag the idea onto a day."}
            </p>
          </div>

          {scheduled ? (
            <label className="planningIdeaCompleteToggle">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                disabled={modalBusy}
              />
              Done
            </label>
          ) : null}
        </div>

        {saveError ? <p className="chatError">{saveError}</p> : null}

        <div className="modalActions">
          <button type="button" className="outlineButton" onClick={onClose} disabled={modalBusy}>
            Cancel
          </button>
          <button
            type="button"
            className="chatSendBtn"
            onClick={() => void save()}
            disabled={modalBusy || !title.trim()}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
