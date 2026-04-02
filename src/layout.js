// Deckdown - Layout Engine
// Calculates positioning and applies typography

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
    
    const layout = {
      page: { ...this.page },
      theme: this.theme,
      blocks: [],
      contentWidth: slideWidth,
      contentHeight: slideHeight
    };

    // Calculate block positions
    let y = this.page.margin + this.theme.spacing.slidePadding;
    let currentCol = 0;
    let numCols = 1;
    let colWidth = slideWidth;
    let colX = this.page.margin + this.theme.spacing.slidePadding;
    
    for (const block of slide.blocks) {
      const blockAttrs = block.attributes ? this.parseSlideAttributes(block.attributes) : {};
      
      // Check for column layout attributes
      if (blockAttrs.cols && blockAttrs.cols > 1) {
        numCols = blockAttrs.cols;
        const colPadding = this.theme.spacing.slidePadding;
        colWidth = (slideWidth - (colPadding * (numCols - 1))) / numCols;
        currentCol = 0;
        colX = this.page.margin + this.theme.spacing.slidePadding;
        y = this.page.margin + this.theme.spacing.slidePadding;
      }
      
      if (blockAttrs.colBreak) {
        currentCol++;
        colX += colWidth + this.theme.spacing.slidePadding;
        y = this.page.margin + this.theme.spacing.slidePadding;
      }
      
      const blockLayout = this.calculateBlockLayout(block, y, blockAttrs, numCols > 1 ? colWidth : slideWidth, colX);
      blockLayout.column = currentCol;
      layout.blocks.push(blockLayout);
      y = blockLayout.y + blockLayout.height + this.theme.spacing.paragraph;
    }
    
    return layout;
  }

  calculateBlockLayout(block, y, blockAttrs, slideWidth, baseX) {
    const padding = this.theme.spacing.slidePadding;
    
    // Calculate width based on attributes
    let width = slideWidth;
    if (blockAttrs.width) {
      width = (blockAttrs.width / 100) * slideWidth;
    } else if (blockAttrs.scale) {
      width = blockAttrs.scale * slideWidth;
    }
    
    // Calculate x position based on alignment
    let x = baseX;
    if (blockAttrs.center) {
      x = baseX + (slideWidth - width) / 2;
    } else if (blockAttrs.right) {
      x = baseX + slideWidth - width;
    }
    
    const layout = {
      type: block.type,
      y,
      x,
      width,
      height: 50
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
        layout.scale = blockAttrs.scale || blockAttrs.width ? (blockAttrs.width / 100) : 1;
        break;
    }
    
    return layout;
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