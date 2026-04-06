import { deriveSlideLabels } from './slide-labels.js';

const state = {
  project: null,
  activeFile: null,
  editorDirty: false,
  saveTimer: null,
  previewTimer: null,
  previewZoom: 1,
  slideRanges: [],
  activeSlideIndex: 0,
  diagnostics: [],
  showDiagnostics: false,
  drawerOpen: false,
  lastPreview: null,
  exportTimer: null
};

const fileList = document.getElementById('file-list');
const projectRoot = document.getElementById('project-root');
const editorTitle = document.getElementById('editor-title');
const editor = document.getElementById('editor');
const slides = document.getElementById('slides');
const diagnostics = document.getElementById('diagnostics');
const diagnosticCount = document.getElementById('diagnostic-count');
const slideTabs = document.getElementById('slide-tabs');
const saveStatus = document.getElementById('save-status');
const saveButton = document.getElementById('save-button');
const refreshButton = document.getElementById('refresh-button');
const fileDrawer = document.getElementById('file-drawer');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const filesToggle = document.getElementById('files-toggle');
const filesClose = document.getElementById('files-close');
const diagnosticsToggle = document.getElementById('diagnostics-toggle');
const zoomIn = document.getElementById('zoom-in');
const zoomOut = document.getElementById('zoom-out');
const zoomReset = document.getElementById('zoom-reset');
const exportStatus = document.getElementById('export-status');
const slideContext = document.getElementById('slide-context');
const exportButtons = {
  pdf: document.getElementById('export-pdf'),
  png: document.getElementById('export-png'),
  pptx: document.getElementById('export-pptx')
};
const editorButtons = Array.from(document.querySelectorAll('[data-snippet], [data-wrap-prefix]'));
const insertSummary = document.querySelector('.insert-menu summary');

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  return payload;
}

function relativeProjectPath(filePath) {
  if (!filePath || !state.project?.rootDir) {
    return null;
  }

  if (!filePath.startsWith(state.project.rootDir)) {
    return null;
  }

  return filePath.slice(state.project.rootDir.length + 1);
}

function updateExportButtons() {
  const capabilities = state.project?.exportCapabilities || {};
  for (const [format, button] of Object.entries(exportButtons)) {
    const capability = capabilities[format] || { available: true };
    button.disabled = !capability.available || !state.activeFile;
    button.title = capability.available
      ? `Export ${format.toUpperCase()}`
      : capability.message || `${format.toUpperCase()} export unavailable`;
  }
}

function updateEditorAvailability() {
  const hasActiveFile = Boolean(state.activeFile);
  editor.disabled = !hasActiveFile;
  saveButton.disabled = !hasActiveFile;
  refreshButton.disabled = !hasActiveFile;
  filesToggle.disabled = false;

  for (const button of editorButtons) {
    button.disabled = !hasActiveFile;
  }

  if (insertSummary) {
    insertSummary.classList.toggle('is-disabled', !hasActiveFile);
  }

  slideContext.textContent = hasActiveFile ? slideContext.textContent : 'No slide';
}

function setDrawerOpen(nextValue) {
  state.drawerOpen = nextValue;
  fileDrawer.classList.toggle('open', nextValue);
  drawerBackdrop.classList.toggle('visible', nextValue);
}

function setExportStatus(message, subtle = false) {
  exportStatus.textContent = message;
  exportStatus.classList.toggle('subtle', subtle);
  if (state.exportTimer) {
    clearTimeout(state.exportTimer);
    state.exportTimer = null;
  }
}

