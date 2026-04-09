import { resolveStudioShortcut } from '../src/studio/shortcuts.js';

describe('studio shortcuts', () => {
  test('maps editor and preview commands from keyboard events', () => {
    expect(resolveStudioShortcut({
      key: 's',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false
    }, { activeFile: 'deck.md', openFiles: ['deck.md'], slideCount: 2, activeSlideIndex: 0 })).toBe('save');

    expect(resolveStudioShortcut({
      key: 'Enter',
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      altKey: false
    }, { activeFile: 'deck.md', openFiles: ['deck.md'], slideCount: 2, activeSlideIndex: 0 })).toBe('refresh-preview');

    expect(resolveStudioShortcut({
      key: '\\',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false
    }, { activeFile: 'deck.md', openFiles: ['deck.md'], slideCount: 2, activeSlideIndex: 0 })).toBe('toggle-files');
  });

  test('only exposes slide and tab navigation when movement is possible', () => {
    expect(resolveStudioShortcut({
      key: 'PageDown',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: true
    }, { activeFile: 'deck.md', openFiles: ['deck.md'], slideCount: 3, activeSlideIndex: 0 })).toBe('next-slide');

    expect(resolveStudioShortcut({
      key: 'PageUp',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: true
    }, { activeFile: 'deck.md', openFiles: ['deck.md'], slideCount: 3, activeSlideIndex: 0 })).toBeNull();

    expect(resolveStudioShortcut({
      key: 'ArrowRight',
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
      altKey: true
    }, { activeFile: 'deck.md', openFiles: ['deck.md', 'notes.md'], slideCount: 3, activeSlideIndex: 0 })).toBe('next-tab');
  });
});
