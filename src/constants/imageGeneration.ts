import type { ImageAspectRatio } from '../types';

export const DEFAULT_IMAGE_ASPECT_RATIO: ImageAspectRatio = '16:9';

export const IMAGE_ASPECT_RATIO_OPTIONS: ReadonlyArray<{
  ratio: ImageAspectRatio;
  width: number;
  height: number;
  label: string;
}> = [
  { ratio: '1:1', width: 1024, height: 1024, label: 'Vuông' },
  { ratio: '2:3', width: 848, height: 1264, label: 'Dọc' },
  { ratio: '3:2', width: 1264, height: 848, label: 'Ngang' },
  { ratio: '16:9', width: 1376, height: 768, label: 'Ngang rộng' },
  { ratio: '9:16', width: 768, height: 1376, label: 'Dọc rộng' }
];

export function isImageAspectRatio(value: unknown): value is ImageAspectRatio {
  return IMAGE_ASPECT_RATIO_OPTIONS.some((option) => option.ratio === value);
}

export function getImageAspectRatioOption(aspectRatio: ImageAspectRatio) {
  return IMAGE_ASPECT_RATIO_OPTIONS.find((option) => option.ratio === aspectRatio)
    || IMAGE_ASPECT_RATIO_OPTIONS.find((option) => option.ratio === DEFAULT_IMAGE_ASPECT_RATIO)!;
}
