create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tracker_platform text,
  tracker_handle text,
  display_name text,
  avatar_url text,
  current_rank_tier text,
  current_rank_division integer,
  max_rank_tier text,
  max_rank_division integer,
  tracker_level integer,
  tracker_rank_score integer,
  tracker_kills integer,
  tracker_damage integer,
  tracker_raw jsonb,
  age_group text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "Users can upsert own profile" on public.profiles;
create policy "Users can upsert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
