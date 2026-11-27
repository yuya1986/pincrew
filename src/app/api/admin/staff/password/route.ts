import { requireAdmin, serviceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  const service = serviceClient();
  if (!service) return Response.json({ error: "ログインの設定がありません。" }, { status: 500 });

  let body: { userId?: string; password?: string };
  try {
    body = (await request.json()) as { userId?: string; password?: string };
  } catch {
    return Response.json({ error: "入力を確認してください。" }, { status: 400 });
  }

  const userId = body.userId ?? "";
  const password = body.password ?? "";
  if (!userId || password.length < 8) {
    return Response.json({ error: "パスワードは8文字以上にしてください。" }, { status: 400 });
  }

  const profile = await service.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile.data?.role !== "marathon_staff") {
    return Response.json({ error: "スタッフアカウントだけ変更できます。" }, { status: 403 });
  }

  const updated = await service.auth.admin.updateUserById(userId, { password });
  if (updated.error) return Response.json({ error: "パスワードを変更できませんでした。" }, { status: 500 });
  return Response.json({ ok: true });
}
