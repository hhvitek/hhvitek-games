#!/usr/bin/env node
// Tests the Lodě engine (games/lode/index.html, the block between "Engine" and "Engine end") in Node:
//   node tools/lode-test.js              fleets (valid, never touching), shots and sunk ships, the battle's turns,
//                                        the computer never shoots at a known square, determinism, the average number
//                                        of shots each level needs to sink a fleet, and matches between the levels
//   node tools/lode-test.js --games N    games per level for the averages (default 400)
//   node tools/lode-test.js --file X     test the engine in another file (an .html or .js with the same block)
// Only Node's built-in modules. Exit code 1 when a test fails.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const file = opt('--file', path.join(__dirname, '..', 'games', 'lode', 'index.html'));
const GAMES = +opt('--games', 400);
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/\/\* -{10} Engine -{10} \*\/([\s\S]*?)\/\* -{10} Engine end -{10} \*\//);
if (!m) { console.error('No Engine block in ' + file); process.exit(1); }
const E = new Function(m[1] + '\nreturn LodeEngine();')();

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('  FAIL ' + msg); } };
const LEVELS = ['easy', 'normal', 'master'];

/* ---------- An independent check of a fleet on a 10 × 10 array ---------- */
function refValid(fleet, lengths) {
  const a = Array.from({ length: 10 }, () => Array(10).fill(-1));
  if (fleet.map(s => s.len).sort().join() !== [...lengths].sort().join()) return false;
  for (let j = 0; j < fleet.length; j++) {
    const s = fleet[j];
    for (let t = 0; t < s.len; t++) {
      const r = s.r + (s.v ? t : 0), c = s.c + (s.v ? 0 : t);
      if (r < 0 || c < 0 || r > 9 || c > 9 || a[r][c] >= 0) return false;
      a[r][c] = j;
    }
  }
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (a[r][c] >= 0)
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < 10 && cc < 10 && a[rr][cc] >= 0 && a[rr][cc] !== a[r][c]) return false;
    }
  return true;
}

console.log('Fleets');
for (const [name, L] of Object.entries(E.FLEETS)) {
  let bad = 0;
  for (let s = 1; s <= 3000; s++) { const f = E.randomFleet(L, E.rng(s)); if (!E.validFleet(f, L) || !refValid(f, L)) bad++; }
  ok(!bad, `${name}: ${bad} of 3000 random fleets invalid`);
  // the same seed gives the same fleet
  ok(JSON.stringify(E.randomFleet(L, E.rng(42))) === JSON.stringify(E.randomFleet(L, E.rng(42))), `${name}: random fleet not deterministic`);
}
{
  const L = E.FLEETS.classic;
  const base = [{ r: 0, c: 0, len: 5, v: false }, { r: 2, c: 0, len: 4, v: false }, { r: 4, c: 0, len: 3, v: false }, { r: 6, c: 0, len: 3, v: false }, { r: 8, c: 0, len: 2, v: false }];
  ok(E.validFleet(base, L) && refValid(base, L), 'a hand-made valid fleet is accepted');
  const touchSide = base.map((s, j) => j === 1 ? { ...s, r: 1 } : s);
  ok(!E.validFleet(touchSide, L), 'ships side by side are refused');
  const touchCorner = [...base.slice(0, 4), { r: 7, c: 3, len: 2, v: false }];
  ok(!E.validFleet(touchCorner, L) && !refValid(touchCorner, L), 'ships touching at a corner are refused');
  const overlap = base.map((s, j) => j === 4 ? { r: 6, c: 1, len: 2, v: false } : s);
  ok(!E.validFleet(overlap, L), 'overlapping ships are refused');
  const out = base.map((s, j) => j === 0 ? { ...s, c: 6 } : s);
  ok(!E.validFleet(out, L), 'a ship out of the sea is refused');
  ok(!E.validFleet(base.slice(0, 4), L), 'a missing ship is refused');
  ok(!E.validFleet(base.map((s, j) => j === 4 ? { ...s, len: 3 } : s), L), 'wrong lengths are refused');
  ok(!E.validFleet(base.map((s, j) => j === 4 ? { ...s, v: 'yes' } : s), L), 'a broken ship is refused');
  ok(E.fits(base, { r: 8, c: 4, len: 2, v: false }, 4) && !E.fits(base, { r: 7, c: 3, len: 2, v: false }, 4), 'fits() keeps a row of water between ships');
}

