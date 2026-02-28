"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabase, supabaseConfigMessage } from "../../lib/supabase";

type TrackerPlatform = "origin" | "xbl" | "psn";

type TrackerProfile = {
  trackerPlatform: string;
  trackerHandle: string;
  displayName: string | null;
  avatarUrl: string | null;
  currentRankTier: string | null;
  currentRankDivision: number | null;
  maxRankTier: string | null;
  maxRankDivision: number | null;
  level: number | null;
  rankScore: number | null;
  kills: number | null;
  damage: number | null;
  raw: unknown;
};

type ProfileRow = {
  user_id: string;
  tracker_platform: string | null;
  tracker_handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  current_rank_tier: string | null;
  current_rank_division: number | null;
  max_rank_tier: string | null;
  max_rank_division: number | null;
  tracker_level: number | null;
  tracker_rank_score: number | null;
  tracker_kills: number | null;
  tracker_damage: number | null;
  age_group: string | null;
};

const PLATFORM_OPTIONS: { value: TrackerPlatform; label: string }[] = [
  { value: "origin", label: "Origin / EA" },
  { value: "xbl", label: "Xbox" },
  { value: "psn", label: "PlayStation" },
];

export default function ProfilePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [platform, setPlatform] = useState<TrackerPlatform>("origin");
  const [playerId, setPlayerId] = useState("");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [fetchedProfile, setFetchedProfile] = useState<TrackerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentUserId = currentUser?.id ?? null;

  const canFetch = useMemo(() => hasSupabaseEnv && currentUserId && playerId.trim().length > 0, [currentUserId, playerId]);

  const fetchProfile = useCallback(async () => {
    if (!hasSupabaseEnv || !currentUserId) {
      setProfile(null);
      return;
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select(
        "user_id,tracker_platform,tracker_handle,display_name,avatar_url,current_rank_tier,current_rank_division,max_rank_tier,max_rank_division,tracker_level,tracker_rank_score,tracker_kills,tracker_damage,age_group"
      )
      .eq("user_id", currentUserId)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
      setError("プロフィール取得に失敗しました。");
      return;
    }

    const row = (data as ProfileRow | null) ?? null;
    setProfile(row);
    if (row?.tracker_platform) setPlatform(row.tracker_platform as TrackerPlatform);
    if (row?.tracker_handle) setPlayerId(row.tracker_handle);
  }, [currentUserId]);

  useEffect(() => {
    let mounted = true;
    if (!hasSupabaseEnv) return;

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setCurrentUser(data.session?.user ?? null);
    };
    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleFetchFromTracker = async () => {
    if (!canFetch) return;
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/tracker/apex?platform=${encodeURIComponent(platform)}&playerId=${encodeURIComponent(playerId.trim())}`,
        { method: "GET" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Tracker APIの取得に失敗しました。");
      }

      const fetched = data?.profile as TrackerProfile | undefined;
      if (!fetched) {
        throw new Error("Tracker APIから有効なプロフィール情報が返りませんでした。");
      }
      setFetchedProfile(fetched);
      setMessage("Tracker Networkから取得しました。内容を確認して保存してください。");
    } catch (fetchError) {
      console.error(fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "プロフィール取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!hasSupabaseEnv) {
      setError(supabaseConfigMessage);
      return;
    }
    if (!currentUserId) {
      setError("ログインが必要です。");
      return;
    }

    const source = fetchedProfile ?? null;
    setSaving(true);
    setError(null);
    setMessage(null);

    const payload = {
      user_id: currentUserId,
      tracker_platform: source?.trackerPlatform ?? platform,
      tracker_handle: source?.trackerHandle ?? playerId.trim(),
      display_name: source?.displayName ?? null,
      avatar_url: source?.avatarUrl ?? null,
      current_rank_tier: source?.currentRankTier ?? null,
      current_rank_division: source?.currentRankDivision ?? null,
      max_rank_tier: source?.maxRankTier ?? null,
      max_rank_division: source?.maxRankDivision ?? null,
      tracker_level: source?.level ?? null,
      tracker_rank_score: source?.rankScore ?? null,
      tracker_kills: source?.kills ?? null,
      tracker_damage: source?.damage ?? null,
      tracker_raw: source?.raw ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
    if (upsertError) {
      console.error(upsertError);
      setError("プロフィール保存に失敗しました。profiles テーブル定義を確認してください。");
      setSaving(false);
      return;
    }

    setMessage("プロフィールを保存しました。");
    setFetchedProfile(null);
    setSaving(false);
    await fetchProfile();
  };

  if (!hasSupabaseEnv) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
        <div className="mx-auto max-w-2xl space-y-3 rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold">プロフィール設定</h1>
          <p className="text-sm text-amber-700">{supabaseConfigMessage}</p>
          <Link href="/" className="inline-flex rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200">
            LFTへ戻る
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">プロフィール設定</h1>
          <Link href="/" className="rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200">
            LFTへ戻る
          </Link>
        </div>

        {!currentUserId && (
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            先にログインしてください。
          </p>
        )}

        <section className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
          <h2 className="text-sm font-semibold">Tracker Network 連携</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">プラットフォーム</label>
            <label className="text-xs font-semibold text-slate-700">プレイヤーID</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as TrackerPlatform)}
              className="rounded border border-slate-400 bg-white p-2 text-sm"
            >
              {PLATFORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              placeholder="例: yourEAID"
              className="rounded border border-slate-400 bg-white p-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleFetchFromTracker}
              disabled={!canFetch || loading}
              className="rounded bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "取得中..." : "Trackerから取得"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!currentUserId || saving}
              className="rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "保存中..." : "プロフィール保存"}
            </button>
          </div>
        </section>

        {error && <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        {message && <p className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}

        <section className="space-y-2 rounded-lg border border-slate-300 p-3">
          <h2 className="text-sm font-semibold">保存済みプロフィール</h2>
          {profile ? (
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">表示名</dt>
                <dd>{profile.display_name ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">EA/Tracker ID</dt>
                <dd>{profile.tracker_handle ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">現在ランク</dt>
                <dd>
                  {profile.current_rank_tier
                    ? `${profile.current_rank_tier} ${profile.current_rank_division ?? ""}`.trim()
                    : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">最高ランク</dt>
                <dd>
                  {profile.max_rank_tier
                    ? `${profile.max_rank_tier} ${profile.max_rank_division ?? ""}`.trim()
                    : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">レベル</dt>
                <dd>{profile.tracker_level ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Rank Score</dt>
                <dd>{profile.tracker_rank_score ?? "-"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-600">まだ保存されていません。</p>
          )}
        </section>

        {fetchedProfile && (
          <section className="space-y-2 rounded-lg border border-indigo-300 bg-indigo-50 p-3">
            <h2 className="text-sm font-semibold">取得プレビュー</h2>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">表示名</dt>
                <dd>{fetchedProfile.displayName ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">EA/Tracker ID</dt>
                <dd>{fetchedProfile.trackerHandle}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">現在ランク</dt>
                <dd>
                  {fetchedProfile.currentRankTier
                    ? `${fetchedProfile.currentRankTier} ${fetchedProfile.currentRankDivision ?? ""}`.trim()
                    : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">レベル</dt>
                <dd>{fetchedProfile.level ?? "-"}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    </main>
  );
}
