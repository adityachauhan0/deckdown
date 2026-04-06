// Deckdown - Compiler and CLI helpers

import { spawnSync } from 'child_process';
import { Command } from 'commander';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import { tokenize } from './lexer.js';
import { parse } from './parser.js';
import { resolveImports } from './resolver.js';
import { layoutDocument } from './layout.js';
import { renderPDF } from './renderer-pdf.js';
import { renderPNG } from './renderer-png.js';
import { renderPPTX } from './renderer-pptx.js';
import { startStudioServer } from './studio/server.js';
import { createWorkspace } from './workspace.js';

function mergeConfig(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (typeof override[key] === 'object' && !Array.isArray(override[key]) && result[key] !== undefined) {
      result[key] = mergeConfig(result[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

function validateOutputTarget(format, output) {
  if (format === 'png') {
    if (!output) {
      throw new Error('PNG output requires --output <directory>.');
    }

    if (existsSync(output) && !statSync(output).isDirectory()) {
      throw new Error(`PNG output path must be a directory: ${output}`);
    }

    return;
  }

  if (format === 'pptx') {
    if (!output) {
      throw new Error('PPTX output requires --output <file>.');
    }

    if (existsSync(output) && statSync(output).isDirectory()) {
      throw new Error(`PPTX output path must be a file: ${output}`);
    }

    return;
  }

  if (format === 'pdf' && output && existsSync(output) && statSync(output).isDirectory()) {
    throw new Error(`PDF output path must be a file: ${output}`);
  }
}

function ensureGhostscriptAvailable() {
  const result = spawnSync('gs', ['--version'], {
    encoding: 'utf8',
    stdio: 'ignore'
  });

  if (result.status !== 0) {
    throw new Error('PNG output requires Ghostscript (`gs`) on PATH.');
  }
}

function createLayoutOptions(metadata, options = {}) {
  return {
    page: {
      width: metadata.page?.width || parseInt(options.pageWidth || '1920', 10),
      height: metadata.page?.height || parseInt(options.pageHeight || '1080', 10),
      margin: metadata.page?.margin || parseInt(options.margin || '80', 10)
    },
    theme: metadata.theme || {}
  };
}

function printDiagnostics(diagnostics = []) {
  for (const diagnostic of diagnostics) {
    const location = diagnostic.filePath ? `${diagnostic.filePath}: ` : '';
    const prefix = diagnostic.severity === 'error' ? 'Error' : 'Warning';
    console.error(`${prefix}: ${location}${diagnostic.message}`);
  }
}

function isExternalAsset(assetPath = '') {
  return /^([a-zA-Z][a-zA-Z\d+.-]*:|\/\/)/.test(assetPath);
}

function validateDocument(inputPath, resolvedContent, document, metadata) {
  const diagnostics = [];

  if (!String(resolvedContent || '').trim()) {
    diagnostics.push({
      severity: 'error',
      source: 'validation',
      filePath: inputPath,
      message: 'Deck is empty.'
    });
    return diagnostics;
  }

  if (!document.slides.length) {
    diagnostics.push({
      severity: 'error',
      source: 'validation',
      filePath: inputPath,
      message: 'Deck has no slides.'
    });
    return diagnostics;
  }

  const firstSlide = document.slides[0];
  const hasTitle = Boolean(metadata.title)
    || firstSlide.blocks.some(block => block.type === 'heading' && String(block.text || '').trim());

  if (!hasTitle) {
    diagnostics.push({
      severity: 'warning',
      source: 'validation',
      filePath: inputPath,
      message: 'Deck has no title. Add frontmatter `title` or a heading on the first slide.'
    });
  }

  document.slides.forEach((slide, index) => {
    if (!slide.blocks.length) {
      diagnostics.push({
        severity: 'warning',
        source: 'validation',
        filePath: inputPath,
        message: `Slide ${index + 1} is empty.`
      });
    }

    slide.blocks.forEach(block => {
      if (block.type !== 'image' || !block.url || isExternalAsset(block.url)) {
        return;
      }

      const assetPath = resolve(block.url);
      if (!existsSync(assetPath)) {
        diagnostics.push({
          severity: 'warning',
          source: 'validation',
          filePath: inputPath,
          message: `Image asset not found: ${assetPath}`
        });
      }
    });
  });

  return diagnostics;
}

async function buildPresentation(inputPath, options = {}) {
  const absoluteInputPath = resolve(inputPath);
  const diagnostics = [];
  const content = options.sourceContent ?? readFileSync(absoluteInputPath, 'utf-8');
  const { content: resolvedContent, yamlImports } = resolveImports(content, absoluteInputPath);

  let mergedConfig = {};
  for (let i = yamlImports.length - 1; i >= 0; i--) {
    const { content: yamlContent, path: importPath } = yamlImports[i];
    try {
      const parsed = yaml.load(yamlContent);
      mergedConfig = mergeConfig(mergedConfig, parsed);
    } catch (err) {
      diagnostics.push({
        severity: 'warning',
        source: 'import',
        filePath: importPath,
        code: 'import.parse_failed',
        line: err.mark ? err.mark.line + 1 : undefined,
        column: err.mark ? err.mark.column + 1 : undefined,
        message: `Failed to parse YAML import: ${err.message}`
      });
    }
  }

  const tokens = tokenize(resolvedContent);
  const document = parse(tokens, {
    diagnostics,
    filePath: absoluteInputPath
  });
  const metadata = mergeConfig(mergedConfig, document.metadata);
  diagnostics.push(...validateDocument(absoluteInputPath, resolvedContent, document, metadata));
  const layoutOptions = createLayoutOptions(metadata, options);
  const compiledDocument = { ...document, metadata };
  const layout = layoutDocument(compiledDocument, layoutOptions);

  return {
    inputPath: absoluteInputPath,
    content,
    resolvedContent,
    tokens,
    document: compiledDocument,
    metadata,
    layout,
    diagnostics
  };
}

async function renderLayout(layout, format, output) {
  switch (format) {
    case 'pdf':
      await renderPDF(layout, output);
      break;
    case 'png':
      await renderPNG(layout, output);
      break;
    case 'pptx':
      await renderPPTX(layout, output);
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

async function compile(inputPath, options) {
  const format = (options.format || 'pdf').toLowerCase();
  validateOutputTarget(format, options.output);

  if (format === 'png') {
    ensureGhostscriptAvailable();
  }

  const result = await buildPresentation(inputPath, options);
  printDiagnostics(result.diagnostics);
  await renderLayout(result.layout, format, options.output);

  if (options.output) {
    console.log(`Output written to ${options.output}`);
  }
}

function createProgram(version = '0.0.0') {
  const program = new Command();

  program
    .name('deckdown')
    .description('Local-first Markdown to PDF presentation compiler')
    .version(version)
    .argument('<input>', 'Input Markdown file')
    .option('-o, --output <path>', 'Output file or directory (PNG and PPTX require this option)')
    .option('-f, --format <format>', 'Output format: pdf, png, pptx (default: pdf)', 'pdf')
    .option('--page-width <pixels>', 'Page width in pixels', '1920')
    .option('--page-height <pixels>', 'Page height in pixels', '1080')
    .option('--margin <pixels>', 'Page margin in pixels', '80')
    .action(async (input, options) => {
      try {
        await compile(input, options);
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  program
    .command('init [target]')
    .description('Create a repo-first DeckDown workspace')
    .option('--force', 'Overwrite starter files if they already exist')
    .action((target = process.cwd(), options) => {
      try {
        const result = createWorkspace(target, options);
        console.log(`DeckDown workspace created at ${result.rootDir}`);
        console.log(`Starter deck: ${result.entryFile}`);
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  program
    .command('studio [target]')
    .description('Launch DeckDown Studio as a localhost web app')
    .option('--port <port>', 'Preferred localhost port', '0')
    .option('--no-open', 'Do not open a browser automatically')
    .action(async (target = process.cwd(), options) => {
      try {
        await startStudioServer(target, options);
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  return program;
}

async function runCli(argv = process.argv, version = '0.0.0') {
  const program = createProgram(version);
  await program.parseAsync(argv);
}

export {
  buildPresentation,
  compile,
  createLayoutOptions,
  createWorkspace,
  createProgram,
  ensureGhostscriptAvailable,
  mergeConfig,
  printDiagnostics,
  renderLayout,
  runCli,
  validateOutputTarget
};
