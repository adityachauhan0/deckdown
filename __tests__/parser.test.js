import { tokenize } from '../src/lexer.js';
import { parse } from '../src/parser.js';

describe('Parser', () => {
  describe('Basic Structure', () => {
    test('creates document with empty slides array', () => {
      const tokens = tokenize('');
      const doc = parse(tokens);
      expect(doc.type).toBe('Document');
      expect(doc.slides).toEqual([]);
    });

    test('creates document with metadata', () => {
      const tokens = tokenize('---\ntitle: Test\n---\n# Slide');
      const doc = parse(tokens);
      expect(doc.metadata).toBeDefined();
      expect(doc.metadata.title).toBe('Test');
    });
  });

  describe('Slides', () => {
    test('creates single slide from content', () => {
      const tokens = tokenize('# Hello\nSome text');
      const doc = parse(tokens);
      expect(doc.slides).toHaveLength(1);
      expect(doc.slides[0].blocks).toHaveLength(2);
    });

    test('creates multiple slides from slide breaks', () => {
      const tokens = tokenize('# Slide 1\n---\n# Slide 2');
      const doc = parse(tokens);
      expect(doc.slides).toHaveLength(2);
      expect(doc.slides[0].blocks[0].type).toBe('heading');
      expect(doc.slides[1].blocks[0].type).toBe('heading');
    });

    test('handles slide with only heading', () => {
      const tokens = tokenize('# Only Heading');
      const doc = parse(tokens);
      expect(doc.slides).toHaveLength(1);
      expect(doc.slides[0].blocks).toHaveLength(1);
    });
  });

  describe('Blocks', () => {
    test('parses heading block', () => {
      const tokens = tokenize('# Title');
      const doc = parse(tokens);
      expect(doc.slides[0].blocks[0].type).toBe('heading');
      expect(doc.slides[0].blocks[0].level).toBe(1);
      expect(doc.slides[0].blocks[0].text).toBe('Title');
    });

    test('parses paragraph block', () => {
      const tokens = tokenize('Some text content');
      const doc = parse(tokens);
      expect(doc.slides[0].blocks[0].type).toBe('paragraph');
      expect(doc.slides[0].blocks[0].text).toBe('Some text content');
    });

    test('parses code block', () => {
      const tokens = tokenize('```javascript\nconst x = 1;\n```');
      const doc = parse(tokens);
      expect(doc.slides[0].blocks[0].type).toBe('code');
      expect(doc.slides[0].blocks[0].language).toBe('javascript');
      expect(doc.slides[0].blocks[0].content).toContain('const x = 1');
    });

    test('parses mermaid fences into diagram blocks', () => {
      const tokens = tokenize('```mermaid\ngraph TD\n  A --> B\n```');
      const doc = parse(tokens);
      expect(doc.slides[0].blocks[0].type).toBe('mermaid');
      expect(doc.slides[0].blocks[0].content).toContain('graph TD');
    });

    test('parses block math into math blocks', () => {
      const tokens = tokenize('$$\n\\int_0^1 x^2 dx\n$$');
      const doc = parse(tokens);
      expect(doc.slides[0].blocks[0].type).toBe('math');
      expect(doc.slides[0].blocks[0].formula).toContain('\\int_0^1');
    });

    test('parses image block', () => {
      const tokens = tokenize('![Alt](image.png)');
      const doc = parse(tokens);
      expect(doc.slides[0].blocks[0].type).toBe('image');
      expect(doc.slides[0].blocks[0].alt).toBe('Alt');
      expect(doc.slides[0].blocks[0].url).toBe('image.png');
    });

    test('parses block with attributes', () => {
      const tokens = tokenize('# Title {{ center middle }}');
      const doc = parse(tokens);
      expect(doc.slides[0].blocks[0].type).toBe('heading');
      expect(doc.slides[0].blocks[0].attributes).toBeDefined();
      expect(doc.slides[0].blocks[0].attributes).toContain('center');
      expect(doc.slides[0].blocks[0].attributes).toContain('middle');
    });

    test('skips empty text tokens', () => {
      const tokens = tokenize('\n\n# Title');
      const doc = parse(tokens);
      expect(doc.slides[0].blocks).toHaveLength(1);
    });
  });

  describe('Attributes', () => {
    test('attaches trailing attributes to the preceding block', () => {
      const tokens = tokenize('# Title\n{{ center }}\nBody');
      const doc = parse(tokens);
      expect(doc.slides[0].attributes).toEqual([]);
      expect(doc.slides[0].blocks[0].attributes).toContain('center');
    });

    test('keeps control attributes leading for the following block', () => {
      const tokens = tokenize('{{ cols: 2 }}\n# Title');
      const doc = parse(tokens);
      expect(doc.slides[0].attributes).toEqual([]);
      expect(doc.slides[0].blocks[0].attributes).toContain('cols: 2');
    });

    test('splits multiple standalone attributes', () => {
      const tokens = tokenize('{{ center middle }}\n# Title');
      const doc = parse(tokens);
      expect(doc.slides[0].blocks[0].attributes).toContain('center');
      expect(doc.slides[0].blocks[0].attributes).toContain('middle');
    });

    test('splits mixed key value and flag attributes', () => {
      const tokens = tokenize('![Alt](image.png)\n{{ width: 72% center }}');
      const doc = parse(tokens);
      expect(doc.slides[0].blocks[0].attributes).toContain('width: 72%');
      expect(doc.slides[0].blocks[0].attributes).toContain('center');
    });
  });
});
