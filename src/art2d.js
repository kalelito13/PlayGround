import * as THREE from '../vendor/three.module.js';

// ---------------------------------------------------------------------------
// Lumen Isles — 2D illustration engine (procedural)
// ---------------------------------------------------------------------------
// Cada criatura se pinta sobre canvas combinando partes anatómicas (cabeza,
// cuerpo, patas, cola, alas, cuernos, orejas, escamas, pelo, plumas) con una
// paleta elemental y detalles de brillo/sombra. El resultado es un sprite
// billboard dentro del mundo 3D. Los brillos (shiny) reciben una paleta
// semilla única con estrellas, orbitadores y constelaciones, así que no hay
// dos iguales.
// ---------------------------------------------------------------------------

const SIZE = 512;
const INK = '#141923';
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
  return `hsl(${((h % 360) + 360) % 360}, ${Math.max(0, Math.min(1, s)) * 100}%, ${Math.max(0, Math.min(1, l)) * 100}%)`;
}

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
  if (fill !== undefined && fill !== null) { ctx.fillStyle = fill; ctx.fill(); }
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
  } else if (kind === 'snarl') {
    ctx.beginPath();
    ctx.moveTo(x - w, y + 2);
    ctx.quadraticCurveTo(x, y + w * 0.5, x + w, y + 2);
    ctx.stroke();
    poly(ctx, [[x - w * 0.4, y + 3], [x - w * 0.15, y + 3], [x - w * 0.28, y + w * 0.55]], '#fffdf4', 2);
    poly(ctx, [[x + w * 0.15, y + 3], [x + w * 0.4, y + 3], [x + w * 0.28, y + w * 0.55]], '#fffdf4', 2);
  } else {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y + w * 0.55, x + w, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Detail helpers — fur, scales, feathers, shading, eyes
// ---------------------------------------------------------------------------

function fur(ctx, pts, base, edge, count = 9) {
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

function shade(ctx, color, alpha = 0.35) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function highlight(ctx, color, alpha = 0.5) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function eyeDetailed(ctx, x, y, rx, ry, iris, opts = {}) {
  const tilt = opts.tilt || 0;
  const lid = opts.lid !== false;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ell(ctx, 0, ry * 0.06, rx, ry, '#fffdf2', 4);
  ctx.beginPath();
  ctx.ellipse(0, ry * 0.08, rx * 0.66, ry * 0.75, 0, 0, Math.PI * 2);
  ctx.fillStyle = radial(ctx, 0, ry * 0.1, 1, rx * 0.62, [[0, '#ffffff'], [0.32, iris], [0.82, shift(iris, 10, 1.15, -0.22)], [1, '#141923']]);
  ctx.fill();
  ell(ctx, 0, ry * 0.08, rx * 0.3, ry * 0.5, '#11131c', 0);
  ell(ctx, -rx * 0.18, -ry * 0.3, rx * 0.18, ry * 0.18, '#ffffff', 0);
  ell(ctx, rx * 0.28, -ry * 0.14, rx * 0.11, ry * 0.11, '#ffffff', 0);
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
  const r = opts.r ?? 200;
  glow(ctx, cx, cy, r * 0.85, p.aura, 0.22);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = radial(ctx, cx, cy, r * 0.2, r, [[0, p.accent], [1, 'rgba(0,0,0,0)']]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
    star(ctx, x, y, r, i % 3 === 0 ? (p.spark2 || p.light) : p.accent, 4, 0.35 + rand() * 0.55);
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
// Species palettes by element
// ---------------------------------------------------------------------------

const ELEMENTS = {
  leaf:   { base: '#62cf74', base2: '#2f9b55', dark: '#1c5b3a', light: '#dcffab', accent: '#ffe066', aura: '#72ff9b', eye: '#a8ffbf', metal: '#d8c07a' },
  ember:  { base: '#f07a3c', base2: '#bd3f28', dark: '#4a1d22', light: '#ffd28a', accent: '#ffc94a', aura: '#ff7a36', eye: '#ffd55e', metal: '#8c4a2e' },
  aqua:   { base: '#54c6e4', base2: '#2679b4', dark: '#143e62', light: '#d9fbff', accent: '#a9f7ff', aura: '#5fe0ff', eye: '#8bfff4', metal: '#cfe9ef' },
  spark:  { base: '#f5d34f', base2: '#d79a25', dark: '#4a3a1e', light: '#fff6b0', accent: '#fff06a', aura: '#ffe75a', eye: '#fff27a', metal: '#7b6641' },
  stone:  { base: '#9a958a', base2: '#5f6159', dark: '#2f3635', light: '#d7d1bd', accent: '#b7ff8a', aura: '#9dffb0', eye: '#c6ff9a', metal: '#8a7a5f' },
  normal: { base: '#a58ae8', base2: '#6a4db8', dark: '#2e2354', light: '#eadcff', accent: '#ff9ad5', aura: '#b48cff', eye: '#ffd0f2', metal: '#7d6aa8' },
  mythic: { base: '#5b60b8', base2: '#30356f', dark: '#171a3c', light: '#dbe6ff', accent: '#9ff0ff', aura: '#6ad6ff', eye: '#b5f5ff', metal: '#c8dcff' },
  divine: { base: '#f7cf63', base2: '#da8f2e', dark: '#63351c', light: '#fff3c4', accent: '#fff0a8', aura: '#ffcf5e', eye: '#fff09a', metal: '#d89b36' },
};

function paletteFor(speciesId, appearance) {
  const base = PALETTES[speciesId] || ELEMENTS.leaf;
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

const PALETTES = {};

// Build per-species palettes from element + rare shifts
function buildPalettes(speciesList) {
  for (const s of speciesList) {
    const e = ELEMENTS[s.element] || ELEMENTS.leaf;
    const p = { ...e };
    if (s.rarityShift) {
      const r = s.rarityShift;
      p.base = shift(p.base, r.dh || 0, r.ds || 1, r.dl || 0);
      p.base2 = shift(p.base2, r.dh || 0, r.ds || 1, r.dl || 0);
      p.dark = shift(p.dark, r.dh || 0, r.ds || 1, r.dl || 0);
      p.light = shift(p.light, r.dh || 0, r.ds || 1, r.dl || 0);
      p.accent = shift(p.accent, r.dh || 0, r.ds || 1, r.dl || 0);
      p.aura = shift(p.aura, r.dh || 0, r.ds || 1, r.dl || 0);
      p.eye = shift(p.eye, r.dh || 0, r.ds || 1, r.dl || 0);
      p.metal = shift(p.metal, r.dh || 0, r.ds || 1, r.dl || 0);
    }
    PALETTES[s.id] = p;
  }
}

// ---------------------------------------------------------------------------
// Procedural body part builders
// ---------------------------------------------------------------------------

// Draws a creature body from a parts configuration.
// parts: { head, body, tail, wings, horns, ears, fur, scales, feathers, eyes, mouth, feet }
function drawCreatureFromParts(ctx, p, parts, size = 1) {
  const cx = 256, cy = 285;
  const s = size || 1;

  // Backdrop aura
  backdrop(ctx, p, { r: 190 + (parts.auraBoost || 0) * 30, cx, cy });

  // ---- Tail (behind body) ----
  if (parts.tail) {
    const t = parts.tail;
    const pts = t.points || [[300, 330], [390, 280], [440, 310], [400, 360], [330, 350]];
    const scaled = pts.map(([x, y]) => [cx + (x - 256) * s * t.scale, cy + (y - 285) * s * t.scale]);
    shape(ctx, scaled, grad(ctx, scaled[0][0], scaled[0][1], scaled[scaled.length - 1][0], scaled[scaled.length - 1][1], [[0, t.color2 || p.base2], [1, t.color || p.dark]]), 5, p.dark);
    if (t.glow) glow(ctx, cx + (t.gx || 150) * s, cy + (t.gy || -40) * s, (t.gr || 50) * s, p.aura, 0.3);
    if (t.fur) fur(ctx, scaled, p.base, p.dark, t.furCount || 7);
    if (t.feathers) feathers(ctx, cx + (t.fx || 400) * s, cy + (t.fy || 300) * s, 6, 1.2, p.accent, p.dark);
  }

  // ---- Hind legs ----
  if (parts.legs) {
    const l = parts.legs;
    for (const side of [-1, 1]) {
      const x = cx + l.x * side * s;
      shape(ctx, [[x - 24 * s, l.y * s], [x - 30 * s, l.y2 * s], [x + 12 * s, l.y2 * s], [x + 22 * s, l.y * s]], grad(ctx, x - 30 * s, l.y * s, x + 20 * s, l.y2 * s, [[0, p.base2], [1, p.dark]]), 5, p.dark);
      ell(ctx, x - 4 * s, l.y2 * s + 6 * s, 36 * s, 14 * s, p.light, 4);
      if (l.fur) fur(ctx, [[x - 18 * s, l.y * s], [x + 6 * s, l.y * s]], p.base, p.dark, 6);
    }
  }

  // ---- Body ----
  if (parts.body) {
    const b = parts.body;
    const pts = b.points || [[154, 308], [190, 242], [278, 220], [352, 252], [372, 330], [334, 402], [228, 416], [172, 378]];
    const scaled = pts.map(([x, y]) => [cx + (x - 256) * s * b.scale, cy + (y - 285) * s * b.scale]);
    shape(ctx, scaled, grad(ctx, scaled[0][0], scaled[0][1], scaled[scaled.length - 1][0], scaled[scaled.length - 1][1], [[0, p.light], [0.35, p.base], [1, p.base2]]), 5, p.dark);
    if (b.highlight) {
      const hy = cy + (b.hy || 330) * s;
      ell(ctx, cx + (b.hx || 264) * s, hy, (b.hrx || 80) * s, (b.hry || 64) * s, grad(ctx, cx + (b.hx - 50) * s, hy - 40 * s, cx + (b.hx + 50) * s, hy + 40 * s, [[0, p.light], [1, 'rgba(255,255,255,0)']]), 0);
    }
    if (b.shade) shade(ctx, p.dark, 0.28);
    if (b.scales) scales(ctx, cx, cy, b.sw || 160 * s, b.sh || 90 * s, p.base2, p.dark, b.rows || 4, b.cols || 4);
    if (b.fur) furAround(ctx, scaled, p.base, p.dark, b.furCount || 10, b.furOffset || 8);
    if (b.moss) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ell(ctx, cx + Math.cos(a) * 70 * s, cy - 20 * s + Math.sin(a) * 28 * s, 20 * s, 14 * s, p.base2, 3, a);
      }
    }
    if (b.chestGlow) glow(ctx, cx + (b.cgx || 266) * s, cy + (b.cgy || 348) * s, (b.cgr || 40) * s, p.aura, 0.5);
  }

  // ---- Arms / front limbs ----
  if (parts.arms) {
    const a = parts.arms;
    for (const side of [-1, 1]) {
      const x = cx + a.x * side * s;
      shape(ctx, [[x - 22 * s, a.y * s], [x - 34 * s, a.y2 * s], [x - 8 * s, a.y3 * s], [x + 8 * s, a.y2 * s], [x + 22 * s, a.y * s]], grad(ctx, x - 34 * s, a.y * s, x + 10 * s, a.y3 * s, [[0, p.base], [1, p.base2]]), 5, p.dark);
      ell(ctx, x - 10 * s, a.y3 * s + 4 * s, 24 * s, 20 * s, p.base2, 4);
      if (a.fur) fur(ctx, [[x - 14 * s, a.y * s], [x + 2 * s, a.y * s]], p.base, p.dark, 5);
    }
  }

  // ---- Head ----
  if (parts.head) {
    const h = parts.head;
    const pts = h.points || [[178, 210], [198, 146], [266, 124], [334, 152], [356, 216], [320, 276], [252, 288], [204, 260]];
    const scaled = pts.map(([x, y]) => [cx + (x - 256) * s * h.scale, cy + (y - 285) * s * h.scale]);
    shape(ctx, scaled, grad(ctx, scaled[0][0], scaled[0][1], scaled[scaled.length - 1][0], scaled[scaled.length - 1][1], [[0, p.light], [0.32, p.base], [1, p.base2]]), 5, p.dark);
    shade(ctx, p.dark, 0.25);
    rim(ctx, cx + (h.rx || 262) * s, cy + (h.ry || 208) * s, (h.rrx || 74) * s, (h.rry || 68) * s, p.accent);

    // Face mask
    if (h.mask) {
      const m = h.mask;
      const mpts = m.points || [[212, 206], [252, 190], [288, 204], [304, 248], [278, 276], [240, 276], [206, 244]];
      const mscaled = mpts.map(([x, y]) => [cx + (x - 256) * s * m.scale, cy + (y - 285) * s * m.scale]);
      shape(ctx, mscaled, p.light, 4);
    }

    // Eyes
    const ex = h.eyeX || 22;
    const ey = h.eyeY || 27;
    const el = h.eyeLeft || [-30, 0];
    const er = h.eyeRight || [30, 0];
    eyeDetailed(ctx, cx + el[0] * s, cy + (h.ey || 214) * s + el[1] * s, ex * s, ey * s, p.eye, { brow: h.brow !== false, tilt: (h.tiltL || 0.06) });
    eyeDetailed(ctx, cx + er[0] * s, cy + (h.ey || 214) * s + er[1] * s, ex * s, ey * s, p.eye, { brow: h.brow !== false, tilt: (h.tiltR || -0.06) });
    if (h.eyeGlow) {
      glow(ctx, cx + el[0] * s, cy + (h.ey || 214) * s + el[1] * s, (ex * 1.2) * s, p.aura, 0.32);
      glow(ctx, cx + er[0] * s, cy + (h.ey || 214) * s + er[1] * s, (ex * 1.2) * s, p.aura, 0.32);
    }

    // Mouth
    if (h.mouth) {
      const mx = h.mx || 264;
      const my = h.my || 254;
      const mw = h.mw || 15;
      mouth(ctx, cx + mx * s, cy + my * s, mw * s, h.mouthKind || 'fang');
    }

    // Nose / markings
    if (h.nose) ell(ctx, cx + h.nx * s, cy + h.ny * s, h.nrx || 9 * s, h.nry || 7 * s, p.dark, 3);
    if (h.markings) {
      for (const mk of h.markings) {
        line(ctx, mk.pts.map(([x, y]) => [cx + x * s, cy + y * s]), mk.color || p.accent, mk.lw || 4, mk.alpha || 0.8);
      }
    }

    // Forehead ornament
    if (h.crown) {
      const c = h.crown;
      poly(ctx, c.pts.map(([x, y]) => [cx + x * s, cy + y * s]), c.color || p.accent, 3, p.dark);
    }
    if (h.crescent) {
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(cx + h.cx * side * s, cy + h.cy * s);
        ctx.rotate(side * h.crot || 0.34);
        ctx.beginPath();
        ctx.arc(0, 0, (h.cr || 46) * s, Math.PI * 0.15, Math.PI * 1.55);
        ctx.strokeStyle = p.light;
        ctx.lineWidth = 13;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();
      }
    }
    if (h.starMark) {
      star(ctx, cx + h.smx * s, cy + h.smy * s, (h.smr || 12) * s, p.accent, 6, 0.95);
      glow(ctx, cx + h.smx * s, cy + h.smy * s, 22 * s, p.aura, 0.4);
    }
  }

  // ---- Ears ----
  if (parts.ears) {
    const e = parts.ears;
    for (const side of [-1, 1]) {
      const pts = e.points || [[198, 158], [158, 38], [236, 102], [256, 158]];
      const scaled = pts.map(([x, y]) => [cx + (x - 256 + e.xoff * side) * s * e.scale, cy + (y - 285 + e.yoff) * s * e.scale]);
      shape(ctx, scaled, grad(ctx, scaled[0][0], scaled[0][1], scaled[scaled.length - 1][0], scaled[scaled.length - 1][1], [[0, p.base], [1, p.base2]]), 5, p.dark);
      if (e.inner) {
        const ipts = e.innerPoints || [[204, 142], [184, 72], [228, 112], [238, 148]];
        const iscaled = ipts.map(([x, y]) => [cx + (x - 256 + e.xoff * side) * s * e.scale, cy + (y - 285 + e.yoff) * s * e.scale]);
        shape(ctx, iscaled, p.light, 3);
      }
      if (e.line) line(ctx, e.linePts.map(([x, y]) => [cx + (x + e.lineX * side) * s, cy + (y + e.lineY) * s]), e.lineColor || p.base2, 3, 0.8);
    }
  }

  // ---- Wings ----
  if (parts.wings) {
    const w = parts.wings;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + w.x * side * s, cy + w.y * s);
      ctx.scale(side * s, s);
      const wpts = w.points || [[40, -30], [128, -96], [214, -48], [206, 16], [176, -4], [166, 60], [130, 18], [112, 88], [82, 28], [52, 52]];
      shape(ctx, wpts, grad(ctx, 60, -90, 220, 80, [[0, p.base], [0.6, p.base2], [1, p.dark]]), 5, p.dark);
      if (w.inner) {
        const ipts = w.innerPoints || [[58, -8], [142, -52], [196, -20]];
        shape(ctx, ipts, p.light, 3, 0.45);
      }
      if (w.feathers) feathers(ctx, 100, 0, 6, 1.0, p.accent, p.dark);
      ctx.restore();
    }
  }

  // ---- Horns / antlers ----
  if (parts.horns) {
    const h = parts.horns;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + h.x * side * s, cy + h.y * s);
      ctx.scale(side * s, s);
      for (const seg of h.segments) {
        line(ctx, seg.pts.map(([x, y]) => [x, y]), seg.color || p.metal, seg.lw || 9, p.dark);
      }
      for (const st of h.stars || []) {
        star(ctx, st[0] * s, st[1] * s, (st[2] || 6) * s, p.accent, 4, 0.95);
        glow(ctx, st[0] * s, st[1] * s, 12 * s, p.aura, 0.4);
      }
      ctx.restore();
    }
    if (h.glow) glow(ctx, cx, cy + h.gy * s, (h.gr || 90) * s, p.aura, 0.25);
  }

  // ---- Feet / hooves ----
  if (parts.feet) {
    const f = parts.feet;
    for (const side of [-1, 1]) {
      const x = cx + f.x * side * s;
      shape(ctx, [[x - f.w * s, f.y * s], [x - f.w2 * s, f.y2 * s], [x + f.w2 * s, f.y2 * s], [x + f.w * s, f.y * s]], grad(ctx, x - f.w * s, f.y * s, x + f.w * s, f.y2 * s, [[0, p.base2], [1, p.dark]]), 4, p.dark);
      ell(ctx, x, f.y2 * s + 4 * s, f.rx || 30 * s, f.ry || 12 * s, p.metal, 3);
    }
  }

  // ---- Chest markings / symbols ----
  if (parts.chest) {
    const c = parts.chest;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(cx + c.x * s, cy + c.y * s, (c.r || 22) * s, 0, Math.PI * 2);
    ctx.fillStyle = p.accent;
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx + (c.x + c.dx) * s, cy + (c.y + c.dy) * s, (c.r2 || 20) * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- Sparkle field + shiny freckles ----
  sparkleField(ctx, p, p.seed || 0, 16, [60, 80, 460, 400]);
  shinyFreckles(ctx, p, p.seed || 0);
}

