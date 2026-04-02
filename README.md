# DeskDown

**DeskDown** is a local-first Markdown to PDF/PNG/PPTX presentation compiler. Write your presentations in Markdown with YAML frontmatter configuration, and compile them to professional presentations.

## Features

- **Markdown-based** - Write presentations in familiar Markdown syntax
- **Multiple output formats** - PDF, PNG, and PPTX support
- **YAML frontmatter configuration** - Customize page size, theme, fonts, colors, and more
- **Inline attributes** - Position and style content with `{{ }}` syntax
- **Import system** - Reuse slides and themes with `@import[file]` directive
- **Column layouts** - Create multi-column slides easily
- **Local-first** - No cloud dependencies, works entirely offline

## Installation

```bash
npm install
```

## Usage

```bash
# Basic usage
node src/index.js deck.md -o output.pdf

# Specify format
node src/index.js deck.md -o output.png --format png

# Custom page size
node src/index.js deck.md -o output.pdf --page-width 1920 --page-height 1080

# With margin
node src/index.js deck.md -o output.pdf --margin 60
```

## Markdown Syntax

### Frontmatter

Configure your presentation with YAML frontmatter:

```yaml
---
title: My Presentation
page:
  width: 1920
  height: 1080
  margin: 80
theme:
  fonts:
    heading: DejaVu Sans
    body: DejaVu Sans
    code: DejaVu Sans Mono
  colors:
    background: '#ffffff'
    text: '#1a1a1a'
    heading: '#000000'
    accent: '#0066cc'
  typography:
    lineHeight: 1.5
    headingScale: 2.0
    bodySize: 18
---
```

### Slide Breaks

Separate slides with a line containing just `---`:

```markdown
# Slide 1

Content for slide 1

---

# Slide 2

Content for slide 2
```

### Inline Attributes

Position and style content with `{{ }}` attributes:

```markdown
# Centered Heading {{ center }}

This text is {{ width: 60% }} positioned with 60% width.

{{ cols: 2 }}
Content for column 1
{{ col: break }}
Content for column 2
```

**Available attributes:**

| Attribute | Description |
|-----------|-------------|
| `{{ center }}` | Center the block |
| `{{ middle }}` | Vertically center the block |
| `{{ left }}` | Left-align the block |
| `{{ right }}` | Right-align the block |
| `{{ width: X% }}` | Set block width to X percent |
| `{{ scale: X }}` | Scale block by X factor |
| `{{ cols: N }}` | Start N-column layout |
| `{{ col: break }}` | Break to next column |
| `{{ key: value }}` | Custom key:value attributes |

### Import Directive

Reuse external files with `@import`:

```markdown
@import[theme.yaml]
@import[slides/common.md]
```

Imports are resolved recursively, and later imports override earlier ones.

## Project Structure

```
deskdown/
├── src/
│   ├── index.js           # CLI entry point
│   ├── lexer.js           # Tokenization
│   ├── parser.js          # AST generation
│   ├── resolver.js        # Import resolution
│   ├── layout.js          # Layout engine
│   ├── renderer-pdf.js    # PDF output (PDFKit)
│   ├── renderer-png.js    # PNG output (Ghostscript)
│   ├── renderer-pptx.js   # PPTX output (pptxgenjs)
│   └── utils.js           # Utilities
├── __tests__/             # Jest tests
├── samples/               # Sample presentations
└── package.json
```

## Testing

```bash
npm test
```

## Dependencies

- **PDFKit** - PDF generation
- **pptxgenjs** - PowerPoint generation
- **js-yaml** - YAML frontmatter parsing
- **Shiki** - Syntax highlighting (integration pending)
- **Ghostscript** - PNG conversion (must be installed separately)

## License

MIT
