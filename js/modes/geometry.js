// geometry.js — "Geometrie" mode: circle geometry (Kreisgeometrie) and related
// calculations. A single config-driven form renders each calculator's inputs
// and results. Inputs accept expressions (e.g. 2*pi) via the safe parser.
// Angles are entered in degrees.

import { el } from '../core/dom.js';
import { formatNumber } from '../core/format.js';
import { evaluate } from '../core/parser.js';
import * as history from '../core/history.js';

const TAU = Math.PI * 2;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

// Each calculator: inputs (fields), require ('all' | 'one'), and compute() that
// returns an array of [label, value, unit?] rows or throws a string message.
export const CALCS = [
  {
    id: 'kreis',
    name: 'Kreis: Radius · Durchmesser · Umfang · Fläche',
    require: 'one',
    hint: 'Gib genau EINEN Wert ein — der Rest wird berechnet.',
    inputs: [
      { key: 'r', label: 'Radius r' },
      { key: 'd', label: 'Durchmesser d' },
      { key: 'U', label: 'Umfang U' },
      { key: 'A', label: 'Flächeninhalt A' },
    ],
    compute(v) {
      let r;
      if ('r' in v) r = v.r;
      else if ('d' in v) r = v.d / 2;
      else if ('U' in v) r = v.U / TAU;
      else { if (v.A < 0) throw 'A muss ≥ 0 sein.'; r = Math.sqrt(v.A / Math.PI); }
      if (r < 0) throw 'Der Radius muss ≥ 0 sein.';
      return [
        ['Radius r', r], ['Durchmesser d', 2 * r],
        ['Umfang U = 2πr', TAU * r], ['Flächeninhalt A = πr²', Math.PI * r * r],
      ];
    },
  },
  {
    id: 'bogen',
    name: 'Kreisbogen · Kreissektor · Kreissegment · Sehne',
    require: 'all',
    hint: 'Winkel α im Gradmaß.',
    inputs: [{ key: 'r', label: 'Radius r' }, { key: 'a', label: 'Mittelpunktswinkel α', unit: '°' }],
    compute(v) {
      const { r, a } = v;
      if (r < 0) throw 'Der Radius muss ≥ 0 sein.';
      const rad = toRad(a);
      return [
        ['Kreisbogen b = r·α', r * rad],
        ['Sehne s = 2r·sin(α/2)', 2 * r * Math.sin(rad / 2)],
        ['Sektorfläche A = ½r²α', 0.5 * r * r * rad],
        ['Sektor-Umfang b + 2r', r * rad + 2 * r],
        ['Segmentfläche ½r²(α − sin α)', 0.5 * r * r * (rad - Math.sin(rad))],
      ];
    },
  },
  {
    id: 'ring',
    name: 'Kreisring (Annulus)',
    require: 'all',
    hint: 'R = Außenradius, r = Innenradius (R ≥ r).',
    inputs: [{ key: 'R', label: 'Außenradius R' }, { key: 'r', label: 'Innenradius r' }],
    compute(v) {
      const { R, r } = v;
      if (R < 0 || r < 0) throw 'Radien müssen ≥ 0 sein.';
      if (R < r) throw 'Außenradius R muss ≥ Innenradius r sein.';
      return [
        ['Ringfläche A = π(R² − r²)', Math.PI * (R * R - r * r)],
        ['Ringbreite R − r', R - r],
        ['Umfang außen 2πR', TAU * R],
        ['Umfang innen 2πr', TAU * r],
      ];
    },
  },
  {
    id: 'umfangswinkel',
    name: 'Zentriwinkel ↔ Umfangswinkel',
    require: 'one',
    hint: 'Umfangswinkelsatz: Zentriwinkel = 2 · Umfangswinkel. Gib genau EINEN ein.',
    inputs: [{ key: 'z', label: 'Zentriwinkel', unit: '°' }, { key: 'u', label: 'Umfangswinkel', unit: '°' }],
    compute(v) {
      let z, u;
      if ('z' in v) { z = v.z; u = z / 2; } else { u = v.u; z = 2 * u; }
      const rows = [['Zentriwinkel', z, '°'], ['Umfangswinkel', u, '°']];
      if (Math.abs(u - 90) < 1e-9) rows.push(['Hinweis', 'Thaleskreis: Sehne = Durchmesser']);
      return rows;
    },
  },
  {
    id: 'lage',
    name: 'Gerade & Kreis: Passante / Tangente / Sekante',
    require: 'all',
    hint: 'p = Abstand der Geraden vom Mittelpunkt.',
    inputs: [{ key: 'r', label: 'Radius r' }, { key: 'p', label: 'Abstand p' }],
    compute(v) {
      const { r, p } = v;
      if (r < 0 || p < 0) throw 'Werte müssen ≥ 0 sein.';
      const rows = [];
      if (p > r) rows.push(['Lage', 'Passante — kein Schnittpunkt'], ['Abstand zum Kreis p − r', p - r]);
      else if (Math.abs(p - r) < 1e-9) rows.push(['Lage', 'Tangente — ein Berührpunkt']);
      else rows.push(['Lage', 'Sekante — zwei Schnittpunkte'], ['Sehnenlänge 2·√(r² − p²)', 2 * Math.sqrt(r * r - p * p)]);
      return rows;
    },
  },
  {
    id: 'tangente',
    name: 'Tangentenlänge von einem Punkt',
    require: 'all',
    hint: 'd = Abstand des Punktes vom Mittelpunkt.',
    inputs: [{ key: 'r', label: 'Radius r' }, { key: 'd', label: 'Abstand Punkt–Mittelpunkt d' }],
    compute(v) {
      const { r, d } = v;
      if (r < 0 || d < 0) throw 'Werte müssen ≥ 0 sein.';
      if (d < r) throw 'Der Punkt liegt innerhalb des Kreises (d < r).';
      return [
        ['Tangentenlänge t = √(d² − r²)', Math.sqrt(d * d - r * r)],
        ['Winkel Tangente–Radius', toDeg(Math.acos(r / d)), '°'],
      ];
    },
  },
  {
    id: 'winkelhalbierende',
    name: 'Winkelhalbierende',
    require: 'all',
    hint: 'Halbiert den Winkel α.',
    inputs: [{ key: 'a', label: 'Winkel α', unit: '°' }],
    compute(v) {
      return [['Halber Winkel α/2', v.a / 2, '°'], ['Zwei Teilwinkel je', v.a / 2, '°']];
    },
  },
  {
    id: 'pi',
    name: 'Kreiszahl π',
    require: 'none',
    hint: 'Die Konstante π.',
    inputs: [],
    compute() {
      return [['π', Math.PI], ['2π (Vollwinkel im Bogenmaß)', TAU], ['π/180 (1° in rad)', Math.PI / 180]];
    },
  },
];

