"use client";

import { pinEmoji, pinTitle } from "@/lib/pins/display";
import type { SavedPin } from "@/lib/pins/types";

type ConfirmDialogProps = {
  pin: SavedPin;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({ pin, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-[#243038]/40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-pin-title"
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(36,48,56,0.2)]"
      >
        <h2 id="delete-pin-title" className="text-xl font-bold">
          このピンを削除しますか？
        </h2>
        <p className="mt-3 text-base leading-7 text-muted">
          <span className="mr-1">{pinEmoji(pin.icon)}</span>
          {pinTitle(pin)} を削除します。直後なら元に戻せます。
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-full bg-[#f4f1ec] text-base font-bold"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-12 rounded-full bg-[#243038] text-base font-bold text-white"
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}
