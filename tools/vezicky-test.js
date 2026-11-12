#!/usr/bin/env node
// Tests the Věžičky engine (games/vezicky/index.html, the block between "Engine" and "Engine end") in Node:
//   node tools/vezicky-test.js              the board, the gathering rule on hand-made boards, vanishing and the
//                                           points, invariants and determinism on random games, the end of the
//                                           game, and simulated games (random moves and Poradit) per difficulty
//   node tools/vezicky-test.js --games N    simulated games per difficulty and player (default 40 random, 8 Poradit)
//   node tools/vezicky-test.js --file X     test the engine in another file (an .html or .js with the same block)
// Only Node's built-in modules. Exit code 1 when a test fails.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const file = opt('--file', path.join(__dirname, '..', 'games', 'vezicky', 'index.html'));
const GAMES = +opt('--games', 40);
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/\/\* -{10} Engine -{10} \*\/([\s\S]*?)\/\* -{10} Engine end -{10} \*\//);
if (!m) { console.error('No Engine block in ' + file); process.exit(1); }
const E = new Function(m[1] + '\nreturn VezickyEngine();')();
// the difficulties as the game defines them (start colours)
const DIFFS = [...src.matchAll(/\{ id: '(\w+)',\s+name: '([^']+)',\s+start: (\d+)/g)].map(x => ({ id: x[1], name: x[2], start: +x[3] }));

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('  FAIL ' + msg); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// the same random numbers as the game's seededRnd
function seeded(seed) {
  let s = seed | 0;
  return n => { s = (s + 0x6D2B79F5) | 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) % n; };
}
const cellOf = (c, y) => E.CELLS.findIndex(p => p.c === c && p.y === y);
const empty = () => Array.from({ length: E.N }, () => []);
const tiles = b => b.reduce((a, s) => a + s.length, 0);
const R = 0, B = 1, Y = 2, G = 3;

/* ---------- The board ---------- */
console.log('board');
ok(E.N === 24, `24 cells (${E.N})`);
ok(DIFFS.length === 3 && eq(DIFFS.map(d => d.start), [4, 5, 6]), 'three difficulties starting with 4, 5, 6 colours');
for (let i = 0; i < E.N; i++) {
  ok(E.NB[i].length >= 3 && E.NB[i].length <= 6, `cell ${i}: 3–6 neighbours (${E.NB[i].length})`);
  for (const j of E.NB[i]) ok(E.NB[j].includes(i), `neighbours ${i}–${j} both ways`);
}
const mid = cellOf(2, 4); // the middle column, third cell: six neighbours
ok(mid >= 0 && E.NB[mid].length === 6, 'an inner cell has six neighbours');
ok(E.NB.reduce((a, n) => a + n.length, 0) / 2 === 55, 'the honeycomb has 55 neighbour pairs');

