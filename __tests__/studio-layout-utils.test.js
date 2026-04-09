import {
  DEFAULT_DRAWER_WIDTH,
  EDITOR_MIN_WIDTH,
  PREVIEW_MAX_HEIGHT,
  PREVIEW_MAX_WIDTH,
  PREVIEW_MIN_WIDTH,
  resolveDraggedWidth,
  clampDrawerWidth,
  clampEditorWidth,
  computePreviewFrame,
  getPreferredPreviewStageWidth
} from '../src/studio/layout-utils.js';

describe('Studio layout utils', () => {
  test('caps drawer width within desktop bounds', () => {
    expect(DEFAULT_DRAWER_WIDTH).toBe(220);
    expect(clampDrawerWidth(120)).toBe(220);
    expect(clampDrawerWidth(320)).toBe(320);
    expect(clampDrawerWidth(520)).toBe(420);
  });

  test('resolves drag widths from the original pointer position instead of compounding deltas', () => {
    expect(resolveDraggedWidth(220, 100, 120, clampDrawerWidth)).toBe(240);
    expect(resolveDraggedWidth(220, 100, 140, clampDrawerWidth)).toBe(260);
  });

  test('keeps editor width within the workspace split bounds', () => {
    expect(clampEditorWidth(240, 1200)).toBe(EDITOR_MIN_WIDTH);
    expect(clampEditorWidth(720, 1200)).toBe(720);
    expect(clampEditorWidth(980, 1200)).toBe(1200 - PREVIEW_MIN_WIDTH);
  });

  test('computes a fixed preview frame with reasonable caps', () => {
    const widescreen = computePreviewFrame(
      { width: 1920, height: 1080 },
      { width: 1400, height: 900 },
      1
    );
    expect(widescreen.width).toBe(getPreferredPreviewStageWidth({ width: 1920, height: 1080 }));
    expect(widescreen.height).toBe(Math.round((1080 / 1920) * widescreen.width));

    const zoomed = computePreviewFrame(
      { width: 1920, height: 1080 },
      { width: 1400, height: 900 },
      1.5
    );
    expect(zoomed.width).toBeLessThanOrEqual(PREVIEW_MAX_WIDTH);
    expect(zoomed.height).toBeLessThanOrEqual(PREVIEW_MAX_HEIGHT);

    const compact = computePreviewFrame(
      { width: 1920, height: 1080 },
      { width: 760, height: 460 },
      1
    );
    expect(compact.width).toBeLessThanOrEqual(760);
    expect(compact.height).toBeLessThanOrEqual(460);
  });
});
