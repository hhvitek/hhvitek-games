# Kočka — design spec (developer document, not deployed)

The game `games/kocka/` ("Kočka"): Koxa, the user's black tortoiseshell cat, lives in a cottage with a garden on the
phone's real clock. This file is the source of truth for the builders; the lead keeps it current. Player texts are
Czech (informal "ty", gender-neutral about the player; Koxa is "ona": "Koxa má hlad"). Code is English.

## 0. User's decisions (2026-11-12)
- The cat is **Koxa**; renamed at any time (Nastavení → Jméno kočky, 1–20 characters, trimmed, default "Koxa").
  Every text uses the current name (and Czech forms: see §11 `nameForms`).
- **Mild consequences:** thinner, sad, uncooperative, ill (vet cures). Never death, never lost for good.
- **All controls:** stroking, multi-touch, long press, drag, flick, tilt, microphone, sound, timed minigames.
- **Cross-game link** in the launcher's Nastavení, **off by default** (§10).
- The senior rules no longer apply (CLAUDE.md "No senior constraints"); targets may be small where it feels right,
  but the main care actions stay easy to hit (≥ 44 px).

## 1. Code layout
During development every block has its own source file; `node tools/kocka-dev/assemble.js` copies them between the
markers of `games/kocka/index.html` (the shipped single file). Never edit the copied blocks in index.html by hand.

| Source file | Marker in index.html | Global | Owner |
|---|---|---|---|
| `tools/kocka-dev/src/art.js` | `/* ---------- Cat art ---------- */` | `KockaArt()` | Art agent |
| `tools/kocka-dev/src/input.js` | `/* ---------- Input ---------- */` | `KockaInput()` | Input agent |
| `tools/kocka-dev/src/engine.js` | `/* ---------- Life engine ---------- */` | `KockaEngine()` | Engine agent |
| the main `<script>` of index.html | (template blocks + Scenes and UI) | `window.Kocka` | lead / UI agent |

