#!/usr/bin/env node
// Corrupted saves never crash a game (CLAUDE.md: "corrupted or invalid data must never crash the game"). In Node:
//   node tools/saves-test.js                 every game of games/registry.js: it is started on a fake page (every
//                                            element is a stand-in that accepts anything), played a little where the
//                                            game has a test hook for it, and its save is taken; then the game is
//                                            started again N times, each time with that save broken in 1–3 places
//                                            (a value replaced by a wrong type, a list cut or lengthened, a number
//                                            off by one, a key removed), and every exception is reported
//   node tools/saves-test.js --saves N       broken saves per game (default 200)
//   node tools/saves-test.js --ids a,b       only these games
// It finds crashes in loading and in the first moments after it (timers run for about 3 s of game time), not
// wrong behaviour; a game the fake page cannot run at all is listed as skipped. Only Node's built-in modules.
// Exit code 1 when something fails.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const SAVES = +opt('--saves', 200);
const ALL = [...fs.readFileSync(path.join(ROOT, 'games', 'registry.js'), 'utf8').matchAll(/id: '([^']+)'/g)].map(m => m[1]);
const IDS = opt('--ids', '') ? opt('--ids').split(',') : ALL;

/* ---------- The fake page ---------- */
// A stand-in for any DOM object: every property is another stand-in, calls and `new` work, numbers read as 0,
// strings as '' and lists as empty (element.querySelectorAll gives 64 stand-ins, enough for any board)
function stub() {
  const store = {};
  return new Proxy(function () {}, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return h => h === 'string' ? '' : 0;
      if (k === Symbol.iterator) return function* () {};
      if (k === 'then' || k === 'toJSON') return undefined;
      if (k === 'length') return 0;
      if (k in store) return store[k];
      if (k === 'children') return (store.children = Array.from({ length: 400 }, stub));
      if (k === 'querySelectorAll') return () => Array.from({ length: 64 }, stub);
      if (k === 'hidden') return true;
      if (k === 'value' || k === 'textContent' || k === 'innerHTML' || k === 'className') return '';
      if (typeof k === 'string' && /^(offset|client|scroll)(Width|Height|Top|Left)$|^(top|left|right|bottom|width|height|x|y)$/.test(k)) return 0;
      return stub();
    },
    set(t, k, v) { store[k] = v; if (k === 'innerHTML') store.children = Array.from({ length: (String(v).match(/<div/g) || []).length }, stub); return true; },
    apply() { return stub(); },
    construct() { return stub(); },
    has() { return true; },
  });
}
// the game's scripts in order: shared files (src) and the inline ones
function scriptsOf(id) {
  const file = path.join(ROOT, 'games', id, 'index.html'), src = fs.readFileSync(file, 'utf8'), out = [];
  for (const m of src.matchAll(/<script(\s+src="([^"]+)")?>([\s\S]*?)<\/script>/g)) {
    if (m[2]) out.push({ name: m[2], code: fs.readFileSync(path.resolve(path.dirname(file), m[2]), 'utf8') });
    else out.push({ name: 'inline', code: m[3] });
  }
  return out;
}
const where = e => e && e.stack ? `${e.message} @ ${(e.stack.split('\n').find(l => l.includes(' at ')) || '').trim()}` : String(e);
// starts a game with the given localStorage; timers run only when runTimers is called (game time, not real time)
function start(id, storage, extra = '') {
  const ls = new Map(Object.entries(storage || {})), errors = [], timers = [];
  let tid = 0, clock = 0;
  const localStorage = {
    getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k),
    key: i => [...ls.keys()][i] ?? null, get length() { return ls.size; }, clear: () => ls.clear(),
  };
  const els = new Map(), el = s => { if (!els.has(s)) els.set(s, stub()); return els.get(s); };
  const document = new Proxy(stub(), { get(t, k) {
    if (k === 'querySelector' || k === 'getElementById') return el;
    if (k === 'querySelectorAll') return () => [];
    if (k === 'hidden') return false;
    return t[k];
  } });
  const later = (f, t) => { if (typeof f === 'function') timers.push({ id: ++tid, f, at: clock + (+t || 0) }); return tid; };
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} }, Math, JSON, Date, Array, Object, String, Number, Boolean, Map, Set,
    WeakMap, WeakSet, Symbol, Promise, Error, TypeError, RangeError, RegExp, Int8Array, Uint8Array, Int16Array, Uint16Array,
    Int32Array, Uint32Array, Float32Array, Float64Array, BigInt, Proxy, Reflect, parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, structuredClone, localStorage, sessionStorage: localStorage, document,
    navigator: { storage: { persist: () => Promise.resolve(true) }, userActivation: { hasBeenActive: false }, vibrate: () => true },
    location: { search: '?menu', href: `http://localhost/games/${id}/index.html?menu`, pathname: `/games/${id}/index.html` },
    history: { state: null, pushState() {}, go() {}, back() {}, replaceState() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    requestAnimationFrame: f => later(() => f(clock), 16), cancelAnimationFrame() {},
    setTimeout: later, clearTimeout: x => { const i = timers.findIndex(q => q.id === x); if (i >= 0) timers.splice(i, 1); },
    setInterval: () => 0, clearInterval() {},
    performance: { now: () => clock }, crypto: require('crypto').webcrypto,
    visualViewport: { height: 873, width: 393, scale: 1, addEventListener() {} }, innerHeight: 873, innerWidth: 393, devicePixelRatio: 3,
    Worker: function () { throw new Error('no worker here'); }, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, Blob: function () {},
    MutationObserver: function () { return { observe() {}, disconnect() {} }; }, ResizeObserver: function () { return { observe() {}, disconnect() {} }; },
    getComputedStyle: () => stub(), addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    Event: function () {}, CustomEvent: function () {}, Image: function () { return stub(); }, AudioContext: undefined,
    queueMicrotask: f => Promise.resolve().then(f),
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const scripts = scriptsOf(id);
  if (extra) scripts.push({ name: 'extra', code: extra });
  for (const s of scripts) {
    try { vm.runInContext(s.code, ctx, { filename: `${id}/${s.name}`, timeout: 20000 }); }
    catch (e) { errors.push(`loading (${s.name}): ${where(e)}`); }
  }
  // runs the due timers in time order, up to `until` ms of game time
  const runTimers = (until, max = 300) => {
    for (let k = 0; k < max && timers.length; k++) {
      timers.sort((a, b) => a.at - b.at);
      if (timers[0].at > until) break;
      const q = timers.shift(); clock = Math.max(clock, q.at);
      try { q.f(clock); } catch (e) { errors.push(`timer: ${where(e)}`); }
    }
  };
  return { ctx, ls, errors, runTimers };
}
const tick = () => new Promise(r => setImmediate(r));
async function settle(g, ms) { for (let t = 500; t <= ms; t += 500) { g.runTimers(t); await tick(); } }

