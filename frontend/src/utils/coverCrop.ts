/** 小程序首页封面裁剪与展示 */

export interface CoverCrop {
  x: number
  y: number
  width: number
  height: number
}

export const DEFAULT_COVER_CROP: CoverCrop = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
}

export function normalizeCoverCrop(input?: Partial<CoverCrop> | null): CoverCrop {
  if (!input) {
    return { ...DEFAULT_COVER_CROP }
  }
  const width = Number(input.width ?? 1)
  const height = Number(input.height ?? 1)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { ...DEFAULT_COVER_CROP }
  }
  return {
    x: clamp01(Number(input.x ?? 0)),
    y: clamp01(Number(input.y ?? 0)),
    width: clampRange(width, 0.01, 1),
    height: clampRange(height, 0.01, 1),
  }
}

export function buildHeroCoverImageStyle(
  crop: CoverCrop,
  naturalWidth: number,
  naturalHeight: number,
  containerWidth: number,
  containerHeight: number,
) {
  const normalized = normalizeCoverCrop(crop)
  if (naturalWidth <= 0 || naturalHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return {}
  }
  const cropX = normalized.x * naturalWidth
  const cropY = normalized.y * naturalHeight
  const cropW = normalized.width * naturalWidth
  const cropH = normalized.height * naturalHeight
  const scale = Math.max(containerWidth / cropW, containerHeight / cropH)
  const displayW = naturalWidth * scale
  const displayH = naturalHeight * scale
  return {
    width: `${displayW}px`,
    height: `${displayH}px`,
    transform: `translate(${-cropX * scale}px, ${-cropY * scale}px)`,
  }
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function clampRange(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}
