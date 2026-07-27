<?php
/**
 * Plugin Name: OMFIT SEO Bridge
 * Description: Technical SEO, Vietnamese article typography, metadata, schema, redirects and sitemaps for OMFIT.
 * Version: 1.0.7
 * Author: OMFIT
 * Requires at least: 6.4
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('OMFIT_SEO_CANONICAL_HOST', 'omfit.com.vn');
define('OMFIT_SEO_SITE_NAME', 'OMFIT Fitness & Wellness');
define('OMFIT_SEO_BRIDGE_VERSION', '1.0.7');

function omfit_seo_canonical_url($url) {
    $url = preg_replace('#^http://#i', 'https://', (string) $url);
    return preg_replace('#^https://www\.omfit\.com\.vn#i', 'https://omfit.com.vn', $url);
}

function omfit_seo_sanitize_https_url($url) {
    $url = omfit_seo_canonical_url(trim((string) $url));
    $url = esc_url_raw($url, array('https'));
    if (!$url || strtolower((string) wp_parse_url($url, PHP_URL_SCHEME)) !== 'https') {
        return '';
    }

    return omfit_seo_canonical_url($url);
}

function omfit_seo_normalize_branches($value) {
    if (is_string($value)) {
        if (strlen($value) > 50000) {
            return array();
        }
        $decoded = json_decode($value, true);
        if (!is_array($decoded)) {
            $decoded = json_decode(wp_unslash($value), true);
        }
        $value = is_array($decoded) ? $decoded : array();
    }

    if (!is_array($value)) {
        return array();
    }

    if (isset($value['branches']) && is_array($value['branches'])) {
        $value = $value['branches'];
    }

    $branches = array();
    foreach (array_slice($value, 0, 20) as $branch) {
        if (!is_array($branch)) {
            continue;
        }

        $name = sanitize_text_field((string) ($branch['name'] ?? ''));
        $address = sanitize_textarea_field((string) ($branch['address'] ?? ''));
        if ($name === '' || $address === '') {
            continue;
        }

        $normalized = array(
            'name' => $name,
            'address' => $address,
        );

        $id = sanitize_key((string) ($branch['id'] ?? ''));
        $phone = sanitize_text_field((string) ($branch['phone'] ?? ''));
        $email = sanitize_email((string) ($branch['email'] ?? ''));
        $cta_url = omfit_seo_sanitize_https_url(
            (string) ($branch['ctaUrl'] ?? ($branch['cta_url'] ?? ($branch['url'] ?? '')))
        );

        if ($id !== '') {
            $normalized['id'] = $id;
        }
        if ($phone !== '') {
            $normalized['phone'] = $phone;
        }
        if ($email !== '') {
            $normalized['email'] = $email;
        }
        if ($cta_url !== '') {
            $normalized['ctaUrl'] = $cta_url;
        }

        foreach (array('addressLocality', 'addressRegion', 'postalCode', 'addressCountry') as $address_field) {
            $address_value = sanitize_text_field((string) ($branch[$address_field] ?? ''));
            if ($address_value !== '') {
                $normalized[$address_field] = $address_value;
            }
        }

        $services = array();
        foreach (array_slice((array) ($branch['services'] ?? array()), 0, 30) as $service) {
            $service = sanitize_text_field((string) $service);
            if ($service !== '') {
                $services[] = $service;
            }
        }
        if ($services) {
            $normalized['services'] = array_values(array_unique($services));
        }

        $branches[] = $normalized;
    }

    return $branches;
}

function omfit_seo_sanitize_branches_json($value) {
    $branches = omfit_seo_normalize_branches($value);
    return $branches ? wp_json_encode($branches, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '';
}

function omfit_seo_can_manage_editorial_meta($allowed, $meta_key, $post_id) {
    $capability = sanitize_key((string) apply_filters(
        'omfit_seo_editorial_meta_capability',
        'edit_others_posts',
        $meta_key,
        $post_id
    ));
    $capability = $capability ?: 'edit_others_posts';
    return current_user_can('edit_post', (int) $post_id) && current_user_can($capability);
}

function omfit_seo_can_manage_brand_meta($allowed, $meta_key, $post_id) {
    $capability = sanitize_key((string) apply_filters(
        'omfit_seo_brand_meta_capability',
        'manage_options',
        $meta_key,
        $post_id
    ));
    $capability = $capability ?: 'manage_options';
    return current_user_can('edit_post', (int) $post_id) && current_user_can($capability);
}

function omfit_seo_can_confirm_reviewer($allowed, $meta_key, $post_id) {
    return current_user_can('edit_post', (int) $post_id);
}

function omfit_seo_register_editorial_meta() {
    $author_text_fields = array(
        'omfit_author_name',
        'omfit_author_job_title',
    );

    foreach ($author_text_fields as $meta_key) {
        register_post_meta('post', $meta_key, array(
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'sanitize_callback' => 'sanitize_text_field',
            'auth_callback' => 'omfit_seo_can_manage_editorial_meta',
        ));
    }

    $reviewer_text_fields = array(
        'omfit_reviewer_name',
        'omfit_reviewer_credentials',
    );

    foreach ($reviewer_text_fields as $meta_key) {
        register_post_meta('post', $meta_key, array(
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'sanitize_callback' => 'sanitize_text_field',
            'auth_callback' => 'omfit_seo_can_manage_editorial_meta',
        ));
    }

    register_post_meta('post', 'omfit_author_url', array(
        'type' => 'string',
        'single' => true,
        'show_in_rest' => true,
        'sanitize_callback' => 'omfit_seo_sanitize_https_url',
        'auth_callback' => 'omfit_seo_can_manage_editorial_meta',
    ));

    register_post_meta('post', 'omfit_reviewer_url', array(
        'type' => 'string',
        'single' => true,
        'show_in_rest' => true,
        'sanitize_callback' => 'omfit_seo_sanitize_https_url',
        'auth_callback' => 'omfit_seo_can_manage_editorial_meta',
    ));

    register_post_meta('post', 'omfit_reviewer_confirmed', array(
        'type' => 'boolean',
        'single' => true,
        'default' => false,
        'show_in_rest' => true,
        'sanitize_callback' => 'rest_sanitize_boolean',
        'auth_callback' => 'omfit_seo_can_confirm_reviewer',
    ));

    foreach (array('omfit_publisher_logo_url') as $meta_key) {
        register_post_meta('post', $meta_key, array(
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'sanitize_callback' => 'omfit_seo_sanitize_https_url',
            'auth_callback' => 'omfit_seo_can_manage_brand_meta',
        ));
    }

    register_post_meta('post', 'omfit_branches_json', array(
        'type' => 'string',
        'single' => true,
        'show_in_rest' => true,
        'sanitize_callback' => 'omfit_seo_sanitize_branches_json',
        'auth_callback' => 'omfit_seo_can_manage_brand_meta',
    ));
}
add_action('init', 'omfit_seo_register_editorial_meta');

function omfit_seo_enqueue_frontend_assets() {
    wp_enqueue_style(
        'omfit-seo-be-vietnam-pro',
        'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap',
        array(),
        null
    );
}
add_action('wp_enqueue_scripts', 'omfit_seo_enqueue_frontend_assets');

function omfit_seo_description($post_id = 0) {
    $post = get_post($post_id ?: get_queried_object_id());
    if (!$post) {
        return get_bloginfo('description');
    }

    $description = has_excerpt($post)
        ? get_the_excerpt($post)
        : wp_strip_all_tags(strip_shortcodes($post->post_content));
    $description = preg_replace('/\s+/u', ' ', html_entity_decode($description, ENT_QUOTES, 'UTF-8'));
    $description = trim($description);

    $description = preg_replace('/(?:\.{2,}|…)\s*$/u', '', $description);
    if (mb_strlen($description, 'UTF-8') > 154) {
        $description = mb_substr($description, 0, 154, 'UTF-8');
        $description = preg_replace('/\s+\S*$/u', '', $description);
        $description = rtrim($description, " \t\n\r\0\x0B,;:!?–—-");
    }
    if ($description !== '' && !preg_match('/[.!?]\s*$/u', $description)) {
        $description .= '.';
    }

    return $description;
}

add_filter('allowed_redirect_hosts', function ($hosts) {
    $hosts[] = OMFIT_SEO_CANONICAL_HOST;
    return array_values(array_unique($hosts));
});

function omfit_seo_current_request_path() {
    $request_path = wp_parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
    $request_path = rawurldecode(is_string($request_path) ? $request_path : '/');
    $request_path = '/' . ltrim($request_path, '/');
    return $request_path === '/' ? '/' : untrailingslashit($request_path);
}

function omfit_seo_thin_archive_paths() {
    return array(
        '/2025/05',
    );
}

function omfit_seo_is_thin_archive_request() {
    return in_array(omfit_seo_current_request_path(), omfit_seo_thin_archive_paths(), true);
}

function omfit_seo_handle_legacy_paths() {
    if (is_admin() || wp_doing_ajax() || (defined('REST_REQUEST') && REST_REQUEST)) {
        return;
    }

    $request_path = omfit_seo_current_request_path();
    $request_query = (string) ($_SERVER['QUERY_STRING'] ?? '');

    $redirects = array(
        '/career-category/group-trainers' => '/huan-luyen-vien/',
        '/category/wellness' => '/kien-thuc-wellness/',
        '/service-category/sports-nutrition' => '/che-do-dinh-duong/',
    );

    if (isset($redirects[$request_path])) {
        $destination = 'https://' . OMFIT_SEO_CANONICAL_HOST . $redirects[$request_path];
        wp_safe_redirect($destination, 301, 'OMFIT SEO Bridge');
        exit;
    }

    $gone_paths = array(
        '/business/2025-07-15/game-bai-doi-thuong.pdf',
        '/company/2025-08-13/loto-choi-nhieu-nhat-trong-ngay.shtm',
        '/result/2025-08-18/bai-doi-thuong-52fun.shtml',
        '/huynhvicuong',
        '/chuminhdat',
        '/wp-content/plugins/*',
        '/product-tag/bodyweight-training',
        '/phamvanduy',
        '/sample-page',
        '/wdt_footers/footer-3',
        '/our-gallery-section',
        '/wdt_careers/therapeutic-yoga-teacher',
        '/portfolio-category/sound-theraphy',
        '/service-list',
        '/wdt_classes/digital-coaching',
        '/classes/weight-lifting-2',
    );

    $is_exact_query_spam = $request_path === '/'
        && $request_query === 'lot/2025-07-23/portomaso-casino.html';

    if ($is_exact_query_spam || in_array($request_path, $gone_paths, true)) {
        status_header(410);
        nocache_headers();
        header('X-Robots-Tag: noindex, nofollow', true);
        header('Content-Type: text/plain; charset=UTF-8', true);
        echo '410 Gone';
        exit;
    }
}
add_action('template_redirect', 'omfit_seo_handle_legacy_paths', -20);

add_action('template_redirect', function () {
    if (is_admin() || wp_doing_ajax() || (defined('REST_REQUEST') && REST_REQUEST)) {
        return;
    }

    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if ($host === 'www.' . OMFIT_SEO_CANONICAL_HOST) {
        $request_uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        wp_safe_redirect('https://' . OMFIT_SEO_CANONICAL_HOST . $request_uri, 301, 'OMFIT SEO Bridge');
        exit;
    }
}, 0);

add_action('init', function () {
    remove_action('wp_head', 'rel_canonical');
});

add_filter('get_canonical_url', 'omfit_seo_canonical_url', 20);

add_filter('pre_get_document_title', function ($title) {
    if (is_singular('post')) {
        return wp_strip_all_tags(get_the_title());
    }
    return $title;
}, 20);

function omfit_seo_remove_inline_heading_typography($content) {
    return preg_replace_callback(
        '/(<h[1-3]\b[^>]*?)\s+style\s*=\s*(["\'])(.*?)\2([^>]*>)/is',
        function ($matches) {
            $kept_declarations = array();
            $blocked_properties = array(
                'font-family',
                'font-size',
                'font-weight',
                'letter-spacing',
                'line-height',
            );

            foreach (preg_split('/\s*;\s*/', trim($matches[3])) as $declaration) {
                if ($declaration === '') {
                    continue;
                }

                if (
                    preg_match('/^\s*([a-z-]+)\s*:/i', $declaration, $property_match)
                    && in_array(strtolower($property_match[1]), $blocked_properties, true)
                ) {
                    continue;
                }

                $kept_declarations[] = trim($declaration);
            }

            $style_attribute = '';
            if ($kept_declarations) {
                $style_attribute = ' style="' . esc_attr(implode('; ', $kept_declarations)) . '"';
            }

            return $matches[1] . $style_attribute . $matches[4];
        },
        $content
    );
}

