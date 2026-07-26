begin;

create extension if not exists pgcrypto;

create table if not exists public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'OMFIT',
  version integer not null default 1,
  is_active boolean not null default true,
  mission text not null default '',
  positioning text not null default '',
  audience text[] not null default '{}',
  voice jsonb not null default '{}'::jsonb,
  colors jsonb not null default '{}'::jsonb,
  typography jsonb not null default '{}'::jsonb,
  visual_rules jsonb not null default '{}'::jsonb,
  prohibited_elements text[] not null default '{}',
  approved_claims text[] not null default '{}',
  prompt_template text not null default '',
  negative_prompt text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name, version)
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brand_profile_id uuid references public.brand_profiles(id) on delete set null,
  title text not null,
  slug text not null,
  meta_title text not null default '',
  meta_description text not null default '',
  focus_keyword text not null default '',
  content_html text not null default '',
  content_blocks jsonb not null default '[]'::jsonb,
  word_count integer not null default 0,
  readability_score integer not null default 0 check (readability_score between 0 and 100),
  seo_score integer not null default 0 check (seo_score between 0 and 100),
  seo_status text not null default 'needs_review'
    check (seo_status in ('needs_review', 'ready', 'blocked')),
  categories text[] not null default '{}',
  tags text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'review', 'published', 'archived')),
  wp_post_id bigint,
  wp_post_url text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create table if not exists public.article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision_no integer not null,
  snapshot jsonb not null,
  change_note text not null default '',
  created_at timestamptz not null default now(),
  unique (article_id, revision_no)
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid references public.articles(id) on delete set null,
  brand_profile_id uuid references public.brand_profiles(id) on delete set null,
  provider text not null default 'upload',
  provider_generation_id text,
  model text,
  bucket text not null,
  storage_path text not null,
  public_url text,
  source_url text,
  mime_type text,
  width integer,
  height integer,
  bytes bigint,
  checksum text,
  file_name text not null,
  alt_text text not null default '',
  caption text not null default '',
  prompt text not null default '',
  negative_prompt text not null default '',
  style text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'published', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, storage_path)
);

create table if not exists public.article_media (
  article_id uuid not null references public.articles(id) on delete cascade,
  media_id uuid not null references public.media_assets(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('featured', 'inline')),
  section_key text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (article_id, media_id)
);

create table if not exists public.seo_audits (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  readability_score integer not null check (readability_score between 0 and 100),
  passed boolean not null default false,
  issues jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.internal_links (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  target_url text not null,
  target_title text not null default '',
  anchor_text text not null,
  section_key text,
  status text not null default 'suggested'
    check (status in ('suggested', 'approved', 'inserted', 'broken', 'removed')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.site_content_index (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  wp_post_id bigint,
  content_type text not null default 'post',
  title text not null,
  url text not null,
  slug text not null,
  excerpt text not null default '',
  keywords text[] not null default '{}',
  status text not null default 'publish',
  wp_modified_at timestamptz,
  indexed_at timestamptz not null default now(),
  unique (owner_id, url)
);

create index if not exists articles_owner_updated_idx
  on public.articles(owner_id, updated_at desc);
create index if not exists media_assets_owner_article_idx
  on public.media_assets(owner_id, article_id);
create index if not exists site_content_index_owner_slug_idx
  on public.site_content_index(owner_id, slug);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_brand_profiles_updated_at on public.brand_profiles;
create trigger set_brand_profiles_updated_at
before update on public.brand_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_articles_updated_at on public.articles;
create trigger set_articles_updated_at
before update on public.articles
for each row execute function public.set_updated_at();

drop trigger if exists set_media_assets_updated_at on public.media_assets;
create trigger set_media_assets_updated_at
before update on public.media_assets
for each row execute function public.set_updated_at();

alter table public.brand_profiles enable row level security;
alter table public.articles enable row level security;
alter table public.article_revisions enable row level security;
alter table public.media_assets enable row level security;
alter table public.article_media enable row level security;
alter table public.seo_audits enable row level security;
alter table public.internal_links enable row level security;
alter table public.site_content_index enable row level security;

create policy "brand_profiles_owner_all" on public.brand_profiles
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "articles_owner_all" on public.articles
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "article_revisions_owner_all" on public.article_revisions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "media_assets_owner_all" on public.media_assets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "article_media_owner_all" on public.article_media
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "seo_audits_owner_all" on public.seo_audits
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "internal_links_owner_all" on public.internal_links
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "site_content_index_owner_all" on public.site_content_index
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('omfit-draft-assets', 'omfit-draft-assets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('omfit-public-assets', 'omfit-public-assets', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "storage_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('omfit-draft-assets', 'omfit-public-assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "storage_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('omfit-draft-assets', 'omfit-public-assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "storage_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('omfit-draft-assets', 'omfit-public-assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "storage_owner_read_drafts" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'omfit-draft-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
