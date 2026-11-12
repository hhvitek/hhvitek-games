#!/usr/bin/env node
// Tests the Reversi engine (games/reversi/index.html, the block between "Engine" and "Engine end") in Node:
//   node tools/reversi-test.js              rules, a second independent move generator, perft, the endgame solver
//                                           against plain minimax, and short matches between the levels
//   node tools/reversi-test.js --matches N  play N games per pairing (default 20)
//   node tools/reversi-test.js --deep       also Mistr against Mistr with a smaller node budget
//   node tools/reversi-test.js --file X     test the engine in another file (an .html or .js with the same block)
// Only Node's built-in modules. Exit code 1 when a rule test, the generator comparison, perft or the solver fails.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const file = opt('--file', path.join(__dirname, '..', 'games', 'reversi', 'index.html'));
const MATCHES = +opt('--matches', 20);
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/\/\* -{10} Engine -{10} \*\/([\s\S]*?)\/\* -{10} Engine end -{10} \*\//);
if (!m) { console.error('No Engine block in ' + file); process.exit(1); }
const E = new Function(m[1] + '\nreturn ReversiEngine();')();

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('  FAIL ' + msg); } };

/* ---------- Notation: a1..h8, row 8 is the top row (square 0 = a8) ---------- */
const sq = n => (8 - +n[1]) * 8 + (n.charCodeAt(0) - 97);
const name = s => String.fromCharCode(97 + (s & 7)) + (8 - (s >> 3));
// a board from lists like { b: 'd5 e4', w: 'd4 e5' }
function board(o) {
  const a = Array(64).fill('.');
  for (const k of ['b', 'w']) for (const n of (o[k] || '').split(/\s+/).filter(Boolean)) a[sq(n)] = k;
  return a.join('');
}
const names = list => list.map(name).sort().join(' ');

/* ---------- A second move generator, written separately on an 8 × 8 array, to compare with ---------- */
function refMoves(str, side) {
  const me = side ? 'w' : 'b', op = side ? 'b' : 'w';
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (str[r * 8 + c] !== '.') continue;
    const flips = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const line = [];
      let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && str[rr * 8 + cc] === op) { line.push(rr * 8 + cc); rr += dr; cc += dc; }
      if (line.length && rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && str[rr * 8 + cc] === me) flips.push(...line);
    }
    if (flips.length) {
      const a = str.split('');
      a[r * 8 + c] = me;
      for (const f of flips) a[f] = me;
      out.push({ sq: r * 8 + c, after: a.join(''), flips: flips.sort((x, y) => x - y) });
    }
  }
  return out;
}
const refCount = str => { let d = 0; for (const ch of str) d += ch === 'b' ? 1 : ch === 'w' ? -1 : 0; return d; };
// plain minimax to the end (disc difference for the side to move; empty squares are not counted)
function refExact(str, side, passed = false) {
  const list = refMoves(str, side);
  if (!list.length) {
    if (passed) { const d = refCount(str); return side ? -d : d; }
    return -refExact(str, 1 - side, true);
  }
  let best = -Infinity;
  for (const mv of list) best = Math.max(best, -refExact(mv.after, 1 - side, false));
  return best;
}