function omfit_seo_normalize_single_post_content($content) {
    if (!is_singular('post') || !in_the_loop() || !is_main_query()) {
        return $content;
    }

    $content = omfit_seo_remove_inline_heading_typography($content);
    $has_h1 = false;
    $content = preg_replace_callback(
        '/<h1\b([^>]*)>(.*?)<\/h1\s*>/is',
        function ($matches) use (&$has_h1) {
            if (!$has_h1) {
                $has_h1 = true;
                return $matches[0];
            }

            return '<h2' . $matches[1] . '>' . $matches[2] . '</h2>';
        },
        $content
    );

    if (!$has_h1) {
        $content = '<h1 class="omfit-article-title">' . esc_html(get_the_title()) . '</h1>' . $content;
    }

    if (!preg_match('/\bclass\s*=\s*(["\'])[^"\']*\bomfit-article-content\b[^"\']*\1/i', $content)) {
        $content = '<div class="omfit-article-content">' . $content . '</div>';
    }

    return $content;
}
add_filter('the_content', 'omfit_seo_normalize_single_post_content', 5);

function omfit_seo_editorial_identity($post_id) {
    $reviewer_confirmed = rest_sanitize_boolean(
        get_post_meta($post_id, 'omfit_reviewer_confirmed', true)
    );
    return array(
        'author_name' => sanitize_text_field((string) get_post_meta($post_id, 'omfit_author_name', true)),
        'author_url' => omfit_seo_sanitize_https_url(get_post_meta($post_id, 'omfit_author_url', true)),
        'author_job_title' => sanitize_text_field((string) get_post_meta($post_id, 'omfit_author_job_title', true)),
        'reviewer_name' => $reviewer_confirmed
            ? sanitize_text_field((string) get_post_meta($post_id, 'omfit_reviewer_name', true))
            : '',
        'reviewer_url' => $reviewer_confirmed
            ? omfit_seo_sanitize_https_url(get_post_meta($post_id, 'omfit_reviewer_url', true))
            : '',
        'reviewer_credentials' => $reviewer_confirmed
            ? sanitize_text_field((string) get_post_meta($post_id, 'omfit_reviewer_credentials', true))
            : '',
    );
}

