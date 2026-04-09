function normalizePathSegments(input) {
  const segments = String(input || '')
    .replace(/\\/g, '/')
    .split('/');
  const resolved = [];

  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (resolved.length && resolved[resolved.length - 1] !== '..') {
        resolved.pop();
      } else {
        resolved.push(segment);
      }
      continue;
    }

    resolved.push(segment);
  }

  return resolved.join('/');
}

function getDirectoryName(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  if (index < 0) {
    return '';
  }
  return normalized.slice(0, index);
}

function splitPathAndSuffix(assetPath) {
  const match = String(assetPath || '').match(/^([^?#]+)([?#].*)?$/);
  if (!match) {
    return { path: '', suffix: '' };
  }
  return {
    path: match[1],
    suffix: match[2] || ''
  };
}

function resolveDocumentImageSource(filePath, assetPath) {
  const rawSrc = String(assetPath || '').trim();
  if (!rawSrc) {
    return '';
  }

  const resolvedPath = resolveDocumentAssetPath(filePath, rawSrc);
  if (!resolvedPath || isExternalUrl(resolvedPath) || /^[a-zA-Z]:[\\/]/.test(resolvedPath)) {
    return resolvedPath;
  }

  return `/api/asset?path=${encodeURIComponent(resolvedPath)}`;
}

function isExternalUrl(value) {
  return /^([a-zA-Z][a-zA-Z\d+.-]*:|\/\/)/.test(value) || /^data:/i.test(value) || /^blob:/i.test(value);
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseAttributes(source) {
  const attributes = {};
  const attrRegex = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/g;
  let match;
  while ((match = attrRegex.exec(source)) !== null) {
    attributes[match[1].toLowerCase()] = match[3] ?? match[4] ?? match[5] ?? '';
  }
  return attributes;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderInlineMarkdown(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function appendSafeInlineHtml(document, parent, html, filePath) {
  const tokenRegex = /<\/?([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g;
  const allowedTags = new Set(['em', 'strong', 'code', 'br', 'img']);
  const stack = [parent];
  let match;

  while ((match = tokenRegex.exec(String(html || ''))) !== null) {
    const [, tagNameRaw, rawAttributes, textToken] = match;
    const current = stack[stack.length - 1];

    if (textToken !== undefined) {
      current.appendChild(document.createTextNode(decodeHtmlEntities(textToken)));
      continue;
    }

    const tagName = String(tagNameRaw || '').toLowerCase();
    const isClosingTag = match[0][1] === '/';

    if (!allowedTags.has(tagName)) {
      current.appendChild(document.createTextNode(match[0]));
      continue;
    }

    if (isClosingTag) {
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tagName.toLowerCase() === tagName) {
          stack.length = index;
          break;
        }
      }
      continue;
    }

    if (tagName === 'br') {
      current.appendChild(document.createElement('br'));
      continue;
    }

    if (tagName === 'img') {
      const attrs = parseAttributes(rawAttributes);
      const image = document.createElement('img');
      image.alt = attrs.alt || '';
      if (attrs.title) {
        image.title = attrs.title;
      }
      if (attrs.width) {
        image.style.width = attrs.width;
      }
      if (attrs.height) {
        image.style.height = attrs.height;
      }
      if (attrs.style) {
        image.style.cssText = attrs.style;
      }
      image.src = resolveDocumentImageSource(filePath, attrs.src || '');
      current.appendChild(image);
      continue;
    }

    const node = document.createElement(tagName);
    current.appendChild(node);
    stack.push(node);
  }
}

function renderInlineHtml(document, html, filePath) {
  const span = document.createElement('span');
  appendSafeInlineHtml(document, span, html, filePath);
  return span;
}

function createImageNode(document, filePath, attrs) {
  const image = document.createElement('img');
  image.alt = attrs.alt || '';
  if (attrs.title) {
    image.title = attrs.title;
  }
  if (attrs.width) {
    image.style.width = attrs.width;
  }
  if (attrs.height) {
    image.style.height = attrs.height;
  }
  if (attrs.style) {
    image.style.cssText = attrs.style;
  }
  image.src = resolveDocumentImageSource(filePath, attrs.src || '');
  return image;
}

function renderHtmlParagraph(document, filePath, blockHtml) {
  const trimmed = String(blockHtml || '').trim();
  const paragraphMatch = trimmed.match(/^<p\b([^>]*)>([\s\S]*)<\/p>$/i);
  if (!paragraphMatch) {
    return null;
  }

  const paragraph = document.createElement('p');
  const attrs = parseAttributes(paragraphMatch[1]);
  if (attrs.align) {
    paragraph.style.textAlign = attrs.align;
  }

  const innerHtml = paragraphMatch[2].trim();
  if (!innerHtml) {
    return paragraph;
  }

  const imageOnlyMatch = innerHtml.match(/^<img\b([^>]*)\/?>$/i);
  if (imageOnlyMatch) {
    paragraph.appendChild(createImageNode(document, filePath, parseAttributes(imageOnlyMatch[1])));
    return paragraph;
  }

  const fragment = renderInlineHtml(document, innerHtml, filePath);
  while (fragment.firstChild) {
    paragraph.appendChild(fragment.firstChild);
  }
  return paragraph;
}

function renderMarkdownTable(document, rows) {
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const tag = rowIndex === 0 ? 'th' : 'td';
      const cellNode = document.createElement(tag);
      cellNode.innerHTML = renderInlineMarkdown(cell);
      tr.appendChild(cellNode);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function flushMarkdownBlock(document, fragment, type, buffer) {
  if (!buffer.length) {
    return;
  }

  const text = buffer.join('\n').trim();
  buffer.length = 0;
  if (!text) {
    return;
  }

  if (type === 'paragraph') {
    const paragraph = document.createElement('p');
    paragraph.innerHTML = renderInlineMarkdown(text);
    fragment.appendChild(paragraph);
    return;
  }

  if (type === 'blockquote') {
    const blockquote = document.createElement('blockquote');
    blockquote.innerHTML = renderInlineMarkdown(text.replace(/^>\s?/gm, ''));
    fragment.appendChild(blockquote);
  }
}

export function isDocumentPreviewPath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/').trim();
  if (!normalized) {
    return false;
  }

  const lower = normalized.toLowerCase();
  if (/^readme(\.(md|markdown))?$/.test(lower)) {
    return true;
  }

  return /^docs\/.+\.(md|markdown)$/.test(lower);
}

export function resolveDocumentAssetPath(filePath, assetPath) {
  const rawAsset = String(assetPath || '').trim();
  if (!rawAsset) {
    return '';
  }

  const unwrapped = rawAsset.replace(/^<([^>]+)>$/, '$1');
  const { path, suffix } = splitPathAndSuffix(unwrapped);

  if (!path || isExternalUrl(path) || /^[a-zA-Z]:[\\/]/.test(path)) {
    return path.replace(/\\/g, '/') + suffix;
  }

  if (path.startsWith('/')) {
    return normalizePathSegments(path.slice(1)) + suffix;
  }

  const baseDir = getDirectoryName(filePath);
  const joined = baseDir ? `${baseDir}/${path}` : path;
  return normalizePathSegments(joined) + suffix;
}

export function renderDocumentMarkdown(markdown, options = {}) {
  const document = options.document || globalThis.document;
  if (!document) {
    throw new Error('renderDocumentMarkdown requires a document');
  }

  const filePath = options.filePath || '';
  const article = document.createElement('article');
  article.className = 'document-preview';
  const fragment = document.createDocumentFragment();
  const lines = String(markdown || '').replace(/\r/g, '').split('\n');
  const paragraphBuffer = [];
  const blockquoteBuffer = [];

  const flushAll = () => {
    flushMarkdownBlock(document, fragment, 'paragraph', paragraphBuffer);
    flushMarkdownBlock(document, fragment, 'blockquote', blockquoteBuffer);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    if (/^```/.test(trimmed)) {
      flushAll();
      const fence = trimmed;
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      const language = fence.slice(3).trim();
      if (language) {
        code.dataset.language = language;
      }
      code.textContent = codeLines.join('\n');
      pre.appendChild(code);
      fragment.appendChild(pre);
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      flushAll();
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const heading = document.createElement(`h${headingMatch[1].length}`);
        heading.innerHTML = renderInlineMarkdown(headingMatch[2].trim());
        fragment.appendChild(heading);
      }
      continue;
    }

    if (/^<p\b/i.test(trimmed)) {
      flushAll();
      let htmlBlock = line;
      while (!/<\/p>\s*$/i.test(htmlBlock.trim()) && index + 1 < lines.length) {
        index += 1;
        htmlBlock += `\n${lines[index]}`;
      }
      const paragraph = renderHtmlParagraph(document, filePath, htmlBlock);
      if (paragraph) {
        fragment.appendChild(paragraph);
      }
      continue;
    }

    const tableRows = [];
    if (trimmed.includes('|')) {
      const maybeTable = [];
      let cursor = index;
      while (cursor < lines.length) {
        const candidate = lines[cursor].trim();
        if (!candidate || !candidate.includes('|')) {
          break;
        }
        maybeTable.push(candidate);
        cursor += 1;
      }

      if (maybeTable.length >= 2 && /^\|?\s*:?-{3,}/.test(maybeTable[1].replace(/\|/g, '').trim())) {
        flushAll();
        for (const row of maybeTable) {
          const cells = row.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
          if (/^\|?\s*:?-{3,}/.test(row.replace(/\|/g, '').trim())) {
            continue;
          }
          tableRows.push(cells);
        }
        if (tableRows.length > 0) {
          fragment.appendChild(renderMarkdownTable(document, tableRows));
          index = cursor - 1;
          continue;
        }
      }
    }

    if (/^>\s?/.test(trimmed)) {
      if (paragraphBuffer.length) {
        flushMarkdownBlock(document, fragment, 'paragraph', paragraphBuffer);
      }
      blockquoteBuffer.push(trimmed);
      continue;
    }

    if (/^(-|\*|\+)\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      flushAll();
      const list = document.createElement(trimmed.match(/^\d+\./) ? 'ol' : 'ul');
      while (index < lines.length) {
        const itemLine = lines[index].trim();
        if (!/^(-|\*|\+)\s+/.test(itemLine) && !/^\d+\.\s+/.test(itemLine)) {
          break;
        }
        const item = document.createElement('li');
        item.innerHTML = renderInlineMarkdown(itemLine.replace(/^(-|\*|\+|\d+\.)\s+/, ''));
        list.appendChild(item);
        index += 1;
      }
      fragment.appendChild(list);
      index -= 1;
      continue;
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      flushAll();
      const paragraph = document.createElement('p');
      paragraph.style.textAlign = 'center';
      paragraph.appendChild(createImageNode(document, filePath, {
        alt: imageMatch[1],
        src: imageMatch[2]
      }));
      fragment.appendChild(paragraph);
      continue;
    }

    if (blockquoteBuffer.length) {
      flushMarkdownBlock(document, fragment, 'blockquote', blockquoteBuffer);
    }

    paragraphBuffer.push(line);
  }

  flushAll();
  article.appendChild(fragment);
  return article;
}
