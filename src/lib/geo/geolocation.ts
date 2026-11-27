import type { Coordinates } from "@/lib/geo/types";

export type GeolocationFailureReason =
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported";

export class GeolocationFailure extends Error {
  readonly reason: GeolocationFailureReason;

  constructor(message: string, reason: GeolocationFailureReason) {
    super(message);
    this.name = "GeolocationFailure";
    this.reason = reason;
  }
}

/** A fix older than this is not safe to drop a pin on. */
export const GPS_FRESH_MS = 8_000;

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 1000,
};

const FRESH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 12000,
};

const RECENT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 4000,
  timeout: 8000,
};

export function isFreshFix(coords: Coordinates | null, now = Date.now()): coords is Coordinates {
  return coords?.updatedAt !== undefined && now - coords.updatedAt <= GPS_FRESH_MS;
}

const FIRST_FIX_PATIENCE_MS = 20_000;
const WATCH_MAX_AGE_MS = 45_000;

/** True when the open watch should be replaced with a new one. */
export function gpsWatchStalled(watchAgeMs: number, fixAgeMs: number | null): boolean {
  if (watchAgeMs > WATCH_MAX_AGE_MS) return true;
  if (fixAgeMs === null) return watchAgeMs > FIRST_FIX_PATIENCE_MS;
  return fixAgeMs > GPS_FRESH_MS && watchAgeMs > GPS_FRESH_MS;
}

function toCoordinates(position: GeolocationPosition): Coordinates {
  const measuredAt =
    position.timestamp > 1e12 ? position.timestamp : position.timestamp > 1e9 ? position.timestamp * 1000 : Date.now();
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    updatedAt: measuredAt,
  };
}

function toGeolocationFailure(error: GeolocationPositionError): GeolocationFailure {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return new GeolocationFailure(
        "位置情報はオフです。地図を動かして、中央の場所を保存できます。",
        "denied",
      );
    case error.TIMEOUT:
      return new GeolocationFailure(
        "現在地の取得がタイムアウトしました。地図を動かして場所を選べます。",
        "timeout",
      );
    default:
      return new GeolocationFailure(
        "現在地を取得できませんでした。地図を動かして場所を選べます。",
        "unavailable",
      );
  }
}

function unsupportedFailure(): GeolocationFailure {
  return new GeolocationFailure(
    "このブラウザは位置情報に対応していません。地図を動かして場所を選べます。",
    "unsupported",
  );
}

export function getCurrentPosition(options: PositionOptions = FRESH_OPTIONS): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(unsupportedFailure());
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toCoordinates(position)),
      (error) => reject(toGeolocationFailure(error)),
      options,
    );
  });
}

/** Ask for a brand-new fix, then accept one measured in the last few seconds. */
export async function readFreshPosition(): Promise<Coordinates> {
  try {
    return await getCurrentPosition(FRESH_OPTIONS);
  } catch (error) {
    if (error instanceof GeolocationFailure && (error.reason === "denied" || error.reason === "unsupported")) {
      throw error;
    }
    return getCurrentPosition(RECENT_OPTIONS);
  }
}

export function watchCurrentPosition(
  onSuccess: (coords: Coordinates) => void,
  onError: (error: GeolocationFailure) => void,
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError(unsupportedFailure());
    return () => {};
  }

  let active = true;
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (!active) return;
      onSuccess(toCoordinates(position));
    },
    (error) => {
      if (!active) return;
      onError(toGeolocationFailure(error));
    },
    WATCH_OPTIONS,
  );

  return () => {
    active = false;
    navigator.geolocation.clearWatch(watchId);
  };
}
