/**
 * OMFIT indexing cleanup deployed through Code Snippets.
 * This mirrors the indexing-specific additions in SEO Bridge 1.0.8.
 */

if (!defined('ABSPATH')) {
    return;
}

add_action('template_redirect', function () {
    $path = wp_parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
    $raw_path = rawurldecode(is_string($path) ? $path : '/');
    $path = '/' . trim($raw_path, '/');

    $redirects = array(
        '/nhung-loi-co-ban-pho-bien-khi-tap-yoga-bay-va-cach-khac-phuc' => '/nhung-sai-lam-pho-bien-khi-tap-yoga-bay-va-cach-khac-phuc/',
        '/8882-2' => '/khong-gian-phong-tap-anh-huong-tam-trang-hieu-qua/',
        '/8793-2' => '/7-loi-ich-tap-luyen-zumba/',
        '/2025-nfl-draft-most-likely-trade-partners-with-titans-for-no-1-pick' => '/phu-nu-tap-gym-co-bi-do-khong/',
        '/seahawks-fill-qb-void-with-sam-darnold-is-he-an-upgrade-over-geno-smith' => '/so-sanh-ems-training-va-tap-gym-truyen-thong/',
    );

    if ($path === '/che-do-dinh-duong' && substr($raw_path, -1) !== '/') {
        wp_safe_redirect('https://omfit.com.vn/che-do-dinh-duong/', 301, 'OMFIT Indexing Cleanup');
        exit;
    }

    if (isset($redirects[$path])) {
        wp_safe_redirect('https://omfit.com.vn' . $redirects[$path], 301, 'OMFIT Indexing Cleanup');
        exit;
    }

    if (in_array($path, array(
        '/classes/weight-lifting',
        '/product/fitness-cycling-tool',
        '/sample-page/feed',
    ), true)) {
        status_header(410);
        nocache_headers();
        header('X-Robots-Tag: noindex, follow', true);
        exit;
    }
}, -30);

add_action('send_headers', function () {
    if (is_feed()) {
        header('X-Robots-Tag: noindex, follow', true);
    }
});

add_filter('wp_sitemaps_posts_query_args', function ($args, $post_type) {
    if ($post_type === 'post') {
        $args['post__not_in'] = array_values(array_unique(array_merge(
            isset($args['post__not_in']) ? (array) $args['post__not_in'] : array(),
            array(8399)
        )));
    }

    return $args;
}, 20, 2);
