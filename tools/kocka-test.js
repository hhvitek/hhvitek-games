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
  // neighbour cats she already knows (Koxa's own hearts: a friend, a hissing Bivoj) and the visitors' bowl: more visits, joint acts
  st.visitors = { sedivka: { friend: 5, pal: 3.5, met: t0, visits: 2, fed: 0 }, bivoj: { friend: 4, pal: 0, met: t0, visits: 1, fed: 0 }, ciperka: { friend: 0, pal: 1, met: 0, visits: 1, fed: 0 } };
  st.owned.visitorBowl = true; st.furniture.visitorBowl = { room: 'garden', x: 0.5, y: 0.8 };
  let t = t0, events = [];
  const ARGS = {
    feed: () => pick(['kibble', 'pouch', 'chicken', 'tuna', null, 'stone', 42]),
    stroke: () => pick([null, { region: pick(Object.keys(E.REGIONS).concat('nose')), along: pick([true, false, 'sideways', 'x']), speed: pick([50, 300, 1200, 'good', NaN]) }]),
    scratch: () => ({ region: pick(Object.keys(E.REGIONS)), seconds: pick([1, 2, 0.5, -3, 99, NaN]) }),
    play: () => pick(Object.keys(E.TOYS).concat('stone', null)),
    vetCure: () => ({ won: r() < 0.5 }),
    putDown: () => pick(['window', 'bed', null, 'x'.repeat(50)]),
    feedVisitor: () => ({ id: st.visit && r() < 0.7 ? st.visit.id : pick(['mourek', 'bivoj', 'sedivka', 'tom', null]) }),
    strokeVisitor: () => Object.assign({ id: st.visit && r() < 0.7 ? st.visit.id : pick(['mourek', 'bivoj', 'sedivka', 'tom', null]) },
      r() < 0.6 ? { region: pick(Object.keys(E.REGIONS).concat('nose', null)), along: pick([true, false, 'sideways', 'x']), speed: pick([50, 300, 700, 1200, 'good', 'fast', NaN]) } : {}),
    treatVisitor: () => ({ id: st.visit && r() < 0.7 ? st.visit.id : pick(['mourek', 'sedivka', 'tom', null]) }),
    playVisitor: () => ({ id: st.visit && r() < 0.7 ? st.visit.id : pick(['mourek', 'sedivka', 'tom', null]), caught: pick(['koxa', 'visitor', 'x', null]) }),
    invite: () => ({ id: st.visit && r() < 0.7 ? st.visit.id : pick(['sedivka', 'bivoj', 'tom', null]) }),
    photo: () => pick([null, {}, { room: pick(['garden', 'living', 'lap', 'moon']), pose: 'sit', vpose: pick(['sit', '', 'x'.repeat(30), 5]), vx: pick([0, 123.4, 999, -5, NaN, 'x']), vflip: pick([true, false, 'yes']), nokoxa: pick([true, false, 1]) }]),
    // teasing (SPEC §13): good and garbage pats; boop and splash take no argument
    pat: () => pick([null, 'x', { region: pick(Object.keys(E.REGIONS).concat('nose', 'v:liza:head', null, 7)), n: pick([1, 2, 3, 8, 14, 20, -5, 1.5, NaN, 1e6, '3']),
      ms: pick([0, 150, 500, 650, 6000, NaN, -1]), cv: pick([0, 0.1, 0.5, 5, NaN, 'x']), eating: pick([true, false, 1]) }]),
    boop: () => pick([null, {}, 'x']),
    splash: () => pick([null, {}, 7]),
  };
  const acts = E.ACTIONS.concat(['bogus', '', null]);
  let lvl = 0;
  while (t < t0 + days * D) {
    const k = r();
    t += (st.visit || st.guest) && k < 0.5 ? Math.floor(r() * 3 * MIN) : k < 0.6 ? Math.floor(r() * 30 * MIN) : k < 0.97 ? Math.floor(r() * 20 * H) : Math.floor(r() * 5 * D);   // with a visitor: often minutes
    if (r() < 0.02) t -= Math.floor(r() * 3 * H);            // the clock moved back
    let res;
    // now and then a neighbour cat comes over (made by hand, then repaired), so the visitor actions meet a visitor
    if (r() < 0.08 && !st.visit && !st.guest) { st.visit = { id: pick(['sedivka', 'sedivka', 'mourek', 'liza', 'rambo', 'ciperka']), since: st.t, until: st.t + 60 * MIN, gain: 0 }; E.repair(st); }
    if (st.visit && r() < 0.3) { const a = pick(['strokeVisitor', 'strokeVisitor', 'treatVisitor', 'playVisitor', 'invite', 'photo', 'feedVisitor']); res = E.act(st, a, ARGS[a](), t); }
    else if (r() < 0.05) {   // a run of pats (or nose taps, or the can) seconds apart: warnings, blowUps, sulks, crosses, paybacks
      const kind = pick(['pat', 'pat', 'pat', 'boop', 'splash']), region = pick(['back', 'tailBase', 'tail', 'head', 'belly', 'nose']);
      const ms = pick([150, 450, 600]), k = 2 + Math.floor(r() * 25), eating = r() < 0.1, all = [];
      if (kind === 'splash' && r() < 0.8) all.push(...E.act(st, 'goGarden', null, t).events);
      for (let i = 1; i <= k; i++) {
        t += kind === 'pat' ? ms : 5000;
        res = E.act(st, kind, kind === 'pat' ? { region, n: i, ms: i > 1 ? ms : 0, cv: pick([0, 0.1, 0.5]), eating } : null, t);
        all.push(...res.events);
      }
      if (r() < 0.6) { t += 3000; all.push(...E.act(st, pick(['stroke', 'stroke', 'scratch', 'treat', 'call', 'play', 'pickUp', 'lapOn']), pick([null, { region: 'back', along: true, speed: 300 }]), t).events); }
      if (r() < 0.5) for (let i = 0; i < 9; i++) { t += 10 * MIN; all.push(...E.advance(st, t).events); }   // the player watches her
      res = { st, events: all };
    }
    else if (r() < 0.15) res = E.advance(st, t);
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
{
  const seen = {};
  for (const j of results) for (const evs of JSON.parse(j).events) for (const e of evs) seen[e.type] = (seen[e.type] || 0) + 1;
  const need = ['pat', 'blowUp', 'trap', 'boop', 'swat', 'splash', 'sulk', 'cross', 'sulkEnd', 'crossEnd', 'reconcile', 'payback'];
  console.log(`  teasing in the fuzz: ${need.map(k => `${k} ${seen[k] || 0}`).join(', ')}`);
  ok(need.every(k => seen[k] > 0), `the random runs meet the teasing events (missing: ${need.filter(k => !seen[k]).join(', ')})`);
}

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
  // teasing (SPEC §13): the flop (8 regular pats at the tail base in her tempo), a nose tap, the can in the garden (a sulk,
  // made up by a stroke), two more splashes (a cross) and her payback back in the house
  for (let i = 0; i < 5 && !['happy', 'calm'].includes(E.mood(st)); i++) { tick(30 * MIN); careAt(st, t); E.act(st, 'play', T.toy, t); }
  const tempo = E.patTempo(st);
  for (let i = 1; i <= 8; i++) { t += tempo; E.act(st, 'pat', { region: 'tailBase', n: i, ms: i > 1 ? tempo : 0, cv: 0 }, t); }
  t += 5000; E.act(st, 'boop', null, t);
  E.act(st, 'goGarden', null, t); E.act(st, 'splash', null, t);
  t += 5000; E.act(st, 'stroke', { region: 'back', along: true, speed: 300 }, t);
  t += 5000; E.act(st, 'splash', null, t); t += 5000; E.act(st, 'splash', null, t);
  E.act(st, 'goHouse', null, t);
  for (let i = 0; i < 18 && !st.diary.payback; i++) tick(10 * MIN);
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
    const missing = list.filter(e => !e.found && !e.id.startsWith('pal') && !['sleepover', 'kittens', 'kitGrown'].includes(e.id)).map(e => e.id);   // pal*, sleepover, kittens: neighbour cats, see 'Visitors 2', 3 and 4
    ok(missing.length === 0, `seed ${seed} (${T.favFood}, ${T.spots}, ${T.fear}, ${T.quirk}, ${T.toy}): all found, missing ${missing.join(', ')}`);
    ok(list.every(e => typeof e.text === 'string' && e.text.length > 3 && !/undefined|NaN/.test(e.text)), `seed ${seed}: entry texts`);
    if (!missing.length) { seen.favFood.add(T.favFood); seen.fear.add(T.fear); seen.quirk.add(T.quirk); seen.toy.add(T.toy); T.spots.forEach(s => seen.spot.add(s)); }
    invariants(st, 'diary');
  }
  ok(full(), `every trait value reached (${tested} cats)`);
  const st = E.create(1, at(2026, 11, 12, 15), 'Koxa');
  const d = E.diary(st, 'Micka');
  ok(d.length === 21 && d.find(e => e.id === 'birthday').found && d.find(e => e.id === 'birthday').text === 'Micka k nám přišla 12. 11. 2026.', 'the list: 21 entries, the name from the argument, the birthday found at once');
  ok(d.map(e => e.id).slice(9, 15).join() === 'birthday,bliss,boop,reconcile,splash,payback' &&
    d.filter(e => ['bliss', 'boop', 'reconcile', 'splash', 'payback'].includes(e.id)).every(e => !e.found && (e.text.endsWith('?') || e.text.endsWith('…'))),
    'the five teasing entries follow the birthday; not found yet: a question or a neutral hint');
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
  // a crop on a bed that is not open yet (a broken save: beds 5–6 below Parťačka) is dropped, the open beds keep theirs
  const hb = clone(bp); hb.bond = 300; hb.lvl = 2; hb.beds[1] = clone(hb.beds[5]); hb.beds[4] = clone(hb.beds[5]);
  E.repair(hb);
  ok(E.bedCount(hb) === 4 && hb.beds.length === 6 && hb.beds[4] === null && hb.beds[5] === null && hb.beds[1] && hb.beds[1].crop === 'radish',
    'repair: crops on beds not open yet are dropped, the open ones kept');
  const hb2 = clone(hb); E.repair(hb2); ok(JSON.stringify(hb2) === JSON.stringify(hb), 'repair of the hidden beds is idempotent');
  const bp2 = clone(bp); E.repair(bp2); ok(JSON.stringify(bp2) === JSON.stringify(bp) && bp2.beds[5] && bp2.beds[5].crop === 'radish', 'repair keeps the crop on bed 6 at Parťačka');
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
  // Phase A: they play only together in the garden (chase, wrestle), no longer through the window
  let more = 0, less = 0;
  for (let s = 1; s <= 20; s++) {
    const mk = vis => { const x = E.create(s, t0, 'Koxa'); x.needs.fun = 20; x.yard = { since: t0, snow: false, tree: null }; if (vis) x.visit = { id: 'ciperka', since: t0, until: t0 + 2 * H, gain: 0 }; return x; };
    const a = mk(true), b = mk(false);
    for (let k = 1; k <= 9; k++) { E.advance(a, t0 + k * 10 * MIN); E.advance(b, t0 + k * 10 * MIN); }
    if (a.needs.fun > b.needs.fun + 1e-9) more++; else if (a.needs.fun < b.needs.fun - 1e-9) less++;
  }
  ok(more >= 14 && less === 0 && E.moodValue(with_('ciperka')) === base + 5, `Čiperka: they play in the garden (more fun in ${more}/20, less in ${less}), mood +5 while she only watches`);
  ok(E.moodValue(with_('mourek')) === base, 'Mourek: she just watches');
  // feeding and stroking
  const p = with_('pacicka');
  ok(E.act(p, 'feedVisitor', { id: 'liza' }, t0).events[0].reason === 'Líza tu teď není.', 'an absent visitor: refused');
  ok(E.act(p, 'feedVisitor', { id: 'pacicka' }, t0).events.some(e => e.type === 'visitorFed') && p.visitors.pacicka.friend === 1 && p.visit.until === t0 + H + 30 * MIN, 'Pacička (greedy): food = a heart and a longer visit');
  ok(E.act(p, 'feedVisitor', { id: 'pacicka' }, t0).events[0].reason === 'Pacička už dnes dostala.', 'fed once a day');
  for (let i = 0; i < 20; i++) E.act(p, 'strokeVisitor', { id: 'pacicka' }, t0 + i * MIN);   // one stroke a minute counts (Phase B)
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
  st.postcards = [{ id: E.postcardAt(st.seed, 0), t: t0 }]; st.visitors = { liza: { friend: 2.5, pal: 1, met: t0, visits: 3, fed: 0 }, rambo: { friend: 0, pal: 0, met: 0, visits: 1, fed: 0 } };
  const al = E.album(st);
  ok(al.photos.length === 200 && al.photos[0].t > al.photos[199].t && al.postcards.length === 1 && al.visitors.length === 1 && al.visitors[0].name === 'Líza' && al.visitors[0].hearts === 2 && al.visitors[0].pal === 1, 'album(st): photos newest first, postcards, only the cats met');
  const g = clone(st); g.album = [null, { t: 'x' }, { t: t0, room: 'moon', mood: 'ecstatic', pose: 5 }].concat(Array(300).fill({ t: t0 }));
  E.repair(g); ok(g.album.length === 200 && g.album[0].room === 'living' && g.album[0].mood === 'calm' && g.album[0].pose === 'sit', 'repair: broken photos fixed or dropped, at most 200');
  const c = clone(st); E.repair(c); ok(JSON.stringify(c) === JSON.stringify(st), 'an album state is canonical');
}

