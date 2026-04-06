import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildPresentation } from '../src/index.js';

describe('buildPresentation diagnostics', () => {
  test('reports an error when the deck source is empty', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'deckdown-build-'));
    const entryPath = join(tempDir, 'empty-deck.md');
    writeFileSync(entryPath, '   \n\n');

    const result = await buildPresentation(entryPath);

    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'error',
        message: 'Deck is empty.'
      })
    ]));
  });

  test('reports missing title and missing local images', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'deckdown-build-'));
    const entryPath = join(tempDir, 'untitled-deck.md');
    writeFileSync(entryPath, 'Intro paragraph\n\n![Missing](./assets/does-not-exist.png)\n');

    const result = await buildPresentation(entryPath);
    const messages = result.diagnostics.map(diagnostic => diagnostic.message);

    expect(messages).toContain('Deck has no title. Add frontmatter `title` or a heading on the first slide.');
    expect(messages).toContain(`Image asset not found: ${join(tempDir, 'assets', 'does-not-exist.png')}`);
  });
});
