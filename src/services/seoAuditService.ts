import type { BrandProfile, GeneratedArticle, SeoAuditResult, SeoIssue } from '../types';

const OMFIT_LINKS = [
  { title: 'Tìm hiểu lớp Pilates tại OMFIT', url: 'https://omfit.com.vn/service/pilates/', terms: ['pilates', 'reformer'] },
  { title: 'Khám phá các bài viết sức khỏe từ OMFIT', url: 'https://omfit.com.vn/tin-tuc/', terms: ['sức khỏe', 'wellness', 'fitness', 'dinh dưỡng'] },
  { title: 'Liên hệ OMFIT để được tư vấn lộ trình phù hợp', url: 'https://omfit.com.vn/contact-us/', terms: [] }
];

function normalize(value: string) {
  return value.toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
}

function tokenize(value: string) {
  return normalize(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean);
}

const SEO_STOP_WORDS = new Set([
  'ai', 'bạn', 'bài', 'bị', 'các', 'cho', 'có', 'của', 'đã', 'đang', 'để', 'đến',
  'được', 'giúp', 'hay', 'khi', 'là', 'một', 'những', 'ở', 'sẽ', 'tại', 'theo',
  'thì', 'trong', 'từ', 'và', 'về', 'với', 'omfit'
]);

const SEARCH_INTENT_PHRASES = [
  'bao nhiêu', 'cao cấp', 'đánh giá', 'gần đây', 'giá rẻ', 'giá trị', 'hướng dẫn',
  'khuyến mãi', 'là gì', 'miễn phí', 'phù hợp', 'review', 'so sánh', 'tốt nhất', 'uy tín'
];

function keywordCoverage(value: string, keyword: string) {
  const valueTokens = new Set(tokenize(value));
  const keywordTokens = [...new Set(tokenize(keyword).filter((token) => !SEO_STOP_WORDS.has(token)))];
  if (!keywordTokens.length) return 1;
  return keywordTokens.filter((token) => valueTokens.has(token)).length / keywordTokens.length;
}

function extractIntentPhrases(value: string) {
  const normalizedValue = ` ${tokenize(value).join(' ')} `;
  return SEARCH_INTENT_PHRASES.filter((phrase) => normalizedValue.includes(` ${phrase} `));
}

function findCopyTypoSignals(value: string) {
  const tokens = tokenize(value);
  const signals = new Set<string>();

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const current = tokens[index];
    const next = tokens[index + 1];
    if (current === next) {
      signals.add(`${current} ${next}`);
      continue;
    }

    const isShortFragment = current.length === 1
      && next.length >= current.length + 2
      && next.startsWith(current)
      && /\p{L}/u.test(current);
    if (isShortFragment) signals.add(`${current} ${next}`);
  }

  return [...signals];
}

function countDuplicateValues(values: string[]) {
  const counts = new Map<string, number>();
  values
    .map((value) => normalize(value))
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.values()].filter((count) => count > 1).length;
}

function parseHtml(contentHtml: string) {
  return new DOMParser().parseFromString(`<main>${contentHtml}</main>`, 'text/html');
}

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const suspiciousInternalLinkPattern = /(?:nfl|seahawks|quarterback|titans|super-bowl|sam-darnold|geno-smith|nba|baseball|\/\d+-\d+\/?$)/i;

function isSafeInternalLink(urlValue: string) {
  try {
    const url = new URL(urlValue, 'https://omfit.com.vn');
    return url.hostname.replace(/^www\./i, '') === 'omfit.com.vn'
      && !suspiciousInternalLinkPattern.test(url.pathname);
  } catch {
    return false;
  }
}

