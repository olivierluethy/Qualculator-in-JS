// formula.js — free-text formula entry, e.g. (3 + 4) * 2^3 / sqrt(16).
// The input is bound to the shared expression state, so the main display's
// live preview and history commit work exactly as in the button modes.

import { el } from '../core/dom.js';
import * as state from '../core/state.js';

export function mountFormula(container) {
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

  // Type -> update shared state (drives the live preview above).
  input.addEventListener('input', () => state.setExpression(input.value));
  // Enter -> evaluate and commit to history.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); state.evaluateNow(); input.value = state.getExpression(); }
  });

  const evalBtn = el('button', {
    className:
      'mt-3 w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white ' +
      'font-medium transition-colors active:scale-95',
    text: 'Evaluate  =',
    attrs: { type: 'button' },
    onClick: () => { state.evaluateNow(); input.value = state.getExpression(); input.focus(); },
  });

  const help = el('p', {
    className: 'mt-3 text-xs text-slate-400 leading-relaxed',
    html:
      'Supports <span class="text-slate-300">+ − × ÷ % ^</span>, parentheses, and functions: ' +
      '<span class="text-slate-300">sin, cos, tan, asin, acos, atan, sqrt, cbrt, log, ln, exp, abs, x!</span>. ' +
      'Constants: <span class="text-slate-300">π, e</span>. Angle mode follows the Scientific DEG/RAD toggle.',
  });

  // Keep the input in sync when history reloads an expression, etc.
  state.subscribe(() => { if (document.activeElement !== input) input.value = state.getExpression(); });

  container.appendChild(input);
  container.appendChild(evalBtn);
  container.appendChild(help);
}
