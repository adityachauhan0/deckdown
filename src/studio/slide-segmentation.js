function normalizeMarkdownSource(content) {
  return String(content || '').replace(/\r\n?/g, '\n');
}

function findFrontmatterEnd(source) {
  const match = source.match(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/);
  return match ? match[0].length : 0;
}

function isFenceLine(trimmed) {
  const match = trimmed.match(/^(`{3,}|~{3,})(.*)$/);
  if (!match) {
    return null;
  }

  return {
    marker: match[1][0],
    length: match[1].length
  };
}

function isFenceClose(trimmed, fence) {
  if (!fence) {
    return false;
  }

  if (!trimmed || trimmed[0] !== fence.marker) {
    return false;
  }

  let markerCount = 0;
  while (markerCount < trimmed.length && trimmed[markerCount] === fence.marker) {
    markerCount += 1;
  }

  return markerCount >= fence.length && trimmed.slice(markerCount).trim().length === 0;
}

function readLine(source, start) {
  const newlineIndex = source.indexOf('\n', start);
  if (newlineIndex === -1) {
    return {
      line: source.slice(start),
      end: source.length,
      next: source.length
    };
  }

  return {
    line: source.slice(start, newlineIndex),
    end: newlineIndex,
    next: newlineIndex + 1
  };
}

export function deriveSlideRanges(content) {
  const source = normalizeMarkdownSource(content);
  const ranges = [];
  const frontmatterEnd = findFrontmatterEnd(source);

  let slideStart = frontmatterEnd;
  let cursor = frontmatterEnd;
  let fence = null;

  while (cursor <= source.length) {
    const { line, end, next } = readLine(source, cursor);
    const trimmed = line.trim();

    if (fence) {
      if (isFenceClose(trimmed, fence)) {
        fence = null;
      }
    } else {
      const openingFence = isFenceLine(trimmed);
      if (openingFence) {
        fence = openingFence;
      } else if (trimmed === '---') {
        ranges.push({ start: slideStart, end: cursor });
        slideStart = next;
        cursor = next;
        continue;
      }
    }

    if (next === source.length) {
      break;
    }

    cursor = next;
  }

  if (source.length > slideStart || ranges.length === 0) {
    ranges.push({ start: slideStart, end: source.length });
  }

  return ranges.filter(range => source.slice(range.start, range.end).trim().length > 0);
}
