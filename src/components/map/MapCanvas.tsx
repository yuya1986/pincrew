"use client";

import { useEffect, useRef, useState } from "react";
import { AttributionControl, Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import type { Coordinates } from "@/lib/geo/types";
import { DEFAULT_CENTER, DEFAULT_ZOOM, getMapStyleUrl } from "@/lib/map/constants";
import { addOverlayLayers, SAVED_PIN_LAYER_IDS, syncSavedPins, syncUserLocation } from "@/lib/map/layers";
import { loadPinPhotoIcon } from "@/lib/map/pin-images";
import { usePinCovers } from "@/hooks/use-pin-covers";
import type { SavedPin } from "@/lib/pins/types";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl("/maplibre-gl-worker.js");

const MAP_LOAD_TIMEOUT_MS = 12000;

type MapCanvasProps = {
  pins: SavedPin[];
  photoRevision?: number;
  userLocation: Coordinates | null;
  interactionsEnabled: boolean;
  onReady: (map: MapLibreMap) => void;
  onDispose: () => void;
  onUserGesture: () => void;
  onFatalError: (message: string) => void;
  onSelectPin: (ids: string[]) => void;
  onClearPin: () => void;
};

export function MapCanvas({
  pins,
  photoRevision = 0,
  userLocation,
  interactionsEnabled,
  onReady,
  onDispose,
  onUserGesture,
  onFatalError,
  onSelectPin,
  onClearPin,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinsRef = useRef(pins);
  const userLocationRef = useRef(userLocation);
  const onReadyRef = useRef(onReady);
  const onDisposeRef = useRef(onDispose);
  const onUserGestureRef = useRef(onUserGesture);
  const onFatalErrorRef = useRef(onFatalError);
  const onSelectPinRef = useRef(onSelectPin);
  const onClearPinRef = useRef(onClearPin);
  const [styleReady, setStyleReady] = useState(false);
  const [photoIcons, setPhotoIcons] = useState<Record<string, string>>({});
  const covers = usePinCovers(
    pins.map((pin) => pin.id),
    photoRevision,
  );

  useEffect(() => {
    pinsRef.current = pins;
    userLocationRef.current = userLocation;
    onReadyRef.current = onReady;
    onDisposeRef.current = onDispose;
    onUserGestureRef.current = onUserGesture;
    onFatalErrorRef.current = onFatalError;
    onSelectPinRef.current = onSelectPin;
    onClearPinRef.current = onClearPin;
  }, [
    onClearPin,
    onDispose,
    onFatalError,
    onReady,
    onSelectPin,
    onUserGesture,
    pins,
    userLocation,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let stopped = false;
    let removed = false;
    let timeoutId = 0;
    let map: MapLibreMap | null = null;

    const destroy = () => {
      if (removed) return;
      removed = true;
      window.clearTimeout(timeoutId);
      if (map) {
        try {
          map.remove();
        } catch {
          // 読み込み途中で破棄しても、次の初期化を止めない。
        }
      }
      mapRef.current = null;
    };

    const reportFatal = (message: string) => {
      if (cancelled || stopped) return;
      stopped = true;
      onFatalErrorRef.current(message);
      destroy();
    };

    try {
      map = new MapLibreMap({
        container,
        style: getMapStyleUrl(),
        center: [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maplibreLogo: false,
      });
    } catch {
      reportFatal("このブラウザでは地図を表示できません");
      return;
    }

    map.addControl(new AttributionControl({ compact: true }), "bottom-left");
    const attributionCorner = map
      .getContainer()
      .querySelector(".maplibregl-ctrl-bottom-left");
    if (attributionCorner instanceof HTMLElement) {
      attributionCorner.style.left = "0.75rem";
      attributionCorner.style.bottom = "calc(env(safe-area-inset-bottom) + 6.5rem)";
    }
    map
      .getContainer()
      .querySelector(".maplibregl-ctrl-attrib")
      ?.classList.add("maplibregl-compact");
    mapRef.current = map;

    timeoutId = window.setTimeout(() => {
      reportFatal("地図を読み込めませんでした。通信状況を確認して、もう一度開いてください。");
    }, MAP_LOAD_TIMEOUT_MS);

    const handleLoad = () => {
      if (cancelled || stopped) return;
      window.clearTimeout(timeoutId);
      map.resize();
      addOverlayLayers(map);
      syncSavedPins(map, pinsRef.current);
      syncUserLocation(map, userLocationRef.current);
      map.on("click", (event) => {
        const box = 28;
        const features = map.queryRenderedFeatures(
          [
            [event.point.x - box, event.point.y - box],
            [event.point.x + box, event.point.y + box],
          ],
          { layers: [...SAVED_PIN_LAYER_IDS] },
        );
        const nearest = new Map<string, number>();
        for (const feature of features) {
          const pinId = feature.properties?.id;
          if (typeof pinId !== "string" || pinId.length === 0) continue;
          if (feature.geometry.type !== "Point") continue;
          const [longitude, latitude] = feature.geometry.coordinates;
          const distance = (longitude - event.lngLat.lng) ** 2 + (latitude - event.lngLat.lat) ** 2;
          const previous = nearest.get(pinId);
          if (previous === undefined || distance < previous) nearest.set(pinId, distance);
        }
        const ids = [...nearest.entries()].sort((left, right) => left[1] - right[1]).map(([id]) => id);
        if (ids.length === 0) {
          onClearPinRef.current();
          return;
        }
        onSelectPinRef.current(ids);
      });
      for (const layerId of SAVED_PIN_LAYER_IDS) {
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
      }
      setStyleReady(true);
      onReadyRef.current(map);
    };

    const handleError = (event: { error: { message?: string } }) => {
      const message = event.error.message?.toLowerCase() ?? "";
      if (message.includes("webgl")) {
        window.clearTimeout(timeoutId);
        reportFatal("このブラウザでは地図を表示できません");
      }
    };

    const handleGesture = (event: { originalEvent?: Event }) => {
      if (event.originalEvent) onUserGestureRef.current();
    };

    map.on("load", handleLoad);
    map.on("error", handleError);
    map.on("dragstart", handleGesture);
    map.on("zoomstart", handleGesture);

    const resize = () => {
      map.resize();
    };

    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      onDisposeRef.current();
      destroy();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    let cancelled = false;

    void (async () => {
      const next: Record<string, string> = {};
      for (const [pinId, cover] of Object.entries(covers)) {
        const imageId = `pin-photo-${cover.photoId}`;
        if (!map.getStyle()) return;
        if (!map.hasImage(imageId)) {
          const image = await loadPinPhotoIcon(cover.url);
          if (cancelled || !map.getStyle()) return;
          if (!image) continue;
          if (!map.hasImage(imageId)) map.addImage(imageId, image, { pixelRatio: 2 });
        }
        if (!cancelled && map.hasImage(imageId)) next[pinId] = imageId;
      }
      if (!cancelled) setPhotoIcons(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [covers, styleReady]);

  useEffect(() => {
    if (!styleReady || !mapRef.current) return;
    syncSavedPins(mapRef.current, pins, photoIcons);
  }, [pins, photoIcons, styleReady]);

  useEffect(() => {
    if (!styleReady || !mapRef.current) return;
    syncUserLocation(mapRef.current, userLocation);
  }, [styleReady, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    const handlers = [
      map.dragPan,
      map.scrollZoom,
      map.doubleClickZoom,
      map.touchZoomRotate,
      map.keyboard,
    ];
    for (const handler of handlers) {
      if (interactionsEnabled) handler.enable();
      else handler.disable();
    }
  }, [interactionsEnabled, styleReady]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-[#efe8df]"
      role="application"
      aria-label="地図"
    />
  );
}