export function mountGeometry(container) {
  let current = CALCS[0];
  const fieldEls = {}; // key -> input element

  const select = el('select', {
    className: 'w-full bg-slate-800 text-slate-100 rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-indigo-400 text-sm',
  }, CALCS.map((c) => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.name; return o;
  }));

  const hint = el('p', { className: 'text-xs text-slate-400 mt-2' });
  const form = el('div', { className: 'space-y-3 mt-3' });
  const result = el('div', {
    className: 'mt-4 rounded-xl bg-slate-800/60 border border-slate-700 p-3 text-sm min-h-[3rem] text-slate-300',
    text: 'Werte eingeben und berechnen.',
  });

  const calcBtn = el('button', {
    className: 'mt-4 w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors active:scale-95',
    text: 'Berechnen', attrs: { type: 'button' }, onClick: run,
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
    result.textContent = 'Werte eingeben und berechnen.';
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
      if (!r.ok) parseError = `"${raw}" ist keine gültige Zahl.`;
      else values[f.key] = r.value;
    });
    if (parseError) return showError(parseError);

    // Validate how many fields are required.
    const filled = Object.keys(values).length;
    if (current.require === 'all' && filled < current.inputs.length) return showError('Bitte alle Felder ausfüllen.');
    if (current.require === 'one' && filled !== 1) return showError('Bitte genau EINEN Wert eingeben.');

    let rows;
    try { rows = current.compute(values); }
    catch (msg) { return showError(typeof msg === 'string' ? msg : 'Ungültige Eingabe.'); }

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

  function showError(msg) {
    result.classList.add('text-rose-400');
    result.textContent = msg;
  }

  select.addEventListener('change', () => { current = CALCS.find((c) => c.id === select.value); buildForm(); });

  container.appendChild(select);
  container.appendChild(hint);
  container.appendChild(form);
  container.appendChild(calcBtn);
  container.appendChild(result);
  buildForm();
}
