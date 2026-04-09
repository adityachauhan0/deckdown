# DeckDown Studio Editor And AI Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade DeckDown Studio from a textarea-based editor to a production-grade authoring surface with real syntax highlighting, inline diagnostics, working file/sidebar controls, template-based project creation, and explicit AI-facing usage surfaces in the repo and CLI.

**Architecture:** Replace the raw textarea editor with a CodeMirror 6 surface backed by the existing Studio server and compiler APIs. Add a small DeckDown editor module for syntax highlighting, autocomplete, and inline linting, expand workspace scaffolding to support templates, and add canonical AI instructions as static docs plus a CLI print command.

**Tech Stack:** Node.js ESM, Commander, existing Studio localhost server, CodeMirror 6 packages, plain HTML/CSS/JS, Jest, Chrome DevTools verification.

---

### Task 1: Editor Platform Upgrade

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/studio/index.html`
- Modify: `src/studio/app.js`
- Modify: `src/studio/styles.css`
- Create: `src/studio/editor.js`
- Create: `src/studio/deckdown-language.js`
- Test: `__tests__/studio.test.js`

- [ ] Step 1: Write failing tests for any new static assets or DOM contract required by the editor bundle.
- [ ] Step 2: Run targeted tests to verify the new editor surface is not implemented yet.
- [ ] Step 3: Add CodeMirror 6 dependencies and create a focused editor wrapper module.
- [ ] Step 4: Replace the textarea-driven state path with editor-backed getters/setters while preserving autosave, preview, and slide sync.
- [ ] Step 5: Fix the file toggle/sidebar behavior on desktop and mobile using explicit pinned/collapsed state instead of the current always-on desktop layout.
- [ ] Step 6: Re-run targeted tests and browser-check the upgraded editor shell.

### Task 2: Real-Time Syntax Highlighting, Inline Diagnostics, And Autocomplete

**Files:**
- Modify: `src/studio/editor.js`
- Modify: `src/studio/deckdown-language.js`
- Modify: `src/studio/app.js`
- Modify: `src/studio/styles.css`
- Possibly modify: `src/index.js`
- Test: `__tests__/studio.test.js`
- Test: `__tests__/build-presentation.test.js`
- Create: `__tests__/deckdown-language.test.js`

- [ ] Step 1: Write failing tests for DeckDown-specific syntax labeling and any new compiler diagnostics needed for inline feedback.
- [ ] Step 2: Run those tests to verify they fail for the intended reason.
- [ ] Step 3: Add DeckDown syntax rules for frontmatter, slide breaks, imports, and attribute blocks.
- [ ] Step 4: Add CodeMirror autocomplete/snippet sources for headings, slide breaks, imports, image blocks, columns, title slides, and frontmatter keys.
- [ ] Step 5: Surface compiler diagnostics inline in the editor and keep the diagnostics panel synchronized with live lint state.
- [ ] Step 6: Re-run targeted tests and browser-check that typing shows immediate syntax/diagnostic feedback.

### Task 3: Template-Based Project Creation Flow

**Files:**
- Modify: `src/workspace.js`
- Modify: `src/studio/server.js`
- Modify: `src/studio/index.html`
- Modify: `src/studio/app.js`
- Modify: `src/studio/styles.css`
- Modify: `src/index.js`
- Test: `__tests__/workspace.test.js`
- Test: `__tests__/studio.test.js`
- Test: `__tests__/cli.test.js`

- [ ] Step 1: Write failing tests for template-aware workspace creation via CLI and Studio API.
- [ ] Step 2: Run targeted tests to verify the current bootstrap path is insufficient.
- [ ] Step 3: Extend workspace scaffolding to support named templates:
  - `presentation-16-9`
  - `presentation-4-3`
  - `document-a4`
  - `document-letter`
  - `blank-custom`
- [ ] Step 4: Replace the empty-project placeholder with a real project-creation screen in Studio that lets the user choose a template and create the workspace without leaving localhost.
- [ ] Step 5: Add matching CLI support so `deckdown init` can choose templates directly.
- [ ] Step 6: Re-run targeted tests and browser-check empty-directory project creation from the UI.

### Task 4: AI Instructions And CLI Prompt Surface

**Files:**
- Create: `AGENTS.md`
- Create: `docs/ai.md`
- Modify: `README.md`
- Modify: `docs/index.md`
- Modify: `docs/cli.md`
- Modify: `docs/agent-workflows.md`
- Modify: `src/index.js`
- Test: `__tests__/cli.test.js`

- [ ] Step 1: Write failing CLI tests for an `ai-prompt` command.
- [ ] Step 2: Run those tests to confirm the command does not exist yet.
- [ ] Step 3: Add a canonical AI prompt generator to the CLI that prints detailed DeckDown usage instructions for agents.
- [ ] Step 4: Add repo-root AI instructions and link them from the README/docs.
- [ ] Step 5: Re-run targeted CLI/doc verification.

### Task 5: Final Hardening And Verification

**Files:**
- Verify across all touched files above

- [ ] Step 1: Run the full test suite.
- [ ] Step 2: Run `npm run release-check`.
- [ ] Step 3: Browser-check Studio for:
  - existing repo editing
  - sidebar toggle behavior
  - syntax highlighting
  - live diagnostics while typing malformed DeckDown syntax
  - autocomplete/snippet insertion
  - empty-directory template creation
- [ ] Step 4: Request one final code review and resolve any material issues before closing the batch.
