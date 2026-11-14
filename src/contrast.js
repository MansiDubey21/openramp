// WCAG 2.x colour-contrast maths. Claude calls these as tools instead of estimating ratios.

export function parseColor(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return m[1].split('').map((c) => parseInt(c + c, 16));
  m = s.match(/^#([0-9a-f]{6})$/);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = s.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
  if (m) {
    const rgb = [m[1], m[2], m[3]].map(Number);
    return rgb.every((v) => v <= 255) ? rgb : null;
  }
  return null;
}

export function toHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function luminance([r, g, b]) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** WCAG AA threshold: 3:1 for large text (>=24px, or >=18.66px bold), else 4.5:1. */
export function requiredRatio(fontSizePx, bold) {
  const size = Number(fontSizePx) || 16;
  return size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
}

export function checkContrast({ foreground, background, font_size_px, bold }) {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) return { error: 'Colors must be hex (#rrggbb) or rgb() values.' };
  const ratio = contrastRatio(fg, bg);
  const required = requiredRatio(font_size_px, bold);
  return { ratio: Math.round(ratio * 100) / 100, required_ratio: required, passes_aa: ratio >= required };
}

/** Smallest change to the foreground (towards black or white) that meets minRatio against the background. */
export function suggestAccessibleColor({ foreground, background, min_ratio }) {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  const target = Math.min(Math.max(Number(min_ratio) || 4.5, 1), 21) + 0.05; // small safety margin
  if (!fg || !bg) return { error: 'Colors must be hex (#rrggbb) or rgb() values.' };
  if (contrastRatio(fg, bg) >= target) return { color: toHex(fg), ratio: round(contrastRatio(fg, bg)), changed: false };
  let best = null;
  for (const anchor of [[0, 0, 0], [255, 255, 255]]) {
    for (let t = 0.01; t <= 1.0001; t += 0.01) {
      const c = fg.map((v, i) => Math.round(v + (anchor[i] - v) * t));
      const r = contrastRatio(c, bg);
      if (r >= target) {
        if (!best || t < best.t) best = { t, color: toHex(c), ratio: round(r) };
        break;
      }
    }
  }
  if (!best) return { error: 'No foreground color can reach that ratio on this background; change the background instead.' };
  return { color: best.color, ratio: best.ratio, changed: true };
}

function round(n) {
  return Math.round(n * 100) / 100;
}
