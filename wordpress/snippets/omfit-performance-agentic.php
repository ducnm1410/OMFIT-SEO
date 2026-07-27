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

        foreach (array('waypoints', 'pxl-counter') as $handle) {
            wp_script_add_data($handle, 'strategy', 'defer');
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
        $mobile_wellness = 'https://omfit.com.vn/wp-content/uploads/2026/07/omfit-home-wellness-background-768x377.webp';
        echo '<link rel="preload" as="image" href="' . esc_url($hero) . '" fetchpriority="high" />' . "\n";
        echo '<link rel="preload" as="image" href="' . esc_url($mobile_wellness) . '" fetchpriority="high" media="(max-width: 767px)" />' . "\n";
        ?>
        <style id="omfit-critical-loader-css">
        #pxl-loadding.pxl-loader{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}
        @media(max-width:767px){
            .elementor-131 .elementor-element.elementor-element-e88dfc0>.pxl-overlay--image{background-image:url("https://omfit.com.vn/wp-content/uploads/2026/07/omfit-home-wellness-background-768x377.webp")!important}
            .pxl-video--imagebg[style*="DSC02100-scaled.jpg"],
            .pxl-overlay--image[style*="/bg2.png"],
            .pxl-overlay--image[style*="/bg5.png"],
            .pxl-swiper-slide>.pxl-item--inner>.pxl-item--image>a[style*="background-image"]{background-image:none!important}
        }
        </style>
        <?php
    }
    add_action('wp_head', 'omfit_agentic_print_early_home_hints', 1);

    function omfit_agentic_async_home_styles($html, $handle, $href, $media) {
        if (!omfit_agentic_is_home()) {
            return $html;
        }

        $async_handles = array(
            'pxl-main-css',
            'font-awesome-pro',
            'uaf_client_css',
            'elementor-icons',
            'e-animation-fadeInRight',
            'magnific-popup',
            'wow-animate',
            'flaticon',
            'pxl-caseicon',
            'pxl-google-fonts',
            'wpsocialreviews_chat',
        );

        if (!in_array($handle, $async_handles, true)) {
            return $html;
        }

        return '<link rel="stylesheet" id="' . esc_attr($handle) . '-css" href="'
            . esc_url($href)
            . '" media="print" data-media="'
            . esc_attr($media ?: 'all')
            . '" onload="this.onload=null;this.media=this.dataset.media" />' . "\n"
            . '<noscript>' . $html . '</noscript>' . "\n";
    }
    add_filter('style_loader_tag', 'omfit_agentic_async_home_styles', 20, 4);

    function omfit_agentic_filter_home_markup($html) {
        $html = str_replace('http://omfit.com.vn/', 'https://omfit.com.vn/', (string) $html);
        $html = str_replace(
            'content="width=device-width, initial-scale=1, maximum-scale=1"',
            'content="width=device-width, initial-scale=1"',
            $html
        );
        $html = preg_replace(
            '/<!-- Google Tag Manager -->\s*<script>/i',
            '<!-- Google Tag Manager (delayed for mobile performance) -->'
                . "\n" . '<script id="omfit-delayed-gtm" type="application/x-omfit-delayed">',
            $html,
            1
        );

        $html = preg_replace_callback(
            '/<img\b[^>]*Ellipse-1\.png[^>]*>/i',
            function ($matches) {
                $tag = str_replace('no-lazyload ', '', $matches[0]);
                if (stripos($tag, ' loading=') === false) {
                    $tag = preg_replace('/<img\b/i', '<img loading="lazy"', $tag, 1);
                }
                if (stripos($tag, ' decoding=') === false) {
                    $tag = preg_replace('/<img\b/i', '<img decoding="async"', $tag, 1);
                }
                return $tag;
            },
            $html
        );

        return $html;
    }

    function omfit_agentic_start_home_markup_filter() {
        if (omfit_agentic_is_home() && !is_feed() && !is_embed()) {
            ob_start('omfit_agentic_filter_home_markup');
        }
    }
    add_action('template_redirect', 'omfit_agentic_start_home_markup_filter', -100);

    function omfit_agentic_print_home_runtime_script() {
        if (!omfit_agentic_is_home()) {
            return;
        }

        ?>
        <script id="omfit-home-runtime-js">
        (function(){
            function nodes(root,selector){
                var result=[];
                if(root.nodeType===1&&root.matches(selector)){result.push(root);}
                if(root.querySelectorAll){result=result.concat(Array.prototype.slice.call(root.querySelectorAll(selector)));}
                return result;
            }
            function cleanText(value){return String(value||'').replace(/\s+/g,' ').trim();}
            function socialLabel(link){
                var icon=link.querySelector('i');
                var classes=icon?icon.className:'';
                if(classes.indexOf('facebook')!==-1){return 'Facebook OMFIT';}
                if(classes.indexOf('instagram')!==-1){return 'Instagram OMFIT';}
                if(classes.indexOf('youtube')!==-1){return 'YouTube OMFIT';}
                if(classes.indexOf('tiktok')!==-1){return 'TikTok OMFIT';}
                if(classes.indexOf('google')!==-1){return 'Google OMFIT';}
                return 'Mạng xã hội OMFIT';
            }
            function fixAccessibility(root){
                nodes(root,'.woosc-settings-field').forEach(function(input){
                    if(input.hasAttribute('aria-label')){return;}
                    var move=input.parentElement?input.parentElement.querySelector('.move'):null;
                    var field=cleanText(move?move.textContent:'');
                    input.setAttribute('aria-label',field?'Hiển thị trường '+field+' trong bảng so sánh':'Hiển thị trường trong bảng so sánh');
                });
                nodes(root,'a.btn-video').forEach(function(link){
                    if(!link.hasAttribute('aria-label')){link.setAttribute('aria-label','Phát video giới thiệu OMFIT');}
                });
                nodes(root,'.pxl-swiper-slide>.pxl-item--inner>.pxl-item--image>a').forEach(function(link){
                    if(link.hasAttribute('aria-label')){return;}
                    var item=link.closest('.pxl-item--inner');
                    var title=item?item.querySelector('.pxl-item--title,.pxl-item--content h3,.pxl-item--content h4'):null;
                    var label=cleanText(title?title.textContent:'');
                    link.setAttribute('aria-label',label?'Đọc bài viết '+label:'Đọc bài viết OMFIT');
                });
                nodes(root,'.pxl-logo>a').forEach(function(link){
                    if(!link.hasAttribute('aria-label')){link.setAttribute('aria-label','Trang chủ OMFIT');}
                });
                nodes(root,'.pxl-icon1>a').forEach(function(link){
                    if(!link.hasAttribute('aria-label')){link.setAttribute('aria-label',socialLabel(link));}
                });
                nodes(root,'a[href]:not([aria-label])').forEach(function(link){
                    var text=cleanText(link.textContent);
                    var image=link.querySelector('img[alt]');
                    if(!text&&(!image||!cleanText(image.alt))){
                        link.setAttribute('aria-label','Mở nội dung OMFIT');
                    }
                });
            }
            function setupLazyBackgrounds(){
                if(!window.matchMedia||!window.matchMedia('(max-width: 767px)').matches){return;}
                var selector=[
                    '.pxl-video--imagebg[style*="DSC02100-scaled.jpg"]',
                    '.pxl-overlay--image[style*="/bg2.png"]',
                    '.pxl-overlay--image[style*="/bg5.png"]',
                    '.pxl-swiper-slide>.pxl-item--inner>.pxl-item--image>a[style*="background-image"]'
                ].join(',');
                var items=Array.prototype.slice.call(document.querySelectorAll(selector));
                function loadBackground(element){
                    var background=element.style.backgroundImage;
                    if(background){element.style.setProperty('background-image',background,'important');}
                }
                if(!('IntersectionObserver' in window)){
                    items.forEach(loadBackground);
                    return;
                }
                var observer=new IntersectionObserver(function(entries){
                    entries.forEach(function(entry){
                        if(entry.isIntersecting){
                            loadBackground(entry.target);
                            observer.unobserve(entry.target);
                        }
                    });
                },{rootMargin:'400px 0px'});
                items.forEach(function(element){observer.observe(element);});
            }
            function setupDelayedAnalytics(){
                var source=document.getElementById('omfit-delayed-gtm');
                if(!source){return;}
                var started=false;
                function start(){
                    if(started){return;}
                    started=true;
                    var script=document.createElement('script');
                    script.text=source.textContent||'';
                    document.head.appendChild(script);
                    source.remove();
                }
                ['pointerdown','touchstart','keydown','scroll'].forEach(function(eventName){
                    window.addEventListener(eventName,start,{once:true,passive:true});
                });
                window.addEventListener('load',function(){window.setTimeout(start,5000);},{once:true});
            }
            function initialize(){
                fixAccessibility(document);
                setupLazyBackgrounds();
                setupDelayedAnalytics();
                if('MutationObserver' in window){
                    new MutationObserver(function(mutations){
                        mutations.forEach(function(mutation){
                            Array.prototype.forEach.call(mutation.addedNodes,function(node){
                                if(node.nodeType===1){fixAccessibility(node);}
                            });
                        });
                    }).observe(document.body,{childList:true,subtree:true});
                }
            }
            if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initialize,{once:true});}
            else{initialize();}
        })();
        </script>
        <?php
    }
    add_action('wp_footer', 'omfit_agentic_print_home_runtime_script', PHP_INT_MAX);

    function omfit_agentic_print_font_fallbacks() {
        if (!omfit_agentic_is_home()) {
            return;
        }

        ?>
        <style id="omfit-font-display-css">
        @font-face{font-family:"gilroy";font-style:normal;font-weight:400;font-display:swap;src:url("https://omfit.com.vn/wp-content/uploads/useanyfont/9455Gilroy.woff2") format("woff2")}
        @font-face{font-family:"Plateia Bold";font-style:normal;font-weight:400;font-display:swap;src:url("https://omfit.com.vn/wp-content/themes/hadkaur/assets/fonts/font-custom/Plateia%20Bold.ttf") format("truetype")}
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

    function omfit_agentic_latest_articles($limit = 10) {
        $posts = get_posts(array(
            'post_type' => 'post',
            'post_status' => 'publish',
            'numberposts' => max(1, min(20, (int) $limit)),
            'orderby' => 'date',
            'order' => 'DESC',
            'no_found_rows' => true,
        ));

        return array_map(function ($post) {
            $summary_source = $post->post_excerpt ?: $post->post_content;
            $categories = get_the_category($post->ID);

            return array(
                '@type' => 'BlogPosting',
                'id' => (int) $post->ID,
                'headline' => html_entity_decode(
                    wp_strip_all_tags(get_the_title($post)),
                    ENT_QUOTES | ENT_HTML5,
                    'UTF-8'
                ),
                'url' => get_permalink($post),
                'summary' => wp_trim_words(
                    html_entity_decode(
                        wp_strip_all_tags(strip_shortcodes($summary_source)),
                        ENT_QUOTES | ENT_HTML5,
                        'UTF-8'
                    ),
                    32,
                    '…'
                ),
                'datePublished' => get_post_time(DATE_W3C, true, $post),
                'dateModified' => get_post_modified_time(DATE_W3C, true, $post),
                'categories' => array_values(array_map(function ($category) {
                    return $category->name;
                }, $categories ?: array())),
                'image' => get_the_post_thumbnail_url($post, 'large') ?: null,
            );
        }, $posts);
    }

    function omfit_agentic_knowledge_payload() {
        $latest_articles = omfit_agentic_latest_articles(10);
        $last_modified = !empty($latest_articles)
            ? $latest_articles[0]['dateModified']
            : gmdate(DATE_W3C);

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
            'articleDiscovery' => array(
                'archive' => 'https://omfit.com.vn/tin-tuc/',
                'rss' => 'https://omfit.com.vn/feed/',
                'restApi' => 'https://omfit.com.vn/wp-json/wp/v2/posts?per_page=10&_fields=id,link,slug,date,modified,title,excerpt,featured_media,categories',
            ),
            'latestArticles' => $latest_articles,
            'verificationNote' => 'Lịch học, học phí, ưu đãi và tình trạng dịch vụ có thể thay đổi. Vui lòng xác nhận qua hotline hoặc email chính thức trước khi hành động.',
            'lastModified' => $last_modified,
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
        $lines = array(
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
            '- [RSS bài viết](https://omfit.com.vn/feed/): Feed bài viết mới theo thời gian',
            '- [WordPress sitemap](https://omfit.com.vn/wp-sitemap.xml): Danh sách URL có thể lập chỉ mục',
            '',
            '## Dữ liệu máy đọc',
            '',
            '- [OMFIT Knowledge API](https://omfit.com.vn/wp-json/omfit/v1/knowledge): Hồ sơ tổ chức, dịch vụ, liên hệ và URL chính thức ở định dạng JSON',
            '- [WordPress REST API bài viết](https://omfit.com.vn/wp-json/wp/v2/posts?per_page=10): Nội dung Tin tức công khai',
            '',
            '## Bài viết mới nhất',
            '',
        );

        foreach (omfit_agentic_latest_articles(10) as $article) {
            $lines[] = '- [' . str_replace(array('[', ']'), '', $article['headline']) . ']('
                . $article['url'] . '): ' . $article['summary'];
        }

        $lines = array_merge($lines, array(
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

        return implode("\n", $lines);
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
