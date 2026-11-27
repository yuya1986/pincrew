"use client";

import Link from "next/link";
import { useState } from "react";
import { DeletedPinsPanel } from "@/components/admin/DeletedPinsPanel";
import { ModerationPanel } from "@/components/admin/ModerationPanel";
import { StaffAdmin } from "@/components/admin/StaffAdmin";
import { authErrorMessage } from "@/lib/auth/messages";
import { useAuth } from "@/hooks/use-auth";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function AdminPage() {
  const { configured, ready, user, profile, isAdmin } = useAuth();
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revision, setRevision] = useState(0);

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
    const { error } = await createBrowserSupabase().auth.signInWithPassword({
      email: nextEmail,
      password,
    });
    setSubmitting(false);
    if (error) setNotice(authErrorMessage(error.message, "login"));
  }

  return (
    <main className="mx-auto min-h-full max-w-md bg-background px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[calc(env(safe-area-inset-bottom)+2.5rem)] text-foreground">
      <h1 className="text-xl font-bold">PinCrew 管理画面</h1>
      {!configured ? <p className="mt-4 text-base leading-7">ログインの設定がありません。</p> : null}
      {configured && !ready ? <p className="mt-4 text-base leading-7">読み込み中</p> : null}
      {configured && ready && user ? (
        <div className="mt-5 rounded-[28px] bg-white p-5">
          <p className="text-base leading-7">
            {isAdmin ? "管理者としてログインしています。" : "このアカウントは管理者ではありません。"}
          </p>
          {profile?.email ? <p className="mt-2 text-base text-muted">{profile.email}</p> : null}
          <button
            type="button"
            onClick={() => void createBrowserSupabase().auth.signOut()}
            className="mt-5 h-12 w-full rounded-full bg-[#f4f1ec] text-base font-bold"
          >
            ログアウト
          </button>
        </div>
      ) : null}
      {configured && ready && isAdmin ? (
        <>
          <StaffAdmin onChanged={() => setRevision((current) => current + 1)} />
          <DeletedPinsPanel />
          <ModerationPanel revision={revision} />
        </>
      ) : null}
      {configured && ready && !user ? (
        <form
          className="mt-5 space-y-4 rounded-[28px] bg-white p-5"
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
              className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-base font-medium">パスワード</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none"
            />
          </label>
          {notice ? <p className="text-base leading-7 text-muted">{notice}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="h-14 w-full rounded-full bg-brand text-lg font-bold text-white disabled:opacity-60"
          >
            ログイン
          </button>
        </form>
      ) : null}
      <Link href="/" className="mt-6 inline-flex h-12 items-center text-base font-bold text-brand">
        地図へ戻る
      </Link>
    </main>
  );
}
