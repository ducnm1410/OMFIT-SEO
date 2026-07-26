import type { SeoOutline, GeneratedArticle } from '../types';

export class GeminiService {
  private apiKey: string;
  private model = 'gemini-2.5-flash';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async generate(prompt: string, responseMimeType = 'text/plain') {
    if (!this.apiKey) {
      throw new Error('Chưa cấu hình Gemini API key.');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini trả về lỗi ${response.status}.`);
    }

    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini không trả về nội dung.');
    return String(text).trim();
  }

  async generateOutline(
    keyword: string,
    tone = 'Chuyên nghiệp, truyền cảm hứng, cân bằng'
  ): Promise<SeoOutline> {
    const text = await this.generate(
      `Tạo dàn ý bài viết SEO On-Page bằng tiếng Việt cho thương hiệu OMFIT.
Từ khóa chính: ${keyword}
Giọng văn: ${tone}

Trả về đúng một JSON object với cấu trúc:
{
  "title": "Tiêu đề H1",
  "metaTitle": "Tiêu đề SEO tối đa 60 ký tự",
  "metaDescription": "Mô tả SEO từ 140 đến 160 ký tự",
  "slug": "slug-khong-dau",
  "focusKeyword": "${keyword}",
  "headings": [
    { "tag": "h2", "text": "Tiêu đề mục", "points": ["Ý chính"] },
    { "tag": "h3", "text": "Tiêu đề mục con", "points": ["Ý chính"] }
  ],
  "faq": [
    { "question": "Câu hỏi?", "answer": "Câu trả lời ngắn." }
  ]
}

Không thêm Markdown hoặc nội dung ngoài JSON.`,
      'application/json'
    );

    const outline = JSON.parse(text) as SeoOutline;
    if (
      !outline.title
      || !outline.metaTitle
      || !outline.metaDescription
      || !outline.slug
      || !outline.focusKeyword
      || !Array.isArray(outline.headings)
      || !Array.isArray(outline.faq)
    ) {
      throw new Error('Dàn ý trả về không đúng cấu trúc.');
    }
    return outline;
  }

  async generateFullArticle(
    outline: SeoOutline,
    targetWordCount = 1500
  ): Promise<GeneratedArticle> {
    const content = await this.generate(
      `Viết bài hoàn chỉnh bằng tiếng Việt dựa đúng trên dàn ý JSON dưới đây:
${JSON.stringify(outline)}

Yêu cầu:
- Khoảng ${targetWordCount} từ.
- Trả về HTML semantic, bắt đầu trực tiếp bằng nội dung bài, không có thẻ html/body.
- Dùng h2, h3, p, ul, ol, blockquote và bảng khi phù hợp.
- Không tự tạo số liệu, chứng nhận, địa chỉ, giá, lời cam kết hoặc trích dẫn không có trong dàn ý.
- Không chèn ảnh giả, URL ảnh mẫu hoặc Markdown.
- Dùng từ khóa tự nhiên, tránh nhồi nhét.
- Có mục FAQ dựa trên dữ liệu FAQ trong dàn ý.

Chỉ trả về HTML.`
    );

    const contentHtml = content
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const plainText = contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plainText) throw new Error('Nội dung bài viết trả về rỗng.');

    return {
      id: crypto.randomUUID(),
      title: outline.title,
      slug: outline.slug,
      metaTitle: outline.metaTitle,
      metaDescription: outline.metaDescription,
      focusKeyword: outline.focusKeyword,
      contentHtml,
      wordCount: plainText.split(' ').filter(Boolean).length,
      readabilityScore: 0,
      seoScore: 0,
      categories: [],
      tags: [outline.focusKeyword],
      articleImages: [],
      createdAt: new Date().toISOString(),
      status: 'draft'
    };
  }
}
