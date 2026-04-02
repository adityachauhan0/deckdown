// PPTX Renderer
// Generates PowerPoint output using pptxgenjs

import PptxGenJS from 'pptxgenjs';
import { resolve } from 'path';
import { highlightCode } from './layout.js';

export class PPTXRenderer {
  constructor(layout) {
    this.layout = layout;
    this.shapeType = new PptxGenJS().ShapeType;
  }

  async render(outputPath) {
    const pptx = new PptxGenJS();
    
    pptx.defineLayout({
      name: 'DECKDOWN_CUSTOM',
      width: this.layout.page.width / 96,
      height: this.layout.page.height / 96
    });
    pptx.layout = 'DECKDOWN_CUSTOM';
    
    for (const slide of this.layout.slides) {
      const pptSlide = pptx.addSlide();
      pptSlide.background = { color: this.layout.theme.colors.background };
      
      for (const block of slide.blocks) {
        await this.renderBlock(pptSlide, block);
      }
    }
    
    await pptx.writeFile({ fileName: outputPath });
  }

  getFontName(fontFamily) {
    if (!fontFamily) return 'Arial';
    const fontMap = {
      'DejaVu Sans': 'Arial',
      'DejaVu Serif': 'Times New Roman',
      'DejaVu Sans Mono': 'Courier New',
      'Helvetica': 'Arial',
      'Times': 'Times New Roman',
      'Courier': 'Courier New',
      'Inter': 'Arial',
      'Arial': 'Arial',
      'JetBrains Mono': 'Courier New'
    };
    for (const key of Object.keys(fontMap)) {
      if (fontFamily.includes(key)) {
        return fontMap[key];
      }
    }
    return 'Arial';
  }

  toInches(value) {
    return (value || 0) / 96;
  }

  async renderBlock(pptSlide, block) {
    const x = this.toInches(block.x);
    const y = this.toInches(block.y);
    const w = this.toInches(block.width || 300);
    const h = Math.max(this.toInches(block.height || 50), 0.35);
    
    switch (block.type) {
      case 'heading':
        pptSlide.addText(block.text, {
          x, y, w, h,
          fontSize: block.fontSize || 44,
          color: block.color || '#000000',
          bold: true,
          fontFace: this.getFontName(block.fontFamily),
          align: block.center ? 'center' : 'left',
          valign: 'top',
          margin: 0,
          fit: 'shrink'
        });
        break;
        
      case 'paragraph':
        pptSlide.addText(block.text || '', {
          x, y, w, h,
          fontSize: block.fontSize || 18,
          color: block.color || '#1a1a1a',
          fontFace: this.getFontName(block.fontFamily),
          align: 'left',
          valign: 'top',
          lineSpacingMultiple: this.layout.theme.typography.lineHeight,
          margin: 0,
          fit: 'shrink'
        });
        break;
        
      case 'code':
        const codeFontSize = block.fontSize || 14;
        const codeHighlight = await highlightCode(
          block.content || '',
          block.language,
          block.backgroundColor || this.layout.theme.colors.codeBg || this.layout.theme.colors.background
        );
        const codeBackground = block.backgroundColor || codeHighlight.background || this.layout.theme.colors.codeBg;
        const codeLineHeight = Math.max(this.toInches(Math.round(codeFontSize * 1.45)), 0.22);
        const innerX = x + this.toInches(10);
        const innerY = y + this.toInches(10);
        const lineWidth = Math.max(w - this.toInches(20), 0.1);

        pptSlide.addShape(this.shapeType.rect, {
          x,
          y,
          w,
          h: Math.max(h, codeLineHeight * Math.max(codeHighlight.lines.length, 1) + this.toInches(20)),
          line: { color: codeBackground, transparency: 100 },
          fill: { color: codeBackground }
        });

        codeHighlight.lines.forEach((line, lineIndex) => {
          const runs = line.length > 0
            ? line.map(token => ({
                text: token.content,
                options: {
                  color: token.color || codeHighlight.foreground || this.layout.theme.colors.text,
                  fontFace: 'Courier New',
                  bold: !!(token.fontStyle & 2),
                  italic: !!(token.fontStyle & 1)
                }
              }))
            : [{ text: ' ', options: { fontFace: 'Courier New' } }];

          pptSlide.addText(runs, {
            x: innerX,
            y: innerY + (lineIndex * codeLineHeight),
            w: lineWidth,
            h: codeLineHeight,
            margin: 0,
            fontFace: 'Courier New',
            fontSize: codeFontSize,
            color: this.layout.theme.colors.text,
            valign: 'top',
            fit: 'shrink'
          });
        });
        break;
        
      case 'image':
        if (block.src) {
          try {
            pptSlide.addImage({
              path: resolve(block.src),
              x, y,
              w,
              h: this.toInches(block.height || 400)
            });
          } catch (err) {
            pptSlide.addText(`[Image: ${block.alt || block.src}]`, {
              x, y, w, h,
              fontSize: 12,
              color: '#999999',
              fontFace: 'Arial'
            });
          }
        }
        break;
    }
  }
}

export async function renderPPTX(layout, outputPath) {
  const renderer = new PPTXRenderer(layout);
  return renderer.render(outputPath);
}
