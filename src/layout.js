// Deckdown - Layout Engine
// Calculates positioning and applies typography

import { getSingletonHighlighter } from 'shiki';
import { hexToRgb } from './utils.js';

export const DEFAULT_PAGE = {
  width: 1920,
  height: 1080,
  margin: 80
};

export const DEFAULT_THEME = {
  fonts: {
    heading: 'DejaVu Sans',
    body: 'DejaVu Sans',
    code: 'DejaVu Sans Mono',
    fallback: 'DejaVu Sans'
  },
  colors: {
    background: '#ffffff',
    text: '#1a1a1a',
    heading: '#000000',
    accent: '#0066cc',
    codeBg: '#f5f5f5'
  },
  typography: {
    lineHeight: 1.5,
    headingScale: 2.0,
    bodySize: 18,
    codeSize: 16
  },
  spacing: {
    paragraph: 24,
    slidePadding: 60
  }
};

const SHIKI_THEMES = ['vitesse-dark', 'vitesse-light'];
const SHIKI_LANGUAGES = [
  'rust',
  'javascript',
  'typescript',
  'bash',
  'toml',
  'yaml',
  'json',
  'markdown',
  'css',
  'html',
  'python',
  'go',
  'java'
];

const SHIKI_LANGUAGE_ALIASES = {
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
  py: 'python',
  golang: 'go'
};

const highlightedCodeCache = new Map();
let shikiHighlighterPromise;

function normalizeCodeLanguage(language) {
  const normalized = String(language || '').trim().toLowerCase();
  if (!normalized) return '';
  return SHIKI_LANGUAGES.includes(normalized)
    ? normalized
    : SHIKI_LANGUAGE_ALIASES[normalized] || '';
}

function pickCodeTheme(backgroundColor) {
  const rgb = hexToRgb(backgroundColor || '');
  if (!rgb) {
    return 'vitesse-dark';
  }

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.56 ? 'vitesse-light' : 'vitesse-dark';
}

function normalizeHexColor(color) {
  if (typeof color !== 'string') {
    return color;
  }

  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) {
    return `#${trimmed.slice(1, 7)}`;
  }

  return trimmed;
}

async function getShikiHighlighter() {
  if (!shikiHighlighterPromise) {
    shikiHighlighterPromise = getSingletonHighlighter({
      themes: SHIKI_THEMES,
      langs: SHIKI_LANGUAGES
    });
  }

  return shikiHighlighterPromise;
}

export async function highlightCode(content, language, backgroundColor) {
  const normalizedLanguage = normalizeCodeLanguage(language);
  const theme = pickCodeTheme(backgroundColor);
  const cacheKey = `${theme}\u0000${normalizedLanguage || 'plain'}\u0000${content || ''}`;

  if (highlightedCodeCache.has(cacheKey)) {
    return highlightedCodeCache.get(cacheKey);
  }

  const highlighter = await getShikiHighlighter();
  const options = { theme };
  if (normalizedLanguage) {
    options.lang = normalizedLanguage;
  }

  const highlighted = highlighter.codeToTokens(content || '', options);
  const result = {
    theme,
    background: normalizeHexColor(highlighted.bg),
    foreground: normalizeHexColor(highlighted.fg),
    lines: highlighted.tokens.map(line => line.map(token => ({
      content: token.content,
      color: normalizeHexColor(token.color || highlighted.fg),
      fontStyle: token.fontStyle || 0
    })))
  };

  highlightedCodeCache.set(cacheKey, result);
  return result;
}

export class LayoutEngine {
  constructor(document, options = {}) {
    this.document = document;
    this.page = { ...DEFAULT_PAGE, ...options.page };
    this.theme = this.mergeTheme(options.theme || {});
    this.attributes = this.parseAttributes(document.metadata);
  }

  mergeTheme(userTheme) {
    const merged = JSON.parse(JSON.stringify(DEFAULT_THEME));
    
    // Deep merge user theme
    if (userTheme.fonts) {
      merged.fonts = { ...merged.fonts, ...userTheme.fonts };
    }
    if (userTheme.colors) {
      merged.colors = { ...merged.colors, ...userTheme.colors };
    }
    if (userTheme.typography) {
      merged.typography = { ...merged.typography, ...userTheme.typography };
    }
    if (userTheme.spacing) {
      merged.spacing = { ...merged.spacing, ...userTheme.spacing };
    }
    
    return merged;
  }

