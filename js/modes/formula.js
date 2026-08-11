// formula.js — free-text formula entry, e.g. (3 + 4) * 2^3 / sqrt(16).
// The input is bound to the shared expression state, so the main display's
// live preview and history commit work exactly as in the button modes.
//
// A full on-screen pad lets everything be built by clicking — every operator,
// paren, constant and function — while the keyboard keeps working unchanged.
// Function buttons insert e.g. "sqrt(" and drop the caret inside the paren.

import { el } from '../core/dom.js';
import * as state from '../core/state.js';
import { mountResultCard } from '../core/result-card.js';

export function mountFormula(container, viz) {
  const input = el('input', {
    className:
      'w-full bg-slate-800 text-slate-100 text-lg rounded-xl px-4 py-3 ' +
      'border border-slate-700 focus:border-indigo-400 focus:outline-none ' +
      'focus:ring-2 focus:ring-indigo-400/40 font-mono',
    attrs: {
      type: 'text',
      placeholder: '(3 + 4) * 2^3 / sqrt(16)',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      'aria-label': 'Formula input',
    },
    value: state.getExpression(),
  });

  // Type -> update shared state (drives the live preview above + the viz card).
  input.addEventListener('input', () => state.setExpression(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); state.evaluateNow(); input.value = state.getExpression(); }
  });

  // --- caret-aware editing helpers (drive both the input and shared state) ---
  function insert(text) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const caret = start + text.length; // for "sqrt(" this lands just inside the paren
    input.setSelectionRange(caret, caret);
    input.focus();
    state.setExpression(input.value);
  }
  function backspace() {
    const s = input.selectionStart ?? input.value.length;
    const e = input.selectionEnd ?? input.value.length;
    if (s !== e) { input.value = input.value.slice(0, s) + input.value.slice(e); input.setSelectionRange(s, s); }
    else if (s > 0) { input.value = input.value.slice(0, s - 1) + input.value.slice(s); input.setSelectionRange(s - 1, s - 1); }
    input.focus();
    state.setExpression(input.value);
  }
  function clearAll() { input.value = ''; state.clear(); input.focus(); }

  // --- pad button factory (denser than the standard keypad) ---
  const PBASE =
    'select-none rounded-lg h-11 text-sm font-medium transition-colors active:scale-95 ' +
    'focus:outline-none focus:ring-2 focus:ring-indigo-400/50 flex items-center justify-center';
  const PVAR = {
    func: 'bg-slate-800/70 hover:bg-slate-700 text-indigo-300',
    digit: 'bg-slate-800 hover:bg-slate-700 text-slate-100',
    op: 'bg-slate-700 hover:bg-slate-600 text-indigo-200',
    accent: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    danger: 'bg-rose-900/70 hover:bg-rose-800 text-rose-100',
  };
  const pad = (label, onClick, variant = 'digit', extra = '', title) => el('button', {
    className: `${PBASE} ${PVAR[variant]} ${extra}`,
    text: label,
    attrs: { type: 'button', 'aria-label': title || label, ...(title ? { title } : {}) },
    onClick,
  });
  const ins = (label, text, variant = 'func', title) => pad(label, () => insert(text), variant, '', title);

  // Functions & constants — click to insert, caret ready inside the parens.
  const funcs = [
    ['sin', 'sin('], ['cos', 'cos('], ['tan', 'tan('], ['asin', 'asin('], ['acos', 'acos('], ['atan', 'atan('],
    ['√', 'sqrt(', 'square root'], ['∛', 'cbrt(', 'cube root'], ['ln', 'ln('], ['log', 'log('], ['exp', 'exp('], ['|x|', 'abs(', 'absolute value'],
    ['π', 'π', 'pi'], ['e', 'e'], ['^', '^'], ['x!', '!', 'factorial'], ['(', '('], [')', ')'],
  ];
  const funcGrid = el('div', { className: 'grid grid-cols-3 sm:grid-cols-6 gap-2' },
    funcs.map(([label, text, title]) => ins(label, text, 'func', title)));

  // Numeric + operator pad.
  const numGrid = el('div', { className: 'grid grid-cols-4 gap-2 mt-2' }, [
    ins('7', '7', 'digit'), ins('8', '8', 'digit'), ins('9', '9', 'digit'), ins('÷', '/', 'op', 'divide'),
    ins('4', '4', 'digit'), ins('5', '5', 'digit'), ins('6', '6', 'digit'), ins('×', '*', 'op', 'multiply'),
    ins('1', '1', 'digit'), ins('2', '2', 'digit'), ins('3', '3', 'digit'), ins('−', '-', 'op', 'minus'),
    ins('0', '0', 'digit'), ins('.', '.', 'digit'), ins('%', '%', 'op', 'percent'), ins('+', '+', 'op', 'plus'),
    pad('C', clearAll, 'danger'), pad('⌫', backspace, 'func', '', 'backspace'),
    pad('=', () => { state.evaluateNow(); input.value = state.getExpression(); input.focus(); }, 'accent', 'col-span-2'),
  ]);

  const help = el('p', {
    className: 'mt-3 text-xs text-slate-400 leading-relaxed',
    html: 'Type or tap. Function buttons insert e.g. <span class="text-slate-300 font-mono">sqrt(</span> with the cursor ready inside. Angle mode follows the Scientific DEG/RAD toggle.',
  });

  container.appendChild(input);
  container.appendChild(el('div', { className: 'mt-3' }, [funcGrid, numGrid]));
  container.appendChild(help);

  // Right column: a large, friendly live readout (desktop-only; the top
  // display already covers mobile).
  mountResultCard(viz);

  // Keep the input in sync when history reloads an expression, etc.
  state.subscribe(() => { if (document.activeElement !== input) input.value = state.getExpression(); });
}
