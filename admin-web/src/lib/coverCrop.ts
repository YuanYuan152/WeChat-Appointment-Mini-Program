/** 小程序首页封面宽高比（750rpx × 420rpx） */
export const HERO_COVER_ASPECT = 750 / 420;

export interface CoverCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_COVER_CROP: CoverCrop = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

export function normalizeCoverCrop(input?: Partial<CoverCrop> | null): CoverCrop {
  if (!input) {
    return { ...DEFAULT_COVER_CROP };
  }
  const width = Number(input.width ?? 1);
  const height = Number(input.height ?? 1);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { ...DEFAULT_COVER_CROP };
  }
  return {
    x: clamp01(Number(input.x ?? 0)),
    y: clamp01(Number(input.y ?? 0)),
    width: clampRange(width, 0.01, 1),
    height: clampRange(height, 0.01, 1),
  };
}

export function defaultCropForImage(imageWidth: number, imageHeight: number, aspect = HERO_COVER_ASPECT): CoverCrop {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { ...DEFAULT_COVER_CROP };
  }
  const imageAspect = imageWidth / imageHeight;
  if (imageAspect > aspect) {
    const width = aspect / imageAspect;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  const height = imageAspect / aspect;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

export function computeCropFromTransform(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
): CoverCrop {
  if (imageWidth <= 0 || imageHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { ...DEFAULT_COVER_CROP };
  }
  const baseScale = Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight);
  const scale = baseScale * zoom;
  const displayedWidth = imageWidth * scale;
  const displayedHeight = imageHeight * scale;
  const cropX = (displayedWidth - viewportWidth) / 2 - offsetX;
  const cropY = (displayedHeight - viewportHeight) / 2 - offsetY;
  return normalizeCoverCrop({
    x: cropX / scale / imageWidth,
    y: cropY / scale / imageHeight,
    width: viewportWidth / scale / imageWidth,
    height: viewportHeight / scale / imageHeight,
  });
}

export function cropToTransform(
  crop: CoverCrop,
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { zoom: number; offsetX: number; offsetY: number } {
  const normalized = normalizeCoverCrop(crop);
  if (imageWidth <= 0 || imageHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { zoom: 1, offsetX: 0, offsetY: 0 };
  }
  const cropPxW = normalized.width * imageWidth;
  const cropPxH = normalized.height * imageHeight;
  const zoomW = viewportWidth / (cropPxW * Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight));
  const zoomH = viewportHeight / (cropPxH * Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight));
  const zoom = Math.max(zoomW, zoomH, 1);
  const baseScale = Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight);
  const scale = baseScale * zoom;
  const displayedWidth = imageWidth * scale;
  const displayedHeight = imageHeight * scale;
  const cropX = normalized.x * imageWidth * scale;
  const cropY = normalized.y * imageHeight * scale;
  const offsetX = (displayedWidth - viewportWidth) / 2 - cropX;
  const offsetY = (displayedHeight - viewportHeight) / 2 - cropY;
  return { zoom, offsetX, offsetY };
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function clampRange(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}
