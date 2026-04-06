# DeckDown Handoff Notes

> **For AI Agents:** This document provides full context for continuing development on DeckDown. Read completely before making changes.

---

## Project Introduction

**DeckDown** is a local-first Markdown to PDF/PNG/PPTX presentation compiler. The goal is to enable developers and technical writers to create professional presentations using familiar Markdown tooling, with no cloud dependencies or internet required.

**Vision:** Treat presentations as code - version control them, reuse components via imports, and maintain consistency through shared theme files.

**Core Philosophy:**
- Local-first (no cloud, no accounts, no tracking)
- Markdown-native (write in your preferred editor)
- Composable (import and reuse slides/themes)
- Programmable (YAML config + inline attributes for full control)

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Core | Node.js (ES modules) | Runtime |
| CLI | Commander.js | Argument parsing |
| Parsing | js-yaml | YAML frontmatter parsing |
| PDF Output | PDFKit | PDF generation |
| PNG Output | PDFKit + Ghostscript (`gs`) | PDF→PNG via Ghostscript |
| PPTX Output | pptxgenjs | PowerPoint generation |
| Syntax Highlighting | Shiki | Code block highlighting |
| Testing | Jest | Unit and integration tests |

**Note:** Syntax highlighting is integrated into the rendering pipeline and used across PDF, PNG, and PPTX output.

---

## Architecture

### Pipeline Flow

```
Markdown File
    │
    ▼
┌─────────────────┐
│  resolveImports  │ ← Resolves @import[file] directives recursively
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     lexer       │ ← Tokenizes markdown into tokens
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     parser      │ ← Builds AST from tokens, parses YAML frontmatter
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  layoutEngine   │ ← Calculates positions, merges theme, applies attributes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    renderer     │ ← Renders to PDF, PNG, or PPTX
└─────────────────┘
```

### Key Files

| File | Responsibility |
|------|----------------|
| `src/index.js` | CLI entry point, command-line argument handling |
| `src/lexer.js` | Tokenizes input into: text, heading, code, image, slideBreak, frontmatter, attribute, import tokens |
| `src/parser.js` | Builds document AST: Document → Slides → Blocks |
| `src/resolver.js` | Resolves `@import` directives recursively |
| `src/layout.js` | LayoutEngine class - positioning, theme merging, attribute parsing |
| `src/renderer-pdf.js` | PDF output via PDFKit |
| `src/renderer-png.js` | PNG output via PDFKit + Ghostscript |
| `src/renderer-pptx.js` | PPTX output via pptxgenjs |
| `src/utils.js` | Shared utilities |

---

## Configuration System

### Frontmatter YAML

```yaml
---
title: Presentation Title
page:
  width: 1920      # Page width in pixels
  height: 1080     # Page height in pixels
  margin: 80       # Page margin in pixels
theme:
  fonts:
    heading: DejaVu Sans
    body: DejaVu Sans
    code: DejaVu Sans Mono
    fallback: DejaVu Sans
  colors:
    background: '#ffffff'
    text: '#1a1a1a'
    heading: '#000000'
    accent: '#0066cc'
    codeBg: '#f5f5f5'
  typography:
    lineHeight: 1.5
    headingScale: 2.0
    bodySize: 18
    codeSize: 16
  spacing:
    paragraph: 24
    slidePadding: 60
---
```

### Inline Attributes

Attributes in `{{ }}` are attached to the preceding block:

```markdown
# Heading {{ center }}

Paragraph with {{ width: 60% }} width.

{{ cols: 2 }}
Column 1 content
{{ col: break }}
Column 2 content
```

**Supported attributes:**
- `center`, `middle`, `left`, `right` - positioning
- `width: X%` - block width as percentage
- `scale: X` - block scale factor
- `cols: N` - start N-column layout
- `col: break` - break to next column
- `key: value` - arbitrary key:value pairs

### Import Directive

```markdown
@import[theme.yaml]
@import[slides/intro.md]
@import[shared/code-examples.md]
```

Imports are resolved relative to the main file. Later imports override earlier ones (conflict resolution).

---

## Current Status

**Phase 1-6 COMPLETE** - Core functionality is implemented and verified.

### What Works
- Full pipeline: Markdown → Tokenize → Parse → Layout → Render (PDF/PNG/PPTX)
- `@import[file]` directive for recursive YAML/Markdown imports
- Frontmatter YAML configuration (page size, theme, fonts, colors, typography, spacing)
- Inline `{{ }}` attributes (center, middle, width:X%, scale:X, cols:N, col:break, key:value)
- PDF output via PDFKit (generates valid PDF1.3 with magic byte verification)
- PNG output via PDFKit + Ghostscript
- PPTX output via pptxgenjs
- 53 passing Jest tests across lexer, parser, CLI, layout/rendering, and integration coverage
- Syntax-highlighted code blocks rendered through Shiki
- Release verification via `npm run release-check` and packaging via `npm pack`

### Known Limitations
- **Ghostscript required** - PNG output requires `gs` command installed (no pure-JS fallback)
- **Fonts are mapped to built-ins** - PDF/PPTX output currently map theme fonts to bundled font families rather than embedding arbitrary fonts

---

## File Structure

