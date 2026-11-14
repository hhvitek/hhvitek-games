#!/usr/bin/env node
// Tests the Přistání engine (games/pristani/index.html, the block between "Engine" and "Engine end") in Node:
//   node tools/pristani-test.js              rules, failure modes, scoring, daily missions and the autopilot table
//   node tools/pristani-test.js --seeds N    fly every mission with N seeds (default 4)
//   node tools/pristani-test.js --dates N    check N daily missions (default 60)
//   node tools/pristani-test.js --beginner N  tries per mission for the simulated beginner (default 40, m01 five times as many)
//   node tools/pristani-test.js --pars       print the fuel pars measured now (paste them into PARS after changing
//                                            the physics, the autopilot or a mission)
//   node tools/pristani-test.js --file X     test the engine in another file (an .html with the same block, or a .js
//                                            that holds only the block)
// Only Node's built-in modules. Exit code 1 when anything fails.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const file = opt('--file', path.join(__dirname, '..', 'games', 'pristani', 'index.html'));
const SEEDS = Math.max(1, +opt('--seeds', 4));
const DATES = Math.max(1, +opt('--dates', 60));
const src = fs.readFileSync(file, 'utf8');
const block = file.endsWith('.js') ? src : (src.match(/\/\* -{10} Engine -{10} \*\/([\s\S]*?)\/\* -{10} Engine end -{10} \*\//) || [])[1];
if (!block) { console.error('No Engine block in ' + file); process.exit(1); }
const E = new Function(block + '\nreturn PristaniEngine();')();
const { DT, DEG, LIMITS, ROCKET } = E;

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.log('  FAIL ' + msg); } };
const near = (a, b, eps) => Math.abs(a - b) <= eps;
const byId = id => E.MISSIONS.find(m => m.id === id);
const run = (f, input, seconds) => { const n = Math.round(seconds / DT); for (let i = 0; i < n; i++) E.step(f, typeof input === 'function' ? input(f) : input, DT); return f; };
const until = (f, input, cond, seconds = 30) => { for (let i = 0; i < seconds / DT && !cond(f); i++) E.step(f, input, DT); return f; };
const types = f => E.takeEvents(f).map(e => e.type);
const NONE = { left: false, right: false, burn: false };
const BURN = { left: false, right: false, burn: true };

if (args.includes('--pars')) {
  const out = E.MISSIONS.map(m => { const f = E.fly(m, m.seed, 'score'); return `${m.id}: ${f.outcome.ok ? Math.round((m.fuel - f.fuel) * E.PAR_SHARE * 10) / 10 : 'null'}`; });
  console.log(`Object.assign(PARS, { ${out.join(', ')} });`);
  process.exit(0);
}

// a flight placed by hand: dx from the pad centre, gap = height of the lowest foot (or the base) above the surface
function place(m, o) {
  const f = E.createFlight(m, o.seed || m.seed);
  const legs = o.legs == null ? 1 : o.legs;
  f.legs = legs; f.legsOut = legs > 0;
  f.a = (o.tilt || 0) * DEG; f.w = 0;
  f.x = f.deck.x + (o.dx || 0);
  const pts = [[-ROCKET.radius, 0], [ROCKET.radius, 0], [0, 0]];
  if (legs > 0) pts.push(...[-1, 1].map(s => { const b = E.footBody(legs, s); return [b.x, b.y]; }));
  const low = Math.min(...pts.map(([bx, by]) => E.toWorld(0, 0, f.a, bx, by).y));
  const sy = E.surfaceY(f, f.x, f.t, f.deck);
  f.y = sy + (o.gap == null ? 0.02 : o.gap) - low;
  f.vx = (o.vx || 0) + (o.relDeck ? f.deck.vx : 0); f.vy = (o.vy || 0) + (o.relDeck ? f.deck.vy : 0);
  if (o.fuel != null) f.fuel = o.fuel;
  E.takeEvents(f);
  return f;
}

