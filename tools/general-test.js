#!/usr/bin/env node
// Tests the Generál engine (games/general/index.html, the block between "Engine" and "Engine end") in Node:
//   node tools/general-test.js              scoring of every box on hand-made rolls, the opponent's decisions, and
//                                           games between the levels (the stronger level must win more)
//   node tools/general-test.js --games N    games per pairing (default 300)
//   node tools/general-test.js --file X     test the engine in another file (an .html or .js with the same block)
// Only Node's built-in modules. Exit code 1 when a test fails.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const file = opt('--file', path.join(__dirname, '..', 'games', 'general', 'index.html'));
const GAMES = +opt('--games', 300);
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/\/\* -{10} Engine -{10} \*\/([\s\S]*?)\/\* -{10} Engine end -{10} \*\//);
if (!m) { console.error('No Engine block in ' + file); process.exit(1); }
const E = new Function(m[1] + '\nreturn GeneralEngine();')();

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('  FAIL ' + msg); } };
const NAMES = ['jedničky', 'dvojky', 'trojky', 'čtyřky', 'pětky', 'šestky', 'pár', 'dva páry', 'trojice', 'čtveřice', 'malá postupka', 'velká postupka', 'full', 'šance', 'generál'];
const sc = (b, dice) => E.scoreBox(b, E.counts(dice.split('').map(Number)));
const is = (b, dice, want) => { const got = sc(b, dice); ok(got === want, `${NAMES[b]} for ${dice}: ${got}, expected ${want}`); };

/* ---------- Scoring ---------- */
console.log('Scoring');
is(0, '11234', 2); is(0, '23456', 0); is(1, '22226', 8); is(2, '33312', 9); is(3, '44444', 20); is(4, '55123', 10); is(5, '66665', 24);
is(6, '11234', 2); is(6, '66553', 12); is(6, '12345', 0); is(6, '66666', 12); is(6, '44412', 8);
is(7, '66553', 22); is(7, '11223', 6); is(7, '66655', 22); is(7, '66665', 0); is(7, '66666', 0); is(7, '11234', 0);
is(8, '33312', 9); is(8, '66665', 18); is(8, '66666', 18); is(8, '33124', 0);
is(9, '22223', 8); is(9, '55555', 20); is(9, '22233', 0);
is(10, '12345', 15); is(10, '54321', 15); is(10, '23456', 0); is(10, '12346', 0); is(10, '11234', 0);
is(11, '23456', 20); is(11, '65432', 20); is(11, '12345', 0); is(11, '23455', 0);
is(12, '22333', 13); is(12, '66655', 28); is(12, '11122', 7); is(12, '66666', 0); is(12, '22233', 12); is(12, '22234', 0); is(12, '66665', 0);
is(13, '12345', 15); is(13, '66666', 30); is(13, '11111', 5);
is(14, '66666', 50); is(14, '11111', 50); is(14, '11112', 0);

console.log('Totals and the bonus');
{
  const sh = new Array(15).fill(null);
  [3, 6, 9, 12, 15, 18].forEach((v, b) => { sh[b] = v; });
  ok(E.upperSum(sh) === 63 && E.bonusOf(sh) === 50, 'three of every face = 63 and the bonus 50');
  ok(E.total(sh) === 113, 'total with the bonus');
  sh[0] = 2;
  ok(E.bonusOf(sh) === 0 && E.total(sh) === 62, 'one short of 63: no bonus');
  const s2 = new Array(15).fill(null); s2[5] = 18; s2[4] = 5;
  ok(E.bonusPossible(s2), 'the bonus still possible with four free upper boxes');
  [0, 1, 2, 3].forEach(b => { s2[b] = 0; });
  ok(!E.bonusPossible(s2), 'the bonus no longer possible (23 points)');
  const full = [5, 10, 15, 20, 25, 30, 12, 22, 18, 24, 15, 20, 28, 30, 50];
  ok(E.total(full) === 374, 'the highest possible total is 374');
}

