"use client";

import { useCallback, useEffect, useState } from "react";
import { hasSupabaseEnv, supabase, supabaseConfigMessage } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";

type Post = {
  id: number;
  title: string;
  recruit_count: number;
  mode: string;
  allowed_age_groups?: string[] | null;
  min_rank_tier?: string | null;
  min_rank_division?: number | null;
  vc_type: string;
  play_styles: string[];
  other_text?: string;
  current_rank_tier?: string;
  current_rank_division?: number;
  max_rank_tier?: string;
  max_rank_division?: number;
  age_group: string;
  platform?: string | null;
  created_at: string;
  user_id: string;
  is_closed: boolean;
  winner_user_id?: string;
  applications?: { count: number }[];
};

type Application = {
  id: number;
  applicant_user_id: string;
  post_id: number;
};

type ApplicationResult = {
  id: number;
  post_id: number;
  post_title: string;
  vc_type: string | null;
  recruiter_user_id: string;
  applicant_user_id: string;
  status: "selected" | "rejected";
  ea_account_name: string | null;
  discord_invite_link: string | null;
  message: string | null;
  created_at: string;
};

type FinalizePayload = {
  eaAccountName: string;
  discordInviteLink: string;
  message: string;
};

type UserProfile = {
  user_id: string;
  tracker_platform: string | null;
  current_rank_tier: string | null;
  current_rank_division: number | null;
  max_rank_tier: string | null;
  max_rank_division: number | null;
  age_group: string | null;
};

type ApplicantProfile = {
  user_id: string;
  display_name: string | null;
  tracker_handle: string | null;
  current_rank_tier: string | null;
  current_rank_division: number | null;
  max_rank_tier: string | null;
  max_rank_division: number | null;
  age_group: string | null;
};

type FormState = {
  title: string;
  recruitCount: number;
  mode: string;
  allowedAgeGroups: string[];
  minRankTier: string;
  minRankDivision: number | null;
  vcType: string;
  playStyles: string[];
  otherText: string;
  currentRankTier: string;
  currentRankDivision: number | null;
  maxRankTier: string;
  maxRankDivision: number | null;
  ageGroup: string;
  platform: string;
};

type PostFilter = {
  title: string;
  recruitCount: "all" | "1" | "2";
  mode: "all" | "rank" | "casual";
  minRankTier: "all" | "none" | "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master" | "predator";
  minRankDivision: "all" | "1" | "2" | "3" | "4";
  vcType: "all" | "game" | "discord" | "off";
  allowedAgeGroup: "all" | "10s" | "20s" | "30s" | "40s";
  playStyle: string;
  otherText: string;
  currentRankTier:
    | "all"
    | "none"
    | "bronze"
    | "silver"
    | "gold"
    | "platinum"
    | "diamond"
    | "master"
    | "predator";
  currentRankDivision: "all" | "1" | "2" | "3" | "4";
  maxRankTier: "all" | "none" | "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master" | "predator";
  maxRankDivision: "all" | "1" | "2" | "3" | "4";
  posterAgeGroup: "all" | "10s" | "20s" | "30s" | "40s";
  posterPlatform: "all" | "origin" | "xbl" | "psn";
};

const POST_EXPIRY_MS = 2 * 60 * 60 * 1000;
const CLOCK_TICK_MS = 60 * 1000;
const DEFAULT_PLAY_STYLE_OPTIONS: string[] = [];
const AGE_GROUP_OPTIONS = [
  { value: "10s", label: "10代" },
  { value: "20s", label: "20代" },
  { value: "30s", label: "30代" },
  { value: "40s", label: "40代以上" },
];
const PLATFORM_OPTIONS = [
  { value: "origin", label: "PC (Origin/EA app)" },
  { value: "xbl", label: "Xbox" },
  { value: "psn", label: "PlayStation" },
];
const MIN_RANK_TIER_OPTIONS = [
  { value: "", label: "指定なし" },
  { value: "bronze", label: "ブロンズ" },
  { value: "silver", label: "シルバー" },
  { value: "gold", label: "ゴールド" },
  { value: "platinum", label: "プラチナ" },
  { value: "diamond", label: "ダイヤ" },
  { value: "master", label: "マスター" },
  { value: "predator", label: "プレデター" },
];
const MIN_RANK_DIVISION_OPTIONS = [
  { value: 4, label: "IV" },
  { value: 3, label: "III" },
  { value: 2, label: "II" },
  { value: 1, label: "I" },
];
const PROFILE_RANK_TIER_OPTIONS = [
  { value: "", label: "未設定" },
  { value: "bronze", label: "ブロンズ" },
  { value: "silver", label: "シルバー" },
  { value: "gold", label: "ゴールド" },
  { value: "platinum", label: "プラチナ" },
  { value: "diamond", label: "ダイヤ" },
  { value: "master", label: "マスター" },
  { value: "predator", label: "プレデター" },
];
const INITIAL_NOW = Date.now();
const RANK_TIER_ORDER = ["bronze", "silver", "gold", "platinum", "diamond", "master", "predator"] as const;
const DIVISION_HIGHEST = 1;
const DIVISION_LOWEST = 4;
const MODE_LABELS: Record<string, string> = {
  rank: "ランク",
  casual: "カジュアル",
  ランク: "ランク",
  カジュアル: "カジュアル",
};
const VC_LABELS: Record<string, string> = {
  game: "ゲーム内VC",
  discord: "Discord",
  off: "VCなし",
  "ゲーム内VC": "ゲーム内VC",
  "VCなし": "VCなし",
};
const AGE_LABELS: Record<string, string> = {
  "10s": "10代",
  "20s": "20代",
  "30s": "30代",
  "40s": "40代以上",
  "10代": "10代",
  "20代": "20代",
  "30代": "30代",
  "40代以上": "40代以上",
};
const PLATFORM_LABELS: Record<string, string> = {
  origin: "PC (Origin/EA app)",
  xbl: "Xbox",
  psn: "PlayStation",
  pc: "PC (Origin/EA app)",
  xbox: "Xbox",
  playstation: "PlayStation",
};
const TIER_LABELS: Record<string, string> = {
  bronze: "ブロンズ",
  silver: "シルバー",
  gold: "ゴールド",
  platinum: "プラチナ",
  diamond: "ダイヤ",
  master: "マスター",
  predator: "プレデター",
  ブロンズ: "ブロンズ",
  シルバー: "シルバー",
  ゴールド: "ゴールド",
  プラチナ: "プラチナ",
  ダイヤ: "ダイヤ",
  マスター: "マスター",
  プレデター: "プレデター",
};
const TIER_KEYS_BY_LABEL: Record<string, (typeof RANK_TIER_ORDER)[number]> = {
  ブロンズ: "bronze",
  シルバー: "silver",
  ゴールド: "gold",
  プラチナ: "platinum",
  ダイヤ: "diamond",
  マスター: "master",
  プレデター: "predator",
  bronze: "bronze",
  silver: "silver",
  gold: "gold",
  platinum: "platinum",
  diamond: "diamond",
  master: "master",
  predator: "predator",
};
const MODE_KEYS_BY_LABEL: Record<string, "rank" | "casual"> = {
  rank: "rank",
  casual: "casual",
  ランク: "rank",
  カジュアル: "casual",
};
const VC_KEYS_BY_LABEL: Record<string, "game" | "discord" | "off"> = {
  game: "game",
  discord: "discord",
  off: "off",
  "ゲーム内VC": "game",
  "VCなし": "off",
};
const AGE_KEYS_BY_LABEL: Record<string, "10s" | "20s" | "30s" | "40s"> = {
  "10s": "10s",
  "20s": "20s",
  "30s": "30s",
  "40s": "40s",
  "10代": "10s",
  "20代": "20s",
  "30代": "30s",
  "40代以上": "40s",
};
const PLATFORM_KEYS_BY_LABEL: Record<string, "origin" | "xbl" | "psn"> = {
  origin: "origin",
  xbl: "xbl",
  psn: "psn",
  pc: "origin",
  "pc (origin/ea app)": "origin",
  xbox: "xbl",
  playstation: "psn",
};
const toModeLabel = (value: string) => MODE_LABELS[value] ?? value;
const toVcLabel = (value: string) => VC_LABELS[value] ?? value;
const toAgeLabel = (value: string) => AGE_LABELS[value] ?? value;
const toPlatformLabel = (value: string) => PLATFORM_LABELS[value.toLowerCase()] ?? value;
const toTierLabel = (value: string) => TIER_LABELS[value] ?? value;
const toModeKey = (value: string) => MODE_KEYS_BY_LABEL[value] ?? value;
const toVcKey = (value: string) => VC_KEYS_BY_LABEL[value] ?? value;
const toAgeKey = (value: string) => AGE_KEYS_BY_LABEL[value] ?? value;
const toPlatformKey = (value?: string | null) => {
  if (!value) return null;
  return PLATFORM_KEYS_BY_LABEL[value.toLowerCase()] ?? null;
};
const toTierKey = (value?: string | null) => {
  if (!value) return null;
  return TIER_KEYS_BY_LABEL[value] ?? null;
};
const POST_SELECT_COLUMNS = `
  id,
  title,
  recruit_count,
  mode,
  allowed_age_groups,
  min_rank_tier,
  min_rank_division,
  vc_type,
  play_styles,
  other_text,
  current_rank_tier,
  current_rank_division,
  max_rank_tier,
  max_rank_division,
  age_group,
  platform,
  created_at,
  user_id,
  is_closed,
  winner_user_id
`;

