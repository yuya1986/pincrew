"use client";

import { useState } from "react";
import { authErrorMessage } from "@/lib/auth/messages";
import { createBrowserSupabase } from "@/lib/supabase/client";

type AuthSheetProps = {
  email: string | null;
  busyMigrate: boolean;
  migrationCount: number;
  onClose: () => void;
  onMigrate: () => void;
  onSignOut: () => void;
};

export function AuthSheet({
  email,
  busyMigrate,
  migrationCount,
  onClose,
  onMigrate,
  onSignOut,
}: AuthSheetProps) {
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (submitting) return;
    const nextEmail = address.trim();
    if (!nextEmail.includes("@")) {
      setNotice("メールアドレスの形式を確認してください。");
      return;
    }
    if (password.length < 8) {
      setNotice("パスワードは8文字以上にしてください。");
      return;
    }

    setSubmitting(true);
    setNotice(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email: nextEmail, password });
    setSubmitting(false);
    if (error) {
      setNotice(authErrorMessage(error.message, "login"));
      return;
    }
    onClose();
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end">
      <button type="button" className="absolute inset-0 bg-[#243038]/35" aria-label="閉じる" onClick={onClose} />
      <section className="relative w-full rounded-t-[28px] bg-white px-5 pt-3 shadow-[0_-12px_40px_rgba(36,48,56,0.16)]">
        <div className="flex justify-center">
          <span className="h-1.5 w-12 rounded-full bg-[#e6e1d8]" />
        </div>
        <div className="flex items-center justify-between pt-3">
          <h2 className="text-xl font-bold">{email ? "管理者" : "管理者ログイン"}</h2>
          <button type="button" onClick={onClose} className="text-base font-medium text-muted">
            閉じる
          </button>
        </div>

        {email ? (
          <div className="py-5" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
            <p className="text-base leading-7">管理者としてログインしています。</p>
            <p className="mt-1 text-base leading-7 text-muted">{email}</p>
            {migrationCount > 0 ? (
              <button
                type="button"
                disabled={busyMigrate}
                onClick={onMigrate}
                className="mt-4 h-14 w-full rounded-full bg-brand text-lg font-bold text-white disabled:opacity-60"
              >
                この端末の{migrationCount}件を移す
              </button>
            ) : null}
            <button
              type="button"
              onClick={onSignOut}
              className="mt-3 h-12 w-full rounded-full bg-[#f4f1ec] text-base font-bold"
            >
              ログアウト
            </button>
          </div>
        ) : (
          <form
            className="space-y-4 py-5"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label className="block">
              <span className="mb-2 block text-base font-medium">メールアドレス</span>
              <input
                type="email"
                autoComplete="email"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-base font-medium">パスワード</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none focus:border-brand"
              />
            </label>
            {notice ? <p className="text-base leading-7 text-muted">{notice}</p> : null}
            <p className="text-base leading-7 text-muted">場所や写真の追加に、アカウントは要りません。</p>
            <button
              type="submit"
              disabled={submitting}
              className="h-14 w-full rounded-full bg-brand text-lg font-bold text-white disabled:opacity-60"
            >
              ログイン
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
