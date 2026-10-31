import * as THREE from '../vendor/three.module.js';

// ---------------------------------------------------------------------------
// Lumen Isles — 2D illustration engine
// ---------------------------------------------------------------------------
// Creatures and people are painted on canvas as original, hand-authored vector
// art: layered gradients, ink outlines, rim light, elemental auras and
// constellation details. The result is used as a billboard sprite inside the
// 3D world, so the characters read as 2D animation while the island stays 3D.
// Shiny variants get a seeded palette plus unique star-freckle patterns, so no
// two shinies ever share the same illustration.
// ---------------------------------------------------------------------------

const SIZE = 512;
const INK = '#161b26';
const cache = new Map();

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { h: 0, s: 0, l: 0 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s, l };
}

function hslCss(h, s, l) {
  return `hsl(${((h % 360) + 360) % 360} ${Math.max(0, Math.min(1, s)) * 100}% ${Math.max(0, Math.min(1, l)) * 100}%)`;
}

// Shift a colour through HSL. Used for the unique shiny palettes.
function shift(hex, dh = 0, ds = 1, dl = 0) {
  const c = hexToHsl(hex);
  return hslCss(c.h + dh, c.s * ds, c.l + dl);
}

function grad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

function radial(ctx, cx, cy, r0, r1, stops) {
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

function smoothPath(ctx, pts) {
  const n = pts.length;
  if (n < 3) return;
  ctx.beginPath();
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const next = pts[(i + 1) % n];
    const m2 = mid(p, next);
    ctx.quadraticCurveTo(p[0], p[1], m2[0], m2[1]);
  }
  ctx.closePath();
}

function ink(ctx, fill, lw = 5, stroke = INK) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw > 0) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function shape(ctx, pts, fill, lw = 5, stroke = INK) {
  smoothPath(ctx, pts);
  ink(ctx, fill, lw, stroke);
}

function poly(ctx, pts, fill, lw = 5, stroke = INK) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ink(ctx, fill, lw, stroke);
}

function ell(ctx, x, y, rx, ry, fill, lw = 5, rot = 0, stroke = INK) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  ink(ctx, fill, lw, stroke);
}

function glow(ctx, x, y, r, color, alpha = 0.7) {
  if (r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = radial(ctx, x, y, 0, r, [[0, color], [0.45, color], [1, 'rgba(0,0,0,0)']]);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function line(ctx, pts, color, lw = 4, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p.length === 4) ctx.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else ctx.lineTo(p[0], p[1]);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

function star(ctx, x, y, r, color, points = 4, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.28;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function rim(ctx, x, y, rx, ry, color, rot = 0) {
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, Math.PI * 1.02, Math.PI * 1.72);
  ctx.stroke();
  ctx.restore();
}

// Large expressive eye with an ink outline, luminous iris and two highlights.
function eye(ctx, x, y, rx, ry, iris = '#8ef7c1', opts = {}) {
  const tilt = opts.tilt || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ell(ctx, 0, 0, rx, ry, '#fffdf4', 4.5);
  const irisGrad = radial(ctx, 0, ry * 0.15, 1, rx * 0.95, [
    [0, '#ffffff'], [0.35, iris], [0.82, shift(iris, 8, 1.15, -0.24)], [1, '#151824'],
  ]);
  ctx.beginPath();
  ctx.ellipse(0, ry * 0.08, rx * 0.62, ry * 0.72, 0, 0, Math.PI * 2);
  ctx.fillStyle = irisGrad;
  ctx.fill();
  ell(ctx, rx * 0.05, ry * 0.12, rx * 0.25, ry * 0.4, '#11131c', 0);
  ell(ctx, -rx * 0.2, -ry * 0.3, rx * 0.2, ry * 0.22, '#ffffff', 0);
  ell(ctx, rx * 0.25, -ry * 0.12, rx * 0.09, ry * 0.1, '#ffffff', 0);
  // eyelid / brow
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, Math.PI * 1.02, Math.PI * 1.82);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.stroke();
  if (opts.brow) {
    line(ctx, [[-rx * 0.9, -ry * 1.12], [0, -ry * 1.34], [rx * 0.9, -ry * 1.12]], INK, 4.5);
  }
  ctx.restore();
}

function mouth(ctx, x, y, w, kind = 'smile') {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  if (kind === 'grin') {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y + w * 0.9, x + w, y);
    ctx.stroke();
    ctx.fillStyle = '#fffdf4';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.75, y + 1);
    ctx.quadraticCurveTo(x, y + w * 0.62, x + w * 0.75, y + 1);
    ctx.fill();
  } else if (kind === 'beak') {
    poly(ctx, [[x - w, y], [x + w, y], [x, y + w * 1.4]], '#f0a33c', 4);
  } else if (kind === 'fang') {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y + w * 0.7, x + w, y);
    ctx.stroke();
    poly(ctx, [[x - w * 0.55, y + 1], [x - w * 0.3, y + 1], [x - w * 0.45, y + w * 0.6]], '#fffdf4', 2);
    poly(ctx, [[x + w * 0.3, y + 1], [x + w * 0.55, y + 1], [x + w * 0.42, y + w * 0.6]], '#fffdf4', 2);
  } else {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y + w * 0.55, x + w, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Species palettes (base, then shiny variants are derived from the seed)
// ---------------------------------------------------------------------------

const PALETTES = {
  spriglet: {
    base: '#62cf74', base2: '#2f9b55', dark: '#1c5b3a', light: '#dcffab',
    accent: '#ffe066', aura: '#72ff9b', eye: '#a8ffbf', metal: '#d8c07a',
  },
  emberpup: {
    base: '#f07a3c', base2: '#bd3f28', dark: '#4a1d22', light: '#ffd28a',
    accent: '#ffc94a', aura: '#ff7a36', eye: '#ffd55e', metal: '#8c4a2e',
  },
  dropplet: {
    base: '#54c6e4', base2: '#2679b4', dark: '#143e62', light: '#d9fbff',
    accent: '#a9f7ff', aura: '#5fe0ff', eye: '#8bfff4', metal: '#cfe9ef',
  },
  mossling: {
    base: '#8fc95c', base2: '#4f8c3e', dark: '#2a532f', light: '#e6f9a8',
    accent: '#ffd978', aura: '#8cff86', eye: '#d6ff88', metal: '#a49a86',
  },
  pebblit: {
    base: '#9a958a', base2: '#5f6159', dark: '#2f3635', light: '#d7d1bd',
    accent: '#b7ff8a', aura: '#9dffb0', eye: '#c6ff9a', metal: '#8a7a5f',
  },
  zapmouse: {
    base: '#f5d34f', base2: '#d79a25', dark: '#4a3a1e', light: '#fff6b0',
    accent: '#fff06a', aura: '#ffe75a', eye: '#fff27a', metal: '#7b6641',
  },
  fluffbat: {
    base: '#a58ae8', base2: '#6a4db8', dark: '#2e2354', light: '#eadcff',
    accent: '#ff9ad5', aura: '#b48cff', eye: '#ffd0f2', metal: '#7d6aa8',
  },
  lunari: {
    base: '#5b60b8', base2: '#30356f', dark: '#171a3c', light: '#dbe6ff',
    accent: '#9ff0ff', aura: '#6ad6ff', eye: '#b5f5ff', metal: '#c8dcff',
  },
  solaris: {
    base: '#f7cf63', base2: '#da8f2e', dark: '#63351c', light: '#fff3c4',
    accent: '#fff0a8', aura: '#ffcf5e', eye: '#fff09a', metal: '#d89b36',
  },
  elderwood: {
    base: '#79a861', base2: '#456b3d', dark: '#22361f', light: '#c9efa0',
    accent: '#ddffa8', aura: '#9dff88', eye: '#d8ffae', metal: '#c2ac86',
  },
  mosswarden: {
    base: '#7fbb57', base2: '#467d3a', dark: '#24472a', light: '#e8f9b2',
    accent: '#ffd76a', aura: '#9bff8a', eye: '#d8ff9a', metal: '#b3a488',
  },
  voltrix: {
    base: '#ffd84f', base2: '#c9881c', dark: '#40300f', light: '#fffbd0',
    accent: '#eaff6a', aura: '#ffe65a', eye: '#fff49a', metal: '#8a7132',
  },
  cragwarden: {
    base: '#8f8c84', base2: '#54544f', dark: '#262b2a', light: '#e0d8c2',
    accent: '#a8ffd2', aura: '#93ffd0', eye: '#c6ffe2', metal: '#b59a6a',
  },
  tidalyn: {
    base: '#46bcdd', base2: '#1f6ea8', dark: '#0f3558', light: '#dcfcff',
    accent: '#b5fff2', aura: '#5fe8ff', eye: '#9bfff4', metal: '#d8eef4',
  },
  sylvanox: {
    base: '#5fcf72', base2: '#2b8f4e', dark: '#173f2e', light: '#e4ffb0',
    accent: '#ffe58a', aura: '#7dffae', eye: '#b9ffd0', metal: '#e0c684',
  },
  pyrohound: {
    base: '#f4793a', base2: '#a93220', dark: '#3d1620', light: '#ffe09a',
    accent: '#ffd04d', aura: '#ff6f2e', eye: '#ffd968', metal: '#d08a3f',
  },
  nocturne: {
    base: '#8f7bd8', base2: '#54408f', dark: '#241c45', light: '#f0e6ff',
    accent: '#ffc2ef', aura: '#c08cff', eye: '#ffe0ff', metal: '#9f8bd0',
  },
};

function paletteFor(speciesId, appearance) {
  const base = PALETTES[speciesId] || PALETTES.spriglet;
  const out = { ...base };
  if (!appearance?.shiny || !appearance.seed) return out;
  const rand = mulberry32(appearance.seed >>> 0);
  const dh = Math.floor(rand() * 360);
  const ds = 0.9 + rand() * 0.55;
  const dl = -0.04 + rand() * 0.12;
  for (const key of Object.keys(out)) {
    out[key] = shift(out[key], dh + rand() * 38 - 19, ds, dl);
  }
  out.shiny = true;
  out.seed = appearance.seed;
  out.spark = hslCss(rand() * 360, 0.95, 0.78);
  out.spark2 = hslCss(rand() * 360, 0.9, 0.7);
  out.dh = dh;
  return out;
}

// ---------------------------------------------------------------------------
// Detail helpers — anatomy, fur, scales, feathers, shading
// ---------------------------------------------------------------------------

function fur(ctx, pts, base, edge, count = 9) {
  // Tufts of fur along an edge: alternating base/edge clumps.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const x = pts[0][0] + (pts[pts.length - 1][0] - pts[0][0]) * t;
    const y = pts[0][1] + (pts[pts.length - 1][1] - pts[0][1]) * t;
    const nx = -(pts[pts.length - 1][1] - pts[0][1]);
    const ny = pts[pts.length - 1][0] - pts[0][0];
    const len = Math.hypot(nx, ny) || 1;
    const hx = nx / len * (10 + Math.sin(t * 13) * 6);
    const hy = ny / len * (10 + Math.sin(t * 13) * 6);
    ctx.beginPath();
    ctx.moveTo(x - hx * 0.45, y - hy * 0.45);
    ctx.lineTo(x, y);
    ctx.lineTo(x + hx * 0.45, y - hy * 0.45);
    ctx.lineTo(x, y + hy * 0.5);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? base : edge;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();
}

function scales(ctx, x, y, w, h, color, dark, rows = 4, cols = 4) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const stepX = w / cols, stepY = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x + c * stepX + (r % 2) * stepX * 0.5;
      const cy = y + r * stepY;
      ctx.beginPath();
      ctx.moveTo(cx, cy - stepY * 0.35);
      ctx.lineTo(cx + stepX * 0.5, cy + stepY * 0.3);
      ctx.lineTo(cx - stepX * 0.5, cy + stepY * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function feathers(ctx, x, y, count, span, color, dark) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1) - 0.5;
    const a = Math.PI * 0.42 + t * span;
    const len = 28 + Math.sin(t * 3) * 8;
    const x1 = x + Math.cos(a) * len;
    const y1 = y + Math.sin(a) * len * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.3, x1, y1);
    ctx.lineTo(x + Math.cos(a + 0.18) * len * 0.45, y + Math.sin(a + 0.18) * len * 0.27);
    ctx.lineTo(x + Math.cos(a) * len * 0.6, y + Math.sin(a) * len * 0.36);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? color : dark;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();
}