/* ---------- 21. Phase A: Koxa and the visiting cat do things together ---------- */
section('Visitors 2');
{
  const ACTS = Object.keys(E.VISIT_ACTS), JOINT = ACTS.filter(k => E.VISIT_ACTS[k].joint);
  const rec = (friend, pal) => ({ friend, pal, met: 0, visits: 1, fed: 0 });
  // a visit forced at 10:00 with Koxa in the garden, watched in 10-minute steps; a rainy day is moved on (rain ends visits)
  function gardenVisit(st, id, t, minutes, each) {
    while (E.weather(t, st) === 'rain') t += D;
    E.advance(st, t); basicCare(st, t); st.needs.energy = 90;
    st.yard = { since: t, snow: false, tree: null };
    st.visit = { id, since: t, until: t + minutes * MIN, gain: 0, palGain: 0, greeted: false, act: { kind: 'arrive', since: t, with: null } };
    const acts = [], events = [], pal0 = st.visitors[id] ? st.visitors[id].pal : 0, love0 = st.needs.love;
    for (let k = 1; k * 10 < minutes && st.visit; k++) {
      const ev = E.advance(st, t + k * 10 * MIN).events;
      for (const e of ev) { events.push(e); if (e.type === 'visitAct') acts.push(e); }
      if (each) each(st, t + k * 10 * MIN);
    }
    if (st.yard) E.act(st, 'goHouse', null, st.t);
    return { acts, events, pal0, love0, t };
  }
  // the programme is seeded: a save and reload in the middle of a visit changes nothing, and another seed gives other acts
  const run = (seed, reloadAfter) => {
    const st = E.create(seed, at(2026, 6, 10, 9), 'Koxa'); st.visitors.ciperka = rec(1, 1);
    let k = 0;
    const r = gardenVisit(st, 'ciperka', at(2026, 6, 10, 10), 90, s => {
      if (++k !== reloadAfter) return;
      const c = clone(s); E.repair(c); Object.keys(s).forEach(key => delete s[key]); Object.assign(s, c);   // the saved state, read again
    });
    return JSON.stringify([st, r.acts]);
  };
  ok(run(80) === run(80, 3) && run(80) === run(80, 5), 'a save and reload in the middle of a visit: the same acts and the same state');
  ok([81, 82, 83, 84].some(s => JSON.parse(run(s))[1].map(a => a.kind).join() !== JSON.parse(run(80))[1].map(a => a.kind).join()), 'another seed: other acts');
  ok(JSON.parse(run(80))[1].length >= 3, 'a visit in the garden has a programme of several acts');
  { // the programme draws nothing from st.n and changes no needs while Koxa is not with the visitor (indoors)
    const indoor = (id, kind, pal) => {
      const t = at(2026, 6, 10, 10), st = E.create(81, t - H, 'Koxa'); E.advance(st, t); basicCare(st, t); st.visitors[id] = rec(pal, pal);
      const n0 = st.n;
      st.visit = { id, since: t, until: t + 80 * MIN, gain: 0, palGain: 0, greeted: false, act: { kind, since: t, with: null } };
      const acts = [];
      for (let k = 1; k <= 6; k++) E.advance(st, t + k * 10 * MIN).events.forEach(e => { if (e.type === 'visitAct') acts.push(e.kind); });
      return { n: st.n - n0, needs: JSON.stringify(st.needs), acts: acts.join() };
    };
    const a = indoor('mourek', 'arrive', 0), b = indoor('fousek', 'nap', 3);
    ok(a.acts !== b.acts && a.n === b.n && a.needs === b.needs, `indoors: other acts (${a.acts} / ${b.acts}), the same random draws (${a.n}) and needs`);
    // in the garden: the joint acts change her needs, never the random sequence
    const garden = (id, pal) => { const st = E.create(81, at(2026, 6, 10, 9), 'Koxa'); st.visitors[id] = rec(pal, pal); const n0 = st.n; const r = gardenVisit(st, id, at(2026, 6, 10, 10), 60); return { n: st.n - n0, acts: r.acts.map(a => a.kind).join() }; };
    const g = garden('ciperka', 1), h = garden('mourek', 0);
    ok(g.acts !== h.acts && g.n === h.n, `in the garden: other acts (${g.acts} / ${h.acts}), the same random draws (${g.n})`);
  }
  // the step does not matter: 10-minute steps, 30 s steps and stroking her every 200 ms give the same acts
  function stepped(seed, id, pal, ms, stroke) {
    const st = E.create(seed, at(2026, 6, 10, 9), 'Koxa'); st.visitors[id] = rec(pal, pal);
    let t = at(2026, 6, 10, 10); while (E.weather(t, st) === 'rain') t += D;
    E.advance(st, t); basicCare(st, t); st.needs.energy = 90; st.yard = { since: t, snow: false, tree: null };
    st.visit = { id, since: t, until: t + 60 * MIN, gain: 0, palGain: 0, greeted: false, act: { kind: 'arrive', since: t, with: null } };
    const acts = [], when = [];
    let tree = false;
    for (let x = t + ms; st.visit; x += ms) {
      const ev = stroke ? E.act(st, 'stroke', { region: 'back', speed: 500 }, x).events : E.advance(st, x).events;
      for (const e of ev) { if (e.type === 'visitAct') { acts.push(e.kind + (e.with ? '+' : '')); when.push(x); } if (e.type === 'climbStuck') tree = true; }
    }
    return { acts, when, tree };
  }
  let same = 0, cmp = 0, gapBad = 0, perSec = 0;
  for (const [seed, id, pal] of [[1, 'ciperka', 1], [2, 'sedivka', 3], [3, 'mourek', 3], [4, 'bivoj', 0], [5, 'fousek', 4], [6, 'ciperka', 3], [7, 'rambo', 1], [8, 'liza', 3], [9, 'pacicka', 3], [10, 'bivoj', 4], [11, 'ciperka', 0], [12, 'sedivka', 4], [13, 'mourek', 1], [14, 'fousek', 3]]) {
    const a = stepped(seed, id, pal, 10 * MIN), b = stepped(seed, id, pal, 30000), c = stepped(seed, id, pal, 200, true);
    if (a.tree || b.tree || c.tree) continue;   // up the tree at another moment: the garden's own randomness, not the programme
    cmp++;
    if (a.acts.join() === b.acts.join() && b.acts.join() === c.acts.join()) same++;
    else console.log(`    ${seed} ${id}: ${a.acts.join()} | ${b.acts.join()} | ${c.acts.join()}`);
    // stroking every 200 ms: never two acts in a second, and after the greeting every act lasts at least its minimum
    for (let i = 1; i < c.when.length; i++) {
      if (c.when[i] - c.when[i - 1] < 1000) perSec++;
      const prev = c.acts[i - 1].replace('+', '');
      if (c.acts.slice(0, i).some(k => k.endsWith('+')) && c.when[i] - c.when[i - 1] < E.VISIT_ACTS[prev].min * MIN - 200) gapBad++;
    }
  }
  ok(cmp >= 8 && same === cmp, `10 min, 30 s and 200 ms steps give the same acts (${same}/${cmp})`);
  ok(perSec === 0 && gapBad === 0, `stroking every 200 ms: never two acts in a second (${perSec}), every act lasts its minimum (${gapBad} shorter)`);
  { // a visit that comes by itself, watched: 'visitor' then visitAct 'arrive' on the fence; visitAct only while watching
    const st = E.create(94, at(2026, 6, 1, 9), 'Koxa'); let arrivals = 0, arriveOk = 0, actsAway = 0;
    for (let t = st.t + 30 * MIN; t <= at(2026, 6, 15, 9); t += 30 * MIN) {
      const ev = E.advance(st, t).events;
      ev.forEach((e, i) => { if (e.type === 'visitor') { arrivals++; const n = ev[i + 1]; if (n && n.type === 'visitAct' && n.kind === 'arrive' && n.with === null && n.id === e.id) arriveOk++; } });
      if (new Date(t).getHours() === 20 && new Date(t).getMinutes() === 0) basicCare(st, t);
    }
    const away = E.create(94, at(2026, 6, 1, 9), 'Koxa');
    for (let t = away.t + 5 * H; t <= at(2026, 6, 15, 9); t += 5 * H) actsAway += E.advance(away, t).events.filter(e => e.type === 'visitAct').length;
    ok(arrivals > 5 && arriveOk === arrivals && actsAway === 0, `arrival: visitor + visitAct arrive (${arriveOk}/${arrivals}); none while nobody watches (${actsAway})`);
  }
  // the first joint act is greet, or standoff for a hissing pair; standoff only Bivoj < 3 hearts and Rambo < 2;
  // groom and snuggle only from 3 hearts; at most +½ heart a visit
  let firstOk = 0, firstN = 0, badStand = 0, badGroom = 0, badGain = 0, stand = 0, groom = 0, snug = 0, chase = 0, seen = new Set();
  for (let s = 1; s <= 12; s++) for (const id of Object.keys(E.VISITORS)) for (const p of [0, 1, 2, 3, 4.5]) {
    const st = E.create(s, at(2026, 6, 1 + s, 9), 'Koxa'); st.visitors[id] = rec(p, p);
    const r = gardenVisit(st, id, at(2026, 6, 1 + s, 10), 90);
    const joint = r.acts.filter(a => a.with === 'koxa');
    r.acts.forEach(a => seen.add(a.kind));
    const hissing = (id === 'bivoj' && p < 3) || (id === 'rambo' && p < 2);
    if (joint.length) { firstN++; if (joint[0].kind === (hissing ? 'standoff' : 'greet')) firstOk++; }
    for (const a of joint) {
      if (a.kind === 'standoff') { stand++; if (!hissing) badStand++; }
      if (a.kind === 'groom' || a.kind === 'snuggle') { a.kind === 'groom' ? groom++ : snug++; if (p < 3) badGroom++; }
      if (a.kind === 'chase' || a.kind === 'wrestle') chase++;
      if (a.id !== id || !E.VISIT_ACTS[a.kind].joint) badStand++;
    }
    if (hissing && joint.length > 1) badStand++;   // after a standoff they keep apart for the rest of the visit
    if (st.visitors[id].pal - r.pal0 > 0.5 + 1e-9 || st.visitors[id].pal < r.pal0) badGain++;
  }
  console.log(`  ${firstN} visits with joint acts: ${stand} standoffs, ${chase} chases/wrestles, ${groom} groomings, ${snug} snuggles`);
  ok(firstN > 300 && firstOk === firstN, `the first joint act is greet (standoff for a hissing pair): ${firstOk}/${firstN}`);
  ok(badStand === 0 && stand > 10, 'standoff only Bivoj < 3 hearts and Rambo < 2, once a visit, then they keep apart');
  ok(badGroom === 0 && groom > 10 && snug > 10 && chase > 20, 'groom and snuggle only from 3 hearts');
  ok(badGain === 0, 'Koxa gains at most ½ heart a visit and never loses one');
  ok(ACTS.every(k => seen.has(k) || k === 'bowl' || k === 'arrive' || E.VISIT_ACTS[k].kits), `every act occurs (missing: ${ACTS.filter(k => !seen.has(k)).join(', ')})`);   // kittens: 'Visitors 4'
  const bw = E.create(82, at(2026, 6, 10, 9), 'Koxa'); bw.owned.visitorBowl = true; bw.furniture.visitorBowl = { room: 'garden', x: 0.5, y: 0.8 };
  let bowl = 0; for (let d = 0; d < 6; d++) bowl += gardenVisit(bw, 'pacicka', at(2026, 6, 10 + d, 10), 90).acts.filter(a => a.kind === 'bowl').length;
  ok(bowl > 0, `greedy Pacička goes to the miska pro návštěvy (${bowl}×)`);
  const wi = E.create(83, at(2027, 1, 10, 9), 'Koxa'); let drinkW = 0;
  for (let d = 0; d < 8; d++) drinkW += gardenVisit(wi, 'mourek', at(2027, 1, 10 + d, 10), 90).acts.filter(a => a.kind === 'drink').length;
  ok(drinkW === 0, 'no drinking from the frozen pond in winter');
  // Šedivka (old, she) every day: Koxa's hearts grow to 3+, the diary entries appear with her name
  const fr = E.create(84, at(2026, 6, 1, 9), 'Koxa'); const ups = [];
  let day = at(2026, 6, 1, 10);
  for (let d = 0; d < 40 && !(fr.diary.palGroom && fr.diary.palSnuggle); d++) {
    const r = gardenVisit(fr, 'sedivka', day, 90); day = r.t + D;
    r.events.forEach(e => { if (e.type === 'palUp') ups.push(e.pal); });
    invariants(fr, `Šedivka day ${d}`);
  }
  ok(fr.visitors.sedivka.pal >= 3 && ups.join() === '1,2,3' + (fr.visitors.sedivka.pal >= 4 ? ',4' : '') + (fr.visitors.sedivka.pal >= 5 ? ',5' : ''), `pal grows over the visits (${fr.visitors.sedivka.pal}, palUp ${ups.join(',')})`);
  ok(fr.visitors.sedivka.friend === 0, "Koxa's hearts are her own: the player's stay 0");
  const dl = E.diary(fr), txt = id => dl.find(e => e.id === id).text;
  ok(fr.diaryCat.palFirst === 'sedivka' && txt('palFirst') === 'Koxa má první kamarádku: Šedivka.', `palFirst: "${txt('palFirst')}"`);
  ok(txt('palGroom') === 'Koxa a Šedivka si poprvé navzájem umyly kožíšky.' && txt('palSnuggle') === 'Koxa a Šedivka si poprvé zdřímly schoulené u sebe.', `palGroom / palSnuggle: "${txt('palGroom')}" / "${txt('palSnuggle')}"`);
  const mo = clone(fr); mo.diaryCat = { palFirst: 'mourek', palGroom: 'bivoj', palSnuggle: 'fousek' }; E.repair(mo);
  ok(E.diary(mo, 'Micka').find(e => e.id === 'palFirst').text === 'Micka má prvního kamaráda: Mourek.' && E.diary(mo).find(e => e.id === 'palSnuggle').text === 'Koxa a Fousek si poprvé zdřímli schoulení u sebe.' && E.diary(mo).find(e => e.id === 'palGroom').text === 'Koxa a Bivoj si poprvé navzájem umyli kožíšky.', 'he: kamaráda, zdřímli schoulení, umyli');
  const fresh = E.diary(E.create(85, at(2026, 6, 1), 'Koxa')).filter(e => e.id.startsWith('pal'));
  ok(fresh.length === 3 && fresh.every(e => !e.found && e.text.length > 10), 'not found yet: a hint');
  // Bivoj: Koxa hisses, but when the player befriends him in the garden she gets used to him
  const bv = E.create(86, at(2026, 6, 1, 9), 'Koxa'); let bday = at(2026, 6, 1, 10), standoffs = 0, greets = 0;
  for (let d = 0; d < 12; d++) {
    const r = gardenVisit(bv, 'bivoj', bday, 60, (s, t) => { if (s.visit) E.act(s, 'strokeVisitor', { id: 'bivoj' }, t); }); bday = r.t + D;
    standoffs += r.acts.filter(a => a.kind === 'standoff').length; greets += r.acts.filter(a => a.kind === 'greet').length;
  }
  ok(standoffs > 0 && bv.visitors.bivoj.pal >= 3 && greets > 0, `Bivoj: standoffs (${standoffs}) until Koxa has 3 hearts (${bv.visitors.bivoj.pal}), then greetings (${greets})`);
  // a standoff is mild: a little love and mood, nothing more
  const so = E.create(87, at(2026, 6, 10, 9), 'Koxa'); let low = 100, mvLow = 100;
  const sr = gardenVisit(so, 'rambo', at(2026, 6, 10, 10), 60, s => { low = Math.min(low, s.needs.love); mvLow = Math.min(mvLow, E.moodValue(s)); });
  const love0 = sr.love0;   // before the visit, so the first 10 minutes count too
  ok(sr.acts.some(a => a.kind === 'standoff') && love0 - low <= 6 && mvLow > 30, `a standoff with Rambo: love −${Math.round((love0 - low) * 10) / 10} at most, mood ${mvLow} at worst`);
  // an old save: Koxa takes over the player's hearts; the reaction is Koxa's own now
  const old = E.create(88, at(2026, 6, 10, 10), 'Koxa'); old.visitors = { bivoj: { friend: 3.5, met: old.t, visits: 4, fed: 0 }, rambo: { friend: 1, met: old.t, visits: 2, fed: 0 } };
  old.visit = { id: 'bivoj', since: old.t, until: old.t + H, gain: 0.5 };
  E.repair(old);
  ok(old.visitors.bivoj.pal === 3.5 && old.visitors.rambo.pal === 1 && old.visit.act.kind === 'wander' && old.visit.act.with === null && old.visit.palGain === 0 && old.visit.greeted === false, 'a save without pal: pal = friend, the visit gets a solo act');
  { // an old save with the player's 5 hearts (= Koxa's): the first friend is found, and before grooming or snuggling
    let found = 0, order = 0, n = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const os = E.create(seed, at(2026, 6, 10, 9), 'Koxa'); os.visitors = { sedivka: { friend: 5, met: os.t, visits: 6, fed: 0 } }; E.repair(os);
      gardenVisit(os, 'sedivka', at(2026, 6, 10, 10), 90);
      if (!Object.keys(os.diary).some(k => k.startsWith('pal'))) continue;
      n++; if (os.diary.palFirst && os.diaryCat.palFirst === 'sedivka') found++;
      if (['palGroom', 'palSnuggle'].every(k => !os.diary[k] || os.diary[k] >= os.diary.palFirst)) order++;
    }
    ok(n >= 4 && found === n && order === n, `old save, 5 hearts: palFirst found (${found}/${n}), never after palGroom / palSnuggle (${order}/${n})`);
  }
  const vb = E.create(89, at(2026, 6, 10, 10), 'Koxa'); vb.visitors.bivoj = rec(5, 0); vb.visit = { id: 'bivoj', since: vb.t, until: vb.t + H, gain: 0, palGain: 0, greeted: false, act: { kind: 'arrive', since: vb.t, with: null } };
  const base = E.moodValue(E.create(89, at(2026, 6, 10, 10), 'Koxa'));
  ok(E.moodValue(vb) === base - 10, "Bivoj, the player's best friend: Koxa still hisses (pal 0)");
  vb.visit.act = { kind: 'greet', since: vb.t, with: 'koxa' }; vb.visitors.mourek = rec(0, 3);
  ok(E.moodValue(vb) === base + 5, 'mood from the joint act (greet +5) instead of the reaction');
  const al = E.album(Object.assign(clone(vb), { visitors: { liza: { friend: 1.5, pal: 3.75, met: vb.t, visits: 2, fed: 0 } } }));
  ok(al.visitors[0].hearts === 1 && al.visitors[0].pal === 3, 'album: hearts (player) and pal (Koxa), whole hearts');
  // garbage: repaired, canonical
  const g = clone(fr); g.visitors.sedivka.pal = 'x'; g.visitors.mourek = { friend: 2, pal: 9 }; g.visitors.liza = { friend: 1, pal: 1.3 };
  g.visit = { id: 'mourek', since: g.t - 10 * MIN, until: g.t + H, gain: 0, palGain: 7, greeted: 'yes', act: { kind: 'dance', since: 'y', with: 'x' } };
  E.repair(g);
  ok(g.visitors.sedivka.pal === g.visitors.sedivka.friend && g.visitors.mourek.pal === 5 && g.visitors.liza.pal === 1.25, 'pal: a number 0–5 in quarters, else the player\'s hearts');
  ok(g.visit.palGain === 0.5 && g.visit.greeted === false && g.visit.act.kind === 'wander' && g.visit.act.with === null && g.visit.act.since === g.visit.since, 'a broken act: wander alone from the start of the visit');
  invariants(g, 'garbage visit');
  for (const bad of [{ kind: 'chase', with: null }, { kind: 'nap', with: 'koxa' }, { kind: 'greet', with: 'koxa', since: g.t + H }, null, 'greet', { kind: '__proto__', with: null }]) {
    const b = clone(g); b.visit.act = bad; E.repair(b); const A = b.visit.act;
    ok((A.with === 'koxa') === E.VISIT_ACTS[A.kind].joint && A.since >= b.visit.since && A.since <= b.t && (A.kind === 'wander' || (bad && bad.kind === A.kind)), `act ${JSON.stringify(bad)} repaired to ${JSON.stringify(A)}`);
    invariants(b, `act ${JSON.stringify(bad)}`);
  }
  const dc = clone(fr); dc.diaryCat = { palSnuggle: 'tom', palFirst: 'liza', extra: 'mourek', palGroom: 'sedivka' }; delete dc.diary.palGroom; E.repair(dc);
  ok(JSON.stringify(dc.diaryCat) === '{"palFirst":"liza","palSnuggle":"sedivka"}' || JSON.stringify(dc.diaryCat) === '{"palFirst":"liza"}', `diaryCat: known cats of found entries only (${JSON.stringify(dc.diaryCat)})`);
  invariants(dc, 'diaryCat garbage');
  // the clock moved back in the middle of a visit: every time moves along
  const cb = E.create(90, at(2026, 6, 10, 10), 'Koxa'); cb.yard = { since: cb.t, snow: false, tree: null };
  cb.visit = { id: 'ciperka', since: cb.t, until: cb.t + 90 * MIN, gain: 0, palGain: 0, greeted: false, act: { kind: 'arrive', since: cb.t, with: null } };
  for (let k = 1; k <= 3; k++) E.advance(cb, cb.t + 10 * MIN);
  const ab = cb.visit.act.since - cb.visit.since; E.advance(cb, cb.t - 2 * H);
  ok(cb.visit && cb.visit.act.since - cb.visit.since === ab && cb.visit.act.since <= cb.t, 'clock back: the act moves with the visit');
  invariants(cb, 'clock back in a visit');
  // 30 days with the garden twice a day: joint acts only while Koxa is in the garden (never indoors, out or up the tree)
  let bad = 0, joint = 0, checks = 0;
  for (const seed of [91, 92, 93]) {
    const st = E.create(seed, at(2026, 5, 1, 7), 'Koxa'); st.owned.visitorBowl = true; st.furniture.visitorBowl = { room: 'garden', x: 0.5, y: 0.8 };
    st.visitors = { ciperka: rec(1, 1), sedivka: rec(3, 3), mourek: rec(0, 0) };
    for (let t = st.t + 10 * MIN; t <= at(2026, 5, 31, 7); t += 10 * MIN) {
      const hr = new Date(t).getHours(), mi = new Date(t).getMinutes();
      E.advance(st, t);
      if ([8, 20].includes(hr) && mi === 0) basicCare(st, t);
      if ((hr === 10 || hr === 16) && mi === 0) E.act(st, 'goGarden', null, t);
      if ((hr === 12 || hr === 18) && mi === 0 && st.yard) { if (st.yard.tree) E.act(st, 'fetchDown', null, t); E.act(st, 'goHouse', null, t); }
      if (hr === 11 && mi === 0 && st.visit) E.act(st, 'strokeVisitor', { id: st.visit.id }, t);
      if (st.visit) {
        checks++;
        const A = st.visit.act;
        if (A.with === 'koxa') { joint++; if (!st.yard || st.out || st.yard.tree) bad++; }
        if ((A.with === 'koxa') !== E.VISIT_ACTS[A.kind].joint) bad++;
      }
      if (mi === 0 && hr % 6 === 0) invariants(st, `garden days seed ${seed}`);
    }
  }
  ok(bad === 0 && joint > 20, `joint acts only in the garden (${joint} of ${checks} visit steps together, ${bad} wrong)`);
}

