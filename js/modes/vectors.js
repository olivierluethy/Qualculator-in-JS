// vectors.js — interactive 2D coordinate plane with two vectors A and B.
// Plot by typing components or by dragging the arrow tips. Compute vector
// operations (and interpret A, B as forces to get the resultant). Every
// computed result is pushed to history.

import { el } from '../core/dom.js';
import { formatNumber, formatVector } from '../core/format.js';
import * as history from '../core/history.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const SCALE = 18;   // pixels per world unit
const CX = 200, CY = 200; // svg center
const RANGE = 10;   // world extent in each direction (-10..10)

// Two live vectors. Colors match the arrows on the plane.
const A = { x: 4, y: 3, color: '#818cf8', name: 'A' };   // indigo
const B = { x: -3, y: 5, color: '#34d399', name: 'B' };  // emerald
let result = null; // optional derived vector to draw, e.g. A+B (amber)

// --- world <-> svg coordinate mapping ---
const toSvgX = (wx) => CX + wx * SCALE;
const toSvgY = (wy) => CY - wy * SCALE;
const toWorldX = (sx) => (sx - CX) / SCALE;
const toWorldY = (sy) => (CY - sy) / SCALE;
const clamp = (v) => Math.max(-RANGE, Math.min(RANGE, v));
const snap = (v) => Math.round(v * 2) / 2; // snap dragging to 0.5

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export function mountVectors(controls, viz) {
  let inputs = {}; // 'Ax','Ay','Bx','By' -> input elements
  let readout;

  // ---- SVG plane -------------------------------------------------------
  const svg = svgEl('svg', {
    viewBox: '0 0 400 400',
    class: 'w-full max-w-md mx-auto lg:max-w-none touch-none select-none rounded-xl bg-slate-900 border border-slate-700 block',
    'aria-label': '2D vector plane',
  });
  // arrowhead marker
  const defs = svgEl('defs');
  const marker = svgEl('marker', { id: 'vhead', markerWidth: '10', markerHeight: '10', refX: '7', refY: '3', orient: 'auto', markerUnits: 'strokeWidth' });
  marker.appendChild(svgEl('path', { d: 'M0,0 L7,3 L0,6 Z', fill: 'context-stroke' }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  const gridLayer = svgEl('g');
  const vectorLayer = svgEl('g');
  svg.appendChild(gridLayer);
  svg.appendChild(vectorLayer);

  drawGrid(gridLayer);

  // ---- redraw the vectors + result ----
  function redraw() {
    while (vectorLayer.firstChild) vectorLayer.removeChild(vectorLayer.firstChild);
    if (result) drawArrow(vectorLayer, result, '#f59e0b', 'R', false); // amber resultant
    drawArrow(vectorLayer, A, A.color, 'A', true);
    drawArrow(vectorLayer, B, B.color, 'B', true);
    // sync inputs with current values
    if (inputs.Ax) {
      inputs.Ax.value = formatNumber(A.x); inputs.Ay.value = formatNumber(A.y);
      inputs.Bx.value = formatNumber(B.x); inputs.By.value = formatNumber(B.y);
    }
  }

  // ---- draggable arrow tips ----
  function drawArrow(layer, vec, color, label, draggable) {
    const [x2, y2] = [toSvgX(vec.x), toSvgY(vec.y)];
    const line = svgEl('line', { x1: CX, y1: CY, x2, y2, stroke: color, 'stroke-width': '2.5', 'marker-end': 'url(#vhead)' });
    layer.appendChild(line);
    // label near the tip
    const lbl = svgEl('text', { x: x2 + 6, y: y2 - 6, fill: color, 'font-size': '13', 'font-weight': '600' });
    lbl.textContent = `${label}(${formatNumber(vec.x)}, ${formatNumber(vec.y)})`;
    layer.appendChild(lbl);
    if (!draggable) return;
    const handle = svgEl('circle', { cx: x2, cy: y2, r: '9', fill: color, 'fill-opacity': '0.35', stroke: color, 'stroke-width': '2', class: 'cursor-grab' });
    handle.addEventListener('pointerdown', (e) => startDrag(e, vec));
    layer.appendChild(handle);
  }

  function startDrag(e, vec) {
    e.preventDefault();
    const move = (ev) => {
      const rect = svg.getBoundingClientRect();
      // map client px -> viewBox (400 units) -> world
      const vbx = ((ev.clientX - rect.left) / rect.width) * 400;
      const vby = ((ev.clientY - rect.top) / rect.height) * 400;
      vec.x = clamp(snap(toWorldX(vbx)));
      vec.y = clamp(snap(toWorldY(vby)));
      redraw();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // ---- component inputs ------------------------------------------------
  function vecInputs(vec, colorClass) {
    const mk = (axis) => {
      const input = el('input', {
        className: 'w-20 bg-slate-800 text-slate-100 rounded-lg px-2 py-1.5 border border-slate-700 focus:border-indigo-400 focus:outline-none text-center',
        attrs: { type: 'text', inputmode: 'decimal', 'aria-label': `${vec.name} ${axis}` },
        value: formatNumber(vec[axis]),
      });
      input.addEventListener('input', () => {
        const v = Number(input.value);
        if (Number.isFinite(v)) { vec[axis] = v; redraw(); }
      });
      inputs[vec.name + axis] = input;
      return input;
    };
    return el('div', { className: 'flex items-center gap-2' }, [
      el('span', { className: `font-semibold ${colorClass}`, text: vec.name }),
      el('span', { className: 'text-slate-500', text: '(' }),
      mk('x'),
      el('span', { className: 'text-slate-500', text: ',' }),
      mk('y'),
      el('span', { className: 'text-slate-500', text: ')' }),
    ]);
  }

  // ---- operations ------------------------------------------------------
  readout = el('div', {
    className: 'mt-3 min-h-[3rem] rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3 text-slate-100 text-sm',
    text: 'Drag the arrow tips or type components, then pick an operation.',
  });

  function show(expr, resultStr) {
    readout.innerHTML = `<span class="text-slate-400">${expr} =</span> <span class="text-indigo-300 font-semibold">${resultStr}</span>`;
    history.add(expr, resultStr, { mode: 'vectors' });
  }
  const mag = (v) => Math.hypot(v.x, v.y);

  const ops = [
    ['A + B', () => { result = { x: A.x + B.x, y: A.y + B.y }; redraw(); show('A + B', formatVector(result)); }],
    ['A − B', () => { result = { x: A.x - B.x, y: A.y - B.y }; redraw(); show('A − B', formatVector(result)); }],
    ['|A|', () => show('|A|', formatNumber(mag(A)))],
    ['|B|', () => show('|B|', formatNumber(mag(B)))],
    ['A · B', () => show('A · B', formatNumber(A.x * B.x + A.y * B.y))],
    ['A × B', () => show('A × B (determinant)', formatNumber(A.x * B.y - A.y * B.x))],
    ['∠(A,B)', () => {
      const denom = mag(A) * mag(B);
      if (denom === 0) { readout.textContent = 'Angle undefined for a zero vector.'; return; }
      let cos = (A.x * B.x + A.y * B.y) / denom;
      cos = Math.max(-1, Math.min(1, cos));
      show('∠(A, B)', `${formatNumber((Math.acos(cos) * 180) / Math.PI)}°`);
    }],
    ['Resultant force', () => {
      result = { x: A.x + B.x, y: A.y + B.y };
      redraw();
      const m = mag(result);
      const dir = (Math.atan2(result.y, result.x) * 180) / Math.PI;
      show('Resultant force A + B', `${formatVector(result)}, |R| = ${formatNumber(m)} N at ${formatNumber(dir)}°`);
    }],
  ];
  const scalarInput = el('input', {
    className: 'w-16 bg-slate-800 text-slate-100 rounded-lg px-2 py-1.5 border border-slate-700 focus:border-indigo-400 focus:outline-none text-center',
    attrs: { type: 'text', inputmode: 'decimal', 'aria-label': 'scalar k' }, value: '2',
  });

  // Operation buttons: the last-used one stays visibly highlighted as active.
  const opButtons = [];
  const setActiveOp = (btn) => opButtons.forEach((b) => { b.className = opClass(b === btn); });
  const opGrid = el('div', { className: 'grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3' });
  ops.forEach(([label, fn]) => {
    const b = el('button', {
      className: opClass(false), text: label, attrs: { type: 'button' },
      onClick: () => { setActiveOp(b); fn(); },
    });
    opButtons.push(b);
    opGrid.appendChild(b);
  });

  // scalar multiply row (uses the scalar input)
  const kaBtn = el('button', {
    className: opClass(false),
    text: 'k · A', attrs: { type: 'button' },
    onClick: () => {
      const k = Number(scalarInput.value);
      if (!Number.isFinite(k)) { readout.textContent = 'k must be a number.'; return; }
      setActiveOp(kaBtn);
      result = { x: k * A.x, y: k * A.y }; redraw();
      show(`${formatNumber(k)} · A`, formatVector(result));
    },
  });
  opButtons.push(kaBtn);
  const scalarRow = el('div', { className: 'flex items-center gap-2 mt-2' }, [
    el('span', { className: 'text-sm text-slate-300', text: 'k =' }),
    scalarInput,
    kaBtn,
    el('button', {
      className: 'h-11 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors ml-auto',
      text: 'Clear R', attrs: { type: 'button' },
      onClick: () => { result = null; setActiveOp(null); redraw(); readout.textContent = 'Resultant cleared.'; },
    }),
  ]);

  // ---- assemble: plane on the right, controls on the left -------------
  viz.appendChild(el('div', {
    className: 'rounded-2xl bg-slate-900 border border-slate-700 p-3 sm:p-4',
  }, [
    el('p', { className: 'text-xs font-medium text-slate-400 mb-1', text: 'Vector plane — drag the arrow tips' }),
    svg,
  ]));
  controls.appendChild(el('div', { className: 'flex flex-wrap gap-4' }, [
    vecInputs(A, 'text-indigo-400'),
    vecInputs(B, 'text-emerald-400'),
  ]));
  controls.appendChild(opGrid);
  controls.appendChild(scalarRow);
  controls.appendChild(readout);

  redraw();
}

// An operation button: highlighted (indigo) when it is the active operation.
function opClass(active) {
  return (
    'h-11 px-4 rounded-xl text-sm font-medium transition-colors active:scale-95 ' +
    (active
      ? 'bg-indigo-600 text-white ring-1 ring-indigo-400/50'
      : 'bg-slate-800 hover:bg-slate-700 text-indigo-200')
  );
}

// Draw grid lines, axes, ticks and labels once.
function drawGrid(layer) {
  for (let i = -RANGE; i <= RANGE; i++) {
    const isAxis = i === 0;
    // vertical
    layer.appendChild(svgEl('line', {
      x1: toSvgX(i), y1: toSvgY(-RANGE), x2: toSvgX(i), y2: toSvgY(RANGE),
      stroke: isAxis ? '#64748b' : '#1e293b', 'stroke-width': isAxis ? '1.5' : '1',
    }));
    // horizontal
    layer.appendChild(svgEl('line', {
      x1: toSvgX(-RANGE), y1: toSvgY(i), x2: toSvgX(RANGE), y2: toSvgY(i),
      stroke: isAxis ? '#64748b' : '#1e293b', 'stroke-width': isAxis ? '1.5' : '1',
    }));
    // axis number labels every 5 units (skip 0)
    if (i !== 0 && i % 5 === 0) {
      const xl = svgEl('text', { x: toSvgX(i), y: toSvgY(0) + 14, fill: '#94a3b8', 'font-size': '10', 'text-anchor': 'middle' });
      xl.textContent = String(i);
      layer.appendChild(xl);
      const yl = svgEl('text', { x: toSvgX(0) + 6, y: toSvgY(i) + 3, fill: '#94a3b8', 'font-size': '10' });
      yl.textContent = String(i);
      layer.appendChild(yl);
    }
  }
}
