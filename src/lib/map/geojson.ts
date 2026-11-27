import type { FeatureCollection, Point } from "geojson";
import type { Coordinates } from "@/lib/geo/types";
import { pinIconImageId } from "@/lib/pins/catalog";
import type { SavedPin } from "@/lib/pins/types";

type PinProperties = {
  id: string;
  title: string;
  color: string;
  iconImage: string;
  hasPhoto: number;
};

export function pinsToFeatureCollection(
  pins: SavedPin[],
  photoIcons: Readonly<Record<string, string>> = {},
): FeatureCollection<Point, PinProperties> {
  return {
    type: "FeatureCollection",
    features: pins.map((pin) => ({
      type: "Feature",
      id: pin.id,
      geometry: {
        type: "Point",
        coordinates: [pin.longitude, pin.latitude],
      },
      properties: {
        id: pin.id,
        title: pin.title,
        color: pin.color,
        iconImage: photoIcons[pin.id] ?? pinIconImageId(pin.icon),
        hasPhoto: photoIcons[pin.id] ? 1 : 0,
      },
    })),
  };
}

export function userLocationToFeatureCollection(
  location: Coordinates | null,
): FeatureCollection<Point> {
  if (!location) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [location.longitude, location.latitude],
        },
        properties: {},
      },
    ],
  };
}
