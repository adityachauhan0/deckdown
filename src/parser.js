// Deckdown - Parser
// Builds AST from tokens

import { TokenType } from './lexer.js';
import yaml from 'js-yaml';

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
    
    while (this.current().type !== TokenType.EOF) {
      const token = this.current();
      
      switch (token.type) {
        case TokenType.SLIDE_BREAK:
          document.slides.push(currentSlide);
          currentSlide = this.createSlide();
          pendingAttributes = [];
          break;
          
        case TokenType.HEADING:
          currentSlide.blocks.push({
            type: 'heading',
            ...token.value,
            attributes: [...pendingAttributes]
          });
          pendingAttributes = [];
          break;
          
        case TokenType.CODE_BLOCK:
          currentSlide.blocks.push({
            type: 'code',
            ...token.value,
            attributes: [...pendingAttributes]
          });
          pendingAttributes = [];
          break;
          
        case TokenType.IMAGE:
          currentSlide.blocks.push({
            type: 'image',
            ...token.value,
            attributes: [...pendingAttributes]
          });
          pendingAttributes = [];
          break;
          
        case TokenType.TEXT:
          // Skip empty text tokens
          if (token.value.trim() === '') {
            break;
          }
          currentSlide.blocks.push({
            type: 'paragraph',
            text: token.value,
            attributes: [...pendingAttributes]
          });
          pendingAttributes = [];
          break;
          
        case TokenType.ATTRIBUTE:
          pendingAttributes.push(token.value);
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