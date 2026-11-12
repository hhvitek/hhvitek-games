#!/usr/bin/env node
// Tests the Hledání min engine (games/hledani-min/index.html, the block between "Engine" and "Engine end") in Node:
//   node tools/miny-test.js              the rules, the first tap, the solver on hand-made and random positions,
//                                        and the "Bez hádání" generator on every board size (speed included)
//   node tools/miny-test.js --games N    deals per board size (default 300)
//   node tools/miny-test.js --file X     test the engine in another file (an .html or .js with the same block)
// Only Node's built-in modules. Exit code 1 when something fails.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const file = opt('--file', path.join(__dirname, '..', 'games', 'hledani-min', 'index.html'));
const GAMES = +opt('--games', 300);
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/\/\* -{10} Engine -{10} \*\/([\s\S]*?)\/\* -{10} Engine end -{10} \*\//);
if (!m) { console.error('No Engine block in ' + file); process.exit(1); }
const E = new Function(m[1] + '\nreturn MinyEngine();')();
// the board sizes of the game (SIZES in index.html)
const SIZES = [...src.matchAll(/(\w+):\s*\{ w: (\d+),\s*h: (\d+), m: (\d+)/g)].map(x => ({ id: x[1], w: +x[2], h: +x[3], m: +x[4] }));

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('  FAIL ' + msg); } };

// a board from a picture: '*' mine, '.' safe; rows separated by spaces
function board(pic) {
  const rows = pic.trim().split(/\s+/), h = rows.length, w = rows[0].length;
  const mine = rows.join('').split('').map(ch => ch === '*' ? 1 : 0);
  return { w, h, mine, num: E.numbers(w, h, mine), total: mine.reduce((a, v) => a + v, 0) };
}
// what the solver knows when the cells marked 'o' in the picture are open ('o' safe and open, '.' safe, '*' mine)
function position(pic) {
  const b = board(pic.replace(/o/g, '.'));
  const open = pic.trim().split(/\s+/).join('').split('').map(ch => ch === 'o' ? 1 : 0);
  const know = new Uint8Array(b.w * b.h);
  E.deduce(b.w, b.h, b.num, open, know, -1);
  return { ...b, open, know };
}
const at = (b, r, c) => r * b.w + c;

/* ---------- Rules ---------- */
console.log('Rules');
{
  const b = board('*.. ... ..*');
  ok(b.num[at(b, 0, 1)] === 1 && b.num[at(b, 1, 1)] === 2 && b.num[at(b, 1, 0)] === 1 && b.num[at(b, 2, 1)] === 1 && b.num[at(b, 0, 2)] === 0, 'numbers count the mines around');
  const st = new Array(9).fill(0);
  ok(E.reveal(b.w, b.h, b.mine, b.num, st, at(b, 0, 1)).length === 1, 'a number opens only itself');
  const b2 = board('..... ..... ..... ....*'), st2 = new Array(20).fill(0);
  st2[at(b2, 0, 4)] = 2; // a flag stays closed
  const opened = E.reveal(b2.w, b2.h, b2.mine, b2.num, st2, 0);
  ok(opened.length === 18 && st2[at(b2, 0, 4)] === 2 && st2[at(b2, 3, 4)] === 0, 'a zero opens its area, never a flag or a mine');
  const st3 = new Array(20).fill(0);
  ok(E.reveal(b2.w, b2.h, b2.mine, b2.num, st3, at(b2, 3, 4)).length === 1 && st3[at(b2, 3, 4)] === 1, 'a mine opens just itself');
  ok(E.reveal(b2.w, b2.h, b2.mine, b2.num, st3, at(b2, 3, 4)).length === 0, 'an open cell opens nothing');
  ok(E.neighbours(8, 10)[0].length === 3 && E.neighbours(8, 10)[9].length === 8 && E.neighbours(8, 10)[79].length === 3, 'neighbours at the corners and inside');
}

