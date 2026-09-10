import { GoogleGenAI } from '@google/genai';
import crypto from 'node:crypto';
import {
  extractLeonardoErrorMessage,
  extractLeonardoGenerationId,
  leonardoGenerationStatusEndpoint,
  LEONARDO_GENERATION_ENDPOINT,
  LEONARDO_IMAGE_MODEL,
  LEONARDO_INIT_IMAGE_ENDPOINT
} from './leonardoImageGeneration.mjs';

// Leonardo chỉ chấp nhận width/height nằm trong danh sách cố định của API v2;
// gửi số tuỳ ý sẽ bị trả về VALIDATION_ERROR. Mọi giá trị dưới đây đã được đối chiếu
// với danh sách đó, chọn kích thước lớn nhất còn đúng tỉ lệ cho mỗi mức chất lượng.
// Lưu ý: cạnh dài tối đa Leonardo hỗ trợ là 3808px, nên mức '4k' thực tế là ~3.5K.
const LEONARDO_RESOLUTIONS = {
  '1:1':  { '1k': { w: 1024, h: 1024 }, '2k': { w: 2048, h: 2048 }, '4k': { w: 3584, h: 3584 } },
  '2:3':  { '1k': { w: 848, h: 1264 }, '2k': { w: 1696, h: 2560 }, '4k': { w: 2336, h: 3504 } },
  '3:2':  { '1k': { w: 1264, h: 848 }, '2k': { w: 2560, h: 1696 }, '4k': { w: 3808, h: 2560 } },
  '3:4':  { '1k': { w: 896, h: 1200 }, '2k': { w: 1856, h: 2448 }, '4k': { w: 2448, h: 3264 } },
  '4:3':  { '1k': { w: 1200, h: 896 }, '2k': { w: 2560, h: 1920 }, '4k': { w: 3808, h: 2880 } },
  '4:5':  { '1k': { w: 928, h: 1152 }, '2k': { w: 1856, h: 2336 }, '4k': { w: 2880, h: 3584 } },
  '5:4':  { '1k': { w: 1152, h: 928 }, '2k': { w: 2336, h: 1856 }, '4k': { w: 3584, h: 2880 } },
  '9:16': { '1k': { w: 768, h: 1376 }, '2k': { w: 1376, h: 2448 }, '4k': { w: 2016, h: 3584 } },
  '16:9': { '1k': { w: 1376, h: 768 }, '2k': { w: 2880, h: 1632 }, '4k': { w: 3584, h: 2016 } },
  '21:9': { '1k': { w: 1584, h: 672 }, '2k': { w: 3200, h: 1376 }, '4k': { w: 3808, h: 1632 } }
};

const DEFAULT_MODEL_ID = LEONARDO_IMAGE_MODEL;

function resolveDimensions(size = '16:9', quality = '1k') {
  const normSize = String(size || '16:9').trim();
  const normQuality = String(quality || '1k').trim().toLowerCase();
  const sizeMap = LEONARDO_RESOLUTIONS[normSize] || LEONARDO_RESOLUTIONS['16:9'];
  return sizeMap[normQuality] || sizeMap['1k'] || { w: 1376, h: 768 };
}

async function uploadInitImageToLeonardo(dataUrl, apiKey) {
  if (!dataUrl || !apiKey) return null;
  try {
    const extMatch = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
    const ext = extMatch ? extMatch[1].replace('jpeg', 'jpg') : 'jpg';

    const initRes = await fetch(LEONARDO_INIT_IMAGE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ extension: ext })
    });

    if (!initRes.ok) return null;
    const initData = await initRes.json();
    if (!initData.uploadInitImage) return null;

    const { id, url: uploadUrl, fields: fieldsStr } = initData.uploadInitImage;
    const rawBase64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(rawBase64, 'base64');

    if (fieldsStr) {
      const fields = JSON.parse(fieldsStr);
      const formData = new FormData();
      Object.entries(fields).forEach(([k, v]) => formData.append(k, String(v)));
      const blob = new Blob([buffer], { type: `image/${ext}` });
      formData.append('file', blob, `image.${ext}`);
      const uploadRes = await fetch(uploadUrl, { method: 'POST', body: formData });
      if (!uploadRes.ok) return null;
    } else {
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': `image/${ext}` },
        body: buffer
      });
      if (!uploadRes.ok) return null;
    }

    return id;
  } catch (err) {
    console.error('[Leonardo] Upload Init Image error:', err.message);
    return null;
  }
}

