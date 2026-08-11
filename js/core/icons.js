// icons.js — a small set of inline SVG icons, one per calculator mode.
// Stroke-based, currentColor, so they inherit the tab's text color.

const PATHS = {
  // keypad grid
  standard: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  // sine wave
  scientific: '<path d="M3 12 Q7 3 12 12 T21 12"/>',
  // square brackets (expression)
  formula: '<path d="M8 4H5v16h3"/><path d="M16 4h3v16h-3"/>',
  // atom (physics)
  physics: '<circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>',
  // arrow from origin
  vectors: '<line x1="5" y1="19" x2="18" y2="6"/><polyline points="18 13 18 6 11 6"/>',
  // axes + curve
  graph: '<path d="M4 4v16h16"/><path d="M4 16c4 0 5-9 9-9s4 6 7 6"/>',
  // circle with radius + center (geometry)
  geometry: '<circle cx="12" cy="12" r="8"/><line x1="12" y1="12" x2="20" y2="12"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
};

function svg(inner) {
  return `<svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// Return a span element containing the icon for a given mode id.
export function iconSpan(id) {
  const span = document.createElement('span');
  span.className = 'inline-flex';
  span.innerHTML = svg(PATHS[id] || '');
  return span;
}
