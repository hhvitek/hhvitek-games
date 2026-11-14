# Přistání — design (game id `pristani`)

The user's wish (2026-11-13): a rocket booster lands on a pad. Gravity pulls it down, the engine slows it, the player
steers left/right. Fiery engine, beautiful graphics, sea around the pad (a miss = splash and sinking), desert (a miss =
explosion). It must stay interesting and habit-forming although it is "always the same thing". 2D or 3D was left to us.
The user liked the video "First Stage Landing Simulator" (an old mobile game: separation, recovery burns, legs, land pad or
drone ship). We make an **original** game in the genre: no real company names, logos or liveries.

Research summary (agent report, 2026-11-13): what keeps landers replayable is a short attempt (< 45 s) with an instant
retry, a score from the touchdown quality with 1–3 stars, levels that each add **one** new variable, a daily challenge
from the date seed, a ghost of your own best run, and the "hoverslam" (light the engine as late as possible) as the
mastery hook. Touch buttons beat phone tilt for precision; rotation must be rate-limited and auto-levelling, never
inverted. Canvas 2D side view with pseudo-3D shading is the right choice (no libraries, readable on a phone).

## 1. Look and feel (the most important part for the user)

Canvas 2D, side view, portrait, with depth by parallax and shading:
- **Rocket**: a slim booster (about 1 : 10), off-white body with a cylinder gradient (light from one side), a dark
  interstage at the top with 4 small grid fins, 4 landing legs folded along the body that swing out (animated,
  about 0.8 s) when the altitude drops below a mission-defined height; a nozzle with a hot glow after burning; the body
  gets visibly **sootier** with each second of burning (a soot gradient from the bottom). Original colours: one thin
  orange band, a small "VH-1" style serial, no real-world logos.
- **Engine flame** (additive blending `lighter`): 3 nested teardrop shapes (outer orange-red, middle yellow, white-blue
  core), length ∝ throttle with per-frame flicker, 3–5 **mach diamonds** in the core, a big pre-rendered glow sprite at
  the nozzle, the plume **widens with altitude** (thin air high up), it bends with the rocket's tilt; ignition flash and
  a short spool-up (≈ 0.25 s), a puff of smoke at shutdown.
- **Smoke and dust**: pooled particles (cap ≈ 300; halve spawning when frames run long). Grey smoke trail high up,
  near the ground radial sheets of dust (desert), white spray/steam (sea), ballistic dust with no smoke (Moon).
  A pool of light on the ground under the flame that grows as the rocket comes down.
- **High speed**: a re-entry glow on the bottom when falling fast, a white vapour cone around the rocket near the speed
  of sound, a soft "boom" (sound + ring) when it drops below it.
- **Scene**: sky gradient per mission (day, sunset, night with stars and moon, black Moon sky with Earth, butterscotch
  Mars sky), 3 parallax layers (far mountains/dunes or horizon, clouds, near details), a **cloud deck** the rocket falls
  through on some missions, rain and lightning in the storm mission. All static layers pre-rendered to offscreen
  canvases and redrawn only on resize.
- **Desert land pad**: concrete circle with a target ring and a cross, edge lights; around it sand, rocks, a few
  cacti/antennas far away. **Touchdown outside the pad = explosion.**
- **Sea barge**: a flat deck with yellow edge stripes, a target circle, lights at the corners, riding the waves
  (heave and pitch from the same wave function as the water). Water is a **row of springs** (dynamic 2D water) with an
  ambient swell, so a splash makes real ripples. **Missing the barge = splash**: crown, droplets, ripples, the rocket
  tips, slides under a translucent water layer drawn over it, bubbles rise and shrink, a hiss of steam.
- **Explosion**: a 60–100 ms freeze, a white flash, a fireball of additive particles (yellow → orange → dark smoke),
  a shockwave ring, 10–20 rotating debris pieces that bounce once, a scorch mark left on the ground, screen shake
  (trauma², decaying), a lingering smoke column.
