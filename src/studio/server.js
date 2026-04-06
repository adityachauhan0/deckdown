import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { buildPresentation, ensureGhostscriptAvailable, renderLayout } from '../index.js';
import { createWorkspace } from '../workspace.js';

const STUDIO_INDEX_HTML = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const STUDIO_APP_JS = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const STUDIO_STYLE_CSS = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const STUDIO_SLIDE_LABELS_JS = readFileSync(new URL('./slide-labels.js', import.meta.url), 'utf8');

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

function serializePreviewLayout(layout) {
  return {
    page: layout.page,
    theme: layout.theme,
    slides: layout.slides.map(slide => ({
      page: slide.page,
      theme: slide.theme,
      blocks: slide.blocks.map(block => ({ ...block }))
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

function createExportTarget(rootDir, relativePath, format) {
  const exportRoot = join(rootDir, 'dist', 'studio-exports');
  mkdirSync(exportRoot, { recursive: true });

  const baseName = basename(relativePath, extname(relativePath)).replace(/[^a-zA-Z0-9._-]+/g, '-');
  if (format === 'png') {
    return join(exportRoot, `${baseName}-png`);
  }

  return join(exportRoot, `${baseName}.${format}`);
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

export async function startStudioServer(target, options = {}) {
  const { rootDir, entryFile } = resolveStudioTarget(target);
  const exportCapabilities = getExportCapabilities();
  const getProjectState = () => {
    const files = walkProjectFiles(rootDir);
    return {
      files,
      initialFile: pickEntryFile(files, entryFile)
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

      if (request.method === 'GET' && requestUrl.pathname === '/studio.js') {
        sendText(response, 200, 'text/javascript; charset=utf-8', STUDIO_APP_JS);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/slide-labels.js') {
        sendText(response, 200, 'text/javascript; charset=utf-8', STUDIO_SLIDE_LABELS_JS);
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
          exportCapabilities,
          canBootstrap: projectState.initialFile === null
        });
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/api/workspace/init') {
        const result = createWorkspace(rootDir);
        const projectState = getProjectState();
        sendJson(response, 200, {
          ok: true,
          rootDir: result.rootDir,
          entryFile: result.entryFile,
          initialFile: projectState.initialFile,
          files: summarizeFiles(projectState.files)
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

        const outputPath = createExportTarget(rootDir, relativePath, format);
        rmSync(outputPath, { recursive: true, force: true });

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
