const OMFIT_ORIGIN = 'https://omfit.com.vn';

const DEFAULT_INTERNAL_LINKS = [
  {
    title: 'Khám phá kiến thức Fitness & Wellness từ OMFIT',
    url: 'https://omfit.com.vn/tin-tuc/'
  },
  {
    title: 'Tìm hiểu các dịch vụ tập luyện tại OMFIT',
    url: 'https://omfit.com.vn/service/pilates/'
  },
  {
    title: 'Liên hệ OMFIT để được tư vấn lộ trình phù hợp',
    url: 'https://omfit.com.vn/contact-us/'
  }
];

const SUSPICIOUS_SLUG_PATTERN = /(?:casino|game-bai|loto|doi-thuong|52fun|nfl|seahawks|quarterback|titans|super-bowl|sam-darnold|geno-smith|nba|baseball|\.s?html?$|\.pdf$)/i;
const HEALTH_TOPIC_PATTERN = /(?:sức khỏe|dinh dưỡng|giảm cân|giảm mỡ|tim mạch|huyết áp|đau|chấn thương|trị liệu|phục hồi|y khoa|bệnh|protein|calo|vitamin|pilates|yoga|fitness|wellness|health|nutrition|therapy|rehab)/i;

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function stripHtml(value = '') {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeVietnameseSlug(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, (match) => match === 'Đ' ? 'D' : 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180)
    .replace(/-+$/g, '');
}

export function validateArticleSlug(value = '') {
  const original = String(value || '').trim();
  const normalized = normalizeVietnameseSlug(original);
  const reasons = [];
  if (!normalized) reasons.push('Slug không được để trống.');
  if (/^\d+(?:-\d+)*$/.test(normalized)) reasons.push('Slug không được chỉ chứa số.');
  if (normalized.length < 3) reasons.push('Slug phải có ít nhất 3 ký tự.');
  if (SUSPICIOUS_SLUG_PATTERN.test(normalized)) reasons.push('Slug có mẫu từ khóa không an toàn.');
  return {
    valid: reasons.length === 0,
    normalized,
    changed: normalized !== original.toLowerCase(),
    reasons
  };
}

export function isSafeOmfitLink(value = '') {
  try {
    const url = new URL(String(value), OMFIT_ORIGIN);
    return url.protocol === 'https:'
      && url.hostname.replace(/^www\./i, '') === 'omfit.com.vn'
      && !SUSPICIOUS_SLUG_PATTERN.test(url.pathname);
  } catch {
    return false;
  }
}