  parseAttributes(metadata) {
    const attrs = {};
    
    // Parse page dimensions
    if (metadata.page) {
      if (typeof metadata.page === 'object') {
        attrs.page = { ...this.page, ...metadata.page };
      } else {
        attrs.page = this.page;
      }
    }
    
    // Parse theme
    if (metadata.theme) {
      attrs.theme = typeof metadata.theme === 'object' 
        ? this.mergeTheme(metadata.theme)
        : this.theme;
    }
    
    return attrs;
  }

  calculateSlideLayout(slide) {
    const slideWidth = this.page.width - (this.page.margin * 2);
    const slideHeight = this.page.height - (this.page.margin * 2);
    const contentTop = this.page.margin + this.theme.spacing.slidePadding;
    const contentLeft = this.page.margin + this.theme.spacing.slidePadding;
    const contentBottom = this.page.height - this.page.margin - this.theme.spacing.slidePadding;
    const contentHeight = Math.max(0, contentBottom - contentTop);
    
    const layout = {
      page: { ...this.page },
      theme: this.theme,
      blocks: [],
      contentWidth: slideWidth,
      contentHeight,
      contentTop,
      contentLeft
    };

    // Calculate block positions
    let y = contentTop;
    let currentCol = 0;
    let numCols = 1;
    let colWidth = slideWidth;
    let colX = contentLeft;
    let columnStartY = contentTop;
    const columnGap = this.theme.spacing.slidePadding;
    
    for (const block of slide.blocks) {
      const blockAttrs = block.attributes ? this.parseSlideAttributes(block.attributes) : {};
      
      // Check for column layout attributes
      if (blockAttrs.cols && blockAttrs.cols > 1) {
        numCols = blockAttrs.cols;
        colWidth = (slideWidth - (columnGap * (numCols - 1))) / numCols;
        currentCol = 0;
        colX = contentLeft;
        columnStartY = y;
        y = columnStartY;
      }
      
      if (blockAttrs.colBreak) {
        currentCol = Math.min(currentCol + 1, numCols - 1);
        colX = contentLeft + (currentCol * (colWidth + columnGap));
        y = columnStartY;
      }
      
      const blockLayout = this.calculateBlockLayout(
        block,
        y,
        blockAttrs,
        numCols > 1 ? colWidth : slideWidth,
        colX,
        {
          contentTop,
          contentHeight
        }
      );
      blockLayout.column = currentCol;
      layout.blocks.push(blockLayout);
      y = blockLayout.y + blockLayout.height + this.theme.spacing.paragraph;
    }
    
    return layout;
  }

  calculateBlockLayout(block, y, blockAttrs, slideWidth, baseX, slideMetrics = {}) {
    // Calculate width based on attributes
    let width = slideWidth;
    if (blockAttrs.width !== undefined) {
      width = (blockAttrs.width / 100) * slideWidth;
    } else if (blockAttrs.scale !== undefined) {
      width = blockAttrs.scale * slideWidth;
    }

    // Calculate x position based on alignment
    let x = baseX;
    if (blockAttrs.center) {
      x = baseX + (slideWidth - width) / 2;
    } else if (blockAttrs.right) {
      x = baseX + slideWidth - width;
    }
    
    const height = this.estimateBlockHeight(block, width, blockAttrs);
    let blockY = y;
    if (blockAttrs.middle) {
      const centeredY = slideMetrics.contentTop + Math.max(0, (slideMetrics.contentHeight - height) / 2);
      blockY = Math.max(y, centeredY);
    }

    const layout = {
      type: block.type,
      y: blockY,
      x,
      width,
      height,
      center: !!blockAttrs.center,
      middle: !!blockAttrs.middle,
      left: !!blockAttrs.left,
      right: !!blockAttrs.right
    };
    
    switch (block.type) {
      case 'heading':
        layout.fontSize = this.theme.typography.bodySize * this.theme.typography.headingScale / block.level;
        layout.fontFamily = this.theme.fonts.heading;
        layout.color = this.theme.colors.heading;
        layout.bold = true;
        layout.text = block.text;
        break;
        
      case 'paragraph':
        layout.fontSize = this.theme.typography.bodySize;
        layout.fontFamily = this.theme.fonts.body;
        layout.color = this.theme.colors.text;
        layout.text = block.text;
        break;
        
      case 'code':
        layout.fontSize = this.theme.typography.codeSize;
        layout.fontFamily = this.theme.fonts.code;
        layout.backgroundColor = this.theme.colors.codeBg;
        layout.language = block.language;
        layout.content = block.content;
        break;
        
      case 'image':
        layout.src = block.url;
        layout.alt = block.alt;
        layout.scale = 1;
        layout.height = blockAttrs.height !== undefined ? blockAttrs.height : 400;
        layout.cover = !!blockAttrs.cover;
        layout.contain = !!blockAttrs.contain || !blockAttrs.cover;
        break;
    }
    
    return layout;
  }

