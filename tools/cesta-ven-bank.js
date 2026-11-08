#!/usr/bin/env node
// Finds hard puzzles for Cesta ven (games/cesta-ven/) and writes them into its BANK (between
// "/* BANK START */" and "/* BANK END */"). The game makes easy puzzles on the spot; puzzles that need more
// than LIVE_UP_TO moves are rare among random boards, so they are searched for here, ahead of time.
// Usage (from the repository root, Node 18+, no dependencies):  node tools/cesta-ven-bank.js [seconds=600]
// The puzzles already in the BANK are kept (if they still fit the game's logic), so the bank only grows; a longer
// run finds more of the rare hard puzzles.
// It uses the game's own logic (the GAME LOGIC section of the file), so the bank always matches the game.
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'games', 'cesta-ven', 'index.html');
const PER_DEPTH = 12;   // puzzles kept for each number of moves
const MIN_COUNT = 8;    // the bank ends below the first depth with fewer puzzles than this
const seconds = +process.argv[2] || 600;

const html = fs.readFileSync(FILE, 'utf8');
const a = html.indexOf('/* ---------- GAME LOGIC'), b = html.indexOf('/* ---------- State');
if (a < 0 || b < 0) throw new Error('GAME LOGIC section not found');
const L = new Function(html.slice(a, b) + '\nreturn { analyse, randomBoard, encode, decode, LIVE_UP_TO, GOAL };')();

// The same position can be encoded with different piece letters (the piece order of a board is random),
// so puzzles are told apart by their shape: the pieces sorted, without letters
const shapeKey = (pieces, pos) => pieces.map((p, i) => `${p.f},${p.len},${p.h},${pos[i]}`).sort().join('|');
const bank = {};   // depth -> Map shapeKey -> encoded puzzle
const add = (d, pieces, pos) => { const m = bank[d] = bank[d] || new Map(), k = shapeKey(pieces, pos); if (!m.has(k)) m.set(k, L.encode(pieces, pos)); };
const full = d => bank[d] && bank[d].size >= PER_DEPTH;
// The puzzles already in the BANK stay, so a short run never makes the bank smaller: each is checked with the
// current logic (after a change of the game the ones that no longer need exactly their number of moves drop out)
// and they come first; the search only fills the places up to PER_DEPTH
const oldCodes = new Set();
let dropped = 0;
{
  const s = html.indexOf('/* BANK START */'), e = html.indexOf('/* BANK END */');
  let old = {};
  try { old = new Function(html.slice(s, e) + '\nreturn BANK;')() || {}; } catch (err) { console.log('the old BANK could not be read, it is replaced'); }
  for (const [key, list] of Object.entries(old)) for (const code of Array.isArray(list) ? list : []) {
    const d = +key, m = bank[d] = bank[d] || new Map();
    let g = null, r = null;
    try { g = L.decode(code); r = g && L.analyse(g.pieces, g.pos); } catch (err) {}
    const k = g && shapeKey(g.pieces, g.pos);
    if (r && r.d0 === d && !m.has(k) && m.size < PER_DEPTH) { m.set(k, code); oldCodes.add(code); } else dropped++;
  }
  if (oldCodes.size || dropped) console.log(`from the old BANK: ${oldCodes.size} puzzles kept, ${dropped} dropped`);
}
const end = Date.now() + seconds * 1000;
let boards = 0, deepest = 0, lastLog = 0;
while (Date.now() < end) {
  const k = 11 + Math.floor(Math.random() * 4);
  const board = L.randomBoard(k);
  const r = L.analyse(board.pieces, board.pos, 99);
  boards++;
  if (!r || r.max <= L.LIVE_UP_TO) continue;
  deepest = Math.max(deepest, r.max);
  // the hardest position of this board, and one easier depth that still needs puzzles (one board, few depths)
  const depths = [r.max];
  const open = [];
  for (let d = L.LIVE_UP_TO + 1; d < r.max; d++) if (!full(d)) open.push(d);
  if (open.length) depths.push(open[Math.floor(Math.random() * open.length)]);
  for (const d of depths) {
    if (full(d)) continue;
    const p = L.analyse(board.pieces, board.pos, d);
    const check = L.analyse(board.pieces, p.at);   // verify from the puzzle itself
    if (check && check.d0 === d) add(d, board.pieces, p.at);
  }
  if (Date.now() - lastLog > 10000) {
    lastLog = Date.now();
    const counts = Object.keys(bank).map(Number).sort((x, y) => x - y).map(d => `${d}:${bank[d].size}`).join(' ');
    console.log(`${Math.round((end - Date.now()) / 1000)} s left, ${boards} boards, deepest ${deepest}  ${counts}`);
  }
}

// keep the depths without gaps, from LIVE_UP_TO + 1 up
const out = {};
for (let d = L.LIVE_UP_TO + 1; bank[d] && bank[d].size >= MIN_COUNT; d++) out[d] = [...bank[d].values()].slice(0, PER_DEPTH);
const depths = Object.keys(out).map(Number);
if (!depths.length) { console.log('nothing found, the bank was not changed'); process.exit(1); }
const body = 'const BANK = {\n' + depths.map(d => `  ${d}: [${out[d].map(s => `'${s}'`).join(',')}],`).join('\n') + '\n};';
// read the file again: it may have been edited while the search was running
const now = fs.readFileSync(FILE, 'utf8');
const s = now.indexOf('/* BANK START */'), e = now.indexOf('/* BANK END */');
if (s < 0 || e < s) throw new Error('BANK markers not found');
const next = now.slice(0, s) + '/* BANK START */\n' + body + '\n' + now.slice(e);
const total = depths.reduce((n, d) => n + out[d].length, 0);
const kept = depths.reduce((n, d) => n + out[d].filter(c => oldCodes.has(c)).length, 0);
const summary = `${depths[0]}–${depths[depths.length - 1]} moves, ${total} puzzles (${total - kept} new, ${kept} kept, ${dropped} dropped; ${boards} boards searched)`;
if (next === now) console.log(`nothing new, the bank was not changed: ${summary}`);
else { fs.writeFileSync(FILE, next); console.log(`bank written: ${summary}`); }
