import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { buildPresentation, ensureGhostscriptAvailable, renderLayout } from '../index.js';
import { createWorkspace, listWorkspaceTemplates } from '../workspace.js';

const STUDIO_INDEX_HTML = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const STUDIO_APP_JS = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const STUDIO_STYLE_CSS = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const STUDIO_SLIDE_LABELS_JS = readFileSync(new URL('./slide-labels.js', import.meta.url), 'utf8');
const STUDIO_SLIDE_SEGMENTATION_JS = readFileSync(new URL('./slide-segmentation.js', import.meta.url), 'utf8');
const STUDIO_SLIDE_OUTLINE_JS = readFileSync(new URL('./slide-outline.js', import.meta.url), 'utf8');
const STUDIO_LAYOUT_UTILS_JS = readFileSync(new URL('./layout-utils.js', import.meta.url), 'utf8');
const STUDIO_LAYOUT_CONSTANTS_JS = readFileSync(new URL('./layout-constants.js', import.meta.url), 'utf8');
const STUDIO_PREFERENCES_JS = readFileSync(new URL('./preferences.js', import.meta.url), 'utf8');
const STUDIO_SHORTCUTS_JS = readFileSync(new URL('./shortcuts.js', import.meta.url), 'utf8');
const STUDIO_DOCUMENT_PREVIEW_JS = readFileSync(new URL('./document-preview.js', import.meta.url), 'utf8');
const STUDIO_EDITOR_ENTRY = new URL('./editor.js', import.meta.url);
const STUDIO_DOCS_ROOT = fileURLToPath(new URL('../../docs/', import.meta.url));
const STUDIO_DOC_PAGES = [
  { slug: 'index', file: 'index.md', title: 'Docs Overview' },
  { slug: 'getting-started', file: 'getting-started.md', title: 'Getting Started' },
  { slug: 'cli', file: 'cli.md', title: 'CLI Reference' },
  { slug: 'authoring', file: 'authoring.md', title: 'Authoring Guide' },
  { slug: 'agent-workflows', file: 'agent-workflows.md', title: 'AI Agent Workflows' },
  { slug: 'ai', file: 'ai.md', title: 'AI Instructions' }
];

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.next',
  '.cache'
]);

const EDITABLE_EXTENSIONS = new Set(['.md', '.markdown', '.yaml', '.yml', '.json']);
const ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);

function isEditablePath(pathname) {
  return EDITABLE_EXTENSIONS.has(extname(pathname).toLowerCase());
}

function isAssetPath(pathname) {
  return ASSET_EXTENSIONS.has(extname(pathname).toLowerCase());
}

function isMarkdownPath(pathname) {
  return MARKDOWN_EXTENSIONS.has(extname(pathname).toLowerCase());
}

function shouldIgnoreEntry(name) {
  return IGNORED_DIRECTORIES.has(name);
}

function resolveStudioTarget(target) {
  const absoluteTarget = resolve(target);
  if (!existsSync(absoluteTarget)) {
    throw new Error(`Studio target not found: ${absoluteTarget}`);
  }

  const stats = statSync(absoluteTarget);
  if (stats.isFile()) {
    return {
      rootDir: resolve(absoluteTarget, '..'),
      entryFile: relative(resolve(absoluteTarget, '..'), absoluteTarget)
    };
  }

  return {
    rootDir: absoluteTarget,
    entryFile: null
  };
}

function walkProjectFiles(rootDir, currentDir = rootDir, results = []) {
  const entries = readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (shouldIgnoreEntry(entry.name)) {
        continue;
      }
      walkProjectFiles(rootDir, join(currentDir, entry.name), results);
      continue;
    }

    const absolutePath = join(currentDir, entry.name);
    if (!isEditablePath(absolutePath) && !isAssetPath(absolutePath)) {
      continue;
    }

    results.push(relative(rootDir, absolutePath));
  }

  return results.sort((left, right) => left.localeCompare(right));
}

function pickEntryFile(files, requestedEntry) {
  if (requestedEntry && files.includes(requestedEntry) && isMarkdownPath(requestedEntry)) {
    return requestedEntry;
  }

  const preferredCandidates = [
    'deck.md',
    'test-render.md',
    'samples/sample-deck.md',
    'samples/readme-showcase.md'
  ];

  for (const candidate of preferredCandidates) {
    if (files.includes(candidate)) {
      return candidate;
    }
  }

  return files.find(file => isMarkdownPath(file)) || null;
}

