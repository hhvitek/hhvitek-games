#!/usr/bin/env node
// Checks the texts and their translations (CLAUDE.md, Texts and languages). Only Node's built-in modules.
//   node tools/i18n.js [ids…]                    errors, then one line of translation debt per language (exit 1 on errors)
//   node tools/i18n.js --strict [ids…]           the debt of a ready language (missing or stale) is an error too (release gate)
//   node tools/i18n.js --todo <lang> [ids…]      JSON of what to translate: [{ key, game, cs, oldCs?, oldText?, note? }]
//   node tools/i18n.js --mark-translated <lang> [ids…]   records the cs each <lang> text was translated from
//                                                (i18n/translated.json), so a later change of cs shows as stale
// ids are game ids (games/<id>/texts.js); "shared" means the texts in i18n/. Without ids: everything.
// ids may also be "launcher" (index.html with i18n/launcher.js).
// As a module (tools/check.js): checkGame(id), checkShared(), checkLauncher(), isConverted(id), messages(), debtLine().
//
// Errors (fail tools/check.js at once):
//  - text written in the code of a converted page instead of a message: a JS string or template literal, an HTML
//    text node or an aria-label / title / alt / placeholder with Czech diacritics or a common Czech word;
//    a line with "i18n-ignore" is exempt,
//  - a key used in the code (t('k'), th('k'), I18N.t('k'), data-t*="k", nameKey: 'k' …) that does not exist,
//  - a message without cs, a key twice, a message that does not parse, a plural without every category of its
//    language, a translation with other {params} than cs, en with Czech diacritics or the same as cs, a key of
//    games/<id>/texts.js that does not start with "<id>."
//    (a translation may leave out a param that cs uses only to choose a select case, e.g. the gender {fem}).
// Debt (only reported): a message without a language of i18n/languages.js, a stale translation (cs changed since it
// was translated), a key nobody uses.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const rel = p => path.join(ROOT, p);
const read = p => fs.readFileSync(rel(p), 'utf8');
const exists = p => fs.existsSync(rel(p));
const TRANSLATED = 'i18n/translated.json';
// i18n/ files that hold no messages
const NOT_TEXTS = ['languages.js', 'i18n.js', 'flags.js'];
// shared scripts checked like a page once they use I18N (later steps convert them)
const SHARED_SCRIPTS = ['games/_cards/cards.js', 'games/_cards/marias.js', 'games/_opponents/opponents.js'];
// a translation may be the same as cs (names, symbols): these texts
const SAME_OK = ['Koxa', 'Líza', 'Čiperka', 'Pacička', 'Šedivka', 'Mourek', 'Bivoj', 'Rambo', 'Fousek', 'Mrrp!', 'Laser', 'laser', '{kg} kg', 'Sudoku', 'Mahjong', 'FreeCell', 'Reversi', 'OK', 'Prší', 'Start', 'Mars'];
// words with Czech letters that may stay in an English text (names of places, cats, the author, Czech games and cards)
const NAMES_OK = ['Šedivka', 'Nováková', 'Náchod', 'Náchodsko', 'Vítek', 'Vítkovy', 'Líza', 'Čiperka', 'Pacička', 'Prší', 'Mariáš', 'mariáš'];
// languages whose texts must not contain Czech diacritics
const NO_DIACRITICS = ['en'];
const DIACRITICS = /[ěščřžýáíéůúňťďĚŠČŘŽÝÁÍÉŮÚŇŤĎ]/;
// common Czech words without diacritics (keep it short: every word here can give a false hit)
const WORDS = /(?<![\w.\-/$#@"'=])(ty|hra|hry|hru|hrat|tah|tahy|tahu|nova|zpet|karta|karty|kostka|kostky|vyhral|vyhrala|prohral|prohrala|znovu|konec)(?![\w\-/])/i;
const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 10);
const ERRLOG_MARK = '/* ---------- Error log ---------- */';
const lineOf = (text, pos) => { let n = 1; for (let i = 0; i < pos && i < text.length; i++) if (text.charCodeAt(i) === 10) n++; return n; };

/* ---------- Loading the messages ---------- */
// runs the i18n runtime (for its parser) and every texts file in one vm, recording where each key comes from
function loadFiles(files, getSource) {
  const ctx = vm.createContext({ console: { log() {}, warn() {}, error() {}, info() {} } });
  const out = { defs: new Map(), dupes: [], loadErrors: [], langs: [], flags: {}, parse: null };
  try { vm.runInContext(read('i18n/languages.js'), ctx, { filename: 'i18n/languages.js' }); } catch (e) { out.loadErrors.push(`i18n/languages.js: ${e.message}`); }
  try { vm.runInContext(read('i18n/i18n.js'), ctx, { filename: 'i18n/i18n.js' }); } catch (e) { out.loadErrors.push(`i18n/i18n.js: ${e.message}`); }
  try { if (exists('i18n/flags.js')) vm.runInContext(read('i18n/flags.js'), ctx, { filename: 'i18n/flags.js' }); } catch (e) { out.loadErrors.push(`i18n/flags.js: ${e.message}`); }
  out.langs = Array.isArray(ctx.LANGS) ? JSON.parse(JSON.stringify(ctx.LANGS)) : [];
  out.flags = ctx.FLAGS && typeof ctx.FLAGS === 'object' ? Object.assign({}, ctx.FLAGS) : {};
  out.parse = ctx.I18N && ctx.I18N.parse;
  let current = '';
  ctx.I18N = {
    add(obj) {
      if (!obj || typeof obj !== 'object') { out.loadErrors.push(`${current}: I18N.add() needs an object`); return; }
      for (const k of Object.keys(obj)) {
        if (out.defs.has(k)) out.dupes.push({ key: k, file: current, first: out.defs.get(k).file });
        else out.defs.set(k, { msg: obj[k], file: current });
      }
    },
  };
  for (const f of files) {
    current = f;
    try { vm.runInContext(getSource(f), ctx, { filename: f, timeout: 5000 }); } catch (e) { out.loadErrors.push(`${f}: ${e.message}`); }
  }
  return out;
}
function textFiles() {
  const shared = exists('i18n') ? fs.readdirSync(rel('i18n')).filter(f => f.endsWith('.js') && !NOT_TEXTS.includes(f)).sort().map(f => `i18n/${f}`) : [];
  const games = fs.readdirSync(rel('games'), { withFileTypes: true }).filter(d => d.isDirectory() && exists(`games/${d.name}/texts.js`)).map(d => `games/${d.name}/texts.js`).sort();
  return [...shared, ...games];
}
let DB = null;
function db() {
  if (DB) return DB;
  DB = loadFiles(textFiles(), read);
  DB.translated = {};
  try { if (exists(TRANSLATED)) DB.translated = JSON.parse(read(TRANSLATED)) || {}; } catch (e) { DB.loadErrors.push(`${TRANSLATED}: ${e.message}`); }
  return DB;
}
// whose texts a file holds: a game id, "launcher" (i18n/launcher.js, keys launcher.*) or "shared" (the rest of i18n/)
const ownerOf = file => { if (file === 'i18n/launcher.js') return 'launcher'; const m = /^games\/([^/]+)\/texts\.js$/.exec(file); return m ? m[1] : 'shared'; };
const langCodes = () => db().langs.map(l => l && l.code).filter(Boolean);

/* ---------- One message ---------- */
function walk(nodes, fn) { for (const x of nodes || []) if (x && typeof x === 'object') { fn(x); if (x.cases) for (const c of Object.values(x.cases)) walk(c, fn); } }
function paramsOf(nodes) { const s = new Set(); walk(nodes, x => { if (x.name) s.add(x.name); }); return [...s].sort().join(','); }
// params used only to choose a select case (never printed, e.g. {fem, select, …}): a language without that grammar may leave them out
function selectorsOnly(nodes) { const sel = new Set(), other = new Set(); walk(nodes, x => { if (x.name) (x.k === 'select' ? sel : other).add(x.name); }); return new Set([...sel].filter(n => !other.has(n))); }
const categories = lang => { try { return new Intl.PluralRules(lang).resolvedOptions().pluralCategories; } catch (e) { return ['other']; } };
function messageErrors(key, def) {
  const P = [], m = def.msg, where = `${def.file}: ${key}`;
  if (!m || typeof m !== 'object' || Array.isArray(m)) return [`${where}: must be { cs, en?, note? }`];
  const codes = langCodes();
  for (const f of Object.keys(m)) if (f !== 'note' && !codes.includes(f)) P.push(`${where}: unknown field "${f}" (a language of i18n/languages.js or note)`);
  if ('note' in m && typeof m.note !== 'string') P.push(`${where}: note must be a string`);
  if (typeof m.cs !== 'string' || !m.cs) { P.push(`${where}: no cs text (cs is the source and always required)`); return P; }
  const parse = db().parse, trees = {};
  for (const lang of codes) {
    if (!(lang in m)) continue;
    if (typeof m[lang] !== 'string') { P.push(`${where}: ${lang} must be a string`); continue; }
    if (!m[lang]) continue; // empty = not translated yet
    try { trees[lang] = parse(m[lang]); } catch (e) { P.push(`${where}: ${lang} does not parse: ${e.message}`); continue; }
    const cats = categories(lang);
    walk(trees[lang], x => {
      if (x.k !== 'plural') return;
      const miss = cats.filter(c => !(c in x.cases));
      if (miss.length) P.push(`${where}: ${lang} plural {${x.name}} needs the forms ${miss.join(', ')} (${lang}: ${cats.join(', ')})`);
    });
    if (lang === 'cs') continue;
    // the same params as cs; a param cs uses only to choose a select case (the gender {fem}) may be left out
    if (trees.cs) {
      const own = paramsOf(trees[lang]).split(',').filter(Boolean), src = paramsOf(trees.cs).split(',').filter(Boolean), opt = selectorsOnly(trees.cs);
      if (own.some(p => !src.includes(p)) || src.some(p => !own.includes(p) && !opt.has(p))) P.push(`${where}: ${lang} has the params {${own.join(',')}}, cs has {${src.join(',')}}${opt.size ? ` (only {${[...opt].join(',')}} may be left out)` : ''}`);
    }
    if (NO_DIACRITICS.includes(lang)) {
      let s = m[lang]; for (const n of NAMES_OK) s = s.split(n).join('');
      if (DIACRITICS.test(s)) P.push(`${where}: ${lang} contains Czech letters ("${m[lang].slice(0, 60)}"); allowed names are in NAMES_OK in tools/i18n.js`);
    }
    if (m[lang] === m.cs && /\p{L}{2}/u.test(m.cs.replace(/\{[^{}]*\}|<[^>]*>/g, ' ')) && !SAME_OK.includes(m.cs)) P.push(`${where}: ${lang} is the same as cs; translate it (or add the text to SAME_OK in tools/i18n.js)`);
  }
  return P;
}

/* ---------- Text written in the code ---------- */
// every string and template-literal part of a script: { at, text, tpl }; comments and regular expressions skipped
const KEYWORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof']);
function jsLiterals(code) {
  const out = [];
  let i = 0;
  const regexOk = prev => prev === '' || /^[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || KEYWORDS.has(prev);
  function expr(endOnBrace) {
    let depth = 0, prev = '';
    while (i < code.length) {
      const c = code[i], d = code[i + 1];
      if (c === '/' && d === '/') { const e = code.indexOf('\n', i); i = e < 0 ? code.length : e; continue; }
      if (c === '/' && d === '*') { const e = code.indexOf('*/', i + 2); i = e < 0 ? code.length : e + 2; continue; }
      if (c === '"' || c === "'") {
        const s = ++i;
        while (i < code.length && code[i] !== c && code[i] !== '\n') i += code[i] === '\\' ? 2 : 1;
        out.push({ at: s, text: code.slice(s, i), tpl: false }); i++; prev = 'a'; continue;
      }
      if (c === '`') { template(); prev = 'a'; continue; }
      if (c === '/' && regexOk(prev)) {
        i++; let cls = false;
        while (i < code.length && code[i] !== '\n') {
          if (code[i] === '\\') { i += 2; continue; }
          if (code[i] === '[') cls = true; else if (code[i] === ']') cls = false; else if (code[i] === '/' && !cls) { i++; break; }
          i++;
        }
        while (/[a-z]/.test(code[i] || '')) i++;
        prev = 'a'; continue;
      }
      if (/\s/.test(c)) { i++; continue; }
      if (/[\w$]/.test(c)) { const s = i; while (i < code.length && /[\w$]/.test(code[i])) i++; prev = code.slice(s, i); continue; }
      if (c === '{') depth++;
      else if (c === '}') { if (!depth && endOnBrace) { i++; return; } depth--; }
      prev = c; i++;
    }
  }
  function template() {
    i++;
    let at = i;
    while (i < code.length && code[i] !== '`') {
      if (code[i] === '\\') { i += 2; continue; }
      if (code[i] === '$' && code[i + 1] === '{') { out.push({ at, text: code.slice(at, i), tpl: true }); i += 2; expr(true); at = i; continue; }
      i++;
    }
    out.push({ at, text: code.slice(at, i), tpl: true }); i++;
  }
  expr(false);
  return out;
}
const blank = s => s.replace(/[^\n]/g, ' ');
// the hard-coded texts of a page (HTML with inline scripts) or of a script: ["line N: …"]
function hardCoded(src, isScript) {
  const found = new Map(); // line → snippet
  const lines = src.split('\n');
  const hit = (text, at, kind) => {
    // data-t* values are keys, not texts
    const s = text.replace(/data-t(?:-[a-z]+)?\s*=\s*"[^"]*"/g, blank);
    const checks = [DIACRITICS];
    if (kind !== 'str' || /\s/.test(s.trim()) || /^[A-ZÁ-Ž][a-zá-ž]/.test(s)) checks.push(WORDS);
    for (const re of checks) {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      for (const m of s.matchAll(g)) {
        const line = lineOf(src, at + m.index);
        if (found.has(line) || /i18n-ignore/.test(lines[line - 1] || '')) continue;
        found.set(line, (lines[line - 1] || '').trim().replace(/\s+/g, ' ').slice(0, 90));
      }
    }
  };
  if (isScript) {
    for (const l of jsLiterals(src)) hit(l.text, l.at, l.tpl ? 'tpl' : 'str');
  } else {
    let doc = src.replace(/<!--[\s\S]*?-->/g, blank).replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, b, c) => a + blank(b) + c);
    const scripts = [];
    doc = doc.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, b, c, off) => { scripts.push({ at: off + a.length, code: b }); return a + blank(b) + c; });
    for (const s of scripts) {
      if (s.code.includes(ERRLOG_MARK)) continue; // the shared developer log, compared byte for byte by tools/check.js
      for (const l of jsLiterals(s.code)) hit(l.text, s.at + l.at, l.tpl ? 'tpl' : 'str');
      // a display name written as data ({ id: 'night', name: 'Noc' }) is a text even without diacritics: use nameKey
      for (const m of s.code.matchAll(/\b(name|title|desc|label)\s*:\s*(['"`])([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^'"`\n]*)\2/g)) {
        const line = lineOf(src, s.at + m.index);
        if (!found.has(line) && !/i18n-ignore/.test(lines[line - 1] || '')) found.set(line, (lines[line - 1] || '').trim().replace(/\s+/g, ' ').slice(0, 90));
      }
    }
    for (const m of doc.matchAll(/<[^>]*>|[^<]+/g)) {
      if (m[0][0] !== '<') { hit(m[0], m.index, 'text'); continue; }
      for (const a of m[0].matchAll(/\s(aria-label|title|alt|placeholder)\s*=\s*("([^"]*)"|'([^']*)')/gi)) hit(a[3] !== undefined ? a[3] : a[4], m.index + a.index + a[0].length - a[2].length + 1, 'attr');
    }
  }
  return [...found].sort((a, b) => a[0] - b[0]).map(([line, s]) => `line ${line}: ${s}`);
}

/* ---------- Keys used in the code ---------- */
// { exact: Set (checked: must exist), prefixes: Set, strings: Set (any literal equal to a key counts as a use) }
function keysUsed(src, isScript) {
  const exact = new Set(), prefixes = new Set(), strings = new Set();
  const code = isScript ? src : src.replace(/<!--[\s\S]*?-->/g, '');
  for (const m of code.matchAll(/(?<![\w$])(?:I18N\s*\.\s*)?th?\(\s*(['"])([^'"\n]+)\1/g)) exact.add(m[2]);
  for (const m of code.matchAll(/(?<![\w$])(?:I18N\s*\.\s*)?th?\(\s*`([^`$]*)(\$\{)?/g)) (m[2] ? prefixes : exact).add(m[1]);
  for (const m of code.matchAll(/\bdata-t(?:-html|-aria|-title)?="([^"]*)"/g)) {
    const v = m[1], d = v.indexOf('${');
    if (d < 0) exact.add(v); else if (d > 0) prefixes.add(v.slice(0, d));
  }
  for (const m of code.matchAll(/\b[a-z]\w*Key\s*:\s*(['"])([\w-]+(?:\.[\w-]+)+)\1/g)) if (!m[2].startsWith('games.')) exact.add(m[2]);
  const scripts = isScript ? [src] : [...code.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  for (const s of scripts) for (const l of jsLiterals(s)) if (!l.tpl) strings.add(l.text);
  prefixes.delete('');
  return { exact, prefixes, strings };
}

/* ---------- Pages and scripts ---------- */
const isConverted = id => exists(`games/${id}/index.html`) && read(`games/${id}/index.html`).includes('<script src="texts.js"></script>');
const launcherConverted = () => exists('index.html') && /<script src="i18n\/i18n\.js"><\/script>/.test(read('index.html'));
const sharedConverted = f => exists(f) && /\bI18N\./.test(read(f));
// every file whose code uses the messages: { file, owner, isScript }
function consumers() {
  const out = [];
  for (const d of fs.readdirSync(rel('games'), { withFileTypes: true })) if (d.isDirectory() && isConverted(d.name)) out.push({ file: `games/${d.name}/index.html`, owner: d.name, isScript: false });
  if (launcherConverted()) out.push({ file: 'index.html', owner: 'launcher', isScript: false });
  for (const f of SHARED_SCRIPTS) if (sharedConverted(f)) out.push({ file: f, owner: 'shared', isScript: true });
  return out;
}
const useCache = new Map();
const usesOf = c => { if (!useCache.has(c.file)) useCache.set(c.file, keysUsed(read(c.file), c.isScript)); return useCache.get(c.file); };
function codeErrors(c) {
  const P = [], src = read(c.file), u = usesOf(c), defs = db().defs;
  const hard = hardCoded(src, c.isScript);
  for (const h of hard.slice(0, 25)) P.push(`${c.file} ${h}  ← text for the player belongs in a texts file (t()/th()/data-t*); "i18n-ignore" on the line if it is not one`);
  if (hard.length > 25) P.push(`${c.file}: … and ${hard.length - 25} more lines with text written in the code`);
  for (const k of u.exact) if (!defs.has(k)) P.push(`${c.file}: the key "${k}" is used but not defined`);
  return P;
}

/* ---------- Checks ---------- */
function messageErrorsOf(filter) {
  const P = [], d = db();
  for (const [k, def] of d.defs) {
    if (!filter(def.file)) continue;
    P.push(...messageErrors(k, def));
    const owner = ownerOf(def.file);
    if (owner !== 'shared' && !k.startsWith(owner + '.')) P.push(`${def.file}: the key "${k}" must start with "${owner}."`);
  }
  for (const x of d.dupes) if (filter(x.file)) P.push(`${x.file}: the key "${x.key}" is defined twice (also in ${x.first})`);
  for (const e of d.loadErrors) if (filter(e.split(':')[0])) P.push(`does not load: ${e}`);
  return P;
}
// a converted game: its texts.js and its index.html
function checkGame(id) {
  if (!isConverted(id)) return [];
  const P = messageErrorsOf(f => f === `games/${id}/texts.js`);
  if (!exists(`games/${id}/texts.js`)) P.push(`games/${id}/texts.js is missing`);
  P.push(...codeErrors({ file: `games/${id}/index.html`, owner: id, isScript: false }));
  return P;
}
// the texts in i18n/, the languages and flags, and (once converted) the shared scripts; the launcher: checkLauncher()
function checkShared() {
  const d = db(), P = messageErrorsOf(f => f.startsWith('i18n/'));
  const codes = langCodes();
  if (!d.langs.length) P.push('i18n/languages.js must set globalThis.LANGS');
  if (new Set(codes).size !== codes.length) P.push('i18n/languages.js: a language code twice');
  if (!d.langs.some(l => l.code === 'cs' && l.ready)) P.push("i18n/languages.js: cs must be there with ready: true");
  for (const l of d.langs) {
    if (!l || !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(l.code || '') || !l.name) P.push(`i18n/languages.js: ${JSON.stringify(l)} needs a code (BCP 47) and a name`);
    else if (!/^<svg[\s\S]*<\/svg>$/.test(d.flags[l.code] || '')) P.push(`i18n/flags.js: no flag (inline <svg>) for ${l.code}`);
  }
  for (const c of consumers().filter(c => c.owner === 'shared')) P.push(...codeErrors(c));
  return P;
}
// the launcher (index.html) once it loads the texts: no text written in its code, every key it uses exists
// (its keys are launcher.* in i18n/launcher.js, common.* and game.*; all of them live in i18n/)
function checkLauncher() {
  if (!launcherConverted()) return [];
  const P = codeErrors({ file: 'index.html', owner: 'launcher', isScript: false });
  if (!exists('i18n/launcher.js')) P.push('i18n/launcher.js is missing (the texts of the launcher)');
  return P;
}
// every message: Map key -> { msg: { cs, en?, note? }, file }
const messages = () => db().defs;

/* ---------- Debt ---------- */
function inScope(ids) { return file => !ids || !ids.length || ids.includes(ownerOf(file)); }
function debt(ids) {
  const d = db(), scope = inScope(ids), out = {};
  for (const l of d.langs) {
    if (!l || l.code === 'cs') continue;
    const rec = d.translated[l.code] || {}, r = out[l.code] = { ready: !!l.ready, missing: [], stale: [] };
    for (const [k, def] of d.defs) {
      if (!scope(def.file) || !def.msg || typeof def.msg.cs !== 'string') continue;
      const v = def.msg[l.code];
      if (typeof v !== 'string' || !v) r.missing.push(k);
      else if (rec[k] !== hash(def.msg.cs)) r.stale.push(k);
    }
  }
  // unused: a game's keys not used by its page; shared keys not used by any page (game.* are read through the registry)
  const cons = consumers(), unused = [];
  const usedBy = (k, list) => list.some(c => { const u = usesOf(c); return u.exact.has(k) || u.strings.has(k) || [...u.prefixes].some(p => k.startsWith(p)); });
  for (const [k, def] of d.defs) {
    if (!scope(def.file) || k.startsWith('game.')) continue;
    const owner = ownerOf(def.file);
    const list = owner === 'shared' ? cons : cons.filter(c => c.owner === owner);
    if (owner !== 'shared' && !list.length) continue; // the game does not load its texts yet
    if (!usedBy(k, list)) unused.push(k);
  }
  return { langs: out, unused };
}
const gamesOf = keys => new Set(keys.map(k => ownerOf(db().defs.get(k).file)));
function debtLine(ids) {
  try {
    const x = debt(ids), parts = [];
    for (const [code, r] of Object.entries(x.langs)) {
      const g = gamesOf([...r.missing, ...r.stale]);
      parts.push(`${code}${r.ready ? '' : ' (not ready)'}: ${r.missing.length} missing, ${r.stale.length} stale${g.size ? ` in ${g.size} file group${g.size > 1 ? 's' : ''}` : ''}`);
    }
    return `i18n debt: ${parts.join('; ') || 'no other language'}; ${x.unused.length} unused key${x.unused.length === 1 ? '' : 's'}`;
  } catch (e) { return `i18n debt: could not be computed (${e.message})`; }
}

/* ---------- --todo: the old cs from the commit that last recorded the translations ---------- */
const oldSources = new Map();
function oldCs(file, key, recorded) {
  if (!recorded) return undefined;
  try {
    if (!oldSources.has(file)) {
      let defs = null;
      const c = spawnSync('git', ['log', '-1', '--format=%H', '--', TRANSLATED], { cwd: ROOT, encoding: 'utf8' });
      const commit = (c.stdout || '').trim();
      if (commit) {
        const s = spawnSync('git', ['show', `${commit}:${file}`], { cwd: ROOT, encoding: 'utf8' });
        if (s.status === 0) defs = loadFiles([file], () => s.stdout).defs;
      }
      oldSources.set(file, defs);
    }
    const defs = oldSources.get(file), def = defs && defs.get(key);
    return def && def.msg && hash(def.msg.cs) === recorded ? def.msg.cs : undefined;
  } catch (e) { return undefined; }
}
function todo(lang, ids) {
  const d = db(), x = debt(ids).langs[lang];
  if (!x) throw new Error(`no language "${lang}" in i18n/languages.js (or it is cs, the source)`);
  const rec = d.translated[lang] || {};
  return [...x.missing, ...x.stale].map(k => {
    const def = d.defs.get(k), m = def.msg, o = { key: k, game: ownerOf(def.file), cs: m.cs };
    if (typeof m[lang] === 'string' && m[lang]) { const old = oldCs(def.file, k, rec[k]); if (old !== undefined) o.oldCs = old; o.oldText = m[lang]; }
    if (m.note) o.note = m.note;
    return o;
  });
}
function markTranslated(lang, ids) {
  const d = db(), scope = inScope(ids);
  if (!langCodes().includes(lang) || lang === 'cs') throw new Error(`no language "${lang}" to mark`);
  const all = Object.assign({}, d.translated), rec = Object.assign({}, all[lang] || {});
  for (const k of Object.keys(rec)) if (!d.defs.has(k)) delete rec[k]; // keys that are gone
  let n = 0;
  for (const [k, def] of d.defs) {
    if (!scope(def.file) || !def.msg || typeof def.msg.cs !== 'string') continue;
    const v = def.msg[lang];
    if (typeof v === 'string' && v) { rec[k] = hash(def.msg.cs); n++; }
  }
  all[lang] = Object.fromEntries(Object.keys(rec).sort().map(k => [k, rec[k]]));
  const sorted = Object.fromEntries(Object.keys(all).sort().map(k => [k, all[k]]));
  fs.writeFileSync(rel(TRANSLATED), JSON.stringify(sorted, null, 2) + '\n');
  return n;
}

module.exports = { checkGame, checkShared, checkLauncher, messages, isConverted, debt, debtLine, todo, markTranslated, hardCoded, jsLiterals, keysUsed, hash };

/* ---------- CLI ---------- */
if (require.main === module) {
  const args = process.argv.slice(2);
  const flag = name => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
  const strict = args.includes('--strict'); if (strict) args.splice(args.indexOf('--strict'), 1);
  const todoLang = flag('--todo'), markLang = flag('--mark-translated');
  const ids = args.filter(a => !a.startsWith('--'));
  try {
    if (todoLang) { console.log(JSON.stringify(todo(todoLang, ids), null, 2)); process.exit(0); }
    if (markLang) { const n = markTranslated(markLang, ids); console.log(`${TRANSLATED}: ${n} ${markLang} texts recorded`); process.exit(0); }
  } catch (e) { console.error(e.message); process.exit(1); }
  const errors = [];
  if (!ids.length || ids.includes('shared')) errors.push(...checkShared());
  if (!ids.length || ids.includes('launcher')) errors.push(...checkLauncher());
  const gameIds = ids.length ? ids.filter(i => i !== 'shared' && i !== 'launcher') : fs.readdirSync(rel('games'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  for (const id of gameIds) {
    if (!exists(`games/${id}/index.html`)) { if (ids.length) errors.push(`no game "${id}"`); continue; }
    if (exists(`games/${id}/texts.js`) && !isConverted(id)) errors.push(`games/${id}/texts.js exists but games/${id}/index.html does not load it`);
    errors.push(...checkGame(id));
  }
  if (strict) {
    const x = debt(ids.length ? ids : null);
    for (const [code, r] of Object.entries(x.langs)) if (r.ready && r.missing.length + r.stale.length)
      errors.push(`${code} is ready but ${r.missing.length} texts are missing and ${r.stale.length} stale: run the translation pass (node tools/i18n.js --todo ${code})`);
  }
  for (const e of errors) console.log(`  - ${e}`);
  const conv = gameIds.filter(isConverted);
  console.log(`${errors.length ? `${errors.length} errors` : 'no errors'} (${conv.length} converted game${conv.length === 1 ? '' : 's'}${launcherConverted() ? ' + the launcher' : ''})`);
  console.log(debtLine(ids.length ? ids : null));
  process.exit(errors.length ? 1 : 0);
}
