#!/usr/bin/env node
// Releases a new version of the app (only when the user asks, see "Deployment" in CLAUDE.md).
//   node tools/release.js [patch|minor|major] [--dry-run] [--no-push] [--trailer "Key: value"]
//     patch (default) 1.0.0 -> 1.0.1, minor -> 1.1.0, major -> 2.0.0. The very first release (no v* tag yet)
//     releases the version in version.js as it is.
//     Turns "## Nevydáno" in CHANGELOG.md into "## X.Y.Z – YYYY-MM-DD", writes version.js (the version, the date
//     and every release for "Co je nového"), commits "Release X.Y.Z", tags vX.Y.Z and pushes both;
//     the tag starts .github/workflows/deploy.yml, which puts this version on GitHub Pages.
//     --dry-run only says what would happen, --no-push stops before the push, --trailer adds a commit trailer.
//   node tools/release.js --verify <tag>
//     For the deploy workflow: the tag matches version.js and CHANGELOG.md and is on master; exit code 1 if not.
// Node 18+, no dependencies.
'use strict';
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s);
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitOk = (...args) => spawnSync('git', args, { cwd: ROOT, stdio: 'ignore' }).status === 0;
const die = msg => { console.error(`release: ${msg}`); process.exit(1); };

const UNRELEASED = 'Nevydáno';
const RELEASE_TITLE = /^(\d+\.\d+\.\d+) – (\d{4}-\d{2}-\d{2})$/;
const VERSION_LINE = /^globalThis\.APP_VERSION = \{ version: '(\d+\.\d+\.\d+)', date: '(\d{4}-\d{2}-\d{2})' \};\r?$/m; // \r?: a copy saved with Windows line ends
// Files the player never gets (tools/release.js asks for at least one other changed file since the last tag)
const NOT_FOR_PLAYERS = [/^(tools|docs|\.claude|\.github|\.playwright-mcp|games\/_template)\//, /\.md$/, /^\.git/, /^LICENSE$/, /^\.mcp\.json$/];

function readVersion() {
  const m = VERSION_LINE.exec(read('version.js'));
  if (!m) die("version.js has no line globalThis.APP_VERSION = { version: 'X.Y.Z', date: 'YYYY-MM-DD' };");
  const sandbox = {};
  try { new Function('globalThis', read('version.js'))(sandbox); } catch (e) { die(`version.js does not run: ${e.message}`); }
  return { version: m[1], date: m[2], changes: Array.isArray(sandbox.APP_CHANGES) ? sandbox.APP_CHANGES : null };
}

// CHANGELOG.md: the lines before the first "## " heading, then one section per "## " heading
function parseChangelog(text) {
  const head = [], sections = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) { // Windows line ends too (written back with \n)
    const m = /^## (.+)$/.exec(line);
    if (m) sections.push(cur = { title: m[1].trim(), body: [] });
    else (cur ? cur.body : head).push(line);
  }
  return { head, sections };
}
const serialize = ({ head, sections }) => [...head, ...sections.flatMap(s => [`## ${s.title}`, ...s.body])].join('\n');
// "- " starts an item; indented lines below it continue it
function items(section) {
  const out = [];
  for (const line of section.body) {
    if (/^- /.test(line)) out.push(line.slice(2).trim());
    else if (/^\s+\S/.test(line) && out.length) out[out.length - 1] += ' ' + line.trim();
  }
  return out;
}
const releases = log => log.sections.filter(s => RELEASE_TITLE.test(s.title)).map(s => {
  const [, version, date] = RELEASE_TITLE.exec(s.title);
  return { version, date, items: items(s) };
});

