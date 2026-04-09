import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { AI_PROMPT_FILE, buildAiPrompt } from './ai-prompt.js';

const DEFAULT_TEMPLATE_ID = 'presentation-16x9';

const WORKSPACE_TEMPLATES = [
  {
    id: 'presentation-16x9',
    label: 'Presentation 16:9',
    category: 'presentation',
    description: 'Slides sized for widescreen decks and projector-friendly reviews.',
    page: { width: 1920, height: 1080, margin: 80 }
  },
  {
    id: 'presentation-4x3',
    label: 'Presentation 4:3',
    category: 'presentation',
    description: 'Slides sized for older projectors and legacy presentation layouts.',
    page: { width: 1440, height: 1080, margin: 80 }
  },
  {
    id: 'paper-a4',
    label: 'Document A4',
    category: 'document',
    description: 'Landscape A4 pages for handouts, visual memos, and printable documents.',
    page: { width: 1123, height: 794, margin: 72 }
  },
  {
    id: 'paper-letter',
    label: 'Document Letter',
    category: 'document',
    description: 'Landscape US Letter pages for reports and printable briefs.',
    page: { width: 1056, height: 816, margin: 72 }
  },
  {
    id: 'custom',
    label: 'Blank Custom',
    category: 'custom',
    description: 'Start from a custom page size and margin.',
    custom: true
  }
];

const STARTER_DIRECTORIES = [
  'assets',
  'notes',
  '.deckdown'
];

function ensureParentDirectory(filePath) {
  mkdirSync(resolve(filePath, '..'), { recursive: true });
}

function formatPageFrontmatter(page) {
  return `page:
  width: ${page.width}
  height: ${page.height}
  margin: ${page.margin}`;
}

function buildDeckContent(template) {
  return `---
title: Welcome to DeckDown
${formatPageFrontmatter(template.page)}
theme:
  import: ./theme.yaml
---

# Welcome to DeckDown

Write markdown on the left, review slides on the right, and keep the deck in version control.

---

# Next Steps

- Add your own content
- Keep notes in \`notes/\`
- Store images in \`assets/\`
`;
}

function buildThemeContent(template) {
  const isDocument = template.category === 'document';
  return `# DeckDown theme starter
# This file uses the theme keys that DeckDown understands today.
# Start by uncommenting one section at a time, render the deck, and keep the values you like.
# Every active key below is part of the current theme schema.
# The commented examples at the end are patterns you can paste into deck frontmatter or shared YAML.

fonts:
  # Headings: slide titles, section titles, and emphasized labels.
  heading: '"Aptos Display", "Segoe UI", sans-serif'
  # Body: paragraphs, bullets, tables, and captions.
  body: '"Aptos", "Segoe UI", sans-serif'
  # Code: fenced code blocks and technical snippets.
  code: '"Cascadia Mono", "SFMono-Regular", monospace'

colors:
  # Full slide canvas background.
  background: '#ffffff'
  # Default paragraph and bullet color.
  text: '#111827'
  # Headings and other display-weight text.
  heading: '${isDocument ? '#0f172a' : '#102a62'}'
  # Links, emphasis, accents, and diagram strokes.
  accent: '${isDocument ? '#0f766e' : '#245fd4'}'
  # Fenced code block background surface.
  codeBg: '#f8fafc'

typography:
  # Base font size for paragraph content.
  bodySize: 28
  # Multiplier applied to heading sizes.
  headingScale: 2.1
  # Fenced code font size.
  codeSize: 20
  # Shared line height for text-heavy blocks.
  lineHeight: 1.45

spacing:
  # Inner padding around the slide canvas.
  slidePadding: ${template.page.margin}
  # Vertical spacing between stacked blocks.
  paragraph: 28

# Uncomment, tweak, and compare:
#
# fonts:
#   heading: '"IBM Plex Sans", sans-serif'
#   body: '"IBM Plex Sans", sans-serif'
#   code: '"IBM Plex Mono", monospace'
#
# colors:
#   background: '#0f172a'
#   text: '#e5eefc'
#   heading: '#ffffff'
#   accent: '#7dd3fc'
#   codeBg: '#111827'
#
# typography:
#   bodySize: 30
#   headingScale: 2.3
#   codeSize: 20
#   lineHeight: 1.4
#
# spacing:
#   slidePadding: ${template.page.margin + 8}
#   paragraph: 28

# Example component overrides for future shared theme fragments:
# components:
#   slide:
#     background: '#ffffff'
#   heading:
#     color: '#0f172a'
#     font: '"Aptos Display", "Segoe UI", sans-serif'
#   paragraph:
#     color: '#111827'
#   code:
#     background: '#f8fafc'
#     font: '"Cascadia Mono", monospace'
#   image:
#     width: '72%'
#     contain: true

# Example design tokens for brand palettes or shared surfaces:
# tokens:
#   brand:
#     primary: '#245fd4'
#     secondary: '#0f766e'
#   surface:
#     paper: '#ffffff'
#     panel: '#f8fafc'
`;
}