function normalizeExternalSourceUrl(value = '') {
  try {
    const url = new URL(String(value));
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || (url.port && url.port !== '443')
    ) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function removeClassBlock(html, tagName, className) {
  const pattern = new RegExp(
    `<${tagName}\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/${tagName}>`,
    'gi'
  );
  return String(html).replace(pattern, '');
}

function removeExistingSupportMarkup(contentHtml) {
  return removeClassBlock(
    removeClassBlock(
      removeClassBlock(contentHtml, 'aside', 'omfit-related-content'),
      'footer',
      'omfit-article-footer'
    ),
    'section',
    'omfit-article-references'
  )
    .replace(/<sup\b[^>]*class=["'][^"']*\bomfit-citation\b[^"']*["'][^>]*>[\s\S]*?<\/sup>/gi, '')
    .trim();
}

function safeCompanyUrl(value, fallback = OMFIT_ORIGIN) {
  return isSafeOmfitLink(value) ? new URL(value, OMFIT_ORIGIN).toString() : fallback;
}

function safeTel(value = '') {
  return String(value).replace(/[^\d+]/g, '').slice(0, 30);
}

function safeEmail(value = '') {
  const normalized = String(value).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}

export function enhanceArticleForPublish({
  contentHtml,
  focusKeyword = '',
  suggestedLinks = [],
  brandProfile = null,
  logoUrl = ''
}) {
  let html = removeClassBlock(
    String(contentHtml || '').trim(),
    'aside',
    'omfit-related-content'
  ).trim();
  const safeSuggestedLinks = [...suggestedLinks, ...DEFAULT_INTERNAL_LINKS]
    .filter((link) => link?.title && isSafeOmfitLink(link?.url))
    .filter((link, index, rows) => rows.findIndex((row) => row.url === link.url) === index)
    .slice(0, 4);

  html += `
<aside class="omfit-related-content" aria-label="Nội dung liên quan">
  <h2>Khám phá thêm cùng OMFIT</h2>
  <p>OMFIT đồng hành cùng bạn xây dựng thói quen vận động phù hợp và hướng đến sức khỏe cân bằng, bền vững.</p>
  <ul>${safeSuggestedLinks.map((link) => `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.title)}</a></li>`).join('')}</ul>
</aside>`;

  html = removeClassBlock(html, 'footer', 'omfit-article-footer').trim();
  const footer = brandProfile?.footer_settings || brandProfile?.footerSettings || {};
  if (footer.enabled !== false) {
    const company = brandProfile?.company_info || brandProfile?.companyInfo || {};
    const branches = Array.isArray(brandProfile?.branches) ? brandProfile.branches : [];
    const displayName = company.displayName || brandProfile?.name || 'OMFIT';
    const heading = footer.heading || 'Đồng hành cùng OMFIT';
    const description = footer.description
      || brandProfile?.mission
      || 'Kết nối với OMFIT để được tư vấn lộ trình tập luyện phù hợp.';
    const ctaUrl = safeCompanyUrl(footer.ctaUrl || 'https://omfit.com.vn/contact-us/');
    const ctaLabel = footer.ctaLabel || 'Đăng ký tư vấn';
    const hotline = safeTel(company.hotline);
    const email = safeEmail(company.email);
    const website = safeCompanyUrl(company.website || OMFIT_ORIGIN);
    const contacts = [
      hotline ? `<a href="tel:${escapeHtml(hotline)}">${escapeHtml(company.hotline)}</a>` : '',
      email ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : '',
      website ? `<a href="${escapeHtml(website)}">${escapeHtml(website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>` : ''
    ].filter(Boolean);
    const branchHtml = branches
      .filter((branch) => branch?.name || branch?.address)
      .slice(0, 4)
      .map((branch) => {
        const phone = safeTel(branch.phone);
        return `<li>
  <span class="omfit-footer-branch-name">${escapeHtml(branch.name || 'Chi nhánh OMFIT')}</span>
  ${branch.address ? `<span>${escapeHtml(branch.address)}</span>` : ''}
  ${phone ? `<a href="tel:${escapeHtml(phone)}">${escapeHtml(branch.phone)}</a>` : ''}
</li>`;
      })
      .join('');
    const safeLogoUrl = normalizeExternalSourceUrl(logoUrl);
    html += `
<footer class="omfit-article-footer omfit-article-cta" aria-label="Thông tin OMFIT">
  <div class="omfit-footer-brand">
    ${safeLogoUrl ? `<img class="omfit-footer-logo" src="${escapeHtml(safeLogoUrl)}" alt="Logo ${escapeHtml(displayName)}" loading="lazy" decoding="async" width="96" height="64" />` : ''}
    <div>
      <h2>${escapeHtml(heading)}</h2>
      <p>${escapeHtml(description)}</p>
      ${company.tagline ? `<p class="omfit-footer-tagline">${escapeHtml(company.tagline)}</p>` : ''}
    </div>
  </div>
  ${contacts.length ? `<p class="omfit-footer-contact">${contacts.join(' · ')}</p>` : ''}
  ${branchHtml ? `<ul class="omfit-footer-branches">${branchHtml}</ul>` : ''}
  <p class="omfit-footer-action"><a class="omfit-footer-cta" href="${escapeHtml(ctaUrl)}">${escapeHtml(ctaLabel)}</a></p>
</footer>`;
  }

  return html.trim();
}

function tokenize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && ![
      'cua', 'cho', 'voi', 'trong', 'nhung', 'duoc', 'tai', 'theo', 'mot', 'cac',
      'this', 'that', 'with', 'from', 'into', 'your', 'about'
    ].includes(token));
}

function sourceParagraphScore(source, paragraph) {
  const sourceTokens = new Set(tokenize(source.claimText || source.title));
  const paragraphTokens = new Set(tokenize(stripHtml(paragraph)));
  if (!sourceTokens.size || !paragraphTokens.size) return 0;
  return [...sourceTokens].filter((token) => paragraphTokens.has(token)).length;
}

