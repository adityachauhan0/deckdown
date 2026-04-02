import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { tokenize } from '../src/lexer.js';
import { parse } from '../src/parser.js';
import { resolveImports } from '../src/resolver.js';
import { layoutDocument } from '../src/layout.js';
import { renderPDF } from '../src/renderer-pdf.js';
import { renderPNG } from '../src/renderer-png.js';
import { renderPPTX } from '../src/renderer-pptx.js';
import sharp from 'sharp';
import yaml from 'js-yaml';

function mergeConfig(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (typeof override[key] === 'object' && !Array.isArray(override[key]) && result[key] !== undefined) {
      result[key] = mergeConfig(result[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

describe('Full Pipeline', () => {
  const tempFiles = [];

  afterAll(() => {
    tempFiles.forEach(f => {
      if (existsSync(f)) {
        try { rmSync(f, { recursive: true, force: true }); } catch {}
      }
    });
  });

  describe('Tokenize → Parse → Layout', () => {
    test('processes simple markdown', () => {
      const content = '# Hello\n\nWorld';
      const { content: resolved } = resolveImports(content, 'test.md');
      const tokens = tokenize(resolved);
      const doc = parse(tokens);
      
      expect(doc.slides).toHaveLength(1);
      expect(doc.slides[0].blocks).toHaveLength(2);
    });

    test('processes markdown with frontmatter', () => {
      const content = `---\ntitle: Test\n---\n# Slide`;
      const { content: resolved } = resolveImports(content, 'test.md');
      const tokens = tokenize(resolved);
      const doc = parse(tokens);
      
      expect(doc.metadata.title).toBe('Test');
      expect(doc.slides).toHaveLength(1);
    });

    test('processes markdown with slide breaks', () => {
      const content = '# Slide 1\n---\n# Slide 2';
      const { content: resolved } = resolveImports(content, 'test.md');
      const tokens = tokenize(resolved);
      const doc = parse(tokens);
      
      expect(doc.slides).toHaveLength(2);
    });

    test('applies page dimensions from frontmatter', () => {
      const content = `---\npage:\n  width: 1280\n  height: 720\n---\n# Slide`;
      const { content: resolved } = resolveImports(content, 'test.md');
      const tokens = tokenize(resolved);
      const doc = parse(tokens);
      
      let mergedConfig = {};
      const metadata = mergeConfig(mergedConfig, doc.metadata);
      
      const layoutOptions = {
        page: {
          width: metadata.page?.width || 1920,
          height: metadata.page?.height || 1080
        }
      };
      
      const layout = layoutDocument(doc, layoutOptions);
      expect(layout.page.width).toBe(1280);
      expect(layout.page.height).toBe(720);
    });

    test('applies theme colors from frontmatter', () => {
      const content = `---\ntheme:\n  colors:\n    background: '#1a1a2e'\n    text: '#eaeaea'\n---\n# Slide`;
      const { content: resolved } = resolveImports(content, 'test.md');
      const tokens = tokenize(resolved);
      const doc = parse(tokens);
      
      const layoutOptions = {
        theme: doc.metadata.theme || {}
      };
      const layout = layoutDocument(doc, layoutOptions);
      expect(layout.theme.colors.background).toBe('#1a1a2e');
      expect(layout.theme.colors.text).toBe('#eaeaea');
    });
  });

  describe('PDF Rendering', () => {
    test('generates valid PDF', async () => {
      const content = '# Test\n\nHello World';
      const { content: resolved } = resolveImports(content, 'test.md');
      const tokens = tokenize(resolved);
      const doc = parse(tokens);
      const layout = layoutDocument(doc, {});
      
      const outputPath = '/tmp/deckdown-test.pdf';
      tempFiles.push(outputPath);
      
      await renderPDF(layout, outputPath);
      
      const stats = existsSync(outputPath);
      expect(stats).toBe(true);
      
      if (stats) {
        const buffer = readFileSync(outputPath);
        expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
      }
    });

    test('generates PDF with custom page size', async () => {
      const content = `---\ntitle: Test\npage:\n  width: 800\n  height: 600\n---\n# Test\n# Slide`;
      const { content: resolved } = resolveImports(content, 'test.md');
      const tokens = tokenize(resolved);
      const doc = parse(tokens);
      
      let mergedConfig = {};
      const metadata = mergeConfig(mergedConfig, doc.metadata);
      
      const layoutOptions = {
        page: {
          width: metadata.page?.width || 1920,
          height: metadata.page?.height || 1080
        }
      };
      
      const layout = layoutDocument(doc, layoutOptions);
      expect(layout.page.width).toBe(800);
      expect(layout.page.height).toBe(600);
    });
  });

  describe('Import Resolution', () => {
    test('resolves YAML imports', () => {
      const content = '@import[package.json]';
      const { content: resolved, yamlImports } = resolveImports(content, 'test.md');
      
      expect(resolved).toBeDefined();
      expect(yamlImports.length).toBeGreaterThan(0);
    });

    test('resolves relative images inside imported markdown', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'deckdown-import-'));
      tempFiles.push(tempDir);

      const importsDir = join(tempDir, 'imports');
      mkdirSync(importsDir);

      const imagePath = join(importsDir, 'fixture.png');
      writeFileSync(imagePath, Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Xf9kAAAAASUVORK5CYII=',
        'base64'
      ));

      const importedPath = join(importsDir, 'slide.md');
      writeFileSync(importedPath, '# Imported Slide\n\n![Fixture](./fixture.png)\n');

      const entryPath = join(tempDir, 'deck.md');
      writeFileSync(entryPath, '@import[imports/slide.md]\n');

      const { content: resolved } = resolveImports('@import[imports/slide.md]\n', entryPath);
      expect(resolved).toContain(imagePath);

      const tokens = tokenize(resolved);
      const doc = parse(tokens);
      const layout = layoutDocument(doc, {});
      const imageBlock = layout.slides[0].blocks.find(block => block.type === 'image');

      expect(imageBlock?.src).toBe(imagePath);

      const pdfPath = join(tempDir, 'out.pdf');
      const pngDir = join(tempDir, 'png-out');
      tempFiles.push(pdfPath, pngDir);

      await renderPDF(layout, pdfPath);
      await renderPNG(layout, pngDir);

      expect(existsSync(pdfPath)).toBe(true);
      expect(existsSync(join(pngDir, 'slide-001.png'))).toBe(true);
    });

    test('renders a generated cover PNG and JPG through the real output paths', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'deckdown-images-'));
      tempFiles.push(tempDir);

      const assetsDir = join(tempDir, 'assets');
      const slidesDir = join(tempDir, 'slides');
      mkdirSync(assetsDir);
      mkdirSync(slidesDir);

      const pngPath = join(assetsDir, 'cover.png');
      const jpgPath = join(assetsDir, 'cover.jpg');

      await sharp({
        create: {
          width: 640,
          height: 360,
          channels: 4,
          background: { r: 20, g: 30, b: 60, alpha: 1 }
        }
      }).png().toFile(pngPath);

      await sharp({
        create: {
          width: 640,
          height: 360,
          channels: 4,
          background: { r: 120, g: 224, b: 255, alpha: 1 }
        }
      }).jpeg({ quality: 90 }).toFile(jpgPath);

      const importedPath = join(slidesDir, 'cover.md');
      writeFileSync(
        importedPath,
        [
          '# Generated Cover',
          '',
          '![PNG cover](../assets/cover.png)',
          '',
          '---',
          '',
          '# Generated JPEG',
          '',
          '![JPG cover](../assets/cover.jpg)'
        ].join('\n')
      );

      const entryPath = join(tempDir, 'deck.md');
      writeFileSync(entryPath, '@import[slides/cover.md]\n');

      const { content: resolved } = resolveImports('@import[slides/cover.md]\n', entryPath);
      expect(resolved).toContain(pngPath);
      expect(resolved).toContain(jpgPath);

      const tokens = tokenize(resolved);
      const doc = parse(tokens);
      const layout = layoutDocument(doc, {});

      expect(layout.slides).toHaveLength(2);
      expect(layout.slides[0].blocks.some(block => block.type === 'image' && block.src === pngPath)).toBe(true);
      expect(layout.slides[1].blocks.some(block => block.type === 'image' && block.src === jpgPath)).toBe(true);

      const pdfPath = join(tempDir, 'cover.pdf');
      const pngDir = join(tempDir, 'cover-png');
      const pptxPath = join(tempDir, 'cover.pptx');
      tempFiles.push(pdfPath, pngDir, pptxPath);

      await renderPDF(layout, pdfPath);
      await renderPNG(layout, pngDir);
      await renderPPTX(layout, pptxPath);

      expect(existsSync(pdfPath)).toBe(true);
      expect(existsSync(join(pngDir, 'slide-001.png'))).toBe(true);
      expect(existsSync(join(pngDir, 'slide-002.png'))).toBe(true);
      expect(existsSync(pptxPath)).toBe(true);
    });
  });
});
