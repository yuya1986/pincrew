import { internalAuthEmail, isInternalAuthEmail, isLoginId, normalizeLoginId } from "@/lib/auth/login-id";
import { requireUser, serviceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const service = serviceClient();
  if (!service) return Response.json({ error: "ログインの設定がありません。" }, { status: 500 });

  let body: { loginId?: string };
  try {
    body = (await request.json()) as { loginId?: string };
  } catch {
    return Response.json({ error: "ログインIDの形式を確認してください。" }, { status: 400 });
  }

  const loginId = normalizeLoginId(body.loginId ?? "");
  if (!isLoginId(loginId)) {
    return Response.json({ error: "ログインIDは3〜30文字の半角英数字、_、-で入力してください。" }, { status: 400 });
  }

  const taken = await service
    .from("profiles")
    .select("id")
    .eq("login_id", loginId)
    .neq("id", user.userId)
    .maybeSingle();
  if (taken.error) return Response.json({ error: "ログインIDを確認できませんでした。" }, { status: 500 });
  if (taken.data) return Response.json({ error: "このIDは既に使用されています。" }, { status: 409 });

  const updated = await service.from("profiles").update({ login_id: loginId }).eq("id", user.userId).select("id");
  if (updated.error || !updated.data?.length) {
    return Response.json({ error: "ログインIDを保存できませんでした。" }, { status: 500 });
  }

  if (isInternalAuthEmail(user.email)) {
    const emailUpdated = await service.auth.admin.updateUserById(user.userId, {
      email: internalAuthEmail(loginId),
      email_confirm: true,
    });
    if (emailUpdated.error) {
      return Response.json({ error: "ログインIDを保存できませんでした。" }, { status: 500 });
    }
  }

  return Response.json({ loginId });
}
