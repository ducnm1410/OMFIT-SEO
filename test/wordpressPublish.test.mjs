import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VERCEL = '1';
const {
  buildWordpressEditorialMeta,
  buildWordpressMediaSyncPlan,
  contentReferencesImage,
  replaceWordpressImageMarkup,
  sendWordpressPost
} = await import('../server/index.mjs');

const permissionDenied = () => ({
  ok: false,
  status: 403,
  text: async () => JSON.stringify({
    code: 'rest_cannot_update',
    message: 'Not allowed to update omfit_publisher_logo_url meta.'
  })
});

test('reviewer chưa xác nhận luôn được gửi false và xóa metadata reviewer cũ', () => {
  const meta = buildWordpressEditorialMeta({
    editorial_settings: {
      authorName: 'OMFIT Editorial',
      reviewerName: 'Reviewer cũ',
      reviewerUrl: 'https://omfit.com.vn/reviewer-cu/',
      reviewerCredentials: 'Chứng chỉ cũ'
    },
    branches: []
  }, '', { includeReviewer: false });

  assert.equal(meta.omfit_reviewer_confirmed, false);
  assert.equal(meta.omfit_reviewer_name, '');
  assert.equal(meta.omfit_reviewer_url, '');
  assert.equal(meta.omfit_reviewer_credentials, '');
});

test('retry bỏ brand meta vẫn giữ nguyên metadata biên tập và dùng deadline chung', async () => {
  const calls = [];
  let clock = 0;
  const response = await sendWordpressPost(
    { authHeader: 'Basic test' },
    'https://omfit.com.vn/wp-json/wp/v2/posts',
    {
      title: 'Bài test',
      meta: {
        omfit_author_name: 'OMFIT Editorial',
        omfit_reviewer_confirmed: false,
        omfit_reviewer_name: '',
        omfit_reviewer_url: '',
        omfit_reviewer_credentials: '',
        omfit_publisher_logo_url: 'https://cdn.example.com/logo.png',
        omfit_branches_json: '[]'
      }
    },
    [],
    {
      deadlineMs: 45_000,
      now: () => clock,
      signalFactory: (timeoutMs) => ({ timeoutMs }),
      fetchImpl: async (_url, options) => {
        calls.push({
          payload: JSON.parse(options.body),
          timeoutMs: options.signal.timeoutMs
        });
        if (calls.length === 1) {
          clock = 1_000;
          return permissionDenied();
        }
        return { ok: true, status: 200 };
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].timeoutMs, 22_500);
  assert.equal(calls[1].timeoutMs, 30_000);
  assert.equal(calls[1].payload.meta.omfit_reviewer_confirmed, false);
  assert.equal(calls[1].payload.meta.omfit_reviewer_name, '');
  assert.equal(calls[1].payload.meta.omfit_author_name, 'OMFIT Editorial');
  assert.ok(!('omfit_publisher_logo_url' in calls[1].payload.meta));
  assert.ok(!('omfit_branches_json' in calls[1].payload.meta));
});

test('cập nhật bài cũ không retry bằng payload thiếu metadata', async () => {
  const calls = [];
  await assert.rejects(
    sendWordpressPost(
      { authHeader: 'Basic test' },
      'https://omfit.com.vn/wp-json/wp/v2/posts/123',
      {
        title: 'Bài cũ',
        meta: {
          omfit_reviewer_confirmed: false,
          omfit_reviewer_name: '',
          omfit_publisher_logo_url: ''
        }
      },
      [],
      {
        allowBrandMetaFallback: false,
        fetchImpl: async (_url, options) => {
          calls.push(JSON.parse(options.body));
          return permissionDenied();
        },
        signalFactory: () => ({})
      }
    ),
    (error) => error?.code === 'wordpress_publish_failed'
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].meta.omfit_reviewer_confirmed, false);
  assert.ok('omfit_reviewer_name' in calls[0].meta);
  assert.ok('omfit_publisher_logo_url' in calls[0].meta);
});

test('deadline tuyệt đối tính cả thời gian xử lý trước final WordPress POST', async () => {
  const timeouts = [];
  const response = await sendWordpressPost(
    { authHeader: 'Basic test' },
    'https://omfit.com.vn/wp-json/wp/v2/posts/123',
    { title: 'Bài đã xử lý media', meta: { omfit_reviewer_confirmed: false } },
    [],
    {
      allowBrandMetaFallback: false,
      deadlineAt: 45_000,
      now: () => 42_000,
      signalFactory: (timeoutMs) => ({ timeoutMs }),
      fetchImpl: async (_url, options) => {
        timeouts.push(options.signal.timeoutMs);
        return { ok: true, status: 200 };
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(timeouts, [3_000]);
});

test('kế hoạch đồng bộ ảnh khử trùng và giới hạn ba ảnh mỗi lượt', () => {
  const ids = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    '55555555-5555-4555-8555-555555555555'
  ];
  const images = ids.map((id) => ({ id }));
  const plan = buildWordpressMediaSyncPlan({
    featuredImage: images[0],
    inlineImages: [images[0], ...images.slice(1)],
    batchSize: 3
  });

  assert.deepEqual(plan.batch.map((image) => image.id), [ids[0], ids[1], ids[2]]);
  assert.equal(plan.nextCursor, 3);
  assert.equal(plan.pendingCount, 5);
  assert.equal(plan.remainingCount, 2);
});

test('kế hoạch đồng bộ tiếp tục theo cursor và vẫn xác minh mapping cũ', () => {
  const images = [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
    { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }
  ];
  const plan = buildWordpressMediaSyncPlan({
    featuredImage: images[0],
    inlineImages: images.slice(1),
    cursor: 3
  });

  assert.deepEqual(plan.batch.map((image) => image.id), [images[3].id]);
  assert.equal(plan.nextCursor, 4);
  assert.equal(plan.pendingCount, 1);
  assert.equal(plan.remainingCount, 0);
});

test('bài đã publish vẫn nhận diện và thay ảnh theo URL WordPress đã lưu', () => {
  const image = {
    url: 'https://cdn.example.com/owned-image.webp',
    wordpressUrl: 'https://omfit.com.vn/wp-content/uploads/2026/07/owned-image-old.webp',
    altText: 'Không gian OMFIT',
    caption: 'Không gian tập luyện tại OMFIT'
  };
  const contentHtml = `<figure><img src="${image.wordpressUrl}" alt="Cũ"></figure>`;
  assert.equal(contentReferencesImage(contentHtml, image), true);

  const replaced = replaceWordpressImageMarkup(contentHtml, image, {
    source_url: 'https://omfit.com.vn/wp-content/uploads/2026/07/owned-image-new.webp',
    media_details: { width: 1200, height: 800, sizes: {} }
  });
  assert.match(replaced, /owned-image-new\.webp/);
  assert.match(replaced, /alt="Không gian OMFIT"/);
  assert.match(replaced, /<figcaption>Không gian tập luyện tại OMFIT<\/figcaption>/);
});
