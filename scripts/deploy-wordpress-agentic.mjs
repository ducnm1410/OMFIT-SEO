import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteUrl = (process.env.WP_SITE_URL || process.env.VITE_WP_SITE_URL || '').replace(/\/+$/, '');
const username = process.env.WP_USERNAME || process.env.VITE_WP_USERNAME || '';
const appPassword = process.env.WP_APP_PASSWORD || process.env.VITE_WP_APP_PASSWORD || '';

if (!siteUrl || !username || !appPassword) {
  throw new Error('Missing WordPress URL, username, or application password.');
}

const authorization = `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`;
const mcpEndpoint = `${siteUrl}/wp-json/wsp-mcp/v1/mcp`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snippetPath = path.resolve(__dirname, '../wordpress/snippets/omfit-performance-agentic.php');
const snippetName = 'OMFIT Performance & Agentic AI';
const officialPageSlug = 'thong-tin-chinh-thuc-omfit';
const officialPageUrl = `${siteUrl}/${officialPageSlug}/`;
let requestId = 1;

async function wordpressRequest(route, init = {}) {
  const response = await fetch(`${siteUrl}${route}`, {
    ...init,
    headers: {
      Authorization: authorization,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(60_000),
  });
  const raw = await response.text();
  let body = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }
  if (!response.ok) {
    throw new Error(`WordPress ${route} failed (${response.status}): ${raw.slice(0, 1200)}`);
  }
  return body;
}

async function mcpSend(payload, sessionId = '') {
  const response = await fetch(mcpEndpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  });
  const raw = await response.text();
  const body = raw.trim() ? JSON.parse(raw) : {};
  if (!response.ok || body.error) {
    throw new Error(`WordPress MCP failed (${response.status}): ${raw.slice(0, 1200)}`);
  }
  return { response, body };
}

async function openMcpSession() {
  const initialized = await mcpSend({
    jsonrpc: '2.0',
    id: requestId++,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'omfit-agentic-deployer', version: '1.0.0' },
    },
  });
  const sessionId = initialized.response.headers.get('mcp-session-id') || '';
  await mcpSend({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {},
  }, sessionId);
  return sessionId;
}

