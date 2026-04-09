import sharp from 'sharp';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';

const assetCache = new Map();

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const mathInput = new TeX({ packages: ['base', 'ams'] });
const mathOutput = new SVG({ fontCache: 'none' });
const mathDocument = mathjax.document('', {
  InputJax: mathInput,
  OutputJax: mathOutput
});

function encodeSvgDataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function encodePngDataUri(buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

async function svgToPngBuffer(svg) {
  return sharp(Buffer.from(svg, 'utf8')).png().toBuffer();
}

function extractStandaloneSvg(markup) {
  const match = String(markup || '').match(/<svg[\s\S]*<\/svg>/i);
  return match ? match[0] : markup;
}

function applySvgColor(svg, color) {
  if (!color) {
    return svg;
  }

  return svg.replace('<svg ', `<svg color="${color}" `);
}

function renderMermaidSvgInSubprocess(payload) {
  return new Promise((resolve, reject) => {
    const workerPath = new URL('./render-mermaid-worker.js', import.meta.url);
    const child = spawn(process.execPath, [fileURLToPath(workerPath)], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Mermaid worker exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout || '{}').svg || '');
      } catch (error) {
        reject(new Error(`Mermaid worker returned invalid JSON: ${error.message}`));
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

export async function renderMathToAsset(formula, options = {}) {
  const color = options.color || '#111827';
  const cacheKey = `math\u0000${color}\u0000${formula}`;
  if (assetCache.has(cacheKey)) {
    return assetCache.get(cacheKey);
  }

  const node = mathDocument.convert(String(formula || '').trim(), { display: true });
  const rawMarkup = adaptor.outerHTML(node);
  const svg = applySvgColor(extractStandaloneSvg(rawMarkup), color);
  const pngBuffer = await svgToPngBuffer(svg);
  const asset = {
    svg,
    svgDataUri: encodeSvgDataUri(svg),
    pngBuffer,
    pngDataUri: encodePngDataUri(pngBuffer)
  };
  assetCache.set(cacheKey, asset);
  return asset;
}

export async function renderMermaidToAsset(source, options = {}) {
  const textColor = options.textColor || '#111827';
  const accentColor = options.accentColor || '#245fd4';
  const backgroundColor = options.backgroundColor || '#ffffff';
  const cacheKey = `mermaid\u0000${textColor}\u0000${accentColor}\u0000${backgroundColor}\u0000${source}`;
  if (assetCache.has(cacheKey)) {
    return assetCache.get(cacheKey);
  }

  const svg = await renderMermaidSvgInSubprocess({
    source,
    textColor,
    accentColor,
    backgroundColor
  });
  const pngBuffer = await svgToPngBuffer(svg);
  const asset = {
    svg,
    svgDataUri: encodeSvgDataUri(svg),
    pngBuffer,
    pngDataUri: encodePngDataUri(pngBuffer)
  };
  assetCache.set(cacheKey, asset);
  return asset;
}

export async function hydrateRenderableAssets(layout, options = {}) {
  const diagnostics = options.diagnostics || [];
  const hydratedSlides = await Promise.all(layout.slides.map(async slide => ({
    ...slide,
    blocks: await Promise.all(slide.blocks.map(async block => {
      try {
        if (block.type === 'math') {
          return {
            ...block,
            renderAsset: await renderMathToAsset(block.formula, {
              color: layout.theme.colors.text
            }),
            previewSrc: undefined
          };
        }

        if (block.type === 'mermaid') {
          return {
            ...block,
            renderAsset: await renderMermaidToAsset(block.content, {
              textColor: layout.theme.colors.text,
              accentColor: layout.theme.colors.accent,
              backgroundColor: layout.theme.colors.background
            }),
            previewSrc: undefined
          };
        }

        return block;
      } catch (error) {
        diagnostics.push({
          severity: 'warning',
          source: 'render',
          message: `${block.type === 'math' ? 'LaTeX' : 'Mermaid'} render failed: ${error.message}`
        });

        return {
          ...block,
          renderError: error.message
        };
      }
    }))
  })));

  return {
    ...layout,
    slides: hydratedSlides
  };
}
