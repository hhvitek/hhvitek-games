#!/usr/bin/env node
// Tests the texts runtime (i18n/i18n.js) in a Node vm and the hard-coded-text detector of tools/i18n.js.
//   node tools/i18n-test.js
// Only Node's built-in modules. Exit code 1 when something fails. Run it after changing either file.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const tool = require('./i18n.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'i18n', 'i18n.js'), 'utf8');
let failed = 0, passed = 0;
const eq = (got, want, what) => {
  if (got === want) { passed++; return; }
  failed++; console.log(`FAIL ${what}\n     got:  ${JSON.stringify(got)}\n     want: ${JSON.stringify(want)}`);
};
const ok = (cond, what) => eq(!!cond, true, what);
const throws = (fn, what) => { try { fn(); eq('no error', 'an error', what); } catch (e) { passed++; } };

// a fresh runtime with the given page around it
function runtime({ langs, search = '', stored = null, nav = undefined, document } = {}) {
  const store = new Map(stored ? [['games.lang', stored]] : []), errors = [];
  const ctx = {
    console: { error: m => errors.push(m), log() {} },
    location: { search },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) },
  };
  if (nav) ctx.navigator = nav;
  if (document) ctx.document = document;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  ctx.LANGS = langs || [{ code: 'cs', name: 'Čeština', ready: true }, { code: 'en', name: 'English', ready: false }];
  vm.runInContext(SRC, ctx);
  return { I: ctx.I18N, store, errors };
}
const NBSP = ' ';
const READY = [{ code: 'cs', name: 'Čeština', ready: true }, { code: 'en', name: 'English', ready: true }];

/* ---------- Formatting in Czech ---------- */
{
  const { I, errors } = runtime();
  eq(I.lang, 'cs', 'no navigator, nothing saved: cs');
  I.add({
    moves: { cs: '{n, plural, one {# tah} few {# tahy} many {# tahu} other {# tahů}}', en: '{n, plural, one {# move} other {# moves}}' },
    zero: { cs: '{n, plural, =0 {žádný tah} one {# tah} few {# tahy} many {# tahu} other {# tahů}}' },
    score: { cs: 'Body: {n}' },
    won: { cs: '{name} {fem, select, true {vyhrála} other {vyhrál}}' },
    nested: { cs: '{fem, select, true {Odehrála {n, plural, one {# hru} few {# hry} many {# hry} other {# her}}} other {Odehrál {n, plural, one {# hru} few {# hry} many {# hry} other {# her}}}}' },
    hashInSelect: { cs: '{n, plural, one {{x, select, a {# A} other {# jiné}}} few {# few} many {# many} other {# other}}' },
    html: { cs: 'Hraje <b>{name}</b>' },
    apos: { cs: "Rock 'n' roll {x}" },
    plain: { cs: 'Jen text' },
  });
  eq(I.t('moves', { n: 1 }), '1 tah', 'plural one');
  eq(I.t('moves', { n: 2 }), '2 tahy', 'plural few');
  eq(I.t('moves', { n: 4 }), '4 tahy', 'plural few 4');
  eq(I.t('moves', { n: 5 }), '5 tahů', 'plural other');
  eq(I.t('moves', { n: 0 }), '0 tahů', 'plural other 0');
  eq(I.t('moves', { n: 1.5 }), '1,5 tahu', 'plural many (a fraction), decimal comma');
  eq(I.t('moves', { n: 5000 }), `5${NBSP}000 tahů`, 'plural # formatted with grouping');
  eq(I.t('zero', { n: 0 }), 'žádný tah', 'plural =0 exact case');
  eq(I.t('zero', { n: 1 }), '1 tah', 'plural =0 does not take 1');
  eq(I.t('score', { n: 5000 }), `Body: 5${NBSP}000`, '{n} with a number is formatted');
  eq(I.t('score', { n: '2026' }), 'Body: 2026', '{n} with a string stays as written');
  eq(I.num(5000), `5${NBSP}000`, 'num()');
  eq(I.t('won', { name: 'Jarka', fem: true }), 'Jarka vyhrála', 'select true');
  eq(I.t('won', { name: 'Franta', fem: false }), 'Franta vyhrál', 'select false → other');
  eq(I.t('nested', { fem: true, n: 3 }), 'Odehrála 3 hry', 'plural nested in select');
  eq(I.t('nested', { fem: false, n: 5 }), 'Odehrál 5 her', 'plural nested in select (other)');
  eq(I.t('hashInSelect', { n: 1, x: 'a' }), '1 A', '# inside a select inside a plural');
  eq(I.th('html', { name: '<i>Tom & "Jerry"</i>' }), 'Hraje <b>&lt;i&gt;Tom &amp; &quot;Jerry&quot;&lt;/i&gt;</b>', 'th() escapes params, keeps the message HTML');
  eq(I.t('html', { name: '<i>' }), 'Hraje <b><i></b>', 't() leaves params as they are');
  eq(I.t('apos', { x: 1 }), "Rock 'n' roll 1", 'an apostrophe is a plain character');
  eq(I.t('score'), 'Body: {n}', 'a missing param stays visible');
  eq(I.t('nope'), 'nope', 'a missing key gives the key');
  ok(errors.some(e => /missing key nope/.test(e)), 'a missing key is reported on the console');
  I.add({ plain: { cs: 'Jiný' } }); I.add({ plain: { cs: 'Ještě jiný' } });
  eq(I.t('plain'), 'Jen text', 'a duplicate key keeps the first message');
  eq(errors.filter(e => /duplicate key plain/.test(e)).length, 1, 'a duplicate key is reported once');
  I.add({ broken: { cs: 'Rozbitá {zpráva' } });
  eq(I.t('broken'), 'Rozbitá {zpráva', 'a broken message shows as written');
  eq(I.has('moves'), true, 'has()');
}

