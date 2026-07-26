# Kết nối Google Ads bằng tài khoản người dùng

OMFIT dùng OAuth 2.0 Authorization Code Flow. Người dùng đăng nhập Google trực tiếp, còn
`client_secret`, Developer Token và refresh token không được đưa vào JavaScript phía trình duyệt.
Refresh token được mã hóa trong cookie `HttpOnly`, `SameSite=Lax`.

## Redirect URI bắt buộc

Trong Google Cloud Console, mở OAuth 2.0 Client ID loại **Web application** và thêm chính xác:

```text
http://localhost:5173/api/auth/google/callback
https://omfit-seo.vercel.app/api/auth/google/callback
```

Nếu dùng domain production khác, thay `https://omfit-seo.vercel.app` bằng domain đó và cập nhật
`OAUTH_REDIRECT_BASE`.

## Cấu hình Google Cloud

1. Enable Google Ads API cho Cloud project.
2. Cấu hình OAuth consent screen.
3. Thêm scope `https://www.googleapis.com/auth/adwords`.
4. Nếu ứng dụng còn ở Testing, thêm email Google Ads vào danh sách Test users.
5. Google Ads yêu cầu tài khoản cấp quyền bật xác minh hai bước.

## Biến môi trường backend

```dotenv
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
OAUTH_SESSION_SECRET=
OAUTH_REDIRECT_BASE=https://omfit-seo.vercel.app
```

`OAUTH_SESSION_SECRET` nên là chuỗi ngẫu nhiên tối thiểu 32 byte. Không thêm tiền tố `VITE_` vào
bất kỳ biến nào ở trên.

## Luồng sử dụng

1. Mở tab **Phân Tích Keyword**.
2. Chọn **Đăng nhập Google Ads**.
3. Cấp quyền cho ứng dụng.
4. Nếu có nhiều Customer ID, chọn tài khoản cần dùng.
5. Thực hiện phân tích keyword.

Có thể dùng nút **Ngắt kết nối** để xóa cookie chứa phiên OAuth trên thiết bị hiện tại.
