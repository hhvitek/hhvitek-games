// Shared computer opponents: who the opponent is (a random Czech name, its gender and a drawn face with a mood)
// and how it is shown (a round avatar, the name and a badge: stars for the level or a short trait).
// Every game keeps its own AI and its own levels, LEVELS = [{ title, desc }] from the weakest to the strongest;
// this file only shows them. Kostky, Dáma, Piškvorky, Reversi, Generál, Lodě, Oko bere, Oko bere plus mínus and Prší use it.
// Load it with  <script src="../_opponents/opponents.js"></script>  (after images/sets.js and _cards/cards.js).
// It prepends its CSS (.op…) to <head>, so the game's own rules win, and sets globalThis.OPPONENTS.
// Sizes and colours come from the game's variables: --op-ava (avatar size), --op-ava-bg, --op-name (name size),
// --op-accent (the badge, default var(--accent)).
(() => {
'use strict';

/* ---------- CSS ---------- */
const css = document.createElement('style');
css.id = 'opponents-css';
css.textContent = `
.op{display:flex;align-items:center;gap:8px;min-width:0}
.op-ava{flex:none;width:var(--op-ava,44px);height:var(--op-ava,44px);border-radius:50%;overflow:hidden;background:var(--op-ava-bg,rgba(255,255,255,.2));display:grid;place-items:center}
.op-ava svg{display:block;width:100%;height:100%}
.op-nm{min-width:0;font-size:var(--op-name,20px);font-weight:800;line-height:1.2;display:inline-flex;flex-wrap:wrap;align-items:baseline;column-gap:8px}
.op-badge{font-size:18px;font-weight:700;color:var(--op-accent,var(--accent));white-space:nowrap}
.op-stars{letter-spacing:1px}
`;
document.head.prepend(css);

/* ---------- Who: name, gender and face ---------- */
// fem: the Czech past tense of the opponent's words ("vyhrála"); faces 0, 2 are men, 1, 3 women.
const NAMES = {
  m: ['Pepa', 'Honza', 'Franta', 'Karel', 'Jirka', 'Mirek', 'Láďa', 'Tonda', 'Venca', 'Standa', 'Vašek', 'Petr'],
  f: ['Jarka', 'Marie', 'Hanka', 'Věra', 'Zdena', 'Jana', 'Alena', 'Eva', 'Božena', 'Libuše', 'Milena', 'Dáša'],
};
const FACES = [0, 1, 2, 3];
const rndCrypto = n => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch (e) { return Math.floor(Math.random() * n); } };

// A new opponent { name, fem, face }. avoidNames: names not to use (the previous game's opponent, the other seats);
// avoidFaces: faces not to use when the gender still has another one (two opponents at one table look different).
function create(rnd = rndCrypto, avoidNames = [], avoidFaces = []) {
  for (let i = 0; i < 200; i++) {
    const fem = rnd(2) === 1, list = fem ? NAMES.f : NAMES.m, name = list[rnd(list.length)];
    if (avoidNames.includes(name)) continue;
    const free = [0, 1].map(k => (fem ? 1 : 0) + 2 * k).filter(f => !avoidFaces.includes(f));
    const faces = free.length ? free : [fem ? 1 : 0, fem ? 3 : 2];
    return { name, fem, face: faces[rnd(faces.length)] };
  }
  return { name: 'Pepa', fem: false, face: 0 };
}
// A saved opponent is taken over only when it is one of ours (extra fields of the game, e.g. a play style, may stay)
const valid = f => !!f && typeof f === 'object' && typeof f.fem === 'boolean' && (f.fem ? NAMES.f : NAMES.m).includes(f.name)
  && FACES.includes(f.face) && f.face % 2 === (f.fem ? 1 : 0);
const past = (f, m, fem) => f && f.fem ? fem : m;

/* ---------- Faces (viewBox 64×64): a man in a red cap, a woman with a brown bun, an old man with glasses and
   a moustache, an old woman with a grey bun and glasses; mood calm | happy | sad | think ---------- */
function face(f, mood) {
  const k = typeof f === 'number' ? f : f && f.face;
  const ink = '#3a2a1e', skin = '#f1c7a0';
  const my = k === 2 ? 3 : 0;
  const mouth = { happy: `M22 ${41 + my}q10 9 20 0`, sad: `M23 ${47 + my}q9-7 18 0`, think: `M26 ${45 + my}h11`, calm: `M23 ${43 + my}q9 5 18 0` }[mood] || `M23 ${43 + my}q9 5 18 0`;
  const ey = mood === 'think' ? 30 : 32;
  let back = '', front = '';
  const glasses = `<circle cx="25" cy="${ey}" r="6.5" fill="none" stroke="${ink}" stroke-width="2"/><circle cx="39" cy="${ey}" r="6.5" fill="none" stroke="${ink}" stroke-width="2"/><path d="M31.5 ${ey}h1" stroke="${ink}" stroke-width="2"/>`;
  const bun = c => [`<circle cx="32" cy="10" r="7.5" fill="${c}" stroke="${ink}" stroke-width="2"/><circle cx="32" cy="35" r="24" fill="${c}" stroke="${ink}" stroke-width="2"/>`,
    `<path d="M12 31Q14 13 32 13Q50 13 52 31Q46 20 32 21Q18 20 12 31Z" fill="${c}" stroke="${ink}" stroke-width="2"/>`];
  if (k === 1) [back, front] = bun('#8a5a3c');
  else if (k === 2) {
    back = `<ellipse cx="13" cy="31" rx="5" ry="8" fill="#e8e4dc" stroke="${ink}" stroke-width="2"/><ellipse cx="51" cy="31" rx="5" ry="8" fill="#e8e4dc" stroke="${ink}" stroke-width="2"/>`;
    front = glasses + `<path d="M21 42q5-5 11-1q6-4 11 1q-5 4-11 1q-6 3-11-1Z" fill="#e8e4dc" stroke="${ink}" stroke-width="1.6"/>`;
  } else if (k === 3) { [back, front] = bun('#cfcac2'); front += glasses; }
  else front = `<path d="M12 29C12 12 52 12 52 29Z" fill="#c8402f" stroke="${ink}" stroke-width="2"/><path d="M42 27h16q-1 5-9 5h-7z" fill="#a83325" stroke="${ink}" stroke-width="2"/><path d="M14 30q4-4 8-1M42 29q4-3 8 1" stroke="#7a4a26" stroke-width="3" fill="none"/>`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${back}<circle cx="32" cy="35" r="20" fill="${skin}" stroke="${ink}" stroke-width="2"/>`
    + `<circle cx="25" cy="${ey}" r="2.6" fill="${ink}"/><circle cx="39" cy="${ey}" r="2.6" fill="${ink}"/>`
    + (mood === 'think' ? `<path d="M34 ${ey - 6}q5-3 9 0" stroke="${ink}" stroke-width="2" fill="none"/>` : '')
    + `<path d="${mouth}" stroke="${ink}" stroke-width="2.5" fill="none" stroke-linecap="round"/>${front}</svg>`;
}
// The player: a silhouette in currentColor
const ME_SVG = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="25" r="11" fill="currentColor"/><path d="M12 56c2-13 10-19 20-19s18 6 20 19z" fill="currentColor"/></svg>';

/* ---------- Levels: stars count the game's own levels (2 levels ★☆ ★★, 3 levels ★☆☆ … ★★★) ---------- */
const stars = (i, n) => '★'.repeat(i + 1) + '☆'.repeat(Math.max(0, n - i - 1));
const starWord = k => k === 1 ? 'hvězdička' : k < 5 ? 'hvězdičky' : 'hvězdiček';
// "Zkušený hráč, 2 hvězdičky ze 3" (for aria-label)
const levelSpoken = (levels, i) => `${levels[i].title}, ${i + 1} ${starWord(i + 1)} ${levels.length < 5 ? 'ze' : 'z'} ${levels.length}`;
// "Zkušený hráč ★★☆" (settings, help, dialogs)
const levelName = (levels, i) => `${levels[i].title} ${stars(i, levels.length)}`;

/* ---------- Display: the same head in every game ---------- */
const levelBadge = (levels, i) => `<small class="op-badge op-stars" aria-label="${levelSpoken(levels, i)}">${stars(i, levels.length)}</small>`;
const traitBadge = text => `<small class="op-badge">${text}</small>`;
const ava = (f, mood) => `<span class="op-ava">${face(f, mood)}</span>`;
const name = (f, badge = '') => `<span class="op-nm">${f.name}${badge ? ' ' + badge : ''}</span>`;
// avatar + name + badge in one row; opts = { mood, badge }
const head = (f, opts = {}) => `<span class="op">${ava(f, opts.mood)}${name(f, opts.badge)}</span>`;

globalThis.OPPONENTS = { NAMES, create, valid, past, face, ME_SVG, stars, levelSpoken, levelName, levelBadge, traitBadge, ava, name, head };
})();
