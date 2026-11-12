#!/usr/bin/env node
// Tests the Mlýn engine (games/mlyn/index.html, the block between "Engine" and "Engine end") in Node:
//   node tools/mlyn-test.js              the rules on hand-made positions (mills, what a mill may take, jumping, the
//                                        end and the draws), a second independent move generator on random games
//                                        (with and without jumping), perft against it, the search on small puzzles,
//                                        and short matches between the levels
//   node tools/mlyn-test.js --matches N  play N games per pairing (default 20)
//   node tools/mlyn-test.js --deep       also Mistr against Poradit (400 000 nodes)
//   node tools/mlyn-test.js --file X     test the engine in another file (an .html or .js with the same block)
// Only Node's built-in modules. Exit code 1 when a rule test, the generator comparison, perft or a puzzle fails.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const file = opt('--file', path.join(__dirname, '..', 'games', 'mlyn', 'index.html'));
const MATCHES = +opt('--matches', 20);
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/\/\* -{10} Engine -{10} \*\/([\s\S]*?)\/\* -{10} Engine end -{10} \*\//);
if (!m) { console.error('No Engine block in ' + file); process.exit(1); }
const E = new Function(m[1] + '\nreturn MlynEngine();')();

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('  FAIL ' + msg); } };

/* ---------- The board written again from its picture (not from the engine's tables) ----------
   Points by their place on the 7 × 7 grid, numbered row by row; two points are neighbours when a line joins them
   with no point between; a mill is three points in a row on one line. */
const XY = [[0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2], [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3], [2, 4], [3, 4], [4, 4], [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6]];
const at = (x, y) => XY.findIndex(p => p[0] === x && p[1] === y);
// the lines of the board: the three squares and the four short lines between them
const SEGS = [];
for (const r of [0, 1, 2]) { const a = r, b = 6 - r; SEGS.push([[a, a], [b, a]], [[b, a], [b, b]], [[a, b], [b, b]], [[a, a], [a, b]]); }
SEGS.push([[3, 0], [3, 2]], [[3, 4], [3, 6]], [[0, 3], [2, 3]], [[4, 3], [6, 3]]);
const onSeg = ([[x1, y1], [x2, y2]], [x, y]) => (x1 === x2 ? x === x1 && y >= Math.min(y1, y2) && y <= Math.max(y1, y2) : y === y1 && x >= Math.min(x1, x2) && x <= Math.max(x1, x2));
const segPts = SEGS.map(s => XY.map((p, i) => onSeg(s, p) ? i : -1).filter(i => i >= 0).sort((a, b) => (XY[a][0] - XY[b][0]) || (XY[a][1] - XY[b][1])));
const NB = XY.map(() => new Set());
for (const pts of segPts) for (let k = 1; k < pts.length; k++) { NB[pts[k]].add(pts[k - 1]); NB[pts[k - 1]].add(pts[k]); }
// a mill: three points on one straight side (a whole side of a square, or a short line between the squares)
const MILLS = [];
for (const pts of segPts) if (pts.length === 3) MILLS.push(pts);
// sides of a square are split at their middle point by the short lines: a whole side is the mill
for (const r of [0, 1, 2]) {
  const a = r, b = 6 - r;
  for (const s of [[[a, a], [3, a], [b, a]], [[b, a], [b, 3], [b, b]], [[a, b], [3, b], [b, b]], [[a, a], [a, 3], [a, b]]]) {
    const pts = s.map(([x, y]) => at(x, y)).sort((p, q) => p - q);
    if (!MILLS.some(m2 => m2.join() === pts.join())) MILLS.push(pts);
  }
}
ok(MILLS.length === 16, 'the reference board has 16 mills: ' + MILLS.length);
ok(NB.reduce((s, n) => s + n.size, 0) === 64, 'the reference board has 32 lines between neighbours');