function setDiagnostics(items, options = {}) {
  const nextDiagnostics = [...items].sort((left, right) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return (severityOrder[left.severity] ?? 3) - (severityOrder[right.severity] ?? 3);
  });

  const previousErrors = state.diagnostics.filter(diagnostic => diagnostic.severity === 'error').length;
  state.diagnostics = nextDiagnostics;

  const errorCount = nextDiagnostics.filter(diagnostic => diagnostic.severity === 'error').length;
  const warningCount = nextDiagnostics.filter(diagnostic => diagnostic.severity !== 'error').length;

  if (options.autoOpenOnError && errorCount > previousErrors) {
    state.showDiagnostics = true;
  }

  diagnosticsToggle.classList.toggle('has-issues', nextDiagnostics.length > 0);
  diagnosticCount.textContent = `${errorCount}/${warningCount}`;
  renderDiagnostics();
}

function renderFileList() {
  fileList.innerHTML = '';

  for (const file of state.project.files.filter(entry => entry.kind === 'editable')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'file-button';
    button.textContent = file.path;
    if (file.path === state.activeFile) {
      button.classList.add('active');
    }
    button.addEventListener('click', async () => {
      setDrawerOpen(false);
      await openFile(file.path);
    });
    fileList.appendChild(button);
  }
}

function renderWorkspaceEmptyState() {
  editorTitle.textContent = 'No deck yet';
  editor.value = '';
  slideTabs.innerHTML = '';
  slides.innerHTML = `
    <div class="empty-workspace">
      <div class="empty-workspace-eyebrow">Workspace Ready</div>
      <h2>Start with a local DeckDown workspace</h2>
      <p>Create a starter deck, notes folder, assets folder, and workspace metadata in this repo.</p>
      <button id="workspace-init-button" class="primary-button" type="button">Create starter workspace</button>
    </div>
  `;
  updateEditorAvailability();

  const initButton = document.getElementById('workspace-init-button');
  if (initButton) {
    initButton.addEventListener('click', () => {
      bootstrapWorkspace().catch(error => {
        console.error(error);
        setDiagnostics([{
          severity: 'error',
          source: 'workspace',
          message: error.message
        }], { autoOpenOnError: true });
      });
    });
  }
}

function createBlockNode(block) {
  const node = document.createElement('div');
  node.className = `slide-block ${block.type}`;
  node.style.left = `${block.x}px`;
  node.style.top = `${block.y}px`;
  node.style.width = `${block.width}px`;
  node.style.height = `${block.height}px`;
  if (block.fontSize) {
    node.style.fontSize = `${block.fontSize}px`;
  }
  node.style.color = block.color || 'inherit';
  node.style.fontFamily = block.fontFamily || 'inherit';
  node.style.textAlign = block.center ? 'center' : block.right ? 'right' : 'left';

  if (block.type === 'code') {
    node.style.background = block.backgroundColor || '#111827';
    const pre = document.createElement('pre');
    pre.textContent = block.content || '';
    node.appendChild(pre);
    return node;
  }

  if (block.type === 'image' && block.src) {
    const image = document.createElement('img');
    image.alt = block.alt || '';
    image.src = `/api/asset?path=${encodeURIComponent(block.src)}`;
    image.style.objectFit = block.cover ? 'cover' : 'contain';
    node.appendChild(image);
    return node;
  }

  node.textContent = block.text || '';
  return node;
}

function updateCanvasScale(surface, canvas, page) {
  const fitScale = surface.clientWidth / page.width;
  const scale = Math.max(0.45, Math.min(fitScale * state.previewZoom, 2.25));
  canvas.style.transform = `scale(${scale})`;
  surface.style.height = `${page.height * scale}px`;
}

function jumpToDiagnostic(diagnostic) {
  const projectPath = relativeProjectPath(diagnostic.filePath);

  if (projectPath && projectPath !== state.activeFile) {
    openFile(projectPath).then(() => {
      if (diagnostic.line) {
        const lineOffset = getOffsetForLine(editor.value, diagnostic.line);
        editor.focus();
        editor.setSelectionRange(lineOffset, lineOffset);
      }
    }).catch(error => {
      console.error(error);
    });
    return;
  }

  if (diagnostic.line) {
    const lineOffset = getOffsetForLine(editor.value, diagnostic.line);
    editor.focus();
    editor.setSelectionRange(lineOffset, lineOffset);
    const lineHeight = 28;
    editor.scrollTop = Math.max(0, (diagnostic.line - 3) * lineHeight);
  }
}