function buildWorkspaceMetadata(templateId) {
  return JSON.stringify({
    version: 2,
    entryFile: 'deck.md',
    notesDir: 'notes',
    assetsDir: 'assets',
    templateId
  }, null, 2);
}

function normalizeCustomPage(customPage = {}) {
  const width = Number.parseInt(customPage.width, 10);
  const height = Number.parseInt(customPage.height, 10);
  const margin = Number.parseInt(customPage.margin, 10);

  if (!Number.isFinite(width) || width <= 0) {
    throw new Error('Custom workspace template requires a positive page width.');
  }

  if (!Number.isFinite(height) || height <= 0) {
    throw new Error('Custom workspace template requires a positive page height.');
  }

  if (!Number.isFinite(margin) || margin < 0) {
    throw new Error('Custom workspace template requires a non-negative page margin.');
  }

  return { width, height, margin };
}

function resolveTemplate(templateId = DEFAULT_TEMPLATE_ID, customPage) {
  const baseTemplate = WORKSPACE_TEMPLATES.find(template => template.id === templateId);
  if (!baseTemplate) {
    throw new Error(`Unknown workspace template: ${templateId}`);
  }

  if (!baseTemplate.custom) {
    return baseTemplate;
  }

  return {
    ...baseTemplate,
    page: normalizeCustomPage(customPage)
  };
}

function buildStarterFiles(template) {
  return {
    'deck.md': buildDeckContent(template),
    'theme.yaml': buildThemeContent(template),
    'notes/inbox.md': `# Inbox

- Capture source material here before turning it into slides.
`,
    '.deckdown/workspace.json': buildWorkspaceMetadata(template.id),
    [AI_PROMPT_FILE]: buildAiPrompt()
  };
}

export function listWorkspaceTemplates() {
  return WORKSPACE_TEMPLATES.map(template => ({ ...template }));
}

export function createWorkspace(target, options = {}) {
  const rootDir = resolve(target);
  const template = resolveTemplate(options.templateId, options.customPage);
  const starterFiles = buildStarterFiles(template);
  mkdirSync(rootDir, { recursive: true });

  const starterPaths = [
    ...STARTER_DIRECTORIES.map(directory => join(rootDir, directory)),
    ...Object.keys(starterFiles).map(file => join(rootDir, file)),
    join(rootDir, 'assets', '.gitkeep')
  ];

  if (!options.force && starterPaths.some(filePath => existsSync(filePath))) {
    throw new Error(`Workspace already exists at ${rootDir}. Use --force to overwrite starter files.`);
  }

  for (const directory of STARTER_DIRECTORIES) {
    mkdirSync(join(rootDir, directory), { recursive: true });
  }

  for (const [relativePath, content] of Object.entries(starterFiles)) {
    const filePath = join(rootDir, relativePath);
    ensureParentDirectory(filePath);
    writeFileSync(filePath, content, 'utf8');
  }

  writeFileSync(join(rootDir, 'assets', '.gitkeep'), '', 'utf8');

  return {
    rootDir,
    entryFile: 'deck.md',
    templateId: template.id
  };
}
