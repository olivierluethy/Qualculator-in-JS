// result-card.js — a large, friendly "Live result" panel for the keypad modes.
// It mirrors the shared expression state in big type so the right-hand desktop
// column is put to use and the current sum stays readable from across a room.
// Desktop-only by default: on mobile the compact top display already covers it.

import { el } from './dom.js';
import * as state from './state.js';

export function mountResultCard(viz, { desktopOnly = true } = {}) {
  if (!viz) return;
  const wrap = el('div', {
    className: (desktopOnly ? 'hidden lg:block ' : '') +
      'rounded-2xl bg-slate-900 border border-slate-700 p-5',
  });
  const bigExpr = el('div', { className: 'text-right text-2xl font-mono text-slate-100 break-all leading-tight min-h-[2rem]' });
  const bigResult = el('div', { className: 'text-right text-4xl font-semibold mt-3 min-h-[3rem] break-all text-indigo-300' });
  wrap.appendChild(el('p', { className: 'text-xs font-medium text-slate-400 mb-2', text: 'Live result' }));
  wrap.appendChild(bigExpr);
  wrap.appendChild(bigResult);

  const render = () => {
    const expr = state.getExpression();
    bigExpr.textContent = expr === '' ? '—' : expr;
    const err = state.getError();
    if (err) {
      bigResult.textContent = err;
      bigResult.className = 'text-right text-2xl font-semibold mt-3 min-h-[3rem] break-all text-rose-400';
      return;
    }
    const p = state.getPreview();
    bigResult.textContent = p ? '= ' + p : '';
    bigResult.className = 'text-right text-4xl font-semibold mt-3 min-h-[3rem] break-all text-indigo-300';
  };
  state.subscribe(render);
  render();
  viz.appendChild(wrap);
}
