<?php
/**
 * OMFIT production runtime optimizations.
 *
 * This file is deployed through Code Snippets. Keep it compatible with PHP 7.4
 * and keep every public function behind the omfit_agentic_ prefix.
 */

if (!defined('ABSPATH')) {
    return;
}

if (!function_exists('omfit_agentic_is_home')) {
    function omfit_agentic_is_home() {
        return !is_admin() && is_front_page();
    }

    function omfit_agentic_dequeue_home_assets() {
        if (!omfit_agentic_is_home()) {
            return;
        }

        $styles = array(
            'contact-form-7',
            'mptt-style',
            'omfit-seo-be-vietnam-pro',
            'woocommerce-layout',
            'woocommerce-smallscreen',
            'woocommerce-general',
            'brands-styles',
            'hint',
            'perfect-scrollbar',
            'perfect-scrollbar-wpc',
            'woosc-frontend',
            'woosw-icons',
            'woosw-frontend',
            'wc-blocks-style',
        );

        foreach ($styles as $handle) {
            wp_dequeue_style($handle);
        }

        $scripts = array(
            'swv',
            'contact-form-7',
            'wc-add-to-cart',
            'woocommerce',
            'wc-jquery-blockui',
            'wc-js-cookie',
            'sourcebuster-js',
            'wc-order-attribution',
            'pxl-woocommerce',
            'wooaa-frontend',
            'print',
            'table-head-fixer',
            'perfect-scrollbar',
            'woosc-frontend',
            'woosw-frontend',
            'mptt-functions',
            'mptt-event-object-js',
            'mptt-editor-panel-js',
            'hadkaur-three',
            'hadkaur-smoke',
            'pxl-admin',
        );

        foreach ($scripts as $handle) {
            wp_dequeue_script($handle);
        }
    }
    add_action('wp_enqueue_scripts', 'omfit_agentic_dequeue_home_assets', PHP_INT_MAX);
    add_action('wp_footer', 'omfit_agentic_dequeue_home_assets', 0);

    function omfit_agentic_google_font_swap($src, $handle) {
        if (
            omfit_agentic_is_home()
            && $handle === 'pxl-google-fonts'
            && strpos((string) $src, 'display=') === false
        ) {
            return add_query_arg('display', 'swap', $src);
        }

        return $src;
    }
    add_filter('style_loader_src', 'omfit_agentic_google_font_swap', 10, 2);

    function omfit_agentic_print_early_home_hints() {
        if (!omfit_agentic_is_home()) {
            return;
        }

        $hero = 'https://omfit.com.vn/wp-content/uploads/2026/07/omfit-home-hero-can-bang-toan-dien.webp';
        echo '<link rel="preload" as="image" href="' . esc_url($hero) . '" fetchpriority="high" />' . "\n";
        echo '<style id="omfit-critical-loader-css">#pxl-loadding.pxl-loader{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}</style>' . "\n";
    }
    add_action('wp_head', 'omfit_agentic_print_early_home_hints', 1);

    function omfit_agentic_print_font_fallbacks() {
        if (!omfit_agentic_is_home()) {
            return;
        }

        ?>
        <style id="omfit-font-display-css">
        @font-face{font-family:"gilroy";font-style:normal;font-weight:400;font-display:swap;src:url("https://omfit.com.vn/wp-content/uploads/useanyfont/9455Gilroy.woff2") format("woff2")}
        @font-face{font-family:"Plateia Bold";font-style:normal;font-weight:400;font-display:swap;src:url("https://omfit.com.vn/wp-content/themes/hadkaur/assets/fonts/font-custom/Plateia%20Bold.ttf") format("truetype")}
        @font-face{font-family:"Caseicon";font-style:normal;font-weight:400;font-display:swap;src:url("https://omfit.com.vn/wp-content/themes/hadkaur/assets/fonts/caseicon/caseicon.woff2") format("woff2")}
        @font-face{font-family:"Flaticon";font-style:normal;font-weight:400;font-display:swap;src:url("https://omfit.com.vn/wp-content/themes/hadkaur/assets/fonts/flaticon/fonts/flaticon.woff2") format("woff2")}
        @font-face{font-family:"Font Awesome 5 Brands";font-style:normal;font-weight:400;font-display:swap;src:url("https://omfit.com.vn/wp-content/plugins/bravis-addons/assets/libs/font-awesome-pro/webfonts/fa-brands-400.woff2") format("woff2")}
        @font-face{font-family:"Font Awesome 5 Pro";font-style:normal;font-weight:300;font-display:swap;src:url("https://omfit.com.vn/wp-content/plugins/bravis-addons/assets/libs/font-awesome-pro/webfonts/fa-light-300.woff2") format("woff2")}
        @font-face{font-family:"Font Awesome 5 Pro";font-style:normal;font-weight:400;font-display:swap;src:url("https://omfit.com.vn/wp-content/plugins/bravis-addons/assets/libs/font-awesome-pro/webfonts/fa-regular-400.woff2") format("woff2")}
        </style>
        <?php
    }
    add_action('wp_head', 'omfit_agentic_print_font_fallbacks', 100);

    function omfit_agentic_organization_data() {
        return array(
            '@type' => array('HealthClub', 'Organization'),
            '@id' => 'https://omfit.com.vn/#organization',
            'name' => 'OMFIT Fitness & Wellness',
            'alternateName' => 'OMFIT',
            'url' => 'https://omfit.com.vn/',
            'logo' => array(
                '@type' => 'ImageObject',
                'url' => 'https://omfit.com.vn/wp-content/uploads/2023/08/476558850_122103530234761386_5564187386758449618_n.jpg',
                'width' => 1575,
                'height' => 1575,
            ),
            'image' => 'https://omfit.com.vn/wp-content/uploads/2026/07/omfit-home-hero-can-bang-toan-dien.webp',
            'description' => 'OMFIT Fitness & Wellness cung cấp giải pháp chăm sóc sức khỏe toàn diện với Gym, Pilates, Yoga, Group X, Spinning, Sauna và Sound Therapy.',
            'slogan' => 'Balance For Life - Vì một sức khỏe toàn diện',
            'email' => 'info@omfit.com.vn',
            'telephone' => '1900 2727 79',
            'address' => array(
                '@type' => 'PostalAddress',
                'streetAddress' => '02 Nguyễn Đổng Chi, Phường Tân Phú, Quận 7',
                'addressLocality' => 'Thành phố Hồ Chí Minh',
                'addressCountry' => 'VN',
            ),
            'areaServed' => array(
                '@type' => 'City',
                'name' => 'Thành phố Hồ Chí Minh',
            ),
            'openingHoursSpecification' => array(
                '@type' => 'OpeningHoursSpecification',
                'dayOfWeek' => array(
                    'Monday',
                    'Tuesday',
                    'Wednesday',
                    'Thursday',
                    'Friday',
                    'Saturday',
                    'Sunday',
                ),
                'opens' => '06:00',
                'closes' => '22:00',
            ),
            'knowsAbout' => array(
                'Gym',
                'Pilates',
                'Yoga',
                'Group X',
                'Spinning',
                'Sauna',
                'Sound Therapy',
                'Huấn luyện cá nhân',
                'Dinh dưỡng',
            ),
        );
    }

    function omfit_agentic_print_home_schema() {
        if (!omfit_agentic_is_home()) {
            return;
        }

        $schema = array(
            '@context' => 'https://schema.org',
            '@graph' => array(
                omfit_agentic_organization_data(),
                array(
                    '@type' => 'WebPage',
                    '@id' => 'https://omfit.com.vn/#webpage',
                    'url' => 'https://omfit.com.vn/',
                    'name' => 'OMFIT Fitness & Wellness - Cân bằng toàn diện',
                    'description' => 'Trung tâm Fitness & Wellness tại Quận 7, Thành phố Hồ Chí Minh với Gym, Pilates, Yoga, Group X, Spinning, Sauna và Sound Therapy.',
                    'about' => array('@id' => 'https://omfit.com.vn/#organization'),
                    'primaryImageOfPage' => array(
                        '@type' => 'ImageObject',
                        'url' => 'https://omfit.com.vn/wp-content/uploads/2026/07/omfit-home-hero-can-bang-toan-dien.webp',
                    ),
                    'inLanguage' => 'vi-VN',
                ),
            ),
        );

        echo '<script id="omfit-agentic-schema" type="application/ld+json">'
            . wp_json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            . '</script>' . "\n";
        echo '<link rel="alternate" type="text/plain" href="https://omfit.com.vn/llms.txt" title="OMFIT information for language models" />' . "\n";
    }
    add_action('wp_head', 'omfit_agentic_print_home_schema', 6);

    function omfit_agentic_knowledge_payload() {
        return array(
            'schemaVersion' => '1.0',
            'canonicalUrl' => 'https://omfit.com.vn/',
            'language' => 'vi-VN',
            'organization' => omfit_agentic_organization_data(),
            'services' => array(
                'Gym',
                'Pilates',
                'Yoga',
                'Group X',
                'Spinning',
                'Sauna',
                'Sound Therapy',
                'Huấn luyện cá nhân',
                'Tư vấn dinh dưỡng',
            ),
            'officialPages' => array(
                'home' => 'https://omfit.com.vn/',
                'about' => 'https://omfit.com.vn/ve-chung-toi/',
                'contact' => 'https://omfit.com.vn/contact-us/',
                'trainers' => 'https://omfit.com.vn/huan-luyen-vien/',
                'articles' => 'https://omfit.com.vn/tin-tuc/',
                'sitemap' => 'https://omfit.com.vn/wp-sitemap.xml',
                'llms' => 'https://omfit.com.vn/llms.txt',
            ),
            'verificationNote' => 'Lịch học, học phí, ưu đãi và tình trạng dịch vụ có thể thay đổi. Vui lòng xác nhận qua hotline hoặc email chính thức trước khi hành động.',
            'lastModified' => get_lastpostmodified('c'),
        );
    }

    function omfit_agentic_register_rest_routes() {
        register_rest_route('omfit/v1', '/knowledge', array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => function () {
                $response = rest_ensure_response(omfit_agentic_knowledge_payload());
                $response->header('Cache-Control', 'public, max-age=3600');
                return $response;
            },
            'permission_callback' => '__return_true',
        ));
    }
    add_action('rest_api_init', 'omfit_agentic_register_rest_routes');

    function omfit_agentic_llms_text() {
        return implode("\n", array(
            '# OMFIT Fitness & Wellness',
            '',
            '> Nguồn thông tin chính thức về OMFIT Fitness & Wellness tại Thành phố Hồ Chí Minh. OMFIT hướng đến cân bằng Thân - Tâm - Trí với triết lý “Balance For Life”.',
            '',
            '## Dịch vụ chính',
            '',
            '- Gym và huấn luyện cá nhân',
            '- Pilates',
            '- Yoga và Group X',
            '- Spinning',
            '- Sauna',
            '- Sound Therapy',
            '- Tư vấn dinh dưỡng và lộ trình sức khỏe cá nhân hóa',
            '',
            '## Nguồn chính thức',
            '',
            '- [Trang chủ](https://omfit.com.vn/): Tổng quan thương hiệu và dịch vụ',
            '- [Về OMFIT](https://omfit.com.vn/ve-chung-toi/): Sứ mệnh, triết lý và cam kết',
            '- [Liên hệ](https://omfit.com.vn/contact-us/): Hotline, email, địa chỉ và giờ hoạt động',
            '- [Huấn luyện viên](https://omfit.com.vn/huan-luyen-vien/): Danh sách đội ngũ huấn luyện',
            '- [Tin tức](https://omfit.com.vn/tin-tuc/): Kiến thức Fitness và Wellness',
            '- [WordPress sitemap](https://omfit.com.vn/wp-sitemap.xml): Danh sách URL có thể lập chỉ mục',
            '',
            '## Dữ liệu máy đọc',
            '',
            '- [OMFIT Knowledge API](https://omfit.com.vn/wp-json/omfit/v1/knowledge): Hồ sơ tổ chức, dịch vụ, liên hệ và URL chính thức ở định dạng JSON',
            '- [WordPress REST API](https://omfit.com.vn/wp-json/wp/v2/): Nội dung WordPress công khai',
            '',
            '## Liên hệ',
            '',
            '- Hotline: 1900 2727 79',
            '- Email: info@omfit.com.vn',
            '- Địa chỉ: 02 Nguyễn Đổng Chi, Phường Tân Phú, Quận 7, Thành phố Hồ Chí Minh, Việt Nam',
            '- Giờ hoạt động: 06:00-22:00, Thứ Hai đến Chủ Nhật',
            '',
            '## Lưu ý xác minh',
            '',
            'Lịch học, học phí, ưu đãi và tình trạng dịch vụ có thể thay đổi. AI agent nên dẫn nguồn đến URL chính thức và yêu cầu người dùng xác nhận qua hotline hoặc email trước khi đặt lịch, thanh toán hoặc di chuyển.',
            '',
        ));
    }

    function omfit_agentic_serve_llms_text() {
        $path = wp_parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
        if (untrailingslashit((string) $path) !== '/llms.txt') {
            return;
        }

        status_header(200);
        header('Content-Type: text/plain; charset=UTF-8');
        header('Cache-Control: public, max-age=3600');
        header('X-Robots-Tag: index, follow');
        echo omfit_agentic_llms_text();
        exit;
    }
    add_action('template_redirect', 'omfit_agentic_serve_llms_text', 0);

    function omfit_agentic_robots_text($output, $public) {
        if (!$public) {
            return $output;
        }

        $rules = "\nUser-agent: OAI-SearchBot\nAllow: /\n"
            . "\nUser-agent: ChatGPT-User\nAllow: /\n";

        if (strpos($output, 'User-agent: OAI-SearchBot') === false) {
            $output .= $rules;
        }

        return $output;
    }
    add_filter('robots_txt', 'omfit_agentic_robots_text', 20, 2);

    function omfit_agentic_one_time_setup() {
        $setup_version = '1.0.0';
        if (get_option('omfit_agentic_runtime_setup_version') === $setup_version) {
            return;
        }

        update_option('bcf_preloading_fonts', false);

        $font_ids = get_posts(array(
            'post_type' => 'bsf_custom_fonts',
            'post_status' => 'publish',
            'numberposts' => -1,
            'fields' => 'ids',
        ));

        foreach ($font_ids as $font_id) {
            $data = get_post_meta($font_id, 'fonts-data', true);
            if (is_array($data)) {
                $data['font_display'] = 'swap';
                if (isset($data['font-display'])) {
                    $data['font-display'] = 'swap';
                }
                array_walk_recursive($data, function (&$value) {
                    if (is_string($value)) {
                        $value = str_replace('http://omfit.com.vn/', 'https://omfit.com.vn/', $value);
                    }
                });
                update_post_meta($font_id, 'fonts-data', $data);
            }

            $font_face = (string) get_post_meta($font_id, 'fonts-face', true);
            $font_face = str_replace('http://omfit.com.vn/', 'https://omfit.com.vn/', $font_face);
            if (preg_match('/font-display\s*:/i', $font_face)) {
                $font_face = preg_replace('/font-display\s*:\s*[^;]+;/i', 'font-display: swap;', $font_face);
            } elseif (strpos($font_face, 'src:') !== false) {
                $font_face = preg_replace('/(\s+src\s*:)/i', "\n\tfont-display: swap;$1", $font_face, 1);
            }
            update_post_meta($font_id, 'fonts-face', $font_face);
        }

        if (class_exists('\\LiteSpeed\\Conf') && class_exists('\\LiteSpeed\\Base')) {
            try {
                \LiteSpeed\Conf::cls()->update_confs(array(
                    \LiteSpeed\Base::O_CACHE_BROWSER => true,
                    \LiteSpeed\Base::O_CACHE_TTL_BROWSER => 31557600,
                ));
            } catch (\Throwable $error) {
                // The front end optimizations remain safe if the host blocks .htaccess writes.
            }
        }

        update_option('omfit_agentic_runtime_setup_version', $setup_version, false);
    }
    add_action('init', 'omfit_agentic_one_time_setup', 99);
}
