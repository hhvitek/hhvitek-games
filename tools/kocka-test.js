#!/usr/bin/env node
// Tests the Kočka life engine (tools/kocka-dev/src/engine.js, copied into games/kocka/index.html by assemble.js) in Node:
//   node tools/kocka-test.js            all tests
//   node tools/kocka-test.js --file X   test the engine in another file (an .html with the "Life engine" block, or a .js)
// Only Node's built-in modules. Exit code 1 when a test fails.
'use strict';
process.env.TZ = 'Europe/Prague';               // day phases are local time; set before any Date is used
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const file = opt('--file', path.join(__dirname, 'kocka-dev', 'src', 'engine.js'));
let src = fs.readFileSync(file, 'utf8');
if (/\.html?$/i.test(file)) {
  const m = src.match(/\/\* -{10} Life engine -{10} \*\/([\s\S]*?)\/\* -{10} Life engine end -{10} \*\//);
  if (!m) { console.error('No "Life engine" block in ' + file); process.exit(1); }
  src = m[1];
}
if (/Date\.now\(|Math\.random\(|document\.|window\.|localStorage/.test(src)) { console.error('The engine must be pure (no Date.now, Math.random, DOM)'); process.exit(1); }
if (src.includes('</script')) { console.error('The engine contains "</script"'); process.exit(1); }
const Factory = new Function(src + '\nreturn KockaEngine;')();
const E = Factory();

let failed = 0, passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  FAIL ' + msg); } };
const section = name => console.log(name);
const H = 3600000, D = 24 * H, MIN = 60000;
const at = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();   // local time, month 1-based
const clone = o => JSON.parse(JSON.stringify(o));
// walks (letOut) need bond level Kamarádka (300); the bond itself is reached by care (tested in 'Care only' and 'Balance')
const friend = st => { st.bond = Math.max(st.bond, 300); st.lvl = Math.max(st.lvl, 2); return st; };
const MOODS = ['happy', 'calm', 'grumpy', 'sad'];
const WANTS = [null, 'food', 'water', 'fun', 'love', 'litter', 'coat'];

// every number finite, needs/weight/bond in range, canonical (repair changes nothing), no death or loss
function invariants(st, where) {
  const bad = [];
  (function walk(o, p) {
    if (typeof o === 'number' && !Number.isFinite(o)) bad.push(p);
    else if (o === undefined) bad.push(p + ' undefined');
    else if (o && typeof o === 'object') for (const k of Object.keys(o)) walk(o[k], p + '.' + k);
  })(st, 'st');
  if (bad.length) return ok(false, `${where}: not finite ${bad.join(', ')}`);
  for (const k of Object.keys(st.needs)) if (!(st.needs[k] >= 0 && st.needs[k] <= 100)) return ok(false, `${where}: need ${k} = ${st.needs[k]}`);
  if (!(st.weight >= 3.0 && st.weight <= 5.6)) return ok(false, `${where}: weight ${st.weight}`);
  if (!(st.bond >= 0 && st.bond <= 1000 && st.bond >= E.LEVELS[st.lvl].min)) return ok(false, `${where}: bond ${st.bond} lvl ${st.lvl}`);
  if (!(Number.isInteger(st.pamlsky) && st.pamlsky >= 0)) return ok(false, `${where}: pamlsky ${st.pamlsky}`);
  if (!MOODS.includes(E.mood(st))) return ok(false, `${where}: mood ${E.mood(st)}`);
  if (!WANTS.includes(E.wants(st))) return ok(false, `${where}: wants ${E.wants(st)}`);
  const mv = E.moodValue(st); if (!(mv >= -100 && mv <= 100)) return ok(false, `${where}: moodValue ${mv}`);
  const j = JSON.stringify(st);
  if (/"(dead|died|lost|gone|death)"/i.test(j)) return ok(false, `${where}: a death/loss field`);
  const c = clone(st); E.repair(c);
  if (JSON.stringify(c) !== j) return ok(false, `${where}: repair changed a valid state\n    ${j}\n    ${JSON.stringify(c)}`);
  ok(true);
}

// a random player: actions with valid and garbage arguments at random times
function randomRun(seed, days) {
  let x = seed >>> 0;
  const r = () => { x = (Math.imul(x ^ (x >>> 15), 0x2C1B3C6D) + 0x6D2B79F5) >>> 0; x ^= x >>> 12; return (x >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(r() * a.length)];
  const t0 = at(2026, 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28), Math.floor(r() * 24));
  const st = E.create(seed, t0, 'Koxa');
  let t = t0, events = [];
  const ARGS = {
    feed: () => pick(['kibble', 'pouch', 'chicken', 'tuna', null, 'stone', 42]),
    stroke: () => pick([null, { region: pick(Object.keys(E.REGIONS).concat('nose')), along: pick([true, false, 'sideways', 'x']), speed: pick([50, 300, 1200, 'good', NaN]) }]),
    scratch: () => ({ region: pick(Object.keys(E.REGIONS)), seconds: pick([1, 2, 0.5, -3, 99, NaN]) }),
    play: () => pick(Object.keys(E.TOYS).concat('stone', null)),
    vetCure: () => ({ won: r() < 0.5 }),
    putDown: () => pick(['window', 'bed', null, 'x'.repeat(50)]),
  };
  const acts = E.ACTIONS.concat(['bogus', '', null]);
  let lvl = 0;
  while (t < t0 + days * D) {
    const k = r();
    t += k < 0.6 ? Math.floor(r() * 30 * MIN) : k < 0.97 ? Math.floor(r() * 20 * H) : Math.floor(r() * 5 * D);
    if (r() < 0.02) t -= Math.floor(r() * 3 * H);            // the clock moved back
    let res;
    if (r() < 0.15) res = E.advance(st, t);
    else if (r() < 0.02) res = E.consumeTreats(st, pick([1, 5, -3, NaN, 1e9]), t);
    else { const a = pick(acts); res = E.act(st, a, ARGS[a] ? ARGS[a]() : null, t); }
    ok(res.st === st && Array.isArray(res.events), `seed ${seed}: result shape`);
    for (const e of res.events) if (!e || typeof e.type !== 'string') ok(false, `seed ${seed}: bad event ${JSON.stringify(e)}`);
    ok(st.lvl >= lvl, `seed ${seed}: bond level fell`); lvl = st.lvl;
    events.push(res.events);
    invariants(st, `seed ${seed} t=${new Date(t).toISOString()}`);
    if (failed > 20) break;
  }
  return JSON.stringify({ st, events });
}

/* ---------- 1. random 60-day sequences ---------- */
section('Random 60-day sequences: needs, weight, bond in range, canonical state');
const runs = [1, 2, 3, 77, 4242, 0xdeadbeef];
const results = runs.map(s => randomRun(s, 60));

/* ---------- 2. determinism ---------- */
section('Determinism');
ok(randomRun(77, 60) === results[3], 'the same seed and inputs give identical JSON and events');
{
  const E2 = Factory(), t0 = at(2026, 5, 10, 9);
  const a = E.create(5, t0, 'Koxa'), b = E2.create(5, t0, 'Koxa');
  E.advance(a, t0 + 20 * H); for (let i = 0; i < 120; i++) E2.advance(b, t0 + (i + 1) * 10 * MIN);
  ok(Math.abs(a.needs.food - b.needs.food) < 1e-6 && a.asleep === b.asleep && a.ill === null === (b.ill === null), 'one 20-hour advance equals 120 ten-minute ones');
  ok(JSON.stringify(E.create(9, t0, 'X')) === JSON.stringify(E2.create(9, t0, 'X')), 'create is deterministic');
}

/* ---------- 3. clock moved back ---------- */
section('Clock moved back');
{
  const t0 = at(2026, 11, 12, 10), st = E.create(11, t0, 'Koxa');
  E.advance(st, t0 + 5 * H);
  const before = clone(st), r = E.advance(st, t0 + 2 * H);
  ok(r.events.length === 0, 'no events');
  const rel = s => JSON.stringify([s.needs, s.weight, s.bond, s.asleep, s.litterAt - s.t, s.wokeAt - s.t, s.sleepAt ? s.sleepAt - s.t : 0, s.traits, s.cnt]);
  ok(st.t === t0 + 2 * H && rel(st) === rel(before), 'nothing happens; stored moments move with the clock');
  const r2 = E.act(st, 'feed', 'kibble', t0 + H);
  ok(r2.events.every(e => e.type !== 'ill' && e.type !== 'weighed'), 'an act with an earlier clock works');
  ok(E.advance(st, NaN).events.length === 0 && st.t === t0 + H, 'advance(NaN) does nothing');
}

/* ---------- 4. a long absence: paní Nováková ---------- */
section('30-day absence (paní Nováková)');
{
  const t0 = at(2026, 6, 1, 9), st = E.create(21, t0, 'Koxa');
  const w0 = st.weight, bond0 = st.bond;
  E.advance(E.create(1, t0, 'W'), t0 + 30 * D);                 // warm up
  const t1 = process.hrtime.bigint();
  const r = E.advance(st, t0 + 30 * D), w30 = st.weight;
  const ms = Number(process.hrtime.bigint() - t1) / 1e6;
  ok(ms < 50, `takes < 50 ms (${ms.toFixed(1)} ms)`);
  ok(st.needs.food === 40 && st.needs.water === 40, 'food and water 40');
  ok(r.events.some(e => e.type === 'offended') && E.health(st).offended && st.off.until === t0 + 31 * D, 'offended for 24 h');
  ok(w0 - st.weight <= 0.4 + 3 * 0.08 + 1e-9 && st.weight >= 3.0, `weight drop capped (${w0} → ${st.weight})`);
  ok(st.t === t0 + 30 * D && !st.out, 'she is home, time is now');
  ok(!st.ill && E.advance(E.create(23, t0, 'Koxa'), t0 + 73 * H).events.every(e => e.type !== 'ill'), 'away > 72 h: not ill (paní Nováková fed her from 24 h on)');
  ok(st.bond >= bond0 - 20 && st.bond >= 0, 'bond falls at most 20 and never below its level');
  const c1 = E.act(st, 'call', null, st.t), c2 = E.act(st, 'call', null, st.t);
  ok(c1.events.some(e => e.type === 'turnBack') && c2.events.some(e => e.type === 'come'), 'turns her back once when called, then comes');
  E.advance(st, st.t + 25 * H);
  ok(!E.health(st).offended, 'not offended after 24 h');
  // the same 72 h are simulated; then 0.1 kg for every whole day over 3, at most 0.4
  const s3 = E.create(21, t0, 'Koxa'), s10 = E.create(21, t0, 'Koxa');
  E.advance(s3, t0 + 4 * D + H); E.advance(s10, t0 + 10 * D);
  ok(Math.abs((s3.weight - w30) - 0.3) < 1e-9 && s10.weight === w30, `4 days away −0.1 kg, 10 and 30 days −0.4 (${s3.weight}, ${s10.weight}, ${w30})`);
  // 60 h away: nobody came (paní Nováková only for more than 72 h)
  const s4 = E.create(22, t0, 'Koxa'); E.advance(s4, t0 + 60 * H);
  ok(s4.needs.food >= 20 && s4.needs.water >= 20 && !s4.ill && !s4.off, 'away 60 h: paní Nováková looked in after 24 h, not ill, not offended');
}

/* ---------- 5. neglect never kills or loses her ---------- */
section('Neglect: never dead or lost');
{
  const t0 = at(2026, 1, 10, 9), st = E.create(31, t0, 'Koxa');
  friend(st); E.act(st, 'letOut', null, t0);
  const kinds = new Set();
  for (let t = t0 + H; t <= t0 + 60 * D; t += H) {
    const r = E.advance(st, t);
    for (const e of r.events) if (e.type === 'ill') kinds.add(e.kind);
    if (t % (24 * H) === 0) invariants(st, 'neglect');
  }
  invariants(st, 'neglect end');
  ok(!st.out, 'she came home by herself');
  ok(st.weight === 3.0, `thin but alive (${st.weight} kg)`);
  ok(kinds.size >= 1, `fell ill (${[...kinds].join(', ')}), never worse`);
  ok(['grumpy', 'sad'].includes(E.mood(st)), 'unhappy');
  const r = E.act(st, 'feed', 'kibble', st.t);
  ok(r.events.some(e => e.type === 'ate'), 'and still eats when fed');
}

/* ---------- 6. DST (Europe/Prague) ---------- */
section('Daylight saving time');
{
  ok(new Date(2026, 0, 1).getTimezoneOffset() === -60 && new Date(2026, 6, 1).getTimezoneOffset() === -120, 'TZ=Europe/Prague works in this Node');
  const expect = h => h >= 22 || h < 6 ? 'night' : h < 10 ? 'morning' : h < 17 ? 'day' : 'evening';
  for (const [m, d] of [[3, 29], [10, 25]]) {
    const a = at(2026, m, d, 0), b = at(2026, m, d + 1, 0);
    ok(b - a === (m === 3 ? 23 : 25) * H, `${d}.${m}. has ${(b - a) / H} hours`);
    let changes = 0, prev = null, wrong = 0;
    for (let t = a; t < b; t += 10 * MIN) {
      const p = E.dayPhase(t);
      if (p !== expect(new Date(t).getHours())) wrong++;
      if (p !== prev) { changes++; prev = p; }
    }
    ok(wrong === 0 && changes === 5, `${d}.${m}.: phases follow the local clock (night, morning, day, evening, night)`);
  }
  // 10 days over each change with hourly ticks: one weighing per local day, asleep at 3:00 local, awake at 11:00
  for (const [m, d] of [[3, 24], [10, 20]]) {
    const t0 = at(2026, m, d, 8), st = E.create(41, t0, 'Koxa');
    let weighed = 0, asleep3 = 0, awake11 = 0;
    for (let t = t0 + H; t <= at(2026, m, d + 10, 8); t += H) {
      const r = E.advance(st, t); weighed += r.events.filter(e => e.type === 'weighed').length;
      const hr = new Date(t).getHours();
      if (hr === 8) { E.act(st, 'feed', 'kibble', t); E.act(st, 'feed', 'kibble', t); E.act(st, 'water', null, t); E.act(st, 'cleanLitter', null, t); }
      if (hr === 3 && st.asleep) asleep3++;
      if (hr === 11 && !st.asleep) awake11++;
    }
    ok(weighed === 10, `${d}.${m}. + 10 days: ${weighed} weighings (10)`);
    ok(asleep3 === 10 && awake11 >= 9, `${d}.${m}. + 10 days: asleep at 3:00 ${asleep3}×, awake at 11:00 ${awake11}×`);
    invariants(st, 'DST');
  }
}

/* ---------- 7. holidays and seasons ---------- */
section('Holidays and seasons');
{
  const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
  ok(eq(E.easter(2026), [3, 5]) && eq(E.easter(2027), [2, 28]) && eq(E.easter(2025), [3, 20]) && eq(E.easter(2024), [2, 31]) && eq(E.easter(2038), [3, 25]) && eq(E.easter(2285), [2, 22]), 'Easter Sunday dates');
  const has = (ms, id, st) => E.holiday(ms, st).includes(id);
  ok(has(at(2026, 4, 5, 12), 'velikonoce') && has(at(2026, 4, 3, 12), 'velikonoce') && has(at(2026, 4, 6, 12), 'velikonoce') && !has(at(2026, 4, 2, 12), 'velikonoce') && !has(at(2026, 4, 7, 12), 'velikonoce'), 'Velikonoce 2026: Good Friday 3.4. – Easter Monday 6.4.');
  ok(has(at(2027, 3, 26, 9), 'velikonoce') && has(at(2027, 3, 29, 9), 'velikonoce') && !has(at(2027, 3, 30, 9), 'velikonoce'), 'Velikonoce 2027');
  ok(has(at(2026, 2, 17, 9), 'masopust') && !has(at(2026, 2, 16, 9), 'masopust') && has(at(2027, 2, 9, 9), 'masopust'), 'Masopust = Easter − 47 (17.2.2026, 9.2.2027)');
  ok(has(at(2026, 12, 1), 'advent') && has(at(2026, 12, 23, 23), 'advent') && !has(at(2026, 12, 24), 'advent') && !has(at(2026, 11, 30), 'advent'), 'Advent 1.–23.12.');
  ok(has(at(2026, 12, 5, 10), 'mikulas') && !has(at(2026, 12, 6, 10), 'mikulas'), 'Mikuláš 5.12.');
  ok(has(at(2026, 12, 24), 'vanoce') && has(at(2027, 1, 6, 23), 'vanoce') && !has(at(2027, 1, 7), 'vanoce') && !has(at(2026, 12, 23), 'vanoce'), 'Vánoce 24.12.–6.1.');
  ok(has(at(2026, 12, 31, 18), 'silvestr') && !has(at(2026, 12, 31, 12), 'silvestr') && !has(at(2027, 1, 1, 1), 'silvestr'), 'Silvestr 31.12. evening');
  ok(has(at(2026, 4, 30, 20), 'carodejnice') && has(at(2026, 11, 2, 8), 'dusicky') && E.holiday(at(2026, 7, 14, 12)).length === 0, 'Čarodějnice, Dušičky, an ordinary day');
  const st = E.create(1, at(2026, 11, 12, 15), 'Koxa');
  ok(!has(at(2026, 11, 12, 18), 'birthday', st) && has(at(2027, 11, 12, 8), 'birthday', st) && !has(at(2027, 11, 13, 8), 'birthday', st), 'her birthday on the adoption day from the next year');
  const leap = E.create(1, at(2028, 2, 29, 10), 'Koxa');
  ok(has(at(2029, 2, 28, 10), 'birthday', leap) && has(at(2032, 2, 29, 10), 'birthday', leap) && !has(at(2032, 2, 28, 10), 'birthday', leap), 'born 29.2.: 28.2. in other years');
  const b = E.create(1, at(2026, 11, 12, 15), 'Koxa'); let bd = null;
  for (let t = at(2027, 11, 10, 12); t <= at(2027, 11, 13, 12); t += H) {
    const r = E.advance(b, t);
    for (const e of r.events) if (e.type === 'birthday') bd = e;
  }
  ok(bd && bd.age === 1, 'a birthday event with age 1');
  ok(E.season(at(2026, 3, 1)) === 'spring' && E.season(at(2026, 6, 1)) === 'summer' && E.season(at(2026, 9, 1)) === 'autumn' && E.season(at(2026, 12, 1)) === 'winter' && E.season(at(2026, 2, 28)) === 'winter', 'seasons');
}

/* ---------- 8. illnesses: every one is cured by the vet and ends by itself after 4 days ---------- */
section('Illnesses');
function careAt(st, t, litter = true) {
  for (let i = 0; i < 3 && st.needs.food < 70; i++) E.act(st, 'feed', 'kibble', t);
  E.act(st, 'water', null, t);
  if (litter) E.act(st, 'cleanLitter', null, t);
  for (let i = 0; i < 10; i++) E.act(st, 'stroke', { region: 'back', along: true, speed: 300 }, t);
}
function makeIll(kind) {
  const t0 = kind === 'cold' ? at(2026, 12, 2, 21, 30) : at(2026, 9, 1, 8);
  const st = E.create(51, t0, 'Koxa');
  let got = null, t = t0;
  const watch = r => { for (const e of r.events) if (e.type === 'ill') got = e.kind; };
  if (kind === 'fleas') for (; !got && t < t0 + 10 * D; t += H) { watch(E.advance(st, t)); if (new Date(t).getHours() % 6 === 0) careAt(st, t, false); }
  if (kind === 'tummy') { E.consumeTreats(st, 20, t); for (let i = 0; i < 13; i++) watch(E.act(st, 'treat', null, t)); }
  if (kind === 'cold') { friend(st); watch(E.act(st, 'letOut', null, t)); for (; !got && t < t0 + 3 * H; t += 10 * MIN) watch(E.advance(st, t)); }
  return { st, got };
}
for (const kind of Object.keys(E.ILLS)) {
  const { st, got } = makeIll(kind);
  ok(got === kind && st.ill && st.ill.kind === kind, `${kind}: caught (${got})`);
  if (!st.ill) continue;
  ok(E.mood(st) !== 'happy' && E.health(st).ill === kind, `${kind}: shown in health, mood lower`);
  const a = clone(st), b = clone(st), c = clone(st);
  a.pamlsky = 30;
  const r = E.act(a, 'vetCure', { won: true }, a.t);
  ok(!a.ill && r.events.some(e => e.type === 'cured' && e.by === 'vet') && a.pamlsky === 15 && !a.pill, `${kind}: the vet cures (15 pamlsky, a win: no pill)`);
  b.pamlsky = 4;
  const rb = E.act(b, 'vetCure', { won: false }, b.t);
  ok(!b.ill && b.pamlsky === 0 && rb.events.some(e => e.type === 'cured' && e.short) && E.health(b).pill === 'tomorrow', `${kind}: the vet cures with too few pamlsky; lost minigame = a pill tomorrow`);
  ok(E.act(b, 'pill', null, b.t).events.some(e => e.type === 'refused'), `${kind}: the pill not yet today`);
  E.advance(b, b.t + D);
  ok(E.act(b, 'pill', null, b.t).events.some(e => e.type === 'pill') && !b.pill, `${kind}: the pill the next day`);
  let cured = null, t = c.t;
  for (; !cured && t <= c.ill.since + 4 * D + H; t += H) {
    for (const e of E.advance(c, t).events) if (e.type === 'cured') cured = e;
    if (new Date(t).getHours() % 6 === 0) careAt(c, t);
  }
  ok(cured && cured.by === 'time' && !c.ill && t - H - st.ill.since <= 4 * D + H, `${kind}: ends by itself after 4 days`);
  ok(E.act(clone(c), 'vetCure', {}, c.t).events.some(e => e.type === 'refused'), `${kind}: the vet refuses a healthy cat`);
}

/* ---------- 9. care with free things only keeps her healthy ---------- */
section('Care only with free granule and water, 30 days');
function careRun(full, seed) {
  const t0 = at(2026, 11, 1, 8), st = E.create(seed, t0, 'Koxa');
  let ill = 0, sad = 0, happy = 0, n = 0;
  for (let d = 0; d < 30; d++) for (const hr of [8, 13, 19]) {
    const t = at(2026, 11, 1 + d, hr);
    while (st.t + H < t) for (const e of E.advance(st, st.t + H).events) if (e.type === 'ill') ill++;
    careAt(st, t);
    if (full) { E.act(st, 'play', 'mouse', t); if (hr === 19) E.act(st, 'brush', null, t); }
    const m = E.mood(st); n++; if (m === 'sad') sad++; if (m === 'happy') happy++;
    if (st.ill) ill++;
    invariants(st, 'care');
  }
  return { st, ill, sad, happy, n };
}
for (const seed of [3, 61, 1234]) {
  const b = careRun(false, seed);
  ok(b.ill === 0 && b.sad === 0 && b.st.weight >= 3.6 && b.st.weight <= 5.0 && b.st.pamlsky === 5, `seed ${seed}: granule, water, litter, strokes 3×/day: healthy (ill ${b.ill}, sad ${b.sad}, ${b.st.weight} kg)`);
  const f = careRun(true, seed);
  ok(f.ill === 0 && f.happy >= f.n * 0.8 && f.st.bond >= 100, `seed ${seed}: + play and brushing: happy ${f.happy}/${f.n}, bond ${Math.round(f.st.bond)}`);
}

/* ---------- 10. every Deníček entry is reachable ---------- */
section('Deníček: every entry reachable');
function discover(seed) {
  const t0 = at(2026, 6, 1, 8);
  const st = E.create(seed, t0, 'Koxa'), T = st.traits;
  st.pamlsky = 50;   // her favourite food is bought (kapsička 2, kuře 3, tuňák 4 a serving)
  let t = t0;
  const tick = dt => { t += dt; E.advance(st, t); };
  // the next time it is h o'clock (today or tomorrow), with care on the way
  const nextDay = h => { const d = new Date(t), n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (d.getHours() < h ? 0 : 1), h).getTime(); while (t + 6 * H < n) { tick(6 * H); careAt(st, t); } t = n; E.advance(st, t); careAt(st, t); };
  // favourite food 3×
  for (let i = 0; i < 3; i++) { tick(6 * H); careAt(st, t); st.needs.food = Math.min(st.needs.food, 50); E.act(st, 'feed', T.favFood, t); }
  nextDay(10);
  // her spots, 10 strokes along the fur each
  for (const s of T.spots) for (let i = 0; i < 10; i++) E.act(st, 'stroke', { region: s, along: true, speed: 400 }, t);
  // belly: until 5 welcome rubs
  for (let i = 0; i < 400 && !st.diary.belly; i++) { E.act(st, 'stroke', { region: 'belly' }, t); if (i % 5 === 0) careAt(st, t); }
  // her toy 5×
  for (let i = 0; i < 5; i++) { tick(30 * MIN); E.act(st, 'play', T.toy, t); }
  // a walk
  friend(st); E.act(st, 'letOut', null, t); tick(H); E.act(st, 'letIn', null, t);
  // her quirk, seen on two days
  for (let d = 0; d < 30 && !st.diary.quirk; d++) {
    if (T.quirk === 'wakesEarly') nextDay(7);
    else if (T.quirk === 'box') { nextDay(10); const n = new Date(t); t = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23).getTime(); E.advance(st, t); E.act(st, 'stroke', { region: 'back' }, t); }
    else if (T.quirk === 'socks') { nextDay(18); for (let i = 0; i < 5; i++) E.act(st, 'play', 'mouse', t); }
    else { nextDay(10); st.needs.water = 20; E.act(st, 'water', null, t); }
  }
  // her fear
  if (T.fear === 'vacuum') E.act(st, 'vacuum', null, t);
  else if (T.fear === 'storm') for (let d = 0; d < 90 && !st.diary.fear; d++) { for (let h = 0; h < 24; h++) tick(H); careAt(st, t); }
  else { t = at(2026, 12, 31, 12); E.advance(st, t); careAt(st, t); for (let h = 0; h < 16; h++) tick(H); }
  nextDay(8);   // the weight
  return st;
}
{
  const seen = { favFood: new Set(), fear: new Set(), quirk: new Set(), toy: new Set(), spot: new Set() };
  const all = { favFood: 3, fear: 3, quirk: 4, toy: 4, spot: 5 };
  const full = () => Object.keys(all).every(k => seen[k].size === all[k]);
  let tested = 0;
  for (let seed = 1; seed < 400 && !full(); seed++) {   // cats until every value of every trait was discovered
    const T = E.create(seed, at(2026, 6, 1), 'K').traits;
    const fresh = seen.favFood.has(T.favFood) && seen.fear.has(T.fear) && seen.quirk.has(T.quirk) && seen.toy.has(T.toy) && T.spots.every(s => seen.spot.has(s));
    if (fresh) continue;
    const st = discover(seed); tested++;
    const list = E.diary(st);
    const missing = list.filter(e => !e.found).map(e => e.id);
    ok(missing.length === 0, `seed ${seed} (${T.favFood}, ${T.spots}, ${T.fear}, ${T.quirk}, ${T.toy}): all found, missing ${missing.join(', ')}`);
    ok(list.every(e => typeof e.text === 'string' && e.text.length > 3 && !/undefined|NaN/.test(e.text)), `seed ${seed}: entry texts`);
    if (!missing.length) { seen.favFood.add(T.favFood); seen.fear.add(T.fear); seen.quirk.add(T.quirk); seen.toy.add(T.toy); T.spots.forEach(s => seen.spot.add(s)); }
    invariants(st, 'diary');
  }
  ok(full(), `every trait value reached (${tested} cats)`);
  const st = E.create(1, at(2026, 11, 12, 15), 'Koxa');
  const d = E.diary(st, 'Micka');
  ok(d.length === 10 && d.find(e => e.id === 'birthday').found && d.find(e => e.id === 'birthday').text === 'Micka k nám přišla 12. 11. 2026.', 'the list: 10 entries, the name from the argument, the birthday found at once');
  ok(E.diary(st).find(e => e.id === 'birthday').text.startsWith('Koxa'), 'the stored name without an argument');
}

/* ---------- 11. repair survives garbage ---------- */
section('repair / valid');
{
  for (const g of [null, undefined, 'Koxa', 42, NaN, [], [1, 2], true, () => 1]) {
    let r; try { r = E.repair(g); ok(r === null, `repair(${String(g)}) = null`); } catch (e) { ok(false, `repair(${String(g)}) threw ${e.message}`); }
    ok(E.valid(g) === false, `valid(${String(g)}) = false`);
  }
  const base = E.create(7, at(2026, 11, 12, 10), 'Koxa');
  E.act(base, 'feed', 'tuna', base.t); E.advance(base, base.t + 30 * H); friend(base); E.act(base, 'letOut', null, base.t);
  const GARBAGE = [null, 'x', NaN, Infinity, -Infinity, 1e308, -1e308, [], {}, true, -5, '<b>', 2 ** 53, { kind: 'plague' }, [1, 2, 3]];
  const paths = [];
  (function walk(o, p) { for (const k of Object.keys(o)) { paths.push(p.concat(k)); if (o[k] && typeof o[k] === 'object') walk(o[k], p.concat(k)); } })(base, []);
  paths.push(['ill'], ['off'], ['needs', 'extra'], ['__proto__']);
  let survived = 0;
  for (const p of paths) for (const g of GARBAGE) {
    const s = clone(base);
    let o = s; for (let i = 0; i < p.length - 1; i++) o = o[p[i]];
    o[p[p.length - 1]] = g;
    try {
      const r = E.repair(s);
      if (p.length === 1 && p[0] === 't' && r === null) { ok(false, 't garbage with a good born must survive'); continue; }
      ok(r === s, `repair ${p.join('.')} = ${String(g)} keeps the object`);
      if (r.born === base.born) ok(r.traits.favFood === base.traits.favFood || p.includes('traits'), `${p.join('.')}: Koxa's traits kept`);
      invariants(r, `repair ${p.join('.')} = ${String(g)}`);
      E.advance(r, r.t + 3 * H); E.act(r, 'feed', 'kibble', r.t + 3 * H); E.act(r, 'stroke', null, r.t);
      invariants(r, `after repair ${p.join('.')} = ${String(g)}`);
      survived++;
    } catch (e) { ok(false, `repair ${p.join('.')} = ${String(g)} threw ${e.stack}`); }
  }
  console.log(`  ${survived} corrupted states repaired`);
  const bare = { t: at(2026, 1, 1) };
  ok(E.valid(bare) && bare.needs && bare.traits && bare.diary.birthday === bare.born, 'a state with only a time is repaired');
  const noT = { needs: {} };
  ok(E.repair(noT) === null && E.repair({ needs: {} }, at(2026, 1, 1)) !== null, 'no time at all: null, unless now is given');
  const old = { v: 1, seed: 5, n: 0, t: at(2026, 11, 10), born: at(2026, 11, 10), needs: { food: 80, water: 80, energy: 80, fun: 70, love: 70, litter: 100, coat: 100 }, pamlsky: 5 };
  ok(E.valid(old) && old.needs.food === 80 && old.pamlsky === 5 && old.born === at(2026, 11, 10), 'the Phase 0 stub save is upgraded, its values kept');
  const huge = clone(base); huge.t = 1e300; huge.born = 1e300;
  ok(E.repair(huge) === null, 'impossible times: unusable');
}

/* ---------- 12. actions: the skeleton UI calls and the rules of §4 and §6 ---------- */
section('Actions');
{
  const t0 = at(2026, 11, 12, 10), st = E.create(8, t0, 'Koxa');
  st.needs.food = 30; st.needs.water = 30;
  ok(E.act(st, 'feed', null, t0).events.some(e => e.type === 'ate' && e.food === 'kibble'), 'feed(null) = granule');
  ok(E.act(st, 'water', null, t0).events.some(e => e.type === 'drank') && st.needs.water === 100, 'water fills the bowl');
  const l0 = st.needs.love; E.act(st, 'stroke', null, t0);
  ok(st.needs.love === Math.min(100, l0 + (st.traits.spots.includes('back') ? 4 : 2)), 'stroke(null) = along the back');
  st.needs.food = 95;
  ok(E.act(st, 'feed', 'kibble', t0).events.some(e => e.type === 'refused' && /sytá/.test(e.reason)), 'a full cat refuses food (Czech reason)');
  ok(E.act(st, 'dance', null, t0).events[0].type === 'refused', 'unknown action: refused');
  st.needs.food = 80; const r = E.act(st, 'feed', 'kibble', t0).events.find(e => e.type === 'ate');
  ok(r && r.left && st.needs.food === 100, 'over 90 she leaves the rest');
  // grumpy: the belly always bites
  const g = E.create(8, t0, 'Koxa'); Object.assign(g.needs, { food: 30, water: 30, fun: 30, love: 30 });
  ok(E.mood(g) === 'grumpy', 'grumpy set up');
  let bites = 0; for (let i = 0; i < 20; i++) { g.needs.love = 30; if (E.act(g, 'stroke', { region: 'belly' }, t0).events.some(e => e.type === 'bite')) bites++; }
  ok(bites === 20, 'grumpy: the belly always bites');
  // sad: toys ignored about half the time, stroking gives half
  const s = E.create(9, t0, 'Koxa'); Object.assign(s.needs, { food: 5, water: 5, fun: 5, love: 5, energy: 80 });
  ok(E.mood(s) === 'sad', 'sad set up');
  let ign = 0; for (let i = 0; i < 200; i++) { s.needs.fun = 5; s.needs.energy = 80; if (E.act(s, 'play', 'mouse', t0).events.some(e => e.type === 'ignore')) ign++; }
  ok(ign > 70 && ign < 130, `sad: ignores toys ~50 % (${ign}/200)`);
  const lv = s.needs.love = 5; E.act(s, 'stroke', { region: 'tail', along: true, speed: 300 }, t0);
  ok(s.needs.love === lv + 1, `sad: stroking gives half (${lv} → ${s.needs.love})`);
  // against the fur, too fast
  const a = E.create(10, t0, 'Koxa'); a.needs.love = 50;
  ok(E.act(a, 'stroke', { region: 'back', along: false, speed: 300 }, t0).events.some(e => e.type === 'earsBack') && a.needs.love === 49, 'against the fur: ears back, love −1');
  ok(E.act(a, 'stroke', { region: 'back', along: true, speed: 2000 }, t0).events.some(e => e.type === 'earsBack' && e.rough), 'too fast: rough');
  ok(E.act(a, 'stroke', { region: 'back', along: true, speed: 50 }, t0).events.length === 0 && a.needs.love === 48, 'too slow: nothing');
  // pick up: wriggles when unhappy or tired
  const p = E.create(11, t0, 'Koxa');
  ok(E.act(p, 'pickUp', null, t0).events.some(e => e.type === 'held') && E.act(p, 'putDown', 'window', t0).events.some(e => e.type === 'put' && e.place === 'window'), 'pick up and put down');
  p.needs.energy = 10;
  ok(E.act(p, 'pickUp', null, t0).events.some(e => e.type === 'wriggle'), 'tired: she wriggles free');
  ok(E.act(p, 'putDown', null, t0).events.some(e => e.type === 'refused'), 'put down when not held: refused');
  // scratching, brushing, litter, treats
  const q = E.create(12, t0, 'Koxa'); q.needs.love = 20;
  E.act(q, 'scratch', { region: 'ears', seconds: 2 }, t0);
  ok(q.needs.love === 28, 'scratching behind the ears +4/s');
  q.needs.coat = 50; E.act(q, 'brush', null, t0);
  ok(q.needs.coat === 75, 'brushing +25');
  q.needs.litter = 10; E.act(q, 'cleanLitter', null, t0);
  ok(q.needs.litter === 100 && E.act(q, 'cleanLitter', null, t0).events[0].type === 'refused', 'clean litter = 100');
  const tr = E.create(13, t0, 'Koxa'); tr.pamlsky = 0;
  ok(E.act(tr, 'treat', null, t0).events.some(e => e.type === 'refused'), 'no pamlsky: no treat');
  E.consumeTreats(tr, 3, t0);
  ok(tr.pamlsky === 3 && E.act(tr, 'treat', null, t0).events.some(e => e.type === 'treat') && tr.pamlsky === 2, 'launcher pamlsky arrive; a treat costs 1');
  ok(E.consumeTreats(tr, 'x', t0).events.length === 0 && tr.pamlsky === 2, 'consumeTreats ignores garbage');
  // outside: not in the room
  const o = friend(E.create(14, t0, 'Koxa')); E.act(o, 'letOut', null, t0);
  ok(E.act(o, 'stroke', null, t0).events.some(e => e.type === 'refused') && E.act(o, 'cleanLitter', null, t0).events.length >= 0, 'outside: no stroking');
  let back = null; for (let t = t0; !back && t < t0 + 10 * H; t += 10 * MIN) back = E.advance(o, t).events.find(e => e.type === 'back');
  ok(back && back.minutes >= 120 && back.minutes <= 8 * 60 + 10, `she comes home by herself after 2–8 h (${back && back.minutes} min)`);
  // the bond: levels never lost
  const bnd = E.create(15, t0, 'Koxa'); bnd.bond = 99;
  const lu = E.act(Object.assign(bnd, { needs: Object.assign(bnd.needs, { food: 20 }) }), 'feed', 'kibble', t0).events.find(e => e.type === 'levelUp');
  ok(lu && lu.level === 1 && lu.name === 'Známá' && E.bondLevel(bnd).next === 300, 'a satisfied want +1 bond, level up');
  E.advance(bnd, bnd.t + 5 * D);
  ok(bnd.bond >= 100, 'bond never falls below a level reached');
  // sleeping: refused, phases
  const z = E.create(16, at(2026, 11, 12, 21), 'Koxa'); E.advance(z, at(2026, 11, 13, 2));
  ok(z.asleep && E.act(z, 'play', 'mouse', z.t).events.some(e => e.type === 'refused' && /spí/.test(e.reason)), 'asleep at night; play refused');
  E.advance(z, at(2026, 11, 13, 9));
  ok(!z.asleep, 'awake in the morning');
  // rename
  E.rename(z, '  Micka  '); ok(z.name === 'Micka' && E.act(z, 'dance', null, z.t).events.length === 1, 'rename');
  E.rename(z, ''); ok(z.name === 'Koxa', 'an empty name = Koxa');
  // the constants cannot be changed by mistake
  try { E.FOODS.kibble.gain = 99; } catch (e) {}
  ok(E.FOODS.kibble.gain === 35, 'constants are frozen');
}

/* ---------- 13. balance: two visits a day with basic care, mood sampled every hour ---------- */
section('Balance (hourly samples)');
// basic care: feed until she is full, water, clean the litter, 10 strokes, one play
function basicCare(st, t, plays = 1) {
  for (let i = 0; i < 4; i++) E.act(st, 'feed', 'kibble', t);
  E.act(st, 'water', null, t); E.act(st, 'cleanLitter', null, t);
  for (let i = 0; i < 10; i++) E.act(st, 'stroke', { region: 'back', along: true, speed: 300 }, t);
  for (let i = 0; i < plays; i++) E.act(st, 'play', 'mouse', t);
}
// visits at the given local hours for `days` days; returns hourly mood shares, illnesses, weight range
function visitRun(seed, hours, days, plays = 1) {
  const t0 = at(2026, 9, 1, 7), st = E.create(seed, t0, 'Koxa');
  const c = { happy: 0, calm: 0, grumpy: 0, sad: 0 }; let n = 0, ill = 0, minW = 9, maxW = 0;
  for (let t = t0 + H; t <= t0 + days * D; t += H) {
    for (const e of E.advance(st, t).events) if (e.type === 'ill') ill++;
    if (hours.includes(new Date(t).getHours())) basicCare(st, t, plays);
    c[E.mood(st)]++; n++; minW = Math.min(minW, st.weight); maxW = Math.max(maxW, st.weight);
  }
  return { st, ill, minW, maxW, sad: c.sad / n, good: (c.happy + c.calm) / n, c, n };
}
for (const seed of [3, 61, 1234]) {
  const r = visitRun(seed, [8, 20], 60);
  ok(r.sad < 0.1 && r.good > 0.7 && r.ill === 0 && r.minW >= 3.8 && r.maxW <= 4.6,
    `seed ${seed}: 2×/day (8, 20) basic care, 60 days: happy+calm ${Math.round(100 * r.good)} %, sad ${Math.round(100 * r.sad)} %, ill ${r.ill}×, weight ${r.minW}–${r.maxW}`);
  const r0 = visitRun(seed, [8, 20], 30, 0);
  ok(r0.sad < 0.1 && r0.ill === 0, `seed ${seed}: 2×/day without play: sad ${Math.round(100 * r0.sad)} %, never ill`);
}
{
  // neglect still shows: four days of nothing while the app is open, and four days away
  const t0 = at(2026, 9, 1, 8), st = E.create(5, t0, 'Koxa'); basicCare(st, t0);
  let ill = 0; for (let t = t0 + H; t <= t0 + 4 * D; t += H) for (const e of E.advance(st, t).events) if (e.type === 'ill') ill++;
  ok(E.mood(st) === 'sad' && ill >= 1 && st.weight < 4.2, `4 days of nothing (app open): sad, ill ${ill}×, thinner ${st.weight}`);
  const a = E.create(5, t0, 'Koxa'); basicCare(a, t0); const w = a.weight; E.advance(a, t0 + 5 * D);
  ok(E.mood(a) === 'sad' && E.health(a).offended && a.weight < w, `5 days away: sad, offended, thinner (${w} → ${a.weight})`);
}

/* ---------- 14. regressions from the independent review (2026-11-12) ---------- */
section('Review regressions');
{
  // 1. the clock set forward and corrected leaves no future moments
  const t0 = at(2026, 11, 12, 10);
  const a = E.create(5, t0, 'Koxa');
  E.advance(a, t0 + 4 * D); E.advance(a, t0 + 10 * MIN); E.valid(a);
  ok(a.off && a.off.until - a.t <= D && a.litterAt - a.t <= 9 * H && a.wokeAt <= a.t, '#1 +4 days and back: offended at most 24 h more, no future timers');
  E.advance(a, t0 + 25 * H); ok(!E.health(a).offended, '#1 +4 days and back: not offended a day later');
  const b = E.create(5, t0, 'Koxa');
  E.advance(b, at(2100, 1, 1)); E.advance(b, t0 + H); E.valid(b);
  ok(b.off.until - b.t <= D && b.bday <= 2026 && b.day.key <= 20261112 && b.born <= b.t && Object.values(b.diary).every(v => v <= b.t), '#1 2100 and back: nothing left in the future');
  const c = E.create(5, t0, 'Koxa'); c.traits.fear = 'vacuum';
  E.advance(c, t0 + 20 * H); E.act(c, 'vacuum', null, t0 + 20 * H); E.advance(c, t0 + 5 * MIN); E.valid(c);
  ok(c.scared - c.t <= 2 * H, '#1 scared at a wrong clock: at most 2 h after the correction');
  let slept = false; for (let t = t0 + 10 * MIN; t < t0 + 22 * H; t += 10 * MIN) { E.advance(c, t); slept = slept || c.asleep; }
  ok(slept, '#1 she sleeps again after the correction');
  const d = E.create(5, t0, 'Koxa'); E.consumeTreats(d, 20, t0 + 2 * D); for (let i = 0; i < 13; i++) E.act(d, 'treat', null, t0 + 2 * D);
  ok(d.ill && d.ill.kind === 'tummy', '#1 setup: ill at the wrong clock');
  E.advance(d, t0 + MIN); E.valid(d);
  ok(E.health(d).illDaysLeft <= 4 && d.ill.since <= d.t, '#1 ill.since moved back with the clock');
  E.advance(d, d.t + 4 * D + H); ok(!d.ill, '#1 the illness still ends by itself');
  const e = E.create(5, t0, 'Koxa'); Object.assign(e, { off: { until: t0 + 400 * D, turned: false }, scared: t0 + 400 * D, ill: { kind: 'cold', since: t0 + 400 * D }, heldAt: t0 + D, pill: 20991231, bday: 2099 });
  E.repair(e);
  ok(e.off === null && e.scared === 0 && e.ill.since === t0 && e.heldAt === 0 && e.pill === 0 && e.bday === 2026, '#1 repair clamps moments relative to t');
  // 2. a clock before 2000 (or after 2200) is ignored like NaN
  const f = E.create(5, t0, 'Koxa'); E.advance(f, t0 + 5 * MIN);
  E.advance(f, 0); E.advance(f, Date.UTC(1999, 0, 1)); E.act(f, 'feed', 'kibble', 0); E.advance(f, Date.UTC(2300, 0, 1));
  ok(f.t === t0 + 5 * MIN, '#2 a clock at 1970/1999/2300 changes nothing');
  const g = clone(f); E.valid(g); const rg = E.advance(g, t0 + 10 * MIN);
  ok(!rg.events.some(x => x.type === 'offended') && !E.health(g).offended, '#2 no absence penalty after a momentary 1970 clock');
  // 3. a longer absence is never better than a shorter one
  let prev = null, mono = true, sick = [];
  for (const gap of [12, 18, 24, 30, 36, 48, 60, 71, 72, 73, 96, 168, 720]) {
    const s = E.create(3, at(2026, 9, 1, 18), 'Koxa'); basicCare(s, s.t);
    E.advance(s, s.t + gap * H);
    const cur = { gap, mood: E.moodValue(s), w: s.weight, off: E.health(s).offended };
    if (s.ill) sick.push(gap);
    if (prev && (cur.mood > prev.mood + 5 || cur.w > prev.w + 0.03 || (prev.off && !cur.off))) { mono = false; console.log('    not monotonic', prev, cur); }
    ok(cur.off === gap > 72, `#3 away ${gap} h: offended only over 72 h`);
    prev = cur;
  }
  ok(mono, '#3 mood, weight and offence never better after a longer absence');
  ok(sick.length === 0, `#3 well cared for before leaving: never ill after any absence (${sick.join(', ')})`);
  ok(visitRun(3, [8], 30).ill === 0, '#3 a visit every 24 h: never ill');
  // 4. weight moves back to normal
  const thin = (() => { const t1 = at(2026, 9, 1, 7), s = E.create(3, t1, 'Koxa'); s.weight = 3.0;
    for (let t = t1 + H; t <= t1 + 30 * D; t += H) { E.advance(s, t); if ([8, 20].includes(new Date(t).getHours())) basicCare(s, t); } return s; })();
  ok(thin.weight >= 4.0 && !E.health(thin).thin, `#4 a thin cat recovers with care 2×/day (3.0 → ${thin.weight} in 30 days)`);
  const fed = visitRun(3, [7, 11, 15, 19, 22], 60);
  ok(fed.maxW <= 4.5, `#4 feeding 5×/day never makes her heavier than 4.5 (${fed.maxW})`);
  const tr = E.create(3, at(2026, 9, 1, 8), 'Koxa'); tr.weight = 5.2; E.advance(tr, tr.t + H);
  for (let d2 = 0; d2 < 40; d2++) { const t = at(2026, 9, 2 + d2, 8); E.advance(tr, t); basicCare(tr, t); E.advance(tr, t + 12 * H); basicCare(tr, t + 12 * H); }
  ok(tr.weight <= 4.6, `#4 chubby without treats slims back (5.2 → ${tr.weight})`);
  // 5. no flea loop; the litter box and the coat are told apart
  let vet = 0; const fl = E.create(3, at(2026, 9, 1, 8), 'Koxa');
  for (let d2 = 0; d2 < 30; d2++) for (const h of [7, 22]) {
    const t = at(2026, 9, 1 + d2, h); E.advance(fl, t);
    for (let i = 0; i < 3 && fl.needs.food < 70; i++) E.act(fl, 'feed', 'kibble', t);
    E.act(fl, 'water', null, t); E.act(fl, 'cleanLitter', null, t);
    for (let i = 0; i < 10; i++) E.act(fl, 'stroke', null, t);
    if (fl.ill) { fl.pamlsky = 99; E.act(fl, 'vetCure', { won: true }, t); vet++; }
  }
  ok(vet <= 1, `#5 2×/day (7, 22) without brushing: vet ${vet}× in 30 days`);
  const fc = E.create(3, t0, 'Koxa'); fc.ill = { kind: 'fleas', since: t0 }; fc.needs.coat = 0;
  E.act(fc, 'vetCure', { won: true }, t0); ok(fc.needs.coat >= 60, '#5 the vet leaves her coat at 60 or more after fleas');
  const wl = E.create(3, t0, 'Koxa'); Object.assign(wl.needs, { litter: 5, coat: 90 });
  const wc = E.create(3, t0, 'Koxa'); Object.assign(wc.needs, { litter: 100, coat: 5 });
  ok(E.wants(wl) === 'litter' && E.wants(wc) === 'coat' && E.needs(wl).litter === 5 && E.needs(wc).clean === 5, '#5 wants litter / coat apart; needs() gives both and clean');
  // 6. "budí ráno" wakes her only between 5:00 and 5:59
  let seed6 = 1; while (E.create(seed6, t0, 'K').traits.quirk !== 'wakesEarly') seed6++;
  const q = E.create(seed6, at(2026, 11, 12, 21, 30), 'Koxa'); q.needs.energy = 80;
  const wakes = [];
  for (let t = q.t + 5 * MIN; t <= at(2026, 11, 13, 7); t += 5 * MIN) for (const x of E.advance(q, t).events) if (x.type === 'wake') wakes.push(new Date(t).getHours());
  ok(wakes.length >= 1 && wakes[0] === 5, `#6 wakesEarly: first wake at 5:xx (${wakes.join(', ')})`);
  // 7. the bond cannot be farmed
  const bf = E.create(4, t0, 'Koxa'); Object.assign(bf.needs, { food: 90, water: 90, fun: 90, energy: 90, litter: 100, coat: 90, love: 39 });
  for (let i = 0, t = t0; i < 600; i++) { t += 500; E.act(bf, 'stroke', { region: 'tail', along: true, speed: 300 }, t); E.act(bf, 'stroke', { region: 'tail', along: false, speed: 300 }, t); E.act(bf, 'stroke', { region: 'tail', along: false, speed: 300 }, t); }
  ok(bf.bond <= 1, `#7 1800 strokes in 5 minutes: bond ${bf.bond}`);
  // 8. no pill while she is outside
  const pl = E.create(14, t0, 'Koxa'); pl.pill = 20261112; friend(pl); E.act(pl, 'letOut', null, t0);
  const rp = E.act(pl, 'pill', null, t0 + MIN).events;
  ok(rp.some(x => x.type === 'refused' && /venku/.test(x.reason)) && pl.pill === 20261112, '#8 pill refused outside');
  // minor: the morning quirk only when she is home and awake
  const mq = E.create(seed6, at(2026, 11, 12, 6, 30), 'Koxa'); mq.out = { since: mq.t, until: mq.t + 3 * H };
  ok(!E.act(mq, 'call', null, mq.t).events.some(x => x.type === 'quirk') && mq.cnt.quirk === 0, 'minor: wakesEarly not seen while she is outside');
  // minor: pickUp works after she turned her back once
  const pu = E.create(6, t0, 'Koxa'); Object.assign(pu.needs, { food: 100, water: 100, fun: 100, love: 100, energy: 100 }); pu.off = { until: t0 + D, turned: false };
  const w1 = E.act(pu, 'pickUp', null, t0).events.some(x => x.type === 'wriggle');
  E.act(pu, 'call', null, t0);
  ok(w1 && E.act(pu, 'pickUp', null, t0).events.some(x => x.type === 'held'), 'minor: offended: wriggles until she turned her back once, then can be held');
  // minor: frequent acts do not lose the small falls to rounding
  const ra = E.create(7, t0, 'Koxa'), rb = E.create(7, t0, 'Koxa');
  E.advance(ra, t0 + 10 * MIN); for (let t = t0 + 1000; t <= t0 + 10 * MIN; t += 1000) E.advance(rb, t);
  ok(Math.abs(ra.needs.food - rb.needs.food) < 1e-3 && rb.needs.food < 80, `minor: 1-second ticks fall like one advance (${ra.needs.food} vs ${rb.needs.food})`);
}

/* ---------- 15. integration with the UI (2026-11-12) ---------- */
section('UI integration');
{
  const t0 = at(2026, 11, 12, 10);
  // body regions: exactly Art's strokable regions; favourite spots only among them
  const ART = ['head', 'chin', 'ears', 'back', 'tail', 'paws', 'belly', 'tailBase'];
  ok(Object.keys(E.REGIONS).every(r => ART.includes(r)), `every engine region can be stroked (${Object.keys(E.REGIONS)})`);
  let spotsOk = true;
  for (let s = 0; s < 500; s++) if (!E.create(s, t0, 'K').traits.spots.every(r => ['chin', 'ears', 'head', 'back', 'tailBase'].includes(r))) spotsOk = false;
  ok(spotsOk, 'favourite spots are always chin, ears, head, back or tailBase');
  const p = E.create(5, t0, 'Koxa'); p.needs.love = 50;
  const ep = E.act(p, 'stroke', { region: 'paws', along: true, speed: 300 }, t0).events;
  const eq = E.act(p, 'stroke', { region: 'paw', along: true, speed: 300 }, t0).events;
  const es = E.act(p, 'stroke', { region: 'side', along: true, speed: 300 }, t0).events;
  ok(!ep.some(e => e.type === 'refused') && !eq.some(e => e.type === 'refused') && !es.some(e => e.type === 'refused') && p.needs.love > 50, "'paws' strokes; 'paw' and 'side' are accepted as aliases");
  // a new cat adopted in the afternoon stays awake for the first 2 hours
  for (const h of [13, 14, 15, 16]) {
    const n = E.create(9, at(2026, 11, 12, h, 20), 'Koxa');
    const born = n.t; let slept = false; for (let t = born + 10 * MIN; t <= born + 2 * H - MIN; t += 10 * MIN) { E.advance(n, t); slept = slept || n.asleep; }
    const r = E.act(n, 'play', 'mouse', n.t).events;
    ok(!slept && r.some(e => e.type === 'played'), `adopted at ${h}:20: awake for 2 h and plays`);
  }
  const night = E.create(9, at(2026, 11, 12, 22, 30), 'Koxa'); E.advance(night, at(2026, 11, 13, 2));
  ok(night.asleep, 'adopted at night: she still sleeps that night');
  // favourite food: with granule only (Etapa 1) the entry stays a question
  const ff = E.create(5, t0, 'Koxa');
  for (let i = 0; i < 30; i++) { const t = t0 + i * 8 * H; E.advance(ff, t); E.act(ff, 'feed', 'kibble', t); }
  const entry = E.diary(ff).find(e => e.id === 'favFood');
  ok(!entry.found && /\?/.test(entry.text) && ff.cnt.favFood === 0, 'favourite food: granule never reveals it, the text stays a question');
}

/* ---------- 16. the lap (SPEC §12d) ---------- */
section('Lap');
function lapCat(seed, needs) {
  const t0 = at(2026, 11, 12, 15), st = E.create(seed, t0, 'Koxa');
  Object.assign(st.needs, { food: 85, water: 85, fun: 80, love: 70, energy: 80, litter: 100, coat: 80 }, needs || {});
  return st;
}
// a session with a stroke (of the given kind) every 10 s and an advance tick every 10 s; minutes until she leaves
function lapSession(seed, needs, stroke, maxMin = 120, strokeMin = maxMin) {
  const st = lapCat(seed, needs), t0 = st.t;
  const ev0 = E.act(st, 'lapOn', null, t0).events;
  if (!ev0.some(e => e.type === 'lapOn')) return { refused: ev0 };
  let doze = false, leave = null;
  for (let t = t0 + 10000; t <= t0 + maxMin * MIN && !leave; t += 10000) {
    const r = stroke && t - t0 <= strokeMin * MIN ? E.act(st, 'stroke', stroke, t) : E.advance(st, t);
    for (const e of r.events) { if (e.type === 'lapDoze') doze = true; if (e.type === 'lapLeave') leave = e; }
    if (st.lap && st.lap.doze) break;
  }
  return { st, doze, leave, min: (st.t - t0) / MIN };
}
{
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const good = { region: 'back', along: true, speed: 300 };
  const happy = [], none = [], annoyed = [], hungry = []; let dozed = 0, stuck = 0;
  for (let s = 1; s <= 200; s++) {
    const a = lapSession(s, null, good); if (a.leave) happy.push(a.min); else if (a.doze) dozed++; else stuck++;
    const b = lapSession(s, null, null); if (b.leave) none.push(b.min); else if (!b.doze) stuck++;
    const c = lapSession(s, null, { region: 'back', along: false, speed: 300 }); if (c.leave) annoyed.push(c.min); else stuck++;
    const d = lapSession(s, { food: 20 }, good); if (d.leave) hungry.push(d.leave.reason);
  }
  console.log(`  happy with strokes: median ${med(happy).toFixed(1)} min; without strokes ${med(none).toFixed(1)} min; against the fur ${med(annoyed).toFixed(1)} min`);
  ok(med(happy) >= 1.5 && med(happy) <= 6 && med(none) < med(happy), `a happy session lasts a few minutes (median ${med(happy).toFixed(1)} min), shorter without stroking (${med(none).toFixed(1)})`);
  ok(med(annoyed) < 1.2 && annoyed.length === 200, `strokes against the fur end it quickly (median ${med(annoyed).toFixed(1)} min)`);
  ok(stuck === 0, 'she always leaves within 2 hours unless she dozes off');
  ok(hungry.filter(r => r === 'hungry').length > 150, `a hungry cat leaves because of hunger (${hungry.filter(r => r === 'hungry').length}/200)`);
  ok(JSON.stringify(lapSession(7, null, good).st) === JSON.stringify(lapSession(7, null, good).st), 'deterministic');
  // dozing: a sleepy content cat often dozes off and stays until stroked awake or the player stands up
  let dz = 0, staid = 0, woke = 0;
  for (let s = 1; s <= 100; s++) {
    const a = lapSession(s, { energy: 40 }, good, 30, 1);   // stroked for a minute, then left alone
    if (!a.doze) continue;
    dz++;
    const st = a.st, t1 = st.t;
    let left = false; for (let t = t1 + 30000; t <= t1 + 30 * MIN; t += 30000) for (const e of E.advance(st, t).events) if (e.type === 'lapLeave') left = true;
    if (!left && st.lap && st.lap.doze && E.health(st).lapDoze) staid++;
    const r = E.act(st, 'stroke', good, st.t).events;
    if (r.some(e => e.type === 'wake' && e.lap) && st.lap && !st.lap.doze) woke++;
  }
  ok(dz >= 30 && staid === dz && woke === dz, `sleepy: dozed ${dz}/100, stayed dozing 30 min ${staid}, woke by a stroke and stayed ${woke}`);
  // a dozing cat is never stuck: rested, she wakes and later leaves; with ticks every 30 s for 12 h
  let free = 0, tried = 0;
  for (let s = 1; s <= 40; s++) {
    const a = lapSession(s, { energy: 30 }, good, 30, 1); if (!a.doze) continue; tried++;
    const st = a.st, t1 = st.t;
    for (let t = t1 + 30000; t <= t1 + 12 * H && st.lap; t += 30000) E.advance(st, t);
    if (!st.lap) free++;
  }
  ok(tried > 0 && free === tried, `a dozing cat wakes rested and leaves by herself within 12 h (${free}/${tried})`);
  // a long advance (the app closed) ends the lap
  const lg = lapCat(3); E.act(lg, 'lapOn', null, lg.t); lg.lap.doze = true;
  const rl = E.advance(lg, lg.t + 2 * H);
  ok(!lg.lap && !E.health(lg).lap && rl.events.some(e => e.type === 'lapLeave' && e.reason === 'away'), 'a 2-hour advance ends the lap (away), even dozing');
  // refusals
  const t0 = at(2026, 11, 12, 15);
  const cases = [
    ['asleep', s => { s.asleep = true; s.sleepAt = t0; }, 'refused'], ['outside', s => { s.out = { since: t0, until: t0 + 3 * H }; }, 'refused'],
    ['offended', s => { s.off = { until: t0 + D, turned: false }; }, 'wriggle'], ['tummy', s => { s.ill = { kind: 'tummy', since: t0 }; }, 'wriggle'],
    ['scared', s => { s.scared = t0 + H; }, 'wriggle'], ['very hungry', s => { s.needs.food = 10; }, 'wriggle'], ['very thirsty', s => { s.needs.water = 5; }, 'wriggle'],
  ];
  for (const [nm, set, type] of cases) {
    const s = lapCat(4); set(s); const r = E.act(s, 'lapOn', null, t0).events;
    ok(r.some(e => e.type === type) && !s.lap, `lapOn when ${nm}: ${type}`);
  }
  // on the lap: love ×1.5, purrs, lapOff, other actions stand up, health
  const l = lapCat(5); l.needs.love = 40; E.act(l, 'lapOn', null, t0);
  ok(E.health(l).lap && E.health(l).lapSince === t0, 'health: lap and lapSince');
  const pr = E.act(l, 'stroke', { region: 'tail', along: true, speed: 300 }, t0).events;
  ok(l.needs.love === 43 && pr.some(e => e.type === 'purr'), 'on the lap: love ×1.5 and a purr');
  const of = E.act(l, 'lapOff', null, t0).events;
  ok(of.some(e => e.type === 'lapOff') && !l.lap && E.act(l, 'lapOff', null, t0).events[0].type === 'refused', 'lapOff; again: refused');
  E.act(l, 'lapOn', null, t0); l.needs.food = 50;
  const fe = E.act(l, 'feed', 'kibble', t0).events;
  ok(fe[0].type === 'lapOff' && fe.some(e => e.type === 'ate') && !l.lap, 'feeding means standing up first');
  // repair
  const g = lapCat(6); E.act(g, 'lapOn', null, t0); const c = clone(g); E.repair(c);
  ok(JSON.stringify(c) === JSON.stringify(g), 'a lap state is canonical');
  g.lap = { since: 'x', annoy: NaN }; E.repair(g); ok(g.lap === null, 'a broken lap is dropped');
}

/* ---------- 17. outside: weather, the garden, the tree, walks, the beds (SPEC §12e) ---------- */
section('Weather');
{
  const st = E.create(42, at(2026, 1, 1), 'Koxa');
  const count = { winter: {}, spring: {}, summer: {}, autumn: {} }, days = { winter: 0, spring: 0, summer: 0, autumn: 0 };
  for (let d = 0; d < 365 * 3; d++) {
    const t = at(2026, 1, 1 + d, 12), s = E.season(t), w = E.weather(t, st);
    days[s]++; count[s][w] = (count[s][w] || 0) + 1;
    if (E.weather(t, st) !== w || E.weather(at(2026, 1, 1 + d, 8), st) !== w) ok(false, 'weather is the same all day and deterministic');
  }
  const p = (s, w) => (count[s][w] || 0) / days[s];
  ok(p('winter', 'snow') > 0.15 && p('winter', 'snow') < 0.35 && !count.spring.snow && !count.summer.snow && !count.autumn.snow, `snow only in winter (${Math.round(100 * p('winter', 'snow'))} % of winter days)`);
  ok(p('spring', 'rain') > 0.15 && p('spring', 'rain') < 0.4 && p('autumn', 'rain') > 0.2 && p('autumn', 'rain') < 0.45, `rain some spring and autumn days (${Math.round(100 * p('spring', 'rain'))} %, ${Math.round(100 * p('autumn', 'rain'))} %)`);
  ok(p('summer', 'clear') > 0.5 && Object.keys(E.WEATHERS).every(w => typeof E.WEATHERS[w].name === 'string'), `mostly clear summers (${Math.round(100 * p('summer', 'clear'))} %)`);
  ok(E.weather(at(2026, 4, 1), null) === E.weather(at(2026, 4, 1), { seed: 0 }) && E.weather(NaN) === 'clear', 'weather without a cat or with a bad time');
  // a storm day is a rainy day
  let stormRain = true;
  for (let d = 0; d < 120; d++) {
    const s = E.create(7, at(2026, 5, 1 + d, 13), 'Koxa');
    const r = E.advance(s, at(2026, 5, 1 + d, 21));
    if (r.events.some(e => (e.type === 'scared' || e.type === 'curious') && e.what === 'storm') && E.weather(at(2026, 5, 1 + d, 15), s) !== 'rain') stormRain = false;
  }
  ok(stormRain, 'a storm day has rainy weather');
}
section('Garden');
// the first day from t (at hour h) whose weather is w
function dayWith(st, w, from, h = 10) { for (let d = 0; d < 400; d++) { const t = from + d * D, x = new Date(t); const u = new Date(x.getFullYear(), x.getMonth(), x.getDate(), h).getTime(); if (E.weather(u, st) === w) return u; } return null; }
function gardenCat(seed, t) {
  const st = E.create(seed, t - 3 * H, 'Koxa');
  Object.assign(st.needs, { food: 90, water: 90, fun: 30, love: 70, energy: 90, litter: 100, coat: 80 });
  E.advance(st, t); st.asleep = false; st.wokeAt = t; Object.assign(st.needs, { food: 90, water: 90, fun: 30, energy: 90 });
  return st;
}
{
  const probe = E.create(11, at(2026, 4, 1), 'K');
  const clear = dayWith(probe, 'clear', at(2026, 4, 1)), rain = dayWith(probe, 'rain', at(2026, 4, 1)), snow = dayWith(probe, 'snow', at(2026, 12, 1));
  // a clear day: fun rises fast, the coat suffers a little, love does not fall at the rate of being alone
  const g = gardenCat(11, clear), f0 = g.needs.fun, c0 = g.needs.coat;
  const r = E.act(g, 'goGarden', null, clear).events;
  ok(r.some(e => e.type === 'garden' && e.weather === 'clear') && E.health(g).garden, 'goGarden: garden event with the weather');
  for (let t = clear + MIN; t <= clear + 30 * MIN; t += MIN) { E.advance(g, t); if (g.yard && g.yard.tree) E.act(g, 'fetchDown', null, t); }
  ok(g.needs.fun >= f0 + 4 && g.needs.coat < c0, `30 min outside: fun ${f0} → ${g.needs.fun.toFixed(1)}, coat ${c0} → ${g.needs.coat.toFixed(1)}`);
  ok(E.act(g, 'goHouse', null, g.t).events.some(e => e.type === 'house') && !E.health(g).garden, 'goHouse');
  ok(E.act(g, 'goHouse', null, g.t).events[0].type === 'refused', 'goHouse when not in the garden: refused');
  // rain: wet, grumpy for 2 h
  const w = gardenCat(11, rain), m0 = E.moodValue(w);
  const rw = E.act(w, 'goGarden', null, rain).events;
  ok(rw.some(e => e.type === 'wet') && E.health(w).wet && E.moodValue(w) <= m0 - 15, `rain: wet at once, mood ${m0} → ${E.moodValue(w)}`);
  E.act(w, 'goHouse', null, rain + 5 * MIN); E.advance(w, rain + 90 * MIN);
  ok(E.health(w).wet, 'still wet 1.5 h later'); E.advance(w, rain + 3 * H); ok(!E.health(w).wet, 'dry after 2 h');
  // snow: paw prints once
  const sn = gardenCat(12, snow); const rs = E.act(sn, 'goGarden', null, snow).events;
  for (let t = snow + MIN; t <= snow + 10 * MIN; t += MIN) for (const e of E.advance(sn, t).events) rs.push(e);
  ok(rs.filter(e => e.type === 'snowPaws').length === 1, 'snow: she shakes her paws once');
  // presents and the tree over many garden hours; the tree never keeps her more than 30 min
  let presents = 0, stuck = 0, longest = 0, callsMax = 0;
  for (let s = 1; s <= 30; s++) {
    const day = dayWith(E.create(s, clear, 'K'), 'clear', at(2026, 6, 1));
    const c = gardenCat(s, day); E.act(c, 'goGarden', null, day);
    let since = null;
    for (let t = day + MIN; t <= day + 4 * H; t += MIN) {
      for (const e of E.advance(c, t).events) {
        if (e.type === 'present') { presents++; if (!E.PRESENTS[e.item]) ok(false, 'a known present'); }
        if (e.type === 'climbStuck') { stuck++; since = t; }
        if (e.type === 'climbDown') { longest = Math.max(longest, t - since); since = null; }
      }
      if (!c.yard) { E.act(c, 'goGarden', null, t); }
    }
    if (since) longest = Math.max(longest, c.t - since);
  }
  ok(presents > 10 && stuck > 5 && longest <= 31 * MIN, `4 h in the garden × 30 cats: ${presents} presents, stuck ${stuck}×, never longer than 30 min (${Math.round(longest / MIN)} min)`);
  // call: down within three calls; fetchDown: at once; goHouse refused while she is up there
  for (let s = 1; s <= 20; s++) {
    const c = gardenCat(s, clear); E.act(c, 'goGarden', null, clear); c.yard.tree = { since: clear, calls: 0 };
    ok(E.act(c, 'goHouse', null, clear).events[0].type === 'refused', `#${s} goHouse refused on the tree`);
    let n = 0; while (c.yard.tree && n < 5) { E.act(c, 'call', null, clear); n++; }
    callsMax = Math.max(callsMax, n);
  }
  ok(callsMax <= 3, `call brings her down within 3 calls (max ${callsMax})`);
  const fd = gardenCat(3, clear); E.act(fd, 'goGarden', null, clear); fd.yard.tree = { since: clear, calls: 0 };
  ok(E.act(fd, 'fetchDown', null, clear).events.some(e => e.type === 'climbDown' && e.by === 'fetch') && !fd.yard.tree, 'fetchDown');
  // the player leaves: an advance over 15 min = she stays in the garden alone (letOut) and comes back by herself
  const al = gardenCat(4, clear); E.act(al, 'goGarden', null, clear); al.yard.tree = { since: clear, calls: 0 };
  const ra = E.advance(al, clear + H).events;
  ok(!al.yard && (al.out || ra.some(e => e.type === 'back')) && ra.some(e => e.type === 'out' && e.walk === false), 'the garden left alone: she stays outside, off the tree');
  let back = ra.find(e => e.type === 'back'); for (let t = clear + H; !back && t < clear + 5 * H; t += 10 * MIN) back = E.advance(al, t).events.find(e => e.type === 'back');
  ok(back && !back.walk && back.postcard === null && back.minutes <= 180, `she comes back by herself within 3 h, no postcard (${back && back.minutes} min)`);
  const lg = gardenCat(4, clear); E.act(lg, 'goGarden', null, clear); E.advance(lg, clear + 10 * D);
  ok(!lg.yard && !lg.out, 'a long absence: home again, nobody in the garden');
  // a cold winter night in the garden gives a cold
  const wn = E.create(5, at(2026, 12, 3, 21), 'Koxa'); E.act(wn, 'goGarden', null, wn.t);
  let cold = false; for (let t = wn.t + 10 * MIN; t <= at(2026, 12, 3, 23); t += 10 * MIN) for (const e of E.advance(wn, t).events) if (e.type === 'ill' && e.kind === 'cold') cold = true;
  ok(cold && !wn.yard, 'a winter night in the garden: a cold, and she goes in');
  ok(E.act(wn, 'goGarden', null, wn.t).events[0].type === 'refused', 'with a cold she stays home');
}
section('Walks and postcards');
{
  const t0 = at(2026, 6, 1, 10), st = E.create(8, t0, 'Koxa');
  const rr = E.act(st, 'letOut', null, t0).events[0];
  ok(rr.type === 'refused' && /Kamarádka/.test(rr.reason) && !st.out, `letOut below bond 300: "${rr.reason}"`);
  friend(st);
  const seen = []; let presents = 0, nothing = 0, t = t0;
  for (let i = 0; i < 200; i++) {
    const d0 = new Date(t); t = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1, 10).getTime();   // every walk at 10:00
    E.advance(st, t); st.asleep = false; st.ill = null; Object.assign(st.needs, { food: 90, water: 90, energy: 90 });
    E.act(st, 'letOut', null, t);
    let b = null; for (let k = 0; !b && k < 60; k++) { t += 10 * MIN; b = E.advance(st, t).events.find(e => e.type === 'back'); }
    if (!b) { ok(false, 'she came back from the walk'); break; }
    if (b.minutes < 120 && st.needs.energy >= 25) ok(false, `a walk lasts 2–8 h (${b.minutes})`);
    if (b.postcard !== null) seen.push(b.postcard); else if (b.present) presents++; else nothing++;
    t += H;
  }
  const r1 = seen.slice(0, 42), r2 = seen.slice(42, 84);
  ok(seen.length >= 84 && new Set(r1).size === 42 && new Set(r2).size === 42, `postcards: ${seen.length} in 200 walks; the first 42 and the next 42 never repeat`);
  ok(presents > 10 && nothing > 10, `walks also bring dárky (${presents}) or nothing (${nothing})`);
  ok(st.postcards.length === seen.length && st.postcards.every((p, i) => p.id === seen[i]) && E.postcardAt(st.seed, 0) === seen[0], 'st.postcards keeps them in order');
  const c = clone(st); c.postcards.splice(3, 1); E.repair(c);
  ok(c.postcards.length === 3, 'a broken postcard list is cut where it stops following the order (no early repeats)');
}
section('Beds');
{
  const rich = s => { s.pamlsky = 500; return s; };   // seeds cost pamlsky (tested in 'Economy')
  const sp = at(2026, 4, 6, 9), st = rich(E.create(13, sp, 'Koxa'));
  ok(E.bedCount(st) === 4 && E.act(st, 'sow', { bed: 4, crop: 'radish' }, sp).events[0].type === 'refused', '4 beds; the 5th from bond level Parťačka');
  ok(E.act(st, 'sow', { bed: 0, crop: 'cactus' }, sp).events[0].type === 'refused' && E.act(st, 'sow', { bed: 9, crop: 'radish' }, sp).events[0].type === 'refused', 'unknown crop or bed: refused');
  ok(E.act(st, 'waterBeds', null, sp).events[0].type === 'refused', 'nothing to water: refused');
  // every crop ripens after exactly its number of watered days (dry days: no growth)
  const crops = Object.keys(E.CROPS);
  crops.slice(0, 4).forEach((c, i) => ok(E.act(st, 'sow', { bed: i, crop: c }, sp).events.some(e => e.type === 'sown' && e.crop === c), `sow ${c}`));
  ok(E.act(st, 'sow', { bed: 0, crop: 'catnip' }, sp).events[0].type === 'refused', 'a bed with a plant: refused');
  const ripeDay = {}; let wateredDays = 0, t = sp;
  for (let d = 0; d < 12; d++) {
    t = at(2026, 4, 6 + d, 9); for (const e of E.advance(st, t).events) if (e.type === 'ripe') ripeDay[e.crop] = wateredDays;
    const rained = E.weather(t, st) === 'rain';
    const r = E.act(st, 'waterBeds', null, t).events;
    if (!r.some(e => e.type === 'watered') && st.beds.some(b => b && b.days < E.CROPS[b.crop].days)) ok(false, 'watering works once a day');
    if (E.act(st, 'waterBeds', null, t).events[0].type !== 'refused') ok(false, 'a second watering the same day: refused');
    wateredDays++;
    E.advance(st, at(2026, 4, 6 + d, 23, 59));
    for (const e of E.advance(st, at(2026, 4, 7 + d, 0, 5)).events) if (e.type === 'ripe') ripeDay[e.crop] = wateredDays;
    void rained;
  }
  ok(crops.slice(0, 4).every(c => ripeDay[c] === E.CROPS[c].days), `ripe after exactly their days: ${JSON.stringify(ripeDay)}`);
  const h = E.act(st, 'harvest', { bed: 3 }, t).events;
  ok(h.some(e => e.type === 'harvested' && e.crop === 'tomato') && st.pantry.tomato === 3 && st.beds[3] === null, 'harvest puts 3 tomatoes in the pantry');
  ok(E.act(st, 'harvest', { bed: 3 }, t).events[0].type === 'refused', 'an empty bed cannot be harvested');
  // dry days pause, never kill; rain waters
  const dry = rich(E.create(14, sp, 'Koxa')); E.act(dry, 'sow', { bed: 0, crop: 'carrot' }, sp);
  let dryGrowth = 0, rainy = 0;
  for (let d = 1; d <= 40; d++) { const t1 = at(2026, 4, 6 + d, 9); E.advance(dry, t1); if (E.weather(at(2026, 4, 5 + d, 12), dry) === 'rain') rainy++; }
  dryGrowth = dry.beds[0].days;
  ok(dry.beds[0] && dry.beds[0].crop === 'carrot' && dryGrowth === Math.min(4, rainy), `40 days without the can: alive, grew only on the ${rainy} rainy days (${dryGrowth})`);
  ok(E.act(dry, 'harvest', { bed: 0 }, dry.t).events.some(e => e.type === (dryGrowth >= 4 ? 'harvested' : 'refused')), 'unripe: refused');
  // winter: no sowing, no growth
  const wi = rich(E.create(15, at(2026, 11, 28, 9), 'Koxa')); E.act(wi, 'sow', { bed: 0, crop: 'tomato' }, wi.t);
  for (let d = 0; d < 20; d++) { const t1 = at(2026, 11, 28 + d, 9); E.advance(wi, t1); E.act(wi, 'waterBeds', null, t1); }
  const nov = wi.beds[0].days;
  ok(nov <= 3 && E.act(wi, 'sow', { bed: 1, crop: 'radish' }, wi.t).events[0].reason === 'Záhony spí pod sněhem.', `Dec–Feb: no sowing, growth stops (${nov} days from November only)`);
  // šanta kočičí: zoomies at the harvest, or into the pantry when she sleeps; catnip from the pantry
  const ct = rich(E.create(16, sp, 'Koxa')); E.act(ct, 'sow', { bed: 0, crop: 'catnip' }, sp); ct.beds[0].days = 3; ct.needs.fun = 20;
  const hc = E.act(ct, 'harvest', { bed: 0 }, sp).events;
  ok(hc.some(e => e.type === 'catnip') && ct.needs.fun === 80 && !ct.pantry.catnip, 'šanta: catnip, fun +60');
  E.act(ct, 'sow', { bed: 0, crop: 'catnip' }, sp); ct.beds[0].days = 3; ct.asleep = true; ct.sleepAt = sp;
  E.act(ct, 'harvest', { bed: 0 }, sp); ok(ct.pantry.catnip === 1, 'šanta while she sleeps: into the pantry');
  ct.asleep = false; ct.needs.fun = 10;
  ok(E.act(ct, 'catnip', null, sp).events.some(e => e.type === 'catnip') && !ct.pantry.catnip && E.act(ct, 'catnip', null, sp).events[0].type === 'refused', 'catnip from the pantry, once');
  // 6 beds at Parťačka
  const bp = rich(E.create(17, sp, 'Koxa')); bp.bond = 600; bp.lvl = 3;
  ok(E.bedCount(bp) === 6 && E.act(bp, 'sow', { bed: 5, crop: 'radish' }, sp).events.some(e => e.type === 'sown'), '6 beds at bond 600');
  // repair of garden data
  const rp = clone(bp); Object.assign(rp, { beds: [{ crop: 'x' }, 5, null], pantry: { radish: -1, gold: 5, carrot: 2 }, presents: { leaf: 'x', cone: 2 }, yard: { since: 'no' }, wet: 1e20 });
  E.repair(rp);
  ok(rp.beds.length === 6 && rp.beds.every(b => b === null) && JSON.stringify(rp.pantry) === '{"carrot":2}' && JSON.stringify(rp.presents) === '{"cone":2}' && rp.yard === null && rp.wet === 0, 'repair: beds, pantry, presents, yard, wet');
  const ok2 = clone(st); E.repair(ok2); ok(JSON.stringify(ok2) === JSON.stringify(st), 'a garden state is canonical');
}

