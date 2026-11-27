"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GeolocationFailure,
  GPS_FRESH_MS,
  gpsWatchStalled,
  readFreshPosition,
  watchCurrentPosition,
} from "@/lib/geo/geolocation";
import type { Coordinates } from "@/lib/geo/types";

const CHECK_MS = 3_000;

export function useCurrentLocation() {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const locationRef = useRef<Coordinates | null>(null);
  const deniedRef = useRef(false);
  const watchStopRef = useRef<(() => void) | null>(null);
  const watchStartedAtRef = useRef(0);
  const kickRef = useRef<Promise<Coordinates> | null>(null);

  const applyFix = useCallback((coords: Coordinates) => {
    locationRef.current = coords;
    setLocation(coords);
    setRecovering(false);
  }, []);

  const stopWatch = useCallback(() => {
    watchStopRef.current?.();
    watchStopRef.current = null;
  }, []);

  const startWatch = useCallback(() => {
    if (deniedRef.current || typeof navigator === "undefined" || !navigator.geolocation) return;
    stopWatch();
    watchStartedAtRef.current = Date.now();
    watchStopRef.current = watchCurrentPosition(applyFix, (error) => {
      if (error.reason === "denied" || error.reason === "unsupported") {
        deniedRef.current = true;
        setRecovering(false);
        setErrorMessage(error.message);
        stopWatch();
        return;
      }
      const current = locationRef.current;
      const age = current?.updatedAt === undefined ? null : Date.now() - current.updatedAt;
      if (current && (age === null || age > GPS_FRESH_MS)) setRecovering(true);
      watchStartedAtRef.current = 0;
    });
  }, [applyFix, stopWatch]);

  const kick = useCallback(() => {
    if (kickRef.current) return kickRef.current;
    const pending = readFreshPosition()
      .then((coords) => {
        applyFix(coords);
        return coords;
      })
      .finally(() => {
        if (kickRef.current === pending) kickRef.current = null;
      });
    kickRef.current = pending;
    return pending;
  }, [applyFix]);

  const revive = useCallback(() => {
    if (deniedRef.current || document.visibilityState === "hidden") return;
    const fix = locationRef.current;
    const watchAge = Date.now() - watchStartedAtRef.current;
    const fixAge = fix?.updatedAt === undefined ? null : Date.now() - fix.updatedAt;
    if (watchStopRef.current && !gpsWatchStalled(watchAge, fixAge)) return;
    if (fix && (fixAge === null || fixAge > GPS_FRESH_MS)) setRecovering(true);
    startWatch();
    void kick().catch(() => {});
  }, [kick, startWatch]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErrorMessage("このブラウザは位置情報に対応していません。地図を動かして場所を選べます。");
      return;
    }

    startWatch();
    const timer = window.setInterval(revive, CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState !== "visible" || deniedRef.current) return;
      const fix = locationRef.current;
      const fixAge = fix?.updatedAt === undefined ? null : Date.now() - fix.updatedAt;
      if (fix && (fixAge === null || fixAge > GPS_FRESH_MS)) setRecovering(true);
      startWatch();
      void kick().catch(() => {});
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      onVisible();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      stopWatch();
    };
  }, [kick, revive, startWatch, stopWatch]);

  const requestCurrentLocation = useCallback(async (): Promise<Coordinates> => {
    setRequesting(true);
    if (locationRef.current) setRecovering(true);
    startWatch();
    try {
      return await kick();
    } catch (error) {
      if (error instanceof GeolocationFailure && (error.reason === "denied" || error.reason === "unsupported")) {
        deniedRef.current = true;
        setRecovering(false);
        setErrorMessage(error.message);
        stopWatch();
      } else if (locationRef.current) {
        setRecovering(true);
      }
      throw error;
    } finally {
      setRequesting(false);
    }
  }, [kick, startWatch, stopWatch]);

  return { location, errorMessage, requesting, recovering, requestCurrentLocation };
}
