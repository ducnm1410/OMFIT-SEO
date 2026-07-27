import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VERCEL = '1';
const {
  buildWordpressEditorialMeta,
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
