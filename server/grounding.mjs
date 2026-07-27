import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';

const TRUSTED_SOURCE_RULES = [
  { pattern: /(?:^|\.)who\.int$/i, type: 'official_health' },
  { pattern: /(?:^|\.)moh\.gov\.vn$/i, type: 'official_health' },
  { pattern: /(?:^|\.)cdc\.gov$/i, type: 'official_health' },
  { pattern: /(?:^|\.)nih\.gov$/i, type: 'official_health' },
  { pattern: /(?:^|\.)ncbi\.nlm\.nih\.gov$/i, type: 'academic' },
  { pattern: /(?:^|\.)pubmed\.ncbi\.nlm\.nih\.gov$/i, type: 'academic' },
  { pattern: /(?:^|\.)acsm\.org$/i, type: 'professional_body' },
  { pattern: /(?:^|\.)doi\.org$/i, type: 'academic' },
  { pattern: /(?:^|\.)omfit\.com\.vn$/i, type: 'official_brand' }
];

const NON_PUBLIC_IPS = new BlockList();

[
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
].forEach(([network, prefix]) => NON_PUBLIC_IPS.addSubnet(network, prefix, 'ipv4'));

[
  ['::', 96],
  ['::ffff:0:0:0', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
  ['5f00::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8]
].forEach(([network, prefix]) => NON_PUBLIC_IPS.addSubnet(network, prefix, 'ipv6'));

function normalizeIpLiteral(address = '') {
  return String(address)
    .trim()
    .replace(/^\[|\]$/g, '')
    .replace(/%.+$/, '')
    .toLowerCase();
}

function isNonPublicIp(address = '') {
  const normalized = normalizeIpLiteral(address);
  const family = isIP(normalized);
  if (!family) return true;
  return NON_PUBLIC_IPS.check(normalized, family === 4 ? 'ipv4' : 'ipv6');
}

export function isUnsafeHostname(hostname = '') {
  const normalized = normalizeIpLiteral(String(hostname).replace(/\.+$/, ''));
  if (
    !normalized
    || normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized.endsWith('.internal')
    || normalized === 'home.arpa'
    || normalized.endsWith('.home.arpa')
    || normalized === 'test'
    || normalized.endsWith('.test')
    || normalized === 'invalid'
    || normalized.endsWith('.invalid')
    || normalized === 'example'
    || normalized.endsWith('.example')
  ) return true;
  const ipVersion = isIP(normalized);
  if (ipVersion) return isNonPublicIp(normalized);
  return !normalized.includes('.') || /^[\d.]+$/.test(normalized);
}

export function normalizeGroundedUrl(value = '') {
  try {
    const url = new URL(String(value));
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || (url.port && url.port !== '443')
      || isUnsafeHostname(url.hostname)
    ) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function classifySourceDomain(hostname = '') {
  const matched = TRUSTED_SOURCE_RULES.find((rule) => rule.pattern.test(hostname));
  return matched?.type || 'web';
}

export function buildGroundedGenerateRequest(prompt) {
  return {
    contents: [{ parts: [{ text: String(prompt || '') }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096
    }
  };
}

export function extractGroundedSources(payload, { accessedAt = new Date().toISOString() } = {}) {
  const candidate = payload?.candidates?.[0] || {};
  const metadata = candidate.groundingMetadata || {};
  const chunks = Array.isArray(metadata.groundingChunks) ? metadata.groundingChunks : [];
  const supports = Array.isArray(metadata.groundingSupports) ? metadata.groundingSupports : [];
  const claimsByChunk = new Map();

  supports.forEach((support) => {
    const claimText = String(support?.segment?.text || '').replace(/\s+/g, ' ').trim();
    if (!claimText) return;
    (support?.groundingChunkIndices || []).forEach((chunkIndex) => {
      if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= chunks.length) return;
      const claims = claimsByChunk.get(chunkIndex) || [];
      if (!claims.includes(claimText)) claims.push(claimText);
      claimsByChunk.set(chunkIndex, claims);
    });
  });

  return chunks
    .map((chunk, index) => {
      const rawUrl = chunk?.web?.uri;
      const url = normalizeGroundedUrl(rawUrl);
      if (!url) return null;
      const parsed = new URL(url);
      return {
        url,
        canonicalUrl: url,
        title: String(chunk?.web?.title || parsed.hostname).replace(/\s+/g, ' ').trim(),
        publisher: parsed.hostname.replace(/^www\./i, ''),
        domain: parsed.hostname.replace(/^www\./i, ''),
        publishedAt: null,
        accessedAt,
        sourceType: classifySourceDomain(parsed.hostname),
        claimText: (claimsByChunk.get(index) || []).join(' ').slice(0, 1500),
        approved: false,
        status: 'candidate',
        groundingData: {
          chunkIndex: index,
          searchQueries: Array.isArray(metadata.webSearchQueries)
            ? metadata.webSearchQueries.slice(0, 10)
            : [],
          supports: supports
            .filter((support) => (support?.groundingChunkIndices || []).includes(index))
            .slice(0, 10)
        }
      };
    })
    .filter(Boolean)
    .filter((source, index, rows) => rows.findIndex((row) => row.url === source.url) === index)
    .slice(0, 12);
}

export function dedupeSourcesByUpsertUrl(sources = []) {
  const deduped = [];
  const indexByUrl = new Map();
  sources.forEach((source) => {
    const upsertUrl = normalizeGroundedUrl(source?.url || source?.canonicalUrl);
    if (!upsertUrl) {
      deduped.push(source);
      return;
    }
    const existingIndex = indexByUrl.get(upsertUrl);
    if (existingIndex === undefined) {
      indexByUrl.set(upsertUrl, deduped.length);
      deduped.push(source);
      return;
    }
    const existing = deduped[existingIndex];
    if (existing?.status !== 'verified' && source?.status === 'verified') {
      deduped[existingIndex] = source;
    }
  });
  return deduped;
}

function remainingTime(deadlineAt) {
  return Math.max(0, deadlineAt - Date.now());
}

async function withTimeout(promise, timeoutMs, message) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error(message);
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        timer.unref?.();
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function resolvePublicAddresses(hostname, { lookupImpl, deadlineAt }) {
  const normalizedHostname = normalizeIpLiteral(hostname);
  if (isUnsafeHostname(normalizedHostname)) {
    throw new Error('Tên miền nguồn không an toàn.');
  }

  const literalFamily = isIP(normalizedHostname);
  const rawRecords = literalFamily
    ? [{ address: normalizedHostname, family: literalFamily }]
    : await withTimeout(
      lookupImpl(normalizedHostname, { all: true, verbatim: true }),
      remainingTime(deadlineAt),
      'Phân giải DNS nguồn quá thời gian.'
    );
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    throw new Error('Không phân giải được tên miền nguồn.');
  }

  return rawRecords.map((record) => {
    const address = normalizeIpLiteral(record?.address);
    const family = isIP(address);
    if (!family || isNonPublicIp(address)) {
      throw new Error('Nguồn trỏ tới mạng riêng hoặc địa chỉ không an toàn.');
    }
    return { address, family };
  }).filter((record, index, rows) => (
    rows.findIndex((candidate) => (
      candidate.address === record.address && candidate.family === record.family
    )) === index
  ));
}

function createPinnedLookup(records) {
  return (_hostname, options, callback) => {
    const requestedFamily = typeof options === 'number'
      ? options
      : Number(options?.family || 0);
    const candidates = requestedFamily
      ? records.filter((record) => record.family === requestedFamily)
      : records;
    if (!candidates.length) {
      const error = new Error('Không có địa chỉ IP công khai phù hợp.');
      error.code = 'ENOTFOUND';
      callback(error);
      return;
    }
    if (typeof options === 'object' && options?.all) {
      callback(null, candidates);
      return;
    }
    callback(null, candidates[0].address, candidates[0].family);
  };
}

function isPinnedRemoteAddress(remoteAddress, records) {
  const normalized = normalizeIpLiteral(remoteAddress);
  const family = isIP(normalized);
  if (!family || isNonPublicIp(normalized)) return false;
  const allowed = new BlockList();
  records.forEach((record) => (
    allowed.addAddress(record.address, record.family === 4 ? 'ipv4' : 'ipv6')
  ));
  return allowed.check(normalized, family === 4 ? 'ipv4' : 'ipv6');
}

function nativePinnedRequest(
  url,
  {
    headers,
    lookup: pinnedLookup,
    records,
    timeoutMs
  }
) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = httpsRequest(url, {
      method: 'GET',
      headers,
      agent: false,
      lookup: pinnedLookup
    }, (response) => {
      const remoteAddress = normalizeIpLiteral(response.socket?.remoteAddress);
      const result = {
        status: Number(response.statusCode || 0),
        ok: Number(response.statusCode || 0) >= 200 && Number(response.statusCode || 0) < 300,
        url,
        headers: new Headers(response.headers),
        remoteAddress
      };
      response.destroy();
      if (!isPinnedRemoteAddress(remoteAddress, records)) {
        settled = true;
        reject(new Error('Kết nối nguồn không khớp địa chỉ DNS công khai đã xác minh.'));
        return;
      }
      settled = true;
      resolve(result);
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error('Xác minh nguồn quá thời gian.'));
    });
    request.once('error', (error) => {
      if (!settled) reject(error);
    });
    request.end();
  });
}