/* ---------- Missions ---------- */
console.log('Missions');
ok(E.MISSIONS.length === 24, `24 missions (${E.MISSIONS.length})`);
ok(E.CHAPTERS.length === 6, '6 chapters');
ok(new Set(E.MISSIONS.map(m => m.id)).size === 24, 'unique mission ids');
for (const c of E.CHAPTERS) ok(E.MISSIONS.filter(m => m.chapter === c.id).length === 4, `chapter ${c.id} has 4 missions`);
for (const m of E.MISSIONS) {
  const p = `${m.id} ${m.name}:`;
  ok(m.name && m.what && /[a-zá-ž]/i.test(m.what), `${p} a Czech name and a sentence`);
  ok(m.g > 0 && m.air >= 0 && m.twr > 1 && m.fuel > 0, `${p} gravity, air, thrust, fuel`);
  ok(m.ignitions === null || (Number.isInteger(m.ignitions) && m.ignitions >= 1), `${p} ignitions null or ≥ 1`);
  ok((m.pad.kind === 'barge') === (m.surface === 'sea'), `${p} a barge exactly on the sea`);
  ok(['land', 'sea'].includes(m.surface) || m.world !== 'earth', `${p} surface`);
  ok(m.start.alt > m.legAlt * 2, `${p} starts well above the leg height`);
  ok(['day', 'sunset', 'night', 'storm', 'fog', 'moon', 'mars', 'dust'].includes(m.scene.sky), `${p} sky`);
  ok(E.parOf(m) > 0 && E.parOf(m) < m.fuel, `${p} a fuel par below the tank`);
  ok(m.pad.halfWidth >= ROCKET.footX + 3, `${p} the pad leaves at least 3 m beside each foot`);
}
for (const m of E.MISSIONS.filter(m => m.chapter === 5)) {
  const f = E.createFlight(m);
  const full = E.thrustAccel(f) / m.g; f.fuel = 0.05 * f.fuel0; const empty = E.thrustAccel(f) / m.g;
  ok(full > 1.8 && empty > 2.3 && empty < 2.6, `${m.id}: cannot hover (thrust ${full.toFixed(2)} g full, ${empty.toFixed(2)} g nearly empty)`);
}
for (const m of E.MISSIONS.filter(m => m.chapter <= 4)) {
  const f = E.createFlight(m);
  const full = E.thrustAccel(f) / m.g;
  ok(full > 1.1 && full < 1.5, `${m.id}: can hover a bit (thrust ${full.toFixed(2)} g)`);
}
for (const m of E.MISSIONS.filter(m => m.chapter === 6)) {
  const f = E.createFlight(m), full = E.thrustAccel(f);
  ok(near(full, 1.3 * 9.81, 0.01) && full / m.g > 3 && m.ignitions >= 2, `${m.id}: the Earth engine on a light world, far too strong (${(full / m.g).toFixed(1)} g), ${m.ignitions} ignitions`);
}
ok(byId('m21').air === 0 && byId('m21').g === 1.62, 'the Moon: 1.62 m/s², no air');
ok(byId('m23').g === 3.71 && byId('m23').air > 0 && byId('m23').air < 0.2, 'Mars: 3.71 m/s², thin air');
ok(byId('m19').ignitions === 1 && byId('m20').ignitions === 1 && byId('m20').pad.kind === 'barge', 'single ignition on land and on the barge');

/* ---------- Determinism ---------- */
console.log('Determinism');
{
  const m = byId('m16'); // gusts, waves, drift
  const script = seed => { const r = E.rng(seed); let cur = NONE; return () => { if (r() < 0.04) cur = { left: r() < 0.3, right: r() < 0.3, burn: r() < 0.6 }; return cur; }; };
  const a = E.createFlight(m, 7), b = E.createFlight(m, 7), ia = script(99), ib = script(99);
  const evA = [], evB = [];
  let same = true;
  for (let i = 0; i < 40 / DT && !a.over; i++) {
    E.step(a, ia(), DT); E.step(b, ib(), DT);
    evA.push(...E.takeEvents(a)); evB.push(...E.takeEvents(b));
    if (a.x !== b.x || a.y !== b.y || a.a !== b.a || a.fuel !== b.fuel) same = false;
  }
  ok(same && JSON.stringify(evA) === JSON.stringify(evB) && JSON.stringify(a.outcome) === JSON.stringify(b.outcome), 'same mission, seed and inputs give the same flight');
  const c = E.createFlight(m, 8);
  ok(E.windAt(c, 10, 300) !== E.windAt(a, 10, 300) && E.deckAt(c, 10).y !== E.deckAt(E.createFlight(m, 7), 10).y, 'another seed gives other gusts and waves');
  const f1 = E.fly(m, 3, 'score'), f2 = E.fly(m, 3, 'score');
  ok(f1.outcome.t === f2.outcome.t && f1.fuel === f2.fuel && f1.x === f2.x, 'the autopilot flies the same flight twice');
}

/* ---------- Steering ---------- */
console.log('Steering');
{
  const m = byId('m01'), f = E.createFlight(m);
  let maxRate = 0, prev = f.a;
  for (let i = 0; i < 2 / DT; i++) { E.step(f, { right: true }, DT); maxRate = Math.max(maxRate, Math.abs(f.a - prev) / DT); prev = f.a; }
  ok(f.a > 39.9 * DEG && f.a <= 40 * DEG + 1e-9, `right tilts the nose right up to 40° (${(f.a / DEG).toFixed(1)}°)`);
  ok(maxRate <= 70 * DEG + 1e-6 && maxRate > 65 * DEG, `turning rate at most 70 °/s (${(maxRate / DEG).toFixed(1)})`);
  let maxLevel = 0; prev = f.a;
  for (let i = 0; i < 3 / DT; i++) { E.step(f, NONE, DT); maxLevel = Math.max(maxLevel, Math.abs(f.a - prev) / DT); prev = f.a; }
  ok(Math.abs(f.a) < 0.5 * DEG, `with no input it levels itself (${(f.a / DEG).toFixed(2)}° after 3 s)`);
  ok(maxLevel <= 25 * DEG + 1e-6, `levelling at most 25 °/s (${(maxLevel / DEG).toFixed(1)})`);
  const g = E.createFlight(m); run(g, { left: true }, 0.6); const vx0 = g.vx; run(g, { left: true, burn: true }, 1);
  ok(g.a < 0 && g.vx < vx0 - 1, 'left tilts the nose left and the burn pushes the rocket left (never inverted)');
  const h = E.createFlight(m); run(h, { steer: 0.5 }, 0.5);
  ok(h.a > 10 * DEG && h.a < 20 * DEG, `an analog steer turns at half rate (${(h.a / DEG).toFixed(1)}° after 0.5 s)`);
  const both = E.createFlight(m); run(both, { right: true }, 0.3); run(both, { left: true, right: true, burn: true }, 3);
  ok(Math.abs(both.a) < 1 * DEG, 'both sides = burn straight while the nose returns upright');
}

