import type { BrandProfile, GeneratedArticle, SeoAuditResult, SeoIssue } from '../types';

const OMFIT_LINKS = [
  { title: 'Tìm hiểu lớp Pilates tại OMFIT', url: 'https://omfit.com.vn/service/pilates/', terms: ['pilates', 'reformer'] },
  { title: 'Khám phá các bài viết sức khỏe từ OMFIT', url: 'https://omfit.com.vn/tin-tuc/', terms: ['sức khỏe', 'wellness', 'fitness', 'dinh dưỡng'] },
  { title: 'Liên hệ OMFIT để được tư vấn lộ trình phù hợp', url: 'https://omfit.com.vn/contact-us/', terms: [] }
];

function normalize(value: string) {
  return value.toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
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
      company?.hotline ? `<a style="color:#67C1FF;" href="tel:${escapeHtml(company.hotline.replace(/\s+/g, ''))}">${escapeHtml(company.hotline)}</a>` : '',
      company?.email ? `<a style="color:#67C1FF;" href="mailto:${escapeHtml(company.email)}">${escapeHtml(company.email)}</a>` : '',
      company?.website ? `<a style="color:#67C1FF;" href="${escapeHtml(company.website)}">${escapeHtml(company.website.replace(/^https?:\/\//, ''))}</a>` : ''
    ].filter(Boolean);
    const branchHtml = branches
      .filter((branch) => branch.name || branch.address)
      .slice(0, 4)
      .map((branch) => `<li>
        <strong style="color:#FFFFFF;">${escapeHtml(branch.name || 'Chi nhánh OMFIT')}</strong>
        ${branch.address ? `<span style="color:#E5E7EB;">${escapeHtml(branch.address)}</span>` : ''}
        ${branch.phone ? `<a style="color:#67C1FF;" href="tel:${escapeHtml(branch.phone.replace(/\s+/g, ''))}">${escapeHtml(branch.phone)}</a>` : ''}
      </li>`)
      .join('');
    main.insertAdjacentHTML(
      'beforeend',
      `<footer class="omfit-article-footer omfit-article-cta" aria-label="Thông tin OMFIT" style="margin-top:32px;padding:24px;border:1px solid rgba(103,193,255,.35);border-radius:16px;background:#18232E;color:#E5E7EB;">
        <div class="omfit-footer-brand" style="display:flex;align-items:flex-start;gap:16px;">
          ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(company?.displayName || brandProfile?.name || 'OMFIT')}" loading="lazy" style="width:96px;height:64px;object-fit:contain;background:#fff;border-radius:12px;padding:8px;" />` : ''}
          <div>
            <h2 style="margin:0 0 12px;color:#FFFFFF;font-size:24px;line-height:1.35;">${escapeHtml(heading)}</h2>
            <p style="margin:0 0 12px;color:#E5E7EB;font-size:16px;line-height:1.75;">${escapeHtml(description)}</p>
            ${company?.tagline ? `<p style="margin:0;color:#E5E7EB;"><strong style="color:#FFFFFF;">${escapeHtml(company.tagline)}</strong></p>` : ''}
          </div>
        </div>
        ${contactItems.length ? `<p class="omfit-footer-contact" style="margin:16px 0;color:#E5E7EB;">${contactItems.join(' · ')}</p>` : ''}
        ${branchHtml ? `<ul class="omfit-footer-branches" style="margin:16px 0;padding-left:20px;color:#E5E7EB;">${branchHtml}</ul>` : ''}
        <p style="margin:16px 0 0;"><a class="omfit-footer-cta" href="${escapeHtml(ctaUrl)}" style="display:inline-flex;min-height:44px;align-items:center;padding:10px 16px;border-radius:12px;background:#0879D9;color:#FFFFFF;text-decoration:none;font-weight:700;">${escapeHtml(ctaLabel)}</a></p>
      </footer>`
    );
  }

  return main.innerHTML.trim();
}

export function auditArticle(article: Pick<
  GeneratedArticle,
  'title' | 'metaTitle' | 'metaDescription' | 'slug' | 'focusKeyword' | 'contentHtml' | 'articleImages'
>): SeoAuditResult {
  const document = parseHtml(article.contentHtml);
  const main = document.querySelector('main');
  const plainText = normalize(main?.textContent || '');
  const words = plainText.split(' ').filter(Boolean);
  const paragraphs = [...(main?.querySelectorAll('p') || [])];
  const sentences = plainText.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const heading2Count = main?.querySelectorAll('h2').length || 0;
  const heading3Count = main?.querySelectorAll('h3').length || 0;
  const h1Count = main?.querySelectorAll('h1').length || 0;
  const imageCount = main?.querySelectorAll('img').length || 0;
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
  if (article.metaDescription.length < 140 || article.metaDescription.length > 160) {
    add('meta_description_length', 'warning', 'Meta description nên nằm trong khoảng 140–160 ký tự.', 8);
  } else add('meta_description_length', 'success', 'Độ dài meta description phù hợp.');
  if (words.length < 800) add('word_count', 'warning', 'Bài viết nên có ít nhất 800 từ nếu chủ đề cần phân tích chuyên sâu.', 8);
  else add('word_count', 'success', `Bài viết có ${words.length} từ.`);
  if (heading2Count < 2) add('heading_structure', 'error', 'Bài viết cần ít nhất hai H2.', 10);
  else add('heading_structure', 'success', `Cấu trúc có ${heading2Count} H2 và ${heading3Count} H3.`);
  if (focusKeyword && !plainText.slice(0, 700).includes(focusKeyword)) {
    add('keyword_intro', 'warning', 'Từ khóa chính chưa xuất hiện tự nhiên trong phần mở đầu.', 7);
  } else add('keyword_intro', 'success', 'Từ khóa xuất hiện trong phần mở đầu.');
  if (keywordDensity > 2.5) add('keyword_density', 'warning', 'Mật độ từ khóa cao; cần viết tự nhiên hơn.', 8);
  if (internalLinks.length < 2) add('internal_links', 'warning', 'Nên có ít nhất hai internal link phù hợp.', 8);
  else add('internal_links', 'success', `Đã có ${internalLinks.length} internal link.`);
  if (unsafeInternalLinks > 0) {
    add('unsafe_internal_links', 'error', `Có ${unsafeInternalLinks} internal link dùng slug không an toàn hoặc sai chủ đề.`, 15);
  }
  if (imageCount + (article.articleImages?.length || 0) < 2) {
    add('inline_images', 'warning', 'Bài dài nên có ít nhất hai hình ảnh minh họa.', 8);
  } else add('inline_images', 'success', 'Số lượng ảnh minh họa phù hợp.');
  if (!main?.querySelector('.omfit-article-cta')) add('cta', 'warning', 'Bài viết chưa có CTA OMFIT.', 6);
  else add('cta', 'success', 'Đã có CTA OMFIT cuối bài.');

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
      imageCount,
      internalLinkCount: internalLinks.length,
      unsafeInternalLinkCount: unsafeInternalLinks,
      keywordDensity: Number(keywordDensity.toFixed(2)),
      averageSentenceWords: Number(averageSentenceWords.toFixed(1))
    }
  };
}