function ensureInsideRoot(rootDir, relativePath) {
  const absolutePath = resolve(rootDir, relativePath || '');
  const relativeFromRoot = relative(rootDir, absolutePath);
  if (relativeFromRoot.startsWith(`..${sep}`) || relativeFromRoot === '..') {
    throw new Error('Path escapes the Studio project root.');
  }

  return absolutePath;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, contentType, body) {
  response.writeHead(statusCode, { 'content-type': contentType });
  response.end(body);
}

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function summarizeFiles(files) {
  return files.map(file => ({
    path: file,
    kind: isAssetPath(file) ? 'asset' : 'editable'
  }));
}

function buildProjectTree(files) {
  const root = {
    name: '.',
    path: '',
    kind: 'directory',
    expanded: true,
    children: []
  };

  const findOrCreateChild = (parent, name, pathName, kind, fileKind = null) => {
    let child = parent.children.find(entry => entry.name === name && entry.kind === kind);
    if (!child) {
      child = kind === 'directory'
        ? {
            name,
            path: pathName,
            kind,
            expanded: true,
            children: []
          }
        : {
            name,
            path: pathName,
            kind,
            fileKind: fileKind || 'editable'
          };
      parent.children.push(child);
    }

    return child;
  };

  for (const file of files) {
    const parts = file.split('/');
    let current = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLeaf = index === parts.length - 1;
      const kind = isLeaf ? 'file' : 'directory';
      const fileKind = isLeaf
        ? (isAssetPath(file) ? 'asset' : 'editable')
        : null;
      current = findOrCreateChild(current, part, currentPath, kind, fileKind);
    });
  }

  const sortChildren = node => {
    if (!node.children) {
      return;
    }

    node.children.sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === 'directory' ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });

    node.children.forEach(sortChildren);
  };

  sortChildren(root);
  return root;
}

function resolveDocsPage(slug = 'index') {
  const page = STUDIO_DOC_PAGES.find(entry => entry.slug === slug) || STUDIO_DOC_PAGES[0];
  const filePath = resolve(STUDIO_DOCS_ROOT, page.file);
  if (!existsSync(filePath)) {
    return null;
  }

  return {
    slug: page.slug,
    title: page.title,
    path: filePath,
    content: readFileSync(filePath, 'utf8')
  };
}

function serializePreviewLayout(layout) {
  return {
    page: layout.page,
    theme: layout.theme,
    slides: layout.slides.map(slide => ({
      page: slide.page,
      theme: slide.theme,
      blocks: slide.blocks.map(block => ({
        ...block,
        renderAsset: block.renderAsset
          ? {
              svgDataUri: block.renderAsset.svgDataUri,
              pngDataUri: block.renderAsset.pngDataUri
            }
          : undefined
      }))
    }))
  };
}

