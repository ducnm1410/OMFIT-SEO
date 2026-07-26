begin;

update public.brand_profiles
set
  mission = 'Đồng hành cùng người Việt trên hành trình chăm sóc sức khỏe toàn diện và bền vững.',
  positioning = 'Fitness & Wellness cao cấp với triết lý Balance for Life, cân bằng Thân – Tâm – Trí.',
  audience = array[
    'Người quan tâm sức khỏe toàn diện',
    'Người tập Pilates, Yoga và Fitness',
    'Khách hàng cần lộ trình cá nhân hóa'
  ],
  voice = '{
    "language": "Tiếng Việt tự nhiên",
    "tone": ["chuyên nghiệp", "truyền cảm hứng", "ấm áp", "đáng tin cậy"],
    "avoid": ["giật gân", "cam kết kết quả", "phán đoán y khoa"]
  }'::jsonb,
  visual_rules = '{
    "style": "Photorealistic premium fitness and wellness photography",
    "lighting": "Ánh sáng tự nhiên, trong trẻo, cân bằng, không quá tương phản",
    "environment": "Không gian OMFIT hiện đại, sạch sẽ, cao cấp, thiết bị đúng giải phẫu",
    "people": "Người Việt trưởng thành, chuyển động tự nhiên, trang phục thể thao thanh lịch",
    "composition": "Chừa khoảng thở, chủ thể rõ, phù hợp crop 16:9 và 4:3",
    "logo": "Không yêu cầu hệ thống tạo ảnh tự vẽ chữ hoặc logo; sử dụng logo chính thức đã tải lên"
  }'::jsonb,
  prohibited_elements = array[
    'Chữ hoặc logo bị biến dạng',
    'Thiết bị Pilates sai cấu tạo',
    'Tư thế tập nguy hiểm',
    'Hình ảnh before-after',
    'Cam kết giảm cân hoặc chữa bệnh',
    'Không gian đông đúc, lộn xộn'
  ],
  approved_claims = array[
    'OMFIT hướng đến sức khỏe toàn diện',
    'Triết lý Balance for Life',
    'Giải pháp tập luyện được cá nhân hóa theo nhu cầu'
  ],
  guideline_notes = 'Ưu tiên hình ảnh chân thực, cao cấp, sạch sẽ và thể hiện triết lý Balance for Life. Chỉ sử dụng logo OMFIT chính thức đã tải lên.',
  footer_settings = '{
    "enabled": true,
    "heading": "Đồng hành cùng OMFIT",
    "description": "Kết nối với OMFIT để được tư vấn lộ trình tập luyện phù hợp.",
    "ctaLabel": "Đăng ký tư vấn",
    "ctaUrl": "https://omfit.com.vn/contact-us/"
  }'::jsonb
where
  mission ~ '[[:alpha:]]\?[[:alpha:]]'
  or mission like '??%'
  or positioning ~ '[[:alpha:]]\?[[:alpha:]]'
  or positioning like '??%'
  or audience::text ~ '[[:alpha:]]\?[[:alpha:]]'
  or voice::text ~ '[[:alpha:]]\?[[:alpha:]]'
  or visual_rules::text ~ '[[:alpha:]]\?[[:alpha:]]'
  or prohibited_elements::text ~ '[[:alpha:]]\?[[:alpha:]]'
  or approved_claims::text ~ '[[:alpha:]]\?[[:alpha:]]'
  or guideline_notes ~ '[[:alpha:]]\?[[:alpha:]]'
  or guideline_notes like '??%'
  or footer_settings::text ~ '[[:alpha:]]\?[[:alpha:]]';

commit;
