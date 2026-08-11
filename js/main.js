// main.js — application bootstrap.
// Wires the shared display + live preview, the mode tabs, the history drawer,
// and global keyboard support. Each calculator mode is mounted into its panel.

import * as state from './core/state.js';
import * as history from './core/history.js';
import { el } from './core/dom.js';
import { iconSpan } from './core/icons.js';
import { mountStandard } from './modes/standard.js';
import { mountScientific } from './modes/scientific.js';
import { mountFormula } from './modes/formula.js';
import { mountPhysics } from './modes/physics.js';
import { mountVectors } from './modes/vectors.js';
import { mountGraph } from './modes/graph.js';
import { mountGeometry } from './modes/geometry.js';

// Mode registry. needsDisplay = uses the shared expression display at the top.
const MODES = [
  { id: 'standard', label: 'Standard', mount: mountStandard, needsDisplay: true },
  { id: 'scientific', label: 'Scientific', mount: mountScientific, needsDisplay: true },
  { id: 'formula', label: 'Formula', mount: mountFormula, needsDisplay: true },
  { id: 'physics', label: 'Physics', mount: mountPhysics, needsDisplay: false },
  { id: 'vectors', label: 'Vectors', mount: mountVectors, needsDisplay: false },
  { id: 'graph', label: 'Graph', mount: mountGraph, needsDisplay: false },
  { id: 'geometry', label: 'Geometry', mount: mountGeometry, needsDisplay: false },
];

let activeMode = 'standard';

const $ = (id) => document.getElementById(id);

function boot() {
  const tabsEl = $('tabs');
  const panelsEl = $('panels');
  const displayEl = $('display');

  // --- build tabs + panels ---
  const panels = {};
  MODES.forEach((mode, idx) => {
    const tab = el('button', {
      className: tabClass(idx === 0),
      attrs: { type: 'button', 'data-mode': mode.id, role: 'tab' },
      onClick: () => switchMode(mode.id),
    }, [iconSpan(mode.id), el('span', { text: mode.label })]);
    tabsEl.appendChild(tab);

    const panel = el('div', { className: idx === 0 ? '' : 'hidden' });
    mode.mount(panel);           // mount the mode's UI once
    panels[mode.id] = panel;
    panelsEl.appendChild(panel);
  });

  function switchMode(id) {
    activeMode = id;
    MODES.forEach((mode, idx) => {
      panels[mode.id].classList.toggle('hidden', mode.id !== id);
      tabsEl.children[idx].className = tabClass(mode.id === id);
    });
    const mode = MODES.find((m) => m.id === id);
    displayEl.classList.toggle('hidden', !mode.needsDisplay);
  }

  // --- shared display: expression + live preview + error ---
  const exprLine = $('expr');
  const previewLine = $('preview');
  const angleTag = $('angle');

  function renderDisplay() {
    const expr = state.getExpression();
    exprLine.textContent = expr === '' ? '0' : expr;
    // keep the newest (right-most) characters in view
    exprLine.scrollLeft = exprLine.scrollWidth;

    const err = state.getError();
    if (err) {
      previewLine.textContent = err;
      previewLine.className = previewClass(true);
    } else {
      const preview = state.getPreview();
      previewLine.textContent = preview ? `= ${preview}` : '';
      previewLine.className = previewClass(false);
    }
    angleTag.textContent = state.getAngleMode().toUpperCase();
  }
  state.subscribe(renderDisplay);
  renderDisplay();

  // --- history drawer ---
  setupHistory();

  // --- keyboard support (only for the button-driven calc modes) ---
  window.addEventListener('keydown', onKey);

  // expose switchMode for history reuse
  boot.switchMode = switchMode;
}

function onKey(e) {
  // Let text inputs (formula, physics, vectors) handle their own typing.
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (activeMode !== 'standard' && activeMode !== 'scientific') return;

  const k = e.key;
  if (k >= '0' && k <= '9') { state.append(k, 'digit'); e.preventDefault(); }
  else if (k === '.') { state.append('.', 'dot'); e.preventDefault(); }
  else if (['+', '-', '*', '/', '%', '^'].includes(k)) { state.append(k, 'op'); e.preventDefault(); }
  else if (k === '(' || k === ')') { state.append(k, 'raw'); e.preventDefault(); }
  else if (k === 'Enter' || k === '=') { state.evaluateNow(); e.preventDefault(); }
  else if (k === 'Backspace') { state.backspace(); e.preventDefault(); }
  else if (k === 'Escape') { state.clear(); e.preventDefault(); }
}

