import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { startStudioServer } from '../src/studio/server.js';

describe('Studio server regressions', () => {
  test('bootstrap responses refresh tree state after project initialization', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'deckdown-studio-bootstrap-'));
    const { server, url } = await startStudioServer(tempDir, {
      port: 0,
      open: false,
      quiet: true
    });

    try {
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
      expect(initPayload.ok).toBe(true);
      expect(initPayload.entryFile).toBe('deck.md');
      expect(initPayload.canBootstrap).toBe(false);
      expect(initPayload.bootstrap).toBeNull();
      expect(initPayload.tree.children.some(node => node.path === 'deck.md')).toBe(true);

      const projectResponse = await fetch(`${url}api/project`);
      const projectPayload = await projectResponse.json();
      expect(projectResponse.status).toBe(200);
      expect(projectPayload.initialFile).toBe('deck.md');
      expect(projectPayload.canBootstrap).toBe(false);
      expect(projectPayload.bootstrap).toBeNull();
      expect(projectPayload.tree.children.some(node => node.path === 'deck.md')).toBe(true);
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

  test('keeps export targets unique for decks that share a basename', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'deckdown-studio-export-'));
    const subDir = join(tempDir, 'nested', 'a');
    const otherDir = join(tempDir, 'nested', 'b');
    mkdirSync(subDir, { recursive: true });
    mkdirSync(otherDir, { recursive: true });

    const firstPath = join(subDir, 'deck.md');
    const secondPath = join(otherDir, 'deck.md');
    writeFileSync(firstPath, '# First\n\nDeck');
    writeFileSync(secondPath, '# Second\n\nDeck');

    const { server, url } = await startStudioServer(tempDir, {
      port: 0,
      open: false,
      quiet: true
    });

    try {
      const firstResponse = await fetch(`${url}api/export`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          path: 'nested/a/deck.md',
          format: 'pdf',
          content: '# First\n\nDeck'
        })
      });
      const firstPayload = await firstResponse.json();

      const secondResponse = await fetch(`${url}api/export`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          path: 'nested/b/deck.md',
          format: 'pdf',
          content: '# Second\n\nDeck'
        })
      });
      const secondPayload = await secondResponse.json();

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
      expect(firstPayload.outputPath).not.toBe(secondPayload.outputPath);
      expect(firstPayload.outputPath).toContain(join('dist', 'studio-exports', 'nested', 'a'));
      expect(secondPayload.outputPath).toContain(join('dist', 'studio-exports', 'nested', 'b'));
      expect(existsSync(firstPayload.outputPath)).toBe(true);
      expect(existsSync(secondPayload.outputPath)).toBe(true);
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

  test('rejects export requests for non-Markdown files with a clear error', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'deckdown-studio-export-reject-'));
    writeFileSync(join(tempDir, 'notes.txt'), 'Plain text');

    const { server, url } = await startStudioServer(tempDir, {
      port: 0,
      open: false,
      quiet: true
    });

    try {
      const response = await fetch(`${url}api/export`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          path: 'notes.txt',
          format: 'pdf',
          content: 'Plain text'
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.error).toBe('Export requires a Markdown deck file.');
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
