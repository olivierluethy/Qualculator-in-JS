// geometry-figures.js — live, labeled SVG diagrams for the Geometry mode.
//
// One drawing function per calculator. Each is fed the values currently typed
// into the form (a lenient map that may be empty or partial) and redraws the
// figure immediately, labelling the entered value on the drawing itself. The
// same functions render the finished figure on Calculate (final = true), so a
// child sees the shape change as they type and the completed object afterwards.
//
// Everything is schematic, not to scale: the picture explains the relationship,
// the labels carry the real numbers.

import { formatNumber } from '../core/format.js';

const NS = 'http://www.w3.org/2000/svg';
const CX = 160, CY = 150; // figure centre (viewBox is 0 0 320 320)

// Colour roles — reused from the app's dark palette so figures feel native.
const COL = {
  circle: '#818cf8', // indigo — primary radius / circle
  accent: '#fbbf24', // amber  — secondary dimension (diameter, angle, distance)
  ring: '#34d399',   // emerald — outer ring
  chord: '#f472b6',  // pink   — chords / tangents / inscribed angle
  line: '#22d3ee',   // cyan   — a line meeting the circle
  muted: '#334155',  // slate-700 — reference geometry
  text: '#e2e8f0',   // slate-200
  sub: '#94a3b8',    // slate-400
  bg: '#0f172a',     // slate-900 — halo behind labels
};
// lighter label tints so text stays legible on the dark ground
const TINT = { circle: '#c7d2fe', accent: '#fcd34d', ring: '#6ee7b7', chord: '#f9a8d4', line: '#67e8f9' };

// ---- tiny SVG helpers ------------------------------------------------------
function mk(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
const fmt = (x) => (isFinite(x) ? formatNumber(x) : '?');

// point on a circle, angle in degrees, screen-y flipped so +angle is upward
function ptOnC(cx, cy, r, deg) {
  const t = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(t), cy - r * Math.sin(t)];
}
function arcPts(cx, cy, r, a0, a1, steps = 40) {
  const out = [];
  for (let i = 0; i <= steps; i++) out.push(ptOnC(cx, cy, r, a0 + ((a1 - a0) * i) / steps));
  return out;
}
function poly(points, attrs = {}) {
  const d = points.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ');
  return mk('path', { d, ...attrs });
}
// text with a rounded halo (paint-order:stroke) so it reads over any line
function label(parent, x, y, s, o = {}) {
  const t = mk('text', {
    x, y, fill: o.fill || COL.text, 'font-size': o.size || 13,
    'text-anchor': o.anchor || 'middle', 'font-weight': o.weight || '600',
    'font-family': 'ui-sans-serif, system-ui, sans-serif',
  });
  if (o.halo !== null) {
    t.setAttribute('stroke', COL.bg);
    t.setAttribute('stroke-width', '3.5');
    t.setAttribute('paint-order', 'stroke');
    t.setAttribute('stroke-linejoin', 'round');
  }
  t.textContent = s;
  parent.appendChild(t);
  return t;
}
function layer(svg) { const g = mk('g'); svg.appendChild(g); return g; }

// A results strip along the bottom: [label, value, colour].
function captions(svg, rows) {
  const y0 = 298;
  rows.forEach((row, i) => {
    const y = y0 + i * 17;
    label(svg, 14, y, row[0], { fill: COL.sub, size: 12, anchor: 'start', halo: null, weight: '500' });
    label(svg, 306, y, String(row[1]), { fill: row[2] || COL.text, size: 13, anchor: 'end', halo: null, weight: '700' });
  });
}
function hintIfEmpty(svg, empty) {
  if (empty) label(svg, CX, 24, 'Type a value — the figure updates live', { fill: COL.sub, size: 12, halo: null, weight: '500' });
}
function resultBadge(svg) {
  const g = mk('g');
  g.appendChild(mk('rect', { x: 236, y: 10, width: 74, height: 22, rx: 11, fill: COL.circle, 'fill-opacity': 0.18, stroke: COL.circle, 'stroke-width': 1 }));
  label(g, 273, 25, '✓ result', { fill: TINT.circle, size: 12, halo: null });
  svg.appendChild(g);
}

// schematic radius in px that grows with the value, then caps
function dispR(r) {
  if (!isFinite(r) || r <= 0) return 96;
  return clamp(46 + 11 * r, 46, 120);
}

// ---- figures ---------------------------------------------------------------

function circleR(v) {
  if (isFinite(v.r)) return v.r;
  if (isFinite(v.d)) return v.d / 2;
  if (isFinite(v.U)) return v.U / (2 * Math.PI);
  if (isFinite(v.A) && v.A >= 0) return Math.sqrt(v.A / Math.PI);
  return undefined;
}