/* ---------- The gathering rule on hand-made boards ---------- */
console.log('rule');
// A, Bc, C are three neighbours of mid that do not touch each other: above, lower right, lower left
const up = cellOf(2, 2), lr = cellOf(3, 5), ll = cellOf(1, 5), ur = cellOf(3, 3), down = cellOf(2, 6);
ok(!E.NB[up].includes(lr) && !E.NB[up].includes(ll) && !E.NB[lr].includes(ll), 'test cells: up, lower right, lower left do not touch');
ok(E.NB[up].includes(ur) && E.NB[mid].includes(ur), 'test cells: upper right touches up and mid');
function run(setup, placed) {
  const b = empty();
  for (const [i, s] of setup) b[i] = s.slice();
  return E.settle(b, placed);
}
{ // a pure placed stack takes the matching top from a mixed neighbour
  const r = run([[mid, [R, R]], [up, [B, R]]], mid);
  ok(eq(r.board[mid], [R, R, R]) && eq(r.board[up], [B]), 'pure placed stack collects: ' + JSON.stringify([r.board[mid], r.board[up]]));
  ok(r.events.length === 1 && eq(r.events[0], { t: 'move', from: up, to: mid, n: 1, c: R }), 'one move event');
}
{ // a mixed placed stack gives its top to a pure neighbour, and shows the colour under it
  const r = run([[mid, [G, R]], [up, [R, R, R]]], mid);
  ok(eq(r.board[up], [R, R, R, R]) && eq(r.board[mid], [G]), 'top goes to the pure neighbour: ' + JSON.stringify([r.board[mid], r.board[up]]));
}
{ // both mixed: the longer top run is the target
  const r = run([[mid, [G, R, R]], [up, [B, R]]], mid);
  ok(eq(r.board[mid], [G, R, R, R]) && eq(r.board[up], [B]), 'longer run is the target');
  const r2 = run([[mid, [G, R]], [up, [B, R, R]]], mid);
  ok(eq(r2.board[up], [B, R, R, R]) && eq(r2.board[mid], [G]), 'longer run on the neighbour is the target');
}
{ // a tie: the placed stack is the target
  const r = run([[mid, [G, R]], [up, [B, R]]], mid);
  ok(eq(r.board[mid], [G, R, R]) && eq(r.board[up], [B]), 'tie: the placed stack');
  const r2 = run([[mid, [R]], [up, [R]]], mid);
  ok(eq(r2.board[mid], [R, R]) && eq(r2.board[up], []), 'tie of pure stacks: the placed stack');
}
{ // a pure neighbour wins over a longer mixed run
  const r = run([[mid, [G, R, R, R]], [up, [R]]], mid);
  ok(eq(r.board[up], [R, R, R, R]) && eq(r.board[mid], [G]), 'pure beats a longer mixed run');
}
{ // all matching neighbours gather on the placed stack
  const r = run([[mid, [R]], [up, [G, R]], [lr, [Y, R]], [ll, [B, R, R]]], mid);
  ok(eq(r.board[mid], [R, R, R, R, R]) && eq(r.board[up], [G]) && eq(r.board[lr], [Y]) && eq(r.board[ll], [B]), 'three neighbours gather: ' + JSON.stringify([up, lr, ll, mid].map(i => r.board[i])));
}
{ // the target does not touch another member: that one goes over the placed stack
  const r = run([[mid, [G, R]], [up, [R, R, R, R]], [lr, [B, R]]], mid);
  ok(eq(r.board[up], [R, R, R, R, R, R]) && eq(r.board[mid], [G]) && eq(r.board[lr], [B]), 'over the placed stack to the pure target');
  ok(eq(r.events.map(e => [e.from, e.to, e.n]), [[lr, mid, 1], [mid, up, 2]]), 'events: lower right to mid, then mid to up: ' + JSON.stringify(r.events));
}
{ // a chain: the colour under the moved tiles gathers with the next neighbour
  const r = run([[mid, [B, R]], [up, [R, R, R]], [lr, [Y, B]]], mid);
  ok(eq(r.board[up], [R, R, R, R]) && eq(r.board[mid], [B, B]) && eq(r.board[lr], [Y]), 'chain: ' + JSON.stringify([mid, up, lr].map(i => r.board[i])));
}
{ // gathering goes on from the target to its own neighbours
  const far = cellOf(4, 2); // touches ur but not mid
  ok(E.NB[ur].includes(far) && !E.NB[mid].includes(far), 'test cells: far touches ur, not mid');
  const r = run([[mid, [G, R]], [ur, [R, R]], [far, [B, R]]], mid);
  ok(eq(r.board[ur], [R, R, R, R]) && eq(r.board[mid], [G]) && eq(r.board[far], [B]), 'gathering spreads: ' + JSON.stringify([mid, ur, far].map(i => r.board[i])));
}
{ // ten of one colour vanish; points = tiles
  const r = run([[mid, [R, R, R, R]], [up, [R, R, R, R, R, R]]], mid);
  ok(eq(r.board[mid], []) && eq(r.board[up], []), 'ten vanish');
  ok(r.points === 10 && r.clears === 1, `10 points (${r.points})`);
  ok(r.events[r.events.length - 1].t === 'clear' && r.events[r.events.length - 1].n === 10, 'a clear event');
  const r2 = run([[mid, [B, R, R, R]], [up, [R, R, R, R, R, R, R, R, R]]], mid);
  ok(r2.points === 12 && eq(r2.board[up], []) && eq(r2.board[mid], [B]), `12 vanish: 12 points (${r2.points})`);
  const r3 = run([[mid, [R, R, R]], [up, [R, R, R, R, R, R]]], mid);
  ok(r3.points === 0 && eq(r3.board[up], [R, R, R, R, R, R, R, R, R]), 'nine stay');
}
{ // a second vanishing in the same move counts twice; a vanishing shows the colour under it, which gathers again
  // mid [B, R] next to up = 9 red (pure) -> 10 red vanish at up; mid shows B next to lr = 9 blue -> 10 blue vanish
  const r = run([[mid, [B, R]], [up, Array(9).fill(R)], [lr, Array(9).fill(B)]], mid);
  ok(r.clears === 2 && r.points === 10 + 20, `two clears: 10 + 2 × 10 = 30 (${r.points})`);
  ok(eq(r.board[mid], []) && eq(r.board[up], []) && eq(r.board[lr], []), 'all gone');
}
{ // under a vanished run a colour comes up and gathers with a neighbour
  const r = run([[mid, [R, R]], [up, [Y, ...Array(8).fill(R)]], [ur, [B, Y]]], mid);
  ok(eq(r.board[up], [Y, Y]) && eq(r.board[ur], [B]) && r.points === 10, 'after vanishing: ' + JSON.stringify([mid, up, ur].map(i => r.board[i])));
}
{ // nothing to gather
  const r = run([[mid, [R, B]], [up, [B, R]]], mid);
  ok(r.events.length === 0 && eq(r.board[mid], [R, B]), 'different tops stay');
}

