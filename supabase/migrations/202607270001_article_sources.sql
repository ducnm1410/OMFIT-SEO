begin;

create unique index if not exists articles_id_owner_idx
  on public.articles(id, owner_id);

alter table public.brand_profiles
  add column if not exists editorial_settings jsonb not null default '{}'::jsonb;

create table if not exists public.article_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null,
  url text not null check (url ~* '^https://'),
  canonical_url text check (
    canonical_url is null
    or canonical_url ~* '^https://'
  ),
  title text not null default '',
  publisher text not null default '',
  domain text not null default '',
  published_at timestamptz,
  accessed_at timestamptz not null default now(),
  source_type text not null default 'web',
  claim_text text not null default '',
  grounding_data jsonb not null default '{}'::jsonb,
  approved boolean not null default false,
  status text not null default 'candidate'
    check (status in ('candidate', 'verified', 'approved', 'rejected', 'broken')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_sources_article_owner_fkey
    foreign key (article_id, owner_id)
    references public.articles(id, owner_id)
    on delete cascade,
  constraint article_sources_article_url_key
    unique (article_id, url)
);

create index if not exists article_sources_owner_article_created_idx
  on public.article_sources(owner_id, article_id, created_at desc);

create index if not exists article_sources_owner_status_idx
  on public.article_sources(owner_id, status, approved);

drop trigger if exists set_article_sources_updated_at on public.article_sources;
create trigger set_article_sources_updated_at
before update on public.article_sources
for each row execute function public.set_updated_at();

alter table public.article_sources enable row level security;

drop policy if exists "article_sources_owner_all" on public.article_sources;
drop policy if exists "article_sources_owner_select" on public.article_sources;
create policy "article_sources_owner_select" on public.article_sources
  for select to authenticated
  using (owner_id = auth.uid());

revoke insert, update, delete on public.article_sources from authenticated;
grant select on public.article_sources to authenticated;
grant all privileges on public.article_sources to service_role;

commit;
