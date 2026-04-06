---
title: DeckDown README Showcase
page:
  width: 1600
  height: 900
  margin: 64
theme:
  fonts:
    heading: Arial
    body: Helvetica
    code: Courier
  colors:
    background: '#f6f8fc'
    text: '#243041'
    heading: '#0f172a'
    accent: '#2563eb'
    codeBg: '#10172a'
  typography:
    lineHeight: 1.45
    headingScale: 2.35
    bodySize: 22
    codeSize: 17
  spacing:
    paragraph: 22
    slidePadding: 56
---

# Markdown in. Presentation assets out.

DeckDown turns repo-native Markdown into PDF, PNG, and PPTX for AI agents and humans who want a deterministic render path.

Local-first. Markdown-native. Agent-friendly.

{{ cols: 2 }}

## Built for the workflow

- Keep slides in git
- Render the same source to multiple deliverables
- Hand agents a CLI instead of a browser editor

## Visual delivery

- PNGs for README previews and review
- PDF for approval and archival
- PPTX for downstream handoff

{{ col: break }}

![DeckDown showcase cover](./phil-opp-os/assets/site-cover.png)
{{ width: 100% contain height: 480 }}

---

# Shared themes. Imported sections. One deck system.

@import[./readme-showcase-imports.md]

---

# Syntax highlighting that survives export

```javascript
const outputs = ['pdf', 'png', 'pptx'];

for (const format of outputs) {
  console.log(`deckdown notes.md -o deck.${format} --format ${format}`);
}

const deck = {
  source: 'Markdown',
  delivery: outputs,
  mode: 'local-first'
};

export default deck;
```

The same code block stays readable in every supported output format.

---

# Same source, three delivery modes

{{ cols: 2 }}

## PDF

Review-ready output for approvals and archival.

## PNG

Slide-by-slide images for README embeds, QA, and visual diffs.

## PPTX

Handoff-friendly output for teams that live in PowerPoint.

{{ col: break }}

```bash
deckdown showcase.md -o deck.pdf
deckdown showcase.md -o slides --format png
deckdown showcase.md -o deck.pptx --format pptx
```

One Markdown source can target each review and handoff path without changing tools.
