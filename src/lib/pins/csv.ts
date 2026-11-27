import { assertCoordinates } from "@/lib/geo/coordinates";
import { PIN_ICONS, pinIconById } from "@/lib/pins/catalog";
import { sanitizePinForm } from "@/lib/pins/create-pin";
import type { SavedPin } from "@/lib/pins/types";

const MAX_IMPORT_ROWS = 1000;

export class CsvImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvImportError";
  }
}

const COLUMNS = [
  "タイトル",
  "住所",
  "緯度",
  "経度",
  "カテゴリー",
  "アイコン",
  "色",
  "メモ",
  "訪問日時",
  "登録日時",
] as const;

function csvDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function csvNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(6) : "";
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}

export function pinsToCsv(pins: readonly SavedPin[]): string {
  const rows = pins.map((pin) =>
    [
      pin.title.trim(),
      pin.address.trim(),
      csvNumber(pin.latitude),
      csvNumber(pin.longitude),
      pin.category,
      pinIconById(pin.icon).label,
      pin.color,
      pin.memo,
      csvDate(pin.visitedAt),
      csvDate(pin.createdAt),
    ]
      .map(csvCell)
      .join(","),
  );
  return [COLUMNS.join(","), ...rows].join("\r\n");
}

function parseCsvTable(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((item) => item.some((value) => value.trim() !== ""));
}

function cellText(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (trimmed.startsWith("'") && /^[=+\-@]/.test(trimmed.slice(1))) return trimmed.slice(1);
  return trimmed;
}

function parseImportedDate(value: string, fallback: string): string {
  if (!value) return fallback;
  const match = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (match) {
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] ?? 0),
      Number(match[5] ?? 0),
    );
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function iconIdFromCell(value: string): string {
  const match = PIN_ICONS.find((icon) => icon.id === value || icon.label === value || icon.emoji === value);
  return match?.id ?? "place";
}

export function pinsFromCsv(text: string): { pins: SavedPin[]; skipped: number } {
  const table = parseCsvTable(text);
  const header = table[0]?.map((cell) => cellText(cell));
  if (!header || !COLUMNS.every((column) => header.includes(column))) {
    throw new CsvImportError("このCSVは読み込めません。PinCrewから書き出した形式を使ってください。");
  }

  const indexOf = (column: (typeof COLUMNS)[number]) => header.indexOf(column);
  const now = new Date().toISOString();
  const pins: SavedPin[] = [];
  let skipped = Math.max(0, table.length - 1 - MAX_IMPORT_ROWS);

  for (const row of table.slice(1, MAX_IMPORT_ROWS + 1)) {
    const latitude = Number(cellText(row[indexOf("緯度")]));
    const longitude = Number(cellText(row[indexOf("経度")]));
    try {
      assertCoordinates(latitude, longitude);
    } catch {
      skipped += 1;
      continue;
    }

    const createdAt = parseImportedDate(cellText(row[indexOf("登録日時")]), now);
    const form = sanitizePinForm(
      {
        title: cellText(row[indexOf("タイトル")]),
        address: cellText(row[indexOf("住所")]),
        memo: cellText(row[indexOf("メモ")]),
        category: cellText(row[indexOf("カテゴリー")]),
        icon: iconIdFromCell(cellText(row[indexOf("アイコン")])),
        color: cellText(row[indexOf("色")]),
        visitedAt: parseImportedDate(cellText(row[indexOf("訪問日時")]), createdAt),
      },
      now,
    );

    pins.push({
      id: crypto.randomUUID(),
      latitude,
      longitude,
      ...form,
      createdAt,
      updatedAt: createdAt,
      syncStatus: "local",
      mapId: null,
      status: "private",
      createdBy: null,
      createdByLabel: "",
    });
  }

  return { pins, skipped };
}

export function isSameSavedPlace(left: SavedPin, right: SavedPin): boolean {
  return (
    left.latitude.toFixed(6) === right.latitude.toFixed(6) &&
    left.longitude.toFixed(6) === right.longitude.toFixed(6) &&
    left.title.trim() === right.title.trim() &&
    left.address.trim() === right.address.trim()
  );
}

export async function exportPinsCsv(pins: readonly SavedPin[]): Promise<"shared" | "downloaded"> {
  const today = csvDate(new Date().toISOString()).slice(0, 10).replaceAll("/", "-");
  const filename = `PinCrew-${today}.csv`;
  const file = new File([`\uFEFF${pinsToCsv(pins)}`], filename, { type: "text/csv;charset=utf-8" });

  if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "PinCrewの場所" });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "shared";
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
