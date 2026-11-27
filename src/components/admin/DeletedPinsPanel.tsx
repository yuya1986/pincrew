"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPinDate, pinTitle } from "@/lib/pins/display";
import { listDeletedPins, restoreDeletedPin, type DeletedPin } from "@/lib/pins/remote-pins";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function DeletedPinsPanel() {
  const [pins, setPins] = useState<DeletedPin[]>([]);
  const [mapNames, setMapNames] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [deleted, maps] = await Promise.all([
        listDeletedPins(),
        createBrowserSupabase().from("maps").select("id, name"),
      ]);
      const names: Record<string, string> = {};
      for (const map of maps.data ?? []) names[map.id] = map.name;
      setMapNames(names);
      setPins(deleted);
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "削除したピンを読み込めませんでした");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  async function revive(pin: DeletedPin) {
    if (busyId) return;
    setBusyId(pin.id);
    try {
      await restoreDeletedPin(pin.id);
      setPins((current) => current.filter((item) => item.id !== pin.id));
      setNotice("復活しました");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "復活できませんでした");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-5 rounded-[28px] bg-white p-5">
      <h2 className="text-lg font-bold">削除したピン</h2>
      <p className="mt-2 text-base leading-7 text-muted">管理者だけが、削除したピンを地図へ戻せます。</p>
      {pins.length === 0 ? <p className="mt-3 text-base leading-7 text-muted">削除したピンはありません。</p> : null}
      <ul className="mt-3 space-y-3">
        {pins.map((pin) => (
          <li key={pin.id} className="rounded-2xl bg-[#fbfaf7] p-3">
            <p className="text-base font-bold">{pinTitle(pin)}</p>
            <p className="mt-1 text-base text-muted">
              {mapNames[pin.mapId ?? ""] ?? "マップ"} · {formatPinDate(pin.deletedAt)}
            </p>
            {pin.memo.trim() ? <p className="mt-1 text-base leading-7">{pin.memo}</p> : null}
            <button
              type="button"
              disabled={busyId === pin.id}
              onClick={() => void revive(pin)}
              className="mt-3 h-10 rounded-full bg-brand px-4 text-base font-bold text-white disabled:opacity-60"
            >
              復活
            </button>
          </li>
        ))}
      </ul>
      {notice ? <p className="mt-3 text-base leading-7 text-muted">{notice}</p> : null}
    </section>
  );
}
