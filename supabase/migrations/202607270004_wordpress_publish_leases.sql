begin;

create table if not exists public.wordpress_publish_leases (
  article_id uuid primary key references public.articles(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  lease_token uuid not null,
  lease_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wordpress_publish_leases_expiry_idx
  on public.wordpress_publish_leases(lease_expires_at);

drop trigger if exists set_wordpress_publish_leases_updated_at
  on public.wordpress_publish_leases;
create trigger set_wordpress_publish_leases_updated_at
before update on public.wordpress_publish_leases
for each row execute function public.set_updated_at();

alter table public.wordpress_publish_leases enable row level security;
revoke all privileges on public.wordpress_publish_leases from public, anon, authenticated;
grant all privileges on public.wordpress_publish_leases to service_role;

create or replace function public.claim_wordpress_publish_lease(
  p_article_id uuid,
  p_owner_id uuid,
  p_lease_token uuid,
  p_lease_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.articles
    where id = p_article_id
      and owner_id = p_owner_id
  ) then
    return false;
  end if;

  insert into public.wordpress_publish_leases (
    article_id,
    owner_id,
    lease_token,
    lease_expires_at
  )
  values (
    p_article_id,
    p_owner_id,
    p_lease_token,
    p_lease_expires_at
  )
  on conflict (article_id) do update
  set
    owner_id = excluded.owner_id,
    lease_token = excluded.lease_token,
    lease_expires_at = excluded.lease_expires_at
  where public.wordpress_publish_leases.lease_expires_at <= now();

  return found;
end;
$$;

revoke all on function public.claim_wordpress_publish_lease(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_wordpress_publish_lease(uuid, uuid, uuid, timestamptz)
  to service_role;

commit;
