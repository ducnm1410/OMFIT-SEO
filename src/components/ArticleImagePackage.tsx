import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileImage,
  Image as ImageIcon,
  Layers3,
  PlusCircle,
  Trash2,
  Upload
} from 'lucide-react';
import type { GeneratedArticle, GeneratedImage } from '../types';
import { LeonardoService } from '../services/leonardoService';
import { uploadMediaFile } from '../services/contentRepository';
import {
  articleContainsImage,
  buildArticleImageMarkup,
  collectArticleAltTexts,
  mergeUniqueArticleImages,
  sectionHasImage
} from '../utils/articleImageMarkup';
import { ButtonContent } from './ButtonContent';

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

type UploadTarget =
  | { type: 'featured' }
  | { type: 'section'; section: ArticleSection };

function parseContent(contentHtml: string) {
  return new DOMParser().parseFromString(`<main>${contentHtml}</main>`, 'text/html');
}

function getSections(contentHtml: string): ArticleSection[] {
  const document = parseContent(contentHtml);
  return [...document.querySelectorAll('main h2')]
    .filter((heading) => !heading.closest('.omfit-related-content, .omfit-article-cta, .omfit-article-footer'))
    .map((heading, index) => {
      return {
        index,
        title: heading.textContent?.trim() || `Phần ${index + 1}`,
        hasImage: sectionHasImage(heading)
      };
    });
}

function insertSectionImage(
  contentHtml: string,
  sectionIndex: number,
  image: GeneratedImage,
  caption: string,
  article: GeneratedArticle,
  allowAdditional = false
) {
  const document = parseContent(contentHtml);
  const main = document.querySelector('main');
  const headings = [...document.querySelectorAll('main h2')]
    .filter((heading) => !heading.closest('.omfit-related-content, .omfit-article-cta, .omfit-article-footer'));
  const heading = headings[sectionIndex];
  if (
    !main
    || !heading
    || articleContainsImage(main, image)
    || (!allowAdditional && sectionHasImage(heading))
  ) {
    return { contentHtml, image, inserted: false };
  }
  const markup = buildArticleImageMarkup({
    image,
    caption,
    sectionTitle: heading.textContent?.trim(),
    articleTitle: article.title,
    focusKeyword: article.focusKeyword,
    existingAltTexts: collectArticleAltTexts(main)
  });
  let insertionTarget = heading;
  if (allowAdditional) {
    let sibling = heading.nextElementSibling;
    while (sibling && sibling.tagName !== 'H2') {
      if (sibling.matches('figure, img') || sibling.querySelector('img')) {
        insertionTarget = sibling;
      }
      sibling = sibling.nextElementSibling;
    }
  }
  insertionTarget.insertAdjacentHTML('afterend', markup.html);
  return {
    contentHtml: main.innerHTML.trim(),
    image: { ...image, altText: markup.altText, caption: markup.caption },
    inserted: true
  };
}

