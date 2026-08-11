# Qualculator

A clean, responsive, **dark-mode** scientific & engineering calculator that runs
equally well on desktop and mobile. Built with **HTML + Tailwind CSS + vanilla
JavaScript (ES modules)** — no framework, no backend, no build step.

## Running it

Because the app uses native ES modules, it must be served over HTTP (opening
`index.html` directly via `file://` will not load the modules). Any static
server works:

```bash
# from the project root — pick one
python3 -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000>.

Tailwind is loaded via the official Play CDN, so the first load needs internet
access; everything else (calculations, history) runs entirely client-side.

## Modes

The display (full expression + live preview) and the persistent history are
shared across every mode.

| Mode | What it does |
|------|--------------|
| **Standard** | Digits, `+ − × ÷ %`, parentheses, clear, backspace, `=`. Correct precedence & chaining via the shared parser. |
| **Scientific** | Powers/roots (`^`, `√`), trig (`sin cos tan` + inverses), `log`, `ln`, `exp`, factorial `x!`, constants `π` and `e`, and a **DEG/RAD** toggle. |
| **Formula** | Type a full expression such as `(3 + 4) * 2^3 / sqrt(16)` and evaluate it. |
| **Physics** | Newton's second law **F = m · a**. Fill any two of F (N), m (kg), a (m/s²); leave one blank to solve for it. |
| **Vectors** | Interactive SVG coordinate plane. Plot two vectors by typing components or dragging the arrow tips. Compute add/subtract, scalar multiply, magnitude, dot product, angle between, 2D cross product/determinant, and the **resultant force** (vector sum with magnitude & direction). |
| **Graph** | GeoGebra-style graphing calculator on a pannable/zoomable canvas. Plot functions `y = f(x)`, points `(x, y)`, vertical lines `x = c`, **vector fields** `(P, Q)`, and **slope fields** `y' = f(x, y)`. Each object gets its own color with show/hide and delete; drag to pan, scroll to zoom, or click the plane to drop points. |
| **Geometrie** | Circle-geometry calculator (German labels): Kreis (Radius/Durchmesser/Umfang/Fläche), Kreisbogen · Kreissektor · Kreissegment · Sehne, Kreisring, Zentri-/Umfangswinkel, Passante/Tangente/Sekante, Tangentenlänge, Winkelhalbierende, and Kreiszahl π. Pick a calculator from the dropdown; inputs accept expressions (e.g. `2*pi`). Results go to history. |

## Key features

- **Always-visible expression.** The full running expression — including any
  pending operator — is always on screen, with a live preview of the result on a
  second line. (This fixes the old bug where an operator stayed "active" but
  invisible.)
- **Persistent history.** Every completed calculation from every mode is saved to
  `localStorage`. Tap a **result** to insert it into the current expression, or
  tap an **expression** to reload it for editing. Delete individual entries or
  clear all.
- **Safe expression evaluation.** No `eval()`. A custom tokenizer → shunting-yard
  → RPN evaluator (`js/core/parser.js`) with a whitelist of functions and
  constants. Chosen over a library (e.g. math.js) to stay dependency-free and
  fully offline, and to keep full control over error handling.
- **Robust edge cases.** Division by zero, empty input, unbalanced parentheses,
  and invalid formulas all produce a clear error state — never a crash.
- **Keyboard support.** Digits, `+ − * / % ^ ( )`, `Enter` = `=`, `Backspace`,
  `Esc` = clear (in the Standard/Scientific modes).
- **Touch-friendly & responsive.** Large tap targets, no hover-only interactions,
  layout adapts to narrow screens; history is a slide-over drawer.

## Project structure

```
index.html            # page shell, Tailwind CDN + config, display, tabs, history drawer
js/
  main.js             # bootstrap: display, tabs, history drawer, keyboard
  core/
    parser.js         # tokenizer → shunting-yard → RPN evaluator (no eval); vars + compile()
    format.js         # number formatting (float-noise cleanup, exponential, errors)
    state.js          # shared expression state + live-preview engine
    history.js        # localStorage-backed history store
    icons.js          # inline SVG icon per mode
    dom.js            # small element/button helpers
  modes/
    standard.js       # standard keypad
    scientific.js     # scientific functions + DEG/RAD
    formula.js        # free-text formula input
    physics.js        # F = m·a solver
    vectors.js        # interactive SVG vector plane
    graph.js          # canvas graphing calculator (functions, points, fields)
    geometry.js       # circle-geometry calculators (Kreis, Sektor, Sehne, ...)
docs/superpowers/specs # design document
```

## Notes

- Dark theme only, by design.
- No dependencies to install; math.js was intentionally **not** used (see above).
