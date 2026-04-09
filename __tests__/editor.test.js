import { shouldNotifySelectionChange } from '../src/studio/editor.js';

describe('studio editor selection sync', () => {
  test('does not notify slide sync when typing changes the selection', () => {
    expect(shouldNotifySelectionChange({ selectionSet: true, docChanged: true })).toBe(false);
    expect(shouldNotifySelectionChange({ selectionSet: true, docChanged: false })).toBe(true);
    expect(shouldNotifySelectionChange({ selectionSet: false, docChanged: false })).toBe(false);
  });
});
