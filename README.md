# DeckDown

DeckDown is a local-first Markdown presentation compiler for teams that want one source deck and multiple deliverables. Write slides in Markdown, compose themes and slide fragments with `@import[...]`, and render the same deck to PDF, PNG, or PPTX.

DeckDown is built for repo-native presentation authoring:
- Markdown input instead of a browser editor
- reusable themes and imported slide sections
- deterministic local output
- syntax-highlighted code across every output format
- no cloud dependency in the render path

## Why DeckDown

Most presentation tools optimize for interactive editing. DeckDown optimizes for authors who want presentations to behave like source code:

- keep decks in git
- review changes as text
- share theme files across multiple decks
- generate multiple deliverables from the same source
- run the full render path offline

## Features

- Markdown slides with YAML frontmatter
- Recursive `@import[...]` for Markdown and YAML
- Configurable page dimensions, colors, fonts, typography, and spacing
- Layout attributes such as `center`, `middle`, `width`, `scale`, `cols`, `cover`, and `contain`
- Shiki-powered syntax highlighting
- PDF, PNG, and PPTX output from the same deck

## Installation

Use the path that matches how you plan to consume DeckDown.

| Use case | Command |
| --- | --- |
| Install globally from npm | `npm install -g deckdown` |
| Run without global install | `npx deckdown@latest --help` |
| Install a locally packed release | `npm install -g ./dist/deckdown-<version>.tgz` |
| Work on the repo locally | `npm install` |
| Make the local checkout act like the published CLI | `npm link` |

## Requirements

DeckDown itself is a Node.js CLI. Some output and verification flows also depend on local system tools.

| Task | Requirement |
| --- | --- |
| Run DeckDown | Node.js `>= 18` |
| Generate PDF | no extra system dependency |
| Generate PPTX | no extra system dependency |
| Generate PNG | Ghostscript (`gs`) on `PATH` |
| Run `npm run release-check` | `gs`, `pdftoppm`, and LibreOffice `soffice` |

## Quick Start

Create `deck.md`:

```markdown
---
title: Product Review
theme:
  colors:
    background: '#ffffff'
    text: '#111827'
    heading: '#0f172a'
    accent: '#2563eb'
    codeBg: '#f8fafc'
---

# Product Review

DeckDown compiles Markdown slides to PDF, PNG, and PPTX.

---

# Shared Source, Multiple Outputs

- PDF for review
- PNG for visual diffing
- PPTX for handoff
```

Render it:

```bash
deckdown deck.md -o deck.pdf
deckdown deck.md -o deck.pptx --format pptx
deckdown deck.md -o slides --format png
```

Reference decks live in [samples/](./samples).

## CLI Usage

Basic form:

```bash
deckdown <input> [-o <path>] [--format pdf|png|pptx]
```

Output behavior:
- PDF can write to a file or to stdout when `-o` is omitted
- PNG requires `-o` and writes one image per slide into that directory
- PPTX requires `-o` and writes a single `.pptx` file

Common commands:

```bash
# PDF file
deckdown deck.md -o deck.pdf

# PDF to stdout
deckdown deck.md > deck.pdf

# PPTX
deckdown deck.md -o deck.pptx --format pptx

# PNG slide set
deckdown deck.md -o slides --format png

# Override page size
deckdown deck.md -o deck.pdf --page-width 1600 --page-height 900 --margin 68
```

Direct repo execution is also available:

```bash
node src/cli.js deck.md -o deck.pdf
```

Run `deckdown --help` for the current option list.

## Authoring Model

DeckDown uses a small Markdown-plus-directives syntax for presentations.

### Frontmatter

Use YAML frontmatter to define page and theme settings:

```yaml
---
title: My Deck
page:
  width: 1920
  height: 1080
  margin: 80
theme:
  fonts:
    heading: Helvetica
    body: Helvetica
    code: Courier
  colors:
    background: '#ffffff'
    text: '#111827'
    heading: '#0f172a'
    accent: '#2563eb'
    codeBg: '#f8fafc'
  typography:
    lineHeight: 1.5
    headingScale: 2.2
    bodySize: 22
    codeSize: 18
  spacing:
    paragraph: 24
    slidePadding: 60
---
```

### Slide Breaks

Separate slides with a line containing only `---`:

```markdown
# Slide One

Content

---

# Slide Two
```

### Block Attributes

Attach layout attributes with `{{ ... }}`:

```markdown
# Centered Title {{ center }}

![Architecture](./diagram.png)
{{ width: 72% center contain height: 430 }}

{{ cols: 2 }}
### Left Column

Content for the first column.

{{ col: break }}
### Right Column

Content for the second column.
```

Supported built-in attributes:

| Attribute | Effect |
| --- | --- |
| `{{ center }}` | Center the block horizontally |
| `{{ middle }}` | Center the block vertically in the slide content area |
| `{{ left }}` | Left align the block |
| `{{ right }}` | Right align the block |
| `{{ width: X% }}` | Set block width as a percentage of available content width |
| `{{ scale: X }}` | Scale a block relative to available width |
| `{{ cols: N }}` | Start an `N` column layout |
| `{{ col: break }}` | Move to the next column |
| `{{ cover }}` | Render an image as cover within its block bounds |
| `{{ contain }}` | Render an image contained within its block bounds |
| `{{ height: N }}` | Set an explicit image height |

### Imports

Use `@import[...]` to compose decks from reusable files:

```markdown
@import[theme.yaml]
@import[slides/title.md]
@import[slides/metrics.md]
```

Imports are resolved recursively. YAML imports are merged before document frontmatter, and document metadata wins on conflicts.

## Code Highlighting

Fenced code blocks with a language identifier are highlighted with Shiki and carried through PDF, PNG, and PPTX output.

````markdown
```javascript
const outputs = ['pdf', 'png', 'pptx'];
```
````

## Images

DeckDown currently expects local image paths.

```markdown
![Diagram](./diagram.png)

![Hero](./cover.png)
{{ width: 86% center contain height: 430 }}
```

## Output Formats

| Format | Output | Notes |
| --- | --- | --- |
| PDF | single file or stdout | best for review, export, and archival |
| PNG | directory of slide images | useful for visual QA and diffs |
| PPTX | single file | useful for handoff into presentation tooling |

## Current Limitations

- PNG output requires Ghostscript (`gs`) on `PATH`
- Images currently use local file paths
- Watch mode is not implemented yet

## Examples

Reference decks in this repo:
- [samples/sample-deck.md](./samples/sample-deck.md)
- [samples/phil-opp-os/presentation.md](./samples/phil-opp-os/presentation.md)

## Release Verification

Before publishing, run:

```bash
npm run release-check
```

The release gate verifies:
- required local tools
- isolated Jest suites
- sample PDF, PNG, and PPTX renders
- PDF and PPTX round-trip image conversion
- `npm pack` output
- packed CLI execution from the generated tarball

`npm publish` is guarded by `prepublishOnly`, which re-runs the release gate before publish.

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Create a publishable tarball locally:

```bash
npm pack --pack-destination dist
```

That produces an npm-installable artifact in [dist/](./dist).

## License

[MIT](./LICENSE)
