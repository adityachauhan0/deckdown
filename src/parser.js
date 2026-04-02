// Deckdown - Parser
// Builds AST from tokens

import { TokenType } from './lexer.js';
import yaml from 'js-yaml';

function expandAttributeTokens(value) {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const tokens = [];
  let rest = trimmed;

  while (rest.length > 0) {
    const kvMatch = rest.match(/^(\w+):\s*([^\s]+)(?:\s+|$)/);
    if (kvMatch) {
      tokens.push(`${kvMatch[1]}: ${kvMatch[2]}`);
      rest = rest.slice(kvMatch[0].length).trim();
      continue;
    }

    const flagMatch = rest.match(/^([^\s]+)(?:\s+|$)/);
    if (!flagMatch) {
      break;
    }

    tokens.push(flagMatch[1]);
    rest = rest.slice(flagMatch[0].length).trim();
  }

  return tokens;
}

function normalizeAttributes(values = []) {
  return values.flatMap(value => expandAttributeTokens(value));
}

function isControlAttribute(value) {
  const trimmed = value.trim();
  return (
    trimmed.startsWith('cols:') ||
    trimmed === 'col: break' ||
    trimmed.startsWith('grid:') ||
    trimmed.startsWith('cell:') ||
    trimmed === 'cover' ||
    trimmed === 'contain'
  );
}

export class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parse() {
    const document = {
      type: 'Document',
      metadata: {},
      slides: []
    };

    // Handle frontmatter
    if (this.current().type === TokenType.FRONTMATTER) {
      document.metadata = this.parseFrontmatter(this.current().value);
      this.advance();
    }

    // Handle slides
    let currentSlide = this.createSlide();
    let pendingAttributes = [];
    let lastBlock = null;
    
    while (this.current().type !== TokenType.EOF) {
      const token = this.current();
      
      switch (token.type) {
        case TokenType.SLIDE_BREAK:
          document.slides.push(currentSlide);
          currentSlide = this.createSlide();
          pendingAttributes = [];
          lastBlock = null;
          break;
          
        case TokenType.HEADING:
          currentSlide.blocks.push(this.createBlock({
            type: 'heading',
            ...token.value,
            attributes: [...pendingAttributes, ...normalizeAttributes(token.value.attributes)]
          }));
          pendingAttributes = [];
          lastBlock = currentSlide.blocks[currentSlide.blocks.length - 1];
          break;
          
        case TokenType.CODE_BLOCK:
          currentSlide.blocks.push(this.createBlock({
            type: 'code',
            ...token.value,
            attributes: [...pendingAttributes, ...normalizeAttributes(token.value.attributes)]
          }));
          pendingAttributes = [];
          lastBlock = currentSlide.blocks[currentSlide.blocks.length - 1];
          break;
          
        case TokenType.IMAGE:
          currentSlide.blocks.push(this.createBlock({
            type: 'image',
            ...token.value,
            attributes: [...pendingAttributes, ...normalizeAttributes(token.value.attributes)]
          }));
          pendingAttributes = [];
          lastBlock = currentSlide.blocks[currentSlide.blocks.length - 1];
          break;
          
        case TokenType.TEXT:
          // Skip empty text tokens
          if (token.value.trim() === '') {
            break;
          }
          currentSlide.blocks.push(this.createBlock({
            type: 'paragraph',
            text: token.value,
            attributes: [...pendingAttributes, ...normalizeAttributes(token.value.attributes)]
          }));
          pendingAttributes = [];
          lastBlock = currentSlide.blocks[currentSlide.blocks.length - 1];
          break;
          
        case TokenType.ATTRIBUTE:
          const attrTokens = expandAttributeTokens(token.value);
          for (const attr of attrTokens) {
            if (lastBlock && pendingAttributes.length === 0 && !isControlAttribute(attr)) {
              lastBlock.attributes.push(attr);
            } else {
              pendingAttributes.push(attr);
            }
          }
          break;
          
        case TokenType.IMPORT:
          // Imports are resolved in pre-processing
          break;
      }
      
      this.advance();
    }
    
    // Don't forget the last slide
    if (currentSlide.blocks.length > 0 || currentSlide.attributes.length > 0) {
      document.slides.push(currentSlide);
    }
    
    return document;
  }

  createSlide() {
    return {
      type: 'Slide',
      blocks: [],
      attributes: []
    };
  }

  createBlock(block) {
    return {
      ...block,
      attributes: block.attributes ? [...block.attributes] : []
    };
  }

  parseFrontmatter(content) {
    try {
      return yaml.load(content) || {};
    } catch (err) {
      console.error(`Warning: Failed to parse YAML frontmatter: ${err.message}`);
      return {};
    }
  }

  current() {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: '', line: 0 };
  }

  advance() {
    this.pos++;
    return this.current();
  }
}

export function parse(tokens) {
  const parser = new Parser(tokens);
  return parser.parse();
}