- **Successful landing**: the engine cuts off, the legs compress a little (suspension), a steam puff, the pad lights turn
  green, a short slow motion (time scale ≈ 0.3 for 0.6 s) and a satisfying thud, then the result card.
- **Camera**: follows the rocket smoothly, **zooms out high up and in near the ground** (about 0.45 → 1.15), a gentle
  shake proportional to throttle; an arrow at the screen edge points to the pad when it is out of view.
- **Sound** (WebAudio, no files; started at the first tap, setting "Zvuk", on): engine roar = looped brown noise →
  lowpass (cutoff rises with throttle) → gain ∝ throttle, plus a quieter crackle band; wind noise ∝ speed; explosion,
  splash with bubble blips, touchdown thud, sonic boom, a soft beep when the legs deploy. Vibration (setting
  "Vibrace", on) for touchdown and crash.
- Performance: devicePixelRatio capped at 2, no `shadowBlur`, sprites pre-rendered, fixed-step physics (120 Hz)
  with an accumulator inside `requestAnimationFrame`, 60 fps on a Xiaomi 13T in Chrome. Adaptive quality (`Q`):
  frames averaging over 20 ms for a second lower the canvas pixel ratio 2 → 1.5 → 1.25 and cut particle spawning;
  it goes back up only after 12 s × (number of drops) of fast frames (no flapping); a fast device stays at 2.

## 2. Controls

Settings section "Ovládání" first. Never inverted: left means the nose (and the rocket) goes left.
- **"Dva palce"** (default, `ctl: 'thumbs'`): the lower part of the screen is split in two halves (subtle
  translucent zones with ◀ / ▶ and a flame mark). Hold the left half = the nose tilts left **and** the engine burns;
  hold the right half = tilt right and burn; hold both = burn straight while the nose returns upright; hold nothing =
  engine off. Multi-touch with pointer events, every pointer tracked.
- **"Tlačítka"** (`ctl: 'buttons'`): ◀ and ▶ on the left (tilt only), a big flame button on the right (burn).
  Lets an expert tilt without burning.
- **"Náklon telefonu"** (`ctl: 'tilt'`): tilting the phone steers (gamma, dead zone ≈ 3°, smoothing, ±25° of phone =
  full tilt), holding anywhere on the scene burns. Copy the permission handling from `games/kulicka/`; when the sensor
  is unavailable it says so and falls back to Dva palce.
- Rotation is rate-limited (≈ 70 °/s), damped, limited to ±40°, and **auto-levels** (≈ 25 °/s) with no tilt input.
- Throttle is on/off with a spool-up of ≈ 0.25 s (it feels heavy).

## 3. Rules of a flight

- A flight starts high (mission-defined) with downward and sideways speed, engine off. It lasts 15–45 s.
- Limited **fuel** (a bar). Some missions limit **ignitions** ("Zážehy: 3"): every new burn after the engine was off
  for more than 0.3 s uses one; with none left the engine will not light (a click and a toast-like flash on the HUD).
  From chapter 5 the engine's thrust is well above the weight (≈ 2.4 g even when nearly empty), so hovering is
  impossible and the burn must be timed (hoverslam). Chapter 6 keeps the ordinary Earth engine (1.3 × 9.81 m/s²): on
  the Moon that is ≈ 7.9 local g, on Mars ≈ 3.4, with 2–4 ignitions, so every burn is a hard short kick.
- Legs deploy by themselves below the mission's leg height (≈ 120 m game altitude); touchdown without legs = crash.
- **Touchdown succeeds** when: vertical speed ≤ 4 m/s, horizontal speed (relative to the pad) ≤ 2 m/s, tilt ≤ 8°
  (relative to the deck on the barge), legs deployed and both feet on the pad. Otherwise:
  - too fast / no legs → explosion on the pad (or splash if the barge was missed),
  - too tilted (up to 25°) → the rocket tips over (animated) and explodes,
  - a foot off the pad → it tips over the edge: explosion (land) / into the sea (barge),
  - anywhere off the pad → explosion (land, Moon, Mars) / splash and sinking (sea),
  - fuel runs out → it just falls (the HUD says so),
  - leaving the scene sideways far away → "Raketa uletěla mimo oblast" (failure).
