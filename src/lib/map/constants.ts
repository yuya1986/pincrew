import type { Coordinates } from "@/lib/geo/types";

export const DEFAULT_CENTER: Coordinates = {
  latitude: 35.681236,
  longitude: 139.767125,
};

export const DEFAULT_ZOOM = 13;
export const LOCATE_ZOOM = 16;

/** Keyless MapLibre style. Set NEXT_PUBLIC_MAP_STYLE_URL to use MapTiler or another style. */
export const FALLBACK_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";

export const BRAND_COLOR = "#E36A4A";
export const USER_LOCATION_COLOR = "#2F80ED";

export function getMapStyleUrl(): string {
  const configured = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
  return configured ? configured : FALLBACK_MAP_STYLE_URL;
}
