// physics.js — Newton's second law, F = m · a.
// Fill any two fields and leave one blank; the third is solved and written to
// history. Each field is clearly labeled with its SI unit.

import { el } from '../core/dom.js';
import { formatNumber } from '../core/format.js';
import * as history from '../core/history.js';

export function mountPhysics(container) {
  const fields = {}; // name -> input element

  function field(name, label, unit) {
    const input = el('input', {
      className:
        'w-full bg-slate-800 text-slate-100 text-lg rounded-xl px-4 py-3 ' +
        'border border-slate-700 focus:border-indigo-400 focus:outline-none ' +
        'focus:ring-2 focus:ring-indigo-400/40',
      attrs: { type: 'text', inputmode: 'decimal', placeholder: 'leave blank to solve', 'aria-label': label },
    });
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
    onClick: () => { fields.F.value = ''; fields.m.value = ''; fields.a.value = ''; output.textContent = 'Enter two values, leave one blank.'; },
  });

  container.appendChild(el('div', { className: 'space-y-3' }, [
    field('F', 'Force  F', 'N'),
    field('m', 'Mass  m', 'kg'),
    field('a', 'Acceleration  a', 'm/s²'),
  ]));
  container.appendChild(solveBtn);
  container.appendChild(clearBtn);
  container.appendChild(output);
}

function fmt(n) { return formatNumber(n); }
