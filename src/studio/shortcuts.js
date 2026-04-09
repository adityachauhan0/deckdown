function normalizeKey(key) {
  return String(key || '').toLowerCase();
}

function getActiveFileIndex(state) {
  if (!state || !Array.isArray(state.openFiles) || !state.activeFile) {
    return -1;
  }

  return state.openFiles.indexOf(state.activeFile);
}

function canMoveToNextSlide(state) {
  const slideCount = Number(state?.slideCount || 0);
  const activeSlideIndex = Number(state?.activeSlideIndex || 0);
  return slideCount > 1 && activeSlideIndex < slideCount - 1;
}

function canMoveToPreviousSlide(state) {
  const slideCount = Number(state?.slideCount || 0);
  const activeSlideIndex = Number(state?.activeSlideIndex || 0);
  return slideCount > 1 && activeSlideIndex > 0;
}

function canMoveToNextTab(state) {
  const index = getActiveFileIndex(state);
  return index >= 0 && index < state.openFiles.length - 1;
}

function canMoveToPreviousTab(state) {
  const index = getActiveFileIndex(state);
  return index > 0;
}

export function resolveStudioShortcut(event, state = {}) {
  const key = normalizeKey(event?.key);
  const ctrlOrMeta = Boolean(event?.ctrlKey || event?.metaKey);
  const shift = Boolean(event?.shiftKey);
  const alt = Boolean(event?.altKey);

  if (ctrlOrMeta && !alt) {
    if (key === 's' && !shift) {
      return 'save';
    }

    if (key === 'enter' && shift) {
      return 'refresh-preview';
    }

    if (key === '\\' && !shift) {
      return 'toggle-files';
    }
  }

  if (!ctrlOrMeta && alt) {
    if (key === 'pagedown' && !shift && canMoveToNextSlide(state)) {
      return 'next-slide';
    }

    if (key === 'pageup' && !shift && canMoveToPreviousSlide(state)) {
      return 'prev-slide';
    }

    if (shift && key === 'arrowright' && canMoveToNextTab(state)) {
      return 'next-tab';
    }

    if (shift && key === 'arrowleft' && canMoveToPreviousTab(state)) {
      return 'prev-tab';
    }
  }

  return null;
}
