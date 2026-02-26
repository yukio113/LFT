import { createClient } from "@supabase/supabase-js";

const normalizeEnv = (value: string | undefined) => {
  if (!value) return "";
  const trimmed = value.trim();
  // Handle values accidentally wrapped in quotes in hosting env settings.
  return trimmed.replace(/^['\"]|['\"]$/g, "");
};

const supabaseUrl = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = normalizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigMessage =
  "Supabase environment variables are not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";

// Use safe placeholder values during build when env vars are missing/invalid.
const fallbackUrl = "https://example.supabase.co";
const fallbackAnonKey = "public-anon-key-placeholder";

export const supabase = createClient(
  supabaseUrl || fallbackUrl,
  supabaseAnonKey || fallbackAnonKey
);