/* ---------- 18. every good stroke gets a visible reaction ---------- */
section('Stroke reactions');
{
  const t0 = at(2026, 11, 12, 10), REACT = ['purr', 'content', 'tolerate', 'earsBack', 'bite'];
  const moods = { happy: { food: 95, water: 95, fun: 95, love: 95 }, calm: { food: 60, water: 60, fun: 60, love: 60 }, grumpy: { food: 30, water: 30, fun: 30, love: 30 }, sad: { food: 5, water: 5, fun: 5, love: 5 } };
  for (const [m, needs] of Object.entries(moods)) {
    let silent = 0, content = 0, n = 0;
    for (let s = 1; s <= 30; s++) {
      const st = E.create(s, t0, 'Koxa'); Object.assign(st.needs, needs, { energy: 80 });
      if (E.mood(st) !== m) { ok(false, `set up ${m}`); continue; }
      const plain = ['tail', 'paws'].concat(['back', 'head', 'chin', 'ears', 'tailBase'].filter(r => !st.traits.spots.includes(r)));
      const region = plain[s % 3];
      for (const along of [true, 'sideways']) {
        const ev = E.act(st, 'stroke', { region, along, speed: 300 }, t0).events; n++;
        if (!ev.some(e => REACT.includes(e.type))) silent++;
        if (ev.some(e => e.type === 'content')) content++;
        Object.assign(st.needs, needs);
      }
    }
    ok(silent === 0, `${m}: every along or sideways stroke on a plain spot gets a reaction (${n - silent}/${n})`);
    if (m === 'calm') ok(content === n / 2, `calm: a good stroke on a plain spot = content (${content}/${n / 2})`);
    if (m === 'grumpy' || m === 'sad') ok(content > 0 && content < n / 2, `${m}: content sometimes (${content}/${n / 2}), otherwise tolerate`);
  }
}

