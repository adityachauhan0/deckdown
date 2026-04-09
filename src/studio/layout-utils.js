export const DRAWER_MIN_WIDTH = 220;
export const DRAWER_MAX_WIDTH = 420;
export const DEFAULT_DRAWER_WIDTH = DRAWER_MIN_WIDTH;
export const EDITOR_MIN_WIDTH = 380;
export const PREVIEW_MIN_WIDTH = 460;
export const PREVIEW_BASE_WIDTH = 1114;
export const PREVIEW_MAX_WIDTH = 1180;
export const PREVIEW_MAX_HEIGHT = 700;
export const PREVIEW_MIN_SCALE_FACTOR = 0.78;

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

export function resolveDraggedWidth(startWidth, startX, currentX, clampWidth = value => value) {
  return clampWidth(Math.round(startWidth + (currentX - startX)));
}

export function clampDrawerWidth(width) {
  return clamp(Math.round(width), DRAWER_MIN_WIDTH, DRAWER_MAX_WIDTH);
}

export function clampEditorWidth(width, totalWidth) {
  const safeTotal = Math.max(EDITOR_MIN_WIDTH + PREVIEW_MIN_WIDTH, Math.round(totalWidth || 0));
  const maxWidth = Math.max(EDITOR_MIN_WIDTH, safeTotal - PREVIEW_MIN_WIDTH);
  return clamp(Math.round(width), EDITOR_MIN_WIDTH, maxWidth);
}

export function getPreferredPreviewStageWidth(page = {}) {
  const pageWidth = Math.max(1, Math.round(page?.width || 1920));
  return clamp(Math.round(pageWidth * 0.58), 900, PREVIEW_MAX_WIDTH);
}

export function computePreviewFrame(page, viewport, zoom = 1) {
  const pageWidth = Math.max(1, Math.round(page?.width || 1920));
  const pageHeight = Math.max(1, Math.round(page?.height || 1080));
  const availableWidth = Math.max(320, Math.round(viewport?.width || PREVIEW_BASE_WIDTH));
  const availableHeight = Math.max(240, Math.round(viewport?.height || PREVIEW_MAX_HEIGHT));
  const baseStageWidth = getPreferredPreviewStageWidth(page);
  const baseScale = Math.min(
    baseStageWidth / pageWidth,
    availableWidth / pageWidth,
    availableHeight / pageHeight
  );
  const minScale = Math.max(0.24, baseScale * PREVIEW_MIN_SCALE_FACTOR);
  const maxScale = Math.min(
    PREVIEW_MAX_WIDTH / pageWidth,
    availableWidth / pageWidth,
    Math.min(1, availableHeight / pageHeight),
    PREVIEW_MAX_HEIGHT / pageHeight
  );
  const scale = clamp(baseScale * zoom, minScale, maxScale);

  return {
    scale,
    width: Math.round(pageWidth * scale),
    height: Math.round(pageHeight * scale),
    stageWidth: baseStageWidth
  };
}
