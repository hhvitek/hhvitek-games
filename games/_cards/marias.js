// Mariáš cards (32 cards, the single-headed Czech look) for Prší and Oko bere: the suit signs, the pip cards with
// Roman numerals, the standing spodek and svršek, the king as a big crowned bust and the aces with one big sign.
// Load it after cards.js:  <script src="../_cards/marias.js"></script>  (cards.js gives the frame, faces and backs)
// It adds its CSS to the page and sets globalThis.MARIAS = { faceHTML, symSVG, artSVG }.
// card = number 0–31; suit = c >> 3 (0 srdce, 1 zelené/listy, 2 kule, 3 žaludy), rank = c & 7:
//   0 sedma, 1 osma, 2 devítka, 3 desítka, 4 spodek, 5 svršek, 6 král, 7 eso.
// No letters on the cards (user's decision): the number cards carry VII–X like real mariášky, the figures are told
// apart by the picture: the spodek holds his suit sign at his chest, the svršek holds it up above his head (both
// small standing men), the král is a big crowned head and shoulders, the eso is one big sign and nothing else.
// Every card shows its suit and rank in the top-left part, which stays visible in Prší's overlapping hand.
(() => {
'use strict';

/* ---------- CSS ---------- */
const st = document.createElement('style');
st.id = 'marias-css';
document.head.prepend(st);
st.textContent = `
[data-face]{--mzR:var(--red);--mzRd:#8c0d14;--mzG:#2e8b3a;--mzGd:#1d5e27;--mzY:#f2c02a;--mzO:#e0761c;--mzB:#2c5ba8;--mzBr:#8a5a2b;--mzOc:#d9a043;--mzS:#f7d6b4;--mzSt:#b4bcc6;--mzP:#7b3f8f;--mzW:var(--fc);--mzK:#2a2018;--mzHb:#6b4423;--mzHg:#cfc9bf;--mzHy:#e2b04a;
  --i0:var(--red);--i1:#1f6e2b;--i2:#b8400f;--i3:#6b4310}
[data-face="contrast"]{--mzG:#1d7a1d;--mzGd:#0b4a0b;--mzY:#f5b800;--mzO:#e05a00;--mzB:#1a49a0;--mzBr:#6e4214;--mzOc:#cf8a1c;--mzSt:#9aa4b0;--i1:#0b5a0b;--i2:#a33000;--i3:#4a2c08}
.mz{position:absolute;inset:0;display:block;width:100%;height:100%;overflow:visible}
.mz,.mzs{--mzw:max(1px,calc(var(--cw,60px)*.02))}
:is(.mz,.mzs) *{vector-effect:non-scaling-stroke;stroke:var(--blk);stroke-width:var(--mzw);stroke-linejoin:round;stroke-linecap:round}
:is(.mz,.mzs) .n{stroke:none}
:is(.mz,.mzs) .l{fill:none}
:is(.mz,.mzs) .t{stroke-width:max(.8px,calc(var(--mzw)*.7))}
:is(.mz,.mzs) .R{fill:var(--mzR)}:is(.mz,.mzs) .Rd{fill:var(--mzRd)}:is(.mz,.mzs) .G{fill:var(--mzG)}:is(.mz,.mzs) .Gd{fill:var(--mzGd)}
:is(.mz,.mzs) .Y{fill:var(--mzY)}:is(.mz,.mzs) .O{fill:var(--mzO)}:is(.mz,.mzs) .B{fill:var(--mzB)}:is(.mz,.mzs) .Br{fill:var(--mzBr)}
:is(.mz,.mzs) .Oc{fill:var(--mzOc)}:is(.mz,.mzs) .S{fill:var(--mzS)}:is(.mz,.mzs) .St{fill:var(--mzSt)}:is(.mz,.mzs) .P{fill:var(--mzP)}
:is(.mz,.mzs) .W{fill:var(--mzW)}:is(.mz,.mzs) .K{fill:var(--blk)}:is(.mz,.mzs) .Hk{fill:var(--mzK)}:is(.mz,.mzs) .Hb{fill:var(--mzHb)}
:is(.mz,.mzs) .Hg{fill:var(--mzHg)}:is(.mz,.mzs) .Hy{fill:var(--mzHy)}
.mz .rn{font:700 29px Georgia,"Times New Roman",serif;stroke:none;letter-spacing:-.5px}
[data-face="contrast"] .mz .rn{font-weight:900}
.mz .rn0{fill:var(--i0)}.mz .rn1{fill:var(--i1)}.mz .rn2{fill:var(--i2)}.mz .rn3{fill:var(--i3)}
`;

/* ---------- Suit signs (box 0 0 100 100) ---------- */
const SIGN = [
  // srdce: a red heart
  '<path class="R" d="M50 93C22 71 5 55 5 32 5 17 17 6 30 6c9 0 16 5 20 13 4-8 11-13 20-13 13 0 25 11 25 26 0 23-17 39-45 61z"/>',
  // zelené: a green pointed leaf with its stem and veins
  '<path class="G" d="M50 3C71 18 91 38 89 60 87 78 71 86 57 82L55 97H45L43 82C29 86 13 78 11 60 9 38 29 18 50 3Z"/>'
    + '<path class="l t" d="M50 14V84M50 38 37 29M50 38 63 29M50 57 30 45M50 57 70 45M50 74 35 66M50 74 65 66"/>',
  // kule: a yellow bell-ball with a red band, a slot with round ends and a knob on top
  '<rect class="Y" x="44" y="3" width="12" height="12" rx="4"/><circle class="Y" cx="50" cy="55" r="41"/>'
    + '<path class="R n" d="M12.5 42H87.5A41 41 0 0 1 90.4 51H9.6A41 41 0 0 1 12.5 42Z"/>'
    + '<path class="K n" d="M32 72H68V77H32Z"/><circle class="K n" cx="32" cy="74.5" r="4.5"/><circle class="K n" cx="68" cy="74.5" r="4.5"/><path class="K n" d="M48 77H52V93H48Z"/>',
  // žaludy: an ochre acorn under a brown scaled cap, with its stem
  '<path class="Br" d="M45 2H55V17H45Z"/><path class="Oc" d="M20 47H80C80 74 68 92 50 98 32 92 20 74 20 47Z"/>'
    + '<path class="l t" d="M36 60Q35 78 46 88"/>'
    + '<path class="Br" d="M10 51C10 28 27 14 50 14S90 28 90 51Z"/>'
    + '<path class="l t" style="stroke:var(--mzOc)" d="M18 44 32 22M32 49 48 18M50 50 62 18M68 49 76 26M22 30 40 48M40 20 62 49M60 17 80 44"/>',
];
const sign = (s, x, y, w) => `<g transform="translate(${x} ${y}) scale(${w / 100})">${SIGN[s]}</g>`;

/* ---------- Pip cards: Roman numeral in the corner, the signs in two columns ---------- */
const ROMAN = ['VII', 'VIII', 'IX', 'X'];
const PW = 26, PL = 8, PR = 66, PC = 37;
const pairs = ys => ys.flatMap(y => [[PL, y], [PR, y]]);
const PIPS = [
  [...pairs([36, 74, 110]), [PC, 55]],
  pairs([36, 61, 86, 111]),
  [...pairs([36, 61, 86, 111]), [PC, 73.5]],
  [...pairs([36, 61, 86, 111]), [PC, 48.5], [PC, 98.5]],
];
const pipArt = (s, r) => `<text class="rn rn${s}" x="6" y="29">${ROMAN[r]}</text>` + PIPS[r].map(([x, y]) => sign(s, x, y, PW)).join('');

/* ---------- Figures ---------- */
const f1 = v => Math.round(v * 10) / 10;
// an arm (or a leg) from (x1,y1) to (x2,y2), w1 wide at the start and w2 at the end
function limb(x1, y1, x2, y2, w1, w2, cls) {
  const L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
  const p = (x, y, w, k) => `${f1(x + nx * w / 2 * k)} ${f1(y + ny * w / 2 * k)}`;
  return `<path class="${cls}" d="M${p(x1, y1, w1, 1)}L${p(x2, y2, w2, 1)}L${p(x2, y2, w2, -1)}L${p(x1, y1, w1, -1)}Z"/>`;
}
const hand = (x, y) => `<circle class="S" cx="${x}" cy="${y}" r="3.6"/>`;

// head at (50, cy): hair behind, face, eyes, beard
function head(cy, hair, beard) {
  let h = `<ellipse class="${hair}" cx="50" cy="${cy - 2}" rx="12.5" ry="11.5"/><circle class="S" cx="50" cy="${cy}" r="10"/>`
    + `<circle class="K n" cx="46" cy="${cy - 1}" r="1.4"/><circle class="K n" cx="54" cy="${cy - 1}" r="1.4"/><path class="l t" d="M50 ${cy}v4h-1.6"/>`;
  if (beard === 'full') h += `<path class="${hair}" d="M40 ${cy + 1}Q41 ${cy + 15} 50 ${cy + 17}Q59 ${cy + 15} 60 ${cy + 1}Q56 ${cy + 8} 50 ${cy + 8}T40 ${cy + 1}Z"/>`;
  else if (beard === 'long') h += `<path class="${hair}" d="M40 ${cy + 1}Q40 ${cy + 20} 50 ${cy + 25}Q60 ${cy + 20} 60 ${cy + 1}Q56 ${cy + 8} 50 ${cy + 8}T40 ${cy + 1}Z"/>`;
  if (beard !== 'none') h += `<path class="${hair}" d="M43.5 ${cy + 6}Q50 ${cy + 3} 56.5 ${cy + 6}Q50 ${cy + 8.5} 43.5 ${cy + 6}Z"/>`;
  else h += `<path class="l t" d="M46.5 ${cy + 6.5}Q50 ${cy + 8} 53.5 ${cy + 6.5}"/>`;
  return h;
}
// hats on a head at (50, cy); c = colour class, f = feather colour class
function hat(kind, c, f, cy) {
  const y = cy - 9; // the forehead
  if (kind === 'beret') return `<path class="${f}" d="M58 ${y - 4}Q64 ${y - 20} 74 ${y - 23}Q71 ${y - 11} 63 ${y - 1}Z"/>`
    + `<path class="${c}" d="M33 ${y + 1}Q34 ${y - 10} 50 ${y - 11}Q67 ${y - 11} 68 ${y}Q59 ${y - 3} 50 ${y - 2}T33 ${y + 1}Z"/>`;
  if (kind === 'brim') return `<path class="${c}" d="M41 ${y}V${y - 12}Q50 ${y - 17} 59 ${y - 12}V${y}Z"/>`
    + `<path class="${f}" d="M57 ${y - 9}Q66 ${y - 22} 73 ${y - 21}Q68 ${y - 12} 60 ${y - 5}Z"/>`
    + `<path class="K n" d="M41 ${y - 4}H59V${y - 1}H41Z"/><ellipse class="${c}" cx="50" cy="${y + 1}" rx="18" ry="3.6"/>`;
  if (kind === 'cap') return `<path class="${c}" d="M50 ${y - 11}Q61 ${y - 17} 66 ${y - 8}Q62 ${y - 9} 59 ${y - 7}Z"/>`
    + `<path class="${c}" d="M39 ${y + 3}Q38 ${y - 12} 50 ${y - 12}T61 ${y + 3}Q56 ${y} 50 ${y}T39 ${y + 3}Z"/>`
    + `<path class="W" d="M38.5 ${y + 3}Q50 ${y - 2} 61.5 ${y + 3}V${y + 6}Q50 ${y + 1} 38.5 ${y + 6}Z"/>`;
  if (kind === 'helmet') return `<path class="${f}" d="M49 ${y - 13}Q46 ${y - 24} 56 ${y - 25}Q52 ${y - 19} 53 ${y - 13}Z"/>`
    + `<path class="St" d="M44 ${y - 7}Q50 ${y - 19} 56 ${y - 7}Z"/>`
    + `<path class="St" d="M34 ${y + 3}Q40 ${y} 41 ${y}Q42 ${y - 12} 50 ${y - 13}Q58 ${y - 12} 59 ${y}Q60 ${y} 66 ${y + 3}Q50 ${y - 1} 34 ${y + 3}Z"/>`;
  // tall hat with a band
  return `<path class="${c}" d="M40 ${y + 1}L42 ${y - 16}H58L60 ${y + 1}Z"/><path class="${f}" d="M41.3 ${y - 5}H58.7L59.2 ${y - 1}H40.8Z"/>`
    + `<ellipse class="${c}" cx="50" cy="${y + 1.5}" rx="14" ry="3.2"/>`;
}
// the thing a figure holds in its right hand (on the viewer's right), the hand at about (78, 80)
function attr(kind) {
  if (kind === 'halberd') return `<path class="Br" d="M76.5 16H80V134H76.5Z"/><path class="St" d="M78 2 81.5 16H74.5Z"/>`
    + `<path class="St" d="M80 19Q90 18 94 22V36Q88 33 80 34Z"/><path class="St" d="M76.5 22 68 25 76.5 30Z"/>`;
  if (kind === 'staff') return `<path class="Br" d="M76.5 26H80V134H76.5Z"/><path class="l" style="stroke:var(--mzBr);stroke-width:calc(var(--mzw)*3)" d="M78.2 28V22Q78 12 86 12Q93 12 92 20"/>`;
  if (kind === 'sword') return `<path class="St" d="M76 22 78 12 80 22V74H76Z"/><path class="Y" d="M69 74H87V78.5H69Z"/><path class="Br" d="M76.5 78.5H79.5V90H76.5Z"/><circle class="Y" cx="78" cy="92" r="2.6"/>`;
  if (kind === 'axe') return `<path class="Br" d="M76.5 22H80V134H76.5Z"/><path class="St" d="M80 24Q92 19 93 30Q92 41 80 38Z"/><path class="St" d="M76.5 26 70 29 76.5 34Z"/>`;
  // crossbow, held upright
  return `<path class="Br" d="M75.5 36H80.5L80 120H76Z"/><path class="l t" d="M66 50 78 62 90 50"/>`
    + `<path class="Br" d="M64 52Q78 36 92 52Q78 42 64 52Z"/><path class="St" d="M77 26 78 18 79 26V44H77Z"/>`;
}
// spodek (rank 4) and svršek (rank 5) of every suit: hat, hat colour, feather, hair, beard, coat, breeches, hose, held thing
const FIG = {
  4: [
    { hat: 'brim', hc: 'Br', fc: 'W', hair: 'Hb', beard: 'mous', coat: 'R', br: 'Y', hose: 'Y', at: 'staff' },
    { hat: 'helmet', hc: 'St', fc: 'R', hair: 'Hk', beard: 'full', coat: 'G', br: 'R', hose: 'R', at: 'halberd' },
    { hat: 'cap', hc: 'R', fc: 'W', hair: 'Hg', beard: 'long', coat: 'O', br: 'B', hose: 'B', at: 'sword' },
    { hat: 'tall', hc: 'Hk', fc: 'R', hair: 'Hb', beard: 'full', coat: 'B', br: 'Y', hose: 'R', at: 'axe' },
  ],
  5: [
    { hat: 'beret', hc: 'R', fc: 'W', hair: 'Hy', beard: 'none', coat: 'B', br: 'R', hose: 'R', at: 'sword' },
    { hat: 'brim', hc: 'G', fc: 'Y', hair: 'Hb', beard: 'full', coat: 'G', br: 'Y', hose: 'G', at: 'crossbow' },
    { hat: 'helmet', hc: 'St', fc: 'Y', hair: 'Hk', beard: 'mous', coat: 'R', br: 'Y', hose: 'Y', at: 'halberd' },
    { hat: 'beret', hc: 'Hk', fc: 'R', hair: 'Hg', beard: 'long', coat: 'Y', br: 'G', hose: 'G', at: 'staff' },
  ],
};
const HY = 41; // head centre
function standing(s, r) {
  const f = FIG[r][s], up = r === 5;
  // the body is drawn narrow and widened as a whole, the head a bit bigger: the figure fills the card
  let b = attr(f.at);
  // legs, shoes, puffed breeches, doublet with a belt, the collar
  b += `<path class="${f.hose}" d="M39.5 104H48V129H39.5ZM52 104H60.5V129H52Z"/>`
    + `<path class="K" d="M38 128H48.5V133H35.5ZM51.5 128H62L64.5 133H51.5Z"/>`
    + `<path class="${f.br}" d="M35 92H65L68 107Q59 111 50 106Q41 111 32 107Z"/><path class="l t" d="M42 94V107M50 94V105M58 94V107"/>`
    + `<path class="${f.coat}" d="M37.5 55Q50 51 62.5 55L66.5 95H33.5Z"/><path class="l t" d="M50 57V94"/>`
    + `<circle class="Y t" cx="50" cy="65" r="1.6"/><circle class="Y t" cx="50" cy="73" r="1.6"/>`
    + `<path class="K" d="M34.5 84H65.5V88H34.5Z"/><path class="Y" d="M47.5 83.5H52.5V88.5H47.5Z"/>`
    + `<ellipse class="W" cx="50" cy="54" rx="10" ry="3.4"/>`;
  // the arms: the right one (viewer's right) goes to the held thing, the left one to the suit sign
  b += limb(61, 58, 77, 79, 10, 6, f.coat) + hand(78, 80);
  b += up ? limb(39, 58, 26, 37, 10, 6, f.coat) : limb(39, 58, 30, 72, 10, 6, f.coat);
  let h = `<g transform="translate(50 0) scale(1.18 1) translate(-50 0)">${b}</g>`
    + `<g transform="translate(50 ${HY}) scale(1.2) translate(-50 -${HY})">${head(HY, f.hair, f.beard) + hat(f.hat, f.hc, f.fc, HY)}</g>`;
  // the suit sign: high above the head for the svršek, at the chest for the spodek (the hand holds it)
  h += up ? sign(s, -2, -2, 33) + hand(19.5, 35) : sign(s, -2, 49, 32) + hand(25, 72);
  return h;
}
// král (rank 6): a big bust, unlike the small standing spodek and svršek: a large gold crown, a big face with a
// long beard, an ermine collar, the robe filling the card and a sceptre; the suit sign in the top corner
const KING = [
  { cloak: 'R', tunic: 'Y', hair: 'Hg' },
  { cloak: 'G', tunic: 'R', hair: 'Hb' },
  { cloak: 'B', tunic: 'Y', hair: 'Hk' },
  { cloak: 'P', tunic: 'G', hair: 'Hy' },
];
function king(s) {
  const k = KING[s], cy = 50;
  return `<path class="${k.cloak}" d="M24 76Q50 64 76 76L100 144H0Z"/><path class="${k.tunic}" d="M41 80H59L66 144H34Z"/>`
    + `<path class="W" d="M20 78Q50 98 80 78L78 68Q50 86 22 68Z"/>`
    + [[30, 80], [40, 85], [50, 87], [60, 85], [70, 80]].map(([x, y]) => `<circle class="K n" cx="${x}" cy="${y}" r="1.6"/>`).join('')
    + `<path class="Y" d="M83 134 92 44H96L87 134Z"/><circle class="Y" cx="94" cy="40" r="6"/>`
    + limb(68, 84, 86, 104, 13, 9, k.cloak) + hand(88, 105)
    + `<g transform="translate(50 ${cy}) scale(1.55) translate(-50 -${cy})">${head(cy, k.hair, 'long')}`
    + `<path class="Y" d="M39 ${cy - 8}V${cy - 22}l5.5 6 5.5-9 5.5 9 5.5-6v14Z"/><circle class="R t" cx="50" cy="${cy - 13}" r="2"/><circle class="B t" cx="43" cy="${cy - 12}" r="1.4"/><circle class="B t" cx="57" cy="${cy - 12}" r="1.4"/></g>`
    + sign(s, -2, -2, 28);
}
// eso (rank 7): one big suit sign in the middle of the card, nothing else
const ace = s => sign(s, 4, 24, 92);

/* ---------- Public ---------- */
function artSVG(c) {
  const s = c >> 3, r = c & 7;
  return r <= 3 ? pipArt(s, r) : r === 7 ? ace(s) : r === 6 ? king(s) : standing(s, r);
}
const cache = [];
// the content of a face-up card (inside .cd.up): one drawing over the whole card, a little margin to the edge
const faceHTML = c => `<div class="fc"><svg class="mz" viewBox="-4 -4 108 148" aria-hidden="true">${cache[c] || (cache[c] = artSVG(c))}</svg></div>`;
// a suit sign alone (badges, the suit chooser); needs data-face on the page for its colours
const symSVG = (s, cls = '') => `<svg class="mzs${cls ? ' ' + cls : ''}" viewBox="0 0 100 100" aria-hidden="true">${SIGN[s]}</svg>`;

globalThis.MARIAS = { faceHTML, symSVG, artSVG };
})();