function omfit_seo_visible_author_post_id($user_id = 0) {
    if (!is_singular('post')) {
        return 0;
    }

    global $post;
    $queried_post_id = (int) get_queried_object_id();
    $post_id = $post instanceof WP_Post ? (int) $post->ID : $queried_post_id;
    if (!$post_id || $post_id !== $queried_post_id || get_post_type($post_id) !== 'post') {
        return 0;
    }

    $post_author_id = (int) get_post_field('post_author', $post_id);
    if ($user_id && $post_author_id !== (int) $user_id) {
        return 0;
    }

    return $post_id;
}

function omfit_seo_filter_visible_author_name($display_name, $user_id = 0) {
    $post_id = omfit_seo_visible_author_post_id($user_id);
    if (!$post_id) {
        return $display_name;
    }

    $custom_name = sanitize_text_field((string) get_post_meta($post_id, 'omfit_author_name', true));
    return $custom_name !== '' ? $custom_name : $display_name;
}
add_filter('get_the_author_display_name', 'omfit_seo_filter_visible_author_name', 20, 2);
add_filter('the_author', 'omfit_seo_filter_visible_author_name', 20, 1);

function omfit_seo_filter_visible_author_link($link, $author_id) {
    $post_id = omfit_seo_visible_author_post_id($author_id);
    if (!$post_id) {
        return $link;
    }

    $custom_name = sanitize_text_field((string) get_post_meta($post_id, 'omfit_author_name', true));
    $custom_url = omfit_seo_sanitize_https_url(get_post_meta($post_id, 'omfit_author_url', true));
    return $custom_name !== '' && $custom_url !== '' ? $custom_url : $link;
}
add_filter('author_link', 'omfit_seo_filter_visible_author_link', 20, 2);