/* ---------- Playing a little before the save is taken (games with a test hook for it) ---------- */
const PLAY = {
  reversi: c => { c.Reversi.noWorker && c.Reversi.noWorker(); c.Reversi.skip(20); },
  mlyn: c => { c.Mlyn.noWorker && c.Mlyn.noWorker(); c.Mlyn.skip(30); },
  lode: c => c.Lode.skip(6),
  general: c => c.General.nearEnd(),
  'hledani-min': c => { const H = c.HledaniMin, G = H.state.G; H.tap((G.h >> 1) * G.w + (G.w >> 1)); for (let i = 0; i < 20; i++) H.hold(i); },
  'sipky-ven': c => { const S = c.SipkyVen; for (let k = 0; k < 4; k++) { const f = S.freeNow(); if (f.length) S.tapPiece(f[0]); } S.tapPiece(0); },
  vezicky: c => { const V = c.Vezicky; for (let k = 0; k < 6; k++) { const a = V.advise(); if (a) V.place(a.i, a.cell); } },
  pristani: c => { c.Pristani.outcome('land'); }, // a landing: stars, a best, a ghost
};

/* ---------- Breaking a save ---------- */
let seed = 12345;
const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const WRONG = [null, -1, 0, 1, 2, 3, 1e9, 1.5, '', 'x', true, false, [], {}, [null], [[]], [-1, 99], 'won', 'lost', 'over', 'playing'];
function paths(o, p = [], out = []) {
  out.push(p);
  if (o && typeof o === 'object') for (const k of Object.keys(o)) paths(o[k], p.concat(k), out);
  return out;
}
function breakOne(obj) {
  const all = paths(obj).filter(p => p.length);
  if (!all.length) return 'nothing to break';
  const p = all[rnd(all.length)];
  let o = obj; for (const k of p.slice(0, -1)) o = o[k];
  const k = p[p.length - 1], r = rnd(10);
  if (r === 0) delete o[k];
  else if (r === 1 && Array.isArray(o[k])) o[k] = o[k].slice(0, rnd(o[k].length + 1));
  else if (r === 2 && Array.isArray(o[k]) && o[k].length) o[k].push(JSON.parse(JSON.stringify(o[k][rnd(o[k].length)])));
  else if (r === 3 && typeof o[k] === 'number') o[k] += rnd(2) ? 1 : -1;
  else if (r === 4 && Array.isArray(o)) o.reverse();
  else o[k] = JSON.parse(JSON.stringify(WRONG[rnd(WRONG.length)]));
  return p.join('.');
}