/* ---------- A second move generator on arrays ---------- */
// a position: { a: 24 × '.', 'w', 'b', hand: [white, black], stm }
const posOf = t => ({ a: t.slice(0, 24).split(''), hand: [+t[24], +t[25]], stm: +t[26] });
const textOf = p => p.a.join('') + p.hand[0] + p.hand[1] + p.stm;
const C = ['w', 'b'];
const inMill = (a, i) => MILLS.some(ml => ml.includes(i) && ml.every(k => a[k] === a[i]));
// every legal move as { from, to, rm, after }
function refMoves(t, jump) {
  const p = posOf(t), me = C[p.stm], op = C[1 - p.stm];
  const mine = p.a.filter(c => c === me).length, out = [];
  if (mine + p.hand[p.stm] < 3) return out;
  const steps = [];
  if (p.hand[p.stm] > 0) { for (let i = 0; i < 24; i++) if (p.a[i] === '.') steps.push([-1, i]); }
  else for (let f = 0; f < 24; f++) if (p.a[f] === me) for (let i = 0; i < 24; i++) {
    if (p.a[i] !== '.') continue;
    if ((jump && mine === 3) || NB[f].has(i)) steps.push([f, i]);
  }
  for (const [f, i] of steps) {
    const a = p.a.slice();
    if (f >= 0) a[f] = '.';
    a[i] = me;
    const hand = p.hand.slice(); if (f < 0) hand[p.stm]--;
    const theirs = [...a.keys()].filter(k => a[k] === op);
    if (MILLS.some(ml => ml.includes(i) && ml.every(k => a[k] === me)) && theirs.length) {
      const free = theirs.filter(k => !inMill(a, k));
      for (const r of free.length ? free : theirs) { const b = a.slice(); b[r] = '.'; out.push({ from: f, to: i, rm: r, after: textOf({ a: b, hand, stm: 1 - p.stm }) }); }
    } else out.push({ from: f, to: i, rm: -1, after: textOf({ a, hand, stm: 1 - p.stm }) });
  }
  return out;
}
const key = mv => `${mv.from},${mv.to},${mv.rm}`;
const engineKeys = (t, jump) => E.moves(t, jump).map(x => `${E.mFrom(x)},${E.mTo(x)},${E.mRm(x)}`).sort().join(' ');

/* ---------- Notation: points by name, a1 … g7 (column a–g, row 1 at the bottom) ---------- */
const pt = n => at(n.charCodeAt(0) - 97, 7 - +n[1]);
// a position from lists like { w: 'a7 d7', b: 'g1', hw: 0, hb: 0, stm: 0 }
function pos(o) {
  const a = Array(24).fill('.');
  for (const k of ['w', 'b']) for (const n of (o[k] || '').split(/\s+/).filter(Boolean)) a[pt(n)] = k;
  return a.join('') + (o.hw || 0) + (o.hb || 0) + (o.stm || 0);
}
const mv = (from, to, rm) => E.enc(from ? pt(from) : -1, pt(to), rm ? pt(rm) : -1);