function omfit_seo_render_editorial_identity($content) {
    if (!is_singular('post') || !in_the_loop() || !is_main_query()) {
        return $content;
    }

    $identity = omfit_seo_editorial_identity(get_queried_object_id());
    if ($identity['author_name'] === '' && $identity['reviewer_name'] === '') {
        return $content;
    }

    $rows = array();
    if ($identity['author_name'] !== '') {
        $author = esc_html($identity['author_name']);
        if ($identity['author_url'] !== '') {
            $author = '<a href="' . esc_url($identity['author_url']) . '" rel="author">' . $author . '</a>';
        }
        if ($identity['author_job_title'] !== '') {
            $author .= '<span class="omfit-editorial-role"> — ' . esc_html($identity['author_job_title']) . '</span>';
        }
        $rows[] = '<p><span class="omfit-editorial-label">Tác giả:</span> ' . $author . '</p>';
    }

    if ($identity['reviewer_name'] !== '') {
        $reviewer = esc_html($identity['reviewer_name']);
        if ($identity['reviewer_url'] !== '') {
            $reviewer = '<a href="' . esc_url($identity['reviewer_url']) . '">' . $reviewer . '</a>';
        }
        if ($identity['reviewer_credentials'] !== '') {
            $reviewer .= '<span class="omfit-editorial-role"> — ' . esc_html($identity['reviewer_credentials']) . '</span>';
        }
        $rows[] = '<p><span class="omfit-editorial-label">Kiểm duyệt chuyên môn:</span> ' . $reviewer . '</p>';
    }

    $byline = '<aside class="omfit-editorial-identity" aria-label="Thông tin biên tập">'
        . implode('', $rows)
        . '</aside>';

    if (preg_match('/<h1\b[^>]*>.*?<\/h1\s*>/is', $content)) {
        return preg_replace_callback(
            '/<h1\b[^>]*>.*?<\/h1\s*>/is',
            function ($matches) use ($byline) {
                return $matches[0] . $byline;
            },
            $content,
            1
        );
    }

    return $byline . $content;
}
add_filter('the_content', 'omfit_seo_render_editorial_identity', 6);