- The fail card says exactly why with the numbers ("Dosednutí 7,4 m/s, nejvýš 4 m/s").
- **Score** (only for a successful landing, 0–1000): softness 0–400 (0 m/s → 400, 4 m/s → 0), precision 0–300
  (distance of the rocket's axis from the pad centre relative to the pad half-width), uprightness 0–100, fuel left
  0–200. **Stars**: landed ★, ≥ 600 ★★, ≥ 850 ★★★ (tune so that 3 stars are hard but reachable: the Node autopilot
  tuned for score should reach about 900).
- **Wind**: a steady speed plus gusts (smooth noise from the seed) and optionally shear (different wind high and low);
  it pushes the rocket sideways (drag ∝ relative speed). A wind sock/arrow with the speed in the HUD.
- **Waves**: deck heave and pitch from a sum of two sines (predictable), drift = the barge moves sideways slowly.
- All randomness (gusts, daily mission) comes from a seed; the physics is a pure fixed-step function of
  (mission, seed, inputs), so the same inputs give the same flight.

## 4. Progression

**24 missions in 6 chapters**, each adds one thing; mission N+1 unlocks when N is landed (at least ★). The chapters:
1. **Poušť** (land pad, day): První přistání (low, straight above, slow) · Posun do strany (sideways speed) ·
   Z výšky (fast fall, sonic boom, cloud layer) · Úzká plošina. The pads narrow from chapter to chapter
   (section 9, Difficulty).
2. **Moře** (barge): Loď na moři (calm) · Vlny (heave + pitch) · Unášená loď (drift) · Vlny a drift.
3. **Vítr**: Stálý vítr · Poryvy · Střih větru (direction flips with altitude) · Vítr nad mořem.
4. **Noc a mraky**: Západ slunce · Noc (only the pad lights, the rocket's lights and the flame's light) ·
   Mlha (low cloud deck, pad visible late) · Bouře na moři (night, rain, lightning, waves, gusts).
5. **Zážehy** (hoverslam, no hover): 3 zážehy · 2 zážehy · Jediný zážeh (land) · Jediný zážeh na lodi.
6. **Jiné světy** (the Earth engine on a light world is far too strong: short precise burns, limited ignitions):
   Měsíc (1.62 m/s², no air: no drag, no smoke, ballistic dust, black sky with Earth; 2 ignitions) ·
   Kráter (pad in a crater between rims; 4) · Mars (3.71 m/s², thin air, red sky; 2) · Prachová bouře (Mars, gusts, dust
   haze).

Besides the missions: **"Výzva dne"**: a mission generated from the date (same for everybody that day), with its own
best score and a **streak** of days in a row with a landing (a missed day resets it, nothing worse).

**Ghost**: the best successful flight of each mission (sampled at 10 Hz: x, y, angle, throttle, rounded) is drawn as a
faint translucent rocket during the next attempt (setting "Ukazovat nejlepší let", on).

**Aid** (setting "Ukazovat místo dopadu", on): a small marker on the ground where the rocket would hit with the engine
off, coloured green where both feet fit on the pad (|x − pad| ≤ halfWidth − footX), red elsewhere. It makes landing easier, so the best score is kept per mission and
per aid (`bests[missionId + (aid ? '+a' : '')]`); stars count either way.

## 5. Screens and layout (portrait, 393×760–873)

- Top bar (game theme): home (hidden without `?menu`), **"Mise"** button in place of "Nová hra" (opens the mission
  list; like Kočka's Deníček this game has no "Nová hra": a flight is short and "Znovu" restarts it at once, no
  confirmation), `<h1>Přistání</h1>`, "?" and settings.
- Below it a HUD row: mission name, Výška (m), Rychlost ↓ and ↔ (m/s, green when safe for touchdown, red otherwise),
  Palivo (bar), Zážehy (when limited), wind arrow with m/s. Compact, readable, no overlap at 360 px.
- The scene canvas fills the rest down to the bottom safe area; the control zones lie over its lower part.
- **Briefing** (before each flight, small card over the scene, not a paper screen): mission name, one sentence of
  what is new, conditions, the best stars; big "Start" (a tap anywhere also starts; the first touch never burns).
- **Result card** (over the scene after the outcome animation): "Přistáno!" with stars and the 4 score lines and the
  points, "Nový rekord" when it is; or the failure reason. Buttons "Znovu" (primary on failure) and "Další mise"
  (primary on success), "Mise".
- **Mission list** (paper screen `#screenMissions`, closed by Back): the 6 chapters with their missions as tiles
  (number, name, stars, locked ones dimmed with a lock), "Výzva dne" on top with today's best and the streak.
- Pause: the physics stops while any screen/dialog is open or the page is hidden; coming back shows a short
  "Pokračuj" card (a tap continues). A small pause button in the HUD row too.
- Settings (paper): Ovládání (3 choices), Ukazovat místo dopadu, Ukazovat nejlepší let, Zvuk, Vibrace, Vzhled
  (themes for the top bar/HUD/cards: "Noc" default dark blue-grey, "Papír" with the launcher's colours (required),
  "Ocel"), "Smazat postup" (asks). Help explains the controls, the touchdown limits, the score, stars, the chapters.

## 6. Contract and storage

- `games.pristani.state` = `{ v: 1, settings, stars: {missionId: 0–3}, bests: {key: score}, ghosts: {missionId: […]},
  daily: { date, best, streak, lastLanded }, last: missionId }`. Everything validated on load (whitelist of settings,
  numbers clamped, ghosts checked, bad data dropped, never a crash).
- A flight in progress is **not** saved (it is short); `games.pristani.inProgress` is always removed. A reload returns
  to the briefing of the last mission.
- All the usual contract parts from the template: error log first script, Back button, visible height, rotate notice,
  persist(), the test hook `window.Pristani = { get state(), … }` with helpers for the screenshot pass.

## 7. Code structure

One file `games/pristani/index.html`. The physics, missions, scoring, wind/wave functions and the autopilot live in one
pure block between `/* ---------- Engine ---------- */` and `/* ---------- Engine end ---------- */` (no DOM), tested
in Node by `tools/pristani-test.js` (rules, every failure mode, determinism, scoring, and an autopilot that must land
**every** mission with a margin, plus one that aims for score to calibrate the stars).

## 8. Engine API

`const E = PristaniEngine();` (the function is global in the page; `tools/pristani-test.js` runs the same block in Node).
Everything is pure and deterministic: the same mission, seed and inputs give the same flight. Units: metres, seconds,
m/s. World coordinates: x to the right, y up, **y = 0 is the mean ground / pad top on land and the mean sea level at
sea**. Angles inside a flight are **radians, positive = nose to the right** (clockwise on screen); missions give degrees.

### Constants
- `E.DT` = 1/120 s: always step with it (accumulator in `requestAnimationFrame`).
- `E.ROCKET` = `{ height: 40, radius: 1.85, hingeY: 3, footX: 8.5, footY: -2, com: 14, legTime: 0.8, legLen, legAngle }`:
  the rocket's base point (`f.x, f.y`) is the bottom of the engine on the axis; the body goes up 40 m; legs hinge on the
  body 3 m up and their feet end at (±8.5, −2) when deployed. `E.footBody(p, side)` gives a foot in body coordinates
  for leg progress `p` (0 folded along the body, 1 out) and `side` −1 / 1; `E.toWorld(x, y, a, bx, by)` turns body
  coordinates into world ones; `E.feet(f)` = both feet in the world now.
- `E.LIMITS` = `{ vDown: 4, vSide: 2, tilt: 8, tipMax: 25 }` (the touchdown limits for the help and the HUD colours).
- `E.CTRL` (turn 70 °/s, levelling 25 °/s, ±40°, spool-up 0.25 s, spool-down 0.1 s, relight grace 0.3 s), `E.AIR`,
  `E.DECK` (`height` 2.5 m of the deck top above the water, `drift` period 60 s), `E.PLANETS`, `E.STARS` = [600, 850].

### Missions
- `E.CHAPTERS` = `[{ id: 1..6, name, what }]` (Czech).
- `E.MISSIONS` = 24 objects (ids `m01`…`m24`, in order; chapter `c` holds `m(4c−3)`…`m(4c)`):
  `{ id, chapter, num (1–4), name, what (one Czech sentence of what is new), world: 'earth'|'moon'|'mars',
  g (m/s²), air (density factor, 0 = none), sound (m/s, 0 = none), twr (thrust/weight with a full tank; rises 30 % as it
  empties), fuel (seconds of full thrust), ignitions (null = unlimited, else 1–3), wind { steady, gusts, shear: null |
  { alt, high } } (m/s, + = to the right; above `shear.alt` the wind blends to `shear.high`), surface: 'land'|'sea'|
  'moon'|'mars', pad { kind: 'pad'|'barge', x, halfWidth, waves: null | { heave (m), pitch (°), period (s) }, drift
  (m, signed amplitude of a 60 s sideways sway) }, start { x (from the pad centre), alt (base above the pad), vx, vy,
  angle }, legAlt (m), area (half-width of the allowed area, m), crater: null | { floor, rim, out, h } (use
  `E.ground`), scene { sky: 'day'|'sunset'|'night'|'storm'|'fog'|'moon'|'mars'|'dust', clouds: null | { base, top },
  fog: null | { base, top }, rain, lightning, haze 0–1, terrain: 'desert'|'sea'|'moon'|'crater'|'mars' }, seed, par }`.
  **Start a mission's flight with `mission.seed`** (fixed gusts and waves every attempt, so ghosts and bests are fair).
- `E.dailyMission('YYYY-MM-DD')` → a mission like the above with `id: 'daily-YYYY-MM-DD'`, `chapter: 0`,
  `name: 'Výzva dne'`, its own `seed` and `par`. It is checked by flying it with the autopilot (15–45 s), so it is
  always landable; it takes about 60 ms, so build it once per day, not every frame.

### Flight
- `const f = E.createFlight(mission, mission.seed)`, then every fixed step `E.step(f, input, E.DT)`.
  `input` = `{ left, right, burn }` (booleans; Dva palce: one side = that side + burn, both = burn only; Tlačítka:
  ◀/▶ and the flame separately) or `{ steer: -1..1, burn }` for Náklon telefonu (`steer` wins when it is a number;
  |steer| < 0.001 counts as no input, so the rocket levels itself).
- State the renderer and the HUD read (all kept current after every step):
  - `t` (s), `n` (steps), `x`, `y`, `vx`, `vy`, `a` (rad), `w` (rad/s), `alt` (m from the lowest point of the
    rocket to whatever is under it), `deck` = `{ x, y, a, vx, vy, va }` (pad / barge deck centre, its top and angle,
    positive = right end lower; land pads have zeros), `wind` (m/s at the rocket's height), `mach`, `supersonic`.
  - Engine: `throttle` 0..1 (flame length; spools), `burning` (the input is lighting it), `session` (a burn is on or
    was off for at most 0.3 s), `sinceOff`, `fuel`, `fuel0` (bar = fuel / fuel0), `ignLeft` (null = unlimited),
    `ignUsed`, `burnTime` (s at full thrust so far), `soot` 0..1.
  - Legs: `legs` 0..1 (animated over 0.8 s), `legsOut`.
  - `phase`: `'flying'` → `'landed'` (rides the deck), `'tipping'` (falls over about a foot or the pad edge),
    `'exploded'` (hide the rocket, show the fireball), `'sinking'` (keeps moving down and tipping; `f.sink` = metres
    of the base below the water, draw the water over it), `'gone'` (left the area). `over` becomes true when the
    result card should come (landed 1.6 s, explosion 2.4 s, sinking 3.2 s, away 0.6 s after the event); keep stepping
    after it for the background scene. `post.t` = seconds since the outcome (leg suspension, slow motion, puffs).
  - `outcome` (null while flying) = `{ ok, reason, fate, where, vDown, vSide, tilt (°, absolute), dist (m of the axis
    from the centre), halfWidth, footOff (m beyond the edge), onPad (feet on it), legs, fuelLeft, fuelOut, t, ignUsed }`.
    `reason`: `'landed'`, `'fastDown'`, `'fastSide'`, `'noLegs'`, `'tilt'`, `'edge'`, `'offPad'`, `'away'`.
    `fate`: `'rest'`, `'explode'`, `'tip'` (tilt ≤ 25° or a foot off the edge; it explodes or splashes later),
    `'splash'`, `'gone'`. `where`: `'pad'`, `'ground'`, `'deck'`, `'water'`. Speeds are relative to the deck.
- `E.takeEvents(f)` → the events since the last call (read once per frame; the list keeps at most 200). Each is
  `{ type, t, … }`: `ignition { left }` (a new burn used an ignition), `cutoff` (the burn input was released; a puff),
  `shutdown` (off for more than 0.3 s: the next burn is a new ignition), `noIgnition { why: 'ignitions'|'fuel' }`
  (once per press: a click and a flash on the HUD), `fuelOut`, `legsDeploy` (a soft beep), `legsLocked`,
  `sonicBoom`, `touchdown { ok, reason, vDown, vSide, tilt, where }`, `landed`, `tipStart { dir }`,
  `explode { x, y, where }` (the centre of the rocket), `splash { x, y, v }`, `away`, `over`.
- `E.impact(f)` → `null` or `{ x, y, t, onPad, padX }`: where the rocket would hit with the engine off (the aid
  marker; `onPad` = both feet would fit on the pad: |x − padX| ≤ halfWidth − ROCKET.footX). Cached per step, so calling it every frame is cheap.
- `E.relSpeed(f)` → `{ down, side }`: the rocket's speed relative to the deck point under it, along the deck's normal
  (+ = towards it) and along the deck (signed, + = right); exactly what touchdown judges, so the HUD shows it (on land
  `-vy` and `vx`).
- Scene functions (same ones the physics uses): `E.windAt(f, t, h)`, `E.water(f, x, t)` (the sea surface; the
  renderer's spring water should follow it as its swell), `E.deckAt(f, t)`, `E.ground(f, x)` (land and the crater),
  `E.surfaceY(f, x, t)`, `E.density(f, h)`, `E.thrustAccel(f)`.
- `E.outcomeText(f)` → `{ title, detail }` in Czech, e.g. "Moc rychle dolů" / "Dosednutí 7,4 m/s, nejvýš 4 m/s.",
  "Do moře" / "Loď minuta o 40 m.", plus "Došlo palivo." when the tank was empty.

### Score
- `E.score(f)` → `{ softness 0–400, precision 0–300, upright 0–100, fuel 0–200, total, stars }`; zeros and 0 stars
  for a failure. Softness = 400 × (1 − (vDown / 4)²), precision = 300 × (1 − dist / halfWidth), upright = 100 ×
  (1 − (tilt / 8)²), fuel = 200 when the flight used at most the mission's par, falling to 0 at 1.6 × par
  (`E.parOf(m)`; par = 80 % of the fuel the score autopilot uses, so 200 is for experts). Stars: landed ★, ≥ 600 ★★,
  ≥ 850 ★★★. Measured (`node tools/pristani-test.js`): the score autopilot gets ≈ 895 (★★★ on 23 of 24 missions), the
  safe one ≈ 790, an "average pilot" (aims 30 % of the pad off the centre, 2 m/s, 2.5° tilt) ≈ 650 (★★).
- `E.bestKey(missionId, aid)` → `'m01'` or `'m01+a'` (bests per mission and per "Ukazovat místo dopadu").

### Autopilot
- `E.autopilot(f, 'safe' | 'score' | { mode, k, vtd, slope, aim, lean })` → an input for this step (with `steer`
  and matching `left/right`). It keeps its memory in `f.ap`, which the physics never reads. `'safe'` lands every
  mission with a margin (≈ 1.4 m/s, centred); `'score'` brakes late and hard for points. Useful for a demo flight and
  the screenshot pass. `E.fly(mission, seed, pilot)` flies a whole flight at once (pilot = a mode or a function
  `f => input`) and returns the finished flight.

## 9. UI build notes (deviations and choices, 2026-11-13)

- **The scene is full width.** The canvas is the world behind everything, so it runs edge to edge; every control on it
  (the thumb zones, the buttons, the cards, the HUD chips) keeps the 12 px side margin. The scene does not follow the
  theme (it is the mission's sky and ground); the themes colour the top bar, the HUD row, the cards and the control marks.
- **HUD row**: two lines. Line 1: mission label, Zážehy pips, wind, the pause button (it moved here from line 2 so the
  four gauges fit at 360 px). Line 2: Výška m, Dolů m/s, Bokem m/s, Palivo bar. The speeds are neutral high up and turn
  green/red only below about 150 m or once the legs are out (constant red while falling from 3 km was just noise).
- **Ghost storage**: `ghosts[missionId] = { s: score, d: [x, y, a, throttle, …] }` (10 Hz, rounded), not a bare array,
  so a better flight replaces it only when its score is higher. Ghosts are kept for the 24 missions, not for the daily.
- **Daily**: `daily = { date, best, stars, streak, lastLanded }` (stars added). Its best is one number for the day,
  with or without the aid.
- **Aid and records**: a flight counts for the `+a` best when the aid was on at any moment of it.
- **Znovu** starts the new flight at once (no briefing); **Další** opens the next mission's briefing.
- **Camera**: besides the altitude zoom it zooms out further when needed so the rocket and the ground under it are both
  in view (the pad never hides under the thumbs); with a card up it frames everything above the card.
- **Engine block unchanged** except the difficulty tuning below (mission values, the chapter 6 engine and one autopilot rule).
- **Difficulty rises through the game** (user's wish 2026-11-13: it must not be easy, the fun is that it does not work
  at first; the orchestrator's decision: it must get harder chapter by chapter). Measured with the beginner bot in
  `tools/pristani-test.js` (a bot that knows the strategy but reacts late and imprecisely, aims ≈ 3.5 m off; real
  first-timers land much less at first). The bot is almost insensitive to wind, gusts, drift and start speeds (it
  corrects them in time); what it feels is gravity × reaction time near the ground and the room beside the feet.
  So the pads narrow through chapters 1–5 (half-widths: m01 30, m02 22, m03 16, m04 12; barges 14 → 13; wind 13.5 →
  12.5; night 12.5 → 12; Zážehy 11.5; the legs are at ±8.5 m, every pad leaves ≥ 3 m beside each foot), Vlny got
  bigger waves (1.8 m, 5°). Chapter 6 got its own skill instead of narrow pads (the orchestrator's decision): the Earth
  engine keeps its thrust in newtons (Měsíc 2 ignitions, Kráter 4, Mars 2, Prachová bouře 3; tanks 14–24 s; the
  crater starts at −300 m, 8 m/s so the flight stays under 45 s). A burn a little too early stops the rocket high and
  costs an ignition, a little late crashes. The autopilot's sideways correction burn leans up to 40° and pushes only
  while falling when the engine would lift the rocket back up. Daily: pads 12.5–16 m, barge 13 m, Moon 4 ignitions,
  Mars 2 (dailies ≈ 34 % for the bot, Moon/Mars ≈ 20 %). Bot landing rate (150 tries each): ch1 42 % (m04 32 %),
  ch2 37 %, ch3 35 %, ch4 28 %, ch5 27 %, ch6 17 % (Měsíc 28, Kráter 19, Mars 10, Prachová bouře 12). The test asserts
  m01 in 30–70 %, each chapter at most 5 points above the one before and ch6 at least 15 points below ch1.