// ---------------------------------------------------------------------------
// Archetype presets — combine parts into full creatures
// ---------------------------------------------------------------------------

function quadBody(id, elementP) {
  return {
    tail: { points: [[300, 330], [390, 280], [440, 310], [400, 360], [330, 350]], color: elementP.base2, color2: elementP.dark, glow: true, gx: 140, gy: -30, gr: 60, fur: true },
    legs: { x: 70, y: 380, y2: 450, fur: true },
    body: { points: [[154, 308], [190, 242], [278, 220], [352, 252], [372, 330], [334, 402], [228, 416], [172, 378]], scale: 1, highlight: true, shade: true },
    arms: { x: 95, y: 328, y2: 390, y3: 400, fur: true },
    head: { points: [[178, 210], [198, 146], [266, 124], [334, 152], [356, 216], [320, 276], [252, 288], [204, 260]], scale: 1, mask: true, eyeGlow: true, mouth: true, markings: [{ pts: [[170, 300], [196, 330], [184, 370]], color: elementP.accent, lw: 4, alpha: 0.85 }, { pts: [[352, 296], [332, 336], [348, 374]], color: elementP.accent, lw: 4, alpha: 0.85 }] },
    ears: { points: [[198, 158], [158, 38], [236, 102], [256, 158]], scale: 0.9, inner: true, line: true, linePts: [[210, 112], [218, 74]], lineColor: elementP.base2 },
    feet: { x: 70, y: 450, y2: 462, w: 34, w2: 18, rx: 36, ry: 14 },
  };
}