/* ---------- Engine, ignitions, fuel ---------- */
console.log('Engine');
{
  const m = byId('m01'), f = E.createFlight(m);
  run(f, BURN, 0.125); const half = f.throttle; run(f, BURN, 0.125);
  ok(near(half, 0.5, 0.02) && f.throttle > 0.999, `spool-up about 0.25 s (${half.toFixed(2)} at 0.125 s)`);
  const fuel0 = f.fuel; run(f, BURN, 1);
  ok(near(fuel0 - f.fuel, 1, 0.01), 'full throttle burns 1 s of fuel per second');
  ok(types(f).filter(t => t === 'ignition').length === 1 && f.ignLeft === null, 'unlimited ignitions: ignLeft null, one ignition event');
  run(f, NONE, 0.2); ok(f.throttle === 0, 'the flame dies within 0.1 s');
  f.fuel = 0.05; run(f, BURN, 0.5);
  const ev = types(f);
  ok(f.fuel === 0 && !f.burning && ev.includes('fuelOut'), 'fuel runs out: fuelOut, engine off');
  run(f, NONE, 0.1); run(f, BURN, 0.2);
  ok(types(f).includes('noIgnition') && f.throttle === 0, 'no fuel: noIgnition, no thrust');
}
{
  const m = byId('m18'), f = E.createFlight(m); // 2 ignitions
  run(f, BURN, 0.5);
  let ev = types(f);
  ok(f.ignLeft === 1 && ev.filter(t => t === 'ignition').length === 1, 'the first burn uses an ignition');
  run(f, NONE, 0.25); run(f, BURN, 0.3);
  ev = types(f);
  ok(f.ignLeft === 1 && ev.includes('cutoff') && !ev.includes('ignition') && !ev.includes('shutdown'), 'off for 0.25 s: a cutoff, but the same burn');
  run(f, NONE, 0.35);
  ok(types(f).includes('shutdown'), 'off for more than 0.3 s ends the burn (shutdown event)');
  run(f, BURN, 0.3);
  ok(f.ignLeft === 0 && types(f).includes('ignition'), 'the second burn uses the last ignition');
  run(f, NONE, 0.4); types(f);
  run(f, BURN, 0.5);
  ev = E.takeEvents(f);
  ok(f.ignLeft === 0 && f.throttle === 0 && ev.filter(e => e.type === 'noIgnition').length === 1 && ev[0].why === 'ignitions', 'none left: one noIgnition event while held, no thrust');
  run(f, NONE, 0.05); run(f, BURN, 0.05);
  ok(types(f).filter(t => t === 'noIgnition').length === 1, 'a new press flags noIgnition again');
  ok(f.ignUsed === 2, 'ignUsed counts the ignitions');
}

/* ---------- Legs ---------- */
console.log('Legs');
{
  const fb = E.footBody(1, 1), fl = E.footBody(1, -1), f0 = E.footBody(0, 1);
  ok(near(fb.x, ROCKET.footX, 1e-9) && near(fb.y, ROCKET.footY, 1e-9) && near(fl.x, -ROCKET.footX, 1e-9), 'deployed feet at ±8.5 m, 2 m below the base');
  ok(f0.y > 5 && near(f0.x, ROCKET.radius, 0.01), 'folded legs lie along the body');
  const m = byId('m01'), f = E.createFlight(m);
  ok(f.legs === 0 && !f.legsOut, 'legs folded at the start');
  let deployAt = -1, lockedAt = -1;
  for (let i = 0; i < 60 / DT && lockedAt < 0; i++) {
    E.step(f, E.autopilot(f, 'safe'), DT);
    for (const e of E.takeEvents(f)) { if (e.type === 'legsDeploy') { deployAt = f.t; ok(f.alt < m.legAlt && f.alt > m.legAlt - 3, `legs start below ${m.legAlt} m (${f.alt.toFixed(1)})`); } if (e.type === 'legsLocked') lockedAt = f.t; }
  }
  ok(deployAt > 0 && near(lockedAt - deployAt, ROCKET.legTime, 2 * DT), `legs take 0.8 s (${(lockedAt - deployAt).toFixed(3)})`);
}

/* ---------- Touchdown rules at their edges ---------- */
console.log('Touchdown rules');
{
  const J = o => E.judgeTouchdown(Object.assign({ legs: 1, vDown: 1, vSide: 0, tilt: 0, axisS: 0, feetS: [-8.5, 8.5], hw: 30, sea: false }, o));
  const feetAt = s => [s - 8.5, s + 8.5];
  ok(J({}).reason === 'landed' && J({}).ok, 'a gentle centred touchdown lands');
  ok(J({ vDown: 4 }).ok && J({ vDown: 4.001 }).reason === 'fastDown' && J({ vDown: 4.001 }).fate === 'explode', 'vertical speed: 4 m/s lands, more explodes');
  ok(J({ vSide: 2 }).ok && J({ vSide: 2.001 }).reason === 'fastSide', 'sideways: 2 m/s lands, more is too fast');
  ok(J({ tilt: 8 }).ok && J({ tilt: -8 }).ok && J({ tilt: 8.001 }).reason === 'tilt', 'tilt: 8° lands, more tips over');
  ok(J({ tilt: 25 }).fate === 'tip' && J({ tilt: -20 }).fate === 'tip' && J({ tilt: 25.1 }).fate === 'explode', 'tilt up to 25° tips over (animated), more explodes at once');
  ok(J({ legs: 0.99 }).reason === 'noLegs' && J({ legs: 0.99 }).fate === 'explode', 'legs not fully out = crash');
  ok(J({ axisS: 21.5, feetS: feetAt(21.5) }).ok, 'a foot exactly at the edge still lands');
  const edge = J({ axisS: 22, feetS: feetAt(22) });
  ok(edge.reason === 'edge' && edge.fate === 'tip' && near(edge.footOff, 0.5, 1e-9), 'a foot 0.5 m off the edge tips over');
  ok(J({ axisS: 40, feetS: feetAt(40) }).reason === 'offPad' && J({ axisS: 40, feetS: feetAt(40) }).fate === 'explode', 'off the pad on land explodes');
  ok(J({ axisS: 40, feetS: feetAt(40), sea: true }).fate === 'splash', 'off the barge splashes');
  ok(J({ axisS: 32, feetS: feetAt(32), legs: 0.5 }).reason === 'offPad' && J({ axisS: 20, feetS: feetAt(20), legs: 0.5 }).reason === 'noLegs', 'without legs: the axis decides between off the pad and no legs');
  ok(J({ vDown: 5, axisS: 22, feetS: feetAt(22) }).reason === 'fastDown', 'too fast wins over a foot off the edge');
  ok(J({ vDown: 5, tilt: 12 }).reason === 'fastDown' && J({ vSide: 3, tilt: 12 }).reason === 'fastSide', 'speeds come before the tilt');
}

