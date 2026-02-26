"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

type AdminApplication = {
  id: number;
  applicant_user_id: string;
  created_at?: string;
};

type AdminPost = {
  id: number;
  title: string;
  user_id: string;
  mode: string;
  recruit_count: number;
  created_at: string;
  is_closed: boolean;
  winner_user_id?: string | null;
  applications?: AdminApplication[];
};

type PlayStyleTag = {
  id: number | string;
  name: string;
  is_active: boolean;
  created_at?: string;
};

const ADMIN_USER_IDS = (process.env.NEXT_PUBLIC_ADMIN_USER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const HAS_ADMIN_CONFIG = ADMIN_USER_IDS.length > 0;

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [tags, setTags] = useState<PlayStyleTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    if (!HAS_ADMIN_CONFIG) return false;
    return ADMIN_USER_IDS.includes(currentUser.id);
  }, [currentUser]);

  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from("posts")
      .select(`
        id,
        title,
        user_id,
        mode,
        recruit_count,
        created_at,
        is_closed,
        winner_user_id,
        applications(id, applicant_user_id, created_at)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setPosts((data as AdminPost[]) ?? []);
  }, []);

  const fetchTags = useCallback(async () => {
    const { data, error } = await supabase
      .from("play_style_tags")
      .select("id,name,is_active,created_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setTagError("play_style_tagsテーブルの取得に失敗しました。");
      return;
    }

    setTagError(null);
    setTags((data as PlayStyleTag[]) ?? []);
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setCurrentUser(data.session?.user ?? null);
      setLoading(false);
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
    if (!currentUser || !isAdmin) return;
    const timer = window.setTimeout(() => {
      void Promise.all([fetchPosts(), fetchTags()]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentUser, isAdmin, fetchPosts, fetchTags]);

  const handleClosePost = async (postId: number) => {
    const { error } = await supabase.from("posts").update({ is_closed: true }).eq("id", postId);
    if (error) {
      console.error(error);
      alert("投稿のクローズに失敗しました");
      return;
    }
    await fetchPosts();
  };

  const handleReopenPost = async (postId: number) => {
    const { error } = await supabase
      .from("posts")
      .update({ is_closed: false, winner_user_id: null })
      .eq("id", postId);
    if (error) {
      console.error(error);
      alert("投稿の再オープンに失敗しました");
      return;
    }
    await fetchPosts();
  };

  const handleDeletePost = async (postId: number) => {
    const confirmed = confirm("この投稿を削除しますか？");
    if (!confirmed) return;

    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) {
      console.error(error);
      alert("投稿の削除に失敗しました");
      return;
    }
    await fetchPosts();
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;

    const { error } = await supabase.from("play_style_tags").insert([{ name, is_active: true }]);
    if (error) {
      console.error(error);
      alert("タグの追加に失敗しました");
      return;
    }

    setNewTagName("");
    await fetchTags();
  };

  const handleToggleTag = async (tag: PlayStyleTag) => {
    const { error } = await supabase
      .from("play_style_tags")
      .update({ is_active: !tag.is_active })
      .eq("id", tag.id);
    if (error) {
      console.error(error);
      alert("タグ状態の更新に失敗しました");
      return;
    }
    await fetchTags();
  };

  const handleDeleteTag = async (tagId: string | number) => {
    const confirmed = confirm("このタグを削除しますか？");
    if (!confirmed) return;

    const { error } = await supabase.from("play_style_tags").delete().eq("id", tagId);
    if (error) {
      console.error(error);
      alert("タグの削除に失敗しました");
      return;
    }
    await fetchTags();
  };

  const filteredPosts = posts.filter((post) => {
    if (!query.trim()) return true;
    const target = `${post.title} ${post.user_id} ${post.mode}`.toLowerCase();
    return target.includes(query.toLowerCase());
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
        <p>読み込み中...</p>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
        <div className="mx-auto max-w-xl rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-xl font-bold">管理者ページ</h1>
          <p className="mb-4 text-sm text-slate-700">アクセスにはログインが必要です。</p>
          <Link href="/" className="rounded-md bg-indigo-700 px-3 py-2 text-sm font-medium text-white">
            トップへ戻る
          </Link>
        </div>
      </main>
    );
  }

  if (!HAS_ADMIN_CONFIG) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
        <div className="mx-auto max-w-xl rounded-xl border border-amber-300 bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-xl font-bold">管理者ページ</h1>
          <p className="mb-4 text-sm text-amber-800">
            管理者IDが未設定です。`NEXT_PUBLIC_ADMIN_USER_IDS` に Supabase ユーザーIDをカンマ区切りで設定してください。
          </p>
          <Link href="/" className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white">
            トップへ戻る
          </Link>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
        <div className="mx-auto max-w-xl rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-xl font-bold">管理者ページ</h1>
          <p className="mb-4 text-sm text-rose-700">このアカウントには管理者権限がありません。</p>
          <Link href="/" className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white">
            トップへ戻る
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-950">管理者ページ</h1>
          <Link href="/" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium">
            トップへ戻る
          </Link>
        </div>

        <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">プレイスタイルタグ管理</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="新しいタグ名"
              className="min-w-[220px] flex-1 rounded border border-slate-400 bg-white p-2 text-sm"
            />
            <button
              type="button"
              onClick={handleCreateTag}
              className="rounded-md bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800"
            >
              追加
            </button>
          </div>

          {tagError && <p className="mb-2 text-sm text-rose-700">{tagError}</p>}

          <div className="space-y-2">
            {tags.map((tag) => (
              <div key={String(tag.id)} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                <div className="text-sm">
                  <span className="font-medium">{tag.name}</span>
                  <span className={`ml-2 ${tag.is_active ? "text-emerald-700" : "text-slate-500"}`}>
                    {tag.is_active ? "有効" : "無効"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs"
                  >
                    {tag.is_active ? "無効化" : "有効化"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTag(tag.id)}
                    className="rounded bg-rose-700 px-2 py-1 text-xs text-white hover:bg-rose-800"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
            {tags.length === 0 && <p className="text-sm text-slate-600">タグがありません</p>}
          </div>
        </section>

        <section className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
          <input
            type="text"
            placeholder="タイトル / 投稿者ID / モードで絞り込み"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded border border-slate-400 bg-white p-2 text-sm"
          />
        </section>

        <div className="space-y-3">
          {filteredPosts.map((post) => (
            <article key={post.id} className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{post.title}</h2>
                  <p className="text-xs text-slate-600">
                    投稿者ID: {post.user_id} / モード: {post.mode} / 募集人数: {post.recruit_count}
                  </p>
                  <p className="text-xs text-slate-600">投稿日: {new Date(post.created_at).toLocaleString("ja-JP")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {post.is_closed ? (
                    <button
                      type="button"
                      onClick={() => handleReopenPost(post.id)}
                      className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      再オープン
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleClosePost(post.id)}
                      className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900"
                    >
                      クローズ
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeletePost(post.id)}
                    className="rounded-md bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-800"
                  >
                    削除
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-sm font-semibold">応募一覧 ({post.applications?.length ?? 0})</p>
                <ul className="space-y-1 text-sm text-slate-700">
                  {(post.applications ?? []).map((app) => (
                    <li key={app.id}>
                      {app.applicant_user_id}
                      {app.created_at ? ` / ${new Date(app.created_at).toLocaleString("ja-JP")}` : ""}
                    </li>
                  ))}
                  {(post.applications ?? []).length === 0 && <li>応募なし</li>}
                </ul>
              </div>
            </article>
          ))}

          {filteredPosts.length === 0 && (
            <p className="rounded-xl border border-slate-300 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
              投稿がありません
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
