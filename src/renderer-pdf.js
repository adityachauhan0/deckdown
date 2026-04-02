// Deckdown - PDF Renderer
// Generates PDF output using PDFKit

import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { resolve } from 'path';

export class PDFRenderer {
  constructor(layout) {
    this.layout = layout;
    this.doc = null;
  }

  async render(outputPath) {
    return new Promise((resolve, reject) => {
      this.doc = new PDFDocument({
        size: [this.layout.page.width, this.layout.page.height],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      
      const stream = outputPath 
        ? createWriteStream(outputPath)
        : process.stdout;
      
      this.doc.pipe(stream);
      
      // Render each slide
      for (let i = 0; i < this.layout.slides.length; i++) {
        const slide = this.layout.slides[i];
        this.renderSlide(slide);
        
        // Add new page for next slide (except last)
        if (i < this.layout.slides.length - 1) {
          this.doc.addPage();
        }
      }
      
      this.doc.end();
      
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  renderSlide(slide) {
    // Set background
    this.doc.rect(0, 0, this.layout.page.width, this.layout.page.height)
       .fill(this.layout.theme.colors.background);
    
    // Render each block
    for (const block of slide.blocks) {
      this.renderBlock(block);
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

  renderBlock(block) {
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
        
        // Draw background
        this.doc.rect(codeX, codeY, codeWidth, codeHeight)
           .fill(block.backgroundColor);
        
        // Draw code text
        this.doc.font('Courier')
           .fontSize(block.fontSize)
           .fillColor(this.layout.theme.colors.text)
           .text(block.content, codeX + 10, codeY + 10, {
             width: codeWidth - 20,
             height: codeHeight - 20
           });
        break;
        
      case 'image':
        if (block.src) {
          try {
            const imgPath = resolve(block.src);
            this.doc.image(imgPath, block.x, block.y, {
              fit: [block.width * (block.scale || 1), 400],
              align: 'center'
            });
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