/* ---------- Rules on hand-made positions ---------- */
console.log('Pravidla');
{
  ok(E.moves(E.START).length === 24, 'white opens on any of the 24 points');
  ok(E.text(E.parse(E.START)) === E.START && E.parse('x'.repeat(27)) === null && E.parse(E.START.slice(1)) === null, 'text round trip, bad text refused');
  ok(E.parse('w'.repeat(10) + '.'.repeat(14) + '000') === null, 'more than nine stones are refused');
  // a mill while placing: a7 d7 white, g7 closes it; black stones: one in a mill (a1 d1 g1 is a mill), one free
  const t1 = pos({ w: 'a7 d7 b6', b: 'a1 d1 g1 f4', hw: 6, hb: 5, stm: 0 });
  const takes = E.moves(t1).filter(x => E.mTo(x) === pt('g7')).map(x => E.mRm(x));
  ok(takes.length === 1 && takes[0] === pt('f4'), 'a mill takes only a stone outside mills: ' + takes);
  // all stones in mills: any may be taken
  const t2 = pos({ w: 'a7 d7 b6', b: 'a1 d1 g1', hw: 6, hb: 6, stm: 0 });
  ok(E.moves(t2).filter(x => E.mTo(x) === pt('g7')).length === 3, 'all stones in mills: any of them may be taken');
  // no stone of the other side on the board: the mill takes nothing
  const t3 = pos({ w: 'a7 d7', hw: 7, hb: 9, stm: 0 });
  ok(E.moves(t3).some(x => x === mv(null, 'g7')) && E.moves(t3).length === 22, 'a mill with nothing to take is a plain move');
  // two mills at once take one stone: a7 d7 + g4 g1, white g7 closes both
  const t4 = pos({ w: 'a7 d7 g4 g1', b: 'a1 b2 c3', hw: 5, hb: 6, stm: 0 });
  ok(E.moves(t4).filter(x => E.mTo(x) === pt('g7')).length === 3, 'two mills at once: still one stone per move');
  ok(E.play(t4, mv(null, 'g7', 'a1')) === pos({ w: 'a7 d7 g7 g4 g1', b: 'b2 c3', hw: 4, hb: 6, stm: 1 }), 'the move places, takes and passes the turn');
  // moving: along the lines only
  const t5 = pos({ w: 'd5 a7 g7 g1', b: 'a1 b2 b4 f2', stm: 0 });
  const fromD5 = E.moves(t5).filter(x => E.mFrom(x) === pt('d5')).map(x => E.mTo(x)).sort((a, b) => a - b);
  ok(fromD5.join() === [pt('d6'), pt('c5'), pt('e5')].sort((a, b) => a - b).join(), 'd5 goes to d6, c5 or e5: ' + fromD5);
  ok(!E.moves(t5).some(x => E.mFrom(x) === pt('a7') && E.mTo(x) === pt('b6')), 'no diagonal moves');
  // jumping with three stones, only when allowed
  const t6 = pos({ w: 'a7 g7 g1', b: 'a1 b2 b4 f2 d6', stm: 0 });
  ok(E.moves(t6, true).some(x => x === mv('a7', 'e3')) && !E.moves(t6, false).some(x => x === mv('a7', 'e3')), 'three stones jump to any free point, only when allowed');
  ok(new Set(E.moves(t6, true).map(E.mTo)).size === 16, 'a jump reaches every one of the 16 free points');
  ok(E.moves(t5, true).length === E.moves(t5, false).length, 'four stones never jump');
  // opening a mill and closing it again takes again
  const t7 = pos({ w: 'a7 d7 g7 g4', b: 'a1 b2 c3 f2', stm: 0 });
  const t7b = E.play(t7, mv('d7', 'd6'));
  const t7c = t7b && E.play(t7b, mv('f2', 'f4'));
  ok(t7c && E.moves(t7c).some(x => E.mFrom(x) === pt('d6') && E.mTo(x) === pt('d7') && E.mRm(x) >= 0), 'a mill opened and closed again takes again');
  ok(E.play(t7, mv('d7', 'd6', 'a1')) === null, 'a move that closes no mill cannot take');
  // the end: two stones left, no move
  ok(E.result([pos({ w: 'a7 d7 g7', b: 'a1 d1', stm: 1 })]).why === 'few', 'two stones left lose');
  ok(!E.result([pos({ w: 'a7 d7 g7', b: 'a1 d1', hb: 1, stm: 1 })]).over, 'two on the board and one in hand still play');
  const shut = pos({ w: 'd1 a4 b2 d6 f4 g7', b: 'a1 c3 e3', stm: 1 });
  ok(E.moves(shut, false).length === 4 && !E.result([shut], false).over && E.moves(shut, true).length > 4, 'black can still move (and jumps with three stones): ' + E.moves(shut, false).length);
  const allShut = pos({ w: 'd1 a4 b2 b6 c4 d3 e4 f2 g7', b: 'a1 b4 c3 e3', stm: 1 });
  ok(E.moves(allShut).length === 0 && E.result([allShut]).winner === 0 && E.result([allShut]).why === 'blocked', 'no move loses: ' + E.moves(allShut).length);
  // the third repetition is a draw (the same position with the same side to move)
  const seq = [pos({ w: 'a7 d7 g4 f2', b: 'a1 d1 b4 c5', stm: 0 })];
  const cyc = [mv('a7', 'a4'), mv('d1', 'd2'), mv('a4', 'a7'), mv('d2', 'd1')];
  for (let k = 0; k < 8; k++) seq.push(E.play(seq[seq.length - 1], cyc[k % 4]));
  ok(seq.every(Boolean), 'the repetition line is legal');
  if (seq.every(Boolean)) ok(!E.result(seq.slice(0, 8)).over && E.result(seq).why === 'rep', 'the third repetition is a draw: ' + JSON.stringify(E.result(seq)));
  // three stones each (no jumping here): 20 moves without a mill
  const q3 = [pos({ w: 'a7 d6 g1', b: 'a1 d2 g7', stm: 0 })];
  let ok3 = true;
  for (let k = 0; k < 20 && ok3; k++) {
    const t = q3[q3.length - 1];
    const l = E.moves(t, false).filter(x => E.mRm(x) < 0 && !q3.includes(E.play(t, x, false)));
    if (!l.length) ok3 = false; else q3.push(E.play(t, l[0], false));
  }
  ok(ok3, 'the walk of three stones each is possible');
  if (ok3) ok(!E.result(q3.slice(0, 20), false).over && E.result(q3, false).why === 'three', 'three stones each, 20 moves without a mill: ' + JSON.stringify(E.result(q3, false)));
  // the quiet rule from random play: the result agrees with counting by hand
  let found = 0;
  for (let g = 0; g < 400 && found < 3; g++) {
    let seed = 99 + g; const rand = n => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; };
    const line = [E.START];
    for (let k = 0; k < 600; k++) {
      const l = E.moves(line[line.length - 1], true).filter(x => E.mRm(x) < 0 || rand(8) === 0);
      const all = l.length ? l : E.moves(line[line.length - 1], true);
      line.push(E.play(line[line.length - 1], all[rand(all.length)], true));
      const r = E.result(line, true);
      if (r.over) { if (r.why === 'quiet') { found++; let q2 = 0; for (let i = line.length - 1; i > 0 && line[i].slice(24, 26) === line[i - 1].slice(24, 26) && line[i].replace(/\./g, '').length === line[i - 1].replace(/\./g, '').length; i--) q2++; ok(q2 === 50, 'quiet draw after exactly 50 moves: ' + q2); } break; }
    }
  }
  ok(found > 0, 'random games reach the quiet-move draw');
}