// Internal soft shading on top of a shape (multiply-style overlay).
function shade(ctx, color, alpha = 0.35) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// Highlight pass (screen-style overlay).
function highlight(ctx, color, alpha = 0.5) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// Expressive eye with lid, iris pattern, catch-light and subtle shadow.
function eyeDetailed(ctx, x, y, rx, ry, iris, opts = {}) {
  const tilt = opts.tilt || 0;
  const lid = opts.lid !== false;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  // sclera
  ell(ctx, 0, ry * 0.06, rx, ry, '#fffdf2', 4);
  // iris ring
  ctx.beginPath();
  ctx.ellipse(0, ry * 0.08, rx * 0.66, ry * 0.75, 0, 0, Math.PI * 2);
  ctx.fillStyle = radial(ctx, 0, ry * 0.1, 1, rx * 0.62, [[0, '#ffffff'], [0.32, iris], [0.82, shift(iris, 10, 1.15, -0.22)], [1, '#161b26']]);
  ctx.fill();
  // pupil
  ell(ctx, 0, ry * 0.08, rx * 0.3, ry * 0.5, '#11131c', 0);
  // catch lights
  ell(ctx, -rx * 0.18, -ry * 0.3, rx * 0.18, ry * 0.18, '#ffffff', 0);
  ell(ctx, rx * 0.28, -ry * 0.14, rx * 0.11, ry * 0.11, '#ffffff', 0);
  // iris flecks
  ctx.fillStyle = shift(iris, 15, 0.9, -0.1);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const rr = rx * 0.28 + Math.sin(i) * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * rr, ry * 0.08 + Math.sin(a) * rr, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (lid) {
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, Math.PI * 1.02, Math.PI * 1.82);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  if (opts.brow) {
    line(ctx, [[-rx * 0.95, -ry * 1.18], [0, -ry * 1.4], [rx * 0.95, -ry * 1.18]], INK, 5);
  }
  ctx.restore();
}

// Fur clump around a shape's edge.
function furAround(ctx, pts, base, edge, count = 10, offset = 8) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const p1 = pts[i % pts.length];
    const p2 = pts[(i + 1) % pts.length];
    const mx = (p1[0] + p2[0]) / 2;
    const my = (p1[1] + p2[1]) / 2;
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len * offset;
    const ny = dx / len * offset;
    const side = i % 2 === 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(mx - nx * side * 0.35, my - ny * side * 0.35);
    ctx.lineTo(mx + nx * side * 0.35, my + ny * side * 0.35);
    ctx.lineTo(mx, my);
    ctx.closePath();
    ctx.fillStyle = i % 3 === 0 ? base : edge;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Shared scene dressing
// ---------------------------------------------------------------------------

