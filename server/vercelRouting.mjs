const multiplexedRoutes = new Map([
  ['research-sources', '/api/research/sources'],
  ['media-register', '/api/media/register'],
  ['post-publish-seo', '/api/wordpress/post-publish-seo']
]);

export function resolveMultiplexedUrl(rawUrl) {
  const requestUrl = new URL(rawUrl || '/api/content/article', 'https://omfit-seo.vercel.app');
  const routeKey = requestUrl.searchParams.get('__omfit_route');
  const targetPath = multiplexedRoutes.get(routeKey);

  if (targetPath) {
    requestUrl.searchParams.delete('__omfit_route');
    return `${targetPath}${requestUrl.search}`;
  }

  return rawUrl;
}
