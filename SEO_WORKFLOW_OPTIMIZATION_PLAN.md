# Kế hoạch tối ưu luồng làm bài SEO OMFIT

## Mục tiêu

Rút gọn quy trình từ nhiều màn hình rời rạc thành một luồng có hướng dẫn, luôn cho người dùng biết:

- Đang ở bước nào.
- Dữ liệu nào đã hoàn tất hoặc còn thiếu.
- Nội dung có đủ điều kiện chuyển bước hay chưa.
- Khi lỗi xảy ra, bước nào cần làm lại và dữ liệu nào đã được lưu an toàn.

Không thay đổi các nguyên tắc hiện có về xác thực người dùng, nguồn tham khảo, SEO gate, media ownership, reviewer confirmation và publish idempotency.

## Trạng thái triển khai

Cập nhật ngày 27/07/2026:

- Đã triển khai workflow 4 bước thống nhất trên các màn hình làm bài.
- Đã mở rộng Content Brief với search intent, dịch vụ, độc giả, mục tiêu chuyển đổi, giọng văn và số từ.
- Đã hiển thị bài đang làm và trạng thái tự động lưu.
- Đã lưu bước hiện tại, brief và bài đang làm để tiếp tục sau khi refresh hoặc đăng nhập lại.
- Đã tích hợp hình ảnh và nguồn tham khảo trong trình biên tập hiện tại.
- Đã đưa checklist SEO, media, nguồn và reviewer lên trước thao tác publish.
- Đã tách rõ giai đoạn hoàn thiện nội dung và giai đoạn kiểm duyệt/xuất bản.
- Backend publish, SEO gate, media ownership và idempotency được giữ nguyên.

Các hạng mục orchestration dạng background job, retry từng chặng và analytics vận hành vẫn thuộc giai đoạn mở rộng tiếp theo; không được giả lập bằng trạng thái frontend.

## Luồng hiện tại

1. Phân tích keyword từ Google Ads.
2. Chuyển sang màn hình soạn bài để tạo dàn ý.
3. Tạo toàn bộ nội dung.
4. Hệ thống tự tạo một số ảnh sau khi lưu bài.
5. Chuyển sang Image Studio hoặc trình biên tập để bổ sung ảnh.
6. Tìm và duyệt nguồn tham khảo trong trình biên tập.
7. Kiểm tra SEO ở thời điểm đăng bài.
8. Đồng bộ media nhiều lượt rồi đăng WordPress.

Các điểm gây gián đoạn:

- Nghiên cứu nguồn diễn ra sau khi nội dung đã được viết.
- Người dùng phải chuyển nhiều tab và tự nhớ bài đang xử lý.
- Kiểm tra SEO quan trọng xuất hiện khá muộn.
- Quá trình tạo ảnh và đồng bộ WordPress có nhiều bước nhưng trạng thái chưa được trình bày như một workflow thống nhất.
- Khi lỗi, log kỹ thuật có ích cho chẩn đoán nhưng chưa cho người dùng biết hành động tiếp theo.

## Luồng đề xuất

### Bước 1 — Content brief

Một màn hình duy nhất để xác định:

- Keyword chính và nhóm keyword.
- Search intent.
- Dịch vụ hoặc chi nhánh OMFIT liên quan.
- Đối tượng độc giả.
- Mục tiêu chuyển đổi.
- Độ dài và giọng văn.

Đầu ra: một `Content Brief` được lưu và có thể tiếp tục sau khi tải lại trang.

### Bước 2 — Bằng chứng và dàn ý

- Tìm nguồn trước khi viết nội dung đầy đủ.
- Cho phép mở, kiểm tra và duyệt nguồn.
- Tạo dàn ý dựa trên brief cùng các nguồn đã duyệt.
- Hiển thị cấu trúc H2/H3, FAQ, internal links và claim cần kiểm chứng trong cùng màn hình.

Đầu ra: dàn ý đã duyệt và bộ nguồn đã xác minh.

### Bước 3 — Nội dung và hình ảnh