/* ---------- 22. Phase B: the player and the visitor ---------- */
section('Visitors 3');
{
  const rec = (friend, pal) => ({ friend, pal, met: 0, visits: 1, fed: 0 });
  const types = ev => ev.map(e => e.type);
  // a cat visiting at time t (moved to a dry day), Koxa cared for and awake; garden: she is in the garden with the player
  function visiting(seed, id, friend, pal, t, garden) {
    const probe = E.create(seed, t, 'Koxa');
    while (E.weather(t, probe) === 'rain') t += D;
    const st = E.create(seed, t - H, 'Koxa');
    E.advance(st, t); basicCare(st, t); st.needs.energy = 90;
    st.visitors[id] = rec(friend, pal);
    st.visit = { id, since: t, until: t + 2 * H, gain: 0, palGain: 0, greeted: false, act: { kind: 'arrive', since: t, with: null } };
    if (garden) st.yard = { since: t, snow: false, tree: null };
    return { st, t };
  }
  const T0 = at(2026, 6, 10, 10);
  // liked, neutral and disliked spots
  {
    const { st, t } = visiting(100, 'sedivka', 0, 0, T0);
    let ev = E.act(st, 'strokeVisitor', { id: 'sedivka', region: 'back', along: true, speed: 300 }, t).events;
    ok(ev.some(e => e.type === 'visitorPurr' && e.region === 'back' && e.liked === true) && st.visitors.sedivka.friend === 1, `Šedivka loves the back: +¾ +¼ (${st.visitors.sedivka.friend})`);
    ev = E.act(st, 'strokeVisitor', { id: 'sedivka', region: 'paws', along: true, speed: 300 }, t + MIN).events;
    ok(ev.some(e => e.type === 'visitorDislike' && e.region === 'paws' && e.why === 'region' && e.away === false) && st.visitors.sedivka.friend === 1, 'Šedivka: paws disliked, no friendship');
    ev = E.act(st, 'strokeVisitor', { id: 'sedivka', region: 'back', along: false, speed: 300 }, t + 2 * MIN).events;
    ok(ev.some(e => e.type === 'visitorDislike' && e.why === 'against'), 'against the fur: disliked');
    ev = E.act(st, 'strokeVisitor', { id: 'sedivka', region: 'back', speed: 1500 }, t + 3 * MIN).events;
    ok(ev.some(e => e.type === 'visitorDislike' && e.why === 'fast'), 'too fast: disliked');
    ev = E.act(st, 'strokeVisitor', { id: 'sedivka', region: 'back', speed: 60 }, t + 4 * MIN).events;
    ok(!ev.some(e => /^visitor/.test(e.type)) && st.visitors.sedivka.friend === 1, 'too slow: it does not notice');
    ev = E.act(st, 'strokeVisitor', { id: 'sedivka', region: 'head', along: 'sideways', speed: 300 }, t + 5 * MIN).events;
    ok(ev.some(e => e.type === 'visitorPurr' && e.liked === false) && st.visitors.sedivka.friend === 1, 'neutral (sideways): purrs, but neutral strokes stop at +1 a visit');
    for (let k = 6; k < 20; k++) E.act(st, 'strokeVisitor', { id: 'sedivka', region: 'back', speed: 300 }, t + k * MIN);
    ok(st.visitors.sedivka.friend === 1.5 && st.visit.gain === 1.5, `liked strokes: at most +1½ a visit (${st.visitors.sedivka.friend})`);
    invariants(st, 'liked strokes');
    const n = visiting(100, 'mourek', 0, 0, T0).st;
    for (let k = 0; k < 10; k++) E.act(n, 'strokeVisitor', { id: 'mourek', region: 'back', speed: 300 }, n.t + k * MIN);
    ok(n.visitors.mourek.friend === 1, 'neutral strokes only: at most +1 a visit (as before)');
    const u = visiting(100, 'mourek', 0, 0, T0).st;
    ok(E.act(u, 'strokeVisitor', { id: 'mourek', region: 'whiskers', speed: 300 }, u.t).events.some(e => e.type === 'visitorPurr' && !('region' in e)) && u.visitors.mourek.friend === 0.5, 'an unknown region: like the menu\'s Pohladit');
    // the nose (Art's region, SPEC §13.2) counts as the head: Mourek likes the head
    const nz = visiting(100, 'mourek', 0, 0, T0).st;
    ok(E.act(nz, 'strokeVisitor', { id: 'mourek', region: 'nose', along: true, speed: 300 }, nz.t).events.some(e => e.type === 'visitorPurr' && e.region === 'head' && e.liked) && nz.visitors.mourek.friend === 0.75,
      'a visitor\'s nose counts as its head (liked by Mourek)');
    invariants(nz, 'visitor nose');
  }
  // the likes table
  {
    const all = Object.keys(E.REGIONS);
    let bad = 0;
    for (const id of Object.keys(E.VISITORS)) {
      const L = E.visitorLikes(id);
      if (!L || !L.likes.length || L.likes.some(r => !all.includes(r) || L.dislikes.includes(r)) || L.dislikes.some(r => !all.includes(r)) || !(L.text.length > 20 && L.text.includes(E.VISITORS[id].name))) bad++;
    }
    ok(bad === 0 && E.visitorLikes('liza').gentle && !E.visitorLikes('bivoj').gentle && E.visitorLikes('tom') === null, 'visitorLikes: known regions, a Czech help line with the name, Líza only gently');
    ok(E.visitorLikes('ciperka').dislikes.join() === 'tail' && E.visitorLikes('rambo').dislikes.includes('belly') && E.visitorLikes('pacicka').likes.includes('chin') && E.visitorLikes('mourek').likes.includes('head'), 'Čiperka anything but the tail, Rambo hates the belly, Pacička the chin, Mourek the head');
  }
  // shy Líza: head and chin, gently; fast or elsewhere she runs off under 2 hearts, else she moves away a bit
  {
    let r = visiting(101, 'liza', 0, 0, T0);
    let ev = E.act(r.st, 'strokeVisitor', { id: 'liza', region: 'head', speed: 300 }, r.t).events;
    ok(ev.some(e => e.type === 'visitorPurr' && e.liked) && r.st.visit, 'Líza: a gentle stroke on the head is liked');
    ev = E.act(r.st, 'strokeVisitor', { id: 'liza', region: 'head', speed: 700 }, r.t + MIN).events;
    ok(ev.some(e => e.type === 'visitorLeave' && e.reason === 'shy') && !r.st.visit, 'Líza: a quick stroke (700 px/s) makes her run off');
    r = visiting(101, 'liza', 1.75, 0, T0);
    ev = E.act(r.st, 'strokeVisitor', { id: 'liza', region: 'back', speed: 300 }, r.t).events;
    ok(ev.some(e => e.type === 'visitorLeave' && e.reason === 'shy'), 'Líza under 2 hearts: the back makes her run off');
    r = visiting(101, 'liza', 2, 0, T0);
    ev = E.act(r.st, 'strokeVisitor', { id: 'liza', region: 'back', speed: 300 }, r.t).events;
    ok(ev.some(e => e.type === 'visitorDislike' && e.away === true) && r.st.visit && r.st.visitors.liza.friend === 2, 'Líza with 2 hearts: she just moves away a bit');
    invariants(r.st, 'Líza');
  }
  // grumpy Rambo: the belly makes him swipe under 3 hearts (a quarter heart once a visit), later he just dislikes it
  {
    let r = visiting(102, 'rambo', 2.5, 0, T0), hiss = 0;
    for (let k = 0; k < 5; k++) hiss += E.act(r.st, 'strokeVisitor', { id: 'rambo', region: 'belly', speed: 300 }, r.t + k * 1000).events.filter(e => e.type === 'visitorHiss' && e.region === 'belly').length;
    ok(hiss === 5 && r.st.visitors.rambo.friend === 2.25, `Rambo: swipes at every belly stroke (${hiss}), −¼ heart once a visit (${r.st.visitors.rambo.friend})`);
    r = visiting(102, 'rambo', 3, 0, T0);
    ok(E.act(r.st, 'strokeVisitor', { id: 'rambo', region: 'belly', speed: 300 }, r.t).events.some(e => e.type === 'visitorDislike') && r.st.visitors.rambo.friend === 3, 'Rambo with 3 hearts: no swipe, he just does not like it');
    // a neutral spot under 2 hearts: half the minutes he swipes, the same answer within a minute
    let mixed = 0, swipes = 0, n = 0;
    for (let s = 1; s <= 30; s++) {
      const q = visiting(s, 'rambo', 1, 0, T0), out = [];
      for (let k = 0; k < 6; k++) out.push(E.act(q.st, 'strokeVisitor', { id: 'rambo', region: 'head', speed: 300 }, q.t + 10 * MIN + k * 5000).events.some(e => e.type === 'visitorHiss'));
      if (out.some(x => x !== out[0])) mixed++;
      n++; if (out[0]) swipes++;
    }
    ok(mixed === 0 && swipes > 5 && swipes < 25, `Rambo at a neutral spot: ${swipes}/${n} minutes he swipes, never mixed within a minute (${mixed})`);
  }
  // stroke farming: any number of strokes within a minute counts once
  {
    const a = visiting(103, 'mourek', 0, 0, T0).st, a0 = a.t;
    for (let x = 0; x < 60000; x += 200) E.act(a, 'strokeVisitor', { id: 'mourek', region: 'back', speed: 400 }, a0 + x);
    ok(a.visitors.mourek.friend === 0.5, `300 strokes within a minute: +½ only (${a.visitors.mourek.friend})`);
    const c = visiting(103, 'mourek', 0, 0, T0), d = visiting(103, 'mourek', 0, 0, T0);
    for (let x = 0; x < 3 * MIN; x += 200) E.act(c.st, 'strokeVisitor', { id: 'mourek', region: 'head', speed: 400 }, c.t + x);
    for (let k = 0; k < 3; k++) E.act(d.st, 'strokeVisitor', { id: 'mourek', region: 'head', speed: 400 }, d.t + k * MIN);
    ok(c.st.visitors.mourek.friend === d.st.visitors.mourek.friend && c.st.visitors.mourek.friend === 1.5, `strokes every 200 ms for 3 min = one a minute (${c.st.visitors.mourek.friend} / ${d.st.visitors.mourek.friend})`);
  }
  // a treat from the hand
  {
    const { st, t } = visiting(104, 'pacicka', 0, 0, T0);
    const p0 = st.pamlsky;
    let ev = E.act(st, 'treatVisitor', { id: 'pacicka' }, t).events;
    ok(ev.some(e => e.type === 'visitorTreat' && e.id === 'pacicka') && st.pamlsky === p0 - 1 && st.visitors.pacicka.friend === 1, 'treatVisitor: a pamlsek, greedy Pacička +1 heart');
    ok(E.act(st, 'treatVisitor', { id: 'pacicka' }, t + MIN).events[0].reason === 'Pacička už pamlsek dostala.' && st.pamlsky === p0 - 1, 'once a visit');
    ok(E.act(st, 'feedVisitor', { id: 'pacicka' }, t + MIN).events[0].reason === 'Pacička už dnes dostala.', 'a treat counts as fed today');
    const m = visiting(104, 'mourek', 0, 0, T0); m.st.pamlsky = 0;
    ok(E.act(m.st, 'treatVisitor', { id: 'mourek' }, m.t).events[0].reason === 'Nemáš žádné pamlsky.' && m.st.visitors.mourek.friend === 0 && m.st.pamlsky === 0, 'no pamlsky: refused');
    m.st.pamlsky = 3;
    ok(E.act(m.st, 'treatVisitor', { id: 'mourek' }, m.t).events.some(e => e.type === 'visitorTreat') && m.st.visitors.mourek.friend === 0.5 && E.act(m.st, 'treatVisitor', { id: 'mourek' }, m.t).events[0].reason === 'Mourek už pamlsek dostal.', 'Mourek +½, "už pamlsek dostal"');
    ok(E.act(m.st, 'treatVisitor', { id: 'liza' }, m.t).events[0].reason === 'Líza tu teď není.', 'an absent cat: refused');
    invariants(m.st, 'treat');
  }
  // the feather for two
  {
    const { st, t } = visiting(105, 'ciperka', 0, 0, T0, true);
    st.needs.fun = 50; const fun0 = st.needs.fun;
    let ev = E.act(st, 'playVisitor', { id: 'ciperka', caught: 'koxa' }, t).events;
    ok(ev.some(e => e.type === 'visitorPlay' && e.caught === 'koxa' && e.koxa === true) && st.visitors.ciperka.friend === 0.25 && st.visitors.ciperka.pal === 0.25 && st.needs.fun > fun0, 'playVisitor: +¼ heart, Koxa plays along (+¼ of hers, fun)');
    ev = E.act(st, 'playVisitor', { id: 'ciperka', caught: 'visitor' }, t + 30000).events;
    ok(ev[0].type === 'refused' && ev[0].reason === 'Čiperka si chvilku oddechne.' && st.visitors.ciperka.friend === 0.25, 'one game a minute');
    for (let k = 1; k <= 5; k++) E.act(st, 'playVisitor', { id: 'ciperka', caught: 'visitor' }, t + k * MIN);
    ok(st.visitors.ciperka.friend === 0.5 && st.visit.playGain === 0.5 && st.visitors.ciperka.pal <= 0.5, `at most +½ a visit from games (${st.visitors.ciperka.friend}, Koxa ${st.visitors.ciperka.pal})`);
    const i = visiting(105, 'ciperka', 0, 0, T0), f0 = i.st.needs.fun;
    ev = E.act(i.st, 'playVisitor', { id: 'ciperka', caught: 'koxa' }, i.t).events;
    ok(ev.some(e => e.type === 'visitorPlay' && e.caught === 'visitor' && e.koxa === false) && i.st.visitors.ciperka.pal === 0 && i.st.needs.fun <= f0, 'Koxa indoors: only the visitor plays (caught = visitor)');
    invariants(st, 'feather');
  }
  // jealousy
  {
    const jcat = (seed, lvl, garden = true, pal = 1.5) => { const r = visiting(seed, 'mourek', 0, pal, T0, garden); r.st.bond = [0, 100, 300][lvl]; r.st.lvl = lvl; return r; };
    // the twin is the same cat at the same moment, only further in the random stream (st.n), as other advance steps
    // would leave it: the answer must come from the moment, never from rnd(st)
    let jealous = 0, again = 0, drew = 0;
    for (let s = 1; s <= 200; s++) {
      const a = jcat(s, 1), b = clone(a.st); b.n = (b.n + 7919) >>> 0;
      const n0 = a.st.n;
      const ja = E.act(a.st, 'strokeVisitor', { id: 'mourek', region: 'head', speed: 300 }, a.t).events.some(e => e.type === 'jealous');
      const jb = E.act(b, 'strokeVisitor', { id: 'mourek', region: 'head', speed: 300 }, a.t).events.some(e => e.type === 'jealous');
      if (ja) jealous++; if (ja === jb) again++; if (a.st.n !== n0) drew++;
    }
    ok(jealous > 35 && jealous < 90 && again === 200 && drew === 0, `jealous after a stroke in ${jealous}/200 (about 30 %), the same whatever the random stream (${again}/200, drew ${drew})`);
    // the same moment reached in 5-second steps or in one jump: the same answer
    let stepSame = 0;
    for (let s = 1; s <= 12; s++) {
      const a = jcat(s, 1), b = clone(a.st), c = clone(a.st), t1 = a.t + 3 * MIN;
      E.advance(b, t1); for (let x = a.t + 5000; x <= t1; x += 5000) E.advance(c, x);
      const jb = E.act(b, 'strokeVisitor', { id: 'mourek', region: 'head', speed: 300 }, t1).events.some(e => e.type === 'jealous');
      const jc = E.act(c, 'strokeVisitor', { id: 'mourek', region: 'head', speed: 300 }, t1).events.some(e => e.type === 'jealous');
      if (jb === jc) stepSame++;
    }
    ok(stepSame === 12, `5-second steps or one jump to the same moment: the same jealousy (${stepSame}/12)`);
    let low = 0, indoor = 0;
    for (let s = 1; s <= 60; s++) {
      const a = jcat(s, 0); if (E.act(a.st, 'strokeVisitor', { id: 'mourek', region: 'head', speed: 300 }, a.t).events.some(e => e.type === 'jealous')) low++;
      const b = jcat(s, 2, false); if (E.act(b.st, 'treatVisitor', { id: 'mourek' }, b.t).events.some(e => e.type === 'jealous')) indoor++;
    }
    ok(low === 0 && indoor === 0, 'never below Známá, never when she does not see it (indoors)');
    // a stroke once a minute for an hour: jealous at most every 20 min; strokes on Koxa within 2 min make it right
    let tooOften = 0, starts = 0, oks = 0, ends = 0, okBad = 0;
    for (let s = 1; s <= 15; s++) {
      const r = jcat(s, 2, true, 0.5); r.st.needs.energy = 28; r.st.needs.love = 60;   // no tree climbing, no chasing: awake for the hour
      let last = -1e15, open = null;
      for (let k = 0; k < 60; k++) {
        const t = r.t + k * MIN, ev = E.act(r.st, 'strokeVisitor', { id: 'mourek', region: 'head', speed: 300 }, t).events;
        for (const e of ev) {
          if (e.type === 'jealous') { starts++; if (t - last < 20 * MIN) tooOften++; last = t; open = t; }
          if (e.type === 'jealousEnd') ends++;
        }
        if (open !== null && s % 2 === 0 && t - open === MIN) {   // even seeds: stroke Koxa a minute later
          const love = r.st.needs.love, e2 = E.act(r.st, 'stroke', { region: 'back', along: true, speed: 300 }, t + 1000).events;
          if (e2.some(e => e.type === 'jealousOk')) oks++; else okBad++;
          if (r.st.jealous || !(r.st.needs.love > love)) okBad++;
          open = null;
        }
        if (!r.st.visit) break;
      }
      invariants(r.st, `jealousy seed ${s}`);
    }
    ok(starts > 3 && tooOften === 0, `jealous ${starts}× in 15 hours of strokes, never twice within 20 min`);
    ok(oks > 0 && okBad === 0 && ends > 0, `stroking her makes it right (${oks}×), else it ends by itself (${ends}×)`);
    // the end without stroking: a mild dip (love −4), the same whatever the step
    let seed = 1, r0;
    for (; seed < 200; seed++) { r0 = jcat(seed, 1); r0.st.needs.energy = 28; if (E.act(r0.st, 'strokeVisitor', { id: 'mourek', region: 'head', speed: 300 }, r0.t).events.some(e => e.type === 'jealous')) break; }
    const twin = clone(r0.st); twin.jealous = null;
    const big = clone(r0.st), small = clone(r0.st), t1 = r0.t + 5 * MIN;
    const endsBig = E.advance(big, t1).events.filter(e => e.type === 'jealousEnd').length;
    let endsSmall = 0; for (let x = r0.t + 5000; x <= t1; x += 5000) endsSmall += E.advance(small, x).events.filter(e => e.type === 'jealousEnd').length;
    E.advance(twin, t1);
    const dip = twin.needs.love - big.needs.love;
    ok(endsBig === 1 && endsSmall === 1 && !big.jealous && Math.abs(big.needs.love - small.needs.love) < 1e-3 && Math.abs(dip - 4) < 1e-3 && E.mood(big) !== 'sad', `jealousEnd once whatever the step, love −${Math.round(dip * 100) / 100} (mild)`);
    // stroking Koxa after the 2 minutes is too late
    const late = clone(r0.st);
    ok(!E.act(late, 'stroke', { region: 'back', along: true, speed: 300 }, r0.t + 2 * MIN).events.some(e => e.type === 'jealousOk') && !late.jealous, 'after 2 minutes: too late, it ended');
    // asleep, let out, back in the house or up the tree she cannot be stroked for it: it passes, no event, no dip
    {
      const J = ev => ev.filter(e => /^jealous/.test(e.type)).length, t5 = r0.t + 5 * MIN;
      const calm = clone(r0.st); calm.jealous = null; calm.needs.energy = 24;
      const sl = clone(r0.st); sl.needs.energy = 24;   // too tired: she falls asleep at once
      const jS = J(E.advance(sl, t5).events); E.advance(calm, t5);
      ok(sl.asleep && sl.yard && !sl.jealous && jS === 0 && Math.abs(sl.needs.love - calm.needs.love) < 1e-6 && !E.health(sl).jealous, `jealous, then asleep: it passes without the dip (love ${Math.round(sl.needs.love * 100) / 100} = ${Math.round(calm.needs.love * 100) / 100})`);
      const sl5 = clone(r0.st); sl5.needs.energy = 24; let j5 = 0;
      for (let x = r0.t + 5000; x <= t5; x += 5000) j5 += J(E.advance(sl5, x).events);
      ok(j5 === 0 && !sl5.jealous && Math.abs(sl5.needs.love - sl.needs.love) < 1e-3, 'asleep: the same in 5-second steps');
      const lo = friend(clone(r0.st)), jl = J(E.act(lo, 'letOut', null, r0.t + 30000).events) + J(E.advance(lo, t5).events);
      const loT = friend(clone(r0.st)); loT.jealous = null; E.act(loT, 'letOut', null, r0.t + 30000); E.advance(loT, t5);
      ok(lo.out && !lo.jealous && jl === 0 && Math.abs(lo.needs.love - loT.needs.love) < 1e-6, 'jealous, then let out: it passes without the dip');
      const gh = clone(r0.st), jh = J(E.act(gh, 'goHouse', null, r0.t + 30000).events) + J(E.advance(gh, t5).events);
      const ghT = clone(r0.st); ghT.jealous = null; E.act(ghT, 'goHouse', null, r0.t + 30000); E.advance(ghT, t5);
      ok(!gh.yard && !gh.jealous && jh === 0 && Math.abs(gh.needs.love - ghT.needs.love) < 1e-6, 'jealous, then back in the house: it passes without the dip');
      const tr = clone(r0.st); tr.yard.tree = { since: r0.t, calls: 0 };
      ok(J(E.advance(tr, t5).events) === 0 && !tr.jealous, 'jealous, then up the tree: it passes without the dip');
      invariants(sl, 'jealous asleep'); invariants(lo, 'jealous let out');
    }
    // repair, clock back
    const g = clone(r0.st); g.jealous = { since: g.t + H, id: 'mourek' }; E.repair(g); ok(g.jealous === null, 'repair: jealousy in the future dropped');
    const g2 = clone(r0.st); g2.jealous = { since: g2.t - 10 * MIN, id: 'mourek' }; E.repair(g2); ok(g2.jealous === null, 'repair: stale jealousy dropped');
    const g3 = clone(r0.st); g3.jealous = { since: g3.t, id: 'tom' }; g3.jealousAt = 'x'; E.repair(g3); ok(g3.jealous === null && g3.jealousAt === 0, 'repair: an unknown cat, a broken time');
    const cb = clone(r0.st); E.advance(cb, cb.t - H);
    ok(cb.jealous && cb.jealous.since === cb.t && cb.jealousAt === cb.t, 'clock back: jealousy moves with it');
    invariants(cb, 'jealousy clock back');
    invariants(r0.st, 'jealous');
  }
  // invite in for the night
  {
    const EVE = at(2026, 6, 10, 19);
    const inv = (seed, id, friend, pal, t = EVE, garden = false) => visiting(seed, id, friend, pal, t, garden);
    const why = (r, id) => E.canInvite(r.st, id, r.t).reason;
    let r = inv(110, 'sedivka', 5, 3);
    ok(E.canInvite(r.st, 'sedivka', r.t).ok === true && E.canInvite(r.st, 'sedivka', r.t).reason === null, 'canInvite: ok');
    ok(why(inv(110, 'sedivka', 4.75, 3), 'sedivka') === 'Šedivka ještě není tak velká kamarádka.', 'friend < 5: "není tak velká kamarádka"');
    ok(why(inv(110, 'mourek', 4, 3), 'mourek') === 'Mourek ještě není tak velký kamarád.', 'he: "není tak velký kamarád"');
    ok(why(inv(110, 'sedivka', 5, 2.75), 'sedivka') === 'Koxa a Šedivka ještě nejsou kamarádky.' && why(inv(110, 'mourek', 5, 2), 'mourek') === 'Koxa a Mourek ještě nejsou kamarádi.', 'pal < 3: "nejsou kamarádky / kamarádi"');
    ok(why(inv(110, 'sedivka', 5, 3, at(2026, 6, 10, 15)), 'sedivka') === 'Pozvat na noc jde jen večer (od 18 do 22 h).', 'only in the evening');
    ok(why(r, 'mourek') === 'Mourek tu teď není.' && why(r, 'tom') === 'Takovou kočku neznáme.', 'only the cat visiting now');
    const o = inv(110, 'sedivka', 5, 3); friend(o.st); E.act(o.st, 'letOut', null, o.t);
    ok(why(o, 'sedivka') === 'Koxa je venku.' && E.act(o.st, 'invite', { id: 'sedivka' }, o.t).events[0].reason === 'Koxa je venku.', 'Koxa out: refused');
    const tr = inv(110, 'sedivka', 5, 3, EVE, true); tr.st.yard.tree = { since: tr.t, calls: 0 };
    ok(why(tr, 'sedivka') === 'Koxa je na stromě.' && E.act(tr.st, 'invite', { id: 'sedivka' }, tr.t).events[0].reason === 'Koxa je na stromě.', 'Koxa up the tree: refused');
    const before = JSON.stringify(r.st); E.canInvite(r.st, 'sedivka', r.t + 5 * MIN); ok(JSON.stringify(r.st) === before, 'canInvite changes nothing');
    // the invitation
    let ev = E.act(r.st, 'invite', { id: 'sedivka' }, r.t).events;
    const d0 = new Date(r.t), key0 = d0.getFullYear() * 10000 + (d0.getMonth() + 1) * 100 + d0.getDate();
    const until = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 1, 7).getTime(), MORNING = until + H;
    ok(ev.some(e => e.type === 'visitorLeave' && e.reason === 'inside' && e.id === 'sedivka') && ev.some(e => e.type === 'guestIn' && e.id === 'sedivka') && !r.st.visit &&
      r.st.guest && r.st.guest.id === 'sedivka' && r.st.guest.until === until && r.st.invDay === key0, 'invite: the visit ends ("inside"), the guest stays until 7:00');
    const found = ev.find(e => e.type === 'found' && e.id === 'sleepover');
    ok(found && found.text === 'Koxa měla poprvé návštěvu na noc: Šedivka.' && r.st.diaryCat.sleepover === 'sedivka' && E.diary(r.st).find(e => e.id === 'sleepover').text === found.text, `diary: "${found && found.text}"`);
    ok(why(r, 'sedivka') === 'Šedivka už u nás na noc je.', 'already a guest');
    ok(E.act(r.st, 'treatVisitor', { id: 'sedivka' }, r.t).events[0].reason === 'Šedivka je u nás na noc. To počká do rána.' && E.act(r.st, 'strokeVisitor', { id: 'sedivka', region: 'back', speed: 300 }, r.t).events.some(e => e.type === 'visitorPurr') && r.st.visitors.sedivka.friend === 5, 'the guest: strokes only, no hearts');
    // below the clamp (friend 4, Koxa's 3½): liked strokes, the menu's Pohladit and a disliked spot change neither
    {
      const gs = clone(r.st); gs.visitors.sedivka.friend = 4; gs.visitors.sedivka.pal = 3.5;
      const evG = [];
      for (let k = 0; k < 4; k++) evG.push(...E.act(gs, 'strokeVisitor', { id: 'sedivka', region: 'back', along: true, speed: 300 }, r.t + k * MIN).events);
      evG.push(...E.act(gs, 'strokeVisitor', { id: 'sedivka' }, r.t + 5 * MIN).events, ...E.act(gs, 'strokeVisitor', { id: 'sedivka', region: 'paws', speed: 300 }, r.t + 6 * MIN).events);
      ok(evG.some(e => e.type === 'visitorPurr' && e.liked) && evG.some(e => e.type === 'visitorDislike') && !evG.some(e => e.type === 'jealous' || e.type === 'visitorFriend') &&
        gs.visitors.sedivka.friend === 4 && gs.visitors.sedivka.pal === 3.5, `the guest with 4 hearts: strokes change no hearts (${gs.visitors.sedivka.friend}, Koxa ${gs.visitors.sedivka.pal})`);
      const evO = E.advance(gs, until + H).events;
      ok(evO.some(e => e.type === 'guestOut') && gs.visitors.sedivka.friend === 4.25 && gs.visitors.sedivka.pal === 3.75, `a good night from below 5: +¼ from the cat and +¼ of Koxa's (${gs.visitors.sedivka.friend}, ${gs.visitors.sedivka.pal})`);
    }
    invariants(r.st, 'guest in');
    // the night in 10-minute steps: no other visitors, she sleeps, no sleeping together with 3 hearts, home at 7:00
    const night = (st, from, step) => {
      const out = []; let visitors = 0;
      for (let x = from + step; x <= MORNING; x += step) for (const e of E.advance(st, x).events) { out.push(e); if (e.type === 'visitor') visitors++; }
      return { out, visitors };
    };
    const r3 = clone(r.st), n3 = night(r3, r.t, 10 * MIN);
    const go = n3.out.find(e => e.type === 'guestOut');
    ok(n3.visitors === 0 || n3.out.findIndex(e => e.type === 'visitor') > n3.out.findIndex(e => e.type === 'guestOut'), 'no visitor while the guest is in');
    ok(go && go.slept === false && !n3.out.some(e => e.type === 'guestSleep') && !r3.guest && r3.visitors.sedivka.pal === 3.25 && r3.visitors.sedivka.friend === 5, 'pal 3: they do not sleep together; at 7:00 home with +¼ of Koxa\'s hearts');
    invariants(r3, 'guest out');
    // pal 4: they sleep together (once an event), a little more love than a twin with 3¾
    const p4 = clone(r.st); p4.visitors.sedivka.pal = 4;
    const p3 = clone(r.st); p3.visitors.sedivka.pal = 3.75;
    let love4 = 0, love3 = 0;
    const n4 = night(p4, r.t, 10 * MIN); night(p3, r.t, 10 * MIN);
    const p4b = clone(r.st); p4b.visitors.sedivka.pal = 4; const p3b = clone(r.st); p3b.visitors.sedivka.pal = 3.75;
    E.advance(p4b, until - 10 * MIN); E.advance(p3b, until - 10 * MIN); love4 = p4b.needs.love; love3 = p3b.needs.love;
    ok(n4.out.filter(e => e.type === 'guestSleep').length === 1 && n4.out.find(e => e.type === 'guestOut').slept === true && love4 > love3 && love4 - love3 < 40, `pal 4: they sleep together, love ${Math.round(love4)} vs ${Math.round(love3)}`);
    // invited from the garden: Koxa comes in with the guest, and they sleep together in the house
    {
      const gy = inv(110, 'sedivka', 5, 4, EVE, true);
      const evY = E.act(gy.st, 'invite', { id: 'sedivka' }, gy.t).events;
      ok(evY.some(e => e.type === 'house') && !gy.st.yard && gy.st.guest && gy.st.guest.id === 'sedivka', 'invited from the garden: Koxa comes in too ("house")');
      const ny = night(gy.st, gy.t, 10 * MIN);
      ok(ny.out.filter(e => e.type === 'guestSleep').length === 1 && ny.out.find(e => e.type === 'guestOut').slept === true, 'then they sleep together in the house');
      // Koxa asleep in the garden (kept there): no sleeping together, no bonus, no mood from the guest
      const yd = clone(r.st); yd.visitors.sedivka.pal = 4; yd.yard = { since: yd.t, snow: false, tree: null };
      const ydNo = clone(yd); ydNo.guest = null;
      ok(E.moodValue(yd) === E.moodValue(ydNo), `Koxa in the garden: the guest inside does not lift her mood (${E.moodValue(yd)} / ${E.moodValue(ydNo)})`);
      let sleptOut = false; const outY = [];
      for (let x = yd.t + 10 * MIN; x <= MORNING; x += 10 * MIN) { outY.push(...E.advance(yd, x).events); if (yd.asleep && yd.yard) sleptOut = true; }
      ok(sleptOut && !outY.some(e => e.type === 'guestSleep') && outY.find(e => e.type === 'guestOut').slept === false, 'Koxa asleep in the garden: no "spí spolu"');
    }
    // the step does not matter: 10-minute steps or one jump give the same guest's end and hearts
    const one = clone(r.st); one.visitors.sedivka.pal = 4; const evOne = E.advance(one, MORNING).events;
    ok(evOne.filter(e => e.type === 'guestOut').length === 1 && one.visitors.sedivka.pal === p4.visitors.sedivka.pal && one.visitors.sedivka.friend === p4.visitors.sedivka.friend && !one.guest, 'one jump to the morning: the same end');
    // once a day: the same evening no other sleepover (the guest gone by a repair of a broken guest)
    const od = clone(r.st); od.guest = null; od.visit = { id: 'mourek', since: od.t, until: od.t + H, gain: 0 }; od.visitors.mourek = rec(5, 5);
    ok(why({ st: od, t: od.t + MIN }, 'mourek') === 'Dnes už u nás jedna návštěva spala.', 'at most one sleepover a day');
    const nx = clone(r3); E.advance(nx, until + 12 * H); nx.visit = { id: 'mourek', since: nx.t, until: nx.t + H, gain: 0 }; nx.visitors.mourek = rec(5, 5); nx.out = null; nx.yard = null;
    ok(E.canInvite(nx, 'mourek', nx.t).ok, `the next evening another one may come (${E.canInvite(nx, 'mourek', nx.t).reason})`);
    // a long absence, the clock moved back, repair
    const la = clone(r.st); const evLa = E.advance(la, r.t + 5 * D).events;
    ok(!la.guest && evLa.filter(e => e.type === 'guestOut').length === 1, 'a long absence: the guest went home in the morning');
    invariants(la, 'guest long absence');
    const ck = clone(r.st); E.advance(ck, r.t + 2 * H); const left = ck.guest.until - ck.t; E.advance(ck, ck.t - 3 * H);
    ok(ck.guest && ck.guest.until - ck.t === left && ck.guest.until - ck.guest.since <= 14 * H, 'clock back: the guest\'s night moves with it, never longer');
    invariants(ck, 'guest clock back');
    const rp = clone(r.st); rp.guest = { id: 'sedivka', since: rp.t, until: rp.t + 3 * D, slept: 'x' }; E.repair(rp); ok(rp.guest === null, 'repair: a guest for more than a night dropped');
    const rp2 = clone(r.st); rp2.guest = { id: 'tom', since: rp2.t, until: rp2.t + H }; rp2.invDay = 99999999; E.repair(rp2); ok(rp2.guest === null && rp2.invDay === 0, 'repair: an unknown guest, a broken day');
    const rp3 = clone(r.st); rp3.guest.slept = 1; rp3.visit = { id: 'sedivka', since: rp3.t, until: rp3.t + H, gain: 0 }; E.repair(rp3);
    ok(rp3.guest && rp3.guest.slept === false && rp3.visit === null, 'repair: the guest is not in the garden at the same time');
    invariants(rp3, 'guest repair');
  }
  // photos: the visitor's place, Koxa not in the picture
  {
    const { st, t } = visiting(120, 'mourek', 1, 1, T0, true);
    E.act(st, 'photo', { room: 'garden', pose: 'sit', vpose: ' loaf ', vx: 123.6, vflip: true }, t);
    let p = st.album[st.album.length - 1];
    ok(p.visitor === 'mourek' && p.vpose === 'loaf' && p.vx === 124 && p.vflip === true && !('nokoxa' in p), 'a photo with the visitor: vpose, vx, vflip');
    E.act(st, 'photo', { room: 'garden', vpose: 'x'.repeat(30), vx: 999, vflip: 'yes', nokoxa: true }, t + 1000);
    p = st.album[st.album.length - 1];
    ok(p.vpose.length === 20 && p.vx === 400 && !('vflip' in p) && p.nokoxa === true, 'vpose ≤ 20, vx ≤ 400, vflip only true; nokoxa');
    E.act(st, 'photo', { room: 'kitchen', vpose: 'sit', vx: 10, nokoxa: false }, t + 2000);
    p = st.album[st.album.length - 1];
    ok(p.visitor === null && !('vpose' in p) && !('vx' in p), 'indoors the visitor is not in the picture');
    ok(E.act(st, 'photo', { room: 'kitchen', nokoxa: true }, t + 3000).events[0].reason === 'Na fotce nikdo není.', 'nobody in the picture: refused');
    const o = visiting(120, 'mourek', 1, 1, T0); friend(o.st); E.act(o.st, 'letOut', null, o.t);
    const evO = E.act(o.st, 'photo', { room: 'garden', vpose: 'sit', vx: 200 }, o.t + 1000).events;
    p = o.st.album[0];
    ok(evO.some(e => e.type === 'photo') && p.nokoxa === true && p.visitor === 'mourek', 'Koxa out: a photo of the visitor alone');
    ok(E.act(o.st, 'photo', { room: 'living' }, o.t + 2000).events[0].reason === 'Koxa je venku.', 'Koxa out, nobody else: refused');
    const gq = visiting(121, 'sedivka', 5, 3, at(2026, 6, 10, 19)); E.act(gq.st, 'invite', { id: 'sedivka' }, gq.t);
    E.act(gq.st, 'photo', { room: 'living', vpose: 'loaf', vx: 300 }, gq.t + 1000);
    p = gq.st.album[0];
    ok(p.visitor === 'sedivka' && p.vpose === 'loaf' && !('nokoxa' in p), 'the guest in the living room is in the photo');
    // on the lap: a photo keeps her there; indoors the guest is never in it, on the garden bench the visitor is
    const lp = visiting(121, 'sedivka', 5, 3, at(2026, 6, 10, 19)); E.act(lp.st, 'invite', { id: 'sedivka' }, lp.t);
    E.act(lp.st, 'lapOn', null, lp.t + 1000);
    const evL = E.act(lp.st, 'photo', { room: 'lap', pose: 'lapLoaf' }, lp.t + 2000).events;
    p = lp.st.album[0];
    ok(lp.st.lap && !evL.some(e => e.type === 'lapOff') && p.room === 'lap' && p.visitor === null && !('vx' in p), 'a lap photo indoors: she stays on the lap, the guest is not in it');
    const lb = visiting(122, 'mourek', 1, 1, T0, true); E.act(lb.st, 'lapOn', null, lb.t + 1000);
    const evB = E.act(lb.st, 'photo', { room: 'lap', pose: 'lapLoaf' }, lb.t + 2000).events;
    ok(lb.st.lap && !evB.some(e => e.type === 'lapOff') && lb.st.album[0].visitor === 'mourek', 'a lap photo on the garden bench: the visitor is in it');
    invariants(lp.st, 'lap photo'); invariants(lb.st, 'bench photo');
    invariants(st, 'photos'); invariants(o.st, 'photo out'); invariants(gq.st, 'photo guest');
    // an older photo stays as it was; broken new fields are dropped
    const old = { t: t - D, pose: 'sit', room: 'garden', mood: 'calm', phase: 'day', season: 'summer', note: '', visitor: 'mourek' };
    const h = clone(st); h.album = [clone(old), Object.assign(clone(old), { t: t - D + 1, vx: 'x', vflip: 'yes', nokoxa: 1, vpose: 7 }), Object.assign(clone(old), { t: t - D + 2, visitor: null, vpose: 'sit', vx: 5, nokoxa: true })];
    E.repair(h);
    ok(JSON.stringify(h.album[0]) === JSON.stringify(old) && JSON.stringify(h.album[1]) === JSON.stringify(Object.assign(clone(old), { t: t - D + 1 })) && !('vpose' in h.album[2]) && !('nokoxa' in h.album[2]), 'repair: an old photo unchanged, broken fields dropped');
    invariants(h, 'old photos');
  }
  // a month with the garden, treats, games, strokes and evening invitations: canonical every day, guests never stay long
  {
    let guests = 0, longGuest = 0, jealous = 0;
    for (const seed of [130, 131]) {
      const st = E.create(seed, at(2026, 5, 1, 7), 'Koxa'); st.owned.visitorBowl = true; st.furniture.visitorBowl = { room: 'garden', x: 0.5, y: 0.8 };
      st.bond = 300; st.lvl = 2; st.pamlsky = 500;
      for (const id of Object.keys(E.VISITORS)) st.visitors[id] = rec(4.5, 3.5);
      for (let t = st.t + 10 * MIN; t <= at(2026, 5, 31, 7); t += 10 * MIN) {
        const hr = new Date(t).getHours(), mi = new Date(t).getMinutes();
        for (const e of E.advance(st, t).events) if (e.type === 'jealous') jealous++;
        if ([8, 20].includes(hr) && mi === 0) basicCare(st, t);
        if ((hr === 10 || hr === 18) && mi === 0) E.act(st, 'goGarden', null, t);
        if ((hr === 12 || hr === 21) && mi === 30 && st.yard) { if (st.yard.tree) E.act(st, 'fetchDown', null, t); E.act(st, 'goHouse', null, t); }
        if (st.visit && st.yard) {
          const id = st.visit.id, L = E.visitorLikes(id);
          for (const e of E.act(st, 'strokeVisitor', { id, region: L.likes[0], speed: 300 }, t + 1000).events) if (e.type === 'jealous') jealous++;
          if (st.visit) E.act(st, 'treatVisitor', { id }, t + 2000);
          if (st.visit) E.act(st, 'playVisitor', { id, caught: 'koxa' }, t + 3000);
          if (st.visit && E.canInvite(st, id, t + 4000).ok) E.act(st, 'invite', { id }, t + 4000);
        }
        if (st.guest) { guests += mi === 0 && hr === 23 ? 1 : 0; if (t - st.guest.since > 14 * H) longGuest++; }
        if (mi === 0 && hr % 6 === 0) invariants(st, `month seed ${seed}`);
      }
    }
    console.log(`  a month × 2: ${guests} nights with a guest, ${jealous} jealous moments`);
    ok(guests > 3 && longGuest === 0 && jealous > 3, 'sleepovers happen, never longer than a night; jealousy happens');
  }
  // a visitor fuzz: the Phase B actions with good and garbage arguments, minutes apart, sometimes hours or back in time
  {
    const seen = {};
    for (const seed of [140, 141, 142, 143, 144, 145]) {
      let x = seed;
      const r = () => { x = (Math.imul(x ^ (x >>> 15), 0x2C1B3C6D) + 0x6D2B79F5) >>> 0; x ^= x >>> 12; return (x >>> 0) / 4294967296; };
      const pick = a => a[Math.floor(r() * a.length)];
      const st = E.create(seed, at(2026, 6, 1, 16), 'Koxa'); st.bond = 300; st.lvl = 2; st.pamlsky = 40;
      for (const id of Object.keys(E.VISITORS)) st.visitors[id] = rec(pick([0, 1.5, 4.75, 5]), pick([0, 2.5, 3, 4]));
      let t = st.t;
      const ids = Object.keys(E.VISITORS).concat('tom', null);
      const ARG = {
        strokeVisitor: id => ({ id, region: pick(Object.keys(E.REGIONS).concat(null, 'nose')), along: pick([true, false, 'sideways']), speed: pick([60, 300, 700, 1500, 'fast', NaN]) }),
        playVisitor: id => ({ id, caught: pick(['koxa', 'visitor', 7]) }),
        photo: () => ({ room: pick(['garden', 'living', 'lap', 'kitchen']), vpose: pick(['sit', '', 9]), vx: pick([0, 250.5, 1e9, NaN]), vflip: pick([true, 'x']), nokoxa: pick([true, false]) }),
        stroke: () => ({ region: 'back', along: true, speed: 300 }), scratch: () => ({ region: 'head', seconds: 1 }),
      };
      for (let i = 0; i < 1500; i++) {
        const k = r();
        t += k < 0.8 ? Math.floor(r() * 3 * MIN) : k < 0.97 ? Math.floor(r() * 6 * H) : -Math.floor(r() * 2 * H);
        if (!st.visit && !st.guest && r() < 0.3) { st.visit = { id: pick(Object.keys(E.VISITORS)), since: st.t, until: st.t + 90 * MIN, gain: 0 }; E.repair(st); }
        const id = st.visit && r() < 0.8 ? st.visit.id : st.guest && r() < 0.5 ? st.guest.id : pick(ids);
        const a = pick(['strokeVisitor', 'strokeVisitor', 'strokeVisitor', 'treatVisitor', 'playVisitor', 'invite', 'photo', 'feedVisitor', 'stroke', 'scratch', 'goGarden', 'goGarden', 'goHouse', 'advance', 'fetchDown', 'basic']);
        let res;
        if (a === 'advance') res = E.advance(st, t);
        else if (a === 'basic') { basicCare(st, t); res = { st, events: [] }; }
        else res = E.act(st, a, ARG[a] ? ARG[a](id) : { id }, t);
        for (const e of res.events) seen[e.type] = (seen[e.type] || 0) + 1;
        if (st.guest && st.guest.until - st.guest.since > 14 * H) ok(false, `visitor fuzz ${seed}: a guest for more than a night`);
        if (st.guest && st.visit && st.guest.id === st.visit.id) ok(false, `visitor fuzz ${seed}: the guest also in the garden`);
        invariants(st, `visitor fuzz ${seed} step ${i}`);
        if (failed > 20) break;
      }
    }
    const need = ['visitorPurr', 'visitorDislike', 'visitorHiss', 'visitorTreat', 'visitorPlay', 'jealous', 'jealousOk', 'jealousEnd', 'guestIn', 'guestOut', 'photo'];
    console.log(`  visitor fuzz: ${need.map(k => `${k} ${seen[k] || 0}`).join(', ')}`);
    ok(need.every(k => seen[k] > 0), `the visitor fuzz meets every new event (missing: ${need.filter(k => !seen[k]).join(', ')})`);
  }
}