function renderDiagnostics() {
  diagnostics.innerHTML = '';
  diagnostics.classList.toggle('is-hidden', !state.showDiagnostics || state.diagnostics.length === 0);

  for (const diagnostic of state.diagnostics) {
    const item = document.createElement('div');
    item.className = `diagnostic ${diagnostic.severity || 'warning'}`;

    const copy = document.createElement('div');
    copy.className = 'diagnostic-copy';

    const meta = document.createElement('div');
    meta.className = 'diagnostic-meta';
    meta.textContent = [
      diagnostic.severity || 'warning',
      diagnostic.source || 'studio',
      diagnostic.line ? `line ${diagnostic.line}` : null
    ].filter(Boolean).join(' · ');

    const message = document.createElement('div');
    message.className = 'diagnostic-message';
    const projectPath = relativeProjectPath(diagnostic.filePath);
    const location = projectPath ? `${projectPath}: ` : '';
    message.textContent = `${location}${diagnostic.message}`;

    copy.append(meta, message);

    const actions = document.createElement('div');
    actions.className = 'diagnostic-actions';

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'diagnostic-action';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => {
      loadPreview().catch(error => {
        console.error(error);
      });
    });
    actions.appendChild(retry);

    if (projectPath || diagnostic.line) {
      const jump = document.createElement('button');
      jump.type = 'button';
      jump.className = 'diagnostic-action';
      jump.textContent = projectPath && projectPath !== state.activeFile ? 'Open file' : 'Jump';
      jump.addEventListener('click', () => jumpToDiagnostic(diagnostic));
      actions.appendChild(jump);
    }

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'diagnostic-action';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', () => {
      state.diagnostics = state.diagnostics.filter(itemDiagnostic => itemDiagnostic !== diagnostic);
      renderDiagnostics();
      const errorCount = state.diagnostics.filter(itemDiagnostic => itemDiagnostic.severity === 'error').length;
      const warningCount = state.diagnostics.length - errorCount;
      diagnosticCount.textContent = `${errorCount}/${warningCount}`;
      diagnosticsToggle.classList.toggle('has-issues', state.diagnostics.length > 0);
    });
    actions.appendChild(dismiss);

    item.append(copy, actions);
    diagnostics.appendChild(item);
  }
}

function getOffsetForLine(content, lineNumber) {
  if (!lineNumber || lineNumber <= 1) {
    return 0;
  }

  let offset = 0;
  let currentLine = 1;
  while (offset < content.length && currentLine < lineNumber) {
    if (content[offset] === '\n') {
      currentLine += 1;
    }
    offset += 1;
  }
  return offset;
}

function setActiveSlide(index, options = {}) {
  const safeIndex = Math.max(0, Math.min(index, Math.max(0, state.slideRanges.length - 1)));
  state.activeSlideIndex = safeIndex;
  const slideLabels = deriveSlideLabels(editor.value);
  slideContext.textContent = slideLabels[safeIndex]
    ? `Slide ${safeIndex + 1}: ${slideLabels[safeIndex]}`
    : `Slide ${safeIndex + 1}`;

  for (const card of slides.querySelectorAll('.slide-card')) {
    card.classList.toggle('active', Number(card.dataset.index) === safeIndex);
  }

  for (const tab of slideTabs.querySelectorAll('.slide-tab')) {
    tab.classList.toggle('active', Number(tab.dataset.index) === safeIndex);
  }

  const activeCard = slides.querySelector(`.slide-card[data-index="${safeIndex}"]`);
  if (activeCard && options.scrollPreview !== false) {
    activeCard.scrollIntoView({
      block: 'nearest',
      behavior: options.immediate ? 'auto' : 'smooth'
    });
  }

  if (options.scrollEditor && state.slideRanges[safeIndex]) {
    const range = state.slideRanges[safeIndex];
    editor.focus();
    editor.setSelectionRange(range.start, range.start);
    const before = editor.value.slice(0, range.start);
    const lineNumber = before.split('\n').length - 1;
    const lineHeight = 28;
    editor.scrollTop = Math.max(0, (lineNumber - 2) * lineHeight);
  }
}