function backdrop(ctx, p, opts = {}) {
  const cx = opts.cx ?? 256;
  const cy = opts.cy ?? 290;
  const r = opts.r ?? 210;
  // soft elemental aura
  glow(ctx, cx, cy, r * 0.85, p.aura, 0.24);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = radial(ctx, cx, cy, r * 0.2, r, [[0, p.accent], [1, 'rgba(0,0,0,0)']]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // dynamic diagonal light rays
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const a = -2.5 + i * 0.16;
    ctx.globalAlpha = 0.05 + (i % 2) * 0.035;
    ctx.fillStyle = p.light;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 330, cy + Math.sin(a) * 330);
    ctx.lineTo(cx + Math.cos(a + 0.07) * 330, cy + Math.sin(a + 0.07) * 330);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // ground shadow
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = radial(ctx, cx, 470, 8, 170, [[0, 'rgba(9,20,18,0.72)'], [1, 'rgba(9,20,18,0)']]);
  ctx.beginPath();
  ctx.ellipse(cx, 470, 170, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function sparkleField(ctx, p, seed = 0, count = 16, zone = [50, 60, 460, 430]) {
  const rand = mulberry32((seed || 1) ^ 0x5f3759df);
  for (let i = 0; i < count; i++) {
    const x = zone[0] + rand() * (zone[2] - zone[0]);
    const y = zone[1] + rand() * (zone[3] - zone[1]);
    const r = 1.6 + rand() * 4.4;
    star(ctx, x, y, r, i % 3 === 0 ? p.spark2 || p.light : p.accent, 4, 0.35 + rand() * 0.55);
  }
}

function shinyFreckles(ctx, p, seed) {
  if (!p.shiny) return;
  const rand = mulberry32((seed >>> 0) ^ 0x9e3779b9);
  const count = 7 + Math.floor(rand() * 7);
  for (let i = 0; i < count; i++) {
    const x = 150 + rand() * 212;
    const y = 150 + rand() * 260;
    const r = 2 + rand() * 5;
    star(ctx, x, y, r, i % 2 ? p.spark : p.spark2, 4, 0.75);
  }
  // unique orbiters
  const orbs = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < orbs; i++) {
    const a = rand() * Math.PI * 2;
    const rr = 120 + rand() * 100;
    const x = 256 + Math.cos(a) * rr;
    const y = 280 + Math.sin(a) * rr * 0.72;
    glow(ctx, x, y, 12 + rand() * 8, p.aura, 0.7);
    star(ctx, x, y, 3.5 + rand() * 3, p.spark, 4, 0.95);
  }
}

// ---------------------------------------------------------------------------
// Creature illustrations
// ---------------------------------------------------------------------------

function drawSpriglet(ctx, p) {
  backdrop(ctx, p, { r: 190, cx: 250, cy: 285 });
  // tail with leaf tuft
  shape(ctx, [[300, 326], [392, 252], [460, 282], [446, 344], [378, 364], [330, 358]], grad(ctx, 320, 256, 444, 368, [[0, p.base2], [0.55, p.dark], [1, p.base]]), 5, p.dark);
  line(ctx, [[320, 340], [384, 286], [432, 292]], p.light, 3, 0.5);
  shape(ctx, [[384, 266], [430, 208], [478, 242], [460, 300], [414, 304]], grad(ctx, 390, 220, 470, 300, [[0, p.accent], [1, p.base2]]), 4, p.dark);
  line(ctx, [[390, 282], [420, 242], [452, 236]], p.light, 3, 0.55);
  glow(ctx, 432, 286, 52, p.aura, 0.28);
  // hind legs with fur tufts
  shape(ctx, [[176, 378], [160, 438], [212, 442], [224, 388]], grad(ctx, 152, 378, 224, 444, [[0, p.base2], [1, p.dark]]), 5, p.dark);
  ell(ctx, 168, 444, 40, 16, p.light, 4);
  fur(ctx, [[178, 386], [206, 384]], p.base, p.dark, 7);
  shape(ctx, [[304, 376], [292, 438], [348, 442], [356, 386]], grad(ctx, 280, 376, 358, 444, [[0, p.base2], [1, p.dark]]), 5, p.dark);
  ell(ctx, 312, 444, 40, 16, p.light, 4);
  fur(ctx, [[304, 384], [332, 382]], p.base, p.dark, 7);
  // body
  shape(ctx, [[154, 308], [190, 242], [278, 220], [352, 252], [372, 330], [334, 402], [228, 416], [172, 378]], grad(ctx, 160, 232, 364, 412, [[0, p.base], [0.58, p.base], [1, p.base2]]), 5, p.dark);
  ell(ctx, 264, 328, 82, 64, grad(ctx, 214, 284, 324, 378, [[0, p.light], [1, 'rgba(255,255,255,0)']]), 0);
  shade(ctx, p.dark, 0.28);
  // chest crest leaf with veins
  shape(ctx, [[252, 288], [304, 330], [272, 374], [232, 350]], grad(ctx, 248, 296, 276, 370, [[0, p.accent], [1, p.base2]]), 4, p.dark);
  line(ctx, [[256, 302], [264, 350]], p.dark, 2.5, 0.7);
  line(ctx, [[262, 308], [266, 356]], p.dark, 2.5, 0.7);
  // arms with fur shoulders
  shape(ctx, [[152, 328], [136, 360], [148, 394], [168, 398], [186, 368], [200, 330]], grad(ctx, 136, 286, 200, 396, [[0, p.base], [1, p.base2]]), 5, p.dark);
  fur(ctx, [[154, 330], [166, 332], [174, 330]], p.base, p.dark, 6);
  shape(ctx, [[374, 324], [390, 356], [402, 392], [414, 394], [432, 364], [448, 330]], grad(ctx, 358, 284, 448, 392, [[0, p.base], [1, p.base2]]), 5, p.dark);
  fur(ctx, [[376, 326], [388, 328], [396, 326]], p.base, p.dark, 6);
  // head
  shape(ctx, [[178, 210], [198, 146], [266, 124], [334, 152], [356, 216], [320, 276], [252, 288], [204, 260]], grad(ctx, 190, 132, 338, 282, [[0, p.light], [0.32, p.base], [1, p.base2]]), 5, p.dark);
  shade(ctx, p.dark, 0.25);
  rim(ctx, 262, 208, 74, 68, p.accent);
  // ears with inner glow
  shape(ctx, [[198, 158], [158, 38], [236, 102], [256, 158]], grad(ctx, 172, 50, 240, 160, [[0, p.base], [1, p.base2]]), 5, p.dark);
  shape(ctx, [[204, 142], [184, 72], [228, 112], [238, 148]], p.light, 3);
  line(ctx, [[210, 112], [218, 74]], p.base2, 2.5, 0.8);
  shape(ctx, [[322, 154], [356, 36], [292, 102], [272, 156]], grad(ctx, 282, 50, 354, 160, [[0, p.base], [1, p.base2]]), 5, p.dark);
  shape(ctx, [[318, 142], [336, 72], [294, 112], [282, 148]], p.light, 3);
  line(ctx, [[312, 112], [304, 74]], p.base2, 2.5, 0.8);
  // face mask
  shape(ctx, [[212, 206], [252, 190], [288, 204], [304, 248], [278, 276], [240, 276], [206, 244]], p.light, 4);
  // detailed eyes
  eyeDetailed(ctx, 234, 214, 22, 27, p.eye, { brow: true, tilt: 0.06 });
  eyeDetailed(ctx, 294, 214, 22, 27, p.eye, { brow: true, tilt: -0.06 });
  mouth(ctx, 264, 254, 15, 'fang');
  ell(ctx, 220, 250, 10, 6, 'rgba(255,110,110,0.35)', 0);
  ell(ctx, 308, 250, 10, 6, 'rgba(255,110,110,0.35)', 0);
  // forehead leaf sprout
  shape(ctx, [[250, 148], [234, 102], [266, 80], [290, 112], [278, 150]], grad(ctx, 242, 82, 288, 150, [[0, p.accent], [1, p.base2]]), 4, p.dark);
  line(ctx, [[256, 142], [266, 104]], p.dark, 3, 0.8);
  line(ctx, [[270, 134], [268, 100]], p.dark, 2.5, 0.8);
  // vine markings on body
  line(ctx, [[170, 300], [196, 330], [184, 370]], p.accent, 4, 0.85);
  line(ctx, [[352, 296], [332, 336], [348, 374]], p.accent, 4, 0.85);
  sparkleField(ctx, p, p.seed || 7, 16, [60, 80, 460, 400]);
  shinyFreckles(ctx, p, p.seed || 0);
}


function drawEmberpup(ctx, p) {
  backdrop(ctx, p, { r: 200 });
  // flame tail
  shape(ctx, [[300, 330], [380, 300], [398, 236], [434, 262], [414, 196], [456, 218], [428, 300], [400, 356], [330, 366]], grad(ctx, 390, 200, 430, 360, [[0, '#fff3b0'], [0.4, p.accent], [1, p.base2]]), 4, '#4a1d22');
  glow(ctx, 408, 280, 90, p.aura, 0.32);
  // legs
  ell(ctx, 188, 408, 46, 56, grad(ctx, 150, 360, 230, 460, [[0, p.base2], [1, p.dark]]));
  ell(ctx, 316, 408, 46, 56, grad(ctx, 280, 360, 360, 460, [[0, p.base2], [1, p.dark]]));
  ell(ctx, 180, 452, 44, 18, p.light);
  ell(ctx, 324, 452, 44, 18, p.light);
  // body
  shape(ctx, [[158, 320], [192, 246], [282, 224], [356, 254], [376, 338], [334, 412], [228, 424], [174, 386]], grad(ctx, 160, 230, 370, 420, [[0, p.base], [0.58, p.base], [1, p.base2]]));
  // flame chest
  shape(ctx, [[258, 300], [284, 334], [302, 368], [268, 392], [236, 378], [222, 342]], grad(ctx, 230, 300, 290, 390, [[0, '#fff6c0'], [0.6, p.accent], [1, p.base2]]), 3, '#4a1d22');
  glow(ctx, 264, 350, 52, p.aura, 0.3);
  // arms
  ell(ctx, 158, 338, 30, 59, grad(ctx, 138, 292, 178, 392, [[0, p.base], [1, p.base2]]), 5, -0.28);
  ell(ctx, 368, 334, 30, 59, grad(ctx, 348, 288, 388, 388, [[0, p.base], [1, p.base2]]), 5, 0.28);
  // head
  shape(ctx, [[182, 218], [202, 150], [268, 128], [336, 152], [356, 220], [320, 282], [252, 294], [202, 264]], grad(ctx, 190, 130, 340, 286, [[0, p.light], [0.35, p.base], [1, p.base2]]));
  rim(ctx, 264, 208, 74, 68, p.accent);
  // ears
  shape(ctx, [[196, 164], [160, 72], [232, 112], [250, 164]], grad(ctx, 168, 80, 242, 160, [[0, p.base], [1, p.base2]]), 5);
  shape(ctx, [[324, 160], [360, 66], [292, 110], [274, 160]], grad(ctx, 280, 72, 356, 156, [[0, p.base], [1, p.base2]]), 5);
  shape(ctx, [[206, 148], [184, 100], [226, 126], [236, 156]], p.dark, 3);
  shape(ctx, [[316, 146], [340, 96], [294, 124], [284, 154]], p.dark, 3);
  // face mask
  shape(ctx, [[214, 208], [252, 190], [292, 206], [304, 252], [276, 280], [240, 280], [206, 250]], p.light, 4);
  eye(ctx, 234, 216, 22, 27, p.eye, { brow: true, tilt: 0.07 });
  eye(ctx, 294, 216, 22, 27, p.eye, { brow: true, tilt: -0.07 });
  mouth(ctx, 264, 254, 16, 'fang');
  // nose + ember marks
  ell(ctx, 264, 238, 9, 7, p.dark, 3);
  line(ctx, [[208, 200], [226, 190]], p.accent, 4, 0.85);
  line(ctx, [[320, 198], [302, 188]], p.accent, 4, 0.85);
  line(ctx, [[170, 306], [192, 338], [180, 376]], p.accent, 4, 0.8);
  line(ctx, [[352, 300], [332, 340], [346, 378]], p.accent, 4, 0.8);
  sparkleField(ctx, p, p.seed || 9, 18, [50, 70, 470, 410]);
  shinyFreckles(ctx, p, p.seed || 0);
}

function drawDropplet(ctx, p) {
  backdrop(ctx, p, { r: 195 });
  // translucent tail fin
  shape(ctx, [[304, 346], [394, 330], [462, 280], [438, 354], [470, 404], [386, 388], [316, 380]], grad(ctx, 330, 290, 450, 400, [[0, p.accent], [1, p.base2]]), 4, p.dark);
  ctx.save(); ctx.globalAlpha = 0.35; shape(ctx, [[330, 350], [402, 338], [450, 306], [430, 366], [446, 396], [380, 374]], p.light, 0); ctx.restore();
  // water droplet crest
  shape(ctx, [[260, 142], [286, 70], [318, 146], [300, 174], [274, 174]], grad(ctx, 268, 74, 316, 174, [[0, p.light], [0.5, p.accent], [1, p.base]]), 5);
  glow(ctx, 292, 120, 54, p.aura, 0.3);
  // legs
  ell(ctx, 192, 410, 44, 54, grad(ctx, 154, 364, 232, 462, [[0, p.base2], [1, p.dark]]));
  ell(ctx, 318, 410, 44, 54, grad(ctx, 282, 364, 360, 462, [[0, p.base2], [1, p.dark]]));
  ell(ctx, 184, 452, 44, 17, p.light);
  ell(ctx, 326, 452, 44, 17, p.light);
  // body
  shape(ctx, [[160, 322], [194, 250], [284, 228], [358, 258], [374, 340], [330, 412], [228, 426], [174, 388]], grad(ctx, 158, 230, 370, 420, [[0, p.light], [0.28, p.base], [1, p.base2]]));
  ell(ctx, 262, 334, 80, 64, grad(ctx, 212, 286, 322, 386, [[0, '#ffffff'], [1, 'rgba(255,255,255,0)']]), 0);
  // belly ripple
  ctx.save(); ctx.globalAlpha = 0.6;
  line(ctx, [[224, 340], [264, 356], [306, 338]], p.light, 4);
  line(ctx, [[232, 362], [264, 374], [298, 360]], p.light, 3);
  ctx.restore();
  // side fins
  shape(ctx, [[150, 322], [92, 280], [122, 356], [166, 374]], grad(ctx, 100, 280, 164, 370, [[0, p.accent], [1, p.base2]]));
  shape(ctx, [[372, 318], [430, 274], [402, 354], [356, 374]], grad(ctx, 356, 280, 428, 368, [[0, p.accent], [1, p.base2]]));
  // head
  shape(ctx, [[184, 222], [204, 152], [270, 130], [338, 156], [356, 224], [320, 282], [252, 294], [202, 264]], grad(ctx, 190, 132, 344, 288, [[0, p.light], [0.32, p.base], [1, p.base2]]));
  rim(ctx, 264, 212, 74, 68, p.accent);
  // gill fins
  shape(ctx, [[196, 236], [158, 212], [166, 258], [198, 270]], p.accent, 4);
  shape(ctx, [[328, 232], [366, 208], [358, 256], [326, 268]], p.accent, 4);
  // face mask
  shape(ctx, [[214, 212], [252, 194], [292, 208], [304, 252], [276, 280], [240, 280], [206, 250]], p.light, 4);
  eye(ctx, 234, 220, 22, 27, p.eye, { brow: true, tilt: 0.06 });
  eye(ctx, 294, 220, 22, 27, p.eye, { brow: true, tilt: -0.06 });
  mouth(ctx, 264, 256, 15, 'smile');
  ell(ctx, 220, 250, 10, 7, 'rgba(80,180,220,0.4)', 0);
  ell(ctx, 310, 250, 10, 7, 'rgba(80,180,220,0.4)', 0);
  // bubbles
  for (const [bx, by, br] of [[140, 180, 13], [114, 140, 8], [404, 190, 16], [438, 148, 9], [386, 120, 6]]) {
    ell(ctx, bx, by, br, br, 'rgba(190,250,255,0.28)', 3, 0, '#c9f7ff');
    ell(ctx, bx - br * 0.3, by - br * 0.3, br * 0.3, br * 0.22, '#ffffff', 0);
  }
  sparkleField(ctx, p, p.seed || 11, 14, [60, 80, 460, 410]);
  shinyFreckles(ctx, p, p.seed || 0);
}

function drawMossling(ctx, p) {
  backdrop(ctx, p, { r: 188 });
  // moss cape
  shape(ctx, [[170, 300], [232, 246], [316, 248], [370, 300], [348, 398], [262, 430], [178, 396]], grad(ctx, 180, 250, 360, 420, [[0, p.base2], [1, p.dark]]));
  // mushrooms on the back
  for (const [mx, my, mr, col] of [[348, 274, 34, p.accent], [388, 318, 24, p.light], [168, 286, 26, p.accent]]) {
    ell(ctx, mx, my - mr * 0.2, mr, mr * 0.52, grad(ctx, mx - mr, my - mr, mx + mr, my, [[0, col], [1, p.base2]]), 4);
    ell(ctx, mx, my + mr * 0.1, mr * 0.22, mr * 0.5, p.light, 3);
  }
  // feet
  ell(ctx, 190, 438, 42, 30, p.dark);
  ell(ctx, 326, 438, 42, 30, p.dark);
  ell(ctx, 184, 454, 42, 16, p.light);
  ell(ctx, 330, 454, 42, 16, p.light);
  // round body
  shape(ctx, [[158, 336], [190, 270], [270, 248], [344, 274], [368, 348], [332, 408], [226, 420], [170, 388]], grad(ctx, 160, 250, 370, 420, [[0, p.base], [0.6, p.base], [1, p.base2]]));
  ell(ctx, 260, 336, 78, 58, grad(ctx, 214, 292, 318, 382, [[0, p.light], [1, 'rgba(255,255,255,0)']]), 0);
  // tiny arms
  ell(ctx, 156, 348, 26, 46, p.base2, 5, -0.3);
  ell(ctx, 370, 344, 26, 46, p.base2, 5, 0.3);
  // cap / head
  shape(ctx, [[164, 250], [196, 178], [264, 152], [334, 180], [360, 252], [322, 286], [252, 296], [190, 282]], grad(ctx, 176, 156, 346, 290, [[0, p.light], [0.35, p.base], [1, p.base2]]));
  // big mushroom cap
  shape(ctx, [[150, 206], [172, 122], [256, 78], [342, 124], [364, 206], [330, 224], [262, 214], [186, 222]], grad(ctx, 160, 86, 352, 220, [[0, p.base2], [0.45, p.big || p.base], [1, p.dark]]));
  shape(ctx, [[178, 202], [196, 132], [256, 96], [318, 132], [336, 202], [300, 214], [256, 204], [204, 214]], p.base, 0);
  // cap spots
  ell(ctx, 222, 158, 19, 12, p.light, 3, -0.2);
  ell(ctx, 284, 144, 13, 9, p.light, 3, 0.2);
  ell(ctx, 316, 182, 11, 8, p.light, 3);
  // face
  shape(ctx, [[198, 230], [252, 216], [312, 232], [322, 272], [280, 292], [232, 292], [194, 270]], p.light, 4);
  eye(ctx, 232, 240, 19, 24, p.eye, { tilt: 0.05 });
  eye(ctx, 294, 240, 19, 24, p.eye, { tilt: -0.05 });
  mouth(ctx, 264, 272, 13, 'smile');
  ell(ctx, 214, 268, 10, 6, 'rgba(230,140,120,0.35)', 0);
  ell(ctx, 312, 268, 10, 6, 'rgba(230,140,120,0.35)', 0);
  // sprout on the cap
  line(ctx, [[256, 84], [252, 54]], p.base2, 5);
  shape(ctx, [[252, 60], [216, 34], [244, 58], [246, 78]], p.light, 3);
  shape(ctx, [[258, 58], [292, 30], [268, 56], [264, 76]], p.accent, 3);
  // hanging vines
  line(ctx, [[164, 226], [148, 288], [162, 326]], p.base2, 4, 0.8);
  line(ctx, [[356, 224], [374, 286], [360, 328]], p.base2, 4, 0.8);
  ell(ctx, 148, 292, 6, 9, p.accent, 2);
  ell(ctx, 374, 290, 6, 9, p.accent, 2);
  sparkleField(ctx, p, p.seed || 13, 16, [60, 70, 450, 400]);
  shinyFreckles(ctx, p, p.seed || 0);
}

function drawPebblit(ctx, p) {
  backdrop(ctx, p, { r: 190 });
  // crystal shards behind
  for (const [sx, sy, sw, sh, rot] of [[344, 292, 44, 132, 0.24], [386, 330, 30, 92, 0.5], [154, 320, 34, 104, -0.4]]) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    poly(ctx, [[0, -sh / 2], [sw / 2, -sh * 0.1], [sw * 0.3, sh / 2], [-sw * 0.3, sh / 2], [-sw / 2, -sh * 0.1]], grad(ctx, -sw, -sh, sw, sh, [[0, p.light], [0.55, p.accent], [1, p.base2]]), 4, p.dark);
    line(ctx, [[0, -sh / 2 + 6], [0, sh / 2 - 8]], '#ffffff', 3, 0.5);
    ctx.restore();
  }
  glow(ctx, 360, 300, 74, p.aura, 0.24);
  // legs
  shape(ctx, [[180, 388], [164, 452], [218, 452], [226, 398]], grad(ctx, 166, 390, 224, 452, [[0, p.base], [1, p.dark]]));
  shape(ctx, [[300, 398], [308, 452], [362, 452], [346, 388]], grad(ctx, 304, 390, 360, 452, [[0, p.base], [1, p.dark]]));
  ell(ctx, 190, 456, 34, 14, p.light, 4);
  ell(ctx, 336, 456, 34, 14, p.light, 4);
  // boulder body
  shape(ctx, [[138, 350], [160, 276], [226, 240], [300, 238], [364, 278], [382, 352], [344, 414], [252, 436], [172, 410]], grad(ctx, 150, 250, 378, 424, [[0, p.light], [0.35, p.base], [1, p.base2]]));
  // rock facets
  poly(ctx, [[170, 312], [222, 284], [252, 330], [214, 378], [168, 360]], 'rgba(255,255,255,0.14)', 2, p.dark);
  poly(ctx, [[252, 330], [316, 286], [352, 330], [320, 386], [258, 402]], 'rgba(0,0,0,0.12)', 2, p.dark);
  line(ctx, [[194, 300], [216, 340], [196, 366]], p.light, 3, 0.55);
  // moss patches
  ell(ctx, 208, 268, 42, 18, p.base2, 0, -0.2);
  ell(ctx, 324, 280, 34, 14, p.base2, 0, 0.3);
  ell(ctx, 248, 414, 52, 16, p.base2, 0);
  // arms / fists
  ell(ctx, 138, 348, 40, 52, grad(ctx, 110, 308, 168, 398, [[0, p.base], [1, p.base2]]), 5, -0.2);
  ell(ctx, 382, 346, 40, 52, grad(ctx, 354, 306, 412, 396, [[0, p.base], [1, p.base2]]), 5, 0.2);
  ell(ctx, 134, 388, 34, 26, p.base2, 4);
  ell(ctx, 386, 386, 34, 26, p.base2, 4);
  // head is a crag
  shape(ctx, [[196, 238], [212, 182], [264, 158], [322, 184], [338, 240], [300, 278], [244, 284], [208, 264]], grad(ctx, 208, 162, 332, 282, [[0, p.light], [0.4, p.base], [1, p.base2]]));
  // brow ridge
  shape(ctx, [[202, 220], [232, 202], [292, 200], [322, 218], [302, 234], [238, 236], [210, 232]], p.base2, 3);
  eye(ctx, 234, 236, 19, 23, p.eye, { tilt: 0.08 });
  eye(ctx, 294, 236, 19, 23, p.eye, { tilt: -0.08 });
  mouth(ctx, 264, 266, 18, 'fang');
  // crack glow
  line(ctx, [[214, 186], [240, 214], [232, 244]], p.accent, 4, 0.9);
  line(ctx, [[316, 190], [298, 218]], p.accent, 3.5, 0.9);
  line(ctx, [[188, 338], [214, 356], [202, 388]], p.accent, 4, 0.75);
  sparkleField(ctx, p, p.seed || 15, 15, [60, 80, 450, 410]);
  shinyFreckles(ctx, p, p.seed || 0);
}

