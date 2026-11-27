"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createMapInvite,
  createSharedMap,
  listMapMembers,
  loadVisibleMaps,
  removeMapMember,
  updateMemberRole,
  type CloudMap,
  type MapMember,
  type MemberRole,
} from "@/lib/cloud/maps";
import type { AccountRole } from "@/hooks/use-auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const STORAGE_KEY = "kokomemo:selected-map";

function readStoredMapId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberMapId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // 選択中マップは次回の初期値。保存できなくても今の画面は使える。
  }
}

function defaultMapId(maps: CloudMap[], userId: string | null, role: AccountRole | null): string | "local" {
  if (role === "marathon_staff") {
    return maps.find((map) => map.mapType === "marathon")?.id ?? "local";
  }
  const stored = readStoredMapId();
  if (stored && maps.some((map) => map.id === stored)) return stored;
  if (!userId) return "local";
  return maps.find((map) => map.mapType === "personal" && map.myRole === "owner")?.id ?? "local";
}

export function useMaps(userId: string | null, authReady: boolean, role: AccountRole | null) {
  const configured = isSupabaseConfigured();
  const [maps, setMaps] = useState<CloudMap[]>([]);
  const [ready, setReady] = useState(!configured);
  const [selectedId, setSelectedId] = useState<string | "local">("local");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!configured) {
      setMaps([]);
      setSelectedId("local");
      setReady(true);
      return;
    }

    try {
      const next = await loadVisibleMaps(userId);
      setMaps(next);
      setSelectedId((current) =>
        role === "marathon_staff" || !(current !== "local" && next.some((map) => map.id === current))
          ? defaultMapId(next, userId, role)
          : current,
      );
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "マップを読み込めませんでした");
    } finally {
      setReady(true);
    }
  }, [configured, role, userId]);

  useEffect(() => {
    if (!authReady || !configured) return;
    let cancelled = false;
    loadVisibleMaps(userId)
      .then((next) => {
        if (cancelled) return;
        setMaps(next);
        setSelectedId((current) =>
          role === "marathon_staff" || !(current !== "local" && next.some((map) => map.id === current))
            ? defaultMapId(next, userId, role)
            : current,
        );
        setError(null);
        setReady(true);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "マップを読み込めませんでした");
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, configured, role, userId]);

  const selectMap = useCallback((id: string | "local") => {
    setSelectedId(id);
    rememberMapId(id);
  }, []);

  const createShared = useCallback(
    async (name: string) => {
      if (!userId) throw new Error("ログインすると、友達とマップを共有できます。");
      const created = await createSharedMap(userId, name);
      rememberMapId(created.mapId);
      setSelectedId(created.mapId);
      await reload();
      return created.inviteId;
    },
    [reload, userId],
  );

  const issueInvite = useCallback(
    async (mapId: string) => {
      if (!userId) throw new Error("ログインすると、招待リンクを発行できます。");
      return createMapInvite(mapId, userId);
    },
    [userId],
  );

  const selected = maps.find((map) => map.id === selectedId) ?? null;
  const personalMapId = maps.find((map) => map.mapType === "personal" && map.myRole === "owner")?.id ?? null;

  return {
    maps,
    ready,
    error,
    selectedId: selected ? selected.id : "local",
    selected,
    personalMapId,
    selectMap,
    createShared,
    issueInvite,
    reload,
    listMembers: listMapMembers,
    updateRole: async (member: MapMember, role: MemberRole) => {
      await updateMemberRole(member.id, role);
    },
    removeMember: async (member: MapMember) => {
      await removeMapMember(member.id);
    },
  };
}
