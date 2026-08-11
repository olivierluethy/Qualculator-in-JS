// state.js — shared expression state for the Standard / Scientific / Formula
// modes, plus a live-preview engine. Everything that changes the expression
// goes through here so the single display component (in main.js) always shows
// the full running expression and its live result. This is what fixes the old
// "operator active in the background but invisible" bug: the operator is part
// of the expression string, always on screen.

import { evaluate } from './parser.js';
import { formatNumber } from './format.js';
import * as history from './history.js';

const listeners = new Set();

let expression = '';       // the full expression being built, e.g. "12+3*"
let angleMode = 'deg';     // 'deg' | 'rad' for scientific trig
let errorMsg = '';         // sticky error to show on the display
let justEvaluated = false; // true right after '=', so next digit starts fresh

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn()); }

export function getExpression() { return expression; }
export function getAngleMode() { return angleMode; }
export function getError() { return errorMsg; }

export function setAngleMode(mode) {
  angleMode = mode === 'rad' ? 'rad' : 'deg';
  emit();
}

// Live preview: evaluate the current expression. Returns a display string or ''.
export function getPreview() {
  const res = evaluate(expression, { angleMode });
  if (res.ok) return formatNumber(res.value);
  return '';
}

// Replace the whole expression (used by history "reload expression").
export function setExpression(expr) {
  expression = String(expr);
  errorMsg = '';
  justEvaluated = false;
  emit();
}

// Characters that count as trailing binary operators for replacement logic.
const TRAILING_OPS = ['+', '-', '*', '/', '%', '^'];

// Append a token from a keypad. `kind` guides input hygiene:
//  'digit'    -> "0".."9"
//  'dot'      -> "."
//  'op'       -> binary operator
//  'raw'      -> anything else (functions like "sin(", constants, parens)
export function append(token, kind = 'raw') {
  errorMsg = '';

  // After '=', decide whether to continue from the result or start fresh.
  if (justEvaluated) {
    if (kind === 'op') {
      // keep result, chain the operator onto it
      justEvaluated = false;
    } else {
      // digit / dot / function / paren -> start a new expression
      expression = '';
      justEvaluated = false;
    }
  }

  if (kind === 'op') {
    if (expression === '') {
      // allow a leading minus (unary); ignore other leading binary operators
      if (token === '-') expression = '-';
      emit();
      return;
    }
    const last = expression[expression.length - 1];
    if (TRAILING_OPS.includes(last)) {
      // replace a dangling operator instead of stacking two
      expression = expression.slice(0, -1) + token;
      emit();
      return;
    }
    expression += token;
    emit();
    return;
  }

  if (kind === 'dot') {
    // prevent a second dot within the current number token
    const currentNumber = expression.split(/[^0-9.]/).pop();
    if (currentNumber.includes('.')) { emit(); return; }
    if (currentNumber === '') expression += '0'; // ".5" -> "0.5"
    expression += '.';
    emit();
    return;
  }

  if (kind === 'digit') {
    // guard leading zeros: "0" then digit replaces the zero
    const currentNumber = expression.split(/[^0-9.]/).pop();
    if (currentNumber === '0') {
      expression = expression.slice(0, -1) + token;
    } else {
      expression += token;
    }
    emit();
    return;
  }

  // raw: functions, constants, parentheses
  expression += token;
  emit();
}

// Insert a plain value into the expression (used by history "insert result").
export function insertValue(value) {
  errorMsg = '';
  if (justEvaluated) { expression = ''; justEvaluated = false; }
  expression += String(value);
  emit();
}

export function backspace() {
  errorMsg = '';
  justEvaluated = false;
  expression = expression.slice(0, -1);
  emit();
}

export function clear() {
  expression = '';
  errorMsg = '';
  justEvaluated = false;
  emit();
}

// Evaluate '='. On success, commit "expression = result" to history and keep
// the result as the new starting expression. Repeated '=' is idempotent.
export function evaluateNow() {
  if (justEvaluated) return; // pressing = again does nothing
  if (expression.trim() === '') return;

  const res = evaluate(expression, { angleMode });
  if (!res.ok) {
    errorMsg = res.error || 'Invalid expression';
    emit();
    return;
  }
  const resultStr = formatNumber(res.value);
  history.add(expression, resultStr, { mode: 'calc' });
  expression = resultStr === '∞' || resultStr === '-∞' || resultStr === 'Error' ? '' : resultStr;
  justEvaluated = true;
  errorMsg = '';
  emit();
}
