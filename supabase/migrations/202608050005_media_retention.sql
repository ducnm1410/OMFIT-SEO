begin;

create table if not exists public.video_source_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null default 'omfit-video-inputs'
    check (bucket = 'omfit-video-inputs'),
  storage_path text not null,
  mime_type text not null,
  bytes bigint not null check (bytes >= 0),
  file_name text not null,
  input_kind text not null default 'video'
    check (input_kind in ('image', 'video')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, storage_path)
);

drop trigger if exists set_video_source_assets_updated_at on public.video_source_assets;
create trigger set_video_source_assets_updated_at
before update on public.video_source_assets
for each row execute function public.set_updated_at();

create index if not exists video_source_assets_retention_idx
  on public.video_source_assets(created_at, id);
create index if not exists video_assets_retention_idx
  on public.video_assets(created_at, id);
create index if not exists media_assets_retention_idx
  on public.media_assets(created_at, id)
  where bucket = 'omfit-public-assets' and status <> 'published';

alter table public.video_source_assets enable row level security;
revoke all privileges on public.video_source_assets from public, anon, authenticated;
grant all privileges on public.video_source_assets to service_role;

comment on table public.video_source_assets is
  'Tracks AI Video Editor source uploads so the Railway retention worker can remove them after 14 days.';

insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '202608050005',
  array['Applied from supabase/migrations/202608050005_media_retention.sql'],
  'media_retention'
)
on conflict (version) do nothing;

commit;