function omfit_seo_print_single_post_typography() {
    if (!is_singular('post')) {
        return;
    }
    ?>
    <style id="omfit-seo-single-post-typography">
        body.single-post article.type-post > h3.post-title {
            display: none !important;
        }

        body.single-post .omfit-article-content,
        body.single-post article.type-post .entry-content,
        body.single-post article.type-post .post-content,
        body.single-post article.type-post .pxl-post--content {
            color: #e5e7eb !important;
            font-family: "Be Vietnam Pro", Inter, "Noto Sans", "Segoe UI", Arial, sans-serif !important;
            font-size: 16px !important;
            font-weight: 400 !important;
            line-height: 1.75 !important;
            overflow-wrap: anywhere;
            text-rendering: optimizeLegibility;
        }

        /*
         * Keep the article surface paired with the enforced light typography.
         * This matches the current OMFIT single-post theme and prevents light
         * text from becoming unreadable if an Elementor wrapper turns white.
         */
        body.single-post .omfit-article-content {
            background-color: #233968 !important;
        }

        body.single-post .omfit-article-content p,
        body.single-post .omfit-article-content li,
        body.single-post .omfit-article-content blockquote,
        body.single-post .omfit-article-content td,
        body.single-post .omfit-article-content th,
        body.single-post .omfit-article-content figcaption {
            font-size: 16px !important;
            font-weight: 400 !important;
            line-height: 1.75 !important;
        }

        body.single-post .omfit-article-content p,
        body.single-post .omfit-article-content li,
        body.single-post .omfit-article-content blockquote,
        body.single-post .omfit-article-content td,
        body.single-post .omfit-article-content th {
            color: #e5e7eb !important;
        }

        body.single-post .omfit-article-content figcaption {
            color: #cbd5e1 !important;
        }

        body.single-post .omfit-article-content .omfit-editorial-identity {
            margin: -8px 0 24px;
            padding: 14px 16px;
            border-left: 3px solid #67c1ff;
            border-radius: 0 10px 10px 0;
            background: #18232e;
            color: #cbd5e1 !important;
        }

        body.single-post .omfit-article-content .omfit-editorial-identity p {
            margin: 0 !important;
            color: #cbd5e1 !important;
            font-size: 14px !important;
            font-weight: 400 !important;
            line-height: 1.65 !important;
        }

        body.single-post .omfit-article-content .omfit-editorial-identity p + p {
            margin-top: 4px !important;
        }

        body.single-post .omfit-article-content .omfit-editorial-label,
        body.single-post .omfit-article-content .omfit-editorial-role {
            color: inherit !important;
            font-weight: 400 !important;
        }

        body.single-post .omfit-article-content .omfit-editorial-identity a {
            color: #67c1ff !important;
            font-weight: 400 !important;
        }

        body.single-post .omfit-article-content blockquote {
            padding: 18px 20px;
            border-left: 4px solid #67c1ff;
            border-radius: 0 12px 12px 0;
            background: #18232e !important;
        }

        body.single-post .omfit-article-content p :where(span, strong, b, em),
        body.single-post .omfit-article-content li :where(span, strong, b, em),
        body.single-post .omfit-article-content blockquote :where(span, strong, b, em),
        body.single-post .omfit-article-content td :where(span, strong, b, em),
        body.single-post .omfit-article-content th :where(span, strong, b, em) {
            color: inherit !important;
        }

        body.single-post .omfit-article-content h1,
        body.single-post article.type-post h1.omfit-article-title,
        body.single-post article.type-post .entry-content h1 {
            color: #f8fafc !important;
            font-size: 32px !important;
            font-weight: 700 !important;
            letter-spacing: -0.02em !important;
            line-height: 1.3 !important;
            margin-block: 0 24px !important;
        }

        body.single-post .omfit-article-content h2,
        body.single-post article.type-post .entry-content h2 {
            color: #f8fafc !important;
            font-size: 24px !important;
            font-weight: 700 !important;
            letter-spacing: -0.01em !important;
            line-height: 1.4 !important;
            margin-block: 32px 14px !important;
        }

        body.single-post .omfit-article-content h3,
        body.single-post article.type-post .entry-content h3 {
            color: #f8fafc !important;
            font-size: 20px !important;
            font-weight: 600 !important;
            line-height: 1.45 !important;
            margin-block: 26px 12px !important;
        }

        body.single-post .omfit-article-content img {
            height: auto;
            max-width: 100%;
        }

        body.single-post .omfit-article-content a {
            color: #67c1ff !important;
            text-decoration-line: underline;
            text-decoration-thickness: 1px;
            text-underline-offset: 3px;
        }

        body.single-post .omfit-article-content .omfit-related-content,
        body.single-post .omfit-article-content nav[aria-label="Mục lục bài viết"] {
            margin-top: 32px;
            padding: 20px 22px;
            border: 1px solid rgba(103, 193, 255, .35);
            border-radius: 16px;
            background: #18232e !important;
            color: #e5e7eb !important;
        }

        body.single-post .omfit-article-content .omfit-related-content p,
        body.single-post .omfit-article-content .omfit-related-content li,
        body.single-post .omfit-article-content .omfit-related-content span,
        body.single-post .omfit-article-content nav[aria-label="Mục lục bài viết"] p,
        body.single-post .omfit-article-content nav[aria-label="Mục lục bài viết"] li,
        body.single-post .omfit-article-content nav[aria-label="Mục lục bài viết"] span {
            color: #e5e7eb !important;
            font-weight: 400 !important;
        }

        body.single-post .omfit-article-content .omfit-related-content a,
        body.single-post .omfit-article-content nav[aria-label="Mục lục bài viết"] a {
            color: #67c1ff !important;
            font-weight: 400 !important;
        }

        body.single-post .omfit-article-content .omfit-article-footer {
            margin-top: 32px;
            padding: 24px;
            border: 1px solid rgba(103, 193, 255, .35);
            border-radius: 16px;
            background: #18232e;
            color: #e5e7eb !important;
        }

        body.single-post .omfit-article-content .omfit-article-footer,
        body.single-post .omfit-article-content .omfit-article-footer p,
        body.single-post .omfit-article-content .omfit-article-footer li,
        body.single-post .omfit-article-content .omfit-article-footer span,
        body.single-post .omfit-article-content .omfit-article-footer a {
            color: #e5e7eb !important;
            font-weight: 400 !important;
        }

        body.single-post .omfit-article-content .omfit-article-footer h2 {
            margin: 0 0 12px !important;
            color: #fff !important;
            font-size: 24px !important;
            font-weight: 600 !important;
            line-height: 1.35 !important;
        }

        body.single-post .omfit-article-content .omfit-footer-brand {
            display: flex;
            align-items: flex-start;
            gap: 16px;
        }

        body.single-post .omfit-article-content img.omfit-footer-logo {
            width: 96px !important;
            height: 64px !important;
            flex: 0 0 96px;
            padding: 8px;
            border-radius: 12px;
            background: #fff;
            object-fit: contain;
        }

        body.single-post .omfit-article-content .omfit-footer-contact,
        body.single-post .omfit-article-content .omfit-footer-branches {
            margin: 16px 0 0 !important;
        }

        body.single-post .omfit-article-content .omfit-footer-branches {
            padding-left: 20px;
        }

        body.single-post .omfit-article-content .omfit-footer-branches li {
            margin-bottom: 8px;
        }

        body.single-post .omfit-article-content .omfit-footer-branch-name {
            display: block;
            color: #fff !important;
        }

        body.single-post .omfit-article-content .omfit-article-footer a {
            color: #67c1ff !important;
        }

        body.single-post .omfit-article-content .omfit-footer-action {
            margin: 16px 0 0 !important;
        }

        body.single-post .omfit-article-content a.omfit-footer-cta {
            display: inline-flex;
            min-height: 44px;
            align-items: center;
            padding: 10px 16px;
            border-radius: 12px;
            background: #076fbd;
            color: #fff !important;
            text-decoration: none;
        }

        @media (max-width: 767px) {
            body.single-post .omfit-article-content h1,
            body.single-post article.type-post h1.omfit-article-title,
            body.single-post article.type-post .entry-content h1 {
                font-size: 28px !important;
                line-height: 1.35 !important;
            }

            body.single-post .omfit-article-content h2,
            body.single-post article.type-post .entry-content h2 {
                font-size: 22px !important;
                line-height: 1.4 !important;
            }

            body.single-post .omfit-article-content h3,
            body.single-post article.type-post .entry-content h3 {
                font-size: 18px !important;
                line-height: 1.5 !important;
            }

            body.single-post .omfit-article-content .omfit-footer-brand {
                flex-direction: column;
            }
        }
    </style>
    <?php
}
add_action('wp_head', 'omfit_seo_print_single_post_typography', 99);