/* ---------- Other languages and the fallback ---------- */
{
  const { I } = runtime({ search: '?menu&lang=en' });
  eq(I.lang, 'en', '?lang=en (allowed for development even when not ready)');
  I.add({ moves: { cs: '{n, plural, one {# tah} few {# tahy} many {# tahu} other {# tahů}}', en: '{n, plural, one {# move} other {# moves}}' }, only: { cs: 'Jen česky {n}' }, empty: { cs: 'Prázdné', en: '' } });
  eq(I.t('moves', { n: 1 }), '1 move', 'en plural one');
  eq(I.t('moves', { n: 5000 }), '5,000 moves', 'en plural other, en grouping');
  eq(I.t('moves', { n: 1.5 }), '1.5 moves', 'en plural of a fraction');
  eq(I.t('only', { n: 1.5 }), 'Jen česky 1,5', 'no en: cs with cs number format');
  eq(I.t('empty'), 'Prázdné', 'an empty en counts as missing');
}
{
  eq(runtime({ search: '?lang=xx' }).I.lang, 'cs', 'an unknown ?lang is ignored');
  eq(runtime({ stored: 'en' }).I.lang, 'cs', 'a saved language that is not ready is ignored');
  eq(runtime({ langs: READY, stored: 'en', nav: { languages: ['cs-CZ'] } }).I.lang, 'en', 'the saved choice beats the phone');
  eq(runtime({ langs: READY, nav: { languages: ['en-US', 'cs'] } }).I.lang, 'en', 'the phone: the first ready language');
  eq(runtime({ langs: READY, nav: { languages: ['sk-SK', 'en'] } }).I.lang, 'cs', 'the phone: Slovak gets Czech');
  eq(runtime({ langs: READY, nav: { languages: ['de-DE', 'fr'] } }).I.lang, 'en', 'the phone: another language gets English when ready');
  eq(runtime({ nav: { languages: ['de-DE', 'en-GB'] } }).I.lang, 'cs', 'the phone: English not ready yet gives Czech');
  eq(runtime({ langs: READY, nav: { language: 'en-US' } }).I.lang, 'en', 'navigator.language when there is no list');
  const r = runtime({ langs: READY });
  eq(r.I.setLang('en'), true, 'setLang a ready language');
  eq(r.I.lang, 'en', 'setLang changes I18N.lang');
  eq(r.store.get('games.lang'), 'en', 'setLang saves games.lang');
  eq(runtime().I.setLang('en'), false, 'setLang refuses a language that is not ready');
  eq(runtime({ langs: READY }).I.langs.map(l => l.code).join(), 'cs,en', 'langs = the ready ones');
  eq(runtime().I.langs.map(l => l.code).join(), 'cs', 'langs without en while it is not ready');
}

