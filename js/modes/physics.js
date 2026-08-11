// physics.js — Newton's second law, F = m · a.
// Fill any two fields and leave one blank; the third is solved and written to
// history. Each field is clearly labeled with its SI unit.

import { el } from '../core/dom.js';
import { formatNumber } from '../core/format.js';
import * as history from '../core/history.js';

const SVGNS = 'http://www.w3.org/2000/svg';

export function mountPhysics(container, viz) {
  const fields = {}; // name -> input element

  // --- live force diagram (right column) ---
  const figure = document.createElementNS(SVGNS, 'svg');
  figure.setAttribute('viewBox', '0 0 320 210');
  figure.setAttribute('class', 'w-full h-auto max-w-sm mx-auto lg:max-w-none block');
  figure.setAttribute('aria-label', 'Force diagram of F = m · a');
  const readNum = (name) => { const v = Number((fields[name] && fields[name].value.trim()) || ''); return fields[name] && fields[name].value.trim() !== '' && Number.isFinite(v) ? v : undefined; };
  const updateFigure = (final = false) => drawForce(figure, { F: readNum('F'), m: readNum('m'), a: readNum('a') }, final);

  function field(name, label, unit) {
    const input = el('input', {
      className:
        'w-full bg-slate-800 text-slate-100 text-lg rounded-xl px-4 py-3 ' +
        'border border-slate-700 focus:border-indigo-400 focus:outline-none ' +
        'focus:ring-2 focus:ring-indigo-400/40',
      attrs: { type: 'text', inputmode: 'decimal', placeholder: 'leave blank to solve', 'aria-label': label },
    });
    input.addEventListener('input', () => updateFigure(false));
    fields[name] = input;
    return el('label', { className: 'block' }, [
      el('span', { className: 'text-sm text-slate-300', html: `${label} <span class="text-slate-500">(${unit})</span>` }),
      el('div', { className: 'mt-1' }, [input]),
    ]);
  }

  const output = el('div', {
    className: 'mt-4 min-h-[3.5rem] rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3 text-slate-100',
    text: 'Enter two values, leave one blank.',
  });

  function solve() {
    const raw = {
      F: fields.F.value.trim(),
      m: fields.m.value.trim(),
      a: fields.a.value.trim(),
    };
    const blanks = Object.keys(raw).filter((k) => raw[k] === '');
    if (blanks.length !== 1) {
      showError('Leave exactly one field blank to solve for it.');
      return;
    }
    // Parse the two provided values.
    const nums = {};
    for (const k of Object.keys(raw)) {
      if (raw[k] === '') continue;
      const v = Number(raw[k]);
      if (!Number.isFinite(v)) { showError(`"${raw[k]}" is not a valid number.`); return; }
      nums[k] = v;
    }

    const target = blanks[0];
    let value, expr;
    if (target === 'F') { value = nums.m * nums.a; expr = `F = m·a = ${fmt(nums.m)}·${fmt(nums.a)}`; }
    else if (target === 'm') {
      if (nums.a === 0) { showError('Cannot solve for m when a = 0.'); return; }
      value = nums.F / nums.a; expr = `m = F/a = ${fmt(nums.F)}/${fmt(nums.a)}`;
    } else {
      if (nums.m === 0) { showError('Cannot solve for a when m = 0.'); return; }
      value = nums.F / nums.m; expr = `a = F/m = ${fmt(nums.F)}/${fmt(nums.m)}`;
    }

    const unit = target === 'F' ? 'N' : target === 'm' ? 'kg' : 'm/s²';
    const resultStr = `${formatNumber(value)} ${unit}`;
    fields[target].value = formatNumber(value);
    output.className = output.className.replace('text-rose-300', 'text-slate-100');
    output.innerHTML = `<span class="text-slate-400 text-sm">${expr} =</span> <span class="text-indigo-300 font-semibold">${resultStr}</span>`;
    history.add(expr, resultStr, { mode: 'physics' });
    updateFigure(true);
  }

  function showError(msg) {
    output.textContent = msg;
    if (!output.className.includes('text-rose-300')) output.className += ' text-rose-300';
  }

  const solveBtn = el('button', {
    className: 'mt-4 w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors active:scale-95',
    text: 'Solve  F = m · a',
    attrs: { type: 'button' },
    onClick: solve,
  });

  const clearBtn = el('button', {
    className: 'mt-2 w-full h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors',
    text: 'Clear fields',
    attrs: { type: 'button' },
    onClick: () => { fields.F.value = ''; fields.m.value = ''; fields.a.value = ''; output.textContent = 'Enter two values, leave one blank.'; updateFigure(false); },
  });

  container.appendChild(el('div', { className: 'space-y-3' }, [
    field('F', 'Force  F', 'N'),
    field('m', 'Mass  m', 'kg'),
    field('a', 'Acceleration  a', 'm/s²'),
  ]));
  container.appendChild(solveBtn);
  container.appendChild(clearBtn);
  container.appendChild(output);

  // Right column: the live force diagram.
  if (viz) {
    viz.appendChild(el('div', {
      className: 'rounded-2xl bg-slate-900 border border-slate-700 p-3 sm:p-4',
    }, [
      el('p', { className: 'text-xs font-medium text-slate-400 mb-1', text: 'Force diagram' }),
      figure,
    ]));
  }
  updateFigure();
}