/* ---------- Failure modes, end to end ---------- */
console.log('Failure modes');
function outcome(f, seconds = 15) { until(f, NONE, x => x.over, seconds); return f; }
{
  const land = byId('m01'), narrow = byId('m04'), sea = byId('m05'), waves = byId('m06');
  let f = outcome(place(land, { vy: -2 }));
  let ev = types(f);
  ok(f.outcome.ok && f.phase === 'landed' && ev.includes('touchdown') && ev.includes('landed') && ev.includes('over'), 'soft touchdown on the pad: landed');
  ok(near(f.outcome.vDown, 2.1, 0.1) && E.score(f).total > 0, `landed: vDown measured (${f.outcome.vDown.toFixed(2)}, 2 m/s plus two steps of gravity) and scored`);
  f = outcome(place(land, { vy: -7 }));
  ok(f.outcome.reason === 'fastDown' && f.phase === 'exploded' && types(f).includes('explode'), 'too fast: explodes on the pad');
  const tx = E.outcomeText(f);
  ok(/Dosednutí 7,\d m\/s, nejvýš 4 m\/s/.test(tx.detail) && tx.title, `fail text with the numbers ("${tx.title}: ${tx.detail}")`);
  f = outcome(place(land, { vx: 3, vy: -1 }));
  ok(f.outcome.reason === 'fastSide' && /Do strany 3,0 m\/s, nejvýš 2 m\/s/.test(E.outcomeText(f).detail), 'too fast sideways');
  f = place(land, { tilt: 14, vy: -1 });
  until(f, NONE, x => x.phase !== 'flying');
  ok(f.outcome.reason === 'tilt' && f.phase === 'tipping', `too tilted: tips over (${f.outcome.tilt.toFixed(1)}°)`);
  const a0 = f.a; until(f, NONE, x => x.phase !== 'tipping', 10);
  ok(f.phase === 'exploded' && Math.abs(f.a) > Math.abs(a0) + 60 * DEG && types(f).includes('explode'), 'the tipping rocket falls on its side and explodes');
  f = outcome(place(land, { tilt: 30, vy: -1 }));
  ok(f.outcome.reason === 'tilt' && f.outcome.fate === 'explode', 'more than 25°: explodes at once');
  f = place(land, { legs: 0, vy: -2, gap: 0.05 });
  outcome(f);
  ok(f.outcome.reason === 'noLegs' && /Nohy/.test(E.outcomeText(f).title), 'no legs: crash');
  f = place(narrow, { dx: narrow.pad.halfWidth - ROCKET.footX + 1.5, vy: -1 });
  until(f, NONE, x => x.phase !== 'flying');
  ok(f.outcome.reason === 'edge' && f.phase === 'tipping' && f.post.dir === 1, 'a foot off the narrow pad: tips over the edge');
  until(f, NONE, x => x.over, 15);
  ok(f.phase === 'exploded', 'over the edge on land: explodes');
  f = outcome(place(land, { dx: 60, vy: -3 }));
  ok(f.outcome.reason === 'offPad' && f.outcome.where === 'ground' && f.phase === 'exploded' && /Dopad 60 m/.test(E.outcomeText(f).detail), 'off the pad on land: explodes on the ground');
  f = outcome(place(sea, { dx: 80, vy: -10 }));
  ev = types(f);
  const sink0 = f.sink; run(f, NONE, 2);
  ok(f.outcome.reason === 'offPad' && f.phase === 'sinking' && ev.includes('splash') && sink0 > 8 && f.sink > sink0 && Math.abs(f.a) > 45 * DEG, `off the barge: splash, it tips and sinks (${sink0.toFixed(1)} m when over, ${f.sink.toFixed(1)} m later)`);
  ok(/Loď minuta o \d+ m/.test(E.outcomeText(f).detail), 'sea fail text');
  f = place(sea, { dx: sea.pad.halfWidth - ROCKET.footX + 0.5, vy: -1 });
  until(f, NONE, x => x.phase !== 'flying');
  ok(f.outcome.reason === 'edge' && f.outcome.where === 'deck', 'a foot off the deck');
  until(f, NONE, x => x.over, 20);
  ok(f.phase === 'sinking' && types(f).includes('splash'), 'over the deck edge: into the sea');
  // the barge moves: speeds are taken relative to the deck
  f = place(waves, { vy: -1, relDeck: true, seed: 5 });
  const deckVy = f.deck.vy;
  outcome(f);
  ok(f.outcome.ok && near(f.outcome.vDown, 1, 0.25), `on a heaving deck the speed is relative to it (deck ${deckVy.toFixed(2)} m/s, vDown ${f.outcome.vDown.toFixed(2)})`);
  const d = E.deckAt(f, f.t);
  ok(near(f.a, d.a, 1e-9) && near(f.vy, d.vy, 1e-9), 'after landing the rocket rides the deck');
  // the HUD's speeds (E.relSpeed) are exactly what touchdown judges, also on a pitching, drifting deck
  {
    let same = 0, all = 0;
    for (const m of [waves, sea, byId('m08'), byId('m20')]) for (const dx of [-5, 0, 5]) for (const wait of [0, 1.3, 2.9]) {
      const g = place(m, { dx, vy: -6, vx: 1.5, relDeck: true, gap: 1 + 0.4 * wait });
      for (let i = 0; i < wait / DT && g.phase === 'flying'; i++) E.step(g, BURN, DT); // other moments of the waves
      until(g, NONE, x => x.phase !== 'flying', 10);
      if (!g.outcome || g.outcome.where !== 'deck' || g.outcome.ok) continue;
      all++;
      const r = E.relSpeed(g); // a crash leaves the rocket where it touched
      if (r.down === g.outcome.vDown && Math.abs(r.side) === g.outcome.vSide) same++;
    }
    ok(all >= 12 && same === all, `relSpeed equals the touchdown speeds on the deck (${same} of ${all} crashes)`);
    let n = 0, off = 0;
    for (const m of E.MISSIONS.filter(x => x.pad.kind === 'barge')) for (const pilot of ['safe', 'score']) {
      const g = E.createFlight(m, m.seed); let last = null;
      while (g.phase === 'flying' && g.t < 120) { last = E.relSpeed(g); E.step(g, E.autopilot(g, pilot), DT); }
      if (!g.outcome || g.outcome.where !== 'deck') continue;
      n++; off = Math.max(off, Math.abs(last.down - g.outcome.vDown), Math.abs(Math.abs(last.side) - g.outcome.vSide));
    }
    ok(n >= 8 && off < 0.25, `the HUD speeds a step before touchdown match the judged ones (${n} barge landings, at most ${off.toFixed(3)} m/s off)`);
    const g = E.createFlight(land); run(g, NONE, 3); const r = E.relSpeed(g);
    ok(r.down === -g.vy && r.side === g.vx, 'on land relSpeed is the plain speed');
  }
  // a very fast fall never passes through the deck between two steps (the contact is swept)
  {
    let deck = 0, all = 0;
    for (const v of [150, 200, 300, 450]) for (const gap of [0.05, 0.5, 1.1]) {
      const g = place(sea, { vy: -v, gap, relDeck: true }); all++;
      until(g, NONE, x => x.phase !== 'flying', 2);
      if (g.outcome && g.outcome.where === 'deck' && g.outcome.reason === 'fastDown') deck++;
    }
    ok(deck === all, `a fall at 150–450 m/s hits the deck, not the sea under it (${deck} of ${all})`);
  }
  // out of the area
  f = E.createFlight(land); f.x = land.area + 5; E.step(f, NONE, DT);
  ok(f.outcome && f.outcome.reason === 'away' && f.phase === 'gone' && /mimo oblast/.test(E.outcomeText(f).detail), 'out of the area: failure');
  run(f, NONE, 1); ok(f.over, 'out of the area: over soon');
  // fuel out is part of the fail text
  f = place(land, { vy: -9, fuel: 0 }); f.fuel = 0; outcome(f);
  ok(f.outcome.fuelOut && /Došlo palivo/.test(E.outcomeText(f).detail), 'fuel out is said in the fail text');
  // after the end nothing breaks
  run(f, BURN, 1); ok(f.phase === 'exploded', 'steps after the end are harmless');
}

