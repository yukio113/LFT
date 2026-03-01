-- Normalization + security policy hardening
-- Generated on 2026-03-01
-- Idempotent migration for phased rollout with backward compatibility.

begin;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Canonicalize user-entered labels to stable keys.
create or replace function public.normalize_age_group(input text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(trim(input), ''))
    when '10s' then '10s'
    when '20s' then '20s'
    when '30s' then '30s'
    when '40s' then '40s'
    else null
  end
$$;

create or replace function public.normalize_platform(input text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(trim(input), ''))
    when 'origin' then 'origin'
    when 'pc' then 'origin'
    when 'pc (origin/ea app)' then 'origin'
    when 'xbl' then 'xbl'
    when 'xbox' then 'xbl'
    when 'psn' then 'psn'
    when 'playstation' then 'psn'
    else null
  end
$$;

create or replace function public.normalize_mode(input text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(trim(input), ''))
    when 'rank' then 'rank'
    when 'casual' then 'casual'
    else null
  end
$$;

create or replace function public.normalize_vc_type(input text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(trim(input), ''))
    when 'game' then 'game'
    when 'discord' then 'discord'
    when 'off' then 'off'
    else null
  end
$$;

create or replace function public.normalize_rank_tier(input text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(trim(input), ''))
    when 'bronze' then 'bronze'
    when 'silver' then 'silver'
    when 'gold' then 'gold'
    when 'platinum' then 'platinum'
    when 'diamond' then 'diamond'
    when 'master' then 'master'
    when 'predator' then 'predator'
    else null
  end
$$;

create table if not exists public.ref_age_groups (
  key text primary key,
  label text not null unique,
  sort_order smallint not null unique
);

insert into public.ref_age_groups(key, label, sort_order)
values
  ('10s', 'teens', 10),
  ('20s', '20s', 20),
  ('30s', '30s', 30),
  ('40s', '40_plus', 40)
on conflict (key) do update
  set label = excluded.label,
      sort_order = excluded.sort_order;

create table if not exists public.ref_platforms (
  key text primary key,
  label text not null unique
);

insert into public.ref_platforms(key, label)
values
  ('origin', 'PC (Origin/EA app)'),
  ('xbl', 'Xbox'),
  ('psn', 'PlayStation')
on conflict (key) do update
  set label = excluded.label;

create table if not exists public.ref_rank_tiers (
  key text primary key,
  label text not null unique,
  sort_order smallint not null unique
);

insert into public.ref_rank_tiers(key, label, sort_order)
values
  ('bronze', 'bronze', 10),
  ('silver', 'silver', 20),
  ('gold', 'gold', 30),
  ('platinum', 'platinum', 40),
  ('diamond', 'diamond', 50),
  ('master', 'master', 60),
  ('predator', 'predator', 70)
on conflict (key) do update
  set label = excluded.label,
      sort_order = excluded.sort_order;

-- Keep existing profiles table as write model, but add visibility control.
alter table if exists public.profiles
  add column if not exists is_public boolean not null default true;

create table if not exists public.user_game_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  age_group_key text references public.ref_age_groups(key),
  platform_key text references public.ref_platforms(key),
  tracker_platform_key text references public.ref_platforms(key),
  tracker_handle text,
  current_rank_tier_key text references public.ref_rank_tiers(key),
  current_rank_division integer,
  max_rank_tier_key text references public.ref_rank_tiers(key),
  max_rank_division integer,
  tracker_level integer,
  tracker_rank_score integer,
  tracker_kills integer,
  tracker_damage integer,
  tracker_raw jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_game_profiles_public_idx
  on public.user_game_profiles (is_public, updated_at desc);

insert into public.user_game_profiles (
  user_id,
  display_name,
  avatar_url,
  age_group_key,
  platform_key,
  tracker_platform_key,
  tracker_handle,
  current_rank_tier_key,
  current_rank_division,
  max_rank_tier_key,
  max_rank_division,
  tracker_level,
  tracker_rank_score,
  tracker_kills,
  tracker_damage,
  tracker_raw,
  is_public,
  created_at,
  updated_at
)
select
  p.user_id,
  p.display_name,
  p.avatar_url,
  public.normalize_age_group(p.age_group),
  public.normalize_platform(p.tracker_platform),
  public.normalize_platform(p.tracker_platform),
  p.tracker_handle,
  public.normalize_rank_tier(p.current_rank_tier),
  p.current_rank_division,
  public.normalize_rank_tier(p.max_rank_tier),
  p.max_rank_division,
  p.tracker_level,
  p.tracker_rank_score,
  p.tracker_kills,
  p.tracker_damage,
  p.tracker_raw,
  coalesce(p.is_public, true),
  p.created_at,
  p.updated_at
