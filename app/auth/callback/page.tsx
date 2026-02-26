import { Suspense } from "react";
import AuthCallbackClient from "./AuthCallbackClient";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
          <div className="mx-auto max-w-md rounded-xl border border-slate-300 bg-white p-6 text-center shadow">
            <p className="text-sm font-medium">ログイン処理中...</p>
          </div>
        </main>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}