/* ---------- Wind, air, waves ---------- */
console.log('Wind and waves');
{
  const f9 = E.createFlight(byId('m09'));
  ok(E.windAt(f9, 0, 0) === 8 && E.windAt(f9, 30, 800) === 8, 'steady wind');
  const f10 = E.createFlight(byId('m10'));
  let lo = Infinity, hi = -Infinity, sum = 0, jump = 0, prev = E.windAt(f10, 0, 100);
  for (let t = 0; t < 600; t += DT) { const w = E.windAt(f10, t, 100); lo = Math.min(lo, w); hi = Math.max(hi, w); sum += w * DT; jump = Math.max(jump, Math.abs(w - prev)); prev = w; }
  ok(lo >= 3 - 9 - 1e-9 && hi <= 3 + 9 + 1e-9 && hi - lo > 6, `gusts vary within steady ± gusts (${lo.toFixed(1)} … ${hi.toFixed(1)})`);
  ok(Math.abs(sum / 600 - 3) < 1.5 && jump < 0.1, 'gusts are smooth and average to the steady wind');
  const f11 = E.createFlight(byId('m11'));
  ok(near(E.windAt(f11, 0, 0), -9, 0.1) && near(E.windAt(f11, 0, 1200), 12, 0.1), 'wind shear: another wind high up');
  const moon = E.createFlight(byId('m21'));
  ok(E.windAt(moon, 0, 0) === 0 && E.density(moon, 0) === 0, 'the Moon: no wind, no air');
  const vx0 = moon.vx; run(moon, NONE, 5);
  ok(moon.vx === vx0, 'the Moon: no drag');
  const mars = E.createFlight(byId('m23'));
  ok(near(E.density(mars, 0), 0.1, 1e-9), 'Mars: thin air');
  const fall = E.createFlight(byId('m03'));
  ok(fall.mach > 1, `Z výšky starts faster than sound (Mach ${fall.mach.toFixed(2)})`);
  const boom = E.createFlight(byId('m03'));
  let boomAt = -1;
  until(boom, NONE, x => { if (boomAt < 0 && E.takeEvents(x).some(e => e.type === 'sonicBoom')) boomAt = x.t; return boomAt >= 0; }, 20);
  ok(boomAt > 0 && boom.mach < 1, `sonic boom when it slows below the speed of sound (at ${boomAt.toFixed(1)} s)`);
  until(boom, NONE, x => x.y < 400, 60);
  ok(Math.abs(boom.vy) < 130, `air drag limits the fall (${Math.abs(boom.vy).toFixed(0)} m/s at 400 m)`);
  const w6 = E.createFlight(byId('m06'), 4), W = byId('m06').pad.waves;
  let ylo = Infinity, yhi = -Infinity, amax = 0, same = true;
  for (let t = 0; t < 120; t += 0.05) {
    const d = E.deckAt(w6, t); ylo = Math.min(ylo, d.y); yhi = Math.max(yhi, d.y); amax = Math.max(amax, Math.abs(d.a));
    if (!near(d.y, E.DECK.height + 0.85 * E.water(w6, d.x, t), 1e-9)) same = false;
  }
  ok(yhi - E.DECK.height <= W.heave + 1e-9 && yhi - ylo > W.heave * 0.9, `deck heave from the waves (${ylo.toFixed(2)} … ${yhi.toFixed(2)} m)`);
  ok(amax <= W.pitch * DEG + 1e-9 && amax > W.pitch * 0.75 * DEG, `deck pitch up to ${W.pitch}° (${(amax / DEG).toFixed(1)}°)`);
  ok(same, 'the deck rides the same wave function as the water');
  const w7 = E.createFlight(byId('m07'));
  ok(E.deckAt(w7, 0).x === 0 && near(E.deckAt(w7, E.DECK.drift / 4).x, 30, 1e-9) && near(E.deckAt(w7, E.DECK.drift / 4).vx, 0, 0.01) && near(E.deckAt(w7, 0).vx, 30 * 2 * Math.PI / E.DECK.drift, 0.01), 'drift: the barge moves slowly sideways (±30 m, about 3 m/s at most)');
  ok(E.deckAt(w6, 33.3).y === E.deckAt(E.createFlight(byId('m06'), 4), 33.3).y, 'waves are predictable from the seed');
  // the aid: where the rocket hits with the engine off
  const g = E.createFlight(byId('m02')), im = E.impact(g);
  until(g, NONE, x => x.phase !== 'flying', 60);
  ok(im && Math.abs(im.x - g.x) < 3 && near(im.t, g.t, 0.5), `impact point predicted (${im && im.x.toFixed(1)} vs ${g.x.toFixed(1)} m)`);
  ok(im && im.onPad === (Math.abs(im.x) <= byId('m02').pad.halfWidth - E.ROCKET.footX), 'impact marker is green only where both feet fit on the pad');
}

