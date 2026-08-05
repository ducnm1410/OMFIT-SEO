begin;

alter table public.video_assets
  add column if not exists generation_mode text not null default 'edit-video',
  add column if not exists aspect_ratio text not null default '16:9',
  add column if not exists render_duration_ms bigint,
  add column if not exists estimated_cost_usd numeric(12, 6),
  add column if not exists output_duration_seconds numeric(10, 3),
  add column if not exists used_at timestamptz,
  add column if not exists use_count integer not null default 0,
  add column if not exists last_used_action text;

alter table public.video_assets
  drop constraint if exists video_assets_generation_mode_check,
  add constraint video_assets_generation_mode_check
    check (generation_mode in ('text-to-video', 'image-to-video', 'edit-video', 'continue')),
  drop constraint if exists video_assets_aspect_ratio_check,
  add constraint video_assets_aspect_ratio_check
    check (aspect_ratio in ('16:9', '9:16')),
  drop constraint if exists video_assets_render_duration_check,
  add constraint video_assets_render_duration_check
    check (render_duration_ms is null or render_duration_ms >= 0),
  drop constraint if exists video_assets_estimated_cost_check,
  add constraint video_assets_estimated_cost_check
    check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  drop constraint if exists video_assets_output_duration_check,
  add constraint video_assets_output_duration_check
    check (output_duration_seconds is null or output_duration_seconds >= 0),
  drop constraint if exists video_assets_use_count_check,
  add constraint video_assets_use_count_check
    check (use_count >= 0),
  drop constraint if exists video_assets_last_used_action_check,
  add constraint video_assets_last_used_action_check
    check (last_used_action is null or last_used_action in ('download', 'selected'));

update storage.buckets
set allowed_mime_types = array[
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'image/jpeg',
  'image/png',
  'image/webp'
]
where id = 'omfit-video-inputs';

create index if not exists video_assets_usage_idx
  on public.video_assets(status, used_at, created_at desc);

create or replace function public.get_video_editor_analytics()
returns table (
  total_videos bigint,
  average_render_seconds numeric,
  estimated_cost_usd numeric,
  used_videos bigint,
  usage_rate numeric
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    count(*)::bigint as total_videos,
    (avg(video.render_duration_ms) filter (where video.render_duration_ms > 0) / 1000.0)::numeric
      as average_render_seconds,
    coalesce(sum(video.estimated_cost_usd), 0)::numeric as estimated_cost_usd,
    count(*) filter (where video.used_at is not null or video.use_count > 0)::bigint as used_videos,
    case
      when count(*) = 0 then 0::numeric
      else (
        count(*) filter (where video.used_at is not null or video.use_count > 0)
        * 100.0 / count(*)
      )::numeric
    end as usage_rate
  from public.video_assets as video
  where video.status = 'approved'
    and public.is_internal_profile_user();
$$;

revoke all on function public.get_video_editor_analytics() from public, anon;
grant execute on function public.get_video_editor_analytics() to authenticated, service_role;

insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '202608050004',
  array['Applied from supabase/migrations/202608050004_video_editor_productivity.sql'],
  'video_editor_productivity'
)
on conflict (version) do nothing;

commit;
