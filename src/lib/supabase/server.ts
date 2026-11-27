import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ServerSupabase = {
  url: string;
  publishableKey: string;
  secretKey: string;
};

export function serverSupabase(): ServerSupabase | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) return null;
  return { url, publishableKey, secretKey };
}

export function serviceClient(): SupabaseClient | null {
  const env = serverSupabase();
  if (!env) return null;
  return createClient(env.url, env.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(accessToken: string): SupabaseClient | null {
  const env = serverSupabase();
  if (!env) return null;
  return createClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function requireAdmin(request: Request): Promise<{ userId: string } | Response> {
  const header = request.headers.get("authorization") ?? "";
  const accessToken = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!accessToken) return Response.json({ error: "ログインしてください。" }, { status: 401 });

  const client = userClient(accessToken);
  if (!client) return Response.json({ error: "ログインの設定がありません。" }, { status: 500 });

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return Response.json({ error: "ログインしてください。" }, { status: 401 });

  const profile = await client.from("profiles").select("role, is_active").eq("id", data.user.id).maybeSingle();
  if (profile.error || profile.data?.role !== "admin" || profile.data.is_active === false) {
    return Response.json({ error: "管理者だけが操作できます。" }, { status: 403 });
  }

  return { userId: data.user.id };
}

export async function requireUser(request: Request): Promise<{ userId: string; email: string | null } | Response> {
  const header = request.headers.get("authorization") ?? "";
  const accessToken = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!accessToken) return Response.json({ error: "ログインしてください。" }, { status: 401 });

  const client = userClient(accessToken);
  if (!client) return Response.json({ error: "ログインの設定がありません。" }, { status: 500 });

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return Response.json({ error: "ログインしてください。" }, { status: 401 });
  return { userId: data.user.id, email: data.user.email ?? null };
}
