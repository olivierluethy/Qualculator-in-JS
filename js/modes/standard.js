// standard.js — the standard calculator keypad.
// Buttons feed the shared expression state; the parser handles precedence and
// chaining, so there is no fragile first/second-number state machine anymore.

import { keyButton, el } from '../core/dom.js';
import * as state from '../core/state.js';
import { mountResultCard } from '../core/result-card.js';

export function mountStandard(container, viz) {
  const grid = el('div', { className: 'grid grid-cols-4 gap-2 sm:gap-3' });

  const add = (t, k) => state.append(t, k);

  const buttons = [
    keyButton('C', () => state.clear(), 'danger'),
    keyButton('←', () => state.backspace(), 'func'),
    keyButton('(', () => add('(', 'raw'), 'func'),
    keyButton(')', () => add(')', 'raw'), 'func'),

    keyButton('7', () => add('7', 'digit')),
    keyButton('8', () => add('8', 'digit')),
    keyButton('9', () => add('9', 'digit')),
    keyButton('÷', () => add('/', 'op'), 'op'),

    keyButton('4', () => add('4', 'digit')),
    keyButton('5', () => add('5', 'digit')),
    keyButton('6', () => add('6', 'digit')),
    keyButton('×', () => add('*', 'op'), 'op'),

    keyButton('1', () => add('1', 'digit')),
    keyButton('2', () => add('2', 'digit')),
    keyButton('3', () => add('3', 'digit')),
    keyButton('−', () => add('-', 'op'), 'op'),

    keyButton('%', () => add('%', 'op'), 'op'),
    keyButton('0', () => add('0', 'digit')),
    keyButton('.', () => add('.', 'dot')),
    keyButton('+', () => add('+', 'op'), 'op'),
  ];
  buttons.forEach((b) => grid.appendChild(b));

  const equals = keyButton('=', () => state.evaluateNow(), 'accent', 'col-span-4 mt-1');
  grid.appendChild(equals);

  container.appendChild(grid);
  mountResultCard(viz);
}
