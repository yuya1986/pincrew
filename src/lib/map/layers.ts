import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { Coordinates } from "@/lib/geo/types";
import { USER_LOCATION_COLOR } from "@/lib/map/constants";
import { pinsToFeatureCollection, userLocationToFeatureCollection } from "@/lib/map/geojson";
import { registerPinIconImages } from "@/lib/map/pin-images";
import type { SavedPin } from "@/lib/pins/types";

export const SAVED_PINS_SOURCE_ID = "saved-pins";
export const USER_LOCATION_SOURCE_ID = "user-location";

function isGeoJsonSource(source: unknown): source is GeoJSONSource {
  return (
    typeof source === "object" &&
    source !== null &&
    "type" in source &&
    source.type === "geojson" &&
    "setData" in source &&
    typeof source.setData === "function"
  );
}

function getGeoJsonSource(map: MapLibreMap, sourceId: string): GeoJSONSource | null {
  const source = map.getSource(sourceId);
  return isGeoJsonSource(source) ? source : null;
}

export const SAVED_PIN_LAYER_IDS = ["saved-pins", "saved-pins-icon"] as const;

export function addOverlayLayers(map: MapLibreMap): void {
  registerPinIconImages(map);

  map.addSource(SAVED_PINS_SOURCE_ID, {
    type: "geojson",
    data: pinsToFeatureCollection([]),
  });

  map.addLayer({
    id: "saved-pins",
    type: "circle",
    source: SAVED_PINS_SOURCE_ID,
    paint: {
      "circle-radius": 18,
      "circle-color": ["get", "color"],
      "circle-opacity": ["case", ["==", ["get", "hasPhoto"], 1], 0, 1],
      "circle-stroke-width": ["case", ["==", ["get", "hasPhoto"], 1], 0, 3],
      "circle-stroke-color": "#ffffff",
    },
  });

  map.addLayer({
    id: "saved-pins-icon",
    type: "symbol",
    source: SAVED_PINS_SOURCE_ID,
    layout: {
      "icon-image": ["get", "iconImage"],
      "icon-size": ["case", ["==", ["get", "hasPhoto"], 1], 0.85, 0.72],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });

  map.addSource(USER_LOCATION_SOURCE_ID, {
    type: "geojson",
    data: userLocationToFeatureCollection(null),
  });

  map.addLayer({
    id: "user-location-halo",
    type: "circle",
    source: USER_LOCATION_SOURCE_ID,
    paint: {
      "circle-radius": 18,
      "circle-color": USER_LOCATION_COLOR,
      "circle-opacity": 0.22,
    },
  });

  map.addLayer({
    id: "user-location-dot",
    type: "circle",
    source: USER_LOCATION_SOURCE_ID,
    paint: {
      "circle-radius": 8,
      "circle-color": USER_LOCATION_COLOR,
      "circle-stroke-width": 3,
      "circle-stroke-color": "#ffffff",
    },
  });
}

export function syncSavedPins(
  map: MapLibreMap,
  pins: SavedPin[],
  photoIcons: Readonly<Record<string, string>> = {},
): void {
  getGeoJsonSource(map, SAVED_PINS_SOURCE_ID)?.setData(pinsToFeatureCollection(pins, photoIcons));
}

export function syncUserLocation(map: MapLibreMap, location: Coordinates | null): void {
  getGeoJsonSource(map, USER_LOCATION_SOURCE_ID)?.setData(
    userLocationToFeatureCollection(location),
  );
}