/* ---------- 19. Phase 3: economy, shop, minigames, tricks (SPEC §8) ---------- */
section('Economy');
{
  const t0 = at(2026, 6, 10, 10), st = E.create(20, t0, 'Koxa');
  st.needs.food = 40; st.pamlsky = 3;
  const r = E.act(st, 'feed', 'tuna', t0).events[0];
  ok(r.type === 'refused' && r.reason === 'Na tuňáka nemáš dost pamlsků (4).', `tuna with 3 pamlsky: "${r.reason}"`);
  ok(E.act(st, 'feed', 'kibble', t0).events.some(e => e.type === 'ate') && st.pamlsky === 3, 'granule is free');
  st.needs.food = 40; st.pamlsky = 4; E.act(st, 'feed', 'tuna', t0);
  ok(st.pamlsky === 0, 'a serving of tuna costs 4');
  st.pamlsky = 8; E.act(st, 'buy', 'pouch5', t0); st.needs.food = 40; E.act(st, 'feed', 'pouch', t0);
  ok(st.pamlsky === 0 && st.stock.pouch === 4, 'a pack of 5 kapsičky (8): feeding takes a serving from the stock');
  for (const [crop, text] of [['radish', 'Na ředkvičku nemáš dost pamlsků (3).'], ['carrot', 'Na mrkev nemáš dost pamlsků (5).'], ['strawberry', 'Na jahody nemáš dost pamlsků (8).'], ['tomato', 'Na rajče nemáš dost pamlsků (9).'], ['catnip', 'Na šantu nemáš dost pamlsků (7).']]) {
    const rs = E.act(st, 'sow', { bed: 0, crop }, t0).events[0];
    ok(rs.type === 'refused' && rs.reason === text, `seeds without pamlsky: "${rs.reason}"`);
  }
  st.pamlsky = 8; E.act(st, 'buy', 'seedsRadish', t0);
  ok(E.act(st, 'sow', { bed: 0, crop: 'radish' }, t0).events.some(e => e.type === 'sown') && st.stock.seed_radish === 2 && st.pamlsky === 0, 'a seed packet from the stock');
  st.pantry = { carrot: 3, catnip: 1 };
  const sl = E.act(st, 'sell', { crop: 'carrot', n: 2 }, t0).events.find(e => e.type === 'sold');
  ok(sl && sl.earned === 6 && st.pamlsky === 6 && st.pantry.carrot === 1, 'selling 2 carrots: 6 pamlsky');
  ok(E.act(st, 'sell', { crop: 'catnip' }, t0).events[0].type === 'refused' && E.act(st, 'sell', { crop: 'gold' }, t0).events[0].type === 'refused', 'šanta and unknown crops cannot be sold');
  st.pamlsky = 6; E.act(st, 'buy', 'sticks5', t0); const l0 = st.needs.love = 50;
  ok(E.act(st, 'treat', 'stick', t0).events.some(e => e.type === 'treat' && e.stick) && st.stock.stick === 4 && st.needs.love === l0 + 5 && st.pamlsky === 0, 'a kočičí tyčinka from the stock: love +5');
}
section('Shop');
{
  const t0 = at(2026, 6, 10, 10), st = E.create(21, t0, 'Koxa'); st.pamlsky = 1000;
  const list = E.shop(st);
  ok(list.every(i => E.SHOP.find(x => x.id === i.id).bond === 0) && !list.some(i => i.id === 'catTree'), 'level Nová: only the basic items are offered');
  ok(E.act(st, 'buy', 'catTree', t0).events[0].type === 'refused', 'the cat tree needs bond level Kamarádka');
  ok(E.act(st, 'buy', 'scratcher', t0).events.some(e => e.type === 'bought' && e.kind === 'furniture') && st.owned.scratcher && st.pamlsky === 970, 'buy a škrabadlo (30)');
  ok(E.act(st, 'buy', 'scratcher', t0).events[0].reason === 'Tohle už máš.', 'not twice');
  const poor = E.create(22, t0, 'Koxa'); poor.pamlsky = 5;
  ok(E.act(poor, 'buy', 'rug', t0).events[0].reason === 'Koberec stojí 35 pamlsků, tolik nemáš.' && E.act(poor, 'buy', 'nothing', t0).events[0].type === 'refused', 'too expensive / unknown: refused in Czech');
  ok(E.act(st, 'place', { id: 'scratcher', room: 'living', x: 3, y: -1 }, t0).events.some(e => e.type === 'placed') && JSON.stringify(st.furniture.scratcher) === '{"room":"living","x":1,"y":0}', 'place: coordinates clamped to 0–1');
  ok(E.act(st, 'place', { id: 'scratcher', room: 'attic' }, t0).events[0].type === 'refused' && E.act(st, 'place', { id: 'lamp', room: 'living' }, t0).events[0].type === 'refused', 'place: unknown room or not owned: refused');
  friend(st);
  E.act(st, 'buy', 'catFlap', t0);
  ok(E.act(st, 'place', { id: 'catFlap', room: 'living' }, t0).events[0].type === 'refused' && E.act(st, 'place', { id: 'catFlap', room: 'hall', x: 0.2, y: 0.9 }, t0).events.some(e => e.type === 'placed'), 'the cat flap only in the předsíň');
  const c = clone(st); E.repair(c); ok(JSON.stringify(c) === JSON.stringify(st), 'a shop state is canonical');
  const g = clone(st); Object.assign(g, { owned: { scratcher: 'yes', pouch5: true, gold: true }, furniture: { scratcher: { room: 'living' }, lamp: { room: 'living' } }, stock: { pouch: -1, bananas: 3 } });
  E.repair(g); ok(JSON.stringify(g.owned) === '{}' && JSON.stringify(g.furniture) === '{}' && JSON.stringify(g.stock) === '{}', 'repair drops garbage owned / furniture / stock');
  // what bought things do
  const pair = (fn, setup) => { const a = E.create(23, t0, 'Koxa'), b = E.create(23, t0, 'Koxa'); setup(b); return fn(a, b); };
  pair((a, b) => { for (const s of [a, b]) { s.needs.coat = 30; E.advance(s, t0 + 40 * H); }
    ok(b.needs.coat >= 59 && a.needs.coat <= 50.5, `škrabadlo: she keeps her coat at 60 by herself (${a.needs.coat.toFixed(0)} → ${b.needs.coat.toFixed(0)})`); }, b => { b.owned.scratcher = true; });
  pair((a, b) => { for (const s of [a, b]) { s.needs.fun = 90; E.advance(s, t0 + 4 * H); }
    ok(b.needs.fun > a.needs.fun, `kočičí strom: fun falls slower (${a.needs.fun.toFixed(1)} vs ${b.needs.fun.toFixed(1)})`); }, b => { b.owned.catTree = true; });
  pair((a, b) => { for (const s of [a, b]) { s.asleep = true; s.sleepAt = t0; s.needs.energy = 20; E.advance(s, t0 + H); }
    ok(b.needs.energy > a.needs.energy, 'pelíšek deluxe: she rests faster'); }, b => { b.owned.bedDeluxe = true; });
  const bx = E.create(24, at(2026, 6, 10, 14), 'Koxa'); bx.owned.box = true; bx.needs.energy = 60; bx.wokeAt = bx.t - 3 * H;
  let place = null; for (let tt = bx.t + MIN; !place && tt < bx.t + H; tt += MIN) { const e = E.advance(bx, tt).events.find(x => x.type === 'sleep'); if (e) place = e.place; }
  ok(place === 'box', `krabice: she naps in the box (${place})`);
  // the cat flap: while the player is away she goes on walks by herself
  let flapWalks = 0, noFlap = 0;
  for (let s = 1; s <= 10; s++) {
    const fl = friend(E.create(s, at(2026, 6, 10, 8), 'Koxa')), nf = friend(E.create(s, at(2026, 6, 10, 8), 'Koxa'));
    fl.owned.catFlap = true; fl.furniture.catFlap = { room: 'hall', x: 0.5, y: 0.5 };
    const rf = E.advance(fl, at(2026, 6, 11, 20)).events, rn = E.advance(nf, at(2026, 6, 11, 20)).events;
    if (rf.some(e => e.type === 'out' && e.flap) && rf.some(e => e.type === 'back' && e.walk)) flapWalks++;
    if (rn.some(e => e.type === 'out')) noFlap++;
  }
  ok(flapWalks >= 8 && noFlap === 0, `kočičí dvířka: walks by herself while the player is away (${flapWalks}/10 cats in 36 h; none without it)`);
  const fw = E.create(26, t0, 'Koxa'); fw.owned.catFlap = true; fw.furniture.catFlap = { room: 'hall', x: 0.5, y: 0.5 };
  ok(!E.advance(fw, t0 + 30 * H).events.some(e => e.type === 'out'), 'the cat flap needs bond Kamarádka');
  // toys: shop toys only when owned; her favourite counts for its kind
  const ty = E.create(27, t0, 'Koxa'); ty.pamlsky = 50;
  ok(E.act(ty, 'play', 'tunnel', t0).events[0].type === 'refused', 'a shop toy that is not owned: refused');
  E.act(ty, 'buy', 'bellBall', t0); ty.needs.fun = 10;
  const pl = E.act(ty, 'play', 'bellBall', t0).events.find(e => e.type === 'played');
  ok(pl && pl.fav === (ty.traits.toy === 'ball') && pl.gain >= 30, `the bell ball plays (+${pl && pl.gain})`);
}
section('Minigames');
{
  const t0 = at(2026, 6, 10, 10), st = E.create(30, t0, 'Koxa'); st.pamlsky = 0; st.needs.fun = 20; st.needs.energy = 80;
  ok(E.minigameResult(st, 'chess', 10, t0).events[0].type === 'refused', 'unknown game: refused');
  const r = E.minigameResult(st, 'mouse', 15, t0).events;
  ok(r.some(e => e.type === 'earned' && e.n === 5) && st.pamlsky === 5 && st.needs.fun === 50 && st.needs.energy === 70, 'Chyť myšku 15: 5 pamlsků, fun +30, energy −10');
  ok(r.some(e => e.type === 'record' && e.best === 15 && e.prev === 0) && st.records.mouse.best === 15, 'a record');
  ok(!E.minigameResult(st, 'mouse', 9, t0).events.some(e => e.type === 'record') && st.records.mouse.best === 15, 'a lower score is no record');
  let total = 0, capped = false;
  for (let i = 0; i < 10; i++) for (const e of E.minigameResult(st, 'feather', 40, t0 + i * MIN).events) { if (e.type === 'earned') total += e.n; if (e.type === 'capReached') capped = true; }
  ok(total === 30 - 3 - 5 && st.earnDay.n === 30 && capped, `at most 30 a day from minigames (earned ${5 + 3 + total})`);
  const nd = E.minigameResult(st, 'fishing', 6, at(2026, 6, 11, 10)).events;
  ok(nd.some(e => e.type === 'earned' && e.n === 6) && st.earnDay.n === 6, 'the next day the cap starts again');
  ok(E.minigameResult(st, 'pill', 1, st.t).events.some(e => e.type === 'earned' && e.n === 1) && E.minigameResult(st, 'pill', 50, st.t).events.some(e => e.type === 'earned' && e.n === 3), 'Pilulka: at most 3');
  const p0 = st.pamlsky; E.minigameResult(st, 'laserRun', NaN, st.t); E.minigameResult(st, 'laserRun', -5, st.t);
  ok(st.pamlsky === p0, 'garbage scores earn nothing');
  const o = friend(E.create(31, t0, 'Koxa')); E.act(o, 'letOut', null, t0);
  ok(E.minigameResult(o, 'mouse', 10, t0).events[0].type === 'refused', 'not while she is out');
}
section('Tricks');
{
  const t0 = at(2026, 6, 10, 10);
  const happy = s => Object.assign(s.needs, { food: 90, water: 90, fun: 90, love: 90, energy: 90, litter: 100, coat: 90 });
  const st = E.create(40, t0, 'Koxa'); happy(st); st.pamlsky = 100;
  ok(E.act(st, 'train', { trick: 'sedni', cue: 'swipeUp' }, t0).events.some(e => e.type === 'trickRefused'), 'Sedni needs bond 100');
  st.bond = 100; st.lvl = 1;
  ok(E.act(st, 'train', { trick: 'sedni', cue: 'circle' }, t0).events.some(e => e.type === 'perform' && !e.ok && e.understood === false), 'a wrong cue: she does not understand');
  let tries = 0, t = t0;
  while (!(st.tricks.sedni && st.tricks.sedni.learned) && tries < 60) {
    t += 5000; tries++; happy(st);
    E.act(st, 'train', { trick: 'sedni', cue: 'swipeUp', treatAt: t + 800 }, t);
  }
  ok(st.tricks.sedni.learned && st.tricks.sedni.progress === 5 && tries <= 40, `Sedni learned after ${tries} tries (5 rewarded performances)`);
  ok(st.pamlsky === 95, `each success cost a pamlsek (${st.pamlsky})`);
  // a late treat does not count; the two-step way (train, then the treat action) does
  const s2 = E.create(41, t0, 'Koxa'); happy(s2); s2.bond = 300; s2.lvl = 2; s2.pamlsky = 50;
  let late = 0, timely = 0;
  for (let i = 0; i < 40; i++) {
    const tt = t0 + i * 10000; happy(s2);
    const ev = E.act(s2, 'train', { trick: 'dejPac', cue: 'tapPaw', treatAt: tt + 2000 }, tt).events;
    if (ev.some(e => e.type === 'perform' && e.ok)) late++;
  }
  ok(late > 0 && !(s2.tricks.dejPac.progress > 0), `treats after 1.5 s never count (${late} performances)`);
  for (let i = 0; i < 40 && !s2.tricks.dejPac.learned; i++) {
    const tt = t0 + H + i * 10000; happy(s2);
    const ev = E.act(s2, 'train', { trick: 'dejPac', cue: 'tapPaw' }, tt).events;
    if (ev.some(e => e.type === 'perform' && e.ok)) { E.act(s2, 'treat', null, tt + 1000); timely++; }
  }
  ok(s2.tricks.dejPac.learned && timely === 5, `train, then a treat within 1.5 s: learned after ${timely} rewards`);
  // showing a learned trick: bond +3, 1 pamlsek per trick a day
  ok(E.act(s2, 'showTrick', { trick: 'sedni' }, s2.t).events.some(e => e.type === 'trickRefused'), 'an unlearned trick cannot be shown');
  const b0 = s2.bond, p0 = s2.pamlsky; let shown = 0, earned = 0;
  for (let i = 0; i < 10; i++) { happy(s2); for (const e of E.act(s2, 'showTrick', { trick: 'dejPac' }, s2.t + 1000).events) { if (e.type === 'perform' && e.ok) shown++; if (e.type === 'earned') earned += e.n; } }
  ok(shown >= 6 && earned === 1 && s2.pamlsky === p0 + 1 && s2.bond === b0 + 3, `shown ${shown}×: bond +${s2.bond - b0} and 1 pamlsek, only the first show of the day`);
  // sad: tricks fail
  const sd = E.create(42, t0, 'Koxa'); Object.assign(sd.needs, { food: 5, water: 5, fun: 5, love: 5 }); sd.bond = 100; sd.lvl = 1; sd.tricks.sedni = { progress: 5, learned: t0, shown: 0 };
  let okSad = 0; for (let i = 0; i < 20; i++) if (E.act(sd, 'showTrick', { trick: 'sedni' }, t0 + i * 1000).events.some(e => e.type === 'perform' && e.ok)) okSad++;
  ok(okSad === 0, 'a sad cat does no tricks');
  ok(E.tricks(s2).length === 4 && E.tricks(s2).find(x => x.id === 'dejPac').learned && !E.tricks(s2).find(x => x.id === 'panacek').available, 'tricks(st) for the UI');
}
section('Economy balance (60 days)');
{
  // a player who plays two minigames a day (typical scores) and does basic care twice a day, kapsička every morning
  const t0 = at(2026, 9, 1, 7), st = E.create(50, t0, 'Koxa');   // starts with 5 pamlsků
  let pouchRefused = 0, toys = 0, firstRich = null, sad = 0, n = 0, ill = 0;
  const toyList = ['catnipMouse', 'bellBall', 'box', 'featherWand', 'tunnel'];
  for (let tt = t0 + H; tt <= t0 + 60 * D; tt += H) {
    for (const e of E.advance(st, tt).events) if (e.type === 'ill') ill++;
    const hr = new Date(tt).getHours(), day = Math.floor((tt - t0) / D);
    if (hr === 8) {
      st.needs.food = Math.min(st.needs.food, 60);
      if (E.act(st, 'feed', 'pouch', tt).events.some(e => e.type === 'refused' && /pamlsk/.test(e.reason))) pouchRefused++;
      basicCare(st, tt);
      E.minigameResult(st, 'mouse', 15, tt + 5 * MIN);
    }
    if (hr === 20) { basicCare(st, tt); E.minigameResult(st, 'feather', 10, tt + 5 * MIN); }
    if (hr === 21 && day % 7 === 6) { const id = toyList.find(x => !st.owned[x] && E.shop(st).some(i => i.id === x)); if (id && E.act(st, 'buy', id, tt).events.some(e => e.type === 'bought')) toys++; }
    if (firstRich === null && st.pamlsky >= 120) firstRich = day;
    n++; if (E.mood(st) === 'sad') sad++;
  }
  console.log(`  2 minigames a day: kapsička refused ${pouchRefused}×, toys bought ${toys}, 120 pamlsků saved on day ${firstRich}, ${st.pamlsky} at the end`);
  ok(pouchRefused === 0 && toys >= 5 && ill === 0 && sad / n < 0.1, 'kapsička every day and a toy every week are affordable; healthy');
  ok(firstRich !== null && firstRich >= 14, `the cat tree (120) takes weeks of saving (day ${firstRich})`);
  const care = visitRun(50, [8, 20], 30);
  ok(care.ill === 0 && care.sad < 0.1 && care.st.pamlsky === 5, 'free care only (granule, water): still healthy, no pamlsky spent');
}

