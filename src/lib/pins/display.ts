import type { SavedPin } from "@/lib/pins/types";
import { pinIconById } from "@/lib/pins/catalog";

export function pinTitle(pin: Pick<SavedPin, "title" | "address">): string {
  const title = pin.title.trim();
  if (title) return title;
  const address = pin.address.trim();
  if (address) return address;
  return "無題の場所";
}

export function formatPinDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function pinEmoji(iconId: string): string {
  return pinIconById(iconId).emoji;
}

export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string, fallbackIso: string): string {
  if (!value) return fallbackIso;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallbackIso;
  return date.toISOString();
}