function getContentType(pathname) {
  const extension = extname(pathname).toLowerCase();
  switch (extension) {
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function tryOpenBrowser(url) {
  const commands = process.platform === 'darwin'
    ? [['open', [url]]]
    : process.platform === 'win32'
      ? [['cmd', ['/c', 'start', '', url]]]
      : [['xdg-open', [url]]];

  for (const [command, args] of commands) {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      return;
    } catch {
      // Best effort only.
    }
  }
}

function createExportTarget(rootDir, absolutePath, format) {
  const exportRoot = join(rootDir, 'dist', 'studio-exports');
  mkdirSync(exportRoot, { recursive: true });

  const safeRelativePath = relative(rootDir, absolutePath);
  const pathSegments = safeRelativePath
    .split(sep)
    .filter(Boolean)
    .map(segment => segment.replace(/[^a-zA-Z0-9._-]+/g, '-'));
  const fileName = pathSegments.pop() || 'deck.md';
  const baseName = basename(fileName, extname(fileName)).replace(/[^a-zA-Z0-9._-]+/g, '-') || 'deck';
  if (format === 'png') {
    return join(exportRoot, ...pathSegments, `${baseName}-png`);
  }

  return join(exportRoot, ...pathSegments, `${baseName}.${format}`);
}

function getExportCapabilities() {
  const capabilities = {
    pdf: { available: true },
    pptx: { available: true },
    png: { available: true }
  };

  try {
    ensureGhostscriptAvailable();
  } catch (error) {
    capabilities.png = {
      available: false,
      message: error.message
    };
  }

  return capabilities;
}

let studioEditorBundlePromise = null;

async function getStudioEditorBundle() {
  if (!studioEditorBundlePromise) {
    studioEditorBundlePromise = build({
      entryPoints: [STUDIO_EDITOR_ENTRY.pathname],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      write: false
    }).then(result => result.outputFiles[0].text);
  }

  return studioEditorBundlePromise;
}

export async function startStudioServer(target, options = {}) {
  const { rootDir, entryFile } = resolveStudioTarget(target);
  const exportCapabilities = getExportCapabilities();
  const getProjectState = () => {
    const files = walkProjectFiles(rootDir);
    const initialFile = pickEntryFile(files, entryFile);
    return {
      files,
      initialFile,
      bootstrap: initialFile ? null : {
        templates: listWorkspaceTemplates()
      }
    };
  };

  const preferredPort = parseInt(options.port || '0', 10);

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');

    try {
      if (request.method === 'GET' && requestUrl.pathname === '/') {
        sendText(response, 200, 'text/html; charset=utf-8', STUDIO_INDEX_HTML);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname.startsWith('/docs')) {
        sendText(response, 200, 'text/html; charset=utf-8', STUDIO_INDEX_HTML);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/studio.js') {
        sendText(response, 200, 'text/javascript; charset=utf-8', STUDIO_APP_JS);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/slide-labels.js') {
        sendText(response, 200, 'text/javascript; charset=utf-8', STUDIO_SLIDE_LABELS_JS);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/slide-segmentation.js') {
        sendText(response, 200, 'text/javascript; charset=utf-8', STUDIO_SLIDE_SEGMENTATION_JS);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/slide-outline.js') {
        sendText(response, 200, 'text/javascript; charset=utf-8', STUDIO_SLIDE_OUTLINE_JS);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/layout-utils.js') {
        sendText(response, 200, 'text/javascript; charset=utf-8', STUDIO_LAYOUT_UTILS_JS);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/studio-preferences.js') {
        sendText(response, 200, 'text/javascript; charset=utf-8', STUDIO_PREFERENCES_JS);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/studio-shortcuts.js') {
        sendText(response, 200, 'text/javascript; charset=utf-8', STUDIO_SHORTCUTS_JS);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/document-preview.js') {
        sendText(response, 200, 'text/javascript; charset=utf-8', STUDIO_DOCUMENT_PREVIEW_JS);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/layout-constants.js') {
        sendText(response, 200, 'text/javascript; charset=utf-8', STUDIO_LAYOUT_CONSTANTS_JS);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/studio-editor.js') {
        sendText(response, 200, 'text/javascript; charset=utf-8', await getStudioEditorBundle());
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/studio.css') {
        sendText(response, 200, 'text/css; charset=utf-8', STUDIO_STYLE_CSS);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/favicon.ico') {
        response.writeHead(204);
        response.end();
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/api/project') {
        const projectState = getProjectState();
        sendJson(response, 200, {
          rootDir,
          initialFile: projectState.initialFile,
          files: summarizeFiles(projectState.files),
          tree: buildProjectTree(projectState.files),
          exportCapabilities,
          canBootstrap: projectState.initialFile === null,
          bootstrap: projectState.bootstrap
        });
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/api/workspace/init') {
        const body = await readRequestJson(request);
        const result = createWorkspace(rootDir, {
          templateId: body.templateId,
          customPage: body.customPage
        });
        const projectState = getProjectState();
        sendJson(response, 200, {
          ok: true,
          rootDir: result.rootDir,
          entryFile: result.entryFile,
          templateId: result.templateId,
          initialFile: projectState.initialFile,
          files: summarizeFiles(projectState.files),
          tree: buildProjectTree(projectState.files),
          canBootstrap: false,
          bootstrap: null
        });
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/api/docs') {
        const page = resolveDocsPage(requestUrl.searchParams.get('page') || 'index');
        if (!page) {
          sendJson(response, 404, { error: 'Docs page not found.' });
          return;
        }

        sendJson(response, 200, {
          pages: STUDIO_DOC_PAGES.map(entry => ({
            slug: entry.slug,
            title: entry.title
          })),
          page: {
            slug: page.slug,
            title: page.title,
            content: page.content
          }
        });
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/api/file') {
        const relativePath = requestUrl.searchParams.get('path') || '';
        const absolutePath = ensureInsideRoot(rootDir, relativePath);

        if (!existsSync(absolutePath)) {
          sendJson(response, 404, { error: 'File not found.' });
          return;
        }

        if (!isEditablePath(absolutePath)) {
          sendJson(response, 400, { error: 'File is not editable in Studio.' });
          return;
        }

        sendJson(response, 200, {
          path: relativePath,
          content: readFileSync(absolutePath, 'utf8')
        });
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/api/file') {
        const body = await readRequestJson(request);
        const relativePath = body.path || '';
        const absolutePath = ensureInsideRoot(rootDir, relativePath);

        if (!isEditablePath(absolutePath)) {
          sendJson(response, 400, { error: 'File is not editable in Studio.' });
          return;
        }

        writeFileSync(absolutePath, body.content ?? '', 'utf8');
        sendJson(response, 200, { ok: true });
        return;
      }

      if ((request.method === 'GET' || request.method === 'POST') && requestUrl.pathname === '/api/preview') {
        const relativePath = requestUrl.searchParams.get('path') || '';
        const absolutePath = ensureInsideRoot(rootDir, relativePath);
        const body = request.method === 'POST'
          ? await readRequestJson(request)
          : {};

        if (!isMarkdownPath(absolutePath)) {
          sendJson(response, 400, { error: 'Preview requires a Markdown deck file.' });
          return;
        }

        try {
          const result = await buildPresentation(absolutePath, {
            sourceContent: typeof body.content === 'string' ? body.content : undefined
          });
          sendJson(response, 200, {
            path: relativePath,
            diagnostics: result.diagnostics,
            preview: serializePreviewLayout(result.layout)
          });
        } catch (err) {
          sendJson(response, 200, {
            path: relativePath,
            diagnostics: [{
              severity: 'error',
              source: 'studio',
              filePath: absolutePath,
              message: err.message
            }],
            preview: null
          });
        }
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/api/export') {
        const body = await readRequestJson(request);
        const relativePath = body.path || '';
        const format = String(body.format || 'pdf').toLowerCase();
        const absolutePath = ensureInsideRoot(rootDir, relativePath);

        if (!isMarkdownPath(absolutePath)) {
          sendJson(response, 400, { error: 'Export requires a Markdown deck file.' });
          return;
        }

        if (!['pdf', 'png', 'pptx'].includes(format)) {
          sendJson(response, 400, { error: `Unsupported export format: ${format}` });
          return;
        }

        const outputPath = createExportTarget(rootDir, absolutePath, format);
        rmSync(outputPath, { recursive: true, force: true });
        mkdirSync(join(outputPath, '..'), { recursive: true });

        if (format === 'png') {
          ensureGhostscriptAvailable();
        }

        const result = await buildPresentation(absolutePath, {
          sourceContent: typeof body.content === 'string' ? body.content : undefined
        });
        await renderLayout(result.layout, format, outputPath);

        sendJson(response, 200, {
          ok: true,
          format,
          outputPath,
          diagnostics: result.diagnostics
        });
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/api/asset') {
        const relativePath = requestUrl.searchParams.get('path') || '';
        const absolutePath = ensureInsideRoot(rootDir, relativePath);

        if (!existsSync(absolutePath) || !isAssetPath(absolutePath)) {
          response.writeHead(404);
          response.end();
          return;
        }

        response.writeHead(200, { 'content-type': getContentType(absolutePath) });
        response.end(readFileSync(absolutePath));
        return;
      }

      response.writeHead(404);
      response.end('Not found');
    } catch (err) {
      sendJson(response, 500, { error: err.message });
    }
  });

  await new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(preferredPort, '127.0.0.1', () => resolvePromise());
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : preferredPort;
  const studioUrl = `http://127.0.0.1:${port}/`;

  if (!options.quiet) {
    const projectState = getProjectState();
    console.log(`DeckDown Studio running at ${studioUrl}`);
    console.log(`Project root: ${rootDir}`);
    console.log(`Entry deck: ${projectState.initialFile || 'none yet'}`);
    console.log('Press Ctrl+C to stop.');
  }

  if (options.open !== false) {
    tryOpenBrowser(studioUrl);
  }

  return {
    server,
    rootDir,
    initialFile: getProjectState().initialFile,
    url: studioUrl
  };
}
