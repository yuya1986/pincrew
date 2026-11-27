"use client";

import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { LoginSheet } from "@/components/auth/LoginSheet";
import { BottomNav, type AppTab } from "@/components/map/BottomNav";
import { Crosshair } from "@/components/map/Crosshair";
import { CurrentLocationButton } from "@/components/map/CurrentLocationButton";
import { MapFallback, MapNotice } from "@/components/map/MapNotice";
import { MapSwitcher } from "@/components/map/MapSwitcher";
import { PlaceSearch } from "@/components/map/PlaceSearch";
import { SavePlaceButton } from "@/components/map/SavePlaceButton";
import { SettingsPanel } from "@/components/map/SettingsPanel";
import { StatusToast } from "@/components/map/StatusToast";
import { MigrateDialog } from "@/components/auth/MigrateDialog";
import { ConfirmDialog } from "@/components/pins/ConfirmDialog";
import { NearbyPinsSheet } from "@/components/pins/NearbyPinsSheet";
import { PinChoiceSheet } from "@/components/pins/PinChoiceSheet";
import { PinDetailCard } from "@/components/pins/PinDetailCard";
import { PinList } from "@/components/pins/PinList";
import { PinSheet } from "@/components/pins/PinSheet";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentLocation } from "@/hooks/use-current-location";
import { useMaps } from "@/hooks/use-maps";
import { LoginRequiredError, useSavedPins } from "@/hooks/use-saved-pins";
import { useStatusMessage } from "@/hooks/use-status-message";
import { CoordinateError } from "@/lib/geo/coordinates";
import { GeolocationFailure, isFreshFix } from "@/lib/geo/geolocation";
import { distanceMeters } from "@/lib/geo/measure";
import type { Coordinates } from "@/lib/geo/types";
import type { CloudMap } from "@/lib/cloud/maps";
import type { PlaceHit } from "@/lib/geocode/places";
import { LOCATE_ZOOM } from "@/lib/map/constants";
import { emptyPinForm } from "@/lib/pins/create-pin";
import { listPinPhotoIds, PhotoError, relinkPinPhotos, removeStoredPinPhotos } from "@/lib/pins/photos";
import { RemotePinError } from "@/lib/pins/remote-pins";
import { PinStoreError } from "@/lib/pins/pin-store";
import { sharePin } from "@/lib/pins/share";
import type { PinFormValues, PinStatus, SavedPin } from "@/lib/pins/types";
import { createBrowserSupabase } from "@/lib/supabase/client";

const MAP_ERROR_MESSAGE = "地図を読み込めませんでした。通信状況を確認して、もう一度開いてください。";
const POOR_ACCURACY_METERS = 150;
const CAMERA_MIN_MOVE_METERS = 3;
const NEARBY_RADIUS_METERS = 5000;

function MapCanvasSlot({
  active,
  onChunkError,
  ...props
}: ComponentProps<typeof import("@/components/map/MapCanvas").MapCanvas> & {
  active: boolean;
  onChunkError: (message: string) => void;
}) {
  const [Canvas, setCanvas] = useState<typeof import("@/components/map/MapCanvas").MapCanvas | null>(null);
  const [chunkFailed, setChunkFailed] = useState(false);

  useEffect(() => {
    if (!active) return;
    let live = true;
    import("@/components/map/MapCanvas")
      .then((mod) => {
        if (live) setCanvas(() => mod.MapCanvas);
      })
      .catch(() => {
        if (!live) return;
        setChunkFailed(true);
        onChunkError(MAP_ERROR_MESSAGE);
      });
    return () => {
      live = false;
    };
  }, [active, onChunkError]);

  if (!active || chunkFailed) return <div className="h-full w-full bg-[#efe8df]" />;
  if (!Canvas) return <MapFallback />;
  return <Canvas {...props} />;
}

function isNearPlace(place: PlaceHit, latitude: number, longitude: number): boolean {
  const latitudeMeters = (place.latitude - latitude) * 111_320;
  const longitudeMeters =
    (place.longitude - longitude) * 111_320 * Math.cos((latitude * Math.PI) / 180);
  return Math.hypot(latitudeMeters, longitudeMeters) <= 80;
}

function writeStatusFor(map: CloudMap | null, userId: string | null, admin: boolean): PinStatus | null {
  if (!map) return null;
  if (map.mapType === "recommended") {
    if (!userId) return null;
    return admin ? "approved" : "pending";
  }
  if (map.myRole === "owner" || map.myRole === "editor") return "private";
  return null;
}

