// history.js — localStorage-backed calculation history shared by every mode.
//
// One entry = { id, expression, result, mode, ts }. Every completed calculation
// (standard, scientific, formula, physics, vectors) is written here via add().
// Subscribers (the history drawer in main.js) re-render on change.

const KEY = 'qualculator.history.v1';
const MAX_ENTRIES = 200;

let entries = load();
let counter = 0;
const listeners = new Set();

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn()); }

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // corrupt/unavailable storage -> start empty, never crash
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // storage full or blocked (e.g. private mode): keep working in-memory
  }
}

// Unique id without relying on Math.random(): time + monotonic counter.
function makeId() {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

export function add(expression, result, meta = {}) {
  entries.unshift({
    id: makeId(),
    expression: String(expression),
    result: String(result),
    mode: meta.mode || 'calc',
    ts: Date.now(),
  });
  if (entries.length > MAX_ENTRIES) entries = entries.slice(0, MAX_ENTRIES);
  save();
  emit();
}

export function remove(id) {
  entries = entries.filter((e) => e.id !== id);
  save();
  emit();
}

export function clearAll() {
  entries = [];
  save();
  emit();
}

export function all() { return entries.slice(); }
