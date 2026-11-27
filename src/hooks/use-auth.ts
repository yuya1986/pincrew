"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { isInternalAuthEmail } from "@/lib/auth/login-id";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AccountRole = "user" | "marathon_staff" | "admin";

export type AccountProfile = {
  role: AccountRole;
  loginId: string;
  displayName: string;
  active: boolean;
  email: string;
};

export function useAuth() {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    if (!configured) return;

    let active = true;
    const supabase = createBrowserSupabase();

    const publish = async (nextUser: User | null) => {
      if (!nextUser) {
        if (!active) return;
        setUser(null);
        setProfile(null);
        setReady(true);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role, login_id, display_name, is_active")
        .eq("id", nextUser.id)
        .maybeSingle();
      if (!active) return;
      if (data && data.is_active === false) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setReady(true);
        return;
      }
      const role: AccountRole =
        data?.role === "admin" || data?.role === "marathon_staff" ? data.role : "user";
      setUser(nextUser);
      setProfile({
        role,
        loginId: data?.login_id ?? "",
        displayName: data?.display_name ?? "",
        active: data?.is_active !== false,
        email: isInternalAuthEmail(nextUser.email) ? "" : (nextUser.email ?? ""),
      });
      setReady(true);
    };

    supabase.auth
      .getUser()
      .then(({ data }) => publish(data.user))
      .catch(() => {
        if (active) setReady(true);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void publish(session?.user ?? null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [configured]);

  return {
    configured,
    ready,
    user,
    profile,
    isAdmin: profile?.role === "admin",
    isStaff: profile?.role === "marathon_staff",
  };
}
