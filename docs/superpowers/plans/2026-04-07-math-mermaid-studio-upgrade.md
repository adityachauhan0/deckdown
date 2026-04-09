# Math Mermaid Studio Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class LaTeX and Mermaid rendering, upgrade Studio's workspace navigation, add a docs view, and make scaffolded theming self-explanatory.

**Architecture:** Extend the Markdown pipeline with new block types that compile to SVG-backed visuals and flow through existing layout/export/render steps as images. In Studio, replace the flat file list with a tree model and add a lightweight docs panel driven by local markdown content rather than a separate app.

**Tech Stack:** Node.js, MathJax SVG generation, Mermaid SVG generation, existing PDFKit/PptxGenJS renderers, local Studio web app.

---

## Files And Responsibilities

- `src/lexer.js`: recognize block math fences if we support `$$ ... $$` directly.
- `src/parser.js`: emit math/mermaid-aware blocks from tokens.
- `src/layout.js`: resolve new block types into renderable image-backed blocks.
- `src/renderer-pdf.js`: draw generated SVG/PNG-backed math and mermaid assets.
- `src/renderer-png.js`: keep PNG export aligned with PDF rendering behavior.
- `src/renderer-pptx.js`: place rendered math/mermaid assets in PPTX output.
- `src/render-assets.js` or equivalent new helper: central asset rendering cache for math/mermaid SVG generation.
- `src/workspace.js`: scaffold commented `theme.yaml` and any docs/workspace metadata changes.
- `src/studio/server.js`: serve docs content and structured tree data.
- `src/studio/app.js`: render tree view, docs mode, and tree interactions.
- `src/studio/index.html`: add docs toggle and any supporting containers.
- `src/studio/styles.css`: tree/docs styling.
- `__tests__/parser.test.js`: parser coverage for new blocks.
- `__tests__/layout-rendering.test.js`: layout/render coverage for math and mermaid.
- `__tests__/studio.test.js`: Studio tree/docs endpoint and shell coverage.
- `__tests__/workspace.test.js`: scaffolded theme comment coverage.
- `docs/authoring.md`, `docs/cli.md`, `README.md`: user-facing documentation.

## Execution Order

1. Parser and render-asset tests for LaTeX and Mermaid.
2. Minimal implementation for math and mermaid render support.
3. Studio tree/docs tests.
4. Studio tree/docs implementation.
5. Theme scaffold tests and commented theme implementation.
6. Full test pass and browser verification.
