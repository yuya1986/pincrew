"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type StatusAction = {
  label: string;
  onClick: () => void;
};

export function useStatusMessage() {
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<StatusAction | null>(null);
  const timerRef = useRef<number | null>(null);

  const expireRef = useRef<(() => void) | null>(null);
  const durationRef = useRef(2600);
  const heldRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    const expire = expireRef.current;
    expireRef.current = null;
    setMessage(null);
    setAction(null);
    expire?.();
  }, []);

  const arm = useCallback(
    (durationMs: number) => {
      clearTimer();
      durationRef.current = durationMs;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (heldRef.current) return;
        finish();
      }, durationMs);
    },
    [clearTimer, finish],
  );

  const dismiss = useCallback(() => {
    clearTimer();
    expireRef.current = null;
    setMessage(null);
    setAction(null);
  }, [clearTimer]);

  const hold = useCallback(() => {
    heldRef.current = true;
    clearTimer();
  }, [clearTimer]);

  const release = useCallback(() => {
    heldRef.current = false;
    arm(durationRef.current);
  }, [arm]);

  const showStatus = useCallback(
    (
      next: string,
      durationMs = 2600,
      nextAction: StatusAction | null = null,
      onExpire: (() => void) | null = null,
    ) => {
      heldRef.current = false;
      const previous = expireRef.current;
      expireRef.current = onExpire;
      previous?.();
      setMessage(next);
      setAction(nextAction);
      arm(durationMs);
    },
    [arm],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { message, action, showStatus, dismiss, hold, release };
}
