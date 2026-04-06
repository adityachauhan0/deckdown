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

async function compile(inputPath, options) {
  const format = (options.format || 'pdf').toLowerCase();
  validateOutputTarget(format, options.output);

  if (format === 'png') {
    ensureGhostscriptAvailable();
  }

  // Read input file
  const content = readFileSync(resolve(inputPath), 'utf-8');
  
  // Resolve imports
  const { content: resolvedContent, yamlImports } = resolveImports(content, inputPath);
  
  // Merge YAML imports (later overrides earlier - reverse order)
  let mergedConfig = {};
  for (let i = yamlImports.length - 1; i >= 0; i--) {
    const { content: yamlContent } = yamlImports[i];
    try {
      const parsed = yaml.load(yamlContent);
      mergedConfig = mergeConfig(mergedConfig, parsed);
    } catch (err) {
      console.error(`Warning: Failed to parse YAML import: ${err.message}`);
    }
  }
  
  // Tokenize
  const tokens = tokenize(resolvedContent);
  
  // Parse
  const document = parse(tokens);
  
  // Merge imported config with document metadata (document wins if conflicts)
  const metadata = mergeConfig(mergedConfig, document.metadata);
  
  // Layout with merged config
  const layoutOptions = {
    page: {
      width: metadata.page?.width || parseInt(options.pageWidth),
      height: metadata.page?.height || parseInt(options.pageHeight),
      margin: metadata.page?.margin || parseInt(options.margin)
    },
    theme: metadata.theme || {}
  };
  const layout = layoutDocument({ ...document, metadata }, layoutOptions);
  
  // Render based on format
  switch (format) {
    case 'pdf':
      await renderPDF(layout, options.output);
      break;
    case 'png':
      await renderPNG(layout, options.output);
      break;
    case 'pptx':
      await renderPPTX(layout, options.output);
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
  
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

  return program;
}

async function runCli(argv = process.argv, version = '0.0.0') {
  const program = createProgram(version);
  await program.parseAsync(argv);
}

export { compile, createProgram, ensureGhostscriptAvailable, mergeConfig, runCli, validateOutputTarget };
