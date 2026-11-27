import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteJoin } from "@/components/maps/InviteJoin";

export const metadata: Metadata = {
  title: "共有マップ",
};

async function InviteParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InviteJoin inviteId={id} />;
}

export default function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="h-dvh overflow-y-auto overscroll-y-contain">
      <Suspense
        fallback={
          <main className="mx-auto min-h-full max-w-md bg-background px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[calc(env(safe-area-inset-bottom)+2.5rem)] text-foreground">
            <h1 className="text-xl font-bold">PinCrew</h1>
            <p className="mt-4 text-base leading-7">読み込み中</p>
          </main>
        }
      >
        <InviteParams params={params} />
      </Suspense>
    </div>
  );
}