/* ---------- 19b. regressions from the second review (lap, garden, economy, tricks) ---------- */
section('Review 2 regressions');
{
  const happy = s => Object.assign(s.needs, { food: 90, water: 90, fun: 90, love: 90, energy: 90, litter: 100, coat: 90 });
  // 1. clock back and forth over midnight: the minigame cap and the trick pay hold
  const m = E.create(5, at(2026, 11, 12, 23, 50), 'Koxa'); const p0 = m.pamlsky;
  for (let i = 0; i < 5; i++) for (const tt of [at(2026, 11, 12, 23, 57), at(2026, 11, 13, 0, 1)])
    for (const g of ['mouse', 'laserRun', 'feather']) E.minigameResult(m, g, 90, tt);
  ok(m.pamlsky - p0 <= 60, `#1 five clock round trips over midnight: ${m.pamlsky - p0} pamlsků (2 days × 30 at most)`);
  const tr = E.create(9, at(2026, 6, 10, 23, 55), 'Koxa'); happy(tr); tr.bond = 100; tr.lvl = 1; tr.tricks.sedni = { progress: 5, learned: tr.t, shown: 0 };
  const q0 = tr.pamlsky;
  for (let i = 0; i < 10; i++) for (const tt of [at(2026, 6, 10, 23, 56), at(2026, 6, 11, 0, 1)]) for (let k = 0; k < 3; k++) { happy(tr); E.act(tr, 'showTrick', { trick: 'sedni' }, tt); }
  ok(tr.pamlsky - q0 <= 2 && tr.bond <= 106, `#1 trick pay over 10 round trips: ${tr.pamlsky - q0} pamlsky, bond ${tr.bond}`);
  const rp = clone(m); rp.earnDay = { key: 20991231, n: 3 }; rp.tricks = { sedni: { progress: 5, learned: m.t, shown: 20991231 } }; E.repair(rp);
  ok(rp.earnDay.key <= 20261114 && rp.earnDay.n === E.EARN_CAP && rp.tricks.sedni.shown <= 20261114, '#1 repair: paid keys at most tomorrow (and then full)');
  // 2. showing a trick: bond +3 only once a trick a day
  const b = E.create(5, at(2026, 11, 12, 10), 'Koxa'); b.bond = 100; b.lvl = 1; b.tricks.sedni = { progress: 5, learned: b.t, shown: 0 };
  for (let i = 0; i < 400; i++) { happy(b); E.act(b, 'showTrick', { trick: 'sedni' }, b.t + 2000); }
  ok(b.bond === 103, `#2 400 shows in 13 min: bond ${b.bond} (+3 once)`);
  // 3. no winter colds the player cannot prevent
  const fl = friend(E.create(7, at(2026, 12, 1, 8), 'Koxa')); fl.pamlsky = 200;
  E.act(fl, 'buy', 'catFlap', fl.t); E.act(fl, 'place', { id: 'catFlap', room: 'hall' }, fl.t);
  let colds = 0, walks = 0;
  for (let d = 0; d < 60; d++) for (const h of [8, 20]) {
    const t = at(2026, 12, 1 + d, h);
    for (const e of E.advance(fl, t).events) { if (e.type === 'ill' && e.kind === 'cold') colds++; if (e.type === 'out' && e.flap) walks++; }
    if (fl.out) E.act(fl, 'letIn', null, t);
    basicCare(fl, t); if (fl.ill) E.act(fl, 'vetCure', { won: true }, t);
  }
  ok(walks > 20 && colds === 0, `#3 Dec–Jan with the cat flap: ${walks} walks by herself, ${colds} colds`);
  let gc = 0;
  for (let s = 1; s <= 30; s++) { const g = E.create(s, at(2026, 12, 10, 21, 30), 'Koxa'); happy(g); E.act(g, 'goGarden', null, g.t);
    if (E.advance(g, at(2026, 12, 11, 8)).events.some(e => e.type === 'ill' && e.kind === 'cold')) gc++; }
  ok(gc === 0, `#3 the garden left at 21:30 in December, app closed: ${gc}/30 colds`);
  const lo = friend(E.create(8, at(2026, 12, 10, 18), 'Koxa')); happy(lo); E.act(lo, 'letOut', null, lo.t);
  ok(lo.out.byPlayer === true, '#3 a walk the player started is marked byPlayer (it may run into the night)');
  // 4. the shop while she is out
  const sh = friend(E.create(9, at(2026, 6, 10, 10), 'Koxa')); sh.pamlsky = 100; sh.pantry.carrot = 2; sh.owned.rug = true; E.act(sh, 'letOut', null, sh.t);
  ok(['bought', 'sold', 'placed'].every((type, i) => E.act(sh, ['buy', 'sell', 'place'][i], [ 'pouch5', { crop: 'carrot' }, { id: 'rug', room: 'living' }][i], sh.t + MIN).events.some(e => e.type === type)), '#4 buy, sell and place work while she is out');
  // 5. up the tree: only the allowed actions
  const tt = E.create(10, at(2026, 6, 3, 10), 'Koxa'); happy(tt); E.act(tt, 'goGarden', null, tt.t); tt.yard.tree = { since: tt.t, calls: 0 };
  for (const a of ['lapOn', 'pickUp', 'feed', 'play', 'showTrick', 'stroke', 'brush', 'letOut'])
    ok(E.act(tt, a, a === 'showTrick' ? { trick: 'sedni' } : null, tt.t).events[0].reason === 'Koxa je na stromě.', `#5 ${a} on the tree: refused`);
  ok(!tt.lap && !tt.held && E.minigameResult(tt, 'mouse', 10, tt.t).events[0].reason === 'Koxa je na stromě.', '#5 no minigame on the tree');
  ok(E.act(tt, 'photo', {}, tt.t).events.some(e => e.type === 'photo') && E.act(tt, 'buy', 'pouch5', tt.t).events.every(e => e.type !== 'refused' || !/stromě/.test(e.reason)), '#5 the camera and the shop still work');
  const tr2 = clone(tt); tr2.lap = { since: tt.t, annoy: 0, doze: false, pet: tt.t, dozeAt: 0 }; tr2.held = true; E.repair(tr2);
  ok(tr2.lap === null && tr2.held === false, '#5 repair: on the tree she is neither on the lap nor held');
  // 6. unripe texts agree with the crop
  const ur = E.create(11, at(2026, 6, 1, 10), 'Koxa'); ur.pamlsky = 999; ur.bond = 700; ur.lvl = 3;
  const texts = ['Ředkvička ještě není zralá.', 'Mrkev ještě není zralá.', 'Jahody ještě nejsou zralé.', 'Rajče ještě není zralé.', 'Šanta kočičí ještě není zralá.'];
  ['radish', 'carrot', 'strawberry', 'tomato', 'catnip'].forEach((c, i) => { E.act(ur, 'sow', { bed: i, crop: c }, ur.t);
    ok(E.act(ur, 'harvest', { bed: i }, ur.t).events[0].reason === texts[i], `#6 "${texts[i]}"`); });
  // 7. a normal training session never makes her ill; training treats do not count for the weight
  const ts = E.create(5, at(2026, 11, 12, 10), 'Koxa'); ts.bond = 500; ts.lvl = 2; ts.pamlsky = 80; let ill = null, t = ts.t;
  for (const [trk, cue] of [['sedni', 'swipeUp'], ['dejPac', 'tapPaw'], ['otocSe', 'circle']])
    for (let i = 0; i < 40 && !(ts.tricks[trk] && ts.tricks[trk].learned); i++) { t += 3000; happy(ts); for (const e of E.act(ts, 'train', { trick: trk, cue, treatAt: t + 500 }, t).events) if (e.type === 'ill') ill = e.kind; }
  ok(Object.keys(ts.tricks).every(k => ts.tricks[k].learned) && !ill && ts.day.treats === 0 && ts.day.ttreats === 15, `#7 three tricks taught in one session: not ill (${ts.day.ttreats} training treats)`);
  for (let i = 0; i < 11; i++) { happy(ts); t += 3000; E.act(ts, 'train', { trick: 'panacek', cue: 'swipeUp2', treatAt: t + 500 }, t); E.act(ts, 'treat', null, t + 60000); }
  ok(ts.ill && ts.ill.kind === 'tummy', '#7 but piles of ordinary treats on top still give tummy');
  // 8. gardening pays a little: a pack of seeds sells for more than it costs, far less a day than the minigames
  for (const it of E.SHOP.filter(x => x.kind === 'seed' && x.stock !== 'seed_catnip')) {
    const c = E.CROPS[it.stock.slice(5)], sale = it.n * c.yield * c.sell, perDay = (c.yield * c.sell - it.price / it.n) / c.days;
    ok(sale >= it.price * 1.3 && sale <= it.price * 1.6 && c.yield * c.sell > c.seed && perDay < 1, `#8 ${it.name}: ${it.price} → sells for ${sale} (${(sale / it.price).toFixed(2)}×), ${perDay.toFixed(2)} a bed a day`);
  }
  let rep = 0;
  for (const seed of [1, 2, 3, 77, 4242]) for (let r = 1; r < 6; r++) if (E.postcardAt(seed, r * 42 - 1) === E.postcardAt(seed, r * 42)) rep++;
  ok(rep === 0, '#8 a postcard round never starts with the card that ended the last');
  // r5: a doze on the lap ends by itself within 90 min
  const dz = E.create(12, at(2026, 11, 12, 14), 'Koxa'); happy(dz); dz.needs.energy = 40; E.act(dz, 'lapOn', null, dz.t); dz.lap.doze = true; dz.lap.dozeAt = dz.t;
  let wokeAt = null; for (let x = dz.t + 30000; !wokeAt && x < dz.t + 3 * H; x += 30000) if (E.advance(dz, x).events.some(e => e.type === 'wake' && e.lap)) wokeAt = x;
  ok(wokeAt && wokeAt - dz.lap.since <= 91 * MIN, `a doze on the lap lasts at most 90 min (${wokeAt && Math.round((wokeAt - dz.lap.since) / MIN)} min)`);
}

