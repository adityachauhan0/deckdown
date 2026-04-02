// Deckdown - CLI Entry Point

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import yaml from 'js-yaml';
import { tokenize } from './lexer.js';
import { parse } from './parser.js';
import { resolveImports } from './resolver.js';
import { layoutDocument } from './layout.js';
import { renderPDF } from './renderer-pdf.js';
import { renderPNG } from './renderer-png.js';
import { renderPPTX } from './renderer-pptx.js';

const program = new Command();

program
  .name('deckdown')
  .description('Local-first Markdown to PDF presentation compiler')
  .version('1.0.0')
  .argument('<input>', 'Input Markdown file')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('-f, --format <format>', 'Output format: pdf, png, pptx (default: pdf)', 'pdf')
  .option('--page-width <pixels>', 'Page width in pixels', '1920')
  .option('--page-height <pixels>', 'Page height in pixels', '1080')
  .option('--margin <pixels>', 'Page margin in pixels', '80')
  .option('-w, --watch', 'Watch for changes and rebuild')
  .action(async (input, options) => {
    try {
      await compile(input, options);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();

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

async function compile(inputPath, options) {
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
  const format = (options.format || 'pdf').toLowerCase();
  
  switch (format) {
    case 'pdf':
      await renderPDF(layout, options.output);
      break;
    case 'png':
      await renderPNG(layout, options.output || '.');
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

export { compile };