import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGroundedGenerateRequest,
  dedupeSourcesByUpsertUrl,
  extractGroundedSources,
  isAbortOrTimeoutError,
  isUnsafeHostname,
  normalizeGroundedUrl,
  verifyPublicSourceUrl
} from '../server/grounding.mjs';

test('request Gemini REST dùng đúng Google Search Grounding tool', () => {
  const request = buildGroundedGenerateRequest('Nghiên cứu Pilates');
  assert.deepEqual(request.tools, [{ google_search: {} }]);
  assert.equal(request.contents[0].parts[0].text, 'Nghiên cứu Pilates');
  assert.equal(request.generationConfig.maxOutputTokens, 2048);
});

test('nhận diện lỗi abort và timeout của các Node runtime', () => {
  assert.equal(isAbortOrTimeoutError({ name: 'TimeoutError' }), true);
  assert.equal(isAbortOrTimeoutError({ name: 'AbortError' }), true);
  assert.equal(
    isAbortOrTimeoutError({ message: 'The operation was aborted due to timeout' }),
    true
  );
  assert.equal(isAbortOrTimeoutError(new Error('HTTP 500')), false);
});

test('chỉ lấy URL từ groundingChunks và bỏ URL model tự viết', () => {
  const sources = extractGroundedSources({
    candidates: [{
      content: { parts: [{ text: 'Xem https://fake.example/test' }] },
      groundingMetadata: {
        webSearchQueries: ['khuyến nghị vận động WHO'],
        groundingChunks: [
          { web: { uri: 'https://www.who.int/health-topics/physical-activity', title: 'WHO' } }
        ],
        groundingSupports: [
          {
            segment: { text: 'Vận động đều đặn có lợi cho sức khỏe.' },
            groundingChunkIndices: [0, 99]
          }
        ]
      }
    }]
  }, { accessedAt: '2026-07-27T00:00:00.000Z' });
  assert.equal(sources.length, 1);
  assert.equal(sources[0].domain, 'who.int');
  assert.match(sources[0].claimText, /Vận động đều đặn/);
  assert.doesNotMatch(JSON.stringify(sources), /fake\.example/);
});

test('lọc URL trùng và URL không an toàn', () => {
  const payload = {
    candidates: [{
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: 'https://example.com/a', title: 'A' } },
          { web: { uri: 'https://example.com/a#fragment', title: 'A duplicate' } },
          { web: { uri: 'https://127.0.0.1/secret', title: 'Private' } }
        ]
      }
    }]
  };
  assert.equal(extractGroundedSources(payload).length, 1);
  assert.equal(normalizeGroundedUrl('https://example.com:8443/a'), '');
  assert.equal(isUnsafeHostname('169.254.169.254'), true);
  assert.equal(isUnsafeHostname('2001:db8::1'), true);
});

test('chặn đầy đủ IPv4-mapped IPv6 và các dải đặc biệt có thể che IP nội bộ', () => {
  [
    '[::ffff:7f00:1]',
    '::ffff:10.0.0.1',
    '::ffff:ac10:1',
    '::ffff:c0a8:1',
    '::ffff:0:127.0.0.1',
    '64:ff9b::7f00:1',
    '2002:7f00:1::',
    'fc00::1',
    'fe80::1',
    'ff02::1'
  ].forEach((hostname) => assert.equal(isUnsafeHostname(hostname), true, hostname));
  assert.equal(isUnsafeHostname('2606:4700:4700::1111'), false);
  assert.equal(normalizeGroundedUrl('https://[::ffff:127.0.0.1]/admin'), '');
});

test('chặn redirect từ nguồn công khai sang mạng nội bộ', async () => {
  const fetchImpl = async () => ({
    status: 302,
    ok: false,
    url: 'https://8.8.8.8/start',
    headers: new Headers({ location: 'https://127.0.0.1/admin' })
  });
  await assert.rejects(
    verifyPublicSourceUrl('https://8.8.8.8/start', { fetchImpl }),
    /không an toàn/
  );
});

test('từ chối hostname nếu bất kỳ kết quả DNS nào là IP riêng', async () => {
  let requestCalled = false;
  await assert.rejects(
    verifyPublicSourceUrl('https://source.example.org/article', {
      lookupImpl: async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 }
      ],
      requestImpl: async () => {
        requestCalled = true;
        throw new Error('không được gọi');
      }
    }),
    /mạng riêng|không an toàn/
  );
  assert.equal(requestCalled, false);
});