/* ---------- The first tap ---------- */
console.log('First tap');
for (const z of SIZES) {
  let bad = 0, det = true, differ = 0;
  for (let s = 0; s < 200; s++) {
    const first = (s * 37) % (z.w * z.h), seed = s * 2654435761 | 0;
    for (const noGuess of [false, true]) {
      const r = E.generate(z.w, z.h, z.m, first, seed, noGuess);
      const count = r.mine.reduce((a, v) => a + v, 0);
      if (count !== z.m || r.mine[first] || E.neighbours(z.w, z.h)[first].some(j => r.mine[j])) bad++;
      const st = new Array(z.w * z.h).fill(0);
      if (E.reveal(z.w, z.h, r.mine, E.numbers(z.w, z.h, r.mine), st, first).length < 2) bad++;
      if (E.generate(z.w, z.h, z.m, first, seed, noGuess).mine.join('') !== r.mine.join('')) det = false;
      if (E.generate(z.w, z.h, z.m, (first + 1) % (z.w * z.h), seed, noGuess).mine.join('') !== r.mine.join('')) differ++;
    }
  }
  ok(!bad, `${z.id}: the right number of mines, none on or next to the first tap, which opens an area (${bad} bad)`);
  ok(det, `${z.id}: the same seed and first tap give the same mines`);
  ok(differ > 300, `${z.id}: another first tap gives other mines (${differ}/400)`);
}

/* ---------- The solver on hand-made positions ---------- */
console.log('Solver');
{
  // a 1 with a single hidden neighbour: that one is a mine
  const p = position('oo* ooo ooo');
  ok(p.know[at(p, 0, 2)] === 2, 'a number with as many hidden cells as mines: all mines');
  // 1-1 at a wall (numbers 1 1 1 1 under the hidden row * . . *): the cell past each pair is safe
  const q = position('*..* oooo');
  ok(q.know[at(q, 0, 1)] === 1 && q.know[at(q, 0, 2)] === 1, 'the difference rule: 1-1 at the edge makes the third cell safe');
  ok(q.know[at(q, 0, 0)] === 2 && q.know[at(q, 0, 3)] === 2, 'and then the mines follow');
  // 1-2-1: the mines are under the 1s
  const r = position('*.* ooo ooo');
  ok(r.know[at(r, 0, 0)] === 2 && r.know[at(r, 0, 1)] === 1 && r.know[at(r, 0, 2)] === 2, 'the 1-2-1 pattern');
  // 1-2 (numbers 1 1 2 1 under . * . *): the cell only the 2 sees is a mine, the cell only the 1 sees is safe
  const s = position('.*.* oooo');
  ok(s.know[at(s, 0, 3)] === 2 && s.know[at(s, 0, 0)] === 1 && s.know[at(s, 0, 1)] === 2 && s.know[at(s, 0, 2)] === 1, 'the 1-2 pattern');
  // a lone 0 in the corner decides only its two hidden neighbours, nothing else
  const t = position('.*.. .... o...');
  ok(t.know.every((v, i) => t.open[i] || ([at(t, 1, 0), at(t, 1, 1), at(t, 2, 1)].includes(i) ? v === 1 : v === 0)), 'a lone 0 decides only its neighbours');
  // a real guess: two cells, one mine, nothing tells which
  const g = position('*. oo');
  ok(g.know[0] === 0 && g.know[1] === 0, 'a 50:50 stays undecided');
  // the mine count: the open 0 in the middle tells nothing about the ends; with 2 mines in all both are mines
  const b = board('*...*'), know = new Uint8Array(5);
  E.deduce(b.w, b.h, b.num, [0, 0, 1, 0, 0], know, -1);
  ok(know[0] === 0 && know[4] === 0 && know[1] === 1 && know[3] === 1, 'without the mine count the ends stay undecided');
  E.deduce(b.w, b.h, b.num, [0, 0, 1, 0, 0], know, 2);
  ok(know[0] === 2 && know[4] === 2, 'the mine count: as many mines left as hidden cells');
  const b2 = board('*.....'), know2 = new Uint8Array(6);
  // the 1 finds the mine, the 0 frees its neighbour, only the mine count frees the last two
  E.deduce(b2.w, b2.h, b2.num, [0, 1, 1, 0, 0, 0], know2, -1);
  ok(know2[0] === 2 && know2[3] === 1 && know2[4] === 0 && know2[5] === 0, 'far cells stay undecided without the mine count');
  E.deduce(b2.w, b2.h, b2.num, [0, 1, 1, 0, 0, 0], know2, 1);
  ok(know2[4] === 1 && know2[5] === 1, 'the mine count: all mines found, the rest is safe');
}

