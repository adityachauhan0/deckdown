// PNG Renderer
// Renders slides to PNG images using Ghostscript

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, resolve as pathResolve } from 'path';
import PDFDocument from 'pdfkit';

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

  generatePDF() {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const doc = new PDFDocument({
        size: [this.layout.page.width, this.layout.page.height],
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      for (let i = 0; i < this.layout.slides.length; i++) {
        if (i > 0) doc.addPage();
        this.renderSlide(doc, this.layout.slides[i]);
      }
      
      doc.end();
    });
  }

  renderSlide(doc, slide) {
    doc.rect(0, 0, this.layout.page.width, this.layout.page.height)
       .fill(this.layout.theme.colors.background);
    
    for (const block of slide.blocks) {
      this.renderBlock(doc, block);
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

  renderBlock(doc, block) {
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
        
        doc.rect(codeX, codeY, codeWidth, codeHeight)
           .fill(block.backgroundColor);
        
        doc.font('Courier')
           .fontSize(block.fontSize)
           .fillColor(this.layout.theme.colors.text)
           .text(block.content || '', codeX + 10, codeY + 10, {
             width: codeWidth - 20,
             height: codeHeight - 20
           });
        break;
        
      case 'image':
        if (block.src) {
          try {
            const imgPath = pathResolve(block.src);
            doc.image(imgPath, block.x, block.y, {
              fit: [block.width * (block.scale || 1), 400],
              align: 'center'
            });
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