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
- **tap**: < 250 ms, < 10 px movement.
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
- **sound** (default on): WebAudio synthesized meow (pitch by mood), purr (low rumble while stroked), soft "nom".
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
- **Garden (Etapa 3):** 4 beds (6 with bond 600), crops from `IMAGE_SETS.produce` drawings (ředkvička 2 days, mrkev 4,
  jahody 5, rajče 6, šanta kočičí 3 → catnip toy: fun +60, wild zoomies), watering once a day by dragging the can
  (an unwatered day pauses growth, never kills), nothing grows outdoors Dec–Feb ("záhony spí pod sněhem");
  birds from `IMAGE_SETS.birds` visit the feeder and she stalks them; dárky (pírko, lísteček, šiška).
- **Toulky (Etapa 4):** "Pustit ven" starts a walk of 2–8 h (seeded); with the cat flap (bond 300) she also goes out by
  herself while the player is away; returns with a postcard (`IMAGE_SETS.nachod` item, no repeat until all 42 are
  collected; Czech text "Byla jsem u …"), a dárek or nothing. Credits screen `#screenCredits` lists photo authors and
  licenses (copy from games/mahjong or games/pexeso).
- **Visitors:** neighbour cats Mourek, Líza, Bivoj, Čiperka, Pacička, Rambo, Šedivka, Fousek (recoloured rig, each a
  trait); they come to the garden when a bowl or cushion is placed there; friendship 0–5 hearts.
- **Album:** photos taken with the in-game camera (stores pose + scene + date, redrawn, not pixels), postcards,
  visitors, deník.
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
