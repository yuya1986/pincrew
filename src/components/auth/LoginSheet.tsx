"use client";

import { useState } from "react";
import { isLoginId, normalizeLoginId } from "@/lib/auth/login-id";
import { authErrorMessage } from "@/lib/auth/messages";
import { createBrowserSupabase } from "@/lib/supabase/client";

type LoginSheetProps = {
  onClose: () => void;
};

const BENEFITS = ["複数端末で同期", "友達とマップ共有", "おすすめスポット投稿", "クラウドバックアップ"];

export function LoginSheet({ onClose }: LoginSheetProps) {
  const [mode, setMode] = useState<"id" | "email">("id");
  const [loginId, setLoginId] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (submitting) return;
    if (password.length < 8) {
      setNotice("パスワードは8文字以上にしてください。");
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      if (mode === "id") {
        const normalized = normalizeLoginId(loginId);
        if (!isLoginId(normalized)) {
          setNotice("ログインIDは3〜30文字の半角英数字、_、-で入力してください。");
          return;
        }
        const response = await fetch("/api/auth/id-login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ loginId: normalized, password }),
        });
        const body = (await response.json()) as { error?: string; accessToken?: string; refreshToken?: string };
        if (!response.ok || !body.accessToken || !body.refreshToken) {
          setNotice(body.error ?? "ログインできませんでした。");
          return;
        }
        const { error } = await createBrowserSupabase().auth.setSession({
          access_token: body.accessToken,
          refresh_token: body.refreshToken,
        });
        if (error) {
          setNotice("ログインできませんでした。");
          return;
        }
      } else {
        const nextEmail = address.trim();
        if (!nextEmail.includes("@")) {
          setNotice("メールアドレスの形式を確認してください。");
          return;
        }
        const { error } = await createBrowserSupabase().auth.signInWithPassword({
          email: nextEmail,
          password,
        });
        if (error) {
          setNotice(authErrorMessage(error.message, "login"));
          return;
        }
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end">
      <button type="button" className="absolute inset-0 bg-[#243038]/35" aria-label="閉じる" onClick={onClose} />
      <section className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-white px-5 pt-3 shadow-[0_-12px_40px_rgba(36,48,56,0.16)]">
        <div className="flex justify-center">
          <span className="h-1.5 w-12 rounded-full bg-[#e6e1d8]" />
        </div>
        <div className="flex items-center justify-between pt-3">
          <h2 className="text-xl font-bold">PinCrew</h2>
          <button type="button" onClick={onClose} className="text-base font-medium text-muted">
            閉じる
          </button>
        </div>
        <p className="mt-2 text-base leading-7 text-muted">場所をピンして、みんなで共有。</p>
        {mode === "id" ? (
          <p className="mt-3 text-base leading-7 text-muted">ログインすると、共有マップと複数端末の同期が使えます。</p>
        ) : (
          <>
            <p className="mt-3 text-base font-bold">ログインすると</p>
            <ul className="mt-1 text-base leading-7 text-muted">
              {BENEFITS.map((item) => (
                <li key={item}>・{item}</li>
              ))}
            </ul>
          </>
        )}
        <form
          className="space-y-4 py-4"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {mode === "id" ? (
            <label className="block">
              <span className="mb-2 block text-base font-medium">ログインID</span>
              <input
                autoCapitalize="none"
                autoCorrect="off"
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#e6e1d8] bg-[#fbfaf7] px-4 text-base outline-none"
              />
            </label>
          ) : (
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
          )}
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
          <button
            type="button"
            onClick={() => {
              setMode(mode === "id" ? "email" : "id");
              setNotice(null);
            }}
            className="h-12 w-full text-base font-bold text-brand"
          >
            {mode === "id" ? "個人アカウントはこちら" : "IDでログイン"}
          </button>
        </form>
      </section>
    </div>
  );
}
