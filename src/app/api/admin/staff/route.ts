import { internalAuthEmail, isLoginId, normalizeLoginId } from "@/lib/auth/login-id";
import { requireAdmin, serviceClient } from "@/lib/supabase/server";

type StaffBody = {
  loginId?: string;
  password?: string;
  displayName?: string;
  mapName?: string;
};

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  const service = serviceClient();
  if (!service) return Response.json({ error: "ログインの設定がありません。" }, { status: 500 });

  const profiles = await service
    .from("profiles")
    .select("id, login_id, display_name, is_active")
    .eq("role", "marathon_staff")
    .order("created_at", { ascending: true });
  if (profiles.error) return Response.json({ error: "スタッフを読み込めませんでした。" }, { status: 500 });

  const ids = (profiles.data ?? []).map((profile) => profile.id);
  const memberships = ids.length
    ? await service.from("map_members").select("user_id, map_id").in("user_id", ids)
    : { data: [], error: null };
  if (memberships.error) return Response.json({ error: "スタッフを読み込めませんでした。" }, { status: 500 });

  const mapIds = [...new Set((memberships.data ?? []).map((row) => row.map_id))];
  const maps = mapIds.length
    ? await service.from("maps").select("id, name, map_type").in("id", mapIds)
    : { data: [], error: null };
  if (maps.error) return Response.json({ error: "スタッフを読み込めませんでした。" }, { status: 500 });

  const mapName = new Map((maps.data ?? []).filter((map) => map.map_type === "marathon").map((map) => [map.id, map.name]));
  const staffMap = new Map<string, string>();
  for (const member of memberships.data ?? []) {
    const name = mapName.get(member.map_id);
    if (name) staffMap.set(member.user_id, name);
  }

  return Response.json({
    staff: (profiles.data ?? []).map((profile) => ({
      id: profile.id,
      loginId: profile.login_id,
      displayName: profile.display_name,
      active: profile.is_active,
      mapName: staffMap.get(profile.id) ?? "",
    })),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  const service = serviceClient();
  if (!service) return Response.json({ error: "ログインの設定がありません。" }, { status: 500 });

  let body: StaffBody;
  try {
    body = (await request.json()) as StaffBody;
  } catch {
    return Response.json({ error: "入力を確認してください。" }, { status: 400 });
  }

  const loginId = normalizeLoginId(body.loginId ?? "");
  const password = body.password ?? "";
  const displayName = (body.displayName ?? "").trim().slice(0, 40);
  const mapName = (body.mapName ?? "").trim().slice(0, 40);
  if (!isLoginId(loginId)) {
    return Response.json({ error: "ログインIDは3〜30文字の半角英数字、_、-で入力してください。" }, { status: 400 });
  }
  if (password.length < 8) return Response.json({ error: "パスワードは8文字以上にしてください。" }, { status: 400 });
  if (!mapName) return Response.json({ error: "使用する共有マップの名前を入力してください。" }, { status: 400 });

  const taken = await service.from("profiles").select("id").eq("login_id", loginId).maybeSingle();
  if (taken.data) return Response.json({ error: "このIDは既に使用されています。" }, { status: 409 });

  const created = await service.auth.admin.createUser({
    email: internalAuthEmail(loginId),
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    return Response.json({ error: "スタッフアカウントを作成できませんでした。" }, { status: 500 });
  }

  const userId = created.data.user.id;
  const profile = await service
    .from("profiles")
    .update({ login_id: loginId, display_name: displayName, role: "marathon_staff", is_active: true })
    .eq("id", userId)
    .select("id");
  if (profile.error || !profile.data?.length) {
    await service.auth.admin.deleteUser(userId);
    return Response.json({ error: "スタッフアカウントを作成できませんでした。" }, { status: 500 });
  }

  const existing = await service
    .from("maps")
    .select("id")
    .eq("map_type", "marathon")
    .eq("name", mapName)
    .maybeSingle();
  let mapId = existing.data?.id ?? "";
  if (!mapId) {
    const inserted = await service
      .from("maps")
      .insert({
        owner_id: admin.userId,
        name: mapName,
        description: "",
        visibility: "shared",
        map_type: "marathon",
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      await service.auth.admin.deleteUser(userId);
      return Response.json({ error: "マラソンマップを作成できませんでした。" }, { status: 500 });
    }
    mapId = inserted.data.id;
    await service.from("map_members").insert({ map_id: mapId, user_id: admin.userId, role: "owner" });
  }

  const member = await service.from("map_members").insert({ map_id: mapId, user_id: userId, role: "editor" });
  if (member.error) {
    return Response.json({ error: "スタッフをマップへ追加できませんでした。" }, { status: 500 });
  }

  return Response.json({ id: userId, loginId, mapName });
}
