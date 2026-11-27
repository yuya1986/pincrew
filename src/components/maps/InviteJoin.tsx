"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoginSheet } from "@/components/auth/LoginSheet";
import { useAuth } from "@/hooks/use-auth";
import { joinMap } from "@/lib/cloud/maps";

const INVITE_KEY = "kokomemo:selected-map";

export function InviteJoin({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const { configured, ready, user } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inviteId);

  async function join() {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    setJoining(true);
    setNotice(null);
    try {
      const mapId = await joinMap(inviteId);
      try {
        localStorage.setItem(INVITE_KEY, mapId);
      } catch {
        // 参加自体は完了している。次回の初期表示だけ既定のマップになる。
      }
      router.push("/");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "この招待では参加できませんでした");
      setJoining(false);
    }
  }

  return (
    <main className="relative mx-auto min-h-full max-w-md bg-background px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[calc(env(safe-area-inset-bottom)+2.5rem)] text-foreground">
      <h1 className="text-xl font-bold">PinCrew</h1>
      {!valid ? <p className="mt-4 text-base leading-7">この招待は見つかりません。</p> : null}
      {valid && !configured ? <p className="mt-4 text-base leading-7">ログインの設定がありません。</p> : null}
      {valid && configured && !ready ? <p className="mt-4 text-base leading-7">読み込み中</p> : null}
      {valid && configured && ready ? (
        <div className="mt-5 rounded-[28px] bg-white p-5">
          <p className="text-base leading-7">PinCrewの共有マップに招待されました。</p>
          <button
            type="button"
            disabled={joining}
            onClick={() => void join()}
            className="mt-4 h-14 w-full rounded-full bg-brand text-lg font-bold text-white disabled:opacity-60"
          >
            参加する
          </button>
          {notice ? <p className="mt-3 text-base leading-7 text-muted">{notice}</p> : null}
        </div>
      ) : null}
      <Link href="/" className="mt-6 inline-flex h-12 items-center text-base font-bold text-brand">
        地図へ戻る
      </Link>
      {loginOpen ? <LoginSheet onClose={() => setLoginOpen(false)} /> : null}
    </main>
  );
}