function fmt(n) { return formatNumber(n); }

// Draw the F = m·a picture: a mass block pushed by a force, with an
// acceleration arrow. Arrow lengths grow with magnitude (schematic).
function drawForce(svg, vals, final) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const mk = (tag, attrs) => { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  const has = (x) => typeof x === 'number' && isFinite(x);
  const f = (x) => (has(x) ? formatNumber(x) : '?');
  const COL = { m: '#818cf8', F: '#f472b6', a: '#fbbf24', text: '#e2e8f0', sub: '#94a3b8', bg: '#0f172a' };

  // arrowhead marker
  const defs = mk('defs', {});
  ['F', 'a'].forEach((k) => {
    const mrk = mk('marker', { id: 'ph-' + k, markerWidth: '9', markerHeight: '9', refX: '6', refY: '3', orient: 'auto', markerUnits: 'strokeWidth' });
    mrk.appendChild(mk('path', { d: 'M0,0 L6,3 L0,6 Z', fill: COL[k] }));
    defs.appendChild(mrk);
  });
  svg.appendChild(defs);

  const label = (x, y, s, o = {}) => {
    const t = mk('text', { x, y, fill: o.fill || COL.text, 'font-size': o.size || 13, 'text-anchor': o.anchor || 'middle', 'font-weight': o.weight || '600', 'font-family': 'ui-sans-serif, system-ui, sans-serif', stroke: COL.bg, 'stroke-width': '3.5', 'paint-order': 'stroke', 'stroke-linejoin': 'round' });
    t.textContent = s;
    svg.appendChild(t);
  };

  // ground
  svg.appendChild(mk('line', { x1: 20, y1: 150, x2: 300, y2: 150, stroke: '#334155', 'stroke-width': 2 }));
  // mass block — size grows a little with m
  const m = vals.m, F = vals.F, a = vals.a;
  const bw = has(m) ? Math.max(44, Math.min(96, 40 + Math.cbrt(Math.abs(m)) * 22)) : 60;
  const bx = 120, by = 150, bh = bw * 0.8;
  svg.appendChild(mk('rect', { x: bx - bw / 2, y: by - bh, width: bw, height: bh, rx: 6, fill: COL.m, 'fill-opacity': 0.18, stroke: COL.m, 'stroke-width': 2 }));
  label(bx, by - bh / 2 + 4, 'm = ' + f(m) + (has(m) ? ' kg' : ''), { fill: '#c7d2fe', size: 12 });

  const arrowLen = (v) => Math.max(24, Math.min(120, Math.abs(v) * 4 + 18));
  // Force arrow (from the block, horizontal)
  const fy = by - bh - 22;
  if (has(F) || !has(m) || !has(a)) {
    const dir = has(F) ? Math.sign(F) || 1 : 1;
    const len = has(F) ? arrowLen(F) : 60;
    const x0 = bx, x1 = bx + dir * len;
    svg.appendChild(mk('line', { x1: x0, y1: fy, x2: x1, y2: fy, stroke: COL.F, 'stroke-width': 3, 'marker-end': 'url(#ph-F)' }));
    label((x0 + x1) / 2, fy - 8, 'F = ' + f(F) + (has(F) ? ' N' : ''), { fill: '#f9a8d4', size: 12 });
  }
  // Acceleration arrow (below the force, same direction)
  const ay = by + 26;
  const adir = has(a) ? Math.sign(a) || 1 : (has(F) ? Math.sign(F) || 1 : 1);
  const alen = has(a) ? arrowLen(a) : 54;
  svg.appendChild(mk('line', { x1: bx, y1: ay, x2: bx + adir * alen, y2: ay, stroke: COL.a, 'stroke-width': 3, 'marker-end': 'url(#ph-a)' }));
  label(bx + (adir * alen) / 2, ay + 16, 'a = ' + f(a) + (has(a) ? ' m/s²' : ''), { fill: '#fcd34d', size: 12 });

  // formula caption
  label(160, 196, 'F = m · a', { fill: COL.sub, size: 13, weight: '700' });
  if (final) {
    svg.appendChild(mk('rect', { x: 236, y: 8, width: 74, height: 22, rx: 11, fill: COL.m, 'fill-opacity': 0.18, stroke: COL.m, 'stroke-width': 1 }));
    label(273, 23, '✓ solved', { fill: '#c7d2fe', size: 12 });
  }
}
