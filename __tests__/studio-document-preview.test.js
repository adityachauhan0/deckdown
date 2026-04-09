import {
  isDocumentPreviewPath,
  renderDocumentMarkdown,
  resolveDocumentAssetPath
} from '../src/studio/document-preview.js';

class MockTextNode {
  constructor(text = '') {
    this.nodeType = 3;
    this.tagName = '#text';
    this.parentNode = null;
    this.childNodes = [];
    this._text = String(text);
  }

  appendChild() {
    throw new Error('Cannot append to text nodes');
  }

  get textContent() {
    return this._text;
  }

  set textContent(value) {
    this._text = String(value);
  }

  querySelector() {
    return null;
  }
}

class MockElement {
  constructor(tagName) {
    this.nodeType = 1;
    this.tagName = String(tagName || '').toUpperCase();
    this.parentNode = null;
    this.childNodes = [];
    this.attributes = {};
    this.style = {};
    this.className = '';
    this.dataset = {};
  }

  appendChild(node) {
    if (node.parentNode && Array.isArray(node.parentNode.childNodes)) {
      const previousParent = node.parentNode;
      const previousIndex = previousParent.childNodes.indexOf(node);
      if (previousIndex >= 0) {
        previousParent.childNodes.splice(previousIndex, 1);
      }
    }
    this.childNodes.push(node);
    node.parentNode = this;
    return node;
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  get textContent() {
    return this.childNodes.map(node => node.textContent).join('');
  }

  set textContent(value) {
    this.childNodes = [new MockTextNode(value)];
  }

  setAttribute(name, value) {
    const normalizedName = String(name).toLowerCase();
    if (normalizedName === 'class') {
      this.className = String(value);
      return;
    }
    this.attributes[normalizedName] = String(value);
  }

  getAttribute(name) {
    const normalizedName = String(name).toLowerCase();
    if (normalizedName === 'class') {
      return this.className || null;
    }
    return Object.prototype.hasOwnProperty.call(this.attributes, normalizedName)
      ? this.attributes[normalizedName]
      : null;
  }

  set src(value) {
    this.attributes.src = String(value);
  }

  get src() {
    return this.getAttribute('src') || '';
  }

  set alt(value) {
    this.attributes.alt = String(value);
  }

  get alt() {
    return this.getAttribute('alt') || '';
  }

  set title(value) {
    this.attributes.title = String(value);
  }

  get title() {
    return this.getAttribute('title') || '';
  }

  querySelector(selector) {
    const parts = String(selector || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return null;
    }

    const matches = (node, token) => node && node.tagName && node.tagName.toLowerCase() === token.toLowerCase();

    const search = (node, depth) => {
      for (const child of node.childNodes || []) {
        if (matches(child, parts[depth])) {
          if (depth === parts.length - 1) {
            return child;
          }
          const nested = search(child, depth + 1);
          if (nested) {
            return nested;
          }
        }

        const descendant = search(child, depth);
        if (descendant) {
          return descendant;
        }
      }
      return null;
    };

    return search(this, 0);
  }
}

class MockDocument {
  createElement(tagName) {
    return new MockElement(tagName);
  }

  createDocumentFragment() {
    return new MockElement('#fragment');
  }

  createTextNode(text) {
    return new MockTextNode(text);
  }
}

describe('studio document preview', () => {
  test('flags README and docs markdown as document-preview content', () => {
    expect(isDocumentPreviewPath('README.md')).toBe(true);
    expect(isDocumentPreviewPath('docs/getting-started.md')).toBe(true);
    expect(isDocumentPreviewPath('samples/sample-deck.md')).toBe(false);
  });

  test('resolves relative asset paths against the markdown file location', () => {
    expect(resolveDocumentAssetPath('README.md', './docs/assets/showcase/slide-001.png')).toBe('docs/assets/showcase/slide-001.png');
    expect(resolveDocumentAssetPath('docs/guide/intro.md', '../assets/hero.png')).toBe('docs/assets/hero.png');
    expect(resolveDocumentAssetPath('README.md', '/docs/index.md')).toBe('docs/index.md');
    expect(resolveDocumentAssetPath('README.md', 'https://example.com/image.png')).toBe('https://example.com/image.png');
  });

  test('renders README-style HTML image blocks and captions as DOM nodes', () => {
    const document = new MockDocument();
    const article = renderDocumentMarkdown(`
## Showcase

<p align="center">
  <img src="./docs/assets/showcase/slide-001.png" alt="Hero" width="100%" />
</p>

<p align="center"><em>Image-led hero slide from Markdown source.</em></p>
`, {
      document,
      filePath: 'README.md'
    });

    const image = article.querySelector('img');
    expect(image).not.toBeNull();
    expect(image.getAttribute('src')).toBe('/api/asset?path=docs%2Fassets%2Fshowcase%2Fslide-001.png');
    expect(image.getAttribute('alt')).toBe('Hero');
    expect(image.style.width).toBe('100%');

    const caption = article.querySelector('p em');
    expect(caption).not.toBeNull();
    expect(caption.textContent).toBe('Image-led hero slide from Markdown source.');
  });
});