function figCircle(svg, v, final) {
  const g = layer(svg);
  const r = circleR(v);
  const dr = dispR(r);
  g.appendChild(mk('circle', { cx: CX, cy: CY, r: dr, fill: COL.circle, 'fill-opacity': 0.06, stroke: COL.circle, 'stroke-width': 2.5 }));
  g.appendChild(mk('circle', { cx: CX, cy: CY, r: 3, fill: COL.circle }));
  // radius line
  g.appendChild(mk('line', { x1: CX, y1: CY, x2: CX + dr, y2: CY, stroke: COL.circle, 'stroke-width': 2.5 }));
  label(g, CX + dr / 2, CY - 8, 'r = ' + fmt(r), { fill: TINT.circle, size: 12 });
  // diameter shown once known (or on the final figure)
  if (final || isFinite(v.d)) {
    g.appendChild(mk('line', { x1: CX - dr, y1: CY, x2: CX + dr, y2: CY, stroke: COL.accent, 'stroke-width': 1.5, 'stroke-dasharray': '5 4', 'stroke-opacity': 0.85 }));
    label(g, CX, CY + 17, 'd = ' + fmt(isFinite(r) ? 2 * r : NaN), { fill: TINT.accent, size: 12 });
  }
  captions(svg, [
    ['Circumference U = 2πr', isFinite(r) ? fmt(2 * Math.PI * r) : '–', TINT.circle],
    ['Area A = πr²', isFinite(r) ? fmt(Math.PI * r * r) : '–', TINT.accent],
  ]);
  hintIfEmpty(svg, r === undefined);
  if (final) resultBadge(svg);
}

function figArc(svg, v, final) {
  const g = layer(svg);
  const r = isFinite(v.r) ? v.r : undefined;
  const a = isFinite(v.a) ? v.a : undefined;
  const dr = dispR(r);
  const ang = a === undefined ? 70 : clamp(a, 1, 350);
  const steps = Math.max(10, Math.round(ang / 4));
  g.appendChild(mk('circle', { cx: CX, cy: CY, r: dr, fill: 'none', stroke: COL.muted, 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }));
  // sector wedge
  g.appendChild(poly([[CX, CY], ...arcPts(CX, CY, dr, 0, ang, steps), [CX, CY]], { fill: COL.accent, 'fill-opacity': 0.16, stroke: 'none' }));
  g.appendChild(poly(arcPts(CX, CY, dr, 0, ang, steps), { fill: 'none', stroke: COL.accent, 'stroke-width': 3 }));
  // radii
  g.appendChild(mk('line', { x1: CX, y1: CY, x2: CX + dr, y2: CY, stroke: COL.circle, 'stroke-width': 2.5 }));
  const [ex, ey] = ptOnC(CX, CY, dr, ang);
  g.appendChild(mk('line', { x1: CX, y1: CY, x2: ex, y2: ey, stroke: COL.circle, 'stroke-width': 2.5 }));
  g.appendChild(mk('circle', { cx: CX, cy: CY, r: 3, fill: COL.circle }));
  // angle arc + labels
  g.appendChild(poly(arcPts(CX, CY, 26, 0, ang, 24), { fill: 'none', stroke: TINT.accent, 'stroke-width': 1.5 }));
  const [lx, ly] = ptOnC(CX, CY, 44, ang / 2);
  label(g, lx, ly, 'α = ' + (a === undefined ? '?' : fmt(a) + '°'), { fill: TINT.accent, size: 12 });
  label(g, CX + dr / 2, CY + 15, 'r = ' + fmt(r), { fill: TINT.circle, size: 12 });
  const rad = (x) => (x * Math.PI) / 180;
  captions(svg, [
    ['Arc length b = r·α', isFinite(r) && isFinite(a) ? fmt(r * rad(a)) : '–', TINT.accent],
    ['Sector area ½r²α', isFinite(r) && isFinite(a) ? fmt(0.5 * r * r * rad(a)) : '–', TINT.circle],
  ]);
  hintIfEmpty(svg, r === undefined && a === undefined);
  if (final) resultBadge(svg);
}

