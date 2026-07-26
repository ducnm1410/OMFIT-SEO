import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileImage,
  Image as ImageIcon,
  Layers3,
  PlusCircle
} from 'lucide-react';
import type { GeneratedArticle, GeneratedImage } from '../types';
import { LeonardoService } from '../services/leonardoService';

interface ArticleImagePackageProps {
  article: GeneratedArticle;
  contentHtml: string;
  leonardoService: LeonardoService;
  onApplyArticle: (article: GeneratedArticle) => void;
}

interface ArticleSection {
  index: number;
  title: string;
  hasImage: boolean;
}

function parseContent(contentHtml: string) {
  return new DOMParser().parseFromString(`<main>${contentHtml}</main>`, 'text/html');
}

function getSections(contentHtml: string): ArticleSection[] {
  const document = parseContent(contentHtml);
  return [...document.querySelectorAll('main h2')]
    .filter((heading) => !heading.closest('.omfit-related-content, .omfit-article-cta, .omfit-article-footer'))
    .map((heading, index) => {
      let sibling = heading.nextElementSibling;
      let hasImage = false;
      while (sibling && sibling.tagName !== 'H2') {
        if (sibling.matches('figure, img') || sibling.querySelector('img')) {
          hasImage = true;
          break;
        }
        sibling = sibling.nextElementSibling;
      }
      return {
        index,
        title: heading.textContent?.trim() || `Phần ${index + 1}`,
        hasImage
      };
    });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function insertSectionImage(contentHtml: string, sectionIndex: number, image: GeneratedImage, caption: string) {
  const document = parseContent(contentHtml);
  const main = document.querySelector('main');
  const headings = [...document.querySelectorAll('main h2')]
    .filter((heading) => !heading.closest('.omfit-related-content, .omfit-article-cta, .omfit-article-footer'));
  const heading = headings[sectionIndex];
  if (!main || !heading) return contentHtml;
  heading.insertAdjacentHTML(
    'afterend',
    `<figure data-omfit-section-image="${escapeHtml(image.id)}">
      <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.altText)}" loading="lazy" decoding="async" width="1200" height="896" />
      <figcaption>${escapeHtml(caption)}</figcaption>
    </figure>`
  );
  return main.innerHTML.trim();
}

export const ArticleImagePackage: React.FC<ArticleImagePackageProps> = ({
  article,
  contentHtml,
  leonardoService,
  onApplyArticle
}) => {
  const sections = useMemo(() => getSections(contentHtml), [contentHtml]);
  const [generatingKey, setGeneratingKey] = useState('');
  const [message, setMessage] = useState('');

  const createImage = (description: string) => leonardoService.generateImage(
    description,
    'Photorealistic 4K',
    undefined,
    article.focusKeyword,
    'nano-banana-2',
    article.id
  );

  const generateFeatured = async () => {
    setGeneratingKey('featured');
    setMessage('');
    try {
      const image = await createImage(
        `Ảnh đại diện cho bài viết "${article.title}". Chủ đề chính: "${article.focusKeyword}". Bố cục ngang 4:3, chủ thể rõ ràng, phù hợp thumbnail WordPress, không có chữ trong ảnh.`
      );
      onApplyArticle({
        ...article,
        contentHtml,
        featuredImage: { ...image, role: 'featured', caption: article.title }
      });
      setMessage('Đã tạo và đặt ảnh đại diện cho bài viết.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tạo ảnh đại diện.');
    } finally {
      setGeneratingKey('');
    }
  };

  const generateSection = async (section: ArticleSection) => {
    setGeneratingKey(`section-${section.index}`);
    setMessage('');
    try {
      const image = await createImage(
        `Ảnh minh họa cho mục "${section.title}" trong bài "${article.title}". Bám sát chủ đề "${article.focusKeyword}", bối cảnh OMFIT fitness và wellness chân thực, chuyển động an toàn, không có chữ trong ảnh.`
      );
      const inlineImage = { ...image, role: 'inline' as const, caption: section.title };
      const nextContent = insertSectionImage(contentHtml, section.index, inlineImage, section.title);
      onApplyArticle({
        ...article,
        contentHtml: nextContent,
        articleImages: [...article.articleImages, inlineImage]
      });
      setMessage(`Đã chèn ảnh ngay sau mục “${section.title}”.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tạo ảnh cho mục này.');
    } finally {
      setGeneratingKey('');
    }
  };

  const generateMissingPackage = async () => {
    const targets = sections.filter((section) => !section.hasImage).slice(0, 3);
    if (targets.length === 0) {
      setMessage('Các mục chính đã có ảnh. Bạn vẫn có thể tạo thêm ở từng mục.');
      return;
    }
    setGeneratingKey('package');
    setMessage('');
    let nextContent = contentHtml;
    const newImages: GeneratedImage[] = [];
    try {
      for (const section of targets) {
        const image = await createImage(
          `Ảnh minh họa cho mục "${section.title}" trong bài "${article.title}". Bám sát từ khóa "${article.focusKeyword}", hình ảnh OMFIT cao cấp và chân thực, không có chữ trong ảnh.`
        );
        const inlineImage = { ...image, role: 'inline' as const, caption: section.title };
        nextContent = insertSectionImage(nextContent, section.index, inlineImage, section.title);
        newImages.push(inlineImage);
      }
      onApplyArticle({
        ...article,
        contentHtml: nextContent,
        articleImages: [...article.articleImages, ...newImages]
      });
      setMessage(`Đã tạo và chèn ${newImages.length} ảnh vào các mục còn thiếu.`);
    } catch (error) {
      if (newImages.length > 0) {
        onApplyArticle({
          ...article,
          contentHtml: nextContent,
          articleImages: [...article.articleImages, ...newImages]
        });
      }
      setMessage(error instanceof Error
        ? `${error.message}${newImages.length ? ` Đã giữ lại ${newImages.length} ảnh tạo thành công.` : ''}`
        : 'Không thể hoàn tất gói hình ảnh.');
    } finally {
      setGeneratingKey('');
    }
  };

  return (
    <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#0879D9]">Gói hình ảnh theo bài</p>
          <h3 className="mt-1 text-lg font-extrabold text-[#071827]">{article.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Hệ thống đọc cấu trúc H2 và tạo ảnh đúng ngữ cảnh, sau đó chèn trực tiếp vào nội dung đang biên tập.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="min-w-20 rounded-xl bg-[#F8FAFC] p-2.5"><strong className="block text-base text-[#071827]">{article.wordCount}</strong><span className="text-[10px] text-slate-500">Từ</span></div>
          <div className="min-w-20 rounded-xl bg-[#F8FAFC] p-2.5"><strong className="block text-base text-[#071827]">{sections.length}</strong><span className="text-[10px] text-slate-500">Mục H2</span></div>
          <div className="min-w-20 rounded-xl bg-[#F8FAFC] p-2.5"><strong className="block text-base text-[#071827]">{article.articleImages.length}</strong><span className="text-[10px] text-slate-500">Ảnh bài</span></div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => void generateFeatured()} disabled={Boolean(generatingKey)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#0879D9]/30 bg-[#F0F9FF] px-4 text-sm font-bold text-[#0879D9] disabled:opacity-50">
          {generatingKey === 'featured' ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0879D9] border-t-transparent" /> : <FileImage className="h-4 w-4" />}
          Tạo ảnh đại diện
        </button>
        <button type="button" onClick={() => void generateMissingPackage()} disabled={Boolean(generatingKey)} className="gradient-bg-omfit-btn inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50">
          {generatingKey === 'package' ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Layers3 className="h-4 w-4" />}
          Tạo gói tối đa 3 ảnh còn thiếu
        </button>
      </div>

      <div className="mt-5 space-y-2">
        {sections.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-[#F8FAFC] p-4 text-sm text-slate-500">
            Bài viết chưa có H2 để xác định vị trí chèn ảnh.
          </p>
        )}
        {sections.map((section) => (
          <div key={`${section.index}-${section.title}`} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${section.hasImage ? 'bg-emerald-50 text-emerald-600' : 'bg-[#F0F9FF] text-[#0879D9]'}`}>
                {section.hasImage ? <CheckCircle2 className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#071827]">{section.title}</p>
                <p className="text-xs text-slate-500">{section.hasImage ? 'Đã có ảnh trong mục này' : 'Chưa có ảnh minh họa'}</p>
              </div>
            </div>
            <button type="button" onClick={() => void generateSection(section)} disabled={Boolean(generatingKey)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-[#0879D9] hover:bg-[#F0F9FF] disabled:opacity-50">
              {generatingKey === `section-${section.index}` ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0879D9] border-t-transparent" /> : <PlusCircle className="h-4 w-4" />}
              Tạo và chèn ảnh
            </button>
          </div>
        ))}
      </div>

      {message && <p aria-live="polite" className="mt-4 rounded-xl bg-[#F0F9FF] p-3 text-sm font-semibold text-[#075EA8]">{message}</p>}
    </section>
  );
};
