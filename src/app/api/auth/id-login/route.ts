import { isLoginId, normalizeLoginId } from "@/lib/auth/login-id";
import { serverSupabase, serviceClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const env = serverSupabase();
  const service = serviceClient();
  if (!env || !service) return Response.json({ error: "ログインの設定がありません。" }, { status: 500 });

  let body: { loginId?: string; password?: string };
  try {
    body = (await request.json()) as { loginId?: string; password?: string };
  } catch {
    return Response.json({ error: "ログインIDの形式を確認してください。" }, { status: 400 });
  }

  const loginId = normalizeLoginId(body.loginId ?? "");
  const password = body.password ?? "";
  if (!isLoginId(loginId) || password.length < 8) {
    return Response.json({ error: "ログインIDかパスワードが違います。" }, { status: 401 });
  }

  const profile = await service
    .from("profiles")
    .select("id, is_active")
    .eq("login_id", loginId)
    .maybeSingle();
  if (profile.error || !profile.data) {
    return Response.json({ error: "ログインIDかパスワードが違います。" }, { status: 401 });
  }
  if (profile.data.is_active === false) {
    return Response.json({ error: "このアカウントは無効です。" }, { status: 403 });
  }

  const authUser = await service.auth.admin.getUserById(profile.data.id);
  const email = authUser.data.user?.email ?? "";
  if (!email) return Response.json({ error: "ログインIDかパスワードが違います。" }, { status: 401 });

  const anon = createClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await anon.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) {
    return Response.json({ error: "ログインIDかパスワードが違います。" }, { status: 401 });
  }

  return Response.json({
    accessToken: signed.data.session.access_token,
    refreshToken: signed.data.session.refresh_token,
  });
}