/* ---------- The engine's generator against the reference, on random games ---------- */
console.log('Generátor proti druhému generátoru');
{
  let seed = 4242;
  const rand = n => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; };
  let checked = 0, diff = 0;
  for (let g = 0; g < 1500; g++) {
    const jump = g % 3 !== 0;
    let t = E.START;
    for (let ply = 0; ply < 160; ply++) {
      const ref = refMoves(t, jump);
      const a = engineKeys(t, jump), b = ref.map(key).sort().join(' ');
      checked++;
      let bad = a !== b;
      if (!bad) for (const x of ref) if (E.play(t, E.enc(x.from, x.to, x.rm), jump) !== x.after) { bad = true; break; }
      if (bad && diff++ < 5) console.log('  differs', t, jump, '\n   engine', a, '\n   ref   ', b);
      if (!ref.length) break;
      t = ref[rand(ref.length)].after;
    }
  }
  ok(diff === 0, `${diff} of ${checked} positions differ`);
  console.log(`  ${checked} pozic, rozdílů: ${diff}`);
}

/* ---------- Perft from the start: the engine against the reference ---------- */
console.log('Perft');
{
  const perft = (t, d, gen) => { if (!d) return 1; let n = 0; for (const nx of gen(t)) n += perft(nx, d - 1, gen); return n; };
  const eng = t => E.moves(t).map(x => E.play(t, x));
  const ref = t => refMoves(t, true).map(x => x.after);
  const t0 = Date.now(), a = [], b = [];
  for (let d = 1; d <= 4; d++) { a.push(perft(E.START, d, eng)); b.push(perft(E.START, d, ref)); }
  console.log('  ' + a.join(', ') + `  (${Date.now() - t0} ms)`);
  ok(a.join() === b.join(), 'perft differs: ' + a.join() + ' / ' + b.join());
  ok(a.slice(0, 3).join() === '24,552,12144', 'perft of the first three plies is 24, 552, 12144');
}

