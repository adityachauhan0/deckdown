export const AI_PROMPT_FILE = 'AGENTS.md';

function trimTrailingWhitespace(content) {
  return content.replace(/[ \t]+$/gm, '').trimEnd() + '\n';
}

export function buildAiPrompt() {
  return trimTrailingWhitespace(`# DeckDown AI Instructions

## Purpose
DeckDown is a local-first Markdown compiler for presentations and visual documents. Work in the repository source files directly and keep the output deterministic.

## Source Of Truth
- Treat \`deck.md\` as the main authored source unless the repo explicitly points to another entry file.
- Keep page dimensions, theme imports, and presentation metadata in deck frontmatter.
- Use \`theme.yaml\` for theme tokens and reusable styling.
- Keep research and rough notes in \`notes/\`.
- Keep local images and media in \`assets/\`.

## DeckDown Syntax
- Use Markdown for headings, paragraphs, lists, quotes, links, code, and images.
- Use a line containing only \`---\` for slide breaks.
- Use frontmatter at the top of the file for \`title\`, \`page\`, and \`theme\`.
- Use \`{{ ... }}\` attribute blocks for layout hints, sizing, columns, centering, and image treatment.
- Use \`@import[./path/to/file.yaml]\` when the deck needs reusable YAML config imports.

## Working In DeckDown Studio
- DeckDown Studio is a localhost web app for human-in-the-loop editing and review.
- Prefer making source edits that keep Markdown readable outside the Studio.
- Use Studio diagnostics to resolve syntax and asset issues before exporting.
- Respect the repo-first workflow: Studio edits should map back to physical files in the workspace.
- Keep these repository instructions in \`AGENTS.md\` so external coding agents can pick them up directly.

## CLI Workflow
- \`deckdown studio <target>\` launches the local editor and preview surface.
- \`deckdown init <target>\` creates a starter DeckDown workspace.
- \`deckdown <input> --format pdf|png|pptx\` compiles the deck to deterministic output.
- \`deckdown ai-prompt\` prints these instructions for existing repositories.

## Agent Expectations
- Keep edits minimal, reviewable, and deterministic.
- Preserve author intent and existing project structure.
- Prefer explicit page sizing and local assets over hidden defaults.
- Surface broken syntax, missing assets, or invalid frontmatter immediately instead of guessing.
- Do not replace the Markdown source of truth with generated sidecar state unless the repo already does that.
`);
}
