// parser.js — a small, safe math expression evaluator.
//
// Pipeline: tokenize() -> toRPN() (shunting-yard) -> evalRPN().
// No use of eval(). Only whitelisted functions and constants are callable,
// so arbitrary code can never run. All failures surface as CalcError, which
// evaluate() catches and returns as a clean { ok:false, error } result.

export class CalcError extends Error {}

// Whitelisted constants.
const CONSTANTS = {
  pi: Math.PI,
  'π': Math.PI, // π
  e: Math.E,
  tau: Math.PI * 2,
};

// Whitelisted unary functions. Trig functions receive the raw operand and the
// current angle mode so they can convert degrees<->radians as needed.
const FUNCTIONS = {
  sin: (x, m) => Math.sin(toRad(x, m)),
  cos: (x, m) => Math.cos(toRad(x, m)),
  tan: (x, m) => Math.tan(toRad(x, m)),
  asin: (x, m) => fromRad(Math.asin(x), m),
  acos: (x, m) => fromRad(Math.acos(x), m),
  atan: (x, m) => fromRad(Math.atan(x), m),
  sinh: (x) => Math.sinh(x),
  cosh: (x) => Math.cosh(x),
  tanh: (x) => Math.tanh(x),
  sqrt: (x) => {
    if (x < 0) throw new CalcError('sqrt of negative number');
    return Math.sqrt(x);
  },
  cbrt: (x) => Math.cbrt(x),
  log: (x) => Math.log10(x), // base-10
  ln: (x) => Math.log(x),    // natural
  exp: (x) => Math.exp(x),
  abs: (x) => Math.abs(x),
  sign: (x) => Math.sign(x),
  round: (x) => Math.round(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  factorial: (x) => factorial(x),
};

function toRad(x, mode) { return mode === 'deg' ? (x * Math.PI) / 180 : x; }
function fromRad(x, mode) { return mode === 'deg' ? (x * 180) / Math.PI : x; }

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) throw new CalcError('factorial needs a non-negative integer');
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

// Binary operators: precedence and associativity. Unary minus ('u-') and the
// postfix factorial ('!') are handled specially during parsing/evaluation.
const OPERATORS = {
  '+': { prec: 2, assoc: 'left', fn: (a, b) => a + b },
  '-': { prec: 2, assoc: 'left', fn: (a, b) => a - b },
  '*': { prec: 3, assoc: 'left', fn: (a, b) => a * b },
  '/': { prec: 3, assoc: 'left', fn: (a, b) => {
    if (b === 0) throw new CalcError('Cannot divide by zero');
    return a / b;
  } },
  '%': { prec: 3, assoc: 'left', fn: (a, b) => {
    if (b === 0) throw new CalcError('Cannot divide by zero');
    return a % b;
  } },
  '^': { prec: 5, assoc: 'right', fn: (a, b) => Math.pow(a, b) },
};
const UNARY_MINUS_PREC = 4; // binds looser than ^, so -3^2 = -(3^2)

// ---- Tokenizer -------------------------------------------------------------

