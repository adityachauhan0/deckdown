// Deckdown - Lexer
// Tokenizes markdown input into meaningful units

export const TokenType = {
  IMPORT: 'IMPORT',
  SLIDE_BREAK: 'SLIDE_BREAK',
  FRONTMATTER: 'FRONTMATTER',
  HEADING: 'HEADING',
  CODE_BLOCK: 'CODE_BLOCK',
  IMAGE: 'IMAGE',
  TEXT: 'TEXT',
  ATTRIBUTE: 'ATTRIBUTE',
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
      
      if (char === '@' && this.peekWord() === 'import') {
        this.tokens.push(this.readImport());
      } else if (this.input.startsWith('---', this.pos) && this.isLineStart()) {
        this.tokens.push(this.readSlideBreakOrFrontmatter());
      } else if (char === '#') {
        this.tokens.push(this.readHeading());
      } else if (char === '`') {
        this.tokens.push(this.readCodeBlock());
      } else if (char === '!' && this.input[this.pos + 1] === '[') {
        this.tokens.push(this.readImage());
      } else if (char === '{' && this.input[this.pos + 1] === '{') {
        this.tokens.push(this.readAttribute());
      } else {
        this.tokens.push(this.readText());
      }
    }
    
    this.tokens.push({ type: TokenType.EOF, value: '', line: this.line });
    return this.tokens;
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
    const text = this.readLine();
    return { type: TokenType.HEADING, value: { level, text: text.trim() }, line: startLine };
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
      if (char === '\n' || char === '@' || char === '{' || char === '#') {
        break;
      }
      if (char === '!') {
        // Check if this is an image
        if (this.input[this.pos + 1] === '[') {
          break;
        }
        // Otherwise consume the standalone !
        text += char;
        this.pos++;
        continue;
      }
      text += char;
      this.pos++;
    }
    return { type: TokenType.TEXT, value: text.trim(), line: startLine };
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
}

export function tokenize(input) {
  const lexer = new Lexer(input);
  return lexer.tokenize();
}