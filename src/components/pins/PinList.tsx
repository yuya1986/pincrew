"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PIN_CATEGORIES, PIN_COLORS } from "@/lib/pins/catalog";
import { CsvImportError, exportPinsCsv, pinsFromCsv } from "@/lib/pins/csv";
import { formatPinDate, pinEmoji, pinTitle } from "@/lib/pins/display";
import { filterPins, type PinDateRange, type PinSort } from "@/lib/pins/query";
import type { SavedPin } from "@/lib/pins/types";
import { usePinCovers } from "@/hooks/use-pin-covers";

type PinListProps = {
  pins: SavedPin[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onImport: (pins: SavedPin[]) => Promise<{ added: number; duplicateCount: number }>;
};

const SORTS: readonly { id: PinSort; label: string }[] = [
  { id: "newest", label: "新しい順" },
  { id: "oldest", label: "古い順" },
  { id: "name", label: "名前順" },
];

const DATE_RANGES: readonly { id: PinDateRange; label: string }[] = [
  { id: "all", label: "すべての期間" },
  { id: "today", label: "今日" },
  { id: "week", label: "7日間" },
  { id: "month", label: "30日間" },
];

export function PinList({ pins, onClose, onSelect, onImport }: PinListProps) {
  const [text, setText] = useState("");
  const [sort, setSort] = useState<PinSort>("newest");
  const [category, setCategory] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<PinDateRange>("all");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const filterCount = (category ? 1 : 0) + (color ? 1 : 0) + (dateRange !== "all" ? 1 : 0);

  async function exportCsv() {
    if (busy || pins.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await exportPinsCsv(pins);
      setNotice(outcome === "shared" ? "共有シートを開きました" : `${pins.length}件を書き出しました`);
    } catch {
      setNotice("書き出せませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function importCsv(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      if (file.size > 1_000_000) {
        setNotice("ファイルが大きすぎます");
        return;
      }
      const parsed = pinsFromCsv(await file.text());
      const result = await onImport(parsed.pins);
      const skipped = parsed.skipped + result.duplicateCount;
      if (result.added === 0) {
        setNotice(skipped > 0 ? "新しい場所はありませんでした" : "読み込める場所がありませんでした");
        return;
      }
      setNotice(
        skipped > 0
          ? `${result.added}件を追加しました。${skipped}件は読み飛ばしました。`
          : `${result.added}件を追加しました`,
      );
    } catch (error) {
      setNotice(error instanceof CsvImportError ? error.message : "読み込めませんでした");
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(
    () => filterPins(pins, { text, sort, category, color, dateRange }),
    [category, color, dateRange, pins, sort, text],
  );
  const covers = usePinCovers(pins.map((pin) => pin.id));

  return (
    <section className="absolute inset-0 z-20 overflow-y-auto bg-background">
      <div
        className="px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold tracking-wide">PinCrew</p>
            <h2 className="text-xl font-bold">保存した場所</h2>
          </div>
          <button type="button" onClick={onClose} className="text-base font-medium text-muted">
            閉じる
          </button>
        </div>
        <p className="mt-1 text-base text-muted" aria-live="polite">
          {visible.length}件
        </p>

        <div className="relative mt-3">
          <Search
            aria-hidden
            size={20}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            enterKeyHint="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="タイトル、住所、メモ"
            aria-label="場所を検索"
            className="h-12 w-full rounded-full bg-white pr-12 pl-11 text-base shadow-[0_8px_24px_rgba(36,48,56,0.08)] outline-none"
          />
          {text ? (
            <button
              type="button"
              aria-label="検索をクリア"
              onClick={() => setText("")}
              className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>

        <div role="group" aria-label="並び順" className="mt-3 grid grid-cols-3 gap-1.5">
          {SORTS.map((item) => (
            <FilterButton key={item.id} pressed={sort === item.id} onClick={() => setSort(item.id)}>
              {item.label}
            </FilterButton>
          ))}
        </div>

        <div className="mt-2 flex gap-2 pb-3">
          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
            className="h-10 rounded-full bg-white px-4 text-base font-medium whitespace-nowrap"
          >
            絞り込み{filterCount > 0 ? ` ${filterCount}` : ""}
          </button>
          <button
            type="button"
            aria-expanded={toolsOpen}
            onClick={() => setToolsOpen((open) => !open)}
            className="h-10 rounded-full bg-white px-4 text-base font-medium whitespace-nowrap"
          >
            書き出し
          </button>
        </div>

        {filtersOpen ? (
          <div className="mb-3 space-y-2">
            <div role="group" aria-label="カテゴリ" className="flex gap-2 overflow-x-auto pb-1">
              <FilterButton pressed={category === null} onClick={() => setCategory(null)}>
                すべて
              </FilterButton>
              {PIN_CATEGORIES.map((item) => (
                <FilterButton key={item} pressed={category === item} onClick={() => setCategory(item)}>
                  {item}
                </FilterButton>
              ))}
            </div>
            <div role="group" aria-label="期間" className="flex gap-2 overflow-x-auto pb-1">
              {DATE_RANGES.map((item) => (
                <FilterButton key={item.id} pressed={dateRange === item.id} onClick={() => setDateRange(item.id)}>
                  {item.label}
                </FilterButton>
              ))}
            </div>
            <div role="group" aria-label="色" className="flex gap-2 overflow-x-auto pb-1">
              <FilterButton pressed={color === null} onClick={() => setColor(null)}>
                すべての色
              </FilterButton>
              {PIN_COLORS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={`色 ${item}`}
                  aria-pressed={color === item}
                  onClick={() => setColor(item)}
                  className={`h-10 w-10 shrink-0 rounded-full border-2 ${color === item ? "border-foreground" : "border-white"}`}
                  style={{ backgroundColor: item }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <ul className="space-y-3 px-4 pb-4">
        {visible.length === 0 ? (
          <li className="rounded-[28px] bg-white px-5 py-8 text-center text-base leading-7">
            {pins.length === 0
              ? "まだ場所がありません。"
              : "条件に合う場所がありません。"}
          </li>
        ) : (
          visible.map((pin) => (
            <PinListCard key={pin.id} pin={pin} coverUrl={covers[pin.id]?.url} onSelect={onSelect} />
          ))
        )}
      </ul>
      {toolsOpen ? (
        <div className="px-4 pt-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4.5rem)" }}>
          {notice ? <p className="mb-2 text-center text-base text-muted">{notice}</p> : null}
          <div className="grid grid-cols-2 gap-2">
          <label
            className={`flex h-12 items-center justify-center rounded-full bg-white text-base font-bold shadow-[0_8px_24px_rgba(36,48,56,0.08)] ${busy ? "opacity-60" : ""}`}
          >
            {busy ? "処理しています" : "CSVを読み込む"}
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void importCsv(file);
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy || pins.length === 0}
            onClick={() => void exportCsv()}
            className="h-12 rounded-full bg-white text-base font-bold shadow-[0_8px_24px_rgba(36,48,56,0.08)] disabled:opacity-60"
          >
            {pins.length === 0 ? "書き出せません" : "CSVで書き出す"}
          </button>
        </div>
        </div>
      ) : (
        <div style={{ height: "calc(env(safe-area-inset-bottom) + 4.5rem)" }} />
      )}
    </section>
  );
}

function PinListCard({
  pin,
  coverUrl,
  onSelect,
}: {
  pin: SavedPin;
  coverUrl?: string;
  onSelect: (id: string) => void;
}) {
  const title = pinTitle(pin);
  const address = pin.address.trim();
  const memo = pin.memo.trim();

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(pin.id)}
        className="flex w-full gap-3 rounded-[28px] bg-white p-4 text-left shadow-[0_8px_24px_rgba(36,48,56,0.08)]"
      >
        {coverUrl ? (
          // Signed URLs expire, so the browser loads them directly.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
            style={{ backgroundColor: pin.color }}
          >
            {pinEmoji(pin.icon)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-bold">{title}</span>
          {pin.status === "pending" ? <span className="mt-0.5 block text-base text-brand">公開待ち</span> : null}
          <span className="mt-0.5 block text-base text-muted">
            {pin.category}
            <span aria-hidden> · </span>
            {formatPinDate(pin.visitedAt)}
          </span>
          {address && address !== title ? (
            <span className="mt-1 block truncate text-base">{address}</span>
          ) : null}
          {memo ? <span className="mt-1 block truncate text-base text-muted">{memo}</span> : null}
        </span>
      </button>
    </li>
  );
}

function FilterButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-10 shrink-0 rounded-full px-3 text-base font-medium whitespace-nowrap ${
        pressed ? "bg-brand text-white" : "bg-white text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
