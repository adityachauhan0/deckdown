import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';
import { tokenize } from '../src/lexer.js';
import { parse } from '../src/parser.js';
import { resolveImports } from '../src/resolver.js';
import { layoutDocument } from '../src/layout.js';
import { renderPDF } from '../src/renderer-pdf.js';
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
        try { unlinkSync(f); } catch {}
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
  });
});