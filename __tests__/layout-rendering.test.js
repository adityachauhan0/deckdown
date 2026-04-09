import { tokenize } from '../src/lexer.js';
import { parse } from '../src/parser.js';
import { DEFAULT_THEME, highlightCode, layoutDocument } from '../src/layout.js';
import { PPTXRenderer } from '../src/renderer-pptx.js';
import { hydrateRenderableAssets, renderMermaidToAsset } from '../src/render-assets.js';

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

  test('hydrates math and mermaid blocks into renderable assets', async () => {
    const markdown = [
      '$$',
      '\\\\int_0^1 x^2 \\\\, dx',
      '$$',
      '',
      '---',
      '',
      '```mermaid',
      'graph TD',
      '  A --> B',
      '```'
    ].join('\n');

    const layout = layoutDocument(parse(tokenize(markdown)), { page, theme });
    const hydrated = await hydrateRenderableAssets(layout);

    expect(hydrated.slides[0].blocks[0].type).toBe('math');
    expect(hydrated.slides[0].blocks[0].renderAsset.svg).toContain('<svg');
    expect(hydrated.slides[0].blocks[0].renderAsset.pngBuffer.length).toBeGreaterThan(0);

    expect(hydrated.slides[1].blocks[0].type).toBe('mermaid');
    expect(hydrated.slides[1].blocks[0].height).toBe(240);
    expect(hydrated.slides[1].blocks[0].renderAsset.svg).toContain('<svg');
    expect(hydrated.slides[1].blocks[0].renderAsset.svg).not.toMatch(/<svg[^>]*style="[^"]*max-width:/);
    expect(hydrated.slides[1].blocks[0].renderAsset.pngBuffer.length).toBeGreaterThan(0);
  });

  test('hydrates complex mermaid diagrams with a non-trivial viewBox', async () => {
    const markdown = [
      '```mermaid',
      'classDiagram',
      '    Animal <|-- Duck',
      '    Animal <|-- Fish',
      '    Animal <|-- Zebra',
      '    Animal : +int age',
      '    Animal : +String gender',
      '    Animal: +isMammal()',
      '    Animal: +mate()',
      '    class Duck{',
      '        +String beakColor',
      '        +swim()',
      '        +quack()',
      '    }',
      '    class Fish{',
      '        -int sizeInFeet',
      '        -canEat()',
      '    }',
      '    class Zebra{',
      '        +bool is_wild',
      '        +run()',
      '    }',
      '```'
    ].join('\n');

    const layout = layoutDocument(parse(tokenize(markdown)), { page, theme });
    const hydrated = await hydrateRenderableAssets(layout);
    const svg = hydrated.slides[0].blocks[0].renderAsset.svg;
    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] || '';
    const [, , width = '0', height = '0'] = viewBox.split(/\s+/);

    expect(Number(width)).toBeGreaterThan(300);
    expect(Number(height)).toBeGreaterThan(150);
  });

  test('uses more readable default theme sizing and balanced render block heights', () => {
    const layout = layoutDocument(parse(tokenize('# Title\n\nParagraph\n\n$$\nx^2\n$$\n\n---\n\n```mermaid\ngraph TD\n  A --> B\n```')));

    expect(layout.theme.typography.bodySize).toBe(DEFAULT_THEME.typography.bodySize);
    expect(layout.theme.typography.headingScale).toBe(DEFAULT_THEME.typography.headingScale);
    expect(layout.theme.typography.codeSize).toBe(DEFAULT_THEME.typography.codeSize);
    expect(layout.slides[0].blocks[1].type).toBe('paragraph');
    expect(layout.slides[0].blocks[2].type).toBe('math');
    expect(layout.slides[0].blocks[2].height).toBe(120);
    expect(layout.slides[0].blocks[2].width).toBeCloseTo(layout.slides[0].contentWidth * 0.72, 0);
    expect(layout.slides[0].blocks[2].center).toBe(true);
    expect(layout.slides[1].blocks[0].type).toBe('mermaid');
    expect(layout.slides[1].blocks[0].height).toBe(240);
    expect(layout.slides[1].blocks[0].width).toBeCloseTo(layout.slides[1].contentWidth * 0.82, 0);
    expect(layout.slides[1].blocks[0].center).toBe(true);
  });

  test('renders complex mermaid diagrams with a real sized viewBox', async () => {
    const asset = await renderMermaidToAsset(`classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{
        +String beakColor
        +swim()
        +quack()
    }
    class Fish{
        -int sizeInFeet
        -canEat()
    }
    class Zebra{
        +bool is_wild
        +run()
    }`);

    const viewBox = asset.svg.match(/viewBox="([^"]+)"/)?.[1]?.split(/\s+/).map(Number);
    expect(viewBox).toBeDefined();
    expect(viewBox[2]).toBeGreaterThan(500);
    expect(viewBox[3]).toBeGreaterThan(250);
  });

  test('renders class diagram labels as svg text instead of foreignObject html', async () => {
    const asset = await renderMermaidToAsset(`classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{
        +String beakColor
        +swim()
        +quack()
    }
    class Fish{
        -int sizeInFeet
        -canEat()
    }
    class Zebra{
        +bool is_wild
        +run()
    }`);

    expect(asset.svg).not.toContain('foreignObject');
    expect(asset.svg).toMatch(/<text[\s\S]*Animal[\s\S]*<\/text>/);
    expect(asset.svg).toMatch(/<text[\s\S]*beakColor[\s\S]*<\/text>/);
  });

  test('renders er diagrams with a viewBox large enough for relationship graphs', async () => {
    const asset = await renderMermaidToAsset(`erDiagram
          CUSTOMER }|..|{ DELIVERY-ADDRESS : has
          CUSTOMER ||--o{ ORDER : places
          CUSTOMER ||--o{ INVOICE : "liable for"
          DELIVERY-ADDRESS ||--o{ ORDER : receives
          INVOICE ||--|{ ORDER : covers
          ORDER ||--|{ ORDER-ITEM : includes
          PRODUCT-CATEGORY ||--|{ PRODUCT : contains
          PRODUCT ||--o{ ORDER-ITEM : "ordered in"`);

    const viewBox = asset.svg.match(/viewBox="([^"]+)"/)?.[1]?.split(/\s+/).map(Number);
    expect(viewBox).toBeDefined();
    expect(viewBox[2]).toBeGreaterThan(450);
    expect(viewBox[3]).toBeGreaterThan(450);
  });

  test('gives dense mermaid diagrams more default vertical space', () => {
    const classLayout = layoutDocument(parse(tokenize('```mermaid\nclassDiagram\nA <|-- B\nA <|-- C\nA : +run()\nclass B {\n  +jump()\n}\nclass C {\n  +swim()\n}\n```')));
    const erLayout = layoutDocument(parse(tokenize('```mermaid\nerDiagram\nCUSTOMER ||--o{ ORDER : places\nORDER ||--|{ ORDER-ITEM : includes\nPRODUCT ||--o{ ORDER-ITEM : ordered in\n```')));

    expect(classLayout.slides[0].blocks[0].height).toBeGreaterThanOrEqual(520);
    expect(erLayout.slides[0].blocks[0].height).toBeGreaterThanOrEqual(560);
  });
});
