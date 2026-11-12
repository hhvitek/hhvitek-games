#!/usr/bin/env node
// Tests the Piškvorky engine (games/piskvorky/index.html, the block between "Engine" and "Engine end") in Node:
//   node tools/piskvorky-test.js              the rules, line shapes, hand-made positions and short matches
//   node tools/piskvorky-test.js --matches N  play N games per pairing (default 10)
//   node tools/piskvorky-test.js --size S     board size for the matches (default 15; 13, 15 or 19)
//   node tools/piskvorky-test.js --file X     test the engine in another file (an .html or .js with the same block)
// Only Node's built-in modules. Exit code 1 when a rule or position test fails.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const file = opt('--file', path.join(__dirname, '..', 'games', 'piskvorky', 'index.html'));
const MATCHES = +opt('--matches', 10);
const SIZE = +opt('--size', 15);
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/\/\* -{10} Engine -{10} \*\/([\s\S]*?)\/\* -{10} Engine end -{10} \*\//);
if (!m) { console.error('No Engine block in ' + file); process.exit(1); }
const E = new Function(m[1] + '\nreturn PiskvorkyEngine();')();
const SH = E.SHAPES;

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('  FAIL ' + msg); } };

/* ---------- Notation: a1 is the top-left cell, letters are columns, numbers rows ---------- */
const N = 15;
const cell = (s, n = N) => (+s.slice(1) - 1) * n + (s.charCodeAt(0) - 97);
const name = (c, n = N) => String.fromCharCode(97 + c % n) + (((c / n) | 0) + 1);
// moves from two lists (x starts): the lists must differ by at most one, x first; extra o marks need fillers
function game(x, o, n = N) {
  const xs = x.split(/\s+/).filter(Boolean).map(s => cell(s, n)), os = o.split(/\s+/).filter(Boolean).map(s => cell(s, n));
  if (!(xs.length === os.length || xs.length === os.length + 1)) throw new Error('bad position ' + x + ' / ' + o);
  const mv = [];
  for (let i = 0; i < xs.length; i++) { mv.push(xs[i]); if (i < os.length) mv.push(os[i]); }
  return mv;
}

/* ---------- Rules ---------- */
console.log('Rules');
ok(E.winLine(N, game('a1 b1 c1 d1 e1', 'a5 b5 c5 d5')) !== null, 'five in a row wins');
ok(E.winLine(N, game('a1 b1 c1 d1', 'a5 b5 c5 d5')) === null, 'four is not a win');
ok((E.winLine(N, game('a1 b1 c1 d1 f1 e1', 'a5 b5 c5 d5 g9')) || []).length === 6, 'six in a row wins too (overline)');
ok(E.winLine(N, game('c3 d4 e5 f6 g7', 'a9 b9 c9 d9')) !== null, 'diagonal');
ok(E.winLine(N, game('o1 n2 m3 l4 k5', 'a9 b9 c9 d9')) !== null, 'anti-diagonal at the edge');
ok(E.winLine(N, game('k1 l1 m1 n1 o1', 'a9 b9 c9 d9')) !== null, 'five at the right edge');
ok(E.winLine(N, game('n1 o1 a2 b2 c2', 'a9 b9 c9 d9')) === null, 'no wrapping round the edge');
ok(E.validMoves(N, game('a1 b1', 'a2')), 'valid game');
ok(!E.validMoves(N, [0, 0]), 'the same cell twice is invalid');
ok(!E.validMoves(N, [0, 225]), 'a cell off the board is invalid');
ok(!E.validMoves(N, game('a1 b1 c1 d1 e1 f9', 'a5 b5 c5 d5 g9')), 'a move after a five is invalid');