function avianBody(id, elementP) {
  return {
    tail: { points: [[300, 330], [390, 280], [440, 310], [400, 360], [330, 350]], color: elementP.base2, color2: elementP.dark, glow: true, gx: 140, gy: -30, gr: 60, feathers: true },
    legs: { x: 55, y: 398, y2: 460, fur: false },
    body: { points: [[218, 316], [232, 250], [286, 226], [336, 252], [350, 322], [318, 398], [268, 416], [230, 384]], scale: 0.95, highlight: true },
    arms: null,
    head: { points: [[226, 246], [236, 184], [286, 158], [338, 184], [348, 242], [318, 286], [272, 300], [238, 280]], scale: 0.95, mask: true, eyeGlow: true, mouth: { kind: 'beak', mw: 16, mx: 286, my: 254 }, markings: [] },
    ears: null,
    wings: { x: 50, y: -10, points: [[28, -8], [110, -114], [196, -146], [230, -70], [210, -18], [176, -58], [170, 34], [142, -12], [128, 78], [100, 18], [70, 62]], inner: true, feathers: true },
    horns: null,
    feet: { x: 55, y: 404, y2: 462, w: 28, w2: 14, rx: 30, ry: 12 },
    auraBoost: 0.4,
  };
}

function serpentBody(id, elementP) {
  return {
    tail: { points: [[306, 350], [386, 326], [452, 274], [458, 214], [480, 268], [462, 344], [400, 396], [330, 392]], color: elementP.base, color2: elementP.accent, glow: true, gx: 130, gy: -50, gr: 80 },
    legs: null,
    body: { points: [[192, 330], [214, 258], [272, 232], [330, 252], [352, 320], [332, 400], [266, 430], [210, 400]], scale: 0.95, highlight: true, chestGlow: true, cgx: 268, cgy: 336, cgr: 48 },
    arms: null,
    head: { points: [[194, 242], [212, 174], [272, 148], [334, 176], [352, 240], [318, 294], [256, 306], [206, 284]], scale: 0.95, mask: true, eyeGlow: true, mouth: true, crown: { pts: [[268, 174], [280, 192], [268, 210], [256, 192]], color: elementP.accent } },
    ears: { points: [[206, 190], [172, 106], [246, 144], [256, 190]], scale: 0.85, inner: true },
    wings: null,
    horns: { x: 54, y: -133, segments: [{ pts: [[0, 8], [28, -46], [66, -74]], color: elementP.metal, lw: 9 }, { pts: [[22, -26], [62, -30]], color: elementP.metal, lw: 6 }], stars: [[28, -46], [66, -74]], glow: true, gy: -130, gr: 90 },
    feet: null,
    auraBoost: 0.3,
  };
}

