"use client";

import { useCallback, useEffect, useState } from "react";
import { reverseGeocodeCached } from "@/lib/geocode/places";
import { readStaffLabel } from "@/lib/auth/staff-label";
import { titleForPin } from "@/lib/pins/catalog";
import { createPin, withPinEdits } from "@/lib/pins/create-pin";
import {
  addPin,
  deletePin,
  forgetPendingDelete,
  listPendingDeletes,
  listPins,
  rememberPendingDelete,
} from "@/lib/pins/pin-store";
import { isSameSavedPlace } from "@/lib/pins/csv";
import { deleteRemotePin, listRemotePins, updateRemotePin, upsertRemotePins } from "@/lib/pins/remote-pins";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type { PinFormValues, PinStatus, SavedPin } from "@/lib/pins/types";

function sortNewestFirst(pins: SavedPin[]): SavedPin[] {
  return [...pins].sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
}

export class LoginRequiredError extends Error {
  constructor() {
    super("ログインすると、共有と投稿が使えます。");
    this.name = "LoginRequiredError";
  }
}

type PinScope = {
  userId: string | null;
  authReady: boolean;
  mapId: string | null | undefined;
  writeStatus: PinStatus | null;
  live: boolean;
};

export function useSavedPins({ userId, authReady, mapId, writeStatus, live }: PinScope) {
  const [pins, setPins] = useState<SavedPin[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [persisted, setPersisted] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [localPinCount, setLocalPinCount] = useState(0);

  const replacePin = useCallback((next: SavedPin) => {
    setPins((current) => current.map((item) => (item.id === next.id ? next : item)));
  }, []);

  const syncPin = useCallback(
    async (pin: SavedPin) => {
      if (!userId || !pin.mapId) return;
      const synced = { ...pin, syncStatus: "synced" as const };
      try {
        try {
          await updateRemotePin(synced);
        } catch {
          await upsertRemotePins([synced], userId);
        }
        await addPin(synced);
        replacePin(synced);
      } catch {
        const failed = { ...pin, syncStatus: "error" as const };
        try {
          await addPin(failed);
        } catch {
          // 端末への記録が先に成功していれば、同期失敗でもピンは残す。
        }
        replacePin(failed);
      }
    },
    [replacePin, userId],
  );

  const enrichPin = useCallback(
    async (pin: SavedPin) => {
      let next = pin;
      if (!pin.address.trim() || !pin.title.trim()) {
        const place = await reverseGeocodeCached(pin.latitude, pin.longitude);
        if (place) {
          const stamped = new Date().toISOString();
          setPins((current) =>
            current.map((item) => {
              if (item.id !== pin.id) return item;
              if (item.address.trim() && item.title.trim()) return item;
              next = {
                ...item,
                title: item.title.trim() || place.name,
                address: item.address.trim() || place.address,
                updatedAt: stamped,
              };
              return next;
            }),
          );
          try {
            await addPin(next);
          } catch {
            // 住所が取れても、すでに保存したピンは消さない。
          }
        }
      }
      if (next.mapId) await syncPin(next);
    },
    [syncPin],
  );

  useEffect(() => {
    if (!authReady || !userId) return;
    let cancelled = false;
    listPins()
      .then((local) => {
        if (!cancelled) setLocalPinCount(local.pins.filter((pin) => !pin.mapId).length);
      })
      .catch(() => {
        if (!cancelled) setLocalPinCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, refreshKey, userId]);

  useEffect(() => {
    if (!live || !mapId || !authReady) return;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`pins-${mapId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pins", filter: `map_id=eq.${mapId}` },
        () => setRefreshKey((current) => current + 1),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authReady, live, mapId]);

  useEffect(() => {
    if (!authReady || mapId === undefined) return;
    let cancelled = false;

    const load = async () => {
      if (!mapId) {
        const local = await listPins();
        if (cancelled) return;
        setPins(sortNewestFirst(local.pins.filter((pin) => !pin.mapId)));
        setLoadedFor(mapId);
        setPersisted(local.persisted);
        setLoadError(null);
        return;
      }

      const pendingDeletes = userId ? await listPendingDeletes() : [];
      for (const id of pendingDeletes) {
        try {
          await deleteRemotePin(id);
          await forgetPendingDelete(id);
        } catch {
          // 次回オンライン時に再度送る。
        }
      }

      try {
        const remote = await listRemotePins(mapId);
        if (cancelled) return;
        const local = await listPins();
        const pending = local.pins.filter(
          (pin) => pin.mapId === mapId && (pin.syncStatus === "pending" || pin.syncStatus === "error"),
        );
        const merged = new Map(remote.map((pin) => [pin.id, pin]));
        for (const pin of pending) {
          if (pendingDeletes.includes(pin.id)) continue;
          merged.set(pin.id, pin);
          void syncPin(pin);
        }
        for (const pin of remote) void addPin(pin);
        setPins(sortNewestFirst([...merged.values()]));
        setLoadedFor(mapId);
        setPersisted(true);
        setLoadError(null);
      } catch {
        const local = await listPins();
        if (cancelled) return;
        setPins(sortNewestFirst(local.pins.filter((pin) => pin.mapId === mapId)));
        setLoadedFor(mapId);
        setLoadError("クラウドの場所を読み込めませんでした。この端末の控えを表示しています。");
      }
    };

    load()
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadedFor(mapId);
        setLoadError(error instanceof Error ? error.message : "保存済みの場所を読み込めませんでした");
      })
      .finally(() => {
        if (!cancelled) setPinsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, mapId, refreshKey, syncPin, userId]);

  const remember = useCallback((result: { persisted: boolean }) => {
    setPersisted(result.persisted);
  }, []);

  const cloudPin = useCallback(
    (pin: SavedPin): SavedPin => {
      if (!mapId) {
        return {
          ...pin,
          title: titleForPin(pin.icon, pin.category, pin.title),
          mapId: null,
          status: "private",
          syncStatus: "local",
        };
      }
      if (!userId) throw new LoginRequiredError();
      if (!writeStatus) throw new Error("このマップは閲覧だけです");
      const titled = titleForPin(pin.icon, pin.category, pin.title);
      return {
        ...pin,
        title: titled,
        mapId,
        status: writeStatus,
        createdBy: pin.createdBy ?? userId,
        createdByLabel: pin.createdByLabel || readStaffLabel(),
        syncStatus: "pending",
      };
    },
    [mapId, userId, writeStatus],
  );

  const importPins = useCallback(
    async (incoming: SavedPin[]) => {
      const fresh = incoming.filter((pin) => !pins.some((existing) => isSameSavedPlace(existing, pin)));
      const duplicateCount = incoming.length - fresh.length;
      if (fresh.length === 0) return { added: 0, duplicateCount };

      const stored = fresh.map((pin) => cloudPin({ ...pin, createdBy: userId }));
      for (const pin of stored) await addPin(pin);
      setPins((current) => sortNewestFirst([...stored, ...current]));
      remember({ persisted: true });
      for (const pin of stored) {
        if (pin.mapId) void syncPin(pin);
      }
      return { added: stored.length, duplicateCount };
    },
    [cloudPin, pins, remember, syncPin, userId],
  );

  const saveNewPin = useCallback(
    async (latitude: number, longitude: number, values: PinFormValues) => {
      const pin = cloudPin(createPin(latitude, longitude, values));
      const result = await addPin(pin);
      setPins((current) => sortNewestFirst([pin, ...current.filter((item) => item.id !== pin.id)]));
      remember(result);
      void enrichPin(pin);
      return { pin, persisted: result.persisted };
    },
    [cloudPin, enrichPin, remember],
  );

  const savePinEdits = useCallback(
    async (pin: SavedPin, values: PinFormValues) => {
      const next = cloudPin(withPinEdits(pin, values));
      if (pin.mapId) {
        next.mapId = pin.mapId;
        next.status = pin.status;
        next.createdBy = pin.createdBy;
      }
      const result = await addPin(next);
      replacePin(next);
      remember(result);
      if (next.mapId) void syncPin(next);
      return { pin: next, persisted: result.persisted };
    },
    [cloudPin, remember, replacePin, syncPin],
  );

  const removePin = useCallback(
    async (id: string) => {
      const result = await deletePin(id);
      setPins((next) => next.filter((pin) => pin.id !== id));
      remember(result);
      return result;
    },
    [remember],
  );

  const commitPinDelete = useCallback(async (id: string) => {
    try {
      await deleteRemotePin(id);
      await forgetPendingDelete(id);
    } catch {
      await rememberPendingDelete(id);
    }
  }, []);

  const restorePin = useCallback(
    async (pin: SavedPin) => {
      const next = pin.mapId && userId ? { ...pin, syncStatus: "pending" as const } : pin;
      const result = await addPin(next);
      await forgetPendingDelete(pin.id);
      setPins((current) => sortNewestFirst([...current.filter((item) => item.id !== pin.id), next]));
      remember(result);
      if (next.mapId) void syncPin(next);
      return result;
    },
    [remember, syncPin, userId],
  );

  const moveLocalPins = useCallback(
    async (targetMapId: string) => {
      if (!userId) throw new LoginRequiredError();
      const local = await listPins();
      const loose = local.pins.filter((pin) => !pin.mapId);
      for (const pin of loose) {
        const next: SavedPin = {
          ...pin,
          mapId: targetMapId,
          status: "private",
          createdBy: userId,
          createdByLabel: pin.createdByLabel || readStaffLabel(),
          syncStatus: "synced",
        };
        await upsertRemotePins([next], userId);
        await addPin(next);
      }
      setLocalPinCount(0);
      setRefreshKey((current) => current + 1);
    },
    [userId],
  );

  const pinsForMap = loadedFor === mapId ? pins : [];

  return {
    pins: pinsForMap,
    pinsLoaded: loadedFor === mapId && pinsLoaded,
    persisted,
    loadError,
    importPins,
    saveNewPin,
    savePinEdits,
    removePin,
    commitPinDelete,
    restorePin,
    localPinCount,
    moveLocalPins,
  };
}
