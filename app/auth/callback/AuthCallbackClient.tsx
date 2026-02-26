"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasSupabaseEnv, supabase, supabaseConfigMessage } from "../../../lib/supabase";

export default function AuthCallbackClient() {
  const router = useRouter();
  const [message, setMessage] = useState(
    hasSupabaseEnv ? "Completing login..." : supabaseConfigMessage
  );

  useEffect(() => {
    let mounted = true;
    if (!hasSupabaseEnv) return;

    const completeAuth = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error(error);
          if (mounted) setMessage("Login failed. Please try again.");
          return;
        }
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.error(error);
          if (mounted) setMessage("Login failed. Please try again.");
          return;
        }
      }

      if (mounted) {
        setMessage("Login complete. Redirecting...");
      }
      router.replace("/");
      router.refresh();
    };

    void completeAuth();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-md rounded-xl border border-slate-300 bg-white p-6 text-center shadow">
        <p className="text-sm font-medium">{message}</p>
      </div>
    </main>
  );
}