/* ---------- Rules on hand-made positions ---------- */
console.log('Pravidla');
{
  const p0 = E.parse(E.START);
  ok(names(E.moves(p0, 0)) === 'c4 d3 e6 f5', 'black opens with c4 d3 e6 f5: ' + names(E.moves(p0, 0)));
  ok(names(E.moves(p0, 1)) === 'c5 d6 e3 f4', 'white would have c5 d6 e3 f4: ' + names(E.moves(p0, 1)));
  ok(JSON.stringify(E.count(p0)) === '[2,2]', 'two discs each at the start');
  // d3 turns d4
  const p1 = E.play(p0, 0, sq('d3'));
  ok(E.text(p1) === board({ b: 'd3 d4 d5 e4', w: 'e5' }), 'd3 turns d4');
  // a disc that turns nothing is not a move
  ok(E.play(p0, 0, sq('a1')) === null && E.flipped(p0, 0, sq('a1')).length === 0, 'a move that turns nothing is refused');
  ok(E.play(p0, 0, sq('d5')) === null, 'an occupied square is refused');
  // several directions at once
  const s2 = board({ b: 'a1 a5 e1 e5 c5 c1 a3 e3', w: 'b2 c2 d2 b3 d3 b4 c4 d4' });
  const f2 = E.flipped(E.parse(s2), 0, sq('c3'));
  ok(names(f2) === 'b2 b3 b4 c2 c4 d2 d3 d4', 'eight directions at once: ' + names(f2));
  // no turning round the edge: h4 w, a3 b (the next square after h4 going right would be a3 in a naive generator)
  const s3 = board({ b: 'a3', w: 'h4' });
  ok(!E.moves(E.parse(s3), 0).includes(sq('g4')), 'a line does not wrap round the edge');
  const s3b = board({ b: 'h5', w: 'a4' });
  ok(E.moves(E.parse(s3b), 0).length === 0, 'no wrap to the left either');
  // a line must end in an own disc, an empty square breaks it
  const s4 = board({ b: 'a1', w: 'b1 d1' });
  ok(names(E.moves(E.parse(s4), 0)) === 'c1', 'a gap ends the line: ' + names(E.moves(E.parse(s4), 0)));
  // a pass: white has no move, black plays again
  const s5 = board({ b: 'a1 b1', w: 'c1' }); // black d1 turns c1; then white has nothing
  const r5 = E.next(E.parse(s5), 0, sq('d1'));
  ok(r5 && r5.over && r5.stm === 1, 'no discs left for white = the game is over');
  const s6 = board({ b: 'a1', w: 'b1 a2 h8', }); // black c1 → white has no move? white h8 alone, black a1 b1 c1 a2
  const r6 = E.next(E.parse(s6), 0, sq('c1'));
  ok(r6 && r6.pass && r6.stm === 0 && !r6.over, 'white passes, black moves again');
  // the text form round-trips
  ok(E.text(p0) === E.START, 'text round trip');
  ok(E.parse('x'.repeat(64)) === null && E.parse('.'.repeat(63)) === null, 'bad text is refused');
}

/* ---------- The engine's generator against the reference, on random games ---------- */
console.log('Generátor proti druhému generátoru');
{
  let seed = 12345;
  const rand = n => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; };
  let checked = 0, diff = 0;
  for (let g = 0; g < 1500; g++) {
    let p = E.parse(E.START), side = 0;
    for (let ply = 0; ply < 70; ply++) {
      const str = E.text(p), ref = refMoves(str, side), mine = E.moves(p, side);
      checked++;
      const a = mine.join(' '), b = ref.map(x => x.sq).join(' ');
      let bad = a !== b;
      if (!bad) for (const x of ref) {
        if (E.text(E.play(p, side, x.sq)) !== x.after || E.flipped(p, side, x.sq).join(' ') !== x.flips.join(' ')) { bad = true; break; }
      }
      if (bad && diff++ < 5) console.log('  differs', str, side, '\n   engine', a, '\n   ref   ', b);
      if (!ref.length) {
        if (!refMoves(str, 1 - side).length) break;
        side = 1 - side; continue;
      }
      const mv = ref[rand(ref.length)];
      const nx = E.next(p, side, mv.sq);
      const otherCan = refMoves(mv.after, 1 - side).length > 0, sameCan = refMoves(mv.after, side).length > 0;
      const want = otherCan ? 1 - side : sameCan ? side : 1 - side;
      if (nx.stm !== want || nx.over !== (!otherCan && !sameCan) || nx.pass !== (!otherCan && sameCan)) { if (diff++ < 5) console.log('  next() differs', str, side, mv.sq); }
      p = nx.p; side = nx.stm;
      if (nx.over) break;
    }
  }
  ok(diff === 0, `${diff} of ${checked} positions differ`);
  console.log(`  ${checked} pozic, rozdílů: ${diff}`);
}