function bulkyBody(id, elementP) {
  return {
    tail: { points: [[300, 330], [380, 300], [398, 236], [434, 262], [414, 196], [456, 218], [428, 300], [400, 356], [330, 366]], color: elementP.base2, color2: elementP.dark, glow: true, gx: 150, gy: -50, gr: 100 },
    legs: { x: 60, y: 388, y2: 452, fur: false },
    body: { points: [[138, 350], [160, 276], [226, 240], [300, 238], [364, 278], [382, 352], [344, 414], [252, 436], [172, 410]], scale: 1, scales: true, shade: true },
    arms: { x: 110, y: 348, y2: 388, y3: 398, fur: false },
    head: { points: [[196, 238], [212, 182], [264, 158], [322, 184], [338, 240], [300, 278], [244, 284], [208, 264]], scale: 1, mask: true, eyeGlow: true, mouth: { kind: 'fang', mw: 18, mx: 264, my: 266 }, markings: [{ pts: [[214, 186], [240, 214], [232, 244]], color: elementP.accent, lw: 4, alpha: 0.9 }, { pts: [[316, 190], [298, 218]], color: elementP.accent, lw: 3.5, alpha: 0.9 }] },
    ears: { points: [[196, 164], [160, 72], [232, 112], [250, 164]], scale: 0.95, inner: true },
    wings: null,
    horns: null,
    feet: { x: 60, y: 456, y2: 470, w: 40, w2: 22, rx: 40, ry: 18 },
    auraBoost: 0.2,
  };
}