(async () => {
  let failed = 0;
  // self-check: an exception in a game must be reported, else every "0 crashes" below would mean nothing
  const self = start(ALL[0], {}, 'setTimeout(() => { throw new Error("self-check"); }, 10); JSON.parse("{");');
  await settle(self, 1000);
  if (self.errors.length !== 2) { console.log('FAIL self-check: the fake page did not report both test exceptions', self.errors); process.exit(1); }

  const skipped = [];
  console.log(`Broken saves: ${SAVES} per game`);
  for (const id of IDS) {
    const key = `games.${id}.state`;
    const base = start(id, {});
    await settle(base, 3000);
    try { if (PLAY[id]) PLAY[id](base.ctx); } catch (e) { base.errors.push(`playing: ${where(e)}`); }
    await settle(base, 6000);
    const good = base.ls.get(key);
    if (base.errors.length || !good) { skipped.push(`${id} (${base.errors[0] || 'nothing saved'})`); continue; }
    const seen = new Map();
    for (let t = 0; t < SAVES; t++) {
      const o = JSON.parse(good), broken = [];
      for (let n = 1 + rnd(3); n > 0; n--) broken.push(breakOne(o));
      const g = start(id, { [key]: JSON.stringify(o) });
      await settle(g, 3000);
      if (!g.ls.has(key)) g.errors.push('the game saved nothing after loading a broken save');
      for (const e of g.errors) { const k = e.replace(/:\d+:\d+\)?$/, ''); if (!seen.has(k)) seen.set(k, { e, broken, n: 0 }); seen.get(k).n++; }
    }
    if (seen.size) failed++;
    console.log(`  ${id.padEnd(20)} ${seen.size ? 'FAIL' : 'ok'}${seen.size ? '' : `  (save ${good.length} characters${PLAY[id] ? ', after some play' : ''})`}`);
    for (const v of seen.values()) console.log(`    ${v.n}× ${v.e}\n       broken: ${v.broken.join(', ')}`);
  }
  if (skipped.length) console.log(`Skipped (the fake page cannot run them):\n  ${skipped.join('\n  ')}`);
  console.log(failed ? `\n${failed} games FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})();
