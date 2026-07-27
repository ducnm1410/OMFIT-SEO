export const OMFIT_PUBLIC_ASSET_BUCKET = 'omfit-public-assets';

export function normalizeOwnedStoragePath(ownerId, bucket, storagePath) {
  const normalizedOwnerId = String(ownerId || '').trim().toLowerCase();
  const normalizedBucket = String(bucket || '').trim();
  const normalizedPath = String(storagePath || '').trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(normalizedOwnerId)
    || normalizedBucket !== OMFIT_PUBLIC_ASSET_BUCKET
    || !normalizedPath
    || normalizedPath.length > 1_000
    || normalizedPath.includes('\\')
    || !/^[a-z0-9._/-]+$/i.test(normalizedPath)
    || /[\u0000-\u001f\u007f]/.test(normalizedPath)
  ) return '';

  const segments = normalizedPath.split('/');
  if (
    segments.length < 3
    || segments[0].toLowerCase() !== normalizedOwnerId
    || segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) return '';
  return normalizedPath;
}

export function normalizeTrustedWordpressMediaUrl(siteUrl, sourceUrl) {
  try {
    const expected = new URL(String(siteUrl || ''));
    const source = new URL(String(sourceUrl || ''));
    if (
      expected.protocol !== 'https:'
      || source.protocol !== 'https:'
      || source.username
      || source.password
      || (source.port && source.port !== '443')
      || source.hostname.replace(/^www\./i, '') !== expected.hostname.replace(/^www\./i, '')
    ) return '';
    source.hash = '';
    return source.toString();
  } catch {
    return '';
  }
}
