// Deckdown - Shared Utilities

export function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function parseLength(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Handle percentages
    if (value.endsWith('%')) {
      return parseFloat(value) / 100;
    }
    // Handle pixel values
    if (value.endsWith('px')) {
      return parseFloat(value);
    }
    // Handle em values
    if (value.endsWith('em')) {
      return parseFloat(value);
    }
    // Plain number
    return parseFloat(value);
  }
  return 0;
}

export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}