"use client";

import { useState } from "react";
import type { CloudMap, MapMember, MemberRole } from "@/lib/cloud/maps";

type MapSwitcherProps = {
  label: string;
  maps: CloudMap[];
  selectedId: string | "local";
  loggedIn: boolean;
  staff: boolean;
  onSelect: (id: string | "local") => void;
  onLogin: () => void;
  onCreateShared: (name: string) => Promise<string>;
  onIssueInvite: (mapId: string) => Promise<string>;
  onListMembers: (mapId: string) => Promise<MapMember[]>;
  onUpdateRole: (member: MapMember, role: MemberRole) => Promise<void>;
  onRemoveMember: (member: MapMember) => Promise<void>;
};

const RECOMMENDED_MARK: Record<string, string> = {
  グルメ: "🍜",
  カフェ: "☕",
  観光: "🌸",
  スポーツ: "🏃",
  買い物: "🛍",
};

function inviteUrl(inviteId: string): string {
  return `${window.location.origin}/invite/${inviteId}`;
}

export function MapSwitcher({
  label,
  maps,
  selectedId,
  loggedIn,
  staff,
  onSelect,
  onLogin,
  onCreateShared,
  onIssueInvite,
  onListMembers,
  onUpdateRole,
  onRemoveMember,
}: MapSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [shareName, setShareName] = useState("");
  const [invite, setInvite] = useState<string | null>(null);
  const [members, setMembers] = useState<MapMember[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = maps.find((map) => map.id === selectedId) ?? null;
  const personal = staff ? [] : maps.filter((map) => map.mapType === "personal");
  const recommended = staff ? [] : maps.filter((map) => map.mapType === "recommended");
  const shared = maps.filter((map) => map.mapType === "shared" || map.mapType === "marathon");
  const canManageMembers = selected?.mapType === "shared" && selected.myRole === "owner";

  function choose(id: string | "local") {
    onSelect(id);
    setOpen(false);
    setInvite(null);
    setMembers(null);
    setNotice(null);
  }

  async function createShared() {
    if (!loggedIn) {
      setOpen(false);
      onLogin();
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const inviteId = await onCreateShared(shareName);
      setShareName("");
      setInvite(inviteUrl(inviteId));
      setOpen(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "共有マップを作成できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function showInvite() {
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    try {
      const inviteId = await onIssueInvite(selected.id);
      setInvite(inviteUrl(inviteId));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "招待リンクを発行できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function showMembers() {
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    try {
      setMembers(await onListMembers(selected.id));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "メンバーを読み込めませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(member: MapMember, role: MemberRole) {
    setBusy(true);
    setNotice(null);
    try {
      await onUpdateRole(member, role);
      if (selected) setMembers(await onListMembers(selected.id));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "役割を変更できませんでした");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 z-10 px-4"
        style={{ top: "calc(env(safe-area-inset-top) + 4.25rem)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pointer-events-auto h-10 max-w-[calc(100%-7.5rem)] truncate rounded-full bg-white/95 px-4 text-base font-bold shadow-[0_8px_24px_rgba(36,48,56,0.12)]"
          >
            {label} ▼
          </button>
          <p className="flex shrink-0 items-center gap-1.5 text-base font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand" aria-hidden>
              <span className="h-2 w-2 rounded-full bg-white" />
            </span>
            PinCrew
          </p>
        </div>
      </div>
      {open ? (
        <div className="absolute inset-0 z-40 flex items-end">
          <button type="button" className="absolute inset-0 bg-[#243038]/35" aria-label="閉じる" onClick={() => setOpen(false)} />
          <section
            className="relative max-h-[80dvh] w-full overflow-y-auto rounded-t-[28px] bg-white px-5 pt-3 shadow-[0_-12px_40px_rgba(36,48,56,0.16)]"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex justify-center">
              <span className="h-1.5 w-12 rounded-full bg-[#e6e1d8]" />
            </div>
            <div className="flex items-center justify-between pt-3">
              <h2 className="text-xl font-bold">マップ</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-base font-medium text-muted">
                閉じる
              </button>
            </div>
            {personal.length > 0 ? (
              <MapGroup title="マイマップ" maps={personal} selectedId={selectedId} onSelect={choose} />
            ) : null}
            {recommended.length > 0 ? (
              <MapGroup title="みんなのおすすめ" maps={recommended} selectedId={selectedId} onSelect={choose} marked />
            ) : null}
            {shared.length > 0 ? (
              <MapGroup title={staff ? "マラソン大会" : "共有マップ"} maps={shared} selectedId={selectedId} onSelect={choose} />
            ) : null}
            {!loggedIn && !staff ? (
              <button type="button" onClick={() => choose("local")} className={rowClass(selectedId === "local")}>
                この端末
              </button>
            ) : null}
            {staff ? null : (
              <div className="mt-4 rounded-[24px] bg-[#fbfaf7] p-4">
                <p className="text-base font-bold">共有マップを作る</p>
                <input
                  value={shareName}
                  onChange={(event) => setShareName(event.target.value)}
                  placeholder="旅行2026"
                  aria-label="共有マップの名前"
                  className="mt-3 h-12 w-full rounded-2xl border border-[#e6e1d8] bg-white px-4 text-base outline-none"
                />
                <button
                  type="button"
                  disabled={busy || shareName.trim().length === 0}
                  onClick={() => void createShared()}
                  className="mt-3 h-12 w-full rounded-full bg-brand text-base font-bold text-white disabled:opacity-60"
                >
                  作成して招待リンクを発行
                </button>
              </div>
            )}
            {notice ? <p className="mt-3 text-base leading-7 text-muted">{notice}</p> : null}
          </section>
        </div>
      ) : null}
      {(selected?.mapType === "shared" || selected?.mapType === "marathon") && !open && !staff ? (
        <div
          className="absolute inset-x-0 z-10 flex gap-2 px-4"
          style={{ top: "calc(env(safe-area-inset-top) + 7rem)" }}
        >
          {selected.myRole === "owner" ? (
            <button type="button" onClick={() => void showInvite()} className="h-10 rounded-full bg-white/95 px-4 text-base font-bold shadow-[0_8px_24px_rgba(36,48,56,0.12)]">
              招待リンク
            </button>
          ) : null}
          {canManageMembers ? (
            <button type="button" onClick={() => void showMembers()} className="h-10 rounded-full bg-white/95 px-4 text-base font-bold shadow-[0_8px_24px_rgba(36,48,56,0.12)]">
              メンバー
            </button>
          ) : null}
        </div>
      ) : null}
      {invite ? (
        <div className="absolute inset-x-4 z-30 rounded-3xl bg-white p-4 shadow-[0_12px_32px_rgba(36,48,56,0.16)]" style={{ top: "calc(env(safe-area-inset-top) + 10rem)" }}>
          <p className="text-base font-bold">招待リンク</p>
          <p className="mt-2 break-all text-base leading-7">{invite}</p>
          {notice ? <p className="mt-2 text-base text-muted">{notice}</p> : null}
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(invite).then(() => setNotice("コピーしました")).catch(() => setNotice("コピーできませんでした"))}
            className="mt-3 h-11 rounded-full bg-brand px-4 text-base font-bold text-white"
          >
            コピー
          </button>
          <button type="button" onClick={() => setInvite(null)} className="mt-3 ml-2 h-11 rounded-full bg-[#f4f1ec] px-4 text-base font-bold">
            閉じる
          </button>
        </div>
      ) : null}
      {members ? (
        <div className="absolute inset-0 z-40 flex items-end">
          <button type="button" className="absolute inset-0 bg-[#243038]/35" aria-label="閉じる" onClick={() => setMembers(null)} />
          <section className="relative max-h-[70dvh] w-full overflow-y-auto rounded-t-[28px] bg-white px-5 pt-4" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
            <h2 className="text-xl font-bold">メンバー</h2>
            <ul className="mt-3 space-y-3">
              {members.map((member) => (
                <li key={member.id} className="rounded-2xl bg-[#fbfaf7] p-3">
                  <p className="text-base font-bold">{member.displayName}</p>
                  {member.role === "owner" ? (
                    <p className="mt-1 text-base text-muted">オーナー</p>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      {(["editor", "viewer"] as const).map((role) => (
                        <button
                          key={role}
                          type="button"
                          disabled={busy}
                          onClick={() => void changeRole(member, role)}
                          className={`h-10 rounded-full px-3 text-base font-bold ${member.role === role ? "bg-brand text-white" : "bg-white"}`}
                        >
                          {role === "editor" ? "編集可" : "閲覧のみ"}
                        </button>
                      ))}
                      <button type="button" disabled={busy} onClick={() => void onRemoveMember(member).then(() => showMembers())} className="h-10 rounded-full px-3 text-base font-bold text-muted">
                        外す
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {notice ? <p className="mt-3 text-base text-muted">{notice}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

function MapGroup({
  title,
  maps,
  selectedId,
  marked,
  onSelect,
}: {
  title: string;
  maps: CloudMap[];
  selectedId: string | "local";
  marked?: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-base font-bold text-muted">{title}</p>
      <div className="mt-2 space-y-2">
        {maps.map((map) => (
          <button key={map.id} type="button" onClick={() => onSelect(map.id)} className={rowClass(map.id === selectedId)}>
            {marked ? `${RECOMMENDED_MARK[map.name] ?? ""} ` : ""}
            {map.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function rowClass(active: boolean): string {
  return `mt-2 flex h-12 w-full items-center rounded-2xl px-4 text-left text-base font-bold ${active ? "bg-[#243038] text-white" : "bg-[#f4f1ec]"}`;
}