function parseSlideRanges(content) {
  const ranges = [];
  const normalized = String(content || '').replace(/\r/g, '');
  let start = 0;

  const frontmatterMatch = normalized.match(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/);
  if (frontmatterMatch) {
    start = frontmatterMatch[0].length;
  }

  const slideBreakRegex = /^---\s*$/gm;
  slideBreakRegex.lastIndex = start;
  let match;
  while ((match = slideBreakRegex.exec(normalized)) !== null) {
    ranges.push({ start, end: match.index });
    start = slideBreakRegex.lastIndex;
  }

  if (normalized.length > start || ranges.length === 0) {
    ranges.push({ start, end: normalized.length });
  }

  return ranges.filter(range => normalized.slice(range.start, range.end).trim().length > 0);
}

function syncActiveSlideFromCursor() {
  const offset = editor.selectionStart;
  const nextIndex = state.slideRanges.findIndex(range => offset >= range.start && offset <= range.end);
  if (nextIndex >= 0 && nextIndex !== state.activeSlideIndex) {
    setActiveSlide(nextIndex);
  }
}

function renderSlideTabs() {
  const slideLabels = deriveSlideLabels(editor.value);
  slideTabs.innerHTML = '';
  state.slideRanges.forEach((_, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'slide-tab';
    tab.dataset.index = String(index);
    tab.textContent = slideLabels[index] || `${index + 1}`;
    tab.title = slideLabels[index]
      ? `Jump to slide ${index + 1}: ${slideLabels[index]}`
      : `Jump to slide ${index + 1}`;
    tab.addEventListener('click', () => setActiveSlide(index, { scrollEditor: true }));
    slideTabs.appendChild(tab);
  });

  setActiveSlide(Math.min(state.activeSlideIndex, Math.max(state.slideRanges.length - 1, 0)), {
    scrollPreview: false,
    immediate: true
  });
}

function renderPreview(preview, diagnosticItems = []) {
  setDiagnostics(diagnosticItems, { autoOpenOnError: true });

  if (preview) {
    state.lastPreview = preview;
  }

  slides.innerHTML = '';
  slides.classList.toggle('is-stale', !preview && Boolean(state.lastPreview));

  const presentation = preview || state.lastPreview;
  if (!presentation) {
    slides.innerHTML = '<div class="empty-state">Preview will appear here once the deck parses.</div>';
    return;
  }

  presentation.slides.forEach((slide, index) => {
    const card = document.createElement('section');
    card.className = 'slide-card';
    if (!preview) {
      card.classList.add('stale');
    }
    card.dataset.index = String(index);
    card.addEventListener('click', () => setActiveSlide(index, { scrollEditor: true }));

    const meta = document.createElement('div');
    meta.className = 'slide-meta';
    meta.textContent = `Slide ${index + 1}`;
    card.appendChild(meta);

    const surface = document.createElement('div');
    surface.className = 'slide-surface';
    surface.style.aspectRatio = `${slide.page.width} / ${slide.page.height}`;
    surface.style.background = slide.theme.colors.background;

    const canvas = document.createElement('div');
    canvas.className = 'slide-canvas';
    canvas.style.width = `${slide.page.width}px`;
    canvas.style.height = `${slide.page.height}px`;

    slide.blocks.forEach(block => {
      canvas.appendChild(createBlockNode(block));
    });

    surface.appendChild(canvas);
    requestAnimationFrame(() => updateCanvasScale(surface, canvas, slide.page));

    card.appendChild(surface);
    slides.appendChild(card);
  });

  setActiveSlide(Math.min(state.activeSlideIndex, Math.max(presentation.slides.length - 1, 0)), {
    scrollPreview: false,
    immediate: true
  });
}