function mysticBody(id, elementP) {
  return {
    tail: { points: [[306, 350], [386, 326], [452, 274], [458, 214], [480, 268], [462, 344], [400, 396], [330, 392]], color: elementP.base, color2: elementP.accent, glow: true, gx: 120, gy: -40, gr: 90 },
    legs: { x: 50, y: 416, y2: 462, fur: true },
    body: { points: [[192, 330], [214, 258], [272, 232], [330, 252], [352, 320], [332, 400], [266, 430], [210, 400]], scale: 0.9, highlight: true, starField: true },
    arms: null,
    head: { points: [[194, 242], [212, 174], [272, 148], [334, 176], [352, 240], [318, 294], [256, 306], [206, 284]], scale: 0.9, mask: true, eyeGlow: true, mouth: true, crescent: { cx: 54, cy: -133, cr: 46, crot: 0.34 }, starMark: { smx: 268, smy: 174, smr: 12 } },
    ears: { points: [[206, 190], [172, 106], [246, 144], [256, 190]], scale: 0.85, inner: true },
    wings: null,
    horns: null,
    feet: { x: 50, y: 462, y2: 476, w: 34, w2: 18, rx: 36, ry: 14 },
    auraBoost: 0.5,
  };
}

function divineBody(id, elementP) {
  return {
    tail: { points: [[306, 350], [386, 326], [452, 274], [458, 214], [480, 268], [462, 344], [400, 396], [330, 392]], color: elementP.base, color2: elementP.accent, glow: true, gx: 150, gy: -40, gr: 120, feathers: true },
    legs: { x: 30, y: 404, y2: 462, fur: false },
    body: { points: [[218, 316], [232, 250], [286, 226], [336, 252], [350, 322], [318, 398], [268, 416], [230, 384]], scale: 1, highlight: true },
    arms: null,
    head: { points: [[226, 246], [236, 184], [286, 158], [338, 184], [348, 242], [318, 286], [272, 300], [238, 280]], scale: 1, mask: true, eyeGlow: true, mouth: { kind: 'beak', mw: 14, mx: 286, my: 254 }, starMark: { smx: 286, smy: 194, smr: 12 } },
    ears: null,
    wings: { x: 50, y: -10, points: [[28, -8], [110, -114], [196, -146], [230, -70], [210, -18], [176, -58], [170, 34], [142, -12], [128, 78], [100, 18], [70, 62]], inner: true, feathers: true },
    horns: null,
    feet: { x: 30, y: 404, y2: 462, w: 28, w2: 14, rx: 30, ry: 12 },
    auraBoost: 0.8,
  };
}