async function pollLeonardoGeneration(generationId, apiKey, maxAttempts = 35, intervalMs = 3500) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    try {
      const res = await fetch(leonardoGenerationStatusEndpoint(generationId), {
        headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` }
      });
      if (!res.ok) continue;
      const data = await res.json();
      const status = data?.generations_by_pk?.status;

      if (status === 'COMPLETE') {
        const images = data?.generations_by_pk?.generated_images || [];
        if (images.length > 0 && images[0]?.url) {
          return images[0].url;
        }
      } else if (status === 'FAILED') {
        throw new Error('Leonardo tạo ảnh thất bại.');
      }
    } catch (err) {
      if (err.message?.includes('thất bại')) throw err;
    }
  }
  throw new Error('Quá thời gian chờ Leonardo xử lý ảnh.');
}

async function generateWithLeonardo({
  apiKey,
  prompt,
  width,
  height,
  bannerInitId,
  characterInitId,
  seed
}) {
  const genBody = {
    model: DEFAULT_MODEL_ID,
    parameters: {
      prompt: prompt.slice(0, 1400),
      width,
      height,
      quantity: 1,
      prompt_enhance: 'OFF',
      quality: 'MEDIUM'
    },
    public: false
  };

  if (typeof seed === 'number' && !Number.isNaN(seed)) {
    genBody.parameters.seed = seed;
  }

  const imageRefs = [];
  if (bannerInitId) {
    imageRefs.push({
      image: { id: bannerInitId, type: 'UPLOADED' },
      strength: 'HIGH'
    });
  }
  if (characterInitId) {
    imageRefs.push({
      image: { id: characterInitId, type: 'UPLOADED' },
      strength: 'HIGH'
    });
  }

  if (imageRefs.length > 0) {
    genBody.parameters.guidances = {
      image_reference: imageRefs
    };
  }

  const res = await fetch(LEONARDO_GENERATION_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(genBody)
  });

  const rawText = await res.text();
  let json;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`Leonardo API trả về dữ liệu không hợp lệ (${res.status}): ${rawText.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(json.error || json.message || `Lỗi gọi Leonardo API (${res.status})`);
  }

  const generationId = extractLeonardoGenerationId(json);
  if (!generationId) {
    const providerMessage = extractLeonardoErrorMessage(json);
    throw new Error(
      providerMessage
        ? `Leonardo từ chối yêu cầu: ${providerMessage}`
        : 'Không nhận được mã tác vụ sinh ảnh từ Leonardo.'
    );
  }

  return await pollLeonardoGeneration(generationId, apiKey);
}

export function registerBannerAdsRoutes({ app, requireSupabaseUser, getSupabaseAdmin, getEnv }) {
  // ── 1. GENERATE SINGLE BANNER ─────────────────────────────────────────────
  app.post('/api/banner-ads/generate-single', requireSupabaseUser, async (request, response) => {
    try {
      const leonardoApiKey = getEnv('LEONARDO_API_KEY');
      const geminiApiKey = getEnv('GEMINI_API_KEY') || getEnv('GOOGLE_API_KEY');

      if (!leonardoApiKey) {
        return response.status(503).json({ error: 'Chưa cấu hình Leonardo API Key trên máy chủ.' });
      }

      const {
        competitorRef,
        character,
        keyMessage = '',
        language = 'Vietnamese',
        size = '16:9',
        quality = '1k'
      } = request.body || {};

      if (!competitorRef && !character && !keyMessage.trim()) {
        return response.status(400).json({ error: 'Vui lòng cung cấp ít nhất 1 ảnh mẫu hoặc thông điệp banner.' });
      }

      const dimensions = resolveDimensions(size, quality);

      // Art Director prompt generation via Gemini
      let englishPrompt = `AAA high-end marketing promotional banner for OMFIT Pilates & Wellness. Aspect ratio ${size}. Professional lighting, balanced composition, modern minimalist luxury studio aesthetic.`;
      
      if (geminiApiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey: geminiApiKey });
          const parts = [];

          if (competitorRef) {
            const raw = competitorRef.replace(/^data:image\/[a-z]+;base64,/, '');
            const mime = competitorRef.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/)?.[1] || 'image/png';
            parts.push({
              inlineData: {
                data: raw,
                mimeType: mime
              }
            });
          }

          if (character) {
            const raw = character.replace(/^data:image\/[a-z]+;base64,/, '');
            const mime = character.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/)?.[1] || 'image/png';
            parts.push({
              inlineData: {
                data: raw,
                mimeType: mime
              }
            });
          }

          const promptInstructions = `You are an elite Creative Director & Graphic Designer for OMFIT PILATES & WELLNESS.
I want to generate a premium, high-converting banner ad.
${competitorRef ? '- Image 1 is the Layout/Composition Reference banner.' : ''}
${character ? '- Image 2 is the Subject/Character/Model reference.' : ''}
${keyMessage ? `- The Key Message / Headline text to place prominently on the banner is: "${keyMessage}" in ${language}.` : ''}
Dimensions target: ${size} (${dimensions.w}x${dimensions.h}).

YOUR TASK:
Write a highly detailed single-paragraph English prompt for an AI Image Generator to create this promotional banner.
Focus on:
1. Composition, clean modern typography placement for "${keyMessage}", luxury pilates reformer / wellness setting.
2. Natural cinematic lighting, clean harmonious colors (navy, electric sky blue, clean whites and warm neutrals).
3. Cohesive blend between subject and background.

Output ONLY the prompt text, under 800 characters.`;

          parts.push({ text: promptInstructions });

          const model = ai.getGenerativeModel ? ai.getGenerativeModel({ model: 'gemini-1.5-flash' }) : ai.models;
          const result = await (ai.models?.generateContent
            ? ai.models.generateContent({ model: 'gemini-2.5-flash', contents: parts })
            : model.generateContent({ contents: parts }));

          const text = result?.response?.text ? result.response.text() : result?.text;
          if (text && text.trim()) {
            englishPrompt = text.trim();
          }
        } catch (err) {
          console.warn('[Gemini Art Director Prompt fallback]:', err.message);
          if (keyMessage.trim()) {
            englishPrompt += ` Feature bold typography: "${keyMessage}".`;
          }
        }
      } else if (keyMessage.trim()) {
        englishPrompt += ` Prominently display headline: "${keyMessage}".`;
      }

      // Upload references to Leonardo
      let bannerInitId = null;
      let characterInitId = null;

      if (competitorRef) {
        bannerInitId = await uploadInitImageToLeonardo(competitorRef, leonardoApiKey);
      }
      if (character) {
        characterInitId = await uploadInitImageToLeonardo(character, leonardoApiKey);
      }

      if (bannerInitId || characterInitId) {
        await new Promise((r) => setTimeout(r, 6000));
      }

      const imageUrl = await generateWithLeonardo({
        apiKey: leonardoApiKey,
        prompt: englishPrompt,
        width: dimensions.w,
        height: dimensions.h,
        bannerInitId,
        characterInitId
      });

      return response.json({
        imageUrl,
        promptUsed: englishPrompt,
        dimensions
      });
    } catch (error) {
      console.error('[POST /api/banner-ads/generate-single error]:', error);
      return response.status(500).json({ error: error.message || 'Không thể tạo banner.' });
    }
  });

  // ── 2. GENERATE BATCH BANNERS ─────────────────────────────────────────────
  app.post('/api/banner-ads/generate-batch', requireSupabaseUser, async (request, response) => {
    try {
      const leonardoApiKey = getEnv('LEONARDO_API_KEY');
      const geminiApiKey = getEnv('GEMINI_API_KEY') || getEnv('GOOGLE_API_KEY');

      if (!leonardoApiKey) {
        return response.status(503).json({ error: 'Chưa cấu hình Leonardo API Key.' });
      }

      const {
        batchSets = [],
        size = '16:9',
        quality = '1k',
        seed
      } = request.body || {};

      if (!Array.isArray(batchSets) || batchSets.length === 0) {
        return response.status(400).json({ error: 'Vui lòng cung cấp danh sách bộ banner.' });
      }

      const dimensions = resolveDimensions(size, quality);
      const results = [];

      for (let i = 0; i < batchSets.length; i++) {
        const item = batchSets[i];
        if (!item.competitorRef && !item.character && !item.keyMessage?.trim()) {
          results.push({ setIndex: i, status: 'skipped' });
          continue;
        }

        try {
          let prompt = `Premium promotional banner for OMFIT Pilates. Aspect ratio ${size}. ${item.keyMessage ? `Headline: "${item.keyMessage}".` : ''} High resolution, cinematic wellness studio lighting.`;
          
          let bInit = null;
          let cInit = null;
          if (item.competitorRef) bInit = await uploadInitImageToLeonardo(item.competitorRef, leonardoApiKey);
          if (item.character) cInit = await uploadInitImageToLeonardo(item.character, leonardoApiKey);
          if (bInit || cInit) await new Promise(r => setTimeout(r, 4000));

          const url = await generateWithLeonardo({
            apiKey: leonardoApiKey,
            prompt,
            width: dimensions.w,
            height: dimensions.h,
            bannerInitId: bInit,
            characterInitId: cInit,
            seed
          });

          results.push({
            setIndex: i,
            status: 'success',
            imageUrl: url,
            promptUsed: prompt
          });
        } catch (err) {
          results.push({
            setIndex: i,
            status: 'error',
            error: err.message || 'Lỗi khi tạo set banner này'
          });
        }
      }

      return response.json({ results, seed });
    } catch (error) {
      console.error('[POST /api/banner-ads/generate-batch error]:', error);
      return response.status(500).json({ error: error.message || 'Không thể tạo batch banner.' });
    }
  });

  // ── 3. RESIZE BANNER ──────────────────────────────────────────────────────
  app.post('/api/banner-ads/resize', requireSupabaseUser, async (request, response) => {
    try {
      const leonardoApiKey = getEnv('LEONARDO_API_KEY');
      if (!leonardoApiKey) {
        return response.status(503).json({ error: 'Chưa cấu hình Leonardo API Key.' });
      }

      const { imageData, sizes = [], quality = '1k', seed } = request.body || {};
      if (!imageData) {
        return response.status(400).json({ error: 'Vui lòng cung cấp ảnh banner gốc.' });
      }
      if (!Array.isArray(sizes) || sizes.length === 0) {
        return response.status(400).json({ error: 'Vui lòng chọn ít nhất 1 kích thước mục tiêu.' });
      }

      const bannerInitId = await uploadInitImageToLeonardo(imageData, leonardoApiKey);
      if (bannerInitId) await new Promise(r => setTimeout(r, 6000));

      const results = [];
      for (const targetSize of sizes) {
        const dim = resolveDimensions(targetSize, quality);
        const prompt = `Recreate and adapt this OMFIT promotional banner perfectly for ${targetSize} aspect ratio. Preserve all key subjects, layout harmony, and modern wellness aesthetic without distortion.`;

        try {
          const url = await generateWithLeonardo({
            apiKey: leonardoApiKey,
            prompt,
            width: dim.w,
            height: dim.h,
            bannerInitId,
            seed
          });
          results.push({ size: targetSize, status: 'success', imageUrl: url });
        } catch (err) {
          results.push({ size: targetSize, status: 'error', error: err.message });
        }
      }

      return response.json({ results, seed });
    } catch (error) {
      console.error('[POST /api/banner-ads/resize error]:', error);
      return response.status(500).json({ error: error.message || 'Không thể resize banner.' });
    }
  });

  // ── 4. SCAN BANNER TEXT (OCR) ─────────────────────────────────────────────
  app.post('/api/banner-ads/scan-text', requireSupabaseUser, async (request, response) => {
    try {
      const geminiApiKey = getEnv('GEMINI_API_KEY') || getEnv('GOOGLE_API_KEY');
      if (!geminiApiKey) {
        return response.status(503).json({ error: 'Chưa cấu hình Gemini API Key.' });
      }

      const { imageData } = request.body || {};
      if (!imageData) {
        return response.status(400).json({ error: 'Vui lòng cung cấp ảnh banner.' });
      }

      const raw = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const mime = imageData.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/)?.[1] || 'image/png';

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const prompt = `You are an expert OCR and localization engine.
Transcribe ALL visible text, headlines, subtitles, and CTAs in this banner with 100% precision.
Return a JSON object formatted as:
{
  "detectedText": "exact text in image",
  "suggestedTranslation": "natural Vietnamese translation suitable for an OMFIT fitness/wellness banner"
}`;

      const contents = [
        { inlineData: { data: raw, mimeType: mime } },
        { text: prompt }
      ];

      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: { responseMimeType: 'application/json' }
      });

      const responseText = result.text || '';
      const parsed = JSON.parse(responseText || '{}');
      return response.json({
        detectedText: parsed.detectedText || '',
        suggestedTranslation: parsed.suggestedTranslation || ''
      });
    } catch (error) {
      console.error('[POST /api/banner-ads/scan-text error]:', error);
      return response.status(500).json({ error: error.message || 'Không thể quét chữ trên banner.' });
    }
  });

  // ── 5. LOCALIZE / TEXT CLONE BANNER ───────────────────────────────────────
  app.post('/api/banner-ads/localize', requireSupabaseUser, async (request, response) => {
    try {
      const leonardoApiKey = getEnv('LEONARDO_API_KEY');
      if (!leonardoApiKey) {
        return response.status(503).json({ error: 'Chưa cấu hình Leonardo API Key.' });
      }

      const { imageData, targetText, targetLanguage = 'Vietnamese', size = '16:9', quality = '1k' } = request.body || {};
      if (!imageData || !targetText) {
        return response.status(400).json({ error: 'Vui lòng cung cấp ảnh và văn bản thay thế.' });
      }

      const dim = resolveDimensions(size, quality);
      const bannerInitId = await uploadInitImageToLeonardo(imageData, leonardoApiKey);
      if (bannerInitId) await new Promise(r => setTimeout(r, 6000));

      const prompt = `Recreate this exact banner image. PRESERVE the entire background, lighting, subjects, and layout. REPLACE the main headline text with: "${targetText}" in ${targetLanguage}. Match typography, color, and visual hierarchy perfectly.`;

      const imageUrl = await generateWithLeonardo({
        apiKey: leonardoApiKey,
        prompt,
        width: dim.w,
        height: dim.h,
        bannerInitId
      });

      return response.json({ imageUrl, promptUsed: prompt });
    } catch (error) {
      console.error('[POST /api/banner-ads/localize error]:', error);
      return response.status(500).json({ error: error.message || 'Không thể bản địa hóa banner.' });
    }
  });

  // ── 6. BANNER HISTORY ─────────────────────────────────────────────────────
  app.get('/api/banner-ads/history', requireSupabaseUser, async (request, response) => {
    try {
      const supabase = getSupabaseAdmin();
      const ownerId = request.supabaseUser.id;

      const { data, error } = await supabase
        .from('media_assets')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) throw error;

      const bannerItems = (data || [])
        .filter((item) => item.metadata?.assetType === 'banner_ad' || item.alt_text?.includes('Banner'))
        .map((item) => ({
          id: item.id,
          ownerId: item.owner_id,
          url: item.public_url || item.source_url,
          prompt: item.prompt,
          keyMessage: item.metadata?.keyMessage || item.alt_text,
          size: item.metadata?.size || '16:9',
          quality: item.metadata?.quality || '1k',
          mode: item.metadata?.mode || 'single',
          createdAt: item.created_at
        }));

      return response.json({ items: bannerItems });
    } catch (error) {
      console.error('[GET /api/banner-ads/history error]:', error);
      return response.status(500).json({ error: error.message || 'Không thể tải lịch sử banner.' });
    }
  });

  // ── 7. SAVE BANNER TO ASSETS ──────────────────────────────────────────────
  app.post('/api/banner-ads/save', requireSupabaseUser, async (request, response) => {
    try {
      const supabase = getSupabaseAdmin();
      const ownerId = request.supabaseUser.id;
      const { imageUrl, prompt = '', keyMessage = '', size = '16:9', quality = '1k', mode = 'single' } = request.body || {};

      if (!imageUrl) {
        return response.status(400).json({ error: 'Vui lòng cung cấp URL ảnh banner.' });
      }

      const fileName = `omfit-banner-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.png`;
      const storagePath = `${ownerId}/banners/${fileName}`;

      let publicUrl = imageUrl;

      // Try downloading and uploading to Supabase Storage if it's an external URL
      if (imageUrl.startsWith('http')) {
        try {
          const res = await fetch(imageUrl);
          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            const { error: uploadError } = await supabase.storage
              .from('omfit-public-assets')
              .upload(storagePath, buffer, {
                contentType: 'image/png',
                upsert: true
              });

            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('omfit-public-assets')
                .getPublicUrl(storagePath);
              if (urlData?.publicUrl) {
                publicUrl = urlData.publicUrl;
              }
            }
          }
        } catch (downloadErr) {
          console.warn('[Save Banner storage upload warning]:', downloadErr.message);
        }
      }

      const { data: asset, error: insertError } = await supabase
        .from('media_assets')
        .insert({
          owner_id: ownerId,
          provider: 'leonardo',
          model: 'banner-ads-generator',
          bucket: 'omfit-public-assets',
          storage_path: storagePath,
          public_url: publicUrl,
          source_url: imageUrl,
          file_name: fileName,
          alt_text: keyMessage ? `OMFIT Banner: ${keyMessage}` : 'OMFIT Promotional Banner',
          caption: keyMessage,
          prompt,
          status: 'approved',
          metadata: {
            assetType: 'banner_ad',
            keyMessage,
            size,
            quality,
            mode
          }
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      return response.json({
        item: {
          id: asset.id,
          ownerId: asset.owner_id,
          url: asset.public_url,
          prompt: asset.prompt,
          keyMessage: asset.metadata?.keyMessage,
          size: asset.metadata?.size,
          quality: asset.metadata?.quality,
          mode: asset.metadata?.mode,
          createdAt: asset.created_at
        }
      });
    } catch (error) {
      console.error('[POST /api/banner-ads/save error]:', error);
      return response.status(500).json({ error: error.message || 'Không thể lưu banner.' });
    }
  });
}