/* ---------- Tray stacks ---------- */
console.log('tray');
{
  const rnd = seeded(7);
  const sizes = new Set(), runs = new Set();
  for (let k = 0; k < 5000; k++) {
    const colors = 4 + k % 5, s = E.genStack(rnd, colors);
    sizes.add(s.length);
    ok(s.length >= 2 && s.length <= 6 && s.every(c => c >= 0 && c < colors), 'a stack has 2–6 tiles of the colours in play');
    let n = 1; for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1]) n++;
    runs.add(n);
    if (n > 3) { ok(false, 'at most 3 runs: ' + JSON.stringify(s)); break; }
  }
  ok(eq([...sizes].sort(), [2, 3, 4, 5, 6]), 'all sizes 2–6 appear');
  ok(eq([...runs].sort(), [1, 2, 3]), '1, 2 and 3 runs appear');
  ok(eq(E.genTray(seeded(42), 5), E.genTray(seeded(42), 5)), 'the same seed gives the same tray');
  ok(!eq(E.genTray(seeded(42), 5), E.genTray(seeded(43), 5)), 'another seed another tray');
  ok(E.colorsFor(4, 0) === 4 && E.colorsFor(4, 149) === 4 && E.colorsFor(4, 150) === 5 && E.colorsFor(5, 10000) === 8, 'a colour more every 150 points, at most 8');
}

