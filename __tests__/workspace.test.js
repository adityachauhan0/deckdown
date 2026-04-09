import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace } from '../src/workspace.js';

describe('workspace scaffolding', () => {
  test('creates a deterministic starter workspace', () => {
    const targetDir = mkdtempSync(join(tmpdir(), 'deckdown-workspace-'));

    const result = createWorkspace(targetDir);

    expect(result.entryFile).toBe('deck.md');
    expect(result.templateId).toBe('presentation-16x9');
    expect(existsSync(join(targetDir, 'deck.md'))).toBe(true);
    expect(existsSync(join(targetDir, 'theme.yaml'))).toBe(true);
    expect(existsSync(join(targetDir, 'notes', 'inbox.md'))).toBe(true);
    expect(existsSync(join(targetDir, 'assets', '.gitkeep'))).toBe(true);
    expect(existsSync(join(targetDir, '.deckdown', 'workspace.json'))).toBe(true);
    expect(existsSync(join(targetDir, 'AGENTS.md'))).toBe(true);
    expect(readFileSync(join(targetDir, 'deck.md'), 'utf8')).toContain('# Welcome to DeckDown');
    const themeContent = readFileSync(join(targetDir, 'theme.yaml'), 'utf8');
    expect(themeContent).toContain('# DeckDown theme starter');
    expect(themeContent).toContain('# Uncomment, tweak, and compare:');
    expect(themeContent).toContain('# Example component overrides for future shared theme fragments:');
    expect(themeContent).toContain('# Example design tokens for brand palettes or shared surfaces:');
    expect(readFileSync(join(targetDir, 'AGENTS.md'), 'utf8')).toContain('DeckDown');
  });

  test('does not overwrite an existing workspace without force', () => {
    const targetDir = mkdtempSync(join(tmpdir(), 'deckdown-workspace-'));

    createWorkspace(targetDir);

    expect(() => createWorkspace(targetDir)).toThrow('Workspace already exists');
  });

  test('creates template-specific page frontmatter and workspace metadata', () => {
    const targetDir = mkdtempSync(join(tmpdir(), 'deckdown-workspace-template-'));

    const result = createWorkspace(targetDir, {
      templateId: 'paper-letter'
    });

    expect(result.templateId).toBe('paper-letter');
    expect(readFileSync(join(targetDir, 'deck.md'), 'utf8')).toContain('width: 1056');
    expect(readFileSync(join(targetDir, 'deck.md'), 'utf8')).toContain('height: 816');
    expect(readFileSync(join(targetDir, '.deckdown', 'workspace.json'), 'utf8')).toContain('"templateId": "paper-letter"');
  });

  test('supports custom page presets during workspace creation', () => {
    const targetDir = mkdtempSync(join(tmpdir(), 'deckdown-workspace-custom-'));

    const result = createWorkspace(targetDir, {
      templateId: 'custom',
      customPage: {
        width: 1600,
        height: 900,
        margin: 72
      }
    });

    expect(result.templateId).toBe('custom');
    expect(readFileSync(join(targetDir, 'deck.md'), 'utf8')).toContain('width: 1600');
    expect(readFileSync(join(targetDir, 'deck.md'), 'utf8')).toContain('height: 900');
    expect(readFileSync(join(targetDir, 'deck.md'), 'utf8')).toContain('margin: 72');
  });
});
