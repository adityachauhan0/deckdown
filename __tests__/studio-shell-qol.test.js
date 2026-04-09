import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { startStudioServer } from '../src/studio/server.js';

describe('Studio shell QoL surface', () => {
  test('serves helper modules and asset preview shell elements', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'deckdown-studio-shell-'));
    writeFileSync(join(tempDir, 'deck.md'), '# Shell Test');

    const { server, url } = await startStudioServer(tempDir, {
      port: 0,
      open: false,
      quiet: true
    });

    try {
      const htmlResponse = await fetch(url);
      const html = await htmlResponse.text();

      expect(htmlResponse.status).toBe(200);
      expect(html).toContain('id="asset-preview"');
      expect(html).toContain('id="asset-preview-meta"');

      const preferencesResponse = await fetch(`${url}studio-preferences.js`);
      const shortcutsResponse = await fetch(`${url}studio-shortcuts.js`);
      const documentPreviewResponse = await fetch(`${url}document-preview.js`);

      expect(preferencesResponse.status).toBe(200);
      expect(shortcutsResponse.status).toBe(200);
      expect(documentPreviewResponse.status).toBe(200);
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