/* ---------- Line shapes ---------- */
console.log('Shapes');
const shape = (x, o, at, p, d = 0) => E.shapes(N, game(x, o), cell(at), p)[d];
ok(shape('e8 f8 g8', 'a1 a3', 'h8', 1) === SH.OPEN4, 'open four');
ok(shape('e8 f8 g8', 'd8 a3', 'h8', 1) === SH.FOUR, 'four blocked on one side');
ok(shape('e8 f8 h8', 'a1 a3', 'g8', 1) === SH.OPEN4, 'filling a broken four');
ok(shape('e8 f8', 'a1 a3', 'g8', 1) === SH.OPEN3, 'open three');
ok(shape('e8 f8', 'd8 a3', 'g8', 1) === SH.THREE, 'three blocked on one side');
ok(shape('a8 b8', 'a1 a3', 'c8', 1) === SH.THREE, 'three at the edge is not open');
ok(shape('e8 g8', 'a1 a3', 'h8', 1) === SH.OPEN3, 'broken open three');
ok(shape('e8 f8 g8 h8', 'a1 a3 a5', 'i8', 1) === SH.FIVE, 'five');
ok(shape('e8', 'a1', 'f8', 1) === SH.OPEN2, 'open two');
ok(shape('e8 f8 g8', 'd8 j8', 'h8', 1) === SH.FOUR, 'a four between marks with room for five');
ok(shape('e8 f8 g8', 'd8 i8', 'h8', 1) === SH.NONE, 'four between two marks is nothing');
ok(shape('a8 b8 c8', 'e8 a3', 'd8', 1) === SH.NONE, 'no room for five');

/* ---------- Positions: what the computer must play ---------- */
console.log('Positions');
const think = (mv, level = 'master', extra) => E.think(Object.assign({ n: N, moves: mv, level, seed: 1 }, extra || {}));
const inSet = (r, list) => list.split(' ').map(s => cell(s)).includes(r.m);
for (const level of ['normal', 'master', 'hint']) {
  // x to move (x has as many marks as o)
  let r = think(game('d4 e4 f4 g4 a14', 'h4 a10 b12 o15 n15'), level); // o blocked one end: x completes five on c4
  ok(inSet(r, 'c4'), `${level}: completes five (played ${name(r.m)})`);
  r = think(game('a1 c1 n14 n12', 'f6 g7 h8 i9'), level);
  ok(inSet(r, 'e5 j10'), `${level}: blocks a four (played ${name(r.m)})`);
}
// an open three of o must be stopped (x has nothing of its own)
{
  const r = think(game('a1 o1 a15', 'g8 h8 i8'));
  ok(inSet(r, 'f8 j8 e8 k8'), `master: stops an open three (played ${name(r.m)})`);
}
// a four-four: two fours in one move
{
  const r = think(game('d4 e4 f4 h5 h6 h7', 'c4 h8 a14 o15 o1 a1'));
  ok(r.m === cell('g4') || r.m === cell('h4'), `master: plays the double four at h4 (played ${name(r.m)}, ${r.how})`);
}
// a win by fours (VCF): x makes fours until two threats come at once
{
  const mv = game('f6 g6 h6 j8 j9', 'e6 a1 a15 o1 o15');
  const r = think(mv);
  ok(r.how === 'vcf' || r.how === 'four', `master finds a win by fours (${r.how} ${name(r.m)})`);
  ok(playOut(mv, r.m), 'master: its win by fours really wins against forced blocks');
}
// a defence against the other's win by fours: o threatens one, x must spoil it
{
  const mv = game('a1 a3 a5 a7', 'f6 g6 h6 j8');
  const r = think(mv.concat([]));
  // after x's move o must not have a win by fours any more
  const r2 = E.think({ n: N, moves: mv.concat([r.m]), level: 'master', seed: 1 });
  ok(!(r2.how === 'vcf' || r2.how === 'four' || r2.how === 'five'), `master spoils the other's fours (played ${name(r.m)}, then o ${r2.how})`);
}
// the same position gets the same answer, whatever was searched before (Undo, reload, Poradit)
{
  const mv = game('h8 i9 g7 j8', 'h9 i8 g9 k9');
  const a = think(mv).m, b = think(mv, 'hint').m, c = think(mv).m, d = think(mv.concat([a])).m, e = think(mv).m;
  ok(a === c && a === e, `master answers the same position the same way (${name(a)} ${name(c)} ${name(e)}, hint ${name(b)}, then ${name(d)})`);
}
// plays the attacker's moves from think and the defender's forced blocks; true when the attacker gets five
function playOut(mv, first) {
  const g = mv.concat([first]);
  for (let k = 0; k < 40; k++) {
    if (E.winLine(N, g)) return ((g.length - 1) & 1) === (mv.length & 1);
    const r = E.think({ n: N, moves: g, level: (g.length % 2 === mv.length % 2) ? 'master' : 'normal', seed: 2 });
    if (r.m < 0) return false;
    g.push(r.m);
  }
  return false;
}

