// graph.js — a GeoGebra-style graphing calculator on <canvas>.
// Reuses the safe parser (compile()) to evaluate expressions in x (and x,y for
// fields). Supports: functions y=f(x), points, vertical lines, vector fields,
// and slope fields. The plane pans (drag) and zooms (wheel / buttons).

import { el } from '../core/dom.js';
import { formatNumber } from '../core/format.js';
import { compile, evaluate } from '../core/parser.js';
import * as history from '../core/history.js';

const PALETTE = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#22d3ee', '#f87171', '#a78bfa'];

export function mountGraph(controls, viz) {
  // --- view state (world units) ---
  let cx = 0, cy = 0;       // world coordinate at canvas center
  let scale = 40;           // pixels per world unit
  let W = 320, H = 360;     // css pixel size of the canvas
  let colorIdx = 0;
  let addPointOnClick = false;

  const objects = []; // { id, type, label, color, visible, ...compiled data }
  let idc = 0;
  let preview = null; // tentative object being typed (drawn dashed, not committed)

  // --- coordinate transforms ---
  const sx = (wx) => W / 2 + (wx - cx) * scale;
  const sy = (wy) => H / 2 - (wy - cy) * scale;
  const wx = (px) => cx + (px - W / 2) / scale;
  const wy = (py) => cy - (py - H / 2) / scale;

  // --- canvas ---
  const canvas = el('canvas', {
    className: 'w-full rounded-xl bg-slate-900 border border-slate-700 touch-none block cursor-grab',
    attrs: { 'aria-label': 'Graphing plane' },
  });
  const ctx = canvas.getContext('2d');

  function resize() {
    W = canvas.clientWidth || 320;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in css pixels
    draw();
  }

  // --- "nice" axis step so labels land on 1/2/5 * 10^n ---
  function niceStep(targetPx) {
    const raw = targetPx / scale;               // world units per targetPx
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    const nice = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
    return nice * pow;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    // committed objects plus the live (dashed) preview of what's being typed
    const all = preview ? objects.concat([preview]) : objects;
    // fields drawn first (background), then curves/lines, then points
    for (const o of all) if (o.visible && (o.type === 'sfield' || o.type === 'vfield')) drawField(o);
    for (const o of all) if (o.visible && (o.type === 'function' || o.type === 'vline')) drawCurve(o);
    for (const o of all) if (o.visible && o.type === 'point') drawPoint(o);
  }

  function drawGrid() {
    const step = niceStep(70);
    ctx.lineWidth = 1;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textBaseline = 'top';

    const left = wx(0), right = wx(W), top = wy(0), bottom = wy(H);
    // vertical grid lines + x labels
    for (let x = Math.ceil(left / step) * step; x <= right; x += step) {
      const px = sx(x);
      ctx.strokeStyle = Math.abs(x) < 1e-9 ? '#64748b' : '#1e293b';
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
      if (Math.abs(x) > 1e-9) {
        ctx.fillStyle = '#64748b';
        ctx.fillText(trimLabel(x), px + 2, clamp(sy(0) + 2, 0, H - 12));
      }
    }
    // horizontal grid lines + y labels
    for (let y = Math.ceil(bottom / step) * step; y <= top; y += step) {
      const py = sy(y);
      ctx.strokeStyle = Math.abs(y) < 1e-9 ? '#64748b' : '#1e293b';
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
      if (Math.abs(y) > 1e-9) {
        ctx.fillStyle = '#64748b';
        ctx.fillText(trimLabel(y), clamp(sx(0) + 3, 0, W - 20), py + 1);
      }
    }
  }

  // Plot y = f(x) across screen columns, breaking the path at discontinuities.
  function drawCurve(o) {
    ctx.save();
    ctx.strokeStyle = o.color;
    ctx.lineWidth = 2;
    if (o.preview) { ctx.setLineDash([6, 5]); ctx.globalAlpha = 0.9; }
    if (o.type === 'vline') {
      const px = sx(o.c);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.beginPath();
    let pen = false, prevY = null;
    for (let px = 0; px <= W; px++) {
      const r = o.fn.eval({ x: wx(px) });
      if (!r.ok || !isFinite(r.value)) { pen = false; prevY = null; continue; }
      const py = sy(r.value);
      // break at asymptotes: a wild vertical jump between adjacent columns
      if (pen && prevY !== null && Math.abs(py - prevY) > 4 * H) { pen = false; }
      if (!pen) { ctx.moveTo(px, py); pen = true; } else { ctx.lineTo(px, py); }
      prevY = py;
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPoint(o) {
    const px = sx(o.x), py = sy(o.y);
    ctx.save();
    if (o.preview) ctx.globalAlpha = 0.9;
    ctx.fillStyle = o.color;
    ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`(${trimLabel(o.x)}, ${trimLabel(o.y)})`, px + 7, py - 6);
    ctx.restore();
  }

  // Vector field: arrows of (P,Q). Slope field: short segments of slope f(x,y).
  function drawField(o) {
    const gap = 34; // px between samples
    ctx.save();
    if (o.preview) ctx.globalAlpha = 0.85;
    ctx.strokeStyle = o.color;
    ctx.fillStyle = o.color;
    ctx.lineWidth = 1.3;
    for (let px = gap / 2; px < W; px += gap) {
      for (let py = gap / 2; py < H; py += gap) {
        const X = wx(px), Y = wy(py);
        if (o.type === 'sfield') {
          const r = o.fn.eval({ x: X, y: Y });
          if (!r.ok || !isFinite(r.value)) continue;
          // direction (1, slope) normalized to a fixed on-screen length
          const ang = Math.atan2(-r.value, 1); // screen y is inverted
          const len = gap * 0.42;
          seg(px - Math.cos(ang) * len, py + Math.sin(ang) * len,
              px + Math.cos(ang) * len, py - Math.sin(ang) * len);
        } else {
          const p = o.p.eval({ x: X, y: Y }), q = o.q.eval({ x: X, y: Y });
          if (!p.ok || !q.ok || !isFinite(p.value) || !isFinite(q.value)) continue;
          const mag = Math.hypot(p.value, q.value) || 1;
          const len = gap * 0.5;
          const dx = (p.value / mag) * len, dy = (q.value / mag) * len;
          arrow(px, py, px + dx, py - dy); // world +y is up -> screen -y
        }
      }
    }
    ctx.restore();
  }

  function seg(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function arrow(x1, y1, x2, y2) {
    seg(x1, y1, x2, y2);
    const a = Math.atan2(y2 - y1, x2 - x1), h = 4;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - h * Math.cos(a - 0.5), y2 - h * Math.sin(a - 0.5));
    ctx.lineTo(x2 - h * Math.cos(a + 0.5), y2 - h * Math.sin(a + 0.5));
    ctx.closePath(); ctx.fill();
  }

  // --- pan & zoom ---
  let dragging = false, moved = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId); canvas.classList.add('cursor-grabbing');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    cx -= dx / scale; cy += dy / scale;
    lastX = e.clientX; lastY = e.clientY; draw();
  });
  canvas.addEventListener('pointerup', (e) => {
    dragging = false; canvas.classList.remove('cursor-grabbing');
    if (!moved && addPointOnClick) {
      const rect = canvas.getBoundingClientRect();
      addObject('point', `(${trimLabel(wx(e.clientX - rect.left))}, ${trimLabel(wy(e.clientY - rect.top))})`);
    }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const worldX = wx(mx), worldY = wy(my);
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    scale = clamp(scale * factor, 4, 4000);
    // keep the point under the cursor fixed
    cx = worldX - (mx - W / 2) / scale;
    cy = worldY + (my - H / 2) / scale;
    draw();
  }, { passive: false });

  // --- object management ---
  function splitTopComma(str) {
    const out = []; let depth = 0, cur = '';
    for (const ch of str) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }

  // Parse raw input into a drawable object (without id/color/visible), or return
  // an error. Shared by "Add" (commits it) and the live preview (draws it only).
  const TYPE_WORD = { function: 'function', vline: 'line', point: 'point', vfield: 'vector field', sfield: 'slope field' };
  function parseObject(type, rawInput) {
    const raw = String(rawInput).trim();
    if (raw === '') return { ok: false, empty: true };
    if (type === 'function') {
      const expr = raw.replace(/^y\s*=/, '').replace(/^f\s*\(\s*x\s*\)\s*=/, '').trim();
      const fn = compile(expr, ['x']);
      if (!fn.ok) return { ok: false, error: `Function error: ${fn.error}` };
      return { ok: true, obj: { type, label: `y = ${expr}`, fn } };
    }
    if (type === 'vline') {
      const r = evaluate(raw.replace(/^x\s*=/, '').trim());
      if (!r.ok) return { ok: false, error: `Line error: ${r.error || 'need x = c'}` };
      return { ok: true, obj: { type, label: `x = ${formatNumber(r.value)}`, c: r.value } };
    }
    if (type === 'point') {
      const parts = splitTopComma(raw.replace(/^\(/, '').replace(/\)$/, ''));
      if (parts.length !== 2) return { ok: false, error: 'Point needs (x, y).' };
      const a = evaluate(parts[0]), b = evaluate(parts[1]);
      if (!a.ok || !b.ok) return { ok: false, error: 'Point coordinates invalid.' };
      return { ok: true, obj: { type, label: `(${formatNumber(a.value)}, ${formatNumber(b.value)})`, x: a.value, y: b.value } };
    }
    if (type === 'vfield') {
      const parts = splitTopComma(raw.replace(/^\(/, '').replace(/\)$/, ''));
      if (parts.length !== 2) return { ok: false, error: 'Vector field needs (P, Q).' };
      const p = compile(parts[0], ['x', 'y']), q = compile(parts[1], ['x', 'y']);
      if (!p.ok || !q.ok) return { ok: false, error: `Field error: ${(p.error || q.error)}` };
      return { ok: true, obj: { type, label: `F = (${parts[0]}, ${parts[1]})`, p, q } };
    }
    const fn = compile(raw, ['x', 'y']); // sfield
    if (!fn.ok) return { ok: false, error: `Field error: ${fn.error}` };
    return { ok: true, obj: { type, label: `y' = ${raw}`, fn } };
  }

  function addObject(type, rawInput) {
    const parsed = parseObject(type, rawInput);
    if (!parsed.ok) { setMsg(parsed.empty ? 'Enter an expression first.' : parsed.error, true); return; }
    const obj = Object.assign({ id: ++idc, color: PALETTE[colorIdx++ % PALETTE.length], visible: true }, parsed.obj);
    objects.push(obj);
    history.add(obj.label, TYPE_WORD[type], { mode: 'graph' });
    preview = null;      // it's committed now; drop the tentative preview
    renderList();
    draw();
    setMsg(`Added: ${obj.label}`);
  }

  // Live preview: redraw the object being typed (dashed) before it's added.
  function updatePreview() {
    const parsed = parseObject(typeSelect.value, input.value);
    preview = parsed.ok ? Object.assign({ visible: true, preview: true, color: '#94a3b8' }, parsed.obj) : null;
    draw();
  }

  // --- controls UI ---
  const typeSelect = el('select', {
    className: 'bg-slate-800 text-slate-100 rounded-lg px-2 py-2 border border-slate-700 focus:outline-none focus:border-indigo-400 text-sm',
  }, [
    optionEl('function', 'Function  y=f(x)'),
    optionEl('point', 'Point  (x, y)'),
    optionEl('vline', 'Vertical line  x=c'),
    optionEl('vfield', 'Vector field  (P, Q)'),
    optionEl('sfield', "Slope field  y'=f(x,y)"),
  ]);
  const PLACEHOLDERS = {
    function: 'sin(x)   or   x^2 - 3', point: '(2, 3)', vline: '2',
    vfield: '(-y, x)', sfield: 'x - y',
  };
  const input = el('input', {
    className: 'flex-1 min-w-0 bg-slate-800 text-slate-100 rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-indigo-400 font-mono text-sm',
    attrs: { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: PLACEHOLDERS.function, 'aria-label': 'Graph expression' },
  });
  typeSelect.addEventListener('change', () => { input.placeholder = PLACEHOLDERS[typeSelect.value]; input.focus(); updatePreview(); });
  const addBtn = el('button', {
    className: 'shrink-0 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium transition-colors active:scale-95',
    text: 'Add', attrs: { type: 'button' },
    onClick: () => { addObject(typeSelect.value, input.value); input.value = ''; input.focus(); },
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });
  input.addEventListener('input', updatePreview); // plot the curve live as it's typed

  const listEl = el('div', { className: 'space-y-1.5 mt-3' });
  const msg = el('div', { className: 'mt-2 text-xs text-slate-400 min-h-[1rem]' });
  function setMsg(text, isError) { msg.textContent = text; msg.className = `mt-2 text-xs min-h-[1rem] ${isError ? 'text-rose-400' : 'text-slate-400'}`; }

  function renderList() {
    listEl.innerHTML = '';
    if (!objects.length) { listEl.appendChild(el('p', { className: 'text-xs text-slate-500', text: 'No objects yet. Add a function, point, or field above.' })); return; }
    objects.forEach((o) => {
      const row = el('div', { className: 'flex items-center gap-2 rounded-lg bg-slate-800/60 border border-slate-700 px-2.5 py-1.5' });
      const swatch = el('button', {
        className: 'shrink-0 w-3.5 h-3.5 rounded-full border border-black/30',
        attrs: { type: 'button', title: o.visible ? 'Hide' : 'Show' },
      });
      swatch.style.backgroundColor = o.visible ? o.color : 'transparent';
      swatch.style.boxShadow = `inset 0 0 0 2px ${o.color}`;
      swatch.addEventListener('click', () => { o.visible = !o.visible; renderList(); draw(); });
      row.appendChild(swatch);
      row.appendChild(el('span', { className: 'flex-1 min-w-0 truncate text-sm font-mono', text: o.label }));
      row.appendChild(el('button', {
        className: 'shrink-0 text-slate-500 hover:text-rose-400 px-1', html: '&times;',
        attrs: { type: 'button', 'aria-label': 'Delete object' },
        onClick: () => { const i = objects.indexOf(o); if (i >= 0) objects.splice(i, 1); renderList(); draw(); },
      }));
      listEl.appendChild(row);
    });
  }

  // zoom / reset / add-point toggle
  const zoomBtn = (label, fn) => el('button', {
    className: 'w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors', text: label, attrs: { type: 'button' }, onClick: fn,
  });
  const pointToggle = el('button', {
    className: 'rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-2 transition-colors',
    text: 'Click-to-add point: off', attrs: { type: 'button' },
    onClick: () => {
      addPointOnClick = !addPointOnClick;
      pointToggle.textContent = `Click-to-add point: ${addPointOnClick ? 'on' : 'off'}`;
      pointToggle.classList.toggle('bg-indigo-600', addPointOnClick);
      pointToggle.classList.toggle('text-white', addPointOnClick);
    },
  });
  const toolbar = el('div', { className: 'flex items-center gap-2 mt-3 flex-wrap' }, [
    zoomBtn('+', () => { scale = clamp(scale * 1.3, 4, 4000); draw(); }),
    zoomBtn('−', () => { scale = clamp(scale / 1.3, 4, 4000); draw(); }),
    el('button', { className: 'rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-2 transition-colors', text: 'Reset view', attrs: { type: 'button' }, onClick: () => { cx = 0; cy = 0; scale = 40; draw(); } }),
    pointToggle,
  ]);

  // --- assemble: plane on the right, controls on the left ---
  viz.appendChild(el('div', {
    className: 'rounded-2xl bg-slate-900 border border-slate-700 p-3 sm:p-4',
  }, [
    el('p', { className: 'text-xs font-medium text-slate-400 mb-1', text: 'Graphing plane — drag to pan, scroll to zoom' }),
    canvas,
  ]));
  controls.appendChild(el('div', { className: 'flex gap-2' }, [typeSelect, input, addBtn]));
  controls.appendChild(msg);
  controls.appendChild(toolbar);
  controls.appendChild(listEl);

  renderList();
  // size the canvas once laid out, and keep it responsive
  requestAnimationFrame(resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);
}

function optionEl(value, label) { const o = document.createElement('option'); o.value = value; o.textContent = label; return o; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function trimLabel(n) { return formatNumber(Math.round(n * 1e6) / 1e6); }
