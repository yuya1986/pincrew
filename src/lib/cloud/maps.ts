import { createBrowserSupabase } from "@/lib/supabase/client";

export type MapVisibility = "private" | "shared" | "public";
export type MapType = "personal" | "shared" | "recommended" | "marathon";
export type MemberRole = "owner" | "editor" | "viewer";

export type CloudMap = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  visibility: MapVisibility;
  mapType: MapType;
  myRole: MemberRole | null;
};

export type MapMember = {
  id: string;
  userId: string;
  role: MemberRole;
  displayName: string;
};

type MapRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  visibility: MapVisibility;
  map_type: MapType;
};

const MAP_COLUMNS = "id, owner_id, name, description, visibility, map_type";
const RECOMMENDED_ORDER = ["グルメ", "カフェ", "観光", "スポーツ", "買い物"];

function toMap(row: MapRow, myRole: MemberRole | null): CloudMap {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    mapType: row.map_type,
    myRole,
  };
}

function sortMaps(maps: CloudMap[]): CloudMap[] {
  return [...maps].sort((left, right) => {
    const rank = (map: CloudMap) => {
      if (map.mapType === "personal") return 0;
      if (map.mapType === "recommended") return 1 + Math.max(RECOMMENDED_ORDER.indexOf(map.name), 0);
      return 20;
    };
    const diff = rank(left) - rank(right);
    return diff === 0 ? left.name.localeCompare(right.name, "ja") : diff;
  });
}

export async function loadVisibleMaps(userId: string | null): Promise<CloudMap[]> {
  const supabase = createBrowserSupabase();
  const roles = new Map<string, MemberRole>();

  if (userId) {
    const { data, error } = await supabase
      .from("map_members")
      .select("map_id, role")
      .eq("user_id", userId);
    if (error) throw new Error("マップを読み込めませんでした");
    for (const row of data ?? []) roles.set(row.map_id, row.role as MemberRole);
  }

  const { data: visible, error: visibleError } = await supabase.from("maps").select(MAP_COLUMNS);
  if (visibleError) throw new Error("マップを読み込めませんでした");

  const maps = ((visible ?? []) as MapRow[])
    .filter((row) => row.visibility === "public" || roles.has(row.id))
    .map((row) => toMap(row, roles.get(row.id) ?? null));

  return sortMaps(maps);
}

export async function createSharedMap(userId: string, name: string): Promise<{ mapId: string; inviteId: string }> {
  const supabase = createBrowserSupabase();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("マップの名前を入力してください");

  const { data: map, error } = await supabase
    .from("maps")
    .insert({
      owner_id: userId,
      name: trimmed.slice(0, 40),
      description: "",
      visibility: "shared",
      map_type: "shared",
    })
    .select("id")
    .single();
  if (error || !map) throw new Error("共有マップを作成できませんでした");

  const { error: memberError } = await supabase.from("map_members").insert({
    map_id: map.id,
    user_id: userId,
    role: "owner",
  });
  if (memberError) throw new Error("共有マップを作成できませんでした");

  const inviteId = await createMapInvite(map.id, userId);
  return { mapId: map.id, inviteId };
}

export async function createMapInvite(mapId: string, userId: string): Promise<string> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("map_invites")
    .insert({ map_id: mapId, created_by: userId })
    .select("id")
    .single();
  if (error || !data) throw new Error("招待リンクを発行できませんでした");
  return data.id;
}

export async function listMapMembers(mapId: string): Promise<MapMember[]> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("map_members")
    .select("id, user_id, role")
    .eq("map_id", mapId);
  if (error) throw new Error("メンバーを読み込めませんでした");

  const rows = data ?? [];
  const ids = rows.map((row) => row.user_id);
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids);
    for (const profile of profiles ?? []) names.set(profile.id, profile.display_name);
  }

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    role: row.role as MemberRole,
    displayName: names.get(row.user_id)?.trim() || "メンバー",
  }));
}

export async function updateMemberRole(memberId: string, role: MemberRole): Promise<void> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase.from("map_members").update({ role }).eq("id", memberId).select("id");
  if (error || !data?.length) throw new Error("役割を変更できませんでした");
}

export async function removeMapMember(memberId: string): Promise<void> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase.from("map_members").delete().eq("id", memberId).select("id");
  if (error || !data?.length) throw new Error("メンバーを外せませんでした");
}

export async function joinMap(inviteId: string): Promise<string> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase.rpc("join_map", { invite_id: inviteId });
  if (error || typeof data !== "string") throw new Error("この招待では参加できませんでした");
  return data;
}