// ---- history drawer + list ----
function setupHistory() {
  const drawer = $('history-drawer');
  const overlay = $('history-overlay');
  const listEl = $('history-list');
  const emptyEl = $('history-empty');

  const open = () => { drawer.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); };
  const close = () => { drawer.classList.add('translate-x-full'); overlay.classList.add('hidden'); };

  // Brief highlight to confirm a history entry was reused.
  const flash = (node) => {
    node.classList.add('ring-2', 'ring-indigo-400');
    setTimeout(() => node.classList.remove('ring-2', 'ring-indigo-400'), 300);
  };

  $('history-toggle').addEventListener('click', open);
  $('history-close').addEventListener('click', close);
  overlay.addEventListener('click', close);
  $('history-clear').addEventListener('click', () => history.clearAll());

  function render() {
    const entries = history.all();
    listEl.innerHTML = '';
    emptyEl.classList.toggle('hidden', entries.length > 0);

    entries.forEach((entry) => {
      const card = el('div', {
        className: 'group relative rounded-xl bg-slate-800/60 border border-slate-700 ' +
          'hover:border-indigo-500/60 transition-colors p-3 pr-7',
      });

      // Expression row -> reload the whole expression to continue editing.
      // A ↻ icon signals it's re-loadable.
      const exprBtn = el('button', {
        className: 'flex items-center gap-1.5 w-full text-left text-xs text-slate-400 ' +
          'hover:text-slate-200 transition-colors',
        attrs: { type: 'button', title: 'Load this expression to edit' },
        onClick: () => { state.setExpression(entry.expression); ensureCalcMode(); flash(card); close(); },
      }, [
        el('span', { className: 'shrink-0 text-slate-500 group-hover:text-indigo-300', html: '&#8635;' }), // ↻
        el('span', { className: 'truncate', text: entry.expression }),
      ]);

      // Result row -> insert the value and keep calculating. The always-visible
      // "reuse" chip makes it obvious the number is tappable (no hover on mobile).
      const resBtn = el('button', {
        className: 'mt-1 -mx-1 flex items-center justify-between gap-2 w-full text-left ' +
          'rounded-lg px-1 py-1 hover:bg-indigo-500/10 transition-colors cursor-pointer',
        attrs: { type: 'button', title: 'Tap to insert this result and keep calculating' },
        onClick: () => { state.insertValue(entry.result); ensureCalcMode(); flash(card); close(); },
      }, [
        el('span', { className: 'text-lg font-semibold text-indigo-300 truncate', text: entry.result }),
        el('span', {
          className: 'shrink-0 inline-flex items-center gap-1 text-[10px] font-medium ' +
            'text-indigo-300 bg-indigo-500/15 rounded-full px-2 py-0.5 ' +
            'opacity-80 group-hover:opacity-100 group-hover:bg-indigo-500/25 transition',
          html: 'Tap to reuse &rarr;',
        }),
      ]);

      const del = el('button', {
        className: 'absolute top-2 right-1.5 text-slate-500 hover:text-rose-400 transition-colors px-1 leading-none',
        html: '&times;',
        attrs: { type: 'button', 'aria-label': 'Delete entry' },
        onClick: () => history.remove(entry.id),
      });

      card.appendChild(exprBtn);
      card.appendChild(resBtn);
      card.appendChild(del);
      listEl.appendChild(card);
    });
  }
  history.subscribe(render);
  render();
}

// Reusing history from Physics/Vectors should jump back to a calc mode so the
// value lands in the visible expression display.
function ensureCalcMode() {
  if (activeMode !== 'standard' && activeMode !== 'scientific' && activeMode !== 'formula') {
    if (boot.switchMode) boot.switchMode('standard');
  }
}

// ---- tailwind class helpers ----
function tabClass(active) {
  return (
    'inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ' +
    (active
      ? 'bg-indigo-600 text-white'
      : 'bg-slate-800 text-slate-300 hover:bg-slate-700')
  );
}
function previewClass(isError) {
  return (
    'text-right text-lg h-7 overflow-hidden ' + (isError ? 'text-rose-400' : 'text-slate-400')
  );
}

boot();
