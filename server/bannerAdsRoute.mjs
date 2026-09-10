import { GoogleGenAI } from '@google/genai';
import crypto from 'node:crypto';
import {
  extractLeonardoErrorMessage,
  extractLeonardoGenerationId,
  leonardoGenerationStatusEndpoint,
  LEONARDO_GENERATION_ENDPOINT,
  LEONARDO_INIT_IMAGE_ENDPOINT
} from './leonardoImageGeneration.mjs';
import {
  capsOf,
  GPT_IMAGE,
  isImageModel,
  resolveResolution
} from '../src/lib/imageModels.mjs';

const DEFAULT_MODEL_ID = GPT_IMAGE;

// Model chạy bước "Art Director": Gemini đọc ảnh tham chiếu rồi viết prompt tiếng
// Anh cho model sinh ảnh. Nhiệt độ thấp để prompt bám sát ảnh gốc thay vì sáng tác.
// Ràng buộc CHỈ áp cho gpt-image-2. Bộ prompt Art Director port từ gssea-gamehub
// vốn viết cho nano-banana-2 — model đó diễn giải lỏng nên vẫn giữ logo và thanh
// footer. gpt-image-2 làm đúng nghĩa đen: gặp "REPLACE all existing text" là xoá
// sạch cả logo lẫn thông tin liên hệ, và khi tự đánh máy lại footer thì viết tràn
// ra ngoài mép khung nên chữ bị cụt. Hai câu dưới đây chặn đúng hai lỗi đó mà
// không phải sửa prompt gốc.
const GPT_IMAGE_FRAMING_RULES = 'IMPORTANT OVERRIDES: Keep the brand logo and the contact/footer bar from the reference exactly as they are - do not remove, rewrite, translate or relocate them; text replacement applies to the headline message only. Every text element must fit entirely inside the canvas with a clear safe margin from all four edges - never let any text touch, overflow or get clipped by an edge.';

const ART_DIRECTOR_MODEL = 'gemini-2.5-pro';
const ART_DIRECTOR_TEMPERATURE = 0.2;
const ART_DIRECTOR_MAX_CHARS = 950;

function resolveModelId(model) {
  return isImageModel(model) ? String(model) : DEFAULT_MODEL_ID;
}