from public.profiles p
on conflict (user_id) do update
set
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  age_group_key = excluded.age_group_key,
  platform_key = excluded.platform_key,
  tracker_platform_key = excluded.tracker_platform_key,
  tracker_handle = excluded.tracker_handle,
  current_rank_tier_key = excluded.current_rank_tier_key,
  current_rank_division = excluded.current_rank_division,
  max_rank_tier_key = excluded.max_rank_tier_key,
  max_rank_division = excluded.max_rank_division,
  tracker_level = excluded.tracker_level,
  tracker_rank_score = excluded.tracker_rank_score,
  tracker_kills = excluded.tracker_kills,
  tracker_damage = excluded.tracker_damage,
  tracker_raw = excluded.tracker_raw,
  is_public = excluded.is_public,
  updated_at = excluded.updated_at;

create or replace function public.sync_user_game_profiles_from_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_game_profiles (
    user_id,
    display_name,
    avatar_url,
    age_group_key,
    platform_key,
    tracker_platform_key,
    tracker_handle,
    current_rank_tier_key,
    current_rank_division,
    max_rank_tier_key,
    max_rank_division,
    tracker_level,
    tracker_rank_score,
    tracker_kills,
    tracker_damage,
    tracker_raw,
    is_public,
    created_at,
    updated_at
  )
  values (
    new.user_id,
    new.display_name,
    new.avatar_url,
    public.normalize_age_group(new.age_group),
    public.normalize_platform(new.tracker_platform),
    public.normalize_platform(new.tracker_platform),
    new.tracker_handle,
    public.normalize_rank_tier(new.current_rank_tier),
    new.current_rank_division,
    public.normalize_rank_tier(new.max_rank_tier),
    new.max_rank_division,
    new.tracker_level,
    new.tracker_rank_score,
    new.tracker_kills,
    new.tracker_damage,
    new.tracker_raw,
    coalesce(new.is_public, true),
    new.created_at,
    new.updated_at
  )
  on conflict (user_id) do update
  set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    age_group_key = excluded.age_group_key,
    platform_key = excluded.platform_key,
    tracker_platform_key = excluded.tracker_platform_key,
    tracker_handle = excluded.tracker_handle,
    current_rank_tier_key = excluded.current_rank_tier_key,
    current_rank_division = excluded.current_rank_division,
    max_rank_tier_key = excluded.max_rank_tier_key,
    max_rank_division = excluded.max_rank_division,
    tracker_level = excluded.tracker_level,
    tracker_rank_score = excluded.tracker_rank_score,
    tracker_kills = excluded.tracker_kills,
    tracker_damage = excluded.tracker_damage,
    tracker_raw = excluded.tracker_raw,
    is_public = excluded.is_public,
    updated_at = excluded.updated_at;

  return new;
end
$$;

drop trigger if exists trg_sync_user_game_profiles_from_profiles on public.profiles;
create trigger trg_sync_user_game_profiles_from_profiles
after insert or update on public.profiles
for each row execute function public.sync_user_game_profiles_from_profiles();

-- Normalize many-value post fields into side tables.
create table if not exists public.post_recruit_settings (
  post_id bigint primary key references public.posts(id) on delete cascade,
  mode_key text check (mode_key in ('rank', 'casual')),
  vc_type_key text check (vc_type_key in ('game', 'discord', 'off')),
  min_rank_tier_key text references public.ref_rank_tiers(key),
  min_rank_division integer,
  current_rank_tier_key text references public.ref_rank_tiers(key),
  current_rank_division integer,
  max_rank_tier_key text references public.ref_rank_tiers(key),
  max_rank_division integer,
  poster_age_group_key text references public.ref_age_groups(key),
  platform_key text references public.ref_platforms(key),
  updated_at timestamptz not null default now()
);

create index if not exists post_recruit_settings_mode_vc_idx
  on public.post_recruit_settings (mode_key, vc_type_key);

create table if not exists public.post_allowed_age_groups (
  post_id bigint not null references public.posts(id) on delete cascade,
  age_group_key text not null references public.ref_age_groups(key),
  primary key (post_id, age_group_key)
);

