// geometry.js — "Geometry" mode: circle geometry and related calculations.
// A config-driven form renders each calculator's inputs and results. Inputs
// accept expressions (e.g. 2*pi) via the safe parser. Angles are in degrees.
// The calculator picker is a custom dropdown so each entry can show a small
// diagram of what it does (native <select> options can't contain SVG).

import { el } from '../core/dom.js';
import { formatNumber } from '../core/format.js';
import { evaluate } from '../core/parser.js';
import * as history from '../core/history.js';

const TAU = Math.PI * 2;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

// Small diagrams (viewBox 40x40) illustrating each calculator.
const GEO_ICONS = {
  circle: '<circle cx="20" cy="20" r="13"/><line x1="20" y1="20" x2="33" y2="20"/><circle cx="20" cy="20" r="1.6" fill="currentColor" stroke="none"/>',
  arc: '<circle cx="20" cy="20" r="13"/><line x1="20" y1="20" x2="26.5" y2="8.7"/><line x1="20" y1="20" x2="32.8" y2="22.3"/><line x1="26.5" y1="8.7" x2="32.8" y2="22.3"/>',
  annulus: '<circle cx="20" cy="20" r="13"/><circle cx="20" cy="20" r="6.5"/>',
  angles: '<circle cx="20" cy="20" r="13"/><line x1="20" y1="20" x2="11" y2="28"/><line x1="20" y1="20" x2="29" y2="28"/><line x1="20" y1="7" x2="11" y2="28"/><line x1="20" y1="7" x2="29" y2="28"/>',
  lines: '<circle cx="20" cy="20" r="13"/><line x1="3" y1="4.5" x2="37" y2="4.5"/><line x1="3" y1="7" x2="37" y2="7"/><line x1="3" y1="15" x2="37" y2="15"/>',
  tangent: '<circle cx="20" cy="20" r="13"/><circle cx="36" cy="20" r="1.6" fill="currentColor" stroke="none"/><line x1="36" y1="20" x2="24" y2="10.5"/><line x1="36" y1="20" x2="24" y2="29.5"/>',
  bisector: '<path d="M8 33 L34 11"/><path d="M8 33 L34 35"/><path d="M8 33 L37 23" stroke-dasharray="3 2.5"/>',
  pi: '<circle cx="20" cy="20" r="13"/><text x="20" y="26.5" font-size="16" text-anchor="middle" fill="currentColor" stroke="none" font-family="serif">π</text>',
};

// Explicit pixel width/height (not Tailwind sizing classes) so the injected
// SVG always has a size, regardless of when the CDN's JIT runs.
function geoIcon(id, px = 32, colorCls = 'text-indigo-300') {
  const s = document.createElement('span');
  s.className = 'inline-flex shrink-0 ' + colorCls;
  s.innerHTML = `<svg width="${px}" height="${px}" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GEO_ICONS[id] || ''}</svg>`;
  return s;
}

