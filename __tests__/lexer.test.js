import { tokenize, TokenType } from '../src/lexer.js';

describe('Lexer', () => {
  describe('Basic Tokens', () => {
    test('tokenizes simple text', () => {
      const tokens = tokenize('Hello World');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe(TokenType.TEXT);
      expect(tokens[0].value).toBe('Hello World');
      expect(tokens[1].type).toBe(TokenType.EOF);
    });

    test('tokenizes heading', () => {
      const tokens = tokenize('# Hello');
      expect(tokens[0].type).toBe(TokenType.HEADING);
      expect(tokens[0].value.level).toBe(1);
      expect(tokens[0].value.text).toBe('Hello');
    });

    test('tokenizes multi-level headings', () => {
      const tokens = tokenize('## Heading 2\n### Heading 3');
      expect(tokens[0].type).toBe(TokenType.HEADING);
      expect(tokens[0].value.level).toBe(2);
      expect(tokens[1].type).toBe(TokenType.HEADING);
      expect(tokens[1].value.level).toBe(3);
    });
  });

  describe('Slide Breaks', () => {
    test('tokenizes slide break with newlines', () => {
      const tokens = tokenize('# Slide 1\n\n---\n\n# Slide 2');
      expect(tokens[0].type).toBe(TokenType.HEADING);
      expect(tokens[1].type).toBe(TokenType.SLIDE_BREAK);
      expect(tokens[2].type).toBe(TokenType.HEADING);
    });

    test('tokenizes slide break with multiple empty lines', () => {
      const tokens = tokenize('# Slide 1\n\n\n\n---\n\n\n# Slide 2');
      expect(tokens[0].type).toBe(TokenType.HEADING);
      expect(tokens[1].type).toBe(TokenType.SLIDE_BREAK);
    });
  });

  describe('Frontmatter', () => {
    test('tokenizes frontmatter at start', () => {
      const tokens = tokenize('---\ntitle: Test\n---\n# Slide');
      expect(tokens[0].type).toBe(TokenType.FRONTMATTER);
      expect(tokens[0].value).toContain('title: Test');
      expect(tokens[1].type).toBe(TokenType.HEADING);
    });

    test('tokenizes frontmatter with nested YAML', () => {
      const tokens = tokenize('---\npage:\n  width: 1280\n---\n# Slide');
      expect(tokens[0].type).toBe(TokenType.FRONTMATTER);
      expect(tokens[0].value).toContain('page:');
      expect(tokens[0].value).toContain('width: 1280');
    });
  });

  describe('Attributes', () => {
    test('tokenizes inline attribute', () => {
      const tokens = tokenize('{{ center }}');
      expect(tokens[0].type).toBe(TokenType.ATTRIBUTE);
      expect(tokens[0].value).toBe('center');
    });

    test('tokenizes key:value attribute', () => {
      const tokens = tokenize('{{ width: 60% }}');
      expect(tokens[0].type).toBe(TokenType.ATTRIBUTE);
      expect(tokens[0].value).toBe('width: 60%');
    });

    test('tokenizes multiple attributes', () => {
      const tokens = tokenize('{{ center middle }}');
      expect(tokens[0].type).toBe(TokenType.ATTRIBUTE);
      expect(tokens[0].value).toBe('center middle');
    });
  });

  describe('Code Blocks', () => {
    test('tokenizes code block with language', () => {
      const tokens = tokenize('```javascript\nconst x = 1;\n```');
      expect(tokens[0].type).toBe(TokenType.CODE_BLOCK);
      expect(tokens[0].value.language).toBe('javascript');
      expect(tokens[0].value.content).toContain('const x = 1');
    });

    test('tokenizes code block without language', () => {
      const tokens = tokenize('```\ncode here\n```');
      expect(tokens[0].type).toBe(TokenType.CODE_BLOCK);
      expect(tokens[0].value.language).toBe('');
    });

    test('tokenizes block math fenced with double dollars', () => {
      const tokens = tokenize('$$\nE = mc^2\n$$');
      expect(tokens[0].type).toBe(TokenType.MATH_BLOCK);
      expect(tokens[0].value).toContain('E = mc^2');
    });
  });

  describe('Images', () => {
    test('tokenizes image', () => {
      const tokens = tokenize('![Alt text](image.png)');
      expect(tokens[0].type).toBe(TokenType.IMAGE);
      expect(tokens[0].value.alt).toBe('Alt text');
      expect(tokens[0].value.url).toBe('image.png');
    });
  });

  describe('Imports', () => {
    test('tokenizes import directive', () => {
      const tokens = tokenize('@import[theme.yml]');
      expect(tokens[0].type).toBe(TokenType.IMPORT);
      expect(tokens[0].value).toBe('theme.yml');
      expect(tokens[1].type).toBe(TokenType.EOF);
    });

    test('tokenizes plain at-sign text without hanging', () => {
      const tokens = tokenize('Email me @home');
      expect(tokens[0].type).toBe(TokenType.TEXT);
      expect(tokens[0].value).toBe('Email me @home');
      expect(tokens[1].type).toBe(TokenType.EOF);
    });
  });

  describe('EOF', () => {
    test('adds EOF token at end', () => {
      const tokens = tokenize('# Hello');
      expect(tokens[1].type).toBe(TokenType.EOF);
    });
  });
});