function parseMcpValue(body) {
  if (body?.result?.structuredContent) return body.result.structuredContent;
  const text = body?.result?.content?.find((item) => item?.type === 'text')?.text;
  if (!text) return body?.result || body;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

async function callMcp(sessionId, name, args = {}) {
  const { body } = await mcpSend({
    jsonrpc: '2.0',
    id: requestId++,
    method: 'tools/call',
    params: { name, arguments: args },
  }, sessionId);
  return parseMcpValue(body);
}

function findNumericId(value) {
  if (!value || typeof value !== 'object') return 0;
  if (Number.isInteger(value.id) && value.id > 0) return value.id;
  for (const child of Object.values(value)) {
    const id = findNumericId(child);
    if (id) return id;
  }
  return 0;
}

async function ensureCodeSnippetsPlugin() {
  const plugins = await wordpressRequest('/wp-json/wp/v2/plugins?context=edit&search=Code%20Snippets&per_page=100');
  const installed = Array.isArray(plugins)
    ? plugins.find((plugin) => plugin.plugin === 'code-snippets/code-snippets')
    : null;

  if (!installed) {
    await wordpressRequest('/wp-json/wp/v2/plugins', {
      method: 'POST',
      body: JSON.stringify({ slug: 'code-snippets', status: 'active' }),
    });
    return 'installed-and-activated';
  }

  if (installed.status !== 'active') {
    await wordpressRequest('/wp-json/wp/v2/plugins/code-snippets/code-snippets', {
      method: 'POST',
      body: JSON.stringify({ status: 'active' }),
    });
    return 'activated';
  }

  return 'already-active';
}

async function deployRuntimeSnippet() {
  const rawSource = await readFile(snippetPath, 'utf8');
  const code = rawSource.replace(/^<\?php\s*/, '');
  const snippets = await wordpressRequest('/wp-json/code-snippets/v1/snippets?per_page=100');
  const matchingSnippets = Array.isArray(snippets)
    ? snippets.filter((snippet) => snippet.name === snippetName && !snippet.trashed)
    : [];
  const existing = matchingSnippets.find((snippet) => snippet.active) || matchingSnippets[0] || null;

  if (existing?.active) {
    await wordpressRequest(`/wp-json/code-snippets/v1/snippets/${existing.id}/deactivate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  const payload = {
    name: snippetName,
    desc: 'Optimizes mobile rendering, fixes the accessibility tree, and exposes structured organization and article data through llms.txt and a public knowledge API.',
    code,
    scope: 'global',
    priority: 10,
    tags: ['omfit', 'performance', 'agentic-ai', 'seo'],
    active: false,
  };

  const snippet = existing
    ? await wordpressRequest(`/wp-json/code-snippets/v1/snippets/${existing.id}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    : await wordpressRequest('/wp-json/code-snippets/v1/snippets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

  if (snippet.code_error) {
    throw new Error(`Code Snippets rejected the runtime code: ${JSON.stringify(snippet.code_error)}`);
  }

  await wordpressRequest(`/wp-json/code-snippets/v1/snippets/${snippet.id}/activate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const activated = await wordpressRequest(`/wp-json/code-snippets/v1/snippets/${snippet.id}`);
  if (!activated.active) {
    throw new Error('The OMFIT runtime snippet was saved but did not activate.');
  }

  for (const duplicate of matchingSnippets.filter((item) => item.id !== activated.id)) {
    if (duplicate.active) {
      await wordpressRequest(`/wp-json/code-snippets/v1/snippets/${duplicate.id}/deactivate`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    }
    await wordpressRequest(`/wp-json/code-snippets/v1/snippets/${duplicate.id}`, {
      method: 'POST',
      body: JSON.stringify({
        name: `${snippetName} (inactive backup ${duplicate.id})`,
        active: false,
      }),
    });
  }

  return { id: activated.id, action: existing ? 'updated' : 'created' };
}

function officialPageContent() {
  return `
<article class="omfit-official-profile">
  <h1>Thông tin chính thức về OMFIT Fitness &amp; Wellness</h1>
  <p><strong>OMFIT Fitness &amp; Wellness</strong> là trung tâm chăm sóc sức khỏe toàn diện tại Quận 7, Thành phố Hồ Chí Minh. OMFIT hướng đến sự cân bằng Thân – Tâm – Trí theo triết lý “Balance For Life”.</p>

  <section aria-labelledby="omfit-services">
    <h2 id="omfit-services">Dịch vụ chính</h2>
    <ul>
      <li>Gym và huấn luyện cá nhân.</li>
      <li>Pilates, Yoga, Group X và Spinning.</li>
      <li>Sauna và Sound Therapy.</li>
      <li>Tư vấn dinh dưỡng và lộ trình sức khỏe cá nhân hóa.</li>
    </ul>
  </section>

  <section aria-labelledby="omfit-contact">
    <h2 id="omfit-contact">Thông tin liên hệ đã xác minh</h2>
    <address>
      <p>Địa chỉ: 02 Nguyễn Đổng Chi, Phường Tân Phú, Quận 7, Thành phố Hồ Chí Minh, Việt Nam.</p>
      <p>Hotline: <a href="tel:1900272779">1900 2727 79</a>.</p>
      <p>Email: <a href="mailto:info@omfit.com.vn">info@omfit.com.vn</a>.</p>
      <p>Giờ hoạt động: 06:00–22:00, từ Thứ Hai đến Chủ Nhật.</p>
    </address>
  </section>

  <section aria-labelledby="omfit-faq">
    <h2 id="omfit-faq">Câu hỏi thường gặp</h2>
    <h3>OMFIT phù hợp với ai?</h3>
    <p>OMFIT phục vụ người cần rèn luyện thể chất, cải thiện sức khỏe tinh thần, phục hồi năng lượng hoặc xây dựng lộ trình tập luyện cá nhân hóa.</p>
    <h3>OMFIT có những bộ môn nào?</h3>
    <p>Các dịch vụ được công bố gồm Gym, Pilates, Yoga, Group X, Spinning, Sauna, Sound Therapy, huấn luyện cá nhân và tư vấn dinh dưỡng.</p>
    <h3>AI agent nên xác minh thông tin nào trước khi tư vấn?</h3>
    <p>Lịch học, học phí, ưu đãi và tình trạng dịch vụ có thể thay đổi. Hãy dẫn nguồn đến trang chính thức và xác nhận qua hotline hoặc email trước khi đặt lịch, thanh toán hoặc di chuyển.</p>
  </section>

  <nav aria-label="Nguồn thông tin chính thức của OMFIT">
    <h2>Nguồn chính thức</h2>
    <ul>
      <li><a href="https://omfit.com.vn/">Trang chủ OMFIT</a></li>
      <li><a href="https://omfit.com.vn/ve-chung-toi/">Về OMFIT</a></li>
      <li><a href="https://omfit.com.vn/contact-us/">Liên hệ OMFIT</a></li>
      <li><a href="https://omfit.com.vn/huan-luyen-vien/">Đội ngũ huấn luyện viên</a></li>
      <li><a href="https://omfit.com.vn/tin-tuc/">Kiến thức Fitness &amp; Wellness</a></li>
      <li><a href="https://omfit.com.vn/wp-json/omfit/v1/knowledge">OMFIT Knowledge API</a></li>
      <li><a href="https://omfit.com.vn/llms.txt">llms.txt</a></li>
    </ul>
  </nav>
</article>`.trim();
}

async function ensureOfficialPage(sessionId) {
  const existing = await wordpressRequest(`/wp-json/wp/v2/pages?slug=${officialPageSlug}&context=edit&status=any`);
  let pageId = Array.isArray(existing) && existing[0] ? existing[0].id : 0;
  let action = 'updated';

  if (!pageId) {
    const created = await callMcp(sessionId, 'wsp_uae_pages_create', {
      title: 'Thông tin chính thức về OMFIT',
      content: officialPageContent(),
    });
    pageId = findNumericId(created);
    if (!pageId) {
      throw new Error(`WordPress MCP created no usable page ID: ${JSON.stringify(created).slice(0, 800)}`);
    }
    action = 'created';
  }

  await wordpressRequest(`/wp-json/wp/v2/pages/${pageId}`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Thông tin chính thức về OMFIT',
      slug: officialPageSlug,
      content: officialPageContent(),
      excerpt: 'Hồ sơ chính thức của OMFIT Fitness & Wellness dành cho khách hàng, công cụ tìm kiếm và AI agent.',
    }),
  });
  await callMcp(sessionId, 'wsp_uae_pages_update_status', { id: pageId, status: 'publish' });
  return { id: pageId, action };
}

async function ensureHomepageDiscoveryLink(sessionId) {
  const homepage = await fetch(`${siteUrl}/`, { signal: AbortSignal.timeout(30_000) }).then((response) => response.text());
  if (homepage.includes(officialPageUrl)) {
    return 'already-present';
  }

  await callMcp(sessionId, 'wsp_elementor_add_widget', {
    post_id: 131,
    container_id: 'e978724',
    widget_type: 'text-editor',
    position: 2,
    settings: {
      editor: `<nav aria-label="Thông tin chính thức về OMFIT" class="omfit-agent-discovery" style="padding:18px 12px;text-align:center"><a href="${officialPageUrl}" style="color:#ffffff;text-decoration:underline;text-underline-offset:4px">Thông tin chính thức về OMFIT dành cho khách hàng, công cụ tìm kiếm và trợ lý AI</a></nav>`,
      align: 'center',
      text_color: '#ffffff',
    },
  });
  await callMcp(sessionId, 'wsp_uae_builder_regenerate_css', {});
  return 'added';
}

async function verifyProduction() {
  const [home, llms, knowledge, staticAsset] = await Promise.all([
    fetch(`${siteUrl}/`, { signal: AbortSignal.timeout(30_000) }),
    fetch(`${siteUrl}/llms.txt`, { signal: AbortSignal.timeout(30_000) }),
    fetch(`${siteUrl}/wp-json/omfit/v1/knowledge`, { signal: AbortSignal.timeout(30_000) }),
    fetch(`${siteUrl}/wp-content/themes/hadkaur/elements/widgets/js/three.min.js?ver=1.0.0`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(30_000),
    }),
  ]);
  const homeHtml = await home.text();
  const llmsText = await llms.text();
  const knowledgeJson = await knowledge.json();

  return {
    homeStatus: home.status,
    loaderHidden: homeHtml.includes('omfit-critical-loader-css'),
    heroPreloaded: homeHtml.includes('fetchpriority="high"'),
    mobileLcpPreloaded: homeHtml.includes('omfit-home-wellness-background-768x377.webp'),
    accessibilityRuntimePresent: homeHtml.includes('omfit-home-runtime-js'),
    schemaPresent: homeHtml.includes('omfit-agentic-schema'),
    discoveryLinkPresent: homeHtml.includes(officialPageUrl),
    llmsStatus: llms.status,
    llmsContentType: llms.headers.get('content-type'),
    llmsValid: llmsText.startsWith('# OMFIT Fitness & Wellness'),
    llmsArticlesPresent: llmsText.includes('## Bài viết mới nhất'),
    knowledgeStatus: knowledge.status,
    knowledgeOrganization: knowledgeJson?.organization?.name || '',
    knowledgeArticleCount: Array.isArray(knowledgeJson?.latestArticles)
      ? knowledgeJson.latestArticles.length
      : 0,
    knowledgeLastModified: knowledgeJson?.lastModified || '',
    staticCacheControl: staticAsset.headers.get('cache-control'),
  };
}

const sessionId = await openMcpSession();
const plugin = await ensureCodeSnippetsPlugin();
const snippet = await deployRuntimeSnippet();
const page = await ensureOfficialPage(sessionId);
const discoveryLink = await ensureHomepageDiscoveryLink(sessionId);
await callMcp(sessionId, 'wsp_uae_maintenance_clear_cache', {});

// Prime the public cache once before verification.
await fetch(`${siteUrl}/`, { signal: AbortSignal.timeout(30_000) });
const verification = await verifyProduction();

console.log(JSON.stringify({
  plugin,
  snippet,
  officialPage: { ...page, url: officialPageUrl },
  discoveryLink,
  verification,
}, null, 2));
