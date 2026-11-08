#!/usr/bin/env node
// PostToolUse hook (.claude/settings.json): after the agent edits a game file, run tools/check.js for that game.
// Problems go to the agent at once (exit code 2, text on stderr); a clean check says nothing.
// The hook gets the tool call as JSON on stdin: { tool_name, tool_input: { file_path, … }, … }.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CHECK = path.join(ROOT, 'tools', 'check.js');

// which check.js targets a changed file belongs to (null = nothing to check)
function targetsOf(rel) {
  const shared = /^games\/(_cards\/cards|_cards\/marias|_opponents\/opponents)\.js$/.exec(rel);
  if (shared) {
    // a shared file (the card look, the computer opponents): every game that loads it
    return fs.readdirSync(path.join(ROOT, 'games')).filter(d => {
      const f = path.join(ROOT, 'games', d, 'index.html');
      return fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes(`../${shared[1]}.js`);
    });
  }
  const m = /^games\/([^/]+)\//.exec(rel);
  if (m) return [m[1]];
  if (rel === 'games/registry.js' || rel === 'README.md' || rel === 'tools/check.js') return ['']; // '' = everything
  if (rel === 'index.html' || rel === 'sw.js') return ['launcher'];
  return null;
}

let input = '';
process.stdin.on('data', d => { input += d; });
process.stdin.on('end', () => {
  let file = '';
  try { file = (JSON.parse(input).tool_input || {}).file_path || ''; } catch (e) { process.exit(0); }
  if (!file) process.exit(0);
  if (process.platform === 'win32') file = file.replace(/^\/([a-z])\//i, '$1:/'); // a Git Bash path /c/… = C:/…
  const rel =path.relative(ROOT, path.resolve(file)).split(path.sep).join('/');
  const targets = targetsOf(rel);
  if (!targets || !targets.length) process.exit(0);
  const problems = [];
  for (const t of targets) {
    const r = spawnSync(process.execPath, [CHECK, ...(t ? [t] : [])], { cwd: ROOT, encoding: 'utf8' });
    if (r.status !== 0) problems.push((r.stdout || '').split('\n').filter(l => /^(FAIL|\s+- |no game)/.test(l)).join('\n'));
  }
  if (!problems.length) process.exit(0);
  process.stderr.write(`tools/check.js found problems after the edit of ${rel} (fix them before you finish; see CLAUDE.md):\n${problems.join('\n')}\n`);
  process.exit(2);
});