- Tạo bài từ dàn ý đã duyệt.
- Hiển thị tiến độ theo section thay vì một trạng thái chờ chung.
- Đánh dấu section thiếu ảnh, thiếu nguồn hoặc quá ngắn ngay trong editor.
- Tạo hoặc tải ảnh tại đúng vị trí cần ảnh, không bắt buộc chuyển sang tab khác.
- Autosave sau mỗi thay đổi quan trọng.

Đầu ra: bản thảo hoàn chỉnh, có media và metadata.

### Bước 4 — Kiểm duyệt và xuất bản

Một checklist duy nhất gồm:

- Tiêu đề, slug và meta description.
- Focus keyword và phân bố heading.
- Nguồn tham khảo.
- Featured image, ảnh trong bài, alt text và caption.
- Internal links.
- Author và reviewer confirmation.
- SEO score và các lỗi bắt buộc.
- Chế độ Draft hoặc Publish.

Khi đạt gate, WordPress publish chạy theo tiến trình:

1. Chuẩn bị media.
2. Đồng bộ metadata.
3. Gửi nội dung.
4. Xác nhận URL bài viết.

Kết quả được trả bằng dialog thành công hoặc thất bại với hành động tiếp theo rõ ràng.

## Kế hoạch triển khai

### Giai đoạn 0 — Đo baseline

Thời lượng dự kiến: 1–2 ngày.

- Ghi nhận thời gian từ keyword đến draft và từ draft đến publish.
- Đếm số lần chuyển tab.
- Đếm lỗi publish, lỗi media và số lần người dùng phải thử lại.
- Xác định bước có tỷ lệ bỏ dở cao nhất.

### Giai đoạn 1 — Tối ưu UX, không đổi backend

Thời lượng dự kiến: 2–4 ngày.

- Thêm workflow stepper thống nhất trên các màn hình.
- Thêm trạng thái `Đã lưu`, `Đang xử lý`, `Cần hành động`.
- Hiển thị bài đang làm ở header.
- Đưa checklist SEO cơ bản lên sớm hơn.
- Hoàn thiện dialog kết quả và thông báo lỗi có hướng xử lý.
- Giữ nguyên API và dữ liệu hiện tại.

### Giai đoạn 2 — Source-first và editor hợp nhất

Thời lượng dự kiến: 4–6 ngày.

- Chuyển nghiên cứu nguồn lên trước bước viết bài.
- Hợp nhất thao tác ảnh thường dùng vào editor.
- Cho phép chỉnh brief và tạo lại riêng một section.
- Lưu trạng thái workflow để tiếp tục sau khi refresh hoặc đăng nhập lại.

### Giai đoạn 3 — Orchestration phía server

Thời lượng dự kiến: 5–7 ngày.

- Chuyển các tác vụ dài sang job có trạng thái rõ ràng.
- Giữ idempotency key cho generate, media sync và publish.
- Retry riêng từng bước an toàn thay vì chạy lại toàn bộ luồng.
- Cho phép resume từ bước cuối đã hoàn tất.
- Giữ publish lease và cơ chế chống bài trùng hiện có.

### Giai đoạn 4 — Quality gate và tối ưu liên tục

Thời lượng dự kiến: 3–5 ngày.

- Gate riêng cho nguồn, nội dung, media và editorial identity.
- So sánh SEO score trước và sau chỉnh sửa.
- Dashboard thời gian hoàn thành, lỗi phổ biến và tỷ lệ publish thành công.
- Thu thập phản hồi để điều chỉnh prompt, brief template và checklist.

## Tiêu chí nghiệm thu

- Toàn bộ quy trình còn tối đa bốn bước chính.
- Có thể refresh hoặc đăng nhập lại mà không mất bước đang làm.
- Người dùng luôn thấy bước hiện tại và hành động tiếp theo.
- Nguồn được duyệt trước khi tạo claim quan trọng.
- Lỗi media không bắt người dùng tạo lại nội dung.
- Một thao tác publish không thể tạo hai bài WordPress.
- Thành công hoặc thất bại đều có dialog rõ ràng, không dùng browser alert.
- Mobile không tràn ngang và các nút chính có vùng chạm tối thiểu 44px.

## Thứ tự ưu tiên

1. UX workflow và trạng thái lưu.
2. Source-first.
3. Editor hợp nhất với hình ảnh.
4. Resume/retry phía server.
5. Analytics và tối ưu prompt.
