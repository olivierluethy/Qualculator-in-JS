# Qualculator Rebuild — Design

**Date:** 2026-08-11
**Status:** Approved

## Goal

Rebuild the existing "Qualculator" calculator (plain HTML/CSS/JS, buggy, desktop-only)
into a clean, responsive, dark-mode-only scientific/engineering calculator that runs
equally well on desktop and mobile. The visible app title stays **Qualculator**.

## Tech decisions (confirmed with user)

- **Stack:** HTML + Tailwind CSS + vanilla JavaScript (ES modules) only. No framework.
- **Tailwind delivery:** Tailwind Play CDN (`<script src="https://cdn.tailwindcss.com">`).
  Zero build step; dark theme is permanent (design uses dark palette directly, no toggle).
  No plain/hand-written CSS files remain.
- **Math engine:** Custom safe parser — tokenizer → shunting-yard → RPN evaluator.
  No raw `eval`. Zero dependencies, fully offline, whitelisted functions/constants.
- **Vector plane:** SVG (crisp grid/axes/labels, easy click & drag, real-time DOM updates).
- **Persistence:** `localStorage` only. No backend, no paid services.

## File structure

```
index.html                 # single page: tab shell, shared display + history drawer, Tailwind config
js/
  main.js                  # bootstrap: tabs, keyboard, mount modes, shared state wiring
  core/
    parser.js              # tokenizer → shunting-yard → RPN eval (whitelisted funcs/consts)
    format.js              # number formatting: float cleanup, rounding, error strings
    history.js             # localStorage-backed history store + render + reuse handlers
    state.js               # shared expression state + live-preview engine (event emitter)
  modes/
    standard.js            # digits/operators/backspace/clear/= keypad
    scientific.js          # scientific functions, constants, deg/rad toggle (shares parser)
    formula.js             # free-text formula input + evaluate
    physics.js             # F = m·a, solve for any variable, units
    vectors.js             # SVG plane, plot/drag vectors, vector ops, resultant force
README.md
```

Deleted from old version: `style/*` (SCSS + compiled CSS + `.map`), the global-variable
state-machine `js/main.js`, inline style animations.

## Shared display (fixes the core bug)

A single display component rendered across every mode, with two lines:

- **Expression line** — the full running expression *including any pending operator*,
  always visible. This directly fixes the old bug where an operator stayed "active in the
  background" invisibly.
- **Preview line** — live evaluated result of the current expression as it is typed (dimmed).

On `=`: the completed `expression = result` is committed to history, and the result becomes
the new starting value for continued calculation. Repeated `=` is well-defined (idempotent
on a committed result; does not re-apply a phantom operator).

## History

- Right-side drawer; slide-over overlay on mobile.
- Persists in `localStorage` (versioned key), survives reload.
- Each entry displays expression **and** result.
- Reuse: click the **result** → insert that value into the current expression; click the
  **expression** → reload the whole expression for editing/re-running.
- Per-entry delete + clear-all.
- Single API `history.add(expression, result, {mode})` used by every mode so all completed
  calculations (standard, scientific, formula, physics, vectors) land in history.

## Parser (core/parser.js)

- **Tokenize:** numbers (int/float/scientific), operators `+ - * / % ^`, parentheses,
  commas, identifiers (function names / constants), unary minus detection.
- **Shunting-yard:** operator precedence with `^` right-associative; functions and
  parentheses handled; produces RPN.
- **Evaluate RPN:** whitelisted only.
  - Functions: `sin cos tan asin acos atan sqrt cbrt log ln exp abs`, factorial (`!` and
    `factorial(n)`).
  - Constants: `π`/`pi`, `e`.
  - Trig respects a deg/rad flag passed in from the UI.
- **Errors:** division by zero, unbalanced parens, unknown token, domain errors (e.g.
  `sqrt(-1)`, `factorial` of non-int/negative) → clean typed error result. Never throws to
  the UI as an uncaught crash; the display shows a clear error message.

## Formatting (core/format.js)

- Float cleanup (kill `0.1 + 0.2` style noise via rounding to sensible precision).
- Large/small numbers → exponential when appropriate.
- Consistent error strings ("Error", "Cannot divide by zero", "Invalid expression").

## Modes

### Standard
Digits, `.`, `+ - * / %`, `C`, backspace `←`, `=`. Builds an expression string that the
parser evaluates (correct precedence & chaining — no more manual first/second-number state
machine). Division by zero → error state, no crash. Leading-zero / multiple-decimal input
guarded.

### Scientific
Standard keypad plus: `^`, `sqrt`, `sin cos tan` + inverses, `log`, `ln`, `exp`, `!`,
constants `π`, `e`, and a **deg/rad** toggle. Shares the same parser and display.

### Formula
Free-text input where the user types a full formula, e.g. `(3 + 4) * 2^3 / sqrt(16)`.
Evaluate button + Enter. Parentheses/powers/functions supported. Invalid formula → inline
clear error message.

### Physics — Newton's second law
`F = m · a`. Three labeled fields with units: F (N), m (kg), a (m/s²). Leave exactly one
field blank → solve for it (`F=m·a`, `m=F/a`, `a=F/m`). Guards: divide-by-zero when solving
with a zero denominator. Result pushed to history.

### Vectors / coordinate system
- SVG Cartesian plane: grid, x/y axes, tick labels, origin.
- Add vectors by entering components `(x, y)` **or** by dragging on the plane.
- Operations: addition, subtraction, scalar multiplication, magnitude, dot product,
  angle between two vectors, 2D cross product / determinant.
- "Interpret as forces" → resultant force = vector sum, reported with magnitude and
  direction (angle), tying back to the Newton mode.
- Real-time render on change. Results pushable into history.

## Cross-cutting

- **Keyboard (desktop):** digit keys, operators, `Enter` = `=`, `Backspace`, `Esc` = clear.
- **Touch/mobile:** adequate tap targets, no hover-only interactions, layout reflows to
  narrow viewports; history becomes an overlay drawer.
- **Code quality:** modular ES modules, one responsibility per file, inline comments on the
  parser and vector-math where non-obvious.
- **README:** how to run (needs a local static server because ES modules don't load over
  `file://`), the modes, and the "custom parser, no eval" note.

## Acceptance criteria

- [ ] Only HTML + Tailwind + JS; no plain CSS files remain.
- [ ] App title unchanged (Qualculator).
- [ ] Dark mode throughout; good on desktop and narrow mobile.
- [ ] Full expression + pending operator always visible; live preview result shown.
- [ ] History persists; results and full expressions both reusable.
- [ ] Standard, scientific, formula, Newton-force, and vector features all work and write
      to history.
- [ ] No crashes on edge cases (div-by-zero, empty input, invalid formulas → clear errors).