function refreshSlideMetadata() {
  state.slideRanges = parseSlideRanges(editor.value);
  renderSlideTabs();
  syncActiveSlideFromCursor();
}

async function loadPreview() {
  if (!state.activeFile) {
    return;
  }

  const previewPayload = await fetchJson(`/api/preview?path=${encodeURIComponent(state.activeFile)}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      content: editor.value
    })
  });

  renderPreview(previewPayload.preview, previewPayload.diagnostics || []);
}

async function openFile(path) {
  if (state.editorDirty) {
    await saveActiveFile();
  }

  const payload = await fetchJson(`/api/file?path=${encodeURIComponent(path)}`);
  state.activeFile = payload.path;
  state.activeSlideIndex = 0;
  state.editorDirty = false;
  state.lastPreview = null;
  editorTitle.textContent = payload.path;
  editor.value = payload.content;
  editor.setSelectionRange(0, 0);
  saveStatus.textContent = 'Saved';
  setExportStatus('Ready', true);
  renderFileList();
  updateExportButtons();
  updateEditorAvailability();
  refreshSlideMetadata();
  await loadPreview();
}

async function saveActiveFile() {
  if (!state.activeFile) {
    return;
  }

  saveStatus.textContent = 'Saving…';
  await fetchJson('/api/file', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      path: state.activeFile,
      content: editor.value
    })
  });
  state.editorDirty = false;
  saveStatus.textContent = 'Saved';
  await loadPreview();
}

async function exportDeck(format) {
  if (!state.activeFile) {
    return;
  }

  for (const button of Object.values(exportButtons)) {
    button.disabled = true;
  }

  setExportStatus(`Exporting ${format.toUpperCase()}…`);

  try {
    const payload = await fetchJson('/api/export', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        path: state.activeFile,
        format,
        content: editor.value
      })
    });

    if (payload.diagnostics) {
      setDiagnostics(payload.diagnostics, { autoOpenOnError: true });
    }

    setExportStatus(`${format.toUpperCase()} saved`);
    state.exportTimer = setTimeout(() => {
      setExportStatus('Ready', true);
      state.exportTimer = null;
    }, 2400);
  } catch (error) {
    console.error(error);
    setExportStatus('Export failed');
    setDiagnostics([{
      severity: 'error',
      source: 'export',
      message: error.message
    }, ...state.diagnostics], { autoOpenOnError: true });
  } finally {
    updateExportButtons();
  }
}

async function bootstrapWorkspace() {
  const payload = await fetchJson('/api/workspace/init', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    }
  });

  state.project = {
    ...state.project,
    initialFile: payload.initialFile,
    files: payload.files
  };
  renderFileList();
  await openFile(payload.entryFile);
}

function scheduleAutosave() {
  state.editorDirty = true;
  saveStatus.textContent = 'Editing…';
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
  }
  state.saveTimer = setTimeout(() => {
    saveActiveFile().catch(error => {
      console.error(error);
      saveStatus.textContent = 'Save failed';
    });
  }, 700);
}

function schedulePreview() {
  if (state.previewTimer) {
    clearTimeout(state.previewTimer);
  }

  state.previewTimer = setTimeout(() => {
    loadPreview().catch(error => {
      console.error(error);
      setDiagnostics([{
        severity: 'error',
        source: 'studio',
        message: error.message
      }], { autoOpenOnError: true });
    });
  }, 180);
}

function insertSnippet(snippet) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const before = editor.value.slice(0, start);
  const after = editor.value.slice(end);
  editor.value = `${before}${snippet}${after}`;
  const cursor = start + snippet.length;
  editor.setSelectionRange(cursor, cursor);
  editor.focus();
  refreshSlideMetadata();
  scheduleAutosave();
  schedulePreview();
}

function wrapSelection(prefix, suffix, fallback = '') {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.slice(start, end) || fallback;
  const before = editor.value.slice(0, start);
  const after = editor.value.slice(end);
  const nextValue = `${before}${prefix}${selected}${suffix}${after}`;
  editor.value = nextValue;
  const selectionStart = start + prefix.length;
  const selectionEnd = selectionStart + selected.length;
  editor.focus();
  editor.setSelectionRange(selectionStart, selectionEnd);
  refreshSlideMetadata();
  scheduleAutosave();
  schedulePreview();
}

function setPreviewZoom(nextZoom) {
  state.previewZoom = Math.max(0.7, Math.min(nextZoom, 1.6));
  slides.querySelectorAll('.slide-surface').forEach(surface => {
    const canvas = surface.querySelector('.slide-canvas');
    if (!canvas) {
      return;
    }
    const page = {
      width: Number.parseFloat(canvas.style.width) || 1920,
      height: Number.parseFloat(canvas.style.height) || 1080
    };
    updateCanvasScale(surface, canvas, page);
  });
}

async function bootstrap() {
  state.project = await fetchJson('/api/project');
  projectRoot.textContent = state.project.rootDir;
  renderFileList();
  updateExportButtons();
  updateEditorAvailability();

  if (state.project.initialFile) {
    await openFile(state.project.initialFile);
    return;
  }

  renderWorkspaceEmptyState();
}

document.querySelectorAll('[data-snippet]').forEach(button => {
  button.addEventListener('click', () => {
    if (!state.activeFile) {
      return;
    }
    insertSnippet(button.dataset.snippet || '');
    if (button.closest('.insert-menu')) {
      button.closest('.insert-menu').removeAttribute('open');
    }
  });
});

document.querySelectorAll('[data-wrap-prefix]').forEach(button => {
  button.addEventListener('click', () => {
    if (!state.activeFile) {
      return;
    }
    wrapSelection(
      button.dataset.wrapPrefix || '',
      button.dataset.wrapSuffix || '',
      button.dataset.wrapFallback || ''
    );
  });
});

editor.addEventListener('input', () => {
  refreshSlideMetadata();
  scheduleAutosave();
  schedulePreview();
});

editor.addEventListener('click', syncActiveSlideFromCursor);
editor.addEventListener('keyup', syncActiveSlideFromCursor);

editor.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveActiveFile().catch(error => {
      console.error(error);
      saveStatus.textContent = 'Save failed';
    });
  }
});

saveButton.addEventListener('click', () => {
  saveActiveFile().catch(error => {
    console.error(error);
    saveStatus.textContent = 'Save failed';
  });
});

refreshButton.addEventListener('click', () => {
  loadPreview().catch(error => {
    console.error(error);
  });
});

filesToggle.addEventListener('click', () => setDrawerOpen(!state.drawerOpen));
filesClose.addEventListener('click', () => setDrawerOpen(false));
drawerBackdrop.addEventListener('click', () => setDrawerOpen(false));

function toggleDiagnostics() {
  state.showDiagnostics = !state.showDiagnostics;
  renderDiagnostics();
}

diagnosticsToggle.addEventListener('click', toggleDiagnostics);

zoomIn.addEventListener('click', () => setPreviewZoom(state.previewZoom + 0.1));
zoomOut.addEventListener('click', () => setPreviewZoom(state.previewZoom - 0.1));
zoomReset.addEventListener('click', () => setPreviewZoom(1));
window.addEventListener('resize', () => setPreviewZoom(state.previewZoom));

exportButtons.pdf.addEventListener('click', () => exportDeck('pdf'));
exportButtons.png.addEventListener('click', () => exportDeck('png'));
exportButtons.pptx.addEventListener('click', () => exportDeck('pptx'));

bootstrap().catch(error => {
  setDiagnostics([{
    severity: 'error',
    source: 'studio',
    message: error.message
  }], { autoOpenOnError: true });
});
