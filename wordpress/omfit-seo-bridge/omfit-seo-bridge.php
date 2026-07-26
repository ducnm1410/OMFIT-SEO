<?php
/**
 * Plugin Name: OMFIT SEO Bridge
 * Description: Technical SEO, Vietnamese article typography, metadata, schema, redirects and sitemaps for OMFIT.
 * Version: 1.0.5
 * Author: OMFIT
 * Requires at least: 6.4
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('OMFIT_SEO_CANONICAL_HOST', 'omfit.com.vn');
define('OMFIT_SEO_SITE_NAME', 'OMFIT Fitness & Wellness');
define('OMFIT_SEO_BRIDGE_VERSION', '1.0.5');

function omfit_seo_canonical_url($url) {
    $url = preg_replace('#^http://#i', 'https://', (string) $url);
    return preg_replace('#^https://www\.omfit\.com\.vn#i', 'https://omfit.com.vn', $url);
}

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

            $schema = array(
                '@context' => 'https://schema.org',
                '@type' => 'BlogPosting',
                'headline' => $title,
                'description' => $description,
                'mainEntityOfPage' => array('@type' => 'WebPage', '@id' => $canonical),
                'datePublished' => get_the_date(DATE_W3C, $post_id),
                'dateModified' => get_the_modified_date(DATE_W3C, $post_id),
                'author' => array('@type' => 'Organization', 'name' => OMFIT_SEO_SITE_NAME, 'url' => 'https://omfit.com.vn/'),
                'publisher' => array('@type' => 'Organization', 'name' => OMFIT_SEO_SITE_NAME, 'url' => 'https://omfit.com.vn/'),
            );
            if ($image) {
                $schema['image'] = array($image);
            }
            echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>' . "\n";
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
