import 'dotenv/config';

const shouldApply = process.argv.includes('--apply');
const siteUrl = (
  process.env.WP_SITE_URL
  || process.env.VITE_WP_SITE_URL
  || 'https://omfit.com.vn'
).replace(/\/+$/, '');
const username = process.env.WP_USERNAME || process.env.VITE_WP_USERNAME;
const appPassword = process.env.WP_APP_PASSWORD || process.env.VITE_WP_APP_PASSWORD;

if (!username || !appPassword) {
  throw new Error('Missing WordPress credentials in .env.');
}

const homePageId = 131;
const authorization = `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`;
const mcpEndpoint = `${siteUrl}/wp-json/wsp-mcp/v1/mcp`;
const trainerImages = [
  {
    originalId: 9858,
    sourceUrl: `${siteUrl}/wp-content/uploads/2026/07/omfit-trainer-vu-anh-thong-optimized.webp`,
    filename: 'omfit-trainer-vu-anh-thong-optimized.webp',
    title: 'Vũ Anh Thông - Huấn luyện viên OMFIT WebP',
    alt: 'Vũ Anh Thông - huấn luyện viên OMFIT'
  },
  {
    originalId: 9859,
    sourceUrl: `${siteUrl}/wp-content/uploads/2026/07/omfit-trainer-chu-minh-dat-optimized.webp`,
    filename: 'omfit-trainer-chu-minh-dat-optimized.webp',
    title: 'Chu Minh Đạt - Huấn luyện viên OMFIT WebP',
    alt: 'Chu Minh Đạt - huấn luyện viên OMFIT'
  },
  {
    originalId: 9860,
    sourceUrl: `${siteUrl}/wp-content/uploads/2026/07/omfit-trainer-pham-vu-thien-vuong-optimized.webp`,
    filename: 'omfit-trainer-pham-vu-thien-vuong-optimized.webp',
    title: 'Phạm Vũ Thiên Vương - Huấn luyện viên OMFIT WebP',
    alt: 'Phạm Vũ Thiên Vương - huấn luyện viên OMFIT'
  },
  {
    originalId: 9861,
    sourceUrl: `${siteUrl}/wp-content/uploads/2026/07/omfit-trainer-vo-thi-nhu-y-optimized.webp`,
    filename: 'omfit-trainer-vo-thi-nhu-y-optimized.webp',
    title: 'Võ Thị Như Ý - Huấn luyện viên OMFIT WebP',
    alt: 'Võ Thị Như Ý - huấn luyện viên OMFIT'
  },
  {
    originalId: 9862,
    sourceUrl: `${siteUrl}/wp-content/uploads/2026/07/omfit-trainer-huynh-le-minh-khanh-optimized.webp`,
    filename: 'omfit-trainer-huynh-le-minh-khanh-optimized.webp',
    title: 'Huỳnh Lê Minh Khánh - Huấn luyện viên OMFIT WebP',
    alt: 'Huỳnh Lê Minh Khánh - huấn luyện viên OMFIT'
  }
];
const carouselElementIds = ['9a3d11e', 'd830a07'];
const heroSectionId = '0e87d67';
const wellnessSectionId = 'e88dfc0';
const bmiModelElementId = '7953166';
const heroAsset = {
  id: 9873,
  url: `${siteUrl}/wp-content/uploads/2026/07/omfit-home-hero-can-bang-toan-dien.webp`
};
const wellnessBackgroundAsset = {
  id: 9874,
  url: `${siteUrl}/wp-content/uploads/2026/07/omfit-home-wellness-background.webp`
};
const bmiModelAsset = {
  id: 9875,
  url: `${siteUrl}/wp-content/uploads/2026/07/omfit-home-bmi-model.webp`
};
let requestId = 1;

async function wordpressRequest(path, init = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...init,
    headers: {
      Authorization: authorization,
      ...(init.headers || {})
    },
    signal: AbortSignal.timeout(45_000)
  });
  const raw = await response.text();
  let body = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      throw new Error(`WordPress returned invalid JSON for ${path} (${response.status}).`);
    }
  }
  if (!response.ok) {
    throw new Error(`WordPress request failed for ${path} (${response.status}): ${raw.slice(0, 600)}`);
  }
  return body;
}

