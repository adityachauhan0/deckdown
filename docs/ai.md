# AI Instructions

DeckDown ships with a canonical `AGENTS.md` contract so human authors and external coding agents can work from the same repo-first rules.

## Recommended Flow

1. Create or open a DeckDown workspace.
2. Keep the authored source in `deck.md`.
3. Run `deckdown studio .` for human-in-the-loop editing, syntax guidance, diagnostics, and preview.
4. Compile to PDF, PNG, or PPTX once the source is clean.

## Repo Setup

New workspaces created with `deckdown init` or first-run Studio now include:

- `deck.md`
- `theme.yaml`
- `notes/inbox.md`
- `assets/`
- `.deckdown/workspace.json`
- `AGENTS.md`

For existing repos, print the canonical instructions with:

```bash
deckdown ai-prompt > AGENTS.md
```

## What Agents Should Respect

- Keep Markdown as the source of truth.
- Keep page dimensions in frontmatter.
- Use `{{ ... }}` for layout hints instead of hidden editor state.
- Use local assets and relative imports.
- Fix diagnostics before exporting.

## See Also

- [AI Agent Workflows](./agent-workflows.md)
- [CLI Reference](./cli.md)
- [Getting Started](./getting-started.md)
