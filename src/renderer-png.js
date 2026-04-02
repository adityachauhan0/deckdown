// PNG Renderer
// Renders slides to PNG images using Ghostscript

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { isAbsolute, join, resolve as pathResolve } from 'path';
import PDFDocument from 'pdfkit';
import { highlightCode } from './layout.js';

const execAsync = promisify(exec);

export class PNGRenderer {
  constructor(layout) {
    this.layout = layout;
  }

  async render(outputDir) {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    const pdfBuffer = await this.generatePDF();
    const pdfPath = join(outputDir, '_temp.pdf');
    writeFileSync(pdfPath, pdfBuffer);
    
    try {
      const baseName = join(outputDir, 'slide');
      const cmd = `gs -dBATCH -dNOPAUSE -sDEVICE=png16m -r150 -sOutputFile='${baseName}-%03d.png' '${pdfPath}'`;
      await execAsync(cmd);
      
      if (existsSync(pdfPath)) unlinkSync(pdfPath);
      
    } catch (err) {
      try {
        if (existsSync(pdfPath)) unlinkSync(pdfPath);
      } catch {}
      throw err;
    }
  }

  async generatePDF() {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const doc = new PDFDocument({
        size: [this.layout.page.width, this.layout.page.height],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      (async () => {
        try {
          for (let i = 0; i < this.layout.slides.length; i++) {
            if (i > 0) doc.addPage();
            await this.renderSlide(doc, this.layout.slides[i]);
          }

          doc.end();
        } catch (err) {
          reject(err);
        }
      })();
    });
  }

  async renderSlide(doc, slide) {
    doc.rect(0, 0, this.layout.page.width, this.layout.page.height)
       .fill(this.layout.theme.colors.background);
    
    for (const block of slide.blocks) {
      await this.renderBlock(doc, block);
    }
  }

  getFontFamily(block) {
    const fontMap = {
      'DejaVu Sans': 'Helvetica',
      'DejaVu Serif': 'Times',
      'DejaVu Sans Mono': 'Courier',
      'Helvetica': 'Helvetica',
      'Times': 'Times',
      'Courier': 'Courier',
      'Inter': 'Helvetica',
      'Arial': 'Helvetica',
      'JetBrains Mono': 'Courier'
    };
    return fontMap[block.fontFamily] || 'Helvetica';
  }

  resolveImagePath(src) {
    if (!src) {
      return null;
    }

    if (isAbsolute(src)) {
      return src;
    }

    return pathResolve(src);
  }

  async renderBlock(doc, block) {
    const font = this.getFontFamily(block);
    
    switch (block.type) {
      case 'heading':
        doc.font(font)
           .fontSize(block.fontSize)
           .fillColor(block.color)
           .text(block.text, block.x, block.y, {
             width: block.width,
             align: block.center ? 'center' : 'left'
           });
        break;
        
      case 'paragraph':
        doc.font(font)
           .fontSize(block.fontSize)
           .fillColor(block.color)
           .text(block.text || '', block.x, block.y, {
             width: block.width,
             lineGap: this.layout.theme.typography.lineHeight
           });
        break;
        
      case 'code':
        const codeX = block.x;
        const codeY = block.y;
        const codeWidth = block.width;
        const codeHeight = block.height || 100;
        const codeFontSize = block.fontSize || 16;
        const codeHighlight = await highlightCode(
          block.content || '',
          block.language,
          block.backgroundColor || this.layout.theme.colors.codeBg || this.layout.theme.colors.background
        );
        const codeFont = 'Courier';
        const codeLineHeight = Math.max(Math.round(codeFontSize * 1.45), 20);
        
        doc.rect(codeX, codeY, codeWidth, codeHeight)
           .fill(block.backgroundColor || codeHighlight.background || this.layout.theme.colors.codeBg);
        
        const innerX = codeX + 10;
        const innerY = codeY + 10;

        for (let lineIndex = 0; lineIndex < codeHighlight.lines.length; lineIndex++) {
          const line = codeHighlight.lines[lineIndex];
          const lineY = innerY + (lineIndex * codeLineHeight);
          let cursorX = innerX;

          for (const token of line) {
            const tokenWidth = doc.widthOfString(token.content, {
              font: codeFont,
              size: codeFontSize
            });
            doc.font(codeFont)
              .fontSize(codeFontSize)
              .fillColor(token.color || codeHighlight.foreground || this.layout.theme.colors.text)
              .text(token.content, cursorX, lineY, {
                lineBreak: false,
                width: tokenWidth + 1
              });
            cursorX += tokenWidth;
          }
        }
        break;
        
      case 'image':
        if (block.src) {
          try {
            const imgPath = this.resolveImagePath(block.src);
            if (imgPath) {
              const imageHeight = block.height || 400;
              const imageOptions = block.cover
                ? {
                    cover: [block.width * (block.scale || 1), imageHeight],
                    align: 'center',
                    valign: 'center'
                  }
                : {
                    fit: [block.width * (block.scale || 1), imageHeight],
                    align: 'center',
                    valign: 'center'
                  };
              doc.image(imgPath, block.x, block.y, imageOptions);
            }
          } catch (err) {
            doc.font('Helvetica')
               .fontSize(14)
               .fillColor('#999999')
               .text(`[Image: ${block.alt || block.src}]`, block.x, block.y);
          }
        }
        break;
    }
  }
}

export async function renderPNG(layout, outputDir) {
  const renderer = new PNGRenderer(layout);
  return renderer.render(outputDir);
}