section('Visitors 4 (kittens)');
{
  const rec = (friend, pal) => ({ friend, pal, met: 0, visits: 1, fed: 0 });
  const T0 = at(2026, 5, 1, 8);
  const bowl = st => { st.owned.visitorBowl = true; st.furniture.visitorBowl = { room: 'garden', x: 0.5, y: 0.8 }; return st; };
  // a cat with friends among the mothers: Líza (3 hearts, Koxa's 3) and Pacička (4, Koxa's 1), and the visitors' bowl
  const mothers = (seed, t = T0) => { const st = bowl(E.create(seed, t, 'Koxa')); st.visitors.liza = rec(3, 3); st.visitors.pacicka = rec(4, 1); return st; };
  const midnight = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  // `days` of life in `step` advances: care at 8 and 20, the garden 9–13 and 15–19; each(st, t, events) after every advance
  function live(st, days, step, each) {
    const end = st.t + days * D;
    for (let t = st.t + step; t <= end; t += step) {
      const d = new Date(t), hr = d.getHours(), mi = d.getMinutes(), s = d.getSeconds();
      const on = h => hr === h && mi === 0 && s < step / 1000;
      if (on(8) || on(20)) basicCare(st, t);
      if (on(9) || on(15)) E.act(st, 'goGarden', null, t);
      if ((on(13) || on(19)) && st.yard) { if (st.yard.tree) E.act(st, 'fetchDown', null, t); E.act(st, 'goHouse', null, t); }
      const ev = E.advance(st, t).events;
      if (each) each(st, t, ev);
    }
    return st;
  }
  // eligibility: never before 7 days, never without 3 hearts with a mother, never Šedivka or a tom, at most 3, 120 days apart
  {
    let early = 0, n = 0, wait = [], aways = new Set(), sizes = new Set(), moms = new Set(), boys = 0, kits = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const st = live(mothers(seed), 40, H);
      if (!st.litter) continue;
      n++; wait.push((st.litter.since - T0) / D);
      if (st.litter.since - st.born < 7 * D) early++;
      aways.add((st.litter.back - st.litter.since) / D); moms.add(st.litter.mother);
      const L = st.kits.filter(k => k.born === st.litter.since);
      sizes.add(L.length); kits += L.length; boys += L.filter(k => !k.fem).length;
      if (st.litter.since !== midnight(st.litter.since) || L.some(k => k.mother !== st.litter.mother) || st.litter.count !== 1) early += 100;
    }
    wait.sort((a, b) => a - b);
    console.log(`  litters in 40 days: ${n}/30, the median day ${wait[n >> 1].toFixed(1)}, away ${[...aways]} days, ${[...sizes].sort()} kittens, ${boys}/${kits} toms`);
    ok(n >= 27 && early === 0 && wait[n >> 1] <= 7 + 14, 'a litter at the earliest 7 days after the start, at midnight, usually within two weeks after that');
    ok(aways.size === 2 && aways.has(2) && aways.has(3) && [2, 3, 4].every(k => sizes.has(k)) && sizes.size === 3 && moms.size === 2 && !moms.has('sedivka'), 'away 2 or 3 days, 2–4 kittens, the mothers with 3+ hearts');
    ok(boys > kits * 0.25 && boys < kits * 0.75, 'kittens of both sexes');
    // nobody may have them: under 3 hearts, Šedivka, the toms
    const none = [];
    for (let seed = 1; seed <= 6; seed++) {
      const st = bowl(E.create(seed, T0, 'Koxa'));
      st.visitors = { liza: rec(2.75, 4), ciperka: rec(2.5, 3), pacicka: rec(0, 0), sedivka: rec(5, 5), mourek: rec(5, 5), bivoj: rec(5, 5), rambo: rec(5, 5), fousek: rec(5, 5) };
      live(st, 60, 2 * H);
      none.push(st.litter, st.kits.length);
    }
    ok(none.every(x => !x), 'no litter under 3 hearts, with Šedivka or with a tom');
    // three litters at most, 120 days apart
    const g = mothers(7, T0); g.born = T0 - 200 * D;
    g.litter = { mother: 'liza', since: midnight(T0 - 100 * D), back: midnight(T0 - 100 * D) + 2 * D, count: 1 };
    E.repair(g);
    live(g, 19, 2 * H);
    ok(g.litter.count === 1 && g.kits.length === 0, 'no second litter within 120 days');
    live(g, 60, 2 * H);
    ok(g.litter.count === 2 && g.litter.since - midnight(T0 - 100 * D) >= 120 * D - H && g.kits.length >= 2 && g.kits.every(k => /^k[5-8]$/.test(k.id)), `the second litter after 120 days: ids k5–k8 (${g.kits.map(k => k.id)})`);
    const m = mothers(8, T0); m.born = T0 - 900 * D; m.litter = { mother: 'pacicka', since: midnight(T0 - 300 * D), back: midnight(T0 - 300 * D) + 3 * D, count: 3 };
    E.repair(m); live(m, 60, 2 * H);
    ok(m.litter.count === 3 && m.kits.length === 0, 'at most three litters a game');
    invariants(g, 'second litter'); invariants(m, 'three litters');
    // never while the mother sleeps over: the same day with Líza as the guest gives no litter that night
    const lizaOnly = () => { const s = mothers(2); s.visitors.pacicka = rec(0, 0); return s; };
    const a = live(lizaOnly(), 30, H), L = a.litter.since;
    const b = lizaOnly(); live(b, (L - 3 * H - b.t) / D, H);
    b.guest = { id: 'liza', since: b.t, until: b.t + 10 * H, slept: false }; b.visit = null;
    E.advance(b, L + H);
    ok(a.litter.mother === 'liza' && (!b.litter || b.litter.since !== L), 'no litter on the night the mother sleeps over');
    invariants(b, 'guest night');
  }
  // the same litter day and kittens whatever the step: 10-minute advances, 30-second ones, irregular ones
  {
    const s10 = live(mothers(2), 11, 10 * MIN), s30 = live(mothers(2), 11, 30 * 1000);
    const irr = mothers(2); let x = 5;
    for (let t = T0; t < T0 + 11 * D;) { x = (x * 1103515245 + 12345) % 2147483648; t = Math.min(T0 + 11 * D, t + 1000 + x % (3 * H)); E.advance(irr, t); }
    const pick = st => JSON.stringify([st.litter, st.kits]);
    ok(s10.litter && pick(s10) === pick(s30) && pick(s10) === pick(irr), `the same litter in 10 min, 30 s and irregular steps (${s10.litter && new Date(s10.litter.since).toDateString()})`);
  }
  // the mother is away, then comes with all her kittens; the kittens come only with her until 21 days, then alone
  {
    let bad = [], kittensEv = 0, group = 0, alone = 0, grown = 0, acts = {}, kitOutside = 0, diaryOk = 0, runs = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const st = mothers(seed);
      let firstSeen = null;
      live(st, 70, 10 * MIN, (s, t, ev) => {
        const Lt = s.litter;
        for (const e of ev) {
          if (e.type === 'visitor') {
            const V = E.visitor(s, e.id);
            if (Lt && e.id === Lt.mother && t >= Lt.since && t < Lt.back + 10 * MIN && s.visit && s.visit.since < Lt.back) bad.push(`${seed}: the mother came while away`);
            if (V.mother) {
              alone++;
              if (V.ageDays < 21) bad.push(`${seed}: ${e.id} alone at ${V.ageDays} days`);
            }
            if (e.kits) {
              group++;
              const want = s.kits.filter(k => k.mother === e.id && s.visit.since - k.born < 21 * D).map(k => k.id);
              if (e.kits.join() !== want.join() || s.visit.kits.join() !== want.join()) bad.push(`${seed}: kits ${e.kits} want ${want}`);
            } else if (Lt && e.id === Lt.mother && s.kits.some(k => k.mother === e.id && s.visit.since - k.born < 21 * D)) bad.push(`${seed}: the mother without her small kittens`);
          }
          if (e.type === 'kittens' && e.alone) { if (!(e.n === 1 && e.ids.join() === s.visit.id && E.visitor(s, e.ids[0]).ageDays >= 21)) bad.push(`${seed}: kittens alone ${JSON.stringify(e)}`); }
          else if (e.type === 'kittens') {
            kittensEv++;
            if (firstSeen === null) firstSeen = t;
            if (!(e.n >= 2 && e.n <= 4 && e.ids.length === e.n && t >= Lt.back)) bad.push(`${seed}: kittens ${JSON.stringify(e)}`);
          }
          if (e.type === 'kitGrown') { grown++; if (E.visitor(s, e.id).ageDays < 21) bad.push(`${seed}: kitGrown at ${E.visitor(s, e.id).ageDays}`); }
          if (e.type === 'visitAct' && E.VISIT_ACTS[e.kind].kits) {
            acts[e.kind] = (acts[e.kind] || 0) + 1;
            if (E.VISIT_ACTS[e.kind].partner && !(s.visit && s.visit.kits.includes(e.kit) || !s.visit)) bad.push(`${seed}: partner ${e.kit}`);
          }
        }
        if (s.visit && s.visit.act && E.VISIT_ACTS[s.visit.act.kind].kits && !(s.yard && !s.asleep)) kitOutside++;
      });
      if (!st.litter) continue;
      runs++;
      const dl = E.diary(st), dk = dl.find(e => e.id === 'kittens'), dg = dl.find(e => e.id === 'kitGrown');
      const names = st.kits.filter(k => k.mother === st.litter.mother).map(k => k.name);
      if (dk.found && dk.text.startsWith(E.visitor(st, st.litter.mother).name + ' přivedla na zahradu koťátka: ') && names.every(n => dk.text.includes(n)) && dk.text.endsWith(names[names.length - 1] + '.') &&
        dg.found && / už chodí na návštěvu sam[a]?\.$|sám\.$/.test(dg.text)) diaryOk++;
    }
    console.log(`  12 lives of 70 days: ${kittensEv} litters seen, ${group} visits with kittens, ${alone} visits of young cats, ${grown} kitGrown, acts ${JSON.stringify(acts)}`);
    ok(bad.length === 0, `kittens visit right: ${bad.slice(0, 4).join('; ')}`);
    ok(kittensEv === runs && runs >= 10 && group >= runs * 3 && alone > runs && grown >= runs, 'each litter is seen, comes with its mother several times, then alone');
    ok(acts.kitPlay > 0 && acts.kitFlee > 0 && acts.kitGroom > 0 && kitOutside === 0, 'kitPlay, kitFlee, kitGroom happen, only with Koxa awake in the garden');
    ok(diaryOk === runs, `the diary: the kittens by name and the first one alone (${diaryOk}/${runs})`);
    const st = mothers(1); live(st, 70, 10 * MIN);
    invariants(st, 'kittens 70 days');
  }
  // a state with Líza's kittens: k1 Micinka (she, 5 days), k2 Tygřík (he, 5 days), k3 (30 days) and k4 (70 days) of Pacička
  const T = at(2026, 6, 10, 10);
  function family(t = T) {
    let u = t; const probe = E.create(5, u, 'Koxa'); while (E.weather(u, probe) === 'rain') u += D;
    const st = bowl(E.create(5, u - 100 * D, 'Koxa'));
    E.advance(st, u - 100 * D + H); st.t = u; st.day = { key: Number(new Date(u).toISOString().slice(0, 10).replace(/-/g, '')), ms: 0, food: 0, mood: 0, minE: 100, treats: 0, ttreats: 0, q: false, acted: false };
    basicCare(st, u); st.needs.energy = 90; st.lvl = 2; st.bond = 300; st.pamlsky = 20;
    const b5 = midnight(u - 5 * D), b30 = midnight(u - 30 * D), b70 = midnight(u - 70 * D);
    st.kits = [
      { id: 'k1', mother: 'pacicka', name: 'Žofka', named: true, fem: true, coat: 'pacicka', born: b70, trait: 'greedy', solo: b70 + 22 * D },
      { id: 'k5', mother: 'pacicka', name: 'Drobek', named: false, fem: false, coat: 'mourek', born: b30, trait: 'shy', solo: 0 },
      { id: 'k9', mother: 'liza', name: 'Micinka', named: false, fem: true, coat: 'liza', born: b5, trait: 'shy', solo: 0 },
      { id: 'k10', mother: 'liza', name: 'Tygřík', named: false, fem: false, coat: 'rambo', born: b5, trait: 'playful', solo: 0 },
    ];
    st.litter = { mother: 'liza', since: b5, back: b5 + 2 * D, count: 3 };
    st.visitors = { liza: rec(5, 3), pacicka: rec(4, 2), k1: rec(5, 3), k5: { friend: 0, pal: 0, met: 0, visits: 0, fed: 0 }, k9: rec(0, 0), k10: rec(0, 0) };
    E.repair(st);
    return st;
  }
  const withKits = (st, garden) => { st.visit = { id: 'liza', since: st.t, until: st.t + 2 * H, gain: 0, palGain: 0, greeted: false, act: { kind: 'arrive', since: st.t, with: null }, kits: ['k10', 'k9', 'k1', 'x'] }; if (garden) st.yard = { since: st.t, snow: false, tree: null }; E.repair(st); return st; };
  // visitor() and visitorIds()
  {
    const st = family();
    ok(E.visitorIds(st).join() === Object.keys(E.VISITORS).concat('k1', 'k5', 'k9', 'k10').join(), 'visitorIds: the eight, then the kittens');
    const all = E.visitorIds(st).map(id => E.visitor(st, id));
    ok(all.every(v => v && typeof v.name === 'string' && typeof v.fem === 'boolean' && typeof v.trait === 'string' && typeof v.coat === 'string' && Object.prototype.hasOwnProperty.call(E.VISITORS, v.coat) && v.kit >= 0 && v.kit <= 1), 'visitor(): every id has a name, sex, trait, a neighbour\'s coat and kit 0–1');
    ok(Object.keys(E.VISITORS).every(id => { const v = E.visitor(st, id); return v.coat === id && v.kit === 0 && v.mother === null && v.name === E.VISITORS[id].name; }), 'the eight: their own coat, kit 0, no mother');
    const m = E.visitor(st, 'k9'), b = E.visitor(st, 'k5'), g = E.visitor(st, 'k1');
    ok(m.name === 'Micinka' && m.fem && m.mother === 'liza' && m.ageDays === 5 && m.small && m.kit > 0.8 && b.ageDays === 30 && !b.small && b.kit > 0.2 && b.kit < 0.35 && g.kit === 0 && g.ageDays === 70, `kittens: age and kit (${m.kit}, ${b.kit}, ${g.kit})`);
    ok(E.visitor(st, 'k2') === null && E.visitor(st, 'tom') === null && E.visitor(st, null) === null && E.visitor(st, '__proto__') === null, 'visitor(): null for unknown ids');
    // the growth curve: 1 up to 2 days, 0.35 at 21, 0 from 60, never growing back
    const c = clone(st), ks = [];
    for (let a = 0; a <= 70; a++) { c.t = c.kits[2].born + a * D + H; ks.push(E.visitor(c, 'k9').kit); }
    ok(ks[0] === 1 && ks[2] === 1 && ks[21] === 0.35 && ks[60] === 0 && ks[70] === 0 && ks.every((k, i) => !i || k <= ks[i - 1]), `kit by age: ${[0, 2, 10, 21, 40, 60].map(a => ks[a])}`);
  }
  // strokes, treats and the feather on small kittens: each has its own; they like it everywhere, never run off
  {
    const st = withKits(family(), true);
    ok(st.visit.kits.join() === 'k9,k10', `a visit keeps only the mother's small kittens, in order (${st.visit.kits})`);
    let ev = E.act(st, 'strokeVisitor', { id: 'k9', region: 'belly', along: true, speed: 300 }, st.t).events;
    ok(ev.some(e => e.type === 'visitorPurr' && e.id === 'k9' && e.liked) && st.visitors.k9.friend === 0.5 && st.visitors.liza.friend === 5, `a kitten likes the belly: +¼ +¼ (${st.visitors.k9.friend})`);
    ev = E.act(st, 'strokeVisitor', { id: 'k10', region: 'tail', along: true, speed: 300 }, st.t + 1000).events;
    ok(ev.some(e => e.type === 'visitorPurr' && e.id === 'k10') && st.visitors.k10.friend === 0.75, 'its brother in the same minute: his own minute (+½ playful, +¼ liked)');
    for (let k = 0; k < 20; k++) E.act(st, 'strokeVisitor', { id: 'k9', speed: 300 }, st.t + 2000 + k * 1000);
    ok(st.visit && st.visit.kits.length === 2 && st.visitors.k9.friend >= 0.5, 'shy Micinka with no hearts never runs off (the menu\'s Pohladit)');
    ev = E.act(st, 'treatVisitor', { id: 'k9' }, st.t + 30000).events;
    ok(ev.some(e => e.type === 'visitorTreat' && e.id === 'k9') && st.pamlsky === 19, 'a treat for Micinka');
    ok(E.act(st, 'treatVisitor', { id: 'k9' }, st.t + 31000).events.some(e => e.type === 'refused' && e.reason === 'Micinka už pamlsek dostala.'), 'once a visit: "Micinka už pamlsek dostala."');
    ok(E.act(st, 'treatVisitor', { id: 'k10' }, st.t + 32000).events.some(e => e.type === 'visitorTreat') && E.act(st, 'treatVisitor', { id: 'liza' }, st.t + 33000).events.some(e => e.type === 'visitorTreat') && st.pamlsky === 17, 'Tygřík and Líza get their own');
    ev = E.act(st, 'playVisitor', { id: 'k10', caught: 'visitor' }, st.t + 40000).events;
    ok(ev.some(e => e.type === 'visitorPlay' && e.id === 'k10' && e.koxa === true), 'the feather with Tygřík (Koxa plays too)');
    ok(E.act(st, 'playVisitor', { id: 'k10' }, st.t + 50000).events.some(e => e.type === 'refused' && e.reason === 'Tygřík si chvilku oddechne.'), 'one game a minute each');
    ok(E.act(st, 'playVisitor', { id: 'k9' }, st.t + 51000).events.some(e => e.type === 'visitorPlay'), 'Micinka has her own minute');
    ok(E.act(st, 'feedVisitor', { id: 'k9' }, st.t + 52000).events.some(e => e.type === 'refused' && /dostala/.test(e.reason)), 'fed today by the treat');
    ok(Object.keys(st.visit.kp).join() === 'k9,k10', 'per-kitten state in the visit\'s order');
    {   // a greedy kitten fed: the mother's visit is not longer (a greedy visitor alone would stay 30 min more)
      const g = withKits(family(), true); g.kits.find(k => k.id === 'k10').trait = 'greedy'; E.repair(g);
      const until = g.visit.until, fe = E.act(g, 'feedVisitor', { id: 'k10' }, g.t + 1000).events;
      ok(E.visitor(g, 'k10').trait === 'greedy' && fe.some(e => e.type === 'visitorFed' && e.id === 'k10') && g.visit.until === until, 'feeding a greedy kitten does not make its mother\'s visit longer');
      invariants(g, 'greedy kitten fed');
    }
    ok(E.act(st, 'strokeVisitor', { id: 'k5', speed: 300 }, st.t + 53000).events.some(e => e.type === 'refused' && e.reason === 'Drobek tu teď není.'), 'a kitten not here: "Drobek tu teď není."');
    invariants(st, 'kittens touched');
    // a young cat on its own follows its trait: shy Drobek under 2 hearts runs off from the belly
    const y = family(); y.visit = { id: 'k5', since: y.t, until: y.t + H, gain: 0 }; E.repair(y);
    ev = E.act(y, 'strokeVisitor', { id: 'k5', region: 'belly', along: true, speed: 300 }, y.t).events;
    ok(ev.some(e => e.type === 'visitorLeave' && e.reason === 'shy') && !y.visit, 'a shy young cat (30 days) runs off like Líza');
    ok(E.visitorLikes('k5', y).text === 'Drobek se nechá hladit jen pomalu a jemně, na hlavě a na bradě.' && E.visitorLikes('k9', y).dislikes.length === 0 && E.visitorLikes('k9', y).text.startsWith('Micinka je ještě koťátko') && E.visitorLikes('k9') === null && E.visitorLikes('liza', y).text === E.visitorLikes('liza').text, 'visitorLikes(id, st): a kitten everywhere, a young cat by its trait');
    invariants(y, 'young cat');
  }
  // kitten acts only with Koxa awake in the garden; the partner is one of the kittens; her hearts with the kitten grow too
  {
    let seen = {}, partner = 0, palK = 0, outside = 0;
    for (let s = 1; s <= 40; s++) {
      const st = family(); st.seed = s; st.visitors.liza = rec(5, s % 2 ? 3 : 0.5); withKits(st, s % 4 !== 0);
      for (let k = 1; k <= 12 && st.visit; k++) {
        const ev = E.advance(st, st.t + 10 * MIN).events;
        for (const e of ev) if (e.type === 'visitAct') { seen[e.kind] = (seen[e.kind] || 0) + 1; if (E.VISIT_ACTS[e.kind].partner && ['k9', 'k10'].includes(e.kit)) partner++; }
        if (st.visit && E.VISIT_ACTS[st.visit.act.kind].kits && !st.yard) outside++;
      }
      if (st.visitors.k9.pal + st.visitors.k10.pal > 0) palK++;
      invariants(st, `kitten acts ${s}`);
    }
    console.log(`  kitten acts: ${JSON.stringify(seen)}`);
    ok(seen.kitPlay > 0 && seen.kitFlee > 0 && seen.kitGroom > 0 && partner === seen.kitPlay + seen.kitGroom && outside === 0 && palK > 0, 'kitPlay / kitFlee / kitGroom with Koxa in the garden, with a kitten partner; Koxa makes friends with the kittens');
    // kitGroom needs 3 of Koxa's hearts with the mother; fleeing more often when they are not friends
    let groomLow = 0, fleeLow = 0, fleeHigh = 0, low = 0, high = 0;
    for (let s = 1; s <= 60; s++) for (const p of [0.5, 4]) {
      const st = family(); st.seed = s; st.visitors.liza = rec(5, p); withKits(st, true);
      for (let k = 1; k <= 12 && st.visit; k++) for (const e of E.advance(st, st.t + 10 * MIN).events) if (e.type === 'visitAct') {
        if (p < 3) { low++; if (e.kind === 'kitGroom') groomLow++; if (e.kind === 'kitFlee') fleeLow++; } else { high++; if (e.kind === 'kitFlee') fleeHigh++; }
      }
    }
    ok(groomLow === 0 && fleeLow / low > fleeHigh / high, `kitGroom only from 3 hearts; she flees more before they are friends (${fleeLow}/${low} vs ${fleeHigh}/${high})`);
    // a kitten act ends when she leaves the garden
    const st = family(); withKits(st, true);
    for (let k = 1; k <= 30 && !(st.visit && E.VISIT_ACTS[st.visit.act.kind].kits); k++) E.advance(st, st.t + MIN);
    if (st.visit && E.VISIT_ACTS[st.visit.act.kind].kits) {
      E.act(st, 'goHouse', null, st.t + 1000);
      ok(st.visit && !st.visit.act.with && st.visit.kits.length === 2, 'going in ends the kitten act; the kittens stay with their mother');
    }
  }
  // the invitation: kittens are too small, the mother has small kittens, a grown one can sleep over
  {
    const ev = at(2026, 6, 10, 19);
    const st = withKits(family(ev), false);
    ok(E.canInvite(st, 'k9', ev).reason === 'Micinka je ještě moc malá.' && E.canInvite(st, 'k10', ev).reason === 'Tygřík je ještě moc malý.', 'a kitten: "je ještě moc malá / malý"');
    ok(E.canInvite(st, 'liza', ev).reason === 'Líza má malá koťátka, musí být s nimi.' && E.act(st, 'invite', { id: 'liza' }, ev).events.some(e => e.type === 'refused' && e.reason === 'Líza má malá koťátka, musí být s nimi.'), 'the mother with small kittens stays with them');
    const y = family(ev); y.visit = { id: 'k5', since: y.t, until: y.t + H, gain: 0 }; y.visitors.k5 = rec(5, 3); E.repair(y);
    ok(E.canInvite(y, 'k5', ev).reason === 'Drobek je ještě moc malý.', 'a young cat (30 days) is still too small');
    const g = family(ev); g.visit = { id: 'k1', since: g.t, until: g.t + H, gain: 0 }; E.repair(g);
    const r = E.act(g, 'invite', { id: 'k1' }, g.t + 1000).events;
    ok(E.canInvite(family(ev), 'k1', ev).reason === 'Žofka tu teď není.' && r.some(e => e.type === 'guestIn' && e.id === 'k1') && g.guest.id === 'k1', 'a grown kitten (70 days) can sleep over');
    ok(E.act(g, 'treatVisitor', { id: 'k1' }, g.t + 2000).events.some(e => e.reason === 'Žofka je u nás na noc. To počká do rána.'), 'the grown kitten as the guest');
    E.advance(g, g.t + 14 * H);
    ok(!g.guest, 'the night ends');
    invariants(g, 'kitten guest'); invariants(st, 'invite mother');
  }
  // naming
  {
    const st = withKits(family(), false);
    ok(E.kitsNew(st).map(v => v.id).join() === 'k9,k10', 'kitsNew: the unnamed kittens that have come (not Drobek, never seen)');
    let ev = E.act(st, 'nameKitten', { id: 'k9', name: '  Mourinka Malinká z Náchoda u Hradce  ' }, st.t).events;
    const K = st.kits.find(k => k.id === 'k9');
    ok(ev.some(e => e.type === 'kitNamed' && e.id === 'k9' && e.name === K.name) && K.named && K.name === 'Mourinka Malinká z N' && E.visitor(st, 'k9').name === K.name, `nameKitten: trimmed, at most 20 characters (${K.name})`);
    for (const bad of ['', '   ', 5, null])
      ok(E.act(st, 'nameKitten', { id: 'k10', name: bad }, st.t).events.some(e => e.type === 'refused' && e.reason === 'Napiš koťátku jméno.') && !st.kits.find(k => k.id === 'k10').named, `a bad name refused (${JSON.stringify(bad)})`);
    for (const id of ['k2', 'k5', 'mourek', null, '__proto__'])
      ok(E.act(st, 'nameKitten', { id, name: 'Bob' }, st.t).events.some(e => e.type === 'refused' && e.reason === 'Takové koťátko neznáme.'), `an unknown kitten refused (${id})`);
    st.yard = { since: st.t, snow: false, tree: { since: st.t, calls: 0 } }; E.repair(st);
    ok(E.act(st, 'nameKitten', { id: 'k10', name: 'Rarášek' }, st.t + 1000).events.some(e => e.type === 'kitNamed') && st.yard.tree && E.kitsNew(st).length === 0, 'naming works whatever Koxa does (up the tree); kitsNew empty');
    ok(E.diary(st).find(e => e.id === 'kittens').found === null, 'no diary entry for kittens made by hand');
    invariants(st, 'naming');
  }
  // a litter nobody saw while small: each young cat is announced alone, as itself, the first time it comes
  {
    const st = family(); st.visit = null;
    st.kits.push({ id: 'k6', mother: 'pacicka', name: 'Sněženka', named: false, fem: true, coat: 'pacicka', born: st.kits[1].born, trait: 'curious', solo: 0 });
    E.repair(st);
    const first = {}, evs = [];
    for (let t = st.t + 10 * MIN; t < st.t + 40 * D && !(first.k5 && first.k6); t += 10 * MIN) {
      const ev = E.advance(st, t).events;
      for (const e of ev) if (e.type === 'visitor' && (e.id === 'k5' || e.id === 'k6') && !first[e.id]) { first[e.id] = ev; evs.push(e.id); }
    }
    const k = id => first[id] && first[id].filter(e => e.type === 'kittens');
    ok(first.k5 && first.k6 && ['k5', 'k6'].every(id => k(id).length === 1 && k(id)[0].alone === true && k(id)[0].n === 1 && k(id)[0].ids.join() === id && k(id)[0].mother === 'pacicka'),
      `a young cat first seen alone: 'kittens' alone, only itself (${evs.map(id => JSON.stringify(k(id)))})`);
    const dk = E.diary(st).find(e => e.id === 'kittens'), fe = st.kits.find(o => o.id === evs[0]);
    ok(dk.found && dk.text === `Na zahradu poprvé ${fe.fem ? 'přišla' : 'přišel'} ${fe.name}, koťátko Pacičky.`, `the diary: "${dk.text}"`);
    ok(['k5', 'k6'].every(id => E.kitsNew(st).some(v => v.id === id)), 'both can be named once seen');
    invariants(st, 'kittens seen alone');
    const r = clone(st); E.repair(r);
    ok(JSON.stringify(r.diaryCat) === JSON.stringify(st.diaryCat) && r.diaryCat.kittens === evs[0], 'repair keeps a kitten in the diary\'s kittens entry');
  }
  // a kitten named while small stays in the album when grown (60 days), an unnamed one seen too
  {
    const st = withKits(family(), false);
    E.act(st, 'nameKitten', { id: 'k9', name: 'Mína' }, st.t + 1000);
    ok(st.visitors.k9.met > 0, 'naming a kitten counts as meeting it');
    st.visit = null; E.repair(st);
    E.advance(st, st.t + 60 * D);
    const al = E.album(st);
    ok(E.visitor(st, 'k9').kit === 0 && al.visitors.some(v => v.id === 'k9' && v.name === 'Mína') && al.visitors.some(v => v.id === 'k10'),
      `grown kittens once seen are among the neighbours' cats (${al.visitors.map(v => v.id)})`);
  }
  // album
  {
    const st = withKits(family(), false); st.visitors.k1.met = st.t; st.visitors.k9.met = st.t;
    const al = E.album(st);
    ok(al.kittens.map(k => k.id).join() === 'k1,k9,k10' && al.kittens.every(k => ['id', 'name', 'named', 'mother', 'motherName', 'ageDays', 'kit', 'coat', 'fem', 'hearts', 'pal'].every(f => f in k)), `album.kittens: the seen ones with every field (${al.kittens.map(k => k.id)})`);
    const z = al.kittens[0];
    ok(z.name === 'Žofka' && z.named && z.motherName === 'Pacička' && z.ageDays === 70 && z.kit === 0 && z.hearts === 5 && z.pal === 3 && al.kittens[1].motherName === 'Líza', 'album.kittens: names, mother, age, hearts');
    ok(al.visitors.some(v => v.id === 'k1' && v.name === 'Žofka') && !al.visitors.some(v => v.id === 'k9'), 'album.visitors: a grown kitten once met, not a small one');
    const ph = E.act(st, 'photo', { room: 'garden', vpose: 'sit' }, st.t + 1000).events;
    st.yard = { since: st.t, snow: false, tree: null }; E.repair(st);
    E.act(st, 'photo', { room: 'garden' }, st.t + 2000);
    ok(st.album[st.album.length - 1].visitor === 'liza' && st.album[st.album.length - 1].kits.join() === 'k9,k10', 'a garden photo with the mother has her kittens');
    invariants(st, 'album kittens');
  }
  // repair: garbage kittens, litters, visits
  {
    const st = withKits(family(), true);
    const g = clone(st);
    g.kits = g.kits.concat([
      { id: 'k9', mother: 'liza', name: 'Dup', named: true, fem: true, coat: 'liza', born: g.t - D, trait: 'shy' },             // a duplicate id
      { id: 'k11', mother: 'sedivka', name: 'X', fem: true, coat: 'sedivka', born: g.t - D, trait: 'shy' },                    // not a mother
      { id: 'k12', mother: 'liza', name: 'Y', fem: true, coat: 'liza', born: g.t + D, trait: 'shy' },                          // born tomorrow
      { id: 'k13', mother: 'liza', name: 'Z', fem: true, coat: 'liza', born: g.t - D, trait: 'shy' },                          // a bad id
      { id: 'k11', mother: 'liza', name: 7, named: true, fem: 'yes', coat: 'tygr', born: g.kits[2].born, trait: 'old', solo: 'x' },   // repaired
      { id: 'k12', mother: 'liza', name: 'Five', fem: false, coat: 'liza', born: g.kits[2].born, trait: 'shy' },                    // the 5th of a litter? (3rd here)
      { id: 'k4', mother: 'ciperka', name: 'W', fem: true, coat: 'ciperka', born: g.t - 2 * D, trait: 'bold' },                     // a 4th litter
      null, 'k8', [],
    ]);
    g.litter = { mother: 'sedivka', since: 'x', back: 5, count: 9 };
    g.visitors.k6 = rec(1, 1); g.visitors.k11 = rec(2, 2);
    g.visit.kp = { k9: { gain: 9, pet: 'x', treat: 1, play: g.t + H, playGain: 3 }, liza: { gain: 1 }, k5: {} };
    g.visit.act = { kind: 'kitGroom', since: g.t, with: 'koxa', kit: 'k5' };
    E.repair(g);
    const k11 = g.kits.find(k => k.id === 'k11');
    ok(g.kits.map(k => k.id).join() === 'k1,k5,k9,k10,k11,k12' && k11.name === 'Koťátko' && !k11.named && !k11.fem && k11.coat === 'liza' && k11.trait === 'playful' && k11.solo === 0, `repair: duplicates, strangers, the future and a 4th litter dropped, fields fixed (${g.kits.map(k => k.id)})`);
    ok(g.litter && g.litter.mother === 'liza' && g.litter.count === 3 && g.litter.since === g.kits[2].born, `repair: a broken litter record rebuilt from the kittens (${JSON.stringify(g.litter)})`);
    ok(!g.visitors.k6 && g.visitors.k11, 'repair: records of unknown kittens dropped');
    ok(JSON.stringify(g.visit.kp) === JSON.stringify({ k9: { gain: 1.5, pet: 0, treat: false, play: 0, playGain: 0.5 } }) && g.visit.act.kind === 'wander' && g.visit.kits.join() === 'k9,k10', `repair: the per-kitten state and a kitGroom with a stranger (${JSON.stringify(g.visit.kp)}, ${g.visit.act.kind})`);
    invariants(g, 'kitten garbage');
    // five of one litter: the fifth dropped
    const f = clone(st); f.kits = f.kits.concat([0, 1, 2].map(i => ({ id: 'k' + (11 + i), mother: 'liza', name: 'N' + i, named: false, fem: true, coat: 'liza', born: f.kits[2].born, trait: 'shy', solo: 0 })));
    E.repair(f);
    ok(f.kits.filter(k => k.mother === 'liza').length === 4, 'at most 4 kittens a litter');
    for (const bad of [null, 'x', 5, { mother: 'liza' }, { mother: 'liza', since: T, back: T + D, count: 1 }]) {
      const b = clone(st); b.litter = bad; E.repair(b);
      ok(b.litter && b.litter.count >= 2 && b.litter.since <= b.t, `repair: litter ${JSON.stringify(bad)} → ${JSON.stringify(b.litter)}`);
      invariants(b, 'litter garbage');
    }
    const e = clone(st); e.kits = 'x'; e.litter = null; E.repair(e);
    ok(e.kits.length === 0 && e.litter === null && !e.visit.kits && !e.visitors.k9 && e.diaryCat.kitGrown === undefined, 'repair: no kittens at all');
    invariants(e, 'no kittens');
    const old = clone(st); delete old.kits; delete old.litter; E.repair(old);
    ok(Array.isArray(old.kits) && old.litter === null, 'an older save: no kittens, no litter');
  }
  // the clock moves back in a visit with kittens; a long absence: they keep growing by real time
  {
    const st = withKits(family(), true);
    E.act(st, 'strokeVisitor', { id: 'k9', region: 'head', speed: 300 }, st.t + 1000);
    const born = st.kits[2].born, since = st.litter.since;
    E.advance(st, st.t - 2 * H);
    ok(st.visit && st.visit.kits.join() === 'k9,k10' && st.kits[2].born === born - 2 * H && E.visitor(st, 'k9').ageDays === 5 && st.litter.since === since - 2 * H && st.visit.kp.k9.pet === st.visit.since + 1000, 'the clock moved back: the kittens stay as old as they were, the litter plan and the strokes move with it');
    invariants(st, 'kittens clock back');
    const fut = withKits(family(), false); fut.kits[2].born = fut.t; fut.kits[3].born = fut.t; E.repair(fut);
    E.advance(fut, fut.t - 3 * D);
    ok(fut.kits[2].born === fut.t && fut.visit.kits.join() === 'k9,k10', 'kittens born just now, the clock 3 days back: born now, still with their mother');
    invariants(fut, 'kittens clock far back');
    // two litters of one mother (200 and 50 days), the clock 300 days back: still two litters, nobody lost, ages kept
    const two = family(); two.kits = two.kits.filter(k => k.mother === 'pacicka');
    const b200 = midnight(two.t - 200 * D), b50 = midnight(two.t - 50 * D);
    two.kits = [
      { id: 'k1', mother: 'liza', name: 'Žofka', named: true, fem: true, coat: 'liza', born: b200, trait: 'greedy', solo: b200 + 22 * D },
      { id: 'k2', mother: 'liza', name: 'Bobík', named: true, fem: false, coat: 'liza', born: b200, trait: 'shy', solo: b200 + 23 * D },
      { id: 'k3', mother: 'liza', name: 'Ťapka', named: true, fem: true, coat: 'mourek', born: b200, trait: 'bold', solo: 0 },
      { id: 'k5', mother: 'liza', name: 'Mňouk', named: true, fem: false, coat: 'liza', born: b50, trait: 'playful', solo: b50 + 30 * D },
      { id: 'k6', mother: 'liza', name: 'Kulička', named: false, fem: true, coat: 'rambo', born: b50, trait: 'sleepy', solo: 0 },
    ];
    two.litter = { mother: 'liza', since: b50, back: b50 + 2 * D, count: 2 }; two.visit = null; two.visitors = { liza: rec(5, 3) }; E.repair(two);
    const ids2 = two.kits.map(k => k.id).join(), ages = two.kits.map(k => E.visitor(two, k.id).ageDays).join();
    E.advance(two, two.t - 300 * D); E.repair(two);
    ok(two.kits.map(k => k.id).join() === ids2 && two.kits.map(k => E.visitor(two, k.id).ageDays).join() === ages && two.kits[0].born !== two.kits[3].born && two.litter.count === 2,
      `the clock 300 days back: two litters of Líza stay two, every kitten kept with its age (${ids2} / ${two.kits.map(k => k.id)}, ${ages})`);
    invariants(two, 'two litters clock back');
    // repair groups by the id block: kittens of one block with another birth join their litter, a stranger mother is dropped
    const blk = clone(two); blk.kits[1].born += D; blk.kits.push({ id: 'k4', mother: 'pacicka', name: 'X', named: false, fem: true, coat: 'pacicka', born: blk.kits[0].born, trait: 'shy', solo: 0 }); E.repair(blk);
    ok(blk.kits.map(k => k.id).join() === ids2 && blk.kits[1].born === blk.kits[0].born, 'repair: a litter is a block of ids (k1–k4): one birth, one mother');
    // a small kitten never visits alone, a kitten under 60 days is never the guest (states made by hand, an old clock)
    const sm = family(); sm.visit = { id: 'k9', since: sm.t, until: sm.t + H, gain: 0 }; E.repair(sm);
    ok(sm.visit === null, 'repair: a kitten of 5 days visiting alone is no visit');
    const gs = family(); gs.visit = null; gs.guest = { id: 'k5', since: gs.t - H, until: gs.t + 5 * H, slept: false }; E.repair(gs);
    const gg = family(); gg.visit = null; gg.guest = { id: 'k1', since: gg.t - H, until: gg.t + 5 * H, slept: false }; E.repair(gg);
    ok(gs.guest === null && gg.guest && gg.guest.id === 'k1', 'repair: a young cat (30 days) is never the guest, a grown one (70 days) may be');
    invariants(sm, 'small alone'); invariants(gs, 'young guest');
    const ab = family(); E.advance(ab, ab.t + 30 * D);
    ok(E.visitor(ab, 'k9').ageDays === 35 && E.visitor(ab, 'k9').kit < 0.35 && E.visitor(ab, 'k9').kit > 0, 'a 30-day absence: the kittens are 30 days older');
    invariants(ab, 'kittens absence');
  }
  // fuzz: the kitten actions with good and garbage ids, minutes apart, sometimes hours or back in time
  {
    const seen = {};
    for (const seed of [150, 151, 152, 153]) {
      let x = seed;
      const r = () => { x = (Math.imul(x ^ (x >>> 15), 0x2C1B3C6D) + 0x6D2B79F5) >>> 0; x ^= x >>> 12; return (x >>> 0) / 4294967296; };
      const pick = a => a[Math.floor(r() * a.length)];
      const st = family(); st.seed = seed;
      let t = st.t;
      const ids = () => E.visitorIds(st).concat('k2', 'k12', 'tom', null, 7);
      for (let i = 0; i < 1500; i++) {
        const k = r();
        t += k < 0.8 ? Math.floor(r() * 3 * MIN) : k < 0.97 ? Math.floor(r() * 8 * H) : -Math.floor(r() * 2 * H);
        if (!st.visit && !st.guest && r() < 0.2) { r() < 0.5 ? withKits(st, false) : (st.visit = { id: pick(E.visitorIds(st)), since: st.t, until: st.t + 90 * MIN, gain: 0 }, E.repair(st)); }
        const V = st.visit, id = V && r() < 0.8 ? (V.kits && r() < 0.6 ? pick(V.kits) : V.id) : pick(ids());
        const a = pick(['strokeVisitor', 'strokeVisitor', 'treatVisitor', 'playVisitor', 'feedVisitor', 'invite', 'photo', 'nameKitten', 'nameKitten', 'goGarden', 'goHouse', 'advance', 'basic']);
        let res;
        if (a === 'advance') res = E.advance(st, t);
        else if (a === 'basic') { basicCare(st, t); res = { st, events: [] }; }
        else if (a === 'nameKitten') res = E.act(st, a, { id: pick(ids()), name: pick(['Bob', '', '  Líza  ', 'x'.repeat(40), 3]) }, t);
        else res = E.act(st, a, a === 'strokeVisitor' ? { id, region: pick(Object.keys(E.REGIONS).concat(null)), along: pick([true, false]), speed: pick([60, 300, 1500]) } : { id, caught: 'koxa', room: 'garden' }, t);
        for (const e of res.events) seen[e.type] = (seen[e.type] || 0) + 1;
        if (st.visit && st.visit.kits && st.visit.kits.some(k => !st.kits.some(o => o.id === k && o.mother === st.visit.id))) ok(false, `kitten fuzz ${seed}: a stranger in the visit`);
        invariants(st, `kitten fuzz ${seed} step ${i}`);
        if (failed > 20) break;
      }
    }
    const need = ['kitNamed', 'visitorPurr', 'visitorTreat', 'visitorPlay', 'kitGrown', 'visitAct', 'refused'];
    console.log(`  kitten fuzz: ${need.map(k => `${k} ${seen[k] || 0}`).join(', ')}`);
    ok(need.every(k => seen[k] > 0), `the kitten fuzz meets the kitten events (missing: ${need.filter(k => !seen[k]).join(', ')})`);
  }
}

