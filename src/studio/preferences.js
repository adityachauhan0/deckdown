export const STUDIO_PREFERENCES_KEY = 'deckdown:studio-preferences';

const VIEW_VALUES = new Set(['workspace', 'docs']);

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value) {
  return isFiniteNumber(value) && value > 0;
}

function getDefaultStorage() {
  try {
    const storage = globalThis?.localStorage;
    return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
      ? storage
      : null;
  } catch {
    return null;
  }
}

export function normalizeStudioPreferences(input = {}) {
  const normalized = {};

  if (typeof input.drawerOpen === 'boolean') {
    normalized.drawerOpen = input.drawerOpen;
  }

  if (isPositiveNumber(input.drawerWidth)) {
    normalized.drawerWidth = input.drawerWidth;
  }

  if (isPositiveNumber(input.editorWidth)) {
    normalized.editorWidth = input.editorWidth;
  }

  if (isFiniteNumber(input.previewZoom) && input.previewZoom >= 0.75 && input.previewZoom <= 1.4) {
    normalized.previewZoom = input.previewZoom;
  }

  if (typeof input.docsPage === 'string' && input.docsPage.trim()) {
    normalized.docsPage = input.docsPage;
  }

  if (VIEW_VALUES.has(input.view)) {
    normalized.view = input.view;
  }

  return normalized;
}

export function createStudioPreferencesStore(storage = getDefaultStorage()) {
  const backend = storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
    ? storage
    : null;

  return {
    load() {
      if (!backend) {
        return {};
      }

      try {
        const raw = backend.getItem(STUDIO_PREFERENCES_KEY);
        if (!raw) {
          return {};
        }

        return normalizeStudioPreferences(JSON.parse(raw));
      } catch {
        return {};
      }
    },

    save(preferences = {}) {
      if (!backend) {
        return;
      }

      const normalized = normalizeStudioPreferences(preferences);
      backend.setItem(STUDIO_PREFERENCES_KEY, JSON.stringify(normalized));
    }
  };
}