/* ---------- Pseudo language ---------- */
{
  const { I } = runtime({ search: '?lang=pseudo' });
  eq(I.lang, 'pseudo', '?lang=pseudo');
  I.add({ m: { cs: 'Hraje <b>{name}</b> &amp; {n, plural, one {# tah} few {# tahy} many {# tahu} other {# tahů}}' } });
  const s = I.t('m', { name: 'Jarka', n: 3 });
  ok(s.startsWith('[') && s.endsWith(']'), 'pseudo is wrapped in [ ]');
  ok(s.includes('<b>Jarka</b>'), 'pseudo keeps the tags and the param value');
  ok(s.includes('&amp;'), 'pseudo keeps entities');
  ok(s.includes('3 ţáĥÿ'), 'pseudo keeps the plural working (cs rules) and changes its letters');
  ok(!/[a-z]{3}/.test(s.replace(/<[^>]*>|&\w+;|Jarka/g, '')), 'pseudo changes the letters');
  ok(/ ~{1,4}( ~{1,4})+]$/.test(s), 'pseudo is padded with short breakable groups of ~');
  I.add({ mk: { cs: 'Ťukni na [undo] a pak [check]' } });
  ok(I.t('mk').includes('[undo]') && I.t('mk').includes('[check]'), 'pseudo keeps picture markers');
}

/* ---------- Parser errors ---------- */
{
  const { I } = runtime();
  throws(() => I.parse('{n, plural, one {x}}'), 'a plural without other');
  throws(() => I.parse('Text {a'), 'an open brace');
  throws(() => I.parse('Text }'), 'a lone closing brace');
  throws(() => I.parse('{n, number}'), 'an unknown type');
  throws(() => I.parse('{x, select, a {1} a {2} other {3}}'), 'a case twice');
  eq(JSON.stringify(I.parse('A # B')), '["A # B"]', '# outside a plural is plain text');
}

/* ---------- apply() on a small fake page ---------- */
{
  const el = attrs => ({ nodeType: 1, attrs: Object.assign({}, attrs), textContent: 'x', innerHTML: 'x',
    getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; }, hasAttribute(k) { return k in this.attrs; } });
  const a = el({ 'data-t': 'k.text' }), b = el({ 'data-t-html': 'k.html' }), c = el({ 'data-t-aria': 'k.text' }), d = el({ 'data-t-title': 'k.text' });
  const all = [a, b, c, d], html = { lang: '' };
  const document = { documentElement: html, querySelectorAll: sel => all.filter(e => e.hasAttribute(sel.slice(1, -1))) };
  const { I } = runtime({ document, search: '?lang=en' });
  I.add({ 'k.text': { cs: 'Ahoj', en: 'Hello' }, 'k.html': { cs: '<b>Ahoj</b>' } });
  I.apply();
  eq(a.textContent, 'Hello', 'apply: data-t');
  eq(b.innerHTML, '<b>Ahoj</b>', 'apply: data-t-html (falls back to cs)');
  eq(c.attrs['aria-label'], 'Hello', 'apply: data-t-aria');
  eq(d.attrs.title, 'Hello', 'apply: data-t-title');
  eq(html.lang, 'en', 'apply: <html lang>');
  const { I: J } = runtime(); J.apply(); // no document: nothing happens, nothing throws
  passed++;
}

/* ---------- The detector of text written in the code ---------- */
{
  const page = body => `<!doctype html><html><body>${body}</body></html>`;
  const n = (src, isScript = false) => tool.hardCoded(src, isScript).length;
  eq(n(page('<button>Nová hra</button>')), 1, 'detector: a Czech HTML text');
  eq(n(page('<button>Hra</button>')), 1, 'detector: a common Czech word without diacritics');
  eq(n(page('<button data-t="common.newGame"></button>')), 0, 'detector: data-t is fine');
  eq(n(page('<a aria-label="Zpět na výběr her"></a>')), 1, 'detector: a Czech aria-label');
  eq(n(page('<!-- Nová hra --><style>.x{content:"Zpět"}</style>')), 0, 'detector: comments and styles are skipped');
  eq(n(page('<script>toast("Zatím není co vrátit");</script>')), 1, 'detector: a Czech JS string');
  eq(n(page('<script>toast("Zatím není co vrátit"); // i18n-ignore</script>')), 0, 'detector: i18n-ignore');
  eq(n(page('<script>// Nová hra\n/* Zpět */ const re = /[ěš]/g; x = a / b / c;</script>')), 0, 'detector: JS comments and regular expressions are skipped');
  eq(n(page('<script>const ID = "kostky"; const k = "games.kostky.state"; t("kostky.title");</script>')), 0, 'detector: ids and keys are not texts');
  eq(n(page('<script>x.innerHTML = `<b data-t="hra.title"></b>${t("a.b")}`;</script>')), 0, 'detector: keys inside a template');
  eq(n(page('<script>x.innerHTML = `<h3>Hra</h3>`;</script>')), 1, 'detector: a word inside a template');
  eq(n(page('<script>x.innerHTML = `${ok ? "Výborně" : t("a")}`;</script>')), 1, 'detector: a string inside ${}');
  eq(n(page('<script>const s = `http://x/${a}//y`; toast("Nová hra");</script>')), 1, 'detector: // inside a string is not a comment');
  eq(n('const a = "Nová hra";\nconst b = I18N.t("x");', true), 1, 'detector: a script file');
  const u = tool.keysUsed(page('<b data-t="a.b"></b><script>t("c.d"); th(`e.${x}`); I18N.t(\'f.g\'); const T = [{ nameKey: \'h.i\' }];</script>'), false);
  eq([...u.exact].sort().join(), 'a.b,c.d,f.g,h.i', 'keys used: exact');
  eq([...u.prefixes].join(), 'e.', 'keys used: a template key is a prefix');
}

