import { deriveSlideOutline } from '../src/studio/slide-outline.js';

describe('deriveSlideOutline', () => {
  test('extracts nested slide components for the sidebar outline', () => {
    const content = `---
title: Outline Test
---

# Slide 1

{{ center }}

Hello World

\`\`\`python
x = 3
\`\`\`

---

# Slide 2

- One
- Two

![Chart](./assets/chart.png)
`;

    const ranges = [
      { start: content.indexOf('# Slide 1'), end: content.indexOf('---\n\n# Slide 2') },
      { start: content.indexOf('# Slide 2'), end: content.length }
    ];

    const outline = deriveSlideOutline(content, ranges);

    expect(outline).toHaveLength(2);
    expect(outline[0].components).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'heading', label: 'Slide 1', detail: 'H1' }),
      expect.objectContaining({ kind: 'layout', label: 'center', detail: 'Layout' }),
      expect.objectContaining({ kind: 'paragraph', label: 'Hello World', detail: 'Text' }),
      expect.objectContaining({ kind: 'code', label: 'Code (python)', detail: 'Code' })
    ]));
    expect(outline[1].components).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'heading', label: 'Slide 2' }),
      expect.objectContaining({ kind: 'list', label: 'One', detail: 'List' }),
      expect.objectContaining({ kind: 'image', label: 'Chart', detail: 'Image' })
    ]));
  });
});
