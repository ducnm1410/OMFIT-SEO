begin;

alter table public.media_assets enable row level security;

drop policy if exists "media_assets_owner_all" on public.media_assets;
drop policy if exists "media_assets_owner_select" on public.media_assets;
create policy "media_assets_owner_select" on public.media_assets
  for select to authenticated
  using (owner_id = auth.uid());

revoke insert, update, delete on public.media_assets from public, anon, authenticated;
grant select on public.media_assets to authenticated;
grant all privileges on public.media_assets to service_role;

create table if not exists public.wordpress_media_mappings (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media_assets(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  site_url text not null check (site_url ~* '^https://'),
  attachment_id bigint not null check (attachment_id > 0),
  slug text not null,
  source_url text not null check (source_url ~* '^https://'),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (media_id, site_url)
);

create index if not exists wordpress_media_mappings_owner_site_idx
  on public.wordpress_media_mappings(owner_id, site_url);

drop trigger if exists set_wordpress_media_mappings_updated_at
  on public.wordpress_media_mappings;
create trigger set_wordpress_media_mappings_updated_at
before update on public.wordpress_media_mappings
for each row execute function public.set_updated_at();

alter table public.wordpress_media_mappings enable row level security;
revoke all privileges on public.wordpress_media_mappings from public, anon, authenticated;
grant all privileges on public.wordpress_media_mappings to service_role;

commit;
