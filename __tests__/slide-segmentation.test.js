import { deriveSlideRanges } from '../src/studio/slide-segmentation.js';

describe('deriveSlideRanges', () => {
  test('splits top-level slide breaks and ignores fenced separators', () => {
    const content = `---
title: Segmentation Test
---

# Intro

Body before the fence.

\`\`\`js
const separator = '---';
---
\`\`\`

---

# Next

Trailing body.
`;

    const ranges = deriveSlideRanges(content);

    expect(ranges).toHaveLength(2);
    expect(content.slice(ranges[0].start, ranges[0].end)).toContain('# Intro');
    expect(content.slice(ranges[0].start, ranges[0].end)).toContain("const separator = '---';");
    expect(content.slice(ranges[0].start, ranges[0].end)).not.toContain('# Next');
    expect(content.slice(ranges[1].start, ranges[1].end)).toContain('# Next');
  });

  test('skips frontmatter before calculating slide ranges', () => {
    const content = `---
title: Frontmatter Test
layout: deck
---

# One

---

# Two
`;

    const ranges = deriveSlideRanges(content);

    expect(ranges).toHaveLength(2);
    expect(content.slice(ranges[0].start, ranges[0].end)).toContain('# One');
    expect(content.slice(ranges[0].start, ranges[0].end)).not.toContain('# Two');
    expect(content.slice(ranges[1].start, ranges[1].end)).toContain('# Two');
  });
});
