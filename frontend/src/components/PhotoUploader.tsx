"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { deleteUpload, uploadImages } from "@/lib/api";
import { MAX_PHOTOS } from "@/lib/types";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIDE = 1600;

type Item = {
  key: string;
  preview: string; // blob: URL for instant display
  status: "uploading" | "done" | "error";
  id?: string; // upload id once saved
  error?: string;
  file: File;
};

/** Shrinks big photos (keeps uploads under the 2 MB limit). Falls back to the original file. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size <= 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    return blob ?? file;
  } catch {
    return file;
  }
}

type Props = {
  /** Called with the saved upload ids (in order), the preview URLs (in order) and whether uploads are still running. */
  onChange: (state: { ids: string[]; previews: string[]; uploading: boolean }) => void;
  error?: string;
};

/**
 * "Rasmlar": pick or drop 1–3 photos. Each uploads right away; any can be removed
 * or made the cover (first) before the eʼlon is sent.
 */
export function PhotoUploader({ onChange, error }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Report upward whenever the list changes.
  useEffect(() => {
    onChange({
      ids: items.filter((i) => i.status === "done" && i.id).map((i) => i.id!),
      previews: items.filter((i) => i.status !== "error").map((i) => i.preview),
      uploading: items.some((i) => i.status === "uploading"),
    });
  }, [items, onChange]);

  // Free blob URLs when leaving the page.
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  const patch = (key: string, p: Partial<Item>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function upload(item: Item) {
    patch(item.key, { status: "uploading", error: undefined });
    try {
      const [saved] = await uploadImages([await shrink(item.file)]);
      // Removed while uploading: clean the orphan up.
      if (!itemsRef.current.some((i) => i.key === item.key)) return void deleteUpload(saved.id);
      patch(item.key, { status: "done", id: saved.id });
    } catch (e) {
      patch(item.key, { status: "error", error: e instanceof Error ? e.message : "Yuklab boʻlmadi" });
    }
  }

  function addFiles(list: FileList | File[]) {
    setNotice(undefined);
    const files = Array.from(list);
    const room = MAX_PHOTOS - itemsRef.current.length;
    const good = files.filter((f) => ACCEPT.includes(f.type));
    if (good.length < files.length) setNotice("Faqat JPG, PNG yoki WEBP rasmlar qoʻshildi.");
    if (good.length > room) setNotice(`Koʻpi bilan ${MAX_PHOTOS} ta rasm. Ortiqchasi qoʻshilmadi.`);
    const fresh: Item[] = good.slice(0, Math.max(0, room)).map((file) => ({
      key: crypto.randomUUID(),
      preview: URL.createObjectURL(file),
      status: "uploading",
      file,
    }));
    if (fresh.length === 0) return;
    setItems((l) => [...l, ...fresh]);
    fresh.forEach(upload);
  }

  function remove(item: Item) {
    setItems((l) => l.filter((i) => i.key !== item.key));
    URL.revokeObjectURL(item.preview);
    if (item.id) void deleteUpload(item.id);
  }

  function makeCover(item: Item) {
    setItems((l) => [item, ...l.filter((i) => i.key !== item.key)]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  const full = items.length >= MAX_PHOTOS;

  return (
    <fieldset aria-describedby="photos-hint">
      <legend className="font-semibold">
        Rasmlar <span className="text-stamp">*</span>
      </legend>
      <p id="photos-hint" className="mt-0.5 text-sm text-muted">
        1–{MAX_PHOTOS} ta rasm · JPG, PNG yoki WEBP · birinchisi muqova boʻladi
      </p>

      <ul className="uploader mt-3">
        {items.map((item, i) => (
          <li key={item.key} className={`up-tile ${item.status === "error" ? "is-error" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.preview} alt={`${i + 1}-rasm`} />
            {i === 0 && item.status !== "error" && <span className="up-badge">Muqova</span>}

            {item.status === "uploading" && (
              <span className="up-state" role="status">
                <span className="up-spin" aria-hidden />
                Yuklanmoqda…
              </span>
            )}
            {item.status === "error" && (
              <span className="up-state" role="alert">
                {item.error}
                <button type="button" className="up-retry" onClick={() => upload(item)}>
                  Qayta urinish
                </button>
              </span>
            )}

            <div className="up-actions">
              {i > 0 && item.status === "done" && (
                <button type="button" onClick={() => makeCover(item)} aria-label={`${i + 1}-rasmni muqova qilish`}>
                  Muqova qilish
                </button>
              )}
              <button
                type="button"
                className="up-remove"
                onClick={() => remove(item)}
                aria-label={`${i + 1}-rasmni oʻchirish`}
              >
                ×
              </button>
            </div>
          </li>
        ))}

        {!full && (
          <li>
            <label
              className={`up-drop ${dragOver ? "is-over" : ""} ${error ? "is-invalid" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT.join(",")}
                multiple
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <span className="up-plus" aria-hidden>
                +
              </span>
              <span className="font-semibold">Rasm qoʻshish</span>
              <span className="text-xs text-muted">
                yoki shu yerga tashlang · yana {MAX_PHOTOS - items.length} ta
              </span>
            </label>
          </li>
        )}
      </ul>

      {(error || notice) && (
        <p role="alert" className="mt-2 text-sm font-medium text-stamp">
          {error ?? notice}
        </p>
      )}
    </fieldset>
  );
}