function drawZapmouse(ctx, p) {
  backdrop(ctx, p, { r: 195 });
  // lightning-bolt tail
  const bolt = [[306, 344], [392, 292], [358, 272], [430, 200], [378, 216], [400, 156], [330, 250], [370, 268], [300, 330]];
  glow(ctx, 372, 250, 100, p.aura, 0.3);
  poly(ctx, bolt, grad(ctx, 320, 170, 420, 340, [[0, '#fffbd0'], [0.45, p.accent], [1, p.base2]]), 5, p.dark);
  line(ctx, [[378, 218], [394, 208]], '#fffef0', 4, 0.8);
  // electric arcs
  for (let i = 0; i < 4; i++) {
    const y = 170 + i * 56;
    line(ctx, [[118, y], [148, y - 18], [162, y + 8], [190, y - 12]], p.accent, 3, 0.65);
    line(ctx, [[394, y + 22], [418, y + 4], [434, y + 28], [458, y + 10]], p.accent, 3, 0.65);
  }
  // legs
  ell(ctx, 198, 410, 42, 54, grad(ctx, 160, 366, 238, 460, [[0, p.base2], [1, p.dark]]));
  ell(ctx, 318, 410, 42, 54, grad(ctx, 280, 366, 358, 460, [[0, p.base2], [1, p.dark]]));
  ell(ctx, 190, 452, 42, 17, p.light);
  ell(ctx, 326, 452, 42, 17, p.light);
  // body
  shape(ctx, [[160, 320], [196, 250], [282, 228], [352, 258], [372, 338], [330, 412], [230, 424], [174, 386]], grad(ctx, 158, 232, 368, 420, [[0, p.light], [0.3, p.base], [1, p.base2]]));
  ell(ctx, 260, 338, 72, 58, p.light, 0);
  // cheek pouches
  ell(ctx, 202, 268, 30, 22, p.accent, 3);
  ell(ctx, 316, 268, 30, 22, p.accent, 3);
  // arms
  ell(ctx, 156, 340, 28, 52, grad(ctx, 136, 300, 176, 392, [[0, p.base], [1, p.base2]]), 5, -0.35);
  ell(ctx, 366, 336, 28, 52, grad(ctx, 346, 296, 386, 388, [[0, p.base], [1, p.base2]]), 5, 0.35);
  // head
  shape(ctx, [[182, 216], [202, 146], [268, 124], [336, 150], [356, 218], [320, 280], [252, 292], [202, 262]], grad(ctx, 190, 128, 342, 286, [[0, p.light], [0.3, p.base], [1, p.base2]]));
  rim(ctx, 264, 206, 74, 68, p.accent);
  // big ears
  shape(ctx, [[198, 154], [148, 24], [238, 104], [252, 158]], grad(ctx, 160, 40, 240, 158, [[0, p.base], [1, p.base2]]));
  shape(ctx, [[322, 150], [376, 20], [290, 102], [274, 154]], grad(ctx, 286, 40, 372, 156, [[0, p.base], [1, p.base2]]));
  shape(ctx, [[204, 140], [172, 52], [228, 112], [238, 148]], p.dark, 3);
  shape(ctx, [[318, 136], [352, 50], [296, 110], [286, 146]], p.dark, 3);
  // forehead bolt marking
  poly(ctx, [[266, 138], [242, 182], [260, 180], [250, 212], [284, 166], [266, 168], [278, 140]], p.accent, 3);
  // face mask
  shape(ctx, [[212, 208], [252, 190], [292, 204], [304, 250], [276, 278], [240, 278], [206, 248]], p.light, 4);
  eye(ctx, 234, 214, 22, 27, p.eye, { brow: true, tilt: 0.07 });
  eye(ctx, 294, 214, 22, 27, p.eye, { brow: true, tilt: -0.07 });
  mouth(ctx, 264, 252, 16, 'fang');
  ell(ctx, 264, 238, 8, 6, p.dark, 3);
  // spark crest
  for (const [sx, sy, s] of [[218, 150, 1], [264, 132, 1.25], [310, 150, 1]]) {
    poly(ctx, [[sx, sy - 26 * s], [sx + 10, sy - 4], [sx + 26, sy - 10], [sx + 12, sy + 12], [sx - 10, sy + 10]], p.accent, 3);
  }
  sparkleField(ctx, p, p.seed || 17, 20, [50, 60, 470, 410]);
  shinyFreckles(ctx, p, p.seed || 0);
}

