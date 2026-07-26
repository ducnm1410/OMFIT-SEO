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
  Upload
} from 'lucide-react';
import type { BrandAsset, BrandBranch, BrandProfile } from '../types';
import {
  saveBrandProfile,
  uploadBrandAsset
} from '../services/contentRepository';

interface BrandSettingsProps {
  profile: BrandProfile | null;
  assets: BrandAsset[];
  onProfileSaved: (profile: BrandProfile) => void;
  onAssetUploaded: (asset: BrandAsset) => void;
}

const inputClass = 'w-full min-h-11 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#071827] outline-none transition focus:border-[#0879D9] focus:ring-2 focus:ring-[#0879D9]/10';

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
          <p className="mt-3 text-sm font-semibold text-slate-600">Đang tải Brand Settings...</p>
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
      setMessage('Đã lưu Brand Guideline. Nội dung, footer và ảnh mới sẽ dùng cấu hình này.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể lưu Brand Settings.');
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
    setIsUploading(assetType);
    setMessage('');
    try {
      const asset = await uploadBrandAsset(file, draft.id, assetType);
      onAssetUploaded(asset);
      setMessage(assetType === 'logo'
        ? 'Đã lưu logo OMFIT vào Brand Assets.'
        : 'Đã lưu tài liệu guideline vào kho riêng tư.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể tải Brand Asset.');
    } finally {
      setIsUploading(null);
      event.target.value = '';
    }
  };

  const logos = assets.filter((asset) => asset.assetType === 'logo');
  const guidelines = assets.filter((asset) => asset.assetType === 'guideline');

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#0879D9]">Nguồn dữ liệu thương hiệu</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#071827]">OMFIT Brand Settings</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Thông tin tại đây được dùng cho prompt tạo ảnh, nội dung bài viết và footer trước khi đăng WordPress.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="gradient-bg-omfit-btn inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            {isSaving
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <Save className="h-4 w-4" />}
            {isSaving ? 'Đang lưu...' : 'Lưu Brand Settings'}
          </button>
        </div>
        {message && (
          <div aria-live="polite" className="mt-4 flex items-start gap-2 rounded-xl bg-[#F0F9FF] p-3 text-sm font-semibold text-[#075EA8]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#0879D9]" />
            <h3 className="text-base font-extrabold text-[#071827]">Thông tin OMFIT</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-700">
              Tên hiển thị
              <input className={`${inputClass} mt-1.5`} value={draft.companyInfo.displayName} onChange={(event) => updateCompany('displayName', event.target.value)} />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Tên pháp lý
              <input className={`${inputClass} mt-1.5`} value={draft.companyInfo.legalName} onChange={(event) => updateCompany('legalName', event.target.value)} />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Tagline
              <input className={`${inputClass} mt-1.5`} value={draft.companyInfo.tagline} onChange={(event) => updateCompany('tagline', event.target.value)} />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Website
              <input type="url" className={`${inputClass} mt-1.5`} value={draft.companyInfo.website} onChange={(event) => updateCompany('website', event.target.value)} />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Hotline
              <input type="tel" className={`${inputClass} mt-1.5`} value={draft.companyInfo.hotline} onChange={(event) => updateCompany('hotline', event.target.value)} />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Email
              <input type="email" className={`${inputClass} mt-1.5`} value={draft.companyInfo.email} onChange={(event) => updateCompany('email', event.target.value)} />
            </label>
          </div>
          <label className="mt-4 block text-sm font-bold text-slate-700">
            Sứ mệnh
            <textarea rows={3} className={`${inputClass} mt-1.5`} value={draft.mission} onChange={(event) => setDraft({ ...draft, mission: event.target.value })} />
          </label>
          <label className="mt-4 block text-sm font-bold text-slate-700">
            Định vị thương hiệu
            <textarea rows={3} className={`${inputClass} mt-1.5`} value={draft.positioning} onChange={(event) => setDraft({ ...draft, positioning: event.target.value })} />
          </label>
        </section>

        <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#0879D9]" />
            <h3 className="text-base font-extrabold text-[#071827]">Guideline và Brand Assets</h3>
          </div>
          <input ref={logoInputRef} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleAssetUpload(event, 'logo')} />
          <input ref={guidelineInputRef} className="hidden" type="file" accept=".pdf,.docx,.txt,.md,image/png,image/jpeg,image/webp" onChange={(event) => void handleAssetUpload(event, 'guideline')} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => logoInputRef.current?.click()} disabled={isUploading !== null} className="min-h-24 rounded-2xl border-2 border-dashed border-[#0879D9]/30 bg-[#F8FAFC] p-4 text-left transition hover:border-[#0879D9] disabled:opacity-50">
              <ImageIcon className="h-5 w-5 text-[#0879D9]" />
              <span className="mt-2 block text-sm font-extrabold text-[#071827]">{isUploading === 'logo' ? 'Đang tải logo...' : 'Upload logo'}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">PNG, JPG hoặc WEBP. Logo thật sẽ dùng trong footer, không yêu cầu model tự vẽ lại.</span>
            </button>
            <button type="button" onClick={() => guidelineInputRef.current?.click()} disabled={isUploading !== null} className="min-h-24 rounded-2xl border-2 border-dashed border-[#0879D9]/30 bg-[#F8FAFC] p-4 text-left transition hover:border-[#0879D9] disabled:opacity-50">
              <Upload className="h-5 w-5 text-[#0879D9]" />
              <span className="mt-2 block text-sm font-extrabold text-[#071827]">{isUploading === 'guideline' ? 'Đang tải guideline...' : 'Upload guideline'}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">PDF, DOCX, TXT, MD hoặc ảnh. Tài liệu được lưu trong bucket riêng tư.</span>
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Logo đã lưu</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {logos.length ? logos.map((asset) => asset.url ? <img key={asset.id} src={asset.url} alt={asset.name} className="h-12 max-w-28 rounded-lg border border-slate-200 bg-white object-contain p-1" /> : null) : <span className="text-xs text-slate-400">Chưa có logo</span>}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Tài liệu guideline</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {guidelines.length ? guidelines.map((asset) => <li key={asset.id} className="truncate">{asset.name}</li>) : <li className="text-slate-400">Chưa có tài liệu</li>}
              </ul>
            </div>
          </div>
          <label className="mt-4 block text-sm font-bold text-slate-700">
            Tóm tắt Brand Guideline cho hệ thống tạo nội dung và ảnh
            <textarea rows={6} className={`${inputClass} mt-1.5`} value={draft.guidelineNotes} onChange={(event) => setDraft({ ...draft, guidelineNotes: event.target.value })} />
            <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">Hãy ghi các quy tắc quan trọng trong file guideline để hệ thống có thể dùng trực tiếp trong prompt.</span>
          </label>
        </section>
      </div>

      <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#0879D9]" />
            <div>
              <h3 className="text-base font-extrabold text-[#071827]">Chi nhánh OMFIT</h3>
              <p className="text-xs text-slate-500">Địa chỉ và dịch vụ được dùng làm dữ kiện cho bài viết, ảnh và footer.</p>
            </div>
          </div>
          <button type="button" onClick={() => setDraft({ ...draft, branches: [...draft.branches, createBranch()] })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#0879D9]/30 bg-[#F0F9FF] px-4 text-sm font-bold text-[#0879D9]">
            <Plus className="h-4 w-4" /> Thêm chi nhánh
          </button>
        </div>
        <div className="space-y-4">
          {draft.branches.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-[#F8FAFC] p-6 text-center text-sm text-slate-500">
              Chưa có chi nhánh. Thêm dữ liệu để footer và nội dung không phải tự suy đoán địa chỉ.
            </div>
          )}
          {draft.branches.map((branch, index) => (
            <fieldset key={branch.id} className="rounded-2xl border border-slate-200 p-4">
              <legend className="px-2 text-sm font-extrabold text-[#071827]">Chi nhánh {index + 1}</legend>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="text-xs font-bold text-slate-700">Tên chi nhánh<input className={`${inputClass} mt-1`} value={branch.name} onChange={(event) => updateBranch(branch.id, 'name', event.target.value)} /></label>
                <label className="text-xs font-bold text-slate-700">Địa chỉ<input className={`${inputClass} mt-1`} value={branch.address} onChange={(event) => updateBranch(branch.id, 'address', event.target.value)} /></label>
                <label className="text-xs font-bold text-slate-700">Điện thoại<input className={`${inputClass} mt-1`} value={branch.phone} onChange={(event) => updateBranch(branch.id, 'phone', event.target.value)} /></label>
                <label className="text-xs font-bold text-slate-700">Email<input type="email" className={`${inputClass} mt-1`} value={branch.email} onChange={(event) => updateBranch(branch.id, 'email', event.target.value)} /></label>
                <label className="text-xs font-bold text-slate-700">Dịch vụ, cách nhau bằng dấu phẩy<input className={`${inputClass} mt-1`} value={branch.services.join(', ')} onChange={(event) => updateBranch(branch.id, 'services', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} /></label>
                <label className="text-xs font-bold text-slate-700">URL đăng ký<input type="url" className={`${inputClass} mt-1`} value={branch.ctaUrl} onChange={(event) => updateBranch(branch.id, 'ctaUrl', event.target.value)} /></label>
              </div>
              <button type="button" onClick={() => setDraft({ ...draft, branches: draft.branches.filter((item) => item.id !== branch.id) })} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold text-rose-600 hover:bg-rose-50">
                <Trash2 className="h-4 w-4" /> Xóa chi nhánh
              </button>
            </fieldset>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[#0879D9]/15 bg-white p-5 sm:p-6">
        <h3 className="text-base font-extrabold text-[#071827]">Footer bài viết</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">Tiêu đề footer<input className={`${inputClass} mt-1.5`} value={draft.footerSettings.heading} onChange={(event) => updateFooter('heading', event.target.value)} /></label>
          <label className="text-sm font-bold text-slate-700">Nhãn CTA<input className={`${inputClass} mt-1.5`} value={draft.footerSettings.ctaLabel} onChange={(event) => updateFooter('ctaLabel', event.target.value)} /></label>
          <label className="text-sm font-bold text-slate-700 md:col-span-2">Mô tả<textarea rows={3} className={`${inputClass} mt-1.5`} value={draft.footerSettings.description} onChange={(event) => updateFooter('description', event.target.value)} /></label>
          <label className="text-sm font-bold text-slate-700 md:col-span-2">URL CTA<input type="url" className={`${inputClass} mt-1.5`} value={draft.footerSettings.ctaUrl} onChange={(event) => updateFooter('ctaUrl', event.target.value)} /></label>
          <label className="inline-flex min-h-11 items-center gap-3 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={draft.footerSettings.enabled} onChange={(event) => updateFooter('enabled', event.target.checked)} className="h-5 w-5 accent-[#0879D9]" />
            Hiển thị footer OMFIT trong bài viết
          </label>
        </div>
      </section>
    </div>
  );
};