// Produces tokens: {type:'num', value}, {type:'op', value}, {type:'func', value},
// {type:'const', value}, {type:'lparen'}, {type:'rparen'}, {type:'comma'},
// {type:'bang'} (postfix factorial).
function tokenize(input) {
  const tokens = [];
  let i = 0;
  const isDigit = (c) => c >= '0' && c <= '9';
  const isIdentStart = (c) => /[a-zA-Zπ]/.test(c);

  while (i < input.length) {
    const c = input[i];

    if (c === ' ' || c === '\t') { i++; continue; }

    // Numbers: digits with optional single dot and optional exponent.
    if (isDigit(c) || (c === '.' && isDigit(input[i + 1]))) {
      let num = '';
      while (i < input.length && (isDigit(input[i]) || input[i] === '.')) num += input[i++];
      // optional scientific exponent, e.g. 1.5e3
      if (input[i] === 'e' || input[i] === 'E') {
        // only treat as exponent if followed by digits or +/- digits
        const look = input[i + 1];
        if (isDigit(look) || ((look === '+' || look === '-') && isDigit(input[i + 2]))) {
          num += input[i++]; // e
          if (input[i] === '+' || input[i] === '-') num += input[i++];
          while (i < input.length && isDigit(input[i])) num += input[i++];
        }
      }
      if ((num.match(/\./g) || []).length > 1) throw new CalcError('Malformed number');
      tokens.push({ type: 'num', value: parseFloat(num) });
      continue;
    }

    // Identifiers: function names or constants.
    if (isIdentStart(c)) {
      let name = '';
      while (i < input.length && /[a-zA-Z0-9π]/.test(input[i])) name += input[i++];
      const lower = name.toLowerCase();
      if (lower in FUNCTIONS) tokens.push({ type: 'func', value: lower });
      else if (name in CONSTANTS || lower in CONSTANTS) {
        tokens.push({ type: 'const', value: (name in CONSTANTS ? CONSTANTS[name] : CONSTANTS[lower]) });
      } else throw new CalcError(`Unknown name: ${name}`);
      continue;
    }

    if (c in OPERATORS) { tokens.push({ type: 'op', value: c }); i++; continue; }
    if (c === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
    if (c === ',') { tokens.push({ type: 'comma' }); i++; continue; }
    if (c === '!') { tokens.push({ type: 'bang' }); i++; continue; }

    throw new CalcError(`Unexpected character: ${c}`);
  }
  return tokens;
}

// ---- Shunting-yard: tokens -> RPN -----------------------------------------

function toRPN(tokens) {
  const output = [];
  const stack = [];
  let prev = null; // previous token, to detect unary minus

  for (const tok of tokens) {
    switch (tok.type) {
      case 'num':
      case 'const':
        output.push(tok);
        break;
      case 'func':
        stack.push(tok);
        break;
      case 'comma':
        while (stack.length && stack[stack.length - 1].type !== 'lparen') output.push(stack.pop());
        if (!stack.length) throw new CalcError('Misplaced comma');
        break;
      case 'bang': // postfix factorial: highest precedence, emit straight out
        output.push({ type: 'func', value: 'factorial' });
        break;
      case 'op': {
        let opName = tok.value;
        // Detect unary minus/plus: at start, or after another operator/paren/comma.
        const isUnaryContext = prev === null ||
          prev.type === 'op' || prev.type === 'lparen' || prev.type === 'comma';
        if (isUnaryContext && (opName === '-' || opName === '+')) {
          if (opName === '-') stack.push({ type: 'uop', value: 'u-', prec: UNARY_MINUS_PREC });
          // unary plus is a no-op; skip it
          break;
        }
        const o1 = OPERATORS[opName];
        while (stack.length) {
          const top = stack[stack.length - 1];
          if (top.type === 'func') { output.push(stack.pop()); continue; }
          if (top.type === 'uop') {
            if (top.prec > o1.prec || (top.prec >= o1.prec && o1.assoc === 'left')) { output.push(stack.pop()); continue; }
            break;
          }
          if (top.type === 'op') {
            const o2 = OPERATORS[top.value];
            if (o2.prec > o1.prec || (o2.prec === o1.prec && o1.assoc === 'left')) { output.push(stack.pop()); continue; }
          }
          break;
        }
        stack.push({ type: 'op', value: opName });
        break;
      }
      case 'lparen':
        stack.push(tok);
        break;
      case 'rparen':
        while (stack.length && stack[stack.length - 1].type !== 'lparen') output.push(stack.pop());
        if (!stack.length) throw new CalcError('Mismatched parentheses');
        stack.pop(); // discard the '('
        if (stack.length && stack[stack.length - 1].type === 'func') output.push(stack.pop());
        break;
    }
    prev = tok;
  }
  while (stack.length) {
    const top = stack.pop();
    if (top.type === 'lparen') throw new CalcError('Mismatched parentheses');
    output.push(top);
  }
  return output;
}

// ---- Evaluate RPN ----------------------------------------------------------

function evalRPN(rpn, angleMode) {
  const stack = [];
  for (const tok of rpn) {
    if (tok.type === 'num' || tok.type === 'const') {
      stack.push(tok.value);
    } else if (tok.type === 'uop') {
      if (stack.length < 1) throw new CalcError('Invalid expression');
      stack.push(-stack.pop());
    } else if (tok.type === 'func') {
      if (stack.length < 1) throw new CalcError('Invalid expression');
      stack.push(FUNCTIONS[tok.value](stack.pop(), angleMode));
    } else if (tok.type === 'op') {
      if (stack.length < 2) throw new CalcError('Invalid expression');
      const b = stack.pop();
      const a = stack.pop();
      stack.push(OPERATORS[tok.value].fn(a, b));
    }
  }
  if (stack.length !== 1) throw new CalcError('Invalid expression');
  const result = stack[0];
  if (typeof result !== 'number' || Number.isNaN(result)) throw new CalcError('Invalid expression');
  return result;
}

// Public API. Returns { ok:true, value } or { ok:false, error }.
export function evaluate(expression, opts = {}) {
  const angleMode = opts.angleMode || 'rad';
  try {
    const trimmed = String(expression).trim();
    if (trimmed === '') return { ok: false, error: '' }; // empty is not an error, just nothing
    const value = evalRPN(toRPN(tokenize(trimmed)), angleMode);
    return { ok: true, value };
  } catch (err) {
    if (err instanceof CalcError) return { ok: false, error: err.message };
    return { ok: false, error: 'Invalid expression' };
  }
}
