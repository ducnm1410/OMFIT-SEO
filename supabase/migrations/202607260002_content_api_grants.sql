begin;

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on table
  public.brand_profiles,
  public.articles,
  public.article_revisions,
  public.media_assets,
  public.article_media,
  public.seo_audits,
  public.internal_links,
  public.site_content_index
to authenticated;

grant all privileges on table
  public.brand_profiles,
  public.articles,
  public.article_revisions,
  public.media_assets,
  public.article_media,
  public.seo_audits,
  public.internal_links,
  public.site_content_index
to service_role;

grant usage, select on all sequences in schema public to authenticated;
grant all privileges on all sequences in schema public to service_role;

commit;