function drawFluffbat(ctx, p) {
  backdrop(ctx, p, { r: 205 });
  // moon disc
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = radial(ctx, 372, 132, 10, 92, [[0, p.light], [1, 'rgba(0,0,0,0)']]);
  ctx.beginPath();
  ctx.arc(372, 132, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // huge wings
  const wing = (side) => {
    ctx.save();
    ctx.translate(256, 300);
    ctx.scale(side, 1);
    shape(ctx, [[40, -30], [128, -96], [214, -48], [206, 16], [176, -4], [166, 60], [130, 18], [112, 88], [82, 28], [52, 52]], grad(ctx, 60, -90, 220, 80, [[0, p.base], [0.6, p.base2], [1, p.dark]]), 5, p.dark);
    line(ctx, [[58, -8], [142, -52], [196, -20]], p.light, 3, 0.45);
    line(ctx, [[78, 22], [132, -6]], p.light, 2.5, 0.4);
    ctx.restore();
  };
  wing(-1); wing(1);
  // body
  shape(ctx, [[204, 300], [226, 228], [286, 206], [338, 238], [350, 322], [312, 396], [256, 414], [214, 376]], grad(ctx, 210, 220, 342, 400, [[0, p.base], [0.55, p.base], [1, p.base2]]));
  ell(ctx, 274, 320, 54, 64, p.light, 0);
  // fluffy collar
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    ell(ctx, 276 + Math.cos(a) * 60, 268 + Math.sin(a) * 24, 24, 18, p.light, 3, a);
  }
  // legs
  ell(ctx, 232, 414, 20, 30, p.dark, 3);
  ell(ctx, 308, 414, 20, 30, p.dark, 3);
  // head
  shape(ctx, [[202, 224], [218, 156], [276, 132], [338, 158], [354, 224], [318, 284], [252, 296], [212, 268]], grad(ctx, 210, 136, 342, 288, [[0, p.light], [0.32, p.base], [1, p.base2]]));
  rim(ctx, 276, 212, 72, 66, p.accent);
  // ears
  shape(ctx, [[216, 168], [190, 80], [250, 122], [260, 170]], grad(ctx, 196, 88, 254, 166, [[0, p.base], [1, p.base2]]));
  shape(ctx, [[334, 164], [362, 74], [302, 120], [292, 168]], grad(ctx, 298, 84, 358, 164, [[0, p.base], [1, p.base2]]));
  // face mask
  shape(ctx, [[224, 214], [256, 198], [294, 212], [308, 250], [282, 282], [248, 282], [216, 250]], p.light, 4);
  eye(ctx, 240, 220, 22, 27, p.eye, { brow: true, tilt: 0.06 });
  eye(ctx, 296, 220, 22, 27, p.eye, { brow: true, tilt: -0.06 });
  // fangs
  mouth(ctx, 268, 254, 14, 'fang');
  ell(ctx, 268, 240, 8, 6, p.dark, 3);
  // inner-ear glow
  line(ctx, [[214, 156], [202, 112], [242, 138]], p.accent, 3, 0.8);
  line(ctx, [[338, 152], [350, 108], [310, 134]], p.accent, 3, 0.8);
  // chest moon mark
  ctx.save(); ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(276, 344, 22, 0, Math.PI * 2);
  ctx.fillStyle = p.accent;
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(286, 336, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // tuft
  shape(ctx, [[268, 136], [256, 106], [284, 92], [296, 118], [286, 140]], p.light, 3);
  sparkleField(ctx, p, p.seed || 19, 18, [50, 60, 470, 400]);
  shinyFreckles(ctx, p, p.seed || 0);
}

function drawLunari(ctx, p) {
  backdrop(ctx, p, { r: 215, cy: 280 });
  // night halo + constellation
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(256, 208, 174, 52, -0.06, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    star(ctx, 256 + Math.cos(a) * 178, 208 + Math.sin(a) * 54, 3 + (i % 3), p.light, 4, 0.8);
  }
  // long crescent tail
  shape(ctx, [[306, 350], [386, 326], [452, 274], [458, 214], [480, 268], [462, 344], [400, 396], [330, 392]], grad(ctx, 340, 230, 460, 390, [[0, p.base], [0.6, p.accent], [1, p.base2]]), 5, p.dark);
  glow(ctx, 432, 300, 72, p.aura, 0.34);
  // crescent horns
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(256 + side * 54, 152);
    ctx.rotate(side * 0.34);
    ctx.beginPath();
    ctx.arc(0, 0, 46, Math.PI * 0.15, Math.PI * 1.55);
    ctx.strokeStyle = p.light;
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }
  // legs
  ell(ctx, 208, 416, 34, 58, grad(ctx, 174, 366, 242, 470, [[0, p.base], [1, p.dark]]));
  ell(ctx, 306, 416, 34, 58, grad(ctx, 274, 366, 342, 470, [[0, p.base], [1, p.dark]]));
  ell(ctx, 204, 462, 34, 14, p.light, 3);
  ell(ctx, 310, 462, 34, 14, p.light, 3);
  // sleek body
  shape(ctx, [[192, 330], [214, 258], [272, 232], [330, 252], [352, 320], [332, 400], [266, 430], [210, 400]], grad(ctx, 200, 240, 344, 424, [[0, p.light], [0.25, p.base], [1, p.base2]]));
  ell(ctx, 268, 330, 56, 62, p.light, 0);
  // starfield inside the body
  const rand = mulberry32((p.seed || 33) ^ 0x51ed270b);
  for (let i = 0; i < 12; i++) {
    star(ctx, 214 + rand() * 116, 270 + rand() * 120, 1.5 + rand() * 2.6, i % 2 ? p.accent : p.light, 4, 0.85);
  }
  // chest crescent
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.arc(268, 336, 24, 0, Math.PI * 2);
  ctx.fillStyle = p.accent;
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(280, 328, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // head
  shape(ctx, [[194, 242], [212, 174], [272, 148], [334, 176], [352, 240], [318, 294], [256, 306], [206, 284]], grad(ctx, 206, 154, 342, 302, [[0, p.light], [0.28, p.base], [1, p.base2]]));
  rim(ctx, 268, 226, 72, 66, p.accent);
  // ears with glow
  shape(ctx, [[206, 190], [172, 106], [246, 144], [256, 190]], grad(ctx, 184, 112, 248, 188, [[0, p.base], [1, p.base2]]));
  shape(ctx, [[330, 186], [366, 102], [292, 142], [282, 188]], grad(ctx, 290, 110, 360, 186, [[0, p.base], [1, p.base2]]));
  shape(ctx, [[212, 174], [190, 124], [234, 150], [242, 184]], p.accent, 3);
  shape(ctx, [[324, 172], [348, 120], [304, 148], [296, 182]], p.accent, 3);
  // face mask
  shape(ctx, [[218, 228], [256, 212], [300, 228], [312, 266], [284, 296], [248, 296], [212, 264]], p.light, 4);
  // luminous eyes
  eye(ctx, 238, 236, 22, 28, p.eye, { brow: true, tilt: 0.06 });
  eye(ctx, 300, 236, 22, 28, p.eye, { brow: true, tilt: -0.06 });
  glow(ctx, 238, 236, 26, p.aura, 0.32);
  glow(ctx, 300, 236, 26, p.aura, 0.32);
  mouth(ctx, 270, 272, 13, 'smile');
  ell(ctx, 270, 256, 7, 5, p.dark, 3);
  // forehead diamond
  poly(ctx, [[268, 174], [280, 192], [268, 210], [256, 192]], p.accent, 3);
  // floating star wisps
  for (const [x, y, r] of [[170, 220, 6], [360, 250, 5], [398, 190, 4], [142, 300, 4], [216, 128, 4]]) {
    star(ctx, x, y, r, p.light, 4, 0.9);
    glow(ctx, x, y, r * 2.2, p.aura, 0.35);
  }
  sparkleField(ctx, p, p.seed || 21, 22, [40, 50, 480, 420]);
  shinyFreckles(ctx, p, p.seed || 0);
}

function drawSolaris(ctx, p) {
  backdrop(ctx, p, { r: 225, cy: 270 });
  // radiant sun disc
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const len = 150 + (i % 3) * 46;
    ctx.globalAlpha = 0.16 + (i % 2) * 0.08;
    ctx.fillStyle = i % 2 ? p.accent : p.light;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(a - 0.035) * 120, 250 + Math.sin(a - 0.035) * 120);
    ctx.lineTo(256 + Math.cos(a) * len, 250 + Math.sin(a) * len);
    ctx.lineTo(256 + Math.cos(a + 0.035) * 120, 250 + Math.sin(a + 0.035) * 120);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  glow(ctx, 256, 250, 160, p.aura, 0.34);
  // enormous wings
  const wing = (side) => {
    ctx.save();
    ctx.translate(256, 296);
    ctx.scale(side, 1);
    shape(ctx, [[28, -8], [110, -114], [196, -146], [230, -70], [210, -18], [176, -58], [170, 34], [142, -12], [128, 78], [100, 18], [70, 62]], grad(ctx, 70, -130, 230, 70, [[0, '#fffbe0'], [0.35, p.light], [0.7, p.accent], [1, p.base2]]), 5, '#63351c');
    line(ctx, [[52, 4], [142, -74], [212, -50]], '#fffdf0', 3, 0.55);
    line(ctx, [[86, 30], [146, -16]], '#fffdf0', 2.5, 0.45);
    ctx.restore();
  };
  wing(-1); wing(1);
  // tail feathers
  for (let i = 0; i < 5; i++) {
    const a = 0.5 + i * 0.2;
    poly(ctx, [[256, 372], [256 + Math.cos(a) * 132, 372 + Math.sin(a) * 112], [256 + Math.cos(a + 0.08) * 172, 372 + Math.sin(a + 0.08) * 146], [270 + Math.cos(a) * 72, 390 + Math.sin(a) * 82]], i % 2 ? p.accent : p.light, 4, '#63351c');
  }
  // legs
  line(ctx, [[232, 404], [220, 458]], p.metal, 8);
  line(ctx, [[290, 404], [302, 458]], p.metal, 8);
  for (const [x, y, s] of [[216, 462, 1], [306, 462, 1]]) {
    line(ctx, [[x - 14 * s, y], [x + 16 * s, y]], p.metal, 6);
    line(ctx, [[x - 10 * s, y + 6], [x + 12 * s, y + 6]], p.metal, 5);
  }
  // body
  shape(ctx, [[218, 316], [232, 250], [286, 226], [336, 252], [350, 322], [318, 398], [268, 416], [230, 384]], grad(ctx, 220, 236, 344, 408, [[0, '#fffbe2'], [0.35, p.light], [0.72, p.base], [1, p.base2]]));
  ell(ctx, 282, 328, 54, 62, '#fff8d8', 0);
  // chest feather flames
  for (let i = 0; i < 4; i++) {
    const y = 362 + i * 14;
    line(ctx, [[256, y], [282, y + 6], [306, y]], i % 2 ? p.accent : p.base2, 3, 0.7);
  }
  // head
  shape(ctx, [[226, 246], [236, 184], [286, 158], [338, 184], [348, 242], [318, 286], [272, 300], [238, 280]], grad(ctx, 240, 162, 344, 292, [[0, '#fffdf0'], [0.4, p.light], [1, p.base]]));
  rim(ctx, 286, 230, 64, 60, '#fffdf0');
  // crest feathers
  for (let i = 0; i < 3; i++) {
    poly(ctx, [[264 + i * 16, 170], [248 + i * 22, 90 - (i === 1 ? 20 : 0)], [282 + i * 18, 160]], i === 1 ? '#fffdf0' : p.accent, 4, '#63351c');
  }
  // face
  shape(ctx, [[242, 222], [276, 208], [314, 222], [322, 252], [296, 276], [266, 276], [236, 254]], '#fffdf0', 4);
  eye(ctx, 260, 232, 19, 24, p.eye, { brow: true, tilt: 0.05 });
  eye(ctx, 306, 232, 19, 24, p.eye, { brow: true, tilt: -0.05 });
  poly(ctx, [[274, 250], [300, 250], [287, 272]], '#e88f2f', 4, '#63351c');
  // solar sigil on forehead
  star(ctx, 286, 194, 12, p.accent, 6, 0.95);
  glow(ctx, 286, 194, 22, p.aura, 0.4);
  // golden halo
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.ellipse(286, 150, 84, 22, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  sparkleField(ctx, p, p.seed || 23, 26, [40, 40, 480, 420]);
  shinyFreckles(ctx, p, p.seed || 0);
}

function drawElderwood(ctx, p) {
  backdrop(ctx, p, { r: 235, cy: 268 });
  // sacred grove rings
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.1 + i * 0.05;
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(256, 444 - i * 36, 210 - i * 34, 32 - i * 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // massive antlers
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(256 + side * 40, 160);
    ctx.scale(side, 1);
    line(ctx, [[0, 0], [46, -74], [92, -110]], p.metal, 13);
    line(ctx, [[30, -46], [92, -54]], p.metal, 9);
    line(ctx, [[62, -82], [118, -140]], p.metal, 8);
    line(ctx, [[16, -22], [44, -128]], p.metal, 8);
    line(ctx, [[92, -110], [116, -158]], p.metal, 6);
    for (const [lx, ly] of [[46, -74], [92, -110], [30, -46], [118, -140], [116, -158]]) {
      star(ctx, lx, ly, 6, p.accent, 4, 0.9);
      glow(ctx, lx, ly, 12, p.aura, 0.4);
    }
    ctx.restore();
  }
  // hovering spirit orbs
  for (const [x, y, r] of [[108, 244, 9], [404, 218, 11], [390, 322, 7], [124, 348, 6], [176, 150, 5], [352, 142, 5]]) {
    glow(ctx, x, y, r * 3.4, p.aura, 0.3);
    ell(ctx, x, y, r, r, p.light, 2, 0, p.accent);
  }
  // legs
  for (const x of [198, 314]) {
    shape(ctx, [[x - 26, 362], [x - 32, 446], [x - 6, 458], [x + 12, 446], [x + 20, 362]], grad(ctx, x - 30, 360, x + 20, 458, [[0, p.base2], [1, p.dark]]));
    ell(ctx, x - 10, 458, 30, 12, p.metal, 3);
  }
  // body
  shape(ctx, [[176, 322], [200, 232], [264, 202], [334, 230], [362, 318], [344, 392], [286, 422], [214, 404]], grad(ctx, 188, 220, 354, 416, [[0, p.light], [0.3, p.base], [1, p.base2]]));
  // chest bark plates
  for (let i = 0; i < 4; i++) {
    const y = 300 + i * 26;
    line(ctx, [[220 - i * 2, y], [264, y + 10], [308 + i * 2, y]], p.dark, 4, 0.55);
  }
  ell(ctx, 266, 306, 52, 58, p.light, 0);
  // glowing heartseed
  ell(ctx, 266, 348, 18, 22, p.accent, 3);
  glow(ctx, 266, 348, 40, p.aura, 0.55);
  // moss mantle
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ell(ctx, 266 + Math.cos(a) * 72, 260 + Math.sin(a) * 28, 20, 14, p.base2, 3, a);
  }
  // neck + head
  shape(ctx, [[242, 236], [244, 192], [260, 164], [300, 168], [312, 210], [300, 252], [268, 262], [246, 252]], grad(ctx, 246, 170, 312, 258, [[0, p.light], [0.5, p.base], [1, p.base2]]));
  shape(ctx, [[232, 190], [222, 142], [264, 158], [286, 136], [312, 156], [352, 136], [338, 188], [302, 206], [262, 204]], grad(ctx, 230, 140, 346, 204, [[0, p.light], [0.45, p.base], [1, p.base2]]));
  // face
  shape(ctx, [[252, 198], [284, 188], [322, 198], [332, 226], [306, 250], [270, 250], [246, 226]], p.light, 4);
  eye(ctx, 276, 212, 15, 19, p.eye, { brow: true, tilt: 0.04 });
  eye(ctx, 316, 212, 15, 19, p.eye, { brow: true, tilt: -0.04 });
  glow(ctx, 276, 212, 20, p.aura, 0.35);
  glow(ctx, 316, 212, 20, p.aura, 0.35);
  mouth(ctx, 296, 236, 13, 'smile');
  ell(ctx, 296, 228, 6, 5, p.dark, 3);
  // leaf mane
  for (let i = 0; i < 7; i++) {
    const a = -0.4 + i * 0.22;
    poly(ctx, [[268 + Math.cos(a) * 34, 174 + Math.sin(a) * 24], [268 + Math.cos(a) * 66, 150 + Math.sin(a) * 44], [286 + Math.cos(a) * 46, 188 + Math.sin(a) * 30]], i % 2 ? p.accent : p.base2, 3);
  }
  // runes on the flanks
  for (const [x, y] of [[204, 312], [330, 306], [216, 370], [322, 366]]) {
    star(ctx, x, y, 6, p.accent, 4, 0.85);
  }
  sparkleField(ctx, p, p.seed || 25, 28, [40, 60, 480, 430]);
  shinyFreckles(ctx, p, p.seed || 0);
}

