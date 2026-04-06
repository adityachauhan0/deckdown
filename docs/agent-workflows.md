# AI Agent Workflows

DeckDown is not an AI presentation generator. It is a Markdown presentation engine that AI agents can drive reliably.

## Why It Works For Agents

AI agents are strong at:

- summarizing source material
- turning notes into slide-shaped Markdown
- reusing templates and shared fragments
- producing structured text from unstructured context

DeckDown is strong at:

- deterministic local rendering
- repo-native source files
- identical output paths for PDF, PNG, and PPTX
- predictable behavior that is easy to automate and review

That combination makes DeckDown a good render layer in an agent workflow.

## Typical Flow

1. Create or open a repo-first workspace.

```bash
deckdown init .
deckdown studio .
```

2. Gather source material.
   Good inputs include docs, product notes, changelogs, RFCs, architecture docs, and metrics summaries.
3. Have the agent draft `deck.md`.
4. Move repeated or shared material into imported Markdown or YAML fragments.
5. Render the deck with DeckDown.

```bash
deckdown deck.md -o deck.pdf
deckdown deck.md -o deck.pptx --format pptx
deckdown deck.md -o slides --format png
```

6. Review the rendered output.
7. Edit the Markdown and rerun the renderer until the deck is ready.

## Best Fit

DeckDown works best when the agent is producing:

- release review decks
- weekly summaries
- architecture walkthroughs
- project status updates
- product or engineering handoff decks

## What It Is Not

- It does not choose the story for you.
- It does not browse external tools or your knowledge base.
- It does not replace the model or orchestration layer that generates the content.

## See Also

- [Getting Started](./getting-started.md)
- [CLI Reference](./cli.md)
- [Authoring Guide](./authoring.md)
