import { pinTitle } from "@/lib/pins/display";
import type { SavedPin } from "@/lib/pins/types";

export type PinSort = "newest" | "oldest" | "name";
export type PinDateRange = "all" | "today" | "week" | "month";

export type PinQuery = {
  text: string;
  category: string | null;
  color: string | null;
  dateRange: PinDateRange;
  sort: PinSort;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function filterPins(pins: readonly SavedPin[], query: PinQuery, now = new Date()): SavedPin[] {
  const needle = normalizeSearch(query.text);

  return pins
    .filter((pin) => {
      if (query.category && pin.category !== query.category) return false;
      if (query.color && pin.color !== query.color) return false;
      if (!matchesDate(pin.visitedAt, query.dateRange, now)) return false;
      if (!needle) return true;
      const haystack = normalizeSearch(`${pin.title}\n${pin.address}\n${pin.memo}`);
      return haystack.includes(needle);
    })
    .sort((left, right) => comparePins(left, right, query.sort));
}

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ja");
}

function matchesDate(iso: string, range: PinDateRange, now: Date): boolean {
  if (range === "all") return true;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  if (range === "today") {
    return time >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
  const windowMs = range === "week" ? WEEK_MS : MONTH_MS;
  return time >= now.getTime() - windowMs;
}

function comparePins(left: SavedPin, right: SavedPin, sort: PinSort): number {
  if (sort === "name") {
    const byName = pinTitle(left).localeCompare(pinTitle(right), "ja");
    if (byName !== 0) return byName;
  }

  if (left.createdAt === right.createdAt) return 0;
  const olderFirst = left.createdAt < right.createdAt;
  if (sort === "oldest") return olderFirst ? -1 : 1;
  return olderFirst ? 1 : -1;
}