const DRAW = {
  spriglet: drawSpriglet,
  emberpup: drawEmberpup,
  dropplet: drawDropplet,
  mossling: drawMossling,
  pebblit: drawPebblit,
  zapmouse: drawZapmouse,
  fluffbat: drawFluffbat,
  lunari: drawLunari,
  solaris: drawSolaris,
  elderwood: drawElderwood,
};

// ---------------------------------------------------------------------------
// Evolved forms — the same soul, grown into its legend
// ---------------------------------------------------------------------------

function crownBranches(ctx, p, y = 128) {
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(256 + side * 42, y);
    ctx.scale(side, 1);
    line(ctx, [[0, 8], [28, -46], [66, -74]], p.metal, 9);
    line(ctx, [[22, -26], [62, -30]], p.metal, 6);
    line(ctx, [[50, -58], [84, -94]], p.metal, 5);
    for (const [x, yy] of [[28, -46], [66, -74], [84, -94]]) star(ctx, x, yy, 4.5, p.accent, 4, 0.95);
    ctx.restore();
  }
  glow(ctx, 256, y, 90, p.aura, 0.25);
}

function drawEvolutionOverlay(ctx, p, id) {
  ctx.save();
  if (id === 'sylvanox') {
    crownBranches(ctx, p, 118);
    // second and third tails
    shape(ctx, [[330, 352], [426, 330], [476, 268], [458, 342], [404, 386], [344, 384]], grad(ctx, 350, 280, 470, 386, [[0, p.base], [0.6, p.accent], [1, p.base2]]), 4, p.dark);
    shape(ctx, [[318, 370], [388, 394], [438, 440], [374, 420], [320, 402]], grad(ctx, 340, 370, 440, 440, [[0, p.base2], [1, p.dark]]), 4, p.dark);
    glow(ctx, 430, 330, 60, p.aura, 0.25);
    for (let i = 0; i < 10; i++) {
      const a = i * 2.1;
      star(ctx, 200 + Math.cos(a) * 118, 260 + Math.sin(a) * 132, 2 + (i % 3), p.accent, 4, 0.7);
    }
  } else if (id === 'pyrohound') {
    // flame mane
    for (let i = 0; i < 11; i++) {
      const a = -0.35 + i * 0.3;
      const x = 256 + Math.cos(a) * 92;
      const y = 230 + Math.sin(a) * 54;
      poly(ctx, [[x - 16, y + 16], [x + Math.cos(a) * 70, y - 48 - (i % 3) * 16], [x + 18, y + 10]], i % 2 ? p.accent : p.light, 3, p.dark);
    }
    // horns
    for (const side of [-1, 1]) {
      poly(ctx, [[256 + side * 76, 150], [256 + side * 120, 94], [256 + side * 96, 170]], p.metal, 5, p.dark);
      star(ctx, 256 + side * 120, 94, 5, p.accent, 4, 0.95);
    }
    glow(ctx, 256, 224, 140, p.aura, 0.3);
    for (let i = 0; i < 8; i++) {
      star(ctx, 150 + i * 30, 150 + (i % 3) * 42, 2 + (i % 2), p.accent, 4, 0.75);
    }
  } else if (id === 'tidalyn') {
    // coral crown
    for (let i = 0; i < 6; i++) {
      const x = 190 + i * 27;
      line(ctx, [[x, 128], [x - 8 + (i % 2) * 14, 76 - (i % 3) * 16]], p.accent, 6);
      ell(ctx, x - 8 + (i % 2) * 14, 72 - (i % 3) * 16, 7, 7, p.light, 3);
    }
    // tide ring
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(256, 416, 186, 38, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    for (const [x, y] of [[98, 300], [416, 336], [380, 210], [132, 196]]) {
      ell(ctx, x, y, 10, 10, 'rgba(210,255,255,0.3)', 3, 0, p.accent);
      ell(ctx, x - 3, y - 3, 3, 2, '#ffffff', 0);
    }
    glow(ctx, 256, 280, 130, p.aura, 0.2);
  } else if (id === 'mosswarden') {
    // giant spotted cap
    shape(ctx, [[132, 196], [160, 108], [256, 62], [352, 108], [380, 196], [336, 218], [256, 206], [176, 220]], grad(ctx, 150, 70, 360, 218, [[0, p.base2], [0.5, p.base], [1, p.dark]]), 5, p.dark);
    for (const [x, y, r] of [[196, 142, 20], [264, 112, 26], [324, 152, 16], [220, 188, 11], [300, 190, 12]]) {
      ell(ctx, x, y, r, r * 0.7, p.light, 3);
    }
    // extra mushrooms
    for (const [x, y, r] of [[128, 262, 24], [392, 282, 20], [368, 352, 15]]) {
      ell(ctx, x, y - r * 0.35, r, r * 0.6, grad(ctx, x - r, y - r, x + r, y, [[0, p.accent], [1, p.base2]]), 4);
      ell(ctx, x, y + r * 0.1, r * 0.2, r * 0.5, p.light, 3);
    }
    for (let i = 0; i < 14; i++) {
      const a = i * 1.7;
      star(ctx, 256 + Math.cos(a) * (120 + (i % 4) * 14), 250 + Math.sin(a) * (100 + (i % 3) * 20), 1.5 + (i % 3), p.accent, 4, 0.65);
    }
  } else if (id === 'cragwarden') {
    // crystal crown & shoulder plates
    for (const [x, y, w, h, rot] of [[256, 96, 34, 92, 0], [204, 122, 24, 62, -0.3], [310, 118, 26, 70, 0.3]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      poly(ctx, [[0, -h / 2], [w / 2, -h * 0.1], [w * 0.3, h / 2], [-w * 0.3, h / 2], [-w / 2, -h * 0.1]], grad(ctx, -w, -h, w, h, [[0, p.light], [0.5, p.accent], [1, p.base2]]), 4, p.dark);
      ctx.restore();
    }
    for (const side of [-1, 1]) {
      shape(ctx, [[256 + side * 78, 300], [256 + side * 116, 322], [256 + side * 116, 378], [256 + side * 78, 386]], p.base2, 4);
      star(ctx, 256 + side * 98, 344, 8, p.accent, 4, 0.9);
    }
    line(ctx, [[176, 278], [204, 312], [188, 358]], p.accent, 4, 0.85);
    line(ctx, [[336, 274], [312, 314], [330, 360]], p.accent, 4, 0.85);
    glow(ctx, 256, 240, 150, p.aura, 0.2);
  } else if (id === 'voltrix') {
    // electric halo
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse(256, 112, 118, 26, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      poly(ctx, [[256 + Math.cos(a) * 120, 112 + Math.sin(a) * 26], [256 + Math.cos(a) * 150, 112 + Math.sin(a) * 46], [256 + Math.cos(a + 0.1) * 126, 112 + Math.sin(a + 0.1) * 30]], p.accent, 2);
    }
    // forked tail
    poly(ctx, [[330, 320], [402, 286], [374, 258], [446, 208], [406, 236], [424, 178], [352, 262], [382, 280], [324, 310]], grad(ctx, 340, 190, 440, 320, [[0, '#fffef0'], [0.4, p.accent], [1, p.base2]]), 4, p.dark);
    // lightning marks
    poly(ctx, [[218, 300], [196, 344], [214, 342], [204, 382], [238, 330], [220, 332], [234, 300]], p.light, 3);
    poly(ctx, [[310, 300], [330, 338], [314, 338], [326, 378], [292, 330], [308, 330], [298, 300]], p.light, 3);
    glow(ctx, 256, 250, 150, p.aura, 0.28);
  } else if (id === 'nocturne') {
    // crescent wings halo
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.55;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(256, 240, 190, side > 0 ? -0.6 : Math.PI - 0.9, side > 0 ? 0.9 : Math.PI + 0.6);
      ctx.stroke();
    }
    ctx.restore();
    // star veil
    const rand = mulberry32((p.seed || 77) ^ 0x2545f491);
    for (let i = 0; i < 22; i++) {
      const x = 84 + rand() * 344;
      const y = 100 + rand() * 340;
      star(ctx, x, y, 1.5 + rand() * 3.4, i % 3 ? p.accent : p.light, 4, 0.55 + rand() * 0.4);
    }
    // crescent crown
    ctx.save();
    ctx.translate(256, 120);
    ctx.beginPath();
    ctx.arc(0, 0, 44, Math.PI * 0.2, Math.PI * 1.7);
    ctx.strokeStyle = p.light;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
    glow(ctx, 256, 250, 160, p.aura, 0.25);
  }
  ctx.restore();
}

const EVOLVED_ART = {
  mosswarden: 'mossling',
  voltrix: 'zapmouse',
  cragwarden: 'pebblit',
  tidalyn: 'dropplet',
  sylvanox: 'spriglet',
  pyrohound: 'emberpup',
  nocturne: 'fluffbat',
};

for (const [evolved, base] of Object.entries(EVOLVED_ART)) {
  const baseDraw = DRAW[base];
  DRAW[evolved] = (ctx, p) => {
    baseDraw(ctx, p);
    drawEvolutionOverlay(ctx, p, evolved);
  };
}


// ---------------------------------------------------------------------------
// People — the player and the story NPCs
// ---------------------------------------------------------------------------

const NPC_LOOKS = {
  player: {
    skin: '#f0c49c', hair: '#4a3428', coat: '#5ab1a6', coat2: '#2f7c74', trim: '#f2f3ee',
    scarf: '#f1c84b', pack: '#e8b455', hat: '#e2675b', boot: '#3e4a66', accent: '#ffe9a3',
    style: 'cap', prop: 'lantern',
  },
  nima: {
    skin: '#c98f68', hair: '#e7e1d4', coat: '#6b6bb4', coat2: '#403f7c', trim: '#f2ecd9',
    scarf: '#d9b84e', pack: '#8b6a45', hat: '#4b4a86', boot: '#3a3550', accent: '#c9c6ff',
    style: 'hood', prop: 'book', elder: true,
  },
  lys: {
    skin: '#e2b08a', hair: '#2f4a63', coat: '#3f9fc4', coat2: '#256a8c', trim: '#e9f7fa',
    scarf: '#9fe4d4', pack: '#c58a4f', hat: '#2f7f9e', boot: '#38505e', accent: '#b9f2ff',
    style: 'bandana', prop: 'rod',
  },
  tilo: {
    skin: '#8a5a3c', hair: '#2b1d18', coat: '#7fb45a', coat2: '#4c7c38', trim: '#f1edcf',
    scarf: '#e9c95d', pack: '#a9753f', hat: '#5d8d42', boot: '#4a3a2a', accent: '#d8ff8a',
    style: 'straw', prop: 'basket',
  },
  orin: {
    skin: '#b98f70', hair: '#cfc8b8', coat: '#8a8f9c', coat2: '#565b6a', trim: '#e8e3d2',
    scarf: '#7fc9a8', pack: '#6b5a48', hat: '#6f7482', boot: '#3e3a36', accent: '#c8ffd9',
    style: 'hood', prop: 'staff', elder: true,
  },
  mica: {
    skin: '#e6b489', hair: '#a4442f', coat: '#d68048', coat2: '#9a4f28', trim: '#f7e9cf',
    scarf: '#f0d05c', pack: '#6f4d32', hat: '#b85e30', boot: '#463326', accent: '#ffd27a',
    style: 'cap', prop: 'satchel',
  },
  sol: {
    skin: '#8f6044', hair: '#161616', coat: '#4d7f5a', coat2: '#30523c', trim: '#e9e2c8',
    scarf: '#d7a93f', pack: '#7a5b3b', hat: '#3d6649', boot: '#332d24', accent: '#ffe08a',
    style: 'bandana', prop: 'staff',
  },
  mara: {
    skin: '#d9a77f', hair: '#7d4a2a', coat: '#69a94b', coat2: '#3f7430', trim: '#f0f6d8',
    scarf: '#f5d76e', pack: '#7f6a3f', hat: '#4f8538', boot: '#3a4a2a', accent: '#d9ff8f',
    style: 'straw', prop: 'staff',
  },
  sable: {
    skin: '#9a6a50', hair: '#162c3a', coat: '#3c94b8', coat2: '#1f6282', trim: '#e4f8ff',
    scarf: '#a8f0e4', pack: '#4f6a78', hat: '#286b88', boot: '#263e4a', accent: '#a9f5ff',
    style: 'bandana', prop: 'rod',
  },
  kael: {
    skin: '#c98f6a', hair: '#5a1e16', coat: '#d06438', coat2: '#8e3820', trim: '#ffe6c4',
    scarf: '#f7c95a', pack: '#6e3f28', hat: '#a94a28', boot: '#42251a', accent: '#ffcf6a',
    style: 'cap', prop: 'staff',
  },
  brann: {
    skin: '#b98662', hair: '#8a8074', coat: '#7d7a70', coat2: '#4c4b45', trim: '#e2d9c4',
    scarf: '#c9b26a', pack: '#756245', hat: '#5c5950', boot: '#3a3730', accent: '#d9ffb0',
    style: 'hood', prop: 'staff', elder: true,
  },
  keeper: {
    skin: '#d6a17a', hair: '#2f2a3f', coat: '#b8913e', coat2: '#7a5a1f', trim: '#fff2c8',
    scarf: '#8fd0c0', pack: '#8a6a35', hat: '#9a7626', boot: '#4a3a24', accent: '#ffe28a',
    style: 'cap', prop: 'book', elder: true,
  },
};

function drawPerson(ctx, look) {
  const L = look;
  const coatGrad = grad(ctx, 170, 240, 350, 460, [[0, L.coat], [0.6, L.coat], [1, L.coat2]]);
  // backdrop glow
  glow(ctx, 256, 300, 168, L.accent, 0.16);
  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = radial(ctx, 256, 468, 6, 140, [[0, 'rgba(10,20,18,0.7)'], [1, 'rgba(10,20,18,0)']]);
  ctx.beginPath();
  ctx.ellipse(256, 468, 140, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // legs + boots
  for (const side of [-1, 1]) {
    shape(ctx, [[248 + side * 32, 396], [240 + side * 32, 448], [270 + side * 32, 448], [274 + side * 32, 396]], L.boot, 5);
    ell(ctx, 254 + side * 34, 450, 24, 12, shift(L.boot, 0, 0.8, 0.08), 4);
  }
  // backpack behind
  shape(ctx, [[164, 276], [150, 330], [168, 392], [206, 398], [208, 288]], L.pack, 5);
  shape(ctx, [[170, 288], [160, 332], [174, 374], [196, 378], [198, 296]], shift(L.pack, 0, 0.9, 0.12), 3);
  line(ctx, [[174, 300], [188, 300]], shift(L.pack, 0, 0.7, -0.2), 3);
  // torso / coat
  shape(ctx, [[198, 286], [218, 252], [294, 246], [322, 280], [330, 374], [304, 412], [212, 412], [184, 374]], coatGrad);
  // coat opening
  shape(ctx, [[250, 260], [268, 260], [276, 404], [244, 404]], L.trim, 3);
  line(ctx, [[262, 276], [262, 396]], shift(L.trim, 0, 0.8, -0.15), 2.5, 0.6);
  // belt
  poly(ctx, [[194, 344], [326, 340], [328, 366], [196, 370]], shift(L.boot, 0, 0.9, 0.08), 4);
  ell(ctx, 262, 356, 13, 11, L.scarf, 3);
  // arms
  shape(ctx, [[190, 286], [168, 322], [162, 388], [186, 396], [200, 332], [210, 292]], L.coat, 5);
  shape(ctx, [[318, 282], [344, 316], [352, 384], [330, 394], [314, 330], [306, 288]], L.coat, 5);
  ell(ctx, 176, 396, 18, 20, L.skin, 4);
  ell(ctx, 340, 392, 18, 20, L.skin, 4);
  // scarf
  shape(ctx, [[202, 266], [222, 250], [294, 248], [316, 268], [300, 288], [220, 290]], L.scarf, 5);
  shape(ctx, [[296, 272], [342, 300], [352, 338], [330, 334], [304, 300]], L.scarf, 4);
  line(ctx, [[228, 264], [286, 262]], shift(L.scarf, 0, 0.9, -0.12), 3, 0.7);
  // neck + head
  ell(ctx, 258, 242, 34, 26, shift(L.skin, 0, 1, -0.08), 4);
  shape(ctx, [[206, 208], [214, 152], [258, 128], [306, 146], [318, 202], [298, 246], [258, 258], [218, 244]], look.elder ? shift(L.skin, 0, 0.82, -0.04) : L.skin, 5);
  // ears
  ell(ctx, 206, 196, 10, 16, shift(L.skin, 0, 0.95, -0.05), 3);
  ell(ctx, 312, 196, 10, 16, shift(L.skin, 0, 0.95, -0.05), 3);
  // hair / hat
  if (L.style === 'straw') {
    shape(ctx, [[180, 176], [198, 132], [318, 132], [336, 176], [318, 190], [198, 190]], grad(ctx, 200, 132, 318, 190, [[0, '#f2d98a'], [1, '#c99f4f']]), 5);
    shape(ctx, [[212, 136], [224, 100], [292, 100], [306, 136]], '#e8ca77', 5);
    line(ctx, [[222, 130], [300, 130]], '#a97d3a', 5);
  } else if (L.style === 'hood') {
    shape(ctx, [[196, 208], [204, 142], [258, 112], [314, 140], [322, 208], [296, 170], [258, 184], [220, 170]], L.hat, 5);
    shape(ctx, [[218, 186], [236, 148], [280, 148], [298, 186]], shift(L.hat, 0, 0.8, 0.1), 4);
    shape(ctx, [[214, 164], [204, 210], [220, 246], [232, 200]], L.hat, 4);
    shape(ctx, [[306, 164], [316, 210], [300, 246], [288, 200]], L.hat, 4);
  } else if (L.style === 'bandana') {
    shape(ctx, [[200, 194], [212, 146], [258, 126], [308, 148], [320, 194], [296, 170], [256, 180], [220, 172]], L.hair, 5);
    poly(ctx, [[196, 176], [320, 176], [314, 198], [202, 198]], L.scarf, 4);
    shape(ctx, [[312, 186], [348, 200], [340, 224], [308, 206]], L.scarf, 3);
  } else {
    shape(ctx, [[200, 194], [210, 144], [258, 122], [308, 144], [318, 194], [296, 166], [256, 176], [220, 168]], L.hair, 5);
    if (L.elder) {
      shape(ctx, [[228, 170], [252, 148], [282, 148], [302, 172], [286, 158], [258, 190], [234, 160]], shift(L.hair, 0, 0.7, 0.18), 3);
      line(ctx, [[254, 244], [258, 268], [272, 276]], shift(L.skin, 0, 0.8, -0.25), 3, 0.7);
    }
    // cap
    shape(ctx, [[196, 150], [212, 118], [296, 112], [318, 148], [304, 164], [212, 168]], L.hat, 5);
    shape(ctx, [[202, 154], [314, 154], [330, 168], [194, 172]], shift(L.hat, 0, 0.9, -0.08), 4);
    ell(ctx, 258, 134, 10, 8, L.accent, 3);
  }
  // face
  eye(ctx, 238, 202, 13, 16, '#5a3d2e', { tilt: 0.05 });
  eye(ctx, 284, 202, 13, 16, '#5a3d2e', { tilt: -0.05 });
  line(ctx, [[224, 186], [246, 182]], INK, 3.5);
  line(ctx, [[276, 182], [298, 186]], INK, 3.5);
  mouth(ctx, 261, 228, 13, L.elder ? 'smile' : 'smile');
  ell(ctx, 222, 220, 10, 6, 'rgba(230,130,120,0.28)', 0);
  ell(ctx, 300, 220, 10, 6, 'rgba(230,130,120,0.28)', 0);
  // prop in the free hand
  ctx.save();
  if (L.prop === 'lantern') {
    line(ctx, [[340, 390], [340, 348]], L.metal || '#8a7a5f', 5);
    shape(ctx, [[318, 348], [362, 348], [358, 390], [322, 390]], '#2f3a44', 4);
    ell(ctx, 340, 368, 12, 14, '#ffe9a3', 2);
    glow(ctx, 340, 368, 34, '#ffd77a', 0.55);
  } else if (L.prop === 'book') {
    poly(ctx, [[310, 338], [356, 326], [362, 378], [316, 390]], '#f2ead2', 4);
    poly(ctx, [[316, 344], [352, 336], [356, 374], [320, 382]], '#e7d8b2', 2);
    line(ctx, [[330, 344], [330, 378]], '#a68d5f', 2);
    ell(ctx, 326, 346, 5, 5, L.accent, 2);
  } else if (L.prop === 'rod') {
    line(ctx, [[336, 392], [386, 220]], '#a97a45', 5);
    line(ctx, [[386, 220], [420, 260]], '#e8e3cf', 2);
    ell(ctx, 420, 262, 6, 8, '#e8e3cf', 2);
  } else if (L.prop === 'basket') {
    shape(ctx, [[314, 362], [366, 356], [356, 402], [320, 406]], '#b9874f', 4);
    for (let i = 0; i < 3; i++) line(ctx, [[318, 370 + i * 10], [360, 366 + i * 10]], '#8a6236', 2.5);
    ell(ctx, 342, 350, 22, 6, '#8a6236', 3);
    ell(ctx, 332, 350, 9, 8, '#8fc95c', 3);
    ell(ctx, 352, 348, 8, 9, '#d8ff8a', 3);
  } else if (L.prop === 'staff') {
    line(ctx, [[344, 402], [344, 250]], '#8a6b47', 6);
    ctx.beginPath();
    ctx.arc(344, 238, 20, Math.PI * 0.3, Math.PI * 1.75);
    ctx.strokeStyle = '#8a6b47';
    ctx.lineWidth = 6;
    ctx.stroke();
    star(ctx, 344, 232, 10, L.accent, 4, 0.95);
    glow(ctx, 344, 232, 32, L.accent, 0.4);
  } else if (L.prop === 'satchel') {
    shape(ctx, [[312, 330], [352, 330], [356, 382], [316, 386]], '#8a5a35', 4);
    line(ctx, [[318, 334], [350, 332]], '#e8c86a', 3);
    ell(ctx, 336, 348, 7, 7, '#e8c86a', 2);
  }
  ctx.restore();
  // dust motes
  const rand = mulberry32((L.skin.length * 97 + L.coat.length * 13) | 1);
  for (let i = 0; i < 9; i++) {
    star(ctx, 120 + rand() * 290, 140 + rand() * 300, 1.5 + rand() * 2.6, L.accent, 4, 0.3 + rand() * 0.4);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function renderCreature(speciesId, appearance) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  const p = paletteFor(speciesId, appearance);
  (DRAW[speciesId] || DRAW.spriglet)(ctx, p);
  return canvas;
}

function cacheKey(speciesId, appearance) {
  return `${speciesId}:${appearance?.shiny ? appearance.seed : 'base'}`;
}

export function creatureCanvas(speciesId, appearance = null) {
  const key = cacheKey(speciesId, appearance);
  if (!cache.has(key)) cache.set(key, renderCreature(speciesId, appearance));
  return cache.get(key);
}

const textures = new Map();

export function creatureTexture(speciesId, appearance = null) {
  const key = cacheKey(speciesId, appearance);
  if (!textures.has(key)) {
    const texture = new THREE.CanvasTexture(creatureCanvas(speciesId, appearance));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    textures.set(key, texture);
  }
  return textures.get(key);
}

export function creatureDataURL(speciesId, appearance = null) {
  return creatureCanvas(speciesId, appearance).toDataURL('image/png');
}

const peopleCache = new Map();

export function personCanvas(profile = 'player') {
  const key = typeof profile === 'string' ? profile : JSON.stringify(profile);
  if (!peopleCache.has(key)) {
    const look = typeof profile === 'string' ? NPC_LOOKS[profile] || NPC_LOOKS.player : { ...NPC_LOOKS.player, ...profile };
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    drawPerson(ctx, look);
    peopleCache.set(key, canvas);
  }
  return peopleCache.get(key);
}

export function personTexture(profile = 'player') {
  const canvas = personCanvas(profile);
  const key = `person:${typeof profile === 'string' ? profile : JSON.stringify(profile)}`;
  if (!textures.has(key)) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    textures.set(key, texture);
  }
  return textures.get(key);
}

export function personDataURL(profile = 'player') {
  return personCanvas(profile).toDataURL('image/png');
}

export const NPC_PROFILES = NPC_LOOKS;
export const ILLUSTRATION_SIZE = SIZE;

