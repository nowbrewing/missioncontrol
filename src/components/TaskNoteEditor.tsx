"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ActionIconButton, { DeleteIcon } from "./ActionIconButton";
import TaskPillarNoteFields from "./calendar/TaskPillarNoteFields";
import {
  compressImageFileToDataUrl,
  MAX_TASK_NOTE_IMAGES,
  newTaskNoteImageId,
  type TaskNoteImage,
} from "../lib/task-note-images";
import type { PillarNoteFieldDef, PillarNoteFieldValues } from "../lib/pillar-note-fields";

function stopDndPropagation(e: React.SyntheticEvent) {
  e.stopPropagation();
}

function fieldValuesEqual(a: PillarNoteFieldValues, b: PillarNoteFieldValues) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? "") !== (b[key] ?? "")) return false;
  }
  return true;
}

export type TaskNoteChange = {
  note: string | null;
  note_images: TaskNoteImage[];
  note_field_values: PillarNoteFieldValues;
};

export default function TaskNoteEditor({
  note,
  noteImages = [],
  noteFields = [],
  noteFieldValues = {},
  onChange,
  taskTitle,
  className = "",
}: {
  note: string | null;
  noteImages?: TaskNoteImage[];
  noteFields?: PillarNoteFieldDef[];
  noteFieldValues?: PillarNoteFieldValues;
  onChange: (change: TaskNoteChange) => void | Promise<void>;
  taskTitle?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [images, setImages] = useState<TaskNoteImage[]>(noteImages);
  const [fieldValues, setFieldValues] = useState<PillarNoteFieldValues>(noteFieldValues);
  const [saving, setSaving] = useState(false);
  const [addingImage, setAddingImage] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setDraft(note ?? "");
      setImages(noteImages);
      setFieldValues(noteFieldValues);
    }
  }, [note, noteImages, noteFieldValues, open]);

  function openModal(e: React.MouseEvent) {
    stopDndPropagation(e);
    setDraft(note ?? "");
    setImages(noteImages);
    setFieldValues(noteFieldValues);
    setSaveError(null);
    setSaved(false);
    setOpen(true);
  }

  function closeModal() {
    if (saving || addingImage) return;
    setOpen(false);
    setSaveError(null);
    setSaved(false);
  }

  function imagesEqual(a: TaskNoteImage[], b: TaskNoteImage[]) {
    if (a.length !== b.length) return false;
    return a.every((img, i) => img.id === b[i]?.id && img.src === b[i]?.src);
  }

  async function save() {
    if (saving || addingImage) return;
    const value = draft.trim() || null;
    const sameText = value === (note?.trim() || null);
    const sameImages = imagesEqual(images, noteImages);
    const sameFields = fieldValuesEqual(fieldValues, noteFieldValues);
    if (sameText && sameImages && sameFields) {
      closeModal();
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await onChange({
        note: value,
        note_images: images,
        note_field_values: fieldValues,
      });
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

  const hasFieldValues = Object.values(noteFieldValues).some((v) => v?.trim());
  const hasNote = !!note?.trim() || noteImages.length > 0 || hasFieldValues;
  const busy = saving || addingImage;

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="modalOverlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-note-title"
            onClick={(e) => e.target === e.currentTarget && !busy && closeModal()}
          >
            <div className="modalCard taskNoteModal" onPaste={onPaste}>
              <h2 id="task-note-title" className="modalTitle">
                Task note
              </h2>
              {taskTitle ? (
                <p className="modalNote taskNoteModalTaskTitle">{taskTitle}</p>
              ) : null}

              <div className="modalForm">
                <div className="modalField">
                  <label className="modalLabel" htmlFor="task-note-text">
                    Note
                  </label>
                  <textarea
                    id="task-note-text"
                    className="invInput taskNoteModalInput"
                    value={draft}
                    disabled={busy}
                    placeholder="Leave a note for yourself… Paste or attach images below."
                    rows={10}
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
                </div>

                <TaskPillarNoteFields
                  fields={noteFields}
                  values={fieldValues}
                  disabled={busy}
                  onChange={setFieldValues}
                />

                <div className="taskNoteImagesSection">
                  <div className="taskNoteImagesHeader">
                    <span className="modalLabel">Images</span>
                    <button
                      type="button"
                      className="outlineButton btnCompact"
                      disabled={busy || images.length >= MAX_TASK_NOTE_IMAGES}
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
                            disabled={busy}
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
              </div>

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
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="chatSendBtn"
                  onClick={() => void save()}
                  disabled={busy}
                >
                  {saving ? "Saving..." : "Save note"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={`boardSoftBtn ${hasNote ? "boardSoftBtnActive" : ""} ${className}`.trim()}
        onPointerDown={stopDndPropagation}
        onMouseDown={stopDndPropagation}
        onClick={openModal}
        title={hasNote ? "View or edit note" : "Add a note"}
        aria-label={hasNote ? "View or edit note" : "Add a note"}
      >
        {hasNote ? "Note" : "+ Note"}
      </button>
      {modal}
    </>
  );
}