/* ---------- Score ---------- */
console.log('Score');
{
  const m = byId('m01'), par = E.parOf(m);
  const fake = o => ({ mission: m, outcome: Object.assign({ ok: true, vDown: 0, vSide: 0, tilt: 0, dist: 0, fuelLeft: m.fuel - par }, o) });
  let s = E.score(fake({}));
  ok(s.softness === 400 && s.precision === 300 && s.upright === 100 && s.fuel === 200 && s.total === 1000 && s.stars === 3, 'a perfect landing: 1000 and ★★★');
  s = E.score(fake({ vDown: 4, dist: m.pad.halfWidth, tilt: 8, fuelLeft: m.fuel - par * (1 + E.FUEL_SPAN) }));
  ok(s.total === 0 && s.stars === 1, 'at every limit: 0 points but still ★ (it landed)');
  s = E.score(fake({ vDown: 2 }));
  ok(s.softness === 300, `softness: 2 m/s gives 300 (${s.softness})`);
  s = E.score(fake({ dist: m.pad.halfWidth / 2 }));
  ok(s.precision === 150, 'precision: half the pad gives 150');
  s = E.score(fake({ fuelLeft: m.fuel - par * (1 + E.FUEL_SPAN / 2) }));
  ok(s.fuel === 100, 'fuel: halfway between par and 1.6 × par gives 100');
  s = E.score(fake({ fuelLeft: m.fuel }));
  ok(s.fuel === 200, 'fuel: never more than 200');
  // a landing worth exactly t points: take points off the precision, then off the fuel
  const total = t => {
    const cut = 1000 - t, cutP = Math.min(cut, 300), cutF = cut - cutP;
    return E.score(fake({ dist: m.pad.halfWidth * cutP / 300, fuelLeft: m.fuel - par * (1 + E.FUEL_SPAN * cutF / 200) }));
  };
  ok(total(600).total === 600 && total(849).total === 849, 'exact totals for the star edges');
  ok(total(850).stars === 3 && total(849).stars === 2 && total(600).stars === 2 && total(599).stars === 1, 'stars: ★★ from 600, ★★★ from 850');
  ok(E.score({ mission: m, outcome: { ok: false, reason: 'fastDown' } }).total === 0 && E.score({ mission: m, outcome: null }).stars === 0, 'a failure scores nothing');
  ok(E.bestKey('m01', true) === 'm01+a' && E.bestKey('m01', false) === 'm01', 'best score kept per mission and aid');
}

