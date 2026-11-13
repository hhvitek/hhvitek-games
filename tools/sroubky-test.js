#!/usr/bin/env node
// Tests the Šroubky logic (games/sroubky/index.html, the block between "Logic" and "Logic end") in Node:
//   node tools/sroubky-test.js             the move rules on hand-made bolts, the deals of every difficulty (whole,
//                                          the same from the same seed, solvable, the solution really wins), the
//                                          backward-scramble fallback, and the solver on positions reached by
//                                          random play (a "lost" verdict is checked by an independent search over every legal move)
//   node tools/sroubky-test.js --games N   deals per difficulty (default 40)
//   node tools/sroubky-test.js --file X    test the logic in another file (an .html or .js with the same block)
// Only Node's built-in modules. Exit code 1 when something fails.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const file = opt('--file', path.join(__dirname, '..', 'games', 'sroubky', 'index.html'));
const GAMES = +opt('--games', 40);
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/\/\* -{10} Logic -{10} \*\/([\s\S]*?)\/\* -{10} Logic end -{10} \*\//);
if (!m) { console.error('No Logic block in ' + file); process.exit(1); }
const L = new Function(m[1] + '\nreturn { LEVELS, prng, moveError, moveAmount, applyMove, usefulMoves, isDone, isWon, topRun, solve, randomDeal, scrambleDeal, generate, cloneB, stateKey };')();

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('  FAIL ' + msg); } };
// bolts from a picture: one string per bolt, the bottom nut first, a letter per colour ('' = empty)
const bolts = (...s) => s.map(b => b.split('').map(ch => ch.charCodeAt(0) - 97));
const pic = bs => bs.map(b => b.map(c => String.fromCharCode(97 + c)).join('') || '-').join(' ');

/* ---------- Rules ---------- */
console.log('Rules');
{
  const b = bolts('abb', 'ab', '', 'aaaa', 'abab');
  ok(L.moveError(b, 4, 0, 0) === 'same', 'a bolt onto itself');
  ok(L.moveError(b, 4, 2, 0) === 'same', 'nothing to take from an empty bolt');
  ok(L.moveError(b, 4, 0, 1) === null, 'b onto b');
  ok(L.moveError(b, 4, 1, 0) === null, 'b onto b (the other way)');
  ok(L.moveError(b, 4, 0, 2) === null, 'anything onto an empty bolt');
  ok(L.moveError(b, 4, 0, 3) === 'done', 'nothing onto a finished bolt');
  ok(L.moveError(b, 4, 0, 4) === 'full', 'nothing onto a full mixed bolt');
  ok(L.moveError(bolts('ab', 'a'), 4, 0, 1) === 'color', 'b onto a: another colour');
  ok(L.topRun(b[0]) === 2 && L.topRun(b[3]) === 4 && L.topRun(b[4]) === 1, 'top runs');
  // the whole top run goes, as many as fit; the rest stays
  const c = bolts('abbb', 'ab', '');
  ok(L.moveAmount(c, 4, 0, 1) === 2, 'three b onto a bolt with room for two: two go');
  const n = L.applyMove(c, 4, 0, 1);
  ok(n === 2 && pic(c) === 'ab abbb -', `after the move: ${pic(c)}`);
  const d = bolts('aabb', '');
  L.applyMove(d, 4, 0, 1);
  ok(pic(d) === 'aa bb', `the top run into an empty bolt: ${pic(d)}`);
  ok(L.isDone([1, 1, 1, 1], 4) && !L.isDone([1, 1, 1], 4) && !L.isDone([1, 1, 2, 1], 4), 'a finished bolt');
  ok(L.isWon(bolts('aaaa', '', 'bbbb'), 4) && !L.isWon(bolts('aaab', 'b', 'bbba'), 4), 'a won board');
  // useful moves leave out a finished bolt as a source and the second empty bolt as a target
  const u = L.usefulMoves(bolts('aaaa', 'ab', '', ''), 4);
  ok(!u.some(([a]) => a === 0), 'nothing out of a finished bolt');
  ok(!u.some(([, t]) => t === 3), 'only the first empty bolt is a target');
  ok(u.some(([a, t]) => a === 1 && t === 2), 'a mixed bolt into the empty one');
  ok(!L.usefulMoves(bolts('aa', '', 'bb'), 4).some(([a, t]) => t === 1), 'a one-colour stack never moves into an empty bolt');
}