create table if not exists public.post_play_style_tags (
  post_id bigint not null references public.posts(id) on delete cascade,
  play_style_tag_id bigint not null references public.play_style_tags(id) on delete cascade,
  primary key (post_id, play_style_tag_id)
);

create index if not exists post_play_style_tags_tag_idx
  on public.post_play_style_tags (play_style_tag_id, post_id);

insert into public.post_recruit_settings (
  post_id,
  mode_key,
  vc_type_key,
  min_rank_tier_key,
  min_rank_division,
  current_rank_tier_key,
  current_rank_division,
  max_rank_tier_key,
  max_rank_division,
  poster_age_group_key,
  platform_key
)
select
  p.id,
  public.normalize_mode(p.mode),
  public.normalize_vc_type(p.vc_type),
  public.normalize_rank_tier(p.min_rank_tier),
  p.min_rank_division,
  public.normalize_rank_tier(p.current_rank_tier),
  p.current_rank_division,
  public.normalize_rank_tier(p.max_rank_tier),
  p.max_rank_division,
  public.normalize_age_group(p.age_group),
  public.normalize_platform(p.platform)
from public.posts p
on conflict (post_id) do update
set
  mode_key = excluded.mode_key,
  vc_type_key = excluded.vc_type_key,
  min_rank_tier_key = excluded.min_rank_tier_key,
  min_rank_division = excluded.min_rank_division,
  current_rank_tier_key = excluded.current_rank_tier_key,
  current_rank_division = excluded.current_rank_division,
  max_rank_tier_key = excluded.max_rank_tier_key,
  max_rank_division = excluded.max_rank_division,
  poster_age_group_key = excluded.poster_age_group_key,
  platform_key = excluded.platform_key,
  updated_at = now();

insert into public.post_allowed_age_groups (post_id, age_group_key)
select p.id, public.normalize_age_group(a.value)
from public.posts p
cross join lateral unnest(coalesce(p.allowed_age_groups, array[]::text[])) as a(value)
where public.normalize_age_group(a.value) is not null
on conflict do nothing;

insert into public.post_play_style_tags (post_id, play_style_tag_id)
select p.id, t.id
from public.posts p
cross join lateral unnest(coalesce(p.play_styles, array[]::text[])) as s(value)
join public.play_style_tags t
  on lower(trim(t.name)) = lower(trim(s.value))
on conflict do nothing;

create or replace function public.sync_post_sidecar_tables()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.post_recruit_settings (
    post_id,
    mode_key,
    vc_type_key,
    min_rank_tier_key,
    min_rank_division,
    current_rank_tier_key,
    current_rank_division,
    max_rank_tier_key,
    max_rank_division,
    poster_age_group_key,
    platform_key,
    updated_at
  )
  values (
    new.id,
    public.normalize_mode(new.mode),
    public.normalize_vc_type(new.vc_type),
    public.normalize_rank_tier(new.min_rank_tier),
    new.min_rank_division,
    public.normalize_rank_tier(new.current_rank_tier),
    new.current_rank_division,
    public.normalize_rank_tier(new.max_rank_tier),
    new.max_rank_division,
    public.normalize_age_group(new.age_group),
    public.normalize_platform(new.platform),
    now()
  )
  on conflict (post_id) do update
  set
    mode_key = excluded.mode_key,
    vc_type_key = excluded.vc_type_key,
    min_rank_tier_key = excluded.min_rank_tier_key,
    min_rank_division = excluded.min_rank_division,
    current_rank_tier_key = excluded.current_rank_tier_key,
    current_rank_division = excluded.current_rank_division,
    max_rank_tier_key = excluded.max_rank_tier_key,
    max_rank_division = excluded.max_rank_division,
    poster_age_group_key = excluded.poster_age_group_key,
    platform_key = excluded.platform_key,
    updated_at = now();

  delete from public.post_allowed_age_groups where post_id = new.id;
  insert into public.post_allowed_age_groups (post_id, age_group_key)
  select new.id, public.normalize_age_group(v)
  from unnest(coalesce(new.allowed_age_groups, array[]::text[])) as x(v)
  where public.normalize_age_group(v) is not null
  on conflict do nothing;

  delete from public.post_play_style_tags where post_id = new.id;
  insert into public.post_play_style_tags (post_id, play_style_tag_id)
  select new.id, t.id
  from unnest(coalesce(new.play_styles, array[]::text[])) as x(v)
  join public.play_style_tags t
    on lower(trim(t.name)) = lower(trim(v))
  on conflict do nothing;

  return new;
