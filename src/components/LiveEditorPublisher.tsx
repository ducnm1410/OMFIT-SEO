import React, { useEffect, useState, useRef } from 'react';
import {
  Edit3,
  Globe,
  Upload,
  FilePenLine,
  CheckCircle2,
  Eye,
  Code,
  ShieldCheck,
  Award,
  Terminal,
  ExternalLink,
  Activity,
  Trash2,
  RefreshCw,
  PlusCircle,
  Tag,
  ImageIcon,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import DOMPurify from 'dompurify';
import type {
  ActiveTab,
  ArticleSource,
  GeneratedArticle,
  GeneratedImage,
  SeoAuditResult,
  SeoWorkflowStep
} from '../types';
import { WordpressMcpService } from '../services/wordpressMcpService';
import { LeonardoService } from '../services/leonardoService';
import { syncWordpressIndex, uploadMediaFile } from '../services/contentRepository';
import { ApiClientError } from '../services/apiClient';
import { auditArticle } from '../services/seoAuditService';
import { ArticleImagePackage } from './ArticleImagePackage';
import { ArticleSourceResearch } from './ArticleSourceResearch';
import {
  PublishResultDialog,
  type PublishDialogResult
} from './PublishResultDialog';
import { ButtonContent } from './ButtonContent';
import {
  articleContainsImage,
  buildArticleImageMarkup,
  collectArticleAltTexts,
  getArticleImageDimensions,
  mergeUniqueArticleImages,
  sectionHasImage
} from '../utils/articleImageMarkup';

interface LiveEditorPublisherProps {
  article: GeneratedArticle | null;
  wpService: WordpressMcpService;
  leonardoService: LeonardoService;
  onSaveArticle: (
    updatedArticle: GeneratedArticle,
    options?: { serverAuthoritative?: boolean; audit?: SeoAuditResult }
  ) => void;
  setActiveTab: (tab: ActiveTab) => void;
  workflowStep: SeoWorkflowStep;
  onWorkflowStepChange: (step: SeoWorkflowStep) => void;
}

type ArticleEditorView = 'visual' | 'code' | 'edit';

const sanitizeArticleHtml = (html: string) => DOMPurify.sanitize(html, {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['button', 'form', 'input', 'math', 'option', 'select', 'style', 'svg', 'textarea'],
  FORBID_ATTR: ['style']
});

interface VisualArticleEditorProps {
  html: string;
  onChange: (html: string) => void;
}

const VisualArticleEditor: React.FC<VisualArticleEditorProps> = ({ html, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || isFocusedRef.current || editor.innerHTML === html) return;
    editor.innerHTML = html;
  }, [html]);

  const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
    const nextHtml = sanitizeArticleHtml(event.currentTarget.innerHTML);
    if (nextHtml !== event.currentTarget.innerHTML) {
      event.currentTarget.innerHTML = nextHtml;
    }
    onChange(nextHtml);
  };

  return (
    <div
      ref={editorRef}
      className="article-visual-editor"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Nội dung bài viết có thể chỉnh sửa trực quan"
      aria-multiline="true"
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={() => {
        isFocusedRef.current = false;
      }}
      onInput={handleInput}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('a')) event.preventDefault();
      }}
    />
  );
};

