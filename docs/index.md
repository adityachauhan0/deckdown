# DeckDown Docs

DeckDown turns Markdown into presentation files locally. It is built for people and agents who want a repo-native source of truth and deterministic PDF, PNG, and PPTX output.

## Start Here

If you want the shortest path from install to first render, read:

1. [Getting Started](./getting-started.md)
2. [CLI Reference](./cli.md)
3. [Authoring Guide](./authoring.md)
4. [AI Agent Workflows](./agent-workflows.md)

## Fast Commands

```bash
npm install -g deckdown@latest
deckdown init .
deckdown studio .
deckdown deck.md -o deck.pdf
deckdown deck.md -o deck.pptx --format pptx
deckdown deck.md -o slides --format png
```

## What The Docs Cover

- installation and first render
- command-line usage and output behavior
- frontmatter, imports, and layout attributes
- code highlighting, images, and slide composition
- recommended agent workflows

## Reference Material

- [`README.md`](../README.md) for the product overview
- [`samples/sample-deck.md`](../samples/sample-deck.md) for a compact example
- [`samples/phil-opp-os/presentation.md`](../samples/phil-opp-os/presentation.md) for a larger deck
