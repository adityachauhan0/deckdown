import { deriveSlideRanges } from './slide-segmentation.js';

export function deriveSlideLabels(content) {
  const normalized = String(content || '').replace(/\r/g, '');
  return deriveSlideRanges(normalized)
    .map(range => normalized.slice(range.start, range.end).trim())
    .filter(Boolean)
    .map((slide, index) => {
      const headingMatch = slide.match(/^#{1,6}\s+(.+)$/m);
      if (headingMatch) {
        return headingMatch[1].trim();
      }

      const firstMeaningfulLine = slide
        .split('\n')
        .map(line => line.trim())
        .find(line => line && !line.startsWith('{{'));

      if (!firstMeaningfulLine) {
        return `Slide ${index + 1}`;
      }

      if (firstMeaningfulLine.startsWith('![')) {
        return 'Image';
      }

      return firstMeaningfulLine.slice(0, 40);
    });
}
