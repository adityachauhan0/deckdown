// Deckdown - PDF Renderer
// Generates PDF output using PDFKit

import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { isAbsolute, resolve } from 'path';
import { highlightCode } from './layout.js';

export class PDFRenderer {
  constructor(layout) {
    this.layout = layout;
    this.doc = null;
  }

  async render(outputPath) {
    this.doc = new PDFDocument({
      size: [this.layout.page.width, this.layout.page.height],
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    const stream = outputPath
      ? createWriteStream(outputPath)
      : process.stdout;

    return new Promise((resolve, reject) => {
      this.doc.pipe(stream);

      (async () => {
        try {
          for (let i = 0; i < this.layout.slides.length; i++) {
            const slide = this.layout.slides[i];
            await this.renderSlide(slide);

            if (i < this.layout.slides.length - 1) {
              this.doc.addPage();
            }
          }

          this.doc.end();
        } catch (err) {
          reject(err);
        }
      })();

      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  async renderSlide(slide) {
    // Set background
    this.doc.rect(0, 0, this.layout.page.width, this.layout.page.height)
       .fill(this.layout.theme.colors.background);
    
    // Render each block
    for (const block of slide.blocks) {
      await this.renderBlock(block);
    }
  }

  getFontFamily(block) {
    // Map theme font names to PDFKit built-in fonts
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

    return resolve(src);
  }

  async renderBlock(block) {
    const font = this.getFontFamily(block);
    
    switch (block.type) {
      case 'heading':
        this.doc.font(font)
           .fontSize(block.fontSize)
           .fillColor(block.color)
           .text(block.text, block.x, block.y, {
             width: block.width,
             align: block.center ? 'center' : 'left'
           });
        break;
        
      case 'paragraph':
        this.doc.font(font)
           .fontSize(block.fontSize)
           .fillColor(block.color)
           .text(block.text, block.x, block.y, {
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
        
        // Draw background
        this.doc.rect(codeX, codeY, codeWidth, codeHeight)
           .fill(block.backgroundColor || codeHighlight.background || this.layout.theme.colors.codeBg);
        
        const innerX = codeX + 10;
        const innerY = codeY + 10;

        for (let lineIndex = 0; lineIndex < codeHighlight.lines.length; lineIndex++) {
          const line = codeHighlight.lines[lineIndex];
          const lineY = innerY + (lineIndex * codeLineHeight);
          let cursorX = innerX;

          for (const token of line) {
            const tokenWidth = this.doc.widthOfString(token.content, {
              font: codeFont,
              size: codeFontSize
            });
            this.doc.font(codeFont)
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
              this.doc.image(imgPath, block.x, block.y, imageOptions);
            }
          } catch (err) {
            // Image not found, skip
            this.doc.font('Helvetica')
               .fontSize(14)
               .fillColor('#999999')
               .text(`[Image: ${block.alt || block.src}]`, block.x, block.y);
          }
        }
        break;
    }
  }
}

export async function renderPDF(layout, outputPath) {
  const renderer = new PDFRenderer(layout);
  return renderer.render(outputPath);
}
