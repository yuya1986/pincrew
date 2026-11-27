"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { PinPhoto } from "@/lib/pins/photos";

type PhotoViewerProps = {
  photos: PinPhoto[];
  index: number;
  title: string;
  memo: string;
  onClose: () => void;
  onIndex: (index: number) => void;
};

export function PhotoViewer({ photos, index, title, memo, onClose, onIndex }: PhotoViewerProps) {
  const photo = photos[index];
  const note = memo.trim();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      if (event.key === "ArrowRight" && index < photos.length - 1) onIndex(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onClose, onIndex, photos.length]);

  if (!photo || typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-50 flex flex-col bg-[#1c2428] text-white" role="dialog" aria-modal="true" aria-label="写真">
      <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="min-w-0 truncate text-base font-bold">{title}</p>
        <button type="button" onClick={onClose} className="h-11 shrink-0 px-2 text-base font-bold">
          閉じる
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-3">
        {/* Signed URLs expire, so the browser loads them directly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt="保存した写真" className="max-h-full max-w-full object-contain" />
      </div>
      {note ? <p className="px-5 pt-3 text-base leading-7">{note}</p> : null}
      {photos.length > 1 ? (
        <div className="grid grid-cols-2 gap-2 px-5 pt-3" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onIndex(index - 1)}
            className="h-12 rounded-full bg-white/10 text-base font-bold disabled:opacity-40"
          >
            前の写真
          </button>
          <button
            type="button"
            disabled={index === photos.length - 1}
            onClick={() => onIndex(index + 1)}
            className="h-12 rounded-full bg-white/10 text-base font-bold disabled:opacity-40"
          >
            次の写真
          </button>
        </div>
      ) : (
        <div style={{ height: "max(1rem, env(safe-area-inset-bottom))" }} />
      )}
    </div>,
    document.body,
  );
}