function versionJs(version, date, changes) {
  return '// The app version, shown in the launcher\'s Nastavení and used by sw.js to name its cache.\n' +
    '// Written by tools/release.js from CHANGELOG.md: never edit by hand.\n' +
    `globalThis.APP_VERSION = { version: '${version}', date: '${date}' };\n` +
    `globalThis.APP_CHANGES = ${JSON.stringify(changes, null, 2)};\n`;
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function bump(version, kind) {
  const [a, b, c] = version.split('.').map(Number);
  return kind === 'major' ? `${a + 1}.0.0` : kind === 'minor' ? `${a}.${b + 1}.0` : `${a}.${b}.${c + 1}`;
}

/* ---------- --verify <tag> (the deploy workflow) ---------- */
function verify(tag) {
  const problems = [];
  const { version, changes } = readVersion();
  if (tag !== `v${version}`) problems.push(`tag ${tag} does not match version.js (${version}); release with tools/release.js`);
  const log = parseChangelog(read('CHANGELOG.md'));
  if (!releases(log).some(r => r.version === version)) problems.push(`CHANGELOG.md has no section "## ${version} – YYYY-MM-DD"`);
  if (!changes || !changes.length || changes[0].version !== version) problems.push('version.js: APP_CHANGES does not start with this version');
  if (!gitOk('merge-base', '--is-ancestor', 'HEAD', 'origin/master')) problems.push('the tagged commit is not on master (origin/master)');
  if (problems.length) die(`not deploying ${tag}:\n  - ${problems.join('\n  - ')}`);
  console.log(`release: ${tag} is a proper release`);
}

/* ---------- a new release ---------- */
function release(kind, { dryRun, push, trailers }) {
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'master') die('release only from master (merge the branch first)');
  if (git('status', '--porcelain')) die('the working tree is not clean: commit or stash first');
  try { git('fetch', '--quiet', '--tags', 'origin'); } catch (e) { die('cannot reach origin (git fetch failed)'); }
  if (gitOk('rev-parse', '--verify', '--quiet', 'origin/master') && git('rev-list', '--count', 'HEAD..origin/master') !== '0') die('master is behind origin/master: pull first');

  const cur = readVersion();
  const tags = git('tag', '--list', 'v[0-9]*').split('\n').filter(Boolean);
  let last = null;
  if (tags.length) {
    try { last = git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*'); } catch (e) { die('no v* tag is reachable from master'); }
    if (last !== `v${cur.version}`) die(`version.js says ${cur.version} but the last release tag is ${last}`);
  }
  const version = last ? bump(cur.version, kind) : cur.version;
  if (tags.includes(`v${version}`)) die(`tag v${version} already exists`);

  // something the player gets must have changed since the last release
  const changed = (last ? git('diff', '--name-only', `${last}..HEAD`) : git('ls-files')).split('\n').filter(Boolean);
  const forPlayers = changed.filter(f => !NOT_FOR_PLAYERS.some(re => re.test(f)));
  if (!forPlayers.length) die(changed.length ? `nothing for the players changed since ${last}, only ${changed.join(', ')}` : `nothing changed since ${last}`);

  const log = parseChangelog(read('CHANGELOG.md'));
  const open = log.sections.find(s => s.title === UNRELEASED);
  if (!open) die(`CHANGELOG.md has no "## ${UNRELEASED}" section`);
  const notes = items(open);
  if (!notes.length) die(`"## ${UNRELEASED}" in CHANGELOG.md is empty: write in Czech what the players get`);

  const check = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'check.js')], { cwd: ROOT, encoding: 'utf8' });
  if (check.status !== 0) die(`tools/check.js fails:\n${check.stdout}`);

  const date = today();
  console.log(`release: ${last || '(first release)'} -> v${version} (${date}), ${forPlayers.length} file(s) for the players`);
  notes.forEach(n => console.log(`  - ${n}`));
  if (dryRun) { console.log('release: --dry-run, nothing written'); return; }

  // CHANGELOG.md: "Nevydáno" becomes this release, a new empty "Nevydáno" goes above it
  open.title = `${version} – ${date}`;
  log.sections.splice(log.sections.indexOf(open), 0, { title: UNRELEASED, body: [''] });
  write('CHANGELOG.md', serialize(log));
  write('version.js', versionJs(version, date, releases(log)));

  git('add', 'version.js', 'CHANGELOG.md');
  git('commit', '--quiet', '-m', `Release ${version}`, '-m', notes.map(n => `- ${n}`).join('\n'), ...trailers.flatMap(t => ['--trailer', t]));
  git('tag', '-a', `v${version}`, '-m', `Version ${version}`);
  console.log(`release: committed and tagged v${version}`);
  if (!push) { console.log(`release: --no-push; to publish: git push --atomic origin master v${version}`); return; }
  try { git('push', '--atomic', '--quiet', 'origin', 'master', `v${version}`); }
  catch (e) { die(`push failed (the commit and the tag are ready locally): git push --atomic origin master v${version}\n${e.stderr || e.message}`); }
  console.log(`release: pushed; GitHub Actions now deploys v${version} (Actions tab of the repository)`);
}

const args = process.argv.slice(2);
if (args[0] === '--verify') {
  if (!args[1]) die('usage: node tools/release.js --verify <tag>');
  verify(args[1]);
} else {
  const kinds = args.filter(a => ['patch', 'minor', 'major'].includes(a));
  const trailers = [];
  args.forEach((a, i) => { if (a === '--trailer' && args[i + 1]) trailers.push(args[i + 1]); });
  const known = new Set(['patch', 'minor', 'major', '--dry-run', '--no-push', '--trailer', ...trailers]);
  const unknown = args.filter(a => !known.has(a));
  if (unknown.length || kinds.length > 1) die(`unknown arguments: ${unknown.join(' ') || kinds.join(' ')}\nusage: node tools/release.js [patch|minor|major] [--dry-run] [--no-push] [--trailer "Key: value"]`);
  release(kinds[0] || 'patch', { dryRun: args.includes('--dry-run'), push: !args.includes('--no-push'), trailers });
}
