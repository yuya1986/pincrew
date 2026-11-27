"use client";

import { useState } from "react";
import { formatCoordinates, formatPinDate, pinEmoji, pinTitle } from "@/lib/pins/display";
import type { SavedPin } from "@/lib/pins/types";
import { PhotoViewer } from "@/components/pins/PhotoViewer";
import { PinPhotos } from "@/components/pins/PinPhotos";
import type { PinPhoto } from "@/lib/pins/photos";

type PinDetailCardProps = {
  pin: SavedPin;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onPhotosChange?: (photos: PinPhoto[]) => void;
};

export function PinDetailCard({
  pin,
  canManage,
  onClose,
  onEdit,
  onDelete,
  onShare,
  onPhotosChange,
}: PinDetailCardProps) {
  const [photos, setPhotos] = useState<PinPhoto[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const title = pinTitle(pin);
  const coverUrl = photos[0]?.url ?? null;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${pin.latitude},${pin.longitude}`;
  const appleMapsUrl = `https://maps.apple.com/?ll=${pin.latitude},${pin.longitude}&q=${encodeURIComponent(title)}`;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-3">
      <article
        className="pointer-events-auto mb-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[min(72dvh,640px)] w-full max-w-md overflow-y-auto rounded-[28px] bg-white p-5 shadow-[0_-8px_32px_rgba(36,48,56,0.16)]"
      >
        <div className="flex items-start gap-3">
          {coverUrl ? (
            <button type="button" onClick={() => setViewerIndex(0)} aria-label="写真を大きく見る" className="shrink-0">
              {/* Signed URLs expire, so the browser loads them directly. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="保存した写真" className="h-16 w-16 rounded-2xl object-cover" />
            </button>
          ) : (
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl"
              style={{ backgroundColor: pin.color }}
            >
              {pinEmoji(pin.icon)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold leading-7">{title}</h2>
            <p className="mt-1 text-base text-muted">{pin.category}</p>
            {pin.status === "pending" ? <p className="mt-1 text-base text-brand">公開待ち</p> : null}
            {pin.createdByLabel ? <p className="mt-1 text-base text-muted">{pin.createdByLabel}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="text-base font-medium text-muted">
            閉じる
          </button>
        </div>

        <PinPhotos
          pinId={pin.id}
          canDelete={canManage}
          onChange={(next) => {
            setPhotos(next);
            setViewerIndex((current) => (current !== null && current >= next.length ? null : current));
            onPhotosChange?.(next);
          }}
          onOpen={setViewerIndex}
        />

        <dl className="mt-4 space-y-3 text-base">
          <div>
            <dt className="text-muted">住所</dt>
            <dd>{pin.address.trim() || "未入力"}</dd>
          </div>
          <div>
            <dt className="text-muted">日時</dt>
            <dd>{formatPinDate(pin.visitedAt)}</dd>
          </div>
          {pin.memo.trim() ? (
            <div>
              <dt className="text-muted">メモ</dt>
              <dd className="whitespace-pre-wrap leading-7">{pin.memo}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted">緯度経度</dt>
            <dd>{formatCoordinates(pin.latitude, pin.longitude)}</dd>
          </div>
        </dl>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {canManage ? (
            <button type="button" onClick={onEdit} className="h-12 rounded-full bg-brand text-base font-bold text-white">
              編集
            </button>
          ) : null}
          {canManage ? (
            <button type="button" onClick={onDelete} className="h-12 rounded-full bg-[#f4f1ec] text-base font-bold">
              削除
            </button>
          ) : null}
          <button type="button" onClick={onShare} className="h-12 rounded-full bg-[#f4f1ec] text-base font-bold">
            共有
          </button>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center rounded-full bg-[#f4f1ec] text-base font-bold"
          >
            Google Maps
          </a>
          <a
            href={appleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 flex h-12 items-center justify-center rounded-full bg-[#f4f1ec] text-base font-bold"
          >
            Apple Mapsで開く
          </a>
        </div>
      </article>
      {viewerIndex !== null ? (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          title={title}
          memo={pin.memo}
          onClose={() => setViewerIndex(null)}
          onIndex={setViewerIndex}
        />
      ) : null}
    </div>
  );
}
