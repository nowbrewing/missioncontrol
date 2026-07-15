export type TaskNoteImage = {
  id: string;
  /** Compressed data URL (image/jpeg or image/png / image/webp). */
  src: string;
};

export const MAX_TASK_NOTE_IMAGES = 6;
const MAX_IMAGE_DIM = 1280;
const JPEG_QUALITY = 0.72;
const MAX_DATA_URL_CHARS = 900_000;

const DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

export function newTaskNoteImageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function parseTaskNoteImages(raw: unknown): TaskNoteImage[] {
  if (!Array.isArray(raw)) return [];
  const out: TaskNoteImage[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const src = typeof row.src === "string" ? row.src.trim() : "";
    if (!id || !src || seen.has(id)) continue;
    if (!DATA_URL_RE.test(src) || src.length > MAX_DATA_URL_CHARS) continue;
    seen.add(id);
    out.push({ id, src });
    if (out.length >= MAX_TASK_NOTE_IMAGES) break;
  }

  return out;
}

export function sanitizeTaskNoteImages(images: TaskNoteImage[]): TaskNoteImage[] {
  return parseTaskNoteImages(images);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read file"));
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/** Compress an image file to a JPEG data URL for storage on the task. */
export async function compressImageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image");
  }

  const original = await readFileAsDataUrl(file);
  const img = await loadImage(original);
  const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(img, 0, 0, width, height);

  const jpeg = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  if (jpeg.length > MAX_DATA_URL_CHARS) {
    throw new Error("Image is too large after compression");
  }
  return jpeg;
}