/* ---------- Solver on small hand-made positions ---------- */
console.log('Solver');
// an independent check: breadth-first over every legal move (not only the useful ones)
function bfs(start, cap, limit = 200000) {
  const seen = new Set([L.stateKey(start)]);
  let q = [start];
  while (q.length) {
    const nq = [];
    for (const t of q) {
      if (L.isWon(t, cap)) return true;
      for (let a = 0; a < t.length; a++) for (let b = 0; b < t.length; b++) {
        if (L.moveError(t, cap, a, b) !== null) continue;
        const nt = L.cloneB(t); L.applyMove(nt, cap, a, b);
        const k = L.stateKey(nt);
        if (seen.has(k)) continue;
        seen.add(k); nq.push(nt);
        if (seen.size > limit) return null;
      }
    }
    q = nq;
  }
  return false;
}
// plays a solution and says whether it wins with legal moves only
function plays(start, cap, moves) {
  const t = L.cloneB(start);
  for (const [a, b] of moves) { if (L.moveError(t, cap, a, b) !== null) return false; L.applyMove(t, cap, a, b); }
  return L.isWon(t, cap);
}
{
  const easy = bolts('ab', 'ba', '');
  const r = L.solve(easy, 2);
  ok(r.moves && plays(easy, 2, r.moves), 'two colours, one free bolt: solved');
  const stuck = bolts('ab', 'ba');
  ok(L.solve(stuck, 2).lost === true && bfs(stuck, 2) === false, 'no free bolt and mixed colours: lost');
  ok(L.solve(bolts('aa', 'bb', ''), 2).moves.length === 0, 'an already sorted board needs no move');
  // small random positions: the solver and the independent search agree
  const rand = L.prng(7);
  let agree = 0, both = 0;
  for (let t = 0; t < 300; t++) {
    const colors = 2 + Math.floor(rand() * 2), cap = 3, nb = colors + 1;
    const pool = []; for (let c = 0; c < colors; c++) for (let i = 0; i < cap; i++) pool.push(c);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const bs = Array.from({ length: nb }, () => []);
    for (const c of pool) { let b; do b = Math.floor(rand() * nb); while (bs[b].length >= cap); bs[b].push(c); }
    const r1 = L.solve(bs, cap, 200000), r2 = bfs(bs, cap);
    if (r1.unknown || r2 === null) continue;
    both++;
    if (!!r1.moves === r2 && (!r1.moves || plays(bs, cap, r1.moves))) agree++;
    else ok(false, `solver and search disagree on ${pic(bs)} (cap ${cap}): ${r1.moves ? 'solved' : 'lost'} vs ${r2}`);
  }
  ok(both > 250, `enough small positions decided (${both})`);
  console.log(`  ${agree} of ${both} small random positions: the solver agrees with an independent search`);
}

/* ---------- Deals ---------- */
(async () => {
  console.log(`Deals (${GAMES} per difficulty)`);
  for (const lv of L.LEVELS) {
    let maxMs = 0, sumMoves = 0;
    for (let s = 1; s <= GAMES; s++) {
      const seed = s * 7919 + lv.colors, t0 = Date.now();
      const b = await L.generate(lv, seed);
      maxMs = Math.max(maxMs, Date.now() - t0);
      const count = new Array(lv.colors).fill(0);
      b.flat().forEach(c => count[c]++);
      ok(b.length === lv.bolts && b.every(x => x.length <= lv.cap) && count.every(n => n === lv.cap) && b.flat().length === lv.colors * lv.cap,
        `${lv.id} seed ${seed}: the deal is whole (${pic(b)})`);
      ok(b.filter(x => !x.length).length >= lv.bolts - lv.colors, `${lv.id} seed ${seed}: the empty bolts are there`);
      ok(JSON.stringify(await L.generate(lv, seed)) === JSON.stringify(b), `${lv.id} seed ${seed}: the same deal from the same seed`);
      const r = L.solve(b, lv.cap, 200000);
      ok(r.moves && plays(b, lv.cap, r.moves), `${lv.id} seed ${seed}: solvable and the solution wins`);
      if (r.moves) sumMoves += r.moves.length;
    }
    // the fallback deal: solvable by construction
    let scrOk = 0;
    for (let s = 1; s <= 100; s++) { const d = L.scrambleDeal(lv, L.prng(s)); const r = L.solve(d, lv.cap, 400000); if (r.moves && plays(d, lv.cap, r.moves)) scrOk++; else ok(r.unknown, `${lv.id}: scrambled deal ${s} is not solvable`); }
    ok(scrOk >= 95, `${lv.id}: scrambled deals proved solvable (${scrOk} of 100)`);
    console.log(`  ${lv.id.padEnd(7)} slowest deal ${maxMs} ms, solution ${(sumMoves / GAMES).toFixed(1)} moves on average, scrambled deals solved ${scrOk}/100`);
  }

  /* ---------- Hints on positions a player reaches ---------- */
  console.log('Hints on positions of random play');
  for (const lv of L.LEVELS) {
    let n = 0, unknown = 0, lost = 0, maxMs = 0;
    for (let s = 1; s <= Math.ceil(GAMES / 2); s++) {
      const b = await L.generate(lv, s * 104729 + 7), rand = L.prng(s * 31);
      for (let k = 0; k < 40; k++) {
        const legal = [];
        for (let x = 0; x < b.length; x++) for (let y = 0; y < b.length; y++) if (L.moveError(b, lv.cap, x, y) === null) legal.push([x, y]);
        if (!legal.length || L.isWon(b, lv.cap)) break;
        const mv = legal[Math.floor(rand() * legal.length)];
        L.applyMove(b, lv.cap, mv[0], mv[1]);
        const t0 = Date.now(), r = L.solve(b, lv.cap, 40000); // the game's hint budget (analyse)
        maxMs = Math.max(maxMs, Date.now() - t0); n++;
        if (r.unknown) unknown++;
        if (r.moves) ok(plays(b, lv.cap, r.moves), `${lv.id}: a hinted solution does not win from ${pic(b)}`);
        // "lost" must be true: the independent search over every legal move never finds a win (null = too big to tell)
        if (r.lost) { lost++; ok(bfs(b, lv.cap, 300000) !== true, `${lv.id}: "lost" but a win exists from ${pic(b)}`); }
      }
    }
    ok(unknown <= n * 0.01, `${lv.id}: the hint ran out of nodes in ${unknown} of ${n} positions`);
    console.log(`  ${lv.id.padEnd(7)} ${n} positions: lost ${lost}, unknown ${unknown}, slowest ${maxMs} ms`);
  }

  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})();