console.log('Shots');
{
  const fleet = [{ r: 0, c: 0, len: 2, v: false }, { r: 5, c: 5, len: 3, v: true }];
  const b = E.sea(fleet);
  ok(E.fire(b, 99) === 'miss' && b.k[99] === 1 && b.shot[99] === 1, 'water');
  ok(E.fire(b, 99) === null, 'a known square cannot be shot again');
  ok(E.fire(b, 55) === 'hit' && b.k[55] === 2, 'hit');
  ok(E.fire(b, 65) === 'hit' && E.fire(b, 75) === 'sunk', 'sunk after all its squares are hit');
  ok([55, 65, 75].every(i => b.k[i] === 3), 'a sunk ship is marked as sunk');
  const ring = [44, 45, 46, 54, 56, 64, 66, 74, 76, 84, 85, 86];
  ok(ring.every(i => b.k[i] === 1 && !b.shot[i]), 'the water around a sunk ship is marked by itself (not as shots)');
  ok(JSON.stringify(E.afloat(b)) === '[2]' && b.left === 2, 'ships afloat and squares left');
  ok(E.fire(b, 0) === 'hit' && E.fire(b, 1) === 'sunk' && b.left === 0, 'the last ship sunk');
  ok(b.k[10] === 1 && b.k[11] === 1 && b.k[12] === 1 && b.k[2] === 1, 'the edge of the sea: water only inside');
  // ring() of a ship in the corner and in the middle
  ok(E.ring({ r: 0, c: 0, len: 1, v: false }).sort((x, y) => x - y).join() === '1,10,11', 'ring in the corner');
  ok(E.ring({ r: 4, c: 4, len: 2, v: true }).length === 10, 'ring of a 2-ship in the middle');
}

console.log('Battle');
{
  const L = E.FLEETS.classic, mine = E.randomFleet(L, E.rng(1)), theirs = E.randomFleet(L, E.rng(2));
  const tm = E.shipMap(theirs), mm = E.shipMap(mine);
  const water = map => { for (let i = 0; i < 100; i++) if (map[i] < 0) return i; };
  const shipSq = map => { for (let i = 0; i < 100; i++) if (map[i] >= 0) return i; };
  // with again: a hit keeps the turn, water passes it
  let b = E.battle(mine, theirs, 0, true, [[0, shipSq(tm)]]);
  ok(b.turn === 0 && b.res[0] === 'hit', 'again: a hit keeps the turn');
  b = E.battle(mine, theirs, 0, false, [[0, shipSq(tm)]]);
  ok(b.turn === 1, 'without again: a hit passes the turn');
  b = E.battle(mine, theirs, 0, true, [[0, water(tm)]]);
  ok(b.turn === 1 && b.res[0] === 'miss', 'water passes the turn');
  b = E.battle(mine, theirs, 1, true, [[0, water(tm)]]);
  ok(b.n === 0, 'a shot out of turn ends the list');
  b = E.battle(mine, theirs, 0, false, [[0, water(tm)], [1, water(mm)], [0, water(tm)]]);
  ok(b.n === 2, 'a shot at a known square ends the list');
  // sinking every ship wins, nothing counts after the end
  const all = [];
  for (let i = 0; i < 100; i++) if (tm[i] >= 0) all.push([0, i]);
  b = E.battle(mine, theirs, 0, true, all.concat([[1, 0]]));
  ok(b.winner === 0 && b.n === 17, 'sinking the whole fleet wins (17 squares), the list ends there');
}

