// format.js — turn raw numbers into clean display strings.
//
// Kills floating-point noise (0.1 + 0.2 -> 0.3), switches to exponential
// notation for very large/small magnitudes, and renders non-finite values
// with friendly symbols.

const PRECISION = 12; // significant digits used to scrub float noise

export function formatNumber(x) {
  if (typeof x !== 'number' || Number.isNaN(x)) return 'Error';
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '-∞';

  // Round to PRECISION significant digits to remove binary-float artifacts,
  // then re-parse so trailing zeros disappear (0.30000000000000004 -> 0.3).
  let r = parseFloat(x.toPrecision(PRECISION));
  if (Object.is(r, -0)) r = 0;

  const abs = Math.abs(r);
  if (r !== 0 && (abs >= 1e15 || abs < 1e-9)) {
    // compact exponential, e.g. 1.234568e+20
    return r.toExponential(6).replace(/\.?0+e/, 'e');
  }
  return String(r);
}

// Format a 2D vector as "(x, y)" using formatNumber on each component.
export function formatVector(v) {
  return `(${formatNumber(v.x)}, ${formatNumber(v.y)})`;
}