/* ---------- Random games: invariants, determinism, the end ---------- */
console.log('games');
// one game; player 'random' (seeded) or 'advise' (Poradit every move). Checks the invariants on every move.
function play(start, player, seed, cap = 3000) {
  const rnd = seeded(seed), pick = seeded(seed ^ 0x5bd1e995);
  let b = empty(), score = 0, cols = start, moves = 0, maxh = 0, clears = 0;
  let tray = E.genTray(rnd, cols);
  const log = [];
  while (moves < cap) {
    const em = E.empties(b);
    if (!em.length) break;
    let i, cell;
    if (player === 'advise') ({ i, cell } = E.advise(b, tray));
    else { const av = [0, 1, 2].filter(k => tray[k]); i = av[pick(av.length)]; cell = em[pick(em.length)]; }
    const before = b.map(s => s.slice()); before[cell] = tray[i].slice();
    const r = E.settle(before, cell);
    // tiles are kept: before = after + vanished
    if (tiles(before) !== tiles(r.board) + r.cleared) { ok(false, `tiles lost at move ${moves}`); break; }
    // settled: no two neighbours share a top colour, no top run of 10 or more
    for (let k = 0; k < E.N; k++) {
      if (!r.board[k].length) continue;
      if (E.runLen(r.board[k]) >= E.CLEAR) { ok(false, `a run of ${E.CLEAR}+ stayed at move ${moves}`); return null; }
      if (E.NB[k].some(j => E.top(r.board[j]) === E.top(r.board[k]))) { ok(false, `neighbours with one top colour stayed at move ${moves}`); return null; }
    }
    // the events replayed on the board before give the board after (what the animation shows)
    const vb = before.map(s => s.slice());
    for (const ev of r.events) {
      if (ev.t === 'move') {
        if (E.top(vb[ev.from]) !== ev.c || E.runLen(vb[ev.from]) !== ev.n) { ok(false, 'a move event does not match the board'); return null; }
        vb[ev.from].length -= ev.n; for (let k = 0; k < ev.n; k++) vb[ev.to].push(ev.c);
      } else vb[ev.at].length -= ev.n;
    }
    if (!eq(vb, r.board)) { ok(false, `events do not replay to the board at move ${moves}`); return null; }
    // the points: every vanished tile counts, the k-th vanishing k times
    const clearsEv = r.events.filter(e => e.t === 'clear');
    if (r.points !== clearsEv.reduce((a, e, k) => a + e.n * (k + 1), 0)) { ok(false, 'points do not add up'); return null; }
    b = r.board; score += r.points; clears += r.clears; moves++; tray[i] = null;
    log.push(i * 100 + cell);
    for (const s of b) maxh = Math.max(maxh, s.length);
    if (tray.every(s => !s)) { cols = Math.max(cols, E.colorsFor(start, score)); tray = E.genTray(rnd, cols); }
  }
  return { score, moves, maxh, clears, cols, board: b, log, ended: !E.empties(b).length };
}
{
  const a = play(5, 'random', 1), b = play(5, 'random', 1);
  ok(a && b && a.score === b.score && eq(a.log, b.log) && eq(a.board, b.board), 'the same seed and moves give the same game');
  ok(a && a.ended && E.empties(a.board).length === 0, 'a game ends with a full board');
  // a full settled board: no move is possible (every cell holds a stack)
  ok(a && a.board.every(s => s.length > 0), 'the end: every cell has a stack');
}
{ // settle does not change its input
  const b = empty(); b[mid] = [R]; b[up] = [R]; const copy = JSON.stringify(b);
  E.settle(b, mid);
  ok(JSON.stringify(b) === copy, 'settle leaves the board it got as it was');
}
{ // advise picks an empty cell and a stack of the tray, and takes a clear when there is one
  const b = empty(); b[up] = Array(8).fill(R); b[down] = [B];
  const a = E.advise(b, [[G, Y], [R, R], null]);
  ok(a && a.i === 1 && E.NB[up].includes(a.cell) && !b[a.cell].length, 'Poradit takes the move that clears: ' + JSON.stringify(a));
  const full = empty().map((s, k) => [k % 8]);
  ok(E.advise(full, [[R], null, null]) === null, 'Poradit on a full board: nothing');
}

/* ---------- Simulated games per difficulty ---------- */
console.log(`simulated games (${GAMES} random, ${Math.max(2, GAMES >> 2)} with Poradit per difficulty)`);
const sum = (rs, k) => rs.reduce((a, r) => a + r[k], 0);
for (const d of DIFFS) {
  for (const player of ['random', 'advise']) {
    const n = player === 'random' ? GAMES : Math.max(2, GAMES >> 2);
    const rs = [];
    for (let g = 0; g < n; g++) { const r = play(d.start, player, 1000 + g); if (!r) break; rs.push(r); }
    if (rs.length < n) break;
    ok(rs.every(r => r.ended), `${d.name} ${player}: every game ends`);
    ok(rs.every(r => r.maxh <= 20), `${d.name} ${player}: towers stay at most 20 tiles (${Math.max(...rs.map(r => r.maxh))})`);
    const med = k => rs.map(r => r[k]).sort((x, y) => x - y)[rs.length >> 1];
    console.log(`  ${d.name.padEnd(8)} ${player === 'random' ? 'random ' : 'Poradit'}  moves ${(sum(rs, 'moves') / n).toFixed(0).padStart(4)} (median ${med('moves')})  points ${(sum(rs, 'score') / n).toFixed(0).padStart(5)} (median ${med('score')})  tallest ${Math.max(...rs.map(r => r.maxh))}  colours at the end ${(sum(rs, 'cols') / n).toFixed(1)}`);
    rs.player = player; d[player] = rs;
  }
  if (d.random && d.advise) ok(sum(d.advise, 'score') / d.advise.length > 1.5 * sum(d.random, 'score') / d.random.length, `${d.name}: Poradit scores clearly more than random moves`);
}
if (DIFFS.every(d => d.random)) ok(sum(DIFFS[0].random, 'moves') > sum(DIFFS[2].random, 'moves'), 'Lehká lasts longer than Těžká (random moves)');

console.log(failed ? `\n${failed} FAILED` : '\nall tests passed');
process.exit(failed ? 1 : 0);