/* ---------- Autopilot: every mission ---------- */
console.log(`Autopilot (${SEEDS} seeds each; safe = landed / tried, time and fuel left with the mission seed)`);
// an average landing: halfway between the centre and where a foot would leave the pad, 2 m/s, a little tilted
const AVERAGE = m => ({ mode: 'safe', aim: 0.5 * (m.pad.halfWidth - ROCKET.footX), vtd: 2, lean: 2.5 });
const scoreTotals = [], avgStars = [], avgTotals = [];
console.log(`  ${'mission'.padEnd(28)} safe   time  fuel  safe pts   best pts    average pts`);
for (const m of E.MISSIONS) {
  let landed = 0, worst = '';
  for (let k = 0; k < SEEDS; k++) {
    const seed = k === 0 ? m.seed : 1000 + k;
    const f = E.fly(m, seed, 'safe');
    const o = f.outcome;
    if (o && o.ok) {
      landed++;
      // with margin: well inside every limit
      if (!(o.vDown < 2.5 && o.vSide < 1.2 && o.tilt < 5 && o.dist < m.pad.halfWidth - ROCKET.footX - 1)) worst = `thin margin seed ${seed}: v ${o.vDown.toFixed(1)} side ${o.vSide.toFixed(1)} tilt ${o.tilt.toFixed(1)} dist ${o.dist.toFixed(1)}`;
      if (m.ignitions !== null && f.ignUsed > m.ignitions) worst = 'used more ignitions than allowed';
    } else worst = `seed ${seed}: ${o ? o.reason : 'no outcome'}`;
    const b = E.fly(m, seed, 'score').outcome;
    if (!b || !b.ok) worst = `the score autopilot, seed ${seed}: ${b ? b.reason : 'no outcome'}`;
  }
  ok(landed === SEEDS && !worst, `${m.id} ${m.name}: both autopilots land every seed, the safe one with margin (${landed}/${SEEDS}${worst ? ', ' + worst : ''})`);
  const f = E.fly(m, m.seed, 'safe'), safe = E.score(f);
  ok(f.outcome.t >= 15 && f.outcome.t <= 45, `${m.id}: a flight takes 15–45 s (${f.outcome.t.toFixed(1)} s)`);
  const best = E.fly(m, m.seed, 'score'), bs = E.score(best);
  ok(best.outcome.ok, `${m.id}: the score autopilot lands`);
  const avg = E.fly(m, m.seed, AVERAGE(m)), as = E.score(avg);
  ok(avg.outcome.ok, `${m.id}: the average pilot lands`);
  scoreTotals.push(bs.total); avgStars.push(as.stars); avgTotals.push(as.total);
  const star = n => '★'.repeat(n).padEnd(3, '·');
  console.log(`  ${(m.id + ' ' + m.name).padEnd(28)} ${(landed + '/' + SEEDS).padEnd(6)} ${f.outcome.t.toFixed(0).padStart(3)} s ${f.fuel.toFixed(1).padStart(5)}  ${String(safe.total).padStart(4)} ${star(safe.stars)}   ${String(bs.total).padStart(4)} ${star(bs.stars)}   ${String(as.total).padStart(4)} ${star(as.stars)}`);
}
{
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const three = scoreTotals.filter(t => t >= 850).length, two = avgStars.filter(s => s === 2).length;
  console.log(`  score autopilot: mean ${mean(scoreTotals).toFixed(0)}, ★★★ on ${three}/24;  average pilot: mean ${mean(avgTotals).toFixed(0)}, ★★ on ${two}/24`);
  ok(mean(scoreTotals) > 860 && mean(scoreTotals) < 940 && three >= 18, 'the score autopilot gets about 900 and ★★★ on most missions');
  ok(two >= 18 && mean(avgTotals) >= 600 && mean(avgTotals) < 850, 'an average landing gets ★★');
  // the pars match what the score autopilot uses now (re-measure them with --pars after changing the physics)
  const off = E.MISSIONS.filter(m => { const f = E.fly(m, m.seed, 'score'); const p = (m.fuel - f.fuel) * E.PAR_SHARE; return Math.abs(p - E.PARS[m.id]) > 0.05 * p; }).map(m => m.id);
  ok(!off.length, `PARS are up to date (re-measure with --pars: ${off.join(', ') || 'ok'})`);
}

