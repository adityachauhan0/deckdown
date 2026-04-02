// PPTX Renderer
// Generates PowerPoint output using pptxgenjs

import PptxGenJS from 'pptxgenjs';
import { resolve } from 'path';

export class PPTXRenderer {
  constructor(layout) {
    this.layout = layout;
  }

  async render(outputPath) {
    const pptx = new PptxGenJS();
    
    pptx.layout = 'LAYOUT_WIDE';
    
    for (const slide of this.layout.slides) {
      const pptSlide = pptx.addSlide();
      pptSlide.background = { color: this.layout.theme.colors.background };
      
      for (const block of slide.blocks) {
        this.renderBlock(pptSlide, block);
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

  renderBlock(pptSlide, block) {
    const x = (block.x || 0) / 96;
    const y = (block.y || 0) / 96;
    const w = (block.width || 300) / 96;
    const h = (block.height || 50) / 96;
    
    switch (block.type) {
      case 'heading':
        pptSlide.addText(block.text, {
          x, y, w, h,
          fontSize: block.fontSize || 44,
          color: block.color || '#000000',
          bold: true,
          fontFace: this.getFontName(block.fontFamily),
          align: block.center ? 'center' : 'left',
          valign: 'top'
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
          lineSpacingMultiple: this.layout.theme.typography.lineHeight
        });
        break;
        
      case 'code':
        pptSlide.addText(block.content || '', {
          x, y, w, h: h || 3,
          fontSize: block.fontSize || 14,
          color: block.color || '#1a1a1a',
          fontFace: 'Courier New',
          background: block.backgroundColor || '#f5f5f5',
          valign: 'top'
        });
        break;
        
      case 'image':
        if (block.src) {
          try {
            pptSlide.addImage({
              path: resolve(block.src),
              x, y,
              w: w * (block.scale || 1),
              h: h * (block.scale || 1) * 0.75
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