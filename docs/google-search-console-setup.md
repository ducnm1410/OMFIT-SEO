# Google Search Console cho OMFIT-SEO

OMFIT-SEO dùng service account ở backend để:

- gửi lại `https://omfit.com.vn/wp-sitemap.xml` sau khi một bài publish đã vượt qua hậu kiểm;
- đọc trạng thái URL hiện có trong Google bằng URL Inspection API;
- không gọi Google Indexing API cho bài blog thông thường, vì API đó chỉ hỗ trợ `JobPosting` và livestream có `BroadcastEvent`.

## 1. Tạo service account

1. Mở [Google Cloud Console](https://console.cloud.google.com/).
2. Chọn hoặc tạo một project dành cho OMFIT SEO.
3. Vào **APIs & Services → Library**, tìm **Google Search Console API** và chọn **Enable**.
4. Vào **IAM & Admin → Service Accounts → Create service account**.
5. Đặt tên, ví dụ `omfit-search-console`.
6. Trong service account vừa tạo, vào **Keys → Add key → Create new key → JSON**.

File JSON chỉ cần hai trường sau cho ứng dụng:

- `client_email` → `GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL`;
- `private_key` → `GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY`.

Không commit hoặc gửi công khai toàn bộ file JSON.

## 2. Cấp quyền trong Search Console

1. Mở [Google Search Console](https://search.google.com/search-console/).
2. Chọn property `omfit.com.vn`.
3. Vào **Settings → Users and permissions → Add user**.
4. Nhập đúng `client_email` của service account.
5. Cấp quyền **Full**.

Nếu Search Console đang dùng Domain property, cấu hình ứng dụng là:

```env
GOOGLE_SEARCH_CONSOLE_PROPERTY=sc-domain:omfit.com.vn
```

Nếu chỉ có URL-prefix property, giá trị phải khớp tuyệt đối và có dấu `/` cuối:

```env
GOOGLE_SEARCH_CONSOLE_PROPERTY=https://omfit.com.vn/
```

## 3. Khai báo biến backend

Khai báo trong Vercel Project Settings → Environment Variables:

```env
GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL=omfit-search-console@PROJECT_ID.iam.gserviceaccount.com
GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SEARCH_CONSOLE_PROPERTY=sc-domain:omfit.com.vn
GOOGLE_SEARCH_CONSOLE_SITEMAP_URL=https://omfit.com.vn/wp-sitemap.xml
```

Áp dụng cho **Production**, **Preview** và **Development** nếu cần thử ở cả ba môi trường, sau đó redeploy.

## 4. Cách đọc trạng thái trong ứng dụng

- **URL công khai**: HTTP 200, canonical tự trỏ, không `noindex`, đúng một H1.
- **WordPress sitemap**: URL đã được tìm thấy trong post sitemap.
- **Google Search Console**: sitemap đã được gửi thành công.
- **Trạng thái Google**: dữ liệu URL Inspection tại thời điểm kiểm tra; không đồng nghĩa Google vừa index URL.

Google có thể mất từ vài ngày đến vài tuần để crawl/index và không bảo đảm mọi URL trong sitemap đều được index.