/* ---------- 19c. feel round: tricks that feel fair, present names ---------- */
section('Tricks feel');
{
  const happy = s => Object.assign(s.needs, { food: 90, water: 90, fun: 90, love: 90, energy: 90, litter: 100, coat: 90 });
  // a happy cat with a new trick performs most correct cues, and never refuses 4 in a row
  let okN = 0, n = 0, worstRun = 0;
  for (let s = 1; s <= 50; s++) {
    const st = E.create(s, at(2026, 11, 12, 10), 'Koxa'); st.bond = 100; st.lvl = 1; st.pamlsky = 50;
    let run = 0;
    for (let i = 0; i < 4; i++) {
      happy(st); const ev = E.act(st, 'train', { trick: 'sedni', cue: 'swipeUp' }, st.t + 3000).events.find(e => e.type === 'perform');
      n++; if (ev.ok) { okN++; run = 0; } else { run++; worstRun = Math.max(worstRun, run); ok(ev.understood === true && ev.reason === 'notNow', 'a happy cat refusing a right cue: understood, notNow'); }
    }
  }
  ok(okN / n >= 0.55 && worstRun <= 2, `a new trick, happy cat, right cue: performed ${Math.round(100 * okN / n)} %, longest refusal run ${worstRun}`);
  // reasons: tired, grumpy; a wrong cue is not understood
  const tired = E.create(3, at(2026, 11, 12, 10), 'Koxa'); tired.bond = 100; tired.lvl = 1; happy(tired); tired.needs.energy = 30;
  const grumpy = E.create(3, at(2026, 11, 12, 10), 'Koxa'); grumpy.bond = 100; grumpy.lvl = 1; Object.assign(grumpy.needs, { food: 30, water: 30, fun: 30, love: 30, energy: 80 });
  const reasons = st => { const r = new Set(); const e0 = st.needs.energy; for (let i = 0; i < 30; i++) { st.needs.energy = e0; const e = E.act(st, 'train', { trick: 'sedni', cue: 'swipeUp' }, st.t + 3000).events.find(x => x.type === 'perform'); if (e && !e.ok) r.add(e.reason); } return [...r]; };
  ok(reasons(tired).join() === 'tired' && reasons(grumpy).join() === 'grumpy', `refusal reasons: tired (${reasons(tired)}), grumpy (${reasons(grumpy)})`);
  const w = E.act(tired, 'train', { trick: 'sedni', cue: 'circle' }, tired.t).events.find(e => e.type === 'perform');
  ok(w && w.ok === false && w.understood === false && !w.reason, 'a wrong cue: not understood, no reason');
  // a learned trick: train answers trickLearned and takes no treat
  const l = E.create(4, at(2026, 11, 12, 10), 'Koxa'); happy(l); l.bond = 100; l.lvl = 1; l.pamlsky = 10; l.tricks.sedni = { progress: 5, learned: l.t, shown: 0 };
  const lt = E.act(l, 'train', { trick: 'sedni', cue: 'swipeUp', treatAt: l.t + 500 }, l.t).events;
  ok(lt.some(e => e.type === 'trickLearned' && e.trick === 'sedni') && !lt.some(e => e.type === 'perform' || e.type === 'treat') && l.pamlsky === 10, 'training a learned trick: trickLearned, no pamlsek used');
  // presents in the accusative
  ok(E.PRESENTS.cone.acc === 'šišku' && E.PRESENTS.feather.acc === 'pírko' && E.PRESENTS.leaf.acc === 'lísteček', 'presents: Přinesla ti šišku / pírko / lísteček');
}