// resolveResolution tự nắn về vùng hợp lệ của model — lớp phòng thủ cho client cũ,
// UI đã lọc sẵn các tier không dùng được.
function resolveDimensions(size = '16:9', quality = '1k', model = DEFAULT_MODEL_ID) {
  return resolveResolution(
    resolveModelId(model),
    String(size || '16:9').trim(),
    String(quality || '1k').trim().toLowerCase()
  );
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

// ════════════════════════════════════════════════════════════════════════════
// ART DIRECTOR — port nguyên văn bộ prompt của tính năng /creative bên
// gssea-gamehub (api/routes/generateCreative.ts). Gemini đọc ảnh tham chiếu rồi
// viết prompt tiếng Anh cho model sinh ảnh, thay vì nhét thẳng thông điệp của
// user vào Leonardo. Nhánh được chọn theo tổ hợp (ảnh layout, ảnh chủ thể,
// thông điệp) vì mỗi tổ hợp là một tác vụ khác hẳn nhau: tráo chủ thể, thay
// chữ, giữ nguyên, hay dựng mới.
//
// Bốn nhánh đầu giữ nguyên 100% văn bản gốc. Nhánh cuối (dựng mới từ đầu) bên
// gamehub viết cho banner game nên đã đổi sang bối cảnh OMFIT.
// ════════════════════════════════════════════════════════════════════════════
function buildArtDirectorInstruction({ hasCompetitor, hasCharacter, hasKeyMessage, keyMessage, language, modelId }) {
  if (hasCompetitor && hasCharacter && hasKeyMessage) {
    return `You are an elite Creative Director. I am providing you with 2 images: Image 1 (Reference Banner) and Image 2 (My Character).
        YOUR TASK: Write a highly detailed, 500-1000 character English prompt for an AI Image Generator (${modelId} model) to perform a PERFECT CHARACTER SWAP AND TEXT REPLACEMENT.

        CRITICAL INSTRUCTIONS:
        1. BACKGROUND & LAYOUT: Analyze Image 1 deeply. Describe EVERY background element (scenery, objects, lighting, color palette, decorative elements). State: "PRESERVE the entire background, layout, and all visual elements EXACTLY as shown."
        2. CHARACTER SWAP: Analyze Image 2. Describe my character in extreme detail (appearance, outfit, pose, art style). Instruct: "REMOVE the original character from the scene and INSERT this exact character in the same position, maintaining the same scale and pose orientation."
        3. TEXT REPLACEMENT: Identify ALL text visible in Image 1. Instruct: "REPLACE all existing text with this exact new text: '${keyMessage}'. Write this text in ${language} language. Use the EXACT SAME typography style, color, effects (glow/shadow/outline), size, and position as the original text."
        4. BLENDING: "Seamlessly blend the new character and text into the existing scene using identical lighting and color grading."

        Output ONLY the final English prompt as a single cohesive paragraph. No labels, no bullet points. MAXIMUM 800 CHARACTERS. Do NOT exceed 800 characters or the system will crash.`;
  }

  if (hasCompetitor && hasCharacter && !hasKeyMessage) {
    return `You are an elite Creative Director. I am providing you with 2 images: Image 1 (Reference Banner) and Image 2 (Character Reference).
        YOUR TASK: Write a highly detailed English prompt for an AI Image Generator (${modelId} model) to perform a PERFECT CHARACTER SWAP ONLY.

        CRITICAL INSTRUCTIONS:
        1. BACKGROUND, LAYOUT & TEXT: Analyze Image 1 deeply. Describe EVERY element including background scenery, objects, lighting, color palette, ALL TEXT/TYPOGRAPHY, and decorative elements. State: "PRESERVE the ENTIRE background, layout, ALL existing text, typography, and every visual element EXACTLY unchanged."
        2. CHARACTER SWAP: Analyze Image 2 (the character). Describe the character in extreme detail (appearance, outfit, pose, hair, accessories). Instruct: "REMOVE all original characters from the scene and INSERT this exact character from Image 2 in the same position, maintaining the same scale and facing direction."
        3. BLENDING: "Seamlessly blend the new character into the existing scene. Match the original lighting, shadows, and color grading perfectly."

        Output ONLY the final English prompt as a single cohesive paragraph. MAXIMUM 800 CHARACTERS. Do NOT exceed 800 characters or the system will crash.`;
  }

  if (hasCompetitor && !hasCharacter && !hasKeyMessage) {
    return `You are an elite Creative Director. I have provided a Reference Banner image.
          YOUR TASK: Write a highly detailed English prompt for an AI Image Generator (${modelId} model) to perform a PERFECT RECREATION AND RESIZING.

          CRITICAL INSTRUCTIONS:
          1. FULL PRESERVATION of ASSETS: Analyze the image deeply. Describe EVERY element including background scenery, characters, objects, lighting, color palette, decorative elements, and ANY existing text/typography EXACTLY as they appear. Use the exact same design language.
          2. STRICT REPLICATION OF VISUALS & TEXT: State explicitly: "PRESERVE ALL existing text, fonts, objects, and visual styles EXACTLY 100% unchanged. Do NOT redesign, do NOT modify, do NOT delete or translate any text regardless of language settings."
          3. SMART LAYOUT REARRANGEMENT: We are creating a new aspect ratio for this design. Instruct: "You have the freedom to SMARTLY REARRANGE the layout and spacing to perfectly fit the new dimensions. However, the core composition, visual hierarchy, and graphics must remain identical to the original."

          Output ONLY the final English prompt as a single cohesive paragraph. No labels, no bullet points. MAXIMUM 800 CHARACTERS.`;
  }

  if (hasCompetitor && !hasCharacter && hasKeyMessage) {
    return `You are an elite Creative Director. I have provided a Reference Banner image.
          YOUR TASK: Write a highly detailed English prompt for an AI Image Generator (${modelId} model) to perform a PERFECT TEXT REPLACEMENT AND LAYOUT ADAPTATION.

          CRITICAL INSTRUCTIONS:
          1. ASSET PRESERVATION: Analyze the image deeply. Describe EVERY element including background scenery, characters, objects, lighting, color palette, and decorative elements. State: "PRESERVE all original visual assets EXACTLY as shown. Do NOT redesign the graphics."
          2. TEXT REPLACEMENT: Identify ALL text visible. Instruct: "REPLACE all existing text with exactly: '${keyMessage}' written in ${language} language. Use the EXACT SAME typography style, color, effects, and visual weight."
          3. SMART LAYOUT REARRANGEMENT: Instruct: "You have permission to SMARTLY REARRANGE the layout and spacing of elements to perfectly fit the new target dimensions. Keep the core composition intact but adapt it flawlessly for the new aspect ratio."

          Output ONLY the final English prompt as a single cohesive paragraph. No labels, no bullet points. MAXIMUM 800 CHARACTERS.`;
  }

  return `You are an elite Art Director for OMFIT Pilates & Wellness. I have provided subject references.
        YOUR TASK: Write a highly detailed English prompt to create a new premium promotional banner from scratch.
        1. Create an elegant, cinematic background suitable for a modern pilates & wellness studio advertisement.
        2. Place my subject prominently in the center.
        ${hasKeyMessage ? `3. Write the exact text '${keyMessage}' in ${language} language prominently at the top center with clean modern typography.` : '3. Add appropriate wellness marketing text with clean modern typography.'}
        Output ONLY the prompt string. MAXIMUM 800 CHARACTERS. Do NOT exceed 800 characters.`;
}

function toInlineImagePart(dataUrl) {
  const mimeType = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/)?.[1] || 'image/jpeg';
  const data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
  return { inlineData: { data, mimeType } };
}

