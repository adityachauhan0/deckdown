# Getting Started

DeckDown is a published npm package. Install it, render one file, then move on to the authoring and CLI docs when you want the full model.

## Install

Global install:

```bash
npm install -g deckdown@latest
```

Run once without a global install:

```bash
npx deckdown@latest deck.md -o deck.pdf
```

Check the published version:

```bash
npm view deckdown version
```

If you are working from a clone of this repository, you can also use:

```bash
npm install
npm link
```

## Requirements

- Node.js `>= 18`
- Ghostscript (`gs`) only when generating PNG output

The release check also uses:

- `gs`
- `pdftoppm`
- LibreOffice `soffice`

## First Workspace

Scaffold a local workspace:

```bash
deckdown init .
deckdown init . --template presentation-4x3
```

Open the localhost editor:

```bash
deckdown studio .
```

If you start Studio in an empty folder, it now opens a first-run template picker for presentation and document sizes.
The Studio sidebar now uses a collapsible tree for repo files, and the top bar includes a Docs toggle that opens the local docs browser for this repository.

Starter `deck.md`:

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

Render PDF:

```bash
deckdown deck.md -o deck.pdf
```

Render PPTX:

```bash
deckdown deck.md -o deck.pptx --format pptx
```

Render PNG slides:

```bash
deckdown deck.md -o slides --format png
```

## Local Development

If you are working from the repository:

```bash
npm install
npm test
npm run release-check
```

Reference decks:
- [`samples/sample-deck.md`](../samples/sample-deck.md)
- [`samples/phil-opp-os/presentation.md`](../samples/phil-opp-os/presentation.md)

## Next Read

- [CLI Reference](./cli.md) for exact flags and output rules
- [Authoring Guide](./authoring.md) for frontmatter, imports, and layout attributes
- [AI Agent Workflows](./agent-workflows.md) for using DeckDown as a render engine
- [AI Instructions](./ai.md) for the canonical `AGENTS.md` flow
