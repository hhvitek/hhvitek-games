#!/usr/bin/env node
// Tests the Dáma engine (games/dama/index.html, the block between "Engine" and "Engine end") in Node:
//   node tools/dama-test.js            rules, a second independent move generator, perft, and short matches
//   node tools/dama-test.js --matches N   play N games per pairing (default 20)
//   node tools/dama-test.js --file X   test the engine in another file (an .html or .js with the same block)
// Only Node's built-in modules. Exit code 1 when a rule test or the generator comparison fails.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const file = opt('--file', path.join(__dirname, '..', 'games', 'dama', 'index.html'));
const MATCHES = +opt('--matches', 20);
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/\/\* -{10} Engine -{10} \*\/([\s\S]*?)\/\* -{10} Engine end -{10} \*\//);
if (!m) { console.error('No Engine block in ' + file); process.exit(1); }
const E = new Function(m[1] + '\nreturn DamaEngine();')();

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('  FAIL ' + msg); } };

/* ---------- Notation: a1..h8 (row 1 is white's home row) ---------- */
const sq = n => { const c = n.charCodeAt(0) - 97, r = +n[1] - 1; return r * 4 + (c >> 1); };
const name = s => String.fromCharCode(97 + E.COL[s]) + (E.ROW[s] + 1);
// board from a list like { w: 'c3 e3', W: 'a1', b: 'd4', B: '' }
function board(o) {
  const a = Array(32).fill('.');
  for (const k of ['w', 'W', 'b', 'B']) for (const n of (o[k] || '').split(/\s+/).filter(Boolean)) a[sq(n)] = k;
  return a.join('');
}
const mvText = mv => name(mv.from) + mv.path.map(s => (mv.caps.length ? ':' : '-') + name(s)).join('');
const listText = (str, stm) => E.moves(E.parse(str, stm)).map(mvText).sort();

/* ---------- A second move generator, written separately on an 8 × 8 array, to compare with ---------- */
function refMoves(str, stm) {
  const g = Array.from({ length: 8 }, () => Array(8).fill('.'));
  for (let s = 0; s < 32; s++) { const r = s >> 2, c = (s & 3) * 2 + (r & 1); g[r][c] = str[s]; }
  const mine = ch => stm === 0 ? ch === 'w' || ch === 'W' : ch === 'b' || ch === 'B';
  const theirs = ch => ch !== '.' && !mine(ch);
  const isK = ch => ch === 'W' || ch === 'B';
  const dirs = [[1, -1], [1, 1], [-1, -1], [-1, 1]];
  const fwd = stm === 0 ? [[1, -1], [1, 1]] : [[-1, -1], [-1, 1]];
  const lastRow = stm === 0 ? 7 : 0;
  const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const id = (r, c) => r * 4 + (c >> 1);
  const res = { king: [], man: [], quiet: [] };
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const ch = g[r][c]; if (!mine(ch)) continue;
    const king = isK(ch);
    const from = id(r, c);
    const out = king ? res.king : res.man;
    // depth-first over captures; captured pieces stay on the board until the end and cannot be jumped again
    const dfs = (rr, cc, taken, pathSq, capsSq) => {
      let any = false;
      const ds = king ? dirs : fwd;
      for (const [dr, dc] of ds) {
        let r1 = rr + dr, c1 = cc + dc;
        if (king) while (inb(r1, c1) && (g[r1][c1] === '.' || (r1 === r && c1 === c))) { r1 += dr; c1 += dc; }
        if (!inb(r1, c1) || !theirs(g[r1][c1]) || taken.has(id(r1, c1))) continue;
        const lands = [];
        let r2 = r1 + dr, c2 = c1 + dc;
        while (inb(r2, c2) && (g[r2][c2] === '.' || (r2 === r && c2 === c))) { lands.push([r2, c2]); if (!king) break; r2 += dr; c2 += dc; }
        if (!lands.length) continue;
        any = true;
        const t2 = new Set(taken); t2.add(id(r1, c1));
        const cont = [];
        for (const [lr, lc] of lands) {
          const before = out.length;
          if (dfs(lr, lc, t2, pathSq.concat(id(lr, lc)), capsSq.concat(id(r1, c1)))) cont.push(1);
          else out.length = before;
        }
        if (!cont.length) for (const [lr, lc] of lands) out.push({ from, path: pathSq.concat(id(lr, lc)), caps: capsSq.concat(id(r1, c1)) });
      }
      return any;
    };
    // the dfs above pushes finished sequences; a landing that goes on pushes inside the recursion
    dfs(r, c, new Set(), [], []);
    for (const [dr, dc] of king ? dirs : fwd) {
      let r1 = r + dr, c1 = c + dc;
      while (inb(r1, c1) && g[r1][c1] === '.') { res.quiet.push({ from, path: [id(r1, c1)], caps: [] }); if (!king) break; r1 += dr; c1 += dc; }
    }
  }
  const list = res.king.length ? res.king : res.man.length ? res.man : res.quiet;
  void lastRow;
  return list.map(mv => name(mv.from) + mv.path.map(s => (mv.caps.length ? ':' : '-') + name(s)).join('')).sort();
}