function omfit_seo_echo_meta_tag($attribute, $key, $content) {
    static $emitted_tags = array();

    if ($content === null || $content === '') {
        return;
    }

    $signature = strtolower($attribute . ':' . $key);
    if (isset($emitted_tags[$signature])) {
        return;
    }

    $emitted_tags[$signature] = true;
    echo '<meta ' . esc_attr($attribute) . '="' . esc_attr($key) . '" content="' . esc_attr($content) . '" />' . "\n";
}

function omfit_seo_image_object_from_attachment($attachment_id) {
    $image_data = $attachment_id ? wp_get_attachment_image_src((int) $attachment_id, 'full') : false;
    if (!$image_data || empty($image_data[0])) {
        return array();
    }

    $image = array(
        '@type' => 'ImageObject',
        'url' => omfit_seo_canonical_url($image_data[0]),
    );
    if (!empty($image_data[1])) {
        $image['width'] = (int) $image_data[1];
    }
    if (!empty($image_data[2])) {
        $image['height'] = (int) $image_data[2];
    }

    return $image;
}

function omfit_seo_image_object_from_url($url) {
    $url = omfit_seo_sanitize_https_url($url);
    if ($url === '') {
        return array();
    }

    $attachment_id = attachment_url_to_postid($url);
    if ($attachment_id) {
        return omfit_seo_image_object_from_attachment($attachment_id);
    }

    return array(
        '@type' => 'ImageObject',
        'url' => $url,
    );
}

function omfit_seo_schema_author($post_id) {
    $identity = omfit_seo_editorial_identity($post_id);
    if ($identity['author_name'] !== '') {
        $author = array(
            '@type' => 'Person',
            'name' => $identity['author_name'],
        );
        if ($identity['author_url'] !== '') {
            $author['url'] = $identity['author_url'];
        }
        if ($identity['author_job_title'] !== '') {
            $author['jobTitle'] = $identity['author_job_title'];
        }
        return $author;
    }

    $author_id = (int) get_post_field('post_author', $post_id);
    $author_name = $author_id
        ? sanitize_text_field((string) get_the_author_meta('display_name', $author_id))
        : '';
    if ($author_id && $author_name !== '') {
        return array(
            '@type' => 'Person',
            'name' => $author_name,
            'url' => omfit_seo_canonical_url(get_author_posts_url($author_id)),
        );
    }

    return array(
        '@type' => 'Organization',
        'name' => OMFIT_SEO_SITE_NAME,
        'url' => omfit_seo_canonical_url(home_url('/')),
    );
}

function omfit_seo_schema_reviewer($post_id) {
    $identity = omfit_seo_editorial_identity($post_id);
    if ($identity['reviewer_name'] === '') {
        return array();
    }

    $reviewer = array(
        '@type' => 'Person',
        'name' => $identity['reviewer_name'],
    );
    if ($identity['reviewer_url'] !== '') {
        $reviewer['url'] = $identity['reviewer_url'];
    }
    if ($identity['reviewer_credentials'] !== '') {
        $reviewer['description'] = $identity['reviewer_credentials'];
    }

    return $reviewer;
}

function omfit_seo_schema_publisher($post_id) {
    $site_name = sanitize_text_field((string) get_bloginfo('name'));
    $publisher = array(
        '@type' => 'Organization',
        'name' => $site_name !== '' ? $site_name : OMFIT_SEO_SITE_NAME,
        'url' => omfit_seo_canonical_url(home_url('/')),
    );

    $logo = omfit_seo_image_object_from_url(get_post_meta($post_id, 'omfit_publisher_logo_url', true));
    if (!$logo) {
        $custom_logo_id = (int) get_theme_mod('custom_logo');
        $logo = omfit_seo_image_object_from_attachment($custom_logo_id);
    }
    if ($logo) {
        $publisher['logo'] = $logo;
    }

    return $publisher;
}