Each source file is plain browser JS that defines exactly one global factory function and nothing else at top level
(no DOM access at load time; Art and Input may touch the DOM only inside functions they export). Engine has **no
DOM at all** and runs in Node (`tools/kocka-test.js` evaluates `src/engine.js`).
Dev pages: `tools/kocka-dev/art.html` (pose and scene sheet), `tools/kocka-dev/feel.html` (gesture lab). They load the
`src/*.js` files directly and are served by `node tools/serve.js` (http://localhost:8765/tools/kocka-dev/…).

## 2. Time model
- All time is real time in ms (`Date.now()`), local time for day phases (`new Date(ms).getHours()`).
- `advance(st, now)`: simulate from `st.t` to `now` in steps of 10 minutes (the last step shorter); at most 14 days
  (older time is skipped: she was at paní Nováková's, §5). If `now < st.t` (clock moved back) nothing happens and
  `st.t = now`. Deterministic: the same state and the same `now` give the same result.
- Day phases (local hours): `night` 22–6, `morning` 6–10, `day` 10–17, `evening` 17–22.
  Koxa sleeps most of the night (energy refills), is hungry in the morning, naps in the afternoon sun patch,
  is playful in the evening (zábava falls faster, play gives more).
- Seasons: spring Mar–May, summer Jun–Aug, autumn Sep–Nov, winter Dec–Feb.
- Holidays (§9) from the date; Easter by the Gregorian computus.

## 3. Needs (0–100, 100 = fully satisfied)
| Need | Czech | Falls per hour (day / night) | Refilled by |
|---|---|---|---|
| `food` | hlad (shown as "Sytost") | 6 / 3 | feeding: granule +35, kapsička +45, kuře +50, tuňák +55 |
| `water` | žízeň ("Pití") | 5 / 2.5 | water bowl +60 (drag the jug to the bowl) |
| `energy` | energie | 3 awake / −8 asleep (refills) | sleep (she sleeps by herself when < 25 or at night) |
| `fun` | zábava | 4 (evening 6) / 1 | play (toy +20…+40, minigames +30), garden |
| `love` | mazlení | 3 / 1 | stroking along the fur +2/stroke, scratching +4/s, carrying +5 if she wants |
| `clean` | čistota | litter: one use every ~8 h dirties it by 30; coat −0.5 | clean litter (=100 litter part), brushing +25 |
`clean` = min(litter, coat). Values never go below 0 or above 100.

**Tuned after the engine review (these numbers win over the table above; source: `RATE` in src/engine.js):**
food 4 / 2 per hour, water 3.5 / 2, fun 2.5 (evening 3.5, resting 0.5), love 2 / 0.5; water fills the bowl to 100;
she grooms herself up to coat 50 unless ill or outside; `wants` is one of food, water, litter, coat, love, fun
(`litter` → "Kočičí záchod potřebuje uklidit", `coat` → "Učeš ji"); a satisfied want gives bond +1 at most once an
hour per need. Weight: average food < 30 → −0.08/day; < 4.2 kg and food ≥ 45 → +0.05 up to 4.2; food > 70 → +0.03
up to 4.5; over 4.5 with ≤ 8 treats → −0.02; > 8 treats → +0.04 up to 5.6. Paní Nováková looks in after 24 h of any
absence and keeps food, water and litter ≥ 20 (a longer absence is never better than a shorter one); the > 72 h
rule (offended, weight penalty, back with 40) is unchanged. A clock outside 2000–2200 is ignored; when the clock is
corrected backwards every stored moment moves with it. The vet's flea cure sets the coat to ≥ 60.
Measured: basic care 2× a day → 87 % happy, 13 % calm, never ill, 4.2–4.5 kg; 1× a day → 23 % sad, never ill;
gone 3+ days → sad, offended, thinner.

**Mood** (−100…100) is a weighted average of the needs minus illness and minus "offended" (§5); shown by poses,
ears, tail and her face, never as a number. Mood names: `happy` (≥ 50), `calm` (≥ 10), `grumpy` (≥ −30), `sad`.
Wants: the lowest need under 40 is what she "wants" (`wants: 'food' | 'water' | 'fun' | 'love' | 'clean' | null`);
the UI hints it (she sits by the bowl, brings a toy, meows at the litter box).

## 4. Consequences (mild) and health
- **Weight** (kg, 3.0–5.6, start 4.2): once a day the average `food` of that day moves it: < 30 → −0.08,
  > 70 → +0.03, too many treats that day (> 8) → +0.04. Under 3.6 she looks **thin** (pose variant `thin`), over 5.0
  **chubby** (fun, not a problem; "Koxa trochu přibrala").
- **Uncooperative:** mood `sad` → ignores toys 50 % of the time, tricks fail, stroking gives half; `grumpy` → belly
  touch always bites (a playful nip, no damage), tail lashes.
- **Illness** (one at a time; signs drawn by Art, told in the hint line):
  - `fleas` (blechy): litter or coat < 15 for 24 h in total → scratches herself, coat dull.
  - `tummy` (bolavé bříško): food or water < 10 for 12 h, or > 12 treats in a day → lies curled, eats little.
  - `cold` (rýma): let out in winter at night, or 5 % a day in winter if energy < 20 → sneezes.
  An ill Koxa loses mood −30 and her needs fall 1.5× faster. She never gets worse than that and never dies.
- **Vet** (Veterinář, a screen): cures any illness for 15 pamlsky; with fewer pamlsky the vet still cures and takes
  what there is ("Zaplatíš příště" — never blocked). The cure = the "give the pill" minigame (§7): win or lose, she is
  cured, a win only spares one extra pill on the next day. Illness without the vet ends by itself after 4 days.
- **Neglect / absence:** away more than 72 h → paní Nováková fed her (the skipped time over 72 h is not simulated):
  she comes back with food 40, water 40, weight −0.1 per day over 3 (at most −0.4), `offended` for 24 h (mood −25,
  turns her back when called once). Postcard if she was allowed out (§8).

## 5. Bond and traits
- **Bond** (přátelství, 0–1000, never falls below a level reached): good care raises it (+1 per satisfied want,
  +5 a day when the day's average mood ≥ 30, tricks +3). Levels: 0 Nová, 100 Známá, 300 Kamarádka, 600 Parťačka,
  900 Nejlepší kamarádka. Levels unlock tricks, furniture and the cat flap (§8).
- **Traits** (drawn once from the seed at adoption, hidden; discovered into the Deníček):
  `favFood` (kapsička | kuře | tuňák), `spots` (two of brada, za ušima, hlava, záda, kořen ocasu), `bellyOk` (0.15–0.4
  chance a belly rub is welcome), `fear` (vysavač | bouřka | ohňostroj), `quirk` (budí ráno | spí v krabici |
  krade ponožky | pije z kohoutku), `toy` (myška | peříčko | klubíčko | laser).
- **Deníček** entries (unlock after the condition, then shown with the date found):
  favourite food (fed it 3×, she ate all with a happy face), each favourite spot (stroked there along the fur 10×),
  belly (5 belly rubs), fear (met it once), quirk (seen 2×), toy (played with it 5×), plus "Váží X kg", "Nejdelší
  toulka", "Narozeniny" (adoption day). Every entry must be reachable (tested).

## 6. Care actions (Etapa 1) — engine `act(st, action, arg, now)`
| Action | arg | Effect (before mood/trait modifiers) |
|---|---|---|
| `feed` | food kind | food + amount, love +2; favourite +5 love, bond +1; when food > 90 she leaves the rest |
| `water` | — | water +60 |
| `stroke` | `{ region, along, speed }` | along & speed ok: love +2 (spot: +4, purr); against: love −1, ears back; belly: bite or +6 |
| `scratch` | `{ region, seconds }` | love +4/s on head/chin/behind ears, purr |
| `pickUp` / `putDown` | place | love +5 if mood ≥ 10 and energy ≥ 20, else she wriggles free (event `wriggle`) |
| `play` | toy | fun +20…+40 (her toy +10), energy −5; ignored per §4 |
| `brush` | — | coat +25, love +1; fleas → finds a flea, coat +10 only |
| `cleanLitter` | — | litter = 100 |
| `letOut` / `letIn` | — | outdoor state; outside she is not in the room (§8) |
| `treat` | — | food +5, love +3, treats today +1 (pamlsky −1) |
| `vetCure` | `{ won }` | illness cleared, pamlsky −min(15, have) |
Added in Phase 1 (engine): `call` (Zavolat / microphone: offended → `turnBack` once, asleep or outside → `ignore`,
else `come`), `vacuum` ("Vysát pokoj", the only way to meet the vacuum fear), `pill` (the extra pill the day after a
lost Pilulka minigame), `rename` (the UI calls `E.rename(st, name)` when the name changes; refusals use `st.name`).
`letOut` is refused while she is ill; outside she comes back by herself after 2–8 h (seeded) or when energy < 25.
Added for Škádlení (§13): `pat { region, n, ms, cv, eating }` (a run of taps on her: like, bliss, a warning, then a
blowUp, a loveBite or a trap), `boop` (a single tap on her nose: she squints and sneezes; the third within 60 s = a swat)
and `splash` (the watering can on her in the garden). `pat` and `boop` keep her on the lap; none of the three works
while she is out or up the tree. Sulking (`st.tease.kind`) also changes `stroke`, `scratch`, `treat`, `call`, `play`,
`pickUp` and `lapOn` (§13.3).

**Settled rules (Phase 1):** she grooms herself, so her coat never falls below 50 unless she is sad, ill or outside
(fleas come in practice from a dirty litter box); paní Nováková helps only after 72 h away, and from hour 12 of the
first 72 h keeps food, water and litter at 40 (she comes back hungry and offended, not ill), bond −20 on return
(never below a reached level); bond −5 for a day with average mood < −30; fun and love fall at the night rate while
she sleeps; how fears and quirks are met: storm (May–Aug, seeded per day) and fireworks (Silvestr) come from
`advance`, vacuum from `vacuum`; quirks count once a day and need two days (budí ráno: the first act between 5 and
10 h; krabice: stroking or playing while she sleeps, or watching her fall asleep; ponožky: 30 % on `play`; kohoutek:
50 % on `water`); the walk entry is found on her first return, the weight entry at the first weighing, the birthday at
once. Food prices exist (`FOODS[k].price`) but are charged only from Etapa 2 (`CHARGE_FOOD`).

`act` returns `{ st, events: [...] }`; events drive the UI (`purr`, `bite`, `wriggle`, `meow`, `ignore`, `found`
(deník entry), `ill`, `cured`, `levelUp`, …). Unknown or impossible actions return an event `refused` with a reason.

## 7. Gestures (Input)
Pointer Events on the scene; mouse and pen behave like one finger.
- **tap**: < 250 ms, < 10 px movement. Every tap carries its time `t`; in 'care' a tap on a cat also carries `pat`
  (the run of taps it belongs to: `n`, tempo `ms`, regularity `cv`, `region`) for Škádlení (§13.1).
- **pat run** (Škádlení, §13.1): taps on a cat at most `PAT_GAP` 900 ms apart, in the same region or within
  `PAT_NEAR` 24 px of the previous tap. Two-finger drumming stays what it is (overlapping fingers = scratch).
- **long press**: 450 ms still (< 10 px) on Koxa → `pickup`; then drag carries her; release over a place → `drop`.
- **stroke**: one pointer moving ≥ 40 px over a body region; direction compared with that region's fur vector
  (cos ≥ 0.5 along, ≤ −0.5 against, else `sideways`); speed px/s: < 120 too slow (nothing), 120–900 good,
  > 900 too fast (counts as rough, love −1). Emits per 40 px of path.
- **scratch**: two pointers on head/chin/ears moving back and forth (≥ 3 reversals in 1.2 s) → `scratch` per second.
- **drag**: an item (food bag, jug, toy, furniture, seedling, pill) from its tray to a target; drop targets light up.
- **flick**: release speed > 600 px/s on a toy → it flies with that velocity, friction, bounces off walls.
- **laser**: in laser mode the dot follows the finger with a short lag; Koxa chases it.
- **tilt** (opt-in in settings, default on when a sensor exists): rolls the klubíčko; reuse Kulička's sensor code
  (deviceorientation, iOS permission button, auto levelling, no-sensor fallback).
- **microphone** (opt-in, default off): "Zavolat {name}" button → getUserMedia audio → AnalyserNode loudness only,
  nothing recorded or sent; a loud call (> threshold for 250 ms) → she turns her ears and comes (unless asleep or
  offended). Denied permission → toast and the switch turns off.
- **sound** (default on): WebAudio synthesized meow (pitch by mood), purr (low rumble while stroked), soft "nom";
  effects `I.sound.fx('sneeze'|'splash'|'shake'|'clink')` for Škádlení (§13.1), not meow kinds.
- **vibration** (default on): purr = short pulses, bite = one sharp buzz.

## 8. Later stages (outline; detailed before each stage)
- **Minigames (Etapa 2)**, 30 s each, records per game, pamlsky = score-based, at most 30 a day in total:
  *Chyť myšku* (mice peek from 5 holes, tap them; Koxa pounces where you tapped), *Laserová honička* (lead her through
  the checkpoints in the room with the dot), *Peříčko* (swing the feather by dragging, tap when she jumps), *Rybaření*
  (garden pond, timing), *Pilulka* (vet: drag the pill into her mouth while she wriggles, 15 s).
- **Economy:** pamlsky earned: minigames, tricks show (1 per trick a day), selling vegetables (2–6), cross-game link
  (1 per game, ≤ 5 a day). Prices: kapsička 2, kuře 3, tuňák 4 (granule free), toys 10–25, furniture 30–120, seeds
  3–8, vet 15. Care must stay possible with free granule and water only (tested: 30 days, no pamlsky).
- **Tricks (Výcvik):** sedni (bond 100, gesture: swipe up), dej pac (300, tap her paw), otoč se (500, a circle),
  panáček (750, two swipes up); a treat within 1.5 s after she performs; 5 successes learn it.
- **Garden (Etapa 3):** 4 beds (6 with bond 600: the garden then draws 6 narrower beds in the same row, clear of the camera button, `A.bedSpots(n)`), crops from `IMAGE_SETS.produce` drawings (ředkvička 2 days, mrkev 4,
  jahody 5, rajče 6, šanta kočičí 3 → catnip toy: fun +60, wild zoomies; harvested while she sleeps or is out it goes to
  the pantry and the player gives it later with "Dát jí" in Deníček → Poklady, action `catnip`), watering once a day by dragging the can
  (an unwatered day pauses growth, never kills), nothing grows outdoors Dec–Feb ("záhony spí pod sněhem");
  birds from `IMAGE_SETS.birds` visit the feeder and she stalks them; dárky (pírko, lísteček, šiška).
- **Toulky (Etapa 4):** "Pustit ven" starts a walk of 2–8 h (seeded); with the cat flap (bond 300; `install: true`: buying
  it puts it in the předsíň door at once, repair installs it for older saves that own it) she also goes out by
  herself while the player is away; returns with a postcard (`IMAGE_SETS.nachod` item, no repeat until all 42 are
  collected; Czech text "Byla jsem u …"), a dárek or nothing. Credits screen `#screenCredits` lists photo authors and
  licenses (copy from games/mahjong or games/pexeso).
- **Visitors:** neighbour cats Mourek, Líza, Bivoj, Čiperka, Pacička, Rambo, Šedivka, Fousek (recoloured rig, each a
  trait); they come to the garden when a bowl or cushion is placed there; friendship 0–5 hearts.
- **Album:** photos taken with the in-game camera (stores pose + scene + date, redrawn, not pixels), postcards,
  visitors, deník. At most 200 photos; the Deníček shows the newest 24 and "Ukázat starší fotky" adds 24 more each tap.
- **Shop toys:** myška se šantou (base mouse, fun +15), míček s rolničkou (base ball, +10), udice s peříčkem (base
  feather, +10) take the place of their basic toy in the tray once bought; a tap on the tray toy switches between the
  two. They play like the basic toy (her favourite counts for its kind) with the bonus.
- **Room:** furniture by drag (škrabadlo, pelíšek, parapet s polštářem, kočičí strom, krabice, koberec, lampa),
  unlocked by bond + bought with pamlsky; positions saved; the window shows season and day phase.

## 8b. Návštěvy 2 (Phase A, user's decision 2026-11-13)
Visitors live in the garden and do things together with Koxa; Koxa has her own friendship with every cat. Phase B
(below) adds the player's interactions with a visitor; Phase C kittens visiting (no adoption).
- **Programme (engine):** `st.visit.act = { kind, since, with }` (`E.VISIT_ACTS`). Alone (`with: null`): `arrive` (on
  the fence, first minutes), `wander`, `drink` (the pond; never in winter), `bench`, `tree`, `nap`, `bowl` (only with
  the miska pro návštěvy). Together (`with: 'koxa'`, only while she is in the garden, awake, not up the tree, on the lap
  or held): `greet` (always the first one), `standoff` (instead of greet while Bivoj has under 3 of her hearts, Rambo
  under 2; it ends by one of them walking away and then only solo acts follow for that visit), `chase`, `wrestle`
  (playful, curious, bold cats from 1 heart, Čiperka at once), `groom`, `snuggle` (from 3 hearts; snuggle also next to
  her when she sleeps in the garden). An act lasts `min` minutes plus an exponential time (`rate` per minute), drawn
  once from its start (`st.seed` and `since`), and the next act is picked from the same start: the programme gives the
  same acts at the same moments whether `advance()` runs every 10 minutes or every 200 ms while she is stroked, and it
  never draws from `st.n`. The greeting comes about 3 minutes after she could first greet (`st.visit.ready`). Joint
  acts change her mood and needs (`fx`, split at the moments the acts change). Leaving the garden ends a joint act at
  once; the visit ends exactly at `until`.
- **Her hearts (`st.visitors[id].pal`, 0–5 in quarters):** +¼ for each joint act except a standoff, at most +½ a visit;
  `reaction()` uses them. The player's hearts stay `friend`. Feeding or stroking a visitor while she is awake in the
  garden raises hers too.
- **Events:** `visitAct { id, kind, with }` (watching only; always when she leaves the garden), `palUp { id, pal }`,
  `found` for the diary entries palFirst, palGroom, palSnuggle (palFirst whenever she has 3+ hearts at a joint act, so
  an older save with the player's hearts finds it before grooming or snuggling).
- **UI:** the visitor is a mover like Koxa (`#visitors`, one box per cat, the same size; walks, trots and runs with the
  leg cycle matched to the speed, jumps on and off the fence, the bench and the tree; goes round the pond). Each act is a
  small looping scene; joint scenes drive Koxa through a long `visit` act (`K.act`), so carrying, care, the lap or petting
  interrupt them cleanly and the visitor waits for her. Distances from the art's "Pózy pro dva": sniff 172, arch 190,
  lickOther 80 (loaf) / 90 (sideLie) / 100 (sit), sideLie 152, swipe 116 / 150, run 184 (art units). The one with the
  lower feet is drawn in front (the licker when they are level). A toast names joint acts; palUp says "Koxa a Líza:
  ♥♥♥ – jsou kamarádky". Deníček and the visitor's menu show both: "Ty ♥♥♡♡♡" and "S Koxou ♥♥♥♡♡".

### Phase B: the player and the visitor (engine 2026-11-13)
New randomness only from `rndSeed` keyed on the moment (salts 30, 31), never `st.n`; nothing depends on the step of
`advance()` or on how often an action is called.
- **Stroking with a finger:** `strokeVisitor { id, region, along, speed }` (Koxa's region ids). `E.VISITOR_LIKES` /
  `E.visitorLikes(id)` = `{ likes, dislikes, gentle, max, text }`: Mourek head, ears (not the belly); Líza only head and
  chin and only gently (≤ 500 px/s; everything else disliked); Bivoj back (not belly, paws); Čiperka everywhere but the
  tail; Pacička chin (not tail); Rambo the root of the tail (not belly, tail, paws); Šedivka back (not paws, tail);
  Fousek ears and chin (not paws). There is no "cheeks" region: chin and ears stand for them. A stroke slower than
  120 px/s is not noticed; faster than `max`, against the fur or on a disliked spot = `visitorDislike { id, region, why:
  'fast'|'against'|'region', away }` and no friendship; Líza under 2 hearts runs off (`visitorLeave` 'shy'), with 2+ she
  moves away a bit (`away: true`); Rambo under 3 hearts swipes (`visitorHiss { id, region }`, −¼ heart once a visit), and
  under 2 hearts he swipes even at a neutral spot in half of the minutes (the same answer for a whole minute). Liked
  (along the fur) = the trait's gain +¼ and the cap +1½ a visit; neutral = the trait's gain, cap +1. Without a region
  (the menu's Pohladit, or an unknown region) as in Phase 5. **Friendship from strokes counts once a minute** however
  many strokes come (`st.visit.pet`); the other strokes still purr.
- **Treat from the hand:** `treatVisitor { id }`: 1 pamlsek, once a visit (`st.visit.treat`), friendship as food by trait
  (greedy +1, others +½), counts as fed today. "Nemáš žádné pamlsky." / "Pacička už pamlsek dostala."
- **Feather for two:** `playVisitor { id, caught }`: one game a minute ("Čiperka si chvilku oddechne."), +¼ heart (at most
  +½ a visit, `st.visit.play`, `playGain`); when Koxa is with them in the garden she plays too (fun +12 if she caught it,
  else +8, energy −3, +¼ of her hearts within the Phase A cap), otherwise `caught` is always 'visitor'.
- **Jealousy:** after a stroke that counted, a treat, or a game the visitor won, while Koxa is in the garden, awake, not up
  the tree, held or on the lap, from bond level Známá: 40 / 30 / 20 % (her hearts for that cat under 1 / 1–3 / 3+), at
  most once every 20 min (`st.jealousAt`). `st.jealous = { since, id }`, event `jealous`, mood −5 meanwhile; stroking or
  scratching her within 2 min = `jealousOk` (love +4), else at 2 min `jealousEnd` (love −4). When she cannot be
  stroked for it any more (falls asleep, goes or is let out, climbs the tree, leaves the garden) it just passes: no
  event, no dip.
- **Sleepover:** `invite { id }`; `E.canInvite(st, id, now)` = `{ ok, reason }` for the button. Only the cat visiting
  now, 5 of the player's hearts, 3+ of Koxa's, 18–22 h, Koxa not out and not up the tree, one a day (`st.invDay`).
  Invited from the garden, Koxa comes in with the guest (`leaveYard` 'house'), so the night is in the house.
  Refusals: "Pacička ještě není tak velká kamarádka." / "Mourek ještě není tak velký kamarád.", "Koxa a Šedivka ještě
  nejsou kamarádky.", "Pozvat na noc jde jen večer (od 18 do 22 h).", "Dnes už u nás jedna návštěva spala.", "… tu teď
  není.", "Koxa je venku.", "Koxa je na stromě.". The visit ends (`visitorLeave` 'inside'), `st.guest = { id, since,
  until, slept }` with `until` = the next 7:00 (never over 14 h), `guestIn`, the diary entry `sleepover` ("Koxa měla
  poprvé návštěvu na noc: Šedivka."). No garden visits meanwhile; the guest is in the living room (strokes only, no
  hearts; other actions "Šedivka je u nás na noc. To počká do rána."); Koxa's mood +5 while she is in the house (not
  out, not in the garden). When Koxa sleeps in the house (never in the garden) and has
  4+ hearts they sleep together (`guestSleep` once, love +3 and energy +1 an hour). At `until`: `guestOut { id, slept }`
  and +¼ heart of each. A long absence ends it in the morning as usual; the clock moving back moves it along.
- **Photos:** a photo record may have `vpose` (≤ 20), `vx` (0–400, whole), `vflip` (only true) — only with a visitor —
  and `nokoxa` (only true). `visitor` = the visitor when the garden (or the bench lap) is photographed, the guest for
  the living room (never for the lap indoors). A photo on the lap keeps her there. With Koxa out (or `nokoxa: true` from the UI) a photo needs a visitor in that place ("Na fotce nikdo
  není."). Older photos are kept exactly as they were.
- **UI (Phase B):** the Input block takes region ids as they are, so `hitRegion` returns Koxa's region or a visitor's as
  `v:<visitor>:<region>` (`catHit`: the cat in front wins where they overlap; a neighbour's coat size is scaled back).
  A finger stroke (and a scratch, as a gentle stroke) on a visitor goes to `strokeVisitor`; while the player is busy
  with a visitor it stays put (`holdVisitor`, like Koxa's `stay()`) and its scene starts again a moment after the last
  touch. Purring, ears back, a short step away (`away`), Rambo's swipe pose with a hiss, a heart over its head; toasts
  are throttled (`tip`). The treat tray item also drops on a visitor (the pamlsek only: the tyčinka is Koxa's, "Tyčinka
  je jen pro Koxu."); a shy one (`gentle`, under 2 hearts) comes
  slowly (`creep` gait) to a hand held still near it for 1.5 s (never while the hand is over Koxa: her treat is hers)
  and backs off from a quick hand or a direct drop. The feather waved near a visitor on the ground makes it crouch (one
  up on the fence, a branch or the bench does not play); after 1.1 s both cats (Koxa when free in the garden) pounce and the one
  nearer the feather catches it (`playVisitor`); while the visitor rests (a minute) Koxa's own feather play works as
  before. Jealousy: Koxa trots to the visitor and does `rub` 104 art units from it, in front of it, then waits in
  front of the player (`K.place`) until `jealousOk` / `jealousEnd`. The visitor's menu shows its likes line and
  "Pozvat na noc" (dimmed with the reason from `canInvite`). The guest (`GZ`, its own mover in the obývák): calm things
  on the rug in the evening, sleeps on the křeslo (the rug when the player sits there), lies down beside Koxa (sideLie,
  `PAIR.sideLie`) when she sleeps in the obývák; at 7:00 it walks out toward the předsíň. Photos: `vx` = 200 + half
  the distance to Koxa (Koxa drawn at 400 − vx), or the visitor's own x when Koxa is not there (`nokoxa`).

### Phase C: kittens visiting (engine 2026-11-13; user's decision: kittens only visit, never a second cat at home)
New randomness from `rndDay` / `rndSeed` keyed on the day or the act's start (salts 40–52), never `st.n`; the litter does
not depend on the step of `advance()`.
- **Litters:** at each new local day (`newDay`) a mother — Líza, Čiperka or Pacička (never Šedivka: she is old) — whose
  player's hearts (`friend`) are 3+ may have kittens: from 7 days after `st.born`, 120 days after the previous litter,
  at most 3 a game, 10 % a day (salt 40; usually within two weeks), never on a night she sleeps over. The kittens are born
  at that day's midnight; the mother stays away 2–3 days (`st.litter = { mother, since, back, count }`, kept after the
  litter for the gap and the count) and then comes with 2–4 kittens. One father (a tom) per litter.
- **Kittens** `st.kits = [{ id: 'k1'…'k12' (litter j: k4j-3…k4j), mother, name, named, fem, coat, born, trait, solo }]`:
  `coat` = the mother's id (55 %) or the father's (a neighbour coat the art draws); `trait` = the mother's (30 %) or drawn
  (playful most likely, never old); `name` = a suggestion (Micinka, Packa, Kulička, Mourinka, Bětka, Fifinka, Ťapka, Žofka,
  Kapička, Lilinka, Mína, Čiča / Tygřík, Čertík, Mikeš, Šmudla, Drobek, Bobík, Fíla, Ťapík, Uhlík, Pepík, Mourínek,
  Kulíšek; never a neighbour's, Koxa's or a sibling's) until the player names it (`nameKitten { id, name }`, cleaned like
  her name; "Napiš koťátku jméno.", "Takové koťátko neznáme." for one never seen; a named kitten counts as met, so it
  stays among the neighbours' cats when grown); `solo` = its first visit alone. A litter is its block of ids (one mother,
  one birth; repair never merges two litters); when the clock moves back the kittens' `born` and `solo` move with it
  like the litter plan, so they keep their age. A kitten under 21 days never visits alone, under 60 days is never the
  guest (repair drops such a visit or guest).
- **Growing:** `kit` (the art's size) is 1 up to 2 days, falls to 0.35 at 21 days and to 0 at 60 days. Under 21 days the
  kittens come only with their mother (`st.visit.kits`; she is picked 3× as often then, never while away); from 21 days a
  young cat visits on its own (weight 0.6 each, all of them at most 3, against 1 for each of the eight: the total rate
  does not change); `kitGrown` at its first visit alone. A kitten (under 60 days) cannot be invited ("Micinka je ještě moc
  malá."), neither a mother with small kittens ("Líza má malá koťátka, musí být s nimi.").
- **Programme:** with the small kittens and Koxa awake in the garden, after the greeting: `kitPlay` (they pounce, pull her
  tail; fun up, energy down), `kitFlee` (she escapes up the tree in the picture, `st.yard.tree` stays; mood −4, no hearts;
  more often under 1 / 3 of her hearts with the mother and when she minds belly rubs, `st.traits.bellyOk`), `kitGroom`
  (she licks one, from 3 hearts; love up). `act.kit` / `visitAct.kit` = the kitten partner (kitPlay, kitGroom), which gets
  the same quarter of Koxa's hearts as the mother.
- **The player and a kitten:** strokes, a treat and the feather as for any visitor, each kitten with its own minute,
  treat and caps (`st.visit.kp`); a small kitten likes strokes everywhere and never runs off or swipes; a young cat
  follows its trait (`visitorLikes(id, st)`).
- **API:** `E.visitor(st, id)` = `{ id, name, trait, fem, coat, kit, mother, ageDays, small }` for the eight and the
  kittens (use it instead of `E.VISITORS[id]`), `E.visitorIds(st)`, `E.kitsNew(st)` (unnamed kittens seen: the
  "Koťátka!" dialog), `album().kittens`, grown kittens in `album().visitors`; events `kittens { mother, n, ids }` (a
  litter's first visit with its mother; not `litter`, the litter box; `alone: true`, n 1, ids [itself]: a young cat that
  nobody saw while small comes on its own the first time), `kitNamed { id, name }`, `kitGrown { id }`, `visitor` /
  `visitorLeave` with `kits`. A garden photo with the mother stores her small kittens (`kits`). Deníček: `kittens`
  ("Líza přivedla na zahradu koťátka: Micinka, Tygřík a Packa.", or "Na zahradu poprvé přišla Žofka, koťátko
  Lízy." when the first kitten seen came alone) and `kitGrown` ("Micinka už chodí na návštěvu sama.").
- **UI (Phase C):** every text takes the name and gender from `E.visitor(st, id)` (`VIS`). A mover knows its `coat` and
  `kit`; the box stays the grown cat's size (the art draws a kitten `kitScale(kit)` big round its feet), anchors from
  `kitAnchor`, REACH scaled by its size, the leg cycle quicker by its size, hit regions from `A.regions` with its kit (no
  extra scaling), `v:k1:head` region ids. All cats are ranked by their feet for the z-order (19, 18 … 12 behind Koxa,
  21, 22 … 25 in front, floor toys 10 and drop rings 11 under every cat, the fly 26, the laser dot 27; a kitten beside its mother in front of her; `zf: 'top'` for the kitten she washes). The small kittens
  (`VZ.kids`) each have a little brain (`kidTick`): follow the mother (walk after her one by one, sit at ±64 art units),
  sleep curled against her when she naps on the ground, tumble, pounce at a sibling (it rolls on its back), chase one,
  climb onto the bench to her and sometimes topple off, drink in front of her, wait under the fence or tree when she is up
  there. With them she comes in and goes out through the gate (they cannot jump the fence). Scenes: `kitPlay` (Koxa sits,
  the partner kitten in `tailCatch` 96 art units behind her on her tail side; then she loafs and it pounces at 100; then it
  tumbles beside her; the distances grow with a bigger kitten by how far its paws reach, from its regions), `kitFlee` (she
  runs to the tree, jumps up and lies on the branch; the kittens wait under the tree, one standing up at the trunk; the
  mother sits on the lawn), `kitGroom` (the kitten sits in front of her chest, a little behind, drawn in front; her
  lickOther tongue (`A.mouth`) on the top of its head (`A.regions` head) at its own size; then it lies beside her). The
  "Koťátka!" dialog (whenFree, 8 s after they come into view, a young cat alone too, or after the `kittens` event, only
  in the garden; never while a finger is down, a drag, carrying her, the laser, the lap or a game: then 3 s later again,
  and any dialog that opens ends a gesture under way, so a dragged treat goes back): a drawing,
  a name field (prefilled with the suggestion, 20 characters, an empty one dims Pojmenovat: "Napiš koťátku jméno.") and
  kočička / kocourek for each; "Později" puts it off for the day (`kitAsk` in the save). A kitten's menu: "koťátko Lízy,
  4 dny" (later "dcera / syn Lízy"), both hearts, Pohladit, Dát pamlsek (small ones; Nakrmit for the young), Přejmenovat,
  Pozvat na noc dimmed with the engine's reason. Treats and the feather go to the cat they are dropped / waved at (the
  nearest one on the ground that is not resting); a dragged treat rings every cat, each ring as big as the cat, the one
  under the finger lit. Photos draw the stored `kits` beside the mother (the side away from Koxa
  first) at the size they had then. Deníček: "Koťátka" (kittens still growing), grown ones among "Kočky od sousedů" with
  "dcera Lízy". Test hook: `forceKittens(mother, kind, days, n)`, `visitor.kids`, `movers`, `moverPoint(id)`,
  `visitorStrokePath(region, against, id)`, `holdVisitor(ms, id)`, `kittenDialog()`, `visitorMenu(id)`.

## 9. Holidays (date → props, texts)
Advent 1.–23.12 (věnec), Mikuláš 5.12 (punčocha), Vánoce 24.12–6.1 (stromeček; she knocks ornaments down),
Silvestr 31.12 evening (ohňostroj: she hides if `fear` = ohňostroj), Masopust (Easter − 47 days: maska),
Velikonoce Good Friday–Easter Monday (kraslice to bat around), Čarodějnice 30.4 (klobouček), Dušičky 2.11 (svíčka
v okně), Koxa's birthday = adoption day each year (dortík, bond +10).

## 10. Storage and the launcher link
- `games.kocka.state` = `{ v: 1, settings, st }`; settings whitelist `DEFAULTS = { name: 'Koxa', theme, vibrate,
  sound, mic, tilt }`; `st` validated field by field (bad field → default; Koxa herself is never reset by a bad field).
- `games.kocka.inProgress` = '1' while she wants something or is ill.
- `games.kocka.mood` = `{ name, mood, wants, ill, ahead }` written on every save (read by the launcher, link on only; the badge always). `ahead` = `[[time, mood, wants, ill], …]` is filled when the page is left: a copy of her moved on up to 48 h, every change of what the launcher shows.
- `games.kocka.treats` = number written by the launcher (link on): +1 per other game started from the launcher,
  at most 5 a day (`{ n, day }`); the game moves them into pamlsky on opening.
- Launcher: Nastavení card "Koxa a ostatní hry" (switch, off by default) in `games.launcher.settings`; when on, the
  header shows Koxa's small face (mood) next to the app icon. "Smazat uložená data" also removes `.mood` and
  `.treats`. Other games are not changed.

## 12. User's feedback after the first playable version (2026-11-12)
The user played it and asked for: (a) a meow that sounds like a real cat, with many variants, never the same twice
in a row; (b) legs that move when she moves — never gliding or "flying" across the floor; (c) more rooms;
(d) sitting on a chair and having her on your lap to scratch her there — but she sometimes runs off, like a real cat.

### 12a. Sounds (Input)
Synthesized (still no files): a formant-based meow ("m-i-a-u": nasal onset, vowel glide i→a→u, pitch contour with a
rise and fall, slight vibrato and breath noise), and variants chosen by situation and randomized every time (pitch
±15 %, length, contour, loudness; never the same variant twice in a row): `mew` (short, kitten-like), `meow`
(normal), `demand` (long, insistent — hungry/thirsty), `plaintive` (sad, falling), `chirp`/`trill` ("mrrp?" greeting,
rolled r), `question` ("mrr?" rising), `yowl` (offended/scared, rare), `hiss`, `purr` (two-layer rumble with the
breathing rhythm in and out, intensity by mood), `nom` (eating crunch), `lap` (soft content murmur). API stays
`I.sound.meow(mood)` and adds `I.sound.say(kind)`.

### 12b. Movement (Art + UI)
Walking is a real gait: legs cycle (at least 4 frames or a continuous CSS leg swing), the step rate follows the
speed, a small body bob; she faces the way she goes; moving toward or away from the viewer on the floor is still a
walk (slightly scaled by depth), never a jump. Jumps only up to / down from raised places (window sill, chair,
lap) with a crouch → leap → land sequence (`jumpUp`, `jumpDown` poses or frames), not the mid-air `pounce`.
`pounce` is only for toys. A trot/run for chasing the laser and toys.

### 12c. Rooms (Art + UI)
Three rooms, side by side; the player switches with arrow buttons at the scene's left/right edges (labelled with the
room's name) — no edge swipe (it would clash with stroking):
- **Obývák** (default): window with the sun patch, rug, **křeslo** (armchair) for the lap, pelíšek, toys.
- **Kuchyně**: food bowl, water bowl, a window, kitchen counter/stove (she may jump on the counter — "Koxo, dolů!").
- **Předsíň**: the door to the garden (cat flap later), the litter box, coat hooks, a shoe she likes to sniff.
She lives in all rooms: the UI decides where she is (wants food → kitchen, litter → předsíň, nap → pelíšek or sun
patch, else wanders), she walks out of one side of the screen and comes in from the other. When she is not in the
room you look at, the hint says where she is ("Koxa je v kuchyni") and the arrow toward her shows her face. Items
from the tray work only where their target is (food/water in the kitchen, scoop in the předsíň); dragging them in
another room says where to go. The current room and her room are saved.

### 12d. Lap (Engine + Art + UI)
In the Obývák tap the **křeslo** → "Sedneš si do křesla". If she is in the room, carry her onto your lap (or call
her: she may come and jump up by herself when her mood is good). The view switches to a **lap close-up** (your knees
from above, Koxa lying on them; regions for stroking/scratching as usual, a bigger cat so strokes feel close). On the
lap stroking and scratching count more (love ×1.5) and she purrs more readily. She stays a while and then, like a
real cat, may jump down and run off — seeded, more likely when she is hungry/thirsty/bored, offended, or after
"against" strokes or belly touches, less likely when sleepy and happy (she may doze off on the lap: then she stays
until woken). Engine actions: `lapOn` (refused/wriggle when she doesn't want it), `lapTick` driven by `advance`
(events `lapLeave {reason}`, `lapDoze`), `lapOff` (the player stands up). "Vstát" button leaves the chair.

### 12e. Outside: the garden is a place (user's wish 2026-11-12: "go outside", "a bit more complex")
The house has four places now: **Obývák, Kuchyně, Předsíň, Zahrada**. From the Předsíň the door leads to the
**Zahrada** (the player goes out too; the arrows include it). The garden scene changes with season, day phase and
weather (rain in spring/autumn, snow in winter: she hates rain — comes back wet and grumpy, coat −; snow: paw prints,
she shakes her paws). In the garden:
- **záhony** (beds) from Etapa 3, pulled forward: dig/sow by dragging a seed packet, water by dragging the can once a
  day, harvest by tapping a ripe plant (crops from `IMAGE_SETS.produce`), **šanta kočičí** makes her wild;
- a **tree** she climbs (and sometimes can't get down: "Koxa je na stromě" → call her / reach up with a long press);
- a **bench** — sit on it and have her on the lap outside, like the armchair (§12d);
- **birds** at a feeder (drawings from `IMAGE_SETS.birds`) she stalks (crouch, tail twitch, chatter) and
  **butterflies** in summer she jumps at; she brings **dárky** (pírko, lísteček, šiška; never dead animals);
- the **garden gate**: she may slip out on a walk (toulky §8, postcards from `IMAGE_SETS.nachod`) when she is
  allowed out — the player decides with "Pustit ji ven" (only when bond ≥ 300 or the cat flap is bought later);
- the neighbour cats (§8 Visitors) come over the fence.
Outside together she gains fun fast and gets a little dirtier (coat −); leaving her alone in the garden is like
letting her out (`letOut`). Night: the garden is dark with fireflies in summer; she wants to go out at dusk.

## 11. Texts and names
- `nameForms(name)`: Czech cases for the common phrases are avoided by phrasing ("Koxa má hlad", "Zavolat: Koxa",
  "Pohlaď Koxu" only when the accusative is safe: names ending in -a → -u; otherwise "Pohlaď ji").
- Hint line examples: "Koxa má hlad – nasyp granule do misky", "Koxa chce pít", "Koxa se nudí – vezmi hračku",
  "Koxa chce pomazlit", "Kočičí záchod potřebuje uklidit", "Koxa spí, nebuď ji", "Koxa je nemocná – zajdi
  k veterináři", "Koxa je uražená".
- Help explains every gesture with a small drawing (Art) and the needs.

## 13. Škádlení (teasing out of love, user's decision 2026-11-13: "co se škádlívá, to se rádo mívá")
Small, funny teasing, nothing complicated: patting (taps in a row), the watering can on her, a tap on her nose, her
payback and making it up. **Rules:** the consequences are mild (a short sulk, making up, nothing is lost); no real fear
(no cucumber, no jump scares, no pulling the tail) and **never claws** (every swat, grab and pounce says "bez drápků" or
shows none); **a sleeping Koxa never blows up**. This section is the contract between the three blocks and the UI:
Engine (`src/engine.js` + `tools/kocka-test.js`), Art (`src/art.js` + `art.html`), Input (`src/input.js` +
`feel.html`) are built in parallel without talking to each other; nobody but the UI step runs `assemble.js`. Where the
plan left a detail open, the answer chosen here is marked **Decided:** — follow it, do not choose another.

Player-visible Czech: Koxa is "ona" (vyletěla, plácla); the player is always in the present tense ("když ji
pokropíš", "když ťukneš"), never in a past tense with a gendered ending. `{n}` below = the cat's current name (`nm()`
in the UI, `st.name` in the engine); `{an}` = its accusative from the UI's `acc(n)`.

### 13.1 Input (`src/input.js`)
**`tap` gets two fields:**

| Field | Mode | Value |
|---|---|---|
| `t` | every mode | ms of the release, from `opts.time(e)` (the same clock as the other gesture times) |
| `pat` | `'care'` only (the key is absent in other modes) | `{ n, ms, cv, region }` when the tap is on a cat (`cat: true`, a region was hit, no `item`); otherwise `null` |

`pat.n` = the number of taps in the run including this one (1, 2, 3 …, not capped); `pat.ms`, `pat.cv` = `rhythm()` of
the run's last `PAT_WINDOW` tap times; `pat.region` = the hit region's id as `hitRegion` gave it (`'nose'`, `'back'`,
`'v:liza:head'` …).

**The run** (one per `attach()`): new thresholds in `T`: `PAT_GAP: 900`, `PAT_NEAR: 24` (CSS px), `PAT_WINDOW: 6`.
- A tap with a `pat` **continues** the run when `t − last ≤ PAT_GAP` **and** (its region id equals the previous tap's
  **or** both region ids belong to the same cat — no `v:` prefix for Koxa, the same `v:<id>:` prefix for a visitor — and
  the tap is at most `PAT_NEAR` px from the previous tap). Otherwise it **starts a new run** (`n = 1`).
- **The run is cleared** (the next pat tap is `n = 1`) by: a tap whose `pat` is `null`; every emitted event other than
  `tap` (stroke, scratchStart, pickup, longpress, dragStart, swipe, laser, …); every pointer released without a tap
  (moved, rubbed, long press); `setMode()`, `cancel()`, `detach()`.
- **Decided:** `ms`/`cv` look only at the last 6 taps, so a run that slows down is judged by its present tempo.
- **Two fingers:** alternate drumming with two fingers on Koxa stays exactly what Input makes of it today: fingers that
  overlap in time are a scratch (no taps); taps that do not overlap form a pat run like any taps. Nothing new may throw.

**Pure helper** `rhythm(times)` (exported with the other helpers): `times` = ascending ms →
`{ n: times.length, ms, cv }`; fewer than 2 times → `ms: 0, cv: 0`; else over the intervals: `ms = Math.round(mean)`,
`cv = round2(populationStdDev / mean)` (0 when the mean is 0). One interval → `cv: 0`.

**Sounds:** `I.sound.fx(name)` → `name` when started, `null` when the name is unknown, sound is off, before the first
gesture or while the page is hidden (the same gates as `say`). `I.sound.FX = ['sneeze', 'splash', 'shake', 'clink']`.
They are **not** meow kinds: never added to `KINDS` (`say()` silently turns an unknown kind into a meow). Synthesized,
no files: `sneeze` a short "hapčí" (a breath in, then a sharp noise burst with a high formant, ~0.35 s); `splash` water
poured on fur (filtered noise burst with a bubbly decay, ~0.5 s); `shake` a quick whole-body shake (fluttering noise,
amplitude modulated ~12 Hz, ~0.6 s); `clink` an enamel mug hitting tiles (a few inharmonic partials 1.2–3.5 kHz with a
fast decay, then a smaller clink ~120 ms later). Randomized a little each time like the meows.

**feel.html:** a "Škádlení" section: a pad on the cat that prints every tap's `pat` (n, ms, cv, region; the run
visibly continuing or restarting) and a button for each `fx` name.

### 13.2 Art (`src/art.js`)
**Region `nose`** (Koxa, visitors and kittens alike, since they share `head()`):
- in `head()`, only when the face is visible (`!h.back`), a polygon of about 26 × 18 head units round (0, 11) in the
  head's own frame (x −13…13, y 2…20), mapped like the other head regions (kitten head scale and lap zoom included);
  `fur` = `v(0, -1)` (as the head);
- `ORDER = ['nose', 'chin', 'tail', 'paws', 'head', 'ears', 'tailBase', 'belly', 'back']` (the nose wins over chin and
  head). The UI's visitor ids become `v:<id>:nose`; the engine maps `nose` to `head` (§13.3), Input passes it on as is.

**New poses** (both stand on (100, 186), no anchor entry):

| Pose | Picture | Regions | Animation |
|---|---|---|---|
| `rearUp` | "zadeček jako výtah": front low (chest near the floor, front paws flat), the rear and hind legs straight up, tail straight up; side view facing left, happy face | nose, chin, head, ears, paws, tail, tailBase, back (no belly) | front paws tread alternately: class `kx-tread` on them, ~0.6 s cycle, infinite |
| `shake` | standing, shaking her whole body (motion lines at the sides, ears flat); with `o.wet` drops fly off | nose, chin, head, ears, paws, tail, tailBase, back | `kx-shake` on the body group, ~0.4 s side wobble, 3 cycles then still; with `o.wet` the drops `kx-drops` fly out once |

`rearUp`'s `tailBase` centroid lies within 15 art units of the `tailBase` centroid in `loaf` (**Decided:** `loaf` is the
reference; art.html prints the distance to `loaf` and to `sit`), so a tap run on her rear goes on when she lifts it
(`PAT_NEAR` and the same region id cover the rest).

**New options** of `cat()` (and of `regions()`/`mouth()`/`headPoint()` where they move something):

| Option | Effect |
|---|---|
| `o.eyes: 'cross' \| 'squint'` | overrides the eyes **after** the pose chose its own (applied inside `head()` / `faceDetails`, so no pose overrides it); `cross` = cross-eyed, both pupils turned to the nose; `squint` = tightly pinched, contented-annoyed. Ignored when the head faces away |
| `o.achoo` | a one-time sneeze: the head jerks forward and down once (`kx-achoo` on the head group, ~0.5 s, plays once), eyes `squint` unless `o.eyes` says otherwise, mouth open. Not the cold's `h.sneeze` (that one keeps its `kx-sneeze` loop) |
| `o.shakeHead` | the head shakes left–right twice (`kx-shakeHead`, ~0.6 s, once) |
| `o.warn` | the tail tip lashes fast (`kx-warn` on the tail tip, ~0.35 s, infinite), ears `'turned'` unless `o.ears` is given, the skin on the back twitches (`kx-twitch`, a ripple of the back patch, ~0.9 s, infinite). Every pose with a tail; a pose without a visible tail only turns the ears |
| `o.grab` | in `belly` and `lapBelly`: the front legs hug the space just above the belly (the hand), the hind legs kick (`kx-kick`, ~0.4 s, infinite); claws are never drawn |

Also the CSS class **`kx-flick`** on any ancestor: her right ear twitches once (~0.4 s), for taps on a sleeping cat.

**New exports:**
- `A.headPoint(pose, opts)` → `{ x, y, nose, back }` in the cat's 0…200 viewBox (kitten and lap zoom applied as in
  `mouth()`): `x, y` = the middle of the head, `nose` = `{ x, y }` of the nose tip or `null` when she faces away,
  `back` = she faces away; `null` for an unknown pose. **Decided:** it also returns the nose so the UI can put the sneeze
  puff on it.
- `fx('splash')` (a splash of water with drops) and `fx('puff')` (a small sneeze cloud with two droplets): the usual
  40 × 40 effects, listed in `A.fxs`.
- `item('mug')`: the enamel mug (smaltovaný plecháček: cream-white, blue rim and handle, a small chip), standing on
  y≈90; `itemSize.mug = { w: 26, h: 26 }` (room units). **Decided:** one picture; the UI turns it while it falls.
- Every new animation is under the existing `prefers-reduced-motion` rule (no movement, the still picture stays clear).

**art.html:** a "Škádlení" sheet: `rearUp`, `shake` (dry and wet), `cross`/`squint` in `sit`, `loaf` and `lapLoaf`,
`achoo`, `shakeHead`, `warn` in `sit`/`loaf`/`lapLoaf`, `belly` and `lapBelly` with `grab`, the `nose` region outlined on
`sit`, `loaf`, `lapLoaf`, a neighbour and a kitten, `fx('splash')`, `fx('puff')`, `item('mug')`.

### 13.3 Engine (`src/engine.js`)
**State.** The only new field is `st.tease` (create → `STATE_KEYS` → canonical repair → `shiftTimes`):

| Key | Type, range | Default | Meaning |
|---|---|---|---|
| `kind` | `null \| 'sulk' \| 'cross'` | `null` | uražená (sulk) / opravdu se zlobí (cross) |
| `until` | ms | 0 | when `kind` ends (0 when `kind` is null) |
| `heat` | 0…10 | 0 | how teased she is, the value at the moment `at` |
| `at` | ms ≤ t | 0 | the last pat, boop or splash; `heat` was brought up to date then |
| `warnAt` | ms ≤ t | 0 | the warning of the current run (0 = none) |
| `boops` | `[ms]`, ascending, ≤ 2 in a saved state | `[]` | nose taps of the last 60 s (the third makes the swat and empties it) |
| `gain` | 0…12 | 0 | love from pats in the current window (up to 8); 12 = the flop's +4 was given too, the window is full |
| `gainAt` | ms ≤ t | 0 | start of that 10-minute window (0 = none) |
| `pay` | `null \| { kind: 'shelf' \| 'ambush', at: ms }` | `null` | a planned payback: due from `at`, lapses at `at + 120 min` |
| `payDay` | day key or 0 | 0 | the local day of the last payback (one a day) |
| `bondDay` | day key or 0 | 0 | the local day bond +1 was given for a flop or a reconcile (one a day, shared) |
| `splash` | ms or 0 | 0 | **Decided (added):** `st.wet` as the can set it; she is "wet from the can" while `st.wet > t && st.wet === tease.splash` |

`heat` cools analytically, never in steps: `heatNow(t) = max(0, heat − (t − at) / (10 min))`. Before any change of
`heat` (and on every pat, boop and splash) `heat = heatNow(t); at = t`. So the step length of `advance()` never matters.

**Repair (canonical; after `st.wet` and `st.off` are repaired):** not an object → the default.
`kind` stays only when it is `'sulk'`/`'cross'`, `until` is a valid time with `t < until ≤ t + 3 min` (sulk) or
`t + 20 min` (cross), and no long offence is running (`!(st.off && t < st.off.until)`); else `kind: null, until: 0`.
`heat` = number clamped 0…10 (else 0); `at` = a moment ≤ t (else 0); `at` 0 → `heat` 0. `warnAt` = a moment ≤ `at`
(else 0). `boops` = the valid times in `(t − 60 s, t]`, sorted, the last 2. `gain` clamped 0…12, `gainAt` a moment ≤ t;
`gainAt` 0 or `t − gainAt ≥ 10 min` → both 0. `pay` = `{ kind, at }` only with a known kind, a valid `at` in
`(t − 120 min, t + 45 min]` and no long offence; else `null`. `payDay`, `bondDay` = a day key ≤ `dkey(t)`, else 0.
`splash` = a valid time `> t` that equals `st.wet`, else 0. Unknown keys dropped. An older save without `tease` gets
the default; `st.off` is never changed by any of this.

**shiftTimes (the clock moved back by d):** `until` (when `kind`), `at`, `warnAt`, `gainAt`, `splash` (when non-zero),
every `boops` entry and `pay.at` move by d (`st.wet` moves too, so `splash === st.wet` still holds); `payDay`,
`bondDay` = `min(key, dkey(now))`; `heat`, `gain` stay.

**`st.off` is untouched.** It stays the 24 h offence after an absence over 72 h. While it runs (`st.off && t <
st.off.until`) teasing **never starts** a sulk or a cross and **never plans** a payback (the blowUp, the swat and their
love and heat still happen). The absence over 72 h (the `gap > AWAY` branch of `advance`) sets `tease.kind = null,
until = 0, pay = null` (heat cools by itself).

**Teasing active** = `teasing(st) = st.tease.kind && st.t < st.tease.until`. While it is active **`palAwake()` is
false** (**Decided:** so a joint visit act ends at the next step via `apart()`, no joint act or jealousy starts while she
sulks; the visit programme is otherwise unchanged).

**Constants** (exported frozen as `E.TEASE`; copy exactly):
```js
const TEASE = deep({
  fast: 260,           // ms: a mean interval under this is drumming ("fast")
  regular: 0.3,        // cv under this is regular
  warnN: 3,            // irritation paths warn from this tap of the run
  overN: 14,           // every other path warns (over-patting) from this tap
  warnMs: 1800,        // blowUp / loveBite only when the run goes on at least this long after the warning
  runGap: 1500,        // ms: a pat later than this after tease.at belongs to a new run (the engine's own check)
  rearN: 3, flopN: 8, flopClose: 0.4,   // bliss: the rear up from tap 3; the flop exactly at tap 8 when close >= 0.4
  closeSpan: 300,      // close = clamp(1 - |ms - fav| / 300, 0, 1)
  fav: [400, 650],     // her favourite tempo (ms): patTempo(st)
  like: 1, bliss: 1, blissClose: 0.5,   // love per pat: like +1, bliss +1 + 0.5 × close
  gainMax: 8, gainWin: 10,              // love from pats: at most +8 per 10-minute window
  flopLove: 4, bond: 1,                 // the flop: love +4 over the cap (once a window: gain = 12), bond +1 (once a day, shared with reconcile)
  heatMax: 10, cool: 10,                // heat 0..10, −1 per 10 minutes
  heat: { blowUp: 2, eat: 1, loveBite: 1, trap: 1, boop: 1, splash: 2 },
  crossAt: 5,                           // heat >= 5 after adding = cross, else sulk
  sulkMin: 3, crossMin: 20,
  love: { blowUp: -2, eat: -1, loveBite: -1, splash: -3, reconcile: 3 },
  boopN: 3, boopWin: 60000,             // the 3rd nose tap within 60 s = a swat
  wetMin: 30,                           // splash: wet until max(st.wet, t + 30 min)
  pay: { p: 0.5, min: 5, max: 25, lapse: 120, ext: 5 },   // payback: chance for a sulk, delay after the end, lapse, see below
  mood: { sulk: -10, cross: -20 },
});
```
**Decided:** `heat.eat 1` and `love.eat −1` (the meal blowUp is the mild one); `heat.boop` is for the boop swat;
`runGap` is the engine's run check (Input's own run uses `PAT_GAP`).

`E.patTempo(st)` = `400 + Math.floor(hash32(st.seed, 0x7A17, 8) / 4294967296 * 251)` (400–650 ms, not stored; `k = 8` is
free in `drawTraits`). `close = clamp(1 − |ms − patTempo(st)| / 300, 0, 1)` (`ms` 0 → close 0).

**New actions** (added to `ACTIONS`); `REGION_ALIAS` gets `nose: 'head'` (so `stroke`, `scratch`, `strokeVisitor` and
the visitors' `v:<id>:nose` count the nose as the head; `REGIONS` and the diary spots do not change). `pat` and `boop`
join the lap-keeping list (`['stroke', 'scratch', 'treat', 'call', 'lapOn', 'lapOff', 'photo', 'pat', 'boop']`);
`splash` does not. None of the three is in `home` or `TREE_OK`, so out → "{n} je venku.", up the tree → "{n} je na
stromě." (the existing general refusals).

| Action | Argument (clamped) | Refusals (exact) |
|---|---|---|
| `pat` | `{ region: regionOf(region, 'head'), n: integer 1…999 (else 1), ms: 0…5000 (else 0), cv: 0…3 (else 0), eating: === true }` | only the general ones |
| `boop` | — | "{n} spí, nebuď ji." (asleep, or dozing on the lap) |
| `splash` | — | in this order: "Konví se zalévá na zahradě." (`!st.yard`), "V zimě ne – byla by jí zima." (`season(t) === 'winter'`), "{n} spí. Nech ji spát." (asleep) |

**Helpers used below.**
- *fresh run*: `n ≤ 2 || t − at > runGap` → `warnAt = 0` (evaluated before `at = t`).
- *warn logic* (for a path that has reached its warning tap): `warnAt === 0` → `warnAt = t`, event `pat { stage: 'warn' }`;
  else `t − warnAt ≥ warnMs` → the outcome (blowUp or loveBite); else `pat { stage: 'warn' }` again.
- *offence(t, mins)* (start or prolong sulk/cross): heat was already added. If the long offence runs: nothing. Else if on
  the lap: `leaveLap(st, t, 'annoyed', ev)` first (lapLeave comes before the cause's event — **Decided:** the engine pushes
  the lapLeave event before blowUp/loveBite/boop/splash); `st.held = false`. A cross running or `heatNow ≥ crossAt` → `kind 'cross'`,
  `until = t + 20 min`, event `cross { until }` (a running cross is renewed); else `kind 'sulk'`, `until = max(until, t + 3 min)`, event `sulk { until }`. Then plan the payback.
- *plan payback* (at the start or prolonging of an offence; never for the meal blowUp): if `pay` exists → `pay.at =
  max(pay.at, until + 5 min)`; else if `payDay !== dkey(t)` and (`kind === 'cross'` or `rndSeed(seed, floor(t/1000), 53)
  < 0.5`) → `pay = { kind: rndSeed(…, 55) < 0.5 ? 'shelf' : 'ambush', at: until + (5 + floor(rndSeed(…, 54) × 21)) min }`.
  All three draws keyed on `Math.floor(t / 1000)` of that moment.

**`pat` decision** (the action emits exactly one of `pat`, `swat`, `trap`, `blowUp`, `loveBite`, plus what the table
adds):

| # | Case | Result |
|---|---|---|
| 0 | asleep, or dozing on the lap | `pat { region, stage: 'tolerate', sleeping: true }`; nothing changes (no wake, no heat, no `at`) |
| — | (then: fresh-run check, `heat = heatNow(t)`, `at = t`) | |
| 1 | cross running | `swat { why: 'pat' }`; no heat, no love; `warnAt = 0` |
| 2 | `eating` | warn from n ≥ 2 → outcome `blowUp { why: 'eat' }` (mild) |
| 3 | `belly` | `trap`; heat +1; on the lap annoy +2; no love change, no offence; `warnAt = 0` |
| 4 | `head`, `chin`, `ears`, `paws` (the nose is `head`) | path *tolerate* |
| 5 | `tail` | path *irritate* `'tail'` |
| 6 | `back` / `tailBase`, `ms > 0 && ms < 260` | path *irritate* `'fast'` |
| 7 | `back` / `tailBase`, mood sad | path *tolerate* |
| 8 | `back` / `tailBase`, mood grumpy, or sulk running, or the long offence | path *irritate* `'grumpy'` |
| 9 | `back` (calm or happy) | path *like* |
| 10 | `tailBase` (calm or happy), `cv < 0.3` | path *bliss* |
| 11 | `tailBase` (calm or happy), irregular | path *like* |

- *irritate*: n < 3 → `pat { stage: 'tolerate' }`, `warnAt = 0`; n ≥ 3 → warn logic → outcome `blowUp { why }`.
- *tolerate / like / bliss*: n ≥ 14 → warn logic → outcome `loveBite`. Below 14: `warnAt = 0` and
  - tolerate: `pat { stage: 'tolerate' }`, no love;
  - like: love +1 within the window, `pat { stage: 'like' }`;
  - bliss: love `1 + 0.5 × close` within the window, `pat { stage: 'bliss', close, rear: n ≥ 3 }`; at **n === 8 with close ≥
    0.4** also `flop { lap }`: if `gain ≤ 8` → love +4 and `gain = 12` (the window is used up), bond +1 when `bondDay !==
    today` (then `bondDay = today`), Deníček `bliss`. **Decided:** the climax bypasses the per-window cap, because taps 1–7
    already fill the +8 and a flop limited by it would almost never give anything: a run of 8 steady pats in her tempo gives
    about +8 +4, and the full window (`gain = 12`) gives no more love to later pats or flops until it ends.
  - like and bliss also `soothe()` the jealousy and, on the lap, set `st.lap.pet = t`.
- *the love window*: `!gainAt || t − gainAt ≥ 10 min` → `gainAt = t, gain = 0`; then `add = min(amount, 8 − gain)`,
  `gain += add`, love += add.
- **blowUp** `{ why: 'fast' | 'grumpy' | 'tail' | 'eat', lap }`: love −2 (eat −1), heat +2 (eat +1), `warnAt = 0`, then
  offence (sulk 3 min or cross); the payback is planned except for `'eat'`. `lap: true` when she was on the lap.
- **loveBite** `{ lap }`: love −1, heat +1, `warnAt = 0`, **no** offence; on the lap `leaveLap('annoyed')` (pushed first).

**`boop`:** the lap stays. Cross running → `swat { why: 'boop' }` (no heat, `boops` unchanged). Else drop `boops` older
than 60 s, push t, `heat = heatNow(t)`, `at = t`. Three in the list → `boops = []`, heat +1, event `boop { swat: true }`
then offence (sulk or cross; on the lap she leaves it). Otherwise event `boop {}` (she squints, sneezes, shakes her
head), Deníček `boop`. A boop gives no love. (A run of taps on the nose is never a boop: from `n ≥ 2` the UI sends
`pat` with the region `nose` = head.)

**`splash`:** `st.held = false`; `w = t + 30 min`: if `w > (st.wet > t ? st.wet : 0)` → `st.wet = w`, `tease.splash = w`
(else she is already wetter from the rain and `splash` stays as it was); love −3; heat +2 (`at = t`); event `splash {}`
then offence (a running cross is renewed to t + 20 min); Deníček `splash`. **Rain after a splash still soaks her:** the
garden's rain check becomes `if (!(st.wet > t) || st.wet === st.tease.splash) { coat −10; event wet }` and then sets
`st.wet = t + 120 min` as now (so she is no longer "from the can"). Mood: the existing wet −15 applies.

**Making up (reconcile)** — only a **sulk** (never a cross), only while she is awake:
- `stroke` along the fur at a good speed (not belly, not sideways), `scratch` (not belly), `treat` (pamlsek or tyčinka):
  the action does what it always does, then `kind = null, until = 0`, love +3, bond +1 when `bondDay !== today` (then
  `bondDay = today`), event `reconcile { by: 'stroke' | 'scratch' | 'treat', bond }` (bond = whether +1 was given),
  Deníček `reconcile`. No `sulkEnd` after a reconcile.
- a stroke against the fur, too fast, sideways, or on the belly leaves the sulk as it is.

**While cross runs** (and she is awake):

| Action | Result |
|---|---|
| `stroke` (not too slow), `scratch` | `swat { why: 'stroke' \| 'scratch' }` instead of the usual effect; no love, no heat |
| `pat`, `boop` | `swat { why: 'pat' \| 'boop' }` (above) |
| `call` | `ignore { reason: '{n} tě teď schválně neposlouchá.' }` (after the out, asleep and tree checks) |
| `play` | `ignore { reason: '{n} si s tebou teď hrát nechce. Zlobí se.' }` (after `sleeping()`) |
| `treat` | she eats it as always (`treat`), stays cross |
| `pickUp`, `lapOn` | `wriggle` |
| `splash` | as above (the cross is renewed) |

Asleep she behaves as asleep (the sleeping purr), never swats. Training, feeding, brushing and the rest are unchanged.

**Ending:** in `step()`, when `kind` and `t + dt ≥ until`: event `sulkEnd {}` or `crossEnd {}`, `kind = null, until = 0`
(in any advance, watching or not). The moment is exact, so the step length does not matter.

**Payback** (checked in `step()` after the ending, at `te = t + dt`): `pay` and `te ≥ pay.at + 120 min` → `pay = null`
(lapsed, silent); `payDay === dkey(te)` → `pay = null`; else when `te ≥ pay.at`, **the advance is watching**
(**Decided:** never inside a long catch-up, so the player sees it) and she is free — not asleep, not out, not on the lap,
not held, not up the tree, not scared, no joint visit act (`st.visit.act.with`), not jealous, not teasing, no long offence —
event `payback { kind }` with `kind = st.yard ? 'ambush' : pay.kind` (**Decided:** no counter in the garden), `payDay =
dkey(te)`, `pay = null`, Deníček `payback`. Not free → it waits until it lapses.

**Events** (add to the header comment of engine.js):

| Event | Fields | When |
|---|---|---|
| `pat` | `region` (after the alias), `stage: 'like'\|'bliss'\|'tolerate'\|'warn'`, `close?` and `rear?` (bliss), `sleeping?` (true), `eating?` (true while `eating`) | a pat that did nothing bigger |
| `flop` | `lap` | after `pat` bliss at tap 8 |
| `blowUp` | `why: 'fast'\|'grumpy'\|'tail'\|'eat'`, `lap` | the warned run went on 1.8 s |
| `loveBite` | `lap` | over-patting went on 1.8 s after its warning |
| `trap` | — | a pat on the belly |
| `boop` | `swat?` (true on the 3rd within 60 s) | a nose tap |
| `swat` | `why: 'pat'\|'boop'\|'stroke'\|'scratch'` | touched while cross |
| `splash` | — | the can on her |
| `sulk` / `cross` | `until` | an offence starts or is prolonged / a cross starts or is renewed |
| `sulkEnd` / `crossEnd` | — | the time ran out |
| `reconcile` | `by: 'stroke'\|'scratch'\|'treat'`, `bond` | made up after a sulk |
| `payback` | `kind: 'shelf'\|'ambush'` | her revenge, at most once a day |
| `found` | `id`, `text` | as before; the five new diary ids |

Order inside one action: `lapLeave` → the cause (`blowUp`/`loveBite`/`boop`/`splash`) → `sulk`/`cross` → `found`.

**`health()` adds:** `sulk` (sulk running), `cross` (cross running), `splashed` (`st.wet > t && st.wet ===
st.tease.splash`), `teaseUntil` (`until` while teasing, else 0). **`moodValue()`:** sulk −10, cross −20 (the wet −15
exists). The launcher's `ahead` follows by itself.

**Deníček:** five new ids, after `birthday` and before the cat entries: `['bliss', 'boop', 'reconcile', 'splash',
'payback']` (in `DIARY_IDS` and in `diary()`; 16 → **21** entries, each reachable, tested with `discover`):

| id | Found at | Text | Hint (not found) |
|---|---|---|---|
| `bliss` | the first flop | "{n} má ráda, když ji poplácáváš u kořene ocasu – svižně. Zvedne zadeček jako výtah a přešlapuje." (`svižně` when `patTempo ≤ 520`, else `pomalu a pravidelně`) | "Co jí udělá radost u kořene ocasu?" |
| `boop` | the first `boop {}` (not the swat) | "Když jí ťukneš do nosu, {n} zašilhá a kýchne." | "Co udělá, když jí ťukneš do nosu?" |
| `reconcile` | the first reconcile | "{n} se po škádlení usmířila: otřela se ti o ruku." | "Jak se usmíříte, když ji naštveš?" |
| `splash` | the first splash | "{n} dostala sprchu z konve. Otřepala se a hodnou chvíli se zlobila." | "Možná se jednou dozvíš…" |
| `payback` | the first payback | "{n} ti to vrátila. Co se škádlívá, to se rádo mívá!" | "Kdo ví, co ji jednou napadne…" |

**Decided:** the boop text avoids the dative of the name ("{Koxe}" breaks for other names, §11).

**Exports:** `TEASE`, `patTempo`. **Tests** (`tools/kocka-test.js`): as in the plan's §5; the existing test at about
line 1564 that expects `'nose'` to be an unknown visitor region uses `'whiskers'` instead, plus a test that a visitor's
`nose` counts as its head.

### 13.4 UI (`games/kocka/index.html`, after the three blocks are assembled)
**Tap routing** in `onTap` (the item and visitor branches stay first; then for a tap on Koxa):
1. asleep (not on the lap) → today's tip "{n} spí, nebuď ji." and `zzz`, **plus** the class `kx-flick` on her for 450 ms;
   dozing on the lap → `zzz` as now; up the tree → as now. None of them sends `pat` or `boop`.
2. `K.teaseLock > perf()` → the tap is ignored (no meow).
3. cross running: `pat.n === 1` → `tip('cross', '{n} dělá, že tě nevidí.', 4000)` (no meow, no bubble); `n ≥ 2` → `doAct('pat', …)`.
4. `!ev.pat || ev.pat.n === 1` → today's meow and bubble; when the region is `nose` also `doAct('boop')`.
5. `ev.pat.n ≥ 2` and the region is Koxa's (no `v:` prefix) → `doAct('pat', { region: ev.pat.region, n, ms, cv, eating:
   !!(K.act && K.act.kind === 'eat') })` instead of the meow. Never while `K.gone`, carrying, on the tree, asleep or
   dozing (rule 1 already returned).
After an outcome that ends the run (`blowUp`, `loveBite`, `trap`, `swat`, `flop`) the UI calls `gest.cancel()`, so the
next tap starts a new run. **Locks** (`K.teaseLock = perf() + ms`): blowUp 2500, trap 2200, loveBite 1200, swat 1000,
flop 1500, boop 1600 (only against a second boop animation; pats are not locked by a boop).

**`decide()` order:** the jealousy clean-up, `K.act`, out, tree, asleep, scared, then **new: `K.sulkPlace`** (while
`h.sulk || h.cross`; made lazily from `kPos()` when missing, e.g. after a reload; cleared when neither runs, on
`reconcile`, and on `put` when the player carried her somewhere), then `K.place`, the long offence, wants … as now.
`K.sulkPlace = { p: { room: here, pose: 'sulk', fx: k.x < 200 ? 330 : 70, fy: garden ? clamp(k.y, 470, 590) : 560, fast:
true, o: { mood: 'grumpy', ears: 'back' } }, until: perf() + (teaseUntil − now()) }`. The events `blowUp`, `sulk`,
`cross`, `splash` and `swat` clear `K.place` (as `K.jealousPlace`). `rearUp` is played with `busy('rearUp', { room: G.her,
pose: 'rearUp', fx: k.x, fy: k.y, o: { mood: 'happy', purring: true } }, 1600)` from `kPos()` (each bliss pat renews it),
never through `K.place`. When a batch holds `lapLeave` and `blowUp`/`loveBite` with `lap: true`, `lapLeave` is handled
first (`exitLap()`), but its own text, sound and `K.place` are skipped: the blowUp or loveBite says it.

**The watering can:** `ITEMS.can.to = ['beds', 'cat']`. In `hitTarget` for `'can'`, only when `G.view === 'garden'`,
`G.her === 'garden'` and `!K.gone`: `catHit()` (the exact regions, the cat in front wins) → `'cat'` when the front one
is Koxa; a visitor in front is never a target (the check falls through to the beds). Only the beds light up while
dragging (Koxa is not offered as a target). `dropItem`: target `'cat'` → `doAct('splash')`, else `doAct('waterBeds')`.

**Choreography and texts** (`notify` unless "tip"; `{n}` = `nm()`):

| Event | What she does | Text |
|---|---|---|
| `pat` like | purr 1200 ms, intensity 0.6 | — |
| `pat` bliss | purr 1500 ms, intensity `min(1, 0.5 + 0.08 × n)` (it grows); `rear` → `rearUp` (not on the lap) | — |
| `pat` tolerate | `o.eyes 'squint'`, ears back for 900 ms | — |
| `pat` warn | `o.warn` for 1800 ms, `I.sound.meow('grumpy')` | tip('warn', "Pozor! Švihá ocasem a dává uši do stran. Radši přestaň.", 5000) |
| `flop` | `sideLie` 8 s (`o.mood 'happy'`); on the lap `lapBelly` 8 s | tip('flop', "{n} se blahem svalila na bok.", 60000) |
| `blowUp` (not eat) | `arch` + `openMouth` 900 ms, `say('hiss')`, `popFx('bang')`, then runs (`fast`) to `K.sulkPlace`, `sulk` there | "{n} vyletěla, naježila se a utekla. Takové bubnování nemá ráda." (fast) / "… Dnes na poplácávání nemá náladu." (grumpy) / "… Na ocas jí nesahej." (tail) |
| `blowUp` eat | ears back, walks away from the bowl to `K.sulkPlace` (no arch, no hiss) | "{n} odešla od misky. Při jídle ji nech." |
| `loveBite` | `openMouth`, ears back 700 ms, vibrate `bite` | "Kous! {n} tě jemně kousla. Tolik poplácávání už je moc." (on the lap: "Kous! {n} tě jemně kousla a seskočila z klína. Tolik poplácávání už je moc.") |
| `trap` | `belly` with `o.grab` 2200 ms (on the lap `lapBelly` + grab), vibrate `bite` | "Past! Chytila tě za ruku a kope zadníma. Drápky ale nechala schované." |
| `boop` | her current pose: `o.eyes 'cross'` 600 ms → `o.achoo` + `fx('puff')` at `A.headPoint(...).nose` + `I.sound.fx('sneeze')` + bubble "Hapčí!" 500 ms → `o.shakeHead` 600 ms | — |
| `boop` swat / `swat` why boop | `swipe` toward the player 900 ms, vibrate `bite` | "Plác! {n} tě varovně plácla tlapkou. Bez drápků." |
| `swat` (pat, stroke, scratch) | `swipe` 900 ms | tip('swat', "Plác! {n} se pořád zlobí – nech ji chvíli být.", 4000) |
| `splash` | `fx('splash')` at `A.headPoint` + `I.sound.fx('splash')`, `arch` (no hiss) 500 ms, `shake` with `o.wet` 1200 ms + `I.sound.fx('shake')`, then to `K.sulkPlace` | "Šplouch! {n} vyskočila, otřepala se a je celá mokrá. Teď se zlobí." |
| `sulk` | (the cause already moved her) a timer `setTimeout(tick, until − now() + 50)` | — |
| `cross` | as sulk, ears back | "{n} se opravdu zlobí. Tohle škádlení už bylo moc – nech ji chvíli být." (after the cause's text) |
| `sulkEnd` | `K.sulkPlace = null` | — |
| `crossEnd` | `K.sulkPlace = null` | tip('crossEnd', "{n} už se nezlobí.", 10000) |
| `reconcile` | trots to the front (fx 200, fy 575) and does `rub` 2200 ms, `say('trill')`, two hearts | "{n} se otočila a otřela se ti o ruku. Usmířeno!" |
| `payback` shelf | she goes to the kitchen counter (`counter` spot, jumps up), the mug stands next to her; she looks at the player 1.5 s, pushes it with a paw (`trickPaw`), it falls to the floor (the UI turns `item('mug')` as it falls), `I.sound.fx('clink')`; she jumps down and walks off | "{n} shodila z linky plecháček. Cink! A celou dobu se na tebe dívala." |
| `payback` ambush | `stalk` 2.5 s low at the side of the room, tail twitching, then `pounce` to the bottom edge (the player's ankle), vibrate `bite`, then `run` off | "Útok ze zálohy! {n} ti skočila po kotníku. Drápky nechala schované." |

The mug on the kitchen floor stays until the player leaves the kitchen (not saved).

**Holding the payback.** The UI queues `payback` (and a `found` with id `payback` from the same batch, shown after the
scene) and plays it only when: nothing is open (`nothingOpen()`), no minigame, training or arranging, not carrying, not
on the lap or seated, no drag, no finger down (`!gest.active()`), the page visible, at least 5 s since the welcome (the
page opened or came back: `K.welcomeAt`), no `K.act`, Koxa still free (`health()`: not asleep, out, tree, lap, held,
sulk, cross), **and the player looks at her room** (`G.view === G.her`). Then: ambush → the scene in that room; shelf →
the scene when that room is the kitchen, otherwise she walks off to the kitchen (`K.place` at the counter) and 3 s
later the text "Z kuchyně se ozvalo cink… {n} shodila z linky plecháček." with a quiet clink. **Decided:** when the
conditions are not met within 3 minutes of visible time, it is shown as text only: shelf → that same text (she is put in
the kitchen); ambush → "{n} na tebe chvíli číhala za rohem a pak to vzdala." A reload drops a held payback (the engine
already counted the day).

**`hintText()`** (after `h.scared`/`h.asleep`, before the long offence and the wants):
- cross: "{n} se zlobí – nech ji chvíli být."
- sulk: "{n} se urazila – pohlaď ji po srsti nebo jí dej pamlsek."
- the wet line becomes `h.splashed ? '{n} je mokrá od konve a mrzutá.' : '{n} zmokla a je mrzutá.'`

**Help (`renderHelp`)** — four rows in **Mazlení** after "Ťuknutí", one in **Zahrada** after "Záhony" (`${n}` =
`esc(nm())`, `${an}` = `esc(acc(nm()))`):

| Row | Picture | Text |
|---|---|---|
| Poplácání | `rearUp` (fallback `loaf`), happy, a tap ring | "Ťukej na ni lehce prstem pořád dokola. Na zádech má ráda klidné, pravidelné poplácávání a na jednom místě úplně nejradši – zkus ho najít, i správné tempo. Hlavu, bradu a tlapky snese. Ocas nech být a bříško je past: chytí tě za ruku a kope." |
| Než se naštve | `sit` grumpy with `warn` | "Když švihá špičkou ocasu, dává uši do stran a cuká jí kůže na zádech, má toho dost. Přestaň – když ťukáš dál, naježí se, uteče a urazí se. Rychlé bubnování nemá ráda nikdy, a když je mrzutá, ani pomalé. Při jídle ji nech. Spící ${n} jen cukne uchem." |
| Ťuknutí do nosu | `sit` calm with `eyes: 'cross'` | "Ťukni jí jednou do nosu: zašilhá, kýchne a zatřepe hlavou. Třikrát za minutu je ale moc – plácne tě tlapkou (drápky nechá schované) a urazí se." |
| Usmíření | `rub` happy (fallback `sit`) | "Uražená sedí zády k tobě na druhém konci pokoje. Pohlaď ji po srsti, podrbej ji nebo jí dej pamlsek a usmíříte se – otře se ti o ruku. Za pár minut ji to přejde i samo. Když to se škádlením přeženeš, opravdu se zlobí: 20 minut tě neposlouchá, nehraje si a na pohlazení plácne tlapkou. Pak ji nech být. A někdy ti to vrátí…" |
| Konev (Zahrada) | the can + `shake` wet (two) | "Konví zaléváš záhony. Když zaliješ i ${an}, vyskočí, otřepe se a je mokrá a uražená. Návštěvy konví nepokropíš. V zimě a když spí, to nejde." |

**Test hook** (`window.Kocka`): `events` (the last 100 events passed to `handle()`, oldest first, the objects as the
engine gave them), `get tease()` (a copy of `G.st.tease` plus `health()`'s `sulk`, `cross`, `splashed`, `teaseUntil`),
`forcePayback(kind)` (puts `{ type: 'payback', kind }` through `handle()` and skips only the 5 s welcome wait; the other
holding rules apply; returns true when queued). `tools/shots.js` gets a step with a tap on her nose and one with the can
on her in the garden.