function filenameSlug(filename) {
  return filename.replace(/\.[^.]+$/, '');
}

async function findExistingMedia(image) {
  const rows = await wordpressRequest(
    `/wp-json/wp/v2/media?context=edit&search=${encodeURIComponent(image.title)}&per_page=100`
  );
  if (!Array.isArray(rows)) return null;
  const stem = filenameSlug(image.filename);
  return rows.find((row) => (
    row.title?.raw === image.title
    && String(row.source_url || '').includes(stem)
  )) || null;
}

async function uploadOptimizedMedia(image) {
  const existing = await findExistingMedia(image);
  if (existing) {
    return {
      id: existing.id,
      sourceUrl: existing.source_url,
      reused: true
    };
  }

  if (!shouldApply) {
    return {
      id: null,
      sourceUrl: image.sourceUrl,
      reused: false,
      planned: true
    };
  }

  const sourceResponse = await fetch(image.sourceUrl, {
    signal: AbortSignal.timeout(30_000)
  });
  if (!sourceResponse.ok) {
    throw new Error(`Could not download ${image.sourceUrl} (${sourceResponse.status}).`);
  }
  const bytes = Buffer.from(await sourceResponse.arrayBuffer());
  const uploaded = await wordpressRequest('/wp-json/wp/v2/media', {
    method: 'POST',
    headers: {
      'Content-Type': sourceResponse.headers.get('content-type') || 'image/png',
      'Content-Disposition': `attachment; filename="${image.filename}"`
    },
    body: bytes
  });
  const updated = await wordpressRequest(`/wp-json/wp/v2/media/${uploaded.id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: image.title,
      alt_text: image.alt,
      parent: homePageId
    })
  });
  return {
    id: updated.id,
    sourceUrl: updated.source_url,
    reused: false
  };
}

async function mcpSend(payload, sessionId = '') {
  const headers = {
    Authorization: authorization,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const response = await fetch(mcpEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000)
  });
  const raw = await response.text();
  const body = raw.trim() ? JSON.parse(raw) : {};
  if (!response.ok || body.error) {
    throw new Error(`WordPress MCP failed (${response.status}): ${raw.slice(0, 800)}`);
  }
  return { response, body };
}

async function openMcpSession() {
  const { response } = await mcpSend({
    jsonrpc: '2.0',
    id: requestId++,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {
        name: 'omfit-wordpress-performance-optimizer',
        version: '1.0.0'
      }
    }
  });
  const sessionId = response.headers.get('mcp-session-id');
  if (!sessionId) throw new Error('WordPress MCP did not return a session ID.');
  await mcpSend({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {}
  }, sessionId);
  return sessionId;
}

async function mcpCall(sessionId, name, args = {}) {
  const { body } = await mcpSend({
    jsonrpc: '2.0',
    id: requestId++,
    method: 'tools/call',
    params: {
      name,
      arguments: args
    }
  }, sessionId);
  if (body.result?.isError) {
    throw new Error(`${name} failed: ${JSON.stringify(body.result.content || body.result)}`);
  }
  const text = body.result?.content?.find((item) => item.type === 'text')?.text || '';
  if (!text) return body.result || null;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

async function main() {
  const media = new Map();
  const uploadSummary = [];
  for (const image of trainerImages) {
    const optimized = await uploadOptimizedMedia(image);
    media.set(image.originalId, {
      ...optimized,
      alt: image.alt
    });
    uploadSummary.push({
      originalId: image.originalId,
      filename: image.filename,
      ...optimized
    });
  }

  const updateSummary = [];
  let heroUpdate = null;
  let wellnessBackgroundUpdate = null;
  let bmiModelUpdate = null;
  if (shouldApply) {
    const sessionId = await openMcpSession();
    for (const elementId of carouselElementIds) {
      const element = await mcpCall(sessionId, 'wsp_elementor_get_element', {
        post_id: homePageId,
        element_id: elementId
      });
      if (!Array.isArray(element.settings?.team)) {
        throw new Error(`Element ${elementId} does not contain the expected team repeater.`);
      }

      const changes = [];
      for (const member of element.settings.team) {
        const originalId = Number(member.image?.id);
        const optimized = media.get(originalId)
          || [...media.values()].find((item) => Number(item.id) === originalId);
        if (!optimized?.id) {
          throw new Error(`No optimized media found for attachment ${originalId}.`);
        }
        changes.push({
          from: originalId,
          to: optimized.id,
          sourceUrl: optimized.sourceUrl
        });
        member.image = {
          ...member.image,
          id: optimized.id,
          url: optimized.sourceUrl,
          size: 'full',
          alt: optimized.alt
        };
      }

      const result = await mcpCall(sessionId, 'wsp_elementor_update_element', {
        post_id: homePageId,
        element_id: elementId,
        settings: element.settings
      });
      if (result.success !== true) {
        throw new Error(`Elementor rejected update for ${elementId}: ${JSON.stringify(result)}`);
      }
      updateSummary.push({ elementId, changes });
    }

    const hero = await mcpCall(sessionId, 'wsp_elementor_get_element', {
      post_id: homePageId,
      element_id: heroSectionId
    });
    const heroSlides = hero.settings?.background_slideshow_gallery;
    if (Number(hero.settings?.background_image?.id) !== heroAsset.id) {
      hero.settings.background_background = 'classic';
      hero.settings.background_image = {
        id: heroAsset.id,
        url: heroAsset.url,
        size: 'full',
        alt: '',
        source: 'library'
      };
      hero.settings.background_position = (
        hero.settings.background_slideshow_background_position
        || hero.settings.background_position
        || 'center center'
      );
      hero.settings.background_slideshow_gallery = [];
      const result = await mcpCall(sessionId, 'wsp_elementor_update_element', {
        post_id: homePageId,
        element_id: heroSectionId,
        settings: hero.settings
      });
      if (result.success !== true) {
        throw new Error(`Elementor rejected hero update: ${JSON.stringify(result)}`);
      }
      heroUpdate = {
        elementId: heroSectionId,
        from: Array.isArray(heroSlides) && heroSlides.length
          ? 'single-image slideshow'
          : hero.settings.background_image?.url,
        to: 'classic WebP background',
        image: hero.settings.background_image.url
      };
    }

    const wellnessSection = await mcpCall(sessionId, 'wsp_elementor_get_element', {
      post_id: homePageId,
      element_id: wellnessSectionId
    });
    if (Number(wellnessSection.settings?.pxl_overlay_img?.id) !== wellnessBackgroundAsset.id) {
      wellnessSection.settings.pxl_overlay_img = {
        id: wellnessBackgroundAsset.id,
        url: wellnessBackgroundAsset.url,
        size: 'full',
        alt: '',
        source: 'library'
      };
      const result = await mcpCall(sessionId, 'wsp_elementor_update_element', {
        post_id: homePageId,
        element_id: wellnessSectionId,
        settings: wellnessSection.settings
      });
      if (result.success !== true) {
        throw new Error(`Elementor rejected wellness background update: ${JSON.stringify(result)}`);
      }
      wellnessBackgroundUpdate = {
        elementId: wellnessSectionId,
        image: wellnessBackgroundAsset.url
      };
    }

    const bmiModel = await mcpCall(sessionId, 'wsp_elementor_get_element', {
      post_id: homePageId,
      element_id: bmiModelElementId
    });
    if (Number(bmiModel.settings?.image?.id) !== bmiModelAsset.id) {
      bmiModel.settings.image = {
        id: bmiModelAsset.id,
        url: bmiModelAsset.url,
        size: 'full',
        alt: 'Huấn luyện viên OMFIT',
        source: 'library'
      };
      const result = await mcpCall(sessionId, 'wsp_elementor_update_element', {
        post_id: homePageId,
        element_id: bmiModelElementId,
        settings: bmiModel.settings
      });
      if (result.success !== true) {
        throw new Error(`Elementor rejected BMI model update: ${JSON.stringify(result)}`);
      }
      bmiModelUpdate = {
        elementId: bmiModelElementId,
        image: bmiModelAsset.url
      };
    }

    await mcpCall(sessionId, 'wsp_uae_builder_regenerate_css');
    await mcpCall(sessionId, 'wsp_uae_maintenance_clear_cache');
  }

  console.log(JSON.stringify({
    mode: shouldApply ? 'apply' : 'dry-run',
    uploads: uploadSummary,
    elementorUpdates: updateSummary,
    heroUpdate,
    wellnessBackgroundUpdate,
    bmiModelUpdate
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