/* ---------- A missing param is reported; the checks of param names, key prefixes and text sinks ---------- */
{
  const { I, errors } = runtime();
  I.add({ 'x.a': { cs: 'Ahoj {name}' } });
  eq(I.t('x.a', {}), 'Ahoj {name}', 'missing param: printed as written');
  ok(errors.some(e => /missing param name for x\.a/.test(e)), 'missing param: reported on the console');
  eq(I.t('x.a', { name: 'Eva' }), 'Ahoj Eva', 'missing param: a passed one is fine');
  const keys = c => [...tool.objectKeys(c, c.indexOf('{'))].sort().join();
  eq(keys('t("k", { a, b: 1, "c": f(x, { z: 1 }), d: [1, { y: 2 }], e: `${q}, g: 1` })'), 'a,b,c,d,e', 'objectKeys: shorthand, nested and templates');
  eq(tool.objectKeys('t("k", { ...p, a })', 8), null, 'objectKeys: a spread cannot be told');
  const ids = [...tool.messages()].filter(([k, d]) => /\{[a-z]+\}/.test(d.msg.cs)).map(([k]) => k);
  ok(ids.length, 'a message with a param exists');
  const k = ids[0];
  const code = c => ({ file: 'x', owner: 'shared', isScript: true, src: c });
  ok(tool.codeErrors(code(`t('${k}', { zzz: 1 });`)).some(e => /does not pass/.test(e)), 'params: a missing one is an error');
  const need = [...new Set([...tool.messages().get(k).msg.cs.matchAll(/\{(\w+)\}/g)].map(m => m[1]))];
  eq(tool.codeErrors(code(`t('${k}', { ${need.join(', ')} });`)).length, 0, 'params: shorthand names that match are fine');
  eq(tool.codeErrors(code(`t('${k}', p);`)).length, 0, 'params: a non-literal second argument is skipped');
  ok(tool.codeErrors(code('t(`nonexistent.prefix.${y}`);')).some(e => /match no defined key/.test(e)), 'prefix: no defined key is an error');
  eq(tool.codeErrors(code('t(`common.${y}`);')).length, 0, 'prefix: a defined one is fine');
  const h = (s, isScript = true) => tool.hardCoded(s, isScript).length;
  eq(h('toast("Hello there friend");'), 1, 'sink: toast with English words');
  eq(h('toast("OK");'), 0, 'sink: one short word is not a text');
  eq(h('toast(t("a.b"));'), 0, 'sink: a message is fine');
  eq(h('el.textContent = "Move one";'), 1, 'sink: textContent');
  eq(h('el.innerHTML = `<b class="x">Move one</b>`;'), 1, 'sink: innerHTML');
  eq(h('el.innerHTML = `<svg viewBox="0 0 1 1"></svg>`;'), 0, 'sink: markup is not a text');
  eq(h('el.textContent = `.a{color:red}`;'), 0, 'sink: CSS is not a text');
  eq(h(['function hintText() {', '  if (a) {', '    return "Tap a card";', '  }', '}'].join('\n')), 1, 'sink: return of a *hint* function');
  eq(h(['function other() {', '  return "Tap a card";', '}'].join('\n')), 0, 'sink: return of another function is not checked');
  eq(h('toast("Move one"); // i18n-ignore'), 0, 'sink: i18n-ignore');
  eq(h('<title data-t="a.b">Dáma</title>', false), 0, 'title: the fallback inside <title data-t> is exempt');
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