/* ---------- A beginner: information about the difficulty ---------- */
// A pilot who knows the strategy (the average autopilot) but plays like a person: sees the HUD a reaction time late
// (0.2–0.35 s) and guesses only part of what changed since (60–90 %), reads the numbers with noise, glances every
// 0.1–0.15 s, presses the buttons on/off (a press lasts at least 0.15 s) and aims and leans a little off. Real
// first-timers do worse at first (they still have to find the strategy). Guard bands are asserted, so a change cannot
// make the game trivial or brutal by accident (user's wish 2026-11-13: it must not be easy, and it gets harder).
function beginner(m, seed) {
  const r = E.rng(seed), gauss = () => (r() + r() + r() - 1.5) * 1.15;
  const delay = 0.2 + r() * 0.15, guess = 0.6 + r() * 0.3;
  const opts = { mode: 'safe', vtd: 1.5 + r(), aim: 6 * gauss(), lean: (r() - 0.5) * 6 };
  const ap = { on: false, corr: false, check: -1, err: 0 }, hist = [];
  let input = NONE, look = 0, held = 9;
  return f => {
    hist.push({ t: f.t, x: f.x, y: f.y, vx: f.vx, vy: f.vy, a: f.a, w: f.w, throttle: f.throttle });
    while (hist.length > 1 && hist[1].t <= f.t - delay) hist.shift();
    look -= DT; held += DT;
    if (look > 0) return input;
    look = 0.1 + r() * 0.05;
    const s = hist[0], d = f.deck, bl = (o, n) => o + (n - o) * guess;
    const seen = { x: bl(s.x, f.x), y: bl(s.y, f.y), vx: bl(s.vx, f.vx), vy: bl(s.vy, f.vy), a: bl(s.a, f.a), w: bl(s.w, f.w), throttle: bl(s.throttle, f.throttle) };
    // the player cannot foresee the gusts or where the barge will be: only the wind sock now and the barge now
    const sees = Object.assign({}, m, { wind: { steady: f.wind, gusts: 0, shear: null }, pad: Object.assign({}, m.pad, { x: d.x, drift: 0 }) });
    const p = Object.assign({}, f, seen, { mission: sees, ap, _imp: null, y: d.y + (seen.y - d.y) * (1 + 0.05 * gauss()),
      vy: d.vy + (seen.vy - d.vy) * (1 + 0.08 * gauss()) + 0.3 * gauss(), vx: seen.vx + 0.3 * gauss() });
    const o = E.autopilot(p, opts);
    // nobody presses the burn while the rocket is not falling, except for a sideways correction burn high up (the
    // autopilot's short pulses that keep a limited burn alive are too quick for a finger: a press lasts 0.15 s or more)
    const want = o.burn && (ap.corr || p.vy - d.vy < -0.3);
    const burn = want === input.burn || held >= 0.15 ? want : input.burn;
    if (burn !== input.burn) held = 0;
    input = { left: o.steer < -0.3, right: o.steer > 0.3, burn };
    return input;
  };
}
{
  const TRIES = Math.max(10, +opt('--beginner', 40)), rate = {};
  console.log(`Beginner (landed / tried: ${5 * TRIES} tries on m01, ${TRIES} on the others)`);
  for (const m of E.MISSIONS) {
    const n = m.id === 'm01' ? 5 * TRIES : TRIES;
    let landed = 0;
    for (let k = 0; k < n; k++) { const f = E.fly(m, m.seed + k, beginner(m, 1234 + k * 7919)); if (f.outcome && f.outcome.ok) landed++; }
    rate[m.id] = landed / n;
  }
  const pct = v => Math.round(100 * v) + ' %', means = {};
  for (const c of E.CHAPTERS) {
    const ms = E.MISSIONS.filter(m => m.chapter === c.id);
    means[c.id] = ms.reduce((s, m) => s + rate[m.id], 0) / ms.length;
    console.log(`  ${c.id}. ${c.name.padEnd(12)} ${ms.map(m => `${m.id} ${pct(rate[m.id]).padStart(5)}`).join('   ')}   mean ${pct(means[c.id])}`);
  }
  ok(rate.m01 >= 0.3 && rate.m01 <= 0.7, `the beginner lands m01 in 30–70 % (${pct(rate.m01)})`);
  // the difficulty rises through the game: no chapter mean is more than 5 points above the one before
  for (let c = 2; c <= 6; c++) ok(means[c] <= means[c - 1] + 0.05, `chapter ${c} is not easier for the beginner than chapter ${c - 1} (${pct(means[c])} vs ${pct(means[c - 1])})`);
  ok(means[6] <= means[1] - 0.15, `chapter 6 is much harder for the beginner than chapter 1 (${pct(means[6])} vs ${pct(means[1])})`);
}

/* ---------- Daily challenge ---------- */
console.log(`Daily challenge (${DATES} dates)`);
{
  const kinds = new Set(), seen = new Set();
  let bad = 0, slow = 0, t0 = Date.now();
  const day0 = Date.UTC(2026, 10, 13);
  for (let i = 0; i < DATES; i++) {
    const date = new Date(day0 + i * 864e5).toISOString().slice(0, 10);
    const m = E.dailyMission(date), m2 = E.dailyMission(date);
    if (JSON.stringify(m) !== JSON.stringify(m2)) { bad++; console.log(`  ${date}: not the same twice`); continue; }
    if (m.id !== 'daily-' + date || !m.name || !m.what || !(m.par > 0) || !(m.fuel > m.par)) { bad++; console.log(`  ${date}: invalid fields`); continue; }
    kinds.add(`${m.world}/${m.pad.kind}/${m.ignitions || '∞'}/${m.scene.sky}`);
    seen.add(JSON.stringify([m.start, m.wind]));
    for (const seed of [m.seed, 77]) {
      const f = E.fly(m, seed, 'safe');
      if (!f.outcome || !f.outcome.ok) { bad++; console.log(`  ${date} seed ${seed}: ${f.outcome ? f.outcome.reason : 'no outcome'} (${m.what})`); }
      else if (seed === m.seed && (f.outcome.t < 12 || f.outcome.t > 50)) { slow++; console.log(`  ${date}: flight ${f.outcome.t.toFixed(0)} s`); }
    }
  }
  console.log(`  ${kinds.size} different kinds (world/pad/ignitions/sky), ${seen.size} different starts, ${((Date.now() - t0) / DATES).toFixed(0)} ms per date`);
  ok(!bad, `every daily mission is valid, the same all day and landable (${bad} problems)`);
  ok(!slow, 'daily flights take a sensible time');
  ok(kinds.size >= Math.min(12, DATES / 4) && seen.size === DATES, 'daily missions vary');
}

console.log(failed ? `${failed} test(s) failed` : 'All tests passed');
process.exit(failed ? 1 : 0);
