import type { GeneratedImage } from '../types';

const DEFAULT_IMAGE_WIDTH = 1200;
const DEFAULT_IMAGE_HEIGHT = 896;
const DEFAULT_IMAGE_SIZES = '(max-width: 1200px) 100vw, 1200px';

export interface ArticleImageMarkupOptions {
  image: GeneratedImage;
  caption?: string;
  sectionTitle?: string;
  articleTitle?: string;
  focusKeyword?: string;
  existingAltTexts?: Iterable<string>;
}

export interface ArticleImageMarkup {
  html: string;
  altText: string;
  caption: string;
}

function cleanText(value?: string) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function comparisonKey(value?: string) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/đ/g, 'd')
    .replace(/[“”"'.,:;!?()[\]{}–—-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function validDimension(value: unknown, fallback: number) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.round(numberValue)
    : fallback;
}

export function getArticleImageDimensions(image: GeneratedImage) {
  return {
    width: validDimension(image.width, DEFAULT_IMAGE_WIDTH),
    height: validDimension(image.height, DEFAULT_IMAGE_HEIGHT)
  };
}

export function sectionHasImage(heading: Element) {
  let sibling = heading.nextElementSibling;
  while (sibling && sibling.tagName !== 'H2') {
    if (sibling.matches('figure, img') || sibling.querySelector('img')) return true;
    sibling = sibling.nextElementSibling;
  }
  return false;
}

export function articleContainsImage(root: ParentNode, image: GeneratedImage) {
  return [...root.querySelectorAll<HTMLElement>('[data-omfit-section-image]')]
    .some((element) => element.dataset.omfitSectionImage === image.id)
    || [...root.querySelectorAll<HTMLImageElement>('img')]
      .some((element) => element.getAttribute('src') === image.url);
}

export function collectArticleAltTexts(root: ParentNode) {
  return [...root.querySelectorAll<HTMLImageElement>('img[alt]')]
    .map((image) => cleanText(image.alt));
}

function contextualCaption(options: ArticleImageMarkupOptions) {
  const proposed = cleanText(options.caption || options.image.caption);
  const sectionTitle = cleanText(options.sectionTitle);
  if (proposed && comparisonKey(proposed) !== comparisonKey(sectionTitle)) return proposed;

  if (sectionTitle) {
    const topic = cleanText(options.focusKeyword);
    return topic && comparisonKey(topic) !== comparisonKey(sectionTitle)
      ? `Hình ảnh minh họa cho nội dung “${sectionTitle}” trong chủ đề ${topic}.`
      : `Hình ảnh minh họa cho nội dung “${sectionTitle}” tại OMFIT.`;
  }

  const articleTitle = cleanText(options.articleTitle);
  return articleTitle
    ? `Hình ảnh minh họa cho bài viết “${articleTitle}”.`
    : 'Hình ảnh minh họa trong bài viết của OMFIT.';
}

function contextualAltText(options: ArticleImageMarkupOptions) {
  const sectionTitle = cleanText(options.sectionTitle);
  const fallback = sectionTitle
    ? `Minh họa ${sectionTitle} tại OMFIT`
    : `Minh họa ${cleanText(options.focusKeyword || options.articleTitle) || 'bài viết OMFIT'}`;
  const proposed = cleanText(options.image.altText) || fallback;
  const existingKeys = new Set(
    [...(options.existingAltTexts || [])]
      .map((value) => comparisonKey(value))
      .filter(Boolean)
  );
  if (!existingKeys.has(comparisonKey(proposed))) return proposed;

  const contextualSuffix = sectionTitle || cleanText(options.focusKeyword || options.articleTitle);
  const contextual = contextualSuffix
    ? `${proposed} – ${contextualSuffix}`
    : `${proposed} – OMFIT`;
  if (!existingKeys.has(comparisonKey(contextual))) return contextual;

  let sequence = 2;
  while (existingKeys.has(comparisonKey(`${contextual} ${sequence}`))) sequence += 1;
  return `${contextual} ${sequence}`;
}

export function buildArticleImageMarkup(options: ArticleImageMarkupOptions): ArticleImageMarkup {
  const { width, height } = getArticleImageDimensions(options.image);
  const altText = contextualAltText(options);
  const caption = contextualCaption(options);
  const html = `<figure data-omfit-section-image="${escapeHtml(options.image.id)}">
      <img src="${escapeHtml(options.image.url)}" alt="${escapeHtml(altText)}" loading="lazy" decoding="async" width="${width}" height="${height}" sizes="${DEFAULT_IMAGE_SIZES}" />
      <figcaption>${escapeHtml(caption)}</figcaption>
    </figure>`;
  return { html, altText, caption };
}

export function mergeUniqueArticleImages(
  existing: GeneratedImage[],
  incoming: GeneratedImage[]
) {
  const merged = [...existing];
  for (const image of incoming) {
    const duplicateIndex = merged.findIndex((item) => (
      item.id === image.id || (Boolean(item.url) && item.url === image.url)
    ));
    if (duplicateIndex >= 0) merged[duplicateIndex] = { ...merged[duplicateIndex], ...image };
    else merged.push(image);
  }
  return merged;
}