test('pin kết nối vào đúng IP công khai đã xác minh để chống DNS rebinding', async () => {
  let pinnedAddress = '';
  const result = await verifyPublicSourceUrl('https://source.example.org/article', {
    lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
    requestImpl: async (url, options) => {
      await new Promise((resolve, reject) => {
        options.lookup('source.example.org', {}, (error, address) => {
          if (error) reject(error);
          else {
            pinnedAddress = address;
            resolve();
          }
        });
      });
      return {
        status: 200,
        ok: true,
        url,
        headers: new Headers({ 'content-type': 'text/html' }),
        remoteAddress: pinnedAddress
      };
    }
  });
  assert.equal(pinnedAddress, '93.184.216.34');
  assert.equal(result.verified, true);
});

test('từ chối kết nối nếu remote address khác IP DNS đã pin', async () => {
  await assert.rejects(
    verifyPublicSourceUrl('https://source.example.org/article', {
      lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
      requestImpl: async (url) => ({
        status: 200,
        ok: true,
        url,
        headers: new Headers({ 'content-type': 'text/html' }),
        remoteAddress: '127.0.0.1'
      })
    }),
    /không khớp địa chỉ DNS/
  );
});

test('mỗi URL chỉ dùng một GET giới hạn thay vì chuỗi HEAD rồi GET', async () => {
  let requestCount = 0;
  await assert.rejects(
    verifyPublicSourceUrl('https://8.8.8.8/article', {
      fetchImpl: async (_url, options) => {
        requestCount += 1;
        assert.equal(options.method, 'GET');
        assert.equal(options.headers.Range, 'bytes=0-4095');
        return {
          status: 403,
          ok: false,
          url: 'https://8.8.8.8/article',
          headers: new Headers()
        };
      }
    }),
    /HTTP 403/
  );
  assert.equal(requestCount, 1);
});

test('deadline tổng kết thúc cả khi transport không phản hồi', async () => {
  const startedAt = Date.now();
  await assert.rejects(
    verifyPublicSourceUrl('https://8.8.8.8/article', {
      fetchImpl: async () => new Promise(() => {}),
      timeoutMs: 250,
      deadlineMs: 250
    }),
    /quá thời gian/
  );
  assert.ok(Date.now() - startedAt < 1_000);
});

test('khử trùng nguồn sau khi nhiều proxy redirect về cùng URL đích', () => {
  const sources = dedupeSourcesByUpsertUrl([
    {
      url: 'https://who.int/news/item',
      canonicalUrl: 'https://who.int/news/item',
      status: 'verified',
      groundingData: { groundingUrl: 'https://vertexaisearch.cloud.google.com/proxy-a' }
    },
    {
      url: 'https://who.int/news/item#duplicate',
      canonicalUrl: 'https://who.int/news/item',
      status: 'verified',
      groundingData: { groundingUrl: 'https://vertexaisearch.cloud.google.com/proxy-b' }
    },
    {
      url: 'https://example.org/unavailable',
      canonicalUrl: 'https://example.org/unavailable',
      status: 'broken'
    }
  ]);

  assert.equal(sources.length, 2);
  assert.equal(sources[0].groundingData.groundingUrl, 'https://vertexaisearch.cloud.google.com/proxy-a');
  assert.equal(sources[1].status, 'broken');
});

test('khử trùng toàn bộ khóa upsert và ưu tiên verified hơn broken', () => {
  const sources = dedupeSourcesByUpsertUrl([
    {
      url: 'https://who.int/news/item',
      canonicalUrl: 'https://who.int/news/item',
      status: 'broken',
      groundingData: { verificationError: 'timeout' }
    },
    {
      url: 'https://who.int/news/item',
      canonicalUrl: 'https://who.int/news/item',
      status: 'verified'
    },
    {
      url: 'https://example.org/other-broken-source',
      canonicalUrl: 'https://example.org/other-broken-source',
      status: 'broken',
      groundingData: { verificationError: 'HTTP 500' }
    }
  ]);

  assert.equal(sources.length, 2);
  assert.equal(sources[0].status, 'verified');
  assert.equal(sources[0].canonicalUrl, 'https://who.int/news/item');
  assert.equal(sources[1].groundingData.verificationError, 'HTTP 500');
});