/**
 * Bước 1 của luồng tạo banner: Gemini viết prompt cho model sinh ảnh.
 * Lỗi ở bước này không làm hỏng cả request — rơi về prompt dự phòng để user vẫn
 * nhận được ảnh, chỉ kém bám ảnh tham chiếu hơn.
 */
async function runArtDirector({ geminiApiKey, competitorRef, character, keyMessage, language, modelId, fallbackPrompt }) {
  if (!geminiApiKey) return fallbackPrompt;

  const instruction = buildArtDirectorInstruction({
    hasCompetitor: !!competitorRef,
    hasCharacter: !!character,
    hasKeyMessage: !!keyMessage?.trim(),
    keyMessage: keyMessage?.trim() || '',
    language,
    modelId
  });

  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const contents = [instruction];
    if (competitorRef) contents.push(toInlineImagePart(competitorRef));
    if (character) contents.push(toInlineImagePart(character));

    const draft = await ai.models.generateContent({
      model: ART_DIRECTOR_MODEL,
      contents,
      config: { temperature: ART_DIRECTOR_TEMPERATURE }
    });

    const englishPrompt = (draft?.text || '').trim();
    if (!englishPrompt) throw new Error('Art Director trả về rỗng.');
    return englishPrompt.length > ART_DIRECTOR_MAX_CHARS
      ? `${englishPrompt.slice(0, ART_DIRECTOR_MAX_CHARS)}...`
      : englishPrompt;
  } catch (err) {
    console.warn('[Art Director fallback]:', err.message);
    return fallbackPrompt;
  }
}

