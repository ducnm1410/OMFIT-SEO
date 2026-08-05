import { GoogleGenAI } from '@google/genai';
import {
  buildGeminiVideoEditRequest,
  calculateVideoTelemetry,
  createVideoEditorTicket,
  extractVideoFromInteraction,
  friendlyGoogleApiError,
  GEMINI_VIDEO_EDITOR_MODEL,
  isGoogleFileNotFoundError,
  normalizeOwnedVideoInputPath,
  verifyVideoEditorTicket,
  VIDEO_EDITOR_FILE_RECOVERY_LIMIT,
  VIDEO_EDITOR_IMAGE_MIME_TYPES,
  VIDEO_EDITOR_JOB_TICKET_TTL_MS,
  VIDEO_EDITOR_MAX_BYTES,
  VIDEO_EDITOR_MAX_IMAGE_BYTES,
  VIDEO_EDITOR_MEDIA_TRANSFER_TIMEOUT_MS,
  VIDEO_EDITOR_MIME_TYPES,
  VIDEO_EDITOR_OUTPUT_BUCKET,
  VIDEO_EDITOR_POLL_REQUEST_TIMEOUT_MS,
  VIDEO_EDITOR_PROVIDER_REQUEST_TIMEOUT_MS,
  VIDEO_EDITOR_SOURCE_BUCKET,
  VIDEO_EDITOR_SOURCE_TICKET_TTL_MS
} from './geminiVideoEditor.mjs';

class VideoNotReadyError extends Error {}

function sourceFileMissingError() {
  const error = new Error('Google Gemini không còn tìm thấy tệp video. Hãy chọn lại video nguồn và thử lại.');
  error.statusCode = 410;
  error.code = 'video_editor_source_missing';
  return error;
}

function normalizedState(value) {
  return String(value?.name || value || '').trim().toUpperCase();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value || ''));
}

function safeVideoName(value) {
  return String(value || 'omfit-video')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'omfit-video';
}

function ticketSecret(getEnv) {
  return getEnv('VIDEO_EDITOR_JOB_SECRET')
    || getEnv('IMAGE_GENERATION_JOB_SECRET')
    || getEnv('SUPABASE_SERVICE_ROLE_KEY');
}

function assertTicket(value, expectedKind, ownerId, ttlMs, getEnv) {
  const job = verifyVideoEditorTicket(value, ticketSecret(getEnv));
  const issuedAt = Number(job?.issuedAt || 0);
  if (
    !job
    || job.version !== 1
    || job.kind !== expectedKind
    || job.ownerId !== ownerId
    || !issuedAt
    || issuedAt > Date.now() + 60_000
    || Date.now() - issuedAt > ttlMs
  ) {
    const error = new Error('Phiên xử lý video không hợp lệ hoặc đã hết hạn.');
    error.statusCode = 400;
    error.code = 'video_editor_ticket_invalid';
    throw error;
  }
  return job;
}

function mapVideoAsset(row) {
  const allowedModes = new Set(['text-to-video', 'image-to-video', 'edit-video', 'continue']);
  return {
    id: row.id,
    url: row.public_url,
    interactionId: row.provider_interaction_id,
    parentAssetId: row.parent_asset_id || undefined,
    promptVi: row.prompt_vi || '',
    promptEn: row.prompt_en || '',
    resolution: row.resolution === '1080p' ? '1080p' : '720p',
    aspectRatio: row.aspect_ratio === '9:16' ? '9:16' : '16:9',
    generationMode: allowedModes.has(row.generation_mode) ? row.generation_mode : 'edit-video',
    fileName: row.file_name,
    mimeType: row.mime_type || 'video/mp4',
    storagePath: row.storage_path,
    sourceStoragePath: row.source_storage_path || undefined,
    bytes: Number(row.bytes) || undefined,
    renderDurationMs: Number(row.render_duration_ms) || undefined,
    estimatedCostUsd: Number(row.estimated_cost_usd) || undefined,
    outputDurationSeconds: Number(row.output_duration_seconds) || undefined,
    usedAt: row.used_at || undefined,
    useCount: Number(row.use_count) || 0,
    createdAt: row.created_at
  };
}

