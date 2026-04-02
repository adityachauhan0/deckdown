import { tokenize } from '../src/lexer.js';
import { parse } from '../src/parser.js';
import { highlightCode, layoutDocument } from '../src/layout.js';
import { PPTXRenderer } from '../src/renderer-pptx.js';

const page = {
  width: 1600,
  height: 900,
  margin: 70
};

const theme = {
  fonts: {
    heading: 'Helvetica',
    body: 'Helvetica',
    code: 'Courier'
  },
  colors: {
    background: '#111827',
    text: '#f9fafb',
    heading: '#ffffff',
    accent: '#38bdf8',
    codeBg: '#0f172a'
  },
  typography: {
    lineHeight: 1.5,
    headingScale: 2,
    bodySize: 22,
    codeSize: 16
  },
  spacing: {
    paragraph: 24,
    slidePadding: 56
  }
};

function createRenderer() {
  return new PPTXRenderer({
    page,
    theme,
    slides: []
  });
}

describe('Layout and PPTX rendering', () => {
  test('highlights rust code with colored Shiki tokens', async () => {
    const highlighted = await highlightCode(
      'fn main() {\n    println!("hi");\n}',
      'rust',
      theme.colors.background
    );

    expect(highlighted.lines.length).toBe(3);
    expect(highlighted.background).toMatch(/^#/);
    expect(highlighted.foreground).toMatch(/^#/);
    expect(highlighted.lines[0].some(token => token.color && token.color !== highlighted.foreground)).toBe(true);
    expect(highlighted.lines[1].some(token => token.color && token.color !== highlighted.foreground)).toBe(true);
  });

  test('middle vertically centers a block in the slide content area', () => {
    const doc = {
      metadata: {},
      slides: [
        {
          type: 'Slide',
          blocks: [
            {
              type: 'paragraph',
              text: 'Centered content should be positioned in the vertical middle of the slide.',
              attributes: ['middle']
            }
          ]
        }
      ]
    };

    const layout = layoutDocument(doc, { page, theme });
    const slideLayout = layout.slides[0];
    const block = slideLayout.blocks[0];
    const expectedY = slideLayout.contentTop + Math.max(0, (slideLayout.contentHeight - block.height) / 2);

    expect(block.middle).toBe(true);
    expect(block.y).toBeCloseTo(expectedY, 0);
  });

  test('estimates block heights instead of using a fixed placeholder', () => {
    const doc = {
      metadata: {},
      slides: [
        {
          type: 'Slide',
          blocks: [
            {
              type: 'heading',
              level: 2,
              text: 'A heading that is long enough to wrap and prove we measure height'
            },
            {
              type: 'paragraph',
              text: 'This paragraph is intentionally long so the layout engine has to wrap it across multiple lines and assign a height that is larger than the old placeholder.'
            },
            {
              type: 'code',
              content: 'const value = 1;\nconsole.log(value);\nconsole.log(value + 1);'
            }
          ]
        }
      ]
    };

    const layout = layoutDocument(doc, { page, theme });
    const heights = layout.slides[0].blocks.map(block => block.height);

    expect(Math.max(...heights)).toBeGreaterThan(50);
    expect(new Set(heights).size).toBeGreaterThan(1);
  });

  test('keeps column blocks from overlapping obvious content', () => {
    const doc = {
      metadata: {},
      slides: [
        {
          type: 'Slide',
          blocks: [
            {
              type: 'heading',
              level: 1,
              text: 'Layout Options'
            },
            {
              type: 'heading',
              level: 2,
              text: 'Left Column Heading With Enough Text To Wrap',
              attributes: ['cols: 2']
            },
            {
              type: 'paragraph',
              text: 'Left column paragraph content that should sit under the heading rather than overlapping it.'
            },
            {
              type: 'heading',
              level: 2,
              text: 'Right Column Heading With Enough Text To Wrap',
              attributes: ['col: break']
            },
            {
              type: 'paragraph',
              text: 'Right column paragraph content that should restart at the top of the second column.'
            }
          ]
        }
      ]
    };

    const layout = layoutDocument(doc, { page, theme });
    const blocks = layout.slides[0].blocks;

    const slideHeading = blocks[0];
    const leftHeading = blocks[1];
    const leftParagraph = blocks[2];
    const rightHeading = blocks[3];
    const rightParagraph = blocks[4];

    expect(leftHeading.y).toBeGreaterThanOrEqual(slideHeading.y + slideHeading.height + theme.spacing.paragraph);
    expect(leftParagraph.y).toBeGreaterThanOrEqual(leftHeading.y + leftHeading.height + theme.spacing.paragraph);
    expect(rightHeading.y).toBe(leftHeading.y);
    expect(rightParagraph.y).toBeGreaterThanOrEqual(rightHeading.y + rightHeading.height + theme.spacing.paragraph);
    expect(rightHeading.x).toBeGreaterThan(leftHeading.x);
    expect(rightHeading.column).toBe(1);
    expect(rightParagraph.column).toBe(1);
  });

  test('applies width and center attributes to an image block through parsing and layout', () => {
    const markdown = [
      '![PNG cover](cover.png)',
      '{{ width: 50% center }}'
    ].join('\n');

    const doc = parse(tokenize(markdown));
    expect(doc.slides[0].blocks[0].type).toBe('image');
    expect(doc.slides[0].blocks[0].attributes).toContain('width: 50%');
    expect(doc.slides[0].blocks[0].attributes).toContain('center');

    const layout = layoutDocument(doc, { page, theme });
    const block = layout.slides[0].blocks[0];
    const expectedWidth = layout.slides[0].contentWidth * 0.5;
    const expectedX = layout.slides[0].contentLeft + ((layout.slides[0].contentWidth - expectedWidth) / 2);

    expect(block.type).toBe('image');
    expect(block.src).toBe('cover.png');
    expect(block.width).toBeCloseTo(expectedWidth, 0);
    expect(block.x).toBeCloseTo(expectedX, 0);
    expect(block.center).toBe(true);
  });

  test('maps PPTX code blocks and images from layout dimensions', () => {
    const renderer = createRenderer();
    const calls = [];
    const slide = {
      addShape: (shape, options) => calls.push({ kind: 'shape', shape, options }),
      addText: (text, options) => calls.push({ kind: 'text', text, options }),
      addImage: options => calls.push({ kind: 'image', options })
    };

    return renderer.renderBlock(slide, {
      type: 'code',
      content: 'const x = 1;\nconsole.log(x);',
      x: 96,
      y: 96,
      width: 480,
      height: 180,
      fontSize: 16,
      backgroundColor: '#0f172a'
    }).then(async () => {
      await renderer.renderBlock(slide, {
        type: 'image',
        src: '/tmp/deckdown-verify/fixtures/fixture-image.png',
        x: 192,
        y: 288,
        width: 480,
        height: 240,
        scale: 1
      });

      const shapeCall = calls.find(call => call.kind === 'shape');
      const textCalls = calls.filter(call => call.kind === 'text');
      const imageCall = calls.find(call => call.kind === 'image');

      expect(shapeCall.shape).toBe('rect');
      expect(shapeCall.options.fill.color).toBe('#0f172a');

      expect(textCalls.length).toBeGreaterThan(1);
      const flattenedRuns = textCalls.flatMap(call => Array.isArray(call.text) ? call.text : [call.text]);
      expect(flattenedRuns.some(run => run.options && run.options.color && run.options.color !== theme.colors.text)).toBe(true);

      expect(imageCall.kind).toBe('image');
      expect(imageCall.options.w).toBeCloseTo(480 / 96, 2);
      expect(imageCall.options.h).toBeCloseTo(240 / 96, 2);
    });
  });
});
