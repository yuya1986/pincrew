import { BRAND_COLOR } from "@/lib/map/constants";
import {
  DEFAULT_PIN_CATEGORY,
  DEFAULT_PIN_ICON,
  isPinCategory,
  isPinColor,
  isPinIconId,
} from "@/lib/pins/catalog";
import type { PinStatus, SavedPin, SyncStatus } from "@/lib/pins/types";

const DB_NAME = "kokomemo";
const DB_VERSION = 2;
const STORE_NAME = "pins";
const GEOCODE_STORE = "geocode_cache";
const DELETE_STORE = "pending_deletes";

export class PinStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PinStoreError";
  }
}

type PersistenceMode = "unknown" | "idb" | "memory";

let persistenceMode: PersistenceMode = "unknown";
let memoryPins: SavedPin[] = [];

function textField(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function syncStatusField(value: unknown): SyncStatus {
  if (value === "local" || value === "pending" || value === "synced" || value === "error") return value;
  return "local";
}

function normalizePin(value: unknown): SavedPin | null {
  if (typeof value !== "object" || value === null) return null;

  const pin = value as Record<string, unknown>;
  if (typeof pin.id !== "string") return null;
  if (typeof pin.latitude !== "number" || !Number.isFinite(pin.latitude)) return null;
  if (typeof pin.longitude !== "number" || !Number.isFinite(pin.longitude)) return null;

  const createdAt = textField(pin.createdAt, new Date().toISOString());
  const category = textField(pin.category);
  const icon = textField(pin.icon);
  const color = textField(pin.color);

  return {
    id: pin.id,
    latitude: pin.latitude,
    longitude: pin.longitude,
    address: textField(pin.address),
    title: textField(pin.title),
    memo: textField(pin.memo),
    category: isPinCategory(category) ? category : DEFAULT_PIN_CATEGORY,
    icon: isPinIconId(icon) ? icon : DEFAULT_PIN_ICON,
    color: isPinColor(color) ? color : BRAND_COLOR,
    visitedAt: textField(pin.visitedAt, createdAt),
    createdAt,
    updatedAt: textField(pin.updatedAt, createdAt),
    syncStatus: syncStatusField(pin.syncStatus),
    mapId: typeof pin.mapId === "string" && pin.mapId ? pin.mapId : null,
    status: pinStatusField(pin.status),
    createdBy: typeof pin.createdBy === "string" && pin.createdBy ? pin.createdBy : null,
    createdByLabel: textField(pin.createdByLabel),
  };
}

function pinStatusField(value: unknown): PinStatus {
  return value === "pending" || value === "approved" || value === "rejected" ? value : "private";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new PinStoreError("このブラウザには場所を保存できません"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(GEOCODE_STORE)) {
        database.createObjectStore(GEOCODE_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(DELETE_STORE)) {
        database.createObjectStore(DELETE_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(new PinStoreError("保存データを開けませんでした"));
    };
  });
}

async function ensurePersistence(): Promise<PersistenceMode> {
  if (persistenceMode !== "unknown") return persistenceMode;

  try {
    const database = await openDatabase();
    database.close();
    persistenceMode = "idb";
  } catch {
    persistenceMode = "memory";
    memoryPins = [];
  }

  return persistenceMode;
}

function sortNewestFirst(pins: SavedPin[]): SavedPin[] {
  return [...pins].sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
}

function readAllPins(database: IDBDatabase): Promise<SavedPin[]> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    let pins: SavedPin[] = [];

    request.onsuccess = () => {
      const result: unknown = request.result;
      pins = Array.isArray(result)
        ? result.flatMap((item) => {
            const pin = normalizePin(item);
            return pin ? [pin] : [];
          })
        : [];
    };
    transaction.oncomplete = () => resolve(pins);
    transaction.onerror = () => reject(new PinStoreError("保存済みの場所を読み込めませんでした"));
    transaction.onabort = () => reject(new PinStoreError("保存済みの場所を読み込めませんでした"));
  });
}

function putPin(database: IDBDatabase, pin: SavedPin): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(pin);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(new PinStoreError("この場所を保存できませんでした。もう一度押してください。"));
    };
    transaction.onabort = () => {
      reject(new PinStoreError("この場所を保存できませんでした。もう一度押してください。"));
    };
  });
}

