import type { GeneratedArticle, GeneratedImage } from '../types';

export interface PublishPostResult {
  postId: number;
  postUrl: string;
  status: string;
  featuredMediaId?: number;
  logs: string[];
}

export class WordpressMcpService {
  private siteUrl: string;
  private wpUsername: string;
  private wpAppPassword: string;

  constructor(siteUrl: string = 'https://omfit.com.vn') {
    this.siteUrl = siteUrl;
    this.wpUsername = import.meta.env.VITE_WP_USERNAME || '';
    this.wpAppPassword = import.meta.env.VITE_WP_APP_PASSWORD || '';
  }

  private getAuthHeader(): string {
    if (!this.wpUsername || !this.wpAppPassword) {
      throw new Error('Thiếu VITE_WP_USERNAME hoặc VITE_WP_APP_PASSWORD trong cấu hình môi trường.');
    }
    return 'Basic ' + btoa(`${this.wpUsername}:${this.wpAppPassword}`);
  }

  // Convert Base64 Data URL to Blob
  private async base64ToBlob(base64Url: string): Promise<Blob> {
    const res = await fetch(base64Url);
    return await res.blob();
  }

  async publishArticleWithMcp(
    article: GeneratedArticle,
    status: 'draft' | 'publish' = 'publish'
  ): Promise<PublishPostResult> {
    const logs: string[] = [];
    logs.push(`[${new Date().toLocaleTimeString()}] 🚀 Bắt đầu quy trình tự động đăng bài qua WP REST API...`);
    logs.push(`[${new Date().toLocaleTimeString()}] 🔗 Target Site: ${this.siteUrl}`);

    let featuredMediaId: number | undefined = undefined;

    try {
      // 1. Upload Featured Image if exists
      if (article.featuredImage) {
        logs.push(`[${new Date().toLocaleTimeString()}] 🖼️ Đang tải ảnh "${article.featuredImage.fileName}" lên WordPress Media Library...`);
        
        const imageBlob = await this.base64ToBlob(article.featuredImage.url);
        const formData = new FormData();
        formData.append('file', imageBlob, article.featuredImage.fileName || 'omfit-image.jpg');
        formData.append('alt_text', article.featuredImage.altText);
        formData.append('title', article.featuredImage.altText);

        const mediaRes = await fetch(`${this.siteUrl}/wp-json/wp/v2/media`, {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthHeader()
          },
          body: formData
        });

        if (!mediaRes.ok) {
          const errData = await mediaRes.text();
          throw new Error(`Lỗi upload ảnh: ${mediaRes.status} - ${errData}`);
        }

        const mediaData = await mediaRes.json();
        featuredMediaId = mediaData.id;
        logs.push(`[${new Date().toLocaleTimeString()}] ✅ Tải ảnh thành công! Attachment Media ID #${featuredMediaId}`);
      }

      // 2. Create the Post
      logs.push(`[${new Date().toLocaleTimeString()}] 📝 Đang khởi tạo bài viết trên WordPress với tiêu đề "${article.title}" (Status: ${status.toUpperCase()})...`);
      
      const postPayload: any = {
        title: article.title,
        content: article.contentHtml,
        status: status,
        slug: article.slug,
        // Categories and tags require IDs in WP REST API. 
        // In a full implementation, we would query the API to find IDs matching article.categories / article.tags.
        // For now, we rely on standard tags/categories handling if needed, or leave them empty to use default category.
      };

      if (featuredMediaId) {
        postPayload.featured_media = featuredMediaId;
        logs.push(`[${new Date().toLocaleTimeString()}] 📌 Gán Featured Image (ID #${featuredMediaId}) làm ảnh đại diện cho bài viết...`);
      }

      const postRes = await fetch(`${this.siteUrl}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postPayload)
      });

      if (!postRes.ok) {
        const errData = await postRes.text();
        throw new Error(`Lỗi tạo bài viết: ${postRes.status} - ${errData}`);
      }

      const postData = await postRes.json();
      const createdPostId = postData.id;
      const postUrl = postData.link;

      logs.push(`[${new Date().toLocaleTimeString()}] 🎉 ĐĂNG BÀI THÀNH CÔNG LÊN OMFIT.COM.VN! Post ID #${createdPostId}`);
      logs.push(`[${new Date().toLocaleTimeString()}] 🌐 Link bài viết công khai: ${postUrl}`);

      return {
        postId: createdPostId,
        postUrl: postUrl,
        status: status,
        featuredMediaId: featuredMediaId,
        logs: logs
      };

    } catch (error: any) {
      logs.push(`[${new Date().toLocaleTimeString()}] ❌ LỖI TRONG QUÁ TRÌNH ĐĂNG BÀI: ${error.message}`);
      throw error;
    }
  }
}
