begin;

create extension if not exists pgcrypto with schema extensions;

update public.profiles
set password = extensions.crypt(password, extensions.gen_salt('bf', 11))
where password is not null
  and password !~ '^\$2[aby]\$';

create or replace function public.hash_internal_profile_password()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.password is null or new.password = '' then
    raise exception 'Profile password cannot be empty';
  end if;
  if new.password !~ '^\$2[aby]\$' then
    new.password := extensions.crypt(new.password, extensions.gen_salt('bf', 11));
  end if;
  return new;
end;
$$;

revoke all on function public.hash_internal_profile_password()
  from public, anon, authenticated;

drop trigger if exists profiles_hash_password_before_write on public.profiles;
create trigger profiles_hash_password_before_write
before insert or update of password on public.profiles
for each row
execute function public.hash_internal_profile_password();

insert into supabase_migrations.schema_migrations (version, statements, name)
values (
  '202608090001',
  array['Applied via Supabase SQL Editor from supabase/migrations/202608090001_enforce_profile_password_hash.sql'],
  'enforce_profile_password_hash'
)
on conflict (version) do nothing;

commit;