/* ---------- 20. Phase 5: neighbour cats and the album ---------- */
section('Visitors');
{
  // 20 days of hourly ticks with care: who comes, when, for how long
  function visits(seed, setup) {
    const t0 = at(2026, 6, 1, 7), st = E.create(seed, t0, 'Koxa'); if (setup) setup(st);
    const list = []; let open = null, nightOthers = 0;
    for (let t = t0 + H; t <= t0 + 20 * D; t += H) {
      for (const e of E.advance(st, t).events) {
        if (e.type === 'visitor') { open = { id: e.id, at: t, reaction: e.reaction }; if (E.dayPhase(t - 30 * MIN) === 'night' && e.id !== 'bivoj') nightOthers++; }
        if (e.type === 'visitorLeave') { if (open) list.push(Object.assign(open, { min: (t - open.at) / MIN })); open = null; }
      }
      if ([8, 20].includes(new Date(t).getHours())) basicCare(st, t);
    }
    return { st, list, nightOthers };
  }
  const a = visits(60), b = visits(60);
  ok(JSON.stringify(a.st) === JSON.stringify(b.st), 'deterministic');
  let total = 0, withBowl = 0, longest = 0, nightOthers = 0;
  const ids = new Set();
  for (let s = 60; s < 70; s++) {
    const r = visits(s); total += r.list.length; nightOthers += r.nightOthers;
    for (const v of r.list) { ids.add(v.id); longest = Math.max(longest, v.min); }
    withBowl += visits(s, st => { st.owned.visitorBowl = true; st.furniture.visitorBowl = { room: 'garden', x: 0.5, y: 0.8 }; }).list.length;
  }
  console.log(`  20 days × 10 cats: ${total} visits, ${withBowl} with the miska pro návštěvy, longest ${longest} min, ${ids.size} different cats`);
  ok(total >= 50 && withBowl > total * 1.5, 'visits are regular and the bowl brings more');
  ok(longest <= 150, `a visit never stays long (${longest} min at most)`);
  ok(nightOthers === 0, 'only Bivoj comes at night');
  ok(ids.size === 8, 'all eight neighbour cats come over');
  const lg = E.create(61, at(2026, 6, 1, 10), 'Koxa'); lg.visit = { id: 'liza', since: lg.t, until: lg.t + H, gain: 0 };
  E.advance(lg, lg.t + 10 * D); ok(!lg.visit || lg.visit.since >= lg.t - 3 * H, 'a long absence leaves no visitor behind');
  // Koxa's reactions
  const t0 = at(2026, 6, 10, 10);
  const with_ = (id, friend) => { const s = E.create(62, t0, 'Koxa'); if (friend != null) s.visitors[id] = { friend, met: t0, visits: 1, fed: 0 }; s.visit = { id, since: t0, until: t0 + H, gain: 0 }; return s; };
  const base = E.moodValue(E.create(62, t0, 'Koxa'));
  ok(E.moodValue(with_('bivoj')) === base - 10 && E.moodValue(with_('bivoj', 3)) === base + 5, 'Bivoj: she hisses (mood −10) until 3 hearts, then they are friends (+5)');
  ok(E.moodValue(with_('rambo', 1)) === base - 10 && E.moodValue(with_('rambo', 2)) === base, 'Rambo: hissing until 2 hearts');
  const ci = with_('ciperka'); ci.needs.fun = 20; E.advance(ci, t0 + 30 * MIN);
  ok(ci.needs.fun > 20 && E.moodValue(with_('ciperka')) === base + 5, 'Čiperka: they play (fun rises, mood +5)');
  ok(E.moodValue(with_('mourek')) === base, 'Mourek: she just watches');
  // feeding and stroking
  const p = with_('pacicka');
  ok(E.act(p, 'feedVisitor', { id: 'liza' }, t0).events[0].reason === 'Líza tu teď není.', 'an absent visitor: refused');
  ok(E.act(p, 'feedVisitor', { id: 'pacicka' }, t0).events.some(e => e.type === 'visitorFed') && p.visitors.pacicka.friend === 1 && p.visit.until === t0 + H + 30 * MIN, 'Pacička (greedy): food = a heart and a longer visit');
  ok(E.act(p, 'feedVisitor', { id: 'pacicka' }, t0).events[0].reason === 'Pacička už dnes dostala.', 'fed once a day');
  for (let i = 0; i < 20; i++) E.act(p, 'strokeVisitor', { id: 'pacicka' }, t0);
  ok(p.visitors.pacicka.friend === 2, `strokes: at most +1 heart a visit (${p.visitors.pacicka.friend})`);
  let fled = 0, hissed = 0;
  for (let s = 1; s <= 30; s++) {
    const l = E.create(s, t0, 'Koxa'); l.visit = { id: 'liza', since: t0, until: t0 + H, gain: 0 };
    if (E.act(l, 'strokeVisitor', { id: 'liza' }, t0).events.some(e => e.type === 'visitorLeave' && e.reason === 'shy')) fled++;
    const r = E.create(s, t0, 'Koxa'); r.visit = { id: 'rambo', since: t0, until: t0 + H, gain: 0 };
    if (E.act(r, 'strokeVisitor', { id: 'rambo' }, t0).events.some(e => e.type === 'visitorHiss')) hissed++;
  }
  ok(fled > 5 && fled < 30 && hissed > 5 && hissed < 30, `shy Líza runs off sometimes (${fled}/30), grumpy Rambo hisses sometimes (${hissed}/30)`);
  // friendship grows to 5 hearts over visits
  const fr = E.create(63, t0, 'Koxa'); let hearts = [];
  for (let d = 0; d < 10; d++) {
    const t = t0 + d * D; E.advance(fr, t); fr.visit = { id: 'sedivka', since: t, until: t + H, gain: 0 };
    E.act(fr, 'feedVisitor', { id: 'sedivka' }, t);
    for (const e of E.act(fr, 'strokeVisitor', { id: 'sedivka' }, t).events) if (e.type === 'visitorFriend') hearts.push(e.hearts);
  }
  ok(fr.visitors.sedivka.friend === 5 && hearts.includes(5), `Šedivka: 5 hearts after a few visits (${hearts.join(', ')})`);
  ok(E.act(fr, 'strokeVisitor', { id: 'tom' }, fr.t).events[0].type === 'refused', 'an unknown cat: refused');
  const c = clone(fr); E.repair(c); ok(JSON.stringify(c) === JSON.stringify(fr), 'a visitors state is canonical');
  const g = clone(fr); Object.assign(g, { visitors: { sedivka: { friend: 99 }, tom: { friend: 1 } }, visit: { id: 'liza', since: fr.t, until: fr.t + 30 * D } });
  E.repair(g); ok(g.visitors.sedivka.friend === 5 && !g.visitors.tom && g.visit === null, 'repair: friendship ≤ 5, unknown cats dropped, an endless visit dropped');
}
section('Album');
{
  const t0 = at(2026, 6, 10, 10), st = E.create(70, t0, 'Koxa');
  const r = E.act(st, 'photo', { pose: 'stretch', room: 'kitchen', note: '  První fotka  ' }, t0).events;
  const p = st.album[0];
  ok(r.some(e => e.type === 'photo' && e.n === 1) && p.t === t0 && p.pose === 'stretch' && p.room === 'kitchen' && p.note === 'První fotka' && p.mood === E.mood(st) && p.phase === 'day' && p.season === 'summer', 'a photo record: pose, room, mood, phase, season, note, date');
  for (let i = 1; i < 200; i++) E.act(st, 'photo', { pose: 'sit' }, t0 + i * 1000);
  const full = E.act(st, 'photo', {}, t0 + 300 * 1000).events[0];
  ok(st.album.length === 200 && full.type === 'refused' && /200/.test(full.reason), `at most 200 photos: "${full.reason}"`);
  ok(E.act(st, 'deletePhoto', { t: t0 }, t0 + 301 * 1000).events.some(e => e.type === 'photoDeleted') && st.album.length === 199 && E.act(st, 'photo', {}, t0 + 302 * 1000).events.some(e => e.type === 'photo'), 'delete one, then there is room again');
  ok(E.act(st, 'deletePhoto', { t: 1 }, st.t).events[0].type === 'refused', 'deleting a photo that is not there: refused');
  const o = friend(E.create(71, t0, 'Koxa')); E.act(o, 'letOut', null, t0);
  ok(E.act(o, 'photo', {}, t0).events[0].type === 'refused', 'no photo while she is out');
  st.postcards = [{ id: E.postcardAt(st.seed, 0), t: t0 }]; st.visitors = { liza: { friend: 2.5, met: t0, visits: 3, fed: 0 }, rambo: { friend: 0, met: 0, visits: 1, fed: 0 } };
  const al = E.album(st);
  ok(al.photos.length === 200 && al.photos[0].t > al.photos[199].t && al.postcards.length === 1 && al.visitors.length === 1 && al.visitors[0].name === 'Líza' && al.visitors[0].hearts === 2, 'album(st): photos newest first, postcards, only the cats met');
  const g = clone(st); g.album = [null, { t: 'x' }, { t: t0, room: 'moon', mood: 'ecstatic', pose: 5 }].concat(Array(300).fill({ t: t0 }));
  E.repair(g); ok(g.album.length === 200 && g.album[0].room === 'living' && g.album[0].mood === 'calm' && g.album[0].pose === 'sit', 'repair: broken photos fixed or dropped, at most 200');
  const c = clone(st); E.repair(c); ok(JSON.stringify(c) === JSON.stringify(st), 'an album state is canonical');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