function figRing(svg, v, final) {
  const g = layer(svg);
  const R = isFinite(v.R) ? v.R : undefined;
  const r = isFinite(v.r) ? v.r : undefined;
  const outer = 120;
  const inner = isFinite(R) && isFinite(r) && R > 0 ? clamp(outer * (r / R), 6, outer - 6) : 54;
  const ringPath =
    `M ${CX - outer} ${CY} a ${outer} ${outer} 0 1 0 ${outer * 2} 0 a ${outer} ${outer} 0 1 0 ${-outer * 2} 0 Z ` +
    `M ${CX - inner} ${CY} a ${inner} ${inner} 0 1 0 ${inner * 2} 0 a ${inner} ${inner} 0 1 0 ${-inner * 2} 0 Z`;
  g.appendChild(mk('path', { d: ringPath, 'fill-rule': 'evenodd', fill: COL.ring, 'fill-opacity': 0.15 }));
  g.appendChild(mk('circle', { cx: CX, cy: CY, r: outer, fill: 'none', stroke: COL.ring, 'stroke-width': 2.5 }));
  g.appendChild(mk('circle', { cx: CX, cy: CY, r: inner, fill: 'none', stroke: COL.accent, 'stroke-width': 2 }));
  g.appendChild(mk('circle', { cx: CX, cy: CY, r: 3, fill: COL.ring }));
  const [Rx, Ry] = ptOnC(CX, CY, outer, 128);
  g.appendChild(mk('line', { x1: CX, y1: CY, x2: Rx, y2: Ry, stroke: COL.ring, 'stroke-width': 2 }));
  label(g, (CX + Rx) / 2 - 2, (CY + Ry) / 2 - 4, 'R = ' + fmt(R), { fill: TINT.ring, size: 12 });
  const [rx, ry] = ptOnC(CX, CY, inner, -40);
  g.appendChild(mk('line', { x1: CX, y1: CY, x2: rx, y2: ry, stroke: COL.accent, 'stroke-width': 2 }));
  label(g, (CX + rx) / 2 + 8, (CY + ry) / 2 + 12, 'r = ' + fmt(r), { fill: TINT.accent, size: 12 });
  captions(svg, [
    ['Ring area π(R²−r²)', isFinite(R) && isFinite(r) ? fmt(Math.PI * (R * R - r * r)) : '–', TINT.ring],
    ['Ring width R−r', isFinite(R) && isFinite(r) ? fmt(R - r) : '–', TINT.accent],
  ]);
  hintIfEmpty(svg, R === undefined && r === undefined);
  if (final) resultBadge(svg);
}

function figAngles(svg, v, final) {
  const g = layer(svg);
  let z, u;
  if (isFinite(v.z)) { z = v.z; u = z / 2; } else if (isFinite(v.u)) { u = v.u; z = 2 * u; }
  const dr = 108;
  const zc = z === undefined ? 90 : clamp(z, 2, 340);
  const base = 270; // chord hangs from the bottom of the circle
  const A = ptOnC(CX, CY, dr, base - zc / 2);
  const B = ptOnC(CX, CY, dr, base + zc / 2);
  g.appendChild(mk('circle', { cx: CX, cy: CY, r: dr, fill: 'none', stroke: COL.circle, 'stroke-width': 2, 'stroke-opacity': 0.5 }));
  g.appendChild(mk('circle', { cx: CX, cy: CY, r: 3, fill: COL.circle }));
  // central angle at the centre
  g.appendChild(mk('line', { x1: CX, y1: CY, x2: A[0], y2: A[1], stroke: COL.accent, 'stroke-width': 2 }));
  g.appendChild(mk('line', { x1: CX, y1: CY, x2: B[0], y2: B[1], stroke: COL.accent, 'stroke-width': 2 }));
  g.appendChild(poly(arcPts(CX, CY, 24, base - zc / 2, base + zc / 2, 24), { fill: 'none', stroke: TINT.accent, 'stroke-width': 1.5 }));
  label(g, CX, CY + 42, 'central ' + (z === undefined ? '?' : fmt(z) + '°'), { fill: TINT.accent, size: 12 });
  // inscribed angle at the top of the circle
  const P = ptOnC(CX, CY, dr, 90);
  g.appendChild(mk('line', { x1: P[0], y1: P[1], x2: A[0], y2: A[1], stroke: COL.chord, 'stroke-width': 2 }));
  g.appendChild(mk('line', { x1: P[0], y1: P[1], x2: B[0], y2: B[1], stroke: COL.chord, 'stroke-width': 2 }));
  g.appendChild(mk('circle', { cx: P[0], cy: P[1], r: 3.5, fill: COL.chord }));
  label(g, P[0], P[1] - 10, 'inscribed ' + (u === undefined ? '?' : fmt(u) + '°'), { fill: TINT.chord, size: 12 });
  g.appendChild(mk('line', { x1: A[0], y1: A[1], x2: B[0], y2: B[1], stroke: COL.line, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }));
  captions(svg, [
    ['Central angle', z === undefined ? '–' : fmt(z) + '°', TINT.accent],
    ['Inscribed = ½ central', u === undefined ? '–' : fmt(u) + '°', TINT.chord],
  ]);
  hintIfEmpty(svg, z === undefined && u === undefined);
  if (final) resultBadge(svg);
}

