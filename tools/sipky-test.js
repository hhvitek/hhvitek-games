#!/usr/bin/env node
// Tests the Šipky ven engine (games/sipky-ven/index.html, the block between "Engine" and "Engine end") in Node:
//   node tools/sipky-test.js              the rules on hand-made boards (the way out from the head to the edge, what
//                                         blocks it, holes of a cut shape never block, the solver), then every level
//                                         1–999: a valid board inside its shape, solvable, the same every time,
//                                         growing sizes, and how long the slowest level takes to make
//   node tools/sipky-test.js --levels N   only levels 1–N (default all)
//   node tools/sipky-test.js --file X     test the engine in another file (an .html or .js with the same block)
// Levels are saved by number in the players' records: a change that alters an existing level is reported.
// Only Node's built-in modules. Exit code 1 when something fails.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const file = opt('--file', path.join(__dirname, '..', 'games', 'sipky-ven', 'index.html'));
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/\/\* -{10} Engine -{10} \*\/([\s\S]*?)\/\* -{10} Engine end -{10} \*\//);
if (!m) { console.error('No Engine block in ' + file); process.exit(1); }
const E = new Function(m[1] + '\nreturn SipkyEngine();')();
const LEVELS = Math.min(+opt('--levels', E.MAX_LEVEL), E.MAX_LEVEL);

// the fingerprint of levels 1–999 (see the end of the Levels part)
const LEVELS_HASH = '36beff42ecb1245e';

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('  FAIL ' + msg); } };
const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
// a board: pieces are [head x, head y, direction, length], the body goes back from the head
const board = (cols, rows, pieces) => ({ cols, rows, pieces });
const none = B => B.pieces.map(() => false);

/* ---------- Rules ---------- */
console.log('Rules');
{
  ok(JSON.stringify(E.cellsOf([2, 1, RIGHT, 3])) === '[[2,1],[1,1],[0,1]]', 'cells of a right arrow, head first');
  ok(JSON.stringify(E.cellsOf([1, 0, UP, 2])) === '[[1,0],[1,1]]', 'cells of an up arrow, head first');
  // A points right at B; B points up and is free; C behind A's tail does not matter
  const B = board(4, 3, [[1, 1, RIGHT, 2], [3, 1, UP, 1], [0, 2, DOWN, 1]]);
  const occ = E.occupancy(B, none(B));
  ok(E.blocker(B, occ, 0).by === 1 && E.blocker(B, occ, 0).dist === 1, 'A is blocked by B one free cell ahead');
  ok(E.isFree(B, occ, 1), 'B (up from the top row edge) is free');
  ok(E.isFree(B, occ, 2), 'C (down at the bottom edge) is free');
  ok(JSON.stringify(E.freePieces(B, none(B))) === '[1,2]', 'free pieces: B and C');
  ok(JSON.stringify(E.freePieces(B, [false, true, false])) === '[0,2]', 'with B out, A is free');
  ok(E.exitDist(B, B.pieces[0]) === 3, 'A slides 3 cells to leave');
  // pieces behind the head never block (only the way in front of the head counts)
  const back = board(4, 1, [[3, 0, RIGHT, 1], [1, 0, RIGHT, 1]]);
  ok(E.isFree(back, E.occupancy(back, none(back)), 0), 'a piece behind does not block');
  ok(!E.isFree(back, E.occupancy(back, none(back)), 1), 'a piece in front blocks');
  // two pieces facing each other: stuck
  const face = board(3, 1, [[0, 0, RIGHT, 1], [2, 0, LEFT, 1]]);
  ok(E.solve(face) === null, 'two arrows facing each other cannot be cleared');
  const r = E.solve(B);
  ok(r && r.order.length === 3 && r.order.indexOf(1) < r.order.indexOf(0), 'the solver takes B before A');
  // a cut shape: the empty cells of the mask are holes the arrows fly over
  const holes = board(3, 1, [[0, 0, RIGHT, 1]]);
  holes.mask = '100';
  ok(E.isFree(holes, E.occupancy(holes, none(holes)), 0), 'holes in the shape never block');
  ok(E.validBoard(B) && !E.validBoard(board(3, 1, [[0, 0, RIGHT, 2]])) && !E.validBoard(board(3, 1, [[0, 0, LEFT, 1], [0, 0, UP, 1]])),
    'a valid board: pieces inside and not overlapping');
  ok(!E.validBoard(board(3, 3, [[1, 1, 4, 1]])) && !E.validBoard(board(3, 3, [[1, 1, 0, 7]])), 'a broken piece is refused');
}

/* ---------- Levels ---------- */
console.log(`Levels 1–${LEVELS}`);
{
  let maxMs = 0, maxAt = 0, prevCells = 0, shrink = [];
  const hash = crypto.createHash('sha256');
  const first = E.generate(1);
  ok(first.cols * first.rows <= 16 && first.pieces.length <= 10, `level 1 is small (${first.cols} × ${first.rows}, ${first.pieces.length} arrows)`);
  for (let lv = 1; lv <= LEVELS; lv++) {
    const t0 = Date.now(), g = E.generate(lv), dt = Date.now() - t0;
    if (dt > maxMs) { maxMs = dt; maxAt = lv; }
    const B = { cols: g.cols, rows: g.rows, pieces: g.pieces, mask: g.mask };
    ok(E.validBoard(B), `level ${lv}: an invalid board`);
    ok(g.cols <= E.MAX_COLS && g.rows <= E.MAX_ROWS, `level ${lv}: bigger than the phone allows`);
    ok(E.solve(B), `level ${lv}: cannot be cleared`);
    for (const p of g.pieces) for (const [x, y] of E.cellsOf(p)) if (g.mask[y * g.cols + x] !== '1') { ok(false, `level ${lv}: an arrow outside its shape`); break; }
    ok(JSON.stringify(E.generate(lv).pieces) === JSON.stringify(g.pieces), `level ${lv}: not the same every time`);
    hash.update(JSON.stringify([g.cols, g.rows, g.mask, g.pieces]));
    const cells = g.cols * g.rows;
    if (cells < prevCells) shrink.push(lv);
    prevCells = Math.max(prevCells, cells);
  }
  ok(shrink.length === 0, `the board never gets smaller (smaller at ${shrink.slice(0, 10).join(', ')})`);
  ok(maxMs < 1000, `the slowest level takes ${maxMs} ms to make (level ${maxAt})`);
  console.log(`  slowest level ${maxAt}: ${maxMs} ms`);
  // the fingerprint of all 999 levels: players keep stars and records per level number, so the levels must not change
  if (LEVELS === E.MAX_LEVEL) {
    const h = hash.digest('hex').slice(0, 16);
    ok(h === LEVELS_HASH, `the levels changed (fingerprint ${h}, expected ${LEVELS_HASH}): players' stars would belong to other boards; if that is on purpose, put the new fingerprint into LEVELS_HASH`);
  }
  for (const lv of [1, 10, 47, 100, 500, 999].filter(x => x <= LEVELS)) {
    const g = E.generate(lv);
    console.log(`  level ${String(lv).padStart(3)}: ${g.cols} × ${g.rows}, ${g.pieces.length} arrows, shape ${g.shape || 'full'}`);
  }
}

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