// Each calculator: icon, inputs, require ('all' | 'one' | 'none'), and compute()
// returning rows [label, value, unit?] or throwing a string message.
export const CALCS = [
  {
    id: 'kreis', icon: 'circle',
    name: 'Circle: radius · diameter · circumference · area',
    require: 'one',
    hint: 'Enter exactly ONE value — the rest is calculated.',
    inputs: [
      { key: 'r', label: 'Radius r' },
      { key: 'd', label: 'Diameter d' },
      { key: 'U', label: 'Circumference U' },
      { key: 'A', label: 'Area A' },
    ],
    compute(v) {
      let r;
      if ('r' in v) r = v.r;
      else if ('d' in v) r = v.d / 2;
      else if ('U' in v) r = v.U / TAU;
      else { if (v.A < 0) throw 'Area must be ≥ 0.'; r = Math.sqrt(v.A / Math.PI); }
      if (r < 0) throw 'The radius must be ≥ 0.';
      return [
        ['Radius r', r], ['Diameter d = 2r', 2 * r],
        ['Circumference U = 2πr', TAU * r], ['Area A = πr²', Math.PI * r * r],
      ];
    },
  },
  {
    id: 'bogen', icon: 'arc',
    name: 'Arc · Sector · Segment · Chord',
    require: 'all',
    hint: 'Angle α in degrees.',
    inputs: [{ key: 'r', label: 'Radius r' }, { key: 'a', label: 'Central angle α', unit: '°' }],
    compute(v) {
      const { r, a } = v;
      if (r < 0) throw 'The radius must be ≥ 0.';
      const rad = toRad(a);
      return [
        ['Arc length b = r·α', r * rad],
        ['Chord s = 2r·sin(α/2)', 2 * r * Math.sin(rad / 2)],
        ['Sector area A = ½r²α', 0.5 * r * r * rad],
        ['Sector perimeter b + 2r', r * rad + 2 * r],
        ['Segment area ½r²(α − sin α)', 0.5 * r * r * (rad - Math.sin(rad))],
      ];
    },
  },
  {
    id: 'ring', icon: 'annulus',
    name: 'Annulus (circular ring)',
    require: 'all',
    hint: 'R = outer radius, r = inner radius (R ≥ r).',
    inputs: [{ key: 'R', label: 'Outer radius R' }, { key: 'r', label: 'Inner radius r' }],
    compute(v) {
      const { R, r } = v;
      if (R < 0 || r < 0) throw 'Radii must be ≥ 0.';
      if (R < r) throw 'Outer radius R must be ≥ inner radius r.';
      return [
        ['Ring area A = π(R² − r²)', Math.PI * (R * R - r * r)],
        ['Ring width R − r', R - r],
        ['Outer circumference 2πR', TAU * R],
        ['Inner circumference 2πr', TAU * r],
      ];
    },
  },
  {
    id: 'umfangswinkel', icon: 'angles',
    name: 'Central ↔ Inscribed angle',
    require: 'one',
    hint: 'Inscribed-angle theorem: central = 2 · inscribed. Enter exactly ONE.',
    inputs: [{ key: 'z', label: 'Central angle', unit: '°' }, { key: 'u', label: 'Inscribed angle', unit: '°' }],
    compute(v) {
      let z, u;
      if ('z' in v) { z = v.z; u = z / 2; } else { u = v.u; z = 2 * u; }
      const rows = [['Central angle', z, '°'], ['Inscribed angle', u, '°']];
      if (Math.abs(u - 90) < 1e-9) rows.push(['Note', "Thales' theorem: chord = diameter"]);
      return rows;
    },
  },
  {
    id: 'lage', icon: 'lines',
    name: 'Line & circle: passing / tangent / secant',
    require: 'all',
    hint: 'p = distance from the line to the center.',
    inputs: [{ key: 'r', label: 'Radius r' }, { key: 'p', label: 'Distance p' }],
    compute(v) {
      const { r, p } = v;
      if (r < 0 || p < 0) throw 'Values must be ≥ 0.';
      const rows = [];
      if (p > r) rows.push(['Position', 'Passing line — no intersection'], ['Distance to circle p − r', p - r]);
      else if (Math.abs(p - r) < 1e-9) rows.push(['Position', 'Tangent — one point of contact']);
      else rows.push(['Position', 'Secant — two intersections'], ['Chord length 2·√(r² − p²)', 2 * Math.sqrt(r * r - p * p)]);
      return rows;
    },
  },
  {
    id: 'tangente', icon: 'tangent',
    name: 'Tangent length from a point',
    require: 'all',
    hint: 'd = distance of the point from the center.',
    inputs: [{ key: 'r', label: 'Radius r' }, { key: 'd', label: 'Distance point–center d' }],
    compute(v) {
      const { r, d } = v;
      if (r < 0 || d < 0) throw 'Values must be ≥ 0.';
      if (d < r) throw 'The point lies inside the circle (d < r).';
      return [
        ['Tangent length t = √(d² − r²)', Math.sqrt(d * d - r * r)],
        ['Angle tangent–radius', toDeg(Math.acos(r / d)), '°'],
      ];
    },
  },
  {
    id: 'winkelhalbierende', icon: 'bisector',
    name: 'Angle bisector',
    require: 'all',
    hint: 'Bisects the angle α.',
    inputs: [{ key: 'a', label: 'Angle α', unit: '°' }],
    compute(v) {
      return [['Half angle α/2', v.a / 2, '°'], ['Two partial angles each', v.a / 2, '°']];
    },
  },
  {
    id: 'pi', icon: 'pi',
    name: 'Pi (π)',
    require: 'none',
    hint: 'The constant π.',
    inputs: [],
    compute() {
      return [['π', Math.PI], ['2π (full angle in radians)', TAU], ['π/180 (1° in radians)', Math.PI / 180]];
    },
  },
];

