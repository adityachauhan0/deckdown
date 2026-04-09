export const DESKTOP_BREAKPOINT = 1180;
export const OUTER_RESIZER_WIDTH = 10;
export const INNER_RESIZER_WIDTH = 10;
export const MIN_DRAWER_WIDTH = 220;
export const MAX_DRAWER_WIDTH = 420;
export const DEFAULT_DRAWER_WIDTH = 260;
export const MIN_EDITOR_WIDTH = 380;
export const MIN_PREVIEW_WIDTH = 460;
export const MAX_PREVIEW_WIDTH = 920;
export const DEFAULT_PREVIEW_WIDTH = 720;

function clamp(value, min, max) {
  if (max < min) {
    return max;
  }

  return Math.min(Math.max(value, min), max);
}

export function clampDrawerWidth(width, options = {}) {
  const containerWidth = Number(options.containerWidth) || 0;
  const maxWidth = Math.min(
    MAX_DRAWER_WIDTH,
    containerWidth - OUTER_RESIZER_WIDTH - INNER_RESIZER_WIDTH - MIN_EDITOR_WIDTH - MIN_PREVIEW_WIDTH
  );

  return clamp(width, MIN_DRAWER_WIDTH, maxWidth);
}

export function clampPreviewWidth(width, options = {}) {
  const containerWidth = Number(options.containerWidth) || 0;
  const drawerWidth = options.drawerOpen === false ? 0 : Number(options.drawerWidth) || DEFAULT_DRAWER_WIDTH;
  const drawerSpace = options.drawerOpen === false ? 0 : drawerWidth + OUTER_RESIZER_WIDTH;
  const maxWidth = Math.min(
    MAX_PREVIEW_WIDTH,
    containerWidth - drawerSpace - INNER_RESIZER_WIDTH - MIN_EDITOR_WIDTH
  );

  return clamp(width, MIN_PREVIEW_WIDTH, maxWidth);
}

export function getPreferredPreviewStageWidth(page = {}) {
  const pageWidth = Number(page.width) || 0;
  return Math.round(Math.min(1180, Math.max(900, pageWidth * 0.58)));
}
