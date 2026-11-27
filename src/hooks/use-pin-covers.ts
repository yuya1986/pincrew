"use client";

import { useEffect, useState } from "react";
import { listPinCoverPhotos, type PinCover } from "@/lib/pins/photos";

export function usePinCovers(pinIds: string[], refreshKey = 0): Record<string, PinCover> {
  const [covers, setCovers] = useState<Record<string, PinCover>>({});
  const idsKey = pinIds.join("\n");

  useEffect(() => {
    let cancelled = false;
    const ids = idsKey ? idsKey.split("\n") : [];
    listPinCoverPhotos(ids)
      .then((next) => {
        if (!cancelled) setCovers(next);
      })
      .catch(() => {
        if (!cancelled) setCovers({});
      });
    return () => {
      cancelled = true;
    };
  }, [idsKey, refreshKey]);

  return covers;
}
