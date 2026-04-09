# Changelog

## 1.2.2

- Added a stronger Studio quality-of-life layer with inline asset preview, persisted layout preferences, keyboard shortcuts, and per-tab file session tracking.
- Added HTML-aware document preview for `README.md` and `docs/*.md`, including safe local asset rendering and Studio-aware internal docs navigation.
- Refined Studio file handling, export targeting, slide segmentation, and bootstrap state to remove several preview and workspace regressions.
- Refreshed the package surface for `v1.2.2` with a new README, a new release showcase deck, and fresh Studio screenshots generated from real DeckDown source.
- Kept release verification green across Jest, export rendering, packaging, and packed CLI smoke tests.

## 1.2.1

- Upgraded DeckDown Studio from a plain textarea to a CodeMirror-based editor with syntax highlighting, autocomplete, inline diagnostics, and selection-aware slide sync.
- Expanded Studio with a collapsible workspace tree, active-slide outline, docs view, resizable panes, and improved fixed-stage preview sizing.
- Added first-run project templates for Studio and `deckdown init`, including a more instructive scaffolded `theme.yaml`.
- Added `deckdown ai-prompt`, repo-root `AGENTS.md`, and AI-focused documentation for external agent workflows.
- Added LaTeX and Mermaid rendering support in the Studio preview and export pipeline.
- Fixed Mermaid `classDiagram` rendering so labels and members render as SVG text in the preview/export path instead of disappearing HTML labels.
- Hardened release verification across the new Studio/editor/runtime surface.

## 1.2.0

- Added `deckdown init` for repo-first workspace bootstrapping with starter deck, theme, notes, assets, and workspace metadata.
- Added `deckdown studio` first-run bootstrap flow for empty directories, plus local export controls for PDF, PNG, and PPTX.
- Improved Studio usability with syntax-hint toolbar actions, slide labels, active-slide context, actionable diagnostics, and stale-preview retention.
- Added compiler diagnostics for empty decks, missing titles, and missing local image assets.
- Hardened release verification to cover Studio, workspace scaffolding, slide-label logic, and packaged Studio runtime files.

## 1.0.0

- Initial public release of DeckDown with deterministic Markdown-to-PDF, PNG, and PPTX compilation.
