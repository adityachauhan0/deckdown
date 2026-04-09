// Deckdown - Lexer
// Tokenizes markdown input into meaningful units

export const TokenType = {
  IMPORT: 'IMPORT',
  SLIDE_BREAK: 'SLIDE_BREAK',
  FRONTMATTER: 'FRONTMATTER',
  HEADING: 'HEADING',
  CODE_BLOCK: 'CODE_BLOCK',
  MATH_BLOCK: 'MATH_BLOCK',
  IMAGE: 'IMAGE',
  TEXT: 'TEXT',
  ATTRIBUTE: 'ATTRIBUTE',
  TABLE_ROW: 'TABLE_ROW',
  EOF: 'EOF'
};

export class Lexer {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.line = 1;
    this.tokens = [];
    this.inFrontmatter = false;
  }

  tokenize() {
    this.inFrontmatter = false;
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const char = this.input[this.pos];
      const lineStart = this.isLineStart();
      
      if (this.input.startsWith('@import[', this.pos)) {
        this.tokens.push(this.readImport());
      } else if (this.input.startsWith('---', this.pos) && this.isLineStart()) {
        this.tokens.push(this.readSlideBreakOrFrontmatter());
      } else if (this.input.startsWith('$$', this.pos) && this.isLineStart()) {
        this.tokens.push(this.readMathBlock());
      } else if (char === '#' && this.isLineStart()) {
        this.tokens.push(this.readHeading());
      } else if (this.input.startsWith('```', this.pos)) {
        this.tokens.push(this.readCodeBlock());
      } else if (char === '!' && this.input[this.pos + 1] === '[') {
        this.tokens.push(this.readImage());
      } else if (char === '{' && this.input[this.pos + 1] === '{') {
        this.tokens.push(this.readAttribute());
      } else if (char === '|' && lineStart) {
        const rowToken = this.readTableRowOrText();
        if (rowToken !== null) {
          this.tokens.push(rowToken);
        }
      } else {
        this.tokens.push(this.readText());
      }
    }
    
    this.tokens.push({ type: TokenType.EOF, value: '', line: this.line });
    return this.tokens;
  }

  readTableRowOrText() {
    const start = this.pos;
    const startLine = this.line;
    const line = this.readLine().trim();

    if (this.isMarkdownTable(line)) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
      return { type: TokenType.TABLE_ROW, value: cells, line: startLine };
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').filter(c => c.trim() !== '');
      const isSeparator = cells.length >= 2 && cells.every(cell => /^[-:\s]+$/.test(cell.trim()));
      if (isSeparator) {
        return null;
      }
    }

    this.pos = start;
    this.line = startLine;
    return this.readText();
  }

  skipWhitespace() {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      if (this.input[this.pos] === '\n') this.line++;
      this.pos++;
    }
  }

  peekWord() {
    const start = this.pos;
    let word = '';
    while (this.pos < this.input.length && /[a-zA-Z]/.test(this.input[this.pos])) {
      word += this.input[this.pos];
      this.pos++;
    }
    this.pos = start;
    return word;
  }

  isLineStart() {
    return this.pos === 0 || this.input[this.pos - 1] === '\n';
  }

  readSlideBreakOrFrontmatter() {
    const start = this.pos;
    const startLine = this.line;
    this.pos += 3; // skip ---
    
    // If we're already in frontmatter, this --- is the closing delimiter
    if (this.inFrontmatter) {
      // Skip to end of line after ---
      while (this.input[this.pos] && this.input[this.pos] !== '\n') {
        this.pos++;
      }
      if (this.input[this.pos] === '\n') {
        this.pos++;
        this.line++;
      }
      this.inFrontmatter = false;
      return { type: TokenType.FRONTMATTER, value: '', line: startLine };
    }
    
    // Skip past newline after ---
    if (this.input[this.pos] === '\n') {
      this.pos++;
      this.line++;
    } else if (this.input[this.pos] === '\r') {
      this.pos++;
      if (this.input[this.pos] === '\n') {
        this.pos++;
        this.line++;
      }
    }
    
    // Look ahead to find the next non-empty line
    let lookaheadPos = this.pos;
    let lookaheadLine = this.line;
    // Skip any empty lines
    while (lookaheadPos < this.input.length) {
      // Skip newline characters and count them
      if (this.input[lookaheadPos] === '\n') {
        lookaheadPos++;
        lookaheadLine++;
        continue;
      }
      if (this.input[lookaheadPos] === '\r') {
        lookaheadPos++;
        if (lookaheadPos < this.input.length && this.input[lookaheadPos] === '\n') {
          lookaheadPos++;
        }
        lookaheadLine++;
        continue;
      }
      // Not a newline, this is the start of content
      break;
    }
    
    // Extract the next non-empty line
    let nextNonEmptyLine = '';
    let tempPos = lookaheadPos;
    while (tempPos < this.input.length && this.input[tempPos] !== '\n' && this.input[tempPos] !== '\r') {
      nextNonEmptyLine += this.input[tempPos];
      tempPos++;
    }
    nextNonEmptyLine = nextNonEmptyLine.trim();
    
    if (nextNonEmptyLine === '---') {
      // --- followed by --- = slide break
      this.pos = lookaheadPos;
      this.line = lookaheadLine;
      this.pos += 3;
      if (this.input[this.pos] === '\n') {
        this.pos++;
        this.line++;
      }
      return { type: TokenType.SLIDE_BREAK, value: '---', line: startLine };
    }
    
    // --- followed by content (not another ---) = potential frontmatter opening
    // But only treat as frontmatter if we're at the START of the document
    // (i.e., no content tokens have been emitted yet)
    if (this.tokens.length > 0) {
      // We've already emitted tokens, so this --- is a slide break
      this.pos = start + 3;
      // Skip to end of line
      while (this.input[this.pos] && this.input[this.pos] !== '\n') {
        this.pos++;
      }
      if (this.input[this.pos] === '\n') {
        this.pos++;
        this.line++;
      }
      return { type: TokenType.SLIDE_BREAK, value: '---', line: startLine };
    }
    
    // We're at the start, this is frontmatter
    this.inFrontmatter = true;
    
    // Position at content start
    let content = '';
    while (this.pos < this.input.length) {
      const lineContent = this.peekRestOfLine();
      if (lineContent.trim() === '---') {
        // This is the closing ---
        this.pos += 3;
        if (this.input[this.pos] === '\n') {
          this.pos++;
          this.line++;
        }
        this.inFrontmatter = false;
        break;
      }
      content += lineContent + '\n';
      this.skipToNextLine();
    }
    return { type: TokenType.FRONTMATTER, value: content.trim(), line: startLine };
  }

  readImport() {
    const start = this.pos;
    const startLine = this.line;
    this.pos += 7; // skip '@import'
    this.skipWhitespace();
    if (this.input[this.pos] !== '[') {
      throw new Error('Expected [ after @import');
    }
    this.pos++;
    const startBracket = this.pos;
    while (this.pos < this.input.length && this.input[this.pos] !== ']') {
      this.pos++;
    }
    const path = this.input.slice(startBracket, this.pos);
    this.pos++; // skip ]
    return { type: TokenType.IMPORT, value: path, line: startLine };
  }

  readHeading() {
    const start = this.pos;
    const startLine = this.line;
    let level = 0;
    while (this.pos < this.input.length && this.input[this.pos] === '#') {
      level++;
      this.pos++;
    }
    this.skipWhitespace();
    const line = this.readLine();
    const { text, attributes } = this.extractInlineAttributes(line.trim());
    return { type: TokenType.HEADING, value: { level, text, attributes }, line: startLine };
  }

  readCodeBlock() {
    const start = this.pos;
    const startLine = this.line;
    // Skip opening ```
    if (this.input.startsWith('```', this.pos)) {
      this.pos += 3;
      const language = this.readLine().trim();
      let content = '';
      while (this.pos < this.input.length) {
        if (this.input.startsWith('```', this.pos)) {
          this.pos += 3;
          break;
        }
        content += this.input[this.pos];
        if (this.input[this.pos] === '\n') this.line++;
        this.pos++;
      }
      return { type: TokenType.CODE_BLOCK, value: { language, content }, line: startLine };
    }
    // Single backtick - treat as text
    this.pos++;
    return { type: TokenType.TEXT, value: '`', line: startLine };
  }

  readMathBlock() {
    const startLine = this.line;
    this.pos += 2;

    if (this.input[this.pos] === '\r') {
      this.pos++;
    }
    if (this.input[this.pos] === '\n') {
      this.pos++;
      this.line++;
    }

    let content = '';
    while (this.pos < this.input.length) {
      if (this.input.startsWith('$$', this.pos) && this.isLineStart()) {
        this.pos += 2;
        if (this.input[this.pos] === '\r') {
          this.pos++;
        }
        if (this.input[this.pos] === '\n') {
          this.pos++;
          this.line++;
        }
        break;
      }

      content += this.input[this.pos];
      if (this.input[this.pos] === '\n') {
        this.line++;
      }
      this.pos++;
    }

    return { type: TokenType.MATH_BLOCK, value: content.trim(), line: startLine };
  }

  readImage() {
    const start = this.pos;
    const startLine = this.line;
    this.pos += 2; // skipuces ![
    const altStart = this.pos;
    while (this.pos < this.input.length && this.input[this.pos] !== ']') {
      this.pos++;
    }
    const alt = this.input.slice(altStart, this.pos);
    this.pos += 2; // skip ](
    const urlStart = this.pos;
    while (this.pos < this.input.length && this.input[this.pos] !== ')') {
      this.pos++;
    }
    const url = this.input.slice(urlStart, this.pos);
    this.pos++; // skip )
    return { type: TokenType.IMAGE, value: { alt, url }, line: startLine };
  }

  readAttribute() {
    const start = this.pos;
    const startLine = this.line;
    this.pos += 2; // skip {{
    const content = [];
    while (this.pos < this.input.length) {
      if (this.input.startsWith('}}', this.pos)) {
        this.pos += 2;
        break;
      }
      content.push(this.input[this.pos]);
      this.pos++;
    }
    return { type: TokenType.ATTRIBUTE, value: content.join('').trim(), line: startLine };
  }

  readText() {
    const start = this.pos;
    const startLine = this.line;
    let text = '';
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (char === '\n') break;
      if (char === '@' && this.input.startsWith('@import[', this.pos)) break;
      if (char === '{' && this.input[this.pos + 1] === '{') break;
      if (char === '#' && this.isLineStart()) break;
      if (char === '`' && this.input.startsWith('```', this.pos)) break;
      if (char === '!' && this.input[this.pos + 1] === '[') break;
      if (char === '|' && this.isLineStart()) break;
      text += char;
      this.pos++;
    }
    const trimmedText = text.trim();
    const segments = this.parseInlineFormatting(trimmedText);
    return { type: TokenType.TEXT, value: trimmedText, segments, line: startLine };
  }

  readLine() {
    let line = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      line += this.input[this.pos];
      this.pos++;
    }
    if (this.pos < this.input.length) {
      this.pos++; // skip newline
      this.line++;
    }
    return line;
  }

  skipToNextLine() {
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      this.pos++;
    }
    if (this.pos < this.input.length) {
      this.pos++;
      this.line++;
    }
  }

  peekRestOfLine() {
    const start = this.pos;
    let line = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      line += this.input[this.pos];
      this.pos++;
    }
    this.pos = start;
    return line;
  }

  extractInlineAttributes(text) {
    const attributes = [];
    const cleaned = text.replace(/{{\s*([^}]+?)\s*}}/g, (_, raw) => {
      const normalized = raw.trim();
      if (normalized) {
        attributes.push(normalized);
      }
      return '';
    }).trim();

    return { text: cleaned, attributes };
  }

  parseInlineFormatting(text) {
    if (!text || typeof text !== 'string') {
      return [{ text: '', formats: [] }];
    }

    const segments = [];
    const regex = /\*\*([^*]+)\*\*|__([^_]+)__|_([^_]+)_|`([^`]+)`/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: text.slice(lastIndex, match.index), formats: [] });
      }

      if (match[1] !== undefined) {
        segments.push({ text: match[1], formats: ['bold'] });
      } else if (match[2] !== undefined) {
        segments.push({ text: match[2], formats: ['bold'] });
      } else if (match[3] !== undefined) {
        segments.push({ text: match[3], formats: ['italic'] });
      } else if (match[4] !== undefined) {
        segments.push({ text: match[4], formats: ['code'] });
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      segments.push({ text: text.slice(lastIndex), formats: [] });
    }

    return segments.length > 0 ? segments : [{ text, formats: [] }];
  }

  isMarkdownTable(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
    const cells = trimmed.split('|').filter(c => c.trim() !== '');
    if (cells.length < 2) return false;
    const isSeparator = cells.every(cell => /^[-:\s]+$/.test(cell.trim()));
    return !isSeparator;
  }

  readTableRow() {
    const startLine = this.line;
    let row = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      row += this.input[this.pos];
      this.pos++;
    }
    if (this.input[this.pos] === '\n') {
      this.pos++;
      this.line++;
    }
    return row.trim();
  }
}

export function tokenize(input) {
  const lexer = new Lexer(input);
  return lexer.tokenize();
}