export const ArticleImagePackage: React.FC<ArticleImagePackageProps> = ({
  article,
  contentHtml,
  leonardoService,
  onApplyArticle
}) => {
  const sections = useMemo(() => getSections(contentHtml), [contentHtml]);
  const inlineImageUsage = useMemo(() => {
    const document = parseContent(contentHtml);
    const main = document.querySelector('main');
    return new Set(
      article.articleImages
        .filter((image) => main && articleContainsImage(main, image))
        .map((image) => image.id || image.url)
    );
  }, [article.articleImages, contentHtml]);
  const [generatingKey, setGeneratingKey] = useState('');
  const [message, setMessage] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<UploadTarget | null>(null);

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

  const applySectionImage = (
    section: ArticleSection,
    image: GeneratedImage,
    successMessage: string
  ) => {
    const inlineImage = { ...image, role: 'inline' as const, caption: section.title };
    const insertion = insertSectionImage(
      contentHtml,
      section.index,
      inlineImage,
      section.title,
      article,
      section.hasImage
    );
    if (!insertion.inserted) {
      setMessage('Ảnh này đã được chèn trước đó nên hệ thống không tạo bản trùng.');
      return false;
    }
    onApplyArticle({
      ...article,
      contentHtml: insertion.contentHtml,
      articleImages: mergeUniqueArticleImages(article.articleImages, [insertion.image])
    });
    setMessage(successMessage);
    return true;
  };

  const generateSection = async (section: ArticleSection) => {
    setGeneratingKey(`section-${section.index}`);
    setMessage('');
    try {
      const image = await createImage(
        `Ảnh minh họa cho mục "${section.title}" trong bài "${article.title}". Bám sát chủ đề "${article.focusKeyword}", bối cảnh OMFIT fitness và wellness chân thực, chuyển động an toàn, không có chữ trong ảnh.`
      );
      applySectionImage(section, image, section.hasImage
        ? `Đã chèn thêm một ảnh vào mục “${section.title}”.`
        : `Đã chèn ảnh ngay sau mục “${section.title}”.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tạo ảnh cho mục này.');
    } finally {
      setGeneratingKey('');
    }
  };

  const selectUpload = (target: UploadTarget) => {
    uploadTargetRef.current = target;
    uploadInputRef.current?.click();
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const target = uploadTargetRef.current;
    if (!file || !target) return;
    const key = target.type === 'featured'
      ? 'upload-featured'
      : `upload-section-${target.section.index}`;
    setGeneratingKey(key);
    setMessage('');
    try {
      const image = await uploadMediaFile(file, article.id);
      if (target.type === 'featured') {
        onApplyArticle({
          ...article,
          contentHtml,
          featuredImage: {
            ...image,
            role: 'featured',
            altText: image.altText || article.title,
            caption: article.title
          }
        });
        setMessage('Đã tải lên và đặt ảnh đại diện cho bài viết.');
      } else {
        applySectionImage(
          target.section,
          image,
          `Đã tải ảnh lên và chèn vào mục “${target.section.title}”.`
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tải ảnh lên.');
    } finally {
      setGeneratingKey('');
      uploadTargetRef.current = null;
      event.target.value = '';
    }
  };

  const removeInlineImage = (image: GeneratedImage) => {
    const document = parseContent(contentHtml);
    const main = document.querySelector('main');
    if (!main) return;

    [...main.querySelectorAll<HTMLElement>('figure[data-omfit-section-image]')]
      .filter((figure) => figure.dataset.omfitSectionImage === image.id)
      .forEach((figure) => figure.remove());
    [...main.querySelectorAll<HTMLImageElement>('img')]
      .filter((element) => element.getAttribute('src') === image.url)
      .forEach((element) => {
        const figure = element.closest('figure');
        if (figure) figure.remove();
        else element.remove();
      });

    onApplyArticle({
      ...article,
      contentHtml: main.innerHTML.trim(),
      articleImages: article.articleImages.filter((item) => (
        item.id !== image.id && (!image.url || item.url !== image.url)
      ))
    });
    setMessage('Đã xóa ảnh khỏi nội dung bài viết. Ảnh gốc vẫn được giữ trong kho OMFIT.');
  };

  const removeFeaturedImage = () => {
    onApplyArticle({
      ...article,
      contentHtml,
      featuredImage: undefined
    });
    setMessage('Đã xóa ảnh đại diện khỏi bài viết.');
  };

  const insertTrackedImage = (image: GeneratedImage) => {
    const targetSection = sections.find((section) => !section.hasImage) || sections[0];
    if (!targetSection) {
      setMessage('Bài viết chưa có mục H2 để chèn ảnh. Hãy bổ sung ít nhất một H2 rồi thử lại.');
      return;
    }
    applySectionImage(
      targetSection,
      image,
      `Đã chèn ảnh vào mục “${targetSection.title}”.`
    );
  };

  const generateMissingPackage = async () => {
    const targets = sections.filter((section) => !section.hasImage).slice(0, 3);
    if (targets.length === 0) {
      setMessage('Mỗi mục H2 đã có ít nhất một ảnh. Dùng nút “Tạo thêm ảnh” nếu cần bổ sung ngữ cảnh cho từng mục.');
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
        const insertion = insertSectionImage(
          nextContent,
          section.index,
          inlineImage,
          section.title,
          article
        );
        nextContent = insertion.contentHtml;
        if (insertion.inserted) newImages.push(insertion.image);
      }
      onApplyArticle({
        ...article,
        contentHtml: nextContent,
        articleImages: mergeUniqueArticleImages(article.articleImages, newImages)
      });
      setMessage(`Đã tạo và chèn ${newImages.length} ảnh vào các mục còn thiếu.`);
    } catch (error) {
      if (newImages.length > 0) {
        onApplyArticle({
          ...article,
          contentHtml: nextContent,
          articleImages: mergeUniqueArticleImages(article.articleImages, newImages)
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
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => void handleUpload(event)}
        className="hidden"
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#0879D9]">Gói hình ảnh theo bài</p>
          <h3 className="mt-1 text-lg font-extrabold text-[#071827]">{article.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Chọn tạo ảnh AI hoặc tải ảnh từ máy cho ảnh đại diện và từng mục H2; ảnh sẽ được chèn trực tiếp vào nội dung đang biên tập.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="min-w-20 rounded-xl bg-[#F8FAFC] p-2.5"><strong className="block text-base text-[#071827]">{article.wordCount}</strong><span className="text-[10px] text-slate-500">Từ</span></div>
          <div className="min-w-20 rounded-xl bg-[#F8FAFC] p-2.5"><strong className="block text-base text-[#071827]">{sections.length}</strong><span className="text-[10px] text-slate-500">Mục H2</span></div>
          <div className="min-w-20 rounded-xl bg-[#F8FAFC] p-2.5"><strong className="block text-base text-[#071827]">{article.articleImages.length}</strong><span className="text-[10px] text-slate-500">Ảnh bài</span></div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => void generateFeatured()} disabled={Boolean(generatingKey)} aria-busy={generatingKey === 'featured'} className="ui-action-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#0879D9]/30 bg-[#F0F9FF] px-3 text-sm font-bold text-[#0879D9] disabled:opacity-50">
          <ButtonContent
            busy={generatingKey === 'featured'}
            busyLabel="Đang tạo ảnh..."
            label="Tạo ảnh đại diện AI"
            icon={<FileImage className="h-4 w-4" />}
          />
        </button>
        <button type="button" onClick={() => selectUpload({ type: 'featured' })} disabled={Boolean(generatingKey)} aria-busy={generatingKey === 'upload-featured'} className="ui-action-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-[#0879D9]/40 hover:text-[#0879D9] disabled:opacity-50">
          <ButtonContent
            busy={generatingKey === 'upload-featured'}
            busyLabel="Đang tải ảnh..."
            label="Upload ảnh đại diện"
            icon={<Upload className="h-4 w-4" />}
          />
        </button>
        <button type="button" onClick={() => void generateMissingPackage()} disabled={Boolean(generatingKey)} aria-busy={generatingKey === 'package'} className="ui-action-button gradient-bg-omfit-btn inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-white disabled:opacity-50">
          <ButtonContent
            busy={generatingKey === 'package'}
            busyLabel="Đang tạo gói ảnh..."
            label="Tạo gói tối đa 3 ảnh còn thiếu"
            icon={<Layers3 className="h-4 w-4" />}
          />
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
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => void generateSection(section)} disabled={Boolean(generatingKey)} aria-busy={generatingKey === `section-${section.index}`} className="ui-action-button inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-[#0879D9] hover:bg-[#F0F9FF] disabled:opacity-50 sm:max-w-44">
                <ButtonContent
                  busy={generatingKey === `section-${section.index}`}
                  busyLabel="Đang tạo ảnh..."
                  label={section.hasImage ? 'Tạo thêm bằng AI' : 'Tạo ảnh bằng AI'}
                  icon={<PlusCircle className="h-4 w-4" />}
                />
              </button>
              <button type="button" onClick={() => selectUpload({ type: 'section', section })} disabled={Boolean(generatingKey)} aria-busy={generatingKey === `upload-section-${section.index}`} className="ui-action-button inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:border-[#0879D9]/40 hover:text-[#0879D9] disabled:opacity-50 sm:max-w-40">
                <ButtonContent
                  busy={generatingKey === `upload-section-${section.index}`}
                  busyLabel="Đang tải ảnh..."
                  label="Tải ảnh lên"
                  icon={<Upload className="h-4 w-4" />}
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      {(article.featuredImage || article.articleImages.length > 0) && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-[#071827]">Ảnh của bài viết</h4>
              <p className="mt-0.5 text-xs text-slate-500">Ảnh chưa chèn có thể đưa vào nội dung bằng nút dấu cộng; xóa khỏi bài không xóa file gốc trong kho OMFIT.</p>
            </div>
            <span className="rounded-full bg-[#F0F9FF] px-2.5 py-1 text-[10px] font-bold text-[#0879D9]">
              {(article.featuredImage ? 1 : 0) + inlineImageUsage.size}/{(article.featuredImage ? 1 : 0) + article.articleImages.length} đang dùng
            </span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {article.featuredImage && (
              <article className="overflow-hidden rounded-xl border border-slate-200 bg-[#F8FAFC]">
                <img src={article.featuredImage.url} alt={article.featuredImage.altText} className="h-32 w-full object-cover" loading="lazy" />
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#0879D9]">Ảnh đại diện</p>
                    <p className="mt-0.5 truncate text-xs text-slate-600">{article.featuredImage.altText || article.title}</p>
                  </div>
                  <button type="button" onClick={removeFeaturedImage} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-rose-600 transition hover:bg-rose-50" aria-label="Xóa ảnh đại diện khỏi bài">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            )}
            {article.articleImages.map((image) => {
              const isInserted = inlineImageUsage.has(image.id || image.url);
              return (
              <article key={image.id || image.url} className={`overflow-hidden rounded-xl border bg-[#F8FAFC] ${
                isInserted ? 'border-emerald-200' : 'border-amber-200'
              }`}>
                <img src={image.url} alt={image.altText} className="h-32 w-full object-cover" loading="lazy" />
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${
                      isInserted ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {isInserted ? 'Đang dùng trong nội dung' : 'Chưa chèn vào nội dung'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-600">{image.caption || image.altText || image.fileName}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!isInserted && (
                      <button type="button" onClick={() => insertTrackedImage(image)} className="grid h-9 w-9 place-items-center rounded-lg text-[#0879D9] transition hover:bg-[#F0F9FF]" aria-label="Chèn ảnh vào nội dung bài" title="Chèn vào bài">
                        <PlusCircle className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => removeInlineImage(image)} className="grid h-9 w-9 place-items-center rounded-lg text-rose-600 transition hover:bg-rose-50" aria-label="Xóa ảnh khỏi nội dung bài" title="Xóa khỏi bài">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        </div>
      )}

      {message && <p aria-live="polite" className="mt-4 rounded-xl bg-[#F0F9FF] p-3 text-sm font-semibold text-[#075EA8]">{message}</p>}
    </section>
  );
};
