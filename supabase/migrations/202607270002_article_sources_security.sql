begin;

alter table public.article_sources enable row level security;

drop policy if exists "article_sources_owner_all" on public.article_sources;
drop policy if exists "article_sources_owner_select" on public.article_sources;
create policy "article_sources_owner_select" on public.article_sources
  for select to authenticated
  using (owner_id = auth.uid());

revoke insert, update, delete on public.article_sources from authenticated;
grant select on public.article_sources to authenticated;
grant all privileges on public.article_sources to service_role;

create or replace function public.omfit_apply_article_source_approvals(
  p_owner_id uuid,
  p_article_id uuid,
  p_approved_ids uuid[],
  p_content_html text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(btrim(p_content_html), '') = '' then
    raise exception 'Article content cannot be empty';
  end if;

  if not exists (
    select 1
    from public.articles
    where id = p_article_id
      and owner_id = p_owner_id
  ) then
    raise exception 'Article not found';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_approved_ids, array[]::uuid[])) as requested(id)
    left join public.article_sources source
      on source.id = requested.id
      and source.article_id = p_article_id
      and source.owner_id = p_owner_id
    where source.id is null
       or source.status = 'broken'
  ) then
    raise exception 'Source selection is invalid';
  end if;

  update public.article_sources
  set
    approved = id = any(coalesce(p_approved_ids, array[]::uuid[])),
    status = case
      when id = any(coalesce(p_approved_ids, array[]::uuid[])) then 'approved'
      when status = 'broken' then 'broken'
      else 'rejected'
    end,
    updated_at = now()
  where owner_id = p_owner_id
    and article_id = p_article_id;

  update public.articles
  set
    content_html = p_content_html,
    updated_at = now()
  where id = p_article_id
    and owner_id = p_owner_id;
end;
$$;

revoke all on function public.omfit_apply_article_source_approvals(uuid, uuid, uuid[], text)
  from public, anon, authenticated;
grant execute on function public.omfit_apply_article_source_approvals(uuid, uuid, uuid[], text)
  to service_role;

commit;