function approvedSourceRows(sources = []) {
  return sources
    .filter((source) => source?.approved && source?.status !== 'broken')
    .map((source) => ({
      ...source,
      url: normalizeExternalSourceUrl(source.url),
      canonicalUrl: normalizeExternalSourceUrl(source.canonicalUrl || source.url)
    }))
    .filter((source) => source.url)
    .filter((source, index, rows) => rows.findIndex((row) => (
      (row.canonicalUrl || row.url) === (source.canonicalUrl || source.url)
    )) === index)
    .slice(0, 12);
}

export function applyApprovedSourcesToHtml(contentHtml, sources = []) {
  const approved = approvedSourceRows(sources);
  let html = String(contentHtml || '')
    .replace(/<sup\b[^>]*class=["'][^"']*\bomfit-citation\b[^"']*["'][^>]*>[\s\S]*?<\/sup>/gi, '');
  html = removeClassBlock(html, 'section', 'omfit-article-references').trim();
  if (!approved.length) return html;

  const paragraphs = [...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)]
    .map((match) => match[0])
    .filter((paragraph) => !/\bomfit-footer-/i.test(paragraph));
  const citationsByParagraph = new Map();

  approved.forEach((source, index) => {
    let bestParagraph = '';
    let bestScore = 0;
    paragraphs.forEach((paragraph) => {
      const score = sourceParagraphScore(source, paragraph);
      if (score > bestScore) {
        bestParagraph = paragraph;
        bestScore = score;
      }
    });
    if (bestParagraph && bestScore >= 3) {
      const entries = citationsByParagraph.get(bestParagraph) || [];
      if (entries.length < 2) {
        entries.push(index + 1);
        citationsByParagraph.set(bestParagraph, entries);
      }
    }
  });

  citationsByParagraph.forEach((citationNumbers, paragraph) => {
    const citations = citationNumbers
      .map((number) => `<sup class="omfit-citation"><a href="#omfit-source-${number}" aria-label="Nguồn tham khảo ${number}">[${number}]</a></sup>`)
      .join('');
    const citedParagraph = paragraph.replace(/<\/p>$/i, `${citations}</p>`);
    html = html.replace(paragraph, citedParagraph);
  });

  const references = `
<section class="omfit-article-references" aria-label="Nguồn tham khảo">
  <h2>Nguồn tham khảo</h2>
  <ol>${approved.map((source, index) => {
    const publisher = source.publisher || source.domain || new URL(source.url).hostname;
    const accessedAt = source.accessedAt || source.accessed_at;
    const accessedLabel = accessedAt
      ? ` Truy cập ngày ${new Intl.DateTimeFormat('vi-VN').format(new Date(accessedAt))}.`
      : '';
    return `<li id="omfit-source-${index + 1}"><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title || publisher)}</a><span> — ${escapeHtml(publisher)}.${escapeHtml(accessedLabel)}</span></li>`;
  }).join('')}</ol>
</section>`;
  const footerMatch = html.match(/<footer\b[^>]*class=["'][^"']*\bomfit-article-footer\b[^"']*["'][^>]*>/i);
  if (footerMatch?.index != null) {
    return `${html.slice(0, footerMatch.index).trim()}\n${references}\n${html.slice(footerMatch.index).trim()}`;
  }
  return `${html}\n${references}`.trim();
}

function readAttribute(tag, attribute) {
  const match = String(tag).match(new RegExp(`\\s${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

function normalizeImageSource(value = '') {
  try {
    const url = new URL(String(value).trim());
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || (url.port && url.port !== '443')
    ) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function removeUnapprovedArticleImages(contentHtml, approvedImageUrls = []) {
  const approved = new Set(
    approvedImageUrls
      .map(normalizeImageSource)
      .filter(Boolean)
  );
  let removedCount = 0;
  let html = String(contentHtml || '');

  html = html.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, (figure) => {
    const imageTags = figure.match(/<img\b[^>]*>/gi) || [];
    const hasUnapprovedImage = imageTags.some((tag) => (
      !approved.has(normalizeImageSource(readAttribute(tag, 'src')))
    ));
    if (!hasUnapprovedImage) return figure;
    removedCount += imageTags.length;
    return '';
  });

  html = html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (approved.has(normalizeImageSource(readAttribute(tag, 'src')))) return tag;
    removedCount += 1;
    return '';
  });

  return {
    contentHtml: html.trim(),
    removedCount
  };
}

function contentBodyForAudit(contentHtml) {
  return removeExistingSupportMarkup(contentHtml);
}

function countWords(value = '') {
  return (stripHtml(value).match(/[\p{L}\p{N}]+/gu) || []).length;
}

export function auditArticleForPublish(
  article,
  {
    status = 'publish',
    approvedSources = [],
    editorialSettings = {},
    approvedImageUrls,
    rejectedImageCount = 0
  } = {}
) {
  const contentHtml = String(article?.contentHtml || '');
  const rawArticleBody = contentBodyForAudit(contentHtml);
  const filteredImages = Array.isArray(approvedImageUrls)
    ? removeUnapprovedArticleImages(rawArticleBody, approvedImageUrls)
    : { contentHtml: rawArticleBody, removedCount: 0 };
  const articleBody = filteredImages.contentHtml;
  const unapprovedImageCount = Math.max(
    filteredImages.removedCount,
    Number(rejectedImageCount || 0)
  );
  const issues = [];
  let score = 100;
  const add = (code, level, message, penalty = 0) => {
    issues.push({ code, level, message });
    score -= penalty;
  };

  const slug = validateArticleSlug(article?.slug);
  if (!slug.valid) add('slug', 'error', slug.reasons.join(' '), 15);
  else if (slug.changed) add('slug_normalized', 'warning', `Slug sẽ được chuẩn hóa thành “${slug.normalized}”.`, 2);

  const h1Count = (contentHtml.match(/<h1\b/gi) || []).length;
  const h2Count = (articleBody.match(/<h2\b/gi) || []).length;
  const h3Count = (articleBody.match(/<h3\b/gi) || []).length;
  if (h1Count !== 1) add('content_h1', 'error', 'Bài xuất bản phải có đúng một H1.', 15);
  if (h2Count < 2) add('heading_structure', 'error', 'Bài viết cần ít nhất hai H2.', 10);

  // WordPress and the SEO bridge expose the actual post title as the document
  // title. A separate metaTitle stored only in Supabase must never make this
  // gate pass when the title users and crawlers will receive is invalid.
  const publishedTitle = String(article?.title || '').trim();
  const metaDescription = String(article?.metaDescription || '').trim();
  if (!publishedTitle) add('post_title_missing', 'error', 'Thiếu tiêu đề bài viết sẽ xuất bản.', 12);
  else if (publishedTitle.length < 45 || publishedTitle.length > 60) {
    add('post_title_length', 'error', 'Tiêu đề bài viết phải nằm trong khoảng 45–60 ký tự trước khi xuất bản.', 12);
  }
  if (!metaDescription) add('meta_description_missing', 'error', 'Thiếu meta description.', 12);
  else if (metaDescription.length < 140 || metaDescription.length > 160) {
    add('meta_description_length', 'warning', 'Meta description nên nằm trong khoảng ưu tiên 140–160 ký tự.', 5);
  }
  if (metaDescription && !/[.!?]\s*$/.test(metaDescription)) {
    add('meta_description_ending', 'warning', 'Meta description cần kết thúc bằng câu trọn ý.', 3);
  }

  const wordCount = countWords(articleBody);
  if (wordCount < 500) add('thin_content', 'warning', 'Nội dung còn mỏng; cần trả lời search intent đầy đủ hơn.', 8);

  const links = [...contentHtml.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1]);
  const internalLinks = [...new Set(links.filter(isSafeOmfitLink))];
  if (internalLinks.length < 2) add('internal_links', 'error', 'Bài viết cần ít nhất hai internal link OMFIT an toàn.', 12);

  const inlineImageTags = articleBody.match(/<img\b[^>]*>/gi) || [];
  const imageCount = inlineImageTags.length;
  if (unapprovedImageCount > 0) {
    add(
      'unapproved_images',
      'error',
      `Đã loại ${unapprovedImageCount} ảnh không thuộc kho OMFIT hoặc chưa được cấp quyền.`,
      12
    );
  }
  if (wordCount >= 800 && imageCount < 2) {
    add('inline_images', 'error', 'Bài từ 800 từ cần ít nhất hai ảnh minh họa trong nội dung.', 10);
  }
  const missingAlt = inlineImageTags.filter((tag) => !readAttribute(tag, 'alt').trim()).length;
  const missingDimensions = inlineImageTags.filter((tag) => (
    !/^[1-9]\d*$/.test(readAttribute(tag, 'width'))
    || !/^[1-9]\d*$/.test(readAttribute(tag, 'height'))
  )).length;
  if (missingAlt) add('image_alt', 'error', `Có ${missingAlt} ảnh nội dung thiếu alt text.`, 8);
  if (missingDimensions) add('image_dimensions', 'error', `Có ${missingDimensions} ảnh thiếu width hoặc height.`, 7);

  const figures = articleBody.match(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi) || [];
  const missingCaptions = figures.filter((figure) => (
    /<img\b/i.test(figure) && !/<figcaption\b[^>]*>[\s\S]*?\S[\s\S]*?<\/figcaption>/i.test(figure)
  )).length;
  if (missingCaptions) add('image_captions', 'warning', `Có ${missingCaptions} ảnh nội dung thiếu chú thích.`, 4);

  if (status === 'publish' && !article?.featuredImage) {
    add('featured_image', 'error', 'Cần chọn featured image trước khi xuất bản.', 12);
  } else if (article?.featuredImage && !String(article.featuredImage.altText || '').trim()) {
    add('featured_image_alt', 'error', 'Featured image thiếu alt text.', 7);
  }

  if (!/\bomfit-article-cta\b/i.test(contentHtml)) {
    add('cta', 'error', 'Bài viết thiếu CTA/footer OMFIT.', 8);
  }

  const approved = approvedSourceRows(approvedSources);
  const topicText = `${article?.title || ''} ${article?.focusKeyword || ''} ${stripHtml(articleBody).slice(0, 1500)}`;
  const healthTopic = HEALTH_TOPIC_PATTERN.test(topicText);
  if (!String(editorialSettings?.authorName || '').trim()) {
    add('author_identity', 'warning', 'Chưa cấu hình tác giả chịu trách nhiệm nội dung trong Brand Settings.', 3);
  }
  if (healthTopic && approved.length === 0) {
    add('health_sources', 'warning', 'Nội dung sức khỏe chưa có nguồn tham khảo đã duyệt.', 8);
  }
  if (healthTopic && !String(editorialSettings?.reviewerName || '').trim()) {
    add('health_reviewer', 'warning', 'Nội dung sức khỏe chưa có người kiểm duyệt chuyên môn.', 5);
  } else if (
    healthTopic
    && !String(editorialSettings?.reviewerCredentials || '').trim()
  ) {
    add(
      'health_reviewer_credentials',
      'warning',
      'Người kiểm duyệt chưa có thông tin chuyên môn hoặc chứng chỉ.',
      3
    );
  }

  score = Math.max(0, Math.min(100, score));
  const hasErrors = issues.some((issue) => issue.level === 'error');
  return {
    score,
    readabilityScore: Math.max(
      0,
      Math.min(100, Number(article?.readabilityScore || 0))
    ),
    passed: score >= 80 && !hasErrors,
    blocking: status === 'publish' && (score < 80 || hasErrors),
    issues,
    normalizedSlug: slug.normalized,
    metrics: {
      wordCount,
      h1Count,
      h2Count,
      h3Count,
      internalLinkCount: internalLinks.length,
      inlineImageCount: imageCount,
      imagesMissingAlt: missingAlt,
      imagesMissingDimensions: missingDimensions,
      imagesMissingCaptions: missingCaptions,
      unapprovedImageCount,
      approvedSourceCount: approved.length,
      healthTopic
    }
  };
}

export function isHealthTopic(article) {
  return HEALTH_TOPIC_PATTERN.test(
    `${article?.title || ''} ${article?.focusKeyword || ''} ${stripHtml(article?.contentHtml || '').slice(0, 1500)}`
  );
}