const DEFAULT_FORM: FormState = {
  title: "",
  recruitCount: 1,
  mode: "rank",
  allowedAgeGroups: [],
  minRankTier: "",
  minRankDivision: null,
  vcType: "game",
  playStyles: [],
  otherText: "",
  currentRankTier: "",
  currentRankDivision: null,
  maxRankTier: "",
  maxRankDivision: null,
  ageGroup: "",
  platform: "",
};
const DEFAULT_FILTER: PostFilter = {
  title: "",
  recruitCount: "all",
  mode: "all",
  minRankTier: "all",
  minRankDivision: "all",
  vcType: "all",
  allowedAgeGroup: "all",
  playStyle: "all",
  otherText: "",
  currentRankTier: "all",
  currentRankDivision: "all",
  maxRankTier: "all",
  maxRankDivision: "all",
  posterAgeGroup: "all",
  posterPlatform: "all",
};
const DEFAULT_FINALIZE_PAYLOAD: FinalizePayload = {
  eaAccountName: "",
  discordInviteLink: "",
  message: "",
};

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [now, setNow] = useState(INITIAL_NOW);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [formTab, setFormTab] = useState<"recruit" | "profile">("recruit");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [postFilter, setPostFilter] = useState<PostFilter>(DEFAULT_FILTER);
  const [filterTab, setFilterTab] = useState<"recruit" | "poster">("recruit");
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [playStyleOptions, setPlayStyleOptions] = useState<string[]>(DEFAULT_PLAY_STYLE_OPTIONS);
  const [appliedPostIds, setAppliedPostIds] = useState<number[]>([]);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [applicantProfiles, setApplicantProfiles] = useState<Record<string, ApplicantProfile>>({});
  const [activeApplicantIndex, setActiveApplicantIndex] = useState(0);
  const [finalizePayloadByPost, setFinalizePayloadByPost] = useState<Record<number, FinalizePayload>>({});
  const [applicationResults, setApplicationResults] = useState<ApplicationResult[]>([]);
  const [activePostId, setActivePostId] = useState<number | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const currentUserId = currentUser?.id ?? null;

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, CLOCK_TICK_MS);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!hasSupabaseEnv) return;

    const syncSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const authCode = params.get("code");
      if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);
        if (error) {
          console.error(error);
        } else {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.error(error);
        } else {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setCurrentUser(data.session?.user ?? null);
    };

    void syncSession();

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

  const fetchPosts = useCallback(async () => {
    if (!hasSupabaseEnv) {
      setPosts([]);
      return;
    }
    const { data, error } = await supabase
      .from("posts")
      .select(`
        ${POST_SELECT_COLUMNS},
        applications(count)
      `);

    if (error) {
      console.error(error);
      return;
    }

    setPosts((data as Post[]) ?? []);
  }, []);

  const fetchPlayStyleTags = useCallback(async () => {
    if (!hasSupabaseEnv) {
      setPlayStyleOptions(DEFAULT_PLAY_STYLE_OPTIONS);
      return;
    }
    const { data, error } = await supabase
      .from("play_style_tags")
      .select("name,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setPlayStyleOptions(DEFAULT_PLAY_STYLE_OPTIONS);
      return;
    }

    const names = (data ?? []).map((item) => item.name).filter(Boolean);
    setPlayStyleOptions(names.length > 0 ? names : DEFAULT_PLAY_STYLE_OPTIONS);
  }, []);

  const fetchMyApplications = useCallback(async () => {
    if (!hasSupabaseEnv) {
      setAppliedPostIds([]);
      return;
    }
    if (!currentUserId) {
      setAppliedPostIds([]);
      return;
    }

    const { data, error } = await supabase
      .from("applications")
      .select("post_id")
      .eq("applicant_user_id", currentUserId);

    if (error) {
      console.error(error);
      return;
    }

    setAppliedPostIds((data ?? []).map((item) => item.post_id));
  }, [currentUserId]);

  const fetchUserProfile = useCallback(async () => {
    if (!hasSupabaseEnv || !currentUserId) {
      setUserProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,tracker_platform,current_rank_tier,current_rank_division,max_rank_tier,max_rank_division,age_group")
      .eq("user_id", currentUserId)
      .maybeSingle();

    if (error) {
      console.error(error);
      setUserProfile(null);
      return;
    }

    setUserProfile((data as UserProfile | null) ?? null);
  }, [currentUserId]);

  const fetchMyApplicationResults = useCallback(async () => {
    if (!hasSupabaseEnv || !currentUserId) {
      setApplicationResults([]);
      return;
    }

    const { data, error } = await supabase
      .from("application_results")
      .select(
        "id,post_id,post_title,vc_type,recruiter_user_id,applicant_user_id,status,ea_account_name,discord_invite_link,message,created_at"
      )
      .eq("applicant_user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setApplicationResults([]);
      return;
    }

    setApplicationResults((data as ApplicationResult[]) ?? []);
  }, [currentUserId]);

  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([fetchPosts(), fetchMyApplications(), fetchPlayStyleTags(), fetchUserProfile(), fetchMyApplicationResults()]);
    };

    void loadInitialData();
  }, [fetchMyApplicationResults, fetchMyApplications, fetchPlayStyleTags, fetchPosts, fetchUserProfile]);

  const togglePlayStyle = (style: string) => {
    const exists = form.playStyles.includes(style);
    if (!exists && form.playStyles.length >= 3) {
      alert("プレイスタイルタグは最大3つまでです");
      return;
    }

    setForm((prev) => {
      const selected = prev.playStyles.includes(style);
      return {
        ...prev,
        playStyles: selected
          ? prev.playStyles.filter((s) => s !== style)
          : [...prev.playStyles, style],
      };
    });
  };

  const resetForm = () => {
    setForm({
      ...DEFAULT_FORM,
      currentRankTier: toTierKey(userProfile?.current_rank_tier) ?? "",
      currentRankDivision: userProfile?.current_rank_division ?? null,
      maxRankTier: toTierKey(userProfile?.max_rank_tier) ?? "",
      maxRankDivision: userProfile?.max_rank_division ?? null,
      ageGroup: toAgeKey(userProfile?.age_group ?? "") || "",
      platform: toPlatformKey(userProfile?.tracker_platform) ?? "",
    });
  };

  const handleSignInWithDiscord = async () => {
    if (!hasSupabaseEnv) {
      alert(supabaseConfigMessage);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error(error);
      alert("Discordログインに失敗しました");
    }
  };

  const handleSignOut = async () => {
    if (!hasSupabaseEnv) {
      alert(supabaseConfigMessage);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error(error);
      alert("ログアウトに失敗しました");
      return;
    }
    setAppliedPostIds([]);
    setActivePostId(null);
    setApplicants([]);
    setApplicantProfiles({});
    setActiveApplicantIndex(0);
    setFinalizePayloadByPost({});
    setApplicationResults([]);
  };

  const handleMinRankTierChange = (tier: string) => {
    setForm((prev) => ({
      ...prev,
      minRankTier: tier,
      minRankDivision:
        tier === "" || tier === "master" || tier === "predator"
          ? null
          : (prev.minRankDivision ?? 4),
    }));
  };

  const toggleAllowedAgeGroup = (ageGroup: string) => {
    setForm((prev) => {
      const selected = prev.allowedAgeGroups.includes(ageGroup);
      return {
        ...prev,
        allowedAgeGroups: selected
          ? prev.allowedAgeGroups.filter((item) => item !== ageGroup)
          : [...prev.allowedAgeGroups, ageGroup],
      };
    });
  };

  const handleProfileRankTierChange = (key: "currentRankTier" | "maxRankTier", tier: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: tier,
      ...(key === "currentRankTier"
        ? {
            currentRankDivision:
              tier === "" || tier === "master" || tier === "predator"
                ? null
                : (prev.currentRankDivision ?? 4),
          }
        : {
            maxRankDivision:
              tier === "" || tier === "master" || tier === "predator"
                ? null
                : (prev.maxRankDivision ?? 4),
          }),
    }));
  };

  const handleSubmit = async () => {
    if (!hasSupabaseEnv) {
      alert(supabaseConfigMessage);
      return;
    }
    if (!currentUserId) {
      alert("投稿するにはDiscordログインが必要です");
      return;
    }
    if (myActivePost) {
      alert("同時に投稿できる募集は1件までです。修正する場合は既存投稿を削除してから再投稿してください。");
      return;
    }
    if (!form.title) return alert("タイトルは必須です");
    if (form.playStyles.length === 0) return alert("プレイスタイルを1つ以上選択してください");
    if (form.playStyles.length > 3) return alert("プレイスタイルタグは最大3つまでです");

    const { error } = await supabase.from("posts").insert([
      {
        title: form.title,
        recruit_count: form.recruitCount,
        mode: toModeLabel(form.mode),
        allowed_age_groups: form.allowedAgeGroups.map((item) => toAgeLabel(item)),
        min_rank_tier: form.minRankTier ? toTierLabel(form.minRankTier) : null,
        min_rank_division: form.minRankDivision || null,
        vc_type: toVcLabel(form.vcType),
        play_styles: form.playStyles,
        other_text: form.otherText,
        age_group: toAgeLabel(form.ageGroup),
        current_rank_tier: form.currentRankTier ? toTierLabel(form.currentRankTier) : null,
        current_rank_division: form.currentRankDivision || null,
        max_rank_tier: form.maxRankTier ? toTierLabel(form.maxRankTier) : null,
        max_rank_division: form.maxRankDivision || null,
        platform: form.platform || null,
        user_id: currentUserId,
      },
    ]);

    if (error) {
      console.error(error);
      alert("投稿に失敗しました");
      return;
    }

    resetForm();
    setFormTab("recruit");
    setIsCreateModalOpen(false);
    await fetchPosts();
  };

  const handleDeletePost = async (postId: number) => {
    if (!hasSupabaseEnv) {
      alert(supabaseConfigMessage);
      return;
    }
    if (!currentUserId) return;
    const confirmed = confirm("この投稿を削除しますか？");
    if (!confirmed) return;

    const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", currentUserId);

    if (error) {
      console.error(error);
      alert("投稿の削除に失敗しました");
      return;
    }

    if (activePostId === postId) {
      setActivePostId(null);
      setApplicants([]);
      setApplicantProfiles({});
      setActiveApplicantIndex(0);
      setFinalizePayloadByPost((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
    }

    alert("投稿を削除しました。再投稿できます。");
    await fetchPosts();
  };

  const updateFinalizePayload = <K extends keyof FinalizePayload>(postId: number, key: K, value: FinalizePayload[K]) => {
    setFinalizePayloadByPost((prev) => ({
      ...prev,
      [postId]: {
        ...(prev[postId] ?? DEFAULT_FINALIZE_PAYLOAD),
        [key]: value,
      },
    }));
  };

  const handleFinalizeSelection = async (postId: number, selectedApplicantUserId: string) => {
    if (!hasSupabaseEnv) {
      alert(supabaseConfigMessage);
      return;
    }
    if (!currentUserId) {
      alert("募集を確定するにはDiscordログインが必要です");
      return;
    }
    if (applicants.length === 0) {
      alert("応募者がいないため確定できません");
      return;
    }
    const finalizePayload = finalizePayloadByPost[postId] ?? DEFAULT_FINALIZE_PAYLOAD;
    if (!finalizePayload.eaAccountName.trim()) {
      alert("EAアカウント名を入力してください");
      return;
    }
    if (!finalizePayload.message.trim()) {
      alert("一言メッセージを入力してください");
      return;
    }

    const confirmed = confirm("この応募者を選択して結果を送付しますか？");
    if (!confirmed) return;

    const selectedApplicantIds = new Set(applicants.map((item) => item.applicant_user_id));
    if (!selectedApplicantIds.has(selectedApplicantUserId)) {
      alert("選択された応募者情報が見つかりません。再読み込みして再試行してください。");
      return;
    }

    const selectedPost = posts.find((item) => item.id === postId);
    const postTitle = selectedPost?.title ?? "募集";
    const postVcType = selectedPost?.vc_type ?? null;
    const isDiscordVc = postVcType ? toVcKey(postVcType) === "discord" : false;
    if (isDiscordVc && !finalizePayload.discordInviteLink.trim()) {
      alert("VCがDiscordの募集は、Discordサーバ招待リンクを入力してください");
      return;
    }
    const resultRows = applicants.map((applicant) => {
      const isSelected = applicant.applicant_user_id === selectedApplicantUserId;
      return {
        post_id: postId,
        post_title: postTitle,
        vc_type: postVcType,
        recruiter_user_id: currentUserId,
        applicant_user_id: applicant.applicant_user_id,
        status: isSelected ? "selected" : "rejected",
        ea_account_name: isSelected ? finalizePayload.eaAccountName.trim() : null,
        discord_invite_link: isSelected && isDiscordVc ? finalizePayload.discordInviteLink.trim() : null,
        message: isSelected ? finalizePayload.message.trim() : "今回は選考外となりました。",
      };
    });

    const { error: resultError } = await supabase
      .from("application_results")
      .upsert(resultRows, { onConflict: "post_id,applicant_user_id" });

    if (resultError) {
      console.error(resultError);
      alert("結果通知の送付に失敗しました");
      return;
    }

    const { error: postError } = await supabase
      .from("posts")
      .update({
        is_closed: true,
        winner_user_id: selectedApplicantUserId,
      })
      .eq("id", postId)
      .eq("user_id", currentUserId);

    if (postError) {
      console.error(postError);
      alert("投稿の確定に失敗しました");
      return;
    }

    setActivePostId(null);
    setApplicants([]);
    setApplicantProfiles({});
    setActiveApplicantIndex(0);
    setFinalizePayloadByPost((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    alert("応募者を確定し、応募者全員へ結果を送付しました");
    await Promise.all([fetchPosts(), fetchMyApplicationResults()]);
  };

  const fetchApplicants = async (postId: number) => {
    if (!hasSupabaseEnv) {
      setApplicants([]);
      setActivePostId(null);
      setApplicantProfiles({});
      setActiveApplicantIndex(0);
      setFinalizePayloadByPost({});
      return;
    }
    if (activePostId === postId) {
      setApplicants([]);
      setActivePostId(null);
      setApplicantProfiles({});
      setActiveApplicantIndex(0);
      setFinalizePayloadByPost((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      return;
    }
    const { data, error } = await supabase.from("applications").select("*").eq("post_id", postId);

    if (error) {
      console.error(error);
      return;
    }

    const nextApplicants = (data as Application[]) ?? [];
    setApplicants(nextApplicants);
    setActiveApplicantIndex(0);
    setFinalizePayloadByPost((prev) => ({
      ...prev,
      [postId]: prev[postId] ?? DEFAULT_FINALIZE_PAYLOAD,
    }));
    const applicantIds = Array.from(new Set(nextApplicants.map((item) => item.applicant_user_id).filter(Boolean)));

    if (applicantIds.length === 0) {
      setApplicantProfiles({});
      setActivePostId(postId);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select(
        "user_id,display_name,tracker_handle,current_rank_tier,current_rank_division,max_rank_tier,max_rank_division,age_group"
      )
      .in("user_id", applicantIds);

    if (profilesError) {
      console.error(profilesError);
      setApplicantProfiles({});
      setActivePostId(postId);
      return;
    }

    const nextProfiles = ((profilesData as ApplicantProfile[]) ?? []).reduce<Record<string, ApplicantProfile>>(
      (acc, profile) => {
        acc[profile.user_id] = profile;
        return acc;
      },
      {}
    );

    setApplicantProfiles(nextProfiles);
    setActivePostId(postId);
  };

  const handleApply = async (post: Post) => {
    if (!hasSupabaseEnv) {
      alert(supabaseConfigMessage);
      return;
    }
    if (!currentUserId) {
      alert("応募するにはDiscordログインが必要です");
      return;
    }
    if (post.user_id === currentUserId) {
      alert("自分の投稿には応募できません");
      return;
    }
    if (appliedPostIds.includes(post.id)) {
      alert("この投稿には応募済みです");
      return;
    }
    const confirmed = confirm("この投稿に応募しますか？");
    if (!confirmed) return;

    const { error } = await supabase.from("applications").insert([
      {
        post_id: post.id,
        applicant_user_id: currentUserId,
      },
    ]);

    if (error) {
      console.error(error);
      alert("応募に失敗しました");
      return;
    }

    alert("応募しました");
    await Promise.all([fetchMyApplications(), fetchPosts()]);
  };

  const getRemainingTime = useCallback(
    (createdAt: string) => {
      const created = new Date(createdAt);
      const expiry = new Date(created.getTime() + POST_EXPIRY_MS);
      const diff = expiry.getTime() - now;

      if (diff <= 0) return null;

      const totalMinutes = Math.floor(diff / 1000 / 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return `${hours}時間${minutes}分`;
    },
    [now]
  );

  const formatRank = (tier?: string, division?: number) => {
    if (!tier) return "未設定";
    const tierLabel = toTierLabel(tier);
    const tierKey = toTierKey(tier);
    if (tierKey === "master" || tierKey === "predator") return tierLabel;
    return `${tierLabel} ${division ?? ""}`;
  };

  const visiblePosts = posts
    .map((post) => ({ post, remaining: getRemainingTime(post.created_at) }))
    .filter(({ post, remaining }) => remaining !== null && !post.is_closed);
  const getRankRequirementScore = (tier: string | null | undefined, division: number | null | undefined) => {
    const tierKey = toTierKey(tier);
    if (!tierKey) return 0;
    const tierIndex = RANK_TIER_ORDER.indexOf(tierKey);
    if (tierIndex < 0) return 0;
    if (tierKey === "master" || tierKey === "predator") return (tierIndex + 1) * 10;
    const normalizedDivision = Math.min(DIVISION_LOWEST, Math.max(DIVISION_HIGHEST, division ?? DIVISION_LOWEST));
    const divisionStrength = DIVISION_LOWEST + 1 - normalizedDivision;
    return (tierIndex + 1) * 10 + divisionStrength;
  };

  const matchesMinRequirementFilter = (
    tier: string | null | undefined,
    division: number | null | undefined,
    filterTier: PostFilter["minRankTier"],
    filterDivision: PostFilter["minRankDivision"]
  ) => {
    if (filterTier === "all") return true;
    const postScore = getRankRequirementScore(tier, division);
    if (filterTier === "none") return postScore === 0;

    const thresholdScore =
      filterTier === "master" || filterTier === "predator"
        ? getRankRequirementScore(filterTier, null)
        : getRankRequirementScore(
            filterTier,
            filterDivision === "all" ? DIVISION_LOWEST : Number(filterDivision)
          );

    return postScore >= thresholdScore;
  };

  const matchesRankFilter = (
    tier: string | null | undefined,
    division: number | null | undefined,
    filterTier: PostFilter["minRankTier"] | PostFilter["currentRankTier"] | PostFilter["maxRankTier"],
    filterDivision: PostFilter["minRankDivision"] | PostFilter["currentRankDivision"] | PostFilter["maxRankDivision"]
  ) => {
    const normalizedTier = toTierKey(tier);
    const tierMatched =
      filterTier === "all" ||
      (filterTier === "none" && !normalizedTier) ||
      (filterTier !== "none" && normalizedTier === filterTier);

    if (!tierMatched) return false;
    if (filterDivision === "all") return true;
    if (!normalizedTier || normalizedTier === "master" || normalizedTier === "predator") return true;
    return division === Number(filterDivision);
  };

  const filteredPosts = visiblePosts.filter(({ post }) => {
    const titleMatched = postFilter.title.trim() === "" || post.title.toLowerCase().includes(postFilter.title.toLowerCase());
    const recruitCountMatched =
      postFilter.recruitCount === "all" || post.recruit_count === Number(postFilter.recruitCount);
    const modeMatched = postFilter.mode === "all" || toModeKey(post.mode) === postFilter.mode;
    const minRankMatched = matchesMinRequirementFilter(
      post.min_rank_tier,
      post.min_rank_division,
      postFilter.minRankTier,
      postFilter.minRankDivision
    );
    const vcMatched = postFilter.vcType === "all" || toVcKey(post.vc_type) === postFilter.vcType;
    const ageMatched =
      postFilter.allowedAgeGroup === "all" ||
      (post.allowed_age_groups ?? []).map((item) => toAgeKey(item)).includes(postFilter.allowedAgeGroup);
    const styleMatched =
      postFilter.playStyle === "all" || (post.play_styles ?? []).includes(postFilter.playStyle);
    const otherTextMatched =
      postFilter.otherText.trim() === "" ||
      (post.other_text ?? "").toLowerCase().includes(postFilter.otherText.toLowerCase());
    const currentRankMatched = matchesRankFilter(
      post.current_rank_tier,
      post.current_rank_division,
      postFilter.currentRankTier,
      postFilter.currentRankDivision
    );
    const maxRankMatched = matchesRankFilter(
      post.max_rank_tier,
      post.max_rank_division,
      postFilter.maxRankTier,
      postFilter.maxRankDivision
    );
    const posterAgeMatched = postFilter.posterAgeGroup === "all" || toAgeKey(post.age_group) === postFilter.posterAgeGroup;
    const posterPlatformMatched =
      postFilter.posterPlatform === "all" || toPlatformKey(post.platform) === postFilter.posterPlatform;

    return (
      titleMatched &&
      recruitCountMatched &&
      modeMatched &&
      minRankMatched &&
      vcMatched &&
      ageMatched &&
      styleMatched &&
      otherTextMatched &&
      currentRankMatched &&
      maxRankMatched &&
      posterAgeMatched &&
      posterPlatformMatched
    );
  });
  const sortedFilteredPosts = [...filteredPosts].sort((a, b) => {
    const aMine = a.post.user_id === currentUserId ? 1 : 0;
    const bMine = b.post.user_id === currentUserId ? 1 : 0;
    return bMine - aMine;
  });
  const activeApplicant = applicants[activeApplicantIndex] ?? null;
  const activeApplicantProfile = activeApplicant ? applicantProfiles[activeApplicant.applicant_user_id] : null;

  const getPosterDisplayName = (userId: string) => {
    if (userId === currentUserId) {
      return (
        currentUser?.user_metadata?.full_name ??
        currentUser?.user_metadata?.name ??
        currentUser?.user_metadata?.user_name ??
        "あなた"
      );
    }
    return `User ${userId.slice(0, 6)}`;
  };

  const getPosterAvatar = (userId: string) => {
    if (userId === currentUserId) {
      return currentUser?.user_metadata?.avatar_url as string | undefined;
    }
    return undefined;
  };
  const myActivePost = visiblePosts.find(({ post }) => post.user_id === currentUserId)?.post ?? null;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-300 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">LFT</h1>
              <p className="text-[11px] font-medium text-slate-600 sm:text-xs">Looking For Team</p>
            </div>
          </div>
          {currentUser ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <span className="max-w-full truncate text-sm text-slate-700 sm:max-w-[420px]">
                ログイン中: {currentUser.user_metadata?.full_name ?? currentUser.email ?? currentUser.id}
              </span>
              <Link
                href="/profile"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium text-slate-800 hover:bg-slate-100 sm:w-auto"
              >
                プロフィール
              </Link>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                disabled={!currentUserId || Boolean(myActivePost)}
                className="w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
              >
                {!currentUserId ? "ログインして投稿" : myActivePost ? "投稿中" : "投稿を作成"}
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 sm:w-auto"
              >
                ログアウト
              </button>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleSignInWithDiscord}
                className="w-full rounded-md bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800 sm:w-auto"
              >
                Discordでログイン
              </button>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                disabled
                className="w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
              >
                ログインして投稿
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 pb-6 pt-4 sm:px-6 sm:pt-6">
      {!hasSupabaseEnv && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {supabaseConfigMessage}
        </div>
      )}

      {!currentUserId && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-indigo-700">
          <span>投稿・応募にはDiscordログインが必要です。</span>
          <button
            type="button"
            onClick={handleSignInWithDiscord}
            className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-indigo-800 hover:bg-indigo-100"
          >
            ログインをやり直す
          </button>
        </div>
      )}

      {myActivePost && (
        <p className="mb-4 text-xs font-medium text-amber-700">
          同時に出せる投稿は1件のみです。修正する場合は「削除 → 再投稿」で対応してください。
        </p>
      )}

      {currentUserId && applicationResults.length > 0 && (
        <section className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 sm:p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">応募結果のお知らせ</h2>
          <div className="space-y-2">
            {applicationResults.slice(0, 5).map((result) => (
              <article key={result.id} className="rounded-md border border-indigo-200 bg-white p-3 text-sm text-slate-800">
                <p className="font-semibold text-slate-900">{result.post_title}</p>
                <p className={`mt-1 text-xs font-semibold ${result.status === "selected" ? "text-emerald-700" : "text-rose-700"}`}>
                  {result.status === "selected" ? "募集者に選ばれました" : "今回は選ばれませんでした"}
                </p>
                {result.message && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-700">{result.message}</p>}
                {result.status === "selected" && (
                  <div className="mt-2 grid gap-1 text-xs text-slate-700 sm:grid-cols-2">
                    <p>EAアカウント名: {result.ea_account_name || "未設定"}</p>
                    {toVcKey(result.vc_type ?? "") === "discord" ? (
                      <p className="break-all">Discord招待: {result.discord_invite_link || "未設定"}</p>
                    ) : (
                      <p>Discord招待: 対象外（VCがDiscordではありません）</p>
                    )}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-slate-500">
                  通知日時: {new Date(result.created_at).toLocaleString("ja-JP")}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-2 sm:items-center sm:p-4"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-xl border border-slate-300 bg-white p-3 shadow-xl sm:rounded-xl sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">投稿を作成</h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-sm text-slate-700 hover:bg-slate-200"
              >
                閉じる
              </button>
            </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-full rounded-lg border border-slate-300 bg-slate-100 p-1 sm:w-auto">
            <button
              type="button"
              onClick={() => setFormTab("recruit")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium sm:flex-none ${
                formTab === "recruit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-700"
              }`}
            >
              募集内容
            </button>
            <button
              type="button"
              onClick={() => setFormTab("profile")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium sm:flex-none ${
                formTab === "profile" ? "bg-white text-slate-900 shadow-sm" : "text-slate-700"
              }`}
            >
              投稿者情報
            </button>
          </div>
          <button
            onClick={handleSubmit}
            disabled={Boolean(myActivePost)}
            className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
          >
            {myActivePost ? "投稿中（削除後に再投稿）" : "投稿する"}
          </button>
        </div>

        {formTab === "recruit" && (
          <section className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
            <h2 className="text-sm font-semibold text-slate-900">募集内容</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="text-xs font-semibold text-slate-800 sm:col-span-2">タイトル（必須）</p>
              <input
                type="text"
                placeholder="タイトル"
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                className="w-full rounded border border-slate-400 bg-white p-2 text-slate-900 placeholder:text-slate-500 sm:col-span-2"
              />

              <p className="text-xs font-semibold text-slate-800">募集人数（必須）</p>
              <select
                value={form.recruitCount}
                onChange={(e) => updateForm("recruitCount", Number(e.target.value))}
                className="w-full rounded border border-slate-400 bg-white p-2 text-slate-900"
              >
                <option value={1}>1人募集</option>
                <option value={2}>2人募集</option>
              </select>

              <p className="text-xs font-semibold text-slate-800">モード（必須）</p>
              <select
                value={form.mode}
                onChange={(e) => updateForm("mode", e.target.value)}
                className="w-full rounded border border-slate-400 bg-white p-2 text-slate-900"
              >
                <option value="rank">ランク</option>
                <option value="casual">カジュアル</option>
              </select>

              <p className="text-xs font-semibold text-slate-800 sm:col-span-2">VC（必須）</p>
              <select
                value={form.vcType}
                onChange={(e) => updateForm("vcType", e.target.value)}
                className="w-full rounded border border-slate-400 bg-white p-2 text-slate-900"
              >
                <option value="game">VC ON（ゲーム内）</option>
                <option value="discord">Discord</option>
                <option value="off">VC OFF</option>
              </select>
            </div>

            <div className="rounded-lg border border-slate-300 bg-slate-50 p-2">
              <p className="mb-1 text-xs font-semibold text-slate-800">応募者の年齢層（任意 / 複数選択可）</p>
              <div className="flex flex-wrap gap-2">
                {AGE_GROUP_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleAllowedAgeGroup(option.value)}
                    className={`rounded px-2 py-1 text-xs ${
                      form.allowedAgeGroups.includes(option.value)
                        ? "bg-indigo-700 text-white"
                        : "border border-slate-300 bg-slate-100 text-slate-800"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-300 bg-slate-50 p-2">
              <p className="mb-1 text-xs font-semibold text-slate-800">要求最低ランク（任意）</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={form.minRankTier}
                  onChange={(e) => handleMinRankTierChange(e.target.value)}
                  className="w-full rounded border border-slate-400 bg-white p-2 text-slate-900"
                >
                  {MIN_RANK_TIER_OPTIONS.map((option) => (
                    <option key={option.value || "none"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={form.minRankDivision ?? 4}
                  onChange={(e) => updateForm("minRankDivision", Number(e.target.value))}
                  disabled={
                    form.minRankTier === "" || form.minRankTier === "master" || form.minRankTier === "predator"
                  }
                  className="w-full rounded border border-slate-400 bg-white p-2 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  {MIN_RANK_DIVISION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-slate-800">プレイスタイルタグ（必須 / 1つ以上、最大3つ）</p>
              <div className="flex flex-wrap gap-2">
                {playStyleOptions.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => togglePlayStyle(style)}
                    className={`rounded px-2 py-1 text-xs ${
                      form.playStyles.includes(style)
                        ? "bg-blue-700 text-white"
                        : "border border-slate-300 bg-slate-100 text-slate-800"
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs font-semibold text-slate-800">その他（任意）</p>
            <textarea
              placeholder="その他"
              value={form.otherText}
              onChange={(e) => updateForm("otherText", e.target.value)}
              className="w-full rounded border border-slate-400 bg-white p-2 text-slate-900 placeholder:text-slate-500"
            />
          </section>
        )}

        {formTab === "profile" && (
          <section className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
            <h2 className="text-sm font-semibold text-slate-900">投稿者情報</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="text-xs font-semibold text-slate-800 sm:col-span-2">現在ランク（任意）</p>
              <select
                value={form.currentRankTier}
                onChange={(e) => handleProfileRankTierChange("currentRankTier", e.target.value)}
                className="w-full rounded border border-slate-400 bg-white p-2 text-slate-900"
              >
                {PROFILE_RANK_TIER_OPTIONS.map((option) => (
                  <option key={`current-${option.value || "none"}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={form.currentRankDivision ?? 4}
                onChange={(e) => updateForm("currentRankDivision", Number(e.target.value))}
                disabled={
                  form.currentRankTier === "" || form.currentRankTier === "master" || form.currentRankTier === "predator"
                }
                className="w-full rounded border border-slate-400 bg-white p-2 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {MIN_RANK_DIVISION_OPTIONS.map((option) => (
                  <option key={`current-division-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-xs font-semibold text-slate-800 sm:col-span-2">最高到達ランク（任意）</p>
              <select
                value={form.maxRankTier}
                onChange={(e) => handleProfileRankTierChange("maxRankTier", e.target.value)}
                className="w-full rounded border border-slate-400 bg-white p-2 text-slate-900"
              >
                {PROFILE_RANK_TIER_OPTIONS.map((option) => (
                  <option key={`max-${option.value || "none"}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={form.maxRankDivision ?? 4}
                onChange={(e) => updateForm("maxRankDivision", Number(e.target.value))}
                disabled={form.maxRankTier === "" || form.maxRankTier === "master" || form.maxRankTier === "predator"}
                className="w-full rounded border border-slate-400 bg-white p-2 text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {MIN_RANK_DIVISION_OPTIONS.map((option) => (
                  <option key={`max-division-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-xs font-semibold text-slate-800 sm:col-span-2">年齢層（任意）</p>
              <select
                value={form.ageGroup}
                onChange={(e) => updateForm("ageGroup", e.target.value)}
                className="w-full rounded border border-slate-400 bg-white p-2 text-slate-900 sm:col-span-2"
              >
                <option value="">未設定</option>
                <option value="10s">10代</option>
                <option value="20s">20代</option>
                <option value="30s">30代</option>
                <option value="40s">40代以上</option>
              </select>

              <p className="mt-1 text-xs font-semibold text-slate-800 sm:col-span-2">プラットフォーム（任意）</p>
              <select
                value={form.platform}
                onChange={(e) => updateForm("platform", e.target.value)}
                className="w-full rounded border border-slate-400 bg-white p-2 text-slate-900 sm:col-span-2"
              >
                <option value="">未設定</option>
                {PLATFORM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

      </div>
          </div>
        </div>
      )}

      <div className="mb-3 lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileFilterOpen((prev) => !prev)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-100"
        >
          {isMobileFilterOpen ? "フィルターを閉じる" : "フィルターを開く"}
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          className={`${isMobileFilterOpen ? "block" : "hidden"} overflow-x-hidden lg:block lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:overflow-y-auto`}
        >
          <div className="min-w-0 rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
            <div className="mb-2 inline-flex w-full rounded-lg border border-slate-300 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setFilterTab("recruit")}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${
                  filterTab === "recruit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-700"
                }`}
              >
                募集内容
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("poster")}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${
                  filterTab === "poster" ? "bg-white text-slate-900 shadow-sm" : "text-slate-700"
                }`}
              >
                投稿者情報
              </button>
            </div>

            <div className="grid gap-2">
              {filterTab === "recruit" && (
                <>
                  <label className="text-xs font-semibold text-slate-700">タイトル</label>
                  <input
                    type="text"
                    placeholder="タイトル"
                    value={postFilter.title}
                    onChange={(e) => setPostFilter((prev) => ({ ...prev, title: e.target.value }))}
                    className="rounded border border-slate-400 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-500"
                  />

                  <select
                    value={postFilter.recruitCount}
                    onChange={(e) =>
                      setPostFilter((prev) => ({ ...prev, recruitCount: e.target.value as PostFilter["recruitCount"] }))
                    }
                    className="rounded border border-slate-400 bg-white p-2 text-sm text-slate-900"
                  >
                    <option value="all">募集人数: すべて</option>
                    <option value="1">募集人数: 1人</option>
                    <option value="2">募集人数: 2人</option>
                  </select>

                  <select
                    value={postFilter.mode}
                    onChange={(e) => setPostFilter((prev) => ({ ...prev, mode: e.target.value as PostFilter["mode"] }))}
                    className="rounded border border-slate-400 bg-white p-2 text-sm text-slate-900"
                  >
                    <option value="all">モード: すべて</option>
                    <option value="rank">モード: ランク</option>
                    <option value="casual">モード: カジュアル</option>
                  </select>

                  <select
                    value={postFilter.vcType}
                    onChange={(e) =>
                      setPostFilter((prev) => ({ ...prev, vcType: e.target.value as PostFilter["vcType"] }))
                    }
                    className="rounded border border-slate-400 bg-white p-2 text-sm text-slate-900"
                  >
                    <option value="all">VC: すべて</option>
                    <option value="game">VC: ゲーム内</option>
                    <option value="discord">VC: Discord</option>
                    <option value="off">VC: OFF</option>
                  </select>

                  <select
                    value={postFilter.allowedAgeGroup}
                    onChange={(e) =>
                      setPostFilter((prev) => ({
                        ...prev,
                        allowedAgeGroup: e.target.value as PostFilter["allowedAgeGroup"],
                      }))
                    }
                    className="rounded border border-slate-400 bg-white p-2 text-sm text-slate-900"
                  >
                    <option value="all">応募者年齢層: すべて</option>
                    <option value="10s">応募者年齢層: 10代</option>
                    <option value="20s">応募者年齢層: 20代</option>
                    <option value="30s">応募者年齢層: 30代</option>
                    <option value="40s">応募者年齢層: 40代以上</option>
                  </select>

                  <select
                    value={postFilter.playStyle}
                    onChange={(e) =>
                      setPostFilter((prev) => ({ ...prev, playStyle: e.target.value }))
                    }
                    className="rounded border border-slate-400 bg-white p-2 text-sm text-slate-900"
                  >
                    <option value="all">プレイスタイル: すべて</option>
                    {playStyleOptions.map((style) => (
                      <option key={style} value={style}>
                        プレイスタイル: {style}
                      </option>
                    ))}
                  </select>

                  <select
                    value={postFilter.minRankTier}
                    onChange={(e) =>
                      setPostFilter((prev) => ({ ...prev, minRankTier: e.target.value as PostFilter["minRankTier"] }))
                    }
                    className="rounded border border-slate-400 bg-white p-2 text-sm text-slate-900"
                  >
                    <option value="all">要求最低ランク: すべて</option>
                    <option value="none">要求最低ランク: 指定なし</option>
                    <option value="bronze">要求最低ランク: ブロンズ</option>
                    <option value="silver">要求最低ランク: シルバー</option>
                    <option value="gold">要求最低ランク: ゴールド</option>
                    <option value="platinum">要求最低ランク: プラチナ</option>
                    <option value="diamond">要求最低ランク: ダイヤ</option>
                    <option value="master">要求最低ランク: マスター</option>
                    <option value="predator">要求最低ランク: プレデター</option>
                  </select>

                  <select
                    value={postFilter.minRankDivision}
                    onChange={(e) =>
                      setPostFilter((prev) => ({
                        ...prev,
                        minRankDivision: e.target.value as PostFilter["minRankDivision"],
                      }))
                    }
                    className="rounded border border-slate-400 bg-white p-2 text-sm text-slate-900"
                  >
                    <option value="all">最低ランク division: すべて</option>
                    <option value="4">最低ランク division: IV</option>
                    <option value="3">最低ランク division: III</option>
                    <option value="2">最低ランク division: II</option>
                    <option value="1">最低ランク division: I</option>
                  </select>

                  <input
                    type="text"
                    placeholder="その他"
                    value={postFilter.otherText}
                    onChange={(e) => setPostFilter((prev) => ({ ...prev, otherText: e.target.value }))}
                    className="rounded border border-slate-400 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-500"
                  />
                </>
              )}

              {filterTab === "poster" && (
                <>
                  <select
                    value={postFilter.currentRankTier}
                    onChange={(e) =>
                      setPostFilter((prev) => ({
                        ...prev,
                        currentRankTier: e.target.value as PostFilter["currentRankTier"],
                      }))
                    }
                    className="rounded border border-slate-400 bg-white p-2 text-sm text-slate-900"
                  >
                    <option value="all">現在ランク: すべて</option>
                    <option value="none">現在ランク: 未設定</option>
                    <option value="bronze">現在ランク: ブロンズ</option>
                    <option value="silver">現在ランク: シルバー</option>
                    <option value="gold">現在ランク: ゴールド</option>
                    <option value="platinum">現在ランク: プラチナ</option>
                    <option value="diamond">現在ランク: ダイヤ</option>
                    <option value="master">現在ランク: マスター</option>
                    <option value="predator">現在ランク: プレデター</option>
                  </select>

                  <select
                    value={postFilter.currentRankDivision}
                    onChange={(e) =>
                      setPostFilter((prev) => ({
                        ...prev,
                        currentRankDivision: e.target.value as PostFilter["currentRankDivision"],
                      }))
                    }
                    className="rounded border border-slate-400 bg-white p-2 text-sm text-slate-900"
                  >
                    <option value="all">現在ランク division: すべて</option>
                    <option value="4">現在ランク division: IV</option>
                    <option value="3">現在ランク division: III</option>
                    <option value="2">現在ランク division: II</option>
                    <option value="1">現在ランク division: I</option>
                  </select>

                  <select
                    value={postFilter.maxRankTier}
                    onChange={(e) =>
                      setPostFilter((prev) => ({ ...prev, maxRankTier: e.target.value as PostFilter["maxRankTier"] }))
                    }
                    className="rounded border border-slate-400 bg-white p-2 text-sm text-slate-900"
                  >
                    <option value="all">最高到達ランク: すべて</option>
                    <option value="none">最高到達ランク: 未設定</option>
                    <option value="bronze">最高到達ランク: ブロンズ</option>
                    <option value="silver">最高到達ランク: シルバー</option>
                    <option value="gold">最高到達ランク: ゴールド</option>
                    <option value="platinum">最高到達ランク: プラチナ</option>
                    <option value="diamond">最高到達ランク: ダイヤ</option>
                    <option value="master">最高到達ランク: マスター</option>
                    <option value="predator">最高到達ランク: プレデター</option>
                  </select>

                  <select
                    value={postFilter.maxRankDivision}
                    onChange={(e) =>
                      setPostFilter((prev) => ({
                        ...prev,
                        maxRankDivision: e.target.value as PostFilter["maxRankDivision"],
                      }))
                    }
                    className="rounded border border-slate-400 bg-white p-2 text-sm text-slate-900"
                  >
                    <option value="all">最高ランク division: すべて</option>
                    <option value="4">最高ランク division: IV</option>
                    <option value="3">最高ランク division: III</option>
                    <option value="2">最高ランク division: II</option>
                    <option value="1">最高ランク division: I</option>
                  </select>

                  <select
                    value={postFilter.posterAgeGroup}
                    onChange={(e) =>
                      setPostFilter((prev) => ({
                        ...prev,
                        posterAgeGroup: e.target.value as PostFilter["posterAgeGroup"],
                      }))
                    }
                    className="rounded border border-slate-400 bg-white p-2 text-sm text-slate-900"
                  >
                    <option value="all">投稿者年齢層: すべて</option>
                    <option value="10s">投稿者年齢層: 10代</option>
                    <option value="20s">投稿者年齢層: 20代</option>
                    <option value="30s">投稿者年齢層: 30代</option>
                    <option value="40s">投稿者年齢層: 40代以上</option>
                  </select>

                  <select
                    value={postFilter.posterPlatform}
                    onChange={(e) =>
                      setPostFilter((prev) => ({
                        ...prev,
                        posterPlatform: e.target.value as PostFilter["posterPlatform"],
                      }))
                    }
                    className="w-full min-w-0 rounded border border-slate-400 bg-white p-2 text-sm text-slate-900"
                  >
                    <option value="all">投稿者プラットフォーム: すべて</option>
                    <option value="origin">投稿者プラットフォーム: PC</option>
                    <option value="xbl">投稿者プラットフォーム: Xbox</option>
                    <option value="psn">投稿者プラットフォーム: PS</option>
                  </select>
                </>
              )}

              <button
                type="button"
                onClick={() => setPostFilter(DEFAULT_FILTER)}
                className="rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-800 hover:bg-slate-200"
              >
                フィルター解除
              </button>
            </div>

            <div className="mt-2">
              <span className="text-xs font-medium text-slate-700">表示件数: {filteredPosts.length}件</span>
            </div>
          </div>
        </aside>

        <section className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2">
          {sortedFilteredPosts.map(({ post, remaining }) => {
            const posterAvatar = getPosterAvatar(post.user_id);
            const posterName = getPosterDisplayName(post.user_id);

            return (
          <article
            key={post.id}
            className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                {posterAvatar ? (
                  <Image
                    src={posterAvatar}
                    alt="poster avatar"
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full border border-slate-300 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-300 text-sm font-semibold text-slate-800">
                    {posterName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">{post.title}</h2>
                  <p className="text-xs text-slate-600">投稿者: {posterName}</p>
                </div>
              </div>
              <div className="flex flex-row items-center gap-2 text-xs sm:flex-col sm:items-end sm:gap-1">
                <span className="rounded-full bg-red-100 px-2 py-1 font-semibold text-red-700">残り {remaining}</span>
                <span className="rounded-full bg-slate-200 px-2 py-1 font-medium text-slate-800">
                  応募 {post.applications?.[0]?.count || 0}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <section className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 text-sm text-slate-800">
                <h3 className="mb-2 font-semibold text-slate-900">募集内容</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <p>募集人数: {post.recruit_count}人</p>
                  <p>モード: {toModeLabel(post.mode)}</p>
                  <p>VC: {toVcLabel(post.vc_type)}</p>
                  <p>
                    応募者年齢層:{" "}
                    {post.allowed_age_groups && post.allowed_age_groups.length > 0
                      ? post.allowed_age_groups.map((item) => toAgeLabel(item)).join(" / ")
                      : "指定なし"}
                  </p>
                  <p className="sm:col-span-2">
                    要求最低ランク:{" "}
                    {post.min_rank_tier ? formatRank(post.min_rank_tier, post.min_rank_division ?? undefined) : "指定なし"}
                  </p>
                  <p className="sm:col-span-2">
                    その他: {post.other_text && post.other_text.trim() ? post.other_text : "なし"}
                  </p>
                </div>
              </section>

              <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 text-sm text-slate-800">
                <h3 className="mb-2 font-semibold text-slate-900">投稿者情報</h3>
                <div className="grid grid-cols-1 gap-2">
                  <p>現在ランク: {formatRank(post.current_rank_tier, post.current_rank_division)}</p>
                  <p>最高到達ランク: {formatRank(post.max_rank_tier, post.max_rank_division)}</p>
                  <p>年齢層: {toAgeLabel(post.age_group)}</p>
                  <p>プラットフォーム: {post.platform ? toPlatformLabel(post.platform) : "未設定"}</p>
                </div>
              </section>
            </div>

            {post.play_styles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {post.play_styles.map((style) => (
                  <span key={style} className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                    {style}
                  </span>
                ))}
              </div>
            )}

            {currentUserId && post.winner_user_id === currentUserId && (
              <p className="mt-3 text-sm font-semibold text-emerald-700">あなたが選ばれました</p>
            )}

            {currentUserId && post.user_id === currentUserId && (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => fetchApplicants(post.id)}
                    className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900"
                  >
                    応募一覧を見る
                  </button>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="rounded-md bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-800"
                  >
                    投稿を削除
                  </button>
                </div>

                {activePostId === post.id && (
                  <div className="mt-2 space-y-2 rounded-lg border border-slate-300 bg-slate-100 p-2">
                    {applicants.length === 0 ? (
                      <p className="text-sm text-slate-700">まだ応募はありません。</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-xs text-slate-700">
                          <span>
                            応募者 {activeApplicantIndex + 1} / {applicants.length}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveApplicantIndex((prev) => Math.max(0, prev - 1))}
                              disabled={activeApplicantIndex === 0}
                              className="rounded border border-slate-300 bg-white px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              前へ
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveApplicantIndex((prev) => Math.min(applicants.length - 1, prev + 1))
                              }
                              disabled={activeApplicantIndex >= applicants.length - 1}
                              className="rounded border border-slate-300 bg-white px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              次へ
                            </button>
                          </div>
                        </div>

                        {activeApplicant && (
                          <div className="rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900">
                            <p className="font-semibold text-slate-950">
                              {activeApplicantProfile?.display_name?.trim() ||
                                activeApplicantProfile?.tracker_handle?.trim() ||
                                `User ${activeApplicant.applicant_user_id.slice(0, 6)}`}
                            </p>
                            <p className="text-xs text-slate-600">ID: {activeApplicant.applicant_user_id}</p>
                            <div className="mt-2 grid gap-1 sm:grid-cols-2">
                              <p>
                                現在ランク:{" "}
                                {formatRank(
                                  activeApplicantProfile?.current_rank_tier ?? undefined,
                                  activeApplicantProfile?.current_rank_division ?? undefined
                                )}
                              </p>
                              <p>
                                最高到達ランク:{" "}
                                {formatRank(
                                  activeApplicantProfile?.max_rank_tier ?? undefined,
                                  activeApplicantProfile?.max_rank_division ?? undefined
                                )}
                              </p>
                              <p>年齢層: {toAgeLabel(activeApplicantProfile?.age_group ?? "") || "未設定"}</p>
                            </div>

                            <div className="mt-3 space-y-2 rounded-md border border-emerald-200 bg-emerald-50/50 p-2">
                              <p className="text-xs font-semibold text-slate-900">選択時に送付する情報</p>
                              <input
                                type="text"
                                placeholder="EAアカウント名"
                                value={finalizePayloadByPost[post.id]?.eaAccountName ?? ""}
                                onChange={(e) => updateFinalizePayload(post.id, "eaAccountName", e.target.value)}
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                              />
                              {toVcKey(post.vc_type) === "discord" && (
                                <input
                                  type="text"
                                  placeholder="Discordサーバ招待リンク"
                                  value={finalizePayloadByPost[post.id]?.discordInviteLink ?? ""}
                                  onChange={(e) => updateFinalizePayload(post.id, "discordInviteLink", e.target.value)}
                                  className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                                />
                              )}
                              <textarea
                                placeholder="一言メッセージ"
                                value={finalizePayloadByPost[post.id]?.message ?? ""}
                                onChange={(e) => updateFinalizePayload(post.id, "message", e.target.value)}
                                rows={3}
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                              />
                            </div>

                            <div className="mt-3">
                              <button
                                onClick={() => handleFinalizeSelection(post.id, activeApplicant.applicant_user_id)}
                                className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
                              >
                                この人に決定して通知を送る
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              {appliedPostIds.includes(post.id) ? (
                <button disabled className="rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-600">
                  応募済み
                </button>
              ) : (
                <button
                  onClick={() => handleApply(post)}
                  disabled={!currentUserId || post.user_id === currentUserId}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {currentUserId ? (post.user_id === currentUserId ? "自分の投稿" : "応募する") : "ログインして応募"}
                </button>
              )}
            </div>
          </article>
            );
          })}
          {filteredPosts.length === 0 && (
            <p className="rounded-xl border border-slate-300 bg-white p-6 text-center text-sm text-slate-700 shadow-sm md:col-span-2">
              {visiblePosts.length > 0 ? "条件に一致する募集がありません" : "表示できる募集がありません"}
            </p>
          )}
          </div>
        </section>
      </div>
      </div>
    </main>
  );
}