  estimateBlockHeight(block, width, blockAttrs) {
    switch (block.type) {
      case 'heading': {
        const fontSize = this.theme.typography.bodySize * this.theme.typography.headingScale / block.level;
        const lines = this.estimateWrappedLines(block.text || '', width, fontSize, 0.58);
        return Math.max(Math.round(fontSize * 1.25 * lines + 8), Math.round(fontSize * 1.25));
      }
      case 'paragraph': {
        const fontSize = this.theme.typography.bodySize;
        const lines = this.estimateWrappedLines(block.text || '', width, fontSize, 0.52);
        return Math.max(Math.round(fontSize * this.theme.typography.lineHeight * lines), Math.round(fontSize * this.theme.typography.lineHeight));
      }
      case 'code': {
        const fontSize = this.theme.typography.codeSize;
        const lines = Math.max(1, String(block.content || '').split(/\r?\n/).length);
        return Math.max(Math.round(lines * fontSize * 1.45 + 24), 72);
      }
      case 'image':
        return blockAttrs.height !== undefined ? blockAttrs.height : 400;
      default:
        return 50;
    }
  }

  estimateWrappedLines(text, width, fontSize, charWidthFactor) {
    const normalized = String(text || '').replace(/\r/g, '');
    const paragraphs = normalized.split('\n');
    const charsPerLine = Math.max(8, Math.floor(width / (fontSize * charWidthFactor)));
    let totalLines = 0;

    for (const paragraph of paragraphs) {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        totalLines += 1;
        continue;
      }

      let currentLineLength = 0;
      let paragraphLines = 1;

      for (const word of words) {
        const wordLength = word.length;
        if (currentLineLength === 0) {
          currentLineLength = wordLength;
          continue;
        }

        if (currentLineLength + 1 + wordLength <= charsPerLine) {
          currentLineLength += 1 + wordLength;
        } else {
          paragraphLines++;
          currentLineLength = wordLength;
        }
      }

      totalLines += paragraphLines;
    }

    return Math.max(1, totalLines);
  }

  parseSlideAttributes(attrStrings) {
    const attrs = {};
    
    for (const attr of attrStrings) {
      const trimmed = attr.trim();
      
      // Layout attributes
      if (trimmed === 'center') attrs.center = true;
      if (trimmed === 'middle') attrs.middle = true;
      if (trimmed === 'left') attrs.left = true;
      if (trimmed === 'right') attrs.right = true;
      if (trimmed === 'cover') attrs.cover = true;
      if (trimmed === 'contain') attrs.contain = true;
      
      // Column layout
      if (trimmed.startsWith('cols:')) {
        const cols = parseInt(trimmed.split(':')[1]);
        if (cols > 0) attrs.cols = cols;
      }
      if (trimmed === 'col: break') attrs.colBreak = true;
      
      // Grid layout
      if (trimmed.startsWith('grid:')) {
        const gridParts = trimmed.split(':')[1].split('x');
        if (gridParts.length === 2) {
          attrs.grid = { cols: parseInt(gridParts[0]), rows: parseInt(gridParts[1]) };
        }
      }
      if (trimmed.startsWith('cell:')) {
        const cellParts = trimmed.split(':')[1].split(',');
        if (cellParts.length === 2) {
          attrs.cell = { col: parseInt(cellParts[0]), row: parseInt(cellParts[1]) };
        }
      }
      
      // Size attributes (percentage)
      const percentMatch = trimmed.match(/^(\d+)%$/);
      if (percentMatch) {
        attrs.scale = parseInt(percentMatch[1]) / 100;
      }
      
      // Key:value attributes
      const kvMatch = trimmed.match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        let value = kvMatch[2].trim();
        
        // Parse value types
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (/^\d+$/.test(value)) value = parseInt(value);
        else if (/^\d+\.\d+$/.test(value)) value = parseFloat(value);
        else if (/^\d+(?:\.\d+)?%$/.test(value)) {
          const percent = parseFloat(value);
          if (key === 'scale') value = percent / 100;
          else if (key === 'width') value = percent;
        }
        
        attrs[key] = value;
      }
    }
    
    return attrs;
  }

  layout() {
    return {
      document: this.document,
      page: this.page,
      theme: this.theme,
      slides: this.document.slides.map(slide => this.calculateSlideLayout(slide))
    };
  }
}

export function layoutDocument(document, options) {
  const engine = new LayoutEngine(document, options);
  return engine.layout();
}
