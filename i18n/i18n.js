// Texts and languages: the runtime every game and the launcher load (CLAUDE.md, Texts and languages).
// Plain script, no libraries: it sets globalThis.I18N and works in a page (also from file://) and in a Node vm.
// Load order: i18n/languages.js, this file, then the texts (i18n/common.js, i18n/games.js, the game's texts.js).
//
//   I18N.add({ key: { cs, en?, note? } })  merge messages (cs is the source and always required)
//   I18N.t(key, params)                    plain text (for textContent, attributes, toasts)
//   I18N.th(key, params)                   HTML: the message is trusted HTML, every param value is escaped
//                                          (use it for everything that goes into innerHTML)
//   I18N.num(n)                            a number in the player's language (cs: "5 000")
//   I18N.apply(root = document)            fills [data-t] (text), [data-t-html] (HTML), [data-t-aria] (aria-label),
//                                          [data-t-title] (title) and sets <html lang>
//   I18N.lang, I18N.langs, I18N.setLang(code)
//
// Messages use a subset of ICU MessageFormat: {name}, {n, plural, =0 {…} one {…} few {…} many {…} other {…}}
// with # = the number, {x, select, a {…} other {…}} (booleans select as true / false), nested freely.
// Deviation from ICU: braces are the only special characters; an apostrophe is always a plain apostrophe
// (ICU would use it for quoting), and # is special only inside a plural. A number param is formatted with
// Intl.NumberFormat (pass a string to keep it as written, e.g. a year).
// Rule for every text: whole sentences with params, never a sentence built from pieces (Czech has cases).
(() => {
  'use strict';
  const G = globalThis;
  const SOURCE = 'cs', STORE = 'games.lang', PSEUDO = 'pseudo';
  const LANGS = Array.isArray(G.LANGS) && G.LANGS.length ? G.LANGS : [{ code: SOURCE, name: 'Čeština', ready: true }];
  const ready = LANGS.filter(l => l && l.ready);
  const isReady = c => ready.some(l => l.code === c);
  const known = c => c === PSEUDO || LANGS.some(l => l && l.code === c);
  const messages = Object.create(null);
  const reported = new Set();
  const complain = msg => { if (reported.has(msg)) return; reported.add(msg); try { console.error('I18N: ' + msg); } catch (e) {} };

  /* ---------- Which language ---------- */
  // ?lang=xx (any language of LANGS, or pseudo; never saved) > the player's choice > the phone's languages > en > cs
  function pick() {
    try { const m = /[?&]lang=([\w-]+)/.exec((G.location && G.location.search) || ''); if (m && known(m[1])) return m[1]; } catch (e) {}
    try { const s = G.localStorage && G.localStorage.getItem(STORE); if (s && isReady(s)) return s; } catch (e) {}
    try {
      const nav = G.navigator || {};
      const list = nav.languages && nav.languages.length ? nav.languages : [nav.language];
      for (const tag of list) {
        const p = String(tag || '').toLowerCase().split(/[-_]/)[0];
        const c = p === 'sk' ? 'cs' : p; // Slovak readers get Czech
        if (isReady(c)) return c;
      }
    } catch (e) {}
    return isReady('en') ? 'en' : SOURCE;
  }

  /* ---------- Parsing (cached) ---------- */
  const HASH = { k: 'hash' };
  function parse(src) {
    let i = 0;
    const fail = why => { throw new Error(`${why} at ${i} in "${src}"`); };
    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    const word = () => { const m = /^[^\s{},]+/.exec(src.slice(i)); if (!m) fail('expected a name'); i += m[0].length; return m[0]; };
    function nodes(inPlural, nested) {
      const out = []; let text = '';
      const flush = () => { if (text) { out.push(text); text = ''; } };
      while (i < src.length) {
        const c = src[i];
        if (c === '{') { flush(); out.push(arg(inPlural)); continue; }
        if (c === '}') { if (!nested) fail('unexpected }'); break; }
        if (c === '#' && inPlural) { flush(); out.push(HASH); i++; continue; }
        text += c; i++;
      }
      if (nested && src[i] !== '}') fail('missing }');
      flush();
      return out;
    }
    function arg(inPlural) {
      i++; ws(); const name = word(); ws();
      if (src[i] === '}') { i++; return { k: 'arg', name }; }
      if (src[i] !== ',') fail('expected , or }');
      i++; ws(); const type = word(); ws();
      if (type !== 'plural' && type !== 'select') fail(`unknown type "${type}"`);
      if (src[i] !== ',') fail('expected ,');
      i++;
      const cases = Object.create(null);
      for (;;) {
        ws();
        if (i >= src.length) fail('missing }');
        if (src[i] === '}') { i++; break; }
        const key = word(); ws();
        if (src[i] !== '{') fail(`expected { after "${key}"`);
        if (key in cases) fail(`case "${key}" twice`);
        i++; cases[key] = nodes(inPlural || type === 'plural', true); i++;
      }
      if (!cases.other) fail(`${type} without "other"`);
      return { k: type, name, cases };
    }
    return nodes(false, false);
  }
  const parsed = new Map();
  function ast(src) {
    let a = parsed.get(src);
    if (!a) {
      try { a = parse(src); } catch (e) { complain(e.message); a = [src]; } // a broken message shows as written
      parsed.set(src, a);
    }
    return a;
  }

  /* ---------- Formatting ---------- */
  const intl = new Map();
  const cached = (kind, lang, make) => { const k = kind + lang; if (!intl.has(k)) { let v = null; try { v = make(); } catch (e) {} intl.set(k, v); } return intl.get(k); };
  const rulesLang = l => (l === PSEUDO ? SOURCE : l);
  function num(n, lang = I18N.lang) {
    const f = cached('n', rulesLang(lang), () => new Intl.NumberFormat(rulesLang(lang)));
    return f ? f.format(n) : String(n);
  }
  function category(lang, x) {
    if (!isFinite(x)) return 'other';
    const r = cached('p', rulesLang(lang), () => new Intl.PluralRules(rulesLang(lang)));
    return r ? r.select(x) : x === 1 ? 'one' : 'other';
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function format(nodes, params, lang, escape, n) {
    let s = '';
    for (const x of nodes) {
      if (typeof x === 'string') { s += x; continue; }
      if (x.k === 'hash') { s += n === undefined ? '#' : num(n, lang); continue; }
      const v = params ? params[x.name] : undefined;
      if ((v === undefined || v === null) && format.key) complain(`missing param ${x.name} for ${format.key}`);
      if (x.k === 'arg') s += v === undefined || v === null ? `{${x.name}}` : typeof v === 'number' ? num(v, lang) : escape(String(v));
      else if (x.k === 'plural') { const q = Number(v); s += format(x.cases['=' + q] || x.cases[category(lang, q)] || x.cases.other, params, lang, escape, q); }
      else s += format(x.cases[String(v)] || x.cases.other, params, lang, escape, n);
    }
    return s;
  }

  /* ---------- Pseudo language (development: ?lang=pseudo) ---------- */
  // the Czech text with look-alike letters, in [ ] and about 40 % longer: a screenshot shows every text that does
  // not come from the messages, and what does not fit; placeholders, HTML tags and entities stay as they are
  const LOOK = { a: 'á', b: 'ƀ', c: 'ç', d: 'ď', e: 'ê', g: 'ĝ', h: 'ĥ', i: 'î', k: 'ķ', l: 'ľ', n: 'ñ', o: 'ö', r: 'ŕ', s: 'ş', t: 'ţ', u: 'ü', w: 'ŵ', y: 'ÿ', z: 'ž',
    A: 'Å', C: 'Ç', D: 'Ď', E: 'Ê', G: 'Ĝ', H: 'Ĥ', I: 'Î', K: 'Ķ', L: 'Ľ', N: 'Ñ', O: 'Ö', R: 'Ŕ', S: 'Ş', T: 'Ţ', U: 'Ü', W: 'Ŵ', Y: 'Ý', Z: 'Ž' };
  // a game's own picture markers in a message ("[undo]", replaced by an icon after t()/th()) stay as they are
  const pseudoText = s => s.replace(/<[^>]*>|&[#\w]+;|\[[a-z]+\]|[^<&[]+|\[/g, m => (m[0] === '<' || m[0] === '&' || /^\[[a-z]+\]$/.test(m) ? m : m.replace(/[A-Za-z]/g, c => LOOK[c] || c)));
  const pseudoNodes = nodes => nodes.map(x => typeof x === 'string' ? pseudoText(x)
    : x.cases ? Object.assign({}, x, { cases: Object.fromEntries(Object.entries(x.cases).map(([k, v]) => [k, pseudoNodes(v)])) }) : x);
  const pseudoCache = new Map();
  function pseudo(src, params, escape) {
    if (!pseudoCache.has(src)) pseudoCache.set(src, pseudoNodes(ast(src)));
    const s = format(pseudoCache.get(src), params, SOURCE, escape);
    // the padding is short words ("~~~~ ~~"), so it wraps like real longer text instead of one unbreakable block
    const n = Math.max(1, Math.round(s.replace(/<[^>]*>|&[#\w]+;/g, '').length * 0.4));
    const pad = n < 4 ? '~'.repeat(n) : ' ' + ('~~~~ '.repeat(Math.ceil(n / 5))).slice(0, n - 1).trim();
    return '[' + s + pad + ']';
  }

  /* ---------- Messages ---------- */
  function add(obj) {
    for (const k of Object.keys(obj || {})) {
      if (k in messages) { complain(`duplicate key ${k}`); continue; } // tools/i18n.js reports it as an error
      messages[k] = obj[k];
    }
  }
  // a message in the player's language, else Czech, else the key itself (so a missing text is easy to spot)
  function text(key, params, escape) {
    const m = messages[key];
    if (!m || typeof m[SOURCE] !== 'string') { complain(`missing key ${key}`); return String(key); }
    const lang = I18N.lang;
    format.key = key; // for the warning about a missing param
    try {
      if (lang === PSEUDO) return pseudo(m[SOURCE], params, escape);
      const own = typeof m[lang] === 'string' && m[lang] !== '';
      return format(ast(own ? m[lang] : m[SOURCE]), params, own ? lang : SOURCE, escape);
    } finally { format.key = ''; }
  }
  const t = (key, params) => text(key, params, String);
  const th = (key, params) => text(key, params, esc);

  /* ---------- Static HTML ---------- */
  function apply(root) {
    const doc = G.document;
    root = root || doc;
    if (!root || typeof root.querySelectorAll !== 'function') return;
    const each = (attr, fn) => {
      const list = Array.from(root.querySelectorAll(`[${attr}]`));
      if (root.nodeType === 1 && root.hasAttribute(attr)) list.unshift(root);
      for (const el of list) fn(el, el.getAttribute(attr));
    };
    each('data-t', (el, k) => { el.textContent = t(k); });
    each('data-t-html', (el, k) => { el.innerHTML = th(k); });
    each('data-t-aria', (el, k) => { el.setAttribute('aria-label', t(k)); });
    each('data-t-title', (el, k) => { el.setAttribute('title', t(k)); });
    try { if (doc && doc.documentElement) doc.documentElement.lang = rulesLang(I18N.lang); } catch (e) {}
    fitTitles();
  }

  /* ---------- The game name in the top bar always fits ---------- */
  // The <h1> may wrap only between words; a name in another language can hold a word longer than the room
  // between the bar's buttons ("Draughts", "Nonograms"). Then its font gets smaller until the word fits
  // (the game's own CSS size stays the start; nothing changes for a name that fits). Again on every resize.
  let fitHooked = false;
  function fitTitles() {
    const doc = G.document;
    if (!doc || typeof doc.querySelectorAll !== 'function' || typeof G.getComputedStyle !== 'function') return;
    try {
      for (const h of doc.querySelectorAll('.topbar h1')) {
        h.style.fontSize = '';
        let size = parseFloat(G.getComputedStyle(h).fontSize) || 0;
        while (size > 12 && h.scrollWidth > h.clientWidth + 1) { size -= 1; h.style.fontSize = size + 'px'; }
      }
      if (!fitHooked && typeof G.addEventListener === 'function') {
        fitHooked = true;
        let queued = false;
        const again = () => { if (queued) return; queued = true; G.requestAnimationFrame(() => { queued = false; fitTitles(); }); };
        G.addEventListener('resize', again);
        if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(again, () => {});
      }
    } catch (e) {}
  }

  function setLang(code) {
    if (!isReady(code)) return false;
    I18N.lang = code;
    try { G.localStorage.setItem(STORE, code); } catch (e) {}
    return true;
  }

  const I18N = {
    lang: SOURCE, langs: ready, source: SOURCE,
    add, t, th, num: n => num(n), esc, apply, setLang,
    has: key => key in messages,
    // one message in one language (undefined when there is none): for translating saved data between languages
    msg: (key, lang) => { const m = messages[key]; return m && typeof m[lang] === 'string' ? m[lang] : undefined; },
    // for tools/i18n.js: the parser and the formatter of one message text
    parse, format: (src, params, lang = SOURCE, html = false) => format(ast(src), params, lang, html ? esc : String),
  };
  I18N.lang = pick();
  G.I18N = I18N;
})();
