-- Security hardening for client-accessed tables.
-- Generated on 2026-02-28
-- Safe to re-run.

begin;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table if exists public.admin_users enable row level security;
alter table if exists public.posts enable row level security;
alter table if exists public.applications enable row level security;
alter table if exists public.play_style_tags enable row level security;

do $$
begin
  if to_regclass('public.admin_users') is not null then
    execute 'drop policy if exists "Users can read own admin row" on public.admin_users';
    execute 'create policy "Users can read own admin row" on public.admin_users for select using (auth.uid() = user_id)';
  end if;
end $$;

do $$
begin
  if to_regclass('public.posts') is not null then
    execute 'drop policy if exists "Anyone can read posts" on public.posts';
    execute 'create policy "Anyone can read posts" on public.posts for select using (true)';

    execute 'drop policy if exists "Users can create own posts" on public.posts';
    execute '' ||
      'create policy "Users can create own posts" on public.posts for insert with check (' ||
      'auth.uid() is not null and auth.uid()::text = user_id::text' ||
      ')';

    execute 'drop policy if exists "Owners or admins can update posts" on public.posts';
    execute '' ||
      'create policy "Owners or admins can update posts" on public.posts for update using (' ||
      'auth.uid() is not null and (' ||
      'auth.uid()::text = user_id::text or exists (select 1 from public.admin_users a where a.user_id = auth.uid())' ||
      ')' ||
      ') with check (' ||
      'auth.uid() is not null and (' ||
      'auth.uid()::text = user_id::text or exists (select 1 from public.admin_users a where a.user_id = auth.uid())' ||
      ')' ||
      ')';

    execute 'drop policy if exists "Owners or admins can delete posts" on public.posts';
    execute '' ||
      'create policy "Owners or admins can delete posts" on public.posts for delete using (' ||
      'auth.uid() is not null and (' ||
      'auth.uid()::text = user_id::text or exists (select 1 from public.admin_users a where a.user_id = auth.uid())' ||
      ')' ||
      ')';
  end if;
end $$;

do $$
begin
  if to_regclass('public.applications') is not null then
    execute 'drop policy if exists "Applicants recruiters and admins can read applications" on public.applications';
    execute '' ||
      'create policy "Applicants recruiters and admins can read applications" on public.applications for select using (' ||
      'auth.uid() is not null and (' ||
      'auth.uid()::text = applicant_user_id::text or ' ||
      'exists (select 1 from public.posts p where p.id = applications.post_id and p.user_id::text = auth.uid()::text) or ' ||
      'exists (select 1 from public.admin_users a where a.user_id = auth.uid())' ||
      ')' ||
      ')';

    execute 'drop policy if exists "Users can apply to open posts" on public.applications';
    execute '' ||
      'create policy "Users can apply to open posts" on public.applications for insert with check (' ||
      'auth.uid() is not null and auth.uid()::text = applicant_user_id::text and ' ||
      'exists (' ||
      'select 1 from public.posts p where p.id = applications.post_id and p.user_id::text <> auth.uid()::text and coalesce(p.is_closed, false) = false' ||
      ')' ||
      ')';

    execute 'drop policy if exists "Applicants recruiters and admins can delete applications" on public.applications';
    execute '' ||
      'create policy "Applicants recruiters and admins can delete applications" on public.applications for delete using (' ||
      'auth.uid() is not null and (' ||
      'auth.uid()::text = applicant_user_id::text or ' ||
      'exists (select 1 from public.posts p where p.id = applications.post_id and p.user_id::text = auth.uid()::text) or ' ||
      'exists (select 1 from public.admin_users a where a.user_id = auth.uid())' ||
      ')' ||
      ')';
  end if;
end $$;

do $$
begin
  if to_regclass('public.play_style_tags') is not null then
    execute 'drop policy if exists "Anyone can read play style tags" on public.play_style_tags';
    execute 'create policy "Anyone can read play style tags" on public.play_style_tags for select using (true)';

    execute 'drop policy if exists "Admins can insert play style tags" on public.play_style_tags';
    execute '' ||
      'create policy "Admins can insert play style tags" on public.play_style_tags for insert with check (' ||
      'auth.uid() is not null and exists (select 1 from public.admin_users a where a.user_id = auth.uid())' ||
      ')';

    execute 'drop policy if exists "Admins can update play style tags" on public.play_style_tags';
    execute '' ||
      'create policy "Admins can update play style tags" on public.play_style_tags for update using (' ||
      'auth.uid() is not null and exists (select 1 from public.admin_users a where a.user_id = auth.uid())' ||
      ') with check (' ||
      'auth.uid() is not null and exists (select 1 from public.admin_users a where a.user_id = auth.uid())' ||
      ')';

    execute 'drop policy if exists "Admins can delete play style tags" on public.play_style_tags';
    execute '' ||
      'create policy "Admins can delete play style tags" on public.play_style_tags for delete using (' ||
      'auth.uid() is not null and exists (select 1 from public.admin_users a where a.user_id = auth.uid())' ||
      ')';
  end if;
end $$;

commit;
