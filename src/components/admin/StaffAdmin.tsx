"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type StaffAccount = {
  id: string;
  loginId: string;
  displayName: string;
  active: boolean;
  mapName: string;
};

async function adminFetch(path: string, body?: unknown) {
  const { data } = await createBrowserSupabase().auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("ログインしてください。");
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json()) as { error?: string; staff?: StaffAccount[] };
  if (!response.ok) throw new Error(payload.error ?? "操作できませんでした。");
  return payload;
}

export function StaffAdmin({ onChanged }: { onChanged?: () => void }) {
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mapName, setMapName] = useState("マラソン大会コース");
  const [nextPassword, setNextPassword] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const payload = await adminFetch("/api/admin/staff");
    setStaff(payload.staff ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload().catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "スタッフを読み込めませんでした。");
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  async function createStaff() {
    setBusy(true);
    setNotice(null);
    try {
      await adminFetch("/api/admin/staff", { loginId, password, displayName, mapName });
      setPassword("");
      setNotice("スタッフアカウントを作成しました。パスワードは再表示しません。");
      await reload();
      onChanged?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "作成できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(userId: string) {
    setBusy(true);
    setNotice(null);
    try {
      await adminFetch("/api/admin/staff/password", { userId, password: nextPassword[userId] ?? "" });
      setNextPassword((current) => ({ ...current, [userId]: "" }));
      setNotice("パスワードを変更しました。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "変更できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(account: StaffAccount, active: boolean) {
    setBusy(true);
    setNotice(null);
    try {
      await adminFetch("/api/admin/staff/active", { userId: account.id, active });
      setNotice(active ? "有効にしました。" : "無効にしました。");
      await reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "変更できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-[28px] bg-white p-5">
      <h2 className="text-lg font-bold">スタッフ共有アカウント</h2>
      <p className="mt-2 text-base leading-7 text-muted">作成したパスワードは保存せず、ここにも残しません。</p>
      <div className="mt-4 space-y-3">
        <input value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="ログインID" aria-label="スタッフログインID" className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none" />
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="パスワード" aria-label="スタッフパスワード" className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none" />
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="表示名" aria-label="スタッフ表示名" className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none" />
        <input value={mapName} onChange={(event) => setMapName(event.target.value)} placeholder="使用する共有マップ" aria-label="使用する共有マップ" className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none" />
        <button type="button" disabled={busy} onClick={() => void createStaff()} className="h-12 w-full rounded-full bg-brand text-base font-bold text-white disabled:opacity-60">
          スタッフを作成
        </button>
      </div>
      <ul className="mt-5 space-y-3">
        {staff.map((account) => (
          <li key={account.id} className="rounded-2xl bg-[#fbfaf7] p-3">
            <p className="text-base font-bold">{account.loginId || "ID未設定"}</p>
            <p className="mt-1 text-base text-muted">{account.displayName || "表示名なし"}</p>
            <p className="text-base text-muted">{account.mapName || "マップ未設定"}</p>
            <p className="text-base">{account.active ? "有効" : "無効"}</p>
            <input
              type="password"
              value={nextPassword[account.id] ?? ""}
              onChange={(event) => setNextPassword((current) => ({ ...current, [account.id]: event.target.value }))}
              placeholder="新しいパスワード"
              aria-label={`${account.loginId}の新しいパスワード`}
              className="mt-3 h-11 w-full rounded-2xl border border-[#e6e1d8] bg-white px-3 text-base outline-none"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void changePassword(account.id)} className="h-10 rounded-full bg-white px-3 text-base font-bold">
                パスワード変更
              </button>
              <button type="button" disabled={busy} onClick={() => void setActive(account, !account.active)} className="h-10 rounded-full bg-white px-3 text-base font-bold">
                {account.active ? "無効にする" : "有効にする"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {notice ? <p className="mt-3 text-base leading-7 text-muted">{notice}</p> : null}
    </section>
  );
}
