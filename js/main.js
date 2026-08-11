// main.js — application bootstrap.
// Wires the shared display + live preview, the mode tabs, the history drawer,
// and global keyboard support. Each calculator mode is mounted into its panel.

import * as state from './core/state.js';
import * as history from './core/history.js';
import { el } from './core/dom.js';
import { mountStandard } from './modes/standard.js';
import { mountScientific } from './modes/scientific.js';
import { mountFormula } from './modes/formula.js';
import { mountPhysics } from './modes/physics.js';
import { mountVectors } from './modes/vectors.js';

// Mode registry. needsDisplay = uses the shared expression display at the top.
const MODES = [
  { id: 'standard', label: 'Standard', mount: mountStandard, needsDisplay: true },
  { id: 'scientific', label: 'Scientific', mount: mountScientific, needsDisplay: true },
  { id: 'formula', label: 'Formula', mount: mountFormula, needsDisplay: true },
  { id: 'physics', label: 'Physics', mount: mountPhysics, needsDisplay: false },
  { id: 'vectors', label: 'Vectors', mount: mountVectors, needsDisplay: false },
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
      text: mode.label,
      attrs: { type: 'button', 'data-mode': mode.id, role: 'tab' },
      onClick: () => switchMode(mode.id),
    });
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

  $('history-toggle').addEventListener('click', open);
  $('history-close').addEventListener('click', close);
  overlay.addEventListener('click', close);
  $('history-clear').addEventListener('click', () => history.clearAll());

  function render() {
    const entries = history.all();
    listEl.innerHTML = '';
    emptyEl.classList.toggle('hidden', entries.length > 0);

    entries.forEach((entry) => {
      const card = el('div', { className: 'group rounded-xl bg-slate-800/60 border border-slate-700 p-3 flex items-start gap-2' });

      const main = el('div', { className: 'flex-1 min-w-0' });
      // click the expression -> reload the whole expression to continue editing
      const exprBtn = el('button', {
        className: 'block w-full text-left text-xs text-slate-400 truncate hover:text-slate-200',
        text: entry.expression,
        attrs: { type: 'button', title: 'Load this expression' },
        onClick: () => { state.setExpression(entry.expression); ensureCalcMode(); },
      });
      // click the result -> insert the value and keep calculating
      const resBtn = el('button', {
        className: 'block w-full text-left text-lg font-semibold text-indigo-300 truncate hover:text-indigo-200',
        text: entry.result,
        attrs: { type: 'button', title: 'Insert this result' },
        onClick: () => { state.insertValue(entry.result); ensureCalcMode(); },
      });
      main.appendChild(exprBtn);
      main.appendChild(resBtn);

      const del = el('button', {
        className: 'shrink-0 text-slate-500 hover:text-rose-400 transition-colors px-1',
        html: '&times;',
        attrs: { type: 'button', 'aria-label': 'Delete entry' },
        onClick: () => history.remove(entry.id),
      });

      card.appendChild(main);
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
    'px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ' +
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