section('Cat flap installed, shop toys, šanta from the pantry');
{
  const t0 = at(2026, 6, 10, 10);
  // buying the cat flap puts it in the předsíň door at once (it used to stay unplaced, so she never went out by herself)
  const cf = friend(E.create(31, t0, 'Koxa')); cf.pamlsky = 100;
  ok(E.act(cf, 'buy', 'catFlap', t0).events.some(e => e.type === 'bought') && cf.furniture.catFlap && cf.furniture.catFlap.room === 'hall' && cf.pamlsky === 20,
    'buying the cat flap installs it in the předsíň');
  invariants(cf, 'cat flap bought');
  let walks = 0;
  for (let s = 1; s <= 10; s++) {
    const st = friend(E.create(100 + s, at(2026, 6, 10, 8), 'Koxa')); st.pamlsky = 100;
    E.act(st, 'buy', 'catFlap', st.t);
    const r = E.advance(st, at(2026, 6, 11, 20)).events;
    if (r.some(e => e.type === 'out' && e.flap) && r.some(e => e.type === 'back' && e.walk && e.flap)) walks++;
    invariants(st, `cat flap walks ${s}`);
  }
  ok(walks >= 8, `a bought cat flap: she goes out by herself and comes back through it (${walks}/10 cats in 36 h)`);
  // a walk through the garden gate (Pustit ven) comes back as a gate walk, not through the flap
  const gw = clone(cf); const go = E.act(gw, 'letOut', null, gw.t).events, gb = E.advance(gw, gw.t + 9 * H).events.find(e => e.type === 'back');
  ok(go.some(e => e.type === 'out' && e.walk && !e.flap) && gb && gb.walk && gb.flap === false, 'a walk through the gate: out and back without the flap');
  // an older save that bought it without installing it gets it on load; nothing without owning it
  const old = clone(cf); delete old.furniture.catFlap; E.repair(old);
  ok(old.furniture.catFlap && old.furniture.catFlap.room === 'hall' && JSON.stringify(old) === JSON.stringify(cf), 'repair installs an owned cat flap in an older save');
  const no = clone(cf); no.owned = {}; E.repair(no); ok(!no.furniture.catFlap, 'no cat flap without owning it');
  const moved = clone(cf); moved.furniture.catFlap = { room: 'living', x: 0.1, y: 0.1 }; E.repair(moved);
  ok(moved.furniture.catFlap && moved.furniture.catFlap.room === 'hall', 'a cat flap in a wrong room goes back to the předsíň');

  // shop toys: refused until bought, then they play like their basic toy plus the bonus (her favourite counts for its kind)
  for (const [k, base] of [['catnipMouse', 'mouse'], ['bellBall', 'ball'], ['featherWand', 'feather']]) {
    const a = friend(E.create(40, t0, 'Koxa')), b = friend(E.create(40, t0, 'Koxa'));   // the udice is offered from Známá
    a.needs.fun = b.needs.fun = 50; b.pamlsky = 100;
    ok(E.act(b, 'play', k, t0).events[0].type === 'refused', `${k}: refused before it is bought`);
    ok(E.act(b, 'buy', k, t0).events.some(e => e.type === 'bought' && e.kind === 'toy') && b.owned[k] === true, `${k}: bought`);
    const pa = E.act(a, 'play', base, t0).events.find(e => e.type === 'played'), pb = E.act(b, 'play', k, t0).events.find(e => e.type === 'played');
    ok(pa && pb && pb.toy === k && pb.fav === pa.fav && pb.gain === pa.gain + E.TOYS[k].bonus && E.TOYS[k].bonus > 0,
      `${k} plays as ${base} with its bonus (+${pb && pb.gain} vs +${pa && pa.gain})`);
    invariants(b, `shop toy ${k}`);
  }
  const fv = E.create(41, t0, 'Koxa'); fv.traits.toy = 'mouse'; fv.owned.catnipMouse = true;
  ok(E.act(fv, 'play', 'catnipMouse', t0).events.some(e => e.type === 'played' && e.fav), 'her favourite kind counts for the shop toy too');

  // šanta harvested while she sleeps (or is out) goes to the pantry and she gets it later
  const cn = E.create(50, at(2026, 6, 10, 14), 'Koxa');
  cn.beds[0] = { crop: 'catnip', sown: cn.t - 3 * D, days: 3, watered: 0 };
  cn.asleep = true; cn.sleepAt = cn.t; cn.needs.energy = 20;
  const hv = E.act(cn, 'harvest', { bed: 0 }, cn.t).events;
  ok(hv.some(e => e.type === 'harvested' && e.crop === 'catnip') && !hv.some(e => e.type === 'catnip') && cn.pantry.catnip === 1, 'šanta harvested while she sleeps: into the pantry');
  invariants(cn, 'catnip in the pantry');
  ok(E.act(cn, 'catnip', null, cn.t).events.some(e => e.type === 'refused') && cn.pantry.catnip === 1, 'šanta from the pantry: not while she sleeps (kept)');
  cn.asleep = false; cn.wokeAt = cn.t; cn.needs.fun = 20; cn.needs.energy = 80;
  const gv = E.act(cn, 'catnip', null, cn.t).events;
  ok(gv.some(e => e.type === 'catnip') && !cn.pantry.catnip && cn.needs.fun === 80, 'šanta from the pantry: she goes wild (fun +60), the pantry is empty');
  ok(E.act(cn, 'catnip', null, cn.t).events[0].reason === 'Nemáš žádnou šantu.', 'no more šanta: refused');
  invariants(cn, 'catnip given');
  const co = E.create(51, at(2026, 6, 10, 14), 'Koxa'); co.pantry.catnip = 2;
  co.out = { since: co.t, until: co.t + 3 * H, walk: true, byPlayer: true };
  ok(E.act(co, 'catnip', null, co.t).events[0].type === 'refused' && co.pantry.catnip === 2, 'šanta from the pantry: not while she is out (kept)');
  co.beds[1] = { crop: 'catnip', sown: co.t - 3 * D, days: 3, watered: 0 };
  ok(!E.act(co, 'harvest', { bed: 1 }, co.t).events.some(e => e.type === 'catnip') && co.pantry.catnip === 3, 'šanta harvested while she is out: into the pantry');
}

