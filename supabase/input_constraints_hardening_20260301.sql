-- Input constraint hardening for abuse/XSS risk reduction.
-- Generated on 2026-03-01
-- Safe to re-run.

begin;

-- Prevent duplicate applications even if client checks are bypassed.
do $$
begin
  if to_regclass('public.applications') is not null then
    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'applications'
        and c.conname = 'applications_post_id_applicant_user_id_key'
    ) then
      alter table public.applications
        add constraint applications_post_id_applicant_user_id_key
        unique (post_id, applicant_user_id);
    end if;
  end if;
end $$;

-- Enforce practical max lengths and safe URL schemes to reduce stored-XSS vectors.
do $$
begin
  if to_regclass('public.posts') is not null then
    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'posts'
        and c.conname = 'posts_title_len_check'
    ) then
      alter table public.posts
        add constraint posts_title_len_check
        check (char_length(title) between 1 and 120);
    end if;

    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'posts'
        and c.conname = 'posts_other_text_len_check'
    ) then
      alter table public.posts
        add constraint posts_other_text_len_check
        check (other_text is null or char_length(other_text) <= 2000);
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.play_style_tags') is not null then
    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'play_style_tags'
        and c.conname = 'play_style_tags_name_len_check'
    ) then
      alter table public.play_style_tags
        add constraint play_style_tags_name_len_check
        check (char_length(name) between 1 and 40);
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'profiles'
        and c.conname = 'profiles_display_name_len_check'
    ) then
      alter table public.profiles
        add constraint profiles_display_name_len_check
        check (display_name is null or char_length(display_name) <= 80);
    end if;

    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'profiles'
        and c.conname = 'profiles_tracker_handle_len_check'
    ) then
      alter table public.profiles
        add constraint profiles_tracker_handle_len_check
        check (tracker_handle is null or char_length(tracker_handle) <= 64);
    end if;

    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'profiles'
        and c.conname = 'profiles_avatar_url_https_check'
    ) then
      alter table public.profiles
        add constraint profiles_avatar_url_https_check
        check (avatar_url is null or avatar_url ~* '^https://');
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.application_results') is not null then
    -- Normalize legacy values so constraint creation does not fail on existing rows.
    update public.application_results
      set discord_invite_link = nullif(btrim(discord_invite_link), '')
      where discord_invite_link is not null;

    update public.application_results
      set discord_invite_link = regexp_replace(discord_invite_link, '^http://', 'https://', 'i')
      where discord_invite_link ~* '^http://(discord\.gg/|discord\.com/invite/)';

    update public.application_results
      set discord_invite_link = null
      where discord_invite_link is not null
        and discord_invite_link !~* '^https://(discord\.gg/|discord\.com/invite/)';

    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'application_results'
        and c.conname = 'application_results_ea_account_name_len_check'
    ) then
      alter table public.application_results
        add constraint application_results_ea_account_name_len_check
        check (ea_account_name is null or char_length(ea_account_name) <= 120);
    end if;

    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'application_results'
        and c.conname = 'application_results_message_len_check'
    ) then
      alter table public.application_results
        add constraint application_results_message_len_check
        check (message is null or char_length(message) <= 2000);
    end if;

    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'application_results'
        and c.conname = 'application_results_discord_invite_link_https_check'
    ) then
      alter table public.application_results
        add constraint application_results_discord_invite_link_https_check
        check (
          discord_invite_link is null
          or discord_invite_link ~* '^https://(discord\\.gg/|discord\\.com/invite/)'
        );
    end if;
  end if;
end $$;

commit;
