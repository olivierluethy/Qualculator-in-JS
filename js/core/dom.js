// dom.js — tiny helpers to build elements without repetitive boilerplate.

// Create an element. props may include className, text, html, onClick, attrs,
// and any direct property (e.g. type, value). children is an array of nodes.
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(props)) {
    if (key === 'className') node.className = val;
    else if (key === 'text') node.textContent = val;
    else if (key === 'html') node.innerHTML = val;
    else if (key === 'onClick') node.addEventListener('click', val);
    else if (key === 'attrs') for (const [a, v] of Object.entries(val)) node.setAttribute(a, v);
    else node[key] = val;
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

// Shared button styling used across every keypad. `variant` picks a color role.
const BTN_BASE =
  'select-none rounded-xl h-14 sm:h-16 text-lg font-medium transition-colors ' +
  'active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 flex items-center justify-center';
const BTN_VARIANTS = {
  digit: 'bg-slate-800 hover:bg-slate-700 text-slate-100',
  func: 'bg-slate-800/60 hover:bg-slate-700 text-indigo-300 text-base',
  op: 'bg-slate-700 hover:bg-slate-600 text-indigo-200',
  accent: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  danger: 'bg-rose-900/70 hover:bg-rose-800 text-rose-100',
};

// Make a keypad button. label is shown; onClick fires on tap/click.
export function keyButton(label, onClick, variant = 'digit', extra = '') {
  return el('button', {
    className: `${BTN_BASE} ${BTN_VARIANTS[variant] || BTN_VARIANTS.digit} ${extra}`,
    text: label,
    onClick,
    attrs: { 'aria-label': label, type: 'button' },
  });
}