/* ---------- Škádlení: teasing out of love (SPEC §13.3) ---------- */
section('Teasing');
{
  const TZ = E.TEASE, T0 = at(2026, 6, 10, 10);
  const NEED_SETS = { happy: [90, 90, 90, 80, 60, 100, 90], calm: [60, 60, 60, 50, 50, 90, 80], grumpy: [40, 40, 50, 30, 30, 60, 60], sad: [15, 15, 40, 10, 10, 30, 30] };
  const setMood = (st, mood) => { ['food', 'water', 'energy', 'fun', 'love', 'litter', 'coat'].forEach((k, i) => { st.needs[k] = NEED_SETS[mood][i]; }); st.want = E.wants(st); };
  // an awake Koxa at 10:00 on a dry day (moved to the next dry one), her mood set by her needs
  function tc(seed, mood = 'happy', t = T0) {
    const probe = E.create(seed, t, 'Koxa');
    while (E.weather(t, probe) === 'rain') t += D;
    const st = E.create(seed, t - H, 'Koxa'); E.advance(st, t);
    setMood(st, mood);
    st.pamlsky = 30;
    if (E.mood(st) !== mood || st.asleep) ok(false, `teasing setup ${seed}: ${mood} awake (${E.moodValue(st)}, asleep ${st.asleep})`);
    return st;
  }
  // a run of k pats on `region`, ms apart (n goes on from n0); all the events and the time of the last tap
  function pats(st, t, region, k, ms, o = {}) {
    const ev = [], n0 = o.n0 || 0;
    for (let i = 1; i <= k; i++) {
      t += ms;
      const n = n0 + i;
      ev.push(...E.act(st, 'pat', { region, n, ms: n > 1 ? ms : 0, cv: o.cv === undefined ? 0 : o.cv, eating: !!o.eating }, t).events);
    }
    return { ev, t };
  }
  const has = (ev, type, f) => ev.some(e => e.type === type && (!f || f(e)));
  const cnt = (ev, type, f) => ev.filter(e => e.type === type && (!f || f(e))).length;
  const idx = (ev, type, f) => ev.findIndex(e => e.type === type && (!f || f(e)));
  const near = (a, b, d = 0.05) => Math.abs(a - b) <= d;
  const dk = ms => { const d = new Date(ms); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };   // local day key
  const heatAt = (st, t) => Math.max(0, st.tease.heat - (t - st.tease.at) / (10 * MIN));
  // three blowUps seconds apart (fast pats on her back): a sulk, a longer sulk, then a cross
  function makeCross(st) {
    let t = st.t; const ev = [];
    for (let k = 0; k < 3; k++) { const r = pats(st, t + 2000, 'back', 15, 150); ev.push(...r.ev); t = r.t; }
    return { ev, t };
  }
  const FRESH = JSON.stringify({ kind: null, until: 0, heat: 0, at: 0, warnAt: 0, boops: [], gain: 0, gainAt: 0, pay: null, payDay: 0, bondDay: 0, splash: 0 });

  // constants and the tempo
  {
    ok(E.TEASE.fast === 260 && E.TEASE.warnMs === 1800 && E.TEASE.gainMax === 8 && E.TEASE.crossAt === 5 && Object.isFrozen(E.TEASE) && Object.isFrozen(E.TEASE.heat), 'TEASE exported, frozen');
    ok(E.ACTIONS.includes('pat') && E.ACTIONS.includes('boop') && E.ACTIONS.includes('splash'), 'pat, boop and splash are actions');
    const tempos = []; for (let s = 1; s <= 300; s++) tempos.push(E.patTempo(E.create(s, T0, 'K')));
    ok(tempos.every(x => Number.isInteger(x) && x >= 400 && x <= 650) && Math.min(...tempos) < 420 && Math.max(...tempos) > 630, `her tempo 400–650 ms from the seed (${Math.min(...tempos)}–${Math.max(...tempos)})`);
    const c = E.create(1, T0, 'Koxa');
    ok(JSON.stringify(c.tease) === FRESH && Object.keys(c).pop() === 'tease', 'create: the default tease, the last key');
    ok(JSON.stringify(E.create(1, T0, 'Koxa').traits) === JSON.stringify(E.create(1, T0, 'Koxa').traits) && c.n === 0, 'no draws from st.n at creation');
  }

  // bliss: her tempo at the tail base; the love cap per 10 minutes; the flop once a run, its bond once a day; over-patting
  {
    const st = tc(1), fav = E.patTempo(st), l0 = st.needs.love, b0 = st.bond;
    let r = pats(st, st.t, 'tailBase', 8, fav);
    const bl = r.ev.filter(e => e.type === 'pat');
    ok(bl.length === 8 && bl.every(e => e.stage === 'bliss' && e.region === 'tailBase') && bl.map(e => e.rear).join() === 'false,false,true,true,true,true,true,true' && bl[7].close === 1 && bl[0].close === 0,
      'tail base, regular, in her tempo: bliss; the rear up from tap 3; close 1 in her tempo');
    ok(cnt(r.ev, 'flop') === 1 && idx(r.ev, 'flop') > r.ev.indexOf(bl[7]) && r.ev.find(e => e.type === 'flop').lap === false, 'the flop exactly once, after the 8th pat');
    const fd = r.ev.find(e => e.type === 'found' && e.id === 'bliss');
    ok(fd && fd.text.includes(fav <= 520 ? 'svižně' : 'pomalu a pravidelně') && fd.text.startsWith('Koxa má ráda'), `Deníček: bliss (${fd && fd.text})`);
    ok(near(st.needs.love, l0 + 8) && st.tease.gain === 8, `love from pats capped at +8 in 10 min (${l0} → ${st.needs.love})`);
    ok(st.bond === b0 + 1 && st.tease.bondDay === dk(st.t), 'the flop: bond +1 (bondDay today)');
    r = pats(st, r.t, 'tailBase', 5, fav, { n0: 8 });
    ok(r.ev.filter(e => e.type === 'pat').every(e => e.stage === 'bliss') && !has(r.ev, 'flop') && near(st.needs.love, l0 + 8), 'taps 9–13: bliss, no flop, no more love');
    const l1 = st.needs.love;
    r = pats(st, r.t, 'tailBase', 3, fav, { n0: 13 });
    ok(r.ev.filter(e => e.type === 'pat').map(e => e.stage).join() === 'warn,warn,warn' && !has(r.ev, 'loveBite'), 'tap 14: over-patting warns');
    let k = 17, bite = null;
    for (; k < 40 && !bite; k++) { r = pats(st, r.t, 'tailBase', 1, fav, { n0: k - 1 }); bite = r.ev.find(e => e.type === 'loveBite'); }
    ok(bite && bite.lap === false && (k - 1 - 14) * fav >= 1800 && (k - 2 - 14) * fav < 1800, `a loveBite 1.8 s after the warning (tap ${k - 1})`);
    ok(st.tease.kind === null && near(st.needs.love, l1 - 1) && near(st.tease.heat, 1, 0.01), 'loveBite: love −1, heat +1, no sulk');
    invariants(st, 'bliss');
    // the next run 11 min later: the flop again, love +8 again (a new window), the bond not again today
    E.advance(st, r.t + 11 * MIN);
    const b1 = st.bond, l2 = st.needs.love;
    r = pats(st, r.t + 11 * MIN, 'tailBase', 8, fav);
    ok(cnt(r.ev, 'flop') === 1 && st.bond === b1 && near(st.needs.love, l2 + 8, 0.2) && !has(r.ev, 'found'), 'a second flop the same day: love in a new window, no bond, no diary');
    // a window that ends inside a run: the flop gives its +4 when the window is not used up
    const G = st.tease.gainAt;
    E.advance(st, G + 10 * MIN - 3.5 * fav);
    const l3 = st.needs.love;
    r = pats(st, G + 10 * MIN - 3.5 * fav, 'tailBase', 8, fav);
    ok(cnt(r.ev, 'flop') === 1 && st.tease.gain === 8 && near(st.needs.love, l3 + 5 * (1 + 0.5) + 4, 0.2), `the flop with room in the window: love +4 (${l3} → ${st.needs.love})`);
    // the next day: bond again
    const nx = clone(st); E.advance(nx, nx.t + D); setMood(nx, 'happy');
    ok(!nx.asleep, 'the next day at 10: awake');
    const b2 = nx.bond; pats(nx, nx.t, 'tailBase', 8, fav);
    ok(nx.bond >= b2 + 1, 'the flop on the next day: bond +1 again');
    invariants(st, 'bliss windows'); invariants(nx, 'bliss next day');
    // irregular at the tail base, or on the back: like (+1 a pat, the same cap); a close tempo only
    const lk = tc(2), l4 = lk.needs.love;
    r = pats(lk, lk.t, 'tailBase', 4, 500, { cv: 0.5 });
    const r2 = pats(lk, r.t, 'back', 4, 500, { n0: 4 });
    ok(r.ev.concat(r2.ev).filter(e => e.type === 'pat').every(e => e.stage === 'like') && near(lk.needs.love, l4 + 8, 0.05), 'irregular tail base and the back: like, +1 each (8 pats = +8)');
    const far = tc(3), fv = E.patTempo(far), slow = Math.min(5000, fv + 400);
    r = pats(far, far.t, 'tailBase', 8, slow);
    ok(!has(r.ev, 'flop') && r.ev.filter(e => e.type === 'pat').every(e => e.stage === 'bliss' && e.close === 0), 'far from her tempo: bliss without the flop');
    invariants(lk, 'like'); invariants(far, 'far tempo');
  }

  // drumming on her back: a warning; stopping within 1.8 s is fine, going on = blowUp
  {
    const st = tc(4);
    let r = pats(st, st.t, 'back', 7, 150);
    // (tap 1 has no tempo yet: liked; the UI sends pats only from tap 2)
    ok(r.ev.filter(e => e.type === 'pat').map(e => e.stage).join() === 'like,tolerate,warn,warn,warn,warn,warn' && !has(r.ev, 'blowUp') && st.tease.warnAt > 0, 'fast on the back: tolerated, a warning from tap 3');
    r = pats(st, r.t + 3000, 'back', 2, 150);
    ok(!has(r.ev, 'blowUp') && !has(r.ev, 'sulk') && st.tease.kind === null && st.tease.warnAt === 0, 'stopped within 1.8 s: nothing, the next run starts fresh');
    // a pause longer than 1.5 s resets the warning even when the UI's n goes on
    r = pats(st, r.t + 3000, 'back', 3, 150);
    const t3 = r.t; r = pats(st, r.t + 1600, 'back', 12, 150, { n0: 3 });
    ok(!has(r.ev, 'blowUp') && st.tease.warnAt === t3 + 1750, 'a pause over 1.5 s: a new warning, no blowUp');
    const l0 = st.needs.love;
    r = pats(st, r.t + 3000, 'back', 20, 150);
    const bi = idx(r.ev, 'blowUp');
    ok(cnt(r.ev, 'blowUp') === 1 && r.ev.slice(0, bi).filter(e => e.type === 'pat').length === 14 && r.ev[bi].why === 'fast' && r.ev[bi].lap === false, 'going on 1.8 s after the warning: blowUp fast at tap 15');
    ok(r.ev[bi + 1] && r.ev[bi + 1].type === 'sulk' && r.ev[bi + 1].until === r.t - 5 * 150 + 3 * MIN && st.tease.kind === 'sulk', 'then a sulk of 3 minutes');
    ok(near(st.needs.love, l0 + 1 - 2, 0.02) && near(heatAt(st, st.t), 2, 0.01), 'blowUp: love −2 (after the liked tap 1), heat +2');
    ok(E.health(st).sulk && !E.health(st).cross && E.health(st).teaseUntil === st.tease.until, 'health: sulk, teaseUntil');
    invariants(st, 'blowUp fast');
    // the tail: irritation even slow and happy
    const tl = tc(5); r = pats(tl, tl.t, 'tail', 10, 500);
    ok(r.ev.find(e => e.type === 'blowUp').why === 'tail' && r.ev.slice(0, idx(r.ev, 'blowUp')).filter(e => e.type === 'pat').map(e => e.stage).join() === 'tolerate,tolerate,warn,warn,warn,warn', 'the tail: warned from tap 3, blowUp tail 1.8 s later');
    invariants(tl, 'tail');
  }

  // asleep (or dozing on the lap): never a blowUp, nothing changes; the nose tap is refused
  {
    const st = tc(6); st.asleep = true; st.sleepAt = st.t; st.needs.energy = 50;
    const T = JSON.stringify(st.tease);
    const ev = [];
    for (const reg of ['back', 'tail', 'belly', 'tailBase', 'nose']) ev.push(...pats(st, st.t, reg, 30, 120).ev);
    ok(st.asleep && ev.every(e => e.type === 'pat' && e.stage === 'tolerate' && e.sleeping === true) && JSON.stringify(st.tease) === T, 'asleep: 150 fast pats are only tolerated in her sleep, the tease state unchanged');
    ok(E.act(st, 'boop', null, st.t).events.pop().reason === 'Koxa spí, nebuď ji.', 'boop asleep: refused');
    invariants(st, 'pats asleep');
    const lp = tc(7); E.act(lp, 'lapOn', null, lp.t); lp.lap.doze = true; lp.lap.dozeAt = lp.t;
    const e2 = pats(lp, lp.t, 'back', 30, 120).ev;
    ok(lp.lap && lp.lap.doze && e2.every(e => e.type === 'pat' && e.sleeping), 'dozing on the lap: tolerated, she stays dozing');
    ok(E.act(lp, 'boop', null, lp.t).events.pop().reason === 'Koxa spí, nebuď ji.' && lp.lap, 'boop while she dozes on the lap: refused, the lap stays');
    invariants(lp, 'pats dozing');
  }

  // at the bowl: the mild blowUp ('eat'), no payback ever
  {
    const st = tc(8), l0 = st.needs.love;
    const r = pats(st, st.t, 'back', 8, 500, { eating: true });
    const ps = r.ev.filter(e => e.type === 'pat'), before = r.ev.slice(0, idx(r.ev, 'blowUp')).filter(e => e.type === 'pat');
    ok(ps.every(e => e.eating === true) && before.map(e => e.stage).join() === 'tolerate,warn,warn,warn,warn' && r.ev.find(e => e.type === 'blowUp').why === 'eat', 'eating: warned from tap 2, blowUp eat 1.8 s later');
    ok(st.tease.kind === 'sulk' && near(st.needs.love, l0 - 1, 0.02) && near(heatAt(st, st.t), 1, 0.01), 'the meal blowUp: love −1, heat +1, a sulk');
    let planned = 0;
    for (let s = 1; s <= 40; s++) { const x = tc(100 + s); pats(x, x.t, 'tail', 8, 500, { eating: true }); if (x.tease.pay) planned++; if (x.tease.kind !== 'sulk') ok(false, `eat ${s}: a sulk`); }
    ok(planned === 0, 'the meal blowUp never plans a payback (40 cats)');
    invariants(st, 'eat');
  }

  // the belly is a trap; the head, chin, ears, paws and nose never blow up
  {
    const st = tc(9), l0 = st.needs.love;
    const r = { ev: E.act(st, 'pat', { region: 'belly', n: 2, ms: 500 }, st.t + 500).events };
    ok(r.ev.map(e => e.type).join() === 'trap' && st.tease.kind === null && near(st.needs.love, l0, 0.01) && near(heatAt(st, st.t), 1, 0.01), 'the belly: a trap (from the run), heat +1, no love, no sulk');
    const lp = tc(10); E.act(lp, 'lapOn', null, lp.t);
    const e2 = E.act(lp, 'pat', { region: 'belly', n: 3, ms: 400 }, lp.t + 500).events;
    ok(has(e2, 'trap') && lp.lap && lp.lap.annoy === 2, 'a trap on the lap: she stays, annoyed +2');
    invariants(st, 'trap'); invariants(lp, 'trap lap');
    for (const mood of ['happy', 'grumpy', 'sad']) for (const reg of ['head', 'chin', 'ears', 'paws', 'nose']) {
      const x = tc(11, mood), ev = pats(x, x.t, reg, 40, 100).ev;
      const ps = ev.filter(e => e.type === 'pat');
      if (has(ev, 'blowUp') || has(ev, 'sulk') || !ps.slice(0, 13).every(e => e.stage === 'tolerate' && e.region === (reg === 'nose' ? 'head' : reg)) || !has(ev, 'loveBite')) ok(false, `${mood} ${reg}: tolerated, never a blowUp, over-patting = a loveBite`);
      else ok(true);
    }
  }

  // her mood: grumpy blows up even when slow, sad tolerates, a sulk irritates
  {
    const g = tc(12, 'grumpy'), r = pats(g, g.t, 'back', 10, 500);
    ok(r.ev.find(e => e.type === 'blowUp').why === 'grumpy', 'grumpy: slow regular pats on the back blow up (grumpy)');
    const s = tc(13, 'sad'), r2 = pats(s, s.t, 'back', 13, 500);
    ok(r2.ev.filter(e => e.type !== 'meow').every(e => e.type === 'pat' && e.stage === 'tolerate') && s.tease.kind === null, 'sad: tolerated');
    const c = tc(14, 'calm'), r3 = pats(c, c.t, 'tailBase', 8, E.patTempo(c));
    ok(has(r3.ev, 'flop'), 'calm: bliss and the flop too');
    const so = tc(15); pats(so, so.t, 'back', 8, 500, { eating: true });   // a sulk from the bowl
    const r4 = pats(so, so.t + 3000, 'back', 10, 500);
    ok(r4.ev.find(e => e.type === 'blowUp').why === 'grumpy' && has(r4.ev, 'sulk', e => e.until === so.tease.until), 'a sulk running: slow pats on the back blow up again (grumpy), the sulk is prolonged');
    invariants(g, 'grumpy'); invariants(s, 'sad'); invariants(so, 'sulk again');
  }

  // making up after a sulk: a stroke along the fur, a scratch, a treat; against the fur keeps the sulk; or it ends by itself
  {
    const sulky = seed => { const x = tc(seed); pats(x, x.t, 'back', 8, 500, { eating: true }); return x; };   // a sulk, no payback
    const st = sulky(16);
    for (const [arg, why] of [[{ region: 'back', along: false, speed: 300 }, 'against'], [{ region: 'back', along: true, speed: 1500 }, 'too fast'], [{ region: 'back', along: 'sideways', speed: 300 }, 'sideways'],
      [{ region: 'back', along: true, speed: 50 }, 'too slow'], [{ region: 'belly', along: true, speed: 300 }, 'the belly']]) {
      const ev = E.act(st, 'stroke', arg, st.t).events;
      ok(!has(ev, 'reconcile') && st.tease.kind === 'sulk', `a stroke ${why}: still sulking`);
    }
    const z = clone(st); z.asleep = true; z.sleepAt = z.t; z.needs.energy = 50;
    ok(!has(E.act(z, 'stroke', { region: 'back', along: true, speed: 300 }, z.t).events, 'reconcile') && z.tease.kind === 'sulk', 'asleep: a stroke does not make it up');
    const b0 = st.bond, ref = clone(st); ref.tease.kind = null; ref.tease.until = 0;
    const ev = E.act(st, 'stroke', { region: 'back', along: true, speed: 300 }, st.t).events;
    E.act(ref, 'stroke', { region: 'back', along: true, speed: 300 }, ref.t);
    const rc = ev.find(e => e.type === 'reconcile');
    ok(rc && rc.by === 'stroke' && rc.bond === true && st.tease.kind === null && st.tease.until === 0 && st.bond === b0 + 1, 'a stroke along the fur: made up, bond +1');
    ok(near(st.needs.love - ref.needs.love, 3, 1e-9) && has(ev, 'found', e => e.id === 'reconcile' && e.text === 'Koxa se po škádlení usmířila: otřela se ti o ruku.'), 'reconcile: love +3, Deníček');
    ok(idx(ev, 'reconcile') < idx(ev, 'found', e => e.id === 'reconcile'), 'reconcile before its found');
    ok(!has(E.advance(st, st.t + 5 * MIN).events, 'sulkEnd'), 'no sulkEnd after making up');
    pats(st, st.t, 'back', 8, 500, { eating: true });
    const e2 = E.act(st, 'scratch', { region: 'head', seconds: 1 }, st.t).events.find(e => e.type === 'reconcile');
    ok(e2 && e2.by === 'scratch' && e2.bond === false && st.bond === b0 + 1, 'a scratch makes up too; the bond only once a day');
    pats(st, st.t, 'back', 8, 500, { eating: true });
    const e3 = E.act(st, 'treat', null, st.t).events;
    ok(has(e3, 'treat') && has(e3, 'reconcile', e => e.by === 'treat' && !e.bond) && st.tease.kind === null, 'a treat makes up');
    pats(st, st.t, 'back', 8, 500, { eating: true });
    ok(has(E.act(st, 'treat', 'stick', st.t).events, 'refused') && st.tease.kind === 'sulk', 'no stick in stock: refused, still sulking');
    invariants(st, 'reconcile');
    // it ends by itself, exactly at until
    const se = sulky(17), u = se.tease.until;
    ok(!has(E.advance(se, u - 1).events, 'sulkEnd') && E.health(se).sulk, 'still sulking 1 ms before the end');
    ok(has(E.advance(se, u).events, 'sulkEnd') && !E.health(se).sulk && se.tease.kind === null && se.tease.until === 0, 'sulkEnd exactly at until');
    invariants(se, 'sulk end');
  }

  // a cross: swats (no claws, no heat), ignores, wriggles; she eats a treat and stays cross; it ends after 20 min
  {
    const st = tc(18), r = makeCross(st), t = st.t;
    ok(cnt(r.ev, 'blowUp') === 3 && r.ev.filter(e => e.type === 'sulk' || e.type === 'cross').map(e => e.type).join() === 'sulk,sulk,cross', 'three blowUps: sulk, sulk, cross');
    ok(st.tease.kind === 'cross' && st.tease.until === t + 20 * MIN && st.tease.pay && E.health(st).cross, 'a cross of 20 minutes always plans a payback');
    const h0 = heatAt(st, t), l0 = st.needs.love;
    const one = (a, arg) => E.act(st, a, arg, t).events;
    ok(one('pat', { region: 'back', n: 2, ms: 500 }).map(e => e.type).join() === 'swat' && one('pat', { region: 'tailBase', n: 5, ms: 500 })[0].why === 'pat', 'pats: a swat');
    ok(one('stroke', { region: 'back', along: true, speed: 300 }).map(e => e.type + e.why).join() === 'swatstroke' && one('scratch', { region: 'chin' })[0].why === 'scratch', 'stroke and scratch: a swat');
    const b4 = st.tease.boops.length;
    ok(one('boop', null)[0].why === 'boop' && st.tease.boops.length === b4, 'boop: a swat, not counted');
    ok(near(heatAt(st, t), h0, 1e-6) && near(st.needs.love, l0, 1e-9), 'swats: no heat, no love');
    ok(one('call', null)[0].reason === 'Koxa tě teď schválně neposlouchá.' && one('play', 'mouse')[0].reason === 'Koxa si s tebou teď hrát nechce. Zlobí se.', 'call and play: ignored');
    ok(one('pickUp', null)[0].type === 'wriggle' && !st.held && one('lapOn', null)[0].type === 'wriggle' && !st.lap, 'pickUp and lapOn: wriggle');
    const tr = one('treat', null);
    ok(has(tr, 'treat') && !has(tr, 'reconcile') && st.tease.kind === 'cross', 'a treat: eaten, still cross');
    const z = clone(st); z.asleep = true; z.sleepAt = z.t; z.needs.energy = 50;
    ok(E.act(z, 'stroke', { region: 'back', along: true, speed: 300 }, z.t).events.map(e => e.type).join() === 'purr' && E.act(z, 'pat', { region: 'back', n: 9, ms: 150 }, z.t).events[0].sleeping, 'asleep while cross: purrs in her sleep, never swats');
    const ref = clone(st); ref.tease.kind = null; ref.tease.until = 0;
    ok(E.moodValue(ref) - E.moodValue(st) === 20, `mood while cross: −20 (${E.moodValue(st)})`);
    invariants(st, 'cross');
    ok(!has(E.advance(st, st.tease.until - 1).events, 'crossEnd') && has(E.advance(st, t + 20 * MIN).events, 'crossEnd') && st.tease.kind === null, 'crossEnd after 20 minutes');
    ok(has(E.act(st, 'call', null, st.t).events, 'come'), 'after the cross she comes when called');
    invariants(st, 'cross end');
  }

  // heat cools by 1 per 10 minutes, analytically
  {
    const st = tc(19);
    let r = pats(st, st.t, 'back', 15, 150);
    ok(near(st.tease.heat, 2, 1e-6), 'one blowUp: heat 2');
    const a0 = st.tease.at;
    E.act(st, 'pat', { region: 'head', n: 1 }, a0 + 10 * MIN);
    ok(near(st.tease.heat, 1, 1e-6) && st.tease.at === a0 + 10 * MIN, 'after 10 min a pat brings it up to date: 1');
    r = pats(st, a0 + 25 * MIN, 'back', 15, 150);
    ok(has(r.ev, 'sulk') && !has(r.ev, 'cross') && near(st.tease.heat, 2, 1e-6), 'a blowUp 25 min later: heat 0 + 2, a sulk');
    const c = tc(20); let t = c.t, kinds = [];
    for (let k = 0; k < 3; k++) { const x = pats(c, t, 'back', 15, 150); kinds.push(x.ev.find(e => e.type === 'sulk' || e.type === 'cross').type); t = x.t + 4 * MIN; }
    ok(kinds.join() === 'sulk,sulk,cross', `three blowUps 4 minutes apart: ${kinds.join()} (heat ${c.tease.heat})`);
    const d = tc(21); t = d.t; kinds = [];
    for (let k = 0; k < 3; k++) { const x = pats(d, t, 'back', 15, 150); kinds.push(x.ev.find(e => e.type === 'sulk' || e.type === 'cross').type); t = x.t + 8 * MIN; }
    ok(kinds.join() === 'sulk,sulk,sulk', `three blowUps 8 minutes apart: never cross (${kinds.join()})`);
    invariants(st, 'heat'); invariants(c, 'heat cross');
  }

  // the nose tap
  {
    const st = tc(22), t = st.t;
    let ev = E.act(st, 'boop', null, t).events;
    ok(ev[0].type === 'boop' && !ev[0].swat && has(ev, 'found', e => e.id === 'boop' && e.text === 'Když jí ťukneš do nosu, Koxa zašilhá a kýchne.') && st.tease.boops.join() === String(t), 'the first boop: she sneezes, Deníček');
    ev = E.act(st, 'boop', null, t + 10000).events;
    ok(ev.map(e => e.type).join() === 'boop' && st.tease.boops.length === 2 && !st.tease.kind, 'the second: a boop');
    invariants(st, 'two boops');
    ev = E.act(st, 'boop', null, t + 20000).events;
    ok(ev.map(e => e.type).join().startsWith('boop,sulk') && ev[0].swat === true && st.tease.boops.length === 0 && st.tease.kind === 'sulk' && near(heatAt(st, st.t), 1, 0.01), 'the third within 60 s: a swat and a sulk, heat +1');
    ok(E.act(st, 'boop', null, t + 30000).events[0].swat === undefined && st.tease.boops.length === 1, 'the next one counts from zero');
    invariants(st, 'boop swat');
    const sl = tc(23), t2 = sl.t;
    E.act(sl, 'boop', null, t2); E.act(sl, 'boop', null, t2 + 30000);
    ok(!E.act(sl, 'boop', null, t2 + 61000).events[0].swat && sl.tease.boops.length === 2, 'three nose taps over 61 s: no swat');
    E.advance(sl, t2 + 125000);
    ok(sl.tease.boops.length === 0, 'old nose taps are dropped');
    invariants(sl, 'boops dropped');
    const lp = tc(24); E.act(lp, 'lapOn', null, lp.t);
    const t3 = lp.t;
    ok(E.act(lp, 'boop', null, t3).events[0].type === 'boop' && lp.lap, 'a boop on the lap: she stays');
    E.act(lp, 'boop', null, t3 + 1000);
    ev = E.act(lp, 'boop', null, t3 + 2000).events;
    ok(ev.map(e => e.type).slice(0, 3).join() === 'lapLeave,boop,sulk' && ev[0].reason === 'annoyed' && !lp.lap, 'the swat on the lap: lapLeave (annoyed), boop, sulk');
    invariants(lp, 'boop lap');
    // a run of taps on the nose is patting the head
    const pn = tc(25), rn = pats(pn, pn.t, 'nose', 3, 400);
    ok(rn.ev.every(e => e.type === 'pat' && e.region === 'head') && pn.tease.boops.length === 0, 'pats on the nose: the head, not boops');
  }

  // the watering can
  {
    const st = tc(26);
    ok(E.act(st, 'splash', null, st.t).events.pop().reason === 'Konví se zalévá na zahradě.', 'splash in the house: refused');
    const w = tc(27, 'happy', at(2027, 1, 14, 10)); E.act(w, 'goGarden', null, w.t);
    ok(w.yard && E.act(w, 'splash', null, w.t).events.pop().reason === 'V zimě ne – byla by jí zima.', 'splash in winter: refused');
    const g = tc(28); E.act(g, 'goGarden', null, g.t);
    const a = clone(g); a.asleep = true; a.sleepAt = a.t; a.needs.energy = 50;
    ok(E.act(a, 'splash', null, a.t).events.pop().reason === 'Koxa spí. Nech ji spát.', 'splash asleep: refused');
    const tr = clone(g); tr.yard.tree = { since: tr.t, calls: 0 };
    ok(E.act(tr, 'splash', null, tr.t).events.pop().reason === 'Koxa je na stromě.', 'splash up the tree: refused');
    const o = friend(clone(g)); E.act(o, 'letOut', null, o.t);
    ok(o.out && E.act(o, 'splash', null, o.t).events.pop().reason === 'Koxa je venku.', 'splash while she is out: refused');
    for (const x of [st, w, a, tr, o]) invariants(x, 'splash refused');
    const l0 = g.needs.love, t = g.t, ref = clone(g);
    const ev = E.act(g, 'splash', null, t).events;
    ok(ev.map(e => e.type).slice(0, 2).join() === 'splash,sulk' && has(ev, 'found', e => e.id === 'splash'), 'splash: splash, sulk, Deníček');
    ok(g.wet === t + 30 * MIN && g.tease.splash === g.wet && E.health(g).splashed && E.health(g).wet && near(g.needs.love, l0 - 3, 1e-9) && near(heatAt(g, t), 2, 1e-6), 'wet for 30 min from the can, love −3, heat +2');
    const dry = clone(g); dry.wet = 0; dry.tease.splash = 0; dry.tease.kind = null; dry.tease.until = 0;
    ok(E.moodValue(dry) - E.moodValue(g) === 25, `mood: wet −15 and sulk −10 (${E.moodValue(dry)} → ${E.moodValue(g)})`);
    invariants(g, 'splash');
    E.act(g, 'splash', null, t + 10 * MIN);
    ok(g.wet === t + 40 * MIN && g.tease.splash === g.wet, 'a second splash: wet until max(wet, t + 30 min)');
    E.advance(g, t + 41 * MIN);
    ok(!E.health(g).splashed && !E.health(g).wet && g.tease.splash === 0, 'dry again: no longer from the can');
    invariants(g, 'splash dry');
    // already wetter from the rain: the can does not shorten it
    let rd = null; for (let s = 30; s < 200 && !rd; s++) { const p = E.create(s, T0, 'K'); for (let d = 0; d < 60 && !rd; d++) if (E.weather(T0 + d * D, p) === 'rain') rd = { s, t: T0 + d * D }; }
    const rn = E.create(rd.s, rd.t - H, 'Koxa'); E.advance(rn, rd.t); rn.needs.energy = 90;
    E.act(rn, 'goGarden', null, rd.t);
    const wr = rn.wet;
    ok(wr === rd.t + 120 * MIN && E.act(rn, 'splash', null, rd.t).events.some(e => e.type === 'splash') && rn.wet === wr && rn.tease.splash === 0 && !E.health(rn).splashed, 'wet from the rain: the can keeps the longer wet, not "from the can"');
    invariants(rn, 'splash rain');
    // rain after a splash still soaks her (coat −10, the wet event)
    let pair = null;
    for (let s = 1; s < 300 && !pair; s++) { const p = E.create(s, T0, 'K'); for (let d = 0; d < 80 && !pair; d++) { const x = at(2026, 6, 1 + d, 12); if (E.weather(x, p) !== 'rain' && E.weather(x + D, p) === 'rain') pair = { s, t: at(2026, 6, 1 + d, 23, 40) }; } }
    const pr = E.create(pair.s, pair.t - H, 'Koxa'); E.advance(pr, pair.t); pr.wokeAt = pr.t; pr.needs.energy = 90;
    E.act(pr, 'goGarden', null, pair.t); E.act(pr, 'splash', null, pair.t);
    ok(pr.tease.splash === pair.t + 30 * MIN, 'a splash before midnight');
    const c0 = pr.needs.coat, all = [];
    for (let k = 1; k <= 4; k++) all.push(...E.advance(pr, pair.t + k * 10 * MIN).events);
    ok(has(all, 'wet') && pr.needs.coat <= c0 - 10 && pr.wet > pr.t + 100 * MIN && pr.tease.splash === 0 && !E.health(pr).splashed, `rain after the splash: soaked, coat −10 (${c0} → ${pr.needs.coat})`);
    invariants(pr, 'rain after splash');
  }

  // the long offence (st.off, after an absence over 72 h) is untouched and blocks new sulks and paybacks
  {
    const st = tc(29); st.off = { until: st.t + 20 * H, turned: false };
    const off = JSON.stringify(st.off), l0 = st.needs.love;
    let r = pats(st, st.t, 'back', 15, 150);
    ok(has(r.ev, 'blowUp', e => e.why === 'fast') && !has(r.ev, 'sulk') && !has(r.ev, 'cross') && st.tease.kind === null && st.tease.pay === null && near(st.needs.love, l0 - 2, 0.02) && near(heatAt(st, st.t), 2, 0.01),
      'the long offence: the blowUp and its love and heat, but no sulk and no payback');
    r = pats(st, st.t + 3000, 'back', 12, 500);
    ok(has(r.ev, 'blowUp', e => e.why === 'grumpy'), 'slow pats on the back: grumpy (the long offence)');
    for (let k = 0; k < 3; k++) r = { ev: E.act(st, 'boop', null, st.t + 1000).events };
    ok(r.ev[0].swat === true && !has(r.ev, 'sulk'), 'the third boop: a swat, no sulk');
    E.act(st, 'goGarden', null, st.t);
    const se = E.act(st, 'splash', null, st.t).events;
    ok(has(se, 'splash') && !has(se, 'sulk') && !has(se, 'cross') && st.tease.kind === null && st.wet > st.t, 'the can: wet, no sulk');
    ok(JSON.stringify(st.off) === off, 'st.off never changes');
    invariants(st, 'long offence');
    // an absence over 72 h ends a sulk or cross and drops the payback
    const ab = tc(30); makeCross(ab);
    ok(ab.tease.kind === 'cross' && ab.tease.pay, 'a cross with a payback');
    const ra = E.advance(ab, ab.t + 4 * D).events;
    ok(has(ra, 'offended') && ab.tease.kind === null && ab.tease.until === 0 && ab.tease.pay === null && ab.off, 'away 4 days: no cross, no payback, the long offence instead');
    invariants(ab, 'absence');
  }

  // her payback: only shelf or ambush, once a day, it waits for a watching advance and a free cat, and lapses
  {
    const kinds = { shelf: 0, ambush: 0 };
    let ok1 = 0;
    for (let s = 1; s <= 30; s++) {
      const st = tc(200 + s); makeCross(st);
      const P = clone(st.tease.pay), U = st.tease.until, all = [];
      if (!P || !['shelf', 'ambush'].includes(P.kind) || P.at < U + 5 * MIN || P.at > U + 25 * MIN) { ok(false, `payback ${s}: planned 5–25 min after the cross (${JSON.stringify(P)})`); continue; }
      let when = 0;
      for (let k = 1; k <= 18; k++) { const e = E.advance(st, st.t + 10 * MIN).events; if (has(e, 'payback') && !when) when = st.t; all.push(...e); }
      const pb = all.filter(e => e.type === 'payback');
      if (pb.length === 1 && pb[0].kind === P.kind && when >= P.at && when < P.at + 10 * MIN && st.tease.pay === null && st.tease.payDay === dk(when) && st.diary.payback) { ok1++; kinds[P.kind]++; }
      else ok(false, `payback ${s}: ${JSON.stringify(pb)} at ${when} planned ${JSON.stringify(P)}`);
      invariants(st, `payback ${s}`);
    }
    ok(ok1 === 30 && kinds.shelf > 3 && kinds.ambush > 3, `a cross: one payback when due (${JSON.stringify(kinds)})`);
    // the Deníček text
    const dt = tc(231); makeCross(dt); for (let k = 0; k < 18; k++) E.advance(dt, dt.t + 10 * MIN);
    ok(E.diary(dt).find(e => e.id === 'payback').text === 'Koxa ti to vrátila. Co se škádlívá, to se rádo mívá!', 'Deníček: payback');
    // a sulk plans one with chance 0.5
    let planned = 0;
    for (let s = 1; s <= 200; s++) { const x = tc(300 + s); pats(x, x.t + s * 1000, 'back', 15, 150); if (x.tease.pay) planned++; }
    ok(planned > 70 && planned < 130, `a sulk plans a payback about half the time (${planned}/200)`);
    // once a day: after a payback no new one is planned that day; the next day again
    const st = tc(232); makeCross(st);
    for (let k = 0; k < 18; k++) E.advance(st, st.t + 10 * MIN);
    ok(st.diary.payback && st.tease.payDay > 0, 'a payback today');
    makeCross(st);
    ok(st.tease.kind === 'cross' && st.tease.pay === null, 'another cross the same day: no payback planned');
    let more = 0; for (let k = 0; k < 18; k++) more += cnt(E.advance(st, st.t + 10 * MIN).events, 'payback');
    ok(more === 0, 'no second payback that day');
    const nd = clone(st); E.advance(nd, at(2026, 6, 11, 10)); nd.needs.energy = 90;
    if (nd.asleep) { nd.asleep = false; nd.wokeAt = nd.t; }
    makeCross(nd);
    ok(nd.tease.pay !== null, 'the next day: planned again');
    invariants(st, 'payback once a day'); invariants(nd, 'payback next day');
    // the garden: always the ambush (no kitchen counter there)
    let amb = 0, gs = 0;
    for (let s = 1; s <= 10; s++) {
      const g = tc(400 + s); E.act(g, 'goGarden', null, g.t);
      for (let k = 0; k < 3; k++) E.act(g, 'splash', null, g.t + 2000);
      if (g.tease.kind !== 'cross' || !g.tease.pay) { ok(false, `garden ${s}: three splashes make a cross`); continue; }
      const all = []; for (let k = 0; k < 18; k++) all.push(...E.advance(g, g.t + 10 * MIN).events);
      const pb = all.filter(e => e.type === 'payback');
      if (pb.length) { gs++; if (pb.every(e => e.kind === 'ambush')) amb++; }
      invariants(g, `garden payback ${s}`);
    }
    ok(gs >= 7 && amb === gs, `in the garden it is always the ambush (${amb}/${gs})`);
    // it waits: not while the advance is not watching (a jump over an hour), then at the next watching one
    const wa = tc(233); makeCross(wa);
    const P = wa.tease.pay, t0 = wa.t;
    ok(!has(E.advance(wa, t0 + 61 * MIN).events, 'payback') && wa.tease.pay && wa.tease.pay.at === P.at, 'a jump over an hour: it waits');
    ok(has(E.advance(wa, t0 + 71 * MIN).events, 'payback'), 'the next watching advance: the payback');
    // it waits while she sleeps, comes when she is awake again
    const sl = tc(234); makeCross(sl);
    const P2 = clone(sl.tease.pay), ev2 = [];
    E.advance(sl, sl.tease.until); sl.asleep = true; sl.sleepAt = sl.t; sl.needs.energy = 30;
    while (sl.t < P2.at + 20 * MIN) ev2.push(...E.advance(sl, sl.t + 10 * MIN).events);
    ok(!has(ev2, 'payback') && sl.asleep && sl.tease.pay, 'asleep when it is due: it waits');
    sl.asleep = false; sl.wokeAt = sl.t; sl.needs.energy = 90;
    ok(has(E.advance(sl, sl.t + 10 * MIN).events, 'payback'), 'awake again: the payback');
    invariants(sl, 'payback waits');
    // and it lapses after 120 min
    const lp = tc(235); makeCross(lp);
    const P3 = clone(lp.tease.pay);
    ok(!has(E.advance(lp, P3.at + 121 * MIN).events, 'payback') && lp.tease.pay === null && !lp.diary.payback, 'not seen within 120 min: it lapses silently');
    let late = 0; for (let k = 0; k < 6; k++) late += cnt(E.advance(lp, lp.t + 10 * MIN).events, 'payback');
    ok(late === 0, 'and never comes later');
    invariants(lp, 'payback lapses');
  }

  // the step length never matters: 10-minute and 10-second advances give the same tease, off and paybacks
  {
    for (const s of [500, 501, 502, 503]) {
      const st = tc(s);
      pats(st, st.t, 'tailBase', 4, 500, { cv: 0.5 });   // the love window
      E.act(st, 'boop', null, st.t + 1000); E.act(st, 'boop', null, st.t + 1000);   // two nose taps
      if (s % 2) makeCross(st); else pats(st, st.t + 2000, 'back', 15, 150);       // a cross, or a sulk
      const A = clone(st), B = clone(st), t0 = st.t, pa = [], pb = [];
      for (let t = t0 + 10 * MIN; t <= t0 + 3 * H; t += 10 * MIN) pa.push(...E.advance(A, t).events.filter(e => /^(payback|sulkEnd|crossEnd)$/.test(e.type)).map(e => e.type + (e.kind || '')));
      for (let t = t0 + 10000; t <= t0 + 3 * H; t += 10000) pb.push(...E.advance(B, t).events.filter(e => /^(payback|sulkEnd|crossEnd)$/.test(e.type)).map(e => e.type + (e.kind || '')));
      ok(JSON.stringify([A.tease, A.off]) === JSON.stringify([B.tease, B.off]) && pa.join() === pb.join() && pa.length > 0,
        `seed ${s}: the same tease after 18 × 10 min and 1080 × 10 s (${pa.join()})`);
      invariants(A, 'steps A'); invariants(B, 'steps B');
    }
  }

  // the clock moved back: every moment moves with it, the days are clamped
  {
    const st = tc(36); E.act(st, 'goGarden', null, st.t);
    pats(st, st.t, 'tailBase', 8, E.patTempo(st));                        // bondDay, the love window
    E.act(st, 'boop', null, st.t + 1000); E.act(st, 'boop', null, st.t + 1000);   // two nose taps
    pats(st, st.t + 3000, 'tail', 3, 300);                                       // a warning
    for (let k = 0; k < 3; k++) E.act(st, 'splash', null, st.t + 2000);           // a cross, wet from the can, a payback planned
    st.tease.warnAt = st.tease.at - 500;                                         // (the splash ended the run: a warning by hand)
    st.tease.payDay = Math.floor(st.tease.bondDay / 100) * 100 + 1;              // a payback on the 1st of the month
    E.repair(st); invariants(st, 'before the clock moves back');
    const b = clone(st), d = -11 * H;
    ok(b.tease.kind === 'cross' && b.tease.pay && b.tease.splash && b.tease.gainAt && b.tease.warnAt && b.tease.boops.length === 2 && b.tease.bondDay > b.tease.payDay, 'every field set');
    ok(E.advance(st, st.t + d).events.length === 0, 'no events');
    const T = st.tease, B = b.tease;
    ok(T.until === B.until + d && T.at === B.at + d && T.warnAt === B.warnAt + d && T.gainAt === B.gainAt + d && T.splash === B.splash + d && st.wet === T.splash &&
      T.boops.join() === B.boops.map(x => x + d).join() && T.pay.at === B.pay.at + d && T.pay.kind === B.pay.kind && T.heat === B.heat && T.gain === B.gain, 'until, at, warnAt, gainAt, splash, boops, pay.at move; heat and gain stay');
    const today = dk(st.t);
    ok(T.bondDay === today && today < B.bondDay && T.payDay === B.payDay, `bondDay clamped to the new today (${B.bondDay} → ${T.bondDay}), an older payDay kept`);
    invariants(st, 'clock moved back');
    ok(E.health(st).cross && E.health(st).splashed && E.health(st).teaseUntil === T.until, 'still cross and wet from the can');
  }

  // repair: garbage in tease gives the canonical default or the valid parts; older saves get the default
  {
    const base = tc(37), t = base.t;
    base.wet = t + 20 * MIN;
    const G = [
      [null, FRESH], ['x', FRESH], [[1, 2], FRESH], [{}, FRESH], [{ kind: 'plague', until: t + MIN }, FRESH],
      [{ kind: 'sulk', until: t + 10 * MIN }, FRESH], [{ kind: 'sulk', until: t }, FRESH], [{ kind: 'cross', until: t + 21 * MIN }, FRESH],
      [{ heat: 7, at: 0 }, FRESH], [{ heat: 99, at: t - MIN, warnAt: t }, null], [{ boops: [t + 1, t - 70000, 'x', t - 5000, t - 3000, t - 1000] }, null],
      [{ gain: 50, gainAt: t - MIN }, null], [{ gain: 5, gainAt: t - 11 * MIN }, FRESH], [{ pay: { kind: 'tray', at: t } }, FRESH],
      [{ pay: { kind: 'shelf', at: t + 50 * MIN } }, FRESH], [{ pay: { kind: 'shelf', at: t - 121 * MIN } }, FRESH], [{ payDay: 20991231, bondDay: 'x' }, FRESH],
      [{ splash: t + 10 * MIN }, FRESH], [{ extra: 1, kind: null }, FRESH],
    ];
    for (const [g, want] of G) {
      const s = clone(base); s.tease = g; E.repair(s);
      invariants(s, `repair tease ${JSON.stringify(g)}`);
      if (want) ok(JSON.stringify(s.tease) === want, `repair tease ${JSON.stringify(g)}: the default`);
    }
    const s1 = clone(base); s1.tease = { heat: 99, at: t - MIN, warnAt: t, boops: [t + 1, t - 70000, 'x', t - 5000, t - 3000, t - 1000], gain: 50, gainAt: t - MIN, kind: 'cross', until: t + 20 * MIN,
      pay: { kind: 'ambush', at: t + 45 * MIN, x: 1 }, payDay: 20260101, bondDay: 20260610, splash: t + 20 * MIN };
    E.repair(s1);
    ok(JSON.stringify(s1.tease) === JSON.stringify({ kind: 'cross', until: t + 20 * MIN, heat: 10, at: t - MIN, warnAt: 0, boops: [t - 3000, t - 1000], gain: 8, gainAt: t - MIN, pay: { kind: 'ambush', at: t + 45 * MIN }, payDay: 20260101, bondDay: 20260610, splash: t + 20 * MIN }),
      `repair keeps the valid parts in the canonical order (${JSON.stringify(s1.tease)})`);
    const lo = clone(s1); lo.off = { until: t + 5 * H, turned: false }; E.repair(lo);
    ok(lo.tease.kind === null && lo.tease.until === 0 && lo.tease.pay === null && lo.off.until === t + 5 * H, 'during the long offence repair drops the sulk/cross and the payback, st.off stays');
    const old = clone(base); delete old.tease; E.repair(old);
    ok(JSON.stringify(old.tease) === FRESH && Object.keys(old).pop() === 'tease', 'an older save without tease: the default');
    invariants(old, 'old save'); E.act(old, 'pat', { region: 'tailBase', n: 3, ms: 500 }, old.t + 1000); invariants(old, 'old save patted');
  }

  // mood and the launcher's forecast during a sulk
  {
    const st = tc(38); pats(st, st.t, 'back', 8, 500, { eating: true });
    const ref = clone(st); ref.tease.kind = null; ref.tease.until = 0;
    ok(E.moodValue(ref) - E.moodValue(st) === 10, 'a sulk: mood −10');
    const fa = clone(st), fb = clone(ref);   // the launcher moves a copy on (the 'ahead' forecast)
    E.advance(fa, st.tease.until + MIN); E.advance(fb, st.tease.until + MIN);
    ok(E.moodValue(fa) === E.moodValue(fb) && !E.health(fa).sulk, 'moved on past the end: the mood as without the sulk');
    const hm = E.health(st);
    ok(hm.sulk === true && hm.cross === false && hm.splashed === false && hm.teaseUntil === st.tease.until && E.health(ref).teaseUntil === 0, 'health: sulk, cross, splashed, teaseUntil');
  }

  // the lap: patting and a nose tap keep her there; a blowUp or loveBite ends it first
  {
    const st = tc(39); E.act(st, 'lapOn', null, st.t);
    const t = st.t;
    let ev = E.act(st, 'pat', { region: 'back', n: 2, ms: 500, cv: 0.5 }, t + 1000).events;
    ok(ev.map(e => e.type).join() === 'pat' && ev[0].stage === 'like' && st.lap && st.lap.pet === t + 1000, 'a pat on the lap: like, she stays, it counts as stroking');
    ev = E.act(st, 'boop', null, t + 2000).events;
    ok(st.lap && ev[0].type === 'boop', 'a boop on the lap: she stays');
    const r = pats(st, t + 5000, 'back', 15, 150);
    const li = idx(r.ev, 'lapLeave');
    ok(li >= 0 && r.ev[li].reason === 'annoyed' && r.ev[li + 1].type === 'blowUp' && r.ev[li + 1].lap === true && r.ev[li + 2].type === 'sulk' && !st.lap, 'a blowUp on the lap: lapLeave (annoyed), blowUp { lap }, sulk');
    invariants(st, 'lap blowUp');
    const lb = tc(40); E.act(lb, 'lapOn', null, lb.t);
    const r2 = pats(lb, lb.t, 'head', 25, 300);
    const bi = idx(r2.ev, 'loveBite');
    ok(bi > 0 && r2.ev[bi - 1].type === 'lapLeave' && r2.ev[bi].lap === true && !lb.lap && !has(r2.ev, 'sulk'), 'a loveBite on the lap: lapLeave, loveBite { lap }, no sulk');
    const sp = tc(41); E.act(sp, 'goGarden', null, sp.t); E.act(sp, 'lapOn', null, sp.t);
    const e3 = E.act(sp, 'splash', null, sp.t + 1000).events;
    ok(e3[0].type === 'lapOff' && has(e3, 'splash') && !sp.lap, 'the can is not a lap action: the player stands up first');
    invariants(lb, 'lap loveBite'); invariants(sp, 'lap splash');
  }

  // with a visitor: while she sulks no joint act goes on and no jealousy starts
  {
    const st = tc(42); E.act(st, 'goGarden', null, st.t); st.lvl = 1; st.bond = 100;
    st.visitors.sedivka = { friend: 5, pal: 3.5, met: st.t, visits: 3, fed: 0 };
    st.visit = { id: 'sedivka', since: st.t, until: st.t + 2 * H, gain: 0, palGain: 0, greeted: true, act: { kind: 'snuggle', since: st.t, with: 'koxa' } };
    E.repair(st);
    ok(st.visit && st.visit.act.with === 'koxa', 'snuggling with Šedivka');
    E.act(st, 'splash', null, st.t + 1000);
    E.advance(st, st.t + 10000);
    ok(st.visit && st.visit.act.with === null, 'a sulk: the joint act ends at the next step');
    let jl = 0;
    for (let k = 0; k < 40; k++) jl += cnt(E.act(st, 'strokeVisitor', { id: 'sedivka', region: 'back', along: true, speed: 300 }, st.t + 1000).events, 'jealous');
    ok(st.tease.kind === 'sulk' && jl === 0, 'no jealousy while she sulks');
    invariants(st, 'visitor sulk');
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