export function enhanceArticleSeoHtml(
  contentHtml: string,
  focusKeyword: string,
  suggestedLinks?: { title: string; url: string }[],
  brandProfile?: BrandProfile | null,
  logoUrl?: string
) {
  if (!contentHtml.trim()) return contentHtml;
  const document = parseHtml(contentHtml);
  const main = document.querySelector('main');
  if (!main) return contentHtml;

  main.querySelectorAll('h1').forEach((heading) => {
    const replacement = document.createElement('h2');
    replacement.innerHTML = heading.innerHTML;
    heading.replaceWith(replacement);
  });

  if (!main.querySelector('.omfit-related-content')) {
    const keyword = normalize(focusKeyword);
    const contextual = OMFIT_LINKS
      .filter((link) => link.terms.length === 0 || link.terms.some((term) => keyword.includes(term)))
      .slice(0, 3);
    const safeSuggestedLinks = (suggestedLinks || [])
      .filter((link) => isSafeInternalLink(link.url))
      .filter((link, index, rows) => rows.findIndex((row) => row.url === link.url) === index);
    const selected = safeSuggestedLinks.length >= 2
      ? safeSuggestedLinks.slice(0, 4)
      : contextual.length >= 2
        ? contextual
        : OMFIT_LINKS.slice(0, 3);
    main.insertAdjacentHTML(
      'beforeend',
      `<aside class="omfit-related-content" aria-label="Nội dung liên quan">
        <h2>Khám phá thêm cùng OMFIT</h2>
        <p>OMFIT đồng hành cùng bạn xây dựng thói quen vận động phù hợp và hướng đến sức khỏe cân bằng, bền vững.</p>
        <ul>${selected.map((link) => `<li><a href="${link.url}">${link.title}</a></li>`).join('')}</ul>
      </aside>`
    );
  }

  main.querySelector('.omfit-article-footer')?.remove();
  const footer = brandProfile?.footerSettings;
  if (!brandProfile || footer?.enabled !== false) {
    const company = brandProfile?.companyInfo;
    const branches = brandProfile?.branches || [];
    const heading = footer?.heading || 'Đồng hành cùng OMFIT';
    const description = footer?.description
      || brandProfile?.mission
      || 'Kết nối với OMFIT để được tư vấn lộ trình tập luyện phù hợp.';
    const ctaUrl = footer?.ctaUrl || 'https://omfit.com.vn/contact-us/';
    const ctaLabel = footer?.ctaLabel || 'Đăng ký tư vấn';
    const contactItems = [
      company?.hotline ? `<a href="tel:${escapeHtml(company.hotline.replace(/\s+/g, ''))}">${escapeHtml(company.hotline)}</a>` : '',
      company?.email ? `<a href="mailto:${escapeHtml(company.email)}">${escapeHtml(company.email)}</a>` : '',
      company?.website ? `<a href="${escapeHtml(company.website)}">${escapeHtml(company.website.replace(/^https?:\/\//, ''))}</a>` : ''
    ].filter(Boolean);
    const branchHtml = branches
      .filter((branch) => branch.name || branch.address)
      .slice(0, 4)
      .map((branch) => `<li>
        <span class="omfit-footer-branch-name">${escapeHtml(branch.name || 'Chi nhánh OMFIT')}</span>
        ${branch.address ? `<span>${escapeHtml(branch.address)}</span>` : ''}
        ${branch.phone ? `<a href="tel:${escapeHtml(branch.phone.replace(/\s+/g, ''))}">${escapeHtml(branch.phone)}</a>` : ''}
      </li>`)
      .join('');
    main.insertAdjacentHTML(
      'beforeend',
      `<footer class="omfit-article-footer omfit-article-cta" aria-label="Thông tin OMFIT">
        <div class="omfit-footer-brand">
          ${logoUrl ? `<img class="omfit-footer-logo" src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(company?.displayName || brandProfile?.name || 'OMFIT')}" loading="lazy" decoding="async" width="96" height="64" />` : ''}
          <div>
            <h2>${escapeHtml(heading)}</h2>
            <p>${escapeHtml(description)}</p>
            ${company?.tagline ? `<p class="omfit-footer-tagline">${escapeHtml(company.tagline)}</p>` : ''}
          </div>
        </div>
        ${contactItems.length ? `<p class="omfit-footer-contact">${contactItems.join(' · ')}</p>` : ''}
        ${branchHtml ? `<ul class="omfit-footer-branches">${branchHtml}</ul>` : ''}
        <p class="omfit-footer-action"><a class="omfit-footer-cta" href="${escapeHtml(ctaUrl)}">${escapeHtml(ctaLabel)}</a></p>
      </footer>`
    );
  }

  return main.innerHTML.trim();
}

export function auditArticle(article: Pick<
  GeneratedArticle,
  'title' | 'metaTitle' | 'metaDescription' | 'slug' | 'focusKeyword' | 'contentHtml' | 'featuredImage' | 'articleImages'
>): SeoAuditResult {
  const document = parseHtml(article.contentHtml);
  const main = document.querySelector('main');
  const articleBody = main?.cloneNode(true) as HTMLElement | null;
  articleBody
    ?.querySelectorAll('.omfit-related-content, .omfit-article-footer, .omfit-article-cta')
    .forEach((element) => element.remove());
  const plainText = normalize(articleBody?.textContent || '');
  const words = plainText.split(' ').filter(Boolean);
  const paragraphs = [...(articleBody?.querySelectorAll('p') || [])];
  const sentences = plainText.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const heading2Count = articleBody?.querySelectorAll('h2').length || 0;
  const heading3Count = articleBody?.querySelectorAll('h3').length || 0;
  const h1Count = articleBody?.querySelectorAll('h1').length || 0;
  const htmlImageCount = articleBody?.querySelectorAll('img').length || 0;
  const headings = [...(articleBody?.querySelectorAll('h1, h2, h3') || [])];
  let hasSeenH2 = false;
  let hasSeenSubheading = false;
  let hasInvalidHeadingOrder = false;
  headings.forEach((heading) => {
    if (heading.tagName === 'H1' && hasSeenSubheading) hasInvalidHeadingOrder = true;
    if (heading.tagName === 'H2') {
      hasSeenH2 = true;
      hasSeenSubheading = true;
    }
    if (heading.tagName === 'H3') {
      if (!hasSeenH2) hasInvalidHeadingOrder = true;
      hasSeenSubheading = true;
    }
  });
  const inlineImages = [...(articleBody?.querySelectorAll('img') || [])];
  const imagesMissingDimensions = inlineImages.filter((image) => {
    const width = image.getAttribute('width') || '';
    const height = image.getAttribute('height') || '';
    return !/^[1-9]\d*$/.test(width) || !/^[1-9]\d*$/.test(height);
  }).length;
  const inlineImageRecords = new Map<string, { alt: string; caption: string }>();
  inlineImages.forEach((image, index) => {
    const src = image.getAttribute('src')?.trim() || `inline-image-${index}`;
    const caption = image.closest('figure')?.querySelector('figcaption')?.textContent || '';
    inlineImageRecords.set(src, {
      alt: image.getAttribute('alt') || '',
      caption
    });
  });
  const htmlImageSources = new Set(
    inlineImages
      .map((image) => image.getAttribute('src')?.trim() || '')
      .filter(Boolean)
  );
  let orphanedArticleImageCount = 0;
  (article.articleImages || []).forEach((image, index) => {
    const key = image.url?.trim() || `article-image-${index}`;
    if (!image.url?.trim() || !htmlImageSources.has(image.url.trim())) {
      orphanedArticleImageCount += 1;
      return;
    }
    const existing = inlineImageRecords.get(key);
    inlineImageRecords.set(key, {
      alt: existing?.alt || image.altText || '',
      caption: existing?.caption || image.caption || ''
    });
  });
  const imageRecords = new Map(inlineImageRecords);
  if (article.featuredImage) {
    const key = article.featuredImage.url?.trim() || 'featured-image';
    const existing = imageRecords.get(key);
    imageRecords.set(key, {
      alt: existing?.alt || article.featuredImage.altText || '',
      caption: existing?.caption || article.featuredImage.caption || ''
    });
  }
  const imagesMissingAltCount = [...imageRecords.values()].filter((image) => !normalize(image.alt)).length;
  const imagesMissingCaptionCount = [...inlineImageRecords.values()].filter((image) => !normalize(image.caption)).length;
  const duplicateImageAltCount = countDuplicateValues([...imageRecords.values()].map((image) => image.alt));
  const duplicateImageCaptionCount = countDuplicateValues([...imageRecords.values()].map((image) => image.caption));
  const allInternalLinks = [...(main?.querySelectorAll('a[href]') || [])]
    .filter((link) => {
      try {
        return new URL(link.getAttribute('href') || '', 'https://omfit.com.vn').hostname.replace(/^www\./i, '') === 'omfit.com.vn';
      } catch {
        return false;
      }
    });
  const internalLinks = allInternalLinks.filter((link) => isSafeInternalLink(link.getAttribute('href') || ''));
  const unsafeInternalLinks = allInternalLinks.length - internalLinks.length;
  const focusKeyword = normalize(article.focusKeyword);
  const keywordMatches = focusKeyword
    ? plainText.split(focusKeyword).length - 1
    : 0;
  const keywordDensity = words.length ? (keywordMatches * focusKeyword.split(' ').length / words.length) * 100 : 0;
  const averageSentenceWords = sentences.length ? words.length / sentences.length : 0;
  const typoSignals = findCopyTypoSignals(main?.textContent || '');
  const h1Text = main?.querySelector('h1')?.textContent?.trim() || article.title;
  const titleSources = [
    { label: 'tiêu đề bài viết', value: article.title },
    { label: 'meta title', value: article.metaTitle },
    { label: 'H1', value: h1Text }
  ].filter((source, index, rows) => rows.findIndex((row) => normalize(row.value) === normalize(source.value)) === index);
  const keywordMismatchSources = focusKeyword
    ? titleSources
      .filter((source) => keywordCoverage(source.value, focusKeyword) < 0.6)
      .map((source) => source.label)
    : [];
  const titleIntent = extractIntentPhrases(article.title);
  const metaTitleIntent = extractIntentPhrases(article.metaTitle);
  const h1Intent = extractIntentPhrases(h1Text);
  const focusKeywordIntent = extractIntentPhrases(article.focusKeyword);
  const intentSignatures = [titleIntent, metaTitleIntent, h1Intent]
    .filter((phrases) => phrases.length)
    .map((phrases) => phrases.sort().join('|'));
  const missesKeywordIntent = focusKeywordIntent.length > 0
    && [titleIntent, metaTitleIntent, h1Intent]
      .some((phrases) => focusKeywordIntent.some((intent) => !phrases.includes(intent)));
  const hasConflictingIntent = new Set(intentSignatures).size > 1 || missesKeywordIntent;
  const issues: SeoIssue[] = [];
  let score = 100;

  const add = (code: string, level: SeoIssue['level'], message: string, penalty = 0) => {
    issues.push({ code, level, message });
    score -= penalty;
  };

  if (h1Count > 1) add('content_h1', 'error', 'Nội dung chỉ được có một H1.', 12);
  else if (h1Count === 1) add('content_h1', 'success', 'Nội dung có đúng một H1.');
  else add('content_h1', 'success', 'Hệ thống sẽ tự thêm một H1 từ tiêu đề khi đăng WordPress.');
  if (article.metaTitle.length < 45 || article.metaTitle.length > 60) {
    add('meta_title_length', 'warning', 'Meta title nên nằm trong khoảng 45–60 ký tự.', 8);
  } else add('meta_title_length', 'success', 'Độ dài meta title phù hợp.');
  if (article.metaDescription.length < 140 || article.metaDescription.length > 155) {
    add('meta_description_length', 'warning', 'Meta description nên nằm trong khoảng ưu tiên 140–155 ký tự.', 8);
  } else add('meta_description_length', 'success', 'Độ dài meta description phù hợp.');
  if (/(?:\.{2,}|…)\s*$/.test(article.metaDescription)) {
    add('meta_description_ending', 'warning', 'Meta description đang kết thúc bằng dấu chấm lửng; hãy viết câu kết trọn ý.', 5);
  } else if (!/[.!?]\s*$/.test(article.metaDescription)) {
    add('meta_description_ending', 'warning', 'Meta description cần kết thúc bằng một câu trọn ý.', 5);
  } else add('meta_description_ending', 'success', 'Meta description kết thúc rõ ràng, không bị cắt cụt.');
  if (keywordMismatchSources.length || hasConflictingIntent) {
    const mismatchDetail = keywordMismatchSources.length
      ? `Từ khóa chính chưa nhất quán trong ${keywordMismatchSources.join(', ')}.`
      : '';
    const conflictDetail = hasConflictingIntent
      ? ' Tiêu đề, H1 và meta title đang dùng cụm ý định tìm kiếm khác nhau.'
      : '';
    add('search_intent_consistency', 'warning', `${mismatchDetail}${conflictDetail}`.trim(), 8);
  } else add('search_intent_consistency', 'success', 'Tiêu đề, H1, meta title và từ khóa chính có cùng ý định tìm kiếm.');
  if (words.length < 800) add('word_count', 'warning', 'Bài viết nên có ít nhất 800 từ nếu chủ đề cần phân tích chuyên sâu.', 8);
  else add('word_count', 'success', `Bài viết có ${words.length} từ.`);
  if (heading2Count < 2) add('heading_structure', 'error', 'Bài viết cần ít nhất hai H2.', 10);
  else add('heading_structure', 'success', `Cấu trúc có ${heading2Count} H2 và ${heading3Count} H3.`);
  if (hasInvalidHeadingOrder) {
    add('heading_order', 'error', 'Thứ tự heading chưa hợp lệ: H3 phải đứng sau H2 và H1 không được xuất hiện sau heading con.', 10);
  } else add('heading_order', 'success', 'Thứ tự H1, H2 và H3 hợp lệ.');
  if (focusKeyword && !plainText.slice(0, 700).includes(focusKeyword)) {
    add('keyword_intro', 'warning', 'Từ khóa chính chưa xuất hiện tự nhiên trong phần mở đầu.', 7);
  } else add('keyword_intro', 'success', 'Từ khóa xuất hiện trong phần mở đầu.');
  if (keywordDensity > 2.5) add('keyword_density', 'warning', 'Mật độ từ khóa cao; cần viết tự nhiên hơn.', 8);
  if (internalLinks.length < 2) add('internal_links', 'warning', 'Nên có ít nhất hai internal link phù hợp.', 8);
  else add('internal_links', 'success', `Đã có ${internalLinks.length} internal link.`);
  if (unsafeInternalLinks > 0) {
    add('unsafe_internal_links', 'error', `Có ${unsafeInternalLinks} internal link dùng slug không an toàn hoặc sai chủ đề.`, 15);
  }
  if (inlineImageRecords.size < 2) {
    add('inline_images', 'warning', 'Bài dài nên có ít nhất hai hình ảnh minh họa.', 8);
  } else add('inline_images', 'success', 'Số lượng ảnh minh họa phù hợp.');
  if (orphanedArticleImageCount > 0) {
    add(
      'orphaned_article_images',
      'warning',
      `Có ${orphanedArticleImageCount} ảnh chỉ còn trong dữ liệu lưu trữ nhưng chưa được chèn vào nội dung bài.`,
      6
    );
  }
  if (imagesMissingDimensions > 0) {
    add(
      'inline_image_dimensions',
      'warning',
      `Có ${imagesMissingDimensions} ảnh trong nội dung thiếu thuộc tính width hoặc height hợp lệ.`,
      5
    );
  } else if (inlineImages.length > 0) {
    add('inline_image_dimensions', 'success', 'Ảnh trong nội dung có đầy đủ width và height.');
  }
  if (duplicateImageAltCount > 0) {
    add('duplicate_image_alt', 'warning', `Có ${duplicateImageAltCount} nhóm ảnh dùng trùng alt text.`, 5);
  } else if (imagesMissingAltCount > 0) {
    add('missing_image_alt', 'warning', `Có ${imagesMissingAltCount} ảnh chưa có alt text mô tả.`, 5);
  } else if (imageRecords.size > 0) {
    add('duplicate_image_alt', 'success', 'Alt text giữa các ảnh không bị trùng lặp.');
  }
  if (duplicateImageCaptionCount > 0) {
    add('duplicate_image_caption', 'warning', `Có ${duplicateImageCaptionCount} nhóm ảnh dùng trùng chú thích.`, 4);
  } else if (imagesMissingCaptionCount > 0) {
    add('missing_image_caption', 'warning', `Có ${imagesMissingCaptionCount} ảnh trong bài chưa có chú thích.`, 4);
  } else if (inlineImageRecords.size > 0) {
    add('duplicate_image_caption', 'success', 'Chú thích giữa các ảnh không bị trùng lặp.');
  }
  if (!main?.querySelector('.omfit-article-cta')) add('cta', 'warning', 'Bài viết chưa có CTA OMFIT.', 6);
  else add('cta', 'success', 'Đã có CTA OMFIT cuối bài.');
  if (typoSignals.length > 0) {
    const samples = typoSignals.slice(0, 3).map((signal) => `“${signal}”`).join(', ');
    add('copy_typo_signals', 'warning', `Phát hiện cụm từ có dấu hiệu lặp hoặc gõ nhầm: ${samples}.`, 7);
  } else add('copy_typo_signals', 'success', 'Không phát hiện từ lặp liền nhau hoặc mảnh từ bất thường.');

  const longParagraphs = paragraphs.filter((paragraph) => normalize(paragraph.textContent || '').split(' ').length > 90).length;
  if (longParagraphs > 0) add('long_paragraphs', 'warning', `Có ${longParagraphs} đoạn văn quá dài.`, 5);
  const readabilityScore = Math.max(
    0,
    Math.min(100, Math.round(100 - Math.max(0, averageSentenceWords - 20) * 2 - longParagraphs * 5))
  );

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    readabilityScore,
    passed: score >= 80 && !issues.some((issue) => issue.level === 'error'),
    issues,
    metrics: {
      wordCount: words.length,
      heading2Count,
      heading3Count,
      imageCount: inlineImageRecords.size,
      htmlImageCount,
      internalLinkCount: internalLinks.length,
      unsafeInternalLinkCount: unsafeInternalLinks,
      keywordDensity: Number(keywordDensity.toFixed(2)),
      averageSentenceWords: Number(averageSentenceWords.toFixed(1)),
      typoSignalCount: typoSignals.length,
      imagesMissingDimensions,
      imagesMissingAltCount,
      imagesMissingCaptionCount,
      orphanedArticleImageCount,
      duplicateImageAltCount,
      duplicateImageCaptionCount
    }
  };
}
