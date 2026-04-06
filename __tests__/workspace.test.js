import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace } from '../src/workspace.js';

describe('workspace scaffolding', () => {
  test('creates a deterministic starter workspace', () => {
    const targetDir = mkdtempSync(join(tmpdir(), 'deckdown-workspace-'));

    const result = createWorkspace(targetDir);

    expect(result.entryFile).toBe('deck.md');
    expect(existsSync(join(targetDir, 'deck.md'))).toBe(true);
    expect(existsSync(join(targetDir, 'theme.yaml'))).toBe(true);
    expect(existsSync(join(targetDir, 'notes', 'inbox.md'))).toBe(true);
    expect(existsSync(join(targetDir, 'assets', '.gitkeep'))).toBe(true);
    expect(existsSync(join(targetDir, '.deckdown', 'workspace.json'))).toBe(true);
    expect(readFileSync(join(targetDir, 'deck.md'), 'utf8')).toContain('# Welcome to DeckDown');
  });

  test('does not overwrite an existing workspace without force', () => {
    const targetDir = mkdtempSync(join(tmpdir(), 'deckdown-workspace-'));

    createWorkspace(targetDir);

    expect(() => createWorkspace(targetDir)).toThrow('Workspace already exists');
  });
});