/* ---------- Matches ---------- */
function rndMove(mv, n, seed) {
  const used = new Set(mv), free = [];
  for (let i = 0; i < n * n; i++) if (!used.has(i)) free.push(i);
  return free[(seed * 7919 + mv.length * 104729) % free.length];
}
function match(a, b, n, seed) {
  const mv = [], t = [0, 0], cnt = [0, 0], max = [0, 0], depth = [0, 0];
  for (;;) {
    const side = mv.length & 1, lv = side ? b : a;
    let move;
    if (lv.level === 'random') move = rndMove(mv, n, seed);
    else {
      const t0 = Date.now();
      const r = E.think({ n, moves: mv, level: lv.level, seed, nodes: lv.nodes });
      const dt = Date.now() - t0;
      t[side] += dt; cnt[side]++; max[side] = Math.max(max[side], dt); depth[side] += r.depth || 0;
      move = r.m;
    }
    if (!Number.isInteger(move) || move < 0 || mv.includes(move)) { failed++; console.log('  FAIL illegal move', move); return { w: -1, t, cnt, max, depth }; }
    mv.push(move);
    if (E.winLine(n, mv)) return { w: side, len: mv.length, t, cnt, max, depth };
    if (mv.length >= n * n) return { w: -1, len: mv.length, t, cnt, max, depth };
  }
}
function series(label, a, b, games, n) {
  const won = [0, 0, 0], t = [0, 0], cnt = [0, 0], max = [0, 0], depth = [0, 0];
  for (let g = 0; g < games; g++) {
    // each pairing plays both colours: even games a starts, odd games b starts
    const swap = g & 1, r = match(swap ? b : a, swap ? a : b, n, 1000 + g);
    const aSide = swap ? 1 : 0;
    if (r.w < 0) won[2]++; else if (r.w === aSide) won[0]++; else won[1]++;
    for (const s of [0, 1]) { const who = s === aSide ? 0 : 1; t[who] += r.t[s]; cnt[who] += r.cnt[s]; max[who] = Math.max(max[who], r.max[s]); depth[who] += r.depth[s]; }
  }
  const ms = i => cnt[i] ? Math.round(t[i] / cnt[i]) : 0;
  console.log(`  ${label}: ${won[0]}:${won[1]}${won[2] ? `, ${won[2]} draws` : ''}  (time per move ${ms(0)} / ${ms(1)} ms, max ${max[0]} / ${max[1]} ms${depth[0] ? `, depth ${(depth[0] / cnt[0]).toFixed(1)}` : ''})`);
  return won;
}
console.log(`Matches on ${SIZE} × ${SIZE}, ${MATCHES} games each, both colours`);
const normal = { level: 'normal' }, master = { level: 'master' }, random = { level: 'random' };
series('Běžný hráč vs random', normal, random, MATCHES, SIZE);
series('Mistr vs Běžný hráč', master, normal, MATCHES, SIZE);
series('Mistr vs Mistr with 30 000 nodes', master, { level: 'master', nodes: 30000 }, MATCHES, SIZE);

console.log(failed ? `${failed} test(s) failed` : 'All tests passed');
process.exit(failed ? 1 : 0);
