"use client";

import { pinEmoji, pinTitle } from "@/lib/pins/display";
import { usePinCovers } from "@/hooks/use-pin-covers";
import type { SavedPin } from "@/lib/pins/types";

type PinChoiceSheetProps = {
  pins: SavedPin[];
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function PinChoiceSheet({ pins, onSelect, onClose }: PinChoiceSheetProps) {
  const covers = usePinCovers(pins.map((pin) => pin.id));

  return (
    <div className="absolute inset-0 z-40 flex items-end">
      <button type="button" className="absolute inset-0 bg-[#243038]/35" aria-label="閉じる" onClick={onClose} />
      <section
        className="relative max-h-[70dvh] w-full overflow-y-auto rounded-t-[28px] bg-white px-5 pt-3 shadow-[0_-12px_40px_rgba(36,48,56,0.16)]"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        aria-label="近くのピン"
      >
        <div className="flex justify-center">
          <span className="h-1.5 w-12 rounded-full bg-[#e6e1d8]" />
        </div>
        <div className="flex items-center justify-between pt-3">
          <h2 className="text-xl font-bold">近くのピン</h2>
          <button type="button" onClick={onClose} className="text-base font-medium text-muted">
            閉じる
          </button>
        </div>
        <p className="mt-1 text-base leading-7 text-muted">重なっているので、見るピンを選んでください。</p>
        <ul className="mt-3 space-y-2">
          {pins.map((pin) => {
            const cover = covers[pin.id]?.url;
            return (
              <li key={pin.id}>
                <button
                  type="button"
                  onClick={() => onSelect(pin.id)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-[#fbfaf7] p-3 text-left"
                >
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
                      style={{ backgroundColor: pin.color }}
                    >
                      {pinEmoji(pin.icon)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-base font-bold">{pinTitle(pin)}</span>
                    <span className="mt-0.5 block text-base text-muted">{pin.category}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