function omfit_seo_breadcrumb_schema($canonical, $title) {
    $posts_page_id = (int) get_option('page_for_posts');
    if ($posts_page_id && get_post_status($posts_page_id) !== 'publish') {
        $posts_page_id = 0;
    }
    if (!$posts_page_id) {
        $news_page = get_page_by_path('tin-tuc', OBJECT, 'page');
        $posts_page_id = $news_page && $news_page->post_status === 'publish'
            ? (int) $news_page->ID
            : 0;
    }
    if (!$posts_page_id) {
        return array();
    }

    $news_url = get_permalink($posts_page_id);
    if (!$news_url) {
        return array();
    }
    $news_url = omfit_seo_canonical_url($news_url);

    return array(
        '@context' => 'https://schema.org',
        '@type' => 'BreadcrumbList',
        'itemListElement' => array(
            array(
                '@type' => 'ListItem',
                'position' => 1,
                'name' => 'Trang chủ',
                'item' => omfit_seo_canonical_url(home_url('/')),
            ),
            array(
                '@type' => 'ListItem',
                'position' => 2,
                'name' => 'Tin tức',
                'item' => $news_url,
            ),
            array(
                '@type' => 'ListItem',
                'position' => 3,
                'name' => $title,
                'item' => $canonical,
            ),
        ),
    );
}

function omfit_seo_normalized_visible_text($value) {
    $value = html_entity_decode(
        wp_strip_all_tags(strip_shortcodes((string) $value)),
        ENT_QUOTES,
        'UTF-8'
    );
    return trim(preg_replace('/\s+/u', ' ', $value));
}

function omfit_seo_post_visibly_mentions_branch($post_id, $branch) {
    $content = omfit_seo_normalized_visible_text(get_post_field('post_content', $post_id));
    $name = omfit_seo_normalized_visible_text($branch['name']);
    $address = omfit_seo_normalized_visible_text($branch['address']);

    return $content !== ''
        && $name !== ''
        && $address !== ''
        && mb_stripos($content, $name, 0, 'UTF-8') !== false
        && mb_stripos($content, $address, 0, 'UTF-8') !== false;
}

function omfit_seo_healthclub_schemas($post_id, $publisher) {
    $branches = omfit_seo_normalize_branches(get_post_meta($post_id, 'omfit_branches_json', true));
    $branches = omfit_seo_normalize_branches(
        apply_filters('omfit_seo_healthclub_branches', $branches, $post_id)
    );
    if (!$branches) {
        return array();
    }

    $schemas = array();
    $seen = array();
    foreach ($branches as $branch) {
        if (!omfit_seo_post_visibly_mentions_branch($post_id, $branch)) {
            continue;
        }

        $signature = strtolower($branch['name'] . '|' . $branch['address']);
        if (isset($seen[$signature])) {
            continue;
        }
        $seen[$signature] = true;

        $schema = array(
            '@context' => 'https://schema.org',
            '@type' => 'HealthClub',
            '@id' => $publisher['url'] . '#healthclub-' . substr(md5($signature), 0, 12),
            'name' => $branch['name'],
            'address' => array(
                '@type' => 'PostalAddress',
                'streetAddress' => $branch['address'],
            ),
            'parentOrganization' => array(
                '@type' => 'Organization',
                'name' => $publisher['name'],
                'url' => $publisher['url'],
            ),
        );
        foreach (array('addressLocality', 'addressRegion', 'postalCode', 'addressCountry') as $address_field) {
            if (!empty($branch[$address_field])) {
                $schema['address'][$address_field] = $branch[$address_field];
            }
        }
        if (!empty($branch['phone'])) {
            $schema['telephone'] = $branch['phone'];
        }
        if (!empty($branch['email'])) {
            $schema['email'] = $branch['email'];
        }
        if (!empty($branch['ctaUrl'])) {
            $schema['url'] = $branch['ctaUrl'];
        }
        if (!empty($publisher['logo']['url'])) {
            $schema['logo'] = $publisher['logo']['url'];
        }

        $schemas[] = $schema;
    }

    return $schemas;
}