/* ---------- Perft from the start (a pass counts as a move, a finished game as a leaf) ---------- */
console.log('Perft');
{
  const perft = (p, side, d, passed) => {
    if (!d) return 1;
    const l = E.moves(p, side);
    if (!l.length) return passed ? 1 : perft(p, 1 - side, d - 1, true);
    let n = 0;
    for (const s of l) n += perft(E.play(p, side, s), 1 - side, d - 1, false);
    return n;
  };
  const KNOWN = [4, 12, 56, 244, 1396, 8200, 55092, 390216, 3005288];
  const t0 = Date.now(), counts = [];
  for (let d = 1; d <= KNOWN.length; d++) counts.push(perft(E.parse(E.START), 0, d, false));
  console.log('  ' + counts.join(', ') + `  (${Date.now() - t0} ms)`);
  ok(counts.join() === KNOWN.join(), 'perft differs from the known values ' + KNOWN.join(', '));
}

/* ---------- The endgame solver against plain minimax ---------- */
console.log('Konec hry: přesný propočet proti prostému minimaxu');
{
  let seed = 777, bad = 0, n = 0;
  const rand = k => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % k; };
  const t0 = Date.now();
  while (n < 60) {
    // a random game until 7–10 empty squares are left
    let p = E.parse(E.START), side = 0, over = false;
    const stopAt = 6 + rand(4);
    for (;;) {
      const [b, w] = E.count(p);
      if (64 - b - w <= stopAt) break;
      const l = E.moves(p, side);
      const nx = E.next(p, side, l[rand(l.length)]);
      p = nx.p; side = nx.stm; if (nx.over) { over = true; break; }
    }
    if (over) continue;
    n++;
    const a = E.exact(p, side), b = refExact(E.text(p), side);
    if (a !== b) { if (bad++ < 5) console.log('  differs', E.text(p), side, 'engine', a, 'minimax', b); }
  }
  ok(bad === 0, `the solver differs in ${bad} of ${n} positions`);
  console.log(`  ${n} pozic, rozdílů: ${bad}  (${Date.now() - t0} ms)`);
}

/* ---------- Games between players ---------- */
// One game; black and white are functions (o) => square. Returns 'b', 'w' or 'd' and the final count.
function game(black, white, seed) {
  let p = E.parse(E.START), side = 0;
  const made = [0, 0];
  for (let ply = 0; ply < 130; ply++) {
    const who = side ? white : black;
    const s = who({ pos: E.text(p), stm: side, seed, myMove: made[side] });
    made[side]++;
    const nx = E.next(p, side, s);
    if (!nx) throw new Error('illegal move ' + s + ' in ' + E.text(p));
    p = nx.p; side = nx.stm;
    if (nx.over) break;
  }
  const [b, w] = E.count(p);
  return { r: b > w ? 'b' : w > b ? 'w' : 'd', b, w };
}
const stats = {};
const ai = (level, extra = {}, tag = level) => o => {
  const t0 = Date.now();
  const r = E.think(Object.assign({}, o, { level }, extra));
  const ms = Date.now() - t0;
  const st = stats[tag] || (stats[tag] = { n: 0, ms: 0, nodes: 0, depth: 0, max: 0, exact: 0 });
  st.n++; st.ms += ms; st.nodes += r.nodes; st.depth += r.depth; st.max = Math.max(st.max, ms); if (r.exact) st.exact++;
  return r.sq;
};
const randomPlayer = o => { const l = E.moves(E.parse(o.pos), o.stm); return l[Math.floor(Math.random() * l.length)]; };
function match(label, A, B, n) {
  const res = { A: 0, B: 0, d: 0, discs: 0 };
  for (let g = 0; g < n; g++) {
    const seed = 1000 + g * 7919;
    const aBlack = g % 2 === 0;
    const r = aBlack ? game(A, B, seed) : game(B, A, seed);
    res.discs += aBlack ? r.b - r.w : r.w - r.b;
    if (r.r === 'd') res.d++;
    else if ((r.r === 'b') === aBlack) res.A++;
    else res.B++;
  }
  console.log(`  ${label}: ${res.A} : ${res.B}, remíz ${res.d} (z ${n}), průměrný rozdíl kamenů ${(res.discs / n).toFixed(1)}`);
  return res;
}
const show = tag => { const t = stats[tag]; if (t && t.n) console.log(`  ${tag}: ${Math.round(t.ms / t.n)} ms na tah (nejvíc ${t.max} ms), ${Math.round(t.nodes / t.n)} uzlů, hloubka ${(t.depth / t.n).toFixed(1)}, přesně ${t.exact}×, ${Math.round(t.nodes / Math.max(1, t.ms))}k uzlů/s`); };
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
