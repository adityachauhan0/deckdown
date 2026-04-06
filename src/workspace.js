import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const STARTER_FILES = {
  'deck.md': `---
title: Welcome to DeckDown
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
`,
  'theme.yaml': `colors:
  background: '#ffffff'
  text: '#111827'
  heading: '#0f172a'
  accent: '#2563eb'
  codeBg: '#f8fafc'
`,
  'notes/inbox.md': `# Inbox

- Capture source material here before turning it into slides.
`,
  '.deckdown/workspace.json': JSON.stringify({
    version: 1,
    entryFile: 'deck.md',
    notesDir: 'notes',
    assetsDir: 'assets'
  }, null, 2)
};

const STARTER_DIRECTORIES = [
  'assets',
  'notes',
  '.deckdown'
];

function ensureParentDirectory(filePath) {
  mkdirSync(resolve(filePath, '..'), { recursive: true });
}

export function createWorkspace(target, options = {}) {
  const rootDir = resolve(target);
  mkdirSync(rootDir, { recursive: true });

  const starterPaths = [
    ...STARTER_DIRECTORIES.map(directory => join(rootDir, directory)),
    ...Object.keys(STARTER_FILES).map(file => join(rootDir, file)),
    join(rootDir, 'assets', '.gitkeep')
  ];

  if (!options.force && starterPaths.some(filePath => existsSync(filePath))) {
    throw new Error(`Workspace already exists at ${rootDir}. Use --force to overwrite starter files.`);
  }

  for (const directory of STARTER_DIRECTORIES) {
    mkdirSync(join(rootDir, directory), { recursive: true });
  }

  for (const [relativePath, content] of Object.entries(STARTER_FILES)) {
    const filePath = join(rootDir, relativePath);
    ensureParentDirectory(filePath);
    writeFileSync(filePath, content, 'utf8');
  }

  writeFileSync(join(rootDir, 'assets', '.gitkeep'), '', 'utf8');

  return {
    rootDir,
    entryFile: 'deck.md'
  };
}
