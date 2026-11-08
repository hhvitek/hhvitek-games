// Shared look of the card games (Solitér, FreeCell, Pyramida, Pavouk): table themes, card faces and backs,
// the pictures in the middle of the cards and the appearance part of their settings.
// Load it after images/sets.js:  <script src="../_cards/cards.js"></script>
// It adds its CSS and the suit symbols (#s0–#s3) to the page and sets globalThis.CARDS.
// Cards here are described by suit (0 ♠, 1 ♥, 2 ♣, 3 ♦; odd = red) and rank (1 = ace … 13 = king).
// Game-specific sizes (.ix corner index, .art picture box, highlights) stay in each game.
(() => {
'use strict';
// The shared CSS goes first in <head>, so the game's own rules (.cd.sel, .cd.drag, sizes) come later and win
const addStyle = id => { const el = document.createElement('style'); el.id = id; document.head.prepend(el); return el; };

/* ---------- CSS ---------- */
addStyle('cards-css').textContent = `
.fnote a{color:inherit;text-decoration:underline}
/* ---------- Table themes (solid colour + subtle texture) ---------- */
[data-table="green"]{--tbl:#1e7135;--ink:#fff;--bar:rgba(0,0,0,.2);--line:rgba(255,255,255,.2);--slot:rgba(255,255,255,.38);--slot-bg:rgba(0,0,0,.1);--btn:rgba(255,255,255,.14);--btn-ink:#fff;--accent:#ffd54a;--accent-ink:#2a2000}
[data-table="blue"]{--tbl:#1c5687;--ink:#fff;--bar:rgba(0,0,0,.2);--line:rgba(255,255,255,.2);--slot:rgba(255,255,255,.38);--slot-bg:rgba(0,0,0,.1);--btn:rgba(255,255,255,.14);--btn-ink:#fff;--accent:#ffd54a;--accent-ink:#2a2000}
[data-table="wine"]{--tbl:#6e1f2c;--ink:#fff;--bar:rgba(0,0,0,.22);--line:rgba(255,255,255,.2);--slot:rgba(255,255,255,.38);--slot-bg:rgba(0,0,0,.12);--btn:rgba(255,255,255,.14);--btn-ink:#fff;--accent:#ffd54a;--accent-ink:#2a2000}
[data-table="wood"]{--tbl:#6a4327;--ink:#fff;--bar:rgba(0,0,0,.22);--line:rgba(255,255,255,.18);--slot:rgba(255,255,255,.36);--slot-bg:rgba(0,0,0,.12);--btn:rgba(255,255,255,.14);--btn-ink:#fff;--accent:#ffd54a;--accent-ink:#2a2000}
[data-table="slate"]{--tbl:#36404a;--ink:#fff;--bar:rgba(0,0,0,.22);--line:rgba(255,255,255,.18);--slot:rgba(255,255,255,.36);--slot-bg:rgba(0,0,0,.12);--btn:rgba(255,255,255,.13);--btn-ink:#fff;--accent:#ffcf5a;--accent-ink:#2a2000}
[data-table="sand"]{--tbl:#d9c8a2;--ink:#2e2412;--bar:rgba(80,55,10,.1);--line:rgba(80,55,10,.22);--slot:rgba(70,50,15,.42);--slot-bg:rgba(80,55,10,.08);--btn:rgba(255,255,255,.5);--btn-ink:#2e2412;--accent:#e06a00;--accent-ink:#fff}
/* paper: the launcher's palette; white buttons like the launcher's rows, the brown accent marks "on" and the selected card; face-up cards get a brown outline so they never dissolve into the light table */
[data-table="paper"]{--tbl:#f4ebdf;--ink:#2b1a0e;--bar:rgba(122,69,32,.08);--line:#e6d8c6;--slot:rgba(122,69,32,.42);--slot-bg:rgba(122,69,32,.06);--btn:#fff;--btn-ink:#2b1a0e;--accent:#7a4520;--accent-ink:#fff;--up-sh:0 0 0 1px rgba(90,50,20,.22),0 1px 4px rgba(60,30,10,.3)}
[data-table="night"]{--tbl:#111316;--ink:#e8eaed;--bar:rgba(255,255,255,.04);--line:rgba(255,255,255,.12);--slot:rgba(255,255,255,.28);--slot-bg:rgba(255,255,255,.03);--btn:rgba(255,255,255,.09);--btn-ink:#e8eaed;--accent:#6fb7ff;--accent-ink:#0a1a2a}
:root{--tex:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .16 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
[data-table]{--grain:none} /* only the wood table has grain (also in the settings swatches) */
html[data-table="paper"],[data-table="paper"]{--tex:none} /* the paper table is flat like the launcher (html[…] beats :root) */
[data-table="wood"]{--grain:repeating-linear-gradient(90deg,rgba(0,0,0,.05) 0 2px,transparent 2px 13px,rgba(255,255,255,.025) 13px 15px,transparent 15px 29px)}

/* ---------- Card faces ---------- */
[data-face="white"]{--fc:#fff;--fc-edge:#8f8f8f;--fc-bw:1px;--red:#d0101c;--blk:#151515;--fw:800}
[data-face="cream"]{--fc:#fbf5e4;--fc-edge:#a8996f;--fc-bw:1px;--red:#b8121f;--blk:#251d12;--fw:800}
[data-face="contrast"]{--fc:#fff;--fc-edge:#000;--fc-bw:2px;--red:#e60000;--blk:#000;--fw:900}

/* ---------- Cards ---------- */
.cd{position:absolute;left:0;top:0;width:var(--cw);height:var(--ch);border-radius:calc(var(--cw)*.1);transition:transform .24s ease;color:var(--blk);
  background:var(--bk-bg);border:calc(var(--cw)*.06) solid var(--bk-edge);box-shadow:0 0 0 1px rgba(0,0,0,.3),0 1px 3px rgba(0,0,0,.35)}
.cd.r{color:var(--red)}
.cd.up{background:var(--fc);border:var(--fc-bw) solid var(--fc-edge);box-shadow:var(--up-sh,0 1px 3px rgba(0,0,0,.35))}
.cd .fc{display:none;position:absolute;inset:0;pointer-events:none}
.cd.up .fc{display:block}
.art svg{display:block;width:100%;height:100%;fill:currentColor;overflow:visible}
.art .w{fill:var(--fc)}
.art .st{fill:none;stroke:currentColor;stroke-width:6;stroke-linecap:round;stroke-linejoin:round}
.art .wst{fill:none;stroke:var(--fc);stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
.art .hd{fill:var(--fc);stroke:currentColor;stroke-width:5}
.art .lt{font:700 92px Georgia,"Times New Roman",serif;fill:currentColor}
`;
// suit symbols used by <use href="#s0"> … "#s3"
document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <symbol id="s0" viewBox="0 0 100 100"><path d="M50 4C40 22 8 38 8 62c0 15 11 24 23 24 8 0 14-4 17-9-1 9-5 15-12 19h28c-7-4-11-10-12-19 3 5 9 9 17 9 12 0 23-9 23-24C92 38 60 22 50 4z"/></symbol>
    <symbol id="s1" viewBox="0 0 100 100"><path d="M50 92C22 70 6 54 6 32 6 17 17 7 30 7c9 0 16 5 20 13 4-8 11-13 20-13 13 0 24 10 24 25 0 22-16 38-44 60z"/></symbol>
    <symbol id="s2" viewBox="0 0 100 100"><circle cx="50" cy="28" r="20"/><circle cx="27" cy="59" r="20"/><circle cx="73" cy="59" r="20"/><path d="M44 36h12v28H44z"/><path d="M47 60c-1 15-5 26-13 34h32c-8-8-12-19-13-34z"/></symbol>
    <symbol id="s3" viewBox="0 0 100 100"><path d="M50 3 87 50 50 97 13 50z"/></symbol>
  </defs>
</svg>`);

const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/* ---------- Appearance ---------- */
const TABLES = [
  { id: 'green', name: 'Zelené sukno', meta: '#1e7135' },
  { id: 'blue',  name: 'Modré sukno',  meta: '#1c5687' },
  { id: 'wine',  name: 'Vínová',       meta: '#6e1f2c' },
  { id: 'wood',  name: 'Dřevo',        meta: '#6a4327' },
  { id: 'slate', name: 'Břidlice',     meta: '#36404a' },
  { id: 'sand',  name: 'Písková',      meta: '#d9c8a2' },
  { id: 'paper', name: 'Papír',        meta: '#f4ebdf' },
  { id: 'night', name: 'Noc',          meta: '#111316' },
];
const svgURI = s => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140">${s}</svg>`)}")`;
const HATCH = 'repeating-linear-gradient(45deg,rgba(255,255,255,.24) 0 1.5px,transparent 1.5px 6px),repeating-linear-gradient(-45deg,rgba(255,255,255,.24) 0 1.5px,transparent 1.5px 6px)';
const ART_BACKS = {
  cat: `<path d="M24 74 27 34 49 54zM76 74 73 34 51 54z" fill="#f6b26b" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="50" cy="78" r="30" fill="#f6b26b" stroke="#fff" stroke-width="5"/>
    <ellipse cx="39" cy="73" rx="4.5" ry="7" fill="#3a2410"/><ellipse cx="61" cy="73" rx="4.5" ry="7" fill="#3a2410"/>
    <path d="M45 84h10l-5 6z" fill="#e8577a"/>
    <path d="M50 90q-6 8-12 3M50 90q6 8 12 3M14 82l20 2M14 92l20-3M86 82l-20 2M86 92l-20-3" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  sun: `<g stroke="#ffe27a" stroke-width="6" stroke-linecap="round"><path d="M50 22v12M50 106v12M10 70h12M78 70h12M22 42l8 8M70 90l8 8M78 42l-8 8M30 90l-8 8"/></g>
    <circle cx="50" cy="70" r="24" fill="#ffd23f" stroke="#fff" stroke-width="4"/>
    <circle cx="42" cy="65" r="3.5" fill="#5a3a00"/><circle cx="58" cy="65" r="3.5" fill="#5a3a00"/>
    <path d="M40 76q10 10 20 0" fill="none" stroke="#5a3a00" stroke-width="3.5" stroke-linecap="round"/>`,
  flower: `<path d="M50 84v44M50 112q-18-4-22-18q18 0 22 18M50 104q16-4 20-16q-16 0-20 16" fill="#9be08a" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
    <g fill="#fff"><circle cx="50" cy="44" r="13"/><circle cx="68" cy="56" r="13"/><circle cx="62" cy="77" r="13"/><circle cx="38" cy="77" r="13"/><circle cx="32" cy="56" r="13"/></g>
    <circle cx="50" cy="62" r="11" fill="#ffd23f"/>`,
  fish: `<path d="M74 70 94 54v32z" fill="#ffb02e" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
    <ellipse cx="46" cy="70" rx="32" ry="20" fill="#ffb02e" stroke="#fff" stroke-width="4"/>
    <path d="M40 54q8 16 0 32" fill="none" stroke="#fff" stroke-width="3"/>
    <circle cx="26" cy="64" r="4.5" fill="#123"/><path d="M15 76q5 3 9 0" fill="none" stroke="#123" stroke-width="2.5" stroke-linecap="round"/>
    <g fill="none" stroke="#fff" stroke-width="3"><circle cx="22" cy="36" r="5"/><circle cx="32" cy="24" r="3.5"/><circle cx="26" cy="14" r="2.5"/></g>`,
};
const BACKS = [
  { id: 'blue',   name: 'Modrá mřížka',    bg: `${HATCH},#1f4fa8` },
  { id: 'red',    name: 'Červená mřížka',  bg: `${HATCH},#b3202a` },
  { id: 'green',  name: 'Zelené puntíky',  bg: 'radial-gradient(circle,rgba(255,255,255,.36) 0 1.7px,transparent 2.3px) 0 0/7px 7px,#22764a' },
  { id: 'purple', name: 'Fialové kostky',  bg: 'linear-gradient(45deg,rgba(255,255,255,.17) 25%,transparent 25% 75%,rgba(255,255,255,.17) 75%) 0 0/10px 10px,linear-gradient(45deg,rgba(255,255,255,.17) 25%,transparent 25% 75%,rgba(255,255,255,.17) 75%) 5px 5px/10px 10px,#5b3a8e' },
  { id: 'brown',  name: 'Hnědé proužky',   bg: 'repeating-linear-gradient(90deg,rgba(255,255,255,.18) 0 2px,transparent 2px 6px),#8a5a1f', edge: '#f6ecd8' },
  { id: 'cat',    name: 'Kočička',   bg: `${svgURI(ART_BACKS.cat)} center/92% no-repeat,#e0762b` },
  { id: 'sun',    name: 'Sluníčko',  bg: `${svgURI(ART_BACKS.sun)} center/92% no-repeat,#3d8fd8` },
  { id: 'flower', name: 'Kytička',   bg: `${svgURI(ART_BACKS.flower)} center/92% no-repeat,#3c9a5a` },
  { id: 'fish',   name: 'Rybička',   bg: `${svgURI(ART_BACKS.fish)} center/92% no-repeat,#1b8796` },
];
// Picture backs from the shared images/ (only when images/sets.js is available); listed first
const IMG = globalThis.IMAGE_SETS || {};
const CASTLE = IMG.nachod && IMG.nachod.items[0], COAT = IMG.coats && IMG.coats.items[0];
// author, license and a link to the source of a card-back picture (the images must name their authors)
const escHTML = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const credit = (what, it) => `${what}: ${escHTML(it.author)}, ${escHTML(it.license)}, <a href="${escHTML(it.source)}" target="_blank" rel="noopener">zdroj</a>`;
if (COAT) BACKS.unshift({ id: 'nachod-coat', name: 'Erb Náchoda', bg: `url("../../images/${COAT.file}") center/88% no-repeat,#7a1f2b` });
if (CASTLE) BACKS.unshift({ id: 'nachod', name: 'Zámek Náchod', bg: `url("../../images/${CASTLE.file}") center/cover no-repeat,#4f7a4a` });
addStyle('cards-backs').textContent = BACKS.map(b => `[data-back="${b.id}"]{--bk-bg:${b.bg};--bk-edge:${b.edge || '#fff'}}`).join('\n');
const FACES = [
  { id: 'white',    name: 'Bílé' },
  { id: 'cream',    name: 'Krémové' },
  { id: 'contrast', name: 'Kontrastní' },
];