/* ---------- Rules on hand-made positions ---------- */
console.log('Pravidla');
{
  // a capture is compulsory: the only moves are the capture
  const s = board({ w: 'c3 g3', b: 'd4' });
  ok(JSON.stringify(listText(s, 0)) === JSON.stringify(['c3:e5']), 'compulsory capture: ' + listText(s, 0));
  // men do not capture backwards
  const s2 = board({ w: 'd4', b: 'c3' });
  ok(!listText(s2, 0).some(x => x.includes(':')), 'a man captured backwards: ' + listText(s2, 0));
  // a king's capture has priority over a man's capture
  const s3 = board({ W: 'a1', w: 'e3', b: 'c3 f4' });
  ok(listText(s3, 0).every(x => x.startsWith('a1:')), 'king priority: ' + listText(s3, 0));
  // a flying king captures from afar and may land on any free square behind
  const s4 = board({ W: 'a1', b: 'e5' });
  ok(JSON.stringify(listText(s4, 0)) === JSON.stringify(['a1:f6', 'a1:g7', 'a1:h8']), 'long king capture: ' + listText(s4, 0));
  // ...but must land where it can capture on
  const s5 = board({ W: 'a1', b: 'e5 g5' });
  ok(JSON.stringify(listText(s5, 0)) === JSON.stringify(['a1:f6:h4']), 'king must go on capturing: ' + listText(s5, 0));
  // a multiple capture by a man is played to its end
  const s6 = board({ w: 'a1', b: 'b2 d4' });
  ok(JSON.stringify(listText(s6, 0)) === JSON.stringify(['a1:c3:e5']), 'multiple capture: ' + listText(s6, 0));
  // a man that reaches the last row becomes a king
  const p7 = E.parse(board({ w: 'g7' }), 0), mv7 = E.moves(p7);
  ok(mv7.length === 2 && mv7.every(x => x.promo) && E.text(E.play(p7, mv7[0])).includes('W'), 'promotion');
  // captured pieces stay until the end of the move: a king cannot pass through a square it has just captured on
  const s8 = board({ W: 'a1', b: 'c3 e3' }); // a1:d4 then from d4 down-right over e3 to f2/g1
  ok(JSON.stringify(listText(s8, 0)) === JSON.stringify(['a1:d4:f2', 'a1:d4:g1']), 'king double capture: ' + listText(s8, 0));
  // no piece is jumped twice (a king going round)
  const s9 = board({ W: 'c1', b: 'd2 f4 e5 c5 b4' });
  for (const t of listText(s9, 0)) { const caps = E.moves(E.parse(s9, 0)).find(x => mvText(x) === t).caps; ok(new Set(caps).size === caps.length, 'jumped twice: ' + t); }
  // black men move down
  ok(JSON.stringify(listText(board({ b: 'd6' }), 1)) === JSON.stringify(['d6-c5', 'd6-e5']), 'black man moves: ' + listText(board({ b: 'd6' }), 1));
  // no moves = lost
  ok(E.moves(E.parse(board({ w: 'a1', b: 'b2 c3' }), 0)).length === 0, 'blocked side has no moves');
  // the text form round-trips
  ok(E.text(E.parse(E.START, 0)) === E.START, 'text round trip');
  ok(E.parse(board({ w: 'b8' }), 0) === null, 'a white man on the last row is refused');
}

/* ---------- The engine's generator against the reference, on random positions ---------- */
console.log('Generátor proti druhému generátoru');
{
  let seed = 12345;
  const rand = n => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; };
  let checked = 0, diff = 0;
  const cmp = (str, stm) => {
    const a = listText(str, stm), b = refMoves(str, stm);
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) { if (diff++ < 5) console.log('  differs', str, stm, '\n   engine', a.join(' '), '\n   ref   ', b.join(' ')); }
  };
  // random games from the start
  for (let gme = 0; gme < 300; gme++) {
    let p = E.parse(E.START, 0);
    for (let ply = 0; ply < 120; ply++) {
      cmp(E.text(p), p.stm);
      const l = E.moves(p); if (!l.length) break;
      p = E.play(p, l[rand(l.length)]);
    }
  }
  // random boards with many kings (long captures in every direction)
  for (let k = 0; k < 20000; k++) {
    const a = Array(32).fill('.');
    const n = 2 + rand(14);
    for (let i = 0; i < n; i++) { const s = rand(32), r = s >> 2; const ch = 'wbWB'[rand(4)]; if ((ch === 'w' && r === 7) || (ch === 'b' && r === 0)) continue; a[s] = ch; }
    cmp(a.join(''), rand(2));
  }
  ok(diff === 0, `${diff} of ${checked} positions differ`);
  console.log(`  ${checked} pozic, rozdílů: ${diff}`);
  // play() keeps the hash equal to a hash computed from scratch
  let p = E.parse(E.START, 0), bad = 0;
  for (let i = 0; i < 2000; i++) {
    const l = E.moves(p); if (!l.length) { p = E.parse(E.START, 0); continue; }
    p = E.play(p, l[rand(l.length)]);
    const q = E.hashOf({ w: p.w, b: p.b, k: p.k, stm: p.stm });
    if (q.h1 !== p.h1 || q.h2 !== p.h2) bad++;
  }
  ok(bad === 0, `incremental hash wrong ${bad}×`);
}

