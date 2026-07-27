import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  MapPin,
  Plus,
  Save,
  Trash2,
  Upload,
  UserRoundCheck
} from 'lucide-react';
import type { BrandAsset, BrandBranch, BrandProfile } from '../types';
import { saveBrandProfile, uploadBrandAsset } from '../services/contentRepository';

interface BrandSettingsProps {
  profile: BrandProfile | null;
  assets: BrandAsset[];
  onProfileSaved: (profile: BrandProfile) => void;
  onAssetUploaded: (asset: BrandAsset) => void;
}

const inputClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2.5 text-base leading-6 text-[#071827] outline-none transition placeholder:text-slate-400 focus:border-[#0879D9] focus:ring-2 focus:ring-[#0879D9]/10';
const brandAssetMaxBytes = 10 * 1024 * 1024;
const brandAssetMimeTypes = {
  logo: new Set(['image/jpeg', 'image/png', 'image/webp']),
  guideline: new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/markdown',
    'text/plain'
  ])
};

function createBranch(): BrandBranch {
  return {
    id: crypto.randomUUID(),
    name: '',
    address: '',
    phone: '',
    email: '',
    services: [],
    ctaUrl: ''
  };
}

export const BrandSettings: React.FC<BrandSettingsProps> = ({
  profile,
  assets,
  onProfileSaved,
  onAssetUploaded
}) => {
  const [draft, setDraft] = useState<BrandProfile | null>(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState<'logo' | 'guideline' | null>(null);
  const [message, setMessage] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const guidelineInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(profile), [profile]);

  if (!draft?.id) {
    return (
      <div className="grid min-h-[360px] place-items-center rounded-3xl border border-[#0879D9]/15 bg-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#0879D9] border-t-transparent" />
          <p className="mt-3 text-sm font-normal text-slate-600">Đang tải cài đặt thương hiệu...</p>
        </div>
      </div>
    );
  }

  const updateCompany = (key: keyof BrandProfile['companyInfo'], value: string) => {
    setDraft((current) => current ? {
      ...current,
      companyInfo: { ...current.companyInfo, [key]: value }
    } : current);
  };

  const updateFooter = (key: keyof BrandProfile['footerSettings'], value: string | boolean) => {
    setDraft((current) => current ? {
      ...current,
      footerSettings: { ...current.footerSettings, [key]: value }
    } : current);
  };

  const updateEditorial = (key: keyof BrandProfile['editorialSettings'], value: string) => {
    setDraft((current) => current ? {
      ...current,
      editorialSettings: { ...current.editorialSettings, [key]: value }
    } : current);
  };

  const updateBranch = (id: string, key: keyof BrandBranch, value: string | string[]) => {
    setDraft((current) => current ? {
      ...current,
      branches: current.branches.map((branch) => branch.id === id ? { ...branch, [key]: value } : branch)
    } : current);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      const saved = await saveBrandProfile(draft);
      setDraft(saved);
      onProfileSaved(saved);
      setMessage('Đã lưu cài đặt thương hiệu. Nội dung, footer và ảnh mới sẽ dùng cấu hình này.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể lưu cài đặt thương hiệu.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssetUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    assetType: 'logo' | 'guideline'
  ) => {
    const file = event.target.files?.[0];
    if (!file || !draft.id) return;
    if (file.size > brandAssetMaxBytes) {
      setMessage('Tệp vượt quá giới hạn 10 MB.');
      event.target.value = '';
      return;
    }
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const acceptedByExtension = assetType === 'logo'
      ? ['jpeg', 'jpg', 'png', 'webp'].includes(extension)
      : ['docx', 'jpeg', 'jpg', 'md', 'pdf', 'png', 'txt', 'webp'].includes(extension);
    if (!brandAssetMimeTypes[assetType].has(file.type) && !acceptedByExtension) {
      setMessage(assetType === 'logo'
        ? 'Logo chỉ hỗ trợ PNG, JPG hoặc WEBP.'
        : 'Brand guideline chỉ hỗ trợ PDF, DOCX, TXT, Markdown, PNG, JPG hoặc WEBP.');
      event.target.value = '';
      return;
    }
    setIsUploading(assetType);
    setMessage('');
    try {
      const asset = await uploadBrandAsset(file, draft.id, assetType);
      onAssetUploaded(asset);
      setMessage(assetType === 'logo'
        ? 'Đã lưu logo OMFIT vào kho tài sản thương hiệu.'
        : 'Đã lưu tài liệu hướng dẫn thương hiệu vào kho riêng tư.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tải tài sản thương hiệu.');
    } finally {
      setIsUploading(null);
      event.target.value = '';
    }
  };

  const logos = assets.filter((asset) => asset.assetType === 'logo');
  const guidelines = assets.filter((asset) => asset.assetType === 'guideline');

  return (
    <div className="font-vietnamese space-y-6">
      <header className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#0879D9]">Nguồn dữ liệu thương hiệu</p>
            <h2 className="mt-1 text-xl font-medium text-[#071827]">Cài đặt thương hiệu OMFIT</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Thông tin tại đây được dùng cho nội dung bài viết, footer và ngữ cảnh tạo ảnh trước khi đăng WordPress.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="gradient-bg-omfit-btn inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <Save className="h-4 w-4" />}
            {isSaving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>
        {message && (
          <div aria-live="polite" className="mt-4 flex items-start gap-2 rounded-xl bg-[#F0F9FF] p-3 text-sm font-normal text-[#075EA8]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#0879D9]" />
            <h3 className="text-base font-medium text-[#071827]">Thông tin OMFIT</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-normal text-slate-700">
              Tên hiển thị
              <input className={inputClass} value={draft.companyInfo.displayName} onChange={(event) => updateCompany('displayName', event.target.value)} />
            </label>
            <label className="text-sm font-normal text-slate-700">
              Tên pháp lý
              <input className={inputClass} value={draft.companyInfo.legalName} onChange={(event) => updateCompany('legalName', event.target.value)} />
            </label>
            <label className="text-sm font-normal text-slate-700">
              Khẩu hiệu
              <input className={inputClass} value={draft.companyInfo.tagline} onChange={(event) => updateCompany('tagline', event.target.value)} />
            </label>
            <label className="text-sm font-normal text-slate-700">
              Website
              <input type="url" className={inputClass} value={draft.companyInfo.website} onChange={(event) => updateCompany('website', event.target.value)} />
            </label>
            <label className="text-sm font-normal text-slate-700">
              Hotline
              <input type="tel" className={inputClass} value={draft.companyInfo.hotline} onChange={(event) => updateCompany('hotline', event.target.value)} />
            </label>
            <label className="text-sm font-normal text-slate-700">
              Email
              <input type="email" className={inputClass} value={draft.companyInfo.email} onChange={(event) => updateCompany('email', event.target.value)} />
            </label>
          </div>
          <label className="mt-4 block text-sm font-normal text-slate-700">
            Sứ mệnh
            <textarea rows={3} className={inputClass} value={draft.mission} onChange={(event) => setDraft({ ...draft, mission: event.target.value })} />
          </label>
          <label className="mt-4 block text-sm font-normal text-slate-700">
            Định vị thương hiệu
            <textarea rows={3} className={inputClass} value={draft.positioning} onChange={(event) => setDraft({ ...draft, positioning: event.target.value })} />
          </label>
        </section>

        <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#0879D9]" />
            <h3 className="text-base font-medium text-[#071827]">Hướng dẫn và tài sản thương hiệu</h3>
          </div>
          <input ref={logoInputRef} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleAssetUpload(event, 'logo')} />
          <input ref={guidelineInputRef} className="hidden" type="file" accept=".pdf,.docx,.txt,.md,image/png,image/jpeg,image/webp" onChange={(event) => void handleAssetUpload(event, 'guideline')} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => logoInputRef.current?.click()} disabled={isUploading !== null} className="min-h-28 rounded-2xl border-2 border-dashed border-[#0879D9]/30 bg-[#F8FAFC] p-4 text-left transition hover:border-[#0879D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879D9] disabled:cursor-not-allowed disabled:opacity-50">
              <ImageIcon className="h-5 w-5 text-[#0879D9]" />
              <span className="mt-2 block text-sm font-medium text-[#071827]">{isUploading === 'logo' ? 'Đang tải logo...' : 'Tải logo lên'}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">PNG, JPG hoặc WEBP. Logo đã lưu có thể được chọn làm ảnh tham chiếu trong Image Studio.</span>
            </button>
            <button type="button" onClick={() => guidelineInputRef.current?.click()} disabled={isUploading !== null} className="min-h-28 rounded-2xl border-2 border-dashed border-[#0879D9]/30 bg-[#F8FAFC] p-4 text-left transition hover:border-[#0879D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0879D9] disabled:cursor-not-allowed disabled:opacity-50">
              <Upload className="h-5 w-5 text-[#0879D9]" />
              <span className="mt-2 block text-sm font-medium text-[#071827]">{isUploading === 'guideline' ? 'Đang tải tài liệu...' : 'Tải hướng dẫn lên'}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">PDF, DOCX, TXT, MD hoặc ảnh. Tài liệu được lưu trong kho riêng tư.</span>
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Logo đã lưu</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {logos.length
                  ? logos.map((asset) => asset.url ? (
                    <figure key={asset.id} className="w-24">
                      <img src={asset.url} alt={`Logo ${asset.name}`} className="h-14 w-24 rounded-lg border border-slate-200 bg-white object-contain p-1" />
                      <figcaption className="mt-1 truncate text-[10px] text-slate-500" title={asset.name}>{asset.name}</figcaption>
                    </figure>
                  ) : null)
                  : <span className="text-xs text-slate-400">Chưa có logo</span>}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tài liệu hướng dẫn</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {guidelines.length
                  ? guidelines.map((asset) => <li key={asset.id} className="truncate" title={asset.name}>{asset.name}</li>)
                  : <li className="text-slate-400">Chưa có tài liệu</li>}
              </ul>
            </div>
          </div>
          <label className="mt-4 block text-sm font-normal text-slate-700">
            Tóm tắt hướng dẫn thương hiệu cho hệ thống tạo nội dung và ảnh
            <textarea rows={6} className={inputClass} value={draft.guidelineNotes} onChange={(event) => setDraft({ ...draft, guidelineNotes: event.target.value })} />
            <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">Ghi lại màu sắc, cách dùng logo, phong cách hình ảnh và những điều cần tránh để hệ thống đưa trực tiếp vào prompt.</span>
          </label>
        </section>
      </div>

      <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-2">
          <UserRoundCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0879D9]" />
          <div>
            <h3 className="text-base font-medium text-[#071827]">Tác giả và người kiểm duyệt</h3>
            <p className="mt-1 text-xs font-normal leading-5 text-slate-500">
              Thông tin này được dùng cho phần tác giả hiển thị trong bài và dữ liệu cấu trúc Article.
              Chỉ nhập người thực sự chịu trách nhiệm nội dung.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-normal text-slate-700">
            Tên tác giả
            <input
              className={inputClass}
              value={draft.editorialSettings.authorName}
              onChange={(event) => updateEditorial('authorName', event.target.value)}
              placeholder="Ví dụ: Đội ngũ chuyên môn OMFIT"
            />
          </label>
          <label className="text-sm font-normal text-slate-700">
            Trang hồ sơ tác giả
            <input
              type="url"
              className={inputClass}
              value={draft.editorialSettings.authorUrl}
              onChange={(event) => updateEditorial('authorUrl', event.target.value)}
              placeholder="https://omfit.com.vn/..."
            />
          </label>
          <label className="text-sm font-normal text-slate-700">
            Vai trò của tác giả
            <input
              className={inputClass}
              value={draft.editorialSettings.authorJobTitle}
              onChange={(event) => updateEditorial('authorJobTitle', event.target.value)}
              placeholder="Ví dụ: Huấn luyện viên Pilates"
            />
          </label>
          <label className="text-sm font-normal text-slate-700">
            Tên người kiểm duyệt chuyên môn
            <input
              className={inputClass}
              value={draft.editorialSettings.reviewerName}
              onChange={(event) => updateEditorial('reviewerName', event.target.value)}
              placeholder="Để trống nếu bài không qua kiểm duyệt chuyên môn"
            />
          </label>
          <label className="text-sm font-normal text-slate-700">
            Trang hồ sơ người kiểm duyệt
            <input
              type="url"
              className={inputClass}
              value={draft.editorialSettings.reviewerUrl}
              onChange={(event) => updateEditorial('reviewerUrl', event.target.value)}
              placeholder="https://omfit.com.vn/..."
            />
          </label>
          <label className="text-sm font-normal text-slate-700">
            Chuyên môn hoặc chứng chỉ
            <input
              className={inputClass}
              value={draft.editorialSettings.reviewerCredentials}
              onChange={(event) => updateEditorial('reviewerCredentials', event.target.value)}
              placeholder="Ví dụ: Huấn luyện viên Pilates được chứng nhận"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#0879D9]" />
            <div>
              <h3 className="text-base font-medium text-[#071827]">Chi nhánh OMFIT</h3>
              <p className="text-xs leading-5 text-slate-500">Địa chỉ và dịch vụ được dùng làm dữ kiện cho bài viết, ảnh và footer.</p>
            </div>
          </div>
          <button type="button" onClick={() => setDraft({ ...draft, branches: [...draft.branches, createBranch()] })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#0879D9]/30 bg-[#F0F9FF] px-4 text-sm font-medium text-[#0879D9]">
            <Plus className="h-4 w-4" /> Thêm chi nhánh
          </button>
        </div>
        <div className="space-y-4">
          {draft.branches.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-[#F8FAFC] p-6 text-center text-sm text-slate-500">
              Chưa có chi nhánh. Thêm dữ liệu để hệ thống không tự suy đoán địa chỉ khi tạo nội dung.
            </div>
          )}
          {draft.branches.map((branch, index) => (
            <fieldset key={branch.id} className="rounded-2xl border border-slate-200 p-4">
              <legend className="px-2 text-sm font-medium text-[#071827]">Chi nhánh {index + 1}</legend>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="text-sm font-normal text-slate-700">Tên chi nhánh<input className={inputClass} value={branch.name} onChange={(event) => updateBranch(branch.id, 'name', event.target.value)} /></label>
                <label className="text-sm font-normal text-slate-700">Địa chỉ<input className={inputClass} value={branch.address} onChange={(event) => updateBranch(branch.id, 'address', event.target.value)} /></label>
                <label className="text-sm font-normal text-slate-700">Điện thoại<input className={inputClass} value={branch.phone} onChange={(event) => updateBranch(branch.id, 'phone', event.target.value)} /></label>
                <label className="text-sm font-normal text-slate-700">Email<input type="email" className={inputClass} value={branch.email} onChange={(event) => updateBranch(branch.id, 'email', event.target.value)} /></label>
                <label className="text-sm font-normal text-slate-700">Dịch vụ, cách nhau bằng dấu phẩy<input className={inputClass} value={branch.services.join(', ')} onChange={(event) => updateBranch(branch.id, 'services', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} /></label>
                <label className="text-sm font-normal text-slate-700">URL đăng ký<input type="url" className={inputClass} value={branch.ctaUrl} onChange={(event) => updateBranch(branch.id, 'ctaUrl', event.target.value)} /></label>
              </div>
              <button type="button" onClick={() => setDraft({ ...draft, branches: draft.branches.filter((item) => item.id !== branch.id) })} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-medium text-rose-600 hover:bg-rose-50">
                <Trash2 className="h-4 w-4" /> Xóa chi nhánh
              </button>
            </fieldset>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
        <h3 className="text-base font-medium text-[#071827]">Footer bài viết</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-normal text-slate-700">Tiêu đề footer<input className={inputClass} value={draft.footerSettings.heading} onChange={(event) => updateFooter('heading', event.target.value)} /></label>
          <label className="text-sm font-normal text-slate-700">Nhãn CTA<input className={inputClass} value={draft.footerSettings.ctaLabel} onChange={(event) => updateFooter('ctaLabel', event.target.value)} /></label>
          <label className="text-sm font-normal text-slate-700 md:col-span-2">Mô tả<textarea rows={3} className={inputClass} value={draft.footerSettings.description} onChange={(event) => updateFooter('description', event.target.value)} /></label>
          <label className="text-sm font-normal text-slate-700 md:col-span-2">URL CTA<input type="url" className={inputClass} value={draft.footerSettings.ctaUrl} onChange={(event) => updateFooter('ctaUrl', event.target.value)} /></label>
          <label className="inline-flex min-h-11 items-center gap-3 text-sm font-normal text-slate-700">
            <input type="checkbox" checked={draft.footerSettings.enabled} onChange={(event) => updateFooter('enabled', event.target.checked)} className="h-5 w-5 accent-[#0879D9]" />
            Hiển thị footer OMFIT trong bài viết
          </label>
        </div>
      </section>
    </div>
  );
};