const ARCHETYPES = {
  quad: quadBody,
  avian: avianBody,
  serpent: serpentBody,
  bulky: bulkyBody,
  mystic: mysticBody,
  divine: divineBody,
};

// ---------------------------------------------------------------------------
// Creature drawer — looks up archetype + palette and draws
// ---------------------------------------------------------------------------

function drawProceduralCreature(ctx, p, archetypeId, parts) {
  const builder = ARCHETYPES[archetypeId] || ARCHETYPES.quad;
  const pArts = builder(archetypeId, p);
  // Merge explicit parts over archetype defaults
  const finalParts = { ...pArts, ...parts };
  drawCreatureFromParts(ctx, p, finalParts);
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
  const species = CREATURE_SPECIES_BY_ID[speciesId];
  if (species && species.draw) {
    species.draw(ctx, p, speciesId, appearance);
  } else {
    drawProceduralCreature(ctx, p, species?.archetype || 'quad', species?.parts);
  }
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

// ---------------------------------------------------------------------------
// People — the player and the story NPCs (simplified but detailed)
// ---------------------------------------------------------------------------

const NPC_LOOKS = {
  player: { skin: '#f0c49c', hair: '#4a3428', coat: '#5ab1a6', coat2: '#2f7c74', trim: '#f2f3ee', scarf: '#f1c84b', pack: '#e8b455', hat: '#e2675b', boot: '#3e4a66', accent: '#ffe9a3', style: 'cap', prop: 'lantern' },
  nima: { skin: '#c98f68', hair: '#e7e1d4', coat: '#6b6bb4', coat2: '#403f7c', trim: '#f2ecd9', scarf: '#d9b84e', pack: '#8b6a45', hat: '#4b4a86', boot: '#3a3550', accent: '#c9c6ff', style: 'hood', prop: 'book', elder: true },
  lys: { skin: '#e2b08a', hair: '#2f4a63', coat: '#3f9fc4', coat2: '#256a8c', trim: '#e9f7fa', scarf: '#9fe4d4', pack: '#c58a4f', hat: '#2f7f9e', boot: '#38505e', accent: '#b9f2ff', style: 'bandana', prop: 'rod' },
  tilo: { skin: '#8a5a3c', hair: '#2b1d18', coat: '#7fb45a', coat2: '#4c7c38', trim: '#f1edcf', scarf: '#e9c95d', pack: '#a9753f', hat: '#5d8d42', boot: '#4a3a2a', accent: '#d8ff8a', style: 'straw', prop: 'basket' },
  orin: { skin: '#b98f70', hair: '#cfc8b8', coat: '#8a8f9c', coat2: '#565b6a', trim: '#e8e3d2', scarf: '#7fc9a8', pack: '#6b5a48', hat: '#6f7482', boot: '#3e3a36', accent: '#c8ffd9', style: 'hood', prop: 'staff', elder: true },
  mica: { skin: '#e6b489', hair: '#a4442f', coat: '#d68048', coat2: '#9a4f28', trim: '#f7e9cf', scarf: '#f0d05c', pack: '#6f4d32', hat: '#b85e30', boot: '#463326', accent: '#ffd27a', style: 'cap', prop: 'satchel' },
  sol: { skin: '#8f6044', hair: '#161616', coat: '#4d7f5a', coat2: '#30523c', trim: '#e9e2c8', scarf: '#d7a93f', pack: '#7a5b3b', hat: '#3d6649', boot: '#332d24', accent: '#ffe08a', style: 'bandana', prop: 'staff' },
  mara: { skin: '#d9a77f', hair: '#7d4a2a', coat: '#69a94b', coat2: '#3f7430', trim: '#f0f6d8', scarf: '#f5d76e', pack: '#7f6a3f', hat: '#4f8538', boot: '#3a4a2a', accent: '#d9ff8f', style: 'straw', prop: 'staff' },
  sable: { skin: '#9a6a50', hair: '#162c3a', coat: '#3c94b8', coat2: '#1f6282', trim: '#e4f8ff', scarf: '#a8f0e4', pack: '#4f6a78', hat: '#286b88', boot: '#263e4a', accent: '#a9f5ff', style: 'bandana', prop: 'rod' },
  kael: { skin: '#c98f6a', hair: '#5a1e16', coat: '#d06438', coat2: '#8e3820', trim: '#ffe6c4', scarf: '#f7c95a', pack: '#6e3f28', hat: '#a94a28', boot: '#42251a', accent: '#ffcf6a', style: 'cap', prop: 'staff' },
  brann: { skin: '#b98662', hair: '#8a8074', coat: '#7d7a70', coat2: '#4c4b45', trim: '#e2d9c4', scarf: '#c9b26a', pack: '#756245', hat: '#5c5950', boot: '#3a3730', accent: '#d9ffb0', style: 'hood', prop: 'staff', elder: true },
  keeper: { skin: '#d6a17a', hair: '#2f2a3f', coat: '#b8913e', coat2: '#7a5a1f', trim: '#fff2c8', scarf: '#8fd0c0', pack: '#8a6a35', hat: '#9a7626', boot: '#4a3a24', accent: '#ffe28a', style: 'cap', prop: 'book', elder: true },
};

function drawPerson(ctx, look) {
  const L = look;
  const coatGrad = grad(ctx, 170, 240, 350, 460, [[0, L.coat], [0.6, L.coat], [1, L.coat2]]);
  glow(ctx, 256, 300, 168, L.accent, 0.16);
  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = radial(ctx, 256, 468, 6, 140, [[0, 'rgba(10,20,18,0.7)'], [1, 'rgba(10,20,18,0)']]);
  ctx.beginPath();
  ctx.ellipse(256, 468, 140, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  for (const side of [-1, 1]) {
    shape(ctx, [[248 + side * 32, 396], [240 + side * 32, 448], [270 + side * 32, 448], [274 + side * 32, 396]], L.boot, 5);
    ell(ctx, 254 + side * 34, 450, 24, 12, shift(L.boot, 0, 0.8, 0.08), 4);
  }
  shape(ctx, [[164, 276], [150, 330], [168, 392], [206, 398], [208, 288]], L.pack, 5);
  shape(ctx, [[170, 288], [160, 332], [174, 374], [196, 378], [198, 296]], shift(L.pack, 0, 0.9, 0.12), 3);
  line(ctx, [[174, 300], [188, 300]], shift(L.pack, 0, 0.7, -0.2), 3);
  shape(ctx, [[198, 286], [218, 252], [294, 246], [322, 280], [330, 374], [304, 412], [212, 412], [184, 374]], coatGrad);
  shape(ctx, [[250, 260], [268, 260], [276, 404], [244, 404]], L.trim, 3);
  line(ctx, [[262, 276], [262, 396]], shift(L.trim, 0, 0.8, -0.15), 2.5, 0.6);
  poly(ctx, [[194, 344], [326, 340], [328, 366], [196, 370]], shift(L.boot, 0, 0.9, 0.08), 4);
  ell(ctx, 262, 356, 13, 11, L.scarf, 3);
  shape(ctx, [[190, 286], [168, 322], [162, 388], [186, 396], [200, 332], [210, 292]], L.coat, 5);
  shape(ctx, [[318, 282], [344, 316], [352, 384], [330, 394], [314, 330], [306, 288]], L.coat, 5);
  ell(ctx, 176, 396, 18, 20, L.skin, 4);
  ell(ctx, 340, 392, 18, 20, L.skin, 4);
  shape(ctx, [[202, 266], [222, 250], [294, 248], [316, 268], [300, 288], [220, 290]], L.scarf, 5);
  shape(ctx, [[296, 272], [342, 300], [352, 338], [330, 334], [304, 300]], L.scarf, 4);
  line(ctx, [[228, 264], [286, 262]], shift(L.scarf, 0, 0.9, -0.12), 3, 0.7);
  ell(ctx, 258, 242, 34, 26, shift(L.skin, 0, 1, -0.08), 4);
  shape(ctx, [[206, 208], [214, 152], [258, 128], [306, 146], [318, 202], [298, 246], [258, 258], [218, 244]], look.elder ? shift(L.skin, 0, 0.82, -0.04) : L.skin, 5);
  ell(ctx, 206, 196, 10, 16, shift(L.skin, 0, 0.95, -0.05), 3);
  ell(ctx, 312, 196, 10, 16, shift(L.skin, 0, 0.95, -0.05), 3);
  if (L.style === 'straw') {
    shape(ctx, [[180, 176], [198, 132], [318, 132], [336, 176], [318, 190], [198, 190]], grad(ctx, 200, 132, 318, 190, [[0, '#f2d98a'], [1, '#c99f4f']]), 5);
    shape(ctx, [[212, 136], [224, 100], [292, 100], [306, 136]], '#e8ca77', 5);
    line(ctx, [[222, 130], [300, 130]], '#a97d3a', 5);
  } else if (L.style === 'hood') {
    shape(ctx, [[196, 208], [204, 142], [258, 112], [314, 140], [322, 208], [296, 170], [258, 184], [220, 170]], L.hat, 5);
    shape(ctx, [[218, 186], [236, 148], [280, 148], [298, 186]], shift(L.hat, 0, 0.8, 0.1), 4);
  } else if (L.style === 'bandana') {
    shape(ctx, [[200, 194], [212, 146], [258, 126], [308, 148], [320, 194], [296, 170], [256, 180], [220, 172]], L.hair, 5);
    poly(ctx, [[196, 176], [320, 176], [314, 198], [202, 198]], L.scarf, 4);
  } else {
    shape(ctx, [[200, 194], [210, 144], [258, 122], [308, 144], [318, 194], [296, 166], [256, 176], [220, 168]], L.hair, 5);
    shape(ctx, [[196, 150], [212, 118], [296, 112], [318, 148], [304, 164], [212, 168]], L.hat, 5);
    shape(ctx, [[202, 154], [314, 154], [330, 168], [194, 172]], shift(L.hat, 0, 0.9, -0.08), 4);
    ell(ctx, 258, 134, 10, 8, L.accent, 3);
  }
  eyeDetailed(ctx, 238, 202, 13, 16, '#5a3d2e', { tilt: 0.05 });
  eyeDetailed(ctx, 284, 202, 13, 16, '#5a3d2e', { tilt: -0.05 });
  line(ctx, [[224, 186], [246, 182]], INK, 3.5);
  line(ctx, [[276, 182], [298, 186]], INK, 3.5);
  mouth(ctx, 261, 228, 13, 'smile');
  ell(ctx, 222, 220, 10, 6, 'rgba(230,130,120,0.28)', 0);
  ell(ctx, 300, 220, 10, 6, 'rgba(230,130,120,0.28)', 0);
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
  const rand = mulberry32((L.skin.length * 97 + L.coat.length * 13) | 1);
  for (let i = 0; i < 9; i++) {
    star(ctx, 120 + rand() * 290, 140 + rand() * 300, 1.5 + rand() * 2.6, L.accent, 4, 0.3 + rand() * 0.4);
  }
}

// ---------------------------------------------------------------------------
// Species registry (populated by src/data.js via registerCreatureArt)
// ---------------------------------------------------------------------------

export const CREATURE_SPECIES_BY_ID = {};
export const CREATURE_SPECIES_LIST = [];

export function registerCreatureArt(speciesId, drawFn, archetypeId, parts) {
  CREATURE_SPECIES_BY_ID[speciesId] = { draw: drawFn, archetype: archetypeId, parts };
  if (!CREATURE_SPECIES_LIST.includes(speciesId)) CREATURE_SPECIES_LIST.push(speciesId);
}

// Called by data.js after all species are defined
export function finalizePalettes(speciesList) {
  buildPalettes(speciesList);
}
