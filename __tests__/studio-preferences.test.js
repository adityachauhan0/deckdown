import {
  STUDIO_PREFERENCES_KEY,
  createStudioPreferencesStore,
  normalizeStudioPreferences
} from '../src/studio/preferences.js';

describe('studio preferences', () => {
  test('normalizes persisted values and ignores invalid entries', () => {
    expect(normalizeStudioPreferences({
      drawerOpen: false,
      drawerWidth: 310,
      editorWidth: 640,
      previewZoom: 1.2,
      docsPage: 'cli',
      view: 'docs'
    })).toEqual({
      drawerOpen: false,
      drawerWidth: 310,
      editorWidth: 640,
      previewZoom: 1.2,
      docsPage: 'cli',
      view: 'docs'
    });

    expect(normalizeStudioPreferences({
      drawerOpen: 'nope',
      drawerWidth: -10,
      editorWidth: Number.NaN,
      previewZoom: 9,
      docsPage: 42,
      view: 'workspace'
    })).toEqual({
      view: 'workspace'
    });
  });

  test('loads and saves preferences through the configured storage backend', () => {
    const storage = new Map();
    const store = createStudioPreferencesStore({
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, value);
      }
    });

    expect(store.load()).toEqual({});

    store.save({
      drawerOpen: true,
      drawerWidth: 280,
      previewZoom: 1.1
    });

    expect(JSON.parse(storage.get(STUDIO_PREFERENCES_KEY))).toEqual({
      drawerOpen: true,
      drawerWidth: 280,
      previewZoom: 1.1
    });
    expect(store.load()).toEqual({
      drawerOpen: true,
      drawerWidth: 280,
      previewZoom: 1.1
    });
  });
});
