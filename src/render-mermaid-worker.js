import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

function parseNumber(value, fallback = 0) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

function unionBBoxes(boxes) {
  const validBoxes = boxes.filter(box => box && Number.isFinite(box.width) && Number.isFinite(box.height) && box.width >= 0 && box.height >= 0);
  if (validBoxes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...validBoxes.map(box => box.x));
  const minY = Math.min(...validBoxes.map(box => box.y));
  const maxX = Math.max(...validBoxes.map(box => box.x + box.width));
  const maxY = Math.max(...validBoxes.map(box => box.y + box.height));

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  };
}

function transformPoint(point, transform) {
  const operations = String(transform || '').match(/[a-zA-Z]+\([^)]*\)/g) || [];
  return operations.reduce((currentPoint, operation) => {
    const [type, rawArgs = ''] = operation.split('(');
    const args = rawArgs.replace(')', '').split(/[\s,]+/).filter(Boolean).map(value => parseNumber(value));

    if (type === 'translate') {
      return {
        x: currentPoint.x + (args[0] || 0),
        y: currentPoint.y + (args[1] ?? 0)
      };
    }

    if (type === 'scale') {
      return {
        x: currentPoint.x * (args[0] || 1),
        y: currentPoint.y * (args[1] ?? args[0] ?? 1)
      };
    }

    if (type === 'matrix' && args.length === 6) {
      return {
        x: args[0] * currentPoint.x + args[2] * currentPoint.y + args[4],
        y: args[1] * currentPoint.x + args[3] * currentPoint.y + args[5]
      };
    }

    return currentPoint;
  }, point);
}

function applyTransformToBBox(box, transform) {
  if (!transform) {
    return box;
  }

  const corners = [
    transformPoint({ x: box.x, y: box.y }, transform),
    transformPoint({ x: box.x + box.width, y: box.y }, transform),
    transformPoint({ x: box.x, y: box.y + box.height }, transform),
    transformPoint({ x: box.x + box.width, y: box.y + box.height }, transform)
  ];

  const minX = Math.min(...corners.map(point => point.x));
  const minY = Math.min(...corners.map(point => point.y));
  const maxX = Math.max(...corners.map(point => point.x));
  const maxY = Math.max(...corners.map(point => point.y));

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  };
}

function computeTextBBox(element) {
  const text = (element.textContent || '').trim();
  const fontSize = parseNumber(element.getAttribute('font-size'), 16);
  const width = Math.max(24, text.length * fontSize * 0.62);
  const height = Math.max(16, fontSize * 1.2);
  const x = parseNumber(element.getAttribute('x'), 0);
  const y = parseNumber(element.getAttribute('y'), 0) - height * 0.8;
  return { x, y, width, height };
}

