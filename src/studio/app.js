import { deriveSlideLabels } from './slide-labels.js';
import {
  DEFAULT_DRAWER_WIDTH,
  clampDrawerWidth,
  clampEditorWidth,
  computePreviewFrame,
  resolveDraggedWidth
} from '/layout-utils.js';
import { createStudioEditor } from '/studio-editor.js';
import { deriveSlideOutline } from '/slide-outline.js';
import { deriveSlideRanges } from '/slide-segmentation.js';
import { createStudioPreferencesStore } from '/studio-preferences.js';
import { resolveStudioShortcut } from '/studio-shortcuts.js';
import {
  isDocumentPreviewPath,
  renderDocumentMarkdown,
  resolveDocumentAssetPath
} from '/document-preview.js';

const state = {
  project: null,
  activeFile: null,
  openFiles: [],
  view: 'workspace',
  docsPage: 'index',
  docsPages: [],
  docsContent: '',
  docsTitle: 'Docs',
  docsLoading: false,
  docsError: null,
  editorDirty: false,
  saveTimer: null,
  previewTimer: null,
  previewZoom: 1,
  previewScrollTop: 0,
  slideRanges: [],
  activeSlideIndex: 0,
  diagnostics: [],
  showDiagnostics: false,
  drawerOpen: window.innerWidth > 1180,
  lastPreview: null,
  exportTimer: null,
  drawerWidth: DEFAULT_DRAWER_WIDTH,
  editorWidth: null,
  bootstrapTemplateId: 'presentation-16x9',
  bootstrapCustomPage: {
    width: 1600,
    height: 900,
    margin: 72
  },
  assetPreview: null,
  fileSessions: new Map(),
  dirtyFiles: new Set()
};

const fileList = document.getElementById('file-list');
const outlineList = document.getElementById('outline-list');
const docsNavList = document.getElementById('docs-nav-list');
const docsContent = document.getElementById('docs-content');
const docsTitle = document.getElementById('docs-title');
const docsRoute = document.getElementById('docs-route');
const projectRoot = document.getElementById('project-root');
const editorTitle = document.getElementById('editor-title');
const editorHost = document.getElementById('editor');
const slides = document.getElementById('slides');
const diagnostics = document.getElementById('diagnostics');
const diagnosticCount = document.getElementById('diagnostic-count');
const fileTabs = document.getElementById('file-tabs');
const assetPreview = document.getElementById('asset-preview');
const assetPreviewMeta = document.getElementById('asset-preview-meta');
const assetPreviewSurface = document.getElementById('asset-preview-surface');
const saveStatus = document.getElementById('save-status');
const saveButton = document.getElementById('save-button');
const refreshButton = document.getElementById('refresh-button');
const fileDrawer = document.getElementById('file-drawer');
const drawerBackdrop = document.getElementById('drawer-backdrop');
const filesToggle = document.getElementById('files-toggle');
const drawerResizer = document.getElementById('drawer-resizer');
const docsToggle = document.getElementById('docs-toggle');
const filesClose = document.getElementById('files-close');
const diagnosticsToggle = document.getElementById('diagnostics-toggle');
const zoomIn = document.getElementById('zoom-in');
const zoomOut = document.getElementById('zoom-out');
const zoomReset = document.getElementById('zoom-reset');
const exportStatus = document.getElementById('export-status');
const exportNotification = document.getElementById('export-notification');
const slideContext = document.getElementById('slide-context');
const studioLayout = document.getElementById('studio-layout');
const workspaceView = document.getElementById('workspace-view');
const docsView = document.getElementById('docs-view');
const previewPane = document.querySelector('.preview-pane');
const previewResizer = document.getElementById('preview-resizer');
const exportButtons = {
  pdf: document.getElementById('export-pdf'),
  png: document.getElementById('export-png'),
  pptx: document.getElementById('export-pptx')
};
const editorButtons = Array.from(document.querySelectorAll('[data-snippet], [data-wrap-prefix]'));
const insertSummary = document.querySelector('.insert-menu summary');
const preferencesStore = createStudioPreferencesStore(window.localStorage);

const editor = createStudioEditor({
  parent: editorHost,
  placeholderText: '# Start here\n\nWrite markdown on the left. Use the toolbar for syntax hints and DeckDown inserts.\n\n---\n\nAdd a slide break when you want the next slide.',
  onChange() {
    refreshSlideMetadata();
    scheduleAutosave();
    schedulePreview();
  },
  onSelectionChange(offset) {
    syncActiveSlideFromCursor(offset);
    persistActiveFileSession();
  },
  onDiagnosticsChange(items) {
    setDiagnostics(items, { autoOpenOnError: true });
  },
  onSave() {
    saveActiveFile().catch(error => {
      console.error(error);
      saveStatus.textContent = 'Save failed';
    });
  }
});

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  return payload;
}

function isMarkdownDeckPath(filePath) {
  return /\.(md|markdown)$/i.test(filePath || '');
}

function isPreviewableFilePath(filePath) {
  return isMarkdownDeckPath(filePath) || isDocumentPreviewPath(filePath);
}

function isImageAssetPath(filePath) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(filePath || '');
}

function getActiveWorkspacePath() {
  return state.assetPreview?.path || state.activeFile;
}

function persistPreferences() {
  preferencesStore.save({
    drawerOpen: state.drawerOpen,
    drawerWidth: state.drawerWidth,
    editorWidth: state.editorWidth,
    previewZoom: state.previewZoom,
    docsPage: state.docsPage,
    view: state.view
  });
}