function canManagePin(pin: SavedPin, map: CloudMap | null, userId: string | null, admin: boolean): boolean {
  if (!pin.mapId) return true;
  if (admin) return true;
  if (userId && pin.createdBy === userId && pin.status === "pending") return true;
  return (map?.myRole === "owner" || map?.myRole === "editor") && pin.status === "private";
}

type ComposerState =
  | { mode: "create"; latitude: number; longitude: number; values: PinFormValues }
  | { mode: "edit"; pin: SavedPin };

export function MapScreen() {
  const mapRef = useRef<MapLibreMap | null>(null);
  const followingRef = useRef(true);
  const centeredRef = useRef(false);
  const [following, setFollowing] = useState(true);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [openingNearby, setOpeningNearby] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapInstanceKey, setMapInstanceKey] = useState(0);
  const [mapMounted, setMapMounted] = useState(true);
  const retryTimerRef = useRef<number | null>(null);
  const aimedPlaceRef = useRef<PlaceHit | null>(null);
  const [saving, setSaving] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinChoices, setPinChoices] = useState<string[] | null>(null);
  const [photoRevision, setPhotoRevision] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<SavedPin | null>(null);
  const [tab, setTab] = useState<AppTab>("map");
  const [loginOpen, setLoginOpen] = useState(false);
  const [moveSkipped, setMoveSkipped] = useState(false);
  const [movingPins, setMovingPins] = useState(false);
  const { ready: authReady, user, profile, isAdmin, isStaff } = useAuth();
  const mapCatalog = useMaps(user?.id ?? null, authReady, profile?.role ?? null);
  const activeMap = mapCatalog.selected;
  const {
    pins,
    pinsLoaded,
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
  } = useSavedPins({
    userId: user?.id ?? null,
    authReady: authReady && mapCatalog.ready,
    mapId: mapCatalog.ready ? (activeMap?.id ?? null) : undefined,
    writeStatus: writeStatusFor(activeMap, user?.id ?? null, isAdmin),
    live: activeMap?.mapType === "marathon" || activeMap?.mapType === "shared",
  });
  const pinsRef = useRef(pins);
  const { location, errorMessage, requesting, recovering, requestCurrentLocation } = useCurrentLocation();
  const locationRef = useRef(location);
  locationRef.current = location;
  const { message, action, showStatus, dismiss, hold, release } = useStatusMessage();
  const photoPurges = useRef(new Map<string, { photoIds: string[]; timer: number }>());

  const visiblePins = pins.filter((pin) => {
    if (activeMap?.mapType !== "recommended") return true;
    if (pin.status === "approved") return true;
    return pin.createdBy === user?.id && pin.status === "pending";
  });
  const selectedPin = visiblePins.find((pin) => pin.id === selectedId) ?? null;

  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  const mapKey = activeMap?.id ?? "local";
  const [seenMap, setSeenMap] = useState(mapKey);
  if (seenMap !== mapKey) {
    setSeenMap(mapKey);
    setSelectedId(null);
    setComposer(null);
  }

  const setFollow = useCallback((next: boolean) => {
    followingRef.current = next;
    setFollowing(next);
  }, []);

  const flyTo = useCallback((coords: Coordinates) => {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      center: [coords.longitude, coords.latitude],
      zoom: Math.max(map.getZoom(), LOCATE_ZOOM),
      duration: 800,
    });
  }, []);

  useEffect(() => {
    if (!mapReady) {
      centeredRef.current = false;
      return;
    }
    if (!location || !followingRef.current) return;
    const map = mapRef.current;
    if (!map) return;
    if (centeredRef.current && location.accuracy !== undefined && location.accuracy > POOR_ACCURACY_METERS) {
      return;
    }
    const current = map.getCenter();
    const moved = distanceMeters(current.lat, current.lng, location.latitude, location.longitude);
    if (centeredRef.current && moved < CAMERA_MIN_MOVE_METERS) return;
    centeredRef.current = true;
    map.easeTo({
      center: [location.longitude, location.latitude],
      zoom: Math.max(map.getZoom(), LOCATE_ZOOM),
      duration: moved > 300 ? 800 : 500,
      essential: true,
    });
  }, [following, location, mapReady]);

  useEffect(() => {
    if (!errorMessage) return;
    showStatus(mapReady && !mapError ? errorMessage : "現在地を取得できませんでした。", 6000);
  }, [errorMessage, mapError, mapReady, showStatus]);

  useEffect(() => {
    if (!recovering || !following) return;
    showStatus("現在地を取り直しています", 4000);
  }, [following, recovering, showStatus]);

  useEffect(() => {
    if (loadError) showStatus(loadError, 6000);
  }, [loadError, showStatus]);

  useEffect(() => {
    if (!pinsLoaded || persisted) return;
    showStatus("このブラウザには保存を残せません。画面を閉じるとピンが消えます。", 6000);
  }, [persisted, pinsLoaded, showStatus]);

  const handleReady = useCallback((map: MapLibreMap) => {
    mapRef.current = map;
    setMapReady(true);
    setMapError(null);
  }, []);

  const handleDispose = useCallback(() => {
    mapRef.current = null;
    setMapReady(false);
  }, []);

  const handleUserGesture = useCallback(() => {
    setFollow(false);
    aimedPlaceRef.current = null;
  }, [setFollow]);

  const handleFatalError = useCallback((nextMessage: string) => {
    setMapError(nextMessage);
  }, []);

  const handleRetryMap = useCallback(() => {
    setMapError(null);
    setMapReady(false);
    setMapMounted(false);
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      setMapInstanceKey((current) => current + 1);
      setMapMounted(true);
    }, 80);
  }, []);

  const handleLocate = useCallback(async () => {
    setFollow(true);
    try {
      await requestCurrentLocation();
    } catch (error) {
      if (error instanceof GeolocationFailure && (error.reason === "denied" || error.reason === "unsupported")) return;
      const mapUsable = Boolean(mapRef.current) && !mapError;
      const nextMessage = !mapUsable
        ? "現在地を取得できませんでした。"
        : "現在地を取り直せませんでした。もう一度押してください。";
      showStatus(nextMessage, 5000);
    }
  }, [mapError, requestCurrentLocation, setFollow, showStatus]);

  const handleQuickSave = useCallback(async () => {
    const map = mapRef.current;
    if (!map || saving) return;
    setSaving(true);
    setPulseKey((current) => current + 1);
    try {
      const center = map.getCenter();
      let latitude = center.lat;
      let longitude = center.lng;
      if (followingRef.current) {
        let fix = locationRef.current;
        if (!isFreshFix(fix)) {
          showStatus("現在地を取り直しています", 4000);
          try {
            fix = await requestCurrentLocation();
          } catch (error) {
            if (error instanceof GeolocationFailure && (error.reason === "denied" || error.reason === "unsupported")) return;
            showStatus("現在地を取り直せませんでした。もう一度押すか、地図を動かして保存してください。", 5000);
            return;
          }
        }
        if (!fix) return;
        latitude = fix.latitude;
        longitude = fix.longitude;
        map.jumpTo({ center: [longitude, latitude] });
      }
      const values = emptyPinForm(new Date().toISOString());
      const aimed = aimedPlaceRef.current;
      if (aimed && isNearPlace(aimed, latitude, longitude)) {
        values.title = aimed.name;
        values.address = aimed.label;
      }

      const result = await saveNewPin(latitude, longitude, values);
      const savedName = result.pin.title.trim();
      const savedText =
        result.pin.status === "pending"
          ? "投稿しました。公開までお待ちください。"
          : result.pin.status === "approved" && activeMap?.mapType === "recommended"
            ? savedName
              ? `✓ ${savedName}を公開しました`
              : "✓ 公開しました"
            : result.persisted
              ? savedName
                ? `✓ ${savedName}を保存しました`
                : "✓ 保存しました"
              : "✓ 保存しました。再読み込み後に残らないことがあります。";
      showStatus(
        savedText,
        4000,
        {
          label: "メモを追加",
          onClick: () => {
            const latest = pinsRef.current.find((pin) => pin.id === result.pin.id) ?? result.pin;
            setSelectedId(null);
            setPendingDelete(null);
            setTab("map");
            setComposer({ mode: "edit", pin: latest });
          },
        },
      );
    } catch (error) {
      if (error instanceof LoginRequiredError) {
        setLoginOpen(true);
        return;
      }
      const nextMessage =
        error instanceof PinStoreError || error instanceof CoordinateError || error instanceof Error
          ? error.message
          : "保存できませんでした。もう一度押してください。";
      showStatus(nextMessage, 4000);
    } finally {
      setSaving(false);
    }
  }, [activeMap, requestCurrentLocation, saveNewPin, saving, showStatus]);

  function handleSelectFromList(id: string) {
    const pin = visiblePins.find((item) => item.id === id);
    setFollow(false);
    setNearbyOpen(false);
    setTab("map");
    setPinChoices(null);
    setSelectedId(id);
    if (!pin) return;
    flyTo({ latitude: pin.latitude, longitude: pin.longitude });
  }

  const handleSelectPin = useCallback(
    (ids: string[]) => {
      if (composer) return;
      setFollow(false);
      setPendingDelete(null);
      if (ids.length > 1) {
        setSelectedId(null);
        setPinChoices(ids);
        return;
      }
      setPinChoices(null);
      setSelectedId(ids[0] ?? null);
    },
    [composer, setFollow],
  );

  const handleClearPin = useCallback(() => {
    if (composer || pendingDelete) return;
    setSelectedId(null);
    setPinChoices(null);
  }, [composer, pendingDelete]);

  const handleSubmit = useCallback(
    async (values: PinFormValues) => {
      if (!composer || saving) return;
      setSaving(true);

      try {
        if (composer.mode === "create") {
          const result = await saveNewPin(composer.latitude, composer.longitude, values);
          setComposer(null);
          showStatus(
            result.persisted
              ? "この場所を保存しました"
              : "保存しました。再読み込み後に残らないことがあります。",
          );
          return;
        }

        const result = await savePinEdits(composer.pin, values);
        setComposer(null);
        setSelectedId(result.pin.id);
        showStatus("変更を保存しました");
      } catch (error) {
        if (error instanceof LoginRequiredError) {
          setComposer(null);
          setLoginOpen(true);
          return;
        }
        const nextMessage =
          error instanceof PinStoreError ||
          error instanceof CoordinateError ||
          error instanceof RemotePinError ||
          error instanceof Error
            ? error.message
            : "保存できませんでした。もう一度押してください。";
        showStatus(nextMessage, 4000);
      } finally {
        setSaving(false);
      }
    },
    [composer, saveNewPin, savePinEdits, saving, showStatus],
  );

  useEffect(() => {
    const pending = photoPurges.current;
    return () => {
      for (const [pinId, entry] of pending) {
        if (entry.timer) window.clearTimeout(entry.timer);
        void removeStoredPinPhotos(pinId, entry.photoIds);
      }
      pending.clear();
    };
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const pin = pendingDelete;

    try {
      setPendingDelete(null);
      setSelectedId(null);
      await removePin(pin.id);
      const photoPromise = user ? listPinPhotoIds(pin.id).catch(() => [] as string[]) : Promise.resolve([]);
      void photoPromise.then((photoIds) => {
        if (photoIds.length === 0) return;
        photoPurges.current.set(pin.id, { photoIds, timer: 0 });
      });
      showStatus(
        "ピンを削除しました",
        8000,
        {
          label: "元に戻す",
          onClick: () => {
            photoPurges.current.delete(pin.id);
            void restorePin(pin)
              .then(() => photoPromise)
              .then((photoIds) => (photoIds.length > 0 ? relinkPinPhotos(pin.id, photoIds) : undefined))
              .catch((error: unknown) => {
                showStatus(error instanceof PhotoError ? error.message : "元に戻せませんでした", 4000);
              });
          },
        },
        () => {
          const pending = photoPurges.current.get(pin.id);
          photoPurges.current.delete(pin.id);
          if (pin.mapId) {
            void commitPinDelete(pin.id);
            return;
          }
          if (pending) void removeStoredPinPhotos(pin.id, pending.photoIds);
        },
      );
    } catch (error) {
      const nextMessage =
        error instanceof PinStoreError || error instanceof RemotePinError || error instanceof PhotoError
          ? error.message
          : "ピンを削除できませんでした";
      showStatus(nextMessage, 4000);
    }
  }, [commitPinDelete, pendingDelete, removePin, restorePin, showStatus, user]);

  const handleShare = useCallback(
    async (pin: SavedPin) => {
      try {
        const outcome = await sharePin(pin);
        if (outcome === "copied") showStatus("共有用の内容をコピーしました");
      } catch {
        showStatus("共有できませんでした", 4000);
      }
    },
    [showStatus],
  );

  const openNearby = useCallback(async () => {
    if (openingNearby) return;
    setOpeningNearby(true);
    try {
      if (!isFreshFix(locationRef.current)) {
        try {
          await requestCurrentLocation();
        } catch (error) {
          if (error instanceof GeolocationFailure && (error.reason === "denied" || error.reason === "unsupported")) return;
          showStatus("現在地を取得できませんでした。もう一度押してください。", 4000);
          return;
        }
      }
      setSelectedId(null);
      setPinChoices(null);
      setPendingDelete(null);
      setNearbyOpen(true);
    } finally {
      setOpeningNearby(false);
    }
  }, [openingNearby, requestCurrentLocation, showStatus]);

  const sheetOpen = composer !== null;
  const mapControlsHidden =
    sheetOpen || selectedPin !== null || pendingDelete !== null || pinChoices !== null || nearbyOpen || tab !== "map";
  const mapUsable = mapReady && !mapError && mapMounted;
  const readOnlyMap = Boolean(activeMap) && writeStatusFor(activeMap, user?.id ?? null, isAdmin) === null && Boolean(user);
  const canSave = mapUsable && !readOnlyMap && mapCatalog.ready;
  const manageable = selectedPin ? canManagePin(selectedPin, activeMap, user?.id ?? null, isAdmin) : false;
  const showMapError = Boolean(mapError) && tab === "map" && !selectedPin && !composer && !pendingDelete && !pinChoices;
  const choicePins = pinChoices
    ?.map((id) => visiblePins.find((pin) => pin.id === id))
    .filter((pin): pin is SavedPin => Boolean(pin));
  const nearbyPins = location
    ? visiblePins
        .map((pin) => ({
          pin,
          meters: distanceMeters(location.latitude, location.longitude, pin.latitude, pin.longitude),
        }))
        .filter((item) => item.meters <= NEARBY_RADIUS_METERS)
        .sort((left, right) => left.meters - right.meters)
    : [];

  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
      <MapCanvasSlot
        key={mapInstanceKey}
        active={mapMounted}
        pins={visiblePins}
        photoRevision={photoRevision}
        userLocation={location}
        interactionsEnabled={!sheetOpen && tab === "map"}
        onReady={handleReady}
        onDispose={handleDispose}
        onUserGesture={handleUserGesture}
        onFatalError={handleFatalError}
        onChunkError={handleFatalError}
        onSelectPin={handleSelectPin}
        onClearPin={handleClearPin}
      />
      {tab === "map" && !sheetOpen && mapUsable ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Crosshair pulseKey={pulseKey} />
        </div>
      ) : null}
      {tab === "map" && !sheetOpen && !selectedPin && !pendingDelete ? (
        <MapSwitcher
          label={activeMap?.name ?? "この端末"}
          maps={mapCatalog.maps}
          selectedId={mapCatalog.selectedId}
          loggedIn={Boolean(user)}
          staff={isStaff}
          onSelect={mapCatalog.selectMap}
          onLogin={() => setLoginOpen(true)}
          onCreateShared={mapCatalog.createShared}
          onIssueInvite={mapCatalog.issueInvite}
          onListMembers={mapCatalog.listMembers}
          onUpdateRole={mapCatalog.updateRole}
          onRemoveMember={mapCatalog.removeMember}
        />
      ) : null}
      {tab === "map" && !sheetOpen && !selectedPin ? (
        <PlaceSearch
          onPick={(hit) => {
            setFollow(false);
            aimedPlaceRef.current = hit;
            flyTo({ latitude: hit.latitude, longitude: hit.longitude });
          }}
        />
      ) : null}
      {mapControlsHidden || !mapUsable ? null : (
        <button
          type="button"
          onClick={() => void openNearby()}
          disabled={openingNearby}
          aria-label="近くのピン"
          className="absolute left-4 z-20 flex h-14 items-center rounded-full bg-white px-5 text-base font-bold text-brand shadow-[0_8px_24px_rgba(36,48,56,0.16)] transition active:scale-95 disabled:opacity-70"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 9.25rem)" }}
        >
          {openingNearby ? "取得中" : "近く"}
        </button>
      )}
      {mapControlsHidden || !mapUsable ? null : (
        <CurrentLocationButton
          requesting={requesting}
          recovering={recovering}
          following={following}
          onLocate={() => void handleLocate()}
        />
      )}
      <StatusToast
        message={message}
        action={action}
        placement={tab === "map" && !sheetOpen && !selectedPin && !pendingDelete ? "map" : "top"}
        onDismiss={dismiss}
        onHold={hold}
        onRelease={release}
      />
      {mapControlsHidden ? null : (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
        >
          {canSave ? null : (
            <p className="mb-2 rounded-full bg-white/95 px-4 py-2 text-center text-base shadow-[0_8px_24px_rgba(36,48,56,0.12)]">
              {readOnlyMap
                ? "このマップは閲覧だけです"
                : !mapCatalog.ready
                  ? "マップを読み込んでいます"
                  : mapError
                    ? "地図を表示できないため、ここは保存できません"
                    : "地図を読み込んでから保存できます"}
            </p>
          )}
          <SavePlaceButton enabled={canSave} saving={saving} onSave={() => void handleQuickSave()} />
        </div>
      )}
      {selectedPin && !composer ? (
        <PinDetailCard
          key={selectedPin.id}
          pin={selectedPin}
          canManage={manageable}
          onPhotosChange={() => setPhotoRevision((current) => current + 1)}
          onClose={() => setSelectedId(null)}
          onEdit={() => {
            setComposer({ mode: "edit", pin: selectedPin });
            setSelectedId(null);
          }}
          onDelete={() => setPendingDelete(selectedPin)}
          onShare={() => void handleShare(selectedPin)}
        />
      ) : null}
      {composer ? (
        <PinSheet
          mode={composer.mode}
          latitude={composer.mode === "create" ? composer.latitude : composer.pin.latitude}
          longitude={composer.mode === "create" ? composer.longitude : composer.pin.longitude}
          initialValues={composer.mode === "create" ? composer.values : composer.pin}
          marathon={activeMap?.mapType === "marathon"}
          saving={saving}
          onClose={() => setComposer(null)}
          onSubmit={(values) => void handleSubmit(values)}
        />
      ) : null}
      {nearbyOpen && location ? (
        <NearbyPinsSheet
          pins={nearbyPins}
          onSelect={(id) => {
            const pin = visiblePins.find((item) => item.id === id);
            setNearbyOpen(false);
            setFollow(false);
            setSelectedId(id);
            if (!pin) return;
            flyTo({ latitude: pin.latitude, longitude: pin.longitude });
          }}
          onClose={() => setNearbyOpen(false)}
        />
      ) : null}
      {choicePins && choicePins.length > 1 ? (
        <PinChoiceSheet
          pins={choicePins}
          onSelect={(id) => {
            setPinChoices(null);
            setSelectedId(id);
          }}
          onClose={() => setPinChoices(null)}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          pin={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      ) : null}
      {tab === "saved" && !selectedPin && !composer ? (
        <PinList pins={visiblePins} onClose={() => setTab("map")} onSelect={handleSelectFromList} onImport={importPins} />
      ) : null}
      {tab === "settings" && !selectedPin && !composer ? (
        <SettingsPanel
          loggedIn={Boolean(user)}
          mapName={activeMap?.name ?? "この端末"}
          onLogin={() => setLoginOpen(true)}
          onLogout={() => void createBrowserSupabase().auth.signOut()}
        />
      ) : null}
      {sheetOpen || selectedPin || pendingDelete || pinChoices || nearbyOpen ? null : (
        <BottomNav tab={tab} onChange={setTab} />
      )}
      {showMapError && mapError ? <MapNotice message={mapError} onRetry={handleRetryMap} /> : null}
      {loginOpen ? <LoginSheet onClose={() => setLoginOpen(false)} /> : null}
      {user && localPinCount > 0 && !moveSkipped ? (
        <MigrateDialog
          count={localPinCount}
          busy={movingPins}
          canMoveShared={Boolean(activeMap && (activeMap.mapType === "shared" || activeMap.mapType === "marathon") && writeStatusFor(activeMap, user.id, isAdmin))}
          canMovePersonal={Boolean(mapCatalog.personalMapId)}
          onShared={() => {
            if (!activeMap) return;
            setMovingPins(true);
            void moveLocalPins(activeMap.id)
              .then(() => setMoveSkipped(true))
              .catch(() => showStatus("共有マップへ移せませんでした", 4000))
              .finally(() => setMovingPins(false));
          }}
          onPersonal={() => {
            if (!mapCatalog.personalMapId) return;
            setMovingPins(true);
            void moveLocalPins(mapCatalog.personalMapId)
              .then(() => setMoveSkipped(true))
              .catch(() => showStatus("マイマップへ移せませんでした", 4000))
              .finally(() => setMovingPins(false));
          }}
          onSkip={() => setMoveSkipped(true)}
        />
      ) : null}
    </div>
  );
}