/* ---------- Decisions ---------- */
console.log('Decisions');
{
  const g = { seed: 4242 }, rng = () => E.rand01(g);
  const die = () => 1 + Math.floor(rng() * 6);
  let bad = 0;
  for (let k = 0; k < 3000; k++) {
    const level = k % 3, sh = new Array(15).fill(null);
    const nFilled = Math.floor(rng() * 15);
    const order = [...Array(15).keys()].sort(() => rng() - 0.5);
    for (let i = 0; i < nFilled; i++) sh[order[i]] = 0;
    const dice = [die(), die(), die(), die(), die()], roll = 1 + Math.floor(rng() * 3);
    const d = E.decide(level, { dice, roll, sheet: sh }, rng);
    if (d.box !== undefined) { if (!(Number.isInteger(d.box) && sh[d.box] === null)) bad++; }
    else if (roll === 3 || !Array.isArray(d.hold) || d.hold.length >= 5 || new Set(d.hold).size !== d.hold.length || !d.hold.every(i => Number.isInteger(i) && i >= 0 && i < 5)) bad++;
  }
  ok(bad === 0, `every decision is a free box, or a valid hold while a roll is left (${bad} bad)`);
  for (const level of [0, 1, 2]) {
    const sh = new Array(15).fill(null);
    const d = E.decide(level, { dice: [4, 4, 4, 4, 4], roll: 1, sheet: sh }, () => 0.5);
    ok(d.box === 14, `level ${level} writes a generál at once`);
  }
  // Mistr: a finished large straight goes into its free box; with three sixes it keeps exactly the sixes
  const empty = () => new Array(15).fill(null);
  ok(E.decide(2, { dice: [2, 3, 4, 5, 6], roll: 1, sheet: empty() }, () => 0.5).box === 11, 'Mistr writes a large straight');
  const h = E.decide(2, { dice: [6, 6, 6, 1, 3], roll: 1, sheet: empty() }, () => 0.5).hold;
  ok(h && h.length === 3 && h.every(i => i < 3), 'Mistr keeps three sixes');
  // only one box left: it is written there whatever the dice
  const last = new Array(15).fill(0); last[9] = null;
  for (const level of [0, 1, 2]) ok(E.decide(level, { dice: [1, 2, 3, 5, 6], roll: 3, sheet: last }, () => 0.5).box === 9, `level ${level} writes the last free box`);
}

console.log('Same seed, same game');
{
  for (const level of [0, 1, 2]) {
    const run = () => { const g = { seed: 99 }, sh = new Array(15).fill(null), boxes = []; for (let t = 0; t < 15; t++) boxes.push(E.playTurn(level, sh, g)); return boxes.join(',') + '|' + sh.join(','); };
    ok(run() === run(), `level ${level} plays the same game from the same seed`);
  }
  ok(JSON.stringify(E.simulate(0, 2, 20, 5)) === JSON.stringify(E.simulate(0, 2, 20, 5)), 'simulate is deterministic');
}

/* ---------- Strength of the levels ---------- */
console.log(`Levels (${GAMES} games per pairing)`);
const t0 = Date.now();
const solo = [0, 1, 2].map(l => E.solo(l, GAMES));
solo.forEach((s, l) => console.log(`  level ${l} alone: average ${s.avg}, bonus in ${Math.round(s.bonus * 100)} %, generál in ${Math.round(s.general * 100)} %`));
ok(solo[0].avg < solo[1].avg && solo[1].avg < solo[2].avg, 'the average score grows with the level');
ok(solo[2].avg > 230, `Mistr averages over 230 (${solo[2].avg})`);
for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) {
  const r = E.simulate(a, b, GAMES);
  console.log(`  level ${a} : level ${b} = ${r.a} : ${r.b} (draws ${r.draw}), averages ${r.avgA} : ${r.avgB}`);
  ok(r.b > r.a * 1.8, `level ${b} clearly beats level ${a}`);
}
console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
