// Kočka: all the drawing of Koxa (the user's black tortoiseshell cat), her places and the items. Pure SVG strings + CSS.
// One global factory; nothing touches the DOM. Copied into games/kocka/index.html by tools/kocka-dev/assemble.js.
//
// API of KockaArt():
//   css                      keyframes and classes (blink, ear twitch, tail sway by mood, sleep breathing, purr shiver,
//                            sneeze, wriggle, Zzz, fleas, gait, weather); prefers-reduced-motion turns it off. Inject once.
//   cat(pose, opts)          <svg class="koxa"> viewBox 0 0 200 200, the cat stands on y≈186 (centre x 100; see anchors).
//                            opts = { mood: 'happy'|'calm'|'grumpy'|'sad', thin, chubby, ill: null|'fleas'|'tummy'|'cold',
//                            ears: 'up'|'back'|'turned', purring, asleep, meow, openMouth, wet, noProp } (a mood string
//                            works as opts too). Poses (side views face left: flip the box with scaleX(-1)):
//                            sit, loaf, sleep, stretch, pounce (toys only), eat, drink, groom, sulk (back turned), belly,
//                            carried, wriggle, window (from behind), walk and trot (legs swing by CSS; the step time is
//                            the CSS variable --kx-step on any ancestor: walk .8s, trot .42s by default), walk1..walk4
//                            (still frames a quarter step apart), crouch → jumpUp → jumpDown (up to and down from the
//                            sill, chair, counter, lap), climb (on the trunk), onBranch, stalk, shakePaw, and the bigger
//                            lap poses lapLoaf, lapCurl (dozing), lapBelly.
//   poses                    the list of pose names.
//   anchors                  { pose: [x, y] } for poses that do not stand on (100, 186): put that point on the spot.
//   regions(pose, opts)      [{ id, path, fur: [dx, dy] }] in the cat's 0..200 viewBox, ids from
//                            'chin'|'tail'|'paws'|'head'|'ears'|'tailBase'|'belly'|'back' (tailBase = kořen ocasu,
//                            the back just in front of the tail root, in every pose that has 'back'). The list is in
//                            hit-test order: the first region whose path contains the point wins (chin before head, head
//                            before ears, so 'ears' is only the visible ear above the head plus a small margin). Paths
//                            may hold several subpaths (both ears, every paw): use the nonzero rule. `fur` is the unit
//                            vector of stroking along the fur (head → tail; on the head from the forehead over the top,
//                            on the chin and throat downwards). Pass the same opts as cat() (the tail follows the mood).
//   mouth(pose, opts)        {x, y} of her mouth in the cat's viewBox, or null when she faces away.
//   room(o) / room(phase, season)  <svg> viewBox 0 0 400 600, preserveAspectRatio xMidYMid slice.
//                            o = { id: 'living'|'kitchen'|'hall'|'garden', phase: 'morning'|'day'|'evening'|'night',
//                            season: 'spring'|'summer'|'autumn'|'winter', sunX: 0..1, holiday: null | id | [ids],
//                            flap: bool (cat flap in the hall door), weather: null|'rain'|'snow' }. Holiday ids: advent,
//                            mikulas, vanoce, silvestr, masopust, velikonoce, carodejnice, dusicky, narozeniny.
//   rooms                    { id: { name (Czech), spots: { name: {x, y} } } } for the four places (room coordinates,
//                            where an item or Koxa stands): living (Obývák: rug, bed, window, chair = armchair seat, sun),
//                            kitchen (Kuchyně: bowl, water, counter, window), hall (Předsíň: litter, door, shoe, mat),
//                            garden (Zahrada: door, gate, tree, branch, branch2, bench, feeder, yard, bed1..bed4).
//   spots                    the old single-room spots { bowl, water, litter, bed, window, door }, kept for old code.
//   sunPatch(sunX)           {x, y}: the middle of the living-room sun patch on the floor (x 95…235), for a sun nap.
//   lap({ phase, season, place: 'chair'|'bench' })  the lap close-up (400×600, slice); lapSpot = { x, y, size }: her
//                            box is size × size, its point (100, 186) at (x, y).
//   crop(name, stage 0..3)   a plant in a bed (viewBox 0 0 100 100, standing on y≈90); crops = names (plant, radish,
//                            carrot, strawberry, tomato, catnip); cropSlot = where a produce drawing can sit on 'plant'.
//   item(name), itemHeld(name)  <svg class="kx-item"> viewBox 0 0 100 100, standing on y≈90; items = the names.
//   icon(name), fx(name), face(mood), vet(), vetSpots  UI icons (24×24, currentColor), effects, the small head, the vet.
//   Tricks and more poses: trickSit, trickPaw (dej pac), trickSpin (turns round by CSS), trickBeg (panáček), inBox, onFence.
//   itemSize[name] = { w, h }  the item's 100 × 100 box in room units; itemPoints: rod / wand tip, cat-tree platforms.
//   mouseHole(), mousePeek(phase 0..1), fish(kind) (fishes: goldfish, carp, perch), marker(done)  minigame pieces.
//   shop(), shopSpots       Obchůdek (400×600 slice) and where goods go on the counter.
//   postcardFrame(caption), postcardHole (viewBox 300×200), photoFrame(), photoHole (200×236)  frames over a photo.
//   neighbour(id, pose, opts), neighbours = { id: { name } }  the visitors (mourek, liza, bivoj, ciperka, pacicka,
//                            rambo, sedivka, fousek) in any pose; usually sit, walk, loaf, onFence (rooms.garden.spots.fence).
function KockaArt() {
  'use strict';
  const C = {
    fur: '#1d1916', fur2: '#28211c', edge: '#54463c', ol: '#f1e2c4',
    patch: '#77441f', patch2: '#b8722f', blaze: '#c98c42',
    eye: '#c8d24a', pupil: '#0e0b09', earIn: '#6e4a40', nose: '#c47c72',
    lid: '#ecdcbf', tongue: '#e48880', bean: '#cf8a80', blush: '#e2836f',
  };
  const KOXA_C = Object.assign({}, C);
  let COAT = { pattern: 'tortie', blaze: true };   // Koxa; withCoat() swaps it for a neighbour cat
  const OLW = 5;                       // outline stroke (half of it shows outside the silhouette)
  const MOODS = ['happy', 'calm', 'grumpy', 'sad'];
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  let uid = 0;
  // ids unique in the page even when several KockaArt() instances draw into one document
  const tag = 'kx' + Math.floor(Math.random() * 46656).toString(36) + '_';
  const nid = () => tag + (++uid).toString(36);

  /* ---------- geometry ---------- */
  // a cubic path from a flat list [x0, y0, c1x, c1y, c2x, c2y, x1, y1, …]
  function cub(p) { let d = `M${p[0]} ${p[1]}`; for (let i = 2; i + 6 <= p.length; i += 6) d += 'C' + p.slice(i, i + 6).join(' '); return d; }
  const line = (x0, y0, x1, y1) => [x0, y0, x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3, x0 + 2 * (x1 - x0) / 3, y0 + 2 * (y1 - y0) / 3, x1, y1];
  const ell = (cx, cy, rx, ry) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
  const poly = pts => 'M' + pts.map(q => r1(q[0]) + ' ' + r1(q[1])).join('L') + 'Z';
  const unit = (dx, dy) => { const l = Math.hypot(dx, dy) || 1; return [r2(dx / l), r2(dy / l)]; };
  function sample(p, n = 6) {
    const out = [[p[0], p[1]]];
    for (let i = 2; i + 6 <= p.length; i += 6) {
      const x0 = p[i - 2], y0 = p[i - 1];
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        out.push([a * x0 + b * p[i] + c * p[i + 2] + d * p[i + 4], a * y0 + b * p[i + 1] + c * p[i + 3] + d * p[i + 5]]);
      }
    }
    return out;
  }
  // the area of a stroke of width w along a cubic list, as a polygon (for regions)
  function ribbon(p, w) {
    const s = sample(p), L = [], R = [];
    s.forEach((q, i) => {
      const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)], [dx, dy] = unit(b[0] - a[0], b[1] - a[1]);
      L.push([q[0] - dy * w / 2, q[1] + dx * w / 2]); R.push([q[0] + dy * w / 2, q[1] - dx * w / 2]);
    });
    return poly(L.concat(R.reverse()));
  }
  function ellPoly(cx, cy, rx, ry, rot = 0) {
    const a = rot * Math.PI / 180, pts = [];
    for (let i = 0; i < 18; i++) { const t = i / 18 * 2 * Math.PI, x = Math.cos(t) * rx, y = Math.sin(t) * ry; pts.push([cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]); }
    return poly(pts);
  }
  // an irregular soft blob (tortie mottling), deterministic from its seed
  function blob(cx, cy, r, seed) {
    let s = (Math.round(seed) * 7919 + 13) % 233280;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280, n = 9, pts = [];
    const rot = rnd() * Math.PI, ca = Math.cos(rot), sa = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, rr = r * (0.5 + 0.7 * rnd()), x = Math.cos(a) * rr * 1.25, y = Math.sin(a) * rr * 0.7;
      pts.push([cx + x * ca - y * sa, cy + x * sa + y * ca]);
    }
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], z = pts[n - 1];
      if (!i) d += `M${r1((z[0] + a[0]) / 2)} ${r1((z[1] + a[1]) / 2)}`;
      d += `Q${r1(a[0])} ${r1(a[1])} ${r1((a[0] + b[0]) / 2)} ${r1((a[1] + b[1]) / 2)}`;
    }
    return d + 'Z';
  }
  // [x, y, r, kind] → tortie mottling: a dark ginger patch, kind 1 with a brighter core
  const spots = list => COAT.pattern === 'none' ? '' : COAT.pattern === 'tabby' ? tabby() : list.map(([x, y, r, c], i) => {
    const sd = i * 31 + x * 3 + y;
    return `<path d="${blob(x, y, r, sd)}" fill="${C.patch}"/>` + (c ? `<path d="${blob(x + r * 0.2, y - r * 0.15, r * 0.5, sd + 5)}" fill="${C.patch2}"/>` : '');
  }).join('');

  // tabby stripes for a neighbour's coat (in the part's own frame, clipped to it like the patches)
  function tabby() {
    const id = nid();
    return `<defs><pattern id="${id}" width="10" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(8)"><path d="M3 0Q6.5 10 3 20T3 40" stroke="${C.patch}" stroke-width="3.6" fill="none"/></pattern></defs><rect x="-400" y="-400" width="1000" height="1000" fill="url(#${id})"/>`;
  }

  /* ---------- rig ---------- */
  // Two layers: every part's cream outline first (one sticker-like outline around the whole silhouette, so the black
  // cat never vanishes on a dark page), then the fills and details. Animated groups are opened in both layers with
  // the same class, so their animations stay in step.
  function Rig(o) {
    const R = { ol: [], fi: [], top: [], defs: [], reg: [], o, wrap: null, shadow: [100, 186, 60, 5] };
    R.open = (tf, cls, ox = 0, oy = 0) => {
      const g = (tf ? `<g transform="${tf}">` : '<g>') + (cls ? `<g class="${cls}" style="transform-origin:${ox}px ${oy}px">` : '<g>');
      R.ol.push(g); R.fi.push(g);
    };
    R.close = () => { R.ol.push('</g></g>'); R.fi.push('</g></g>'); };
    R.part = (d, p = {}) => {
      R.ol.push(`<path d="${d}" fill="${C.ol}" stroke="${C.ol}" stroke-width="${OLW}" stroke-linejoin="round"/>`);
      let s = `<path d="${d}" fill="${p.fill || C.fur}"${p.edge ? ` stroke="${C.edge}" stroke-width="1.4"` : ''}/>`;
      if (p.patches) { const id = nid(); R.defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`); s += `<g clip-path="url(#${id})">${p.patches}</g>`; }
      R.fi.push(s);
    };
    // a leg or tail: a thick round-capped stroke along a cubic list, optional paw at its end
    R.limb = (p, w, q = {}) => {
      const d = cub(p);
      R.ol.push(`<path d="${d}" fill="none" stroke="${C.ol}" stroke-width="${w + OLW}" stroke-linecap="round" stroke-linejoin="round"/>`);
      let s = q.edge ? `<path d="${d}" fill="none" stroke="${C.edge}" stroke-width="${w + 2.6}" stroke-linecap="round" stroke-linejoin="round"/>` : '';
      s += `<path d="${d}" fill="none" stroke="${q.fill || C.fur}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
      for (const [at, len, c] of q.bands || []) s += `<path d="${d}" fill="none" stroke="${c ? C.patch2 : C.patch}" stroke-width="${r1(w * 0.62)}" stroke-linecap="round" stroke-dasharray="${len} 999" stroke-dashoffset="${-at}"/>`;
      R.fi.push(s);
      if (q.paw) paw(R, p[p.length - 2], p[p.length - 1], q.paw[0], q.paw[1], q);
    };
    R.raw = s => R.fi.push(s);
    R.region = (id, path, fur) => R.reg.push({ id, path, fur });
    return R;
  }
  function paw(R, x, y, rx, ry, q = {}) {
    R.part(ell(x, y, rx, ry), { edge: true, fill: COAT.socks || q.fill });
    R.region('paws', ellPoly(x, y, rx + 4, ry + 4), [0, 1]);
    if (q.toes) R.raw(`<path d="M${r1(x - rx * 0.32)} ${r1(y + ry * 0.15)}v${r1(ry * 0.75)}M${r1(x + rx * 0.32)} ${r1(y + ry * 0.15)}v${r1(ry * 0.75)}" stroke="${C.edge}" stroke-width="1.3" stroke-linecap="round"/>`);
    if (q.beans) R.raw(`<g fill="${C.bean}"><ellipse cx="${x}" cy="${r1(y + ry * 0.2)}" rx="${r1(rx * 0.42)}" ry="${r1(ry * 0.36)}"/><circle cx="${r1(x - rx * 0.5)}" cy="${r1(y - ry * 0.42)}" r="${r1(rx * 0.17)}"/><circle cx="${x}" cy="${r1(y - ry * 0.6)}" r="${r1(rx * 0.17)}"/><circle cx="${r1(x + rx * 0.5)}" cy="${r1(y - ry * 0.42)}" r="${r1(rx * 0.17)}"/></g>`);
  }
  function tail(R, p, w = 13, cls = '') {
    R.tailRoot = [p[0], p[1]];
    R.open('', 'kx-tail' + (cls ? ' ' + cls : ''), p[0], p[1]);
    R.limb(p, w, { edge: true, bands: [[30, 11, 0]] });
    R.close();
    R.region('tail', ribbon(p, w + 6), unit(p[p.length - 2] - p[0], p[p.length - 1] - p[1]));
  }
  // thin / chubby: the body (not the head or legs) narrower or wider around x = cx (or y = cy for lying poses)
  const bw = o => (o.thin ? 0.84 : o.chubby ? 1.16 : 1);
  const btfX = (o, cx) => bw(o) === 1 ? '' : `translate(${cx} 0) scale(${bw(o)} 1) translate(${-cx} 0)`;
  const btfY = (o, cy) => bw(o) === 1 ? '' : `translate(0 ${cy}) scale(1 ${r2(1 - (1 - bw(o)) * 0.7)}) translate(0 ${-cy})`;

  /* ---------- head ---------- */
  const HEAD = 'M0 -32C24 -32 38 -20 38 -1L44 9L36 14C30 26 16 31 0 31C-16 31 -30 26 -36 14L-44 9L-38 -1C-38 -20 -24 -32 0 -32Z';
  const EAR_TORN = 'M-14 4L-3.5 -25Q0 -30 3.5 -25L6.5 -15L2 -12L9 -7L14 4Z';
  const EAR = 'M-14 4L-3.5 -25Q0 -30 3.5 -25L14 4Z', EAR_IN = 'M-8 2L-2 -17Q0 -20 2 -17L8 2Z';
  // the head's outline as a polygon (1 unit outside it), for the head region
  const HEAD_PTS = (() => {
    const half = sample([0, -32, 24, -32, 38, -20, 38, -1]).concat([[44, 9], [36, 14]], sample([36, 14, 30, 26, 16, 31, 0, 31]).slice(1));
    const grow = q => { const l = Math.hypot(q[0], q[1]) || 1; return [q[0] * (l + 1) / l, q[1] * (l + 1) / l]; };
    return half.map(grow).concat(half.slice(1, -1).reverse().map(q => grow([-q[0], q[1]])));
  })();
  const BLAZE = 'M-8 -36Q0 -38 8 -36Q3 -14 1.5 7L-1.5 7Q-3 -14 -8 -36Z';
  const EAR_ROT = { up: 12, turned: 34, back: 64, droop: 76 };
  const MOUTH = { cat: 'M-8 16.5Q-4 21.5 0 16.5Q4 21.5 8 16.5', frown: 'M-6 19.5Q0 15.5 6 19.5', flat: 'M-6 18.5Q0 17 6 18.5', wavy: 'M-8 18q2-2 4 0t4 0t4 0t4 0' };
  // the face for opts: which eyes, mouth and ears
  function expr(o) {
    let eyes = o.asleep ? 'closed' : { happy: 'happy', grumpy: 'grumpy', sad: 'sad' }[o.mood] || 'open';
    if (!o.asleep && o.ill) eyes = 'tired';
    if (COAT.old && eyes === 'open') eyes = 'tired';
    const mouth = o.openMouth ? 'open' : o.meow ? 'meow' : o.ill === 'tummy' ? 'wavy' : { grumpy: 'flat', sad: 'frown' }[o.mood] || 'cat';
    const ears = o.ears || (o.asleep ? 'turned' : { grumpy: 'back', sad: 'droop' }[o.mood] || 'up');
    return { eyes, mouth, ears, ill: o.ill, sneeze: o.ill === 'cold' && !o.asleep, blush: o.mood === 'happy' && !o.ill };
  }
  function eye(sd, kind) {
    const cx = sd * 15, cy = -1;
    if (kind === 'happy') return `<path d="M${cx - 8} ${cy + 2.5}Q${cx} ${cy - 7} ${cx + 8} ${cy + 2.5}" fill="none" stroke="${C.eye}" stroke-width="3.2" stroke-linecap="round"/>`;
    if (kind === 'closed') return `<path d="M${cx - 8} ${cy}Q${cx} ${cy + 5.5} ${cx + 8} ${cy}" fill="none" stroke="${C.lid}" stroke-width="2.4" stroke-linecap="round"/>`;
    const big = kind === 'sad' || kind === 'wide';
    const pr = { grumpy: [1.7, 6.6], sad: [5.2, 6.6], wide: [5.8, 7.2], tired: [2.6, 6] }[kind] || [3.3, 7.3];
    let s = `<g transform="translate(${cx} ${cy}) rotate(${-sd * 10})"><ellipse rx="10" ry="${big ? 9.8 : 9}" fill="${C.eye}"/><ellipse cx="${sd * -0.6}" cy="${kind === 'sad' ? 1.5 : 0}" rx="${pr[0]}" ry="${pr[1]}" fill="${C.pupil}"/><circle cx="2.8" cy="-3.6" r="2.2" fill="#fff"/>`;
    if (big) s += '<circle cx="-3" cy="3" r="1.2" fill="#fff"/>';
    const lid = { grumpy: [-5.5, 0.5], sad: [1.5, -8.5], tired: [-1.5, -1.5] }[kind]; // [outer y, inner y]; inner = towards the nose
    if (lid) s += `<path d="M${sd * 12} -12L${-sd * 11} -12L${-sd * 11} ${lid[1]}L${sd * 12} ${lid[0]}Z" fill="${C.fur}"/><path d="M${sd * 10.5} ${lid[0] + 0.3}L${-sd * 10} ${lid[1] + 0.3}" stroke="${C.edge}" stroke-width="1.2"/>`;
    return s + '</g>';
  }
  function faceDetails(h) {
    const open = !['happy', 'closed'].includes(h.eyes);
    let s = open ? `<g class="kx-eyes" style="transform-origin:0px -1px">${eye(-1, h.eyes)}${eye(1, h.eyes)}</g>` : eye(-1, h.eyes) + eye(1, h.eyes);
    if (h.eyes === 'sad') s += `<path d="M-19 8q2.6 4.4 0 6.4q-2.6-2 0-6.4z" fill="#a9d8f2"/>`;
    if (h.blush) s += `<g fill="${C.blush}" opacity=".38"><ellipse cx="-26" cy="12" rx="5.5" ry="3"/><ellipse cx="26" cy="12" rx="5.5" ry="3"/></g>`;
    s += `<path d="M-4.5 9Q0 7.6 4.5 9L0.9 13.4Q0 14.2 -0.9 13.4Z" fill="${h.ill === 'cold' ? '#d8645a' : C.nose}"/>`;
    if (h.mouth === 'meow' || h.mouth === 'open') s += `<g transform="translate(0 16) scale(${h.mouth === 'open' ? 1.45 : 1}) translate(0 -16)"><path d="M-6.5 16Q0 29 6.5 16Q0 18.5 -6.5 16Z" fill="#4a1a17" stroke="${C.lid}" stroke-width="1.3" stroke-linejoin="round"/><path d="M-3.4 22.4Q0 26.4 3.4 22.4Q0 20.6 -3.4 22.4Z" fill="${C.tongue}"/></g>`;
    else s += `<path d="M0 13.6V16.5${MOUTH[h.mouth] || MOUTH.cat}" fill="none" stroke="${C.lid}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
    if (h.tongue) s += `<path d="M-2.8 18Q0 25 2.8 18Z" fill="${C.tongue}"/>`;
    s += `<path d="M-17 12L-50 6M-17 15L-51 15.5M-16 18L-47 25M17 12L50 6M17 15L51 15.5M16 18L47 25"${COAT.whisk ? ` transform="scale(${COAT.whisk} 1)"` : ''} stroke="${C.lid}" stroke-width="1.2" stroke-linecap="round" opacity=".75"/>`;
    if (h.ill === 'cold') s += '<path d="M2.6 14.6q2.8 4.6 0 6.6q-2.8-2 0-6.6z" fill="#a9d8f2"/>';
    if (h.ill === 'tummy') s += `<path d="M35 -27q4.5 6.5 0 9.4q-4.5-2.9 0-9.4z" fill="#a9d8f2" stroke="${C.ol}" stroke-width=".8"/>`;
    return s;
  }
  // head at (x, y), scale s, rotation rot; h from expr() plus { back, tongue, edge }; also adds the head regions
  function head(R, x, y, s, rot, h) {
    R.open(`translate(${x} ${y}) rotate(${rot}) scale(${s})`, h.sneeze ? 'kx-sneeze' : '', 0, 30);
    const ea = EAR_ROT[h.ears] != null ? EAR_ROT[h.ears] : 12, dy = h.ears === 'droop' ? 5 : h.ears === 'back' ? 3 : 0;
    for (const sd of [-1, 1]) {
      R.open(`translate(${sd * 21} ${-22 + dy}) rotate(${sd * ea})`, sd > 0 ? 'kx-ear kx-earR' : 'kx-ear', 0, 0);
      R.part(sd > 0 && COAT.torn ? EAR_TORN : EAR, { patches: sd > 0 ? spots([[4, -3, 10, 0]]) : '', edge: !!h.back });
      if (!h.back) R.raw(`<path d="${EAR_IN}" fill="${C.earIn}"/>`);
      R.close();
    }
    R.part(HEAD, { edge: h.edge !== false, patches: h.back ? spots([[-15, -14, 13, 0], [21, 6, 10, 1], [10, -24, 6, 0]]) : (COAT.blaze ? `<path d="${BLAZE}" fill="${C.blaze}"/>` : '') + spots([[-31, 13, 10, 0], [27, -22, 9, 0], [-24, -25, 5, 1]]) });
    if (!h.back) R.raw(faceDetails(h));
    else R.raw(`<path d="M-37 11L-51 8M-37 15L-50 18M37 11L51 8M37 15L50 18" stroke="${C.lid}" stroke-width="1.2" stroke-linecap="round" opacity=".75"/>`);
    R.close();
    // regions: points of the head's own frame mapped into the cat's viewBox
    const a = rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const m = (px, py) => [x + s * (px * ca - py * sa), y + s * (px * sa + py * ca)];
    const P = pts => poly(pts.map(q => m(q[0], q[1])));
    const v = (dx, dy) => unit(dx * ca - dy * sa, dx * sa + dy * ca);
    const earPts = sd => [[-14, -5], [-6, -31], [0, -36], [6, -31], [14, -5]].map(([ex, ey]) => {
      const b = sd * ea * Math.PI / 180;
      return [sd * 21 + ex * Math.cos(b) - ey * Math.sin(b), -22 + dy + ex * Math.sin(b) + ey * Math.cos(b)];
    });
    R.region('ears', P(earPts(-1)) + P(earPts(1)), v(0, -1));
    if (!h.back) R.mouthPt = m(0, h.mouth === 'open' ? 21 : h.mouth === 'meow' ? 20 : 17).map(r1);
    if (!h.back) R.region('chin', P([[-20, 22], [20, 22], [24, 27], [23, 40], [15, 50], [0, 53], [-15, 50], [-23, 40], [-24, 27]]), v(0, 1));
    R.region('head', P(HEAD_PTS), h.back ? v(0, 1) : v(0, -1));
  }
  const H = (e, more) => Object.assign({}, e, more);

  /* ---------- poses ---------- */
  const TAIL_SIT = {
    happy: [140, 172, 166, 170, 176, 146, 170, 124, 166, 108, 172, 96, 184, 100],
    calm: [138, 180, 124, 192, 82, 192, 64, 185],
    grumpy: [140, 178, 160, 186, 180, 182, 194, 164],
    sad: [140, 182, 156, 187, 172, 187, 188, 186],
  };
  // the sitting body seen from the front (sit, groom) or from behind (sulk, window)
  function sitBody(R, o, back) {
    const BODY = 'M80 90C65 106 57 134 57 160C57 178 70 186 100 186C130 186 143 178 143 160C143 134 135 106 120 90Z';
    R.open(btfX(o, 100));
    R.part(ell(60, 182, 12, 5)); R.part(ell(140, 182, 12, 5));
    R.part(BODY, { patches: spots(back ? [[78, 118, 14, 0], [124, 140, 16, 0], [96, 162, 8, 1], [112, 106, 7, 1], [70, 168, 9, 0]] : [[119, 136, 12, 0], [79, 148, 10, 1], [92, 108, 6, 0], [104, 150, 4, 1]]) });
    R.part(ell(69, 164, 16, 20), { edge: true, patches: spots([[64, 172, 9, 0]]) });
    R.part(ell(131, 164, 16, 20), { edge: true, patches: spots([[136, 154, 7, 1]]) });
    R.close();
    R.region('back', BODY, [0, 1]);
    R.mid = [100, 140];
  }
  const LEG = { paw: [10, 6.5], toes: true };
  function frontLegs(R, both) {
    R.limb(line(88, 112, 87, 177), 15, LEG);
    if (both) { R.limb(line(112, 112, 113, 177), 15, LEG); R.raw(`<path d="M100 132V174" stroke="${C.edge}" stroke-width="1.4" stroke-linecap="round"/>`); }
    else R.raw(`<path d="M95.5 132V174" stroke="${C.edge}" stroke-width="1.4" stroke-linecap="round"/>`);
  }
  const POSES = {
    sit(R, o, e) {
      sitBody(R, o, false);
      const t = TAIL_SIT[o.mood] || TAIL_SIT.calm, wrap = t === TAIL_SIT.calm;
      if (!wrap) tail(R, t);
      frontLegs(R, true);
      if (wrap) tail(R, t);
      const hp = { happy: [100, 70, -7], grumpy: [100, 72, 0], sad: [100, 76, 6] }[o.mood] || [100, 70, 0];
      head(R, hp[0], hp[1], 1, hp[2], e);
    },
    groom(R, o, e) {
      sitBody(R, o, false);
      frontLegs(R, false);
      tail(R, TAIL_SIT.calm);
      head(R, 100, 70, 1, -8, H(e, { eyes: 'closed', mouth: 'cat', tongue: true, blush: false }));
      R.limb([108, 128, 115, 116, 116, 104, 111, 94], 14, {});
      R.raw(`<path d="M117.5 124Q123 110 118 98" fill="none" stroke="${C.edge}" stroke-width="1.4" stroke-linecap="round"/>`);
      paw(R, 110, 92, 8.5, 7, { toes: true });
    },
    sulk(R, o, e) {
      sitBody(R, o, true);
      tail(R, [100, 183, 130, 192, 168, 190, 192, 172]);
      head(R, 100, 77, 1, 0, H(e, { back: true, ears: o.ears || 'back' }));
    },
    window(R, o, e) {
      sitBody(R, o, true);
      tail(R, [100, 183, 130, 190, 156, 182, 160, 158, 163, 140, 172, 131, 183, 135]);
      head(R, 100, 70, 1, -7, H(e, { back: true, ears: o.ears || 'turned' }));
    },
    loaf(R, o, e) {
      const BODY = 'M50 186C40 160 62 121 106 119C150 117 177 142 179 172C180 182 173 186 160 186Z';
      R.open(btfY(o, 186));
      R.part(BODY, { patches: spots([[122, 133, 16, 0], [150, 160, 12, 1], [98, 152, 10, 0], [165, 140, 7, 0], [62, 170, 8, 1]]) });
      R.part(ell(150, 165, 24, 19), { edge: true, patches: spots([[156, 158, 9, 0]]) });
      R.close();
      tail(R, [174, 180, 162, 190, 128, 190, 110, 185]);
      paw(R, 64, 183, 10, 5.5, { toes: true }); paw(R, 87, 184, 10, 5.5, { toes: true });
      head(R, 72, 130, 0.95, -4, e);
      R.region('back', BODY, [1, 0]);
      R.mid = [125, 150];
    },
    sleep(R, o, e) {
      R.wrap = { cls: 'kx-breathe', ox: 100, oy: 186 };
      const BODY = 'M28 184C22 152 54 128 104 127C154 126 184 148 183 174C182 184 172 186 152 186L46 186C34 186 29 186 28 184Z';
      R.open(btfY(o, 186));
      R.part(BODY, { patches: spots([[118, 140, 16, 0], [150, 150, 9, 1], [92, 160, 10, 0], [170, 170, 7, 0]]) });
      R.part(ell(146, 162, 28, 21), { edge: true, patches: spots([[140, 170, 10, 1]]) });
      R.close();
      paw(R, 62, 182, 11, 5.5, { toes: true }); paw(R, 84, 184, 11, 5.5, { toes: true });
      head(R, 64, 152, 0.86, -12, H(e, { eyes: 'closed', mouth: 'cat', ears: o.ears || 'turned', blush: false }));
      tail(R, [178, 176, 170, 190, 124, 191, 102, 186]);
      R.region('back', BODY, [1, 0]);
      R.mid = [125, 150];
    },
    stretch(R, o, e) {
      R.limb(line(70, 170, 32, 184), 11, { fill: C.fur2, paw: [8, 4.5] });
      R.limb(line(152, 128, 160, 182), 13, { fill: C.fur2, paw: [9, 4.5] });
      const BODY = 'M50 160C56 146 80 131 110 115C128 105 150 99 161 111C170 123 160 140 140 147C118 155 90 172 66 177C55 179 47 171 50 160Z';
      R.part(BODY, { patches: spots([[110, 128, 12, 0], [140, 116, 9, 1], [80, 158, 8, 0]]) });
      R.part(ell(146, 124, 17, 22), { edge: true, patches: spots([[150, 132, 8, 0]]) });
      tail(R, [160, 110, 176, 94, 172, 64, 186, 50]);
      R.limb(line(140, 136, 142, 183), 13, { edge: true, paw: [9, 4.5], toes: true });
      R.limb(line(64, 168, 22, 183), 12, { edge: true, paw: [9, 4.5], toes: true });
      head(R, 50, 138, 0.86, -8, e);
      R.region('back', BODY, unit(90, -55));
      R.mid = [110, 130];
    },
    pounce(R, o, e) {
      R.shadow = [106, 186, 44, 4.5];
      R.limb([82, 114, 68, 124, 54, 132, 40, 138], 11, { fill: C.fur2, paw: [8, 6] });
      R.limb([146, 126, 158, 136, 168, 142, 180, 146], 12, { fill: C.fur2, paw: [8, 6] });
      R.open('rotate(16 108 110)');
      R.part(ell(108, 110, 52, 21), { patches: spots([[110, 100, 13, 0], [136, 116, 9, 1], [84, 118, 8, 0]]) });
      R.close();
      R.limb([150, 122, 164, 128, 176, 132, 188, 132], 12, { edge: true, paw: [8, 6], toes: true });
      tail(R, [158, 112, 168, 100, 180, 90, 191, 93]);
      R.limb([76, 108, 60, 116, 44, 124, 28, 128], 11, { edge: true, paw: [8, 6], toes: true });
      head(R, 56, 82, 0.86, -12, H(e, { eyes: o.asleep || o.ill ? e.eyes : 'wide', ears: o.ears || 'up' }));
      R.region('back', ellPoly(108, 110, 52, 21, 16), unit(1, 0.29));
      R.mid = [110, 110];
    },
    eat(R, o, e) {
      R.limb(line(94, 140, 92, 182), 13, { fill: C.fur2, paw: [9, 4.5] });
      R.limb(line(162, 138, 168, 181), 13, { fill: C.fur2, paw: [9, 4.5] });
      R.open(btfY(o, 132)); R.open('rotate(-6 126 132)');
      R.part(ell(126, 132, 46, 22), { patches: spots([[120, 122, 13, 0], [146, 140, 9, 1], [100, 142, 8, 0]]) });
      R.close(); R.close();
      R.part(ell(152, 140, 17, 20), { edge: true, patches: spots([[156, 148, 8, 0]]) });
      R.limb(line(150, 148, 150, 183), 13, { edge: true, paw: [9, 4.5], toes: true });
      R.limb(line(104, 144, 102, 183), 13, { edge: true, paw: [9, 4.5], toes: true });
      tail(R, [168, 126, 184, 112, 184, 88, 194, 78]);
      head(R, 66, 148, 0.88, -22, H(e, { eyes: o.mood === 'happy' ? 'happy' : 'closed', mouth: 'cat' }));
      if (!o.noProp) R.top.push(`<g transform="translate(28 134) scale(.6)">${ITEMS.bowlFull()}</g>`);
      R.region('back', ellPoly(126, 132, 46, 22, -6), [1, 0]);
      R.mid = [126, 128];
    },
    drink(R, o, e) {
      const BODY = 'M66 178C66 152 98 136 132 138C164 140 182 160 177 180C176 186 162 186 150 186L80 186C70 186 66 184 66 178Z';
      R.open(btfY(o, 186));
      R.part(BODY, { patches: spots([[130, 148, 13, 0], [158, 162, 9, 1], [100, 160, 8, 0]]) });
      R.part(ell(152, 166, 22, 18), { edge: true, patches: spots([[148, 172, 8, 0]]) });
      R.close();
      tail(R, [174, 180, 186, 188, 196, 184, 199, 172]);
      paw(R, 80, 184, 10, 4.5, { toes: true }); paw(R, 98, 185, 10, 4.5, { toes: true });
      head(R, 58, 158, 0.84, -16, H(e, { eyes: 'closed', mouth: 'cat', blush: false }));
      if (!o.noProp) R.top.push(`<g transform="translate(20 140) scale(.54)">${ITEMS.waterBowl()}</g>`);
      R.region('back', BODY, [1, 0]);
      R.mid = [130, 160];
    },
    belly(R, o, e) {
      const BODY = 'M44 170C44 146 80 136 116 138C152 140 178 150 178 170C178 182 160 186 116 186L72 186C54 186 44 182 44 170Z';
      R.open(btfY(o, 186));
      R.part(BODY, { patches: spots([[110, 154, 20, 1], [138, 162, 12, 0], [86, 162, 10, 1], [150, 148, 7, 1]]) });
      R.close();
      R.limb([84, 148, 80, 140, 79, 132, 82, 124], 12, { edge: true, paw: [8, 7] });
      R.limb([102, 144, 101, 136, 102, 128, 107, 121], 12, { edge: true, paw: [8, 7] });
      R.limb([138, 148, 140, 128, 148, 118, 157, 118], 13, { edge: true, paw: [9, 8], beans: true });
      R.limb([158, 152, 166, 136, 176, 128, 185, 132], 13, { edge: true, paw: [9, 8], beans: true });
      tail(R, [176, 176, 186, 180, 192, 186, 199, 181]);
      head(R, 54, 152, 0.82, -62, e);
      R.region('belly', ellPoly(118, 160, 50, 20), [1, 0]);
      R.region('back', BODY, [1, 0]);
      R.mid = [118, 160];
    },
    walk(R, o, e) { gait(R, o, e, 'walk'); },
    walk1(R, o, e) { gait(R, o, e, 'walk', 0); },
    walk2(R, o, e) { gait(R, o, e, 'walk', 0.25); },
    walk3(R, o, e) { gait(R, o, e, 'walk', 0.5); },
    walk4(R, o, e) { gait(R, o, e, 'walk', 0.75); },
    trot(R, o, e) { gait(R, o, e, 'trot'); },
    crouch(R, o, e) { crouch(R, o, e); },
    jumpUp(R, o, e) { jump(R, o, e, true); },
    jumpDown(R, o, e) { jump(R, o, e, false); },
    climb(R, o, e) { climb(R, o, e); },
    onBranch(R, o, e) { onBranch(R, o, e); },
    stalk(R, o, e) { stalk(R, o, e); },
    shakePaw(R, o, e) { shakePaw(R, o, e); },
    lapLoaf(R, o, e) { POSES.loaf(R, o, e); },
    lapCurl(R, o, e) { POSES.sleep(R, o, e); },
    lapBelly(R, o, e) { POSES.belly(R, o, e); },
    trickSit(R, o, e) {
      sitBody(R, o, false); frontLegs(R, true); tail(R, TAIL_SIT.calm);
      head(R, 100, 69, 1, 0, H(e, { eyes: e.eyes === 'closed' || o.ill ? e.eyes : 'open', ears: o.ears || 'up', blush: false }));
    },
    trickPaw(R, o, e) {
      sitBody(R, o, false); frontLegs(R, false); tail(R, TAIL_SIT.calm);
      R.limb([112, 112, 118, 116, 124, 118, 128, 120], 16, {});
      paw(R, 130, 120, 14, 13, { beans: true });
      head(R, 100, 70, 1, -6, H(e, { eyes: e.eyes === 'closed' || o.ill ? e.eyes : e.eyes === 'grumpy' ? 'grumpy' : 'open', ears: o.ears || 'up' }));
    },
    trickSpin(R, o, e) { gait(R, o, e, 'walk'); R.wrap = { cls: 'kx-spin', ox: 118, oy: 186 }; },
    trickBeg(R, o, e) {
      R.part(ell(64, 183, 13, 5), { edge: true }); R.part(ell(136, 183, 13, 5), { edge: true });
      const BODY = 'M78 84C66 110 64 150 70 174C78 188 122 188 130 174C136 150 134 110 122 84Z';
      R.open(btfX(o, 100));
      R.part(BODY, { patches: spots([[114, 120, 13, 0], [86, 150, 11, 1], [110, 166, 7, 0]]) });
      R.part(ell(74, 168, 15, 18), { edge: true, patches: spots([[70, 174, 8, 0]]) });
      R.part(ell(126, 168, 15, 18), { edge: true });
      R.close();
      tail(R, [132, 180, 152, 188, 174, 186, 186, 176]);
      R.limb([90, 108, 84, 116, 84, 124, 90, 128], 12, { edge: true, paw: [8, 7], beans: true });
      R.limb([110, 108, 116, 116, 116, 124, 110, 128], 12, { edge: true, paw: [8, 7], beans: true });
      head(R, 100, 58, 0.94, 0, H(e, { eyes: e.eyes === 'closed' || o.ill ? e.eyes : e.eyes === 'grumpy' ? 'grumpy' : 'wide', ears: o.ears || 'up' }));
      R.region('back', BODY, [0, 1]);
      R.mid = [100, 130];
    },
    // in a cardboard box: only her head, ears and two paws on the rim show
    inBox(R, o, e) {
      R.shadow = [100, 186, 66, 5];
      R.raw(`<path d="M46 122L40 92H160L154 122Z" fill="#a8783e" stroke="${IO}" stroke-width="2.5" stroke-linejoin="round"/>`);
      head(R, 100, 102, 1, 0, e);
      R.reg = R.reg.filter(g => g.id !== 'chin');
      R.raw(BOX_FRONT);
      paw(R, 82, 122, 10, 6, { toes: true }); paw(R, 118, 122, 10, 6, { toes: true });
      R.mid = [100, 110];
    },
    // a visitor sitting on the fence top, tail hanging down
    onFence(R, o, e) {
      R.shadow = null;
      sitBody(R, o, false); frontLegs(R, true);
      tail(R, [128, 180, 134, 190, 132, 196, 138, 200]);
      head(R, 100, 70, 1, -6, e);
    },
    carried(R, o, e) { hang(R, o, e, false); },
    wriggle(R, o, e) { hang(R, o, e, true); },
  };
  /* ---------- gait: walk, trot, jumps (side view, facing left; flip the box with scaleX(-1) to go right) ---------- */
  // One leg: the upper part swings at the shoulder / hip (px, py), the lower part bends at the knee. Animated legs get
  // the classes kx-leg / kx-knee and a phase class (kx-phA or kx-phB, half a step apart); still frames get angles.
  function leg(R, px, py, l1, l2, w, q) {
    const fill = q.far ? C.fur2 : undefined, ky = py + l1;
    R.open(q.swing ? `rotate(${r1(q.swing)} ${px} ${py})` : '', q.ph ? `kx-leg ${q.ph}` : '', px, py);
    R.limb(line(px, py, px, ky), w, { fill, edge: !q.far });
    R.open(q.knee ? `rotate(${r1(q.knee)} ${px} ${ky})` : '', q.ph ? `kx-knee ${q.ph}` : '', px, ky);
    R.limb(line(px, ky, px, ky + l2), w - 1, { fill, edge: !q.far, paw: [w * 0.68, 4.5], toes: !q.far });
    R.close(); R.close();
  }
  // the same curves as the CSS keyframes (kx-stride / kx-bend and the trot ones), for still frames: t = 0..1 of a step
  const STRIDE = { walk: [18, 0.6, 50], trot: [28, 0.5, 70] };   // [swing degrees, stance part, knee degrees]
  function legAngles(mode, t) {
    const [a, stance, kn] = STRIDE[mode];
    t = ((t % 1) + 1) % 1;
    const swing = t < stance ? a - 2 * a * t / stance : t < stance + 0.2 ? -a + a * (t - stance) / 0.2 : a * (t - stance - 0.2) / (0.8 - stance);
    const k1 = stance - 0.02, k2 = stance + 0.15, k3 = 0.95;
    const knee = t < k1 || t > k3 ? 0 : t < k2 ? -kn * (t - k1) / (k2 - k1) : -kn + kn * (t - k2) / (k3 - k2);
    return { swing, knee };
  }
  // mode 'walk' / 'trot' (animated by CSS, step time = --kx-step) or a still frame t (0..1) of the walk
  function gait(R, o, e, mode, t) {
    const trot = mode === 'trot', still = t != null;
    R.cls = still ? '' : trot ? 'kx-gait kx-trot' : 'kx-gait';
    R.shadow = [118, 186, 56, 5];
    const ph = k => (still ? Object.assign({}, legAngles('walk', t + (k ? 0.5 : 0))) : { ph: k ? 'kx-phB' : 'kx-phA' });
    const sh = trot ? [92, 126] : [96, 128], hip = trot ? [148, 124] : [146, 128];
    // far legs (behind the body): front B, hind A; near legs: front A, hind B (diagonal pairs move together)
    leg(R, sh[0] + 4, sh[1] + 4, 25, 28, 12, Object.assign({ far: true }, ph(1)));
    leg(R, hip[0] - 3, hip[1] + 4, 23, 30, 13, Object.assign({ far: true }, ph(0)));
    R.open('', still ? '' : 'kx-bobber', 118, 186);
    R.open(btfY(o, 128));
    R.part(trot ? ell(120, 124, 52, 19) : ell(120, 128, 48, 21), { patches: spots([[118, 120, 13, 1], [146, 132, 9, 0], [96, 136, 8, 0]]) });
    R.close();
    R.part(ell(hip[0] + 2, hip[1] + 4, 17, 19), { edge: true, patches: spots([[152, 140, 8, 0]]) });
    tail(R, trot ? [166, 118, 182, 114, 192, 112, 199, 102] : [164, 120, 182, 106, 182, 82, 192, 72]);
    R.close();
    leg(R, hip[0] + 2, hip[1] + 8, 22, 30, 13, ph(1));
    leg(R, sh[0], sh[1] + 6, 24, 27, 12, ph(0));
    head(R, trot ? 62 : 66, trot ? 112 : 110, 0.88, trot ? -2 : -6, trot ? H(e, { eyes: o.asleep || o.ill ? e.eyes : 'wide', ears: o.ears || 'up' }) : e);
    R.region('back', trot ? ellPoly(120, 124, 52, 19) : ellPoly(120, 128, 48, 21), [1, 0]);
    R.mid = [120, 126];
  }
  // a crouch before a jump, looking up
  function crouch(R, o, e) {
    const BODY = 'M64 178C62 150 96 132 132 134C164 136 182 156 178 178C177 186 162 186 150 186L78 186C68 186 64 184 64 178Z';
    R.open(btfY(o, 186));
    R.part(BODY, { patches: spots([[128, 146, 13, 0], [158, 160, 9, 1], [100, 160, 8, 0]]) });
    R.part(ell(152, 160, 22, 20), { edge: true, patches: spots([[148, 168, 8, 0]]) });
    R.close();
    tail(R, [176, 178, 188, 184, 196, 180, 199, 170]);
    paw(R, 80, 184, 10, 4.5, { toes: true }); paw(R, 98, 185, 10, 4.5, { toes: true });
    head(R, 66, 130, 0.88, -14, H(e, { eyes: e.eyes === 'happy' ? 'open' : e.eyes, ears: o.ears || 'up' }));
    R.region('back', BODY, [1, 0]);
    R.mid = [130, 160];
  }
  // in the air: up (front first, hind legs pushing off) or down (front legs reaching for the ground)
  function jump(R, o, e, up) {
    const rot = up ? 34 : -26, cx = up ? 110 : 112, cy = up ? 108 : 112;
    R.shadow = up ? [124, 186, 40, 4] : [96, 186, 44, 4.5];
    if (up) {
      R.limb([142, 134, 150, 152, 156, 168, 162, 184], 12, { fill: C.fur2, paw: [8, 5] });
      R.limb(line(90, 100, 50, 100), 11, { fill: C.fur2, paw: [8, 6] });
    } else {
      R.limb(line(92, 128, 80, 183), 11, { fill: C.fur2, paw: [8.5, 4.5] });
      R.limb([146, 100, 160, 100, 166, 110, 160, 120], 12, { fill: C.fur2, paw: [8, 6] });
    }
    R.open(`rotate(${rot} ${cx} ${cy})`);
    R.part(ell(cx, cy, 50, up ? 19 : 20), { patches: spots([[cx, cy - 8, 13, 1], [cx + 28, cy + 4, 9, 0], [cx - 24, cy + 6, 8, 0]]) });
    R.close();
    if (up) {
      R.part(ell(146, 128, 16, 17), { edge: true });
      R.limb([148, 130, 158, 148, 166, 164, 174, 182], 13, { edge: true, paw: [9, 5], toes: true });
      tail(R, [154, 122, 170, 130, 184, 140, 198, 150]);
      R.limb([84, 92, 70, 90, 56, 88, 42, 86], 12, { edge: true, paw: [8.5, 6], toes: true });
      head(R, 66, 58, 0.84, -24, H(e, { ears: o.ears || 'up' }));
    } else {
      R.part(ell(150, 96, 15, 16), { edge: true });
      R.limb([152, 98, 168, 98, 174, 110, 170, 120], 13, { edge: true, paw: [8.5, 6] });
      tail(R, [156, 92, 168, 74, 180, 66, 192, 52]);
      R.limb(line(80, 126, 64, 183), 12, { edge: true, paw: [9, 4.5], toes: true });
      head(R, 58, 114, 0.86, 8, e);
    }
    const a = rot * Math.PI / 180;
    R.region('back', ellPoly(cx, cy, 50, 20, rot), [r2(Math.cos(a)), r2(Math.sin(a))]);
    R.mid = [cx, cy];
  }

  /* ---------- outdoor poses ---------- */
  // clinging to the tree trunk, seen from behind, looking back at you; place (100, 112) on the trunk
  function climb(R, o, e) {
    R.shadow = null;
    const BODY = 'M80 84C68 104 70 140 80 160C88 174 112 174 120 160C130 140 132 104 120 84Z';
    for (const l of [[86, 150, 78, 156, 70, 162, 60, 166], [114, 150, 122, 156, 130, 162, 140, 166]]) R.limb(l, 13, { edge: true, paw: [8, 6] });
    R.open(btfX(o, 100));
    R.part(BODY, { patches: spots([[110, 110, 13, 0], [88, 136, 11, 1], [112, 154, 8, 0]]) });
    R.close();
    tail(R, [100, 166, 100, 180, 96, 190, 101, 199]);
    for (const l of [[88, 92, 78, 86, 70, 80, 60, 72], [112, 92, 122, 86, 130, 80, 140, 72]]) R.limb(l, 12, { edge: true, paw: [8, 6.5] });
    head(R, 100, 60, 0.88, 0, e);
    R.region('back', BODY, [0, 1]);
    R.mid = [100, 120];
  }
  // lying along a branch, legs and tail hanging down; place (100, 150) on the branch
  function onBranch(R, o, e) {
    R.shadow = null;
    R.limb([82, 140, 84, 154, 82, 166, 84, 178], 11, { fill: C.fur2, paw: [7.5, 5] });
    R.open(btfY(o, 150));
    R.part(ell(112, 132, 56, 19), { patches: spots([[120, 124, 14, 1], [150, 134, 10, 0], [90, 140, 8, 0]]) });
    R.close();
    R.limb([150, 140, 150, 154, 150, 166, 152, 178], 12, { edge: true, paw: [8, 5], toes: true });
    tail(R, [166, 136, 178, 152, 174, 172, 182, 190]);
    R.limb([72, 140, 72, 154, 70, 166, 72, 180], 11, { edge: true, paw: [8, 5], toes: true });
    head(R, 58, 124, 0.86, -4, e);
    R.region('back', ellPoly(112, 132, 56, 19), [1, 0]);
    R.mid = [112, 132];
  }
  // stalking a bird: very low, eyes on the prey, the tail tip twitching
  function stalk(R, o, e) {
    const BODY = 'M52 176C56 156 92 148 128 148C160 148 178 158 178 174C178 184 166 186 150 186L68 186C56 186 50 184 52 176Z';
    R.open(btfY(o, 186));
    R.part(BODY, { patches: spots([[122, 158, 13, 0], [154, 166, 9, 1], [92, 168, 8, 0]]) });
    R.part(ell(152, 158, 22, 19), { edge: true, patches: spots([[150, 166, 8, 0]]) });
    R.close();
    tail(R, [176, 172, 188, 176, 196, 178, 199, 168], 13, 'kx-tw');
    paw(R, 46, 184, 10, 4.5, { toes: true }); paw(R, 66, 185, 10, 4.5, { toes: true });
    head(R, 54, 158, 0.84, -4, H(e, { eyes: o.asleep || o.ill ? e.eyes : 'wide', ears: o.ears || 'up', mouth: 'flat', blush: false }));
    R.region('back', BODY, [1, 0]);
    R.mid = [126, 166];
  }
  // sitting, one front paw lifted and shaken (snow or rain on it)
  function shakePaw(R, o, e) {
    sitBody(R, o, false);
    tail(R, TAIL_SIT.calm);
    R.limb(line(88, 112, 87, 177), 15, { paw: [10, 6.5], toes: true });
    R.open('', 'kx-shakep', 114, 118);
    R.limb([114, 116, 122, 126, 128, 134, 132, 140], 14, { edge: true, paw: [9, 7] });
    R.close();
    head(R, 100, 70, 1, 6, H(e, { ears: o.ears || 'back', eyes: e.eyes === 'happy' ? 'open' : e.eyes }));
    const drop = (x, y) => o.wet ? `<path d="M${x} ${y}q2.4 4 0 5.8q-2.4-1.8 0-5.8z" fill="#a9d8f2" stroke="#2e2118" stroke-width=".8"/>` : `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" stroke="#2e2118" stroke-width=".8"/>`;
    R.top.push(`<g class="kx-flick">${drop(146, 130) + drop(152, 144) + drop(142, 152) + drop(156, 126)}</g>`);
    R.mid = [100, 140];
  }
  // held under the front legs (carried) or twisting to get down (wriggle)
  function hang(R, o, e, wr) {
    R.shadow = null;
    R.wrap = wr ? { cls: 'kx-wrig', ox: 100, oy: 60 } : { cls: 'kx-swing', ox: 100, oy: 60 };
    const BODY = 'M79 80C69 104 71 140 81 164C87 178 113 178 119 164C129 140 131 104 121 80Z';
    const legs = wr
      ? [[90, 158, 80, 168, 70, 176, 60, 180], [110, 158, 122, 166, 134, 168, 146, 164]]
      : [[90, 160, 88, 172, 86, 182, 84, 191], [110, 160, 112, 172, 114, 182, 116, 191]];
    for (const l of legs) R.limb(l, 13, { edge: true, paw: [8, 6], beans: wr });
    R.open(btfX(o, 100));
    R.part(BODY, { patches: spots([[110, 110, 12, 0], [88, 140, 10, 1], [112, 156, 7, 0]]) });
    R.close();
    tail(R, wr ? [100, 168, 112, 180, 126, 186, 138, 178] : [100, 168, 101, 182, 96, 190, 103, 198], wr ? 18 : 13);
    const arms = wr
      ? [[86, 84, 74, 74, 64, 62, 58, 50], [114, 84, 126, 90, 136, 98, 146, 106]]
      : [[86, 84, 76, 78, 66, 72, 56, 68], [114, 84, 124, 78, 134, 72, 144, 68]];
    for (const l of arms) R.limb(l, 12, { edge: true, paw: [8, 7], beans: true });
    head(R, 100, 54, 0.9, wr ? -8 : 0, wr ? H(e, { eyes: o.mood === 'happy' ? 'open' : 'grumpy', ears: o.ears || 'back', mouth: 'meow', blush: false }) : e);
    if (wr) R.top.push(`<path d="M44 116q-8 14 0 28M36 110q-10 20 0 40M156 116q8 14 0 28M164 110q10 20 0 40" fill="none" stroke="#2e2118" stroke-width="5" stroke-linecap="round"/><path d="M44 116q-8 14 0 28M36 110q-10 20 0 40M156 116q8 14 0 28M164 110q10 20 0 40" fill="none" stroke="${C.ol}" stroke-width="2.4" stroke-linecap="round"/>`);
    R.region('back', BODY, [0, 1]);
    R.mid = [100, 120];
  }

  /* ---------- the cat ---------- */
  function opts(x) {
    const o = typeof x === 'string' ? { mood: x } : Object.assign({}, x);
    if (!MOODS.includes(o.mood)) o.mood = 'calm';
    return o;
  }
  // the lap poses are loaf / sleep / belly drawn bigger: [scale, centre x, y, new centre x, y]
  const LAPZ = { lapLoaf: [1.25, 108, 137, 100, 122], lapCurl: [1.2, 102, 146, 100, 128], lapBelly: [1.05, 104, 150, 100, 132] };
  function build(pose, o) {
    if (!POSES[pose]) pose = 'sit';
    if (pose === 'sleep' || pose === 'lapCurl') o.asleep = true;
    const R = Rig(o);
    POSES[pose](R, o, expr(o));
    if (LAPZ[pose]) { R.zoom = LAPZ[pose]; R.shadow = null; }
    return { R, pose };
  }
  const zoomPt = (z, x, y) => [r1(z[3] + z[0] * (x - z[1])), r1(z[4] + z[0] * (y - z[2]))];
  // region paths use only absolute M/L/C/Z, so every pair of numbers is a point
  const zoomPath = (z, d) => { let i = 0; return d.replace(/-?\d*\.?\d+/g, m => String(i++ % 2 ? r1(z[4] + z[0] * (m - z[2])) : r1(z[3] + z[0] * (m - z[1])))); };
  const outlined = (s, w) => `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${s}" stroke="#2e2118" stroke-width="${w + 2.6}"/><path d="${s}" stroke="${C.ol}" stroke-width="${w}"/></g>`;
  function cat(pose, x) {
    const o = opts(x), { R, pose: p } = build(pose, o);
    if (o.asleep) {
      const [mx] = R.mid || [100, 140], curl = p === 'sleep' || p === 'lapCurl', zx = curl ? 92 : mx - 6, zy = curl ? 112 : 40;
      R.top.push([[0, 0, 1, 0], [10, -12, 1.25, 1], [22, -26, 1.5, 2]].map(([dx, dy, k, d]) =>
        `<g class="kx-z" style="animation-delay:${d}s">${outlined(`M${zx + dx} ${zy + dy}h${7 * k}l${-7 * k} ${8 * k}h${7 * k}`, 2.2)}</g>`).join(''));
    }
    if (o.ill === 'fleas') {
      const [mx, my] = R.mid || [100, 140];
      R.top.push(`<g class="kx-fleas">${[[-22, -20, 0], [14, -28, 0.5], [28, 2, 0.9], [-6, 8, 1.3]].map(([dx, dy, d]) =>
        `<circle cx="${mx + dx}" cy="${my + dy}" r="2.3" fill="#7a2e12" stroke="${C.ol}" stroke-width="1" style="animation-delay:${d}s"/>`).join('')}</g>` +
        `<g class="kx-scr">${outlined(`M${mx + 30} ${my - 30}l5 -5l2 6l5 -5`, 1.8)}</g>`);
    }
    let olF = '', fiF = '';
    if (o.wet) {   // wet: the outline turns spiky, the coat darker, drops fall off her
      const f = nid(), g = nid(), [mx, my] = R.mid || [100, 140];
      R.defs.push(`<filter id="${f}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="1" seed="4"/><feDisplacementMap in="SourceGraphic" scale="6" xChannelSelector="R" yChannelSelector="G"/></filter>` +
        `<filter id="${g}"><feColorMatrix type="matrix" values=".72 0 0 0 0 0 .76 0 0 0 0 0 .86 0 0 0 0 0 1 0"/></filter>`);
      olF = ` filter="url(#${f})"`; fiF = ` filter="url(#${g})"`;
      R.top.push(`<g class="kx-drip">${[[-30, 24, 0], [6, 30, 0.6], [34, 22, 1.1]].map(([dx, dy, d]) => `<path d="M${mx + dx} ${my + dy}q2.6 4.4 0 6.4q-2.6-2 0-6.4z" fill="#a9d8f2" stroke="#2e2118" stroke-width=".8" style="animation-delay:${d}s"/>`).join('')}</g>`);
    }
    if (COAT.fluff && !o.wet) {
      const f = nid();
      R.defs.push(`<filter id="${f}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="1" seed="7"/><feDisplacementMap in="SourceGraphic" scale="${COAT.fluff}" xChannelSelector="R" yChannelSelector="G"/></filter>`);
      olF = ` filter="url(#${f})"`;
    }
    let inner = `<g${olF}>${R.ol.join('')}</g><g${fiF}>${R.fi.join('')}</g>${R.top.join('')}`;
    if (R.wrap) inner = `<g class="${R.wrap.cls}" style="transform-origin:${R.wrap.ox}px ${R.wrap.oy}px">${inner}</g>`;
    if (R.zoom) inner = `<g transform="translate(${R.zoom[3]} ${R.zoom[4]}) scale(${R.zoom[0]}) translate(${-R.zoom[1]} ${-R.zoom[2]})">${inner}</g>`;
    if (COAT.size) inner = `<g transform="translate(100 186) scale(${COAT.size}) translate(-100 -186)">${inner}</g>`;
    if (o.purring) inner = `<g class="kx-purr">${inner}</g>`;
    const sh = R.shadow ? `<ellipse cx="${R.shadow[0]}" cy="${R.shadow[1]}" rx="${R.shadow[2]}" ry="${R.shadow[3]}" fill="#000" opacity=".18"/>` : '';
    const cls = ['koxa', 'kx-m-' + o.mood, 'kx-p-' + p, o.asleep ? 'kx-asleep' : '', o.wet ? 'kx-wet' : '', R.cls || ''].filter(Boolean).join(' ');
    return `<svg class="${cls}" viewBox="0 0 200 200" aria-hidden="true"><defs>${R.defs.join('')}</defs>${sh}${inner}</svg>`;
  }
  // poses that do not stand on (100, 186): the point of her box to put on the spot
  const ANCHORS = { onBranch: [100, 150], climb: [100, 112], carried: [100, 60], wriggle: [100, 60] };
  const ORDER = ['chin', 'tail', 'paws', 'head', 'ears', 'tailBase', 'belly', 'back'];
  function regions(pose, x) {
    const { R } = build(pose, opts(x)), by = {};
    // tailBase (kořen ocasu): an oval on the body just in front of the tail root, fur from the body's middle to the root
    if (R.tailRoot && R.mid && R.reg.some(g => g.id === 'back')) {
      const [tx, ty] = R.tailRoot, [dx, dy] = unit(tx - R.mid[0], ty - R.mid[1]);
      R.region('tailBase', ellPoly(tx - dx * 22, ty - dy * 22, 25, 15, Math.atan2(dy, dx) * 180 / Math.PI), [dx, dy]);
    }
    for (const g of R.reg) {
      const path = R.zoom ? zoomPath(R.zoom, g.path) : g.path;
      if (by[g.id]) by[g.id].path += path; else by[g.id] = { id: g.id, path, fur: g.fur };
    }
    return ORDER.filter(id => by[id]).map(id => by[id]);
  }
  // where her mouth is (the middle of the open mouth) in the cat's viewBox, or null when she faces away
  function mouth(pose, x) {
    const { R } = build(pose, opts(x));
    if (!R.mouthPt) return null;
    const [x0, y0] = R.zoom ? zoomPt(R.zoom, R.mouthPt[0], R.mouthPt[1]) : R.mouthPt;
    return { x: x0, y: y0 };
  }
  function face(mood) {
    const o = opts(mood), R = Rig(o);
    head(R, 32, 37, 0.6, 0, expr(o));
    return `<svg class="koxa kx-face kx-m-${o.mood}" viewBox="0 0 64 64" aria-hidden="true"><defs>${R.defs.join('')}</defs><g>${R.ol.join('')}</g><g>${R.fi.join('')}</g></svg>`;
  }

  /* ---------- items (viewBox 0 0 100 100, standing on y≈90) ---------- */
  const IO = '#2e2118', st = (w = 3) => ` stroke="${IO}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  let held = false;   // itemHeld(): no shadow on the ground
  const groundShadow = (rx = 36) => held ? '' : `<ellipse cx="50" cy="90" rx="${rx}" ry="4.5" fill="#000" opacity=".16"/>`;
  const quiet = fn => { const h = held; held = true; try { return fn(); } finally { held = h; } };   // an item without its ground shadow
  const PAWMARK = (x, y, k, col) => `<g transform="translate(${x} ${y}) scale(${k})" fill="${col}"><ellipse cx="0" cy="3" rx="6" ry="5"/><ellipse cx="-7.5" cy="-4" rx="2.6" ry="3.3"/><ellipse cx="-2.6" cy="-8.5" rx="2.6" ry="3.3"/><ellipse cx="2.6" cy="-8.5" rx="2.6" ry="3.3"/><ellipse cx="7.5" cy="-4" rx="2.6" ry="3.3"/></g>`;
  const FEATHERS = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})">` + [[-18, '#3fa3a0'], [0, '#e8892b'], [18, '#e05a7a']].map(([a, col]) =>
    `<g transform="rotate(${a})"><path d="M0 0C10 8 12 26 4 42C-4 28 -6 12 0 0Z" fill="${col}" stroke="${IO}" stroke-width="2"/><path d="M1 4Q4 22 4 40" stroke="#fff" stroke-width="1.4" fill="none" opacity=".7"/></g>`).join('') + '</g>';
  const BOX_FRONT = `<path d="M38 120H162L156 186H44Z" fill="#c99a5e"${st()}/><path d="M38 120L14 102L22 94L46 112Z" fill="#d8ab6c"${st(2.5)}/><path d="M162 120L186 102L178 94L154 112Z" fill="#d8ab6c"${st(2.5)}/><path d="M60 152H140" stroke="#a8783e" stroke-width="3"/><path d="M96 121V142" stroke="#e8c88a" stroke-width="7"/>`;
  function bowl(c, inner, fill = '') {
    return groundShadow() + `<path d="M12 60H88L80 86Q50 92 20 86Z" fill="${c}"${st()}/><ellipse cx="50" cy="60" rx="38" ry="9" fill="${inner}"${st()}/>${fill || empty(inner)}` +
      `<path d="M24 73Q50 79 76 73" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none"/><path d="M45 79l2-3 2 3 2-3" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  }
  // the bare bottom of an empty bowl: a lighter floor inside the rim
  const empty = inner => `<ellipse cx="50" cy="62.5" rx="26" ry="5" fill="#fff" opacity=".22"/><ellipse cx="50" cy="62.5" rx="26" ry="5" fill="none" stroke="${inner}" stroke-width="1.5"/>`;
  const kibble = '<g fill="#7d4a1e"><circle cx="34" cy="54" r="3"/><circle cx="46" cy="49" r="3"/><circle cx="58" cy="52" r="3"/><circle cx="68" cy="56" r="3"/><circle cx="52" cy="57" r="3"/></g><g fill="#d39a58"><circle cx="40" cy="56" r="2.6"/><circle cx="62" cy="47" r="2.6"/><circle cx="54" cy="43" r="2.4"/></g>';
  function litterBox(dirty) {
    return groundShadow(46) + `<path d="M4 58H96L90 88H10Z" fill="#5c8fa3"${st()}/><ellipse cx="50" cy="58" rx="46" ry="10" fill="#e5d29f"${st()}/>` +
      '<g fill="#c9b07a"><circle cx="30" cy="57" r="1.6"/><circle cx="62" cy="55" r="1.6"/><circle cx="72" cy="60" r="1.6"/><circle cx="42" cy="61" r="1.6"/></g>' +
      `<path d="M10 74H90" stroke="#4a7688" stroke-width="3"/>` +
      (dirty ? `<g fill="#8a6239"${st(2)}><ellipse cx="38" cy="57" rx="8" ry="4"/><ellipse cx="62" cy="58" rx="7" ry="3.6"/></g><g fill="none" stroke="#7d9150" stroke-width="3.2" stroke-linecap="round"><path d="M36 44q-6-7 0-13t0-13"/><path d="M52 42q-6-7 0-13t0-13"/><path d="M68 44q-6-7 0-13t0-13"/></g>` : '');
  }
  function toyMouse(body, ear, extra = '') {
    return groundShadow(28) + `<path d="M24 78Q6 76 8 62Q10 50 22 52" fill="none" stroke="#6f6f6f" stroke-width="3" stroke-linecap="round"/><path d="M22 80Q20 56 46 54Q70 54 78 80Z" fill="${body}"${st()}/>` +
      `<circle cx="58" cy="54" r="9" fill="${ear}"${st(2.5)}/><circle cx="58" cy="54" r="4.5" fill="#e6a2a8"/><circle cx="68" cy="66" r="2.6" fill="${IO}"/><circle cx="78" cy="78" r="3" fill="#e6a2a8"${st(1.5)}/><path d="M76 74l12-4M76 78l12 1" stroke="${IO}" stroke-width="1.4"/>` + extra;
  }
  // a small fish sign (food labels), centre (x, y), size k
  const fishMark = (x, y, k, c) => `<g transform="translate(${x} ${y}) scale(${k})" fill="${c}"><path d="M-14 0Q-4 -9 9 0Q-4 9 -14 0Z"/><path d="M8 0L16 -6V6Z"/></g>`;
  const ITEMS = {
    bowl: () => bowl('#b5452c', '#6e2618'),
    bowlEmpty: () => bowl('#b5452c', '#6e2618', empty('#6e2618') + '<g fill="#a8692f"><circle cx="40" cy="62" r="1.8"/><circle cx="58" cy="63.5" r="1.6"/></g>'),
    waterBowlEmpty: () => bowl('#3f78a8', '#2c5a80', empty('#2c5a80') + '<path d="M60 60.5q1.6 2.6 0 3.8q-1.6-1.2 0-3.8z" fill="#9fd4f2"/>'),
    bowlFull: () => bowl('#b5452c', '#6e2618', `<path d="M17 60Q24 44 50 42Q76 44 83 60Q50 68 17 60Z" fill="#a8692f"${st(2.5)}/>` + kibble),
    waterBowl: () => bowl('#3f78a8', '#2c5a80', '<ellipse cx="50" cy="61" rx="33" ry="6.5" fill="#9fd4f2"/><path d="M34 60q8-3 16 0M58 63q6-2 10 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>'),
    litter: () => litterBox(false),
    litterDirty: () => litterBox(true),
    bed: () => groundShadow(46) + `<ellipse cx="50" cy="72" rx="46" ry="18" fill="#b07a3a"${st()}/><ellipse cx="50" cy="66" rx="36" ry="11" fill="#c8574a"${st(2.5)}/><path d="M30 62q20-6 40 0" stroke="#e8897a" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      `<path d="M6 74Q50 98 94 74" fill="none"${st(5)}/><path d="M6 74Q50 98 94 74" fill="none" stroke="#c99052" stroke-width="2.5" stroke-dasharray="5 4"/>`,
    mouse: () => toyMouse('#9b9b9b', '#b9b9b9'),
    catnipMouse: () => toyMouse('#77b35c', '#9dd07f', `<path d="M36 56Q30 40 44 34Q48 48 36 56Z" fill="#3f8a3a"${st(2)}/><path d="M37 54Q40 44 44 36" stroke="#cfe8b8" stroke-width="1.4" fill="none"/>`),
    feather: () => `<path d="M8 94L56 18" stroke="#8a5a32" stroke-width="5" stroke-linecap="round"/><path d="M56 18Q78 22 76 44" fill="none" stroke="#555" stroke-width="1.6"/>` +
      `<path d="M76 44C90 54 92 74 80 92C68 76 66 58 76 44Z" fill="#3fa3a0"${st(2.5)}/><path d="M77 48Q80 70 80 90" stroke="#e8f4f2" stroke-width="1.6" fill="none"/><path d="M76 46C64 54 60 68 64 80C72 70 76 58 76 46Z" fill="#e8892b"${st(2)}/>`,
    yarn: () => groundShadow(26) + `<path d="M72 80Q86 92 97 84" fill="none" stroke="#c8423a" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="62" r="27" fill="#c8423a"${st()}/>` +
      '<g fill="none" stroke="#ec7a68" stroke-width="2.4" stroke-linecap="round"><path d="M30 48Q50 62 46 88"/><path d="M38 40Q62 58 62 86"/><path d="M26 66Q48 58 74 70"/><path d="M58 38Q66 50 76 54"/></g>',
    laserDot: () => '<g class="kx-laser" style="transform-origin:50px 50px"><circle cx="50" cy="50" r="24" fill="#ff2a2a" opacity=".18"/><circle cx="50" cy="50" r="14" fill="#ff2a2a" opacity=".4"/><circle cx="50" cy="50" r="7" fill="#ff3b2f"/><circle cx="50" cy="50" r="3" fill="#fff"/></g>',
    treat: () => `<path d="M64 56L84 42V70Z" fill="#d88f3f"${st()}/><path d="M14 56Q38 34 66 56Q38 78 14 56Z" fill="#e7a752"${st()}/><circle cx="26" cy="53" r="2.6" fill="${IO}"/><path d="M40 48q4 8 0 16M50 49q4 7 0 14" stroke="#b97a32" stroke-width="2" fill="none"/>`,
    foodBag: () => groundShadow(34) + `<path d="M22 30L28 14H72L78 30L83 90H17Z" fill="#d98b2b"${st()}/><path d="M22 30H78" stroke="${IO}" stroke-width="3"/><path d="M28 14L32 30M72 14L68 30" stroke="#b56f1f" stroke-width="2"/>` +
      `<circle cx="50" cy="60" r="18" fill="#f4e6c8"${st(2.5)}/><path d="M60 60L70 53V67Z" fill="#3f78a8"/><path d="M34 60Q46 50 61 60Q46 70 34 60Z" fill="#3f78a8"/><circle cx="40" cy="58" r="1.6" fill="#fff"/>`,
    jug: () => groundShadow(26) + `<path d="M70 40Q92 46 70 74" fill="none"${st(8)}/><path d="M70 40Q92 46 70 74" fill="none" stroke="#e9eef2" stroke-width="4"/>` +
      `<path d="M32 26L16 20L28 36Q24 62 30 88H70Q76 62 70 26Z" fill="#e9eef2"${st()}/><path d="M28 44H71M27 70H72" stroke="#3f78a8" stroke-width="5"/><ellipse cx="51" cy="26" rx="19" ry="4" fill="#9fd4f2"${st(2.5)}/>`,
    brush: () => `<rect x="6" y="44" width="46" height="13" rx="6.5" fill="#a8692f"${st()}/><rect x="46" y="32" width="48" height="28" rx="9" fill="#8a5426"${st()}/>` +
      `<path d="M52 60v14M58 60v16M64 60v14M70 60v16M76 60v14M82 60v16M88 60v14" stroke="#efe2c4" stroke-width="2.6" stroke-linecap="round"/><path d="M52 60v14M64 60v14M76 60v14M88 60v14" stroke="${IO}" stroke-width=".8" opacity=".4"/>`,
    scoop: () => `<path d="M12 90L44 58" stroke="${IO}" stroke-width="13" stroke-linecap="round"/><path d="M12 90L44 58" stroke="#3f8f7a" stroke-width="8" stroke-linecap="round"/>` +
      `<path d="M38 56L62 24Q70 16 80 22L90 32Q96 42 86 48L52 70Z" fill="#4fae94"${st()}/><path d="M60 36L78 48M56 44L72 56M68 28L84 40" stroke="#2c6e5c" stroke-width="3.4" stroke-linecap="round"/>`,
    pouch: () => groundShadow(30) + `<path d="M26 22H74L78 86Q50 91 22 86Z" fill="#8fb6cf"${st()}/><path d="M26 22L27 12H73L74 22Z" fill="#6f98b4"${st()}/><path d="M30 12v10M38 12v10M46 12v10M54 12v10M62 12v10M70 12v10" stroke="#4f7894" stroke-width="1.6"/>` +
      `<rect x="32" y="42" width="36" height="28" rx="6" fill="#f4e6c8"${st(2.5)}/>${fishMark(48, 56, 0.9, '#c8574a')}<path d="M34 30q16-6 32 0" stroke="#fff" stroke-opacity=".6" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    chicken: () => groundShadow(40) + `<ellipse cx="50" cy="80" rx="42" ry="10" fill="#f4f1ea"${st()}/><ellipse cx="50" cy="79" rx="30" ry="6" fill="none" stroke="#d9d2c4" stroke-width="2"/>` +
      `<path d="M58 60L76 46" stroke="${IO}" stroke-width="10" stroke-linecap="round"/><path d="M58 60L76 46" stroke="#f6efe0" stroke-width="5.5" stroke-linecap="round"/><g fill="#f6efe0"${st(2.5)}><circle cx="76" cy="40" r="5.5"/><circle cx="83" cy="47" r="5.5"/></g>` +
      `<path d="M24 74Q14 54 36 44Q58 36 64 56Q68 72 46 77Q32 80 24 74Z" fill="#cf8a45"${st()}/><path d="M32 54q8-8 18-6" stroke="#e8b07a" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
    tuna: () => groundShadow(36) + `<path d="M16 50V82Q50 92 84 82V50" fill="#c5d0d8"${st()}/><path d="M16 60Q50 70 84 60V74Q50 84 16 74Z" fill="#3f78a8"/>${fishMark(50, 70, 1, '#fff')}` +
      `<ellipse cx="50" cy="50" rx="34" ry="9" fill="#dfe6eb"${st()}/><ellipse cx="50" cy="50" rx="27" ry="6" fill="#e6a08f"/><path d="M36 49q6-3 12 0M54 51q6-3 12 0" stroke="#c9786a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    vacuum: () => groundShadow(40) + `<path d="M46 34L56 6" stroke="${IO}" stroke-width="7" stroke-linecap="round"/><path d="M46 34L56 6" stroke="#9aa4aa" stroke-width="3.5" stroke-linecap="round"/><rect x="50" y="2" width="16" height="8" rx="4" fill="#3a3f44"${st(2)}/>` +
      `<path d="M30 64Q12 60 14 80" fill="none" stroke="${IO}" stroke-width="7" stroke-linecap="round"/><path d="M30 64Q12 60 14 80" fill="none" stroke="#6f7a80" stroke-width="3.5" stroke-linecap="round"/>` +
      `<rect x="30" y="30" width="32" height="50" rx="12" fill="#c8423a"${st()}/><rect x="36" y="40" width="20" height="22" rx="6" fill="#9aa4aa"${st(2)}/>` +
      `<path d="M10 80H78Q86 80 86 88H10Z" fill="#3a3f44"${st()}/><circle cx="22" cy="89" r="4" fill="#6f7a80"${st(2)}/><circle cx="74" cy="89" r="4" fill="#6f7a80"${st(2)}/>`,
    seedPacket: () => `<path d="M24 14H76V86H24Z" fill="#f4e6c8"${st()}/><path d="M24 14H76V26H24Z" fill="#d9b24a"${st(2.5)}/><path d="M28 14l4 -4 4 4 4 -4 4 4 4 -4 4 4 4 -4 4 4 4 -4 4 4 4 -4 4 4" fill="none"${st(2)}/>` +
      `<rect x="32" y="34" width="36" height="34" rx="4" fill="#bfe0f0"${st(2)}/><path d="M50 66V48" stroke="#4c8c38" stroke-width="3"/><path d="M50 52Q38 44 40 38Q50 40 50 52ZM50 50Q62 40 62 34Q52 36 50 50Z" fill="#6fb04a"${st(1.6)}/><path d="M34 76h32" stroke="#a8743f" stroke-width="3" stroke-linecap="round"/>`,
    wateringCan: () => groundShadow(34) + `<path d="M64 52L92 30" stroke="${IO}" stroke-width="9" stroke-linecap="round"/><path d="M64 52L92 30" stroke="#4f9a6a" stroke-width="5" stroke-linecap="round"/><ellipse cx="93" cy="29" rx="5" ry="7" transform="rotate(-38 93 29)" fill="#3f7a54"${st(2)}/>` +
      `<path d="M30 40Q22 22 46 22Q66 22 60 40" fill="none"${st(7)}/><path d="M30 40Q22 22 46 22Q66 22 60 40" fill="none" stroke="#4f9a6a" stroke-width="3"/><path d="M20 40H68L64 88H24Z" fill="#5fae7a"${st()}/><path d="M24 54H64" stroke="#3f7a54" stroke-width="3"/>`,
    trowel: () => `<path d="M20 86L46 60" stroke="${IO}" stroke-width="12" stroke-linecap="round"/><path d="M20 86L46 60" stroke="#a8692f" stroke-width="7" stroke-linecap="round"/><path d="M44 62L50 56" stroke="${IO}" stroke-width="4"/>` +
      `<path d="M48 58Q50 34 76 18Q86 14 84 26Q70 52 48 58Z" fill="#b9c4c9"${st()}/><path d="M56 48Q66 34 78 24" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>`,
    pouchPack: () => groundShadow(40) + [[-22, 4], [22, 4], [0, 0]].map(([dx, dy]) => `<g transform="translate(${50 + dx} ${dy}) scale(.72) translate(-50 0)">${quiet(ITEMS.pouch)}</g>`).join('') + `<rect x="12" y="62" width="76" height="22" rx="3" fill="#e9d6b0"${st(2.5)}/><path d="M24 73H76" stroke="#c8574a" stroke-width="4" stroke-linecap="round"/>`,
    chickenPack: () => groundShadow(40) + `<path d="M8 58H92L86 86H14Z" fill="#f4f6f8"${st()}/><g transform="translate(14 8) scale(.72)">${quiet(ITEMS.chicken).replace(/<ellipse cx="50" cy="80"[^>]*\/><ellipse[^>]*\/>/, '')}</g><path d="M8 58Q50 44 92 58" fill="#cfe6f2" fill-opacity=".45"${st(2)}/><path d="M20 54Q34 48 46 50" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/><rect x="58" y="70" width="24" height="10" rx="2" fill="#c8574a"/>`,
    tunaPack: () => groundShadow(40) + [[-20, 10, 0.62], [20, 10, 0.62], [0, -18, 0.62]].map(([dx, dy, k]) => `<g transform="translate(${50 + dx} ${50 + dy}) scale(${k}) translate(-50 -50)">${quiet(ITEMS.tuna)}</g>`).join(''),
    treatBag: () => groundShadow(28) + `<path d="M28 30L32 16H68L72 30L76 90H24Z" fill="#7a5ab0"${st()}/><path d="M28 30H72" stroke="${IO}" stroke-width="3"/><path d="M32 16L36 30M68 16L64 30" stroke="#5a3a8a" stroke-width="2"/><g transform="translate(16 26) scale(.68)">${quiet(ITEMS.treat)}</g><g fill="#f4e6c8"><circle cx="38" cy="78" r="2"/><circle cx="62" cy="80" r="2"/><circle cx="50" cy="76" r="2"/></g>`,
    ballBell: () => groundShadow(22) + `<circle cx="50" cy="66" r="22" fill="#e85a4a"${st()}/><path d="M28 66Q50 56 72 66M50 44Q40 66 50 88" stroke="#ffd04a" stroke-width="4" fill="none"/><g fill="#7a1e14"><circle cx="40" cy="58" r="3.4"/><circle cx="60" cy="58" r="3.4"/><circle cx="50" cy="74" r="3.4"/></g><circle cx="50" cy="66" r="5" fill="#e6b040"${st(1.6)}/><path d="M38 52q4-4 10-4" stroke="#fff" stroke-width="2.4" fill="none" opacity=".7" stroke-linecap="round"/>`,
    box: () => groundShadow(46) + `<path d="M22 50L16 34H84L78 50Z" fill="#a8783e"${st(2.5)}/>` + `<g transform="translate(50 50) scale(.5) translate(-100 -120)">${BOX_FRONT}</g>`,
    tunnel: () => groundShadow(46) + `<path d="M24 50Q50 42 80 50L84 82Q50 90 20 82Z" fill="#3f9a8a"${st()}/><path d="M36 46Q34 66 34 86M50 44Q50 66 50 88M64 46Q66 66 66 86" stroke="#2c7a6c" stroke-width="2.4" fill="none"/>` +
      `<ellipse cx="20" cy="66" rx="12" ry="18" fill="#3f9a8a"${st()}/><ellipse cx="20" cy="66" rx="8" ry="13" fill="#163a34"/><ellipse cx="82" cy="66" rx="6" ry="16" fill="#2c7a6c"${st(2.5)}/>`,
    scratcher: () => groundShadow(36) + `<rect x="16" y="80" width="68" height="10" rx="3" fill="#c49a62"${st()}/><rect x="40" y="18" width="20" height="64" fill="#d9c08a"${st()}/>` +
      `<path d="${Array.from({ length: 15 }, (_, i) => `M40 ${22 + i * 4}H60`).join('')}" stroke="#b39a62" stroke-width="1.6"/><rect x="34" y="12" width="32" height="9" rx="3" fill="#c49a62"${st(2.5)}/><path d="M64 21Q72 30 70 42" fill="none" stroke="${IO}" stroke-width="1.4"/><circle cx="70" cy="46" r="5" fill="#e85a4a"${st(1.6)}/>`,
    catTree: () => groundShadow(40) + `<rect x="14" y="84" width="72" height="8" rx="3" fill="#c49a62"${st()}/>` +
      '<g fill="#d9c08a" stroke="#2e2118" stroke-width="2.5"><rect x="44" y="14" width="10" height="72"/><rect x="62" y="42" width="8" height="44"/></g>' +
      `<g fill="#8fae94"${st(2.5)}><rect x="14" y="58" width="36" height="7" rx="3"/><rect x="54" y="36" width="34" height="7" rx="3"/><rect x="28" y="8" width="38" height="7" rx="3"/></g>` +
      `<path d="M18 58V44Q18 34 30 34Q42 34 42 44V58Z" fill="#c49a62"${st(2.5)}/><ellipse cx="30" cy="48" rx="6" ry="7" fill="#3a2a1a"/><path d="M74 43Q80 52 78 60" fill="none" stroke="${IO}" stroke-width="1.3"/><circle cx="78" cy="63" r="3.6" fill="#ffd04a"${st(1.2)}/>`,
    sillCushion: () => `<rect x="4" y="70" width="92" height="16" rx="8" fill="#cf6a55"${st()}/><path d="M10 76H90" stroke="#f3e6d2" stroke-width="3" stroke-dasharray="6 6"/><path d="M12 74Q30 70 40 72" stroke="#fff" stroke-width="2" fill="none" opacity=".5" stroke-linecap="round"/>`,
    bedDeluxe: () => groundShadow(46) + `<ellipse cx="50" cy="70" rx="46" ry="20" fill="#5f8fb4"${st()}/><ellipse cx="50" cy="64" rx="34" ry="11" fill="#f4e6c8"${st(2.5)}/><path d="M4 70Q6 52 20 52Q50 46 80 52Q94 52 96 70" fill="none" stroke="#7fa8c8" stroke-width="7"/>` +
      `<path d="M4 70Q6 52 20 52Q50 46 80 52Q94 52 96 70" fill="none"${st(2)}/><ellipse cx="66" cy="60" rx="12" ry="5" fill="#e8a8b0"${st(1.8)}/><path d="M24 62q12-4 22-2" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".7"/>`,
    rugRound: () => `<ellipse cx="50" cy="70" rx="47" ry="18" fill="#b5452c"${st(2.5)}/><g fill="none"><ellipse cx="50" cy="70" rx="38" ry="14" stroke="#e6b040" stroke-width="3"/><ellipse cx="50" cy="70" rx="27" ry="10" stroke="#f3e6d2" stroke-width="3"/><ellipse cx="50" cy="70" rx="16" ry="6" stroke="#5f8fb4" stroke-width="3"/></g>`,
    lamp: () => groundShadow(18) + `<ellipse cx="50" cy="88" rx="16" ry="4" fill="#5a3a20"${st(2)}/><path d="M50 86V24" stroke="#5a3a20" stroke-width="4"/><path d="M34 6H66L74 28H26Z" fill="#f6c766"${st(2.5)}/><path d="M27 25H73" stroke="#c4902e" stroke-width="2.4"/><circle cx="56" cy="40" r="2" fill="#5a3a20"/><path d="M56 40V30" stroke="#5a3a20" stroke-width="1.4"/>`,
    birdFeeder: () => groundShadow(20) + `<path d="M50 90V40" stroke="#6b4a2e" stroke-width="5"/><path d="M24 26L50 6L76 26Z" fill="#a8513a"${st(2.5)}/><rect x="30" y="26" width="40" height="20" fill="#e9d6b0"${st(2.5)}/><rect x="24" y="44" width="52" height="6" rx="2" fill="#8a5a32"${st(2)}/><g fill="#d9b24a"><circle cx="40" cy="42" r="1.8"/><circle cx="50" cy="43" r="1.8"/><circle cx="58" cy="41" r="1.8"/></g>`,
    catFlap: () => `<rect x="18" y="20" width="64" height="66" rx="12" fill="#5e3a1f"${st()}/><rect x="26" y="28" width="48" height="50" rx="8" fill="#c9a87a"${st(2)}/><path d="M28 34H72" stroke="#5e3a1f" stroke-width="3"/><path d="M36 50q14-6 28 0" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>${PAWMARK(50, 64, 0.8, '#7a5530')}`,
    fishingRod: () => `<path d="M8 94L70 10" stroke="${IO}" stroke-width="6" stroke-linecap="round"/><path d="M8 94L70 10" stroke="#a8692f" stroke-width="3" stroke-linecap="round"/><path d="M14 86l8-11" stroke="#3a3f44" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M70 10Q92 24 86 58" fill="none" stroke="#555" stroke-width="1.4"/>${FEATHERS(86, 58, 0.7)}`,
    featherWand: () => `<path d="M10 94L60 14" stroke="${IO}" stroke-width="6" stroke-linecap="round"/><path d="M10 94L60 14" stroke="#c8574a" stroke-width="3" stroke-linecap="round"/><path d="M60 14Q96 10 88 60" fill="none" stroke="#555" stroke-width="1.4"/>${FEATHERS(88, 60, 0.8)}`,
    featherBunch: () => FEATHERS(50, 20, 1.3),
    pill: () => `<g transform="rotate(-30 50 55)"><path d="M50 45H30A10 10 0 0 0 30 65H50Z" fill="#fff"/><path d="M50 45H70A10 10 0 0 1 70 65H50Z" fill="#e0727a"/><rect x="20" y="45" width="60" height="20" rx="10" fill="none"${st()}/><path d="M50 45V65" stroke="${IO}" stroke-width="2"/><path d="M28 50H44" stroke="#fff" stroke-opacity=".8" stroke-width="2.4" stroke-linecap="round"/></g>`,
  };
  function item(name) {
    const f = ITEMS[name];
    return f ? `<svg class="kx-item" viewBox="0 0 100 100" aria-hidden="true">${f()}</svg>` : '';
  }
  // the same item while a finger carries it: no ground shadow, slightly tilted and bigger
  function itemHeld(name) {
    const f = ITEMS[name];
    if (!f) return '';
    held = true;
    try { return `<svg class="kx-item kx-held" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-10 50 55) translate(50 55) scale(1.08) translate(-50 -55)">${f()}</g></svg>`; } finally { held = false; }
  }

  /* ---------- UI icons (viewBox 0 0 24 24, line style in currentColor, so they follow the theme's ink) ---------- */
  const DOT = (x, y, r = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
  const PAW = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})" fill="currentColor" stroke="none"><ellipse cx="0" cy="3" rx="4.6" ry="3.8"/><ellipse cx="-6.4" cy="-2.4" rx="2" ry="2.5"/><ellipse cx="-2.6" cy="-6.4" rx="2" ry="2.6"/><ellipse cx="2.6" cy="-6.4" rx="2" ry="2.6"/><ellipse cx="6.4" cy="-2.4" rx="2" ry="2.5"/></g>`;
  const ICONS = {
    food: `<path d="M3 12h18l-1.5 6.4a2 2 0 0 1-2 1.6h-11a2 2 0 0 1-2-1.6z"/><path d="M6.5 12c.5-2.6 2.8-4 5.5-4s5 1.4 5.5 4"/>${DOT(10, 10)}${DOT(13.6, 9.8)}`,
    water: '<path d="M12 3.5c3.8 4.6 6 7.8 6 10.7a6 6 0 0 1-12 0c0-2.9 2.2-6.1 6-10.7z"/><path d="M9.2 14.5a3 3 0 0 0 2.3 2.8"/>',
    litter: '<path d="M2.5 11h19l-1.8 7.2a1.5 1.5 0 0 1-1.5 1.1H5.8a1.5 1.5 0 0 1-1.5-1.1z"/><path d="M5 11c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0"/>',
    coat: '<rect x="3" y="5.5" width="18" height="5" rx="1.5"/><path d="M5.5 10.5v8M9 10.5v8M12.5 10.5v8M16 10.5v8M19.5 10.5v6"/>',
    love: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    fun: '<circle cx="11" cy="11.5" r="7.5"/><path d="M4.6 8.6c3.6.2 7 3 8.4 10.2M8 4.8c3 1.6 5.4 5 6 11M3.7 13.5c3-1.8 7.5-2 11.6 0"/><path d="M17 16.8c1.6 1.6 3.2 2 4.5 1.4"/>',
    energy: '<path d="M13.5 2.5 5.5 13.5h6l-1 8 8-11h-6z"/>',
    weight: '<path d="M9 8.5a3 3 0 1 1 6 0"/><path d="M6.5 9h11l2.5 11h-16z"/><path d="M10 15.5h4"/>',
    bond: PAW(12, 12.5, 1),
    pamlsky: `<path d="M2.5 12c3.5-4.5 9.5-5 13.5 0-4 5-10 4.5-13.5 0z"/><path d="M16 12l5-3.5v7z"/>${DOT(6.8, 11.2, 1.1)}`,
    vet: '<rect x="3" y="3" width="18" height="18" rx="4.5"/><path d="M12 7.5v9M7.5 12h9" stroke-width="2.8"/>',
    diary: `<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H18v-3"/>${PAW(11.5, 10.5, 0.55)}`,
    call: '<path d="M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-9l-5 3.5v-3.5H4A1.5 1.5 0 0 1 2.5 15V6A1.5 1.5 0 0 1 4 4.5z"/><path d="M6.5 10.5c1.2-1.6 2.4-1.6 3.6 0s2.4 1.6 3.6 0 2.4-1.6 3.6 0"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    laser: `<path d="M4 20l8.5-8.5" stroke-width="4"/><path d="M14.5 9.5l2.5-2.5" stroke-dasharray="1.5 2"/>${DOT(19.5, 4.5, 2.4)}`,
    tilt: '<rect x="7.5" y="3" width="9" height="16" rx="2" transform="rotate(20 12 11)"/><path d="M3 17c.8 2 2.4 3.4 4.6 4M21 8c-.6-2-2-3.5-4-4.3"/>',
    door: `<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3.5 21h17"/>${DOT(15, 12.5)}`,
    bed: '<path d="M2.5 12.5c0 4.2 4.3 7 9.5 7s9.5-2.8 9.5-7"/><ellipse cx="12" cy="11.5" rx="7" ry="3"/>',
    window: '<rect x="4" y="3.5" width="16" height="17" rx="1.5"/><path d="M12 3.5v17M4 12h16"/>',
    scoop: '<path d="M3.5 20.5l6-6"/><path d="M8.5 12 15 5.5a2.5 2.5 0 0 1 3.5 0l0 0a2.5 2.5 0 0 1 0 3.5L12 15.5z"/><path d="M13 9l2 2M15.4 7.4l1.2 1.2"/>',
    brush: '<rect x="2.5" y="10" width="7" height="3" rx="1.5"/><rect x="9.5" y="6.5" width="12" height="6.5" rx="2"/><path d="M11.5 13v4M14 13v5M16.5 13v4M19 13v5"/>',
  };
  function icon(name) {
    const s = ICONS[name];
    return s ? `<svg class="kx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${s}</svg>` : '';
  }

  /* ---------- effects above her head (viewBox 0 0 40 40; the class kx-fx-float makes one rise and fade) ---------- */
  const FX = {
    heart: () => `<path d="M20 34S5 25 5 14.5A7.5 7.5 0 0 1 20 10.5 7.5 7.5 0 0 1 35 14.5C35 25 20 34 20 34Z" fill="#e0566a"${st(2.5)}/><path d="M10.5 14a4 4 0 0 1 4.2-3.2" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/>`,
    zzz: () => outlined('M6 26h8l-8 9h8M17 14h10l-10 11h10M27 3h8l-8 8h8', 2.4),
    bang: () => `<path d="${poly(Array.from({ length: 16 }, (_, i) => { const a = i / 16 * 2 * Math.PI - Math.PI / 2, r = i % 2 ? 11 : 18; return [20 + Math.cos(a) * r, 20 + Math.sin(a) * r]; }))}" fill="#ffd04a"${st(2.5)}/><path d="M20 11.5v10" stroke="${IO}" stroke-width="4.5" stroke-linecap="round"/><circle cx="20" cy="28" r="2.6" fill="${IO}"/>`,
    note: () => outlined('M15 29V10l15-4v17', 2.6) + `<g fill="${C.ol}"${st(2.2)}><ellipse cx="11.5" cy="29.5" rx="4.6" ry="3.6" transform="rotate(-20 11.5 29.5)"/><ellipse cx="26.5" cy="23.5" rx="4.6" ry="3.6" transform="rotate(-20 26.5 23.5)"/></g>`,
    sparkle: () => `<path d="M17 3Q19 15 31 17Q19 19 17 31Q15 19 3 17Q15 15 17 3Z" fill="#ffe27a"${st(2)}/><path d="M31 26Q32 31 37 32Q32 33 31 38Q30 33 25 32Q30 31 31 26Z" fill="#ffe27a"${st(1.6)}/>`,
  };
  function fx(name) {
    const f = FX[name];
    return f ? `<svg class="kx-fx" viewBox="0 0 40 40" aria-hidden="true">${f()}</svg>` : '';
  }

  /* ---------- the vet's room (viewBox 0 0 400 600, like room()) ---------- */
  const vetSpots = { table: { x: 200, y: 428 } };   // where she sits: the middle of the table top
  function vet() {
    let s = '<rect width="400" height="404" fill="#dcebe5"/><rect y="290" width="400" height="114" fill="#f1f6f3"/><path d="';
    for (let x = 0; x <= 400; x += 25) s += `M${x} 290V404`;
    for (let y = 315; y < 404; y += 25) s += `M0 ${y}H400`;
    s += '" stroke="#c8d9d2" stroke-width="2"/><rect y="286" width="400" height="6" fill="#9fbab2"/>';
    // window with blinds, a sign with a green cross, the cabinet, the lamp
    s += '<rect x="252" y="70" width="120" height="150" rx="4" fill="#8aa6a0"/><rect x="260" y="78" width="104" height="134" fill="#cfe6f2"/><path d="' +
      Array.from({ length: 10 }, (_, i) => `M260 ${86 + i * 13}H364`).join('') + '" stroke="#f4f8f8" stroke-width="7"/>';
    s += '<rect x="40" y="70" width="80" height="80" rx="14" fill="#fff" stroke="#9fbab2" stroke-width="3"/><path d="M80 88v44M58 110h44" stroke="#3fa37a" stroke-width="14" stroke-linecap="round"/>';
    s += '<rect x="18" y="186" width="112" height="218" rx="6" fill="#f7faf9" stroke="#8aa6a0" stroke-width="3"/><rect x="28" y="198" width="42" height="96" rx="3" fill="#cfe3ea"/><rect x="78" y="198" width="42" height="96" rx="3" fill="#cfe3ea"/>' +
      '<path d="M28 246H70M78 246H120" stroke="#8aa6a0" stroke-width="2.5"/><g stroke="#4a5a58" stroke-width="1.2"><rect x="34" y="226" width="9" height="18" rx="2" fill="#e6b040"/><rect x="48" y="230" width="8" height="14" rx="2" fill="#3f78a8"/><rect x="86" y="222" width="10" height="22" rx="2" fill="#f4f8f8"/><rect x="100" y="230" width="9" height="14" rx="2" fill="#c8574a"/><rect x="38" y="272" width="12" height="20" rx="2" fill="#7fbf9a"/><rect x="92" y="276" width="16" height="16" rx="3" fill="#e9d6b0"/></g>' +
      '<path d="M18 316H130M18 360H130" stroke="#8aa6a0" stroke-width="2.5"/><path d="M62 336h24M62 380h24" stroke="#8aa6a0" stroke-width="4" stroke-linecap="round"/>';
    s += '<path d="M200 0V38" stroke="#4a5a58" stroke-width="3"/><path d="M80 430L170 66H230L320 430Z" fill="#fffbe6" opacity=".22"/><path d="M168 66Q200 28 232 66Z" fill="#e6efec" stroke="#7a9a92" stroke-width="2.5"/><ellipse cx="200" cy="66" rx="32" ry="5" fill="#fff8d8"/>';
    // floor tiles
    s += '<rect y="400" width="400" height="200" fill="#e3ebe8"/><path d="';
    for (let y = 400, r = 0; y < 600; y += 40, r++) for (let x = (r % 2) * 40; x < 400; x += 80) s += `M${x} ${y}h40v40h-40z`;
    s += '" fill="#cbd8d4"/><rect y="398" width="400" height="8" fill="#8aa6a0"/>';
    // the table with a towel, a scale
    s += '<ellipse cx="200" cy="566" rx="140" ry="10" fill="#000" opacity=".14"/><g fill="#9aa8ad" stroke="#5f6e72" stroke-width="2.5"><rect x="112" y="444" width="14" height="120" rx="3"/><rect x="274" y="444" width="14" height="120" rx="3"/><rect x="126" y="528" width="148" height="8"/><rect x="84" y="426" width="232" height="20" rx="6" fill="#c3ced3"/></g>' +
      '<path d="M116 427Q200 419 284 427V441H116Z" fill="#9fd0c8" stroke="#5f8f88" stroke-width="2"/><path d="M116 434H284" stroke="#e8f4f2" stroke-width="2.5"/>';
    s += '<rect x="316" y="536" width="66" height="16" rx="5" fill="#f4f8f8" stroke="#7a9a92" stroke-width="2.5"/><rect x="336" y="540" width="26" height="8" rx="2" fill="#2f3a3a"/><path d="M341 544h16" stroke="#7fe0a0" stroke-width="2"/>';
    return `<svg class="kx-room" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg>`;
  }

  /* ---------- places: Obývák, Kuchyně, Předsíň, Zahrada (viewBox 0 0 400 600, preserveAspectRatio xMidYMid slice) ---------- */
  const SKY = { morning: ['#bfe0f0', '#fbd9a6'], day: ['#7fc0e8', '#cdeaf6'], evening: ['#5f5590', '#f0905e'], night: ['#0b1634', '#24365e'] };
  const HILL = { spring: '#a6cf86', summer: '#79ad5e', autumn: '#c7a25a', winter: '#dbe6ee' };
  const GROUND = { spring: '#86bd5c', summer: '#5f9e3e', autumn: '#b88d44', winter: '#f2f6f9' };
  const GX = 68, GY = 88, GW = 124, GH = 174;   // the living-room window glass; outside() draws for it, view() maps it elsewhere
  // falling rain or snow over a box: a tiled pattern that the CSS moves down by exactly one tile (seamless)
  function weatherFx(weather, x, y, w, h) {
    if (weather !== 'rain' && weather !== 'snow') return '';
    const id = nid(), rain = weather === 'rain', tw = rain ? 40 : 60, th = rain ? 60 : 80;
    const tile = rain ? '<path d="M30 0l-6 18M12 30l-6 18M36 40l-5 15" stroke="#d6e8f4" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>'
      : '<g fill="#fff"><circle cx="10" cy="12" r="2.4"/><circle cx="40" cy="30" r="1.8"/><circle cx="24" cy="56" r="2.2"/><circle cx="52" cy="70" r="1.6"/></g>';
    return `<defs><pattern id="${id}" width="${tw}" height="${th}" patternUnits="userSpaceOnUse">${tile}</pattern><clipPath id="${id}c"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs>` +
      `<g clip-path="url(#${id}c)"><rect class="${rain ? 'kx-rain' : 'kx-snow'}" x="${x - tw}" y="${y - th}" width="${w + 2 * tw}" height="${h + 2 * th}" fill="url(#${id})"/></g>`;
  }
  function outside(c, id) {
    const { ph, se, hol } = c;
    let s = `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKY[ph][0]}"/><stop offset="1" stop-color="${SKY[ph][1]}"/></linearGradient>`;
    s = `<defs>${s}<clipPath id="${id}c"><rect x="${GX}" y="${GY}" width="${GW}" height="${GH}"/></clipPath></defs><g clip-path="url(#${id}c)"><rect x="${GX}" y="${GY}" width="${GW}" height="${GH}" fill="url(#${id}s)"/>`;
    if (ph === 'day' && !c.weather) s += '<g fill="#fff" opacity=".9"><ellipse cx="102" cy="122" rx="18" ry="7"/><ellipse cx="112" cy="116" rx="11" ry="8"/><ellipse cx="168" cy="146" rx="15" ry="6"/></g>';
    if (ph === 'morning') s += '<circle cx="168" cy="196" r="13" fill="#fff0c0"/>';
    if (ph === 'evening') s += '<circle cx="104" cy="212" r="22" fill="#ffb066" opacity=".5"/><circle cx="104" cy="212" r="14" fill="#ffc77a"/>';
    s += `<path d="M68 214Q100 194 136 205T192 199V262H68Z" fill="${HILL[se]}"/>`;
    s += '<g fill="#d9ccb0"><rect x="146" y="191" width="20" height="11"/><rect x="157" y="181" width="5" height="12"/></g><g fill="#a8513a"><path d="M144 192h24l-4-5h-16z"/><path d="M156 182h7l-3.5-6z"/></g>';
    s += `<path d="M68 238Q118 227 192 235V262H68Z" fill="${GROUND[se]}"/>`;
    s += '<path d="M96 242V200M96 214L84 200M96 208L108 194" stroke="#6b4a2e" stroke-width="5" stroke-linecap="round" fill="none"/>';
    s += crown(se, 96, 186, 1);
    if (se === 'winter') s += '<g fill="#fff"><circle cx="80" cy="110" r="2"/><circle cx="120" cy="132" r="1.6"/><circle cx="150" cy="104" r="2"/><circle cx="176" cy="160" r="1.6"/><circle cx="100" cy="160" r="1.8"/><circle cx="140" cy="176" r="1.6"/><circle cx="182" cy="122" r="1.8"/></g><path d="M68 262V253Q90 246 112 252T152 250T192 253V262Z" fill="#fff"/>';
    if (c.weather) s += `<rect x="${GX}" y="${GY}" width="${GW}" height="${GH}" fill="#6a7a8a" opacity=".25"/>` + weatherFx(c.weather, GX, GY, GW, GH);
    if (ph === 'evening') s += `<rect x="${GX}" y="180" width="${GW}" height="90" fill="#ff7a3a" opacity=".16"/>`;
    if (ph === 'night') s += `<rect x="${GX}" y="156" width="${GW}" height="110" fill="#0a1430" opacity=".66"/>` +
      '<g fill="#fff"><circle cx="82" cy="102" r="1.3"/><circle cx="104" cy="96" r="1"/><circle cx="126" cy="112" r="1.4"/><circle cx="96" cy="128" r="1"/><circle cx="140" cy="140" r="1.1"/><circle cx="182" cy="150" r="1.2"/><circle cx="118" cy="150" r="1"/></g><circle cx="165" cy="116" r="12" fill="#f4ecc8"/><circle cx="171" cy="111" r="11" fill="#0d1838"/>';
    if (hol.includes('silvestr') && (ph === 'evening' || ph === 'night')) s += [[104, 120, '#ffd04a'], [158, 146, '#ff6a8a'], [130, 104, '#7ad0ff']].map(([x, y, col]) => burst(x, y, 13, col)).join('');
    if (hol.includes('carodejnice') && (ph === 'evening' || ph === 'night')) s += '<ellipse cx="120" cy="206" rx="12" ry="7" fill="#ffb347" opacity=".55"/><path d="M114 210l6-12 6 12z" fill="#ff8a2a"/>';
    return s + '</g>';
  }
  const burst = (x, y, r, col) => `<g stroke="${col}" stroke-width="2" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => { const q = a * Math.PI / 180; return `<path d="M${r1(x + Math.cos(q) * r * 0.3)} ${r1(y + Math.sin(q) * r * 0.3)}L${r1(x + Math.cos(q) * r)} ${r1(y + Math.sin(q) * r)}"/>`; }).join('')}</g>`;
  // a tree crown for the season, centre (x, y), size k (the window's little tree and the garden tree)
  function crown(se, x, y, k) {
    const C3 = (list, col) => `<g fill="${col}">${list.map(([dx, dy, r]) => `<circle cx="${r1(x + dx * k)}" cy="${r1(y + dy * k)}" r="${r1(r * k)}"/>`).join('')}</g>`;
    if (se === 'spring') return C3([[0, -2, 20], [-14, 8, 13], [14, 8, 13]], '#9ccc65') + C3([[-8, -8, 2.6], [6, -12, 2.6], [12, 2, 2.6], [-12, 8, 2.6], [0, 4, 2.6], [18, 12, 2.2], [-4, -16, 2.2]], '#f7b6c8');
    if (se === 'summer') return C3([[0, -4, 22], [-16, 8, 15], [16, 8, 15]], '#4c8c38') + C3([[8, 4, 9], [-10, 0, 7]], '#3d7a2c');
    if (se === 'autumn') return C3([[0, -2, 19], [-14, 9, 12]], '#d98a2b') + C3([[14, 8, 12], [-4, -10, 8]], '#c0552c') + C3([[6, 4, 7]], '#e6b040');
    return `<path d="M${x} ${r1(y + 14 * k)}L${r1(x - 10 * k)} ${r1(y - 2 * k)}M${x} ${r1(y + 20 * k)}L${r1(x + 16 * k)} ${r1(y + 2 * k)}M${r1(x + 12 * k)} ${r1(y + 8 * k)}L${r1(x + 18 * k)} ${r1(y - 4 * k)}M${r1(x - 8 * k)} ${r1(y + 2 * k)}L${r1(x - 16 * k)} ${r1(y - 4 * k)}" stroke="#6b4a2e" stroke-width="${r1(3 * k)}" stroke-linecap="round" fill="none"/>` +
      `<path d="M${r1(x - 12 * k)} ${r1(y + 13 * k)}l${r1(10 * k)} ${r1(-12 * k)}M${r1(x + 4 * k)} ${r1(y + 17 * k)}l${r1(10 * k)} ${r1(-11 * k)}" stroke="#fff" stroke-width="${r1(2 * k)}" stroke-linecap="round"/>`;
  }
  // the view outside mapped into any glass box, which also stays bright at night
  function view(c, x, y, w, h) {
    c.holes.push([x, y, w, h]);
    return `<g transform="translate(${x} ${y}) scale(${r2(w / GW)} ${r2(h / GH)}) translate(${-GX} ${-GY})">${outside(c, nid())}</g>`;
  }
  // a window: wooden frame, the view, a cross of bars, the sill
  function frameWin(c, x, y, w, h, wood = '#7c4f2c') {
    return `<rect x="${x - 10}" y="${y - 10}" width="${w + 20}" height="${h + 20}" rx="4" fill="${wood}"/>${view(c, x, y, w, h)}` +
      `<rect x="${x + w / 2 - 3}" y="${y}" width="6" height="${h}" fill="${wood}"/><rect x="${x}" y="${y + h / 2 - 3}" width="${w}" height="6" fill="${wood}"/>` +
      `<rect x="${x - 20}" y="${y + h + 6}" width="${w + 40}" height="14" rx="3" fill="#a06e3e"/><rect x="${x - 14}" y="${y + h + 20}" width="${w + 28}" height="5" fill="#6f4626"/>`;
  }
  const gingham = id => `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#f3e6d2"/><rect width="6" height="12" fill="#cf6a55" opacity=".5"/><rect width="12" height="6" fill="#cf6a55" opacity=".5"/></pattern>`;
  const wallFill = col => `<rect width="400" height="404" fill="${col}"/><g fill="#000" opacity=".04"><circle cx="40" cy="40" r="2"/><circle cx="300" cy="64" r="2"/><circle cx="360" cy="30" r="2"/><circle cx="250" cy="250" r="2"/><circle cx="20" cy="200" r="2"/></g>`;
  const panelling = () => '<rect y="300" width="400" height="100" fill="#b88654"/><path d="' + Array.from({ length: 15 }, (_, i) => `M${13 + i * 27} 306V398`).join('') + '" stroke="#a37444" stroke-width="2"/><rect y="296" width="400" height="9" fill="#8f6038"/>';
  function planks() {
    const ys = [406, 420, 438, 460, 486, 516, 552, 600];
    let pl = '';
    ys.forEach((y, i) => { if (i) pl += `M0 ${y}H400`; if (i < ys.length - 1) for (let x = (i * 71) % 130 + 30; x < 400; x += 130 + i * 6) pl += `M${x} ${y}V${ys[i + 1]}`; });
    return `<rect y="400" width="400" height="200" fill="#a87442"/><rect y="396" width="400" height="10" fill="#6e4a2c"/><path d="${pl}" stroke="#8e5f34" stroke-width="2"/>`;
  }
  const hangLamp = (x, lit) => `<path d="M${x} 0V38" stroke="#3a2a1e" stroke-width="2"/><circle cx="${x}" cy="64" r="6" fill="${lit ? '#fff6d0' : '#efe2c0'}"/><path d="M${x - 18} 38H${x + 18}L${x + 30} 62H${x - 30}Z" fill="${lit ? '#f6c766' : '#d99a3e'}" stroke="#8a5a22" stroke-width="1.5" stroke-linejoin="round"/><path d="M${x - 29} 58H${x + 29}" stroke="#8a5a22" stroke-width="3"/>`;
  // the light of the day phase over a whole place; the lamp glows in the evening; glass (c.holes) stays bright at night
  function light(c, lx, ly) {
    const id = nid();
    if (c.ph === 'morning') return '<rect width="400" height="600" fill="#ffb36b" opacity=".06"/>';
    if (c.ph === 'evening') return `<defs><radialGradient id="${id}"><stop offset="0" stop-color="#ffd27a" stop-opacity=".62"/><stop offset=".45" stop-color="#ffc060" stop-opacity=".22"/><stop offset="1" stop-color="#ffb050" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="400" height="600" fill="#3a1a08" opacity=".2"/><circle cx="${lx}" cy="${ly}" r="320" fill="url(#${id})"/><ellipse cx="${lx}" cy="500" rx="180" ry="56" fill="#ffcf80" opacity=".14"/>`;
    if (c.ph === 'night') return `<path d="M0 0H400V600H0Z${c.holes.map(([x, y, w, h]) => `M${x} ${y}V${y + h}H${x + w}V${y}Z`).join('')}" fill="#3e4c86" style="mix-blend-mode:multiply" fill-rule="evenodd"/>`;
    return '';
  }
  const sunX0 = x => 20 + Math.min(1, Math.max(0, Number(x) || 0)) * 140;
  // the middle of the sun patch on the living-room floor for sunX (room units): where a sun nap belongs
  const sunPatch = x => ({ x: sunX0(x) + 75, y: 458 });
  function panes(x0, col, op) {   // the window's light on the floor, four panes
    const A = [x0 + 20, 420], B = [x0 + 110, 420], D = [x0 + 40, 496];
    const P = (u, v) => [A[0] + u * (B[0] - A[0]) + v * (D[0] - A[0]), A[1] + v * (D[1] - A[1])];
    let s = '';
    for (const [u0, u1] of [[0, 0.47], [0.53, 1]]) for (const [v0, v1] of [[0, 0.46], [0.54, 1]]) s += poly([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)]);
    return `<path d="${s}" fill="${col}" opacity="${op}"/>`;
  }
  const flame = (x, y) => `<path d="M${x} ${y}q-3.5-5 0-10q3.5 5 0 10z" fill="#ffc94a"/>`;
  function holidayProps(hol) {
    let s = '', glow = '';
    if (hol.includes('vanoce') || hol.includes('silvestr')) s += '<rect x="30" y="384" width="22" height="18" fill="#9a5a3a" stroke="#4a2a1a" stroke-width="2"/><g fill="#2f6b3a" stroke="#1f4a28" stroke-width="2" stroke-linejoin="round"><path d="M41 290L66 334H16Z"/><path d="M41 314L72 360H10Z"/><path d="M41 338L78 388H4Z"/></g>' +
      '<g><circle cx="30" cy="350" r="4" fill="#c0392b"/><circle cx="54" cy="372" r="4" fill="#e6b040"/><circle cx="44" cy="326" r="3.6" fill="#3f78a8"/><circle cx="22" cy="378" r="3.6" fill="#e6b040"/><circle cx="58" cy="346" r="3.6" fill="#c0392b"/></g><path d="M41 280l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z" fill="#ffd04a" stroke="#a8781e" stroke-width="1"/>';
    if (hol.includes('advent') || hol.includes('mikulas')) {
      s += '<ellipse cx="130" cy="264" rx="28" ry="6" fill="none" stroke="#2f6b3a" stroke-width="7"/><g fill="#c0392b" stroke="#7a2015" stroke-width="1"><rect x="108" y="246" width="6" height="16"/><rect x="124" y="250" width="6" height="14"/><rect x="138" y="246" width="6" height="16"/><rect x="150" y="250" width="6" height="14"/></g>';
      glow += flame(111, 246) + flame(141, 246);
    }
    if (hol.includes('mikulas')) s += '<path d="M262 186l4 2" stroke="#4a2a1a" stroke-width="2"/><path d="M252 190h22v30l10 8q4 8-6 10l-22-10z" fill="#c0392b" stroke="#6a1a10" stroke-width="2" stroke-linejoin="round"/><rect x="250" y="186" width="26" height="9" rx="3" fill="#f6f1e6" stroke="#6a1a10" stroke-width="1.5"/>';
    if (hol.includes('masopust')) s += '<path d="M236 196q26-10 52 0q-2 18-14 20q-6-6-12 0q-12-2-14-20z" fill="#e6b040" stroke="#7a4a10" stroke-width="2"/><ellipse cx="252" cy="203" rx="5" ry="3.4" fill="#2b1a0e"/><ellipse cx="272" cy="203" rx="5" ry="3.4" fill="#2b1a0e"/><path d="M240 194l-6-14M284 194l6-14" stroke="#c0392b" stroke-width="3"/><circle cx="234" cy="178" r="4" fill="#3f78a8"/><circle cx="290" cy="178" r="4" fill="#3fa3a0"/>';
    if (hol.includes('velikonoce')) s += '<path d="M100 256h40l-4 12h-32z" fill="#b07a3a" stroke="#5a3a1a" stroke-width="2"/><path d="M102 256q18-22 36 0" fill="none" stroke="#b07a3a" stroke-width="3"/><ellipse cx="112" cy="254" rx="6" ry="8" fill="#e05a5a" stroke="#6a1a1a" stroke-width="1.4"/><ellipse cx="124" cy="252" rx="6" ry="8" fill="#e6b040" stroke="#6a4a10" stroke-width="1.4"/><ellipse cx="134" cy="255" rx="5.6" ry="7.4" fill="#3f9a8a" stroke="#1a4a40" stroke-width="1.4"/><path d="M108 254h8M120 250h8M130 254h8" stroke="#fff" stroke-width="1.4"/>';
    if (hol.includes('carodejnice')) s += '<path d="M262 186l4 2" stroke="#4a2a1a" stroke-width="2"/><path d="M236 222h56q-6-6-18-6l-4-36q-2-6-8 2l-10 34q-12 0-16 6z" fill="#2b2238" stroke="#120c18" stroke-width="2" stroke-linejoin="round"/><path d="M252 214h28" stroke="#8a5ab0" stroke-width="4"/>';
    if (hol.includes('dusicky')) { s += '<rect x="154" y="248" width="14" height="20" rx="2" fill="#c0392b" stroke="#5a1a10" stroke-width="1.5"/><rect x="156" y="246" width="10" height="4" fill="#d9b24a"/>'; glow += `<circle cx="161" cy="242" r="12" fill="#ffc94a" opacity=".3"/>${flame(161, 246)}`; }
    if (hol.includes('narozeniny')) {
      s += '<path d="M6 26Q200 70 394 26" fill="none" stroke="#7a4a28" stroke-width="2"/>' + [30, 70, 110, 150, 190, 230, 270, 310, 350].map((x, i) => {
        const y = 26 + 44 * (1 - Math.pow((x - 200) / 194, 2)) * 0.99; return `<path d="M${x - 9} ${r1(y - 2)}h18l-9 16z" fill="${['#c0392b', '#e6b040', '#3f78a8', '#3fa3a0'][i % 4]}"/>`;
      }).join('');
      s += '<rect x="96" y="250" width="30" height="16" rx="3" fill="#f4e6c8" stroke="#7a4a28" stroke-width="2"/><path d="M96 256h30" stroke="#e05a7a" stroke-width="3"/><rect x="109" y="240" width="4" height="10" fill="#3f78a8"/>';
      glow += flame(111, 240);
    }
    return { s, glow };
  }
  const AC = { fab: '#c9973e', dark: '#a87a2c', light: '#ddb25e', line: '#6a4a1e' };   // the armchair's mustard fabric
  const armchair = () => `<g stroke="${AC.line}" stroke-width="2.5" stroke-linejoin="round"><rect x="282" y="464" width="10" height="18" fill="#5a3a1e"/><rect x="378" y="464" width="10" height="18" fill="#5a3a1e"/>` +
    `<path d="M290 406V314Q290 288 332 288Q374 288 374 314V406Z" fill="${AC.dark}"/><rect x="270" y="404" width="128" height="64" rx="10" fill="${AC.fab}"/>` +
    `<path d="M286 406Q286 392 300 392H364Q378 392 378 406V418H286Z" fill="${AC.light}"/>` +
    `<path d="M262 470V368Q262 350 279 350Q296 350 296 368V470Z" fill="${AC.fab}"/><path d="M368 470V368Q368 350 384 350Q400 350 400 368V470Z" fill="${AC.fab}"/></g>` +
    `<g fill="${AC.line}"><circle cx="314" cy="324" r="2.4"/><circle cx="350" cy="324" r="2.4"/><circle cx="332" cy="352" r="2.4"/><circle cx="314" cy="376" r="2.4"/><circle cx="350" cy="376" r="2.4"/></g>`;
  const rug = () => '<ellipse cx="200" cy="534" rx="172" ry="46" fill="#5f8580"/><g fill="none"><ellipse cx="200" cy="534" rx="154" ry="39" stroke="#7fa39d" stroke-width="7"/><ellipse cx="200" cy="534" rx="122" ry="29" stroke="#c9b38a" stroke-width="5"/><ellipse cx="200" cy="534" rx="88" ry="19" stroke="#7fa39d" stroke-width="6"/><ellipse cx="200" cy="534" rx="172" ry="46" stroke="#4d6e6a" stroke-width="2"/></g>';
  const PLACES = {
    living: {
      name: 'Obývák',
      spots: { rug: { x: 200, y: 534 }, bed: { x: 316, y: 562 }, window: { x: 130, y: 268 }, chair: { x: 332, y: 396 }, sun: sunPatch(0.5) },
      draw(c) {
        const g = nid();
        let s = `<defs>${gingham(g)}</defs>` + wallFill('#ead7b6') + panelling() + frameWin(c, GX, GY, GW, GH);
        s += `<path d="M34 66H226" stroke="#5a3a20" stroke-width="5" stroke-linecap="round"/><g fill="url(#${g})" stroke="#9a4a3a" stroke-width="1.5"><path d="M38 66H76C72 120 66 170 70 218C74 250 68 288 60 300H40C36 230 34 150 38 66Z"/><path d="M222 66H184C188 120 194 170 190 218C186 250 192 288 200 300H220C224 230 226 150 222 66Z"/></g>`;
        s += '<rect x="234" y="96" width="54" height="46" fill="#6b4426"/><rect x="239" y="101" width="44" height="36" fill="#bfe0f0"/><path d="M239 128q20-10 44-4v13h-44z" fill="#79ad5e"/><g fill="#efe4cc"><rect x="252" y="114" width="20" height="10"/><rect x="263" y="105" width="5" height="11"/></g><path d="M250 115h24l-3-4h-18zM262 106h7l-3.5-5z" fill="#a8513a"/>';
        s += hangLamp(232, c.ph === 'evening') + planks() + rug();
        if ((c.ph === 'day' || c.ph === 'morning') && !c.weather) s += panes(sunX0(c.sunX), c.ph === 'morning' ? '#ffd79a' : '#fff1b8', c.ph === 'morning' ? 0.42 : 0.5);
        const hp = holidayProps(c.hol);
        s += armchair() + hp.s + light(c, 232, 66);
        if (c.ph === 'night') s += panes(150, '#bcd0ff', 0.12);
        return s + hp.glow;
      },
    },
    kitchen: {
      name: 'Kuchyně',
      spots: { bowl: { x: 64, y: 472 }, water: { x: 44, y: 566 }, counter: { x: 282, y: 322 }, window: { x: 116, y: 254 } },
      draw(c) {
        const g = nid();
        let s = `<defs>${gingham(g)}</defs>` + wallFill('#efe1c0');
        s += '<rect x="214" y="246" width="186" height="78" fill="#f4f1ea"/><path d="' + Array.from({ length: 8 }, (_, i) => `M${222 + i * 24} 246V322`).join('') + 'M214 270H400M214 296H400" stroke="#c9d6dc" stroke-width="2"/><g fill="#5f8fb4">' +
          Array.from({ length: 7 }, (_, i) => `<circle cx="${234 + i * 24}" cy="258" r="2.4"/><circle cx="${234 + i * 24}" cy="309" r="2.4"/>`).join('') + '</g>';
        s += frameWin(c, 56, 96, 120, 148);
        s += `<path d="M48 176H184" stroke="#5a3a20" stroke-width="4" stroke-linecap="round"/><path d="M52 176H180V240Q170 248 160 240Q150 248 140 240Q130 248 120 240Q110 248 100 240Q90 248 80 240Q70 248 60 240Q56 244 52 240Z" fill="url(#${g})" stroke="#9a4a3a" stroke-width="1.5"/>`;
        s += '<rect x="230" y="184" width="164" height="9" rx="2" fill="#8a5a32"/><g stroke="#4a3a2a" stroke-width="1.5"><rect x="240" y="156" width="20" height="28" rx="4" fill="#e9d6b0"/><rect x="240" y="152" width="20" height="6" rx="2" fill="#c0503a"/><rect x="266" y="162" width="18" height="22" rx="4" fill="#cfe3ea"/><rect x="266" y="158" width="18" height="6" rx="2" fill="#3f78a8"/><rect x="290" y="150" width="22" height="34" rx="5" fill="#f4e6c8"/><rect x="290" y="146" width="22" height="6" rx="2" fill="#7fbf9a"/></g>' +
          '<g fill="#f6f2ea" stroke="#9aa8ad" stroke-width="2"><circle cx="336" cy="166" r="17"/><circle cx="366" cy="168" r="15"/></g><g fill="none" stroke="#5f8fb4" stroke-width="1.6"><circle cx="336" cy="166" r="11"/><circle cx="366" cy="168" r="9"/></g>';
        s += hangLamp(306, c.ph === 'evening');
        s += '<rect y="400" width="400" height="200" fill="#c4744c"/><path d="';
        for (let y = 400, r = 0; y < 600; y += 50, r++) for (let x = (r % 2) * 50; x < 400; x += 100) s += `M${x} ${y}h50v50h-50z`;
        s += '" fill="#b0623e"/><path d="' + Array.from({ length: 9 }, (_, i) => `M${i * 50} 400V600`).join('') + Array.from({ length: 4 }, (_, i) => `M0 ${450 + i * 50}H400`).join('') + '" stroke="#8a4a2e" stroke-width="2"/><rect y="396" width="400" height="10" fill="#7a4a2e"/>';
        // the counter: cabinets, worktop, stove with a pot
        s += '<g stroke="#4f6a52" stroke-width="2.5" stroke-linejoin="round"><rect x="222" y="336" width="98" height="68" fill="#8fae94"/><rect x="230" y="344" width="38" height="52" rx="3" fill="#9dbca2"/><rect x="274" y="344" width="38" height="52" rx="3" fill="#9dbca2"/></g><g fill="#d9b24a"><circle cx="262" cy="370" r="3"/><circle cx="280" cy="370" r="3"/></g>' +
          '<rect x="320" y="336" width="80" height="68" fill="#e9e4da" stroke="#6f7a80" stroke-width="2.5"/><rect x="328" y="352" width="64" height="44" rx="4" fill="#3a3f44"/><rect x="336" y="360" width="48" height="22" rx="3" fill="#6f7a80"/><g fill="#3a3f44"><circle cx="336" cy="344" r="3"/><circle cx="352" cy="344" r="3"/><circle cx="368" cy="344" r="3"/><circle cx="384" cy="344" r="3"/></g>' +
          '<rect x="214" y="322" width="186" height="15" rx="3" fill="#b98552" stroke="#6b4426" stroke-width="2"/><ellipse cx="344" cy="321" rx="14" ry="3" fill="#2f3438"/><ellipse cx="380" cy="321" rx="14" ry="3" fill="#2f3438"/>' +
          '<path d="M364 318V292H398V318Z" fill="#c0503a" stroke="#6a1a10" stroke-width="2"/><path d="M362 292H400" stroke="#6a1a10" stroke-width="4" stroke-linecap="round"/><path d="M381 288v-4" stroke="#3a3f44" stroke-width="4" stroke-linecap="round"/>';
        s += '<ellipse cx="68" cy="478" rx="54" ry="12" fill="#3f78a8" opacity=".5"/><ellipse cx="48" cy="570" rx="44" ry="11" fill="#3f78a8" opacity=".5"/>';
        return s + light(c, 306, 66);
      },
    },
    hall: {
      name: 'Předsíň',
      spots: { litter: { x: 330, y: 500 }, door: { x: 180, y: 404 }, shoe: { x: 84, y: 548 }, mat: { x: 180, y: 432 } },
      draw(c) {
        let s = wallFill('#e6d4b4') + panelling();
        // the garden door with a glass pane, a cat flap when there is one
        s += `<rect x="124" y="148" width="112" height="256" fill="#5a3a20"/><rect x="132" y="156" width="96" height="248" fill="#5d7f5a"/>${view(c, 146, 174, 68, 84)}` +
          '<rect x="178" y="174" width="4" height="84" fill="#5d7f5a"/><rect x="146" y="214" width="68" height="4" fill="#5d7f5a"/><rect x="146" y="174" width="68" height="84" fill="none" stroke="#3f5a3e" stroke-width="3"/>' +
          '<rect x="146" y="276" width="68" height="104" rx="3" fill="none" stroke="#3f5a3e" stroke-width="3"/><circle cx="216" cy="292" r="5" fill="#d9b24a" stroke="#7a5a1a" stroke-width="1.5"/><rect x="118" y="398" width="124" height="8" fill="#9a958a"/>';
        if (c.flap) s += '<rect x="162" y="356" width="36" height="40" rx="9" fill="#3f5a3e" stroke="#2a3a28" stroke-width="2"/><rect x="167" y="362" width="26" height="30" rx="6" fill="#a8b8a0" opacity=".6"/>';
        if (['advent', 'mikulas', 'vanoce'].some(x => c.hol.includes(x))) s += '<circle cx="180" cy="318" r="18" fill="none" stroke="#2f6b3a" stroke-width="9"/><path d="M174 336l6-6 6 6M180 330v10" stroke="#c0392b" stroke-width="3" fill="none" stroke-linecap="round"/><g fill="#c0392b"><circle cx="166" cy="310" r="2.6"/><circle cx="194" cy="322" r="2.6"/><circle cx="186" cy="302" r="2.6"/></g>';
        // coat rack with a coat, a scarf and a hat; a wall lamp; an umbrella
        s += '<rect x="262" y="148" width="126" height="12" rx="3" fill="#8a5a32" stroke="#5a3a20" stroke-width="2"/><g fill="#5a3a20"><circle cx="282" cy="166" r="4"/><circle cx="314" cy="166" r="4"/><circle cx="346" cy="166" r="4"/><circle cx="374" cy="166" r="4"/></g>' +
          '<path d="M282 166L266 190L262 300H304L300 190Z" fill="#8a3a2a" stroke="#4a1a10" stroke-width="2" stroke-linejoin="round"/><path d="M282 170V298M274 200l8 12 8-12" stroke="#4a1a10" stroke-width="2" fill="none"/>' +
          '<path d="M346 166Q336 220 340 262H352Q350 220 346 166Z" fill="#3f78a8" stroke="#1f3a58" stroke-width="2"/><path d="M341 236h10M340 248h12" stroke="#f3e6d2" stroke-width="3"/>' +
          '<path d="M360 182Q362 162 374 162Q386 162 388 182Z" fill="#6b5a3a" stroke="#3a2a1a" stroke-width="2"/><path d="M354 184H394" stroke="#3a2a1a" stroke-width="3" stroke-linecap="round"/>';
        s += `<rect x="78" y="176" width="12" height="20" rx="3" fill="#8a5a32"/><path d="M70 172H98L92 154H76Z" fill="${c.ph === 'evening' || c.ph === 'night' ? '#f6c766' : '#d99a3e'}" stroke="#8a5a22" stroke-width="1.5"/>`;
        s += '<rect x="36" y="336" width="34" height="66" rx="5" fill="#9a958a" stroke="#5a564e" stroke-width="2"/><path d="M53 336V270" stroke="#3a2a1a" stroke-width="3"/><path d="M53 270q-6-4-6-10" stroke="#3a2a1a" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M42 336Q46 296 53 286Q60 296 64 336Z" fill="#c0503a" stroke="#6a1a10" stroke-width="2"/>';
        s += planks() + '<ellipse cx="180" cy="432" rx="66" ry="14" fill="#9a7040" stroke="#6a4a24" stroke-width="2"/><ellipse cx="180" cy="432" rx="52" ry="9" fill="none" stroke="#b88a54" stroke-width="2" stroke-dasharray="4 3"/>';
        s += '<path d="M62 548V524Q62 516 70 516H84Q90 516 90 524V534Q104 536 108 544V548Z" fill="#7a4a28" stroke="#3a2210" stroke-width="2.5" stroke-linejoin="round"/><path d="M62 548H110" stroke="#3a2210" stroke-width="4" stroke-linecap="round"/><path d="M70 526h12M72 532h10" stroke="#c9a070" stroke-width="1.6"/>';
        return s + light(c, 84, 166);
      },
    },
    garden: {
      name: 'Zahrada',
      spots: {
        door: { x: 44, y: 404 }, gate: { x: 278, y: 390 }, tree: { x: 344, y: 444 }, branch: { x: 278, y: 226 }, branch2: { x: 360, y: 186 },
        bench: { x: 184, y: 420 }, feeder: { x: 108, y: 266 }, yard: { x: 200, y: 470 },
        bed1: { x: 59, y: 566 }, bed2: { x: 155, y: 566 }, bed3: { x: 251, y: 566 }, bed4: { x: 347, y: 566 }, pond: { x: 280, y: 478 }, fence: { x: 120, y: 308 },
      },
      draw(c) {
        const { ph, se } = c, id = nid(), snow = se === 'winter', dusk = ph === 'evening' || ph === 'night';
        let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKY[ph][0]}"/><stop offset="1" stop-color="${SKY[ph][1]}"/></linearGradient></defs><rect width="400" height="400" fill="url(#${id})"/>`;
        // sun, moon, clouds, hills with the castle far away
        const sx = r1(40 + Math.min(1, Math.max(0, Number(c.sunX) || 0)) * 320);
        if ((ph === 'day' || ph === 'morning') && !c.weather) s += `<circle cx="${sx}" cy="${ph === 'morning' ? 190 : 80}" r="20" fill="#fff3c0"/><circle cx="${sx}" cy="${ph === 'morning' ? 190 : 80}" r="30" fill="#fff3c0" opacity=".3"/>`;
        if (ph === 'evening') s += '<circle cx="330" cy="250" r="26" fill="#ffc77a"/><circle cx="330" cy="250" r="40" fill="#ffb066" opacity=".35"/>';
        if (ph === 'night') s += '<g fill="#fff"><circle cx="40" cy="40" r="1.4"/><circle cx="120" cy="70" r="1.2"/><circle cx="190" cy="30" r="1.5"/><circle cx="250" cy="90" r="1.1"/><circle cx="90" cy="130" r="1.2"/><circle cx="210" cy="150" r="1"/><circle cx="160" cy="100" r="1.1"/></g><circle cx="230" cy="60" r="16" fill="#f4ecc8"/><circle cx="238" cy="54" r="15" fill="#0d1838"/>';
        if (ph === 'day' && !c.weather) s += '<g fill="#fff" opacity=".9"><ellipse cx="150" cy="90" rx="30" ry="10"/><ellipse cx="166" cy="80" rx="18" ry="12"/><ellipse cx="60" cy="150" rx="22" ry="8"/></g>';
        if (c.weather) s += '<rect width="400" height="400" fill="#7a8794" opacity=".45"/><g fill="#b9c3cc" opacity=".8"><ellipse cx="90" cy="60" rx="70" ry="22"/><ellipse cx="240" cy="40" rx="90" ry="26"/><ellipse cx="360" cy="80" rx="60" ry="20"/></g>';
        s += `<path d="M0 300Q80 240 170 268T400 250V400H0Z" fill="${HILL[se]}"/><g fill="#d9ccb0"><rect x="212" y="246" width="30" height="16"/><rect x="228" y="232" width="7" height="16"/></g><path d="M209 248h36l-6-7h-24zM227 233h10l-5-8z" fill="#a8513a"/>`;
        // the fence with the gate
        const posts = [8, 60, 112, 164, 216, 320, 372];
        s += `<g fill="#b08a5a" stroke="#6b4a2e" stroke-width="2"><rect x="0" y="322" width="400" height="9"/><rect x="0" y="356" width="400" height="9"/>${posts.map(x => `<rect x="${x}" y="300" width="14" height="92" rx="2"/>`).join('')}` +
          Array.from({ length: 20 }, (_, i) => 10 + i * 20).filter(x => x < 238 || x > 316).map(x => `<path d="M${x} 392V312l6-8 6 8V392Z"/>`).join('') + '</g>';
        s += '<g stroke="#5a3a20" stroke-width="2.5" stroke-linejoin="round"><rect x="240" y="306" width="10" height="88" fill="#8a5a32"/><rect x="306" y="306" width="10" height="88" fill="#8a5a32"/><rect x="252" y="316" width="52" height="72" fill="#c49a62"/><path d="M252 384L304 320M252 316H304M252 352H304M252 388H304" fill="none"/></g><circle cx="298" cy="352" r="3.5" fill="#3a3f44"/>';
        if (snow) s += '<path d="M0 320H400v4H0Z" fill="#fff"/>' + posts.map(x => `<ellipse cx="${x + 7}" cy="300" rx="9" ry="4" fill="#fff"/>`).join('');
        // the house with the back door and a window
        s += `<rect x="0" y="118" width="88" height="292" fill="#efe2c8" stroke="#a8946a" stroke-width="2"/><path d="M-6 120L96 104V124L-6 136Z" fill="#a8513a" stroke="#6a2a1a" stroke-width="2"/>${snow ? '<path d="M-6 118L96 102V108L-6 124Z" fill="#fff"/>' : ''}` +
          `<rect x="22" y="146" width="44" height="50" fill="#7c4f2c"/><rect x="27" y="151" width="34" height="40" fill="${dusk ? '#ffd27a' : '#9fc6dc'}"/><path d="M44 151V191M27 171H61" stroke="#7c4f2c" stroke-width="3"/>` +
          '<rect x="16" y="246" width="56" height="158" fill="#5a3a20"/><rect x="21" y="251" width="46" height="153" fill="#8e5d35"/><rect x="29" y="262" width="30" height="30" fill="#9fc6dc" stroke="#5a3a20" stroke-width="3"/><circle cx="60" cy="334" r="3.5" fill="#d9b24a"/><rect x="8" y="402" width="72" height="9" fill="#9a958a"/>';
        if (dusk) s += '<circle cx="44" cy="171" r="40" fill="#ffd27a" opacity=".22"/>';
        // grass, stepping stones
        s += `<rect y="386" width="400" height="214" fill="${GROUND[se]}"/>`;
        if (!snow) s += `<g stroke="${se === 'autumn' ? '#8f6e30' : '#3f7a2c'}" stroke-width="2" stroke-linecap="round" opacity=".55">${[[30, 440], [120, 452], [228, 446], [320, 470], [70, 488], [180, 482], [370, 432], [260, 492]].map(([x, y]) => `<path d="M${x} ${y}l-3-8M${x + 4} ${y}l1-9M${x + 8} ${y}l4-7"/>`).join('')}</g>`;
        s += `<g fill="${snow ? '#dfe7ee' : '#b8b2a4'}" stroke="${snow ? '#b8c6d2' : '#8a8478'}" stroke-width="2">${[[50, 424, 18], [100, 418, 16], [150, 412, 15], [206, 406, 14], [254, 400, 13]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r1(r * 0.42)}"/>`).join('')}</g>`;
        if (se === 'spring' || se === 'summer') s += `<g>${[[24, 470, '#f4d03f'], [140, 476, '#f7b6c8'], [214, 466, '#fff'], [300, 478, '#f4d03f'], [380, 462, '#f7b6c8'], [90, 456, '#fff']].map(([x, y, col]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="${col}" stroke="#2e2118" stroke-width=".8"/>`).join('')}</g>`;
        if (se === 'autumn') s += `<g>${[[40, 450, '#d98a2b'], [150, 470, '#c0552c'], [230, 460, '#e6b040'], [300, 486, '#d98a2b'], [372, 470, '#c0552c'], [100, 480, '#e6b040']].map(([x, y, col], i) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="2.6" fill="${col}" transform="rotate(${i * 37} ${x} ${y})"/>`).join('')}</g>`;
        if (snow) s += `<g fill="#b8c6d2">${Array.from({ length: 9 }, (_, i) => { const x = 74 + i * 22, y = 430 + Math.sin(i * 1.3) * 8 + i * 2; return `<circle cx="${r1(x)}" cy="${r1(y)}" r="2.2"/><circle cx="${r1(x - 3)}" cy="${r1(y - 4)}" r="1.1"/><circle cx="${r1(x + 1)}" cy="${r1(y - 5)}" r="1.1"/><circle cx="${r1(x + 4)}" cy="${r1(y - 3)}" r="1.1"/>`; }).join('')}</g>`;
        // the pond (Rybaření): stones round the water, a lily pad and reeds; frozen in winter
        s += `<ellipse cx="280" cy="478" rx="50" ry="17" fill="#9a958a" stroke="#6a665e" stroke-width="2"/><ellipse cx="280" cy="478" rx="42" ry="12" fill="${snow ? '#d8eaf4' : '#4f8fb8'}"/>` +
          (snow ? '<path d="M256 474l10 4 8-5M292 480l12-3" stroke="#fff" stroke-width="2" fill="none"/>' : '<path d="M254 474q10-3 20 0M286 482q8-3 16 0" stroke="#bfe0f0" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M296 470a8 4 0 1 0 12 2l-6 0z" fill="#5f9e3e" stroke="#2e5a20" stroke-width="1.2"/>') +
          (snow ? '' : '<g stroke="#4c7a3a" stroke-width="2.4" stroke-linecap="round"><path d="M318 476l-2-20M322 476l2-16M326 478l6-14"/></g><g fill="#6b4a2e"><ellipse cx="316" cy="455" rx="2.4" ry="5"/><ellipse cx="324" cy="459" rx="2.4" ry="5"/></g>');
        // the bird feeder
        s += `<path d="M108 412V292" stroke="#6b4a2e" stroke-width="6"/><path d="M84 276L108 258L132 276Z" fill="#a8513a" stroke="#6a2a1a" stroke-width="2"/><rect x="90" y="276" width="36" height="20" fill="#e9d6b0" stroke="#6b4a2e" stroke-width="2"/><rect x="84" y="294" width="48" height="6" rx="2" fill="#8a5a32"/>${snow ? '<path d="M82 274L108 256L134 274" stroke="#fff" stroke-width="4" fill="none"/>' : ''}`;
        // the bench
        s += `<g stroke="#5a3a20" stroke-width="2.5" stroke-linejoin="round"><rect x="138" y="424" width="8" height="30" fill="#5a3a20"/><rect x="222" y="424" width="8" height="30" fill="#5a3a20"/><rect x="140" y="378" width="88" height="10" rx="3" fill="#9a6a3a"/><rect x="140" y="394" width="88" height="10" rx="3" fill="#9a6a3a"/><path d="M146 404V420M222 404V420" /><rect x="130" y="414" width="108" height="12" rx="3" fill="#b07a42"/></g>${snow ? '<rect x="132" y="410" width="104" height="5" rx="2" fill="#fff"/>' : ''}`;
        // the tree with two branches to sit on
        s += '<path d="M326 446C330 380 334 300 330 196L352 190C356 300 360 380 366 446Z" fill="#6b4a2e" stroke="#3e2a18" stroke-width="2.5"/><path d="M334 400q6-14 2-30M346 330q-6-16 0-34M340 250q6-12 2-24" stroke="#4e3420" stroke-width="2" fill="none"/>' +
          '<path d="M334 248Q300 236 262 230" stroke="#6b4a2e" stroke-width="12" stroke-linecap="round"/><path d="M350 204Q370 192 396 182" stroke="#6b4a2e" stroke-width="10" stroke-linecap="round"/>';
        if (snow) s += '<path d="M262 226Q300 232 330 242M354 198Q372 188 394 178" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none"/>' + crown('winter', 340, 140, 3.2);
        else s += `<g opacity="${se === 'autumn' ? 0.95 : 1}">${crown(se, 336, 132, 3.4)}</g>`;
        // the beds (záhony): wooden edges, soil, snow in winter
        for (let i = 0; i < 4; i++) {
          const x = 16 + i * 96;
          s += `<rect x="${x}" y="508" width="86" height="72" rx="6" fill="#8a5a32" stroke="#4a2e18" stroke-width="2.5"/><rect x="${x + 7}" y="515" width="72" height="58" rx="4" fill="${snow ? '#f2f6f9' : '#5a3a22'}"/>` +
            (snow ? '' : `<path d="M${x + 12} 530H${x + 74}M${x + 12} 546H${x + 74}M${x + 12} 562H${x + 74}" stroke="#46301c" stroke-width="2"/>`);
        }
        // the light of the day phase; fireflies on summer nights; the weather
        if (ph === 'morning') s += '<rect width="400" height="600" fill="#ffb36b" opacity=".08"/>';
        if (ph === 'evening') s += '<rect width="400" height="600" fill="#ff8a3a" opacity=".12"/><rect width="400" height="600" fill="#3a1a08" opacity=".14"/>';
        if (ph === 'night') s += '<path d="M0 0H400V600H0ZM27 151V191H61V151Z" fill="#33407a" style="mix-blend-mode:multiply" fill-rule="evenodd"/>';
        if (ph === 'night' && se === 'summer') s += `<g class="kx-flies">${[[60, 440, 0], [150, 360, 0.7], [240, 470, 1.4], [320, 380, 0.4], [370, 500, 1.1], [110, 520, 1.8], [210, 300, 2.2]].map(([x, y, d]) =>
          `<g style="animation-delay:${d}s"><circle cx="${x}" cy="${y}" r="7" fill="#f6f08a" opacity=".3"/><circle cx="${x}" cy="${y}" r="2.4" fill="#fbf7b0"/></g>`).join('')}</g>`;
        if (c.weather === 'rain') s += '<rect width="400" height="600" fill="#5a6a7a" opacity=".18"/><g fill="#9fb4c6" opacity=".55"><ellipse cx="120" cy="450" rx="30" ry="6"/><ellipse cx="300" cy="500" rx="24" ry="5"/></g>';
        s += weatherFx(c.weather, 0, 0, 400, 600);
        return s;
      },
    },
  };
  // room({ id, phase, season, sunX, holiday, flap, weather }) or the old room(phase, season) = the living room
  function room(a, b) {
    const o = typeof a === 'string' ? { phase: a, season: b } : Object.assign({}, a);
    const P = PLACES[o.id] || PLACES.living;
    const c = { ph: SKY[o.phase] ? o.phase : 'day', se: HILL[o.season] ? o.season : 'summer', sunX: Number.isFinite(o.sunX) ? Math.min(1, Math.max(0, o.sunX)) : 0.5,
      hol: [].concat(o.holiday || []), flap: !!o.flap, weather: o.weather === 'rain' || o.weather === 'snow' ? o.weather : null, holes: [] };
    return `<svg class="kx-room" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${P.draw(c)}</svg>`;
  }
  const rooms = {};
  for (const k of Object.keys(PLACES)) rooms[k] = { name: PLACES[k].name, spots: JSON.parse(JSON.stringify(PLACES[k].spots)) };
  // the old single-room spots (the living room with the bowls, the litter box and the door where they used to be)
  const spotsAt = { bowl: { x: 64, y: 472 }, water: { x: 44, y: 566 }, litter: { x: 340, y: 474 }, bed: { x: 316, y: 562 }, window: { x: 130, y: 268 }, door: { x: 342, y: 402 } };

  /* ---------- the lap close-up: your knees from above in the armchair (or on the garden bench) ---------- */
  const lapSpot = { x: 200, y: 452, size: 380 };   // her box is size × size scene units, its point (100, 186) at (x, y)
  function lap(o) {
    o = Object.assign({}, o);
    const c = { ph: SKY[o.phase] ? o.phase : 'day', se: HILL[o.season] ? o.season : 'summer', hol: [], holes: [] }, bench = o.place === 'bench', id = nid();
    let s = '';
    if (bench) {
      s += `<rect width="400" height="600" fill="${GROUND[c.se]}"/><g stroke="#3f7a2c" stroke-width="2.4" opacity=".5" stroke-linecap="round">${[[30, 60], [360, 90], [50, 300], [370, 330], [20, 520], [380, 560]].map(([x, y]) => `<path d="M${x} ${y}l-4-10M${x + 5} ${y}l1-11M${x + 10} ${y}l5-9"/>`).join('')}</g>` +
        '<g fill="#b07a42" stroke="#5a3a20" stroke-width="3">' + [150, 250, 350, 450, 550].map(y => `<rect x="-10" y="${y}" width="420" height="80" rx="6"/>`).join('') + '</g>';
    } else {
      s += `<rect width="400" height="600" fill="#a87442"/><path d="M0 40H400M0 90H400M0 140H400" stroke="#8e5f34" stroke-width="3"/><rect y="150" width="400" height="450" fill="${AC.fab}"/>` +
        `<path d="M0 150H400" stroke="${AC.line}" stroke-width="3"/><g fill="${AC.dark}" stroke="${AC.line}" stroke-width="3"><path d="M-10 120Q60 120 70 170V600H-10Z"/><path d="M410 120Q340 120 330 170V600H410Z"/></g>` +
        `<path d="M58 180V600M342 180V600" stroke="${AC.light}" stroke-width="4" opacity=".7"/>`;
    }
    // the thighs in trousers, knees towards the top
    s += '<g fill="#4f6f91" stroke="#2e4560" stroke-width="3" stroke-linejoin="round"><path d="M84 600L80 214Q82 136 140 132Q196 132 198 210L200 600Z"/><path d="M316 600L320 214Q318 136 260 132Q204 132 202 210L200 600Z"/></g>' +
      '<g fill="#6f8fb1" opacity=".55"><ellipse cx="140" cy="172" rx="34" ry="22"/><ellipse cx="260" cy="172" rx="34" ry="22"/></g><path d="M200 210V600" stroke="#2e4560" stroke-width="4"/><path d="M96 260Q100 420 96 600M304 260Q300 420 304 600" stroke="#c9a85a" stroke-width="2" stroke-dasharray="6 5" fill="none" opacity=".8"/>';
    if (c.se === 'winter') s += `<defs>${gingham(id)}</defs><path d="M70 380Q200 360 330 380V600H70Z" fill="url(#${id})" stroke="#9a4a3a" stroke-width="2"/><path d="M70 380Q200 360 330 380" stroke="#c0503a" stroke-width="6" fill="none"/>`;
    s += bench ? (c.ph === 'night' ? '<rect width="400" height="600" fill="#33407a" style="mix-blend-mode:multiply"/>' : c.ph === 'evening' ? '<rect width="400" height="600" fill="#ff8a3a" opacity=".14"/>' : '') : light(c, 200, -40);
    return `<svg class="kx-room" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg>`;
  }

  /* ---------- crops for the garden beds: crop(name, stage 0..3), viewBox 0 0 100 100, standing on y≈90 ---------- */
  const CROPS = ['plant', 'radish', 'carrot', 'strawberry', 'tomato', 'catnip'];
  const cropSlot = { x: 50, y: 40, size: 36 };     // where a produce drawing can sit on a ripe 'plant'
  const leaf = (x, y, len, ang, col, wid = 0.36) => `<path d="M0 0Q${r1(len / 2)} ${r1(-len * wid)} ${len} 0Q${r1(len / 2)} ${r1(len * wid)} 0 0Z" transform="translate(${x} ${y}) rotate(${ang})" fill="${col}" stroke="${IO}" stroke-width="1.6"/>`;
  function crop(name, stage) {
    if (!CROPS.includes(name)) name = 'plant';
    const n = Math.max(0, Math.min(3, Math.round(Number(stage) || 0)));
    let s = `<ellipse cx="50" cy="88" rx="32" ry="7" fill="#5a3a22" stroke="${IO}" stroke-width="2"/>`;
    const G1 = '#6fb04a', G2 = '#4c8c38', NIP = '#8fb39a';
    if (n === 0) return wrap(s + '<g fill="#d9b24a" stroke="#2e2118" stroke-width=".8"><ellipse cx="40" cy="86" rx="2.4" ry="1.6"/><ellipse cx="52" cy="88" rx="2.4" ry="1.6"/><ellipse cx="62" cy="85" rx="2.4" ry="1.6"/></g>');
    if (n === 1) return wrap(s + `<path d="M50 87V74" stroke="${G2}" stroke-width="2.6"/>` + leaf(50, 75, 13, -150, name === 'catnip' ? NIP : G1) + leaf(50, 75, 13, -30, name === 'catnip' ? NIP : G1));
    if (name === 'catnip') {
      s += '<path d="M42 87V40M50 87V30M58 87V44" stroke="#5f8a5a" stroke-width="2.6"/>';
      for (const [x, y0] of [[42, 40], [50, 30], [58, 44]]) for (let y = y0 + 8; y < 84; y += 14) s += leaf(x, y, 12, -160, NIP, 0.5) + leaf(x, y, 12, -20, NIP, 0.5);
      if (n === 3) s += '<g fill="#b9a2d8" stroke="#5a4a7a" stroke-width="1">' + [[42, 40], [50, 30], [58, 44]].map(([x, y]) => `<ellipse cx="${x}" cy="${y - 4}" rx="3.4" ry="8"/>`).join('') + '</g>';
      return wrap(s);
    }
    if (name === 'tomato' && n === 3) s += '<path d="M72 88V22" stroke="#a8743f" stroke-width="3.4"/>';
    const tall = name === 'tomato' ? 34 : name === 'carrot' ? 44 : 50;
    s += `<path d="M50 87V${n === 2 ? 64 : tall}" stroke="${G2}" stroke-width="3"/>`;
    const lv = name === 'carrot' ? [[50, 72, 22, -120], [50, 72, 22, -60], [50, 64, 20, -100], [50, 64, 20, -80]] : n === 2 ? [[50, 76, 16, -160], [50, 76, 16, -20], [50, 68, 14, -130], [50, 68, 14, -50]]
      : [[50, 78, 20, -165], [50, 78, 20, -15], [50, 66, 18, -140], [50, 66, 18, -40], [50, tall + 8, 16, -115], [50, tall + 8, 16, -65]];
    s += lv.map(([x, y, l, a]) => leaf(x, y, l, a, name === 'carrot' ? G1 : G2, name === 'carrot' ? 0.18 : 0.36)).join('');
    if (n === 3) {
      if (name === 'radish') s += `<circle cx="50" cy="84" r="9" fill="#d9465a" stroke="${IO}" stroke-width="2"/><path d="M46 80q2-3 5-3" stroke="#fff" stroke-width="1.6" fill="none" opacity=".7"/>`;
      if (name === 'carrot') s += `<path d="M42 86Q50 78 58 86L54 90H46Z" fill="#e8892b" stroke="${IO}" stroke-width="2"/>`;
      if (name === 'strawberry') s += [[34, 74], [64, 78], [56, 62]].map(([x, y]) => `<path d="M${x - 6} ${y - 4}Q${x} ${y - 8} ${x + 6} ${y - 4}Q${x + 4} ${y + 6} ${x} ${y + 8}Q${x - 4} ${y + 6} ${x - 6} ${y - 4}Z" fill="#d9324a" stroke="${IO}" stroke-width="1.6"/><path d="M${x - 4} ${y - 5}l4 2 4-2" stroke="${G1}" stroke-width="2" fill="none"/>`).join('');
      if (name === 'tomato') s += [[62, 46, 7], [70, 62, 8], [60, 74, 6.5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#e0402e" stroke="${IO}" stroke-width="1.8"/><path d="M${x - 3} ${y - r + 1}l3 2 3-2" stroke="${G2}" stroke-width="1.8" fill="none"/>`).join('');
    }
    return wrap(s);
  }
  const wrap = s => `<svg class="kx-item" viewBox="0 0 100 100" aria-hidden="true">${s}</svg>`;


  /* ---------- items' natural size and the hot points of some items ---------- */
  // the size of each item's 100 × 100 box in room units (the drawing stands on y≈90 of its box)
  const itemSize = {};
  for (const [k, v] of Object.entries({ bowl: 58, bowlEmpty: 58, bowlFull: 58, waterBowl: 52, waterBowlEmpty: 52, litter: 104, litterDirty: 104, bed: 150, mouse: 34, catnipMouse: 34,
    feather: 70, yarn: 40, laserDot: 30, treat: 30, foodBag: 60, jug: 56, brush: 50, scoop: 50, pouch: 40, chicken: 56, tuna: 44, vacuum: 140, seedPacket: 40, wateringCan: 70, trowel: 44,
    pill: 24, pouchPack: 70, chickenPack: 70, tunaPack: 64, treatBag: 50, ballBell: 34, box: 120, tunnel: 190, scratcher: 130, catTree: 240, sillCushion: 140, bedDeluxe: 160,
    rugRound: 280, lamp: 170, birdFeeder: 150, catFlap: 60, fishingRod: 120, featherWand: 120, featherBunch: 40 })) itemSize[k] = { w: v, h: v };
  // in the item's own 100 × 100 box: the rod / wand tip (where the UI hangs its own string), the cat tree's platforms
  const itemPoints = { fishingRod: { tip: { x: 70, y: 10 } }, featherWand: { tip: { x: 60, y: 14 } }, catTree: { platforms: [{ x: 32, y: 58 }, { x: 71, y: 36 }, { x: 47, y: 8 }] } };

  /* ---------- minigames ---------- */
  // the hole in the skirting board (Chyť myšku); mousePeek(phase 0..1): the same hole with a toy-grey mouse coming out
  const HOLE = 'M30 90V68Q30 50 50 50Q70 50 70 68V90Z';
  const skirting = `<rect x="0" y="62" width="100" height="30" fill="#6e4a2c"/><path d="M0 64H100" stroke="#8f6038" stroke-width="3"/><path d="${HOLE}" fill="#1a120c"${st(2.5)}/>`;
  function mouseHole() { return wrap(skirting); }
  function mousePeek(phase) {
    const t = Math.max(0, Math.min(1, Number(phase) || 0)), y = r1(104 - 34 * t), id = nid();
    return wrap(skirting + `<defs><clipPath id="${id}"><path d="${HOLE}"/></clipPath></defs><g clip-path="url(#${id})"><g transform="translate(50 ${y})">` +
      `<circle cx="-10" cy="-10" r="7" fill="#b9b9b9"${st(2)}/><circle cx="10" cy="-10" r="7" fill="#b9b9b9"${st(2)}/><circle cx="-10" cy="-10" r="3.4" fill="#e6a2a8"/><circle cx="10" cy="-10" r="3.4" fill="#e6a2a8"/>` +
      `<ellipse cx="0" cy="2" rx="12" ry="11" fill="#9b9b9b"${st(2)}/><circle cx="-4.5" cy="0" r="2" fill="${IO}"/><circle cx="4.5" cy="0" r="2" fill="${IO}"/><circle cx="0" cy="7" r="2.2" fill="#e6a2a8"/>` +
      `<path d="M-3 7l-11-2M-3 8l-11 3M3 7l11-2M3 8l11 3" stroke="#eee" stroke-width=".9"/></g></g>`);
  }
  // fish for the pond (Rybaření): goldfish, carp, perch
  const FISH = { goldfish: ['#ef8a2b', '#f6b45a', null], carp: ['#9a8a5a', '#c4b27a', null], perch: ['#7a9a4a', '#c8d48a', '#3e5a2a'] };
  function fish(kind) {
    const [body, belly, stripe] = FISH[kind] || FISH.goldfish;
    return wrap(`<path d="M74 50L94 36V64Z" fill="${body}"${st(2.5)}/><path d="M8 50Q30 26 62 34Q80 42 78 50Q80 58 62 66Q30 74 8 50Z" fill="${body}"${st(2.5)}/>` +
      `<path d="M16 54Q40 66 70 56" fill="none" stroke="${belly}" stroke-width="5" stroke-linecap="round"/><path d="M40 34Q46 24 56 30" fill="${body}"${st(2)}/>` +
      (stripe ? `<path d="M34 34V64M46 32V66M58 34V62" stroke="${stripe}" stroke-width="3.4"/>` : '') + `<circle cx="22" cy="46" r="3.4" fill="#fff"${st(1.4)}/><circle cx="22.6" cy="46" r="1.6" fill="${IO}"/><path d="M28 40Q32 50 28 60" stroke="${IO}" stroke-width="1.6" fill="none"/>`);
  }
  // a laser-run checkpoint on the floor; done = green with a tick
  function marker(done) {
    const c = done ? '#4fae6a' : '#e85a4a';
    return wrap(`<ellipse cx="50" cy="70" rx="40" ry="15" fill="${c}" opacity=".18"/><ellipse cx="50" cy="70" rx="32" ry="12" fill="none" stroke="${c}" stroke-width="5"/><ellipse cx="50" cy="70" rx="32" ry="12" fill="none"${st(1.6)}/>` +
      (done ? `<path d="M36 68l10 8 18-14" fill="none" stroke="#2e7a44" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` : `<g transform="translate(50 70) scale(1 .45)">${PAWMARK(0, 0, 1.4, c)}</g>`));
  }

  /* ---------- Obchůdek paní Novákové (400 × 600, slice): shelves of cat things, the counter, only her apron and hands ---------- */
  const shopSpots = { counter: { x: 200, y: 382 } };   // the middle of the counter top, where goods are put down
  function shop() {
    const it = (name, x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})">${quiet(ITEMS[name])}</g>`;
    let s = wallFill('#eadcc0') + '<rect x="120" y="14" width="160" height="44" rx="8" fill="#7a4520" stroke="#3f220e" stroke-width="3"/><text x="200" y="45" text-anchor="middle" font-family="Georgia,serif" font-size="25" font-weight="700" fill="#f4e6c8">Obchůdek</text>';
    for (const y of [138, 228, 318]) s += `<rect x="14" y="${y}" width="372" height="10" rx="2" fill="#8a5a32" stroke="#5a3a20" stroke-width="2"/>`;
    s += it('foodBag', 20, 78, 0.6) + it('foodBag', 70, 78, 0.6) + it('tunaPack', 128, 84, 0.56) + it('pouchPack', 186, 84, 0.56) + it('treatBag', 248, 80, 0.6) + it('treatBag', 296, 80, 0.6) + it('chickenPack', 336, 88, 0.52);
    s += it('mouse', 22, 178, 0.5) + it('catnipMouse', 66, 178, 0.5) + it('yarn', 112, 172, 0.56) + it('ballBell', 164, 176, 0.52) + it('featherWand', 210, 166, 0.62) + it('bowl', 268, 180, 0.5) + it('waterBowl', 322, 180, 0.5);
    s += it('box', 18, 264, 0.6) + it('tunnel', 86, 266, 0.6) + it('scratcher', 160, 258, 0.62) + it('bedDeluxe', 226, 268, 0.6) + it('lamp', 312, 254, 0.66);
    // the shopkeeper, drawn simply: grey bun, round glasses, a smile, a flowered apron, hands on the counter
    s += '<path d="M146 400V302Q146 268 200 264Q254 268 254 302V400Z" fill="#7fa8c8" stroke="#3f5a74" stroke-width="2.5"/><rect x="190" y="240" width="20" height="26" fill="#f2c9a8" stroke="#8a5a3a" stroke-width="2"/>' +
      '<circle cx="200" cy="168" r="13" fill="#d9d9d9" stroke="#8a8a8a" stroke-width="2"/><circle cx="200" cy="214" r="32" fill="#f2c9a8" stroke="#8a5a3a" stroke-width="2.5"/><path d="M168 208Q170 180 200 180Q230 180 232 208Q222 192 200 192Q178 192 168 208Z" fill="#d9d9d9" stroke="#8a8a8a" stroke-width="2"/>' +
      '<g fill="none" stroke="#5a4a3a" stroke-width="2"><circle cx="188" cy="214" r="8"/><circle cx="212" cy="214" r="8"/><path d="M196 214h8"/></g><g fill="#3a2a1e"><circle cx="188" cy="214" r="2.4"/><circle cx="212" cy="214" r="2.4"/></g>' +
      '<g fill="#e8908a" opacity=".5"><ellipse cx="180" cy="228" rx="6" ry="3.5"/><ellipse cx="220" cy="228" rx="6" ry="3.5"/></g><path d="M190 232Q200 240 210 232" fill="none" stroke="#8a3a2a" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M156 284Q146 330 166 374M244 284Q254 330 234 374" fill="none" stroke="#3f5a74" stroke-width="19" stroke-linecap="round"/><path d="M156 284Q146 330 166 374M244 284Q254 330 234 374" fill="none" stroke="#7fa8c8" stroke-width="14" stroke-linecap="round"/><path d="M164 400V306Q200 292 236 306V400Z" fill="#f4e6c8" stroke="#8a6a3a" stroke-width="2"/>' +
      '<path d="M174 306Q200 280 226 306" fill="none" stroke="#8a6a3a" stroke-width="2"/><g fill="#e05a7a">' + [[180, 330], [214, 324], [196, 352], [222, 362], [178, 372]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4"/>`).join('') + '</g><g fill="#6fb04a">' + [[186, 336], [208, 330], [190, 358]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4"/>`).join('') + '</g>';
    // the counter with an old till, a bell and a jar of treats
    s += '<rect y="386" width="400" height="214" fill="#9a6a3a"/><path d="M0 430H400M0 500H400M0 570H400" stroke="#7a4f28" stroke-width="3"/><rect y="374" width="400" height="16" rx="3" fill="#b98552" stroke="#6b4426" stroke-width="2.5"/>';
    s += '<g stroke="#3a3f44" stroke-width="2.5"><path d="M286 374V336Q286 326 296 326H354Q364 326 364 336V374Z" fill="#9aa4aa"/><rect x="298" y="306" width="54" height="22" rx="3" fill="#cfd6da"/></g><g fill="#3a3f44">' +
      [0, 1, 2, 3].map(i => `<rect x="${296 + i * 14}" y="344" width="9" height="7" rx="1.5"/><rect x="${296 + i * 14}" y="356" width="9" height="7" rx="1.5"/>`).join('') + '</g>';
    s += '<path d="M60 374Q60 356 74 356Q88 356 88 374Z" fill="#e6b040" stroke="#7a5a1a" stroke-width="2"/><circle cx="74" cy="352" r="3" fill="#7a5a1a"/>' +
      '<path d="M108 374V340Q108 334 114 334H142Q148 334 148 340V374Z" fill="#cfe6f2" fill-opacity=".7" stroke="#5f8fb4" stroke-width="2.5"/><rect x="110" y="326" width="36" height="9" rx="3" fill="#c8574a" stroke="#6a1a10" stroke-width="2"/>' +
      [[118, 360], [130, 352], [138, 364], [124, 368]].map(([x, y]) => `<g transform="translate(${x - 8} ${y - 6}) scale(.16)">${quiet(ITEMS.treat)}</g>`).join('');
    s += '<g fill="#f2c9a8" stroke="#8a5a3a" stroke-width="2"><path d="M160 384Q156 370 168 368Q182 368 184 380Z"/><path d="M240 384Q244 370 232 368Q218 368 216 380Z"/></g>';
    return `<svg class="kx-room" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg>`;
  }

  /* ---------- album frames (drawn over the photo; the hole is transparent) ---------- */
  const postcardHole = { x: 12, y: 12, w: 276, h: 158 };   // in the postcard's viewBox 0 0 300 200
  const photoHole = { x: 12, y: 12, w: 176, h: 176 };      // in the photo's viewBox 0 0 200 236
  const escXml = t => String(t == null ? '' : t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const holeRect = (W, H, h) => `M0 0H${W}V${H}H0Z M${h.x} ${h.y}V${h.y + h.h}H${h.x + h.w}V${h.y}Z`;
  function postcardFrame(caption) {
    const P = postcardHole;
    const stamp = '<g transform="rotate(4 258 44)"><rect x="232" y="16" width="52" height="60" fill="#fff" stroke="#c9b38a" stroke-width="5" stroke-dasharray="3 3"/><rect x="238" y="22" width="40" height="48" fill="#bfe0f0"/>' +
      '<path d="M238 58q20-10 40-4v16h-40z" fill="#79ad5e"/><g fill="#efe4cc"><rect x="248" y="40" width="20" height="10"/><rect x="259" y="31" width="5" height="11"/></g><path d="M246 41h24l-3-4h-18zM258 32h7l-3.5-5z" fill="#a8513a"/></g>' +
      '<g fill="none" stroke="#5a4a6a" stroke-width="1.6" opacity=".7"><circle cx="232" cy="74" r="16"/><circle cx="232" cy="74" r="11"/><path d="M252 70q8-4 16 0t16 0M252 78q8-4 16 0t16 0"/></g>';
    return `<svg class="kx-card" viewBox="0 0 300 200" aria-hidden="true"><path d="${holeRect(300, 200, P)}" fill="#f6efe0" fill-rule="evenodd" stroke="#c9b38a" stroke-width="2"/>` +
      `<rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" fill="none" stroke="#c9b38a" stroke-width="2"/>${stamp}` +
      `<text x="150" y="190" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="15" fill="#5a3a20">${escXml(caption)}</text></svg>`;
  }
  function photoFrame() {
    return `<svg class="kx-card" viewBox="0 0 200 236" aria-hidden="true"><path d="${holeRect(200, 236, photoHole)}" fill="#fbfaf6" fill-rule="evenodd" stroke="#d9d2c4" stroke-width="2"/>` +
      `<rect x="${photoHole.x}" y="${photoHole.y}" width="${photoHole.w}" height="${photoHole.h}" fill="none" stroke="#d9d2c4" stroke-width="1.5"/></svg>`;
  }

  /* ---------- neighbour cats: the same rig in other coats ---------- */
  // a coat changes the palette (C) and these: pattern 'tortie'|'tabby'|'patches'|'none', blaze, socks (paw colour),
  // torn (a notch in the right ear), size, fluff (shaggy outline), whisk (whisker length), old (heavy lids)
  const NEIGHBOURS = {
    mourek: { name: 'Mourek', pattern: 'tabby', c: { fur: '#7d7f82', fur2: '#6a6c6f', edge: '#4a4c4f', patch: '#4a4b4e', patch2: '#5a5b5e', eye: '#9cc56a', earIn: '#c49a96' } },
    liza: { name: 'Líza', pattern: 'patches', c: { fur: '#f4f1ec', fur2: '#e2ddd5', edge: '#bdb5aa', ol: '#5a4d44', patch: '#8d8f94', patch2: '#a9abb0', eye: '#7cc0e8', earIn: '#e8b4b0', lid: '#6a5a50', nose: '#e8a0a0' } },
    bivoj: { name: 'Bivoj', pattern: 'tabby', torn: true, size: 1.12, c: { fur: '#d9822b', fur2: '#c47424', edge: '#9a5a1e', patch: '#b5631c', patch2: '#c97424', eye: '#e8b64a', earIn: '#e8a08a', lid: '#5a3a20', nose: '#c46a5a' } },
    ciperka: { name: 'Čiperka', pattern: 'patches', size: 0.84, c: { fur: '#f6f1e8', fur2: '#e6dfd2', edge: '#c0b6a8', ol: '#5a4d44', patch: '#2a2420', patch2: '#d9822b', eye: '#c8d24a', earIn: '#e8b4b0', lid: '#6a5a50', nose: '#e8a0a0' } },
    pacicka: { name: 'Pacička', pattern: 'none', socks: '#f6f1e8', c: { eye: '#e6c84a' } },
    rambo: { name: 'Rambo', pattern: 'tabby', fluff: 7, c: { fur: '#6e5236', fur2: '#5e452c', edge: '#4a3420', patch: '#3e2a18', patch2: '#4a3420', eye: '#d9a43a', earIn: '#b07a6a' } },
    sedivka: { name: 'Šedivka', pattern: 'patches', old: true, c: { fur: '#a7a9ad', fur2: '#96989c', edge: '#6a6c70', patch: '#c4c6ca', patch2: '#d4d6da', eye: '#b8d48a', earIn: '#c9a6a2', lid: '#3e3e42' } },
    fousek: { name: 'Fousek', pattern: 'none', fluff: 4, whisk: 1.45, c: { fur: '#f7f4ef', fur2: '#e8e3db', edge: '#c6bdb0', ol: '#5a4d44', eye: '#86b8e8', earIn: '#ecb8b4', lid: '#5a4d44', nose: '#eaa2a2' } },
  };
  function withCoat(coat, fn) {
    const save = COAT;
    Object.assign(C, KOXA_C, coat.c); COAT = coat;
    try { return fn(); } finally { Object.assign(C, KOXA_C); COAT = save; }
  }
  // neighbour(id, pose, opts): a visitor drawn like cat() (every pose works; sit, walk, loaf and onFence are the usual ones)
  function neighbour(id, pose, x) {
    const nb = NEIGHBOURS[id] || NEIGHBOURS.mourek;
    return withCoat(nb, () => cat(pose, x)).replace('class="koxa ', `class="koxa kx-nb kx-nb-${NEIGHBOURS[id] ? id : 'mourek'} `);
  }
  const neighbours = {};
  for (const k of Object.keys(NEIGHBOURS)) neighbours[k] = { name: NEIGHBOURS[k].name };

  /* ---------- motion ---------- */
  const css = `
.koxa{display:block;width:100%;height:100%;overflow:visible}
.kx-room,.kx-item{display:block;width:100%;height:100%}
.koxa .kx-eyes{animation:kx-blink 5.2s infinite}
.koxa .kx-earR{animation:kx-twitch 7s infinite 2s}
.koxa .kx-tail{animation:kx-sway 3.2s ease-in-out infinite}
.kx-m-happy .kx-tail{animation-duration:2.2s}
.kx-m-grumpy .kx-tail{animation:kx-lash .6s ease-in-out infinite}
.kx-m-sad .kx-tail{animation:none}
.koxa.kx-asleep .kx-tail{animation:kx-sway 9s ease-in-out infinite}
.kx-breathe{animation:kx-breathe 3.8s ease-in-out infinite}
.kx-purr{animation:kx-purr .12s linear infinite}
.kx-sneeze{animation:kx-sneeze 5s ease-in-out infinite}
.kx-wrig{animation:kx-wrig .34s ease-in-out infinite}
.kx-swing{animation:kx-swing 2.8s ease-in-out infinite}
.kx-gait .kx-leg{animation:kx-stride var(--kx-step,.8s) linear infinite}
.kx-gait .kx-knee{animation:kx-bend var(--kx-step,.8s) linear infinite}
.kx-gait .kx-phB{animation-delay:calc(var(--kx-step,.8s) * -.5)}
.kx-gait .kx-bobber{animation:kx-bob calc(var(--kx-step,.8s) / 2) ease-in-out infinite alternate}
.kx-trot .kx-leg{animation:kx-stride2 var(--kx-step,.42s) linear infinite}
.kx-trot .kx-knee{animation:kx-bend2 var(--kx-step,.42s) linear infinite}
.kx-trot .kx-phB{animation-delay:calc(var(--kx-step,.42s) * -.5)}
.kx-trot .kx-bobber{animation:kx-bob2 calc(var(--kx-step,.42s) / 2) ease-in-out infinite alternate}
.koxa .kx-tail.kx-tw{animation:kx-tw .32s ease-in-out infinite}
.kx-shakep{animation:kx-shakep .28s ease-in-out infinite}
.kx-flick{animation:kx-flick .5s steps(2) infinite}
.kx-drip path{animation:kx-drip 1.6s ease-in infinite}
.kx-rain{animation:kx-rain .5s linear infinite}
.kx-snow{animation:kx-snow 4s linear infinite}
.kx-flies>g{animation:kx-fly 2.6s ease-in-out infinite}
.kx-spin{animation:kx-spin 1.6s ease-in-out infinite}
.kx-card{display:block;width:100%;height:auto}
.kx-z{opacity:0;animation:kx-z 3s linear infinite}
.kx-fleas circle{animation:kx-hop 1.3s ease-in-out infinite}
.kx-scr{animation:kx-flick 1.1s steps(2) infinite}
.kx-laser{animation:kx-glow 1s ease-in-out infinite}
.kx-icon{display:inline-block;width:24px;height:24px;vertical-align:middle;flex:none}
.kx-fx{display:block;width:100%;height:100%;overflow:visible}
.kx-fx-float{animation:kx-float 1.6s ease-out forwards}
@keyframes kx-blink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
@keyframes kx-twitch{0%,86%,100%{transform:rotate(0)}89%{transform:rotate(16deg)}92%{transform:rotate(-4deg)}95%{transform:rotate(8deg)}}
@keyframes kx-sway{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
@keyframes kx-lash{0%,100%{transform:rotate(-13deg)}50%{transform:rotate(11deg)}}
@keyframes kx-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.012,1.04)}}
@keyframes kx-purr{0%,100%{transform:translate(0,0)}25%{transform:translate(.5px,-.4px)}75%{transform:translate(-.5px,.4px)}}
@keyframes kx-sneeze{0%,82%,100%{transform:none}87%{transform:translate(0,-2px) rotate(-6deg)}91%{transform:translate(0,4px) rotate(4deg) scale(1.04)}96%{transform:none}}
@keyframes kx-wrig{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
@keyframes kx-bob{0%{transform:translate(0,0)}100%{transform:translate(0,-2px)}}
@keyframes kx-bob2{0%{transform:translate(0,0)}100%{transform:translate(0,-4px)}}
@keyframes kx-stride{0%{transform:rotate(18deg)}60%{transform:rotate(-18deg)}80%{transform:rotate(0deg)}100%{transform:rotate(18deg)}}
@keyframes kx-bend{0%,58%{transform:rotate(0deg)}75%{transform:rotate(-50deg)}95%,100%{transform:rotate(0deg)}}
@keyframes kx-stride2{0%{transform:rotate(28deg)}50%{transform:rotate(-28deg)}70%{transform:rotate(0deg)}100%{transform:rotate(28deg)}}
@keyframes kx-bend2{0%,48%{transform:rotate(0deg)}65%{transform:rotate(-70deg)}95%,100%{transform:rotate(0deg)}}
@keyframes kx-spin{0%,100%{transform:scaleX(1)}25%{transform:scaleX(.12)}50%{transform:scaleX(-1)}75%{transform:scaleX(.12)}}
@keyframes kx-tw{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(4deg)}}
@keyframes kx-shakep{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(10deg)}}
@keyframes kx-drip{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}100%{opacity:0;transform:translate(0,18px)}}
@keyframes kx-rain{to{transform:translate(0,60px)}}
@keyframes kx-snow{to{transform:translate(0,80px)}}
@keyframes kx-fly{0%,100%{opacity:.25;transform:translate(0,0)}50%{opacity:1;transform:translate(4px,-6px)}}
@keyframes kx-float{0%{opacity:0;transform:translateY(6px) scale(.7)}15%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-34px) scale(1.1)}}
@keyframes kx-swing{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes kx-z{0%{opacity:0;transform:translate(0,0)}15%{opacity:1}100%{opacity:0;transform:translate(10px,-26px)}}
@keyframes kx-hop{0%,100%{transform:translate(0,0)}30%{transform:translate(3px,-9px)}60%{transform:translate(-2px,-3px)}}
@keyframes kx-flick{0%{opacity:1}100%{opacity:0}}
@keyframes kx-glow{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
@media (prefers-reduced-motion:reduce){.koxa,.koxa *,.kx-item *,.kx-room *,.kx-fx-float{animation:none!important}.koxa .kx-z{opacity:.9}}
`;

  return { css, cat, poses: Object.keys(POSES), regions, room, spots: spotsAt, item, items: Object.keys(ITEMS), face,
    mouth, itemHeld, sunPatch, rooms, lap, lapSpot, crop, crops: CROPS, cropSlot, anchors: ANCHORS, itemSize, itemPoints, mouseHole, mousePeek, fish, fishes: Object.keys(FISH), marker,
    shop, shopSpots, postcardFrame, postcardHole, photoFrame, photoHole, neighbour, neighbours, icon, icons: Object.keys(ICONS), fx, fxs: Object.keys(FX), vet, vetSpots };
}