```
deckdown/
├── src/
│   ├── index.js           # CLI entry point (Commander.js)
│   ├── lexer.js           # Tokenization
│   ├── parser.js          # AST generation
│   ├── resolver.js        # @import resolution
│   ├── layout.js          # Layout engine (theme merging, positioning)
│   ├── renderer-pdf.js    # PDF output (PDFKit)
│   ├── renderer-png.js     # PNG output (Ghostscript)
│   ├── renderer-pptx.js   # PPTX output (pptxgenjs)
│   └── utils.js           # Utilities
├── __tests__/
│   ├── lexer.test.js      # tokenization coverage
│   ├── parser.test.js     # parsing coverage
│   ├── layout-rendering.test.js # highlighting and renderer coverage
│   └── integration.test.js # pipeline and output coverage
├── samples/
│   └── sample-deck.md     # Demo presentation
├── DeckDownVault/          # Obsidian vault (source of truth for design)
│   └── Deckdown/
│       ├── Architecture.md
│       ├── Implementation-Roadmap.md
│       ├── Markdown-Syntax.md
│       ├── Project-Overview.md
│       └── Questions.md
├── jest.config.js
├── package.json
├── README.md
├── .gitignore
└── handoff.md             # This file
```

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Page size | 16:9 (1920x1080) | Standard presentation ratio |
| Configuration | Frontmatter YAML + inline `{{ }}` | Familiar, composable |
| Import syntax | `@import[file]` | Clear, unambiguous |
| Theme merging | Later overrides earlier | Allows local customization |
| Syntax highlighting | Shiki | High-quality, VS Code themes |
| Output formats | PDF, PNG, PPTX | Covers most presentation needs |

---

## Testing

```bash
cd deckdown
npm test  # Or: node --max-old-space-size=512 --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand
```

**Test suite:**
- `lexer.test.js` - tokenization, slide breaks, frontmatter, attributes, imports
- `parser.test.js` - document structure, slides, blocks, metadata
- `layout-rendering.test.js` - Shiki highlighting, layout, and PPTX rendering
- `integration.test.js` - full pipeline, PDF/PNG/PPTX rendering, page sizes, theme colors, imports

**Important:** The current suite passes cleanly with 53 tests.

---

## Obsidian Vault

The project uses an **Obsidian vault** as a "second brain" for design decisions. This vault is the **authoritative source of truth** for project architecture and decisions.

**Location:** `DeckDownVault/Deckdown/` (in parent directory)

**Key notes:**
- `Architecture.md` - Technical architecture decisions
- `Implementation-Roadmap.md` - Phases and progress tracking
- `Markdown-Syntax.md` - Syntax documentation
- `Project-Overview.md` - Project goals and vision
- `Questions.md` - Open questions and decisions pending

**When making significant changes:** Update the vault notes to keep design docs in sync with code.

---

## Next Steps

### High Priority

1. **Error Handling & Validation**
   - Validate frontmatter YAML structure
   - Handle missing import files gracefully (friendly error vs crash)
   - Validate inline attributes
   - Add helpful error messages with context

2. **Font Strategy**
   - Support bundled or embedded custom fonts instead of built-in family mapping
   - Keep PDF and PPTX typography closer to the requested theme

3. **Ghostscript Dependency**
   - PNG rendering requires `gs` command installed
   - Consider pure-JS alternative (e.g., `pdf2pic`) for zero dependencies

### Medium Priority

4. **PNG Rendering Options**
   - Support multiple PNG outputs (one per slide)
   - Add `--scale` option for output resolution

5. **CI and Packaging**
   - Set up GitHub Actions for `npm test` and `npm run release-check`
   - Keep package smoke tests part of the release flow

### Lower Priority

6. **Performance Optimization**
   - Profile larger decks for rendering bottlenecks
   - Optimize only after validation and release flow are stable

---

## Bug History

| Bug | Symptom | Fix |
|-----|---------|-----|
| Lexer `!` character | Infinite loop when `!` not followed by `[` | Added check in `readText()` |
| Frontmatter detection | Couldn't distinguish `---` slide break from `---` frontmatter delimiter | Added `inFrontmatter` state flag |
| PNG async stream | PDFKit streams are async, `generatePDF()` returned before completion | Made `generatePDF()` return Promise |
| PPTX defineSlideMaster | `defineSlideMaster()` requires `title` property | Removed in favor of direct slide creation |

---

## CLI Reference

```bash
# Basic usage
node src/index.js <input.md> [-o <path>]

# Options
-o, --output <path>      Output file or directory (required for PNG and PPTX)
-f, --format <format>    Output format: pdf, png, pptx (default: pdf)
--page-width <pixels>   Page width (default: 1920)
--page-height <pixels>  Page height (default: 1080)
--margin <pixels>       Page margin (default: 80)
```

---

## Contributing

When contributing:

1. **Run tests first** - `npm test` should pass the full 53-test suite
2. **Update vault** - Keep `DeckDownVault/Deckdown/` in sync with design changes
3. **Test outputs** - Verify with magic byte checks (`%PDF-` for PDF, `\x89PNG` for PNG, `PK` for PPTX)
4. **No new dependencies** - Avoid adding runtime dependencies unless necessary
