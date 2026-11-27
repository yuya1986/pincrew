import { requireAdmin, serviceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  const service = serviceClient();
  if (!service) return Response.json({ error: "ログインの設定がありません。" }, { status: 500 });

  let body: { userId?: string; active?: boolean };
  try {
    body = (await request.json()) as { userId?: string; active?: boolean };
  } catch {
    return Response.json({ error: "入力を確認してください。" }, { status: 400 });
  }

  const userId = body.userId ?? "";
  const active = body.active === true;
  if (!userId) return Response.json({ error: "スタッフを指定してください。" }, { status: 400 });

  const profile = await service.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile.data?.role !== "marathon_staff") {
    return Response.json({ error: "スタッフアカウントだけ変更できます。" }, { status: 403 });
  }

  const updated = await service.from("profiles").update({ is_active: active }).eq("id", userId).select("id");
  if (updated.error || !updated.data?.length) {
    return Response.json({ error: "状態を変更できませんでした。" }, { status: 500 });
  }

  const banned = await service.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h",
  });
  if (banned.error) return Response.json({ error: "状態を変更できませんでした。" }, { status: 500 });
  return Response.json({ active });
}