export function mountGeometry(container) {
  let current = CALCS[0];
  const fieldEls = {}; // key -> input element

  // --- custom picker (dropdown with a diagram per entry) ---
  const picker = el('div', { className: 'relative' });
  const pbIcon = el('span', { className: 'text-indigo-300' });
  const pbLabel = el('span', { className: 'flex-1 text-sm truncate' });
  const pickerBtn = el('button', {
    className: 'w-full flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-2.5 text-left transition-colors',
    attrs: { type: 'button', 'aria-haspopup': 'listbox' },
  }, [pbIcon, pbLabel, el('span', { className: 'text-slate-400 text-xs', text: '▼' })]);

  const menu = el('div', {
    className: 'absolute left-0 right-0 mt-1 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-72 overflow-auto hidden',
    attrs: { role: 'listbox' },
  });
  CALCS.forEach((c) => {
    menu.appendChild(el('button', {
      className: 'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-700 transition-colors',
      attrs: { type: 'button', role: 'option' },
      onClick: () => selectCalc(c),
    }, [geoIcon(c.icon, 38), el('span', { className: 'text-sm truncate', text: c.name })]));
  });
  picker.appendChild(pickerBtn);
  picker.appendChild(menu);

  pickerBtn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); });
  document.addEventListener('click', (e) => { if (!picker.contains(e.target)) menu.classList.add('hidden'); });

  function setPicker() {
    pbIcon.innerHTML = '';
    pbIcon.appendChild(geoIcon(current.icon, 30));
    pbLabel.textContent = current.name;
  }
  function selectCalc(c) { current = c; setPicker(); buildForm(); menu.classList.add('hidden'); }

  // --- form + results ---
  const hint = el('p', { className: 'text-xs text-slate-400 mt-2' });
  const form = el('div', { className: 'space-y-3 mt-3' });
  const result = el('div', {
    className: 'mt-4 rounded-xl bg-slate-800/60 border border-slate-700 p-3 text-sm min-h-[3rem] text-slate-300',
    text: 'Enter values and calculate.',
  });
  const calcBtn = el('button', {
    className: 'mt-4 w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors active:scale-95',
    text: 'Calculate', attrs: { type: 'button' }, onClick: run,
  });

  function buildForm() {
    form.innerHTML = '';
    for (const key of Object.keys(fieldEls)) delete fieldEls[key];
    hint.textContent = current.hint || '';
    current.inputs.forEach((f) => {
      const input = el('input', {
        className: 'w-full bg-slate-800 text-slate-100 rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-indigo-400',
        attrs: { type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': f.label },
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
      fieldEls[f.key] = input;
      const unit = f.unit ? ` <span class="text-slate-500">(${f.unit})</span>` : '';
      form.appendChild(el('label', { className: 'block' }, [
        el('span', { className: 'text-sm text-slate-300', html: f.label + unit }),
        el('div', { className: 'mt-1' }, [input]),
      ]));
    });
    result.textContent = 'Enter values and calculate.';
    result.classList.remove('text-rose-400');
  }

  function run() {
    // Parse each filled field via the safe parser (allows expressions like 2*pi).
    const values = {};
    let parseError = null;
    current.inputs.forEach((f) => {
      const raw = fieldEls[f.key].value.trim();
      if (raw === '') return;
      const r = evaluate(raw);
      if (!r.ok) parseError = `"${raw}" is not a valid number.`;
      else values[f.key] = r.value;
    });
    if (parseError) return showError(parseError);

    const filled = Object.keys(values).length;
    if (current.require === 'all' && filled < current.inputs.length) return showError('Please fill in all fields.');
    if (current.require === 'one' && filled !== 1) return showError('Please enter exactly ONE value.');

    let rows;
    try { rows = current.compute(values); }
    catch (msg) { return showError(typeof msg === 'string' ? msg : 'Invalid input.'); }

    renderRows(rows);
    // Push a concise summary to history.
    const primary = rows.find((r) => typeof r[1] === 'number');
    if (primary) {
      const inSummary = current.inputs.map((f) => (f.key in values ? `${f.key}=${formatNumber(values[f.key])}` : null)).filter(Boolean).join(', ');
      history.add(`${current.name}${inSummary ? ' [' + inSummary + ']' : ''}`,
        `${primary[0]} = ${formatNumber(primary[1])}${primary[2] || ''}`, { mode: 'geometry' });
    }
  }

  function renderRows(rows) {
    result.classList.remove('text-rose-400');
    result.innerHTML = '';
    const list = el('div', { className: 'space-y-1.5' });
    rows.forEach(([label, value, unit]) => {
      const val = typeof value === 'number' ? `${formatNumber(value)}${unit || ''}` : String(value);
      list.appendChild(el('div', { className: 'flex justify-between gap-3' }, [
        el('span', { className: 'text-slate-400', text: label }),
        el('span', { className: 'font-semibold text-indigo-300 text-right', text: val }),
      ]));
    });
    result.appendChild(list);
  }

  function showError(msg) { result.classList.add('text-rose-400'); result.textContent = msg; }

  container.appendChild(picker);
  container.appendChild(hint);
  container.appendChild(form);
  container.appendChild(calcBtn);
  container.appendChild(result);
  setPicker();
  buildForm();
}