async function findVideoAsset(supabase, ownerId, interactionId) {
  const { data, error } = await supabase
    .from('video_assets')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('provider_interaction_id', interactionId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Không thể đọc lịch sử video: ${error.message}`);
  return data;
}

async function materializeVideo(extracted, apiKey, ai) {
  if (extracted?.base64) return Buffer.from(extracted.base64, 'base64');
  if (!extracted?.uri) throw new Error('Gemini đã hoàn tất nhưng không trả về video.');
  const url = new URL(extracted.uri);
  if (url.protocol !== 'https:' || url.hostname !== 'generativelanguage.googleapis.com') {
    throw new Error('Gemini trả về đường dẫn video không hợp lệ.');
  }
  const fileMatch = url.pathname.match(/\/(files\/[a-zA-Z0-9_-]+)$/);
  if (!fileMatch) throw new Error('Gemini trả về mã tệp video không hợp lệ.');
  let googleFile;
  try {
    googleFile = await ai.files.get({
      name: fileMatch[1],
      config: { httpOptions: { timeout: VIDEO_EDITOR_POLL_REQUEST_TIMEOUT_MS } }
    });
  } catch (error) {
    if (isGoogleFileNotFoundError(error)) {
      throw new VideoNotReadyError('Video output is not visible yet.');
    }
    throw error;
  }
  const fileState = normalizedState(googleFile.state);
  if (fileState === 'FAILED') throw new Error('Gemini không thể hoàn tất tệp video đầu ra.');
  if (fileState !== 'ACTIVE') throw new VideoNotReadyError('Video output is still processing.');

  const downloadUrl = new URL(url);
  downloadUrl.pathname = `${downloadUrl.pathname}:download`;
  downloadUrl.search = '';
  downloadUrl.searchParams.set('alt', 'media');
  const result = await fetch(downloadUrl, {
    headers: { 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(VIDEO_EDITOR_MEDIA_TRANSFER_TIMEOUT_MS)
  });
  if ([404, 409, 425, 429].includes(result.status) || result.status >= 500) {
    throw new VideoNotReadyError('Video output is still processing.');
  }
  if (!result.ok) throw new Error(`Không thể tải video Gemini (${result.status}).`);
  return Buffer.from(await result.arrayBuffer());
}

async function uploadGoogleSource(supabase, ai, storagePath, mimeType, preparedSourceFile) {
  let sourceFile = preparedSourceFile;
  if (!sourceFile) {
    const { data, error: downloadError } = await supabase.storage
      .from(VIDEO_EDITOR_SOURCE_BUCKET)
      .download(storagePath);
    if (downloadError || !data) {
      throw new Error(`Không thể đọc video nguồn: ${downloadError?.message || 'tệp rỗng'}`);
    }
    sourceFile = data;
  }
  if (sourceFile.size > VIDEO_EDITOR_MAX_BYTES) {
    const error = new Error('Video nguồn vượt quá giới hạn 100 MB.');
    error.statusCode = 413;
    error.code = 'video_editor_source_too_large';
    throw error;
  }
  const googleFile = await ai.files.upload({
    file: new Blob([await sourceFile.arrayBuffer()], { type: mimeType }),
    config: {
      mimeType,
      httpOptions: { timeout: VIDEO_EDITOR_MEDIA_TRANSFER_TIMEOUT_MS }
    }
  });
  if (!googleFile?.name || !googleFile?.uri) {
    const error = new Error('Google Gemini không trả về mã tệp video nguồn hợp lệ.');
    error.statusCode = 502;
    error.code = 'video_editor_source_upload_invalid';
    throw error;
  }
  return googleFile;
}

async function persistCompletedVideo(supabase, ownerId, job, interaction, apiKey, ai) {
  const existing = await findVideoAsset(supabase, ownerId, job.interactionId);
  if (existing) return mapVideoAsset(existing);

  const extracted = extractVideoFromInteraction(interaction);
  if (!extracted) throw new Error('Gemini đã hoàn tất nhưng không trả về video.');
  const videoBuffer = await materializeVideo(extracted, apiKey, ai);
  const telemetry = calculateVideoTelemetry(interaction?.usage, videoBuffer);
  if (videoBuffer.byteLength > VIDEO_EDITOR_MAX_BYTES) {
    const error = new Error('Video đầu ra vượt quá giới hạn 100 MB.');
    error.statusCode = 413;
    error.code = 'video_editor_output_too_large';
    throw error;
  }
  const mimeType = VIDEO_EDITOR_MIME_TYPES.has(extracted.mimeType)
    ? extracted.mimeType
    : 'video/mp4';
  const extension = mimeType === 'video/quicktime' ? 'mov' : mimeType === 'video/webm' ? 'webm' : 'mp4';
  const fileName = `${safeVideoName(job.promptVi)}-${safeVideoName(job.interactionId)}.${extension}`;
  const storagePath = `${ownerId}/video-editor/${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from(VIDEO_EDITOR_OUTPUT_BUCKET)
    .upload(storagePath, videoBuffer, { contentType: mimeType, upsert: true });
  if (uploadError) throw new Error(`Không thể lưu video vào Supabase: ${uploadError.message}`);
  const publicUrl = supabase.storage
    .from(VIDEO_EDITOR_OUTPUT_BUCKET)
    .getPublicUrl(storagePath).data.publicUrl;
  const { data, error } = await supabase
    .from('video_assets')
    .insert({
      owner_id: ownerId,
      parent_asset_id: job.parentAssetId || null,
      provider: 'gemini',
      provider_interaction_id: job.interactionId,
      model: GEMINI_VIDEO_EDITOR_MODEL,
      bucket: VIDEO_EDITOR_OUTPUT_BUCKET,
      storage_path: storagePath,
      public_url: publicUrl,
      source_storage_path: job.sourceStoragePath || null,
      mime_type: mimeType,
      bytes: videoBuffer.byteLength,
      file_name: fileName,
      prompt_vi: job.promptVi,
      prompt_en: job.promptEn,
      resolution: job.resolution,
      aspect_ratio: job.aspectRatio,
      generation_mode: job.generationMode,
      render_duration_ms: Math.max(0, Date.now() - Number(job.renderStartedAt || job.issuedAt)),
      estimated_cost_usd: telemetry.estimatedCostUsd,
      output_duration_seconds: telemetry.outputDurationSeconds,
      status: 'approved',
      metadata: {
        usage: interaction?.usage || null,
        sourceMimeType: job.sourceMimeType || null,
        pricing: {
          model: GEMINI_VIDEO_EDITOR_MODEL,
          basis: telemetry.outputVideoTokens > 0 ? 'provider_tokens' : 'output_duration_estimate',
          capturedAt: new Date().toISOString()
        }
      }
    })
    .select('*')
    .single();
  if (error) {
    const persisted = await findVideoAsset(supabase, ownerId, job.interactionId);
    if (persisted) return mapVideoAsset(persisted);
    throw new Error(`Không thể lưu metadata video: ${error.message}`);
  }
  return mapVideoAsset(data);
}

async function translatePrompt(ai, promptVi, getEnv) {
  try {
    const result = await ai.models.generateContent({
      model: getEnv('GEMINI_MODEL', 'gemini-2.5-flash'),
      contents: 'Translate this video-editing instruction into concise imperative English. Return only the translation:\n\n' + promptVi,
      config: { temperature: 0, maxOutputTokens: 256 }
    });
    return String(result.text || '').trim() || promptVi;
  } catch {
    return promptVi;
  }
}

export function registerVideoEditorRoute({ app, requireSupabaseUser, getSupabaseAdmin, getEnv }) {
  app.post('/api/video/editor', requireSupabaseUser, async (request, response) => {
    let fallbackCode = 'video_editor_failed';
    try {
      const apiKey = getEnv('GEMINI_API_KEY');
      if (!apiKey) {
        const error = new Error('Chưa cấu hình GEMINI_API_KEY cho AI Video Editor.');
        error.statusCode = 503;
        error.code = 'video_editor_missing';
        throw error;
      }
      const ownerId = request.supabaseUser.id;
      const supabase = getSupabaseAdmin();
      const ai = new GoogleGenAI({ apiKey });
      const operation = String(request.body?.operation || '').trim().toLowerCase();

      if (operation === 'prepare') {
        fallbackCode = 'video_editor_prepare_failed';
        const storagePath = normalizeOwnedVideoInputPath(
          ownerId,
          request.body?.bucket,
          request.body?.storagePath
        );
        if (!storagePath) {
          const error = new Error('Video nguồn không thuộc kho riêng của tài khoản.');
          error.statusCode = 400;
          error.code = 'video_editor_source_invalid';
          throw error;
        }
        const { data: sourceFile, error: downloadError } = await supabase.storage
          .from(VIDEO_EDITOR_SOURCE_BUCKET)
          .download(storagePath);
        if (downloadError || !sourceFile) throw new Error(`Không thể đọc video nguồn: ${downloadError?.message || 'tệp rỗng'}`);
        const requestedMimeType = String(request.body?.mimeType || '').split(';')[0].trim().toLowerCase();
        const storedMimeType = String(sourceFile.type || '').split(';')[0].trim().toLowerCase();
        const inputKind = request.body?.inputKind === 'image' ? 'image' : 'video';
        const mimeType = VIDEO_EDITOR_MIME_TYPES.has(storedMimeType)
          ? storedMimeType
          : VIDEO_EDITOR_IMAGE_MIME_TYPES.has(storedMimeType) ? storedMimeType : requestedMimeType;
        const allowedMimeTypes = inputKind === 'image'
          ? VIDEO_EDITOR_IMAGE_MIME_TYPES
          : VIDEO_EDITOR_MIME_TYPES;
        if (!allowedMimeTypes.has(mimeType)) {
          const error = new Error(inputKind === 'image'
            ? 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.'
            : 'Chỉ hỗ trợ video MP4, MOV hoặc WEBM.');
          error.statusCode = 415;
          error.code = 'video_editor_source_type_invalid';
          throw error;
        }
        const maxBytes = inputKind === 'image' ? VIDEO_EDITOR_MAX_IMAGE_BYTES : VIDEO_EDITOR_MAX_BYTES;
        if (sourceFile.size > maxBytes) {
          const error = new Error(inputKind === 'image'
            ? 'Ảnh nguồn vượt quá giới hạn 10 MB.'
            : 'Video nguồn vượt quá giới hạn 100 MB.');
          error.statusCode = 413;
          error.code = 'video_editor_source_too_large';
          throw error;
        }
        const googleFile = inputKind === 'video'
          ? await uploadGoogleSource(supabase, ai, storagePath, mimeType, sourceFile)
          : null;
        const sourceTicket = createVideoEditorTicket({
          version: 1,
          kind: 'source',
          issuedAt: Date.now(),
          ownerId,
          googleFileName: googleFile?.name || null,
          googleFileUri: googleFile?.uri || null,
          sourceStoragePath: storagePath,
          mimeType,
          inputKind,
          fileRecoveryCount: 0,
          originalFileName: String(request.body?.fileName || 'video-source').slice(0, 200)
        }, ticketSecret(getEnv));
        const state = inputKind === 'image' ? 'ACTIVE' : normalizedState(googleFile.state);
        if (state === 'FAILED') throw new Error('Gemini không thể xử lý video nguồn.');
        return response.status(state === 'ACTIVE' ? 200 : 202).json({
          status: state === 'ACTIVE' ? 'ready' : 'processing',
          ticket: sourceTicket
        });
      }

      if (operation === 'prepare_poll') {
        fallbackCode = 'video_editor_prepare_poll_failed';
        const sourceJob = assertTicket(
          request.body?.ticket,
          'source',
          ownerId,
          VIDEO_EDITOR_SOURCE_TICKET_TTL_MS,
          getEnv
        );
        if (sourceJob.inputKind === 'image') {
          return response.json({ status: 'ready', ticket: request.body.ticket });
        }
        let googleFile;
        try {
          googleFile = await ai.files.get({
            name: sourceJob.googleFileName,
            config: { httpOptions: { timeout: VIDEO_EDITOR_POLL_REQUEST_TIMEOUT_MS } }
          });
        } catch (error) {
          if (!isGoogleFileNotFoundError(error)) throw error;
          const recoveryCount = Number(sourceJob.fileRecoveryCount || 0) + 1;
          if (recoveryCount > VIDEO_EDITOR_FILE_RECOVERY_LIMIT) throw sourceFileMissingError();
          googleFile = await uploadGoogleSource(
            supabase,
            ai,
            sourceJob.sourceStoragePath,
            sourceJob.mimeType
          );
          sourceJob.fileRecoveryCount = recoveryCount;
          sourceJob.googleFileName = googleFile.name;
        }
        const state = normalizedState(googleFile.state);
        if (state === 'FAILED') throw new Error('Gemini không thể xử lý video nguồn.');
        const refreshedTicket = createVideoEditorTicket({
          ...sourceJob,
          googleFileName: googleFile.name || sourceJob.googleFileName,
          googleFileUri: googleFile.uri || sourceJob.googleFileUri
        }, ticketSecret(getEnv));
        return response.status(state === 'ACTIVE' ? 200 : 202).json({
          status: state === 'ACTIVE' ? 'ready' : 'processing',
          ticket: refreshedTicket
        });
      }

      if (operation === 'start') {
        fallbackCode = 'video_editor_start_failed';
        const promptVi = String(request.body?.promptVi || '').trim();
        if (promptVi.length < 2 || promptVi.length > 1_500) {
          const error = new Error('Yêu cầu chỉnh sửa phải có từ 2 đến 1.500 ký tự.');
          error.statusCode = 400;
          error.code = 'video_editor_prompt_invalid';
          throw error;
        }
        const resolution = request.body?.resolution === '1080p' ? '1080p' : '720p';
        const aspectRatio = request.body?.aspectRatio === '9:16' ? '9:16' : '16:9';
        const allowedModes = new Set(['text-to-video', 'image-to-video', 'edit-video', 'continue']);
        const generationMode = allowedModes.has(request.body?.mode)
          ? request.body.mode
          : 'edit-video';
        const renderStartedAt = Date.now();
        let sourceJob = null;
        let parentAsset = null;
        let imageData = null;
        const previousAssetId = String(request.body?.previousAssetId || '').trim();
        if (generationMode === 'continue') {
          if (!previousAssetId) {
            const error = new Error('Hãy chọn một phiên bản video để tiếp tục chỉnh sửa.');
            error.statusCode = 400;
            error.code = 'video_editor_parent_missing';
            throw error;
          }
          if (!isUuid(previousAssetId)) {
            const error = new Error('Mã video trước không hợp lệ.');
            error.statusCode = 400;
            error.code = 'video_editor_parent_invalid';
            throw error;
          }
          const { data, error } = await supabase
            .from('video_assets')
            .select('*')
            .eq('id', previousAssetId)
            .eq('status', 'approved')
            .maybeSingle();
          if (error) throw new Error(`Không thể đọc video trước: ${error.message}`);
          if (!data) {
            const error = new Error('Video trước không tồn tại hoặc bạn không có quyền sử dụng.');
            error.statusCode = 404;
            error.code = 'video_editor_parent_missing';
            throw error;
          }
          parentAsset = data;
        } else if (generationMode !== 'text-to-video') {
          sourceJob = assertTicket(
            request.body?.sourceTicket,
            'source',
            ownerId,
            VIDEO_EDITOR_SOURCE_TICKET_TTL_MS,
            getEnv
          );
          const expectedInputKind = generationMode === 'image-to-video' ? 'image' : 'video';
          if ((sourceJob.inputKind || 'video') !== expectedInputKind) {
            const error = new Error(generationMode === 'image-to-video'
              ? 'Chế độ Ảnh thành video cần một ảnh nguồn.'
              : 'Chế độ Sửa video cần một video nguồn.');
            error.statusCode = 400;
            error.code = 'video_editor_source_mode_mismatch';
            throw error;
          }
          if (expectedInputKind === 'image') {
            const { data: sourceImage, error: imageError } = await supabase.storage
              .from(VIDEO_EDITOR_SOURCE_BUCKET)
              .download(sourceJob.sourceStoragePath);
            if (imageError || !sourceImage) {
              throw new Error(`Không thể đọc ảnh nguồn: ${imageError?.message || 'tệp rỗng'}`);
            }
            if (sourceImage.size > VIDEO_EDITOR_MAX_IMAGE_BYTES) {
              const error = new Error('Ảnh nguồn vượt quá giới hạn 10 MB.');
              error.statusCode = 413;
              error.code = 'video_editor_source_too_large';
              throw error;
            }
            imageData = Buffer.from(await sourceImage.arrayBuffer()).toString('base64');
          } else {
            let googleFile;
            try {
              googleFile = await ai.files.get({
                name: sourceJob.googleFileName,
                config: { httpOptions: { timeout: VIDEO_EDITOR_POLL_REQUEST_TIMEOUT_MS } }
              });
            } catch (error) {
              if (isGoogleFileNotFoundError(error)) throw sourceFileMissingError();
              throw error;
            }
            if (normalizedState(googleFile.state) !== 'ACTIVE') {
              const error = new Error('Video nguồn chưa xử lý xong.');
              error.statusCode = 409;
              error.code = 'video_editor_source_processing';
              throw error;
            }
          }
        }
        const promptEn = await translatePrompt(ai, promptVi, getEnv);
        const requestOptions = {
          prompt: promptEn,
          mode: generationMode,
          fileUri: sourceJob?.googleFileUri,
          imageData,
          mimeType: sourceJob?.mimeType,
          previousInteractionId: parentAsset?.provider_interaction_id,
          resolution,
          aspectRatio
        };
        let interaction;
        try {
          interaction = await ai.interactions.create(
            buildGeminiVideoEditRequest({ ...requestOptions, includeResolution: true }),
            { timeout_ms: VIDEO_EDITOR_PROVIDER_REQUEST_TIMEOUT_MS }
          );
        } catch (error) {
          if (generationMode === 'edit-video' && /resolution|invalid|unknown|400|argument/i.test(String(error?.message || ''))) {
            interaction = await ai.interactions.create(
              buildGeminiVideoEditRequest({ ...requestOptions, includeResolution: false }),
              { timeout_ms: VIDEO_EDITOR_PROVIDER_REQUEST_TIMEOUT_MS }
            );
          } else {
            throw error;
          }
        }
        if (!interaction?.id) throw new Error('Gemini không trả về mã interaction.');
        const jobTicket = createVideoEditorTicket({
          version: 1,
          kind: 'edit',
          issuedAt: Date.now(),
          renderStartedAt,
          ownerId,
          interactionId: interaction.id,
          parentAssetId: parentAsset?.id || null,
          sourceStoragePath: sourceJob?.sourceStoragePath || parentAsset?.source_storage_path || null,
          sourceMimeType: sourceJob?.mimeType || parentAsset?.metadata?.sourceMimeType || null,
          promptVi,
          promptEn,
          resolution,
          aspectRatio,
          generationMode
        }, ticketSecret(getEnv));
        return response.status(202).json({ status: 'pending', ticket: jobTicket });
      }

      if (operation === 'comparison_source') {
        fallbackCode = 'video_editor_comparison_failed';
        const assetId = String(request.body?.assetId || '').trim();
        if (!isUuid(assetId)) {
          const error = new Error('Mã video so sánh không hợp lệ.');
          error.statusCode = 400;
          error.code = 'video_editor_asset_invalid';
          throw error;
        }
        const { data: asset, error: assetError } = await supabase
          .from('video_assets')
          .select('*')
          .eq('id', assetId)
          .eq('status', 'approved')
          .maybeSingle();
        if (assetError) throw new Error(`Không thể đọc video so sánh: ${assetError.message}`);
        if (!asset) {
          const error = new Error('Video so sánh không tồn tại.');
          error.statusCode = 404;
          error.code = 'video_editor_asset_missing';
          throw error;
        }
        if (asset.parent_asset_id) {
          const { data: parent, error: parentError } = await supabase
            .from('video_assets')
            .select('public_url')
            .eq('id', asset.parent_asset_id)
            .eq('status', 'approved')
            .maybeSingle();
          if (parentError) throw new Error(`Không thể đọc phiên bản trước: ${parentError.message}`);
          return response.json({
            source: parent?.public_url ? { url: parent.public_url, kind: 'video' } : null
          });
        }
        if (!asset.source_storage_path) return response.json({ source: null });
        const { data: signed, error: signedError } = await supabase.storage
          .from(VIDEO_EDITOR_SOURCE_BUCKET)
          .createSignedUrl(asset.source_storage_path, 60 * 60);
        if (signedError || !signed?.signedUrl) {
          throw new Error(`Không thể tạo liên kết video nguồn: ${signedError?.message || 'không có URL'}`);
        }
        const sourceMimeType = String(asset.metadata?.sourceMimeType || '');
        const isImage = asset.generation_mode === 'image-to-video'
          || sourceMimeType.startsWith('image/');
        return response.json({
          source: { url: signed.signedUrl, kind: isImage ? 'image' : 'video' }
        });
      }

      if (operation === 'mark_used') {
        fallbackCode = 'video_editor_mark_used_failed';
        const assetId = String(request.body?.assetId || '').trim();
        if (!isUuid(assetId)) {
          const error = new Error('Mã video không hợp lệ.');
          error.statusCode = 400;
          error.code = 'video_editor_asset_invalid';
          throw error;
        }
        const action = request.body?.action === 'selected' ? 'selected' : 'download';
        const { data: current, error: currentError } = await supabase
          .from('video_assets')
          .select('*')
          .eq('id', assetId)
          .eq('status', 'approved')
          .maybeSingle();
        if (currentError) throw new Error(`Không thể đọc trạng thái sử dụng video: ${currentError.message}`);
        if (!current) {
          const error = new Error('Video không tồn tại.');
          error.statusCode = 404;
          error.code = 'video_editor_asset_missing';
          throw error;
        }
        const { data: updated, error: updateError } = await supabase
          .from('video_assets')
          .update({
            used_at: new Date().toISOString(),
            use_count: Number(current.use_count || 0) + 1,
            last_used_action: action
          })
          .eq('id', assetId)
          .select('*')
          .single();
        if (updateError) throw new Error(`Không thể ghi nhận video đã sử dụng: ${updateError.message}`);
        return response.json(mapVideoAsset(updated));
      }

      if (operation === 'poll') {
        fallbackCode = 'video_editor_poll_failed';
        const editJob = assertTicket(
          request.body?.ticket,
          'edit',
          ownerId,
          VIDEO_EDITOR_JOB_TICKET_TTL_MS,
          getEnv
        );
        const existing = await findVideoAsset(supabase, ownerId, editJob.interactionId);
        if (existing) return response.json(mapVideoAsset(existing));
        const interaction = await ai.interactions.get(
          editJob.interactionId,
          {},
          { timeout_ms: VIDEO_EDITOR_POLL_REQUEST_TIMEOUT_MS }
        );
        const status = String(interaction?.status || 'in_progress').toLowerCase();
        if (['failed', 'cancelled', 'incomplete'].includes(status)) {
          const error = new Error(`Gemini kết thúc interaction với trạng thái ${status}.`);
          error.statusCode = 502;
          error.code = 'video_editor_generation_failed';
          throw error;
        }
        if (status !== 'completed') {
          return response.status(202).json({ status: 'pending', ticket: request.body.ticket });
        }
        try {
          const video = await persistCompletedVideo(supabase, ownerId, editJob, interaction, apiKey, ai);
          return response.json(video);
        } catch (error) {
          if (error instanceof VideoNotReadyError) {
            return response.status(202).json({ status: 'pending', ticket: request.body.ticket });
          }
          throw error;
        }
      }

      const error = new Error('Thao tác AI Video Editor không hợp lệ.');
      error.statusCode = 400;
      error.code = 'video_editor_operation_invalid';
      throw error;
    } catch (error) {
      const message = error?.statusCode
        ? (error instanceof Error ? error.message : 'Không thể xử lý video.')
        : friendlyGoogleApiError(error);
      const rateLimited = /quota|rate|429/i.test(message);
      return response.status(error?.statusCode || (rateLimited ? 429 : 502)).json({
        error: message,
        code: typeof error?.code === 'string' ? error.code : fallbackCode
      });
    }
  });
}
