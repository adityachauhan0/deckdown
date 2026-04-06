# CLI Reference

DeckDown is designed to behave like a straightforward build tool: one input, one output target, predictable format rules.

## Synopsis

```bash
deckdown <input> [-o <path>] [--format pdf|png|pptx]
```

## Output Behavior

- PDF can write to a file with `-o` or to stdout when `-o` is omitted.
- PNG requires `-o` and writes one file per slide into that directory.
- PPTX requires `-o` and writes a single `.pptx` file.
- `--watch` is not implemented.

## Common Commands

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

## Exit Conditions

DeckDown exits non-zero when:
- the output target is invalid for the selected format
- PNG output is requested without Ghostscript
- input parsing or rendering fails

## Notes

- PNG output depends on `gs` being available on `PATH`.
- Direct repo execution is available with `node src/cli.js`.
- For a higher-level walkthrough, see [Getting Started](./getting-started.md).
- For deck syntax and reusable fragments, see [Authoring Guide](./authoring.md).
