#!/usr/bin/env node
// Tests the Malované křížovky engine (games/malovane-krizovky/index.html, the block between "Engine" and "Engine end")
// in Node:
//   node tools/krizovky-test.js              the puzzle set, the line solver against brute force, every puzzle
//                                            uniquely solvable by line logic alone, and the hints
//   node tools/krizovky-test.js --lines N    random lines for the brute-force comparison (default 5000)
//   node tools/krizovky-test.js --file X     test the engine in another file (an .html or .js with the same block)
// Only Node's built-in modules. Exit code 1 when a test fails.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const file = opt('--file', path.join(__dirname, '..', 'games', 'malovane-krizovky', 'index.html'));
const LINES = +opt('--lines', 5000);
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/\/\* -{10} Engine -{10} \*\/([\s\S]*?)\/\* -{10} Engine end -{10} \*\//);
if (!m) { console.error('No Engine block in ' + file); process.exit(1); }
const E = new Function(m[1] + '\nreturn KrizovkyEngine();')();

let failed = 0, warned = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('  FAIL ' + msg); } return cond; };
const warn = msg => { warned++; console.log('  WARN ' + msg); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// a small deterministic random generator, so a failure can be repeated
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };

const runsOf = line => {
  const out = []; let run = 0;
  for (const v of line) { if (v === 1) run++; else if (run) { out.push(run); run = 0; } }
  if (run) out.push(run);
  return out;
};
const solutionOf = p => {
  const out = [];
  for (const row of p.rows) for (const ch of row) out.push(ch === '.' ? 2 : 1);
  return out;
};