function acceptedContentType(value = '') {
  const contentType = String(value).toLowerCase();
  return !contentType
    || contentType.includes('text/html')
    || contentType.includes('text/plain')
    || contentType.includes('application/pdf')
    || contentType.includes('application/xhtml+xml');
}

export async function verifyPublicSourceUrl(
  initialUrl,
  {
    fetchImpl = null,
    lookupImpl = lookup,
    requestImpl = nativePinnedRequest,
    timeoutMs = 3_000,
    deadlineMs = 8_000,
    maxRedirects = 2,
    maxBytes = 5 * 1024 * 1024
  } = {}
) {
  let currentUrl = normalizeGroundedUrl(initialUrl);
  if (!currentUrl) throw new Error('URL nguồn không hợp lệ.');
  const safeDeadlineMs = Math.min(Math.max(Number(deadlineMs) || 0, 250), 15_000);
  const safeRequestTimeoutMs = Math.min(Math.max(Number(timeoutMs) || 0, 250), 5_000);
  const deadlineAt = Date.now() + safeDeadlineMs;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const parsed = new URL(currentUrl);
    const records = await resolvePublicAddresses(parsed.hostname, { lookupImpl, deadlineAt });
    const requestBudget = Math.min(safeRequestTimeoutMs, remainingTime(deadlineAt));
    if (requestBudget <= 0) throw new Error('Xác minh nguồn quá thời gian.');
    const headers = {
      Range: 'bytes=0-4095',
      'User-Agent': 'OMFIT-SEO-SourceVerifier/1.1'
    };
    const requestOptions = {
      headers,
      lookup: createPinnedLookup(records),
      records,
      timeoutMs: requestBudget
    };
    const response = await withTimeout(
      fetchImpl
        ? fetchImpl(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          headers,
          signal: AbortSignal.timeout(requestBudget)
        })
        : requestImpl(currentUrl, requestOptions),
      requestBudget,
      'Xác minh nguồn quá thời gian.'
    );
    if (!fetchImpl && !isPinnedRemoteAddress(response.remoteAddress, records)) {
      throw new Error('Kết nối nguồn không khớp địa chỉ DNS công khai đã xác minh.');
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirectCount === maxRedirects) {
        throw new Error('Nguồn chuyển hướng quá nhiều lần.');
      }
      currentUrl = normalizeGroundedUrl(new URL(location, currentUrl).toString());
      if (!currentUrl) throw new Error('Nguồn chuyển hướng tới URL không an toàn.');
      continue;
    }
    if (!response.ok) throw new Error(`Nguồn trả về HTTP ${response.status}.`);
    if (!acceptedContentType(response.headers.get('content-type'))) {
      throw new Error('Định dạng nguồn không được hỗ trợ.');
    }
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > maxBytes) {
      throw new Error('Nguồn vượt quá giới hạn kích thước.');
    }
    const finalUrl = normalizeGroundedUrl(response.url || currentUrl);
    if (!finalUrl) throw new Error('URL nguồn cuối không hợp lệ.');
    return {
      url: finalUrl,
      domain: new URL(finalUrl).hostname.replace(/^www\./i, ''),
      contentType: response.headers.get('content-type') || '',
      verified: true
    };
  }
  throw new Error('Không thể xác minh nguồn.');
}