/* ---------- Pictures in the middle of cards (custom drawings, viewBox 0 0 100 120) ---------- */
const PICS = [
  { id: 'classic', name: 'Klasické',  desc: 'Velký symbol barvy, u kluka, dámy a krále písmeno.' },
  { id: 'stick',   name: 'Panďuláci', desc: 'Postavičky drží svou barvu. Kluk má kšiltovku, dáma korunku, král korunu a vousy.' },
  { id: 'animals', name: 'Zvířátka',  desc: 'Esa jsou sovičky, kluci pejsci, dámy kočičky a králové lvi. Čísla jsou broučci.' },
  { id: 'smile',   name: 'Smajlíci',  desc: 'Veselé obličeje. Kluk má kšiltovku, dáma mašli, král korunu.' },
];
const U = (s, x, y, w, cls = '') => `<use href="#s${s}" x="${x}" y="${y}" width="${w}" height="${w}"${cls ? ` class="${cls}"` : ''}/>`;
const FACE = [
  { e: [[38, 58], [62, 58]], m: 'M39 71Q50 81 61 71' },
  { e: [[35, 35], [65, 35]], m: 'M36 51Q50 63 64 51' },
  { e: [[42, 25], [58, 25]], m: 'M41 34Q50 42 59 34' },
  { e: [[40, 43], [60, 43]], m: 'M40 57Q50 66 60 57' },
];
function suitFace(s, x, y, w, bug) {
  const f = FACE[s], k = w / 100;
  const eyes = bug
    ? f.e.map(([a, b]) => `<circle class="w" cx="${a}" cy="${b}" r="8"/><circle cx="${a + 1.5}" cy="${b + 1.5}" r="3.6"/>`).join('')
    : f.e.map(([a, b]) => `<circle class="w" cx="${a}" cy="${b}" r="6"/>`).join('') + `<path class="wst" d="${f.m}"/>`;
  return `<g transform="translate(${x} ${y}) scale(${k})">${U(s, 0, 0, 100)}${eyes}</g>`;
}
const smallFace = (cx, cy, r) => `<circle cx="${cx - r * .36}" cy="${cy - r * .12}" r="${r * .13}"/><circle cx="${cx + r * .36}" cy="${cy - r * .12}" r="${r * .13}"/><path class="st" style="stroke-width:4" d="M${cx - r * .4} ${cy + r * .3}Q${cx} ${cy + r * .62} ${cx + r * .4} ${cy + r * .3}"/>`;
const whiteFace = (cx, cy, r) => `<circle class="w" cx="${cx - r * .36}" cy="${cy - r * .14}" r="${r * .13}"/><circle class="w" cx="${cx + r * .36}" cy="${cy - r * .14}" r="${r * .13}"/><path class="wst" d="M${cx - r * .45} ${cy + r * .28}Q${cx} ${cy + r * .7} ${cx + r * .45} ${cy + r * .28}"/>`;
const SHOULDERS = '<path class="st" d="M16 120Q50 92 84 120"/>';
const CROWN = (y) => `<path d="M26 ${y + 30}V${y + 4}l12 14 12-18 12 18 12-14v26z"/>`;