/* ---------- The puzzle set ---------- */
console.log('Puzzles');
const P = E.PUZZLES;
ok(Array.isArray(P) && P.length > 0, 'PUZZLES is a non-empty array');
ok(same(E.SIZES, [5, 10, 15]), 'SIZES is [5, 10, 15]');
const ids = new Set();
P.forEach((p, k) => {
  const tag = (p && p.id) || '#' + k;
  ok(typeof p.id === 'string' && /^p\d{2,}$/.test(p.id), tag + ': id looks like p01');
  ok(p.id === 'p' + String(k + 1).padStart(2, '0'), tag + ': ids go p01, p02, … in order');
  ok(!ids.has(p.id), tag + ': id is unique'); ids.add(p.id);
  ok(typeof p.name === 'string' && p.name.trim().length > 0, tag + ': has a name');
  ok(E.SIZES.includes(p.w) && p.w === p.h, tag + ': size is one of SIZES and square');
  ok(Array.isArray(p.rows) && p.rows.length === p.h && p.rows.every(r => typeof r === 'string' && r.length === p.w),
    tag + ': rows are h strings of length w');
  const letters = Object.keys(p.pal || {});
  ok(letters.length >= 1 && letters.length <= 6, tag + ': 1–6 colours');
  ok(letters.every(l => /^[a-z]$/.test(l) && /^#[0-9a-f]{6}$/i.test(p.pal[l])), tag + ': colours are #rrggbb for letters');
  ok(p.bg === undefined || /^#[0-9a-f]{6}$/i.test(p.bg), tag + ': bg is #rrggbb');
  const used = new Set();
  for (const r of p.rows || []) for (const ch of r) if (ch !== '.') used.add(ch);
  ok([...used].every(ch => letters.includes(ch)), tag + ': only palette letters in the rows');
  ok(letters.every(l => used.has(l)), tag + ': every palette colour is used');
  ok(used.size > 0, tag + ': the picture is not empty');
});
// group order: all of one size before the next, and inside a group the difficulty does not go down
let last = 0;
P.forEach((p, k) => {
  ok(E.SIZES.indexOf(p.w) >= E.SIZES.indexOf(last), p.id + ': groups go 5, 10, 15');
  if (k && P[k - 1].w === p.w && E.difficulty(p) < E.difficulty(P[k - 1]))
    warn(p.id + ' is easier (' + E.difficulty(p) + ') than ' + P[k - 1].id + ' (' + E.difficulty(P[k - 1]) + ')');
  last = p.w;
});

/* ---------- cluesOf ---------- */
console.log('Clues');
{
  const c = E.cluesOf({ w: 5, h: 3, rows: ['aa.b.', '.....', 'aaaaa'] });
  ok(same(c.rows, [[2, 1], [], [5]]), 'row clues (got ' + JSON.stringify(c.rows) + ')');
  ok(same(c.cols, [[1, 1], [1, 1], [1], [1, 1], [1]]), 'column clues (got ' + JSON.stringify(c.cols) + ')');
}

/* ---------- solveLine ---------- */
console.log('Line solver');
const L = (clue, s) => E.solveLine(clue, s.split('').map(Number));
const S = r => r ? r.join('') : null;
ok(S(L([], '00000')) === '22222', 'an empty clue crosses everything');
ok(S(L([], '00100')) === null, 'an empty clue with a filled cell is a contradiction');
ok(S(L([5], '00000')) === '11111', 'a full line');
ok(S(L([3], '00000')) === '00100', 'overlap of 3 in 5');
ok(S(L([2, 2], '00000')) === '11211', '2 2 in 5 is fixed');
ok(S(L([1, 1], '00000')) === '00000', '1 1 in 5 forces nothing');
ok(S(L([3], '10000')) === '11122', 'a run from a filled first cell');
ok(S(L([1], '00200')) === '00200', 'a cross alone forces nothing');
ok(S(L([2], '02020')) === null, 'no room for 2');
ok(S(L([3], '11110')) === null, 'too long a run');
ok(S(L([1, 1], '11000')) === null, 'two filled cells side by side for 1 1');
ok(S(L([1, 2], '00010')) === '00010', '1 2 with the fourth cell filled forces nothing more');
ok(S(L([4], '0000000')) === '0001000', 'overlap of 4 in 7');
ok(S(L([1, 3], '0000020')) === '1211122', '1 3 before a cross near the end is fixed');
ok(S(L([2, 1], '0100000002')) !== null, 'a consistent line is solved');
ok(S(L([1], '')) === null && S(L([], '')) === '', 'an empty line');
// brute force: every arrangement of the clue, the cells common to all that fit the known cells
function brute(clue, cells) {
  const n = cells.length; let all = null;
  for (let mask = 0; mask < (1 << n); mask++) {
    const a = [];
    for (let i = 0; i < n; i++) a.push(mask >> i & 1 ? 1 : 2);
    if (cells.some((v, i) => v && v !== a[i])) continue;
    if (!same(runsOf(a), clue)) continue;
    if (!all) all = a.slice(); else for (let i = 0; i < n; i++) if (all[i] !== a[i]) all[i] = 0;
  }
  return all;
}
{
  let bad = 0, contra = 0;
  const t0 = Date.now();
  for (let t = 0; t < LINES; t++) {
    const n = 1 + Math.floor(rnd() * 15);
    const sol = [];
    const density = 0.3 + rnd() * 0.5;
    for (let i = 0; i < n; i++) sol.push(rnd() < density ? 1 : 2);
    const clue = runsOf(sol);
    const known = rnd() * 0.6;
    // mostly true marks; sometimes a wrong one, so contradictions are tested too
    const cells = sol.map(v => rnd() < known ? (rnd() < 0.08 ? 3 - v : v) : 0);
    const a = E.solveLine(clue, cells), b = brute(clue, cells);
    if (!b) contra++;
    if (!same(a, b)) {
      if (++bad <= 5) console.log('  FAIL solveLine(' + JSON.stringify(clue) + ', ' + cells.join('') + ') = ' + S(a) + ', brute force ' + S(b));
    }
  }
  failed += bad;
  console.log('  ' + LINES + ' random lines (' + contra + ' contradictions) agree with brute force: ' + (bad ? bad + ' differ' : 'yes') +
    ' (' + (Date.now() - t0) + ' ms)');
}
{
  // speed: a 15-cell line with several runs, many times
  const clue = [2, 1, 3, 1, 2], cells = new Array(15).fill(0);
  const t0 = Date.now();
  for (let k = 0; k < 20000; k++) E.solveLine(clue, cells);
  const us = (Date.now() - t0) * 1000 / 20000;
  console.log('  a 15-cell line takes ' + us.toFixed(1) + ' µs');
  ok(us < 200, 'solveLine is fast enough (' + us.toFixed(1) + ' µs per 15-cell line)');
}

/* ---------- Every puzzle: one solution, found by line logic alone ---------- */
console.log('Solving');
const table = [];
for (const p of P) {
  const cl = E.cluesOf(p), sol = solutionOf(p);
  const r = E.solveGrid(cl, p.w, p.h);
  const good = r.ok && r.done && same(r.cells, sol);
  if (!ok(good, p.id + ' ' + p.name + ': line logic from an empty grid reaches the drawing' +
    (r.ok ? ' (' + r.cells.filter(v => v === 0).length + ' cells left unknown)' : ' (contradiction)'))) {
    for (let y = 0; y < p.h; y++) console.log('     ' + r.cells.slice(y * p.w, y * p.w + p.w).map((v, x) => v === 0 ? '?' : p.rows[y][x]).join(' '));
  }
  // the solver keeps a correct start and agrees with it
  const half = sol.map(v => rnd() < 0.5 ? v : 0);
  const r2 = E.solveGrid(cl, p.w, p.h, half);
  ok(r2.ok && r2.done && same(r2.cells, sol), p.id + ': solveGrid from a correct partial start reaches the drawing');
  table.push([p.id, p.w + '×' + p.h, p.name, r.passes, E.difficulty(p)]);
}
{
  // a wrong mark gives a contradiction (a hand-made heart with its top-left filled cell crossed)
  const p = { w: 5, h: 5, rows: ['.a.a.', 'aaaaa', 'aaaaa', '.aaa.', '..a..'] }, sol = solutionOf(p), bad = new Array(25).fill(0);
  bad[sol.indexOf(1)] = 2;
  ok(!E.solveGrid(E.cluesOf(p), p.w, p.h, bad).ok, 'a wrong mark makes solveGrid report ok=false');
  const start = sol.map((v, i) => i % 3 ? 0 : v), copy = start.slice();
  E.solveGrid(E.cluesOf(p), p.w, p.h, start);
  ok(same(start, copy), 'solveGrid does not change its start array');
}

/* ---------- Hints ---------- */
console.log('Hints');
{
  let checked = 0, fills = 0;
  for (const p of P) {
    const cl = E.cluesOf(p), sol = solutionOf(p), n = p.w * p.h;
    for (let t = 0; t < 12; t++) {
      // a random correct partial state: some cells right, the rest unknown
      const share = rnd();
      const cells = sol.map(v => rnd() < share ? v : 0);
      if (cells.indexOf(0) < 0) cells[Math.floor(rnd() * n)] = 0;
      const h = E.hintCell(cl, p.w, p.h, cells);
      if (!ok(h && h.i >= 0 && h.i < n, p.id + ': a hint exists on an unfinished correct grid')) continue;
      checked++;
      if (h.v === 1) fills++;
      ok(cells[h.i] === 0, p.id + ': the hint is an unknown cell');
      ok(h.v === sol[h.i], p.id + ': the hint is right (cell ' + h.i + ' = ' + h.v + ')');
      ok((h.line === 'r' || h.line === 'c') && Number.isInteger(h.k), p.id + ': the hint names its line');
      const inLine = h.line === 'r' ? Math.floor(h.i / p.w) === h.k : h.i % p.w === h.k;
      ok(inLine, p.id + ': the hint cell lies in its line');
      // that line alone forces it
      const idx = [];
      for (let j = 0; j < (h.line === 'r' ? p.w : p.h); j++) idx.push(h.line === 'r' ? h.k * p.w + j : j * p.w + h.k);
      const res = E.solveLine(h.line === 'r' ? cl.rows[h.k] : cl.cols[h.k], idx.map(i => cells[i]));
      ok(res && res[idx.indexOf(h.i)] === h.v, p.id + ': its line forces the hint');
      // deterministic
      ok(same(E.hintCell(cl, p.w, p.h, cells.slice()), h), p.id + ': the same state gives the same hint');
    }
    ok(E.hintCell(cl, p.w, p.h, sol) === null, p.id + ': no hint on a solved grid');
    // from an empty grid the first hint is a filled cell (every picture has a line that forces one)
    const first = E.hintCell(cl, p.w, p.h, new Array(n).fill(0));
    ok(first && first.v === 1, p.id + ': the first hint on an empty grid is a filled cell');
  }
  console.log('  ' + checked + ' hints checked (' + fills + ' filled cells)');
}

/* ---------- Summary ---------- */
console.log('');
console.log('id   size   name              passes  difficulty');
for (const r of table) console.log(r[0].padEnd(5) + r[1].padEnd(7) + r[2].padEnd(18) + String(r[3]).padStart(6) + String(r[4]).padStart(12));
const count = s => P.filter(p => p.w === s).length;
console.log(P.length + ' puzzles: ' + E.SIZES.map(s => count(s) + ' × ' + s + '×' + s).join(', '));
console.log(failed ? failed + ' FAILED' + (warned ? ', ' + warned + ' warnings' : '') : 'All passed' + (warned ? ' (' + warned + ' warnings)' : ''));
process.exit(failed ? 1 : 0);
