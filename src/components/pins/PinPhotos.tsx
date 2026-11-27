"use client";

import { useEffect, useRef, useState } from "react";
import { addPinPhoto, deletePinPhoto, listPinPhotos, PhotoError, type PinPhoto } from "@/lib/pins/photos";

type PinPhotosProps = {
  pinId: string;
  canDelete: boolean;
  onChange?: (photos: PinPhoto[]) => void;
  onOpen?: (index: number) => void;
};

export function PinPhotos({ pinId, canDelete, onChange, onOpen }: PinPhotosProps) {
  const [photos, setPhotos] = useState<PinPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    listPinPhotos(pinId)
      .then((next) => {
        if (cancelled) return;
        setPhotos(next);
        onChangeRef.current?.(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setNotice(error instanceof PhotoError ? error.message : "写真を読み込めませんでした");
      });

    return () => {
      cancelled = true;
    };
  }, [pinId]);

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      for (const file of files) {
        await addPinPhoto(pinId, file);
      }
    } catch (error) {
      setNotice(error instanceof PhotoError ? error.message : "写真を追加できませんでした");
    } finally {
      try {
        const next = await listPinPhotos(pinId);
        setPhotos(next);
        onChange?.(next);
      } catch {
        setNotice((current) => current ?? "写真を読み込めませんでした");
      }
      setBusy(false);
    }
  }

  async function remove(photoId: string) {
    setBusy(true);
    setNotice(null);
    try {
      await deletePinPhoto(pinId, photoId);
      setPhotos((current) => {
        const next = current.filter((photo) => photo.id !== photoId);
        onChange?.(next);
        return next;
      });
    } catch (error) {
      setNotice(error instanceof PhotoError ? error.message : "写真を削除できませんでした");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base text-muted">写真</p>
        <label className="relative inline-flex h-10 cursor-pointer items-center rounded-full bg-[#f4f1ec] px-4 text-base font-bold">
          {busy ? "追加しています" : "写真を追加"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              event.target.value = "";
              void addFiles(selected);
            }}
          />
        </label>
      </div>
      {notice ? <p className="mt-2 text-base leading-7 text-muted">{notice}</p> : null}
      {photos.length > 0 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, index) => (
            <li key={photo.id} className="relative shrink-0">
              <button type="button" onClick={() => onOpen?.(index)} aria-label="写真を大きく見る" className="block">
                {/* Signed URLs expire, so the browser loads them directly. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="保存した写真" className="h-20 w-20 rounded-2xl object-cover" />
              </button>
              {canDelete ? (
                <button
                  type="button"
                  aria-label="写真を削除"
                  disabled={busy}
                  onClick={() => void remove(photo.id)}
                  className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-base font-bold"
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