/* ---------- The computer's aim in whole games: every shot at an unknown square, the fleet sunk ---------- */
// one fleet sunk by one level alone; returns the number of shots
function solo(level, L, seed) {
  const fleet = E.randomFleet(L, E.rng(seed * 7 + 1)), b = E.sea(fleet);
  let n = 0, bad = 0;
  while (b.left) {
    const k = Int8Array.from(b.k), left = E.afloat(b);
    const i = E.aim(k, left, level, E.rng(E.mix(seed, n)));
    if (!(i >= 0 && i < 100) || b.k[i]) { bad++; break; }
    // fair play: the aim depends only on what is known, never on the fleet
    if (n < 3 && E.aim(k, left, level, E.rng(E.mix(seed, n))) !== i) bad++;
    E.fire(b, i); n++;
    if (n > 100) { bad++; break; }
  }
  return { n, bad };
}
console.log(`The computer's aim (${GAMES} fleets per level and fleet type)`);
const avg = {};
for (const [name, L] of Object.entries(E.FLEETS)) {
  const line = [];
  for (const level of LEVELS) {
    let sum = 0, bad = 0, max = 0, min = 100;
    for (let g = 1; g <= GAMES; g++) { const r = solo(level, L, g); sum += r.n; bad += r.bad; max = Math.max(max, r.n); min = Math.min(min, r.n); }
    ok(!bad, `${level} / ${name}: ${bad} shots at a known square or too many shots`);
    avg[level + name] = sum / GAMES;
    line.push(`${level} ${(sum / GAMES).toFixed(1)} (${min}–${max})`);
  }
  console.log(`  ${name}: average shots to sink the fleet: ${line.join(', ')}`);
  // with ten ships the four one-square ships are luck for everybody, so the levels are closer there
  const gap = name === 'big' ? 1 : 3;
  // the order is only meaningful with enough games (the averages vary by several shots below about 200 games)
  if (GAMES >= 200) ok(avg['easy' + name] > avg['normal' + name] + 5 && avg['normal' + name] > avg['master' + name] + gap, `${name}: the levels are not in order`);
  else console.log(`  ${name}: level order not checked (needs --games 200 or more)`);
}
// determinism: the same seed gives the same shots
ok(solo('master', E.FLEETS.classic, 5).n === solo('master', E.FLEETS.classic, 5).n && solo('normal', E.FLEETS.big, 9).n === solo('normal', E.FLEETS.big, 9).n, 'the same seed gives the same game');
// the aim against a fleet where some ship can only hide in one place: Mistr finishes a hit ship along its line
{
  const k = new Int8Array(100); k[44] = 2; k[45] = 2;
  const a = E.aim(k, [5, 4, 3, 3, 2], 'master', E.rng(1)), n = E.aim(k, [5, 4, 3, 3, 2], 'normal', E.rng(1));
  ok([43, 46].includes(a), `Mistr goes on along two hits (shot ${a})`);
  ok([43, 46].includes(n), `Zkušený goes on along two hits (shot ${n})`);
  const k2 = new Int8Array(100); k2[0] = 2;
  ok([1, 10].includes(E.aim(k2, [3], 'master', E.rng(2))) && [1, 10].includes(E.aim(k2, [3], 'normal', E.rng(2))), 'a hit in the corner: the squares next to it');
  ok(E.aim(new Int8Array(100).fill(1), [2], 'master', E.rng(1)) === -1, 'no unknown square: no shot');
}

/* ---------- Matches: two levels against each other, the starter alternating, with "again" ---------- */
function match(a, b, L, seed, again) {
  const fl = [E.randomFleet(L, E.rng(seed * 3 + 1)), E.randomFleet(L, E.rng(seed * 3 + 2))];
  const lv = [a, b], shots = [];
  const starter = seed % 2;
  for (;;) {
    const st = E.battle(fl[0], fl[1], starter, again, shots);
    if (st.winner >= 0) return st.winner;
    const w = st.turn, sea = st.B[w];
    shots.push([w, E.aim(Int8Array.from(sea.k), E.afloat(sea), lv[w], E.rng(E.mix(seed, shots.length)))]);
    if (shots.length > 220) return -1;
  }
}
console.log('Matches (100 games each, the starter alternating)');
for (const fleet of ['classic', 'big']) for (const again of [true, false]) for (const [a, b] of [['normal', 'easy'], ['master', 'normal'], ['master', 'easy']]) {
  let w = 0, l = 0;
  for (let g = 1; g <= 100; g++) { const r = match(a, b, E.FLEETS[fleet], g, again); if (r === 0) w++; else if (r === 1) l++; }
  console.log(`  ${fleet}, ${again ? 'again' : 'one by one'}: ${a} vs ${b}: ${w} : ${l}`);
  ok(w > l, `${a} should beat ${b}`);
}

console.log(failed ? `\n${failed} test(s) failed` : '\nall tests passed');
process.exit(failed ? 1 : 0);
