import { readGeocodeCache, writeGeocodeCache } from "@/lib/pins/pin-store";

export type PlaceHit = {
  name: string;
  label: string;
  latitude: number;
  longitude: number;
};

export type PlaceLabel = {
  name: string;
  address: string;
};

export class PlaceSearchError extends Error {
  constructor() {
    super("検索できませんでした");
    this.name = "PlaceSearchError";
  }
}

const searchCache = new Map<string, { at: number; hits: PlaceHit[] }>();
const SEARCH_TTL_MS = 10 * 60 * 1000;

function readPlace(payload: unknown): PlaceLabel | null {
  if (typeof payload !== "object" || payload === null) return null;
  const displayName = "display_name" in payload ? payload.display_name : null;
  if (typeof displayName !== "string") return null;
  const address = displayName.trim();
  if (!address) return null;
  const named = "name" in payload && typeof payload.name === "string" ? payload.name.trim() : "";
  const head = address.split(",")[0]?.trim() ?? "";
  return { name: named || head || address, address };
}

async function nominatimReverse(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<PlaceLabel | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("accept-language", "ja");
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  return readPlace(await response.json());
}

async function proxyReverse(latitude: number, longitude: number, signal?: AbortSignal): Promise<PlaceLabel | null> {
  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });
  const response = await fetch(`/api/geocode?${params.toString()}`, { signal });
  if (!response.ok) return null;
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null) return null;
  const address = "address" in payload && typeof payload.address === "string" ? payload.address.trim() : "";
  if (!address) return null;
  const head = address.split(",")[0]?.trim() ?? "";
  return { name: head || address, address };
}

export async function reverseGeocodeCached(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<PlaceLabel | null> {
  try {
    const cached = await readGeocodeCache(latitude, longitude);
    if (cached) {
      const head = cached.split(",")[0]?.trim() ?? "";
      return { name: head || cached, address: cached };
    }
  } catch {
    // キャッシュが読めなくても、保存済みのピンはそのまま使える。
  }

  let place: PlaceLabel | null = null;
  try {
    place = await nominatimReverse(latitude, longitude, signal);
  } catch {
    place = null;
  }
  if (!place) {
    try {
      place = await proxyReverse(latitude, longitude, signal);
    } catch {
      place = null;
    }
  }
  if (!place) return null;

  try {
    await writeGeocodeCache(latitude, longitude, place.address);
  } catch {
    // 住所そのものは返す。キャッシュ失敗で保存を失敗にしない。
  }
  return place;
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceHit[]> {
  const text = query.trim();
  if (text.length < 2) return [];

  const cached = searchCache.get(text);
  if (cached && Date.now() - cached.at < SEARCH_TTL_MS) return cached.hits;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", text);
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "ja");
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new PlaceSearchError();
  }
  if (!response.ok) throw new PlaceSearchError();

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) return [];

  const hits = payload.flatMap((item) => {
    const place = readPlace(item);
    if (!place || typeof item !== "object" || item === null) return [];
    const latitude = "lat" in item ? Number(item.lat) : Number.NaN;
    const longitude = "lon" in item ? Number(item.lon) : Number.NaN;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [{ name: place.name, label: place.address, latitude, longitude }];
  });

  searchCache.set(text, { at: Date.now(), hits });
  return hits;
}
