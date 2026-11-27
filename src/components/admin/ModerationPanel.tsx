"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteRemotePin, setRemotePinStatus } from "@/lib/pins/remote-pins";
import { pinTitle } from "@/lib/pins/display";
import type { SavedPin } from "@/lib/pins/types";
import { createBrowserSupabase } from "@/lib/supabase/client";

type PendingPin = SavedPin;

const COLUMNS =
  "id, map_id, created_by, created_by_label, latitude, longitude, address, title, memo, category, icon, color, status, visited_at, created_at, updated_at";

type SharedMap = { id: string; name: string };

export function ModerationPanel({ revision = 0 }: { revision?: number }) {
  const [pending, setPending] = useState<PendingPin[]>([]);
  const [sharedMaps, setSharedMaps] = useState<SharedMap[]>([]);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const reload = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const [pinsResult, mapsResult, usersResult] = await Promise.all([
      supabase.from("pins").select(COLUMNS).eq("status", "pending").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("maps").select("id, name").eq("map_type", "shared").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    if (pinsResult.error || mapsResult.error || usersResult.error) {
      setNotice("管理情報を読み込めませんでした");
      return;
    }
    setPending(
      ((pinsResult.data ?? []) as Array<Record<string, string | number>>).map((row) => ({
        id: String(row.id),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        address: String(row.address ?? ""),
        title: String(row.title ?? ""),
        memo: String(row.memo ?? ""),
        category: String(row.category ?? ""),
        icon: String(row.icon ?? ""),
        color: String(row.color ?? ""),
        visitedAt: String(row.visited_at),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        syncStatus: "synced" as const,
        mapId: String(row.map_id),
        status: "pending" as const,
        createdBy: row.created_by ? String(row.created_by) : null,
        createdByLabel: row.created_by_label ? String(row.created_by_label) : "",
      })),
    );
    setSharedMaps((mapsResult.data ?? []) as SharedMap[]);
    setUserCount(usersResult.count);
    setNotice(null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload, revision]);

  async function decide(pin: PendingPin, status: "approved" | "rejected") {
    try {
      await setRemotePinStatus(pin.id, status);
      setPending((current) => current.filter((item) => item.id !== pin.id));
      setNotice(status === "approved" ? "公開しました" : "却下しました");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "変更できませんでした");
    }
  }

  async function saveTitle(pin: PendingPin) {
    try {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase
        .from("pins")
        .update({ title: draft.trim(), updated_at: new Date().toISOString() })
        .eq("id", pin.id)
        .select("id");
      if (error || !data?.length) throw new Error("変更できませんでした");
      setEditingId(null);
      await reload();
      setNotice("タイトルを保存しました");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "変更できませんでした");
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <section className="rounded-[28px] bg-white p-5">
        <p className="text-base font-bold">確認</p>
        <p className="mt-2 text-base leading-7">ユーザー {userCount ?? "—"} 人</p>
        <p className="text-base leading-7">共有マップ {sharedMaps.length} 件</p>
        {sharedMaps.length > 0 ? (
          <ul className="mt-2 text-base leading-7 text-muted">
            {sharedMaps.map((map) => (
              <li key={map.id}>{map.name}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-base leading-7 text-muted">
          みんなのおすすめを地図で選ぶと、管理者が追加した場所はすぐに公開されます。通報の確認は次の更新で対応します。
        </p>
      </section>
      <section className="rounded-[28px] bg-white p-5">
        <h2 className="text-lg font-bold">承認待ち</h2>
        {pending.length === 0 ? <p className="mt-3 text-base leading-7 text-muted">承認待ちはありません。</p> : null}
        <ul className="mt-3 space-y-3">
          {pending.map((pin) => (
            <li key={pin.id} className="rounded-2xl bg-[#fbfaf7] p-3">
              {editingId === pin.id ? (
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  aria-label="タイトル"
                  className="h-11 w-full rounded-2xl border border-[#e6e1d8] bg-white px-3 text-base outline-none"
                />
              ) : (
                <p className="text-base font-bold">{pinTitle(pin)}</p>
              )}
              <p className="mt-1 text-base text-muted">{pin.category}</p>
              {pin.memo.trim() ? <p className="mt-1 text-base leading-7">{pin.memo}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void decide(pin, "approved")} className="h-10 rounded-full bg-brand px-3 text-base font-bold text-white">
                  承認
                </button>
                <button type="button" onClick={() => void decide(pin, "rejected")} className="h-10 rounded-full bg-white px-3 text-base font-bold">
                  却下
                </button>
                {editingId === pin.id ? (
                  <button type="button" onClick={() => void saveTitle(pin)} className="h-10 rounded-full bg-white px-3 text-base font-bold">
                    保存
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(pin.id);
                      setDraft(pin.title);
                    }}
                    className="h-10 rounded-full bg-white px-3 text-base font-bold"
                  >
                    編集
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void deleteRemotePin(pin.id).then(() => setPending((current) => current.filter((item) => item.id !== pin.id))).catch(() => setNotice("削除できませんでした"))}
                  className="h-10 rounded-full px-3 text-base font-bold text-muted"
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
        {notice ? <p className="mt-3 text-base leading-7 text-muted">{notice}</p> : null}
      </section>
    </div>
  );
}