function artSVG(s, r, pic) {
  if (pic === 'stick') {
    if (r === 1) return `${U(s, 24, 0, 52)}<path class="st" d="M50 86v18M50 104l-12 15M50 104l12 15M50 90 30 46M50 90l20-44"/><circle class="hd" cx="50" cy="73" r="12"/>${smallFace(50, 73, 12)}`;
    if (r === 11) return `${SHOULDERS}<circle class="hd" cx="50" cy="64" r="30"/><path d="M19 60a31 31 0 0 1 62 0z"/><path d="M72 55h22a5 5 0 0 1 0 10H72z"/>${U(s, 42, 38, 16, 'w')}<circle cx="39" cy="70" r="4.5"/><circle cx="61" cy="70" r="4.5"/><path class="st" d="M36 81q14 15 28 0"/>`;
    if (r === 12) return `${SHOULDERS}<circle cx="50" cy="20" r="13"/><circle class="hd" cx="50" cy="66" r="28"/><path d="M20 72a30 30 0 0 1 60 0q-6-22-30-24-24 2-30 24z"/><path class="st" style="stroke-width:4" d="M36 40l5-11 9 8 9-8 5 11"/><circle cx="40" cy="68" r="4"/><circle cx="60" cy="68" r="4"/><path class="st" style="stroke-width:3" d="M34 62l-4-3M66 62l4-3"/><ellipse cx="50" cy="83" rx="7" ry="4"/><circle cx="21" cy="82" r="4"/><circle cx="79" cy="82" r="4"/>`;
    if (r === 13) return `${SHOULDERS}<circle class="hd" cx="50" cy="66" r="27"/>${CROWN(14)}<path d="M23 70q2 34 27 38 25-4 27-38-12 14-27 14T23 70z"/><ellipse class="w" cx="50" cy="90" rx="7" ry="4"/><path class="st" style="stroke-width:5" d="M38 82q12-6 24 0"/><circle cx="40" cy="64" r="4"/><circle cx="60" cy="64" r="4"/>`;
    return `<path class="st" d="M32 44v38M32 82l-11 33M32 82l11 33M32 56 16 38M32 56l22 10"/><circle class="hd" cx="32" cy="30" r="13"/>${smallFace(32, 30, 13)}${U(s, 50, 44, 44)}`;
  }
  if (pic === 'animals') {
    if (r === 1) return `<ellipse cx="50" cy="68" rx="34" ry="46"/><path d="M20 36 26 6l18 22zM80 36 74 6 56 28z"/><circle class="w" cx="36" cy="54" r="14"/><circle class="w" cx="64" cy="54" r="14"/><circle cx="38" cy="56" r="6.5"/><circle cx="62" cy="56" r="6.5"/><path class="w" d="M43 70h14l-7 12z"/><path class="wst" style="stroke-width:3.5" d="M36 94q4 5 8 0M46 100q4 5 8 0M56 94q4 5 8 0"/>`;
    if (r === 11) return `<ellipse cx="20" cy="66" rx="12" ry="28" transform="rotate(14 20 66)"/><ellipse cx="80" cy="66" rx="12" ry="28" transform="rotate(-14 80 66)"/><circle class="hd" cx="50" cy="62" r="30"/><circle cx="40" cy="56" r="4.5"/><circle cx="60" cy="56" r="4.5"/><ellipse cx="50" cy="72" rx="9" ry="6.5"/><path class="st" style="stroke-width:4" d="M50 78v6M40 86q10 8 20 0"/><path d="M45 90h10v8a5 5 0 0 1-10 0z" style="opacity:.55"/>`;
    if (r === 12) return `<path d="M22 52 24 14l26 22zM78 52 76 14 50 36z"/><circle class="hd" cx="50" cy="66" r="30"/><ellipse cx="39" cy="62" rx="4" ry="6.5"/><ellipse cx="61" cy="62" rx="4" ry="6.5"/><path d="M45 72h10l-5 6z"/><path class="st" style="stroke-width:3.5" d="M50 78q-6 8-12 3M50 78q6 8 12 3M6 68l24 3M6 80l24-3M94 68l-24 3M94 80l-24-3"/><path d="M62 30l14-8v16zM90 30l-14-8v16z"/><circle cx="76" cy="30" r="4"/>`;
    if (r === 13) return `${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => { const a = i * Math.PI / 6; return `<circle cx="${(50 + 36 * Math.cos(a)).toFixed(1)}" cy="${(64 + 36 * Math.sin(a)).toFixed(1)}" r="14"/>`; }).join('')}<circle cx="50" cy="64" r="38"/><circle class="hd" cx="50" cy="66" r="25"/><circle cx="41" cy="60" r="4"/><circle cx="59" cy="60" r="4"/><path d="M44 69h12l-6 7z"/><path class="st" style="stroke-width:4" d="M50 76v4M42 82q8 6 16 0"/>`;
    return `<path class="st" style="stroke-width:5" d="M38 104l-6 12M62 104l6 12"/>${suitFace(s, 18, 18, 64, true)}`;
  }
  if (pic === 'smile') {
    if (r === 1) return suitFace(s, 6, 12, 88);
    if (r === 11) return `<circle cx="50" cy="70" r="34"/><path class="hd" style="stroke-width:5" d="M16 62a34 34 0 0 1 68 0z"/><path d="M76 58h20a5 5 0 0 1 0 10H76z"/>${whiteFace(50, 80, 26)}`;
    if (r === 12) return `<path d="M50 30 24 16v28zM50 30l26-14v28z"/><circle cx="50" cy="30" r="7"/><circle cx="50" cy="76" r="33"/>${whiteFace(50, 78, 30)}<path class="wst" style="stroke-width:3" d="M28 66l-5-4M72 66l5-4"/>`;
    if (r === 13) return `${CROWN(6)}<circle cx="50" cy="78" r="34"/>${whiteFace(50, 80, 30)}`;
    return suitFace(s, 16, 22, 68);
  }
  // classic
  if (r === 1) return U(s, 10, 14, 80);
  if (r > 10) return `<text class="lt" x="50" y="102" text-anchor="middle">${RANK[r]}</text>`;
  return U(s, 22, 30, 56);
}
function faceHTML(s, r, pic) {
  return `<div class="fc"><div class="ix"><b${r === 10 ? ' class="t"' : ''}>${RANK[r]}</b><svg viewBox="0 0 100 100">${U(s, 0, 0, 100)}</svg></div>`
    + `<div class="art"><svg viewBox="0 0 100 120">${artSVG(s, r, pic)}</svg></div></div>`;
}