export const LiveEditorPublisher: React.FC<LiveEditorPublisherProps> = ({
  article,
  wpService,
  leonardoService,
  onSaveArticle,
  setActiveTab,
  workflowStep,
  onWorkflowStepChange
}) => {
  const [title, setTitle] = useState(article?.title || '');
  const [metaTitle, setMetaTitle] = useState(article?.metaTitle || '');
  const [metaDescription, setMetaDescription] = useState(article?.metaDescription || '');
  const [slug, setSlug] = useState(article?.slug || '');
  const [focusKeyword, setFocusKeyword] = useState(article?.focusKeyword || '');
  const [contentHtml, setContentHtml] = useState(article?.contentHtml || '');
  const [sources, setSources] = useState<ArticleSource[]>(article?.sources || []);
  const [postStatus, setPostStatus] = useState<'draft' | 'publish'>('publish');
  const [activeView, setActiveView] = useState<ArticleEditorView>('visual');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishLogs, setPublishLogs] = useState<string[]>([]);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishAudit, setPublishAudit] = useState<SeoAuditResult | null>(null);
  const [reviewerConfirmed, setReviewerConfirmed] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishDialogResult | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastAutosavedPayloadRef = useRef('');

  useEffect(() => {
    if (!article) return;
    setTitle(article.title);
    setMetaTitle(article.metaTitle);
    setMetaDescription(article.metaDescription);
    setSlug(article.slug);
    setFocusKeyword(article.focusKeyword);
    setContentHtml(article.contentHtml);
    setSources(article.sources || []);
    setPublishLogs([]);
    setPublishedUrl(null);
    setPublishAudit(null);
    setReviewerConfirmed(false);
    setPublishResult(null);
    lastAutosavedPayloadRef.current = JSON.stringify({
      title: article.title,
      metaTitle: article.metaTitle,
      metaDescription: article.metaDescription,
      slug: article.slug,
      focusKeyword: article.focusKeyword,
      contentHtml: article.contentHtml,
      sources: article.sources || []
    });
    // Chỉ khởi tạo lại trình soạn thảo khi người dùng chuyển sang bài khác.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id]);

  useEffect(() => {
    if (!article) return;
    const payload = JSON.stringify({
      title,
      metaTitle,
      metaDescription,
      slug,
      focusKeyword,
      contentHtml,
      sources
    });
    if (payload === lastAutosavedPayloadRef.current) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      lastAutosavedPayloadRef.current = payload;
      onSaveArticle({
        ...article,
        title,
        metaTitle,
        metaDescription,
        slug,
        focusKeyword,
        contentHtml,
        sources,
        status: 'draft'
      });
    }, 900);
    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
    // Autosave only follows editable fields. The article object and callback may
    // change after a successful save without representing a new editor change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id, contentHtml, focusKeyword, metaDescription, metaTitle, slug, sources, title]);

  if (!article) {
    return (
      <div className="glass-panel p-12 rounded-3xl text-center space-y-4 border border-[#0879D9]/15 bg-white">
        <Edit3 className="w-12 h-12 text-[#0879D9]/40 mx-auto" />
        <h3 className="text-lg font-bold text-[#071827]">Chưa Chọn Bài Viết Nào Để Xem</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
          Vui lòng tạo bài viết mới hoặc chọn bài viết từ bảng điều khiển để xem và đăng lên omfit.com.vn.
        </p>
        <button
          onClick={() => setActiveTab('generator')}
          className="gradient-bg-omfit-btn px-5 py-2.5 rounded-xl text-xs font-bold text-white inline-flex items-center gap-2"
        >
          <FilePenLine className="w-4 h-4" /> Bắt đầu tạo bài viết
        </button>
      </div>
    );
  }

  const workingArticle: GeneratedArticle = {
    ...article,
    title,
    metaTitle,
    metaDescription,
    slug,
    focusKeyword,
    contentHtml,
    sources
  };
  const featuredImageDimensions = article.featuredImage
    ? getArticleImageDimensions(article.featuredImage)
    : { width: 1200, height: 896 };
  const clientAudit = auditArticle(workingArticle);
  const approvedSourceCount = sources.filter(
    (source) => source.approved && source.status !== 'broken'
  ).length;
  const inlineImageCount = Number(
    clientAudit.metrics.imageCount
    || clientAudit.metrics.htmlImageCount
    || 0
  );
  const metadataReady = Boolean(
    title.trim()
    && title.trim().length >= 45
    && title.trim().length <= 60
    && metaDescription.trim().length >= 140
    && metaDescription.trim().length <= 160
    && slug.trim()
    && focusKeyword.trim()
  );
  const contentReady = clientAudit.score >= 80
    && !clientAudit.issues.some((issue) => issue.level === 'error');
  const mediaReady = Boolean(
    article.featuredImage?.altText.trim()
    && inlineImageCount >= 2
  );
  const sourceReady = approvedSourceCount > 0;
  const readinessItems = [
    {
      label: 'Metadata và search intent',
      description: metadataReady
        ? 'Tiêu đề, mô tả, slug và focus keyword đã đủ.'
        : 'Cần tiêu đề 45–60 ký tự, mô tả 140–160 ký tự, slug và focus keyword.',
      complete: metadataReady
    },
    {
      label: 'Cấu trúc và điểm SEO',
      description: contentReady
        ? `Bản kiểm tra sớm đạt ${clientAudit.score}/100.`
        : `Điểm hiện tại ${clientAudit.score}/100; cần xử lý các cảnh báo quan trọng.`,
      complete: contentReady
    },
    {
      label: 'Featured image và ảnh trong bài',
      description: mediaReady
        ? `Đã có featured image và ${inlineImageCount} ảnh trong nội dung.`
        : 'Cần featured image có alt text và tối thiểu hai ảnh cho bài dài.',
      complete: mediaReady
    },
    {
      label: 'Nguồn tham khảo đã duyệt',
      description: sourceReady
        ? `Đã duyệt ${approvedSourceCount} nguồn công khai.`
        : 'Chưa có nguồn được duyệt; nội dung sức khỏe nên bổ sung ít nhất một nguồn.',
      complete: sourceReady
    },
    {
      label: 'Xác nhận người kiểm duyệt',
      description: reviewerConfirmed
        ? 'Đã xác nhận bài được người phụ trách kiểm tra.'
        : 'Cần xác nhận reviewer trước khi đưa thông tin kiểm duyệt vào WordPress.',
      complete: reviewerConfirmed
    }
  ];
  const readinessCount = readinessItems.filter((item) => item.complete).length;
  const previewIssues = (publishAudit || clientAudit).issues
    .filter((issue) => issue.level !== 'success');

  const sanitizedPreviewHtml = sanitizeArticleHtml(contentHtml);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyImageInputRef = useRef<HTMLInputElement>(null);

  // Handle direct file upload for Featured Image from local device
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const uploaded = await uploadMediaFile(file, article.id);
        const newImage: GeneratedImage = {
          ...uploaded,
          altText: article.title || uploaded.altText || 'Ảnh đại diện OMFIT',
          role: 'featured'
        };
        const updatedArticle = {
          ...article,
          featuredImage: newImage
        };
        onSaveArticle(updatedArticle);
      } catch (error) {
        console.error('Không thể tải featured image lên kho OMFIT:', error);
      }
    }
  };

  // Handle uploading an image directly into body content
  const handleBodyImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const uploaded = await uploadMediaFile(file, article.id);
        const altText = uploaded.altText || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const image = { ...uploaded, altText, role: 'inline' as const };
        const document = new DOMParser().parseFromString(`<main>${contentHtml}</main>`, 'text/html');
        const main = document.querySelector('main');
        if (!main || articleContainsImage(main, image)) return;
        const heading = [...main.querySelectorAll('h2')]
          .find((item) => (
            !item.closest('.omfit-related-content, .omfit-article-cta, .omfit-article-footer')
            && !sectionHasImage(item)
          ));
        const markup = buildArticleImageMarkup({
          image,
          sectionTitle: heading?.textContent?.trim(),
          articleTitle: article.title,
          focusKeyword: article.focusKeyword,
          existingAltTexts: collectArticleAltTexts(main)
        });
        if (heading) heading.insertAdjacentHTML('afterend', markup.html);
        else main.insertAdjacentHTML('beforeend', markup.html);
        const nextContent = main.innerHTML;
        const normalizedImage = {
          ...image,
          altText: markup.altText,
          caption: markup.caption
        };
        setContentHtml(nextContent);
        onSaveArticle({
          ...article,
          contentHtml: nextContent,
          articleImages: mergeUniqueArticleImages(article.articleImages, [normalizedImage])
        });
      } catch (error) {
        console.error('Không thể tải ảnh nội dung lên kho OMFIT:', error);
      } finally {
        e.target.value = '';
      }
    }
  };

  const handleAltTextChange = (newAlt: string) => {
    if (article.featuredImage) {
      const updatedArticle = {
        ...article,
        featuredImage: {
          ...article.featuredImage,
          altText: newAlt
        }
      };
      onSaveArticle(updatedArticle);
    }
  };

  const handleRemoveImage = () => {
    const updatedArticle = {
      ...article,
      featuredImage: undefined
    };
    onSaveArticle(updatedArticle);
  };

  const handleSaveDraft = () => {
    onSaveArticle({
      ...article,
      title,
      metaTitle,
      metaDescription,
      slug,
      focusKeyword,
      contentHtml,
      sources,
      status: 'draft'
    });
  };

  const handleImagePackageApply = (updatedArticle: GeneratedArticle) => {
    setContentHtml(updatedArticle.contentHtml);
    onSaveArticle({
      ...updatedArticle,
      title,
      metaTitle,
      metaDescription,
      slug,
      focusKeyword
    });
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishLogs([]);
    setPublishedUrl(null);
    setPublishAudit(null);
    setPublishResult(null);

    const currentArticleState: GeneratedArticle = {
      ...article,
      title,
      metaTitle,
      metaDescription,
      slug,
      focusKeyword,
      contentHtml,
      sources
    };

    try {
      const result = await wpService.publishArticleWithMcp(currentArticleState, postStatus, {
        reviewerConfirmed,
        onProgress: (message) => {
          setPublishLogs((currentLogs) => [...currentLogs, message]);
        }
      });
      const nextPublishLogs = [...result.logs];
      let internalIndexSynced = postStatus !== 'publish';
      if (postStatus === 'publish') {
        try {
          const indexResult = await syncWordpressIndex();
          internalIndexSynced = true;
          nextPublishLogs.push(`Đã cập nhật ${indexResult.indexed} URL trong kho internal link.`);
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'Không thể đồng bộ kho internal link.';
          nextPublishLogs.push(`Bài đã đăng nhưng kho internal link chưa đồng bộ: ${detail}`);
        }
      }
      setPublishLogs(nextPublishLogs);
      setPublishedUrl(result.postUrl);
      setPublishAudit(result.audit || null);
      const nextContentHtml = result.contentHtml || currentArticleState.contentHtml;
      const nextSlug = result.slug || currentArticleState.slug;
      const nextTitle = result.title || currentArticleState.title;
      setContentHtml(nextContentHtml);
      setSlug(nextSlug);
      setTitle(nextTitle);

      onSaveArticle({
        ...currentArticleState,
        title: nextTitle,
        contentHtml: nextContentHtml,
        slug: nextSlug,
        status: postStatus === 'publish' ? 'published' : 'draft',
        wpPostId: result.postId,
        wpPostUrl: result.postUrl,
        seoScore: result.audit?.score ?? currentArticleState.seoScore,
        readabilityScore: result.audit?.readabilityScore ?? currentArticleState.readabilityScore,
        seoIssues: result.audit?.issues ?? currentArticleState.seoIssues
      }, { serverAuthoritative: true, audit: result.audit });

      setPublishResult({
        variant: 'success',
        title: postStatus === 'publish' ? 'Đăng bài thành công' : 'Đã lưu bản nháp',
        message: postStatus === 'publish'
          ? `Bài viết “${nextTitle}” đã được xuất bản lên omfit.com.vn.`
          : `Bài viết “${nextTitle}” đã được lưu dưới dạng bản nháp trên WordPress.`,
        postUrl: result.postUrl,
        checks: postStatus === 'publish' ? [
          {
            label: 'URL công khai',
            status: result.seoDiscovery?.publicPage.ok ? 'success' : 'warning',
            detail: result.seoDiscovery?.publicPage.ok
              ? 'HTTP 200, canonical, robots và một H1 hợp lệ.'
              : result.seoDiscovery?.publicPage.error || 'Chưa vượt qua toàn bộ hậu kiểm.'
          },
          {
            label: 'WordPress sitemap',
            status: result.seoDiscovery?.sitemap.found ? 'success' : 'warning',
            detail: result.seoDiscovery?.sitemap.found
              ? 'URL đã có trong sitemap bài viết.'
              : result.seoDiscovery?.sitemap.error || 'Chưa tìm thấy URL trong sitemap.'
          },
          {
            label: 'Kho internal link',
            status: internalIndexSynced ? 'success' : 'warning',
            detail: internalIndexSynced
              ? 'Đã đồng bộ ngay sau khi xuất bản.'
              : 'Sẽ thử lại khi ứng dụng được tải lại.'
          },
          {
            label: 'Google Search Console',
            status: result.seoDiscovery?.google.sitemapSubmitted
              ? 'success'
              : result.seoDiscovery?.google.configured ? 'warning' : 'pending',
            detail: result.seoDiscovery?.google.sitemapSubmitted
              ? `Đã gửi sitemap.${result.seoDiscovery.google.inspection?.coverageState
                ? ` Trạng thái hiện tại: ${result.seoDiscovery.google.inspection.coverageState}.`
                : ''}`
              : result.seoDiscovery?.google.error
                || 'Chưa có credentials; Google vẫn có thể khám phá bài qua sitemap.'
          }
        ] : undefined
      });
    } catch (err: unknown) {
      console.error('WordPress Publishing Failed:', err);
      const message = err instanceof Error ? err.message : 'Không thể đăng bài lên WordPress.';
      let auditFailed = false;
      if (err instanceof ApiClientError) {
        const payload = err.payload as {
          audit?: SeoAuditResult;
          contentHtml?: string;
          slug?: string;
        };
        if (payload.audit) {
          auditFailed = !payload.audit.passed;
          setPublishAudit(payload.audit);
          setPublishLogs(
            payload.audit.issues
              .filter((issue) => issue.level !== 'success')
              .map((issue) => issue.message)
          );
        }
        if (payload.contentHtml || payload.slug) {
          const nextContentHtml = payload.contentHtml || currentArticleState.contentHtml;
          const nextSlug = payload.slug || currentArticleState.slug;
          setContentHtml(nextContentHtml);
          setSlug(nextSlug);
          onSaveArticle({
            ...currentArticleState,
            contentHtml: nextContentHtml,
            slug: nextSlug,
            seoScore: payload.audit?.score ?? currentArticleState.seoScore,
            readabilityScore: payload.audit?.readabilityScore ?? currentArticleState.readabilityScore,
            seoIssues: payload.audit?.issues ?? currentArticleState.seoIssues
          }, { serverAuthoritative: true, audit: payload.audit });
        }
      }
      setPublishResult({
        variant: 'error',
        title: auditFailed ? 'Bài viết chưa sẵn sàng để đăng' : 'Đăng bài chưa thành công',
        message: auditFailed
          ? `${message}\nCác mục cần xử lý đã được hiển thị trong phần kiểm tra SEO bên dưới.`
          : `${message}\nBạn có thể xem nhật ký xử lý bên dưới rồi thử lại.`
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="ui-page space-y-6">
      <PublishResultDialog
        result={publishResult}
        onClose={() => setPublishResult(null)}
      />
      {/* Top Banner Actions */}
      <div className="ui-page-header flex flex-col items-start justify-between gap-4 p-5 sm:p-6 md:flex-row md:items-center">
        <div>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#E0F2FE] text-[#0879D9] border border-[#0879D9]/30 flex items-center gap-1 inline-flex">
            <Activity className="w-3 h-3" />
            {workflowStep === 4 ? 'QUALITY GATE' : 'CONTENT WORKSPACE'}
          </span>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#17191D]">
            {workflowStep === 4 ? 'Kiểm duyệt và xuất bản' : 'Hoàn thiện nội dung và hình ảnh'}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {workflowStep === 4
              ? 'Rà soát checklist cuối cùng; WordPress sẽ kiểm tra lại toàn bộ quality gate trước khi đăng.'
              : 'Biên tập nội dung, bổ sung nguồn và hình ảnh trước khi chuyển sang bước kiểm duyệt cuối.'}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="min-h-11 flex-1 rounded-xl border border-[#0879D9]/25 bg-white px-4 text-xs font-bold text-[#0879D9] hover:bg-[#F0F9FF] sm:flex-none"
          >
            Lưu bản nháp
          </button>
          {workflowStep === 3 ? (
            <button
              type="button"
              onClick={() => onWorkflowStepChange(4)}
              className="gradient-bg-omfit-btn inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-xs font-bold text-white shadow-md shadow-[#0879D9]/20 sm:flex-none"
            >
              Sang bước kiểm duyệt <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              <select
                aria-label="Trạng thái bài trên WordPress"
                value={postStatus}
                onChange={(e) => setPostStatus(e.target.value as 'draft' | 'publish')}
                className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-xs font-bold text-[#071827] focus:outline-none sm:flex-none"
              >
                <option value="publish">Xuất bản ngay</option>
                <option value="draft">Lưu bản nháp WordPress</option>
              </select>

              <button
                onClick={handlePublish}
                disabled={isPublishing}
                aria-busy={isPublishing}
                className="ui-action-button gradient-bg-omfit-btn inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white shadow-md shadow-[#0879D9]/20 disabled:opacity-50 sm:max-w-56 sm:flex-none"
              >
                <ButtonContent
                  busy={isPublishing}
                  busyLabel="Đang đăng bài..."
                  label="Đăng bài"
                  icon={<Globe className="h-4 w-4" />}
                />
              </button>
            </>
          )}
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-700">
        <input
          type="checkbox"
          checked={reviewerConfirmed}
          onChange={(event) => setReviewerConfirmed(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0879D9] focus:ring-[#0879D9]"
        />
        <span>
          Tôi xác nhận người kiểm duyệt trong Brand Settings đã thực sự kiểm tra bài này.
          Chỉ khi xác nhận, thông tin reviewer mới được đưa vào schema và metadata WordPress.
        </span>
      </label>

      <section className="ui-panel overflow-hidden border-[#0879D9]/15 bg-white" aria-labelledby="publish-readiness-title">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#0879D9]" />
              <h3 id="publish-readiness-title" className="text-sm font-semibold text-[#17191D]">
                Checklist sẵn sàng xuất bản
              </h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Đây là kiểm tra sớm trên trình duyệt. Máy chủ vẫn chạy quality gate chính thức trước khi gửi WordPress.
            </p>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="text-lg font-semibold text-[#17191D]">{readinessCount}/5</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Mục hoàn tất</p>
          </div>
        </div>
        <div className="h-1.5 bg-slate-100">
          <div
            className="h-full bg-[#0879D9] transition-all"
            style={{ width: `${readinessCount * 20}%` }}
          />
        </div>
        <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-5">
          {readinessItems.map((item) => (
            <div key={item.label} className="flex items-start gap-2.5 bg-white p-4">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                item.complete
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}>
                {item.complete
                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                  : <AlertTriangle className="h-3.5 w-3.5" />}
              </span>
              <div>
                <p className="text-xs font-semibold text-[#17191D]">{item.label}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div id="article-images" className="scroll-mt-28">
        <ArticleImagePackage
          article={article}
          contentHtml={contentHtml}
          leonardoService={leonardoService}
          onApplyArticle={handleImagePackageApply}
        />
      </div>

      <div id="article-sources" className="scroll-mt-28">
        <ArticleSourceResearch
          articleId={article.id}
          title={title}
          focusKeyword={focusKeyword}
          contentHtml={contentHtml}
          initialSources={sources}
          onSourcesChange={(nextSources) => {
            setSources(nextSources);
            onSaveArticle({
              ...article,
              title,
              metaTitle,
              metaDescription,
              slug,
              focusKeyword,
              contentHtml,
              sources: nextSources
            });
          }}
          onContentApplied={(nextContentHtml, nextSources) => {
            setContentHtml(nextContentHtml);
            setSources(nextSources);
            onSaveArticle({
              ...article,
              title,
              metaTitle,
              metaDescription,
              slug,
              focusKeyword,
              contentHtml: nextContentHtml,
              sources: nextSources
            });
          }}
        />
      </div>

      {publishAudit && !publishAudit.passed && (
        <section role="alert" className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <h3 className="text-base font-medium text-amber-900">Bài viết chưa vượt qua kiểm tra trước khi đăng</h3>
          <p className="mt-1 text-sm font-normal leading-6 text-amber-800">
            Điểm SEO hiện tại: {publishAudit.score}/100. Hãy xử lý các mục lỗi bên dưới rồi đăng lại.
          </p>
          <ul className="mt-3 space-y-2 text-sm font-normal text-amber-900">
            {publishAudit.issues
              .filter((issue) => issue.level !== 'success')
              .map((issue) => (
                <li key={issue.code} className="rounded-xl border border-amber-200 bg-white/70 px-3 py-2">
                  {issue.message}
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel p-5 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
            <h3 className="text-xs font-extrabold text-[#071827] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <ShieldCheck className="w-4 h-4 text-[#0879D9]" /> Tiêu Đề & Thẻ SEO Meta
            </h3>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Tiêu Đề H1 Bài Viết</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-xs font-bold focus:border-[#0879D9] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Meta Title SEO</label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-xs font-semibold focus:border-[#0879D9] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Meta Description</label>
              <textarea
                rows={3}
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] text-xs font-medium focus:border-[#0879D9] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Từ Khóa SEO</label>
                <input
                  type="text"
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#0879D9] text-xs font-mono font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Slug URL</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-slate-700 text-xs font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Featured Image Management Panel */}
          <div className="glass-panel p-5 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <h3 className="text-xs font-extrabold text-[#071827] uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-[#0879D9]" /> Ảnh Đại Diện (Featured Image)
              </h3>
              {article.featuredImage?.source === 'upload' && (
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-[#E0F2FE] text-[#0879D9]">
                  ẢNH TẢI LÊN
                </span>
              )}
            </div>

            {/* Hidden Input File for Local Device Upload */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <input
              type="file"
              ref={bodyImageInputRef}
              accept="image/*"
              onChange={handleBodyImageUpload}
              className="hidden"
            />

            {article.featuredImage ? (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-[#0879D9]/30 group bg-[#F8FAFC]">
                  <img
                    src={article.featuredImage.url}
                    alt={article.featuredImage.altText}
                    width={featuredImageDimensions.width}
                    height={featuredImageDimensions.height}
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 768px) 100vw, 384px"
                    className="w-full h-44 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-xl bg-white text-[#0879D9] font-bold text-xs shadow-md hover:bg-slate-50 transition flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Thay ảnh
                    </button>
                    <button
                      onClick={handleRemoveImage}
                      className="p-2 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-md hover:bg-rose-700 transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-[#0879D9]" /> Alt Text Tối Ưu SEO
                  </label>
                  <input
                    type="text"
                    value={article.featuredImage.altText}
                    onChange={(e) => handleAltTextChange(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs text-[#071827] font-medium focus:border-[#0879D9] focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 px-3 py-2 rounded-xl bg-[#F0F9FF] text-[#0879D9] border border-[#0879D9]/30 hover:bg-[#0879D9] hover:text-white transition font-bold text-[11px] flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" /> Tải Ảnh Khác Từ Máy Tính
                  </button>
                  <button
                    onClick={() => setActiveTab('imagestudio')}
                    className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition font-bold text-[11px] flex items-center gap-1"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[#0879D9]" /> Ảnh được tạo
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 text-center border-2 border-dashed border-slate-300 hover:border-[#0879D9] rounded-2xl cursor-pointer transition space-y-2 bg-[#F8FAFC] hover:bg-[#F0F9FF]"
                >
                  <div className="w-10 h-10 rounded-full bg-[#E0F2FE] text-[#0879D9] flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#071827]">Tải Ảnh Trực Tiếp Từ Máy Tính</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Click vào đây để chọn file ảnh PNG, JPG, WEBP...</p>
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Hoặc</div>

                <button
                  onClick={() => setActiveTab('imagestudio')}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F0F9FF] text-[#0879D9] border border-[#0879D9]/30 hover:bg-[#0879D9] hover:text-white transition font-bold text-xs flex items-center justify-center gap-2"
                >
                  <ImageIcon className="w-4 h-4" /> Tạo ảnh mới
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Body Content & Preview Column */}
        <div className="lg:col-span-8 glass-panel p-6 rounded-3xl space-y-4 border border-[#0879D9]/15 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView('visual')}
                aria-pressed={activeView === 'visual'}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  activeView === 'visual'
                    ? 'bg-[#E0F2FE] text-[#0879D9] border border-[#0879D9]/30'
                    : 'text-slate-500 hover:text-[#0879D9]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Xem trực quan
              </button>
              <button
                type="button"
                onClick={() => setActiveView('code')}
                aria-pressed={activeView === 'code'}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  activeView === 'code'
                    ? 'bg-[#E0F2FE] text-[#0879D9] border border-[#0879D9]/30'
                    : 'text-slate-500 hover:text-[#0879D9]'
                }`}
              >
                <Code className="w-3.5 h-3.5" /> Chế độ sửa HTML
              </button>
              <button
                type="button"
                onClick={() => setActiveView('edit')}
                aria-pressed={activeView === 'edit'}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  activeView === 'edit'
                    ? 'bg-[#E0F2FE] text-[#0879D9] border border-[#0879D9]/30'
                    : 'text-slate-500 hover:text-[#0879D9]'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" /> Chế độ sửa bài
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => bodyImageInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-[#F0F9FF] text-[#0879D9] border border-[#0879D9]/30 hover:bg-[#0879D9] hover:text-white transition font-bold text-[11px] flex items-center gap-1.5"
                title="Chèn ảnh bất kỳ từ máy tính vào giữa bài viết"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Chèn Ảnh Vào Bài Viết
              </button>

              <span className="text-xs font-mono text-[#0879D9] flex items-center gap-1 font-extrabold">
                <Award className="w-3.5 h-3.5 text-[#0879D9]" /> SEO Score: {article.seoScore > 0 ? `${article.seoScore}/100` : 'Chưa chấm'}
              </span>
            </div>
          </div>

          {activeView === 'code' ? (
            <textarea
              rows={20}
              value={contentHtml}
              onChange={(e) => setContentHtml(e.target.value)}
              aria-label="Mã HTML của bài viết"
              className="w-full p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#071827] font-mono text-xs focus:outline-none focus:border-[#0879D9]"
            />
          ) : (
            <div className={`article-preview bg-[#233968] rounded-2xl border border-[#40558A] min-h-[450px] prose-custom overflow-y-auto max-h-[680px] ${
              activeView === 'edit' ? 'article-preview--editing' : ''
            }`}>
              <h1>{title}</h1>
              {article.featuredImage && (
                <figure className="mb-6 text-center">
                  <img
                    src={article.featuredImage.url}
                    alt={article.featuredImage.altText}
                    width={featuredImageDimensions.width}
                    height={featuredImageDimensions.height}
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="w-full h-80 object-cover rounded-2xl border border-slate-200 shadow-sm mx-auto"
                  />
                  <figcaption className="text-xs text-slate-500 italic mt-2">
                    {article.featuredImage.altText}
                  </figcaption>
                </figure>
              )}
              {activeView === 'edit' ? (
                <VisualArticleEditor html={sanitizedPreviewHtml} onChange={setContentHtml} />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: sanitizedPreviewHtml }} />
              )}
              {previewIssues.length > 0 && (
                <aside className="seo-audit-notes" aria-label="Các mục cần kiểm tra trước khi xuất bản">
                  <div className="seo-audit-notes__header">
                    <span className="seo-audit-notes__icon" aria-hidden="true">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div className="seo-audit-notes__heading">
                      <span className="seo-audit-notes__eyebrow">Kiểm tra SEO</span>
                      <strong>Các mục cần kiểm tra trước khi xuất bản</strong>
                    </div>
                    <span className="seo-audit-notes__count">
                      {previewIssues.length} mục
                    </span>
                  </div>
                  <ul>
                    {previewIssues.map((issue) => <li key={issue.code}>{issue.message}</li>)}
                  </ul>
                </aside>
              )}
            </div>
          )}
        </div>
      </div>

      {publishLogs.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl space-y-3 border border-[#0879D9]/30 bg-white">
          <h3 className="text-xs font-bold text-[#0879D9] uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#0879D9]" /> Nhật Ký Đăng Bài Trực Tiếp Tới MCP WordPress (omfit.com.vn)
          </h3>
          <div className="p-4 rounded-xl bg-[#071827] font-mono text-xs text-[#F3F0E9] space-y-1 max-h-48 overflow-y-auto border border-[#0879D9]/30">
            {publishLogs.map((log, i) => (
              <p key={i} className={log.includes('THÀNH CÔNG') ? 'text-[#28A9F4] font-bold' : ''}>
                {log}
              </p>
            ))}
          </div>

          {publishedUrl && (
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-[#0879D9] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Bài viết đã xuất bản thành công lên website omfit.com.vn!
              </div>
              <a
                href={publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="gradient-bg-omfit-btn px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-md shadow-[#0879D9]/20"
              >
                Mở Xem Bài Viết Trực Tiếp Trên Web <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
