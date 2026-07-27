# OMFIT SEO Bridge

Plugin WordPress đi kèm OMFIT-SEO để:

- redirect `www.omfit.com.vn` về `omfit.com.vn`;
- xuất canonical, meta description, Open Graph và Twitter Card;
- xuất `BlogPosting`, `BreadcrumbList`, tác giả và người phản biện đã xác nhận;
- hiển thị byline, font Be Vietnam Pro và typography phù hợp cho bài tiếng Việt;
- bảo đảm bài viết có một H1 khi theme không hiển thị tiêu đề;
- loại template, tag và author không cần thiết khỏi WordPress sitemap.

## Metadata từ OMFIT-SEO

Ứng dụng có thể gửi các trường REST sau khi tạo hoặc cập nhật bài viết:

- `omfit_author_name`, `omfit_author_url`, `omfit_author_job_title`;
- `omfit_reviewer_name`, `omfit_reviewer_url`, `omfit_reviewer_credentials`;
- `omfit_reviewer_confirmed`: chỉ khi người dùng xác nhận người phản biện đã duyệt bài;
- `omfit_publisher_logo_url`;
- `omfit_branches_json`.

Tài khoản WordPress cần quyền `edit_others_posts` để ghi thông tin tác giả/người
phản biện. Logo và dữ liệu chi nhánh yêu cầu quyền `manage_options`. Nếu tài khoản
không có quyền quản trị, ứng dụng sẽ xuất bản bài mà không gửi các trường brand bị
hạn chế, thay vì làm hỏng toàn bộ lần xuất bản.

## Cài đặt

1. Nén thư mục `omfit-seo-bridge` thành file ZIP.
2. Trong WordPress vào **Plugins → Add New Plugin → Upload Plugin**.
3. Upload ZIP và kích hoạt **OMFIT SEO Bridge**.
4. Xóa cache LiteSpeed.
5. Kiểm tra lại `https://omfit.com.vn/wp-sitemap.xml` và gửi sitemap trong Google Search Console.
