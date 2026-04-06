import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createProgram, validateOutputTarget } from '../src/index.js';

describe('CLI contract', () => {
  test('help does not advertise watch mode', () => {
    expect(createProgram('1.0.0').helpInformation()).not.toContain('--watch');
  });

  test('help advertises the Studio command', () => {
    expect(createProgram('1.0.0').helpInformation()).toContain('studio');
  });

  test('help advertises the init command', () => {
    expect(createProgram('1.0.0').helpInformation()).toContain('init');
  });

  test('allows PDF output without an explicit output path', () => {
    expect(() => validateOutputTarget('pdf')).not.toThrow();
  });

  test('requires an output directory for PNG renders', () => {
    expect(() => validateOutputTarget('png')).toThrow('PNG output requires --output <directory>.');
  });

  test('requires an output file for PPTX renders', () => {
    expect(() => validateOutputTarget('pptx')).toThrow('PPTX output requires --output <file>.');
  });

  test('rejects a file path for PNG output', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'deckdown-cli-'));
    const filePath = join(tempDir, 'out.pdf');
    writeFileSync(filePath, 'x');

    expect(() => validateOutputTarget('png', filePath)).toThrow(`PNG output path must be a directory: ${filePath}`);
  });

  test('rejects a directory path for PDF and PPTX output', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'deckdown-cli-'));
    const outputDir = join(tempDir, 'slides');
    mkdirSync(outputDir);

    expect(() => validateOutputTarget('pdf', outputDir)).toThrow(`PDF output path must be a file: ${outputDir}`);
    expect(() => validateOutputTarget('pptx', outputDir)).toThrow(`PPTX output path must be a file: ${outputDir}`);
  });
});
