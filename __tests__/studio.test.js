import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { startStudioServer } from '../src/studio/server.js';

describe('Studio server', () => {
  test('supports bootstrapping an empty project', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'deckdown-studio-empty-'));
    const { server, url } = await startStudioServer(tempDir, {
      port: 0,
      open: false,
      quiet: true
    });

    try {
      const projectResponse = await fetch(`${url}api/project`);
      const projectPayload = await projectResponse.json();
      expect(projectResponse.status).toBe(200);
      expect(projectPayload.initialFile).toBe(null);
      expect(projectPayload.canBootstrap).toBe(true);
      expect(projectPayload.bootstrap.templates).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'presentation-16x9' }),
        expect.objectContaining({ id: 'custom' })
      ]));

      const initResponse = await fetch(`${url}api/workspace/init`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          templateId: 'paper-letter'
        })
      });
      const initPayload = await initResponse.json();
      expect(initResponse.status).toBe(200);
      expect(initPayload.entryFile).toBe('deck.md');
      expect(initPayload.templateId).toBe('paper-letter');
      expect(existsSync(join(tempDir, 'deck.md'))).toBe(true);
      expect(existsSync(join(tempDir, 'AGENTS.md'))).toBe(true);
      expect(readFileSync(join(tempDir, 'deck.md'), 'utf8')).toContain('width: 1056');

      const refreshedProjectResponse = await fetch(`${url}api/project`);
      const refreshedProjectPayload = await refreshedProjectResponse.json();
      expect(refreshedProjectPayload.initialFile).toBe('deck.md');
      expect(refreshedProjectPayload.files.some(file => file.path === 'deck.md')).toBe(true);
    } finally {
      await new Promise((resolvePromise, rejectPromise) => {
        server.close(error => {
          if (error) {
            rejectPromise(error);
            return;
          }
          resolvePromise();
        });
      });
    }
  });

  test('serves project data, previews a deck, and saves source changes', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'deckdown-studio-'));
    const entryPath = join(tempDir, 'deck.md');
    writeFileSync(entryPath, '# Studio Test\n\nHello from Studio');

    const { server, url } = await startStudioServer(entryPath, {
      port: 0,
      open: false,
      quiet: true
    });

    try {
      const htmlResponse = await fetch(url);
      const html = await htmlResponse.text();
      expect(htmlResponse.status).toBe(200);
      expect(html).toContain('id="export-pdf"');
      expect(html).toContain('id="export-png"');
      expect(html).toContain('id="export-pptx"');
      expect(html).toContain('id="outline-list"');
      expect(html).toContain('id="docs-toggle"');
      expect(html).toContain('id="docs-view"');
      expect(html).toContain('id="drawer-resizer"');
      expect(html).toContain('id="preview-resizer"');

      const labelsModuleResponse = await fetch(`${url}slide-labels.js`);
      expect(labelsModuleResponse.status).toBe(200);

      const editorBundleResponse = await fetch(`${url}studio-editor.js`);
      const editorBundle = await editorBundleResponse.text();
      expect(editorBundleResponse.status).toBe(200);
      expect(editorBundle).toContain('EditorView');

      const projectResponse = await fetch(`${url}api/project`);
      const projectPayload = await projectResponse.json();
      expect(projectResponse.status).toBe(200);
      expect(projectPayload.initialFile).toBe('deck.md');
      expect(projectPayload.tree.children.some(node => node.path === 'deck.md')).toBe(true);

      const docsResponse = await fetch(`${url}api/docs?page=cli`);
      const docsPayload = await docsResponse.json();
      expect(docsResponse.status).toBe(200);
      expect(docsPayload.page.slug).toBe('cli');
      expect(docsPayload.page.content).toContain('CLI Reference');

      const docsRouteResponse = await fetch(`${url}docs/getting-started`);
      expect(docsRouteResponse.status).toBe(200);

      const fileResponse = await fetch(`${url}api/file?path=deck.md`);
      const filePayload = await fileResponse.json();
      expect(fileResponse.status).toBe(200);
      expect(filePayload.content).toContain('Studio Test');

      const previewResponse = await fetch(`${url}api/preview?path=deck.md`);
      const previewPayload = await previewResponse.json();
      expect(previewResponse.status).toBe(200);
      expect(previewPayload.preview.slides).toHaveLength(1);

      const unsavedPreviewResponse = await fetch(`${url}api/preview?path=deck.md`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          content: '# Live Preview\n\nChanged before saving'
        })
      });
      const unsavedPreviewPayload = await unsavedPreviewResponse.json();
      expect(unsavedPreviewResponse.status).toBe(200);
      expect(unsavedPreviewPayload.preview.slides[0].blocks[0].text).toBe('Live Preview');

      const exportResponse = await fetch(`${url}api/export`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          path: 'deck.md',
          format: 'pdf',
          content: '# Exported Deck\n\nBuilt in Studio'
        })
      });
      const exportPayload = await exportResponse.json();
      expect(exportResponse.status).toBe(200);
      expect(exportPayload.ok).toBe(true);
      expect(Array.isArray(exportPayload.diagnostics)).toBe(true);
      expect(existsSync(exportPayload.outputPath)).toBe(true);

      const saveResponse = await fetch(`${url}api/file`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          path: 'deck.md',
          content: '# Saved Title\n\nPersisted from Studio'
        })
      });
      const savePayload = await saveResponse.json();
      expect(saveResponse.status).toBe(200);
      expect(savePayload.ok).toBe(true);
      expect(readFileSync(entryPath, 'utf8')).toContain('Saved Title');
    } finally {
      await new Promise((resolvePromise, rejectPromise) => {
        server.close(error => {
          if (error) {
            rejectPromise(error);
            return;
          }
          resolvePromise();
        });
      });
    }
  });
});
