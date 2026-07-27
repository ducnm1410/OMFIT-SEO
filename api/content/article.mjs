import app from '../../server/index.mjs';
import { resolveMultiplexedUrl } from '../../server/vercelRouting.mjs';

export const maxDuration = 60;

export default function handler(request, response) {
  request.url = resolveMultiplexedUrl(request.url);
  return app(request, response);
}
