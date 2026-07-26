<?php
/**
 * Plugin Name: OMFIT SEO Bridge
 * Description: Chuẩn hóa canonical, metadata, schema, H1 và sitemap cho nội dung OMFIT.
 * Version: 1.0.3
 * Author: OMFIT
 * Requires at least: 6.4
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('OMFIT_SEO_CANONICAL_HOST', 'omfit.com.vn');
define('OMFIT_SEO_SITE_NAME', 'OMFIT Fitness & Wellness');

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

    if (mb_strlen($description, 'UTF-8') > 160) {
        $description = mb_substr($description, 0, 157, 'UTF-8');
        $description = preg_replace('/\s+\S*$/u', '', $description) . '...';
    }

    return $description;
}

add_filter('allowed_redirect_hosts', function ($hosts) {
    $hosts[] = OMFIT_SEO_CANONICAL_HOST;
    return array_values(array_unique($hosts));
});

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

add_filter('the_content', function ($content) {
    if (!is_singular('post') || !in_the_loop() || !is_main_query()) {
        return $content;
    }
    if (!preg_match('/<h1\b/i', $content)) {
        $content = '<h1 class="omfit-article-title">' . esc_html(get_the_title()) . '</h1>' . $content;
    }
    return $content;
}, 5);

add_action('wp_head', function () {
    if (is_singular()) {
        $post_id = get_queried_object_id();
        $canonical = omfit_seo_canonical_url(get_permalink($post_id));
        $title = wp_strip_all_tags(get_the_title($post_id));
        $description = omfit_seo_description($post_id);
        $image = get_the_post_thumbnail_url($post_id, 'full');

        echo '<link rel="canonical" href="' . esc_url($canonical) . '" />' . "\n";
        if ($description) {
            echo '<meta name="description" content="' . esc_attr($description) . '" />' . "\n";
            echo '<meta property="og:description" content="' . esc_attr($description) . '" />' . "\n";
            echo '<meta name="twitter:description" content="' . esc_attr($description) . '" />' . "\n";
        }
        echo '<meta property="og:type" content="' . (is_singular('post') ? 'article' : 'website') . '" />' . "\n";
        echo '<meta property="og:title" content="' . esc_attr($title) . '" />' . "\n";
        echo '<meta property="og:url" content="' . esc_url($canonical) . '" />' . "\n";
        echo '<meta property="og:site_name" content="' . esc_attr(OMFIT_SEO_SITE_NAME) . '" />' . "\n";
        echo '<meta name="twitter:card" content="summary_large_image" />' . "\n";
        echo '<meta name="twitter:title" content="' . esc_attr($title) . '" />' . "\n";
        if ($image) {
            echo '<meta property="og:image" content="' . esc_url($image) . '" />' . "\n";
            echo '<meta name="twitter:image" content="' . esc_url($image) . '" />' . "\n";
        }

        if (is_singular('post')) {
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
