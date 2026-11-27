"use client";

import { useEffect, useRef, useState } from "react";
import { reverseGeocode } from "@/lib/geocode/reverse-geocode";
import { categoriesForMap, iconsForMap, PIN_COLORS } from "@/lib/pins/catalog";
import {
  formatCoordinates,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/pins/display";
import type { PinFormValues } from "@/lib/pins/types";

type PinSheetProps = {
  mode: "create" | "edit";
  latitude: number;
  longitude: number;
  initialValues: PinFormValues;
  marathon?: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (values: PinFormValues) => void;
};

export function PinSheet({
  mode,
  latitude,
  longitude,
  initialValues,
  marathon = false,
  saving,
  onClose,
  onSubmit,
}: PinSheetProps) {
  const [values, setValues] = useState(initialValues);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [addressState, setAddressState] = useState<"idle" | "loading" | "failed">(
    mode === "create" ? "loading" : "idle",
  );
  const addressEditedRef = useRef(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setViewportHeight(viewport.height);
    const frame = window.requestAnimationFrame(update);
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    if (mode !== "create") return;

    const controller = new AbortController();
    reverseGeocode(latitude, longitude, controller.signal)
      .then((address) => {
        if (addressEditedRef.current) return;
        setValues((current) => ({ ...current, address }));
        setAddressState("idle");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAddressState("failed");
      });

    return () => controller.abort();
  }, [latitude, longitude, mode]);

  function update<Key extends keyof PinFormValues>(key: Key, value: PinFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end">
      <button
        type="button"
        className="absolute inset-0 bg-[#243038]/35"
        aria-label="閉じる"
        onClick={onClose}
      />
      <form
        className="relative flex w-full flex-col rounded-t-[28px] bg-white shadow-[0_-12px_40px_rgba(36,48,56,0.16)]"
        style={{ maxHeight: viewportHeight ? `${Math.max(viewportHeight - 12, 240)}px` : "86dvh" }}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            ...values,
            visitedAt: fromDatetimeLocalValue(values.visitedAt, initialValues.visitedAt),
          });
        }}
      >
        <div className="flex justify-center pt-3">
          <span className="h-1.5 w-12 rounded-full bg-[#e6e1d8]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3">
          <h2 className="text-xl font-bold">{mode === "create" ? "この場所を保存" : "ピンを編集"}</h2>
          <button type="button" className="text-base font-medium text-muted" onClick={onClose}>
            閉じる
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="mb-2 block text-base font-medium">住所</span>
            <input
              value={values.address}
              onChange={(event) => {
                addressEditedRef.current = true;
                update("address", event.target.value);
              }}
              placeholder={
                addressState === "loading" ? "住所を取得しています" : "住所を入力"
              }
              autoComplete="off"
              className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none focus:border-brand"
              onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest" })}
            />
            {addressState === "failed" ? (
              <p className="mt-2 text-base text-muted">住所を取得できませんでした。手入力できます。</p>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-2 block text-base font-medium">タイトル</span>
            <input
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="任意"
              onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest" })}
              className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none focus:border-brand"
            />
          </label>

          <fieldset>
            <legend className="mb-2 text-base font-medium">カテゴリー</legend>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categoriesForMap(marathon).map((category) => {
                const selected = values.category === category;
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => update("category", category)}
                    className={`h-11 shrink-0 rounded-full px-4 text-base ${
                      selected ? "bg-brand font-bold text-white" : "bg-[#f4f1ec] text-foreground"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-base font-medium">アイコン</legend>
            <div className="grid grid-cols-6 gap-2">
              {iconsForMap(marathon).map((icon) => {
                const selected = values.icon === icon.id;
                return (
                  <button
                    key={icon.id}
                    type="button"
                    aria-label={icon.label}
                    aria-pressed={selected}
                    onClick={() => {
                      update("icon", icon.id);
                      if (icon.id === "toilet") {
                        update("category", "トイレ");
                        if (!values.title.trim()) update("title", "トイレ");
                      }
                    }}
                    className={`flex h-12 items-center justify-center rounded-2xl text-2xl ${
                      selected ? "bg-[#fff1ec] ring-2 ring-brand" : "bg-[#f4f1ec]"
                    }`}
                  >
                    {icon.emoji}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-base font-medium">色</legend>
            <div className="flex flex-wrap gap-3">
              {PIN_COLORS.map((color) => {
                const selected = values.color === color;
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={`色 ${color}`}
                    aria-pressed={selected}
                    onClick={() => update("color", color)}
                    className={`h-11 w-11 rounded-full ${selected ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                    style={{ backgroundColor: color }}
                  />
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-2 block text-base font-medium">メモ</span>
            <textarea
              value={values.memo}
              onChange={(event) => update("memo", event.target.value)}
              rows={3}
              placeholder="任意"
              className="w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 py-3 text-base outline-none focus:border-brand"
              onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest" })}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-base font-medium">訪問日時</span>
            <input
              type="datetime-local"
              value={toDatetimeLocalValue(values.visitedAt)}
              onChange={(event) =>
                update(
                  "visitedAt",
                  fromDatetimeLocalValue(event.target.value, values.visitedAt),
                )
              }
              className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none focus:border-brand"
            />
          </label>

          <p className="text-base text-muted">{formatCoordinates(latitude, longitude)}</p>
        </div>
        <div
          className="border-t border-[#f0ebe4] px-5 pt-3"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="submit"
            disabled={saving}
            className="h-14 w-full rounded-full bg-brand text-lg font-bold text-white disabled:opacity-60"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
