import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/supabase/env";

export function createBrowserSupabase() {
  const env = supabaseEnv();
  if (!env) {
    throw new Error("Supabase の接続情報がありません");
  }

  return createBrowserClient(env.url, env.publishableKey);
}
