begin;

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_profile_id uuid not null references public.brand_profiles(id) on delete cascade,
  asset_type text not null check (asset_type in ('logo', 'reference', 'texture', 'font_sample')),
  name text not null,
  bucket text not null,
  storage_path text not null,
  public_url text,
  mime_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (brand_profile_id, asset_type, name)
);

alter table public.brand_assets enable row level security;

create policy "brand_assets_owner_all" on public.brand_assets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, update, delete on public.brand_assets to authenticated;
grant all privileges on public.brand_assets to service_role;

commit;