/* ---------- The search on small puzzles ---------- */
console.log('Hledání');
{
  const best = (t, level, extra = {}) => E.think(Object.assign({ pos: t, hist: [], jump: true, level, seed: 7, myMove: 9 }, extra)).m;
  // a mill in one: both levels close it
  const p1 = pos({ w: 'a7 d7 g4 b4', b: 'a1 d1 f2 b2', stm: 0 });
  for (const lv of ['normal', 'master', 'hint']) { const r = best(p1, lv); ok(E.mFrom(r) === pt('g4') && E.mTo(r) === pt('g7') && E.mRm(r) >= 0, lv + ' closes the mill'); }
  // the other side's mill must be blocked (Mistr; while placing)
  const p2 = pos({ w: 'b4 f4', b: 'a7 d7', hw: 7, hb: 7, stm: 0 });
  ok(E.mTo(best(p2, 'master')) === pt('g7'), 'Mistr blocks the mill on g7: ' + E.mTo(best(p2, 'master')));
  // a win by shutting the other side in: d6 to b6 leaves black no move
  const p3 = pos({ w: 'd1 a4 b2 d6 c4 d3 e4 f2 g7', b: 'a1 b4 c3 e3', stm: 0 });
  const r3 = E.think({ pos: p3, hist: [], jump: true, level: 'master', seed: 1, myMove: 9 });
  const after3 = E.play(p3, r3.m);
  ok(after3 && E.result([after3]).winner === 0, 'Mistr shuts the other side in: ' + E.mFrom(r3.m) + '→' + E.mTo(r3.m) + ' ' + r3.score);
  // the same input gives the same move (Undo, reload)
  const t = E.play(E.play(E.START, E.moves(E.START)[4]), E.moves(E.play(E.START, E.moves(E.START)[4]))[7]);
  ok(best(t, 'master') === best(t, 'master') && best(t, 'normal') === best(t, 'normal'), 'the same position gives the same move');
  // the advice for the stone a mill takes: only among the given moves
  const only = E.moves(p1).filter(x => E.mTo(x) === pt('g7'));
  ok(only.includes(best(p1, 'hint', { only })), 'the advice keeps to the given moves');
  console.log('  ok');
}

/* ---------- Games between players ---------- */
function game(white, black, seed, jump = true) {
  const line = [E.START], made = [0, 0];
  for (let k = 0; k < 2000; k++) {
    const t = line[line.length - 1], side = +t[26];
    const s = (side ? black : white)({ pos: t, hist: line.slice(0, -1), jump, seed, myMove: made[side] });
    made[side]++;
    const nx = E.play(t, s, jump);
    if (!nx) throw new Error('illegal move ' + s + ' in ' + t);
    line.push(nx);
    const r = E.result(line, jump);
    if (r.over) return { r, len: line.length - 1 };
  }
  throw new Error('a game without an end');
}
const stats = {};
const ai = (level, extra = {}, tag = level) => o => {
  const t0 = Date.now();
  const r = E.think(Object.assign({}, o, { level }, extra));
  const ms = Date.now() - t0;
  const st = stats[tag] || (stats[tag] = { n: 0, ms: 0, nodes: 0, depth: 0, max: 0 });
  st.n++; st.ms += ms; st.nodes += r.nodes; st.depth += r.depth; st.max = Math.max(st.max, ms);
  return r.m;
};
const randomPlayer = o => { const l = E.moves(o.pos, o.jump); return l[Math.floor(Math.random() * l.length)]; };
function match(label, A, B, n) {
  const res = { A: 0, B: 0, d: 0, len: 0, why: {} };
  for (let g = 0; g < n; g++) {
    const seed = 1000 + g * 7919, aWhite = g % 2 === 0;
    const { r, len } = aWhite ? game(A, B, seed) : game(B, A, seed);
    res.len += len; res.why[r.why] = (res.why[r.why] || 0) + 1;
    if (r.winner < 0) res.d++;
    else if ((r.winner === 0) === aWhite) res.A++;
    else res.B++;
  }
  console.log(`  ${label}: ${res.A} : ${res.B}, remíz ${res.d} (z ${n}), průměrně ${Math.round(res.len / n)} tahů, konce ${JSON.stringify(res.why)}`);
  return res;
}
const show = tag => { const t = stats[tag]; if (t && t.n) console.log(`  ${tag}: ${Math.round(t.ms / t.n)} ms na tah (nejvíc ${t.max} ms), ${Math.round(t.nodes / t.n)} uzlů, hloubka ${(t.depth / t.n).toFixed(1)}, ${Math.round(t.nodes / Math.max(1, t.ms))}k uzlů/s`); };
console.log('Zápasy');
const t0 = Date.now();
match('Běžný hráč – náhodné tahy', ai('normal'), randomPlayer, MATCHES);
match('Mistr – Běžný hráč', ai('master'), ai('normal'), MATCHES);
show('master');
match('Mistr – Mistr se 100 000 uzly', ai('master'), ai('master', { nodes: 100000 }, 'small'), MATCHES);
show('master');
if (args.includes('--deep')) { match('Mistr – Poradit (400 000 uzlů)', ai('master'), ai('hint', {}, 'hint'), MATCHES); show('hint'); }
console.log(`  (${Math.round((Date.now() - t0) / 1000)} s)`);

console.log(failed ? `\n${failed} chyb` : '\nVše v pořádku');
process.exit(failed ? 1 : 0);