function figLine(svg, v, final) {
  const g = layer(svg);
  const r = isFinite(v.r) ? v.r : undefined;
  const p = isFinite(v.p) ? v.p : undefined;
  const dr = dispR(r);
  const k = isFinite(r) && r > 0 ? dr / r : dr / 3; // px per world unit
  const pd = p === undefined ? dr * 0.55 : clamp(p * k, 0, 150);
  const ly = CY - pd;
  g.appendChild(mk('circle', { cx: CX, cy: CY, r: dr, fill: COL.circle, 'fill-opacity': 0.06, stroke: COL.circle, 'stroke-width': 2.5 }));
  g.appendChild(mk('circle', { cx: CX, cy: CY, r: 3, fill: COL.circle }));
  g.appendChild(mk('line', { x1: 18, y1: ly, x2: 302, y2: ly, stroke: COL.line, 'stroke-width': 2.5 }));
  g.appendChild(mk('line', { x1: CX, y1: CY, x2: CX, y2: ly, stroke: COL.accent, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }));
  label(g, CX + 12, (CY + ly) / 2 + 4, 'p = ' + fmt(p), { fill: TINT.accent, size: 12, anchor: 'start' });
  label(g, CX + dr * 0.55, CY + 16, 'r = ' + fmt(r), { fill: TINT.circle, size: 12 });
  let posText = '–';
  if (isFinite(r) && isFinite(p)) {
    if (p > r) posText = 'Passing — no touch';
    else if (Math.abs(p - r) < 1e-9) { posText = 'Tangent — touches once'; g.appendChild(mk('circle', { cx: CX, cy: ly, r: 4, fill: COL.line })); }
    else {
      posText = 'Secant — crosses twice';
      const half = Math.sqrt(r * r - p * p) * k;
      g.appendChild(mk('circle', { cx: CX - half, cy: ly, r: 4, fill: COL.line }));
      g.appendChild(mk('circle', { cx: CX + half, cy: ly, r: 4, fill: COL.line }));
    }
  }
  captions(svg, [['Position of the line', posText, TINT.line]]);
  hintIfEmpty(svg, r === undefined && p === undefined);
  if (final) resultBadge(svg);
}

function figTangent(svg, v, final) {
  const g = layer(svg);
  const r = isFinite(v.r) ? v.r : undefined;
  const d = isFinite(v.d) ? v.d : undefined;
  const dr = dispR(r);
  const k = isFinite(r) && r > 0 ? dr / r : dr / 3;
  const dd = d === undefined ? dr + 70 : clamp(d * k, 4, 150);
  const Px = CX + dd, Py = CY;
  g.appendChild(mk('circle', { cx: CX, cy: CY, r: dr, fill: COL.circle, 'fill-opacity': 0.06, stroke: COL.circle, 'stroke-width': 2.5 }));
  g.appendChild(mk('circle', { cx: CX, cy: CY, r: 3, fill: COL.circle }));
  g.appendChild(mk('line', { x1: CX, y1: CY, x2: Px, y2: Py, stroke: COL.accent, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }));
  label(g, (CX + Px) / 2, CY - 8, 'd = ' + fmt(d), { fill: TINT.accent, size: 12 });
  label(g, CX - dr * 0.5, CY - 8, 'r = ' + fmt(r), { fill: TINT.circle, size: 12 });
  g.appendChild(mk('circle', { cx: Px, cy: Py, r: 3.5, fill: COL.chord }));
  if (isFinite(r) && isFinite(d) && d >= r && dd > dr) {
    const phi = Math.acos(clamp(dr / dd, -1, 1));
    const T1 = [CX + dr * Math.cos(phi), CY - dr * Math.sin(phi)];
    const T2 = [CX + dr * Math.cos(phi), CY + dr * Math.sin(phi)];
    g.appendChild(mk('line', { x1: Px, y1: Py, x2: T1[0], y2: T1[1], stroke: COL.chord, 'stroke-width': 2 }));
    g.appendChild(mk('line', { x1: Px, y1: Py, x2: T2[0], y2: T2[1], stroke: COL.chord, 'stroke-width': 2 }));
    g.appendChild(mk('circle', { cx: T1[0], cy: T1[1], r: 3, fill: COL.chord }));
    g.appendChild(mk('circle', { cx: T2[0], cy: T2[1], r: 3, fill: COL.chord }));
    label(g, (Px + T1[0]) / 2 + 6, (Py + T1[1]) / 2, 't', { fill: TINT.chord, size: 13 });
  }
  const inside = isFinite(r) && isFinite(d) && d < r;
  captions(svg, [['Tangent length √(d²−r²)', isFinite(r) && isFinite(d) && d >= r ? fmt(Math.sqrt(d * d - r * r)) : (inside ? 'point is inside' : '–'), TINT.chord]]);
  hintIfEmpty(svg, r === undefined && d === undefined);
  if (final) resultBadge(svg);
}

