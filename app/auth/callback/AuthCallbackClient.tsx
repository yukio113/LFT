"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("ログイン処理中...");

  useEffect(() => {
    let mounted = true;

    const completeAuth = async () => {
      const code = searchParams.get("code");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error(error);
          if (mounted) setMessage("ログインに失敗しました。もう一度お試しください。");
          return;
        }
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.error(error);
          if (mounted) setMessage("ログインに失敗しました。もう一度お試しください。");
          return;
        }
      }

      if (mounted) {
        setMessage("ログイン成功。トップへ戻ります...");
      }
      router.replace("/");
      router.refresh();
    };

    void completeAuth();

    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-md rounded-xl border border-slate-300 bg-white p-6 text-center shadow">
        <p className="text-sm font-medium">{message}</p>
      </div>
    </main>
  );
}
