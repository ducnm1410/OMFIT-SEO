begin;

alter table public.brand_profiles
  add column if not exists guideline_notes text not null default '',
  add column if not exists company_info jsonb not null default '{}'::jsonb,
  add column if not exists branches jsonb not null default '[]'::jsonb,
  add column if not exists footer_settings jsonb not null default '{}'::jsonb;

alter table public.brand_assets
  drop constraint if exists brand_assets_asset_type_check;

alter table public.brand_assets
  add constraint brand_assets_asset_type_check
  check (asset_type in ('logo', 'guideline', 'reference', 'texture', 'font_sample'));

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown'
]
where id = 'omfit-draft-assets';

commit;
