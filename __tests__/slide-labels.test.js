import { deriveSlideLabels } from '../src/studio/slide-labels.js';

describe('deriveSlideLabels', () => {
  test('uses the first heading from each slide when available', () => {
    const labels = deriveSlideLabels(`# Intro

Body

---

## Deep Dive

More body
`);

    expect(labels).toEqual(['Intro', 'Deep Dive']);
  });

  test('falls back to the first meaningful line when there is no heading', () => {
    const labels = deriveSlideLabels(`Lead paragraph

---

![Chart](./assets/chart.png)
{{ width: 80% }}
`);

    expect(labels).toEqual(['Lead paragraph', 'Image']);
  });

  test('ignores slide break markers inside fenced code blocks', () => {
    const labels = deriveSlideLabels(`# Intro

\`\`\`md
---
\`\`\`

---

# Actual Slide
`);

    expect(labels).toEqual(['Intro', 'Actual Slide']);
  });
});
