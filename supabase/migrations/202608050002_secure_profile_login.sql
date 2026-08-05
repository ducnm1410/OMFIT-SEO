begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists profiles_auth_user_id_unique
  on public.profiles(auth_user_id)
  where auth_user_id is not null;

update public.profiles as profile
set auth_user_id = auth_user.id
from auth.users as auth_user
where profile.auth_user_id is null
  and (
    auth_user.id = profile.id
    or lower(auth_user.email) in (
      regexp_replace(profile.phone, '\D', '', 'g') || '@omfit.local',
      regexp_replace(profile.phone, '\D', '', 'g') || '@omfit.app'
    )
  );

update public.profiles
set password = extensions.crypt(password, extensions.gen_salt('bf', 11))
where password !~ '^\$2[aby]\$';

alter table public.profiles enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy %I on public.profiles', existing_policy.policyname);
  end loop;
end
$$;

revoke all privileges on table public.profiles from anon, authenticated;
grant select (id, phone, full_name, role, "isLoggedIn", created_at, auth_user_id)
  on table public.profiles to authenticated;
grant all privileges on table public.profiles to service_role;

create policy profiles_owner_select
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = coalesce(auth_user_id, id));

create or replace function public.verify_internal_profile_credentials(
  input_phone text,
  input_password text
)
returns table (
  profile_id uuid,
  auth_user_id uuid,
  full_name text,
  role text
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    profile.id,
    profile.auth_user_id,
    profile.full_name,
    profile.role
  from public.profiles as profile
  where regexp_replace(profile.phone, '\D', '', 'g') = input_phone
    and profile.password = extensions.crypt(input_password, profile.password)
  limit 1;
$$;

revoke all on function public.verify_internal_profile_credentials(text, text)
  from public, anon, authenticated;
grant execute on function public.verify_internal_profile_credentials(text, text)
  to service_role;

insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '202608050002',
  array['Applied via Supabase SQL Editor from supabase/migrations/202608050002_secure_profile_login.sql'],
  'secure_profile_login'
)
on conflict (version) do nothing;

commit;
