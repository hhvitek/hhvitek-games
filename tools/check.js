#!/usr/bin/env node
// Checks the rules from CLAUDE.md that can be checked by reading the files: the launcher contract,
// storage, the Back button, fonts, the shared look of the paper screens, no external resources, and the
// "Patterns every game follows" that went wrong before (each message says what to copy from where).
// Usage (from the repository root, Node 18+, no dependencies):
//   node tools/check.js          every game, the template, the launcher and sw.js
//   node tools/check.js <id>     one game (or _template, or launcher); the hooks in .claude/settings.json use this
// Exit code 1 when something fails. Run it after every change to a game.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = p => fs.existsSync(path.join(ROOT, p));

// games from the registry (it is plain JS that sets globalThis.GAMES)
const sandbox = {};
new Function('globalThis', read('games/registry.js'))(sandbox);
const registry = sandbox.GAMES || [];
const games = registry.map(g => g.id);
// folders that start with "_" are not games (_template, _cards, _opponents)
const folders = fs.readdirSync(path.join(ROOT, 'games'), { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('_')).map(d => d.name);
const ONLY = process.argv[2] || null;
const ids = [...new Set([...games, ...folders]), '_template'].filter(id => !ONLY || id === ONLY);
if (ONLY && ONLY !== 'launcher' && !ids.length) { console.log(`no game "${ONLY}" (games/${ONLY}/ is not a game folder)`); process.exit(1); }
const readme = read('README.md');
const cardsCss = exists('games/_cards/cards.js') ? (read('games/_cards/cards.js').match(/textContent = `([\s\S]*?)`;/) || [, ''])[1] : '';

// Settings, help and dialogs look the same in every game (user's decision): this exact rule in every game
const PAPER = '.paper{--pp:#f4ebdf;--pink:#2b1a0e;--pcard:#faf4eb;--popt:#fcf8f2;--popt-on:#f6e9d7;--psoft:#6f5a48;--pline:#e6d8c6;--psw:#e7d9c6;--pbtn:#7a4520;--pbtn-ink:#fff;--pbtn-sh:#3f220e;--pon:#7a4520;--pon-ink:#fff}';
const ERRLOG = (read('games/_template/index.html').match(/<script>\n\/\* ---------- Error log ---------- \*\/[\s\S]*?<\/script>/) || [])[0] || '';

// CSS selectors whose small text is allowed: labels drawn inside game pieces (see CLAUDE.md)
const SMALL_TEXT_OK = [/\.peg\b/, /\.num\b/, /\.ix\b/];

// All rules of a CSS text as { sel, body, media } (nested @media blocks handled, comments removed)
function cssRules(css, media = '') {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const sel = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    const body = css.slice(open + 1, j - 1);
    if (sel.startsWith('@media') || sel.startsWith('@supports')) out.push(...cssRules(body, sel));
    else if (!sel.startsWith('@keyframes')) out.push({ sel, body, media });
    i = j;
  }
  return out;
}
// The text of a function declaration `function name(...) { ... }` (braces balanced), or '' when there is none
function funcBody(code, name) {
  const m = new RegExp(`function ${name}\\s*\\([^)]*\\)\\s*\\{`).exec(code);
  if (!m) return '';
  let depth = 1, j = m.index + m[0].length;
  while (j < code.length && depth) { if (code[j] === '{') depth++; else if (code[j] === '}') depth--; j++; }
  return code.slice(m.index, j);
}
// Every setTimeout(...) call: its line in the script and its text up to the closing parenthesis
function timeouts(code) {
  const out = [];
  for (const m of code.matchAll(/setTimeout\(/g)) {
    let depth = 1, j = m.index + m[0].length;
    while (j < code.length && depth) { if (code[j] === '(') depth++; else if (code[j] === ')') depth--; j++; }
    out.push({ line: code.slice(0, m.index).split('\n').length, text: code.slice(m.index, j) });
  }
  return out;
}
const pxBelow18 = v => { const m = /(^|[^\d.])(\d+(?:\.\d+)?)px/.exec(v); return m && +m[2] < 18; };

let failed = 0;
const report = (id, problems) => {
  if (!problems.length) { console.log(`ok    ${id}`); return; }
  failed++;
  console.log(`FAIL  ${id}`);
  for (const p of problems) console.log(`        - ${p}`);
};

for (const id of ids) {
  const file = `games/${id}/index.html`;
  const P = [];
  const need = (cond, msg) => { if (!cond) P.push(msg); };
  if (!exists(file)) { report(id, [`${file} is missing`]); continue; }
  const html = read(file);
  const isTemplate = id === '_template';
  need(!!ERRLOG && html.includes(ERRLOG), 'the shared Error log block from games/_template');
  need(html.search(/<script\b/) === html.indexOf(ERRLOG), 'the Error log block is the first <script>');
  need(Buffer.from(html).indexOf('<meta charset="utf-8">') >= 0 && Buffer.from(html).indexOf('<meta charset="utf-8">') < 1024 && html.indexOf('<meta charset') < html.search(/<script\b/), '<meta charset="utf-8"> in the first 1024 bytes, before the Error log block');
  const entry = registry.find(g => g.id === id);
  // the id may be written literally or through const ID = '<id>' (as in the template)
  const idConst = (html.match(/const ID = '([^']+)'/) || [])[1];
  const hasKey = suffix => html.includes(`games.${id}.${suffix}`) || (idConst === id || isTemplate) && html.includes('games.${ID}.' + suffix);

  // folder, icon, registry and README
  need(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || isTemplate, 'folder name must be kebab-case ASCII (the Czech name without diacritics)');
  if (!isTemplate) {
    need(!!entry, `games/${id}/ is not listed in games/registry.js`);
    if (entry) need(entry.name && entry.description, 'registry entry needs a Czech name and description');
    need(exists(`games/${id}/icon.svg`), `games/${id}/icon.svg is missing`);
    if (exists(`games/${id}/icon.svg`)) need(/viewBox="0 0 512 512"/.test(read(`games/${id}/icon.svg`)), 'icon.svg must be square with viewBox="0 0 512 512"');
    need(readme.includes(`games/${id}/`), `README.md has no row for games/${id}/`);
  }

  // launcher contract
  need(/<html lang="cs"/.test(html), '<html lang="cs">');
  need(/<h1>[^<]+<\/h1>/.test(html), 'a visible <h1> with the game name in the top bar');
  need(/id="btnHome"[^>]*href="\.\.\/\.\.\/index\.html"[^>]*hidden/.test(html), 'home button: <a id="btnHome" href="../../index.html" … hidden>');
  need(/\[\?&\]menu/.test(html) && /btnHome'?\)?\.hidden = false/.test(html), 'home button shown only with ?menu');
  need(hasKey('inProgress'), `"Rozehráno" badge key games.${id}.inProgress`);
  need(/removeItem\((BADGE|['`]games\.)/.test(html), 'the badge key is removed when there is no unfinished game');
  need(hasKey('state'), `storage key games.${id}.state`);
  need(!/\.plays/.test(html.replace(/games\.\$\{a\.dataset\.id\}\.plays/g, '')), 'a game never touches games.<id>.plays (the launcher counts plays)');
  need(!/serviceWorker\.register|rel="manifest"/.test(html), 'a game registers no service worker or manifest (the launcher does)');
  need(/#app\{[^}]*height:var\(--app-h,100dvh\)/.test(html) && /\/\* ---------- Visible height ---------- \*\//.test(html), 'the game is as tall as the visible window: #app height:var(--app-h,100dvh) and the "Visible height" block from the template');
  need(!/viewport-fit=cover/.test(html), 'no viewport-fit=cover in the viewport meta: the installed app then draws under the navigation bar and hides the bottom buttons');

  // storage and the senior rules
  need(/navigator\.storage\.persist\(\)/.test(html), 'navigator.storage.persist() on start');
  const lines = html.split('\n');
  lines.forEach((l, i) => {
    if (!/localStorage\.(get|set|remove)Item/.test(l)) return;
    if (!/try\s*\{/.test(lines.slice(Math.max(0, i - 8), i + 1).join('\n'))) P.push(`localStorage outside try/catch (line ${i + 1})`);
  });
  need(!/\sdisabled[\s>=]|\.disabled\s*=|setAttribute\(\s*['"]disabled|toggleAttribute\(\s*['"]disabled/.test(html.replace(/:disabled/g, '')), 'no `disabled` without feedback: dim the action and explain it with a toast');
  need(!/(^|[^.\w])(alert|confirm|prompt)\(/m.test(html), 'no alert()/confirm()/prompt(): use the game dialog (#modal)');
  need(/Back button ----/.test(html) && /addEventListener\('popstate'/.test(html), 'the "Back button" block (Android Back closes the open screen)');
  const layers = ((html.match(/const LAYERS = \[([^\]]*)\]/) || [])[1] || '');
  for (const m of html.matchAll(/id="(screen[A-Za-z]+|modal)"/g)) need(layers.includes(`'#${m[1]}'`), `#${m[1]} is missing in LAYERS of the Back button block`);
  for (const scr of ['screenSettings', 'screenHelp']) need(html.includes(`id="${scr}"`), `#${scr} layer`);
  need((html.match(/data-act="close"/g) || []).length >= 2, 'every screen needs a [data-act="close"] button');
  need(/class="screen-head"[^`]*<h2>[^<]+<small>/.test(html), 'screen head shows the game name with the screen name in <small>');
  need(/id="btnUndo"|data-a="undo"|id: 'undo'/.test(html), 'an Undo button ("Zpět")');
  need(/100dvh/.test(html) && /env\(safe-area-inset-/.test(html), 'layout uses 100dvh and env(safe-area-inset-*)');

  // CSS: theming of settings/help/dialogs/toast, fonts, external resources
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
  const usesCards = html.includes('<script src="../_cards/cards.js"></script>');
  const rules = cssRules(styles + (usesCards ? '\n' + cardsCss : ''));
  need(styles.includes(PAPER), 'settings, help and dialogs share one light look: copy the .paper{…} rule from the template');
  for (const r of rules.filter(r => r.sel === '#toast' && !r.media)) {
    const bg = (/background(?:-color)?:([^;]+)/.exec(r.body) || [])[1] || '';
    if (bg && !/var\(|color-mix\(/.test(bg)) P.push('the toast colour comes from the theme, not a fixed colour');
  }
  for (const r of rules) {
    if (/max-height:\s*800px/.test(r.media)) continue; // short screens: smaller text allowed (user's decision)
    for (const m of r.body.matchAll(/font(?:-size)?:([^;]+)/g)) {
      if (pxBelow18(m[1]) && !SMALL_TEXT_OK.some(re => re.test(r.sel))) P.push(`font below 18 px: ${r.sel}`);
    }
  }
  for (const m of html.matchAll(/style="[^"]*font-size:\s*(\d+)px/g)) if (+m[1] < 18) P.push(`inline font below 18 px: ${m[0].slice(0, 60)}`);
  // a phone turned sideways shows the notice "Otoč telefon na výšku" (copy the #rotate block from the template)
  need(/<div id="rotate" class="paper"[^>]*>[\s\S]*?Otoč telefon na výšku/.test(html) && rules.some(r => r.sel === '#rotate' && /orientation:\s*landscape/.test(r.media)), 'the rotate notice for a phone turned sideways (#rotate from the template)');
  // every game offers the theme "Papír" with the launcher's colours (card games: the paper table in cards.js)
  const themeSrc = usesCards ? read('games/_cards/cards.js') : html;
  const attr = usesCards ? 'data-table' : 'data-theme';
  need(/\{\s*id:\s*'paper',\s*name:\s*'Papír',\s*meta:\s*'#f4ebdf'/.test(themeSrc), `a theme { id: 'paper', name: 'Papír', meta: '#f4ebdf' } (the launcher's look)`);
  need(rules.some(r => r.sel.split(',').some(s => s.trim() === `[${attr}="paper"]`) && /#f4ebdf/.test(r.body) && /#2b1a0e/.test(r.body)), `[${attr}="paper"] uses the launcher's colours (#f4ebdf, ink #2b1a0e)`);
  // an unavailable button keeps readable text: no fill and a dashed outline, never only opacity
  for (const r of rules) {
    if (!/\.(undo|act|big|go|tbtn|arrow|ctl|key)\.dim\b|(^|[\s,])\.dim\s*($|,)|\.(sw|sbtn)\.off\b/.test(r.sel)) continue;
    const op = /(?:^|;)\s*opacity:\s*([\d.]+)/.exec(r.body);
    if (op && +op[1] < 1) P.push(`dimmed button only made transparent (${r.sel}): copy the .undo.dim rule from the template (a paper switch: .sw.off in skladani-kostek)`);
  }

  // one self-contained file: only images/, the shared card look, the mariáš cards and the computer opponents may be loaded
  for (const m of html.matchAll(/<(?:script|link|img|iframe|audio|video|source)\b[^>]*\s(?:src|href)=["']([^"']+)["']/g)) {
    const u = m[1];
    if (/^(https?:)?\/\//.test(u)) P.push(`external resource: ${u}`);
    else if (!/^(\.\.\/\.\.\/images\/sets\.js|\.\.\/_cards\/cards\.js|\.\.\/_cards\/marias\.js|\.\.\/_opponents\/opponents\.js|\.\.\/\.\.\/index\.html|data:)/.test(u)) P.push(`unexpected file: ${u}`);
  }
  need(!/url\(\s*['"]?(https?:)?\/\//.test(styles) && !/@import/.test(styles), 'no external CSS (url(http…) or @import)');
  need(!/fetch\(|XMLHttpRequest|import\(/.test(html.replace(/<style[\s\S]*?<\/style>/g, '')), 'no fetch()/XMLHttpRequest/import(): the game must work from file://');
  if (/\bCARDS\b/.test(html)) need(usesCards, 'uses CARDS but does not load ../_cards/cards.js');
  if (/\bMARIAS\b/.test(html)) need(usesCards && html.includes('<script src="../_cards/marias.js"></script>') && html.indexOf('../_cards/marias.js') > html.indexOf('../_cards/cards.js'), 'uses MARIAS but does not load ../_cards/marias.js after ../_cards/cards.js');
  if (/\bOPPONENTS\b/.test(html)) need(html.includes('<script src="../_opponents/opponents.js"></script>'), 'uses OPPONENTS but does not load ../_opponents/opponents.js');

  // "Patterns every game follows" (CLAUDE.md) that went wrong in real games
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  // an end dialog never opens over Settings, Help or another dialog: it waits for them (whenFree) or checks nothingOpen()
  need(/const nothingOpen = /.test(scripts) && /function whenFree\(/.test(scripts), 'the nothingOpen() and whenFree() helpers (copy them from the template, section Helpers)');
  for (const t of timeouts(scripts)) {
    const shows = [...t.text.matchAll(/\b(show[A-Z]\w*)\b/g)].map(m => m[1]).filter(f => f !== 'showHint'); // a hint is not a dialog
    if (!shows.length || /nothingOpen\(\)|whenFree\(/.test(t.text)) continue;
    if (shows.every(f => f !== 'showModal' && /nothingOpen\(\)/.test(funcBody(scripts, f)))) continue;
    P.push(`script line ${t.line}: a delayed dialog (${[...new Set(shows)].join(', ')}) may open over Settings or Help; use whenFree(g0, ms, fn) as in the template`);
  }
  // only known settings are taken over from the save
  need(/for \(const k of Object\.keys\(DEFAULTS\)\)/.test(scripts), 'saved settings: take over only the DEFAULTS keys, `for (const k of Object.keys(DEFAULTS)) if (k in savedSettings) S[k] = savedSettings[k];` (template, section Start)');
  // opening a screen hides the toast
  for (const f of ['openSettings', 'openHelp']) need(/hideToast\(\)/.test(funcBody(scripts, f)), `function ${f}() must call hideToast() (as in the template)`);
  // a settings change that needs a new game says so also after a finished game
  // (only the extra words "a rozehraná hra se ztratí" belong to a game in progress)
  for (const f of ['renderSettings', 'closeSettings']) {
    // "a game in progress" written as status === 'playing' && <has moves> (isFresh, a move counter…)
    const bad = funcBody(scripts, f).split('\n').filter(l => /status === 'playing' && (!isFresh\(\)|[\w.]+ > 0|[\w.]+\.length)/.test(l) && !/ztratí/.test(l));
    if (bad.length) P.push(`${f}(): the "new game" notice and toast must use !isFresh() alone, not status === 'playing' && !isFresh() (a finished game can still be revived by Undo; see patnactka)`);
  }
  // a % padding or margin is taken from the parent's width, not from the element (the tiny dice pips of Zavři čísla)
  styles.split('\n').forEach(l => { if (/(padding|margin)[^;{}]*\d%/.test(l) && !/% ok/.test(l)) P.push(`CSS "${l.trim().slice(0, 70)}": padding/margin in % is taken from the parent's width, not from the element; use calc(var(--size) * x), or add /* % ok */ on the line when that is meant`); });
  // the test hook used by tools/shots.js
  need(/window\.[A-Z]\w* = \{[\s\S]{0,600}?get state\(\)/.test(scripts), 'a test hook `window.<Name> = { …, get state() { return { S, G }; } }` (tools/shots.js uses it)');

  report(id, P);
}

// launcher and offline mode
if (!ONLY || ONLY === 'launcher') {
  const P = [], idx = read('index.html'), sw = read('sw.js');
  const code = idx.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n'); // comments may mention localStorage.clear()
  if (!/OTHER_KEY_NAMES/.test(idx) || /localStorage\.clear\(\)/.test(code)) P.push('reset must remove only our keys (no localStorage.clear())');
  if (!/Back button ----/.test(idx)) P.push('launcher: the "Back button" block for its dialog');
  if (/viewport-fit=cover/.test(idx)) P.push('launcher: no viewport-fit=cover in the viewport meta (the installed app would draw under the navigation bar)');
  if (!ERRLOG || !idx.includes(ERRLOG) || idx.search(/<script\b/) !== idx.indexOf(ERRLOG)) P.push('launcher: the shared Error log block must be the first <script>');
  if (!(Buffer.from(idx).indexOf('<meta charset="utf-8">') >= 0 && Buffer.from(idx).indexOf('<meta charset="utf-8">') < 1024)) P.push('launcher: <meta charset="utf-8"> in the first 1024 bytes');
  if (!/games\/_cards\/cards\.js/.test(sw)) P.push('sw.js must cache games/_cards/cards.js');
  if (!/games\/_cards\/marias\.js/.test(sw)) P.push('sw.js must cache games/_cards/marias.js');
  if (!/games\/_opponents\/opponents\.js/.test(sw)) P.push('sw.js must cache games/_opponents/opponents.js');
  // versioning: version.js (written by tools/release.js) names the release; sw.js caches one version at a time
  const ver = exists('version.js') ? read('version.js') : '';
  if (!/^globalThis\.APP_VERSION = \{ version: '\d+\.\d+\.\d+', date: '\d{4}-\d{2}-\d{2}' \};\r?$/m.test(ver)) P.push("version.js: globalThis.APP_VERSION = { version: 'X.Y.Z', date: 'YYYY-MM-DD' }; (written by tools/release.js)");
  if (!/^globalThis\.APP_CHANGES = \[/m.test(ver)) P.push('version.js: globalThis.APP_CHANGES = [ … ] (written by tools/release.js)');
  if (!/<script src="version\.js"><\/script>/.test(idx)) P.push('launcher: load version.js (<script src="version.js">) for the version in Nastavení');
  if (!/try \{ importScripts\('version\.js'\); \} catch/.test(sw) || !/'version\.js'/.test(sw.split('APP_FILES')[1] || '')) P.push("sw.js: import version.js (try/catch) and keep it in APP_FILES, so every release installs a new worker");
  if (!/const CACHE = PREFIX \+ VERSION/.test(sw)) P.push('sw.js: the cache is named after the version (const CACHE = PREFIX + VERSION)');
  if (/CHECK_EVERY|checkForUpdates/.test(sw)) P.push('sw.js: no hourly per-file check: a new version comes whole with a new worker');
  if (!/updateViaCache: 'none'/.test(idx)) P.push("launcher: register sw.js with { updateViaCache: 'none' } so a release is noticed at once");
  // supply chain: a GitHub Action is pinned to a commit SHA (a tag like @v7 can be moved to other code)
  const wfDir = path.join(ROOT, '.github', 'workflows');
  for (const f of fs.existsSync(wfDir) ? fs.readdirSync(wfDir).filter(n => /\.ya?ml$/.test(n)) : []) {
    for (const m of read(`.github/workflows/${f}`).matchAll(/^\s*-?\s*uses:\s*['"]?([^\s'"#]+)/gm)) {
      if (!m[1].startsWith('./') && !/@[0-9a-f]{40}$/.test(m[1])) P.push(`.github/workflows/${f}: "${m[1]}" must be pinned to a full commit SHA (uses: owner/action@<40 hex> # vX.Y.Z), a release at least 7 days old`);
    }
  }
  if (!exists('CHANGELOG.md') || !/^## Nevydáno\r?$/m.test(read('CHANGELOG.md'))) P.push('CHANGELOG.md with a "## Nevydáno" section (tools/release.js turns it into the next version)');
  if (/importScripts\([^)]*images\/sets\.js/.test(sw.replace(/try \{ importScripts\('images\/sets\.js'\); \} catch/, ''))) P.push('sw.js: images/sets.js must be optional (try/catch)');
  report('launcher + sw.js', P);
}

console.log(failed ? `\n${failed} with problems` : '\nall checks passed');
process.exit(failed ? 1 : 0);
