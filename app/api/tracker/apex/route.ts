import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_TRACKER_BASE_URL = "https://public-api.tracker.gg";
const TRACKER_APEX_PROFILE_PATH = "/v2/apex/standard/profile";
const PLAYER_ID_MAX_LENGTH = 64;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const PLATFORM_ALLOWLIST = new Set(["origin", "xbl", "psn"]);
const TIER_KEY_MAP: Record<string, string> = {
  bronze: "bronze",
  silver: "silver",
  gold: "gold",
  platinum: "platinum",
  diamond: "diamond",
  master: "master",
  predator: "predator",
};

type NormalizedApexProfile = {
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

const normalizeEnv = (value: string | undefined): string => {
  if (!value) return "";
  return value.trim().replace(/^['"]|['"]$/g, "");
};

const trackerProxyRequestCounters = new Map<string, { count: number; resetAt: number }>();

const getNumberValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeTierFromLabel = (
  label: string | null | undefined
): { tier: string | null; division: number | null } => {
  if (!label) return { tier: null, division: null };
  const lower = label.toLowerCase();
  const tier = Object.keys(TIER_KEY_MAP).find((key) => lower.includes(key)) ?? null;
  if (!tier) return { tier: null, division: null };

  const roman = lower.match(/\b(i|ii|iii|iv)\b/);
  const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4 };
  const division = roman ? romanMap[roman[1]] ?? null : null;
  return { tier, division };
};

const findStat = (segments: unknown, key: string): unknown => {
  if (!Array.isArray(segments)) return null;
  for (const segment of segments) {
    if (!segment || typeof segment !== "object") continue;
    const stats = (segment as { stats?: Record<string, unknown> }).stats;
    if (!stats || typeof stats !== "object") continue;
    const stat = stats[key];
    if (!stat || typeof stat !== "object") continue;
    const value = (stat as { value?: unknown; displayValue?: unknown });
    return value.value ?? value.displayValue ?? null;
  }
  return null;
};

const findStatLabel = (segments: unknown, key: string): string | null => {
  if (!Array.isArray(segments)) return null;
  for (const segment of segments) {
    if (!segment || typeof segment !== "object") continue;
    const stats = (segment as { stats?: Record<string, unknown> }).stats;
    if (!stats || typeof stats !== "object") continue;
    const stat = stats[key];
    if (!stat || typeof stat !== "object") continue;
    const label = (stat as { displayName?: unknown; displayValue?: unknown }).displayValue;
    if (typeof label === "string" && label.trim()) return label.trim();
  }
  return null;
};

const normalizeTrackerPayload = (payload: unknown, platform: string, playerId: string): NormalizedApexProfile => {
  const root = (payload ?? {}) as {
    data?: {
      platformInfo?: {
        platformSlug?: string;
        platformUserIdentifier?: string;
        avatarUrl?: string;
      };
      segments?: unknown;
    };
  };

  const platformInfo = root.data?.platformInfo;
  const segments = root.data?.segments;
  const displayName = platformInfo?.platformUserIdentifier ?? null;
  const avatarUrl = platformInfo?.avatarUrl ?? null;

  const rankLabel = findStatLabel(segments, "rankScore");
  const rankScore = getNumberValue(findStat(segments, "rankScore"));
  const level = getNumberValue(findStat(segments, "level"));
  const kills = getNumberValue(findStat(segments, "kills"));
  const damage = getNumberValue(findStat(segments, "damage"));
  const current = normalizeTierFromLabel(rankLabel);

  return {
    trackerPlatform: platformInfo?.platformSlug ?? platform,
    trackerHandle: playerId,
    displayName,
    avatarUrl,
    currentRankTier: current.tier,
    currentRankDivision: current.division,
    maxRankTier: null,
    maxRankDivision: null,
    level,
    rankScore,
    kills,
    damage,
    raw: payload,
  };
};

const getBearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
};

const getRequestIp = (request: Request): string => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown-ip";
};

const enforceRateLimit = (key: string): { limited: boolean; retryAfterSeconds: number } => {
  const now = Date.now();
  const existing = trackerProxyRequestCounters.get(key);

  if (!existing || now >= existing.resetAt) {
    trackerProxyRequestCounters.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { limited: false, retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  existing.count += 1;
  trackerProxyRequestCounters.set(key, existing);
  return { limited: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = (searchParams.get("platform") ?? "").trim().toLowerCase();
  const playerId = (searchParams.get("playerId") ?? "").trim();
  const apiKey = normalizeEnv(process.env.TRN_API_KEY || process.env.TRACKER_API_KEY);
  const baseUrl = normalizeEnv(process.env.TRACKER_API_BASE_URL) || DEFAULT_TRACKER_BASE_URL;
  const supabaseUrl = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured on server." },
      { status: 500 }
    );
  }

  const bearerToken = getBearerToken(request);
  if (!bearerToken) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(bearerToken);
  if (authError || !authData.user?.id) {
    return NextResponse.json({ error: "Authentication failed." }, { status: 401 });
  }

  const requesterId = authData.user.id;
  const rateLimitKey = `${requesterId}:${getRequestIp(request)}`;
  const rateLimit = enforceRateLimit(rateLimitKey);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Tracker API key is not configured on server.",
        hint: "Set TRN_API_KEY (or TRACKER_API_KEY) in .env.local and restart dev server.",
      },
      { status: 500 }
    );
  }

  if (!PLATFORM_ALLOWLIST.has(platform)) {
    return NextResponse.json(
      { error: "platform must be one of origin, xbl, psn." },
      { status: 400 }
    );
  }

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required." }, { status: 400 });
  }
  if (playerId.length > PLAYER_ID_MAX_LENGTH) {
    return NextResponse.json(
      { error: `playerId must be ${PLAYER_ID_MAX_LENGTH} characters or less.` },
      { status: 400 }
    );
  }

  const endpoint = `${baseUrl}${TRACKER_APEX_PROFILE_PATH}/${platform}/${encodeURIComponent(playerId)}`;
  const upstream = await fetch(endpoint, {
    headers: {
      "TRN-Api-Key": apiKey,
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "User-Agent": "apex-matching/1.0",
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    if (upstream.status === 401) {
      return NextResponse.json(
        {
          error: "Tracker API authentication failed (401).",
          hint: "Verify server-side Tracker API credentials and access approval.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: `Tracker API failed with status ${upstream.status}.` }, { status: upstream.status });
  }

  const payload = await upstream.json();
  const profile = normalizeTrackerPayload(payload, platform, playerId);
  return NextResponse.json({ profile });
}
