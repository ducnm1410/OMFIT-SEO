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

  // Find or create a WordPress category by name, returns category ID
  private async findOrCreateCategory(name: string): Promise<number> {
    try {
      // Search existing categories
      const searchRes = await fetch(
        `${this.siteUrl}/wp-json/wp/v2/categories?search=${encodeURIComponent(name)}&per_page=5`,
        { headers: { 'Authorization': this.getAuthHeader() } }
      );
      if (searchRes.ok) {
        const categories = await searchRes.json();
        const exact = categories.find((cat: any) => cat.name.toLowerCase() === name.toLowerCase());
        if (exact) return exact.id;
      }

      // Create new category if not found
      const createRes = await fetch(`${this.siteUrl}/wp-json/wp/v2/categories`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });
      if (createRes.ok) {
        const newCat = await createRes.json();
        return newCat.id;
      }
    } catch (err) {
      console.warn(`Không thể tìm/tạo category "${name}":`, err);
    }
    return 1; // Fallback to default category (ID 1 = Uncategorized)
  }

  // Find or create a WordPress tag by name, returns tag ID
  private async findOrCreateTag(name: string): Promise<number> {
    try {
      const searchRes = await fetch(
        `${this.siteUrl}/wp-json/wp/v2/tags?search=${encodeURIComponent(name)}&per_page=5`,
        { headers: { 'Authorization': this.getAuthHeader() } }
      );
      if (searchRes.ok) {
        const tags = await searchRes.json();
        const exact = tags.find((tag: any) => tag.name.toLowerCase() === name.toLowerCase());
        if (exact) return exact.id;
      }

      const createRes = await fetch(`${this.siteUrl}/wp-json/wp/v2/tags`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });
      if (createRes.ok) {
        const newTag = await createRes.json();
        return newTag.id;
      }
    } catch (err) {
      console.warn(`Không thể tìm/tạo tag "${name}":`, err);
    }
    return 0; // Skip this tag
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

      // 2. Resolve Categories
      let categoryIds: number[] = [];
      if (article.categories && article.categories.length > 0) {
        logs.push(`[${new Date().toLocaleTimeString()}] 🏷️ Đang gán Chuyên mục: [${article.categories.join(', ')}]...`);
        const catPromises = article.categories.map(name => this.findOrCreateCategory(name));
        categoryIds = await Promise.all(catPromises);
        categoryIds = categoryIds.filter(id => id > 0);
        logs.push(`[${new Date().toLocaleTimeString()}] ✅ Đã gán ${categoryIds.length} chuyên mục (IDs: ${categoryIds.join(', ')})`);
      }

      // 3. Resolve Tags
      let tagIds: number[] = [];
      if (article.tags && article.tags.length > 0) {
        logs.push(`[${new Date().toLocaleTimeString()}] Đang gán thẻ: [${article.tags.join(', ')}]...`);
        const tagPromises = article.tags.map(name => this.findOrCreateTag(name));
        tagIds = await Promise.all(tagPromises);
        tagIds = tagIds.filter(id => id > 0);
        logs.push(`[${new Date().toLocaleTimeString()}] ✅ Đã gán ${tagIds.length} thẻ (IDs: ${tagIds.join(', ')})`);
      }

      // 4. Create the Post
      logs.push(`[${new Date().toLocaleTimeString()}] 📝 Đang khởi tạo bài viết trên WordPress với tiêu đề "${article.title}" (Status: ${status.toUpperCase()})...`);
      
      const postPayload: any = {
        title: article.title,
        content: article.contentHtml,
        status: status,
        slug: article.slug,
      };

      if (categoryIds.length > 0) {
        postPayload.categories = categoryIds;
      }

      if (tagIds.length > 0) {
        postPayload.tags = tagIds;
      }

      if (featuredMediaId) {
        postPayload.featured_media = featuredMediaId;
        logs.push(`[${new Date().toLocaleTimeString()}] Gán ảnh #${featuredMediaId} làm ảnh đại diện cho bài viết...`);
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
