# Authoring Guide

DeckDown keeps the authoring model intentionally small: Markdown for content, YAML for deck settings, and a handful of layout directives for the cases where plain Markdown is not enough.

## Deck Shape

Most decks follow this pattern:

```markdown
---
title: My Deck
---

# Title Slide

---

# Section Slide
```

Use shared files when you want reusable themes or repeated sections. Keep the source readable first; use directives to refine layout, not to rebuild a slide editor inside Markdown.

## Frontmatter

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

## Slide Breaks

Separate slides with a line containing only `---`:

```markdown
# Slide One

Content

---

# Slide Two
```

## Imports

Use `@import[...]` to compose decks from shared files:

```markdown
@import[theme.yaml]
@import[slides/title.md]
@import[slides/metrics.md]
```

Import behavior:
- imports are resolved recursively
- YAML imports are merged into the deck metadata before the document frontmatter is applied
- document metadata wins when there is a conflict
- relative image paths inside imported Markdown are resolved against the imported file

This makes imports useful for:

- shared themes
- reusable slide fragments
- section-level content blocks
- deck-wide metadata defaults

## Layout Attributes

Attributes are written in `{{ ... }}` blocks.

Example:

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

Supported attributes:

| Attribute | Effect |
| --- | --- |
| `{{ center }}` | Center the block horizontally |
| `{{ middle }}` | Center the block vertically in the slide content area |
| `{{ left }}` | Left align the block |
| `{{ right }}` | Right align the block |
| `{{ width: X% }}` | Set block width as a percentage |
| `{{ scale: X }}` | Scale a block relative to available width |
| `{{ cols: N }}` | Start a column layout |
| `{{ col: break }}` | Move to the next column |
| `{{ cover }}` | Render an image as cover within its block bounds |
| `{{ contain }}` | Render an image contained within its block bounds |
| `{{ height: N }}` | Set an explicit image height |

## Code Blocks

Fenced code blocks with language identifiers are highlighted with Shiki:

````markdown
```javascript
const outputs = ['pdf', 'png', 'pptx'];
```
````

Code highlighting is carried through PDF, PNG, and PPTX output.

## Images

DeckDown currently expects local image paths:

```markdown
![Diagram](./diagram.png)

![Hero](./cover.png)
{{ width: 86% center contain height: 430 }}
```

External URLs are left untouched by the importer, so keep image assets in the repo when you want portable output.

## Recommended Workflow

1. Draft the deck in a single Markdown file.
2. Split repeated content into shared slide fragments or YAML files.
3. Add layout attributes only where the default flow is not enough.
4. Render PDF first, then PNG or PPTX once the structure is stable.

## See Also

- [Getting Started](./getting-started.md)
- [CLI Reference](./cli.md)
- [AI Agent Workflows](./agent-workflows.md)
