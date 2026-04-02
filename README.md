# DeckDown

DeckDown is a local-first Markdown presentation compiler for teams that want one source deck and multiple deliverables. Write slides in Markdown, compose themes and shared slide fragments with `@import[...]`, and render the same deck to PDF, PNG, or PPTX.

DeckDown is designed for repo-native presentation authoring:
- Markdown input, not a browser editor
- reusable themes and slide partials
- deterministic local output
- PDF, PNG, and PPTX from the same source
- no cloud dependency in the render path

## Quick Start

Install the CLI:

```bash
npm install -g deckdown
```

Create `deck.md`:

```markdown
---
title: Product Review
theme:
  colors:
    background: '#ffffff'
    text: '#111827'
    heading: '#1d4ed8'
    accent: '#2563eb'
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

More examples live in [samples/](./samples).

## Installation

Use the path that matches how you plan to consume DeckDown.

| Use case | Command |
| --- | --- |
| Global CLI from npm | `npm install -g deckdown` |
| One-off usage from a published package | `npx deckdown@latest --help` |
| Install the local release artifact | `npm install -g ./dist/deckdown-1.0.0.tgz` |
| Work on the repo locally | `npm install` |
| Make the repo checkout behave like the published CLI | `npm link` |

## Requirements

DeckDown itself is a Node.js CLI. Some output or verification flows also depend on local system tools.

| Task | Requirement |
| --- | --- |
| Run DeckDown | Node.js `>= 18` |
| Generate PDF | no extra system dependency |
| Generate PPTX | no extra system dependency |
| Generate PNG | Ghostscript (`gs`) on `PATH` |
| Run `npm run release-check` | `gs`, `pdftoppm`, and LibreOffice `soffice` |

## CLI Usage

Basic form:

```bash
deckdown <input> -o <output> [--format pdf|png|pptx]
```

Common commands:

```bash
# PDF
deckdown deck.md -o deck.pdf

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
{{ width: 72% center }}

{{ cols: 2 }}
### Left Column

Content for the first column.

{{ col: break }}
### Right Column

Content for the second column.
```

Available built-in attributes:

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

### Imports

Use `@import[...]` to compose decks from reusable files:

```markdown
@import[theme.yaml]
@import[slides/title.md]
@import[slides/metrics.md]
```

Imports are resolved recursively. YAML imports are merged before document frontmatter, and document metadata wins on conflicts.

## Output Formats

DeckDown supports three output targets from the same Markdown source:

| Format | Output | Notes |
| --- | --- | --- |
| PDF | single file | best for review, export, and archival |
| PNG | directory of slide images | useful for visual QA and diffs |
| PPTX | single file | useful for handoff into presentation tooling |

Syntax-highlighted code is rendered across PDF, PNG, and PPTX using the same layout pipeline.

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

That produces the npm-installable artifact at [dist/deckdown-1.0.0.tgz](./dist/deckdown-1.0.0.tgz).

## License

[MIT](./LICENSE)