function figBisector(svg, v, final) {
  const g = layer(svg);
  const a = isFinite(v.a) ? v.a : undefined;
  const ang = a === undefined ? 80 : clamp(a, 2, 300);
  const Vx = 68, Vy = CY, L = 208;
  const up = ptOnC(Vx, Vy, L, ang / 2);
  const dn = ptOnC(Vx, Vy, L, -ang / 2);
  const bi = ptOnC(Vx, Vy, L, 0);
  g.appendChild(mk('line', { x1: Vx, y1: Vy, x2: up[0], y2: up[1], stroke: COL.circle, 'stroke-width': 2.5 }));
  g.appendChild(mk('line', { x1: Vx, y1: Vy, x2: dn[0], y2: dn[1], stroke: COL.circle, 'stroke-width': 2.5 }));
  g.appendChild(mk('line', { x1: Vx, y1: Vy, x2: bi[0], y2: bi[1], stroke: COL.accent, 'stroke-width': 2, 'stroke-dasharray': '6 4' }));
  g.appendChild(poly(arcPts(Vx, Vy, 52, -ang / 2, ang / 2, 30), { fill: 'none', stroke: COL.circle, 'stroke-width': 1.5 }));
  g.appendChild(mk('circle', { cx: Vx, cy: Vy, r: 3, fill: COL.circle }));
  const [alx, aly] = ptOnC(Vx, Vy, 66, 0);
  label(g, alx + 6, aly - 6, 'α = ' + (a === undefined ? '?' : fmt(a) + '°'), { fill: TINT.circle, size: 12, anchor: 'start' });
  const [h1x, h1y] = ptOnC(Vx, Vy, 112, ang / 4);
  const [h2x, h2y] = ptOnC(Vx, Vy, 112, -ang / 4);
  label(g, h1x, h1y - 4, a === undefined ? '?' : fmt(a / 2) + '°', { fill: TINT.accent, size: 11 });
  label(g, h2x, h2y + 12, a === undefined ? '?' : fmt(a / 2) + '°', { fill: TINT.accent, size: 11 });
  label(g, bi[0] - 4, Vy - 8, 'bisector', { fill: TINT.accent, size: 11, anchor: 'end' });
  captions(svg, [['Half angle α/2', a === undefined ? '–' : fmt(a / 2) + '°', TINT.accent]]);
  hintIfEmpty(svg, a === undefined);
  if (final) resultBadge(svg);
}

function figPi(svg, v, final) {
  const g = layer(svg);
  const dr = 108;
  g.appendChild(mk('circle', { cx: CX, cy: CY, r: dr, fill: COL.circle, 'fill-opacity': 0.06, stroke: COL.circle, 'stroke-width': 2.5 }));
  g.appendChild(mk('line', { x1: CX - dr, y1: CY, x2: CX + dr, y2: CY, stroke: COL.accent, 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
  const pi = mk('text', { x: CX, y: CY - 34, fill: COL.circle, 'font-size': 52, 'text-anchor': 'middle', 'font-family': 'Georgia, serif', 'font-weight': '600' });
  pi.textContent = 'π';
  g.appendChild(pi);
  label(g, CX, CY + 24, 'C = π · d', { fill: TINT.circle, size: 15 });
  captions(svg, [['π', fmt(Math.PI), TINT.circle], ['2π (full turn, rad)', fmt(2 * Math.PI), TINT.accent]]);
  if (final) resultBadge(svg);
}

function figPlaceholder(svg) {
  label(svg, CX, CY, 'Select a shape', { fill: COL.sub, size: 14, halo: null });
}

// Map each calculator id (from geometry.js CALCS) to its figure.
const FIGURES = {
  kreis: figCircle,
  bogen: figArc,
  ring: figRing,
  umfangswinkel: figAngles,
  lage: figLine,
  tangente: figTangent,
  winkelhalbierende: figBisector,
  pi: figPi,
};

// Public entry: clear the svg and (re)draw the figure for `id`.
export function drawGeometryFigure(svg, id, values, final) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  (FIGURES[id] || figPlaceholder)(svg, values || {}, !!final);
}
