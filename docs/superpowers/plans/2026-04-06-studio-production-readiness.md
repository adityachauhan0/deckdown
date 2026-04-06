# DeckDown Studio Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DeckDown Studio production-ready for repo-first agent workflows by adding workspace bootstrapping, a reliable localhost editing flow for empty projects, and stronger slide review/navigation behavior.

**Architecture:** Extend the existing CLI and Studio server rather than adding a second app surface. Keep the compiler as the shared source of truth, add one workspace scaffold utility used by both CLI and Studio, and harden the current Studio UI around explicit project state, active-slide mapping, and actionable diagnostics.

**Tech Stack:** Node.js ESM, Commander, built-in `fs/path/http`, existing DeckDown compiler/renderers, browser UI in plain HTML/CSS/JS, Jest.

---

### Task 1: Workspace Scaffolding

**Files:**
- Create: `src/workspace.js`
- Modify: `src/index.js`
- Modify: `__tests__/cli.test.js`
- Create: `__tests__/workspace.test.js`

- [ ] Add failing tests for workspace scaffolding and CLI exposure.
- [ ] Implement `createWorkspace()` with deterministic starter files:
  - `deck.md`
  - `theme.yaml`
  - `notes/inbox.md`
  - `assets/.gitkeep`
  - `.deckdown/workspace.json`
- [ ] Add `deckdown init [target]` to the CLI with safe non-overwrite behavior unless `--force` is passed.
- [ ] Re-run targeted tests, then commit the workspace scaffold slice.

### Task 2: Empty Project + Studio Bootstrap

**Files:**
- Modify: `src/studio/server.js`
- Modify: `src/studio/index.html`
- Modify: `src/studio/app.js`
- Modify: `src/studio/styles.css`
- Modify: `__tests__/studio.test.js`

- [ ] Add failing tests for starting Studio on an empty directory and bootstrapping a workspace over the local API.
- [ ] Let `/api/project` return `initialFile: null` when no deck exists plus workspace capability metadata.
- [ ] Add `/api/workspace/init` so Studio can create the starter workspace locally without leaving the app.
- [ ] Add a first-run empty state in Studio with a single “Create starter workspace” action and success path into the generated `deck.md`.
- [ ] Re-run targeted tests, then commit the bootstrap slice.

### Task 3: Slide Review Fidelity

**Files:**
- Modify: `src/studio/app.js`
- Modify: `src/studio/index.html`
- Modify: `src/studio/styles.css`
- Modify: `__tests__/studio.test.js`

- [ ] Add failing tests for richer preview metadata where practical at the server/DOM-contract level.
- [ ] Upgrade slide tabs from bare numbers to slide labels based on heading/title when available.
- [ ] Keep active slide and preview scroll in sync from both editor movement and preview clicks.
- [ ] Add a focused current-slide summary/state so the human always knows which slide they are editing.
- [ ] Preserve stale preview behavior and ensure diagnostics remain actionable after navigation changes.
- [ ] Re-run targeted tests, then commit the preview fidelity slice.

### Task 4: Ship Path Hardening

**Files:**
- Modify: `docs/cli.md`
- Modify: `docs/getting-started.md`
- Modify: `docs/agent-workflows.md`
- Modify: `package.json` if packaging metadata must include new assets/docs behavior

- [ ] Update docs to cover `deckdown init`, Studio bootstrap flow, and repo-first workspace structure.
- [ ] Verify package metadata still ships the required runtime files for Studio and CLI usage.
- [ ] Run the full test suite and browser-check the localhost Studio flow for:
  - existing deck
  - empty directory bootstrap
  - export after edits
- [ ] Only then mark the batch complete.
