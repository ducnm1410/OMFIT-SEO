import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyApprovedSourcesToHtml,
  auditArticleForPublish,
  enhanceArticleForPublish,
  isSafeOmfitLink,
  normalizeVietnameseSlug,
  removeUnapprovedArticleImages,
  validateArticleSlug
} from '../server/seoPolicy.mjs';

test('chuẩn hóa slug tiếng Việt và chặn mẫu spam cũ', () => {
  assert.equal(normalizeVietnameseSlug('  Pilates Đúng Cách!  '), 'pilates-dung-cach');
  assert.equal(validateArticleSlug('12345').valid, false);
  assert.equal(validateArticleSlug('game-bai-doi-thuong').valid, false);
  assert.equal(validateArticleSlug('pilates-cho-nguoi-moi').valid, true);
});

test('chỉ xem liên kết OMFIT hợp lệ là internal link', () => {
  assert.equal(isSafeOmfitLink('https://omfit.com.vn/tin-tuc/'), true);
  assert.equal(isSafeOmfitLink('https://www.omfit.com.vn/contact-us/'), true);
  assert.equal(isSafeOmfitLink('https://omfit.com.vn/company/loto-choi-nhieu-nhat.shtml'), false);
  assert.equal(isSafeOmfitLink('https://example.com/omfit'), false);
});

test('tự dựng internal links và footer từ dữ liệu brand an toàn', () => {
  const html = enhanceArticleForPublish({
    contentHtml: '<h2>Mục một</h2><p>Nội dung hữu ích.</p><h2>Mục hai</h2><p>Nội dung tiếp theo.</p>',
    brandProfile: {
      name: 'OMFIT',
      company_info: { website: 'https://omfit.com.vn', hotline: '1900 272779' },
      branches: [{ name: 'OMFIT Quận 1', address: 'TP.HCM' }],
      footer_settings: { enabled: true }
    }
  });
  assert.match(html, /omfit-related-content/);
  assert.match(html, /omfit-article-footer/);
  assert.doesNotMatch(html, /game-bai|loto/i);
});

test('chỉ chèn citation cho nguồn đã duyệt và tạo danh mục tham khảo', () => {
  const html = applyApprovedSourcesToHtml(
    '<h2>Lợi ích vận động</h2><p>Vận động thể chất đều đặn hỗ trợ sức khỏe tim mạch và thể lực.</p>',
    [
      {
        id: 's1',
        title: 'Physical activity',
        url: 'https://www.who.int/news-room/fact-sheets/detail/physical-activity',
        canonicalUrl: 'https://www.who.int/news-room/fact-sheets/detail/physical-activity',
        publisher: 'WHO',
        claimText: 'Vận động thể chất đều đặn hỗ trợ sức khỏe tim mạch và thể lực',
        approved: true,
        status: 'approved',
        accessedAt: '2026-07-27T00:00:00.000Z'
      },
      {
        id: 's2',
        title: 'Không duyệt',
        url: 'https://example.com/unapproved',
        claimText: 'Vận động thể chất',
        approved: false,
        status: 'verified'
      }
    ]
  );
  assert.match(html, /omfit-citation/);
  assert.match(html, /Nguồn tham khảo/);
  assert.match(html, /who\.int/);
  assert.doesNotMatch(html, /unapproved/);
});

test('SEO gate chặn publish khi thiếu yêu cầu bắt buộc', () => {
  const audit = auditArticleForPublish(
    {
      title: 'Pilates cho người mới',
      slug: 'pilates-cho-nguoi-moi',
      metaTitle: 'Pilates cho người mới tại OMFIT',
      metaDescription: 'Mô tả ngắn.',
      focusKeyword: 'pilates cho người mới',
      contentHtml: '<article><h1>Pilates cho người mới</h1><h2>Bắt đầu</h2><p>Nội dung ngắn.</p></article>'
    },
    { status: 'publish', approvedSources: [], editorialSettings: {} }
  );
  assert.equal(audit.blocking, true);
  assert.ok(audit.issues.some((issue) => issue.code === 'heading_structure'));
  assert.ok(audit.issues.some((issue) => issue.code === 'featured_image'));
});

test('SEO gate đánh giá tiêu đề WordPress thực tế thay vì metaTitle chỉ lưu nội bộ', () => {
  const audit = auditArticleForPublish(
    {
      title: 'X',
      metaTitle: 'Pilates an toàn cho người mới bắt đầu tại OMFIT',
      slug: 'pilates-an-toan-cho-nguoi-moi',
      metaDescription: 'Tìm hiểu cách bắt đầu Pilates an toàn, chọn bài tập phù hợp và xây dựng thói quen vận động bền vững cùng đội ngũ OMFIT ngay hôm nay.',
      contentHtml: '<article><h1>X</h1><h2>Mục một</h2><p>Nội dung.</p><h2>Mục hai</h2><p>Nội dung.</p></article>'
    },
    { status: 'draft' }
  );
  assert.ok(audit.issues.some((issue) => issue.code === 'post_title_length'));
  assert.equal(audit.passed, false);
});

test('loại ảnh ngoài kho OMFIT trước khi audit hoặc publish', () => {
  const approvedUrl = 'https://project.supabase.co/storage/v1/object/public/omfit-public-assets/ok.webp';
  const filtered = removeUnapprovedArticleImages(
    [
      `<figure><img src="${approvedUrl}" alt="Ảnh hợp lệ" width="1200" height="800"><figcaption>Hợp lệ</figcaption></figure>`,
      '<figure><img src="https://tracker.example/pixel.jpg" alt="Theo dõi" width="1" height="1"><figcaption>Không hợp lệ</figcaption></figure>',
      '<img src="https://tracker.example/second.jpg" alt="Ngoài kho" width="1200" height="800">'
    ].join(''),
    [approvedUrl]
  );
  assert.equal(filtered.removedCount, 2);
  assert.match(filtered.contentHtml, /project\.supabase\.co/);
  assert.doesNotMatch(filtered.contentHtml, /tracker\.example/);
});
