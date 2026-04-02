# DeckDown Handoff Notes

## Project Overview

**DeckDown** is a local-first Markdown to PDF/PNG/PPTX presentation compiler. It uses Obsidian as a "second brain" for planning, with all design decisions tracked in `DeckDownVault/`.

## Current Status

**Phase 1-6 COMPLETE** - All core functionality is implemented and tested.

### What Works
- Full pipeline: Markdown → Tokenize → Parse → Layout → Render (PDF/PNG/PPTX)
- `@import[file]` directive for recursive YAML/Markdown imports
- Frontmatter YAML configuration (page size, theme, fonts, colors, typography, spacing)
- Inline `{{ }}` attributes (center, middle, width:X%, scale:X, cols:N, col:break, key:value)
- PDF output via PDFKit (generates valid PDF1.3)
- PNG output via PDFKit + Ghostscript
- PPTX output via pptxgenjs
- 21 passing Jest tests

### File Structure
```
/home/eden/Documents/DeckDown/
├── DeckDownVault/Deckdown/     # Obsidian vault (source of truth)
├── deckdown/                   # Main project
│   ├── src/
│   │   ├── index.js           # CLI entry point
│   │   ├── lexer.js           # Tokenization
│   │   ├── parser.js          # AST generation
│   │   ├── resolver.js        # @import resolution
│   │   ├── layout.js          # Layout engine
│   │   ├── renderer-pdf.js     # PDF output
│   │   ├── renderer-png.js     # PNG output
│   │   ├── renderer-pptx.js    # PPTX output
│   │   └── utils.js           # Utilities
│   ├── __tests__/             # Jest tests (21 passing)
│   ├── samples/sample-deck.md # Sample presentation
│   └── package.json
└── idea.md                     # Original concept
```

## Next Steps

### High Priority

1. **Shiki Integration** (Phase 4遗留)
   - Code blocks currently render without syntax highlighting
   - Shiki is already in dependencies but not integrated
   - See `Implementation-Roadmap.md` Phase 4

2. **README & Documentation**
   - Create comprehensive README.md for the GitHub repo
   - Document frontmatter YAML schema
   - Document inline attribute syntax
   - Document import directive syntax
   - Add usage examples

3. **Error Handling & Validation**
   - Validate frontmatter YAML structure
   - Handle missing import files gracefully
   - Validate inline attributes
   - Add helpful error messages

4. **Ghostscript Dependency**
   - PNG rendering requires `gs` command installed
   - Consider adding check/friendly error if missing
   - Consider pure-JS alternative (e.g., pdf2pic)

### Medium Priority

5. **Sample Deck Enhancement**
   - Expand `samples/sample-deck.md` to showcase all features
   - Include examples of all attribute types
   - Include code block examples (once Shiki works)

6. **CLI Polish**
   - Add `--watch` mode (flag exists but not implemented)
   - Add `--verbose` for debugging
   - Add `--theme` to override theme file

7. **PNG Rendering Options**
   - Support multiple PNG outputs (one per slide)
   - Add `--scale` option for output resolution

### Lower Priority

8. **Performance**
   - Jest tests cause heap memory issues in CI (OOM after tests pass)
   - Consider running tests with `--runInBand` and limited memory
   - Profile and optimize if needed

9. **GitHub Actions CI**
   - Set up basic CI to run tests
   - Need memory-limited test run command

## Key Design Decisions

| Decision | Choice |
|----------|--------|
| Page size | 16:9 (1920x1080), configurable |
| Configuration | Frontmatter YAML + inline `{{ }}` |
| Import syntax | `@import[file]` directive |
| Syntax highlighting | Shiki (not yet integrated) |
| Output | PDF, PNG, PPTX |
| Theme merging | Later imports override earlier |

## Testing

```bash
cd deckdown
npm test  # Runs Jest with memory limits to avoid OOM
```

All 21 tests should pass. The OOM error after "PASS" is a Jest cleanup issue, not a test failure.

## Vault同步

The Obsidian vault at `DeckDownVault/Deckdown/` contains the authoritative design decisions. Keep it in sync with any changes made in code.

## Bug History

- Lexer: `!` character (not followed by `[`) caused infinite loops - FIXED
- Frontmatter: `inFrontmatter` state flag needed - FIXED
- PNG Renderer: `generatePDF()` must return Promise for async stream - FIXED
- PPTX Renderer: `defineSlideMaster()` requires `title` - FIXED
