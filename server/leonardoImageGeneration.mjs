export const LEONARDO_IMAGE_MODEL = 'gpt-image-2';
export const DEFAULT_LEONARDO_ASPECT_RATIO = '16:9';

export const LEONARDO_ASPECT_RATIOS = Object.freeze({
  '1:1': Object.freeze({ width: 1024, height: 1024 }),
  '2:3': Object.freeze({ width: 848, height: 1264 }),
  '3:2': Object.freeze({ width: 1264, height: 848 }),
  '16:9': Object.freeze({ width: 1376, height: 768 }),
  '9:16': Object.freeze({ width: 768, height: 1376 })
});

export function resolveLeonardoAspectRatio(value = DEFAULT_LEONARDO_ASPECT_RATIO) {
  const aspectRatio = String(value || DEFAULT_LEONARDO_ASPECT_RATIO).trim();
  if (!Object.prototype.hasOwnProperty.call(LEONARDO_ASPECT_RATIOS, aspectRatio)) {
    return null;
  }
  return { aspectRatio, ...LEONARDO_ASPECT_RATIOS[aspectRatio] };
}

export function buildLeonardoGenerationRequest({
  prompt,
  aspectRatio = DEFAULT_LEONARDO_ASPECT_RATIO,
  uploadedImageId
}) {
  const dimensions = resolveLeonardoAspectRatio(aspectRatio);
  if (!dimensions) throw new TypeError(`Unsupported Leonardo aspect ratio: ${aspectRatio}`);

  return {
    public: false,
    model: LEONARDO_IMAGE_MODEL,
    parameters: {
      quality: 'MEDIUM',
      prompt,
      quantity: 1,
      width: dimensions.width,
      height: dimensions.height,
      prompt_enhance: 'OFF',
      ...(uploadedImageId ? {
        guidances: {
          image_reference: [{
            image: { id: uploadedImageId, type: 'UPLOADED' }
          }]
        }
      } : {})
    }
  };
}