/* ---------- Perft from the start ---------- */
console.log('Perft');
{
  const perft = (p, d) => { if (!d) return 1; let n = 0; for (const mv of E.moves(p)) n += perft(E.play(p, mv), d - 1); return n; };
  const t0 = Date.now();
  const counts = [];
  for (let d = 1; d <= 7; d++) counts.push(perft(E.parse(E.START, 0), d));
  console.log('  ' + counts.join(', ') + `  (${Date.now() - t0} ms)`);
  ok(counts[0] === 7, 'perft(1) is 7');
}

/* ---------- Games between players ---------- */
// One game; white and black are functions (state) => move index. Returns 'w', 'b' or 'd' and the number of moves.
function game(white, black, seed) {
  let p = E.parse(E.START, 0), quiet = 0;
  const hist = [], seen = new Map();
  const counts = [0, 0];
  for (let ply = 0; ply < 400; ply++) {
    const key = E.text(p) + p.stm;
    seen.set(key, (seen.get(key) || 0) + 1);
    if (seen.get(key) >= 3 || quiet >= E.QUIET_LIMIT) return { r: 'd', ply };
    const l = E.moves(p);
    if (!l.length) return { r: p.stm ? 'w' : 'b', ply };
    const who = p.stm ? black : white;
    const i = who({ pos: E.text(p), stm: p.stm, hist: hist.slice(), quiet, seed, myMove: counts[p.stm] });
    const mv = l[i];
    counts[p.stm]++;
    const irr = E.irreversible(mv);
    hist.push(E.text(p));
    p = E.play(p, mv);
    if (irr) { quiet = 0; hist.length = 0; } else quiet++;
  }
  return { r: 'd', ply: 400 };
}
let think = { n: 0, ms: 0, nodes: 0, depth: 0, max: 0 };
const ai = (level, extra = {}) => o => {
  const t0 = Date.now();
  const r = E.think(Object.assign({}, o, { level }, extra));
  const ms = Date.now() - t0;
  if (level === 'master' && !extra.nodes) { think.n++; think.ms += ms; think.nodes += r.nodes; think.depth += r.depth; think.max = Math.max(think.max, ms); }
  return r.i;
};
const randomPlayer = o => { const l = E.moves(E.parse(o.pos, o.stm)); return Math.floor(Math.random() * l.length); };
function match(label, A, B, n) {
  const res = { A: 0, B: 0, d: 0 };
  for (let g = 0; g < n; g++) {
    const seed = 1000 + g * 7919;
    const aWhite = g % 2 === 0;
    const r = aWhite ? game(A, B, seed) : game(B, A, seed);
    if (r.r === 'd') res.d++;
    else if ((r.r === 'w') === aWhite) res.A++;
    else res.B++;
  }
  console.log(`  ${label}: ${res.A} : ${res.B}, remíz ${res.d} (z ${n})`);
  return res;
}
console.log('Zápasy');
const t0 = Date.now();
const r1 = match('Běžný hráč – náhodné tahy', ai('normal'), randomPlayer, MATCHES);
const r2 = match('Mistr – Běžný hráč', ai('master'), ai('normal'), MATCHES);
if (think.n) console.log(`  Mistr: ${Math.round(think.ms / think.n)} ms na tah (nejvíc ${think.max} ms), ${Math.round(think.nodes / think.n)} uzlů, hloubka ${(think.depth / think.n).toFixed(1)}, ${Math.round(think.nodes / Math.max(1, think.ms))}k uzlů/s`);
if (args.includes('--deep')) match('Mistr – Mistr s dvojnásobným rozpočtem', ai('master'), ai('master', { nodes: 2400000 }), MATCHES);
console.log(`  (${Math.round((Date.now() - t0) / 1000)} s)`);
void r1; void r2;

console.log(failed ? `\n${failed} chyb` : '\nVše v pořádku');
process.exit(failed ? 1 : 0);