async function generateWithLeonardo({
  apiKey,
  prompt,
  width,
  height,
  bannerInitId,
  characterInitId,
  seed,
  model,
  imageQuality
}) {
  const modelId = resolveModelId(model);
  const caps = capsOf(modelId);

  // Chừa sẵn chỗ cho phần ràng buộc, tránh việc cắt prompt làm mất luôn nó
  const framingRules = modelId === GPT_IMAGE ? ` ${GPT_IMAGE_FRAMING_RULES}` : '';
  const promptBudget = Math.max(0, caps.maxPrompt - framingRules.length);

  const genBody = {
    model: modelId,
    parameters: {
      prompt: prompt.slice(0, promptBudget) + framingRules,
      width,
      height,
      quantity: 1,
      prompt_enhance: 'OFF'
    },
    public: false
  };

  // Chỉ gpt-image-2 có tham số chất lượng render; nano-banana-2 không nhận.
  if (caps.renderQualities) {
    const allowed = caps.renderQualities.map((q) => q.value);
    const requested = String(imageQuality || '').toUpperCase();
    genBody.parameters.quality = allowed.includes(requested)
      ? requested
      : (allowed.includes('MEDIUM') ? 'MEDIUM' : allowed[0]);
  }

  if (typeof seed === 'number' && !Number.isNaN(seed)) {
    genBody.parameters.seed = seed;
  }

  // gpt-image-2 không dùng `strength` cho image reference (caps.refStrength = null)
  const buildRef = (id) => {
    const ref = { image: { id, type: 'UPLOADED' } };
    if (caps.refStrength) ref.strength = caps.refStrength;
    return ref;
  };

  const imageRefs = [];
  if (bannerInitId) imageRefs.push(buildRef(bannerInitId));
  if (characterInitId) imageRefs.push(buildRef(characterInitId));

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
        quality = '1k',
        model,
        imageQuality
      } = request.body || {};

      if (!competitorRef && !character && !keyMessage.trim()) {
        return response.status(400).json({ error: 'Vui lòng cung cấp ít nhất 1 ảnh mẫu hoặc thông điệp banner.' });
      }

      const modelId = resolveModelId(model);
      const dimensions = resolveDimensions(size, quality, modelId);

      // BƯỚC 1: Art Director viết prompt tiếng Anh từ ảnh tham chiếu
      const fallbackPrompt = `AAA high-end marketing promotional banner for OMFIT Pilates & Wellness. Aspect ratio ${size}. Professional lighting, balanced composition, modern minimalist luxury studio aesthetic.${keyMessage.trim() ? ` Prominently display headline: "${keyMessage.trim()}".` : ''}`;
      const englishPrompt = await runArtDirector({
        geminiApiKey,
        competitorRef,
        character,
        keyMessage,
        language,
        modelId,
        fallbackPrompt
      });

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
        characterInitId,
        model: modelId,
        imageQuality
      });

      return response.json({
        imageUrl,
        promptUsed: englishPrompt,
        dimensions,
        modelUsed: modelId
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
        language = 'Vietnamese',
        model,
        imageQuality,
        seed
      } = request.body || {};

      if (!Array.isArray(batchSets) || batchSets.length === 0) {
        return response.status(400).json({ error: 'Vui lòng cung cấp danh sách bộ banner.' });
      }

      const modelId = resolveModelId(model);
      const dimensions = resolveDimensions(size, quality, modelId);
      const results = [];

      for (let i = 0; i < batchSets.length; i++) {
        const item = batchSets[i];
        if (!item.competitorRef && !item.character && !item.keyMessage?.trim()) {
          results.push({ setIndex: i, status: 'skipped' });
          continue;
        }

        try {
          // Mỗi bộ chạy Art Director riêng vì tổ hợp ảnh/thông điệp của từng bộ khác nhau
          const prompt = await runArtDirector({
            geminiApiKey,
            competitorRef: item.competitorRef,
            character: item.character,
            keyMessage: item.keyMessage,
            language,
            modelId,
            fallbackPrompt: `Premium promotional banner for OMFIT Pilates. Aspect ratio ${size}. ${item.keyMessage ? `Headline: "${item.keyMessage}".` : ''} High resolution, cinematic wellness studio lighting.`
          });

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
            seed,
            model: modelId,
            imageQuality
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

      const { imageData, sizes = [], quality = '1k', seed, model, imageQuality } = request.body || {};
      if (!imageData) {
        return response.status(400).json({ error: 'Vui lòng cung cấp ảnh banner gốc.' });
      }
      if (!Array.isArray(sizes) || sizes.length === 0) {
        return response.status(400).json({ error: 'Vui lòng chọn ít nhất 1 kích thước mục tiêu.' });
      }

      const bannerInitId = await uploadInitImageToLeonardo(imageData, leonardoApiKey);
      if (bannerInitId) await new Promise(r => setTimeout(r, 6000));

      const modelId = resolveModelId(model);

      // Prompt cố định (port từ resizeBanner.ts bên gssea-gamehub): resize là tác vụ
      // giữ nguyên nội dung nên không cần Gemini viết lại prompt cho từng size.
      const RESIZE_PROMPT = 'Resize and adapt this banner image to the new aspect ratio. Keep the exact same visual content, style, colors, text, characters, and composition. Maintain all elements faithfully while adapting the layout to fit the new dimensions naturally.';

      const results = [];
      for (const targetSize of sizes) {
        const dim = resolveDimensions(targetSize, quality, modelId);

        try {
          const url = await generateWithLeonardo({
            apiKey: leonardoApiKey,
            prompt: RESIZE_PROMPT,
            width: dim.w,
            height: dim.h,
            bannerInitId,
            seed,
            model: modelId,
            imageQuality
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
      // Port từ scanBanner.ts bên gssea-gamehub, giữ nguyên bộ RULES; phần output
      // đổi sang object để giữ hợp đồng sẵn có với UI (kèm luôn bản dịch gợi ý).
      const prompt = `You are a precision OCR scanner. Analyze this banner/advertisement image.

YOUR TASK: Identify and extract ALL visible text in the image.

RULES:
1. Extract EVERY piece of text you can see, no matter how small.
2. Preserve the EXACT text as written (including capitalization, punctuation, special characters).
3. If text is in a non-English language, transcribe it exactly as shown.
4. Separate each distinct text element.

Return a JSON object formatted as:
{
  "detectedText": "every text element found, one per line, exactly as written",
  "suggestedTranslation": "natural Vietnamese translation suitable for an OMFIT fitness/wellness banner"
}

If you cannot detect any text, return empty strings for both fields.
Return ONLY the JSON object, no additional text or explanation.`;

      const contents = [
        { inlineData: { data: raw, mimeType: mime } },
        { text: prompt }
      ];

      const result = await ai.models.generateContent({
        model: ART_DIRECTOR_MODEL,
        contents,
        // temperature thấp cho OCR: cần đọc đúng chữ, không cần sáng tạo
        config: { responseMimeType: 'application/json', temperature: 0.1 }
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

      const {
        imageData,
        targetText,
        targetLanguage = 'Vietnamese',
        size = '16:9',
        quality = '1k',
        model,
        imageQuality
      } = request.body || {};
      if (!imageData || !targetText) {
        return response.status(400).json({ error: 'Vui lòng cung cấp ảnh và văn bản thay thế.' });
      }

      const geminiApiKey = getEnv('GEMINI_API_KEY') || getEnv('GOOGLE_API_KEY');
      const modelId = resolveModelId(model);
      const dim = resolveDimensions(size, quality, modelId);

      // Prompt dự phòng chính là prompt gốc của cloneBanner.ts khi Gemini lỗi.
      let prompt = `Recreate this exact banner image. PRESERVE all background, characters, and layout. REPLACE the main text with: '${targetText}'. Match the original typography perfectly.`;

      if (geminiApiKey) {
        // Port từ cloneBanner.ts bên gssea-gamehub — nhánh "TEXT REPLACEMENT ONLY"
        const promptEngineerPrompt = `You are an elite Art Director. I am providing you with a Reference Banner Image.
YOUR TASK: Write a highly detailed, 300-800 character English prompt for an AI Image Generator (${modelId} model) to perform a PERFECT TEXT REPLACEMENT ONLY.

CRITICAL INSTRUCTIONS:
1. BACKGROUND, CHARACTERS & LAYOUT: Analyze the provided image deeply. Explicitly state: "PRESERVE the entire background, characters, layout, and all visual elements EXACTLY as shown."
2. TYPOGRAPHY & TEXT REPLACEMENT: "REPLACE the original text with: '${targetText}'. Use the EXACT SAME typography style, color, 3D effects, size, and position." Write the new text in ${targetLanguage}.

Output ONLY the final English prompt. MAXIMUM 800 CHARACTERS.`;

        try {
          const ai = new GoogleGenAI({ apiKey: geminiApiKey });
          const engineered = await ai.models.generateContent({
            model: ART_DIRECTOR_MODEL,
            contents: [promptEngineerPrompt, toInlineImagePart(imageData)],
            config: { temperature: ART_DIRECTOR_TEMPERATURE }
          });
          const text = (engineered?.text || '').trim();
          if (text) prompt = text;
        } catch (err) {
          console.warn('[Localize prompt engineer fallback]:', err.message);
        }
      }

      const bannerInitId = await uploadInitImageToLeonardo(imageData, leonardoApiKey);
      if (bannerInitId) await new Promise(r => setTimeout(r, 6000));

      const imageUrl = await generateWithLeonardo({
        apiKey: leonardoApiKey,
        prompt,
        width: dim.w,
        height: dim.h,
        bannerInitId,
        model: modelId,
        imageQuality
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
