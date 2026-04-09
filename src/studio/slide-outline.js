import { deriveSlideLabels } from './slide-labels.js';

function truncate(text, length = 42) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized;
}

function parseComponentLines(slideContent, slideStart) {
  const components = [];
  const lines = String(slideContent || '').replace(/\r/g, '').split('\n');
  let offset = 0;
  let inCodeBlock = false;
  let pendingCode = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const absoluteOffset = slideStart + offset;

    if (inCodeBlock) {
      if (/^```/.test(trimmed)) {
        inCodeBlock = false;
        pendingCode = null;
      }
      offset += line.length + 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      components.push({
        kind: 'heading',
        label: truncate(headingMatch[2]),
        detail: `H${headingMatch[1].length}`,
        offset: absoluteOffset
      });
      offset += line.length + 1;
      continue;
    }

    const codeMatch = trimmed.match(/^```([\w-]+)?/);
    if (codeMatch) {
      inCodeBlock = true;
      pendingCode = codeMatch[1] || '';
      components.push({
        kind: 'code',
        label: pendingCode ? `Code (${pendingCode})` : 'Code block',
        detail: 'Code',
        offset: absoluteOffset
      });
      offset += line.length + 1;
      continue;
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      components.push({
        kind: 'image',
        label: truncate(imageMatch[1] || imageMatch[2]),
        detail: 'Image',
        offset: absoluteOffset
      });
      offset += line.length + 1;
      continue;
    }

    if (/^\{\{.*\}\}$/.test(trimmed)) {
      components.push({
        kind: 'layout',
        label: truncate(trimmed.replace(/^\{\{\s*|\s*\}\}$/g, '')),
        detail: 'Layout',
        offset: absoluteOffset
      });
      offset += line.length + 1;
      continue;
    }

    const listMatch = trimmed.match(/^([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      components.push({
        kind: 'list',
        label: truncate(listMatch[2]),
        detail: 'List',
        offset: absoluteOffset
      });
      offset += line.length + 1;
      continue;
    }

    if (trimmed) {
      components.push({
        kind: 'paragraph',
        label: truncate(trimmed),
        detail: 'Text',
        offset: absoluteOffset
      });
    }

    offset += line.length + 1;
  }

  return components;
}

export function deriveSlideOutline(content, slideRanges = []) {
  const labels = deriveSlideLabels(content);
  const source = String(content || '').replace(/\r/g, '');

  return slideRanges.map((range, index) => {
    const slideContent = source.slice(range.start, range.end);
    return {
      index,
      label: labels[index] || `Slide ${index + 1}`,
      start: range.start,
      end: range.end,
      components: parseComponentLines(slideContent, range.start)
    };
  });
}
