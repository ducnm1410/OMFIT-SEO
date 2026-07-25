# Kết nối Google Ads Keyword Planner

Tính năng nghiên cứu keyword dùng `KeywordPlanIdeaService.GenerateKeywordIdeas` để lấy dữ liệu thật,
sau đó mới dùng Gemini để phân loại intent, cluster và đề xuất hướng nội dung.

## 1. Chuẩn bị quyền truy cập

Bạn cần:

- Google Ads manager account và client account.
- Google Ads developer token.
- OAuth client ID, client secret và refresh token có scope
  `https://www.googleapis.com/auth/adwords`.
- Customer ID của tài khoản Google Ads cần lấy dữ liệu.
- Login customer ID nếu xác thực thông qua manager account.

Tài liệu chính thức:

- https://developers.google.com/google-ads/api/docs/get-started/dev-token
- https://developers.google.com/google-ads/api/docs/oauth/overview
- https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas

## 2. Cấu hình

Sao chép `.env.example` thành `.env`, sau đó điền:

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=

GOOGLE_ADS_API_VERSION=v25
GOOGLE_ADS_LANGUAGE_ID=1040
GOOGLE_ADS_GEO_TARGET_ID=2704
KEYWORD_SEED_URL=https://omfit.com.vn
KEYWORD_CACHE_TTL_MS=21600000
```

Không thêm tiền tố `VITE_` vào các credential Google Ads. Biến có tiền tố `VITE_` được đóng gói
vào mã chạy trên trình duyệt và không phù hợp để lưu secret.

## 3. Chạy ứng dụng

```bash
npm run dev
```

Lệnh này chạy đồng thời:

- API backend tại `http://127.0.0.1:8787`
- Vite frontend với proxy `/api`

Kiểm tra cấu hình:

```text
GET http://127.0.0.1:8787/api/health
```

Build và chạy production:

```bash
npm run build
npm start
```

## 4. Deploy trên Vercel

Hai endpoint được đóng gói thành Vercel Functions:

- `api/health.mjs`
- `api/keywords/analyze.mjs`

Trong Vercel Project → Settings → Environment Variables, thêm toàn bộ biến backend sau cho
Production và Preview:

```text
GEMINI_API_KEY
GEMINI_MODEL
GOOGLE_ADS_CLIENT_ID
GOOGLE_ADS_CLIENT_SECRET
GOOGLE_ADS_REFRESH_TOKEN
GOOGLE_ADS_DEVELOPER_TOKEN
GOOGLE_ADS_CUSTOMER_ID
GOOGLE_ADS_LOGIN_CUSTOMER_ID
GOOGLE_ADS_API_VERSION
GOOGLE_ADS_LANGUAGE_ID
GOOGLE_ADS_GEO_TARGET_ID
KEYWORD_SEED_URL
```

Sau khi thay đổi environment variables, cần redeploy vì Vercel không áp dụng biến mới cho deployment cũ.
Không đưa các secret này vào biến có tiền tố `VITE_`.

Cache trong bộ nhớ chỉ có tác dụng khi cùng một Vercel Function instance còn ấm. Nếu lưu lượng tăng,
nên chuyển cache sang Vercel KV/Redis hoặc cơ sở dữ liệu dùng chung để kiểm soát quota ổn định.

## 5. Cách tính điểm cơ hội

`trendScore` không do model tạo. Backend tính điểm từ:

- 55% mức search volume đã chuẩn hóa theo log.
- 25% cơ hội từ competition index thấp.
- 20% xu hướng tăng trưởng giữa ba tháng gần nhất và ba tháng trước đó.

Model chỉ bổ sung:

- Search intent.
- Keyword cluster.
- Từ khóa liên quan.
- Content angle.