function applyPersistedPreferences() {
  const persisted = preferencesStore.load();
  if (typeof persisted.drawerOpen === 'boolean') {
    state.drawerOpen = persisted.drawerOpen;
  }
  if (typeof persisted.drawerWidth === 'number') {
    state.drawerWidth = persisted.drawerWidth;
  }
  if (typeof persisted.editorWidth === 'number') {
    state.editorWidth = persisted.editorWidth;
  }
  if (typeof persisted.previewZoom === 'number') {
    state.previewZoom = persisted.previewZoom;
  }
  if (typeof persisted.docsPage === 'string' && persisted.docsPage) {
    state.docsPage = persisted.docsPage;
  }
  if (persisted.view === 'docs' || persisted.view === 'workspace') {
    state.view = persisted.view;
  }
}

function hideAssetPreview() {
  const hadAssetPreview = Boolean(state.assetPreview);
  state.assetPreview = null;
  assetPreview.classList.add('is-hidden');
  assetPreviewMeta.textContent = '';
  assetPreviewSurface.innerHTML = '';
  slides.classList.remove('is-hidden');
  if (hadAssetPreview) {
    renderFileList();
  }
}

function renderPreviewPlaceholder(message) {
  hideAssetPreview();
  state.lastPreview = null;
  state.previewScrollTop = 0;
  slides.classList.remove('is-stale');
  slides.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function renderAssetPreview(path) {
  state.assetPreview = { path };
  slides.classList.add('is-hidden');
  assetPreview.classList.remove('is-hidden');
  assetPreviewMeta.textContent = path;
  assetPreviewSurface.innerHTML = '';
  slideContext.textContent = 'Asset preview';

  const assetUrl = `/api/asset?path=${encodeURIComponent(path)}`;
  const fileName = path.split('/').pop() || path;

  if (isImageAssetPath(path)) {
    const image = document.createElement('img');
    image.className = 'asset-preview-image';
    image.alt = fileName;
    image.src = assetUrl;
    assetPreviewSurface.appendChild(image);
    return;
  }

  const link = document.createElement('a');
  link.href = assetUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = `Open ${fileName}`;
  assetPreviewSurface.appendChild(link);
}

function renderDocumentPreview(path, content) {
  hideAssetPreview();
  state.lastPreview = null;
  const preservedScrollTop = state.previewScrollTop;
  slides.classList.remove('is-stale');
  slides.innerHTML = '';
  slides.appendChild(renderDocumentMarkdown(content, {
    document,
    filePath: path
  }));
  slideContext.textContent = 'Document preview';
  requestAnimationFrame(() => {
    slides.scrollTop = Math.max(0, Math.min(preservedScrollTop, slides.scrollHeight - slides.clientHeight));
  });
}

function persistActiveFileSession() {
  if (!state.activeFile) {
    return;
  }

  state.fileSessions.set(state.activeFile, {
    selection: editor.getSelection(),
    activeSlideIndex: state.activeSlideIndex,
    previewScrollTop: state.previewScrollTop
  });
}

function restoreFileSession(path) {
  const session = state.fileSessions.get(path);
  state.activeSlideIndex = Math.max(0, Number(session?.activeSlideIndex || 0));
  state.previewScrollTop = Math.max(0, Number(session?.previewScrollTop || 0));

  if (session?.selection) {
    editor.setSelection(session.selection.from, session.selection.to);
    editor.scrollToOffset(session.selection.from);
  }
}

function withSaveFailureHandling(task) {
  task().catch(error => {
    console.error(error);
    saveStatus.textContent = 'Save failed';
  });
}

function cycleFileTab(delta) {
  if (!state.activeFile || state.openFiles.length < 2) {
    return;
  }

  const currentIndex = state.openFiles.indexOf(state.activeFile);
  if (currentIndex === -1) {
    return;
  }

  const nextIndex = currentIndex + delta;
  if (nextIndex < 0 || nextIndex >= state.openFiles.length) {
    return;
  }

  switchToFileTab(state.openFiles[nextIndex]);
}

function isTypingTarget(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'));
}

function getShortcutContext() {
  return {
    activeFile: state.activeFile,
    openFiles: state.openFiles,
    slideCount: state.slideRanges.length,
    activeSlideIndex: state.activeSlideIndex
  };
}

function runShortcutAction(action) {
  switch (action) {
    case 'save':
      withSaveFailureHandling(() => saveActiveFile());
      break;
    case 'refresh-preview':
      loadPreview().catch(error => {
        console.error(error);
      });
      break;
    case 'toggle-files':
      setDrawerOpen(!state.drawerOpen);
      break;
    case 'next-slide':
      setActiveSlide(state.activeSlideIndex + 1, { scrollEditor: true });
      break;
    case 'prev-slide':
      setActiveSlide(state.activeSlideIndex - 1, { scrollEditor: true });
      break;
    case 'next-tab':
      cycleFileTab(1);
      break;
    case 'prev-tab':
      cycleFileTab(-1);
      break;
    default:
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderInlineMarkdown(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function docsRouteForPage(page) {
  return `/docs/${page || 'index'}`;
}

function getDocsSourcePath(page = state.docsPage) {
  const slug = page || 'index';
  return slug === 'index' ? 'docs/index.md' : `docs/${slug}.md`;
}

function resolveWorkspaceDocumentLink(fromPath, href) {
  const rawHref = String(href || '').trim();
  if (!rawHref || /^(https?:|mailto:|#|data:|blob:)/i.test(rawHref)) {
    return null;
  }

  const strippedHref = rawHref.split(/[?#]/)[0];
  return resolveDocumentAssetPath(fromPath, strippedHref);
}

function getPageSlugFromLocation() {
  const { pathname, searchParams } = new URL(window.location.href);
  if (pathname.startsWith('/docs')) {
    return pathname.split('/')[2] || searchParams.get('page') || 'index';
  }

  return searchParams.get('page') || 'index';
}

function syncViewRoute(view, page = state.docsPage, options = {}) {
  if (options.skipHistory) {
    return;
  }

  const nextUrl = view === 'docs' ? docsRouteForPage(page) : '/';
  if (options.replace) {
    history.replaceState({}, '', nextUrl);
  } else {
    history.pushState({}, '', nextUrl);
  }
}

function getEditorValue() {
  return editor.getValue();
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

function getDesktopWorkspaceWidth() {
  if (window.innerWidth <= 1180) {
    return 0;
  }

  const drawerWidth = state.drawerOpen ? clampDrawerWidth(state.drawerWidth) : 0;
  const layoutWidth = studioLayout.clientWidth || window.innerWidth;
  const resizerAllowance = state.drawerOpen ? 20 : 10;
  return Math.max(840, layoutWidth - drawerWidth - resizerAllowance);
}

function applyDesktopLayout() {
  if (window.innerWidth <= 1180) {
    studioLayout.style.removeProperty('--drawer-width');
    workspaceView.style.removeProperty('--editor-width');
    return;
  }

  const drawerWidth = state.drawerOpen ? clampDrawerWidth(state.drawerWidth) : 0;
  state.drawerWidth = drawerWidth || state.drawerWidth;
  studioLayout.style.setProperty('--drawer-width', `${drawerWidth}px`);

  const totalWorkspaceWidth = getDesktopWorkspaceWidth();
  const fallbackEditorWidth = Math.round(totalWorkspaceWidth * 0.44);
  state.editorWidth = clampEditorWidth(state.editorWidth ?? fallbackEditorWidth, totalWorkspaceWidth);
  workspaceView.style.setProperty('--editor-width', `${state.editorWidth}px`);
}

function bindHorizontalResize(handle, onDelta) {
  handle.addEventListener('pointerdown', event => {
    if (window.innerWidth <= 1180) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startValue = onDelta.startValue();
    document.body.classList.add('is-resizing');

    const move = moveEvent => {
      onDelta.update(resolveDraggedWidth(startValue, startX, moveEvent.clientX, onDelta.clamp));
      applyDesktopLayout();
      setPreviewZoom(state.previewZoom);
    };

    const stop = () => {
      document.body.classList.remove('is-resizing');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  });
}

function toggleTreeNodeExpansion(nodeElement) {
  nodeElement.classList.toggle('collapsed');
  const button = nodeElement.querySelector(':scope > .tree-row > .tree-toggle');
  if (button) {
    button.textContent = nodeElement.classList.contains('collapsed') ? '▸' : '▾';
  }
}

function renderFileTreeNode(node, depth = 0) {
  const container = document.createElement('div');
  container.className = `tree-node ${node.kind}${node.path === getActiveWorkspacePath() ? ' active' : ''}`;
  if (node.expanded === false) {
    container.classList.add('collapsed');
  }
  container.dataset.path = node.path || '';
  container.style.marginLeft = depth > 0 ? '0' : '';

  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'tree-row';
  row.style.paddingLeft = `${10 + depth * 16}px`;

  const toggle = document.createElement('span');
  toggle.className = 'tree-toggle';
  toggle.textContent = node.kind === 'directory' ? (node.expanded === false ? '▸' : '▾') : '•';
  row.appendChild(toggle);

  const icon = document.createElement('span');
  icon.className = 'tree-icon';
  icon.textContent = node.kind === 'directory' ? '▸' : node.fileKind === 'asset' ? '◌' : '◦';
  row.appendChild(icon);

  const label = document.createElement('span');
  label.className = 'tree-label';
  label.textContent = node.name;
  row.appendChild(label);

  if (node.kind === 'directory') {
    row.addEventListener('click', event => {
      event.stopPropagation();
      toggleTreeNodeExpansion(container);
    });
  } else {
    row.addEventListener('click', async event => {
      event.stopPropagation();
      if (window.innerWidth <= 1180) {
        setDrawerOpen(false);
      }
      if (node.fileKind === 'asset') {
        renderAssetPreview(node.path);
        renderFileList();
        return;
      }
      await openFile(node.path);
    });
  }

  container.appendChild(row);

  if (node.kind === 'directory' && Array.isArray(node.children) && node.children.length > 0) {
    const children = document.createElement('div');
    children.className = 'tree-children';
    for (const child of node.children) {
      children.appendChild(renderFileTreeNode(child, depth + 1));
    }
    container.appendChild(children);
  }

  return container;
}

function renderFileTree() {
  fileList.innerHTML = '';

  const tree = state.project?.tree;
  if (!tree?.children?.length) {
    fileList.innerHTML = '<div class="outline-empty">No workspace files to show yet.</div>';
    return;
  }

  tree.children.forEach(child => {
    fileList.appendChild(renderFileTreeNode(child));
  });
}

function getDocsNavButtonClass(slug) {
  return slug === state.docsPage ? 'docs-nav-button active' : 'docs-nav-button';
}

function renderDocsNav() {
  docsNavList.innerHTML = '';

  for (const page of state.docsPages) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = getDocsNavButtonClass(page.slug);
    button.textContent = page.title;
    button.addEventListener('click', () => {
      openDocsPage(page.slug).catch(error => {
        console.error(error);
        state.docsError = error.message;
        renderDocsContent();
      });
    });
    docsNavList.appendChild(button);
  }
}

function renderDocsContent() {
  docsContent.innerHTML = '';

  if (state.docsLoading) {
    docsContent.innerHTML = '<div class="empty-state">Loading docs…</div>';
    return;
  }

  if (state.docsError) {
    docsContent.innerHTML = `<div class="empty-state">${escapeHtml(state.docsError)}</div>`;
    return;
  }

  if (!state.docsContent) {
    docsContent.innerHTML = '<div class="empty-state">Select a local docs page to view it here.</div>';
    return;
  }

  docsContent.appendChild(renderDocumentMarkdown(state.docsContent, {
    document,
    filePath: getDocsSourcePath()
  }));
}

docsContent.addEventListener('click', event => {
  const anchor = event.target.closest('a');
  if (!anchor) {
    return;
  }

  const href = anchor.getAttribute('href') || '';
  if (/^(https?:|mailto:|#)/.test(href)) {
    return;
  }

  const normalized = href.replace(/^\.\/?/, '').replace(/^\.\.\//, '').split(/[?#]/)[0];
  const slug = normalized.replace(/^docs\//, '').replace(/\.md$/i, '');
  const knownPage = state.docsPages.find(page => page.slug === slug) || null;
  if (!knownPage) {
    return;
  }

  event.preventDefault();
  openDocsPage(knownPage.slug).catch(error => {
    console.error(error);
    state.docsError = error.message;
    state.docsLoading = false;
    renderDocsContent();
  });
});

slides.addEventListener('click', event => {
  const anchor = event.target.closest('a');
  if (!anchor || !isDocumentPreviewPath(state.activeFile)) {
    return;
  }

  const resolvedPath = resolveWorkspaceDocumentLink(state.activeFile, anchor.getAttribute('href'));
  if (!resolvedPath) {
    return;
  }

  if (/^docs\/.+\.(md|markdown)$/i.test(resolvedPath)) {
    event.preventDefault();
    const slug = resolvedPath.replace(/^docs\//i, '').replace(/\.(md|markdown)$/i, '');
    openDocsPage(slug).catch(error => {
      console.error(error);
      setDiagnostics([{
        severity: 'error',
        source: 'studio',
        message: error.message
      }], { autoOpenOnError: true });
    });
    return;
  }

  if (/\.(md|markdown|ya?ml|json)$/i.test(resolvedPath)) {
    event.preventDefault();
    openFile(resolvedPath).catch(error => {
      console.error(error);
      setDiagnostics([{
        severity: 'error',
        source: 'studio',
        message: error.message
      }], { autoOpenOnError: true });
    });
  }
});

function updateExportButtons() {
  const capabilities = state.project?.exportCapabilities || {};
  const canExportActiveFile = Boolean(state.activeFile) && isMarkdownDeckPath(state.activeFile);
  for (const [format, button] of Object.entries(exportButtons)) {
    const capability = capabilities[format] || { available: true };
    button.disabled = !capability.available || !canExportActiveFile;
    button.title = !canExportActiveFile
      ? 'Export is only available for Markdown deck files.'
      : capability.available
        ? `Export ${format.toUpperCase()}`
        : capability.message || `${format.toUpperCase()} export unavailable`;
  }
}

function updateEditorAvailability() {
  const hasActiveFile = Boolean(state.activeFile);
  const canPreviewActiveFile = isPreviewableFilePath(state.activeFile);
  editor.setReadOnly(!hasActiveFile);
  saveButton.disabled = !hasActiveFile;
  refreshButton.disabled = !hasActiveFile || !canPreviewActiveFile;
  filesToggle.disabled = false;

  for (const button of editorButtons) {
    button.disabled = !hasActiveFile;
  }

  if (insertSummary) {
    insertSummary.classList.toggle('is-disabled', !hasActiveFile);
  }

  if (!hasActiveFile) {
    slideContext.textContent = state.project?.canBootstrap ? 'Project setup' : 'No slide';
  } else if (isDocumentPreviewPath(state.activeFile)) {
    slideContext.textContent = 'Document preview';
  } else if (!canPreviewActiveFile) {
    slideContext.textContent = 'Preview unavailable';
  }
}

function syncViewState() {
  const docsMode = state.view === 'docs';
  workspaceView.classList.toggle('is-hidden', docsMode);
  docsView.classList.toggle('is-hidden', !docsMode);
  docsToggle.classList.toggle('is-active', docsMode);
  docsToggle.textContent = docsMode ? 'Studio' : 'Docs';
  docsToggle.title = docsMode ? 'Return to Studio workspace' : 'Open local docs';
}

function syncDrawerState() {
  const desktop = window.innerWidth > 1180;
  fileDrawer.classList.toggle('open', state.drawerOpen);
  drawerBackdrop.classList.toggle('visible', state.drawerOpen && !desktop);
  studioLayout.classList.toggle('drawer-collapsed', !state.drawerOpen && desktop);
  drawerResizer.classList.toggle('is-hidden', !desktop || !state.drawerOpen);
  filesToggle.textContent = state.drawerOpen ? '▥' : '▤';
  filesToggle.title = state.drawerOpen ? 'Hide files' : 'Show files';
  applyDesktopLayout();
}

function setDrawerOpen(nextValue) {
  state.drawerOpen = nextValue;
  syncDrawerState();
  persistPreferences();
}

function setView(nextView, options = {}) {
  state.view = nextView;
  syncViewState();
  syncViewRoute(nextView, state.docsPage, options);
  persistPreferences();
}

async function openDocsPage(page = 'index', options = {}) {
  const nextPage = page || 'index';
  state.view = 'docs';
  state.docsPage = nextPage;
  state.docsLoading = true;
  state.docsError = null;
  state.docsContent = '';
  docsTitle.textContent = 'Loading…';
  docsRoute.textContent = docsRouteForPage(nextPage);
  syncViewState();
  renderDocsNav();
  renderDocsContent();
  syncViewRoute('docs', nextPage, options);

  try {
    const payload = await fetchJson(`/api/docs?page=${encodeURIComponent(nextPage)}`);
    state.docsPages = payload.pages || [];
    state.docsPage = payload.page?.slug || nextPage;
    state.docsTitle = payload.page?.title || 'Docs';
    state.docsContent = payload.page?.content || '';
    state.docsLoading = false;
    state.docsError = null;
    docsTitle.textContent = state.docsTitle;
    docsRoute.textContent = docsRouteForPage(state.docsPage);
    renderDocsNav();
    renderDocsContent();
    persistPreferences();
  } catch (error) {
    state.docsLoading = false;
    state.docsError = error.message;
    docsTitle.textContent = 'Docs unavailable';
    renderDocsContent();
    throw error;
  }
}

function setExportStatus(message, subtle = false) {
  exportStatus.textContent = message;
  exportStatus.classList.toggle('subtle', subtle);
  if (state.exportTimer) {
    clearTimeout(state.exportTimer);
    state.exportTimer = null;
  }
}

function showExportNotification(format, outputPath) {
  const fileName = outputPath.split('/').pop();
  const dirName = outputPath.substring(0, outputPath.length - fileName.length);
  
  exportNotification.innerHTML = `
    <span>${format.toUpperCase()} saved</span><br>
    <a href="file://${outputPath}" target="_blank" rel="noopener">${fileName}</a>
    <span class="notification-close" title="Dismiss">×</span>
  `;
  exportNotification.classList.add('visible');

  const closeBtn = exportNotification.querySelector('.notification-close');
  closeBtn.addEventListener('click', hideExportNotification);

  document.addEventListener('click', handleNotificationClickAway, { once: true });
}

function hideExportNotification() {
  exportNotification.classList.remove('visible');
  document.removeEventListener('click', handleNotificationClickAway);
}

function handleNotificationClickAway(event) {
  if (!exportNotification.contains(event.target)) {
    hideExportNotification();
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
  renderFileTree();
}

function renderOutline() {
  if (!state.activeFile) {
    outlineList.innerHTML = '<div class="outline-empty">Open a Markdown deck to see the slide outline here.</div>';
    return;
  }

  if (isDocumentPreviewPath(state.activeFile)) {
    outlineList.innerHTML = '<div class="outline-empty">Document previews do not have a slide outline.</div>';
    return;
  }

  if (!isMarkdownDeckPath(state.activeFile)) {
    outlineList.innerHTML = '<div class="outline-empty">The outline is only available for Markdown deck files.</div>';
    return;
  }

  if (state.slideRanges.length === 0) {
    outlineList.innerHTML = '<div class="outline-empty">Slide headings will appear here as soon as the deck has content.</div>';
    return;
  }

  const outline = deriveSlideOutline(getEditorValue(), state.slideRanges);
  outlineList.innerHTML = '';

  outline.forEach(slide => {
    const item = document.createElement('div');
    item.className = 'outline-item';
    item.dataset.index = String(slide.index);
    const isActive = slide.index === state.activeSlideIndex;
    if (isActive) {
      item.classList.add('active');
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'outline-slide-button';
    button.title = `Jump to slide ${slide.index + 1}`;
    button.innerHTML = `
      <span class="outline-index">${slide.index + 1}</span>
      <span class="outline-copy">
        <span class="outline-title">${slide.label}</span>
        <span class="outline-meta">${slide.components.length} component${slide.components.length === 1 ? '' : 's'}</span>
      </span>
    `;
    button.addEventListener('click', () => {
      setActiveSlide(slide.index, { scrollEditor: true });
      if (window.innerWidth <= 1180) {
        setDrawerOpen(false);
      }
    });

    item.appendChild(button);

    if (isActive) {
      const children = document.createElement('div');
      children.className = 'outline-children';

      if (slide.components.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'outline-child-empty';
        empty.textContent = 'No nested components yet';
        children.appendChild(empty);
      } else {
        slide.components.forEach(component => {
          const child = document.createElement('button');
          child.type = 'button';
          child.className = 'outline-child';
          child.innerHTML = `
            <span class="outline-kind">${component.detail}</span>
            <span class="outline-child-label">${component.label}</span>
          `;
          child.title = `${component.detail}: ${component.label}`;
          child.addEventListener('click', event => {
            event.stopPropagation();
            setActiveSlide(slide.index, { scrollPreview: true, immediate: true });
            editor.setSelection(component.offset, component.offset);
            editor.scrollToOffset(component.offset);
            editor.focus();
            if (window.innerWidth <= 1180) {
              setDrawerOpen(false);
            }
          });
          children.appendChild(child);
        });
      }

      item.appendChild(children);
    }

    outlineList.appendChild(item);
  });
}

function findSelectedTemplate() {
  const templates = state.project?.bootstrap?.templates || [];
  return templates.find(template => template.id === state.bootstrapTemplateId) || templates[0] || null;
}

function renderWorkspaceEmptyState() {
  setView('workspace', { replace: true });
  hideAssetPreview();
  const templates = state.project?.bootstrap?.templates || [];
  const selectedTemplate = findSelectedTemplate();
  const usesCustomPage = selectedTemplate?.id === 'custom';

  editorTitle.textContent = 'Create a project';
  editor.setValue('');
  fileTabs.innerHTML = '';
  state.openFiles = [];
  outlineList.innerHTML = '<div class="outline-empty">Pick a template and create the project to generate a slide outline.</div>';
  slides.innerHTML = `
    <div class="empty-workspace">
      <div class="empty-workspace-eyebrow">Studio Setup</div>
      <h2>Create a DeckDown workspace</h2>
      <p>Start with a repo-local project template. DeckDown will generate source files, a local asset folder, notes, and AI instructions for the workspace.</p>
      <div class="template-grid">
        ${templates.map(template => `
          <button
            class="template-card ${template.id === state.bootstrapTemplateId ? 'active' : ''}"
            data-template-id="${template.id}"
            type="button"
          >
            <div class="template-title">${template.label}</div>
            <div class="template-copy">${template.description}</div>
            <div class="template-meta">${template.custom ? 'Custom size' : `${template.page.width} × ${template.page.height}`}</div>
          </button>
        `).join('')}
      </div>
      <div class="template-fields ${usesCustomPage ? '' : 'is-hidden'}" id="template-fields">
        <label class="template-field">
          <span>Width</span>
          <input id="custom-page-width" type="number" min="1" value="${state.bootstrapCustomPage.width}" />
        </label>
        <label class="template-field">
          <span>Height</span>
          <input id="custom-page-height" type="number" min="1" value="${state.bootstrapCustomPage.height}" />
        </label>
        <label class="template-field">
          <span>Margin</span>
          <input id="custom-page-margin" type="number" min="0" value="${state.bootstrapCustomPage.margin}" />
        </label>
      </div>
      <div class="empty-workspace-actions">
        <button id="workspace-init-button" class="primary-button" type="button">Create project</button>
      </div>
    </div>
  `;
  state.lastPreview = null;
  state.previewScrollTop = 0;
  updateEditorAvailability();
  setDiagnostics([], {});
  setExportStatus('Ready', true);

  slides.querySelectorAll('.template-card').forEach(button => {
    button.addEventListener('click', () => {
      state.bootstrapTemplateId = button.dataset.templateId;
      renderWorkspaceEmptyState();
    });
  });

  const widthInput = document.getElementById('custom-page-width');
  const heightInput = document.getElementById('custom-page-height');
  const marginInput = document.getElementById('custom-page-margin');

  if (widthInput && heightInput && marginInput) {
    widthInput.addEventListener('input', () => {
      state.bootstrapCustomPage.width = Number.parseInt(widthInput.value || '0', 10);
    });
    heightInput.addEventListener('input', () => {
      state.bootstrapCustomPage.height = Number.parseInt(heightInput.value || '0', 10);
    });
    marginInput.addEventListener('input', () => {
      state.bootstrapCustomPage.margin = Number.parseInt(marginInput.value || '0', 10);
    });
  }

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
  if (block.type === 'heading' || block.type === 'paragraph') {
    node.style.lineHeight = '1.35';
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

  if ((block.type === 'math' || block.type === 'mermaid') && block.renderAsset?.svgDataUri) {
    node.classList.add('rendered-asset');
    const image = document.createElement('img');
    image.className = `rendered-asset-media rendered-${block.type}`;
    image.alt = block.type === 'math' ? 'Rendered LaTeX block' : 'Rendered Mermaid diagram';
    image.src = block.renderAsset.svgDataUri;
    image.style.objectFit = 'contain';
    node.appendChild(image);
    return node;
  }

  if (block.type === 'table' && block.rows) {
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    block.rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      if (rowIndex === 0) {
        tr.style.background = block.fontFamily?.includes('Sans') ? '#0066cc' : '#333';
        tr.style.color = 'white';
      } else if (rowIndex % 2 === 0) {
        tr.style.background = '#f8f8f8';
      }
      row.forEach(cell => {
        const td = document.createElement(rowIndex === 0 ? 'th' : 'td');
        td.style.padding = '8px 12px';
        td.style.border = '1px solid #ccc';
        td.innerHTML = renderInlineMarkdown(cell);
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    node.appendChild(table);
    return node;
  }

  if (block.segments && block.segments.length > 0) {
    node.innerHTML = block.segments.map(seg => {
      let text = escapeHtml(seg.text || '');
      if (seg.formats?.includes('bold')) {
        text = `<strong>${text}</strong>`;
      }
      if (seg.formats?.includes('italic')) {
        text = `<em>${text}</em>`;
      }
      if (seg.formats?.includes('code')) {
        text = `<code>${text}</code>`;
      }
      return text;
    }).join('');
  } else {
    node.textContent = block.text || '';
  }
  return node;
}

function updateCanvasScale(surface, canvas, page) {
  const frame = computePreviewFrame(
    page,
    {
      width: (slides.clientWidth || surface.parentElement?.clientWidth || page.width) - 28,
      height: (previewPane?.clientHeight || page.height) - 120
    },
    state.previewZoom
  );
  const scale = frame.scale;
  surface.style.width = `${frame.width}px`;
  surface.style.height = `${frame.height}px`;
  canvas.style.transform = `scale(${scale})`;
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

function jumpToDiagnostic(diagnostic) {
  const projectPath = relativeProjectPath(diagnostic.filePath);

  if (projectPath && projectPath !== state.activeFile) {
    openFile(projectPath).then(() => {
      if (diagnostic.line) {
        const lineOffset = getOffsetForLine(getEditorValue(), diagnostic.line);
        editor.setSelection(lineOffset, lineOffset);
        editor.focus();
      }
    }).catch(error => {
      console.error(error);
    });
    return;
  }

  if (diagnostic.line) {
    const lineOffset = getOffsetForLine(getEditorValue(), diagnostic.line);
    editor.setSelection(lineOffset, lineOffset);
    editor.scrollToOffset(lineOffset);
    editor.focus();
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

function setActiveSlide(index, options = {}) {
  const safeIndex = Math.max(0, Math.min(index, Math.max(0, state.slideRanges.length - 1)));
  state.activeSlideIndex = safeIndex;
  const slideLabels = deriveSlideLabels(getEditorValue());
  slideContext.textContent = slideLabels[safeIndex]
    ? `Slide ${safeIndex + 1}: ${slideLabels[safeIndex]}`
    : `Slide ${safeIndex + 1}`;
  renderOutline();

  for (const card of slides.querySelectorAll('.slide-card')) {
    card.classList.toggle('active', Number(card.dataset.index) === safeIndex);
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
    editor.setSelection(range.start, range.start);
    editor.scrollToOffset(range.start);
  }
}

function syncActiveSlideFromCursor(offset = editor.getCursorOffset()) {
  const nextIndex = state.slideRanges.findIndex(range => offset >= range.start && offset <= range.end);
  if (nextIndex >= 0 && nextIndex !== state.activeSlideIndex) {
    setActiveSlide(nextIndex);
  }
}

function renderFileTabs() {
  fileTabs.innerHTML = '';
  
  if (state.openFiles.length === 0) {
    return;
  }

  state.openFiles.forEach((filePath, index) => {
    const fileName = filePath.split('/').pop();
    const isActive = filePath === state.activeFile;
    const isDirty = state.dirtyFiles.has(filePath);
    
    const tab = document.createElement('div');
    tab.className = `file-tab${isActive ? ' active' : ''}`;
    tab.dataset.path = filePath;
    tab.dataset.index = String(index);
    
    const label = document.createElement('span');
    label.className = 'file-tab-name';
    label.textContent = isDirty ? `${fileName} *` : fileName;
    label.title = filePath;
    
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'file-tab-close';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close tab';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeFileTab(filePath);
    });
    
    tab.appendChild(label);
    tab.appendChild(closeBtn);
    
    tab.addEventListener('click', () => {
      switchToFileTab(filePath);
    });
    
    fileTabs.appendChild(tab);
  });

  renderOutline();
}

function renderPreview(preview) {
  hideAssetPreview();
  if (preview) {
    state.lastPreview = preview;
  }

  const preservedScrollTop = state.previewScrollTop;
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
  requestAnimationFrame(() => {
    slides.scrollTop = Math.max(0, Math.min(preservedScrollTop, slides.scrollHeight - slides.clientHeight));
  });
}

function refreshSlideMetadata() {
  if (!isMarkdownDeckPath(state.activeFile)) {
    state.slideRanges = [];
    renderFileTabs();
    return;
  }

  state.slideRanges = deriveSlideRanges(getEditorValue());
  renderFileTabs();
}

async function loadPreview() {
  if (!state.activeFile) {
    return;
  }

  if (isDocumentPreviewPath(state.activeFile)) {
    editor.setServerDiagnostics([]);
    renderDocumentPreview(state.activeFile, getEditorValue());
    renderOutline();
    updateExportButtons();
    updateEditorAvailability();
    return;
  }

  if (!isMarkdownDeckPath(state.activeFile)) {
    editor.setServerDiagnostics([]);
    renderPreviewPlaceholder('Preview is only available for Markdown deck files.');
    renderOutline();
    updateExportButtons();
    updateEditorAvailability();
    return;
  }

  const previewPayload = await fetchJson(`/api/preview?path=${encodeURIComponent(state.activeFile)}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      content: getEditorValue()
    })
  });

  editor.setServerDiagnostics(previewPayload.diagnostics || []);
  renderPreview(previewPayload.preview);
}

async function openFile(path) {
  const existingIndex = state.openFiles.indexOf(path);
  if (existingIndex >= 0) {
    switchToFileTab(path);
    return;
  }

  persistActiveFileSession();
  if (state.editorDirty) {
    await saveActiveFile();
  }

  setView('workspace', { replace: true });
  const payload = await fetchJson(`/api/file?path=${encodeURIComponent(path)}`);
  
  if (!state.openFiles.includes(payload.path)) {
    state.openFiles.push(payload.path);
  }
  
  state.activeFile = payload.path;
  state.editorDirty = false;
  state.dirtyFiles.delete(payload.path);
  state.lastPreview = null;
  editorTitle.textContent = payload.path;
  editor.setValue(payload.content);
  saveStatus.textContent = 'Saved';
  setExportStatus('Ready', true);
  renderFileList();
  renderFileTabs();
  updateExportButtons();
  updateEditorAvailability();
  refreshSlideMetadata();
  restoreFileSession(payload.path);
  await loadPreview();
}

function switchToFileTab(path) {
  if (path === state.activeFile) {
    if (state.assetPreview) {
      loadPreview().catch(error => {
        console.error(error);
      });
    }
    return;
  }

  persistActiveFileSession();
  if (state.editorDirty) {
    saveActiveFile().then(() => {
      state.activeFile = path;
      editorTitle.textContent = path;
      loadFileContent(path);
    });
  } else {
    state.activeFile = path;
    editorTitle.textContent = path;
    loadFileContent(path);
  }
}

async function loadFileContent(path) {
  try {
    const payload = await fetchJson(`/api/file?path=${encodeURIComponent(path)}`);
    state.activeFile = payload.path;
    state.editorDirty = false;
    state.dirtyFiles.delete(payload.path);
    editorTitle.textContent = payload.path;
    editor.setValue(payload.content);
    saveStatus.textContent = 'Saved';
    renderFileList();
    renderFileTabs();
    updateExportButtons();
    updateEditorAvailability();
    refreshSlideMetadata();
    restoreFileSession(payload.path);
    await loadPreview();
  } catch (error) {
    console.error(error);
  }
}

function closeFileTab(path) {
  const index = state.openFiles.indexOf(path);
  if (index === -1) {
    return;
  }

  if (state.openFiles.length === 1) {
    return;
  }

  if (path === state.activeFile) {
    persistActiveFileSession();
    let nextIndex = index - 1;
    if (nextIndex < 0) {
      nextIndex = index + 1;
    }
    state.activeFile = state.openFiles[nextIndex];
    loadFileContent(state.activeFile);
  }

  state.openFiles.splice(index, 1);
  state.dirtyFiles.delete(path);
  renderFileTabs();
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
      content: getEditorValue()
    })
  });
  state.editorDirty = false;
  state.dirtyFiles.delete(state.activeFile);
  saveStatus.textContent = 'Saved';
  renderFileTabs();
  if (isPreviewableFilePath(state.activeFile)) {
    await loadPreview();
  }
}

async function exportDeck(format) {
  if (!state.activeFile || !isMarkdownDeckPath(state.activeFile)) {
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
        content: getEditorValue()
      })
    });

    if (payload.diagnostics) {
      editor.setServerDiagnostics(payload.diagnostics);
    }

    showExportNotification(format, payload.outputPath);
    setExportStatus('Ready', true);
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
  const selectedTemplate = findSelectedTemplate();
  const payload = await fetchJson('/api/workspace/init', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      templateId: state.bootstrapTemplateId,
      customPage: selectedTemplate?.id === 'custom' ? state.bootstrapCustomPage : undefined
    })
  });

  state.project = {
    ...state.project,
    initialFile: payload.initialFile,
    files: payload.files,
    tree: payload.tree,
    canBootstrap: payload.canBootstrap ?? false,
    bootstrap: payload.bootstrap ?? null
  };
  renderFileList();
  updateExportButtons();
  updateEditorAvailability();
  await openFile(payload.entryFile);
}

function scheduleAutosave() {
  if (state.activeFile) {
    state.dirtyFiles.add(state.activeFile);
  }
  state.editorDirty = true;
  saveStatus.textContent = 'Editing…';
  renderFileTabs();
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
  const selection = editor.getSelection();
  const nextCursor = selection.from + snippet.length;
  editor.replaceSelection(snippet, {
    anchor: nextCursor,
    head: nextCursor
  });
}

function wrapSelection(prefix, suffix, fallback = '') {
  const selection = editor.getSelection();
  const value = getEditorValue();
  const selected = value.slice(selection.from, selection.to) || fallback;
  const wrapped = `${prefix}${selected}${suffix}`;
  editor.replaceSelection(wrapped, {
    anchor: selection.from + prefix.length,
    head: selection.from + prefix.length + selected.length
  });
}

function setPreviewZoom(nextZoom) {
  state.previewZoom = Math.max(0.75, Math.min(nextZoom, 1.4));
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
  persistPreferences();
}

async function bootstrap() {
  applyPersistedPreferences();
  state.project = await fetchJson('/api/project');
  projectRoot.textContent = state.project.rootDir;
  const routePage = getPageSlugFromLocation();
  state.docsPage = window.location.pathname.startsWith('/docs') ? routePage : state.docsPage || routePage;
  state.view = window.location.pathname.startsWith('/docs') ? 'docs' : state.view;
  renderFileList();
  renderOutline();
  updateExportButtons();
  updateEditorAvailability();
  syncDrawerState();
  syncViewState();

  if (state.view === 'docs') {
    await openDocsPage(state.docsPage, { replace: true });
    return;
  }

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

saveButton.addEventListener('click', () => {
  withSaveFailureHandling(() => saveActiveFile());
});

refreshButton.addEventListener('click', () => {
  loadPreview().catch(error => {
    console.error(error);
  });
});

filesToggle.addEventListener('click', () => setDrawerOpen(!state.drawerOpen));
filesClose.addEventListener('click', () => setDrawerOpen(false));
drawerBackdrop.addEventListener('click', () => setDrawerOpen(false));
docsToggle.addEventListener('click', async () => {
  if (state.view === 'docs') {
    setView('workspace', { replace: true });
    if (state.activeFile) {
      renderFileTree();
      renderOutline();
      updateEditorAvailability();
      updateExportButtons();
      return;
    }
    renderWorkspaceEmptyState();
    return;
  }

  if (state.editorDirty) {
    await saveActiveFile();
  }

  try {
    await openDocsPage(state.docsPage || 'index');
  } catch (error) {
    console.error(error);
  }
});

function toggleDiagnostics() {
  state.showDiagnostics = !state.showDiagnostics;
  renderDiagnostics();
}

bindHorizontalResize(drawerResizer, {
  startValue: () => clampDrawerWidth(state.drawerWidth),
  clamp: clampDrawerWidth,
  update: nextWidth => {
    state.drawerWidth = nextWidth;
    persistPreferences();
  }
});

bindHorizontalResize(previewResizer, {
  startValue: () => {
    const totalWorkspaceWidth = getDesktopWorkspaceWidth();
    return state.editorWidth ?? Math.round(totalWorkspaceWidth * 0.44);
  },
  clamp: nextWidth => clampEditorWidth(nextWidth, getDesktopWorkspaceWidth()),
  update: nextWidth => {
    state.editorWidth = nextWidth;
    persistPreferences();
  }
});

diagnosticsToggle.addEventListener('click', toggleDiagnostics);
slides.addEventListener('scroll', () => {
  state.previewScrollTop = slides.scrollTop;
  persistActiveFileSession();
});

zoomIn.addEventListener('click', () => setPreviewZoom(state.previewZoom + 0.1));
zoomOut.addEventListener('click', () => setPreviewZoom(state.previewZoom - 0.1));
zoomReset.addEventListener('click', () => setPreviewZoom(1));
window.addEventListener('resize', () => {
  if (window.innerWidth <= 1180 && state.drawerOpen) {
    fileDrawer.classList.add('open');
  }
  syncDrawerState();
  setPreviewZoom(state.previewZoom);
});

window.addEventListener('keydown', event => {
  const action = resolveStudioShortcut(event, getShortcutContext());
  if (!action) {
    return;
  }

  if (isTypingTarget(event.target) && action !== 'save') {
    return;
  }

  event.preventDefault();
  runShortcutAction(action);
});

exportButtons.pdf.addEventListener('click', () => exportDeck('pdf'));
exportButtons.png.addEventListener('click', () => exportDeck('png'));
exportButtons.pptx.addEventListener('click', () => exportDeck('pptx'));

window.addEventListener('popstate', async () => {
  const nextPage = getPageSlugFromLocation();
  if (window.location.pathname.startsWith('/docs')) {
    try {
      await openDocsPage(nextPage, { replace: true, skipHistory: true });
    } catch (error) {
      console.error(error);
    }
    return;
  }

  setView('workspace', { replace: true, skipHistory: true });
  if (state.activeFile) {
    syncViewState();
    renderFileTree();
    renderOutline();
    updateEditorAvailability();
    updateExportButtons();
    return;
  }

  if (state.project?.bootstrap) {
    renderWorkspaceEmptyState();
  }
});

bootstrap().catch(error => {
  setDiagnostics([{
    severity: 'error',
    source: 'studio',
    message: error.message
  }], { autoOpenOnError: true });
});
