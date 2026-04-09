import {
  DRAWER_MAX_WIDTH,
  clampDrawerWidth,
  clampEditorWidth,
  computePreviewFrame,
  getPreferredPreviewStageWidth
} from '../src/studio/layout-utils.js';

describe('studio layout sizing', () => {
  test('keeps a fixed readable preview stage for widescreen slides', () => {
    expect(getPreferredPreviewStageWidth({ width: 1920, height: 1080 })).toBe(1114);
    expect(getPreferredPreviewStageWidth({ width: 1056, height: 816 })).toBe(900);
  });

  test('clamps the drawer width inside the supported bounds', () => {
    expect(clampDrawerWidth(260)).toBe(260);
    expect(clampDrawerWidth(500)).toBe(DRAWER_MAX_WIDTH);
  });

  test('clamps editor width so preview never disappears', () => {
    expect(clampEditorWidth(640, 1400)).toBe(640);
    expect(clampEditorWidth(900, 1180)).toBe(720);
  });

  test('fits the preview frame inside constrained pane space', () => {
    const frame = computePreviewFrame({ width: 1920, height: 1080 }, { width: 520, height: 700 }, 1);
    expect(frame.width).toBe(520);
    expect(frame.height).toBe(293);
    expect(frame.scale).toBeCloseTo(520 / 1920, 5);
  });
});
