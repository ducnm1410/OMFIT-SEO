begin;

create table if not exists public.video_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  parent_asset_id uuid references public.video_assets(id) on delete set null,
  provider text not null default 'gemini',
  provider_interaction_id text not null,
  model text not null,
  bucket text not null,
  storage_path text not null,
  public_url text not null check (public_url ~* '^https://'),
  source_storage_path text,
  mime_type text not null default 'video/mp4',
  bytes bigint,
  file_name text not null,
  prompt_vi text not null default '',
  prompt_en text not null default '',
  resolution text not null default '720p' check (resolution in ('720p', '1080p')),
  status text not null default 'approved' check (status in ('approved', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider_interaction_id),
  unique (bucket, storage_path)
);

create index if not exists video_assets_owner_created_idx
  on public.video_assets(owner_id, created_at desc);

drop trigger if exists set_video_assets_updated_at on public.video_assets;
create trigger set_video_assets_updated_at
before update on public.video_assets
for each row execute function public.set_updated_at();

alter table public.video_assets enable row level security;
drop policy if exists "video_assets_owner_select" on public.video_assets;
create policy "video_assets_owner_select" on public.video_assets
  for select to authenticated
  using (owner_id = auth.uid());

revoke insert, update, delete on public.video_assets from public, anon, authenticated;
grant select on public.video_assets to authenticated;
grant all privileges on public.video_assets to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('omfit-video-inputs', 'omfit-video-inputs', false, 104857600, array['video/mp4', 'video/quicktime', 'video/webm']),
  ('omfit-video-assets', 'omfit-video-assets', true, 104857600, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "video_inputs_owner_insert" on storage.objects;
create policy "video_inputs_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'omfit-video-inputs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "video_inputs_owner_select" on storage.objects;
create policy "video_inputs_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'omfit-video-inputs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "video_inputs_owner_delete" on storage.objects;
create policy "video_inputs_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'omfit-video-inputs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
