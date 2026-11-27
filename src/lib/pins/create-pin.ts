import { assertCoordinates } from "@/lib/geo/coordinates";
import { BRAND_COLOR } from "@/lib/map/constants";
import {
  DEFAULT_PIN_CATEGORY,
  DEFAULT_PIN_ICON,
  isPinCategory,
  isPinColor,
  isPinIconId,
} from "@/lib/pins/catalog";
import type { PinFormValues, SavedPin } from "@/lib/pins/types";

function cleanText(value: string): string {
  return value.trim();
}

export function sanitizePinForm(values: PinFormValues, nowIso: string): PinFormValues {
  const visitedAt = new Date(values.visitedAt);
  return {
    address: cleanText(values.address),
    title: cleanText(values.title),
    memo: cleanText(values.memo),
    category: isPinCategory(values.category) ? values.category : DEFAULT_PIN_CATEGORY,
    icon: isPinIconId(values.icon) ? values.icon : DEFAULT_PIN_ICON,
    color: isPinColor(values.color) ? values.color : BRAND_COLOR,
    visitedAt: Number.isNaN(visitedAt.getTime()) ? nowIso : visitedAt.toISOString(),
  };
}

export function createPin(
  latitude: number,
  longitude: number,
  values: PinFormValues,
): SavedPin {
  assertCoordinates(latitude, longitude);
  const now = new Date().toISOString();
  const form = sanitizePinForm(values, now);

  return {
    id: crypto.randomUUID(),
    latitude,
    longitude,
    ...form,
    createdAt: now,
    updatedAt: now,
    syncStatus: "local",
    mapId: null,
    status: "private",
    createdBy: null,
    createdByLabel: "",
  };
}

export function withPinEdits(pin: SavedPin, values: PinFormValues): SavedPin {
  const now = new Date().toISOString();
  const form = sanitizePinForm(values, pin.visitedAt || now);

  return {
    ...pin,
    ...form,
    updatedAt: now,
  };
}

export function emptyPinForm(nowIso: string): PinFormValues {
  return {
    address: "",
    title: "",
    memo: "",
    category: DEFAULT_PIN_CATEGORY,
    icon: DEFAULT_PIN_ICON,
    color: BRAND_COLOR,
    visitedAt: nowIso,
  };
}
