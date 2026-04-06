@import[./phil-opp-os/theme.yaml]

---
title: DeckDown Sample Presentation
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
    background: '#0f172a'
    text: '#e2e8f0'
    heading: '#f8fafc'
    accent: '#f97316'
    codeBg: '#111827'
  typography:
    lineHeight: 1.55
    headingScale: 2.4
    bodySize: 22
    codeSize: 18
  spacing:
    paragraph: 24
    slidePadding: 60
---

# DeckDown

{{ center middle }}

Author once. Ship to PDF, PNG, and PPTX.

---

# Why teams use it

{{ cols: 2 }}

## Repo-native authoring

- Markdown instead of a browser editor
- Shared slides and themes through imports
- Version-control friendly review flow

{{ col: break }}

## Delivery without rework

- PDF for review and archival
- PNG for visual QA and diffs
- PPTX for downstream handoff

---

# Highlighted code stays readable

```javascript
const outputs = ['pdf', 'png', 'pptx'];

for (const format of outputs) {
  console.log(`deckdown deck.md --format ${format}`);
}
```

{{ center }}

Shiki highlighting is rendered through the same layout pipeline in every output format.

---

# Images and layout, no browser required

![Deck hero](./phil-opp-os/assets/cover.png)
{{ width: 86% center contain height: 430 }}

---

# Reuse content across decks

The next slide is imported from another sample deck in this repository.

---

@import[./phil-opp-os/slides/06-value.md]

# One source, multiple deliverables

{{ center middle }}

Write in Markdown, keep the repo as the source of truth, and export the format each audience needs.
