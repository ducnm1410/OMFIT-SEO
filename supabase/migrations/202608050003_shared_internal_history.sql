begin;

create or replace function public.is_internal_profile_user()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where coalesce(profile.auth_user_id, profile.id) = (select auth.uid())
      and profile.role in ('admin', 'editor')
  );
$$;

revoke all on function public.is_internal_profile_user() from public, anon;
grant execute on function public.is_internal_profile_user() to authenticated, service_role;

drop policy if exists "articles_internal_history_select" on public.articles;
create policy "articles_internal_history_select" on public.articles
  for select to authenticated
  using (public.is_internal_profile_user());

drop policy if exists "article_revisions_internal_history_select" on public.article_revisions;
create policy "article_revisions_internal_history_select" on public.article_revisions
  for select to authenticated
  using (public.is_internal_profile_user());

drop policy if exists "media_assets_internal_history_select" on public.media_assets;
create policy "media_assets_internal_history_select" on public.media_assets
  for select to authenticated
  using (public.is_internal_profile_user());

drop policy if exists "article_media_internal_history_select" on public.article_media;
create policy "article_media_internal_history_select" on public.article_media
  for select to authenticated
  using (public.is_internal_profile_user());

drop policy if exists "seo_audits_internal_history_select" on public.seo_audits;
create policy "seo_audits_internal_history_select" on public.seo_audits
  for select to authenticated
  using (public.is_internal_profile_user());

drop policy if exists "article_sources_internal_history_select" on public.article_sources;
create policy "article_sources_internal_history_select" on public.article_sources
  for select to authenticated
  using (public.is_internal_profile_user());

drop policy if exists "video_assets_internal_history_select" on public.video_assets;
create policy "video_assets_internal_history_select" on public.video_assets
  for select to authenticated
  using (public.is_internal_profile_user());

insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '202608050003',
  array['Applied via Supabase SQL Editor from supabase/migrations/202608050003_shared_internal_history.sql'],
  'shared_internal_history'
)
on conflict (version) do nothing;

commit;