add_action('wp_head', function () {
    if (omfit_seo_is_thin_archive_request()) {
        $archive_canonical = 'https://' . OMFIT_SEO_CANONICAL_HOST
            . trailingslashit(omfit_seo_current_request_path());
        echo '<link rel="canonical" href="' . esc_url($archive_canonical) . '" />' . "\n";
    }

    if (is_singular()) {
        $post_id = get_queried_object_id();
        $canonical = omfit_seo_canonical_url(get_permalink($post_id));
        $title = wp_strip_all_tags(get_the_title($post_id));
        $description = omfit_seo_description($post_id);
        $image_id = get_post_thumbnail_id($post_id);
        $image_data = $image_id ? wp_get_attachment_image_src($image_id, 'full') : false;
        $image = $image_data ? $image_data[0] : get_the_post_thumbnail_url($post_id, 'full');
        $image_width = $image_data ? (int) $image_data[1] : 0;
        $image_height = $image_data ? (int) $image_data[2] : 0;
        $image_alt = $image_id ? trim(wp_strip_all_tags(get_post_meta($image_id, '_wp_attachment_image_alt', true))) : '';
        $image_alt = $image_alt ?: $title;

        echo '<link rel="canonical" href="' . esc_url($canonical) . '" />' . "\n";
        if ($description) {
            omfit_seo_echo_meta_tag('name', 'description', $description);
            omfit_seo_echo_meta_tag('property', 'og:description', $description);
            omfit_seo_echo_meta_tag('name', 'twitter:description', $description);
        }
        omfit_seo_echo_meta_tag('property', 'og:type', is_singular('post') ? 'article' : 'website');
        omfit_seo_echo_meta_tag('property', 'og:title', $title);
        omfit_seo_echo_meta_tag('property', 'og:url', $canonical);
        omfit_seo_echo_meta_tag('property', 'og:site_name', OMFIT_SEO_SITE_NAME);
        omfit_seo_echo_meta_tag('name', 'twitter:card', 'summary_large_image');
        omfit_seo_echo_meta_tag('name', 'twitter:title', $title);
        if ($image) {
            omfit_seo_echo_meta_tag('property', 'og:image', $image);
            omfit_seo_echo_meta_tag('property', 'og:image:width', $image_width ? (string) $image_width : '');
            omfit_seo_echo_meta_tag('property', 'og:image:height', $image_height ? (string) $image_height : '');
            omfit_seo_echo_meta_tag('property', 'og:image:alt', $image_alt);
            omfit_seo_echo_meta_tag('name', 'twitter:image', $image);
            omfit_seo_echo_meta_tag('name', 'twitter:image:alt', $image_alt);
        }

        if (is_singular('post')) {
            omfit_seo_echo_meta_tag('property', 'article:published_time', get_the_date(DATE_W3C, $post_id));
            omfit_seo_echo_meta_tag('property', 'article:modified_time', get_the_modified_date(DATE_W3C, $post_id));

            $publisher = omfit_seo_schema_publisher($post_id);
            $reviewer = omfit_seo_schema_reviewer($post_id);
            $main_entity = array('@type' => 'WebPage', '@id' => $canonical);
            if ($reviewer) {
                $main_entity['reviewedBy'] = $reviewer;
            }
            $schema = array(
                '@context' => 'https://schema.org',
                '@type' => 'BlogPosting',
                'headline' => $title,
                'description' => $description,
                'mainEntityOfPage' => $main_entity,
                'datePublished' => get_the_date(DATE_W3C, $post_id),
                'dateModified' => get_the_modified_date(DATE_W3C, $post_id),
                'author' => omfit_seo_schema_author($post_id),
                'publisher' => $publisher,
            );
            if ($image) {
                $schema['image'] = array($image);
            }
            echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>' . "\n";

            $breadcrumb_schema = omfit_seo_breadcrumb_schema($canonical, $title);
            if ($breadcrumb_schema) {
                echo '<script type="application/ld+json">' . wp_json_encode($breadcrumb_schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>' . "\n";
            }

            foreach (omfit_seo_healthclub_schemas($post_id, $publisher) as $healthclub_schema) {
                echo '<script type="application/ld+json">' . wp_json_encode($healthclub_schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>' . "\n";
            }
        }
    }

    if (is_front_page()) {
        $website_schema = array(
            '@context' => 'https://schema.org',
            '@type' => 'WebSite',
            'name' => OMFIT_SEO_SITE_NAME,
            'url' => 'https://omfit.com.vn/',
        );
        echo '<script type="application/ld+json">' . wp_json_encode($website_schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>' . "\n";
    }
}, 5);

add_filter('wp_sitemaps_post_types', function ($post_types) {
    foreach (array('pxl-template', 'mp-column', 'portfolio', 'case', 'elementor_library', 'mp-event', 'product') as $post_type) {
        unset($post_types[$post_type]);
    }
    return $post_types;
});

add_filter('wp_sitemaps_taxonomies', function ($taxonomies) {
    return array();
});

add_filter('wp_sitemaps_add_provider', function ($provider, $name) {
    return $name === 'users' ? false : $provider;
}, 10, 2);

function omfit_seo_excluded_page_slugs() {
    return array(
        'sample-page',
        'cart',
        'checkout',
        'my-account',
        'wishlist',
        'shop',
        'coming-soon',
        'blog',
        'blog-1',
        'service-1',
        'service-2',
        'classes-1',
        'classes-2',
        'classes-3',
        'classes-4',
        'schedule-v1',
        'schedule-v2',
        'contact-us-2',
        'landing',
        'home-1-one-page',
        'home-2',
        'home-2-one-page',
        'home-3',
        'home-3-one-page',
        'home-4',
        'home-4-one-page',
    );
}

add_filter('wp_sitemaps_posts_query_args', function ($args, $post_type) {
    if ($post_type !== 'page') {
        return $args;
    }

    $excluded_ids = array();
    foreach (omfit_seo_excluded_page_slugs() as $slug) {
        $page = get_page_by_path($slug, OBJECT, 'page');
        if ($page) {
            $excluded_ids[] = (int) $page->ID;
        }
    }
    if ($excluded_ids) {
        $args['post__not_in'] = array_values(array_unique(array_merge(
            isset($args['post__not_in']) ? (array) $args['post__not_in'] : array(),
            $excluded_ids
        )));
    }
    return $args;
}, 10, 2);

add_filter('wp_robots', function ($robots) {
    if (omfit_seo_is_thin_archive_request()) {
        $robots['noindex'] = true;
        $robots['follow'] = true;
        unset($robots['index'], $robots['nofollow']);
    }

    if (is_singular(array('product', 'mp-event'))) {
        $robots['noindex'] = true;
        $robots['follow'] = true;
        unset($robots['index']);
    }

    if (is_page(omfit_seo_excluded_page_slugs())) {
        $robots['noindex'] = true;
        $robots['follow'] = true;
        unset($robots['index']);
    }
    return $robots;
});

register_activation_hook(__FILE__, 'flush_rewrite_rules');
register_deactivation_hook(__FILE__, 'flush_rewrite_rules');