/* ---------- The solver never lies (random positions) ---------- */
console.log('Soundness');
{
  let lies = 0, found = 0;
  const rand = E.rng(12345);
  for (const z of SIZES) for (let s = 0; s < 150; s++) {
    const n = z.w * z.h, first = Math.floor(rand() * n);
    const { mine } = E.generate(z.w, z.h, z.m, first, s * 7919, false), num = E.numbers(z.w, z.h, mine), st = new Array(n).fill(0);
    E.reveal(z.w, z.h, mine, num, st, first);
    // open random safe cells, testing what the solver says after each step
    for (let k = 0; k < 40; k++) {
      const open = st.map(v => v === 1 ? 1 : 0), know = new Uint8Array(n);
      E.deduce(z.w, z.h, num, open, know, k % 2 ? z.m : -1);
      for (let i = 0; i < n; i++) if (!open[i] && know[i]) { found++; if ((know[i] === 2) !== !!mine[i]) lies++; }
      const safe = [];
      for (let i = 0; i < n; i++) if (!mine[i] && st[i] === 0) safe.push(i);
      if (!safe.length) break;
      E.reveal(z.w, z.h, mine, num, st, safe[Math.floor(rand() * safe.length)]);
    }
  }
  ok(!lies, `everything the solver decides is true (${lies} wrong of ${found})`);
  ok(found > 1000, `the solver decides something (${found} cells)`);
}

/* ---------- "Bez hádání": every deal can be cleared by logic, fast ---------- */
console.log('Bez hádání');
for (const z of SIZES) {
  const times = [], tries = []; let fails = 0, unsolvable = 0, plain = 0;
  for (let s = 0; s < GAMES; s++) {
    const first = (s * 53) % (z.w * z.h), seed = (s + 1) * 40503 | 0;
    const t0 = process.hrtime.bigint();
    const r = E.generate(z.w, z.h, z.m, first, seed, true);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6); tries.push(r.tries);
    if (!r.ok) fails++;
    if (!E.solvable(z.w, z.h, r.mine, E.numbers(z.w, z.h, r.mine), first, z.m)) unsolvable++;
    const p = E.generate(z.w, z.h, z.m, first, seed, false);
    if (E.solvable(z.w, z.h, p.mine, E.numbers(z.w, z.h, p.mine), first, z.m)) plain++;
  }
  times.sort((a, b) => a - b); tries.sort((a, b) => a - b);
  const q = (a, f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];
  console.log(`  ${z.id} ${z.w}×${z.h}, ${z.m} mines: tries median ${q(tries, .5)}, 95 % ${q(tries, .95)}, max ${tries[tries.length - 1]}; ` +
    `ms median ${q(times, .5).toFixed(1)}, 95 % ${q(times, .95).toFixed(1)}, max ${times[times.length - 1].toFixed(1)}; ` +
    `a plain deal needs no guess in ${Math.round(100 * plain / GAMES)} %`);
  ok(!fails, `${z.id}: a no-guess deal found every time (${fails} failed)`);
  ok(!unsolvable, `${z.id}: every no-guess deal is cleared by the solver (${unsolvable} not)`);
  ok(q(times, .95) < 50, `${z.id}: fast enough for a phone (95 % under 50 ms on this computer)`);
}

console.log(failed ? `\n${failed} FAILED` : '\nall tests passed');
process.exit(failed ? 1 : 0);
