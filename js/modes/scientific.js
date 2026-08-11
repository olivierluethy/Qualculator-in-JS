// scientific.js — scientific keypad: trig, logs, powers/roots, constants,
// factorial, and a degree/radian toggle. Shares the same expression state and
// parser as Standard, so results flow through the same display and history.

import { keyButton, el } from '../core/dom.js';
import * as state from '../core/state.js';

let angleButton; // reference so we can refresh its label when the mode toggles

export function mountScientific(container) {
  const add = (t, k = 'raw') => state.append(t, k);

  // --- Scientific function panel (deg/rad + functions) ---
  const sci = el('div', { className: 'grid grid-cols-5 gap-2 sm:gap-3 mb-2 sm:mb-3' });

  angleButton = keyButton(angleLabel(), () => {
    state.setAngleMode(state.getAngleMode() === 'deg' ? 'rad' : 'deg');
    angleButton.textContent = angleLabel();
  }, 'accent', 'text-sm');

  const sciButtons = [
    angleButton,
    keyButton('sin', () => add('sin('), 'func'),
    keyButton('cos', () => add('cos('), 'func'),
    keyButton('tan', () => add('tan('), 'func'),
    keyButton('π', () => add('π'), 'func'),

    keyButton('x!', () => add('!'), 'func'),
    keyButton('asin', () => add('asin('), 'func'),
    keyButton('acos', () => add('acos('), 'func'),
    keyButton('atan', () => add('atan('), 'func'),
    keyButton('e', () => add('e'), 'func'),

    keyButton('^', () => add('^', 'op'), 'func'),
    keyButton('√', () => add('sqrt('), 'func'),
    keyButton('ln', () => add('ln('), 'func'),
    keyButton('log', () => add('log('), 'func'),
    keyButton('exp', () => add('exp('), 'func'),
  ];
  sciButtons.forEach((b) => sci.appendChild(b));
  container.appendChild(sci);

  // --- Numeric pad (same actions as Standard) ---
  const grid = el('div', { className: 'grid grid-cols-4 gap-2 sm:gap-3' });
  const numeric = [
    keyButton('C', () => state.clear(), 'danger'),
    keyButton('←', () => state.backspace(), 'func'),
    keyButton('(', () => add('('), 'func'),
    keyButton(')', () => add(')'), 'func'),

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
  numeric.forEach((b) => grid.appendChild(b));
  grid.appendChild(keyButton('=', () => state.evaluateNow(), 'accent', 'col-span-4 mt-1'));
  container.appendChild(grid);
}

function angleLabel() { return state.getAngleMode().toUpperCase(); } // DEG / RAD
