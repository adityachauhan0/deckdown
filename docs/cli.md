# CLI Reference

DeckDown is designed to behave like a straightforward build tool: one input, one output target, predictable format rules.

## Synopsis

```bash
deckdown <input> [-o <path>] [--format pdf|png|pptx]
deckdown init [target] [--template <id>]
deckdown studio [target]
deckdown ai-prompt
```

## Output Behavior

- PDF can write to a file with `-o` or to stdout when `-o` is omitted.
- PNG requires `-o` and writes one file per slide into that directory.
- PPTX requires `-o` and writes a single `.pptx` file.
- `--watch` is not implemented.

## Common Commands

Scaffold a workspace:

```bash
deckdown init .
```

Scaffold a document workspace:

```bash
deckdown init . --template paper-letter
```

Launch Studio on the current repo:

```bash
deckdown studio .
```

Print canonical AI instructions:

```bash
deckdown ai-prompt > AGENTS.md
```

PDF file:

```bash
deckdown deck.md -o deck.pdf
```

PDF to stdout:

```bash
deckdown deck.md > deck.pdf
```

PPTX:

```bash
deckdown deck.md -o deck.pptx --format pptx
```

PNG slides:

```bash
deckdown deck.md -o slides --format png
```

Custom page sizing:

```bash
deckdown deck.md -o deck.pdf --page-width 1600 --page-height 900 --margin 68
```

## Options

| Option | Meaning |
| --- | --- |
| `-o, --output <path>` | Output file or directory |
| `-f, --format <format>` | Output format: `pdf`, `png`, or `pptx` |
| `--page-width <pixels>` | Page width override |
| `--page-height <pixels>` | Page height override |
| `--margin <pixels>` | Page margin override |
| `init --template <id>` | Starter workspace template id |
| `ai-prompt` | Print the canonical repo AI instructions |

## Subcommands

| Command | Meaning |
| --- | --- |
| `deckdown init [target]` | Create a starter repo-first DeckDown workspace with templates and `AGENTS.md` |
| `deckdown studio [target]` | Launch the localhost Studio against a deck file or repo folder with a tree sidebar and local docs browser |
| `deckdown ai-prompt` | Print the canonical `AGENTS.md` content for an existing repo |

## Exit Conditions

DeckDown exits non-zero when:
- the output target is invalid for the selected format
- PNG output is requested without Ghostscript
- input parsing or rendering fails

## Notes

- PNG output depends on `gs` being available on `PATH`.
- Direct repo execution is available with `node src/cli.js`.
- Studio serves the same local docs pages used in this repository, including `docs/index.md`, `docs/getting-started.md`, `docs/cli.md`, `docs/authoring.md`, `docs/agent-workflows.md`, and `docs/ai.md`.
- For a higher-level walkthrough, see [Getting Started](./getting-started.md).
- For deck syntax and reusable fragments, see [Authoring Guide](./authoring.md).