function computePointsBBox(pointsValue) {
  const values = String(pointsValue || '').trim().split(/[\s,]+/).map(value => parseNumber(value, Number.NaN)).filter(Number.isFinite);
  const points = [];
  for (let index = 0; index < values.length; index += 2) {
    points.push({ x: values[index], y: values[index + 1] ?? 0 });
  }

  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxX = Math.max(...points.map(point => point.x));
  const maxY = Math.max(...points.map(point => point.y));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function computePathBBox(pathValue) {
  const values = String(pathValue || '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) || [];
  const points = [];
  for (let index = 0; index < values.length - 1; index += 2) {
    points.push({ x: values[index], y: values[index + 1] });
  }
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxX = Math.max(...points.map(point => point.x));
  const maxY = Math.max(...points.map(point => point.y));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function computeElementBBox(element) {
  const tag = String(element.tagName || '').toLowerCase();

  if (tag === 'rect' || tag === 'image' || tag === 'foreignobject') {
    return {
      x: parseNumber(element.getAttribute('x'), 0),
      y: parseNumber(element.getAttribute('y'), 0),
      width: parseNumber(element.getAttribute('width'), 0),
      height: parseNumber(element.getAttribute('height'), 0)
    };
  }

  if (tag === 'circle') {
    const cx = parseNumber(element.getAttribute('cx'), 0);
    const cy = parseNumber(element.getAttribute('cy'), 0);
    const radius = parseNumber(element.getAttribute('r'), 0);
    return { x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 };
  }

  if (tag === 'ellipse') {
    const cx = parseNumber(element.getAttribute('cx'), 0);
    const cy = parseNumber(element.getAttribute('cy'), 0);
    const rx = parseNumber(element.getAttribute('rx'), 0);
    const ry = parseNumber(element.getAttribute('ry'), 0);
    return { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 };
  }

  if (tag === 'line') {
    const x1 = parseNumber(element.getAttribute('x1'), 0);
    const y1 = parseNumber(element.getAttribute('y1'), 0);
    const x2 = parseNumber(element.getAttribute('x2'), 0);
    const y2 = parseNumber(element.getAttribute('y2'), 0);
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  }

  if (tag === 'polygon' || tag === 'polyline') {
    return computePointsBBox(element.getAttribute('points'));
  }

  if (tag === 'path') {
    return computePathBBox(element.getAttribute('d'));
  }

  if (tag === 'text' || tag === 'tspan') {
    return computeTextBBox(element);
  }

  const childBoxes = Array.from(element.children || []).map(child => applyTransformToBBox(computeElementBBox(child), child.getAttribute('transform')));
  if (childBoxes.length > 0) {
    return unionBBoxes(childBoxes);
  }

  const viewBox = element.getAttribute('viewBox');
  if (viewBox) {
    const [x = 0, y = 0, width = 0, height = 0] = viewBox.split(/[\s,]+/).map(value => parseNumber(value));
    return { x, y, width, height };
  }

  return { x: 0, y: 0, width: 120, height: 40 };
}

function normalizeMermaidSvg(svg, window) {
  const sanitized = String(svg || '')
    .replace(/\bwidth="100%"/g, '')
    .replace(/\bheight="100%"/g, '')
    .replace(/\sstyle="max-width:\s*[^"]*;?"/g, '');

  const fragment = new JSDOM(sanitized, { contentType: 'image/svg+xml' });
  const svgElement = fragment.window.document.querySelector('svg');
  if (!svgElement) {
    return sanitized;
  }

  const rawBBox = computeElementBBox(svgElement);
  const padding = 16;
  const normalizedBox = {
    x: Math.floor(rawBBox.x - padding / 2),
    y: Math.floor(rawBBox.y - padding / 2),
    width: Math.max(1, Math.ceil(rawBBox.width + padding)),
    height: Math.max(1, Math.ceil(rawBBox.height + padding))
  };

  svgElement.setAttribute('viewBox', `${normalizedBox.x} ${normalizedBox.y} ${normalizedBox.width} ${normalizedBox.height}`);
  svgElement.setAttribute('width', String(normalizedBox.width));
  svgElement.setAttribute('height', String(normalizedBox.height));

  return svgElement.outerHTML;
}

function installDom() {
  const dom = new JSDOM('<div id="mermaid-root"></div>', { pretendToBeVisual: true });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.Element = window.Element;
  global.HTMLElement = window.HTMLElement;
  global.SVGElement = window.SVGElement;
  global.Node = window.Node;
  const domPurify = createDOMPurify(window);
  createDOMPurify.sanitize = domPurify.sanitize.bind(domPurify);
  createDOMPurify.addHook = domPurify.addHook.bind(domPurify);
  createDOMPurify.removeHook = domPurify.removeHook.bind(domPurify);
  createDOMPurify.removeHooks = domPurify.removeHooks.bind(domPurify);
  createDOMPurify.setConfig = domPurify.setConfig.bind(domPurify);
  createDOMPurify.clearConfig = domPurify.clearConfig.bind(domPurify);
  global.DOMPurify = createDOMPurify;
  window.DOMPurify = global.DOMPurify;
  Object.defineProperty(globalThis, 'navigator', {
    value: window.navigator,
    configurable: true
  });

  if (!window.SVGElement.prototype.getBBox) {
    window.SVGElement.prototype.getBBox = function getBBox() {
      return computeElementBBox(this);
    };
  }

  if (!window.SVGElement.prototype.getComputedTextLength) {
    window.SVGElement.prototype.getComputedTextLength = function getComputedTextLength() {
      const text = (this.textContent || '').trim();
      return Math.max(24, text.length * 8);
    };
  }
}

async function readStdin() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}

async function main() {
  installDom();
  const rawInput = await readStdin();
  const payload = JSON.parse(rawInput || '{}');
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    htmlLabels: false,
    themeVariables: {
      primaryColor: payload.backgroundColor || '#ffffff',
      primaryTextColor: payload.textColor || '#111827',
      primaryBorderColor: payload.accentColor || '#245fd4',
      lineColor: payload.accentColor || '#245fd4',
      textColor: payload.textColor || '#111827',
      fontFamily: 'DejaVu Sans, Helvetica, Arial, sans-serif'
    }
  });

  const { svg } = await mermaid.render(
    `mermaid-${Buffer.from(String(payload.source || '')).toString('hex').slice(0, 12)}`,
    String(payload.source || '').trim()
  );

  process.stdout.write(JSON.stringify({
    svg: normalizeMermaidSvg(svg, window)
  }));
}

main().catch(error => {
  process.stderr.write(error.stack || error.message);
  process.exitCode = 1;
});
