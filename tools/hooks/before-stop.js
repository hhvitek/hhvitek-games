#!/usr/bin/env node
// Stop hook (.claude/settings.json): before the agent ends its turn, look at the games changed in the working tree
// (git status, so edits made by scripts count too):
//  1. tools/check.js must pass for them,
//  2. each changed game needs screenshots newer than its last change (tools/shots.js), so somebody has looked at it.
// Otherwise the turn goes on once with the reason (exit code 2, text on stderr). The second time
// (stop_hook_active) it lets the agent stop, so it is a reminder, never a loop.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CHECK = path.join(ROOT, 'tools', 'check.js');
const SHOTS = path.join(ROOT, '.playwright-mcp');

let input = '';
process.stdin.on('data', d => { input += d; });
process.stdin.on('end', () => {
  let data = {};
  try { data = JSON.parse(input || '{}'); } catch (e) {}
  if (data.stop_hook_active) process.exit(0);

  // games changed and not committed (modified or new files under games/)
  const st = spawnSync('git', ['-c', 'core.quotePath=false', 'status', '--porcelain', '--untracked-files=all', '--', 'games'], { cwd: ROOT, encoding: 'utf8' });
  if (st.status !== 0) process.exit(0); // no git: nothing to say
  const ids = new Set();
  // games that load a shared file (games/_cards/cards.js, games/_cards/marias.js, games/_opponents/opponents.js)
  const usersOf = shared => fs.readdirSync(path.join(ROOT, 'games')).filter(d => {
    const f = path.join(ROOT, 'games', d, 'index.html');
    return fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes(`../${shared}`);
  });
  for (const line of st.stdout.split('\n')) {
    const file = line.slice(3).trim().replace(/^"|"$/g, '');
    const shared = /^games\/(_cards\/cards\.js|_cards\/marias\.js|_opponents\/opponents\.js)$/.exec(file);
    if (shared) usersOf(shared[1]).forEach(id => ids.add(id));
    const m = /^games\/([^/]+)\//.exec(file);
    if (m && m[1] !== '_cards' && m[1] !== '_opponents') ids.add(m[1]);
  }
  const reasons = [];
  // a change the players will get needs a line in "## Nevydáno" of CHANGELOG.md (tools/release.js turns it into
  // the next version); same list of files the players never get as in tools/release.js
  const all = spawnSync('git', ['-c', 'core.quotePath=false', 'status', '--porcelain', '--untracked-files=all'], { cwd: ROOT, encoding: 'utf8' });
  const changed = (all.stdout || '').split('\n').filter(Boolean).map(l => l.slice(3).trim().replace(/^"|"$/g, '').replace(/^.* -> /, ''));
  const forPlayers = changed.filter(f => !/^(tools|docs|\.claude|\.github|\.playwright-mcp|games\/_template)\//.test(f) && !/\.md$/.test(f) && !/^\.git/.test(f) && f !== 'LICENSE');
  if (forPlayers.length && !changed.includes('CHANGELOG.md')) reasons.push(
    `Players will get changes (${forPlayers.slice(0, 4).join(', ')}${forPlayers.length > 4 ? ', …' : ''}) but CHANGELOG.md has no new line: ` +
    'add a short Czech line under "## Nevydáno", or say in your answer why it is not needed.');
  if (!ids.size) {
    if (!reasons.length) process.exit(0);
    process.stderr.write(reasons.join('\n') + '\n');
    process.exit(2);
  }

  const failing = [];
  for (const id of ids) {
    const r = spawnSync(process.execPath, [CHECK, id], { cwd: ROOT, encoding: 'utf8' });
    if (r.status !== 0) failing.push((r.stdout || '').split('\n').filter(l => /^(FAIL|\s+- |no game)/.test(l)).join('\n'));
  }
  if (failing.length) reasons.push('tools/check.js fails for changed games:', ...failing);

  // screenshots: games/<id>/index.html changed after its last tools/shots.js picture (the template is not shot)
  const stale = [...ids].filter(id => id !== '_template' && fs.existsSync(path.join(ROOT, 'games', id, 'index.html'))).filter(id => {
    const shot = path.join(SHOTS, `${id}-1start.png`);
    return !fs.existsSync(shot) || fs.statSync(shot).mtimeMs < fs.statSync(path.join(ROOT, 'games', id, 'index.html')).mtimeMs;
  });
  if (stale.length) reasons.push(
    `Not looked at since the last change: ${stale.join(', ')}. Run tools/shots.js for them (a headless Playwright MCP only, see Testing in CLAUDE.md; browser_run_code_unsafe ` +
    `with filename tools/shots.js after setting globalThis.SHOT_IDS = ${JSON.stringify(stale)}; a local server on port 8765) and look at ` +
    `.playwright-mcp/sheet-<id>.png, or say in your answer why it is not needed (e.g. a comment-only change).`);

  if (!reasons.length) process.exit(0);
  process.stderr.write(reasons.join('\n') + '\n');
  process.exit(2);
});