/* ---------- Settings: pictures, table, back and face (with sample cards drawn by the game) ---------- */
// tile(act, on, inner, name) and minis(pic, withBack) come from the game; backMini = size of the back samples;
// last = extra HTML at the end of the last section (e.g. the Vibrace switch).
function appearanceHTML(S, tile, minis, backMini, last = '') {
  return `<section class="card"><h3>Obrázky na kartách</h3>
      <div class="fnote" style="margin-top:0">Hodnota a barva v rohu karty zůstávají vždy stejné.</div>
      <div class="tiles">${PICS.map(p => tile('pic:' + p.id, S.pic === p.id, `<span class="swatch">${minis(p.id)}</span>`, p.name)).join('')}</div>
    </section>
    <section class="card"><h3>Stůl</h3>
      <div class="tiles">${TABLES.map(t => tile('table:' + t.id, S.table === t.id, `<span class="swatch" data-table="${t.id}">${minis(S.pic, true)}</span>`, t.name)).join('')}</div>
    </section>
    <section class="card"><h3>Rub karet</h3>
      <div class="tiles">${BACKS.map(b => tile('back:' + b.id, S.back === b.id, `<span class="swatch" data-back="${b.id}"><span class="mini" style="${backMini}"><div class="cd"></div><div class="cd"></div></span></span>`, b.name)).join('')}</div>
      ${CASTLE || COAT ? `<div class="fnote">${[CASTLE && credit('Fotka zámku Náchod', CASTLE), COAT && credit('Erb Náchoda', COAT)].filter(Boolean).join('<br>')}<br>Obrázky jsou z Wikimedia Commons.</div>` : ''}
    </section>
    <section class="card"><h3>Barva líce</h3>
      <div class="tiles">${FACES.map(f => tile('face:' + f.id, S.face === f.id, `<span class="swatch" data-face="${f.id}">${minis(S.pic)}</span>`, f.name)).join('')}</div>
      ${last}
    </section>`;
}
// Valid table / back / face / picture in the settings object (falls back to the game's defaults)
function normalizeLook(s, defaults) {
  const pick = (k, list) => { if (!list.includes(s[k])) s[k] = list.includes(defaults[k]) ? defaults[k] : list[0]; };
  pick('table', TABLES.map(t => t.id)); pick('back', BACKS.map(b => b.id)); pick('face', FACES.map(f => f.id)); pick('pic', PICS.map(p => p.id));
}
// Table, back and face of the settings on the page (CSS data attributes) and the browser bar colour
function applyLook(S) {
  const root = document.documentElement;
  root.dataset.table = S.table; root.dataset.back = S.back; root.dataset.face = S.face;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = TABLES.find(t => t.id === S.table).meta;
}

globalThis.CARDS = { TABLES, BACKS, FACES, PICS, CASTLE, COAT, artSVG, faceHTML, appearanceHTML, normalizeLook, applyLook };
})();
