"use client";

import { useState } from "react";
import { isLoginId, normalizeLoginId } from "@/lib/auth/login-id";
import { readStaffLabel, writeStaffLabel } from "@/lib/auth/staff-label";
import { useAuth } from "@/hooks/use-auth";
import { createBrowserSupabase } from "@/lib/supabase/client";

type SettingsPanelProps = {
  loggedIn: boolean;
  mapName: string;
  onLogin: () => void;
  onLogout: () => void;
};

export function SettingsPanel({ loggedIn, mapName, onLogin, onLogout }: SettingsPanelProps) {
  const { profile, user, isStaff } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [loginId, setLoginId] = useState(profile?.loginId ?? "");
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [staffLabel, setStaffLabel] = useState(readStaffLabel);
  const [seenProfile, setSeenProfile] = useState(`${profile?.displayName ?? ""}|${profile?.loginId ?? ""}`);
  const profileKey = `${profile?.displayName ?? ""}|${profile?.loginId ?? ""}`;
  if (profileKey !== seenProfile) {
    setSeenProfile(profileKey);
    setDisplayName(profile?.displayName ?? "");
    setLoginId(profile?.loginId ?? "");
  }
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function checkLoginId(value: string) {
    const normalized = normalizeLoginId(value);
    if (!isLoginId(normalized)) {
      setLoginNotice("3〜30文字の半角英数字、_、-が使えます。");
      return;
    }
    if (normalized === profile?.loginId) {
      setLoginNotice("現在のログインIDです。");
      return;
    }
    const { data, error } = await createBrowserSupabase().rpc("login_id_available", { candidate: normalized });
    if (error) {
      setLoginNotice("確認できませんでした。");
      return;
    }
    setLoginNotice(data ? "このIDは使用できます。" : "このIDは既に使用されています。");
  }

  async function saveDisplayName() {
    if (!user) return;
    setBusy(true);
    setNotice(null);
    const { error } = await createBrowserSupabase()
      .from("profiles")
      .update({ display_name: displayName.trim().slice(0, 40) })
      .eq("id", user.id);
    setBusy(false);
    setNotice(error ? "表示名を保存できませんでした。" : "表示名を保存しました。");
  }

  async function saveLoginId() {
    if (!user) return;
    setBusy(true);
    setNotice(null);
    const { data } = await createBrowserSupabase().auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setBusy(false);
      setNotice("ログインしてください。");
      return;
    }
    const response = await fetch("/api/account/login-id", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ loginId }),
    });
    const body = (await response.json()) as { error?: string };
    setBusy(false);
    setNotice(response.ok ? "ログインIDを保存しました。" : (body.error ?? "ログインIDを保存できませんでした。"));
  }

  async function changePassword() {
    if (!user?.email) return;
    if (nextPassword.length < 8) {
      setNotice("パスワードは8文字以上にしてください。");
      return;
    }
    if (nextPassword !== confirmPassword) {
      setNotice("新しいパスワードが一致しません。");
      return;
    }
    setBusy(true);
    setNotice(null);
    const supabase = createBrowserSupabase();
    const signed = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (signed.error) {
      setBusy(false);
      setNotice("現在のパスワードが違います。");
      return;
    }
    const updated = await supabase.auth.updateUser({ password: nextPassword });
    setBusy(false);
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
    setNotice(updated.error ? "パスワードを変更できませんでした。" : "パスワードを変更しました。");
  }

  return (
    <section className="absolute inset-0 z-20 overflow-y-auto bg-background px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
      <h2 className="text-xl font-bold">設定</h2>
      <p className="mt-1 text-base text-muted">アプリ名 PinCrew</p>
      {!loggedIn ? (
        <div className="mt-5 rounded-[28px] bg-white p-5">
          <p className="text-base leading-7 text-muted">
            ログインすると、複数端末で同期できます。友達とマップを共有したり、おすすめスポットを投稿したりできます。ログインしなくても、この端末だけに場所を保存できます。
          </p>
          <button type="button" onClick={onLogin} className="mt-4 h-12 w-full rounded-full bg-brand text-base font-bold text-white">
            ログイン
          </button>
        </div>
      ) : !profile ? (
        <p className="mt-5 text-base leading-7">読み込み中</p>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-[28px] bg-white p-5">
            <p className="text-base font-bold">アカウント</p>
            <label className="mt-4 block">
              <span className="mb-2 block text-base font-medium">表示名</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none"
              />
            </label>
            <button type="button" disabled={busy} onClick={() => void saveDisplayName()} className="mt-3 h-11 rounded-full bg-[#f4f1ec] px-4 text-base font-bold">
              表示名を保存
            </button>
            <label className="mt-4 block">
              <span className="mb-2 block text-base font-medium">ログインID</span>
              <input
                autoCapitalize="none"
                autoCorrect="off"
                value={loginId}
                readOnly={isStaff}
                onChange={(event) => {
                  setLoginId(event.target.value);
                  setLoginNotice(null);
                }}
                onBlur={() => {
                  if (!isStaff) void checkLoginId(loginId);
                }}
                className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none read-only:text-muted"
              />
            </label>
            {loginNotice ? <p className="mt-2 text-base text-muted">{loginNotice}</p> : null}
            {isStaff ? null : (
              <button type="button" disabled={busy} onClick={() => void saveLoginId()} className="mt-3 h-11 rounded-full bg-brand px-4 text-base font-bold text-white">
                IDを設定
              </button>
            )}
            {profile?.email ? <p className="mt-4 text-base leading-7 text-muted">メールアドレス {profile.email}</p> : null}
            {isStaff ? <p className="mt-4 text-base leading-7">現在の共有マップ {mapName}</p> : null}
          </div>
          {isStaff ? (
            <div className="rounded-[28px] bg-white p-5">
              <label className="block">
                <span className="mb-2 block text-base font-medium">スタッフ名 / 端末名</span>
                <input
                  value={staffLabel}
                  onChange={(event) => setStaffLabel(event.target.value)}
                  placeholder="計測担当"
                  className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  writeStaffLabel(staffLabel);
                  setNotice("スタッフ名をこの端末に保存しました。");
                }}
                className="mt-3 h-11 rounded-full bg-[#f4f1ec] px-4 text-base font-bold"
              >
                端末に保存
              </button>
            </div>
          ) : (
            <form
              className="rounded-[28px] bg-white p-5"
              onSubmit={(event) => {
                event.preventDefault();
                void changePassword();
              }}
            >
              <p className="text-base font-bold">パスワード変更</p>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="現在のパスワード"
                aria-label="現在のパスワード"
                className="mt-3 h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
                placeholder="新しいパスワード"
                aria-label="新しいパスワード"
                className="mt-3 h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="新しいパスワード確認"
                aria-label="新しいパスワード確認"
                className="mt-3 h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none"
              />
              <button type="submit" disabled={busy} className="mt-3 h-11 rounded-full bg-[#f4f1ec] px-4 text-base font-bold">
                変更する
              </button>
            </form>
          )}
          {notice ? <p className="text-base leading-7 text-muted">{notice}</p> : null}
          <button type="button" onClick={onLogout} className="h-12 w-full rounded-full bg-brand text-base font-bold text-white">
            ログアウト
          </button>
        </div>
      )}
    </section>
  );
}