end
$$;

drop trigger if exists trg_sync_post_sidecar_tables on public.posts;
create trigger trg_sync_post_sidecar_tables
after insert or update on public.posts
for each row execute function public.sync_post_sidecar_tables();

create table if not exists public.public_profile_cards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  tracker_handle text,
  current_rank_tier text,
  current_rank_division integer,
  max_rank_tier text,
  max_rank_division integer,
  age_group text,
  updated_at timestamptz not null default now()
);

insert into public.public_profile_cards (
  user_id,
  display_name,
  tracker_handle,
  current_rank_tier,
  current_rank_division,
  max_rank_tier,
  max_rank_division,
  age_group,
  updated_at
)
select
  p.user_id,
  p.display_name,
  p.tracker_handle,
  p.current_rank_tier,
  p.current_rank_division,
  p.max_rank_tier,
  p.max_rank_division,
  p.age_group,
  p.updated_at
from public.profiles p
where p.is_public = true
on conflict (user_id) do update
set
  display_name = excluded.display_name,
  tracker_handle = excluded.tracker_handle,
  current_rank_tier = excluded.current_rank_tier,
  current_rank_division = excluded.current_rank_division,
  max_rank_tier = excluded.max_rank_tier,
  max_rank_division = excluded.max_rank_division,
  age_group = excluded.age_group,
  updated_at = excluded.updated_at;

delete from public.public_profile_cards c
where not exists (
  select 1
  from public.profiles p
  where p.user_id = c.user_id
    and p.is_public = true
);

create or replace function public.sync_public_profile_cards_from_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_public, true) then
    insert into public.public_profile_cards (
      user_id,
      display_name,
      tracker_handle,
      current_rank_tier,
      current_rank_division,
      max_rank_tier,
      max_rank_division,
      age_group,
      updated_at
    )
    values (
      new.user_id,
      new.display_name,
      new.tracker_handle,
      new.current_rank_tier,
      new.current_rank_division,
      new.max_rank_tier,
      new.max_rank_division,
      new.age_group,
      new.updated_at
    )
    on conflict (user_id) do update
    set
      display_name = excluded.display_name,
      tracker_handle = excluded.tracker_handle,
      current_rank_tier = excluded.current_rank_tier,
      current_rank_division = excluded.current_rank_division,
      max_rank_tier = excluded.max_rank_tier,
      max_rank_division = excluded.max_rank_division,
      age_group = excluded.age_group,
      updated_at = excluded.updated_at;
  else
    delete from public.public_profile_cards where user_id = new.user_id;
  end if;

  return new;
end
$$;

drop trigger if exists trg_sync_public_profile_cards_from_profiles on public.profiles;
create trigger trg_sync_public_profile_cards_from_profiles
after insert or update on public.profiles
for each row execute function public.sync_public_profile_cards_from_profiles();

create or replace function public.cleanup_public_profile_card_on_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.public_profile_cards where user_id = old.user_id;
  return old;
end
$$;

drop trigger if exists trg_cleanup_public_profile_card_on_profile_delete on public.profiles;
create trigger trg_cleanup_public_profile_card_on_profile_delete
after delete on public.profiles
for each row execute function public.cleanup_public_profile_card_on_profile_delete();

alter table if exists public.public_profile_cards enable row level security;
revoke all on table public.public_profile_cards from anon;
revoke all on table public.public_profile_cards from authenticated;
drop policy if exists "Authenticated users can read public profile cards" on public.public_profile_cards;
create policy "Authenticated users can read public profile cards"
  on public.public_profile_cards for select
  using (auth.role() = 'authenticated');

create or replace view public.public_profiles as
select
  user_id,
  display_name,
  tracker_handle,
  current_rank_tier,
  current_rank_division,
  max_rank_tier,
  max_rank_division,
  age_group
from public.public_profile_cards;

revoke all on table public.public_profiles from anon;
revoke all on table public.public_profiles from authenticated;
grant select on public.public_profiles to authenticated;

alter table if exists public.profiles enable row level security;

drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can read own public profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Users can upsert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Admins can read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.admin_users a
      where a.user_id = auth.uid()
    )
  );

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