export async function listPins(): Promise<{ pins: SavedPin[]; persisted: boolean }> {
  const mode = await ensurePersistence();

  if (mode === "memory") {
    return { pins: sortNewestFirst(memoryPins), persisted: false };
  }

  const database = await openDatabase();
  try {
    const pins = await readAllPins(database);
    return { pins: sortNewestFirst(pins), persisted: true };
  } finally {
    database.close();
  }
}

export async function addPin(pin: SavedPin): Promise<{ persisted: boolean }> {
  const mode = await ensurePersistence();

  if (mode === "memory") {
    memoryPins = [pin, ...memoryPins.filter((item) => item.id !== pin.id)];
    return { persisted: false };
  }

  const database = await openDatabase();
  try {
    await putPin(database, pin);
    return { persisted: true };
  } finally {
    database.close();
  }
}

function deleteStoredPin(database: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new PinStoreError("ピンを削除できませんでした"));
    transaction.onabort = () => reject(new PinStoreError("ピンを削除できませんでした"));
  });
}

export function geocodeCacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

export async function readGeocodeCache(latitude: number, longitude: number): Promise<string | null> {
  const mode = await ensurePersistence();
  if (mode !== "idb") return null;
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(GEOCODE_STORE, "readonly");
      const request = transaction.objectStore(GEOCODE_STORE).get(geocodeCacheKey(latitude, longitude));
      request.onsuccess = () => {
        const value: unknown = request.result;
        if (typeof value !== "object" || value === null) {
          resolve(null);
          return;
        }
        const address = "address" in value ? value.address : null;
        resolve(typeof address === "string" && address.trim() ? address : null);
      };
      transaction.onerror = () => reject(new PinStoreError("住所キャッシュを読めませんでした"));
      transaction.onabort = () => reject(new PinStoreError("住所キャッシュを読めませんでした"));
    });
  } finally {
    database.close();
  }
}

export async function writeGeocodeCache(latitude: number, longitude: number, address: string): Promise<void> {
  const trimmed = address.trim();
  if (!trimmed) return;
  const mode = await ensurePersistence();
  if (mode !== "idb") return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(GEOCODE_STORE, "readwrite");
      transaction.objectStore(GEOCODE_STORE).put({
        key: geocodeCacheKey(latitude, longitude),
        address: trimmed,
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new PinStoreError("住所キャッシュを保存できませんでした"));
      transaction.onabort = () => reject(new PinStoreError("住所キャッシュを保存できませんでした"));
    });
  } finally {
    database.close();
  }
}

export async function rememberPendingDelete(id: string): Promise<void> {
  const mode = await ensurePersistence();
  if (mode !== "idb") return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(DELETE_STORE, "readwrite");
      transaction.objectStore(DELETE_STORE).put({ id });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new PinStoreError("削除の再送を保存できませんでした"));
      transaction.onabort = () => reject(new PinStoreError("削除の再送を保存できませんでした"));
    });
  } finally {
    database.close();
  }
}

export async function listPendingDeletes(): Promise<string[]> {
  const mode = await ensurePersistence();
  if (mode !== "idb") return [];
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(DELETE_STORE, "readonly");
      const request = transaction.objectStore(DELETE_STORE).getAll();
      request.onsuccess = () => {
        const result: unknown = request.result;
        if (!Array.isArray(result)) {
          resolve([]);
          return;
        }
        resolve(
          result.flatMap((item) => {
            if (typeof item !== "object" || item === null) return [];
            const id = "id" in item ? item.id : null;
            return typeof id === "string" ? [id] : [];
          }),
        );
      };
      transaction.onerror = () => reject(new PinStoreError("削除の再送を読めませんでした"));
      transaction.onabort = () => reject(new PinStoreError("削除の再送を読めませんでした"));
    });
  } finally {
    database.close();
  }
}

export async function forgetPendingDelete(id: string): Promise<void> {
  const mode = await ensurePersistence();
  if (mode !== "idb") return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(DELETE_STORE, "readwrite");
      transaction.objectStore(DELETE_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new PinStoreError("削除の再送を消せませんでした"));
      transaction.onabort = () => reject(new PinStoreError("削除の再送を消せませんでした"));
    });
  } finally {
    database.close();
  }
}

export async function deletePin(id: string): Promise<{ persisted: boolean }> {
  const mode = await ensurePersistence();

  if (mode === "memory") {
    memoryPins = memoryPins.filter((pin) => pin.id !== id);
    return { persisted: false };
  }

  const database = await openDatabase();
  try {
    await deleteStoredPin(database, id);
    return { persisted: true };
  } finally {
    database.close();
  }
}
