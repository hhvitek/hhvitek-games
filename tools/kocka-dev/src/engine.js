// Koxa's life (SPEC §2–6, §9–10). Pure: no DOM, no clock, no global randomness: time comes in as `now` (ms) and every
// random draw comes from st.seed (+ the counter st.n, or a day number), so the same state and the same calls always
// give the same result. Runs in the browser and in Node (tools/kocka-test.js).
//
// Mutation: create() and repair() of a non-object return a new state; advance(), act(), consumeTreats(), rename()
// and valid()/repair() of an object change the given st in place and return it ({ st, events } for the first four).
// The constants (FOODS, TOYS, …) are frozen and never changed.
//
// Events, { type, … } (the UI decides what to show; "watching" = an advance over at most one hour):
//   The bowls (user's wish 2026-11-17): 'feed' fills the food bowl (st.bowl) and 'water' the water dish (st.dish); the
//   needs rise only while she eats or drinks (st.meal, st.drink), in advance(), also while the player is away:
//   poured { food, comes, woke }    the bowl was filled; comes: 'run' | 'trot' (she heard it and comes: the meal starts
//                                   5 / 8 s later) | null (she did not hear it: out, in the garden, asleep, full);
//                                   woke: the rustle woke her (a wake event comes before it)
//   mealStart { food }              she starts eating (watching only)
//   ate { food, gain, left, fav }   a meal ended (watching only): gain = sytost she got; left: food stays in the bowl
//                                   (she was full, or she left the bowl: picked up, the lap, a pat while eating…)
//   dishFilled { tap }              the water dish was filled; tap: she jumped up to drink from the tap instead (quirk;
//                                   a drank { tap: true } follows, water +30 at once)
//   drinkStart / drank { tap }      a drinking session at the dish starts / ends (watching only; tap false)
//   For the UI: health() has sleepPlace, eating, coming (walking to the bowl), drinking, bowl (amount), bowlKind, dish;
//   bowls(st) = { bowl, dish, eating, coming, mealKind, mealSince, drinking, mealTime, mealTimes }; mealTimes(st) = the
//   learned meal times (local hours, e.g. 7.67), mealTime(st, t) = the one whose window holds t, else null
//   Round 2 (user's wishes 2026-11-17), health() also has: gardenAlone (in the garden without the player: st.out with
//   walk false), nap (a daytime nap, not the night), wakeAt (when she wakes, asleep or dozing on the lap), stroll (awake on a night stroll),
//   callAt (she comes then after a callSlow, else 0), visitNoticed (she knows about the visitor: only then the window)
//   purr { region?, sleeping? }     a happy stroke, a favourite spot, a welcome belly rub, being held
//   bite                            a playful nip (belly, grumpy)
//   earsBack { rough? }             stroked against the fur or too fast
//   content { region } / tolerate { region }  a good stroke without a purr: she enjoys it (calm; grumpy or sad
//                                   30 %) / she puts up with it (grumpy or sad, or sideways); every stroke gets a reaction
//   wriggle                         she does not want to be held
//   held / put { place }            picked up / put down
//   played { toy, gain, fav }       a toy worked
//   ignore { reason }               she ignored a toy or a call (sad, tired, asleep; a call also now and then when grumpy
//                                   or sad), reason: playCross | tired | hiding | noPlay | inGarden | outside | asleepCall |
//                                   scaredDown | crossCall | sadCall ("jen smutně koukne") | deaf ("dělá, že neslyší")
//   brushed { gain } / flea         brushing; flea: she has fleas (coat +10 only)
//   clean                           the litter box was cleaned
//   litter { garden? }              she used the litter box (watching only; awake and free only, else 15–30 min later);
//                                   garden: true: she dug by a bed in the garden, the box stays clean
//   treat                           she ate a treat (pamlsky −1)
//   pill                            the extra pill after a lost pill minigame was given
//   out { until, walk, flap?, garden? } / back { minutes, walk, flap, postcard, present, begs, rain? }   let out / came home
//                                   (letIn or by herself). garden: true = the player left her in the garden alone (st.out
//                                   with walk: false; health().gardenAlone: draw her in the garden); she never stays there in
//                                   the rain (back { rain: true }, or she comes in with the player). begs: true after every
//                                   walk the player sees end (watching): she acts starving whatever her hunger (user's wish
//                                   2026-11-17); back during a long absence (the app closed): false. cold: true = a real
//                                   frost sent her in from the garden alone (§12f)
//   Real weather (SPEC §12f, opt-in): st.wx = wxParse(Open-Meteo JSON, city, fetchedAt) or set by setWx(st, wx | null);
//   weather(ms, st) and scareAt follow it hour by hour where it covers ms; sky(ms, st) = { w, temp, real } for the picture
//   come { late? } / turnBack       a call: she comes (late: true = at st.callAt after a callSlow) / turns her back (offended, once)
//   callSlow { at, meal }           a call she heard (an ear or the tail turns) but follows later, at `at` (st.callAt): 10–40 s
//                                   (CALL, by mood and bond), or meal: true = after her meal; then come { late: true }
//                                   (watching; asleep, out, on the lap, held, up the tree or hiding it is forgotten)
//   scared { what } / curious { what }  met a vacuum, a storm, fireworks (scared only when it is her fear; nothing at all
//                                   for the vacuum while she is out)
//   sleep { place, nap } / wake { early, stroll?, rude? }   she fell asleep ('box' only when it is placed indoors | 'sill' | 'sun' on
//                                   a clear day | 'bed'; also st.sleepPlace, health().sleepPlace; nap: a daytime nap, else the
//                                   night) / woke up (watching or caused by an act; stroll: true = a night stroll of 20–40 min,
//                                   health().stroll, then she goes back to sleep). A cat's sleep (user's wish 2026-11-17, SLEEP):
//                                   naps through the day planned when she wakes (st.napAt), each 45–120 min (st.wakeAt), few at
//                                   dawn and dusk, the night 22–6 with a rare stroll; 12–16 h a day
//   meow { want }                   she started to want something (watching only; awake, not out, not on the lap: else
//                                   st.want waits, so she meows when she wakes or comes home). 'food' also at a learned
//                                   meal time with an empty bowl (mealTime())
//   ill { kind } / cured { kind, by: 'vet' | 'time', paid?, short? }
//   weighed { kg, delta }           once a local day
//   levelUp { level }               a new bond level (0–4; its name is the UI's)
//   birthday { age }                adoption anniversary (bond +10)
//   offended { days }               back from paní Nováková after more than 72 h away
//   lapOn / lapOff { dozing }       she settled on the lap / the player stood up (she gets down calmly)
//   lapLeave { reason, minutes }    she jumped down and ran off: 'hungry' | 'thirsty' | 'bored' | 'offended' |
//                                   'annoyed' | 'scared' | 'restless' (nothing in particular) | 'away' (the app was closed)
//   lapDoze                         she dozed off on the lap (stays until stroked awake or the player stands up)
//                                   (sleepy when her nap st.napAt is due within 30 min or overdue, or energy < 60; a doze of
//                                   45–90 min, health().wakeAt; 15 min or more counts as her nap, 2026-11-17)
//   garden { weather, joined? } / house   she goes out into the garden with the player (joined: she was there alone already)
//                                   / back into the house
//   wet / snowPaws                  rain soaked her (grumpy for 2 h, coat −) / she shakes snow off her paws
//   present { item }                a dárek: 'feather' (pírko) | 'leaf' (lísteček) | 'cone' (šiška); garden or a walk
//   climbStuck / climbDown { by }   stuck on the tree / down again: 'call' | 'fetch' | 'self' (after 30 min at most)
//   sown { bed, crop } / watered { n } / ripe { bed, crop } / harvested { bed, crop, n }   the beds
//   catnip                          šanta kočičí: fun +60, wild zoomies
//   (back gets { walk, postcard, present } after a walk: postcard = index 0–41 into IMAGE_SETS.nachod)
//   bought { id, kind } / placed { id, room } / sold { crop, n, earned }   the shop (Obchůdek) and furniture
//   earned { n, game?, trick? } / capReached / record { game, best, prev }  minigame and trick rewards
//   perform { trick, ok, shown?, understood?, reason? } / learned { trick } / trickLearned { trick } / trickRefused { trick, reason: bond (+ bond) | noTreat | notLearned }
//                                   Výcvik: a wrong cue = understood false; a refused right cue = understood true with
//                                   reason 'tired' | 'grumpy' | 'notNow'; trickLearned = training an already learned trick
//   visitor { id, reaction, noticed } / visitorLeave { id, reason: 'time'|'shy'|'night'|'rain' } / visitorFed / visitorPurr /
//   visitorHiss / visitorFriend { id, hearts }   neighbour cats; reaction = Koxa's: 'hiss' | 'play' | 'friends' | 'watch' | 'away'
//   (noticed: Koxa knows about it at once: in the garden, or awake at home and she saw it through the window; reaction is
//   how she takes it, 'away' only on a walk; her mood changes only while she knows: health().visitNoticed, st.visit.noticed)
//   visitorNoticed { id }           awake at home she heard the visitor later (about 10 min after it came; watching only)
//   visitAct { id, kind, with }     the visitor started another act (st.visit.act; watching only, or Koxa left the garden):
//                                   kind of VISIT_ACTS, with = 'koxa' (together with her) | null (alone); 'arrive' follows 'visitor'
//   palUp { id, pal }               Koxa's own friendship with a neighbour cat reached another whole heart (pal 1–5)
//   Phase B (the player and the visitor, SPEC §8b):
//   visitorPurr { id, region?, liked? }   a stroke it enjoys (region and liked only for a finger stroke with a region)
//   visitorDislike { id, region, why: 'region'|'fast'|'against', away }   a stroke it does not like (no friendship);
//                                   away: shy Líza (2+ hearts) moves away a bit; under 2 hearts she runs off instead
//                                   (visitorLeave 'shy'), Rambo under 3 hearts swipes (visitorHiss { id, region })
//   visitorTreat { id }             a pamlsek from the hand (treatVisitor)
//   visitorPlay { id, caught, koxa } the feather for two (playVisitor); caught 'koxa' | 'visitor'; koxa: she played too
//   jealous { id } / jealousOk { id } / jealousEnd { id }   Koxa saw you with a visitor (st.jealous); stroked or
//                                   scratched within 2 min: all right again (love +4); else at the end love −4;
//                                   asleep, out, up the tree or back in the house it just passes (no event, no dip)
//   guestIn { id } / guestSleep { id } / guestOut { id, slept }   a sleepover (invite): the guest in the living room until
//                                   7:00 (invited from the garden, Koxa comes in too: 'house'); guestSleep: Koxa and the
//                                   guest sleep together in the house (pal 4+), once a night
//   (visitorLeave gets reason 'inside' when the visitor was invited in)
//   Phase C (kittens visiting, SPEC §8b; a visitor id may be a kitten 'k1'…'k12': E.visitor(st, id) for its name):
//   visitor / visitorLeave get kits: [ids] when the mother comes or goes with her small kittens (st.visit.kits)
//   kittens { mother, n, ids, alone? }  kittens seen for the first time: a litter with its mother (n 2–4), or alone: true,
//                                   n 1, ids [the visitor]: a young cat that nobody saw while small (a litter during a
//                                   long absence) comes on its own the first time; not 'litter', which is the litter box
//   visitAct { …, kit }             kit: the kitten Koxa is with (kitPlay, kitGroom)
//   kitNamed { id, name }           nameKitten
//   kitGrown { id }                 a kitten's first visit on its own (from 21 days)
//   photo { n } / photoDeleted { n }   the album
//   gift { n }                      pamlsky from the launcher link
//   found { id, info }              a new Deníček entry; info = its facts (entryInfo), the UI writes the sentence
//   quirk { id }                    her quirk was seen (wakesEarly: the player's first act of the day within 2 h after
//                                   she really woke early; box: only while she sleeps in her box)
//   refused { reason, …params }     the action is not possible now: reason is a code (cantNow, onTree, asleep, foodFunds
//                                   { food, price }, price { item, price }, notHere { vis }, …: see refusal() calls), the
//                                   params name ids and numbers; the UI writes the message
// Phase B actions (act): strokeVisitor { id, region?, along?, speed? } (without region: the menu's Pohladit),
//   treatVisitor { id }, playVisitor { id, caught: 'koxa' | 'visitor' }, invite { id }; photo also takes
//   { vpose, vx, vflip, nokoxa } (where the visitor stood; nokoxa: Koxa is not in the picture)
// Phase C action: nameKitten { id, name }
//   Škádlení (teasing out of love, SPEC §13; st.tease):
//   pat { region, stage: 'like'|'bliss'|'tolerate'|'warn', close?, rear?, sleeping?, eating? }   a pat that did nothing
//                                   bigger (region after the alias; close and rear with bliss; sleeping: true asleep or
//                                   dozing on the lap and the run is short, nothing changes; eating: true while she eats)
//   woken { lap }                   tapped awake (the TEASE.wakeN-th tap of a run while asleep or dozing on the lap): she
//                                   hisses, love −2; no heat, sulk or payback. Comes after wake { early: false, rude: true }
//                                   (asleep) or lapLeave 'annoyed' (on the lap: she jumps down)
//   flop { lap }                    after the bliss pat at tap 8: she flops on her side
//   blowUp { why: 'fast'|'grumpy'|'tail'|'eat', lap }   the warned run went on 1.8 s ('eat' is the mild one: she leaves the bowl)
//   loveBite { lap }                over-patting went on 1.8 s after its warning (no sulk)
//   trap                            a pat on the belly: she grabs the hand (no claws)
//   boop { swat? }                  a nose tap (swat: true on the 3rd within 60 s)
//   swat { why: 'pat'|'boop'|'stroke'|'scratch' }   touched while cross (no claws)
//   splash                          the watering can on her
//   sulk { until } / cross { until } a sulk starts or is prolonged / a cross starts or is renewed
//   sulkEnd / crossEnd              the time ran out
//   reconcile { by: 'stroke'|'scratch'|'treat', bond }   made up after a sulk (bond: whether bond +1 was given today)
//   payback { kind: 'shelf'|'ambush' }   her revenge, at most once a day (watching only, when she is free)
//   Order inside one action: lapLeave → the cause (blowUp/loveBite/boop/splash) → sulk/cross → found; a pat while she
//   eats (st.meal, or the UI's eating flag) and blowUp 'eat': she leaves the bowl (ate first) and comes back after 2 min
// Teasing actions: pat { region, n, ms, cv, eating }, boop, splash
//   Play and memories (user's wishes 2026-11-19, SPEC §14):
//   hide { spot, room }             she hid by herself (seen only: SEEN, the advance's last step; awake, free at home, daytime): st.hide, hideSpots(st)
//                                   lists where she may be ('curtain' | 'blanket' in 'living', 'wardrobe' in 'hall', 'box'
//                                   in the box's room when it stands in the house)
//   seekFound { spot, secs, quick } the player found her (seek at her spot): love and fun up, more when quick (≤ 30 s)
//   seekMiss { spot }               not there (nothing changes, she stays hidden)
//   unhide { spot, boo: true }      150 s passed: she jumps out at the player (fun +3)
//   unhide { spot, by }             the hide ended otherwise: by = the action that ended it (any act but seek, buy, sell,
//                                   deletePhoto, nameKitten; pushed first, then the action runs), 'minigame', or 'self'
//                                   (a meal, a fright, … took her out). Not watching: it ends silently
//   catch { kind }                  back from a walk (after back, seen only: SEEN, the advance's last step) with a catch: 'mouse' (a toy mouse) or
//                                   'cricket' (a confused live one); st.catch waits 120 s for praise
//   praised { kind, bond }          praise (the player tapped or stroked her): love +2, bond +1 once a day (bond: given)
//   catchSnub { kind }              nobody praised it in 120 s (seen only: an advance of at most SEEN): followed by sulk { until } (no payback)
//   leafJump { self }               she jumped into the autumn leaf pile in the garden (self: by herself, else leafJump
//                                   act); fun +3; the pile is gone until the next day (leafPile(st, t))
//   dream(st, t) (no event): what she dreams of while asleep or dozing on the lap, from what she lived today and yesterday
// Play actions: seek { spot } (or the spot as a string), praise, leafJump; minigameResult(st, 'hide', { found, secs })
function KockaEngine() {
  const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR, STEP = 10 * MIN;
  // the player sees it happen (hide and seek, a catch; SPEC §14): an advance of at most SEEN (the page ticks every 30 s;
  // a longer one means the phone was put away), and a hide or a catch begins only in its last step, so it never starts
  // and runs out unseen inside one batch
  const SEEN = 10 * MIN;
  const AWAY = 72 * HOUR;          // longer absence: paní Nováková took her (§4); the rest is not simulated
  const HELP = 24 * HOUR;          // after a day without anybody paní Nováková looks in (any absence): food, water and litter
  const HELP_MIN = 20;             // kept ≥ 20: never ill from it, but never better off than a day earlier
  const T_MIN = Date.UTC(2000, 0, 1), T_MAX = Date.UTC(2200, 0, 1);
  const deep = o => { for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') deep(o[k]); return Object.freeze(o); };
  // needs falling per hour; [day, night or asleep] (fun: [morning/day, evening, night or asleep]); tuned so that two visits
  // a day with basic care keep her calm or happy (tools/kocka-test.js "Balance"); food 3.5 / 1.75 (70 a day, 2026-11-17):
  // one bowl of granule (35) twice a day keeps her fed now that she eats only what is in the bowl
  const RATE = deep({ food: [3.5, 1.75], water: [3.5, 2], fun: [2.5, 3.5, 0.5], love: [2, 0.5], coat: 0.5, energy: [3, 8] });
  // the lap (SPEC §12d): leaving is a seeded hazard per minute, so the step length does not matter
  const LAP = deep({
    leave: 0.35,          // per minute when content: a session of about 3 min (median 2), with gentle stroking 0.6× (about 5 min)
    petted: 0.6, sleepyHappy: 0.5,                         // stroked within the last minute; energy < 50 and happy
    hungry: 3, bored: 2, offended: 3, scared: 6,           // food or water < 25; fun < 25; offended; a fright
    annoy: 2,             // + 2× per point of annoyance: against the fur / too fast +1, a belly rub +0.5, a bite +2
    calm: 0.5,            // annoyance fades by 0.5 a minute
    settle: 0.5,          // minutes after settling before she may leave (unless annoyed)
    doze: 0.5,            // per minute when sleepy (her nap is due within 30 min or overdue, or energy < 60), calm or happy,
                          // not annoyed, 20 s – 2 min after the last stroke (or evening, night); ×2 when energy < 35, ×2 when
                          // the nap is due within 30 min and ×2 more when it is overdue, ×1.5 in the evening, ×2 at night; while dozing she never leaves, wakes when
                          // stroked or when the doze is over
    napSoon: 30,          // minutes: her next nap (st.napAt) this close makes her sleepy on the lap (2026-11-17)
    away: 15,             // minutes: an advance longer than this ends the lap (nobody sits in the chair any more)
    dozeMin: 45, dozeMax: 90,   // minutes: a doze lasts 45–90 (seeded from its start; 90 when energy < 35), then she may leave
    napped: 15,           // minutes: a doze this long counts as her nap (her next nap is planned from its end)
  });
  const TARGET_W = 4.2, FED_W = 4.5;   // a thin cat recovers to 4.2; plain food alone never makes her heavier than 4.5

  /* --- constants --- */
  // the engine has no texts (CLAUDE.md, Texts and languages): the constants carry no names, and a refusal is a code with
  // its params, { reason, …params } (in an event: { type: 'refused', reason, … }); the UI turns them into messages
  const refusal = (reason, p) => Object.assign({}, p, { reason });
  const NEEDS = deep(['food', 'water', 'energy', 'fun', 'love', 'clean']);
  const FOODS = deep({
    kibble: { gain: 35, price: 0 },
    pouch: { gain: 45, price: 2 },
    chicken: { gain: 50, price: 3 },
    tuna: { gain: 55, price: 4 },
  });
  const CHARGE_FOOD = true;        // special food: a serving from st.stock, else FOODS[k].price pamlsky (granule free)
  const CHARGE_SEEDS = true;       // seeds: from st.stock ('seed_<crop>'), else CROPS[k].seed pamlsky
  // the garden beds (§12e, pulled forward from Etapa 3): growth = watered days (rain counts), none Dec–Feb, never dies
  const CROPS = deep({
    // yield = pieces per harvest; a pack of 3 seeds sells for 1.5× its price, a single seed for 1.2–1.33× (gardening pays a
    // little, about 0.5–0.7 pamlsku a bed a day: far less than the minigames)
    radish: { days: 2, seed: 3, sell: 2, yield: 2 },
    carrot: { days: 4, seed: 5, sell: 3, yield: 2 },
    strawberry: { days: 5, seed: 8, sell: 5, yield: 2 },
    tomato: { days: 6, seed: 9, sell: 4, yield: 3 },
    catnip: { days: 3, seed: 7, sell: 0, yield: 1 },
  });
  const BEDS = 6;                  // 4 usable, 6 from bond level Parťačka (600)
  const PRESENTS = deep({ feather: {}, leaf: {}, cone: {} });
  const POSTCARDS = 42;            // IMAGE_SETS.nachod has 42 photos
  const WEATHERS = deep({ clear: {}, cloudy: {}, rain: {}, snow: {} });
  // the garden with the player, per hour: fun rises, the coat suffers; chances of a dárek and of getting stuck on the tree
  const GARDEN = deep({ fun: 10, coat: 1.5, rainCoat: 4, wetFor: 2 * 60, present: 0.2, tree: 0.15, treeMax: 30, alone: [60, 180] });
  // the food bowl and the water dish (user's wish 2026-11-17: satisfaction comes from eating, not from a full bowl)
  const BOWL = deep({
    full: 10,          // a second pour is refused while more than this is left in the bowl
    eat: 60,           // food units a minute: a portion of 35–55 takes 35–55 s
    stop: 95,          // she stops at this sytost and leaves the rest
    hungry: 60,        // she goes to a filled bowl by herself under this
    routine: 80,       // at a learned meal time: she eats (and asks for food at an empty bowl) under this
    hear: 85,          // awake: she comes to the rustle under this (her favourite food: always)
    hearSleep: 35, wakeP: 0.7,   // asleep: the rustle wakes her under this with this chance
    run: 40,           // she runs (food under this or her favourite food), else she trots
    walk: { run: 5000, trot: 8000 },   // ms from the pour to the first bite
    wait: 2 * 60000,   // after leaving the bowl in a huff (a pat while eating) she comes back after this
    log: 8, near: 0.75, need: 3, days: 2,   // meal times: the last 8 logged pours; 3 within ±45 min on 2+ days make one
    gap: 0.75,                         // hours: a pour less than this after the last logged one is not logged (a second bowl)
    before: 0.5, after: 1,             // hours: she waits for her meal from 30 min before to 60 min after it
  });
  const DISH = deep({ thirsty: 70, sip: 30, rate: 1.5, full: 90, start: 100, old: 60, tap: 30 });   // rate: water a second (a session 10–20 s)
  const SLEEP_PLACES = deep(['box', 'sill', 'sun', 'bed']);
  // a cat's sleep (user's wish 2026-11-17): several short naps by day, few at dawn and dusk, the night mostly asleep with a
  // rare short stroll. Every moment is planned when she wakes up or falls asleep (st.napAt, st.wakeAt, st.stroll), drawn
  // from the seed and that moment (never st.n), and advance() splits its steps at them, so the step length never matters.
  const SLEEP = deep({
    // the chance per hour to doze off, by local hour 0–23: the night 22–5 (she goes to bed), dawn 5–8 and dusk 17–20 lively
    rate: [3, 3, 3, 3, 3, 0.05, 0.05, 0.05, 1, 1, 1, 2, 2, 2, 2, 2, 1, 0.1, 0.1, 0.1, 0.8, 0.8, 3, 3],
    tired: [[35, 3], [55, 1.8]], rested: [90, 0.8],   // by day ×3 under energy 35, ×1.8 under 55, ×0.8 over 90
    gap: 45,                  // minutes awake at least after any wake
    born: 120,                // a new cat stays awake this long
    nap: [45, 120], napTired: 30, napUp: 75,   // a nap 45–120 min, +30 under energy 40; under 25 until about 75
    play: 15, wantLow: 50, postpone: [20, 40],   // played with in the last 15 min and fun or love under 50: the nap waits 20–40 min
    morning: [6, 40], early: [5, 20],            // the morning wake 6:00 + 0–40 min; her wakesEarly quirk 5:00 + 0–20 min
    stroll: 0.07, strollHungry: 2, strollFrom: 23, strollTo: 4, strollLen: [20, 40], strollAfter: 60,   // per hour 23–4, an hour after bedtime
  });
  const nightHour = h => h >= 22 || h < 5;
  // a call (user's wish 2026-11-17): happy with bond level Kamarádka she comes at once 80 %, else 30–60 % by mood and bond;
  // otherwise she only turns an ear and comes 10–40 s later (callSlow), or, grumpy or sad, now and then ignores it
  const CALL = deep({ happy: 0.8, lvl: 2, base: 0.3, perLvl: 0.075, mood: { happy: 0.15, calm: 0.1 }, max: 0.6, ignore: 0.3, slow: [10, 40], after: 3000 });
  // a visitor seen through the window when it arrives (awake at home), by day phase; else she hears it about 10 min later
  const NOTICE = deep({ morning: 0.6, day: 0.6, evening: 0.4, night: 0.2, hear: 10 });
  const WALK_BOND = 2;             // toulky (letOut) from bond level Kamarádka (300)
  // toys: the four she has from the start (one is her favourite), and shop toys (bought: 'owned'); base = its kind
  const TOYS = deep({
    mouse: {}, feather: {},
    ball: {}, laser: {},
    catnipMouse: { base: 'mouse', shop: true, bonus: 15 },
    bellBall: { base: 'ball', shop: true, bonus: 10 },
    featherWand: { base: 'feather', shop: true, bonus: 10 },
    tunnel: { base: 'tunnel', shop: true, bonus: 10 },
    box: { base: 'box', shop: true, bonus: 5 },
  });
  const BASE_TOYS = deep(['mouse', 'feather', 'ball', 'laser']);
  const ROOMS = deep(['living', 'kitchen', 'hall', 'garden']);
  // the shop (Obchůdek); bond = the bond level (0–4) from which it is offered; room: where furniture goes (fixed: only there;
  // install: put there at once when bought, the player never places it)
  const SHOP = deep([
    { id: 'pouch5', kind: 'food', price: 8, bond: 0, room: null, stock: 'pouch', n: 5 },
    { id: 'chicken5', kind: 'food', price: 12, bond: 0, room: null, stock: 'chicken', n: 5 },
    { id: 'tuna5', kind: 'food', price: 16, bond: 1, room: null, stock: 'tuna', n: 5 },
    { id: 'sticks5', kind: 'treat', price: 6, bond: 0, room: null, stock: 'stick', n: 5 },
    { id: 'catnipMouse', kind: 'toy', price: 10, bond: 0, room: null },
    { id: 'bellBall', kind: 'toy', price: 12, bond: 0, room: null },
    { id: 'box', kind: 'toy', price: 10, bond: 0, room: 'living' },
    { id: 'featherWand', kind: 'toy', price: 15, bond: 1, room: null },
    { id: 'tunnel', kind: 'toy', price: 20, bond: 1, room: 'living' },
    { id: 'scratcher', kind: 'furniture', price: 30, bond: 0, room: 'living' },
    { id: 'rug', kind: 'furniture', price: 35, bond: 0, room: 'living' },
    { id: 'lamp', kind: 'furniture', price: 30, bond: 0, room: 'living' },
    { id: 'birdFeeder', kind: 'furniture', price: 25, bond: 0, room: 'garden', fixed: true },
    { id: 'sillCushion', kind: 'furniture', price: 40, bond: 1, room: 'living' },
    { id: 'bedDeluxe', kind: 'furniture', price: 60, bond: 1, room: 'living' },
    { id: 'catTree', kind: 'furniture', price: 120, bond: 2, room: 'living' },
    { id: 'catFlap', kind: 'furniture', price: 80, bond: 2, room: 'hall', fixed: true, install: true },
    { id: 'visitorBowl', kind: 'furniture', price: 15, bond: 0, room: 'garden', fixed: true },
    { id: 'seedsRadish', kind: 'seed', price: 8, bond: 0, room: null, stock: 'seed_radish', n: 3 },
    { id: 'seedsCarrot', kind: 'seed', price: 12, bond: 0, room: null, stock: 'seed_carrot', n: 3 },
    { id: 'seedsStrawberry', kind: 'seed', price: 20, bond: 0, room: null, stock: 'seed_strawberry', n: 3 },
    { id: 'seedsTomato', kind: 'seed', price: 24, bond: 1, room: null, stock: 'seed_tomato', n: 3 },
    { id: 'seedsCatnip', kind: 'seed', price: 18, bond: 1, room: null, stock: 'seed_catnip', n: 3 },
  ]);
  const SHOP_BY = {}; for (const it of SHOP) SHOP_BY[it.id] = it;
  const STOCK_KEYS = ['pouch', 'chicken', 'tuna', 'stick'].concat(Object.keys(CROPS).map(c => 'seed_' + c));
  // minigames (the UI plays them; the engine rewards): pamlsky = min(max, floor(score / per)); 30 a day from all of them
  const GAMES = deep({
    mouse: { per: 3, max: 10 }, laserRun: { per: 1, max: 8 },
    feather: { per: 2, max: 10 }, fishing: { per: 1, max: 8 }, pill: { per: 1, max: 3 },
    hide: { per: 2, max: 8 },   // Schovávaná: score = hideScore(found, secs)
  });
  const GAME_TOYS = deep({ mouse: 'mouse', feather: 'feather', laserRun: 'laser' });   // the toy a minigame plays with
  const EARN_CAP = 30;
  // Výcvik: bond needed (the value), the cue gesture the Input sends; 5 rewarded performances = learned
  const TRICKS = deep({
    sedni: { bond: 100, cue: 'swipeUp' }, dejPac: { bond: 300, cue: 'tapPaw' },
    otocSe: { bond: 500, cue: 'circle' }, panacek: { bond: 750, cue: 'swipeUp2' },
  });
  const TRICK_N = 5, TREAT_WINDOW = 1500;
  // body regions (Input/Art use the same ids); spot: may be one of her favourite spots
  const REGIONS = deep({
    chin: { spot: true, scratch: true },
    ears: { spot: true, scratch: true },
    head: { spot: true, scratch: true },
    back: { spot: true },
    tailBase: { spot: true },
    belly: {},
    tail: {}, paws: {},
  });
  const REGION_ALIAS = deep({ paw: 'paws', side: 'back', nose: 'head' });   // older or other spellings of the same region (the nose is the head)
  const regionOf = (r, def) => typeof r !== 'string' ? def : Object.prototype.hasOwnProperty.call(REGIONS, r) ? r : Object.prototype.hasOwnProperty.call(REGION_ALIAS, r) ? REGION_ALIAS[r] : def;
  const SPOTS = deep(Object.keys(REGIONS).filter(k => REGIONS[k].spot));
  const FEARS = deep({ vacuum: {}, storm: {}, fireworks: {} });
  const QUIRKS = deep({
    wakesEarly: {}, box: {}, socks: {}, tap: {},
  });
  const ILLS = deep({ fleas: {}, tummy: {}, cold: {} });
  const LEVELS = deep([{ min: 0 }, { min: 100 }, { min: 300 }, { min: 600 }, { min: 900 }]);
  const HOLIDAYS = deep({
    advent: { prop: 'wreath' }, mikulas: { prop: 'stocking' },
    vanoce: { prop: 'tree' }, silvestr: { prop: 'fireworks' },
    masopust: { prop: 'mask' }, velikonoce: { prop: 'eggs' },
    carodejnice: { prop: 'witchHat' }, dusicky: { prop: 'candle' },
    birthday: { prop: 'cake' },
  });
  const ACTIONS = deep(['feed', 'water', 'stroke', 'scratch', 'pickUp', 'putDown', 'play', 'brush', 'cleanLitter', 'letOut', 'letIn', 'treat', 'vetCure', 'pill', 'call', 'vacuum', 'lapOn', 'lapOff',
    'goGarden', 'goHouse', 'fetchDown', 'sow', 'waterBeds', 'harvest', 'catnip', 'buy', 'place', 'sell', 'train', 'showTrick',
    'feedVisitor', 'strokeVisitor', 'photo', 'deletePhoto', 'treatVisitor', 'playVisitor', 'invite', 'nameKitten', 'pat', 'boop', 'splash',
    'seek', 'praise', 'leafJump']);
  // hide and seek (SPEC §14.1): she hides by herself while the player watches, by day, now and then: a chance p per
  // 10-minute slot of the clock (keyed draws, salts 12–14), at most `max` a day, `gap` minutes apart; `len` ms hidden
  const HIDE = deep({
    len: 150000, quick: 30000, slot: 10, p: 0.3, max: 3, gap: 30, from: 8, to: 21, energy: 30, home: 24,   // home: hours at home first
    found: { love: 3, fun: 6 }, quickFx: { love: 5, fun: 10 }, boo: 3,
  });
  // the spots and their rooms; the box: in the room where it stands (only in the house)
  const HIDE_ROOMS = deep({ curtain: 'living', blanket: 'living', wardrobe: 'hall', box: null });
  // actions that do not end a hide (they do not concern her)
  const HIDE_KEEP = deep(['buy', 'sell', 'deletePhoto', 'nameKitten']);
  // a catch brought from a walk (seen only, SEEN): chance p (salt 17), a toy mouse with `mouse` else a cricket (salt 18);
  // it waits `ms` for praise
  const CATCH = deep({ p: 0.3, mouse: 0.6, ms: 120000, love: 2 });
  // the autumn leaf pile in the garden: she jumps in by herself with chance p per 10-minute slot (salts 19, 20)
  const LEAF = deep({ fun: 3, slot: 10, p: 0.15 });
  // her memories for dreams (st.mem): birds = minutes at the bird feeder (capped), at most `cats` neighbour cats; a dream
  // lasts `slot` minutes of sleep; birds from `bird` minutes on are a dream
  const MEM = deep({ birds: 1500, cats: 4, slot: 15, bird: 10 });
  const DREAMS = deep(['bird', 'cat', 'toy', 'walk', 'food', 'mouse']);
  // Škádlení (SPEC §13.3): patting, the nose tap, the watering can, the sulk / cross, making up and her payback
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
    love: { blowUp: -2, eat: -1, loveBite: -1, splash: -3, reconcile: 3, woken: -2 },
    boopN: 3, boopWin: 60000,             // the 3rd nose tap within 60 s = a swat
    wakeN: 4,                             // asleep: the 4th tap of a run wakes her, hissing (user's wish 2026-11-19)
    wetMin: 30,                           // splash: wet until max(st.wet, t + 30 min)
    pay: { p: 0.5, min: 5, max: 25, lapse: 120, ext: 5 },   // payback: chance for a sulk, delay after the end, lapse, see below
    mood: { sulk: -10, cross: -20 },
  });
  const TEASE_DIARY = ['bliss', 'boop', 'reconcile', 'splash', 'payback'];
  const CMAX = 1e6;  // counters saturate here (inc)
  const COUNTS = ['favFood', 'belly', 'toy', 'quirk'].concat(SPOTS.map(s => 'spot_' + s));
  // pal*: Koxa and a neighbour cat (the cat is st.diaryCat[id])
  const PAL_DIARY = ['palFirst', 'palGroom', 'palSnuggle'];
  // the entries that name a neighbour cat (st.diaryCat), in this order; kittens: the mother, kitGrown: the kitten
  const CAT_DIARY = PAL_DIARY.concat(['sleepover', 'kittens', 'kitGrown']);
  const DIARY_IDS = ['favFood'].concat(SPOTS.map(s => 'spot_' + s), ['belly', 'toy', 'fear', 'quirk', 'weight', 'walk', 'birthday'], TEASE_DIARY, CAT_DIARY);

  /* --- small helpers --- */
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const r2 = v => Math.round(v * 100) / 100;
  const inc = (st, k) => (st.cnt[k] = Math.min(CMAX, st.cnt[k] + 1));
  function hash32(a, b, c) {
    let x = (a ^ Math.imul((b + 0x9E3779B9) | 0, 0x85EBCA6B) ^ Math.imul((c + 0x7F4A7C15) | 0, 0xC2B2AE35)) >>> 0;
    x ^= x >>> 16; x = Math.imul(x, 0x7FEB352D); x ^= x >>> 15; x = Math.imul(x, 0x846CA68B); x ^= x >>> 16;
    return x >>> 0;
  }
  const rnd = st => { st.n = (st.n + 1) >>> 0; return hash32(st.seed, st.n, 1) / 4294967296; };
  const rndDay = (st, dayNo, salt) => hash32(st.seed, dayNo, salt) / 4294967296;
  const rndSeed = (seed, a, salt) => hash32(seed, a, salt) / 4294967296;
  // teasing (SPEC §13.3): her favourite pat tempo 400–650 ms from the seed (not stored; k = 8 is free in drawTraits)
  const patTempo = st => TEASE.fav[0] + Math.floor(hash32(st.seed, 0x7A17, 8) / 4294967296 * (TEASE.fav[1] - TEASE.fav[0] + 1));
  const freshTease = () => ({ kind: null, until: 0, heat: 0, at: 0, warnAt: 0, boops: [], gain: 0, gainAt: 0, pay: null, payDay: 0, bondDay: 0, splash: 0 });
  // a sulk or a cross runs at t (default: st.t)
  const teasing = (st, t) => { const T = st.tease, x = t === undefined ? st.t : t; return !!(T && T.kind && x < T.until); };
  const teaseKind = (st, t) => (teasing(st, t) ? st.tease.kind : null);
  const longOff = (st, t) => !!(st.off && t < st.off.until);
  // heat cools analytically (−1 per 10 min from the value at tease.at), so the step length never matters
  const heatNow = (T, t) => Math.max(0, T.heat - (t - T.at) / (TEASE.cool * MIN));
  const ymd = ms => { const d = new Date(ms); return [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]; };
  const dkey = ms => { const [y, m, d] = ymd(ms); return y * 10000 + (m + 1) * 100 + d; };   // local day, 20261112
  // the next local day's key (t + 24 h is not enough on the day the clocks go back)
  const tomorrow = ms => { const d = new Date(ms); d.setDate(d.getDate() + 1); return dkey(d.getTime()); };
  const dayNo = (y, m, d) => Math.round(Date.UTC(y, m, d) / DAY);                         // calendar day number
  const keyNo = k => dayNo(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100);
  // the local time of day in hours (7.5 = 7:30); hourKey: as stored in st.mealLog (0.01 h, 0 ≤ h < 24)
  const hourOf = ms => { const d = new Date(ms); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };
  const hourKey = h => Math.round(h * 100) / 100 % 24;
  const hourDist = (a, b) => { const d = Math.abs(a - b) % 24; return Math.min(d, 24 - d); };
  const isKey = k => Number.isInteger(k) && k >= 19000101 && k <= 22001231 && k % 100 >= 1 && k % 100 <= 31 && Math.floor(k / 100) % 100 >= 1 && Math.floor(k / 100) % 100 <= 12;

  /* --- calendar --- */
  function dayPhase(ms) {
    const h = new Date(ms).getHours();
    return h >= 22 || h < 6 ? 'night' : h < 10 ? 'morning' : h < 17 ? 'day' : 'evening';
  }
  function season(ms) {
    const m = new Date(ms).getMonth();
    return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
  }
  // a summer-afternoon storm day (seeded): scareAt and weather agree
  const stormDay = (seed, no, m) => m >= 4 && m <= 7 && rndSeed(seed, no, 5) < (m === 4 ? 0.05 : 0.12);
  // the day's weather from the date and the seed: 'clear' | 'cloudy' | 'rain' | 'snow' (the same all day)
  const WEATHER_P = { winter: [['snow', 0.25], ['cloudy', 0.35]], spring: [['rain', 0.25], ['cloudy', 0.3]], summer: [['rain', 0.1], ['cloudy', 0.2]], autumn: [['rain', 0.3], ['cloudy', 0.35]] };
  // with real weather (st.wx, SPEC §12f) covering the hour of ms: that hour's weather (it may change hour by hour; a storm
  // is 'rain', fog 'cloudy'); otherwise the seeded day
  function weather(ms, st) {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) return 'clear';
    const i = wxIdx(st, ms);
    if (i >= 0) return WX_DAY[st.wx.w[i]];
    const seed = st && Number.isInteger(st.seed) ? st.seed : 0, [y, m, d] = ymd(ms), no = dayNo(y, m, d);
    if (stormDay(seed, no, m)) return 'rain';
    let r = rndSeed(seed, no, 7);
    for (const [w, p] of WEATHER_P[season(ms)]) { if (r < p) return w; r -= p; }
    return 'clear';
  }
  // the seeded storm's moment on a storm day (14:00–20:00 local), else 0 (scareAt and sky agree)
  function stormAt(seed, y, m, d) {
    const no = dayNo(y, m, d);
    return stormDay(seed, no, m) ? new Date(y, m, d, 14).getTime() + Math.floor(rndSeed(seed, no, 6) * 6 * HOUR) : 0;
  }

  /* --- real weather (SPEC §12f; opt-in: the UI fetches Open-Meteo for a chosen city and stores st.wx) --- */
  // st.wx = { city, at, h0, w, t }: city id, when fetched (ms), the first hour (ms), one char per hour (c clear, o cloudy,
  // f fog, r rain, s snow, x thunderstorm) and the whole °C of each hour; at most WX.max hours. Hour i covers
  // [h0 + i h, h0 + (i + 1) h). Without it (or outside it) everything is seeded exactly as before.
  const WX = deep({
    max: 144,              // hours kept (Open-Meteo past_days=2 + forecast_days=3 = 120)
    tmin: -80, tmax: 60,   // a temperature outside this is broken data
    gaps: 0.25,            // wxParse: at most this share of null hours (filled from the nearest hour), else invalid
    frost: -2,             // °C and below: she comes in from the garden after frostAlone min alone, no nap in the garden
    frostAlone: 30,
    heat: 28,              // °C and above: thirst ×thirst, no nap in the sun patch or on the window sill
    thirst: 1.3,
    stormMin: 40,          // the thunder comes in the first 0–39 min of the first hour of a run of storm hours
  });
  const WX_SKY = deep({ c: 'clear', o: 'cloudy', f: 'fog', r: 'rain', s: 'snow', x: 'storm' });
  const WX_DAY = deep({ c: 'clear', o: 'cloudy', f: 'cloudy', r: 'rain', s: 'snow', x: 'rain' });
  const okTime = v => typeof v === 'number' && Number.isFinite(v) && v >= T_MIN && v <= T_MAX;
  // a WMO weather code (Open-Meteo weather_code) → one char of st.wx.w
  function wmoChar(code) {
    if (code === 0 || code === 1) return 'c';
    if (code === 45 || code === 48) return 'f';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'r';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 's';
    if (code >= 95 && code <= 99) return 'x';
    return 'o';   // 2, 3 and anything unknown: cloudy
  }
  // a valid st.wx (as stored: no extra checks of the time it covers)
  function wxValid(W) {
    if (!W || typeof W !== 'object' || Array.isArray(W)) return false;
    const n = typeof W.w === 'string' ? W.w.length : 0;
    return typeof W.city === 'string' && W.city.length >= 1 && W.city.length <= 40 && okTime(W.at) &&
      Number.isInteger(W.h0) && okTime(W.h0) && n >= 1 && n <= WX.max && /^[cofrsx]+$/.test(W.w) &&
      Array.isArray(W.t) && W.t.length === n && W.t.every(v => Number.isInteger(v) && v >= WX.tmin && v <= WX.tmax);
  }
  // the parsed JSON of Open-Meteo's hourly=weather_code,temperature_2m&timeformat=unixtime → a valid st.wx, or null.
  // Times must be whole seconds, strictly hourly; codes integers, temperatures finite numbers; a null hour takes the
  // nearest hour's value (the earlier one on a tie) when at most a quarter of the hours are null
  function wxParse(json, city, at) {
    const Hh = json && typeof json === 'object' ? json.hourly : null;
    if (!Hh || typeof Hh !== 'object' || typeof city !== 'string' || !okTime(at)) return null;
    const time = Hh.time, code = Hh.weather_code, temp = Hh.temperature_2m;
    if (!Array.isArray(time) || !Array.isArray(code) || !Array.isArray(temp)) return null;
    const n = time.length;
    if (n < 1 || n > WX.max || code.length !== n || temp.length !== n) return null;
    for (let i = 0; i < n; i++) if (!Number.isInteger(time[i]) || (i && time[i] !== time[i - 1] + 3600)) return null;
    const fill = (a, good) => {
      let gaps = 0;
      for (const v of a) if (v === null) gaps++; else if (!good(v)) return null;
      if (gaps > n * WX.gaps) return null;
      return a.map((v, i) => {
        if (v !== null) return v;
        for (let d = 1; d < n; d++) {
          if (i - d >= 0 && a[i - d] !== null) return a[i - d];
          if (i + d < n && a[i + d] !== null) return a[i + d];
        }
        return null;
      });
    };
    const C = fill(code, Number.isInteger), T = fill(temp, v => typeof v === 'number' && Number.isFinite(v) && v >= WX.tmin && v <= WX.tmax);
    if (!C || !T) return null;
    const W = { city, at, h0: time[0] * 1000, w: C.map(wmoChar).join(''), t: T.map(v => Math.round(v) || 0) };
    return wxValid(W) ? W : null;
  }
  // the index of the hour of st.wx that holds ms, or -1 (no data, outside it, or a broken st.wx: never a crash)
  function wxIdx(st, ms) {
    const W = st && st.wx;
    if (!W || typeof W !== 'object' || typeof W.w !== 'string' || typeof W.h0 !== 'number' || typeof ms !== 'number' || !Number.isFinite(ms)) return -1;
    const i = Math.floor((ms - W.h0) / HOUR);
    return i >= 0 && i < W.w.length && 'cofrsx'.includes(W.w[i]) ? i : -1;
  }
  // the real temperature at ms (whole °C) or null (no data there)
  function tempAt(st, ms) {
    const i = wxIdx(st, ms), v = i >= 0 && Array.isArray(st.wx.t) ? st.wx.t[i] : null;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }
  const frostAt = (st, ms) => { const v = tempAt(st, ms); return v !== null && v <= WX.frost; };
  const heatAt = (st, ms) => { const v = tempAt(st, ms); return v !== null && v >= WX.heat; };
  // the sky for the art and the UI: { w: 'clear'|'cloudy'|'fog'|'rain'|'storm'|'snow', temp: °C | null, real }; without
  // real data the seeded weather, 'storm' from 30 min before the seeded storm's thunder to 60 min after it
  function sky(ms, st) {
    const i = wxIdx(st, ms);
    if (i >= 0) return { w: WX_SKY[st.wx.w[i]], temp: tempAt(st, ms), real: true };
    const w = weather(ms, st);
    if (w === 'rain') {
      const [y, m, d] = ymd(ms), s = stormAt(st && Number.isInteger(st.seed) ? st.seed : 0, y, m, d);
      if (s && ms >= s - 30 * MIN && ms < s + HOUR) return { w: 'storm', temp: null, real: false };
    }
    return { w, temp: null, real: false };
  }
  // the thunder of a real storm inside [t, t + dt) (t is covered): the first hour of each run of storm hours, at a seeded
  // minute of it (from the seed and the hour, so a refreshed series with the same storm keeps the same moment)
  function wxThunder(st, t, dt) {
    const W = st.wx, end = t + dt;
    for (let i = wxIdx(st, t); i >= 0 && i < W.w.length && W.h0 + i * HOUR < end; i++) {
      if (W.w[i] !== 'x' || (i > 0 && W.w[i - 1] === 'x')) continue;
      const hs = W.h0 + i * HOUR, at = hs + Math.floor(rndSeed(st.seed, Math.floor(hs / HOUR), 71) * WX.stormMin) * MIN;
      if (at >= t && at < end) return true;
    }
    return false;
  }
  // set (a valid series: a canonical copy), or clear (null) the real weather; false (nothing changed) for an invalid one
  function setWx(st, W) {
    if (W === null || W === undefined) { delete st.wx; return true; }
    if (!wxValid(W)) return false;
    st.wx = { city: W.city, at: W.at, h0: W.h0, w: W.w, t: W.t.slice() };
    return true;
  }
  // Easter Sunday (Gregorian, anonymous computus): [month 0-based, day]
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const x = h + l - 7 * m + 114;
    return [Math.floor(x / 31) - 1, (x % 31) + 1];
  }
  // adoption anniversary of born on this local date (29 Feb → 28 Feb in other years); age in years or 0
  function birthdayAge(born, ms) {
    const [by, bm, bd] = ymd(born), [y, m, d] = ymd(ms);
    if (y <= by) return 0;
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const bd2 = bm === 1 && bd === 29 && !leap ? 28 : bd;
    return m === bm && d === bd2 ? y - by : 0;
  }
  // holidays active at this moment (§9), ids of HOLIDAYS; st optional (her birthday)
  function holiday(ms, st) {
    const out = [];
    if (!Number.isFinite(ms)) return out;
    const [y, m, d, h] = ymd(ms), n = dayNo(y, m, d);
    const [em, ed] = easter(y), E = dayNo(y, em, ed);
    if (m === 11 && d <= 23) out.push('advent');
    if (m === 11 && d === 5) out.push('mikulas');
    if ((m === 11 && d >= 24) || (m === 0 && d <= 6)) out.push('vanoce');
    if (m === 11 && d === 31 && h >= 17) out.push('silvestr');
    if (n === E - 47) out.push('masopust');
    if (n >= E - 2 && n <= E + 1) out.push('velikonoce');
    if (m === 3 && d === 30) out.push('carodejnice');
    if (m === 10 && d === 2) out.push('dusicky');
    if (st && Number.isFinite(st.born) && birthdayAge(st.born, ms)) out.push('birthday');
    return out;
  }

  /* --- traits (drawn from the seed only, so repair can draw a broken one again) --- */
  function drawTraits(seed) {
    const r = k => hash32(seed, 0x7A17, k) / 4294967296;
    const pick = (arr, k) => arr[Math.floor(r(k) * arr.length)];
    const i = Math.floor(r(2) * SPOTS.length);
    let j = Math.floor(r(3) * (SPOTS.length - 1)); if (j >= i) j++;
    return {
      favFood: pick(['pouch', 'chicken', 'tuna'], 1), spots: [SPOTS[i], SPOTS[j]],
      bellyOk: r2(0.15 + r(4) * 0.25), fear: pick(Object.keys(FEARS), 5),
      quirk: pick(Object.keys(QUIRKS), 6), toy: pick(BASE_TOYS, 7),
    };
  }
  // what she lived through on one local day (dreams): minutes at the bird feeder, neighbour cats she knew about, the last
  // toy, her favourite toy played with, a walk, the last treat ('treat') or favourite food eaten (its FOODS id)
  const freshMem = () => ({ birds: 0, cats: [], toy: null, fav: false, walk: false, food: null });
  const freshDay = ms => ({ key: dkey(ms), ms: 0, food: 0, mood: 0, minE: 100, treats: 0, ttreats: 0, q: false, acted: false, early: 0 });

  /* --- creation --- */
  function create(seed, now, name) {
    seed = (Number(seed) >>> 0);
    const st = {
      v: 1, seed, n: 0, t: now, born: now, name: cleanName(name),
      needs: { food: 80, water: 80, energy: 80, fun: 70, love: 60, litter: 100, coat: 90 },
      weight: 4.2, bond: 0, lvl: 0, pamlsky: 5,
      asleep: false, sleepAt: 0, wokeAt: now, held: false, heldAt: 0, pickAt: 0, place: null,
      out: null, ill: null, acc: { fleas: 0, tummy: 0, cold: 0 }, off: null, scared: 0,
      litterAt: now + 8 * HOUR, walkMax: 0, bday: new Date(now).getFullYear(), pill: 0,
      traits: drawTraits(seed), cnt: {}, diary: { birthday: now }, day: freshDay(now), want: null, wantAt: {}, lap: null,
      yard: null, wet: 0, beds: Array(BEDS).fill(null), pantry: {}, postcards: [], presents: {},
      stock: {}, owned: {}, furniture: {}, records: {}, tricks: {}, earnDay: { key: dkey(now), n: 0 }, train: null,
      visitors: {}, visit: null, album: [], diaryCat: {}, guest: null, invDay: 0, jealous: null, jealousAt: 0,
      kits: [], litter: null, tease: freshTease(),
      bowl: null, dish: DISH.start, meal: null, drink: null, mealLog: [], sleepPlace: null,
      napAt: 0, wakeAt: 0, stroll: 0, callAt: 0, playAt: 0,
      hide: null, hides: { key: 0, n: 0, at: 0 }, mem: { today: freshMem(), prev: freshMem() }, catch: null, catchDay: 0, leaves: 0,
    };
    for (const k of COUNTS) st.cnt[k] = 0;
    ensurePlan(st);
    return st;
  }
  function cleanName(s) { return typeof s === 'string' && s.trim() ? s.trim().slice(0, 20) : 'Koxa'; }
  function rename(st, name) { st.name = cleanName(name); return { st, events: [] }; }

  /* --- validation: a bad field gets its default, Koxa herself stays --- */
  function repair(st, now) {
    if (!st || typeof st !== 'object' || Array.isArray(st)) return null;
    const okT = v => typeof v === 'number' && Number.isFinite(v) && v >= T_MIN && v <= T_MAX;
    const num = (v, def, lo, hi) => typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : def;
    const tOr = (v, def) => okT(v) ? v : def;
    const t = okT(st.t) ? st.t : okT(st.born) ? st.born : okT(now) ? now : null;
    if (t === null) return null;
    st.v = 1;
    st.t = t;
    st.born = okT(st.born) && st.born <= t ? st.born : t;
    const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
    const past = (v, def) => okT(v) && v <= t ? v : def;               // a moment that has happened (≤ t)
    const soon = (v, max) => okT(v) && v <= t + max ? v : 0;           // a time in the near future (≤ t + max)
    if (!(Number.isInteger(st.seed) && st.seed >= 0 && st.seed < 4294967296)) st.seed = hash32(st.born % 4294967296, Math.floor(st.born / 4294967296), 99);
    st.n = Number.isInteger(st.n) && st.n >= 0 && st.n < 4294967296 ? st.n : 0;
    st.name = cleanName(st.name);
    const N = st.needs && typeof st.needs === 'object' && !Array.isArray(st.needs) ? st.needs : {};
    const ND = { food: 70, water: 70, energy: 70, fun: 60, love: 60, litter: 80, coat: 80 };
    st.needs = {}; for (const k of Object.keys(ND)) st.needs[k] = num(N[k], ND[k], 0, 100);
    st.weight = num(st.weight, 4.2, 3.0, 5.6);
    st.bond = num(st.bond, 0, 0, 1000);
    st.lvl = Number.isInteger(st.lvl) ? clamp(st.lvl, 0, LEVELS.length - 1) : 0;
    st.lvl = Math.max(st.lvl, levelOf(st.bond)); st.bond = Math.max(st.bond, LEVELS[st.lvl].min);
    st.pamlsky = Math.floor(num(st.pamlsky, 0, 0, 99999));
    st.asleep = st.asleep === true;
    st.sleepAt = past(st.sleepAt, 0); st.wokeAt = past(st.wokeAt, t);
    st.held = st.held === true; st.heldAt = past(st.heldAt, 0); st.pickAt = past(st.pickAt, 0);
    st.place = typeof st.place === 'string' && st.place.length <= 20 ? st.place : null;
    st.out = st.out && typeof st.out === 'object' && okT(st.out.since) && st.out.since <= t && okT(st.out.until) && st.out.until >= st.out.since && st.out.until <= t + 8 * HOUR ? { since: st.out.since, until: st.out.until, walk: st.out.walk === true, byPlayer: st.out.byPlayer === true } : null;
    if (st.out) st.asleep = false;
    const L = st.lap;
    st.lap = L && typeof L === 'object' && !st.out && !st.asleep && okT(L.since) && L.since <= t
      ? { since: L.since, annoy: num(L.annoy, 0, 0, 10), doze: L.doze === true, pet: past(L.pet, 0), dozeAt: L.doze === true ? past(L.dozeAt, t) : 0 } : null;
    if (st.lap) st.held = false;
    const Y = st.yard, TR = Y && Y.tree;
    st.yard = Y && typeof Y === 'object' && !st.out && okT(Y.since) && Y.since <= t ? {
      since: Y.since, snow: Y.snow === true,
      tree: TR && typeof TR === 'object' && okT(TR.since) && TR.since <= t ? { since: TR.since, calls: Math.floor(num(TR.calls, 0, 0, 3)) } : null,
    } : null;
    st.wet = soon(st.wet, GARDEN.wetFor * MIN);
    if (st.wx !== undefined && !setWx(st, st.wx)) delete st.wx;   // the real weather (§12f): a canonical copy, or none
    const B =Array.isArray(st.beds) ? st.beds : [];
    st.beds = [];
    const open = bedCount(st);   // from the repaired lvl: a crop on a bed not open yet (a broken save) would be invisible
    for (let i = 0; i < BEDS; i++) {
      const b = B[i];
      st.beds.push(i < open && b && typeof b === 'object' && has(CROPS, b.crop) && okT(b.sown) ? {
        crop: b.crop, sown: Math.min(b.sown, t), days: Math.floor(num(b.days, 0, 0, CROPS[b.crop].days)),
        watered: isKey(b.watered) && b.watered <= dkey(t) ? b.watered : 0,
      } : null);
    }
    const P = st.pantry && typeof st.pantry === 'object' ? st.pantry : {};
    st.pantry = {}; for (const k of Object.keys(P)) if (has(CROPS, k) && P[k] >= 1) st.pantry[k] = Math.floor(num(P[k], 0, 0, CMAX));
    const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const SK = obj(st.stock); st.stock = {};
    for (const k of Object.keys(SK)) if (STOCK_KEYS.includes(k) && SK[k] >= 1) st.stock[k] = Math.floor(num(SK[k], 0, 0, CMAX));
    const OW = obj(st.owned); st.owned = {};
    for (const k of Object.keys(OW)) if (has(SHOP_BY, k) && !SHOP_BY[k].stock && OW[k] === true) st.owned[k] = true;
    const FU = obj(st.furniture); st.furniture = {};
    for (const k of Object.keys(FU)) {
      const it = has(SHOP_BY, k) ? SHOP_BY[k] : null, p = obj(FU[k]);
      if (it && st.owned[k] && it.room && ROOMS.includes(p.room) && (!it.fixed || p.room === it.room))
        st.furniture[k] = { room: p.room, x: num(p.x, 0.5, 0, 1), y: num(p.y, 0.5, 0, 1) };
    }
    // installed things (the cat flap) are in place whenever they are owned (older saves bought them without it)
    for (const it of SHOP) if (it.install && st.owned[it.id] && !st.furniture[it.id]) st.furniture[it.id] = { room: it.room, x: 0.5, y: 0.5 };
    const RE = obj(st.records); st.records = {};
    for (const k of Object.keys(RE)) { const r = obj(RE[k]); if (has(GAMES, k) && r.best >= 1 && okT(r.t)) st.records[k] = { best: Math.floor(num(r.best, 0, 0, 999)), t: Math.min(r.t, t) }; }
    const TK = obj(st.tricks); st.tricks = {};
    for (const k of Object.keys(TK)) {
      if (!has(TRICKS, k)) continue;
      const r = obj(TK[k]), learned = past(r.learned, 0);
      st.tricks[k] = { progress: learned ? TRICK_N : Math.floor(num(r.progress, 0, 0, TRICK_N - 1)), learned, shown: isKey(r.shown) ? Math.min(r.shown, dkey(t + DAY)) : 0, miss: Number.isInteger(r.miss) ? clamp(r.miss, 0, 2) : 0 };
    }
    const ED = obj(st.earnDay);
    st.earnDay = !isKey(ED.key) ? { key: dkey(t), n: 0 } : ED.key <= dkey(t + DAY) ? { key: ED.key, n: Math.floor(num(ED.n, 0, 0, EARN_CAP)) }
      : { key: dkey(t + DAY), n: EARN_CAP };
    const TR2 = obj(st.train);
    st.train = has(TRICKS, TR2.trick) && okT(TR2.at) && TR2.at <= t ? { trick: TR2.trick, at: TR2.at } : null;
    repairSocial(st, t);
    if (st.yard && st.yard.tree) { st.lap = null; st.held = false; }   // up the tree she is neither on the lap nor held
    const PR = st.presents && typeof st.presents === 'object' ? st.presents : {};
    st.presents = {}; for (const k of Object.keys(PR)) if (has(PRESENTS, k) && PR[k] >= 1) st.presents[k] = Math.floor(num(PR[k], 0, 0, CMAX));
    const seen = new Set();
    st.postcards = (Array.isArray(st.postcards) ? st.postcards : []).filter(p => p && Number.isInteger(p.id) && p.id >= 0 && p.id < POSTCARDS && okT(p.t))
      .map(p => ({ id: p.id, t: Math.min(p.t, t) })).slice(0, 100000);
    // a broken list must not repeat cards early: keep the longest prefix that follows the seeded order
    let ok = 0; for (const p of st.postcards) { if (p.id !== postcardAt(st.seed, ok)) break; ok++; }
    st.postcards = st.postcards.slice(0, ok); seen.clear();
    st.ill = st.ill && typeof st.ill === 'object' && ILLS[st.ill.kind] && Object.prototype.hasOwnProperty.call(ILLS, st.ill.kind) && okT(st.ill.since) ? { kind: st.ill.kind, since: Math.min(st.ill.since, t) } : null;
    const A = st.acc && typeof st.acc === 'object' ? st.acc : {};
    st.acc = { fleas: num(A.fleas, 0, 0, 10 * DAY), tummy: num(A.tummy, 0, 0, 10 * DAY), cold: num(A.cold, 0, 0, 10 * DAY) };
    st.off = st.off && typeof st.off === 'object' && soon(st.off.until, DAY) ? { until: st.off.until, turned: st.off.turned === true } : null;
    st.scared = soon(st.scared, 2 * HOUR);
    st.tease = repairTease(st.tease, st, t);
    st.litterAt = okT(st.litterAt) && st.litterAt >= t - 2 * DAY && st.litterAt <= t + 9 * HOUR ? st.litterAt : t + 8 * HOUR;
    // the food bowl, the water dish, a meal or a drink in progress, the pour times (older saves: an empty bowl, a dish
    // as full as she was satisfied)
    const BW = obj(st.bowl);
    st.bowl = has(FOODS, BW.kind) && typeof BW.amt === 'number' && BW.amt > 0.5 && BW.amt <= 100 && okT(BW.at) && BW.at <= t
      ? { kind: BW.kind, amt: BW.amt, at: BW.at, wait: okT(BW.wait) && BW.wait <= t + BOWL.wait ? BW.wait : 0 } : null;
    st.dish = typeof st.dish === 'number' && Number.isFinite(st.dish) ? clamp(st.dish, 0, 100)
      : st.dish === undefined && typeof N.water === 'number' && Number.isFinite(N.water) ? clamp(N.water, 0, 100) : DISH.old;
    const ML = obj(st.meal);
    st.meal = st.bowl && ML.kind === st.bowl.kind && okT(ML.since) && ML.since <= t + BOWL.walk.trot
      ? { since: ML.since, kind: ML.kind, gain: num(ML.gain, 0, 0, 100), f0: num(ML.f0, 0, 0, 100) } : null;
    const DR = obj(st.drink);
    st.drink = !st.meal && okT(DR.since) && DR.since <= t ? { since: DR.since, gain: num(DR.gain, 0, 0, DISH.sip), w0: num(DR.w0, 0, 0, 100) } : null;
    // [hour, day key] pairs, oldest first
    st.mealLog = (Array.isArray(st.mealLog) ? st.mealLog : []).filter(e => Array.isArray(e) && e.length === 2 && typeof e[0] === 'number'
      && Number.isFinite(e[0]) && e[0] >= 0 && e[0] < 24 && isKey(e[1])).map(e => [hourKey(e[0]), e[1]]).slice(-BOWL.log);
    st.sleepPlace = SLEEP_PLACES.includes(st.sleepPlace) ? st.sleepPlace : null;
    st.walkMax = num(st.walkMax, 0, 0, 100 * DAY);
    const year = new Date(t).getFullYear();
    st.bday = Number.isInteger(st.bday) && st.bday >= 2000 && st.bday <= year ? st.bday : year;
    st.pill = isKey(st.pill) && st.pill <= tomorrow(t) ? st.pill : 0;
    const T = st.traits && typeof st.traits === 'object' ? st.traits : {}, D = drawTraits(st.seed);
    st.traits = {
      favFood: ['pouch', 'chicken', 'tuna'].includes(T.favFood) ? T.favFood : D.favFood,
      spots: Array.isArray(T.spots) && T.spots.length === 2 && T.spots.every(s => SPOTS.includes(s)) && T.spots[0] !== T.spots[1] ? T.spots.slice() : D.spots,
      bellyOk: num(T.bellyOk, D.bellyOk, 0.15, 0.4),
      fear: has(FEARS, T.fear) ? T.fear : D.fear, quirk: has(QUIRKS, T.quirk) ? T.quirk : D.quirk, toy: BASE_TOYS.includes(T.toy) ? T.toy : D.toy,
    };
    const C = st.cnt && typeof st.cnt === 'object' ? st.cnt : {};
    st.cnt = {}; for (const k of COUNTS) st.cnt[k] = Math.floor(num(C[k], 0, 0, CMAX));
    const Dy = st.diary && typeof st.diary === 'object' ? st.diary : {};
    st.diary = {}; for (const k of Object.keys(Dy)) if (DIARY_IDS.includes(k) && okT(Dy[k])) st.diary[k] = Math.min(Dy[k], t);   // keeps the order found
    if (!st.diary.birthday) st.diary.birthday = st.born;
    const DC = obj(st.diaryCat); st.diaryCat = {};   // only for a found pal* entry, in a fixed order
    for (const k of CAT_DIARY) if (st.diary[k] && (k === 'kittens' ? MOTHERS.includes(DC[k]) || !!kitOf(st, DC[k]) : isVisitor(st, DC[k]))) st.diaryCat[k] = DC[k];
    const d = st.day;
    st.day = d && typeof d === 'object' && isKey(d.key) && d.key <= dkey(t) && typeof d.ms === 'number' && d.ms >= 0 && d.ms <= 26 * HOUR ? {
      key: d.key, ms: num(d.ms, 0, 0, 2 * DAY), food: num(d.food, 0, 0, 200 * DAY), mood: num(d.mood, 0, -200 * DAY, 200 * DAY),
      minE: num(d.minE, 100, 0, 100), treats: Math.floor(num(d.treats, 0, 0, 1000)), ttreats: Math.floor(num(d.ttreats, 0, 0, 1000)), q: d.q === true, acted: d.acted === true,
      early: okT(d.early) && d.early <= t && dkey(d.early) === d.key ? d.early : 0,
    } : freshDay(t);
    if (st.day.food > st.day.ms * 100 + 1) st.day.food = st.day.ms * 50;
    if (Math.abs(st.day.mood) > st.day.ms * 100 + 1) st.day.mood = 0;
    st.want = NEED_WANTS.includes(st.want) ? st.want : null;
    const W = st.wantAt && typeof st.wantAt === 'object' ? st.wantAt : {};
    st.wantAt = {}; for (const k of Object.keys(W)) if (NEED_WANTS.includes(k) && okT(W[k])) st.wantAt[k] = Math.min(W[k], t);
    // the sleep plan (after the needs, the traits and st.out): asleep = when she wakes, awake = when she naps, a night
    // stroll, a call she follows later, the player's last play; a missing or broken plan is planned again from t
    st.wakeAt = st.asleep && okT(st.wakeAt) && st.wakeAt <= t + 16 * HOUR ? st.wakeAt : 0;
    st.napAt = !st.asleep && okT(st.napAt) && st.napAt <= t + 48 * HOUR ? st.napAt : 0;
    st.stroll = !st.asleep && okT(st.stroll) && st.stroll <= t + SLEEP.strollLen[1] * MIN ? st.stroll : 0;
    st.callAt = !st.asleep && !st.out && okT(st.callAt) && st.callAt <= t + 3 * MIN ? st.callAt : 0;
    st.playAt = past(st.playAt, 0);
    // play and memories (SPEC §14): a hide only at home, awake, free of the lap and the arms, at a spot that exists now
    const HD = obj(st.hide), hr0 = hideRoom(st, HD.spot);
    st.hide = hr0 && HD.room === hr0 && okT(HD.since) && HD.since <= t && HD.until === HD.since + HIDE.len &&
      !st.asleep && !st.out && !st.yard && !st.lap && !st.held ? { spot: HD.spot, room: hr0, since: HD.since, until: HD.until } : null;
    const HS = obj(st.hides), hk = isKey(HS.key) && HS.key <= dkey(t) ? HS.key : 0;
    st.hides = { key: hk, n: hk && Number.isInteger(HS.n) ? clamp(HS.n, 0, HIDE.max) : 0, at: past(HS.at, 0) };
    const MM = obj(st.mem), fixMem = v => {
      const o = obj(v);
      return {
        birds: Math.round(num(o.birds, 0, 0, MEM.birds) * 1000) / 1000,
        cats: (Array.isArray(o.cats) ? o.cats : []).filter((c, i, A) => isVisitor(st, c) && A.indexOf(c) === i).slice(0, MEM.cats),
        toy: has(TOYS, o.toy) ? o.toy : null, fav: o.fav === true, walk: o.walk === true,
        food: o.food === 'treat' || has(FOODS, o.food) ? o.food : null,
      };
    };
    st.mem = { today: fixMem(MM.today), prev: fixMem(MM.prev) };
    const CA = obj(st.catch);
    st.catch = (CA.kind === 'mouse' || CA.kind === 'cricket') && okT(CA.at) && CA.at <= t && CA.until === CA.at + CATCH.ms ? { kind: CA.kind, at: CA.at, until: CA.until } : null;
    st.catchDay = isKey(st.catchDay) && st.catchDay <= dkey(t) ? st.catchDay : 0;
    st.leaves = past(st.leaves, 0);
    ensurePlan(st);
    for (const k of Object.keys(st)) if (!STATE_KEYS.includes(k)) delete st[k];
    return st;
  }
  const STATE_KEYS = ['v', 'seed', 'n', 't', 'born', 'name', 'needs', 'weight', 'bond', 'lvl', 'pamlsky', 'asleep', 'sleepAt', 'wokeAt', 'held', 'heldAt', 'pickAt', 'place', 'out', 'ill', 'acc', 'off', 'scared', 'litterAt', 'walkMax', 'bday', 'pill', 'traits', 'cnt', 'diary', 'day', 'want', 'wantAt', 'lap', 'yard', 'wet', 'beds', 'pantry', 'postcards', 'presents', 'stock', 'owned', 'furniture', 'records', 'tricks', 'earnDay', 'train', 'visitors', 'visit', 'album', 'diaryCat', 'guest', 'invDay', 'jealous', 'jealousAt', 'kits', 'litter', 'tease', 'bowl', 'dish', 'meal', 'drink', 'mealLog', 'sleepPlace',
    'napAt', 'wakeAt', 'stroll', 'callAt', 'playAt', 'wx', 'hide', 'hides', 'mem', 'catch', 'catchDay', 'leaves'];
  // the canonical st.tease (SPEC §13.3), after st.wet and st.off were repaired; st.off is never changed here
  function repairTease(Z, st, t) {
    const okT = v => typeof v === 'number' && Number.isFinite(v) && v >= T_MIN && v <= T_MAX;
    const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : 0);
    const past = v => (okT(v) && v <= t ? v : 0);
    const day = v => (isKey(v) && v <= dkey(t) ? v : 0);
    const T = Z && typeof Z === 'object' && !Array.isArray(Z) ? Z : {}, off = longOff(st, t);
    const kind = (T.kind === 'sulk' || T.kind === 'cross') && okT(T.until) && T.until > t &&
      T.until <= t + (T.kind === 'sulk' ? TEASE.sulkMin : TEASE.crossMin) * MIN && !off ? T.kind : null;
    const at = past(T.at), heat = at ? num(T.heat, 0, TEASE.heatMax) : 0;
    const warnAt = okT(T.warnAt) && T.warnAt <= at ? T.warnAt : 0;
    const boops = (Array.isArray(T.boops) ? T.boops : []).filter(b => okT(b) && b > t - TEASE.boopWin && b <= t).sort((a, b) => a - b).slice(-(TEASE.boopN - 1));
    let gainAt = past(T.gainAt), gain = num(T.gain, 0, TEASE.gainMax + TEASE.flopLove);
    if (!gainAt || t - gainAt >= TEASE.gainWin * MIN) { gainAt = 0; gain = 0; }
    const P = T.pay && typeof T.pay === 'object' ? T.pay : {};
    const pay = (P.kind === 'shelf' || P.kind === 'ambush') && okT(P.at) && P.at > t - TEASE.pay.lapse * MIN && P.at <= t + 45 * MIN && !off ? { kind: P.kind, at: P.at } : null;
    return {
      kind, until: kind ? T.until : 0, heat, at, warnAt, boops, gain, gainAt, pay, payDay: day(T.payDay), bondDay: day(T.bondDay),
      splash: okT(T.splash) && T.splash > t && T.splash === st.wet ? T.splash : 0,
    };
  }
  // after an advance or an act: the nose taps of the last 60 s, the love window, "wet from the can" (canonical as repair)
  function teaseTidy(st) {
    const T = st.tease, t = st.t;
    if (T.boops.length && T.boops[0] <= t - TEASE.boopWin) T.boops = T.boops.filter(b => b > t - TEASE.boopWin);
    if (T.gainAt && t - T.gainAt >= TEASE.gainWin * MIN) { T.gain = 0; T.gainAt = 0; }
    if (T.splash && !(T.splash > t && T.splash === st.wet)) T.splash = 0;
  }
  // valid(st): repairs st in place and says whether it is usable (false only for null, a non-object or no time at all)
  function valid(st) { return repair(st) !== null; }

  /* --- needs, mood, wants --- */
  // what she can want: the litter box (clean it) and her coat (brush her) are told apart
  const NEED_WANTS = ['food', 'water', 'litter', 'coat', 'love', 'fun'];
  function needs(st) {
    const N = st.needs;
    return { food: N.food, water: N.water, energy: N.energy, fun: N.fun, love: N.love, litter: N.litter, coat: N.coat, clean: Math.min(N.litter, N.coat) };
  }
  function moodValue(st) {
    const v = needs(st);
    let m = (v.food * 0.25 + v.water * 0.2 + v.love * 0.2 + v.fun * 0.15 + v.clean * 0.1 + v.energy * 0.1 - 50) * 2;
    for (const k of ['food', 'water', 'clean', 'love', 'fun']) if (v[k] < 20) m -= 20 - v[k];
    if (st.ill) m -= 30;
    if (st.off && st.t < st.off.until) m -= 25;
    if (st.scared > st.t) m -= 20;
    if (st.wet > st.t) m -= 15;                       // wet from the rain (or the can): grumpy for a while
    const tk = teaseKind(st);                         // teasing: a sulk −10, a cross −20
    if (tk) m += TEASE.mood[tk];
    if (perceives(st)) {   // a neighbour cat in the garden: what they do together, else how she takes it (only when she knows)
      const A = st.visit.act;
      m += A && A.with === 'koxa' && Object.prototype.hasOwnProperty.call(VISIT_ACTS, A.kind) ? VISIT_ACTS[A.kind].mood : VISIT_MOOD[reaction(st, st.visit.id)];
    }
    if (st.yard && st.yard.tree) m -= 10;             // stuck on the tree
    if (st.jealous) m -= 5;                           // she saw you with a visitor
    if (st.guest && !st.out && !st.yard) m += 5;      // a friend sleeps over (she is at home with it)
    return Math.round(clamp(m, -100, 100));
  }
  // she knows about the visitor: in the garden (with the player or alone), or awake at home once she noticed it
  // (user's wish 2026-11-17: asleep or out on a walk a neighbour cat changes nothing)
  const gardenAlone = st => !!(st.out && !st.out.walk);
  const perceives = st => !!st.visit && (!!st.yard || gardenAlone(st) || (!st.out && !st.asleep && !!st.visit.noticed));
  const moodName = v => v >= 50 ? 'happy' : v >= 10 ? 'calm' : v >= -30 ? 'grumpy' : 'sad';
  function mood(st) { return moodName(moodValue(st)); }
  function wants(st) {
    const v = needs(st);
    let best = null;
    for (const k of NEED_WANTS) if (v[k] < 40 && (best === null || v[k] < v[best])) best = k;
    // her routine: at a learned meal time she waits at the empty bowl and asks
    if (best === null && v.food < BOWL.routine && !bowlHas(st) && mealTime(st, st.t) !== null) best = 'food';
    return best;
  }
  const bowlHas = st => !!(st.bowl && st.bowl.amt >= 1);
  // st.want follows wants() only while she can meow (awake, not out, not on the lap); otherwise the old want stays, so
  // the meow comes when she wakes up or comes home. Returns the new want, or undefined when it was kept.
  function syncWant(st) {
    if (st.asleep || st.out || st.lap) return undefined;
    return (st.want = wants(st));
  }
  // the box quirk is seen only when she really sleeps in her box
  function boxSeen(st, t, ev) { if (st.asleep && st.sleepPlace === 'box' && boxHome(st)) seenQuirk(st, 'box', t, ev); }
  // her box can be slept in only when it stands in a room of the house (the picture draws it only there) and she is home
  const boxHome = st => !st.yard && !!st.furniture.box && st.furniture.box.room !== 'garden';
  // the learned meal times (local hours, ascending): where at least 3 of the last 8 logged pours lie within ±45 min and
  // on at least 2 different days; the time is their mean; times closer than 1.5 h merge into the one with more pours
  function mealTimes(st) {
    const LG = Array.isArray(st.mealLog) ? st.mealLog : [], L = LG.map(e => e[0]), cand = [];
    for (const h of L) {
      const near = LG.filter(e => hourDist(e[0], h) <= BOWL.near + 1e-9), m = near.map(e => e[0]);
      if (m.length < BOWL.need || new Set(near.map(e => e[1])).size < BOWL.days) continue;
      let s = 0;
      for (const x of m) { let d = x - h; if (d > 12) d -= 24; else if (d < -12) d += 24; s += d; }
      cand.push({ c: hourKey(((h + s / m.length) % 24 + 24) % 24), n: m.length });
    }
    cand.sort((a, b) => b.n - a.n || a.c - b.c);
    const out = [];
    for (const x of cand) if (out.every(y => hourDist(y, x.c) > 2 * BOWL.near)) out.push(x.c);
    return out.sort((a, b) => a - b);
  }
  // the learned meal time whose window (30 min before to 60 min after) holds the moment t, else null
  function mealTime(st, t) {
    if (typeof t !== 'number' || !Number.isFinite(t)) return null;
    const h = hourOf(t);
    for (const c of mealTimes(st)) {
      let d = h - c; if (d > 12) d -= 24; else if (d < -12) d += 24;
      if (d >= -BOWL.before && d <= BOWL.after) return c;
    }
    return null;
  }
  // at home and free to go to the bowl: awake, not out, not in the garden, not on the lap, not held, not hiding
  const free = (st, t) => !st.out && !st.yard && !st.asleep && !st.lap && !st.held && !(st.scared > t);
  // the bowl and the dish for the UI
  function bowls(st) {
    const B = st.bowl, M = st.meal, R = st.drink, t = st.t;
    return {
      bowl: B ? { kind: B.kind, amt: Math.round(B.amt), at: B.at } : null, dish: Math.round(st.dish),
      eating: !!(M && M.since <= t), coming: !!(M && M.since > t), mealKind: M ? M.kind : null, mealSince: M ? M.since : 0,
      drinking: !!R, mealTime: mealTime(st, t), mealTimes: mealTimes(st),
    };
  }
  function levelOf(bond) { let l = 0; for (let i = 0; i < LEVELS.length; i++) if (bond >= LEVELS[i].min) l = i; return l; }
  function bondLevel(st) {
    const l = st.lvl;
    return { level: l, bond: Math.round(st.bond), min: LEVELS[l].min, next: l + 1 < LEVELS.length ? LEVELS[l + 1].min : null };
  }
  function health(st) {
    const t = st.t;
    return {
      ill: st.ill ? st.ill.kind : null, illSince: st.ill ? st.ill.since : null,
      illDaysLeft: st.ill ? Math.max(0, Math.ceil((st.ill.since + 4 * DAY - t) / DAY)) : 0,
      weight: r2(st.weight), thin: st.weight < 3.6, chubby: st.weight > 5.0,
      offended: !!(st.off && t < st.off.until), scared: st.scared > t, asleep: st.asleep, out: !!st.out, held: st.held,
      lap: !!st.lap, lapSince: st.lap ? st.lap.since : null, lapDoze: !!(st.lap && st.lap.doze),
      garden: !!st.yard, wet: st.wet > t, tree: !!(st.yard && st.yard.tree), walk: !!(st.out && st.out.walk),
      pill: st.pill ? (dkey(t) >= st.pill ? 'today' : 'tomorrow') : null,
      guest: st.guest ? st.guest.id : null, jealous: !!st.jealous,
      sulk: teaseKind(st) === 'sulk', cross: teaseKind(st) === 'cross', splashed: !!(st.tease && st.wet > t && st.wet === st.tease.splash),
      teaseUntil: teasing(st) ? st.tease.until : 0,
      sleepPlace: st.asleep ? st.sleepPlace || 'bed' : null,
      eating: !!(st.meal && st.meal.since <= t), coming: !!(st.meal && st.meal.since > t), drinking: !!st.drink,
      bowl: st.bowl ? Math.round(st.bowl.amt) : 0, bowlKind: st.bowl ? st.bowl.kind : null, dish: Math.round(st.dish),
      // user's wishes 2026-11-17: alone in the garden (out is true, walk false: draw her in the garden, not away); a
      // daytime nap (else a night's sleep) and when she wakes; awake on a short night stroll; a call she follows at callAt;
      // she knows about the visitor (the window: only then she goes to look)
      gardenAlone: gardenAlone(st), nap: napping(st), wakeAt: st.asleep ? st.wakeAt : st.lap && st.lap.doze ? st.lap.dozeAt + dozeLen(st, st.lap) : 0, stroll: !st.asleep && st.stroll > t,
      callAt: st.callAt, visitNoticed: !!(st.visit && st.visit.noticed),
      // play (SPEC §14): hidden { spot, room, since, until } | null; a catch waiting for praise { kind, until } | null
      hiding: st.hide ? { spot: st.hide.spot, room: st.hide.room, since: st.hide.since, until: st.hide.until } : null,
      catch: st.catch ? { kind: st.catch.kind, until: st.catch.until } : null,
    };
  }

  /* --- bond, diary --- */
  function addBond(st, d, ev) {
    st.bond = clamp(st.bond + d, LEVELS[st.lvl].min, 1000);
    const l = levelOf(st.bond);
    if (l > st.lvl) { st.lvl = l; ev.push({ type: 'levelUp', level: l }); }
  }
  function find(st, id, t, ev) {
    if (st.diary[id]) return;
    st.diary[id] = t;
    ev.push({ type: 'found', id, info: entryInfo(st, id) });
  }
  // the facts of a found Deníček entry, for the UI's message (codes and numbers, no text):
  //   favFood { food } | spot_<region> { region } | belly {} | toy { toy } | fear { fear } | quirk { quirk } |
  //   weight { kg } | walk { h, min } | birthday { y, m, d } (m 1–12) | bliss { brisk } | boop, reconcile, splash, payback {} |
  //   the cat entries { cat (visitor id or null), fem } and for kittens also { mother (when a young cat came alone first),
  //   kits: [kitten ids of the mother's first litter seen] }
  function entryInfo(st, id) {
    const T = st.traits;
    if (id === 'favFood') return { food: T.favFood };
    if (id.startsWith('spot_')) return { region: id.slice(5) };
    if (id === 'toy') return { toy: T.toy };
    if (id === 'fear') return { fear: T.fear };
    if (id === 'quirk') return { quirk: T.quirk };
    if (id === 'weight') return { kg: Math.round(st.weight * 10) / 10 };
    if (id === 'walk') { const m = Math.round(st.walkMax / MIN); return { h: Math.floor(m / 60), min: m % 60 }; }
    if (id === 'birthday') { const [y, m, d] = ymd(st.born); return { y, m: m + 1, d }; }
    if (id === 'bliss') return { brisk: patTempo(st) <= 520 };
    if (CAT_DIARY.includes(id)) {
      const c = st.diaryCat ? visitor(st, st.diaryCat[id]) : null;
      const info = { cat: c ? c.id : null, fem: !!(c && c.fem) };   // Koxa is a she: the plural is feminine only with a female cat
      if (id === 'kittens' && c) {
        // a young cat nobody saw while small came alone first; else the mother's first litter seen
        if (c.mother) info.mother = c.mother;
        else { const first = st.kits.filter(k => k.mother === c.id && kitSeen(st, k)); info.kits = first.length ? first.filter(k => kitLit(k.id) === kitLit(first[0].id)).map(k => k.id) : []; }
      }
      return info;
    }
    return {};
  }
  // Deníček: her two spots only; found = when it was found (the UI shows the fact from info), else the UI shows a question
  function diary(st) {
    const ids = ['favFood'].concat(st.traits.spots.map(s => 'spot_' + s), ['belly', 'toy', 'fear', 'quirk', 'weight', 'walk', 'birthday'], TEASE_DIARY, CAT_DIARY);
    return ids.map(id => {
      const found = st.diary[id] || null;
      return { id, found, info: found ? entryInfo(st, id) : null };
    });
  }
  function seenQuirk(st, id, t, ev) {
    if (st.traits.quirk !== id) return;
    ev.push({ type: 'quirk', id });
    if (st.day.q) return;                       // counts once a local day
    st.day.q = true;
    if (inc(st, 'quirk') >= 2) find(st, 'quirk', t, ev);
  }
  function meet(st, what, t, ev) {
    if (st.traits.fear === what) {
      st.scared = t + 2 * HOUR; st.held = false; st.callAt = 0;
      if (st.asleep) rouse(st, t); else st.wokeAt = t;
      if (st.lap) leaveLap(st, t, 'scared', ev);
      ev.push({ type: 'scared', what });
      find(st, 'fear', t, ev);
    } else ev.push({ type: 'curious', what });
  }
  function leaveLap(st, t, reason, ev) {
    ev.push({ type: 'lapLeave', reason, minutes: Math.round((t - st.lap.since) / MIN) });
    lapNapDone(st, t);
    st.lap = null;
  }
  // a doze on the lap ends (she woke, was stroked awake, the player stood up): a doze of 15 min or more was her nap, so
  // the next one is planned from now (as after any wake); a shorter one leaves her nap plan as it was
  function lapNapDone(st, t) {
    const L = st.lap;
    if (!L || !L.doze) return;
    if (t - L.dozeAt >= LAP.napped * MIN) { st.wokeAt = t; st.stroll = 0; st.napAt = napPlan(st, t); }
    L.doze = false; L.dozeAt = 0;
  }
  // how long a doze on the lap lasts, from its start (seeded, never st.n)
  const dozeLen = (st, L) => (st.needs.energy < 35 ? LAP.dozeMax : LAP.dozeMin + Math.floor(rndSeed(st.seed, Math.floor(L.dozeAt / 1000), 70) * (LAP.dozeMax - LAP.dozeMin + 1))) * MIN;
  // one step on the lap: annoyance fades; she may doze off, wake rested, or jump down and run off
  function lapStep(st, t, dt, night, ev) {
    const L = st.lap, N = st.needs, m = dt / MIN;
    L.annoy = Math.max(0, L.annoy - LAP.calm * m);
    if (L.doze) {
      if (t - L.dozeAt >= dozeLen(st, L)) { lapNapDone(st, t); L.pet = t; ev.push({ type: 'wake', early: false, lap: true }); }
      return;
    }
    const mv = moodValue(st), evening = dayPhase(t) === 'evening';
    // sleepy: her nap is due soon (or overdue: she could not nap while on the lap), or she is tired (user's wish 2026-11-17)
    const overdue = !!st.napAt && t >= st.napAt, napSoon = !!st.napAt && st.napAt - t <= LAP.napSoon * MIN, sleepy = napSoon || N.energy < 60;
    const sincePet = t - L.pet;   // she nods off when the stroking stops (20 s – 2 min after the last stroke), or in the evening and at night
    if (sleepy && mv >= 10 && L.annoy < 1 && ((sincePet >= 20000 && sincePet <= 2 * MIN) || ((night || evening) && sincePet >= 20000))) {
      const r = LAP.doze * (N.energy < 35 ? 2 : 1) * (napSoon ? 2 : 1) * (overdue ? 2 : 1) * (night ? 2 : evening ? 1.5 : 1);
      if (rnd(st) < 1 - Math.exp(-r * m)) { L.doze = true; L.dozeAt = t; ev.push({ type: 'lapDoze' }); return; }
    }
    if (t + dt - L.since < LAP.settle * MIN && L.annoy < 2) return;
    let rate = LAP.leave, top = 1, reason = 'restless';
    const f = (k, why) => { rate *= k; if (k > top) { top = k; reason = why; } };
    if (N.food < 25) f(LAP.hungry, 'hungry'); else if (N.water < 25) f(LAP.hungry, 'thirsty');
    if (N.fun < 25) f(LAP.bored, 'bored');
    if (st.off && t < st.off.until) f(LAP.offended, 'offended');
    if (st.scared > t) f(LAP.scared, 'scared');
    if (L.annoy > 0) f(1 + LAP.annoy * L.annoy, 'annoyed');
    if ((N.energy < 50 || napSoon) && mv >= 50) rate *= LAP.sleepyHappy;
    if (t - L.pet <= MIN) rate *= LAP.petted;
    if (rnd(st) < 1 - Math.exp(-rate * m)) leaveLap(st, t + dt, reason, ev);
  }
  /* --- the food bowl and the water dish (user's wish 2026-11-17) --- */
  // a meal ends (eaten up, full, or she left the bowl): love, bond, purr and the favourite food count now, not at the pour
  function endMeal(st, t, watching, ev) {
    const M = st.meal, N = st.needs;
    st.meal = null;
    if (M.gain < 0.5) return;                    // she never got to eat
    const fav = M.kind === st.traits.favFood, tummy = !!(st.ill && st.ill.kind === 'tummy');
    N.love = Math.min(100, N.love + (fav ? 7 : 2));
    if (watching) ev.push({ type: 'ate', food: M.kind, gain: Math.round(M.gain), left: bowlHas(st), fav });
    if (fav) {
      st.mem.today.food = M.kind;
      addBond(st, 1, ev);
      if (watching) ev.push({ type: 'purr' });
      if (!tummy && inc(st, 'favFood') >= 3) find(st, 'favFood', t, ev);
    }
    // a satisfied want (she was hungry): bond +1, at most once an hour
    if (M.f0 < 40 && N.food >= 40 && !(t - (st.wantAt.food || 0) < HOUR)) { st.wantAt.food = t; addBond(st, 1, ev); }
  }
  function endDrink(st, t, watching, ev) {
    const R = st.drink, N = st.needs;
    st.drink = null;
    if (R.gain < 0.5) return;
    if (watching) ev.push({ type: 'drank', tap: false });
    if (R.w0 < 40 && N.water >= 40 && !(t - (st.wantAt.water || 0) < HOUR)) { st.wantAt.water = t; addBond(st, 1, ev); }
  }
  // a meal or a drink that cannot go on (she was picked up, fell asleep, went out…) ends at once
  function bowlCheck(st, t, watching, ev) {
    if (free(st, t)) return;
    if (st.meal) endMeal(st, t, watching, ev);
    if (st.drink) endDrink(st, t, watching, ev);
  }
  // one step at the bowls: she starts a meal by herself when hungry (or at her meal time), eats at BOWL.eat a minute,
  // stops when full or the bowl is empty; she drinks in short sessions when thirsty. Works for any step length.
  // she goes to eat by herself: hungry (or under the routine level at her meal time) with food in the bowl
  const wantsMeal = (st, t) => st.needs.food < BOWL.hungry || (st.needs.food < BOWL.routine && mealTime(st, t) !== null);
  // a meal starts within a few minutes (free at home, a filled bowl, no huff longer than BOWL.wait): no nap before it
  const mealDue = (st, t) => free(st, t) && !st.meal && !!st.bowl && st.bowl.wait <= t + BOWL.wait && wantsMeal(st, t);
  function bowlStep(st, t, dt, watching, ev) {
    const N = st.needs, te = t + dt;
    if (st.meal && !st.bowl) endMeal(st, t, watching, ev);   // never a meal without a bowl
    bowlCheck(st, t, watching, ev);
    if (!free(st, t)) return;
    const B = st.bowl;
    if (!st.meal && !st.drink && B && B.wait < te && wantsMeal(st, t))
      st.meal = { since: Math.max(t, B.wait), kind: B.kind, gain: 0, f0: N.food };   // after a huff: when the 2 minutes are over
    if (st.meal) {
      const M = st.meal, from = Math.max(t, M.since);
      if (from < te) {
        if (M.since >= t && watching) ev.push({ type: 'mealStart', food: M.kind });
        const k = st.ill && st.ill.kind === 'tummy' ? 0.5 : 1;   // a sore tummy: she eats little
        const can = BOWL.eat * (te - from) / MIN, room = Math.max(0, BOWL.stop - N.food) / k;
        const eat = Math.min(can, st.bowl.amt, room);
        st.bowl.amt = Math.round((st.bowl.amt - eat) * 1e6) / 1e6;
        N.food = Math.min(100, N.food + eat * k);
        M.gain = Math.round(Math.min(100, M.gain + eat * k) * 1e6) / 1e6;
        if (st.bowl.amt <= 0.5) st.bowl = null;
        if (eat < can - 1e-9 || !st.bowl) endMeal(st, from + Math.round(eat / BOWL.eat * MIN), watching, ev);
      }
      return;
    }
    if (!st.drink && st.dish > 0.5 && N.water < DISH.thirsty) {
      st.drink = { since: t, gain: 0, w0: N.water };
      if (watching) ev.push({ type: 'drinkStart' });
    }
    if (st.drink) {
      const R = st.drink, from = Math.max(t, R.since);
      if (from >= te) return;
      const can = DISH.rate * (te - from) / 1000, sip = Math.min(can, st.dish, DISH.sip - R.gain, 100 - N.water);
      st.dish = Math.max(0, Math.round((st.dish - sip) * 1e6) / 1e6);
      N.water = Math.min(100, N.water + sip);
      R.gain = Math.round(Math.min(DISH.sip, R.gain + sip) * 1e6) / 1e6;
      if (sip < can - 1e-9) endDrink(st, from + Math.round(sip / DISH.rate * 1000), watching, ev);
    }
  }
  // the pour (act 'feed'): does she hear it? At home (not out, not in the garden): awake and not full (her favourite:
  // always), or asleep and hungry (the rustle wakes her with BOWL.wakeP). Then she comes and eats after a short walk.
  function pour(st, kind, t, ev) {
    const N = st.needs, fav = kind === st.traits.favFood;
    if (st.meal) endMeal(st, t, true, ev);   // a refill while she was finishing the last bits
    st.bowl = { kind, amt: FOODS[kind].gain, at: t, wait: 0 };
    // the routine: one logged pour per meal (a second bowl within 45 min is the same meal)
    const hk = hourKey(hourOf(t)), dk = dkey(t), last = st.mealLog[st.mealLog.length - 1];
    const since = last ? (keyNo(dk) - keyNo(last[1])) * 24 + hk - last[0] : Infinity;
    if (!(since >= 0 && since < BOWL.gap)) st.mealLog.push([hk, dk]);
    if (st.mealLog.length > BOWL.log) st.mealLog.splice(0, st.mealLog.length - BOWL.log);
    let comes = null, woke = false;
    if (!st.out && !st.yard && !(st.scared > t)) {
      if (st.asleep) {
        if (N.food < BOWL.hearSleep && rnd(st) < BOWL.wakeP) {
          rouse(st, t); woke = true;
          ev.push({ type: 'wake', early: false });
        }
      }
      if (!st.asleep && (N.food < BOWL.hear || fav)) comes = N.food < BOWL.run || fav ? 'run' : 'trot';
    }
    if (comes) {
      st.held = false;
      if (st.drink) endDrink(st, t, true, ev);
      st.meal = { since: t + BOWL.walk[comes], kind, gain: 0, f0: N.food };
    }
    ev.push({ type: 'poured', food: kind, comes, woke });
  }
  function getIll(st, kind, t, ev, watching) {
    if (st.ill) return;
    st.ill = { kind, since: t };
    st.acc = { fleas: 0, tummy: 0, cold: 0 };
    if (st.out && kind === 'cold') comeBack(st, t, ev, false, watching);
    if (st.yard && kind === 'cold' && !st.yard.tree) leaveYard(st, ev, 'house');
    ev.push({ type: 'ill', kind });
  }
  function cure(st, by, ev, extra) {
    const kind = st.ill.kind;
    st.ill = null; st.acc = { fleas: 0, tummy: 0, cold: 0 };
    if (kind === 'fleas') st.needs.coat = Math.max(st.needs.coat, 60);   // the flea comb: no flea loop
    ev.push(Object.assign({ type: 'cured', kind, by }, extra || {}));
  }
  // she comes home (letIn or by herself); rain: from the garden, because it began to rain. After a walk she always acts
  // starving (begs: true, user's wish 2026-11-17: she had snacks at the neighbours', but "dělá, že celé dny nejedla"),
  // but only when the player sees her come (watching): back during a long absence she begged to nobody
  // why: 'rain' (back { rain: true }) | 'cold' (a real frost, back { cold: true }) | false
  function comeBack(st, t, ev, why, watching, live = watching) {
    const d = t - st.out.since, walk = st.out.walk, flap = walk && !st.out.byPlayer;   // a walk she began by herself: through the cat flap
    st.out = null; st.acc.cold = 0;
    rouse(st, t);   // out, her sleep plan did not run and her old nap moment passed: the next nap is planned from now
    const e = { type: 'back', minutes: Math.round(d / MIN), walk, flap, postcard: null, present: null, begs: walk && !!watching };
    if (why === 'rain') e.rain = true; else if (why === 'cold') e.cold = true;
    if (walk) {
      // a walk (toulka): a postcard 60 %, a dárek 20 %, nothing 20 %
      if (d > st.walkMax) st.walkMax = d;
      const r = rnd(st);
      if (r < 0.6) { e.postcard = postcardAt(st.seed, st.postcards.length); st.postcards.push({ id: e.postcard, t }); }
      else if (r < 0.8) e.present = givePresent(st);
      st.mem.today.walk = true;
    }
    ev.push(e);
    if (walk) find(st, 'walk', t, ev);
    // a catch (SPEC §14.3), only when the player sees her come: a keyed draw from the moment (never st.n), never a dead animal
    if (walk && live && rndSeed(st.seed, Math.floor(t / 1000), 17) < CATCH.p) {
      const kind = rndSeed(st.seed, Math.floor(t / 1000), 18) < CATCH.mouse ? 'mouse' : 'cricket';
      st.catch = { kind, at: t, until: t + CATCH.ms };
      ev.push({ type: 'catch', kind });
    }
  }
  // the n-th postcard: each round of 42 is a new seeded shuffle, so no card repeats before all were collected
  function postcardAt(seed, n) {
    const shuffle = round => {
      const a = [];
      for (let i = 0; i < POSTCARDS; i++) a.push(i);
      for (let i = POSTCARDS - 1; i > 0; i--) { const j = Math.floor(rndSeed(seed, round * 64 + i, 11) * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; }
      return a;
    };
    const round = Math.floor(n / POSTCARDS), a = shuffle(round);
    // a new round never starts with the card that ended the last one (swapping 0 and 1 keeps a round's last card)
    if (round > 0 && a[0] === shuffle(round - 1)[POSTCARDS - 1]) { const x = a[0]; a[0] = a[1]; a[1] = x; }
    return a[n % POSTCARDS];
  }
  function givePresent(st) {
    const k = Object.keys(PRESENTS)[Math.floor(rnd(st) * 3)];
    st.presents[k] = Math.min(CMAX, (st.presents[k] || 0) + 1);
    return k;
  }
  const bedCount = st => (st.lvl >= 3 ? 6 : 4);
  const bedSleeps = ms => { const m = new Date(ms).getMonth(); return m === 11 || m <= 1; };   // Dec–Feb
  // the end of a local day: every bed watered that day (or rained on) grows one day, never in Dec–Feb
  // it rained on the beds that local day: with real data for any of its hours 6–20, a rainy (or stormy) one of those;
  // else the seeded day's weather (the same all day)
  function rainedOn(st, y, m, d) {
    let real = false;
    for (let h = 6; h <= 20; h++) {
      const ms = new Date(y, m, d, h).getTime();
      if (wxIdx(st, ms) < 0) continue;
      real = true;
      if (weather(ms, st) === 'rain') return true;
    }
    return !real && weather(new Date(y, m, d, 12).getTime(), st) === 'rain';
  }
  function growBeds(st, key, ev) {
    const y = Math.floor(key / 10000), m = Math.floor(key / 100) % 100 - 1, d = key % 100;
    if (m === 11 || m <= 1) return;
    const rained = rainedOn(st, y, m, d);
    st.beds.forEach((b, i) => {
      if (!b || b.days >= CROPS[b.crop].days || !(b.watered === key || rained)) return;
      b.days++;
      if (b.days >= CROPS[b.crop].days) ev.push({ type: 'ripe', bed: i, crop: b.crop });
    });
  }
  function leaveYard(st, ev, type) {
    st.yard = null;
    st.jealous = null;   // she saw the visitor in the garden; inside (or out on a walk) it passes without a dip
    if (st.visit && st.visit.act && st.visit.act.with) apart(st, st.t, true, ev);   // the visitor goes on alone
    if (type) ev.push({ type });
  }
  // one step in the garden with the player
  function gardenStep(st, t, dt, night, ev) {
    const Y = st.yard, N = st.needs, h = dt / HOUR, w = weather(t, st);
    if (Y.tree) {
      if (t + dt - Y.tree.since >= GARDEN.treeMax * MIN) { Y.tree = null; ev.push({ type: 'climbDown', by: 'self' }); }
      return;
    }
    if (w === 'rain') {
      // the rain soaks her also when she is wet from the can (that was only a little water)
      if (!(st.wet > t) || st.wet === st.tease.splash) { N.coat = Math.max(0, N.coat - 10); ev.push({ type: 'wet' }); }
      st.wet = t + GARDEN.wetFor * MIN;
      N.coat = Math.max(0, N.coat - GARDEN.rainCoat * h);
      if (st.lap) leaveLap(st, t, 'rain', ev);
      return;
    }
    if (w === 'snow' && !Y.snow) { Y.snow = true; ev.push({ type: 'snowPaws' }); }
    if (st.asleep || st.lap || night) return;
    const feeder = st.furniture.birdFeeder ? 1.5 : 1;   // birds at the feeder: more feathers, more fun
    if (feeder > 1) N.fun = Math.min(100, N.fun + 2 * h);
    if (rnd(st) < 1 - Math.exp(-GARDEN.present * feeder * h)) ev.push({ type: 'present', item: givePresent(st) });
    else if (N.energy > 30 && w !== 'snow' && !st.held && rnd(st) < 1 - Math.exp(-GARDEN.tree * h)) {
      Y.tree = { since: t, calls: 0 }; ev.push({ type: 'climbStuck' });
      if (st.visit && st.visit.act && st.visit.act.with) apart(st, t, true, ev);   // up the tree: the visitor goes on alone
    }
  }

  /* --- time --- */
  function endDay(st, ev) {
    const D = st.day;
    growBeds(st, D.key, ev);
    if (D.ms < 4 * HOUR) return;                 // too little of the day was simulated to judge it
    const food = D.food / D.ms, md = D.mood / D.ms;
    const w = st.weight;
    let dw = 0;
    if (food < 30) dw = -0.08;                                    // hungry: thinner
    else if (w < TARGET_W && food >= 45) dw = Math.min(0.05, TARGET_W - w);   // a thin cat recovers with ordinary care
    else if (food > 70 && w < FED_W) dw = Math.min(0.03, FED_W - w);          // well fed: a little heavier, up to 4.5
    else if (w > FED_W && D.treats <= 8) dw = -Math.min(0.02, w - FED_W);     // back from chubby without the treats
    if (D.treats > 8) dw += 0.04;                                 // too many treats: chubby (up to 5.6)
    const w0 = st.weight;
    st.weight = r2(clamp(st.weight + dw, 3.0, 5.6));
    ev.push({ type: 'weighed', kg: st.weight, delta: r2(st.weight - w0) });
    find(st, 'weight', st.t, ev);
    if (md >= 30) addBond(st, 5, ev); else if (md < -30) addBond(st, -5, ev);
    // a cold: 5 % a winter day when she was very tired (energy < 20)
    const [y, m, d] = [Math.floor(D.key / 10000), Math.floor(D.key / 100) % 100 - 1, D.key % 100];
    if ((m === 11 || m <= 1) && D.minE < 20 && rndDay(st, dayNo(y, m, d), 3) < 0.05) getIll(st, 'cold', st.t, ev);
  }
  function newDay(st, t, ev) {
    endDay(st, ev);
    st.day = freshDay(t);
    st.mem = { today: freshMem(), prev: st.mem.today };   // a night across midnight still dreams of the day before
    litterDay(st, t, ev);
    const age = birthdayAge(st.born, t), y = new Date(t).getFullYear();
    if (age && st.bday < y) { st.bday = y; addBond(st, 10, ev); ev.push({ type: 'birthday', age }); }
  }
  // a storm (real data covering t: its storm hours, any month; else May–Aug afternoons, seeded per day) or the Silvestr
  // fireworks inside [t, t + dt)
  function scareAt(st, t, dt) {
    const [y, m, d] = ymd(t);
    if (wxIdx(st, t) >= 0) { if (wxThunder(st, t, dt)) return 'storm'; }
    else { const at = stormAt(st.seed, y, m, d); if (at && at >= t && at < t + dt) return 'storm'; }
    if (m === 11 && d === 31) { const at = new Date(y, 11, 31, 23, 50).getTime(); if (at >= t && at < t + dt) return 'fireworks'; }
    return null;
  }
  /* --- a cat's sleep (user's wish 2026-11-17; SLEEP) --- */
  // inverse sampling of a hazard that changes with the hour: the first moment after `from` when `need` (an exponential
  // draw) is used up; rate(x, hour) is constant within 5-minute pieces; null when nothing comes before `max`
  function hazardAt(from, max, need, rate) {
    for (let x = from; x < max;) {
      const d = new Date(x), next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
      const seg = Math.max(1, Math.min(5 * MIN, next - x, max - x)), r = rate(x, d.getHours());
      if (r > 0 && need <= r * seg / HOUR) return x + Math.round(need / r * HOUR);
      need -= r * seg / HOUR; x += seg;
    }
    return null;
  }
  const expDraw = (st, t, salt) => -Math.log(1 - rndSeed(st.seed, Math.floor(t / 1000), salt));
  const sleepRate = (h, e) => {
    if (nightHour(h)) return SLEEP.rate[h];
    let k = e > SLEEP.rested[0] ? SLEEP.rested[1] : 1;
    for (const [lo, f] of SLEEP.tired) if (e < lo) { k = f; break; }
    return SLEEP.rate[h] * k;
  };
  // when she dozes off next, planned when she wakes at t: at least 45 min later (a new cat 2 h after adoption), then by the
  // hourly rate and her energy as it will fall meanwhile
  function napPlan(st, t) {
    const from = Math.max(t + SLEEP.gap * MIN, st.born + SLEEP.born * MIN), e0 = st.needs.energy;
    const at = hazardAt(from, from + 30 * HOUR, expDraw(st, t, 61), (x, h) => sleepRate(h, e0 - RATE.energy[0] * (x - t) / HOUR));
    return at === null ? from + 30 * HOUR : at;
  }
  // the end of a night's sleep that began at s: the morning wake (6:00 + 0–40 min; her wakesEarly quirk 5:00 + 0–20 min,
  // unless `late`), or before it a night stroll (rare: 0.07 an hour from 23 to 4, twice that when hungry or thirsty)
  function nightWake(st, s, late) {
    const d = new Date(s), early = !late && st.traits.quirk === 'wakesEarly', W = early ? SLEEP.early : SLEEP.morning;
    const w = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (d.getHours() < 12 ? 0 : 1), W[0]).getTime() +
      Math.floor(rndSeed(st.seed, Math.floor(s / 1000), late ? 66 : 62) * W[1]) * MIN;
    if (late) return Math.max(w, s + MIN);
    const k = st.needs.food < 40 || st.needs.water < 40 ? SLEEP.strollHungry : 1;
    const walk = hazardAt(s + SLEEP.strollAfter * MIN, w, expDraw(st, s, 63), (x, h) => (h >= SLEEP.strollFrom || h < SLEEP.strollTo ? SLEEP.stroll * k : 0));
    return walk === null ? Math.max(w, s + MIN) : walk;
  }
  // the end of a sleep that begins at t: the night (until the morning or a stroll) or a nap of 30–90 min (+30 when tired;
  // very tired until her energy is about 75)
  function sleepEnd(st, t) {
    if (nightHour(new Date(t).getHours())) return nightWake(st, t, false);
    const e = st.needs.energy, u = rndSeed(st.seed, Math.floor(t / 1000), 64);
    let len = SLEEP.nap[0] + u * (SLEEP.nap[1] - SLEEP.nap[0]) + (e < 40 ? SLEEP.napTired : 0);
    if (e < 25) len = Math.max(len, (SLEEP.napUp - e) / RATE.energy[1] * 60);
    return t + Math.round(len) * MIN;
  }
  // a daytime nap (not a night's sleep): she fell asleep outside the night hours
  const napping = st => st.asleep && !nightHour(new Date(st.sleepAt).getHours());
  // she wakes up at t (any reason); strollUntil: a night stroll, after which she goes back to sleep
  function rouse(st, t, strollUntil) {
    st.asleep = false; st.wokeAt = t; st.wakeAt = 0;
    st.stroll = strollUntil || 0;
    st.napAt = strollUntil || napPlan(st, t);
  }
  function fallAsleep(st, t) {
    st.asleep = true; st.sleepAt = t; st.napAt = 0; st.stroll = 0; st.callAt = 0;
    st.wakeAt = sleepEnd(st, t);
  }
  // asleep: a wake moment after she fell asleep and nothing else; awake: a nap moment at least 45 min after she woke (or
  // the end of her night stroll). A plan that does not fit (states made by hand, older saves) is made again from st.t
  function ensurePlan(st) {
    if (st.asleep) {
      st.napAt = 0; st.stroll = 0; st.callAt = 0;
      if (!(st.wakeAt > st.sleepAt)) st.wakeAt = sleepEnd(st, st.t);
    } else {
      st.wakeAt = 0;
      if (!st.napAt || (st.stroll ? st.napAt !== st.stroll : st.napAt < st.wokeAt + SLEEP.gap * MIN)) { st.stroll = 0; st.napAt = napPlan(st, st.t); }
    }
  }
  // the next planned moment after t (advance() ends a step there; also the end of a doze on the lap)
  // (a hide and a catch do not split steps, SPEC §14: the split would move every later draw of a watched advance; the
  // UI advances at their `until`, and the step that reaches it ends them)
  function nextMoment(st, t) {
    let m = Infinity;
    const doze = st.lap && st.lap.doze ? st.lap.dozeAt + dozeLen(st, st.lap) : 0;   // the end of a doze on the lap
    for (const x of [st.asleep ? st.wakeAt : st.napAt, st.callAt, doze]) if (x > t && x < m) m = x;
    return m;
  }
  // the sleep part of a step at t (not out, not on the lap)
  function sleepStep(st, t, watching, ev) {
    const N = st.needs, hr = new Date(t).getHours();
    ensurePlan(st);
    if (st.asleep) {
      if (t >= st.wakeAt) {
        const nap = napping(st);
        if (nap && nightHour(hr)) { st.sleepAt = t; st.wakeAt = nightWake(st, t, false); return; }   // a nap ran into the night
        if (!nap && nightHour(hr)) {   // a night stroll: awake 20–40 min, then back to sleep
          const len = SLEEP.strollLen[0] + Math.floor(rndSeed(st.seed, Math.floor(t / 1000), 65) * (SLEEP.strollLen[1] - SLEEP.strollLen[0] + 1));
          rouse(st, t, t + len * MIN);
          if (watching) ev.push({ type: 'wake', early: false, stroll: true });
          return;
        }
        const early = !nap && hr === 5 && st.traits.quirk === 'wakesEarly';
        if (early && N.energy < 60) { st.wakeAt = nightWake(st, t, true); return; }   // too tired to wake the house: the usual morning
        rouse(st, t);
        if (early) st.day.early = t;           // "she woke you this morning" counts only after a real early wake
        if (watching) ev.push({ type: 'wake', early });
      } else if (!nightHour(hr) && N.energy >= 40 && (N.food < 15 || N.water < 15)) {   // hungry or thirsty: up
        rouse(st, t);
        if (watching) ev.push({ type: 'wake', early: false });
      }
      return;
    }
    if (st.held || st.scared > t || st.meal || st.drink) return;
    if (!(N.energy < 25 || t >= st.napAt)) return;
    if (mealDue(st, t)) return;   // hungry at a filled bowl: she eats first (bowlStep starts it), then the nap
    if (st.yard && frostAt(st, t)) return;   // a real frost (§12f): no nap in the garden, she waits until she is inside
    // played with just now and she wants fun or love: she stays up a little longer (by day)
    if (N.energy >= 25 && !nightHour(hr) && st.playAt && t - st.playAt < SLEEP.play * MIN && (N.fun < SLEEP.wantLow || N.love < SLEEP.wantLow)) {
      const P = SLEEP.postpone;
      st.napAt = t + (P[0] + Math.floor(rndSeed(st.seed, Math.floor(t / 1000), 67) * (P[1] - P[0] + 1))) * MIN;
      return;
    }
    fallAsleep(st, t);
    // where: her box (only when it stands in a room of the house: always with the box quirk, else for a nap), the sill
    // cushion for a nap, the sun patch for a nap on a clear morning or day, else her bed; a real heat (§12f): neither the
    // sill nor the sun patch (both by the sunny window), her box or her bed
    const ph = dayPhase(t), nap = napping(st), hot = heatAt(st, t);
    const sunny = (ph === 'morning' || ph === 'day') && weather(t, st) === 'clear';
    const place = boxHome(st) && (st.traits.quirk === 'box' || nap) ? 'box' : nap && st.owned.sillCushion && !hot ? 'sill' : sunny && nap && !hot ? 'sun' : 'bed';
    st.sleepPlace = place;
    if (watching) {
      ev.push({ type: 'sleep', place, nap });
      if (place === 'box') seenQuirk(st, 'box', t, ev);
    }
  }
  function step(st, t, dt, helped, watching, ev, seen, live) {
    st.t = t;
    if (dkey(t) !== st.day.key) newDay(st, t, ev);
    const ph = dayPhase(t), night = ph === 'night', N = st.needs, h = dt / HOUR;
    // sleeping and waking (on the lap: dozing, see lapStep)
    if (!st.out && !st.lap) sleepStep(st, t, watching, ev);
    if (st.held && t - st.heldAt >= 5 * MIN) st.held = false;
    bowlStep(st, t, dt, watching, ev);
    // a call she follows later (callSlow): she comes at st.callAt, after her meal; asleep, out, on the lap, held, up the
    // tree or hiding it is forgotten
    if (st.callAt) {
      if (st.asleep || st.out || st.lap || st.held || (st.yard && st.yard.tree) || st.scared > t) st.callAt = 0;
      else if (!st.meal && t + dt >= st.callAt) { st.callAt = 0; if (watching) ev.push({ type: 'come', late: true }); }
    }
    // needs (ill: everything falls 1.5× faster)
    const dozing = !!(st.lap && st.lap.doze), k = st.ill ? 1.5 : 1, rest = night || st.asleep || dozing;
    const fall = (n, r) => { N[n] = clamp(N[n] - r * h * k, 0, 100); };
    fall('food', RATE.food[night ? 1 : 0] * (st.out && st.out.walk ? 0.5 : 1));   // on a walk she snacks at the neighbours'
    fall('water', RATE.water[night ? 1 : 0] * (st.out ? 0.5 : 1) * (heatAt(st, t) ? WX.thirst : 1));   // a real heat (§12f)
    N.energy = clamp(N.energy + (st.asleep || dozing ? RATE.energy[1] * (st.owned.bedDeluxe ? 1.15 : 1) * h : -RATE.energy[0] * h), 0, 100);
    if (st.out) N.fun = clamp(N.fun + 6 * h, 0, 100);
    else if (st.yard && !st.asleep && !st.yard.tree) N.fun = clamp(N.fun + GARDEN.fun * h, 0, 100);   // outside together
    else fall('fun', RATE.fun[rest ? 2 : ph === 'evening' ? 1 : 0] * (st.owned.catTree ? 0.8 : 1));   // the cat tree keeps her busy
    if (!st.lap) fall('love', RATE.love[rest && !st.out ? 1 : 0] * (st.owned.scratcher ? 0.9 : 1));   // on the lap she does not miss anybody
    // the coat: she grooms herself up to 50 unless she is ill or outside
    const groom = st.owned.scratcher ? 60 : 50;   // the škrabadlo: she scratches it (not the armchair) and keeps a nicer coat
    if (!st.out && !st.ill && N.coat <= groom) N.coat = Math.min(groom, N.coat + h);
    else fall('coat', st.yard ? GARDEN.coat : RATE.coat * (st.out ? 2 : 1));
    if (helped) { N.food = Math.max(N.food, HELP_MIN); N.water = Math.max(N.water, HELP_MIN); N.litter = Math.max(N.litter, HELP_MIN); }
    // the litter box, about every 8 hours: only awake and free at home; asleep, on the lap, held or busy at the bowl she
    // goes 15–30 min later; in the garden she digs by a bed instead (the box stays clean); out on a walk: outside
    if (t + dt > st.litterAt) {
      if (!st.out && (st.asleep || st.lap || st.held || st.meal || st.drink || (st.yard && st.yard.tree))) st.litterAt = t + dt + (15 + Math.floor(rnd(st) * 16)) * MIN;
      else {
        if (st.yard) { if (watching) ev.push({ type: 'litter', garden: true }); }
        else if (!st.out) { N.litter = Math.max(0, N.litter - 30); if (watching) ev.push({ type: 'litter' }); }
        st.litterAt = Math.max(st.litterAt, t) + 7 * HOUR + Math.floor(rnd(st) * 2 * HOUR);
      }
    }
    // illnesses (one at a time) and their end after 4 days
    if (st.ill) { if (t + dt - st.ill.since >= 4 * DAY) cure(st, 'time', ev); }
    else {
      const A = st.acc;
      if (N.litter < 15 || N.coat < 15) A.fleas += dt; else if (N.litter >= 30 && N.coat >= 30) A.fleas = Math.max(0, A.fleas - dt / 2);
      if (N.food < 10 || N.water < 10) A.tummy += dt; else if (N.food >= 30 && N.water >= 30) A.tummy = Math.max(0, A.tummy - dt / 2);
      if ((st.out || st.yard) && night && season(t) === 'winter') A.cold += dt;
      if (A.fleas >= 24 * HOUR) getIll(st, 'fleas', t + dt, ev);
      else if (A.tummy >= 12 * HOUR) getIll(st, 'tummy', t + dt, ev);
      else if (A.cold >= 30 * MIN) getIll(st, 'cold', t + dt, ev, watching);
    }
    if (st.lap) lapStep(st, t, dt, night, ev);
    if (st.guest) guestStep(st, t, dt, ev);
    visitStep(st, t, dt, night, watching, ev);
    // jealousy ends by itself 2 min after it began: a small dip (stroking her before that makes it all right);
    // asleep, out, up the tree or back in the house she cannot be stroked for it, so it just passes, without the dip
    if (st.jealous && (st.asleep || st.out || !st.yard || st.yard.tree)) st.jealous = null;
    else if (st.jealous && t + dt >= st.jealous.since + JEALOUS.ok * MIN) {
      N.love = Math.max(0, N.love - JEALOUS.love);
      ev.push({ type: 'jealousEnd', id: st.jealous.id });
      st.jealous = null;
    }
    if (st.yard) { gardenStep(st, t, dt, night, ev); leafStep(st, t, dt, night, watching, ev); }
    // the cat flap: while the player is away she goes on a walk by herself (0.2 per daytime hour; bond Kamarádka, placed in the předsíň)
    else if (!watching && st.furniture.catFlap && st.lvl >= WALK_BOND && !st.out && !st.asleep && !st.lap && !st.ill && !night &&
      rnd(st) < 1 - Math.exp(-0.2 * h)) {
      st.out = { since: t, until: t + 2 * HOUR + Math.floor(rnd(st) * 6 * HOUR), walk: true, byPlayer: false };
      ev.push({ type: 'out', until: st.out.until, walk: true, flap: true });
    }
    // storms and fireworks; coming home by herself
    const s = scareAt(st, t, dt);
    if (s && !st.out) { meet(st, s, t, ev); if (st.yard && s === 'storm' && !st.yard.tree) leaveYard(st, ev, 'house'); }
    // alone in the garden in a real frost (§12f): in after WX.frostAlone minutes at most (back { cold: true })
    const cold = gardenAlone(st) && frostAt(st, t) && t + dt >= Math.min(st.out.until, st.out.since + WX.frostAlone * MIN);
    if (cold) comeBack(st, t + dt, ev, 'cold', watching, live);
    else if (st.out && (t + dt >= st.out.until || N.energy < 25 || (!st.out.byPlayer && night && season(t) === 'winter'))) comeBack(st, t + dt, ev, false, watching, live);
    else if (st.out && !st.out.walk && weather(t, st) === 'rain') comeBack(st, t, ev, 'rain', watching, live);   // alone in the garden: never in the rain
    memStep(st, t, dt, night);
    catchStep(st, t, dt, seen, ev);
    teaseStep(st, t + dt, watching, ev);
    hideStep(st, t, dt, seen, live, ev);
    if (st.off && t >= st.off.until) st.off = null;
    // the day's averages (weight, bond)
    const D = st.day;
    D.ms += dt; D.food += N.food * dt; D.mood += moodValue(st) * dt; D.minE = Math.min(D.minE, N.energy);
    for (const n of Object.keys(N)) N[n] = Math.round(N[n] * 1e6) / 1e6;    // tidy JSON; fine enough for frequent acts
  }
  // teasing at the end of a step (te): the sulk or cross ends at its exact moment; then her payback when it is due, the
  // advance is watching and she is free (else it waits until it lapses)
  function teaseStep(st, te, watching, ev) {
    const T = st.tease;
    if (T.kind && te >= T.until) { ev.push({ type: T.kind === 'sulk' ? 'sulkEnd' : 'crossEnd' }); T.kind = null; T.until = 0; }
    const P = T.pay;
    if (!P) return;
    if (te >= P.at + TEASE.pay.lapse * MIN || T.payDay === dkey(te)) { T.pay = null; return; }
    const free = !st.asleep && !st.out && !st.lap && !st.held && !st.hide && !(st.yard && st.yard.tree) && !(st.scared > te) &&
      !(st.visit && st.visit.act && st.visit.act.with) && !st.jealous && !teasing(st, te) && !longOff(st, te);
    if (te < P.at || !watching || !free) return;
    T.payDay = dkey(te); T.pay = null;
    ev.push({ type: 'payback', kind: st.yard ? 'ambush' : P.kind });   // no kitchen counter in the garden
    find(st, 'payback', te, ev);
  }

  /* --- play and memories (SPEC §14, user's wishes 2026-11-19): hide and seek, dreams, a catch, the leaf pile --- */
  // the room of a hiding spot now, or null (the box: only when it stands in a room of the house)
  function hideRoom(st, spot) {
    if (typeof spot !== 'string' || !Object.prototype.hasOwnProperty.call(HIDE_ROOMS, spot)) return null;
    if (spot !== 'box') return HIDE_ROOMS[spot];
    const B = st.furniture && st.furniture.box;
    return B && B.room !== 'garden' ? B.room : null;
  }
  // where she may hide now: [{ spot, room }]
  function hideSpots(st) {
    return Object.keys(HIDE_ROOMS).map(spot => ({ spot, room: hideRoom(st, spot) })).filter(s => s.room);
  }
  // a hide goes on: at home, awake, not on the lap or in the arms, not frightened, not at the bowls
  const hideStays = (st, x) => free(st, x) && !st.meal && !st.drink;
  // she may start to hide at x (watching): at home for a day already (a new cat settles in first), free at home, by day, in a good mood, nothing else going on, nothing due
  // during the hide (a nap, the litter box, a meal, a drink), at most HIDE.max a day and HIDE.gap minutes apart
  function hideCan(st, x) {
    const N = st.needs, H = st.hides, h = new Date(x).getHours();
    return !st.hide && x - st.born >= HIDE.home * HOUR && hideStays(st, x) && h >= HIDE.from && h < HIDE.to && !st.ill && !teasing(st, x) && !longOff(st, x) &&
      !st.jealous && !st.visit && !st.guest && !st.catch && !st.callAt && !st.tease.pay && N.energy >= HIDE.energy && moodValue(st) >= 10 &&
      !(st.bowl && wantsMeal(st, x)) && !(st.dish > 0.5 && N.water < DISH.thirsty) &&
      st.napAt > x + HIDE.len && st.litterAt > x + HIDE.len &&
      !(H.key === dkey(x) && H.n >= HIDE.max) && !(H.at && x >= H.at && x - H.at < HIDE.gap * MIN);
  }
  // the next moment in (t, t + 10 min] at which a hide may start: one keyed chance per 10-minute slot of the clock
  function hideNext(st, t) {
    const S = HIDE.slot * MIN, s0 = Math.floor(t / S);
    for (let s = s0; s <= s0 + 1; s++) {
      if (rndSeed(st.seed, s, 12) >= HIDE.p) continue;
      const m = s * S + Math.floor(rndSeed(st.seed, s, 13) * S);
      if (m > t) return m;
    }
    return 0;
  }
  // the end of a step (te): a hide ends (from 150 s on: she jumps out; or something took her out), or one starts when a
  // slot's moment lies in (t, te] (watching only; it begins at te, when the UI hears of it, and lasts HIDE.len from there)
  function hideStep(st, t, dt, seen, live, ev) {
    const te = t + dt, H = st.hide;
    if (H) {
      if (!seen) { st.hide = null; return; }
      if (!hideStays(st, te)) { st.hide = null; ev.push({ type: 'unhide', spot: H.spot, by: 'self' }); return; }
      if (te >= H.until) { st.hide = null; st.needs.fun = Math.min(100, st.needs.fun + HIDE.boo); ev.push({ type: 'unhide', spot: H.spot, boo: true }); }
      return;
    }
    if (!live) return;
    const m = hideNext(st, t);
    if (!m || m > te || !hideCan(st, te)) return;
    const spots = hideSpots(st), s = spots[Math.floor(rndSeed(st.seed, Math.floor(m / (HIDE.slot * MIN)), 14) * spots.length)], key = dkey(te);
    st.hides = { key, n: (st.hides.key === key ? st.hides.n : 0) + 1, at: te };
    st.hide = { spot: s.spot, room: s.room, since: te, until: te + HIDE.len };
    ev.push({ type: 'hide', spot: s.spot, room: s.room });
  }
  // the hide ends because of the player (an action, a minigame)
  function unhide(st, by, ev) {
    ev.push({ type: 'unhide', spot: st.hide.spot, by });
    st.hide = null;
  }
  // Schovávaná (the minigame): the score from the rounds she was found in and the seconds it took altogether
  function hideScore(found, secs) {
    const f = typeof found === 'number' && Number.isFinite(found) ? Math.floor(clamp(found, 0, 20)) : 0;
    const s = typeof secs === 'number' && Number.isFinite(secs) ? clamp(secs, 0, 3600) : 3600;
    return Math.max(f, f * 3 - Math.floor(s / 10));
  }
  // her memories of the step (also while nobody watches): minutes at the bird feeder in the garden (with the player or
  // alone; awake, by day, not in the rain, not up the tree), the neighbour cats she knows about
  function memStep(st, t, dt, night) {
    const M = st.mem.today;
    if (st.furniture.birdFeeder && (st.yard ? !st.yard.tree : gardenAlone(st)) && !st.asleep && !night && weather(t, st) !== 'rain')
      M.birds = Math.min(MEM.birds, Math.round((M.birds + dt / MIN) * 1000) / 1000);
    if (perceives(st) && M.cats.length < MEM.cats && !M.cats.includes(st.visit.id)) M.cats.push(st.visit.id);
  }
  // a toy she played with (the act, a toy minigame, the feather for two)
  function memToy(st, toy) {
    const M = st.mem.today;
    M.toy = toy;
    if ((TOYS[toy].base || toy) === st.traits.toy) M.fav = true;
  }
  // what she dreams of at t (pure): null when she is awake; asleep or dozing on the lap { kind, id? }: a weighted keyed
  // pick from today's and yesterday's memories (yesterday half), always a little 'mouse' and 'food'; the same for a
  // 15-minute slot of the sleep (from when it began), and a slot repeats the one before only when nothing else fits
  function dream(st, t) {
    if (!st || typeof st !== 'object' || !st.mem || !st.traits) return null;
    const x = typeof t === 'number' && Number.isFinite(t) ? t : st.t;
    const from = st.asleep ? st.sleepAt || st.t : st.lap && st.lap.doze ? st.lap.dozeAt || st.t : 0;
    if (!from) return null;
    const C = [], add = (kind, w, id) => C.push(id ? { kind, w, id } : { kind, w });
    const base = toy => (Object.prototype.hasOwnProperty.call(TOYS, toy) ? TOYS[toy].base || toy : toy);
    for (const [M, k] of [[st.mem.today, 1], [st.mem.prev, 0.5]]) {
      if (!M) continue;
      if (M.birds >= MEM.bird) add('bird', k * (1 + Math.min(2, M.birds / 60)));
      for (const c of M.cats || []) add('cat', k * 1.2, c);
      const favToy = M.toy && base(M.toy) === st.traits.toy;
      if (M.toy) add('toy', k * (M.fav && favToy ? 2 : 1), M.toy);
      if (M.fav && !favToy) add('toy', k * 2, st.traits.toy);
      if (M.walk) add('walk', k * 2);
      if (M.food) add('food', k * 1.5, M.food);
    }
    add('mouse', 0.5); add('food', 0.3);
    const pick = (s, salt) => {
      let r = rndSeed(st.seed, Math.floor(from / 1000) + s * 7919, salt) * C.reduce((a, c) => a + c.w, 0);
      for (const c of C) { if (r < c.w) return c; r -= c.w; }
      return C[C.length - 1];
    };
    const s = Math.max(0, Math.floor((x - from) / (MEM.slot * MIN)));
    let d = pick(s, 15);
    if (s > 0) { const p = pick(s - 1, 15); if (p.kind === d.kind && p.id === d.id) d = pick(s, 16); }
    return d.id ? { kind: d.kind, id: d.id } : { kind: d.kind };
  }
  // the leaf pile stands in the garden at t: in autumn, unless it was scattered that day (raked up again by the next one)
  function leafPile(st, t) {
    const x = typeof t === 'number' && Number.isFinite(t) ? t : st.t;
    return season(x) === 'autumn' && !(st.leaves && dkey(st.leaves) === dkey(x));
  }
  function leafJump(st, t, self, ev) {
    st.leaves = t;
    st.needs.fun = Math.min(100, st.needs.fun + LEAF.fun);
    ev.push({ type: 'leafJump', self });
  }
  // in the garden with the player (watching): she jumps into a whole pile by herself, a keyed chance per 10-minute slot
  function leafStep(st, t, dt, night, watching, ev) {
    const Y = st.yard;
    if (!Y || !watching || Y.tree || st.asleep || st.lap || st.held || night || !leafPile(st, t) || weather(t, st) === 'rain') return;
    const S = LEAF.slot * MIN, s0 = Math.floor(t / S);
    for (let s = s0; s <= s0 + 1; s++) {
      if (rndSeed(st.seed, s, 19) >= LEAF.p) continue;
      const m = s * S + Math.floor(rndSeed(st.seed, s, 20) * S);
      if (m > t && m <= t + dt && leafPile(st, m)) { leafJump(st, m, true, ev); return; }
    }
  }
  // the catch waits 120 s (nextMoment ends a step there): unpraised while the player watches, she sulks a little
  function catchStep(st, t, dt, seen, ev) {
    const C = st.catch;
    if (!C || t + dt < C.until) return;
    st.catch = null;
    if (!seen || st.out || st.asleep) return;
    offence(st, C.until, { type: 'catchSnub', kind: C.kind }, false, ev);
  }
  // the clock moved back by now - st.t: every stored moment moves with it, so waiting times stay as long as they were
  function shiftTimes(st, now) {
    const d = now - st.t;
    if (!d) return;
    const mv = v => (v ? v + d : v);
    st.t = now;
    st.sleepAt = mv(st.sleepAt); st.wokeAt = mv(st.wokeAt); st.heldAt = mv(st.heldAt); st.pickAt = mv(st.pickAt);
    st.scared = mv(st.scared); st.litterAt = mv(st.litterAt);
    st.napAt = mv(st.napAt); st.wakeAt = mv(st.wakeAt); st.stroll = mv(st.stroll); st.callAt = mv(st.callAt); st.playAt = mv(st.playAt);
    if (st.bowl) st.bowl = { kind: st.bowl.kind, amt: st.bowl.amt, at: st.bowl.at + d, wait: mv(st.bowl.wait) };
    if (st.meal) st.meal = { since: st.meal.since + d, kind: st.meal.kind, gain: st.meal.gain, f0: st.meal.f0 };
    if (st.drink) st.drink = { since: st.drink.since + d, gain: st.drink.gain, w0: st.drink.w0 };
    if (st.out) st.out = { since: st.out.since + d, until: st.out.until + d, walk: st.out.walk, byPlayer: st.out.byPlayer };
    if (st.yard) st.yard = { since: st.yard.since + d, snow: st.yard.snow, tree: st.yard.tree ? { since: st.yard.tree.since + d, calls: st.yard.tree.calls } : null };
    st.wet = mv(st.wet);
    const today = dkey(now);
    for (const b of st.beds) if (b) { b.sown = Math.min(b.sown, now); if (b.watered > today) b.watered = today; }
    for (const p of st.postcards) p.t = Math.min(p.t, now);
    for (const k of Object.keys(st.records)) st.records[k].t = Math.min(st.records[k].t, now);
    for (const k of Object.keys(st.tricks)) { const r = st.tricks[k]; if (r.learned > now) r.learned = now; if (r.shown > dkey(now + DAY)) r.shown = dkey(now + DAY); }
    // the minigame day and the trick days stay paid: a key in the future is kept (at most tomorrow, then full)
    if (st.earnDay.key > dkey(now + DAY)) st.earnDay = { key: dkey(now + DAY), n: EARN_CAP };
    if (st.train) st.train = { trick: st.train.trick, at: st.train.at + d };
    shiftSocial(st, d, now);
    if (st.ill) st.ill = { kind: st.ill.kind, since: st.ill.since + d };
    if (st.off) st.off = { until: st.off.until + d, turned: st.off.turned };
    if (st.lap) st.lap = { since: st.lap.since + d, annoy: st.lap.annoy, doze: st.lap.doze, pet: mv(st.lap.pet), dozeAt: mv(st.lap.dozeAt) };
    for (const k of Object.keys(st.wantAt)) st.wantAt[k] += d;
    for (const k of Object.keys(st.diary)) st.diary[k] = Math.min(st.diary[k], now);
    st.born = Math.min(st.born, now);
    if (st.day.key > dkey(now)) st.day = freshDay(now);
    else if (st.day.early && (st.day.early + d > now || dkey(st.day.early + d) !== st.day.key)) st.day.early = 0;
    else if (st.day.early) st.day.early += d;
    if (st.day.ms > 0 && st.day.key <= dkey(now)) {   // the replayed time must not count twice in the day's averages
      const D = st.day, k = Math.max(0, D.ms + d) / D.ms;
      D.ms *= k; D.food *= k; D.mood *= k;
    }
    st.bday = Math.min(st.bday, new Date(now).getFullYear());
    if (st.pill > tomorrow(now)) st.pill = tomorrow(now);
    const T = st.tease;   // teasing: every moment moves (st.wet too, so splash === st.wet still holds); the days are clamped
    if (T.kind) T.until += d;
    T.at = mv(T.at); T.warnAt = mv(T.warnAt); T.gainAt = mv(T.gainAt); T.splash = mv(T.splash);
    T.boops = T.boops.map(b => b + d);
    if (T.pay) T.pay = { kind: T.pay.kind, at: T.pay.at + d };
    T.payDay = Math.min(T.payDay, today); T.bondDay = Math.min(T.bondDay, today);
    // play (SPEC §14): a hide and a catch keep their length, the day keys are clamped, the leaf pile stays scattered
    if (st.hide) st.hide = { spot: st.hide.spot, room: st.hide.room, since: st.hide.since + d, until: st.hide.until + d };
    st.hides = { key: Math.min(st.hides.key, today), n: st.hides.n, at: mv(st.hides.at) };
    if (st.catch) st.catch = { kind: st.catch.kind, at: st.catch.at + d, until: st.catch.until + d };
    st.catchDay = Math.min(st.catchDay, today);
    st.leaves = Math.min(st.leaves, now);
  }
  // probe (optional) = { at: [times, ascending], fn(copy) }: fn gets, at each of those times, a copy of her exactly as an
  // advance from the same start to that time alone would leave her (the same steps, then the same tidying at the end).
  // Only for times more than an hour after the start: a shorter advance is "watching" and steps differently. The launcher's
  // forecast uses it to get many times in one pass.
  function advance(st, now, probe) {
    const ev = [];
    if (typeof now !== 'number' || !Number.isFinite(now) || now < T_MIN || now > T_MAX) return { st, events: ev };   // a broken clock
    if (now <= st.t) { shiftTimes(st, now); ensurePlan(st); return { st, events: ev }; }   // the clock moved back: nothing happens
    const start = st.t, gap = now - start, watching = gap <= HOUR, seen = gap <= SEEN;
    if (!seen) { st.hide = null; st.catch = null; }   // nobody looked for her or praised the catch: it just passed
    if (st.lap && gap > LAP.away * MIN) leaveLap(st, start, 'away', ev);   // nobody sat in the chair that long
    if (st.yard && gap > LAP.away * MIN && ((season(start) === 'winter' && dayPhase(start) !== 'day' && dayPhase(start) !== 'morning') || weather(start, st) === 'rain')) {
      // a winter evening or night, or rain: she comes in with the player
      if (st.yard.tree) ev.push({ type: 'climbDown', by: 'self' });
      leaveYard(st, ev, 'house');
    }
    if (st.yard && gap > LAP.away * MIN) {   // the player went away: she stays in the garden alone (health().gardenAlone)
      if (st.yard.tree) ev.push({ type: 'climbDown', by: 'self' });
      leaveYard(st, ev, null);
      if (st.asleep) rouse(st, start);
      const alone = (GARDEN.alone[0] + Math.floor(rnd(st) * (GARDEN.alone[1] - GARDEN.alone[0]))) * MIN;
      // a real frost (§12f): at most WX.frostAlone minutes (the draw is made anyway, so st.n does not depend on it)
      st.out = { since: start, until: start + (frostAt(st, start) ? Math.min(alone, WX.frostAlone * MIN) : alone), walk: false, byPlayer: false };
      ev.push({ type: 'out', until: st.out.until, walk: false, garden: true });
    }
    const end = gap > AWAY ? start + AWAY : now;
    // steps of 10 minutes on a grid from start (so one long advance and many short ones step alike), also ended at her
    // next planned moment (falling asleep, waking, a late come), so the step length never moves those
    let pi = 0;
    for (let t = start; t < end;) {
      let dt = Math.min(start + (Math.floor((t - start) / STEP) + 1) * STEP, end) - t;
      const nx = nextMoment(st, t);
      if (nx < t + dt) dt = nx - t;
      step(st, t, dt, t - start >= HELP, watching, ev, seen, seen && t + dt >= end);
      t += dt;
      // a probe time on the step grid is reached exactly (others are skipped): the end of an advance to it, on a copy
      for (; probe && pi < probe.at.length && probe.at[pi] <= t; pi++) {
        if (probe.at[pi] !== t || t - start <= HOUR) continue;
        const c = JSON.parse(JSON.stringify(st));
        c.t = t; teaseTidy(c); ensurePlan(c); syncWant(c);
        probe.fn(c);
      }
    }
    st.t = end;
    if (gap > AWAY) {
      // paní Nováková had her (and looked after her from 24 h on); the time over 72 h is not simulated
      const days = gap / DAY;
      if (st.out) comeBack(st, end, ev);
      if (st.yard) leaveYard(st, ev, null);
      if (st.visit) endVisit(st, 'time', ev);
      if (st.guest) guestOut(st, end, ev);
      st.jealous = null;
      endDay(st, ev);
      st.t = now; st.day = freshDay(now);
      st.mem = { today: freshMem(), prev: freshMem() };   // days ago: nothing fresh to dream of
      st.needs.food = 40; st.needs.water = 40;
      st.weight = r2(clamp(st.weight - Math.min(0.4, 0.1 * Math.max(0, Math.floor(days) - 3)), 3.0, 5.6));
      st.held = false; st.scared = 0; rouse(st, now); st.callAt = 0;
      st.litterAt = now + 4 * HOUR;
      if (st.ill && now - st.ill.since >= 4 * DAY) cure(st, 'time', ev);
      st.off = { until: now + DAY, turned: false };
      st.tease.kind = null; st.tease.until = 0; st.tease.pay = null;   // the heat cools by itself
      addBond(st, -20, ev);
      ev.push({ type: 'offended', days: Math.floor(days) });
      const y = new Date(now).getFullYear();
      if (st.bday < y && birthdayAge(st.born, now)) { st.bday = y; addBond(st, 10, ev); ev.push({ type: 'birthday', age: birthdayAge(st.born, now) }); }
    }
    teaseTidy(st);
    ensurePlan(st);
    const prev = st.want, w = syncWant(st);
    if (w && w !== prev && watching) ev.push({ type: 'meow', want: w });
    return { st, events: ev };
  }

  /* --- care actions (§6) --- */
  function act(st, action, arg, now) {
    const ev = advance(st, now).events;
    const t = st.t, N = st.needs, name = st.name, nm = moodName(moodValue(st));
    const no = (reason, p) => { ev.push(Object.assign({ type: 'refused' }, typeof reason === 'string' ? refusal(reason, p) : reason)); return { st, events: ev }; };
    if (typeof action !== 'string' || !ACTIONS.includes(action)) return no('cantNow');
    // hide and seek (SPEC §14.1): seek looks for her; any other action about her ends the hide first (she comes out)
    if (action === 'seek' && !st.hide) return no('notHiding');
    if (st.hide && action !== 'seek' && !HIDE_KEEP.includes(action)) unhide(st, action, ev);
    const before = wants(st), beforeV = before ? needs(st)[before] : 100, a = arg && typeof arg === 'object' ? arg : {};
    if (action === 'nameKitten') {   // anywhere, whatever Koxa does (she stays on the lap or up the tree)
      const why = nameKitten(st, a, ev);
      return why ? no(why) : { st, events: ev };
    }
    const home = ['feed', 'water', 'cleanLitter', 'letIn', 'call', 'vacuum', 'sow', 'waterBeds', 'harvest', 'feedVisitor', 'strokeVisitor', 'deletePhoto', 'buy', 'sell', 'place',
      'treatVisitor', 'playVisitor', 'invite', 'photo'];   // invite and photo say themselves why not (Koxa out)
    // up the tree: only calling her, fetching her down, the garden, the shop and the camera
    const TREE_OK = ['call', 'fetchDown', 'vetCure', 'goHouse', 'sow', 'waterBeds', 'harvest', 'buy', 'sell', 'place', 'photo', 'feedVisitor', 'strokeVisitor', 'deletePhoto',
      'treatVisitor', 'playVisitor'];   // not invite: she would stay stuck up there (canInvite says so)
    if (st.yard && st.yard.tree && !TREE_OK.includes(action)) return no('onTree');
    // on the lap: stroking, scratching, a treat from the hand, calling, a photo, patting and a nose tap keep her there;
    // anything else = standing up
    if (st.lap && !['stroke', 'scratch', 'treat', 'call', 'lapOn', 'lapOff', 'photo', 'pat', 'boop', 'praise'].includes(action)) {
      ev.push({ type: 'lapOff', dozing: st.lap.doze }); lapNapDone(st, t); st.lap = null;
    }
    const onLap = !!st.lap, lapK = onLap ? 1.5 : 1;
    // stroking a dozing cat on the lap wakes her (she stays)
    const lapWake = () => { if (onLap && st.lap.doze) { lapNapDone(st, t); ev.push({ type: 'wake', early: false, lap: true }); } };
    const annoy = d => { if (st.lap) st.lap.annoy = Math.min(10, st.lap.annoy + d); };
    // jealous: stroking or scratching her within 2 min makes it all right again
    const soothe = () => { if (!st.jealous) return; N.love = Math.min(100, N.love + JEALOUS.love); ev.push({ type: 'jealousOk', id: st.jealous.id }); st.jealous = null; };
    // alone in the garden she is not away: the player can go out to her (goGarden), or let her in (letIn)
    if (st.out && !home.includes(action) && !(action === 'goGarden' && gardenAlone(st))) return no(gardenAlone(st) ? 'inGarden' : 'outside');
    const wakeUp = () => { if (st.asleep) { rouse(st, t); ev.push({ type: 'wake', early: false }); } };
    const sleeping = () => { if (st.asleep) { boxSeen(st, t, ev); no('asleep'); return true; } return false; };
    // teasing (SPEC §13.3): while she is cross a touch gets a swat (no claws); a sulk is made up by a stroke along the fur,
    // a scratch or a treat while she is awake
    const cross = () => teaseKind(st, t) === 'cross';
    const swat = why => ev.push({ type: 'swat', why });
    const awake0 = !st.asleep;
    const reconcile = by => {
      const T = st.tease;
      if (!awake0 || teaseKind(st, t) !== 'sulk') return;
      T.kind = null; T.until = 0;
      N.love = Math.min(100, N.love + TEASE.love.reconcile);
      const bond = T.bondDay !== dkey(t);
      ev.push({ type: 'reconcile', by, bond });
      if (bond) { T.bondDay = dkey(t); addBond(st, TEASE.bond, ev); }
      find(st, 'reconcile', t, ev);
    };
    const hr = new Date(t).getHours();
    // the player's first thing of the day: "she woke you this morning" only when she really woke early today (her
    // wakesEarly quirk) and this comes within 2 h of that wake
    if (!st.day.acted && !st.out && !st.asleep) {
      st.day.acted = true;
      const E0 = st.day.early;
      if (E0 && t >= E0 && t - E0 <= 2 * HOUR) seenQuirk(st, 'wakesEarly', t, ev);
    }
    const sad = nm === 'sad';
    const useStock = k => { if (--st.stock[k] <= 0) delete st.stock[k]; };
    // training treats (small pieces) count half for the tummy rule and not for the weight
    const giveTreat = (stick, training) => {
      wakeUp();
      if (stick) useStock('stick'); else st.pamlsky -= 1;
      if (training) st.day.ttreats++; else st.day.treats++;
      st.mem.today.food = 'treat';
      N.food = Math.min(100, N.food + (stick ? 3 : 5)); N.love = Math.min(100, N.love + (stick ? 5 : 3));
      ev.push({ type: 'treat', stick });
      if (st.day.treats + st.day.ttreats / 2 > 12) getIll(st, 'tummy', t, ev);
    };
    const trickRec = tr => st.tricks[tr] || (st.tricks[tr] = { progress: 0, learned: 0, shown: 0, miss: 0 });
    const catnip = () => { N.fun = Math.min(100, N.fun + 60); N.energy = Math.max(0, N.energy - 10); ev.push({ type: 'catnip' }); };
    // a belly rub: welcome with her bellyOk chance, else (and always when grumpy) a playful nip
    const belly = () => {
      wakeUp();
      if (nm !== 'grumpy' && rnd(st) < st.traits.bellyOk) {
        N.love = Math.min(100, N.love + 6 * (sad ? 0.5 : 1) * lapK); ev.push({ type: 'purr', region: 'belly' }); annoy(0.5);
        if (inc(st, 'belly') >= 5) find(st, 'belly', t, ev);
      } else { N.love = Math.max(0, N.love - 1); ev.push({ type: 'bite' }); annoy(2); }
    };
    switch (action) {
      case 'feed': {   // fills the bowl; she eats it over time (bowlStep), the need rises only as she eats
        const kind = typeof arg === 'string' && Object.prototype.hasOwnProperty.call(FOODS, arg) ? arg : 'kibble';
        if (st.bowl && st.bowl.amt > BOWL.full) return no('bowlNotEmpty');
        const price = CHARGE_FOOD ? FOODS[kind].price : 0;
        if (price && !(st.stock[kind] > 0) && st.pamlsky < price) return no('foodFunds', { food: kind, price });
        if (price && st.stock[kind] > 0) useStock(kind); else st.pamlsky -= price;
        pour(st, kind, t, ev);
        break;
      }
      case 'water': {   // fills the dish; she drinks by herself in short sessions (bowlStep)
        if (st.dish >= DISH.full) return no('dishFull');
        st.dish = 100;
        // her tap quirk: she jumps up and drinks from the running tap instead (at home, awake, free)
        const tap = st.traits.quirk === 'tap' && free(st, t) && rnd(st) < 0.5;
        ev.push({ type: 'dishFilled', tap });
        if (tap) {
          if (st.drink) endDrink(st, t, true, ev);
          N.water = Math.min(100, N.water + DISH.tap);
          ev.push({ type: 'drank', tap: true });
          seenQuirk(st, 'tap', t, ev);
        }
        break;
      }
      case 'stroke': {
        const region = regionOf(a.region, 'back');
        const dir = a.along === false || a.along === 'against' ? 'against' : a.along === 'sideways' ? 'sideways' : 'along';
        const sp = typeof a.speed === 'number' ? (a.speed < 120 ? 'slow' : a.speed > 900 ? 'fast' : 'good') : ['slow', 'fast'].includes(a.speed) ? a.speed : 'good';
        if (sp === 'slow') break;                // too slow: she does not notice
        if (!st.asleep && cross()) { swat('stroke'); break; }
        const half = sad ? 0.5 : 1;
        if (region === 'belly') { belly(); break; }
        if (st.asleep) { N.love = Math.min(100, N.love + 1); ev.push({ type: 'purr', region, sleeping: true }); boxSeen(st, t, ev); break; }
        lapWake();
        if (sp === 'fast' || dir === 'against') { N.love = Math.max(0, N.love - 1); ev.push({ type: 'earsBack', rough: sp === 'fast' }); annoy(1); break; }
        soothe();
        if (dir === 'sideways') { N.love = Math.min(100, N.love + 1 * half); ev.push({ type: 'tolerate', region }); break; }
        const spot = st.traits.spots.includes(region);
        N.love = Math.min(100, N.love + (spot ? 4 : 2) * half * lapK);
        if (onLap) st.lap.pet = t;
        if (spot || nm === 'happy' || (onLap && nm !== 'sad')) ev.push({ type: 'purr', region });
        else if (nm === 'calm' || rnd(st) < 0.3) ev.push({ type: 'content', region });
        else ev.push({ type: 'tolerate', region });
        if (REGIONS[region].spot) { const c = 'spot_' + region; if (inc(st, c) >= 10 && spot) find(st, c, t, ev); }
        reconcile('stroke');                     // along the fur at a good speed: made up after a sulk
        break;
      }
      case 'scratch': {
        const region = regionOf(a.region, 'head');
        const sec = typeof a.seconds === 'number' && Number.isFinite(a.seconds) ? clamp(a.seconds, 0, 5) : 1;
        if (!st.asleep && cross()) { swat('scratch'); break; }
        if (region === 'belly') { belly(); break; }
        const per = REGIONS[region].scratch ? 4 : 1, half = sad || st.asleep ? 0.5 : 1;
        if (!st.asleep) soothe();
        lapWake(); if (onLap) st.lap.pet = t;
        N.love = Math.min(100, N.love + per * sec * half * lapK);
        ev.push({ type: 'purr', region, sleeping: st.asleep });
        if (st.asleep) boxSeen(st, t, ev);
        if (st.traits.spots.includes(region) && REGIONS[region].scratch) {
          const c = 'spot_' + region; st.cnt[c] = Math.min(CMAX, st.cnt[c] + Math.round(sec));
          if (st.cnt[c] >= 10) find(st, c, t, ev);
        }
        reconcile('scratch');
        break;
      }
      case 'pickUp': {
        if (sleeping()) return { st, events: ev };
        if (cross()) { ev.push({ type: 'wriggle' }); break; }
        if (st.held) break;
        if (moodValue(st) >= 10 && N.energy >= 20 && !(st.off && t < st.off.until && !st.off.turned) && st.scared <= t) {
          st.held = true; st.heldAt = t;
          if (t - st.pickAt >= 10 * MIN) { N.love = Math.min(100, N.love + 5); st.pickAt = t; }
          ev.push({ type: 'held' }, { type: 'purr' });
        } else ev.push({ type: 'wriggle' });
        break;
      }
      case 'putDown': {
        if (!st.held) return no('notHeld');
        st.held = false; st.place = typeof arg === 'string' && arg.length <= 20 ? arg : null;
        ev.push({ type: 'put', place: st.place });
        break;
      }
      case 'play': {
        if (sleeping()) return { st, events: ev };
        if (cross()) { ev.push({ type: 'ignore', reason: 'playCross' }); break; }
        const toy = typeof arg === 'string' && Object.prototype.hasOwnProperty.call(TOYS, arg) ? arg : 'mouse';
        if (TOYS[toy].shop && !st.owned[toy]) return no('toyNotOwned');
        if (N.energy < 10) { ev.push({ type: 'ignore', reason: 'tired' }); break; }
        if (st.scared > t) { ev.push({ type: 'ignore', reason: 'hiding' }); break; }
        if (sad && rnd(st) < 0.5) { ev.push({ type: 'ignore', reason: 'noPlay' }); break; }
        const fav = (TOYS[toy].base || toy) === st.traits.toy;
        let gain = 20 + Math.floor(rnd(st) * 21) + (fav ? 10 : 0) + (TOYS[toy].bonus || 0);
        if (dayPhase(t) === 'evening') gain = Math.round(gain * 1.25);
        N.fun = Math.min(100, N.fun + gain); N.energy = Math.max(0, N.energy - 5);
        ev.push({ type: 'played', toy, gain, fav });
        memToy(st, toy);
        if (fav && inc(st, 'toy') >= 5) find(st, 'toy', t, ev);
        if (st.traits.quirk === 'socks' && rnd(st) < 0.3) seenQuirk(st, 'socks', t, ev);
        break;
      }
      case 'brush': {
        if (sleeping()) return { st, events: ev };
        if (N.coat >= 98 && !(st.ill && st.ill.kind === 'fleas')) return no('combed');
        const fleas = st.ill && st.ill.kind === 'fleas', gain = Math.min(fleas ? 10 : 25, 100 - N.coat);
        N.coat += gain; N.love = Math.min(100, N.love + 1);
        ev.push(fleas ? { type: 'flea' } : { type: 'brushed', gain });
        break;
      }
      case 'cleanLitter': {
        if (N.litter >= 100) return no('litterClean');
        N.litter = 100; ev.push({ type: 'clean' });
        break;
      }
      case 'letOut': {   // toulky: a walk of 2–8 h beyond the garden gate
        if (st.lvl < WALK_BOND) return no('walkBond', { level: WALK_BOND, min: LEVELS[WALK_BOND].min });
        if (st.ill) return no('illStays');
        if (st.yard && st.yard.tree) return no('onTree');
        if (sleeping()) return { st, events: ev };
        st.held = false; leaveYard(st, ev, null);
        st.out = { since: t, until: t + 2 * HOUR + Math.floor(rnd(st) * 6 * HOUR), walk: true, byPlayer: true };
        ev.push({ type: 'out', until: st.out.until, walk: true });
        break;
      }
      case 'goGarden': {
        if (st.yard) break;
        if (gardenAlone(st)) {   // she is out there alone: the player comes to her (the time alone is over)
          st.out = null; rouse(st, t);   // as after comeBack: her next nap is planned from now
          st.yard = { since: t, snow: false, tree: null };
          ev.push({ type: 'garden', weather: weather(t, st), joined: true });
          break;
        }
        if (st.ill && st.ill.kind === 'cold') return no('coldStays');
        if (sleeping()) return { st, events: ev };
        st.held = false;
        st.yard = { since: t, snow: false, tree: null };
        ev.push({ type: 'garden', weather: weather(t, st) });
        gardenStep(st, t, 0, dayPhase(t) === 'night', ev);    // rain or snow at once
        break;
      }
      case 'goHouse': {
        if (!st.yard) return no('notInGarden');
        if (st.yard.tree) return no('onTreeFetch');
        leaveYard(st, ev, 'house');
        break;
      }
      case 'fetchDown': {
        if (!st.yard || !st.yard.tree) return no('notOnTree');
        st.yard.tree = null; N.love = Math.min(100, N.love + 2);
        ev.push({ type: 'climbDown', by: 'fetch' }, { type: 'purr' });
        break;
      }
      case 'sow': {
        const i = a.bed, crop = a.crop;
        if (!Number.isInteger(i) || i < 0 || i >= BEDS) return no('noBed');
        if (i >= bedCount(st)) return no('bedLevel', { level: 3 });
        if (typeof crop !== 'string' || !Object.prototype.hasOwnProperty.call(CROPS, crop)) return no('noSeeds');
        if (bedSleeps(t)) return no('bedsSnow');
        if (st.beds[i]) return no('bedTaken');
        const sp = CHARGE_SEEDS ? CROPS[crop].seed : 0, sk = 'seed_' + crop;
        if (sp && !(st.stock[sk] > 0) && st.pamlsky < sp) return no('seedFunds', { crop, price: sp });
        if (sp && st.stock[sk] > 0) useStock(sk); else st.pamlsky -= sp;
        st.beds[i] = { crop, sown: t, days: 0, watered: 0 };
        ev.push({ type: 'sown', bed: i, crop });
        break;
      }
      case 'waterBeds': {
        if (bedSleeps(t)) return no('bedsSnow');
        const k = dkey(t), todo = st.beds.filter(b => b && b.days < CROPS[b.crop].days);
        if (!todo.length) return no('nothingToWater');
        if (todo.every(b => b.watered === k)) return no('watered');
        for (const b of todo) b.watered = k;
        ev.push({ type: 'watered', n: todo.length });
        break;
      }
      case 'harvest': {
        const i = a.bed, b = Number.isInteger(i) && i >= 0 && i < BEDS ? st.beds[i] : null;
        if (!b) return no('bedEmpty');
        if (b.days < CROPS[b.crop].days) return no('unripe', { crop: b.crop });
        st.beds[i] = null;
        const yld = CROPS[b.crop].yield;
        ev.push({ type: 'harvested', bed: i, crop: b.crop, n: yld });
        if (b.crop === 'catnip' && !st.out && !st.asleep) catnip();
        else st.pantry[b.crop] = Math.min(CMAX, (st.pantry[b.crop] || 0) + yld);
        break;
      }
      case 'catnip': {
        if (!st.pantry.catnip) return no('noCatnip');
        if (sleeping()) return { st, events: ev };
        if (--st.pantry.catnip === 0) delete st.pantry.catnip;
        catnip();
        break;
      }
      case 'lapOn': {
        if (st.lap) break;
        if (sleeping()) return { st, events: ev };
        if (cross()) { st.held = false; ev.push({ type: 'wriggle' }); break; }
        const off = st.off && t < st.off.until, tummy = st.ill && st.ill.kind === 'tummy';
        if (off || tummy || st.scared > t || N.food < 15 || N.water < 15 || moodValue(st) < -30) { st.held = false; ev.push({ type: 'wriggle' }); break; }
        st.held = false;
        st.lap = { since: t, annoy: 0, doze: false, pet: t, dozeAt: 0 };
        ev.push({ type: 'lapOn' });
        if (nm === 'happy' || nm === 'calm') ev.push({ type: 'purr' });
        break;
      }
      case 'lapOff': {
        if (!st.lap) return no('notOnLap');
        ev.push({ type: 'lapOff', dozing: st.lap.doze });
        lapNapDone(st, t); st.lap = null;
        break;
      }
      case 'letIn': {
        if (!st.out) return no('atHome');
        comeBack(st, t, ev, false, true);
        break;
      }
      case 'treat': {   // a pamlsek from the hand, or arg 'stick': a kočičí tyčinka from the stock (love +5)
        const stick = arg === 'stick';
        if (stick ? !(st.stock.stick > 0) : st.pamlsky < 1) return no(stick ? 'noSticks' : 'noTreats');
        giveTreat(stick, !!st.train && t - st.train.at <= TREAT_WINDOW && t >= st.train.at);
        if (st.train) rewardTrick(st, t, ev);       // the treat right after a trick: a training success
        reconcile('treat');                          // a sulk is made up (a cross is not: she eats it and stays cross)
        break;
      }
      case 'buy': {
        const id = typeof arg === 'string' ? arg : a.id, it = typeof id === 'string' && Object.prototype.hasOwnProperty.call(SHOP_BY, id) ? SHOP_BY[id] : null;
        if (!it) return no('notInShop');
        if (st.lvl < it.bond) return no('shopLevel', { level: it.bond });
        if (!it.stock && st.owned[it.id]) return no('owned');
        if (st.pamlsky < it.price) return no('price', { item: it.id, price: it.price });
        st.pamlsky -= it.price;
        if (it.stock) st.stock[it.stock] = Math.min(CMAX, (st.stock[it.stock] || 0) + it.n); else st.owned[it.id] = true;
        ev.push({ type: 'bought', id: it.id, kind: it.kind });
        if (it.install) st.furniture[it.id] = { room: it.room, x: 0.5, y: 0.5 };   // the cat flap: in the předsíň door at once
        break;
      }
      case 'place': {
        const it = typeof a.id === 'string' && Object.prototype.hasOwnProperty.call(SHOP_BY, a.id) ? SHOP_BY[a.id] : null;
        if (!it || !st.owned[it.id]) return no('notOwned');
        if (!it.room) return no('notPlaceable');
        if (!ROOMS.includes(a.room)) return no('noRoom');
        if (it.fixed && a.room !== it.room) return no('fixedRoom', { item: it.id, room: it.room });
        const c = v => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, 0, 1) : 0.5);
        st.furniture[it.id] = { room: a.room, x: c(a.x), y: c(a.y) };
        ev.push({ type: 'placed', id: it.id, room: a.room });
        break;
      }
      case 'sell': {
        const crop = typeof a.crop === 'string' && Object.prototype.hasOwnProperty.call(CROPS, a.crop) ? a.crop : null;
        if (!crop || !(st.pantry[crop] > 0)) return no('notInPantry');
        if (!CROPS[crop].sell) return no('catnipNoSale');
        const n = Math.min(st.pantry[crop], Number.isInteger(a.n) && a.n >= 1 ? a.n : 1), got = n * CROPS[crop].sell;
        st.pantry[crop] -= n; if (!st.pantry[crop]) delete st.pantry[crop];
        st.pamlsky = Math.min(99999, st.pamlsky + got);
        ev.push({ type: 'sold', crop, n, earned: got });
        break;
      }
      case 'train': {
        const tr = typeof a.trick === 'string' && Object.prototype.hasOwnProperty.call(TRICKS, a.trick) ? a.trick : null;
        if (!tr) return no('noTrick');
        if (st.bond < TRICKS[tr].bond) { ev.push({ type: 'trickRefused', trick: tr, reason: 'bond', bond: TRICKS[tr].bond }); break; }
        if (sleeping()) return { st, events: ev };
        const P = trickRec(tr);
        st.train = null;
        if (P.learned) { ev.push({ type: 'trickLearned', trick: tr }); break; }   // nothing to train: the UI suggests showing it
        if (a.cue !== TRICKS[tr].cue) { ev.push({ type: 'perform', trick: tr, ok: false, understood: false }); break; }
        const okp = performs(st, P);
        ev.push(okp ? { type: 'perform', trick: tr, ok: true } : { type: 'perform', trick: tr, ok: false, understood: true, reason: notNowReason(st) });
        if (!okp) break;
        st.train = { trick: tr, at: t };
        if (typeof a.treatAt === 'number' && Number.isFinite(a.treatAt)) {    // the UI tells when the treat came
          if (st.pamlsky < 1) { ev.push({ type: 'trickRefused', trick: tr, reason: 'noTreat' }); break; }
          giveTreat(false, true);
          rewardTrick(st, a.treatAt, ev);
        }
        break;
      }
      case 'invite': {
        const id = typeof arg === 'string' ? arg : a.id, why = inviteWhy(st, id, t);
        if (why) return no(why);
        endVisit(st, 'inside', ev);
        if (st.yard) leaveYard(st, ev, 'house');   // Koxa comes in with the guest (the night is in the living room)
        st.guest = { id, since: t, until: next7(t), slept: false };
        st.invDay = dkey(t);
        ev.push({ type: 'guestIn', id });
        palFound(st, 'sleepover', id, t, ev);
        break;
      }
      case 'feedVisitor': case 'strokeVisitor': case 'photo': case 'deletePhoto': case 'treatVisitor': case 'playVisitor': {
        const why = socialAct(st, action, a, t, ev);
        if (why) return no(why);
        break;
      }
      case 'showTrick': {
        const tr = typeof a.trick === 'string' && Object.prototype.hasOwnProperty.call(TRICKS, a.trick) ? a.trick : null;
        if (!tr) return no('noTrick');
        const P = st.tricks[tr];
        if (!P || !P.learned) { ev.push({ type: 'trickRefused', trick: tr, reason: 'notLearned' }); break; }
        if (sleeping()) return { st, events: ev };
        const okp = performs(st, P);
        ev.push(okp ? { type: 'perform', trick: tr, ok: true, shown: true } : { type: 'perform', trick: tr, ok: false, shown: true, understood: true, reason: notNowReason(st) });
        if (!okp) break;
        const today = dkey(t);
        if (P.shown < today) {   // the first successful show of this trick today: bond +3, 1 pamlsek
          P.shown = today; addBond(st, 3, ev);
          st.pamlsky = Math.min(99999, st.pamlsky + 1); ev.push({ type: 'earned', n: 1, trick: tr });
        }
        break;
      }
      case 'vetCure': {
        if (!st.ill) return no('healthy');
        const paid = Math.min(15, st.pamlsky);
        st.pamlsky -= paid;
        cure(st, 'vet', ev, { paid, short: paid < 15 });
        const tm = new Date(t); tm.setDate(tm.getDate() + 1);
        st.pill = a.won === true ? 0 : dkey(tm.getTime());
        break;
      }
      case 'pill': {
        if (!st.pill) return no('noPill');
        if (dkey(t) < st.pill) return no('pillTomorrow');
        st.pill = 0; N.love = Math.max(0, N.love - 1);
        ev.push({ type: 'pill' });
        break;
      }
      case 'call': {   // user's wish 2026-11-17: whether she comes depends on her mood and the bond (CALL)
        if (st.out) { ev.push({ type: 'ignore', reason: gardenAlone(st) ? 'inGarden' : 'outside' }); break; }
        if (st.asleep) { ev.push({ type: 'ignore', reason: 'asleepCall' }); break; }
        if (st.yard && st.yard.tree) {
          const T = st.yard.tree;
          if (++T.calls >= 3 || rnd(st) < 0.5) { st.yard.tree = null; ev.push({ type: 'climbDown', by: 'call' }); }
          else ev.push({ type: 'ignore', reason: 'scaredDown' });
          break;
        }
        if (cross()) { ev.push({ type: 'ignore', reason: 'crossCall' }); break; }
        if (st.off && t < st.off.until && !st.off.turned) { st.off.turned = true; ev.push({ type: 'turnBack' }); break; }
        if (st.lap || st.held) { ev.push({ type: 'come' }); break; }   // she is with you already
        if (st.meal) {   // eating (or on her way to the bowl): she finishes first, then comes
          const M = st.meal, k = st.ill && st.ill.kind === 'tummy' ? 0.5 : 1;
          const left = Math.min(st.bowl ? st.bowl.amt : 0, Math.max(0, BOWL.stop - N.food) / k);
          st.callAt = Math.round(Math.max(t, M.since) + left / BOWL.eat * MIN) + CALL.after;
          ev.push({ type: 'callSlow', at: st.callAt, meal: true });
          break;
        }
        const lvl = st.lvl, p = nm === 'happy' && lvl >= CALL.lvl ? CALL.happy : Math.min(CALL.max, CALL.base + CALL.perLvl * lvl + (CALL.mood[nm] || 0));
        if (rnd(st) < p) { st.callAt = 0; ev.push({ type: 'come' }); break; }
        if ((nm === 'grumpy' || sad) && rnd(st) < CALL.ignore) {
          st.callAt = 0;
          ev.push({ type: 'ignore', reason: sad ? 'sadCall' : 'deaf' });
          break;
        }
        // she heard it (an ear, the tail) and comes on her own a little later; a second call never makes it later
        const at = t + (CALL.slow[0] + Math.floor(rnd(st) * (CALL.slow[1] - CALL.slow[0] + 1))) * 1000;
        st.callAt = st.callAt > t ? Math.min(st.callAt, at) : at;
        ev.push({ type: 'callSlow', at: st.callAt, meal: false });
        break;
      }
      case 'vacuum': {
        if (st.out) break;                       // she is not here: nothing about her
        wakeUp();
        meet(st, 'vacuum', t, ev);
        break;
      }
      case 'pat': case 'boop': case 'splash': {
        const why = teaseAct(st, action, a, t, nm, ev);
        if (why) return no(why);
        break;
      }
      case 'seek': {   // st.hide is set (checked above): the right spot finds her, a wrong one changes nothing
        const H = st.hide, spot = typeof arg === 'string' ? arg : a.spot;
        if (typeof spot !== 'string' || !Object.prototype.hasOwnProperty.call(HIDE_ROOMS, spot)) return no('noSpot');
        if (spot !== H.spot) { ev.push({ type: 'seekMiss', spot }); break; }
        const ms = t - H.since, quick = ms <= HIDE.quick, F = quick ? HIDE.quickFx : HIDE.found;
        st.hide = null;
        N.love = Math.min(100, N.love + F.love); N.fun = Math.min(100, N.fun + F.fun);
        ev.push({ type: 'seekFound', spot, secs: Math.round(ms / 1000), quick });
        break;
      }
      case 'praise': {   // her catch from a walk: praised (a tap or a stroke while it waits)
        const C = st.catch;
        if (!C) return no('noCatch');
        st.catch = null;
        N.love = Math.min(100, N.love + CATCH.love);
        const bond = st.catchDay !== dkey(t);
        ev.push({ type: 'praised', kind: C.kind, bond });
        if (bond) { st.catchDay = dkey(t); addBond(st, 1, ev); }
        break;
      }
      case 'leafJump': {   // the player taps the leaf pile while she is in the garden with them
        if (!st.yard) return no('notInGarden');
        if (!leafPile(st, t)) return no('noLeaves');
        if (sleeping()) return { st, events: ev };
        if (cross()) { ev.push({ type: 'ignore', reason: 'playCross' }); break; }
        st.held = false;
        leafJump(st, t, false, ev);
        break;
      }
    }
    // a satisfied want (the need was under 40, not just her meal time): bond +1, at most once an hour for each need
    if (before && beforeV < 40 && needs(st)[before] >= 40 && !(t - (st.wantAt[before] || 0) < HOUR)) { st.wantAt[before] = t; addBond(st, 1, ev); }
    bowlCheck(st, t, true, ev);                  // picked up, on the lap, out…: she leaves the bowl
    // the player plays with her or cuddles her (an awake cat): her next nap may wait (SLEEP.play)
    if (awake0 && !st.asleep && ['stroke', 'scratch', 'play', 'pat', 'pickUp', 'lapOn', 'train', 'showTrick', 'catnip', 'brush', 'playVisitor', 'praise', 'leafJump'].includes(action)) st.playAt = t;
    if (st.callAt && (st.asleep || st.out || st.lap || st.held)) st.callAt = 0;
    ensurePlan(st);
    syncWant(st);
    teaseTidy(st);
    return { st, events: ev };
  }

  /* --- Škádlení: teasing out of love (SPEC §13.3) --- */
  // pat / boop / splash; returns a refusal (refusal()) or null. No rnd(st): the payback draws are keyed on the moment (salts 53–55)
  function teaseAct(st, action, a, t, nm, ev) {
    const T = st.tease, N = st.needs, today = dkey(t), lap = !!st.lap;
    const touch = () => { T.heat = Math.round(heatNow(T, t) * 1e6) / 1e6; T.at = t; };   // heat brought up to date at t
    const addHeat = k => { T.heat = Math.min(TEASE.heatMax, T.heat + k); };
    const love = d => { N.love = clamp(N.love + d, 0, 100); };
    if (action === 'boop') {
      if (st.asleep || (st.lap && st.lap.doze)) return refusal('asleep');
      if (teaseKind(st, t) === 'cross') { ev.push({ type: 'swat', why: 'boop' }); return null; }
      T.boops = T.boops.filter(b => b > t - TEASE.boopWin);
      T.boops.push(t); touch();
      if (T.boops.length >= TEASE.boopN) { T.boops = []; addHeat(TEASE.heat.boop); offence(st, t, { type: 'boop', swat: true }, true, ev); }
      else { ev.push({ type: 'boop' }); find(st, 'boop', t, ev); }   // she squints, sneezes, shakes her head
      return null;
    }
    if (action === 'splash') {
      if (!st.yard) return refusal('splashGarden');
      if (season(t) === 'winter') return refusal('splashWinter');
      if (st.asleep) return refusal('splashAsleep');
      st.held = false;
      const w = t + TEASE.wetMin * MIN;
      if (w > (st.wet > t ? st.wet : 0)) { st.wet = w; T.splash = w; }   // else she is wetter from the rain already
      love(TEASE.love.splash); touch(); addHeat(TEASE.heat.splash);
      offence(st, t, { type: 'splash' }, true, ev);
      find(st, 'splash', t, ev);
      return null;
    }
    // pat: { region, n, ms, cv, eating }
    const region = regionOf(a.region, 'head');
    const n = Number.isInteger(a.n) ? clamp(a.n, 1, 999) : 1;
    const ms = typeof a.ms === 'number' && Number.isFinite(a.ms) ? clamp(a.ms, 0, 5000) : 0;
    const cv = typeof a.cv === 'number' && Number.isFinite(a.cv) ? clamp(a.cv, 0, 3) : 0;
    const eating = a.eating === true || !!(st.meal && st.meal.since <= t);   // the UI's flag, or a meal in progress
    const pat = (stage, x) => { ev.push(Object.assign({ type: 'pat', region, stage }, x || {}, eating ? { eating: true } : {})); };
    // asleep (or dozing on the lap): a short run changes nothing (the UI flicks an ear); the TEASE.wakeN-th tap of a run
    // wakes her (user's wish 2026-11-19: "she will hiss, but she will be awake"); she never blows up asleep
    if (st.asleep || (st.lap && st.lap.doze)) {
      if (n < TEASE.wakeN) { pat('tolerate', { sleeping: true }); return null; }
      if (lap) leaveLap(st, t, 'annoyed', ev);
      else { rouse(st, t); ev.push({ type: 'wake', early: false, rude: true }); }
      love(TEASE.love.woken); T.warnAt = 0; touch();
      ev.push({ type: 'woken', lap });
      return null;
    }
    if (n <= 2 || t - T.at > TEASE.runGap) T.warnAt = 0;   // a fresh run
    touch();
    // a path at its warning tap: warn; the outcome only when the run goes on 1.8 s after the warning
    const warn = outcome => {
      if (!T.warnAt) { T.warnAt = t; pat('warn'); } else if (t - T.warnAt >= TEASE.warnMs) outcome(); else pat('warn');
    };
    const blowUp = why => {
      const eat = why === 'eat';
      love(eat ? TEASE.love.eat : TEASE.love.blowUp); addHeat(eat ? TEASE.heat.eat : TEASE.heat.blowUp); T.warnAt = 0;
      if (eat && st.meal) { endMeal(st, t, true, ev); if (st.bowl) st.bowl.wait = t + BOWL.wait; }   // she leaves the bowl for a while
      offence(st, t, { type: 'blowUp', why, lap }, !eat, ev);   // the meal one plans no payback
    };
    const loveBite = () => {
      love(TEASE.love.loveBite); addHeat(TEASE.heat.loveBite); T.warnAt = 0;
      if (st.lap) leaveLap(st, t, 'annoyed', ev);
      ev.push({ type: 'loveBite', lap });
    };
    // love from pats: at most +8 in a 10-minute window (gain above 8 = the flop's +4 was given, the window is full)
    const gain = amount => {
      if (!T.gainAt || t - T.gainAt >= TEASE.gainWin * MIN) { T.gainAt = t; T.gain = 0; }
      const add = Math.min(amount, TEASE.gainMax - T.gain);
      if (add > 0) { T.gain = Math.min(TEASE.gainMax, Math.round((T.gain + add) * 1e6) / 1e6); love(add); }
    };
    const irritate = why => { if (n < TEASE.warnN) { T.warnAt = 0; pat('tolerate'); } else warn(() => blowUp(why)); };
    const gentle = path => {
      if (n >= TEASE.overN) { warn(loveBite); return; }   // over-patting
      T.warnAt = 0;
      if (path === 'tolerate') { pat('tolerate'); return; }
      if (path === 'like') { gain(TEASE.like); pat('like'); }
      else {
        const close = ms > 0 ? r2(clamp(1 - Math.abs(ms - patTempo(st)) / TEASE.closeSpan, 0, 1)) : 0;
        gain(TEASE.bliss + TEASE.blissClose * close);
        pat('bliss', { close, rear: n >= TEASE.rearN });
        if (n === TEASE.flopN && close >= TEASE.flopClose) {   // she flops on her side with bliss
          ev.push({ type: 'flop', lap });
          if (T.gain <= TEASE.gainMax) { love(TEASE.flopLove); T.gain = TEASE.gainMax + TEASE.flopLove; }   // the climax bypasses the cap, once a window
          if (T.bondDay !== today) { T.bondDay = today; addBond(st, TEASE.bond, ev); }
          find(st, 'bliss', t, ev);
        }
      }
      if (st.jealous) { N.love = Math.min(100, N.love + JEALOUS.love); ev.push({ type: 'jealousOk', id: st.jealous.id }); st.jealous = null; }
      if (st.lap) st.lap.pet = t;
    };
    if (teaseKind(st, t) === 'cross') { T.warnAt = 0; ev.push({ type: 'swat', why: 'pat' }); return null; }
    if (eating) {   // at the bowl: warned from the 2nd tap, then she leaves it (mild)
      if (n >= 2) warn(() => blowUp('eat')); else { T.warnAt = 0; pat('tolerate'); }
      return null;
    }
    if (region === 'belly') {   // a trap: she grabs the hand and kicks (no claws); no love, no sulk
      addHeat(TEASE.heat.trap); T.warnAt = 0;
      if (st.lap) st.lap.annoy = Math.min(10, st.lap.annoy + 2);
      ev.push({ type: 'trap' });
      return null;
    }
    if (region === 'head' || region === 'chin' || region === 'ears' || region === 'paws') gentle('tolerate');
    else if (region === 'tail') irritate('tail');
    else if (ms > 0 && ms < TEASE.fast) irritate('fast');                 // back / tailBase from here on
    else if (nm === 'sad') gentle('tolerate');
    else if (nm === 'grumpy' || teaseKind(st, t) === 'sulk' || longOff(st, t)) irritate('grumpy');
    else if (region === 'back' || cv >= TEASE.regular) gentle('like');
    else gentle('bliss');                                                 // tailBase, regular, calm or happy
    return null;
  }
  // start or prolong a sulk / renew a cross (heat already added); the cause is pushed after lapLeave, before sulk/cross.
  // While the long offence (st.off) runs: only the cause, nothing starts and no payback is planned
  function offence(st, t, cause, plan, ev) {
    const T = st.tease;
    if (longOff(st, t)) { ev.push(cause); return; }
    if (st.lap) leaveLap(st, t, 'annoyed', ev);
    st.held = false;
    ev.push(cause);
    const k = teaseKind(st, t);
    if (k === 'cross' || heatNow(T, t) >= TEASE.crossAt) {
      T.kind = 'cross'; T.until = t + TEASE.crossMin * MIN;
      ev.push({ type: 'cross', until: T.until });
    } else {
      T.until = Math.max(k === 'sulk' ? T.until : 0, t + TEASE.sulkMin * MIN); T.kind = 'sulk';
      ev.push({ type: 'sulk', until: T.until });
    }
    if (plan) planPay(st, t);
  }
  // her payback: a cross always, a sulk with chance 0.5 (salt 53); due 5–25 min after the end (salt 54), 'shelf' or
  // 'ambush' (salt 55), one a day; an existing plan only waits until 5 min after the new end
  function planPay(st, t) {
    const T = st.tease, P = TEASE.pay, k = Math.floor(t / 1000);
    if (T.pay) { T.pay = { kind: T.pay.kind, at: Math.max(T.pay.at, T.until + P.ext * MIN) }; return; }
    if (T.payDay === dkey(t) || !(T.kind === 'cross' || rndSeed(st.seed, k, 53) < P.p)) return;
    T.pay = { kind: rndSeed(st.seed, k, 55) < 0.5 ? 'shelf' : 'ambush', at: T.until + (P.min + Math.floor(rndSeed(st.seed, k, 54) * (P.max - P.min + 1))) * MIN };
  }

  // the chance she performs a trick: by progress (learned 0.9), mood, energy, offence
  function performChance(st, P) {
    const m = mood(st), mk = m === 'happy' ? 1 : m === 'calm' ? 0.85 : m === 'grumpy' ? 0.5 : 0;   // sad: tricks fail (§4)
    return (P.learned ? 0.9 : 0.6 + 0.08 * P.progress) * mk * (st.needs.energy < 35 ? 0.5 : 1) * (st.off && st.t < st.off.until ? 0.5 : 1);
  }
  // why she did not perform a cue she understood: 'tired' | 'grumpy' | 'notNow' (the UI: Pochopila, ale nechce se jí)
  function notNowReason(st) {
    const m = mood(st);
    return st.needs.energy < 35 ? 'tired' : m === 'grumpy' || m === 'sad' || (st.off && st.t < st.off.until) ? 'grumpy' : 'notNow';
  }
  // does she perform a right cue? after two refusals 'just not now' the third right cue always works, so the player
  // can tell a right cue from a wrong one
  function performs(st, P) {
    const why = notNowReason(st);
    const okp = (why === 'notNow' && P.miss >= 2) || rnd(st) < performChance(st, P);
    P.miss = okp || why !== 'notNow' ? 0 : Math.min(2, P.miss + 1);
    return okp;
  }
  // a treat at time `at` within 1.5 s after she performed = a training success; 5 = learned
  function rewardTrick(st, at, ev) {
    const T = st.train;
    st.train = null;
    if (!T || at < T.at || at - T.at > TREAT_WINDOW) return false;
    const P = st.tricks[T.trick];
    if (P.learned) return true;
    P.progress = Math.min(TRICK_N, P.progress + 1);
    if (P.progress >= TRICK_N) { P.learned = at; ev.push({ type: 'learned', trick: T.trick }); }
    return true;
  }
  // minigame rewards and records (§8): the UI plays the game and reports the score
  function minigameResult(st, game, score, now) {
    const ev = advance(st, now).events, t = st.t;
    const no = reason => { ev.push(Object.assign({ type: 'refused' }, refusal(reason))); return { st, events: ev }; };
    if (typeof game !== 'string' || !Object.prototype.hasOwnProperty.call(GAMES, game)) return no('noGame');
    if (st.out) return no('outside');
    if (st.yard && st.yard.tree) return no('onTree');
    if (st.lap) { ev.push({ type: 'lapOff', dozing: st.lap.doze }); lapNapDone(st, t); st.lap = null; }
    if (st.meal) endMeal(st, t, true, ev);    // she leaves the bowl to play
    if (st.drink) endDrink(st, t, true, ev);
    if (st.hide) unhide(st, 'minigame', ev);
    // Schovávaná reports { found, secs } (or a score already made by hideScore)
    if (game === 'hide' && score && typeof score === 'object') score = hideScore(score.found, score.secs);
    const sc = typeof score === 'number' && Number.isFinite(score) ? Math.floor(clamp(score, 0, 999)) : 0, G = GAMES[game];
    if (Object.prototype.hasOwnProperty.call(GAME_TOYS, game)) memToy(st, GAME_TOYS[game]);   // a dream of the toy
    const today = dkey(t);
    if (st.earnDay.key < today) st.earnDay = { key: today, n: 0 };
    // a day already paid in the future (the clock went back): nothing more today
    const want = Math.min(G.max, Math.floor(sc / G.per)), n = st.earnDay.key > today ? 0 : Math.min(want, EARN_CAP - st.earnDay.n);
    if (n > 0) { st.pamlsky = Math.min(99999, st.pamlsky + n); st.earnDay.n += n; ev.push({ type: 'earned', n, game }); }
    if (want > n) ev.push({ type: 'capReached' });
    const N = st.needs;
    if (game !== 'pill') { N.fun = Math.min(100, N.fun + 30); N.energy = Math.max(0, N.energy - 10); if (st.asleep) rouse(st, t); st.playAt = t; }
    const prev = st.records[game] ? st.records[game].best : 0;
    if (sc > prev) { st.records[game] = { best: sc, t }; ev.push({ type: 'record', game, best: sc, prev }); }
    ensurePlan(st);
    syncWant(st);
    return { st, events: ev };
  }
  // the shop for the UI: items offered at her bond level, with owned / affordable
  function shop(st) {
    return SHOP.filter(it => st.lvl >= it.bond).map(it => ({ id: it.id, kind: it.kind, price: it.price, room: it.room,
      owned: !it.stock && !!st.owned[it.id], have: it.stock ? st.stock[it.stock] || 0 : null, affordable: st.pamlsky >= it.price }));
  }
  // Výcvik for the UI
  function tricks(st) {
    return Object.keys(TRICKS).map(id => { const P = st.tricks[id] || { progress: 0, learned: 0 };
      return { id, cue: TRICKS[id].cue, bond: TRICKS[id].bond, available: st.bond >= TRICKS[id].bond, progress: P.progress, of: TRICK_N, learned: P.learned || null }; });
  }

  /* --- Phase 5: neighbour cats over the fence and the album (SPEC §8 Visitors, Album, §12e) --- */
  // trait: how they take a stroke and food; fem: the grammatical gender of the messages (dostal / dostala); their names are
  // the UI's messages (visitor() gives name: null for them)
  const VISITORS = deep({
    mourek: { trait: 'curious', fem: false }, liza: { trait: 'shy', fem: true },
    bivoj: { trait: 'bold', fem: false }, ciperka: { trait: 'playful', fem: true },
    pacicka: { trait: 'greedy', fem: true }, rambo: { trait: 'grumpy', fem: false },
    sedivka: { trait: 'old', fem: true }, fousek: { trait: 'sleepy', fem: false },
  });
  const VISITOR_IDS = Object.keys(VISITORS);
  /* --- Phase C: kittens visiting (SPEC §8b Phase C; they only visit, never a second cat at home) --- */
  const MOTHERS = deep(['liza', 'ciperka', 'pacicka']);   // not Šedivka: she is old
  const TOMS = deep(['mourek', 'bivoj', 'rambo', 'fousek']);
  // after: the first litter at the earliest this many days after the game started; gap: days from one litter to the next;
  // max litters a game; p: the chance a day once a mother can have them (the player's 3 hearts); per: kittens at most;
  // alone: from this age (days) a kitten visits on its own; grown: adult size (can be invited); the visit pick: a mother
  // with small kittens weighs motherW (1 for the others), a young cat kitW, all young cats together at most kitsW
  const KIT = deep({ after: 7, gap: 120, max: 3, p: 0.1, per: 4, friend: 3, alone: 21, grown: 60, motherW: 3, kitW: 0.6, kitsW: 3 });
  // suggested names (until the player names the kitten), none the same as a neighbour's. They are stored in the save as the
  // kitten's name (like the player's name for Koxa: data, not a text of the game; the player renames it)
  const KIT_NAMES = deep({
    f: ['Micinka', 'Packa', 'Kulička', 'Mourinka', 'Bětka', 'Fifinka', 'Ťapka', 'Žofka', 'Kapička', 'Lilinka', 'Mína', 'Čiča'],   // i18n-ignore: stored names
    m: ['Tygřík', 'Čertík', 'Mikeš', 'Šmudla', 'Drobek', 'Bobík', 'Fíla', 'Ťapík', 'Uhlík', 'Pepík', 'Mourínek', 'Kulíšek'],   // i18n-ignore: stored names
  });
  // the names of the player's language: the UI sets them from its texts (setKitNames); the Czech ones above are the default.
  // Only the choice of a new name depends on them, never the behaviour.
  let kitNamesNow = { f: KIT_NAMES.f, m: KIT_NAMES.m, girl: 'Kočička', boy: 'Kocourek', kitten: 'Koťátko' };   // i18n-ignore: the default stored names (see KIT_NAMES)
  const kitNameOk = s => typeof s === 'string' && s.trim() === s && s.length >= 1 && s.length <= 20;
  function setKitNames(o) {
    const list = L => Array.isArray(L) && L.length >= 4 && L.length <= 40 && L.every(kitNameOk) && new Set(L.map(s => s.toLowerCase())).size === L.length;
    if (!o || !list(o.f) || !list(o.m) || !kitNameOk(o.girl) || !kitNameOk(o.boy) || !kitNameOk(o.kitten)) return false;
    kitNamesNow = { f: o.f.slice(), m: o.m.slice(), girl: o.girl, boy: o.boy, kitten: o.kitten };
    return true;
  }
  const kitNames = () => kitNamesNow;
  // a kitten's trait when not the mother's (30 %): playful ones are the most common, never old
  const KIT_TRAITS = deep({ curious: 2, shy: 1, bold: 1, playful: 3, greedy: 1, grumpy: 0.5, sleepy: 1 });
  // where a young cat (from 21 days) likes a stroke, by its trait (a small kitten likes it everywhere); the UI's help line
  // comes from the trait
  const KIT_LIKES = deep({
    curious: { likes: ['head', 'ears'], dislikes: ['belly'], max: 900 },
    shy: { likes: ['head', 'chin'], dislikes: ['belly', 'tail', 'paws'], max: 600 },
    bold: { likes: ['back'], dislikes: ['belly', 'paws'], max: 900 },
    playful: { likes: ['head', 'ears', 'chin', 'back', 'tailBase'], dislikes: ['tail'], max: 900 },
    greedy: { likes: ['chin'], dislikes: ['tail'], max: 900 },
    grumpy: { likes: ['tailBase'], dislikes: ['belly', 'tail', 'paws'], max: 900 },
    sleepy: { likes: ['ears', 'chin'], dislikes: ['paws'], max: 900 },
  });
  const isKitId = id => typeof id === 'string' && /^k([1-9]|1[0-2])$/.test(id);
  const kitOf = (st, id) => (isKitId(id) && Array.isArray(st.kits) ? st.kits.find(k => k.id === id) || null : null);
  // a litter is a block of ids: k1–k4 the first, k5–k8 the second, k9–k12 the third (one mother, one birth)
  const kitLit = id => Math.ceil(Number(id.slice(1)) / KIT.per);
  // the kitten `id` is younger than `days` at t (false for the eight)
  const kitUnder = (st, id, t, days) => { const K = kitOf(st, id); return !!K && t - K.born < days * DAY; };
  // a neighbour cat: one of the eight or a kitten of this game
  function isVisitor(st, id) { return typeof id === 'string' && (Object.prototype.hasOwnProperty.call(VISITORS, id) || !!kitOf(st, id)); }
  // how much of a kitten it still is (the art's size): 1 up to 2 days, 0.35 at 21 days (it visits alone), 0 at 60 (grown)
  function kitValue(age) {
    const v = age <= 2 ? 1 : age < KIT.alone ? 1 - 0.65 * (age - 2) / (KIT.alone - 2) : age < KIT.grown ? 0.35 * (KIT.grown - age) / (KIT.grown - KIT.alone) : 0;
    return r2(v);
  }
  // { id, name, trait, fem, coat, kit, mother, ageDays, small } for any visitor id (null when unknown; name: a kitten's, null
  // for the eight: the UI has their names); coat = whose coat the
  // art draws (a kitten: the mother's or a tom's); small = under 21 days, comes only with its mother
  function visitor(st, id) {
    if (typeof id !== 'string') return null;
    if (Object.prototype.hasOwnProperty.call(VISITORS, id)) { const V = VISITORS[id]; return { id, name: null, trait: V.trait, fem: V.fem, coat: id, kit: 0, mother: null, ageDays: null, small: false }; }
    const K = st && kitOf(st, id);
    if (!K) return null;
    const age = Math.max(0, ((Number.isFinite(st.t) ? st.t : K.born) - K.born) / DAY);
    return { id, name: K.name, trait: K.trait, fem: K.fem, coat: K.coat, kit: kitValue(age), mother: K.mother, ageDays: Math.floor(age), small: age < KIT.alone, named: K.named };
  }
  // every visitor id: the eight, then the kittens of this game
  function visitorIds(st) { return VISITOR_IDS.concat(st && Array.isArray(st.kits) ? st.kits.map(k => k.id) : []); }
  const pickW = (W, r) => { const ks = Object.keys(W), sum = ks.reduce((a, k) => a + W[k], 0); let x = r * sum; for (const k of ks) { if (x < W[k]) return k; x -= W[k]; } return ks[ks.length - 1]; };
  // a kitten has come to the garden (with its mother or alone)
  const kitSeen = (st, K) => !!(st.visitors[K.id] && st.visitors[K.id].visits);
  // the unnamed kittens that have been seen (the UI's "Koťátka!" dialog), as visitor() records
  function kitsNew(st) { return (Array.isArray(st.kits) ? st.kits : []).filter(k => !k.named && kitSeen(st, k)).map(k => visitor(st, k.id)); }
  function kitName(st, fem, r) {
    const used = new Set([st.name].concat(st.kits.map(k => k.name)).map(s => s.toLowerCase()));   // KIT_NAMES has no neighbour's name
    const L = kitNamesNow[fem ? 'f' : 'm'], s = Math.floor(r * L.length);
    for (let i = 0; i < L.length; i++) { const nm = L[(s + i) % L.length]; if (!used.has(nm.toLowerCase())) return nm; }
    return fem ? kitNamesNow.girl : kitNamesNow.boy;
  }
  // a new local day: a mother the player has 3 hearts with may have kittens (seeded by the day, salts 40–49); she stays
  // away 2–3 days and then comes with them; the kittens are born at the day's midnight
  function litterDay(st, t, ev) {
    const [y, m, d] = ymd(t), no = dayNo(y, m, d), since = new Date(y, m, d).getTime(), L = st.litter;
    if (since - st.born < KIT.after * DAY || (L && (L.count >= KIT.max || since - L.since < KIT.gap * DAY))) return;
    const can = MOTHERS.filter(id => st.visitors[id] && st.visitors[id].friend >= KIT.friend && !(st.guest && st.guest.id === id));
    if (!can.length || rndDay(st, no, 40) >= KIT.p) return;
    const mother = can[Math.floor(rndDay(st, no, 41) * can.length)];
    const n = 2 + Math.floor(rndDay(st, no, 42) * 3), away = rndDay(st, no, 43) < 0.5 ? 2 : 3;
    const father = TOMS[Math.floor(rndDay(st, no, 44) * TOMS.length)], count = (L ? L.count : 0) + 1;
    for (let i = 0; i < n; i++) {
      const r = salt => rndSeed(st.seed, no * 8 + i, salt), fem = r(45) < 0.5, id = 'k' + ((count - 1) * KIT.per + i + 1);
      if (kitOf(st, id)) continue;
      st.kits.push({ id, mother, name: kitName(st, fem, r(49)), named: false, fem, coat: r(46) < 0.55 ? mother : father, born: since,
        trait: r(47) < 0.3 ? VISITORS[mother].trait : pickW(KIT_TRAITS, r(48)), solo: 0 });
    }
    st.litter = { mother, since, back: since + away * DAY, count };
    if (st.visit && st.visit.id === mother) endVisit(st, 'time', ev);
  }
  // the weight of a neighbour in the visit pick: 0 while she is away with new kittens, more while they are small
  function pickWeight(st, id, t) {
    const L = st.litter;
    if (L && L.mother === id && t < L.back) return 0;
    return st.kits.some(k => k.mother === id && k.born <= t && t - k.born < KIT.alone * DAY) ? KIT.motherW : 1;
  }
  // the small kittens that come with their mother now
  const smallKits = (st, id, t) => st.kits.filter(k => k.mother === id && k.born <= t && t - k.born < KIT.alone * DAY).map(k => k.id);
  // nameKitten: a refusal or null
  function nameKitten(st, a, ev) {
    const K = kitOf(st, a.id);
    if (!K || !kitSeen(st, K)) return refusal('noKitten');
    if (typeof a.name !== 'string' || !a.name.trim()) return refusal('kitNameEmpty');
    K.name = cleanName(a.name); K.named = true;
    const R = vrec(st, K.id); if (!R.met) R.met = st.t;   // named = met: it stays in the album when grown
    ev.push({ type: 'kitNamed', id: K.id, name: K.name });
    return null;
  }
  // the visit begins: the mother's small kittens come along (a litter seen for the first time: 'kittens'); a young cat on
  // its own: never seen before ('kittens' alone, only itself: a litter nobody saw while small), its first lone visit
  function kitsArrive(st, id, kits, t, ev) {
    const K = kitOf(st, id);
    if (K) {
      if (!kitSeen(st, K)) { ev.push({ type: 'kittens', mother: K.mother, n: 1, ids: [id], alone: true }); palFound(st, 'kittens', id, t, ev); }
      if (!K.solo) { K.solo = t; ev.push({ type: 'kitGrown', id }); palFound(st, 'kitGrown', id, t, ev); }
      return;
    }
    const first = [];
    for (const k of kits.map(x => kitOf(st, x))) {
      const lit = st.kits.filter(o => kitLit(o.id) === kitLit(k.id));
      if (!first.includes(lit[0]) && lit.every(o => !kitSeen(st, o))) {
        first.push(lit[0]);
        ev.push({ type: 'kittens', mother: k.mother, n: lit.length, ids: lit.map(o => o.id) });
      }
    }
    for (const x of kits) { const R = vrec(st, x); R.visits = Math.min(CMAX, R.visits + 1); }
    if (first.length) palFound(st, 'kittens', first[0].mother, t, ev);
  }
  // per hour: a visit in the daytime (×2.5 with the miska pro návštěvy in the garden, ×1.5 with a cushion there);
  // only Bivoj comes at night; a visit lasts 20–90 min (greedy and sleepy ones +30 min when fed)
  // perVisitLiked: the cap when the strokes are where it likes them (Phase B)
  const VISIT = deep({ day: 0.05, night: 0.03, bowl: 2.5, cushion: 1.5, stay: [20, 90], fedStay: 30, perVisit: 1, perVisitLiked: 1.5 });
  // friendship (0–5 hearts, quarter steps) from a stroke / from food, by trait; at most +1 a visit from strokes
  const BY_TRAIT = deep({
    curious: [0.5, 0.5], shy: [0.25, 0.5], bold: [0.5, 0.5], playful: [0.5, 0.5],
    greedy: [0.25, 1], grumpy: [0.5, 0.5], old: [0.75, 0.5], sleepy: [0.5, 0.5],
  });
  // Koxa and the visitor (her own hearts, pal): 'hiss' (Bivoj until 3 hearts, Rambo until 2), 'play' (Čiperka), 'friends'
  // (3+ hearts), 'watch'; the mood while the visitor is there and they do nothing together
  const VISIT_MOOD = { hiss: -10, play: 5, friends: 5, watch: 0 };
  // Phase A, a visit's programme (st.visit.act): what the visitor does alone (joint false) or together with Koxa in the garden.
  // An act lasts at least `min` minutes, then ends after an exponential time with `rate` per minute: the end is drawn once from
  // the act's start (actEnd) and the next act is picked from the same start, so how often advance() runs does not matter;
  // fx = Koxa's needs per hour while they do it together; mood = her mood meanwhile (instead of VISIT_MOOD)
  const VISIT_ACTS = deep({
    arrive: { joint: false, min: 5, rate: 1 },          // on the fence
    wander: { joint: false, min: 5, rate: 0.1 }, drink: { joint: false, min: 3, rate: 0.15 },   // drink: at the pond, not in winter (frozen)
    bench: { joint: false, min: 5, rate: 0.06 }, tree: { joint: false, min: 5, rate: 0.1 },
    nap: { joint: false, min: 10, rate: 0.04 }, bowl: { joint: false, min: 3, rate: 0.15 },     // bowl: only with the miska pro návštěvy
    greet: { joint: true, min: 3, rate: 1, mood: 5, fx: { love: 3 } },                          // nose to nose: the first joint act
    standoff: { joint: true, min: 3, rate: 0.2, mood: -10, fx: { love: -6, energy: -2 } },     // arched backs, instead of greet when she hisses
    chase: { joint: true, min: 3, rate: 0.12, mood: 8, fx: { fun: 20, energy: -8 } },
    wrestle: { joint: true, min: 3, rate: 0.12, mood: 8, fx: { fun: 15, energy: -6 } },
    groom: { joint: true, min: 5, rate: 0.08, mood: 8, fx: { coat: 8, love: 6 } },
    snuggle: { joint: true, min: 10, rate: 0.04, mood: 8, fx: { energy: 6, love: 6 } },       // also next to her when she sleeps
    // Phase C, only while the mother has her small kittens with her (kits); partner: one kitten is Koxa's partner (act.kit)
    kitPlay: { joint: true, kits: true, partner: true, min: 3, rate: 0.15, mood: 6, fx: { fun: 18, energy: -8 } },   // they pounce on her, pull her tail
    kitFlee: { joint: true, kits: true, min: 3, rate: 0.2, mood: -4, fx: { love: -2 } },                            // she escapes up the tree (the art; st.yard.tree stays)
    kitGroom: { joint: true, kits: true, partner: true, min: 4, rate: 0.12, mood: 8, fx: { love: 8 } },            // she licks a kitten
  });
  const PAL_STEP = 0.25, PAL_VISIT = 0.5;   // Koxa's hearts: +¼ for each joint act (not a standoff), at most +½ a visit
  const SOLO_W = deep({ wander: 3, drink: 2, bench: 2, tree: 2, nap: 1, bowl: 3 });
  const SOLO_TRAIT = deep({
    sleepy: { nap: 4, bench: 3, tree: 0.3 }, old: { nap: 4, bench: 3, tree: 0.3 }, playful: { wander: 2.5, tree: 2.5, nap: 0.5 },
    curious: { wander: 2.5, tree: 2.5, nap: 0.5 }, greedy: { bowl: 4 }, bold: { tree: 1.5 }, shy: { bench: 1.5, wander: 0.7 },
  });
  // Phase B: where each cat likes a finger stroke (REGIONS ids; liked = +¼ heart and the higher cap), where it does not
  // (no friendship: visitorDislike; shy Líza runs off under 2 hearts, Rambo swipes under 3), the fastest stroke it takes
  // (px/s; faster = disliked); the help line for the help and the visitor's menu is the UI's message per cat
  const VISITOR_LIKES = deep({
    mourek: { likes: ['head', 'ears'], dislikes: ['belly'], max: 900 },
    liza: { likes: ['head', 'chin'], dislikes: ['ears', 'back', 'tailBase', 'belly', 'tail', 'paws'], max: 500 },
    bivoj: { likes: ['back'], dislikes: ['belly', 'paws'], max: 900 },
    ciperka: { likes: ['head', 'ears', 'chin', 'back', 'tailBase', 'belly', 'paws'], dislikes: ['tail'], max: 900 },
    pacicka: { likes: ['chin'], dislikes: ['tail'], max: 900 },
    rambo: { likes: ['tailBase'], dislikes: ['belly', 'tail', 'paws'], max: 900 },
    sedivka: { likes: ['back'], dislikes: ['paws', 'tail'], max: 900 },
    fousek: { likes: ['ears', 'chin'], dislikes: ['paws'], max: 900 },
  });
  const PLAY_VISIT = 0.5;   // the feather for two: +¼ heart a game, at most +½ a visit, one game a minute
  // jealousy: the chance (her hearts for that cat: under 1 / 1–3 / 3+), at most once every 20 min, 2 min to make it right
  const JEALOUS = deep({ p: [0.4, 0.3, 0.2], every: 20, ok: 2, love: 4 });
  const GUEST = deep({ max: 14, love: 3, energy: 1 });   // a sleepover: at most 14 h; sleeping together per hour
  const ALBUM_MAX = 200;
  const PHOTO_ROOMS = ['living', 'kitchen', 'hall', 'garden', 'lap', 'walk'];
  // Koxa's own hearts for a cat (a record from before Phase A has only the player's: she takes those over)
  const palOf = R => (!R ? 0 : typeof R.pal === 'number' && Number.isFinite(R.pal) ? R.pal : typeof R.friend === 'number' && Number.isFinite(R.friend) ? R.friend : 0);
  function reaction(st, id) {
    const h = palOf(st.visitors[id]);
    if (id === 'bivoj' && h < 3) return 'hiss';
    if (id === 'rambo' && h < 2) return 'hiss';
    if (id === 'ciperka') return 'play';
    if (kitOf(st, id) && visitor(st, id).kit > 0) return 'play';   // a young cat
    return h >= 3 ? 'friends' : 'watch';
  }
  function vrec(st, id) {
    const R = st.visitors[id];
    if (!R) return (st.visitors[id] = { friend: 0, pal: 0, met: 0, visits: 0, fed: 0 });
    if (typeof R.pal !== 'number') st.visitors[id] = { friend: R.friend, pal: palOf(R), met: R.met, visits: R.visits, fed: R.fed };
    return st.visitors[id];
  }
  function endVisit(st, reason, ev) {
    ev.push(Object.assign({ type: 'visitorLeave', id: st.visit.id, reason }, st.visit.kits ? { kits: st.visit.kits.slice() } : {}));
    st.visit = null;
  }
  // one step: a visitor may come (seeded), Koxa reacts, the visit ends after its time (never forever)
  function visitStep(st, t, dt, night, watching, ev) {
    const h = dt / HOUR;
    if (st.visit) {
      if (night && st.visit.id !== 'bivoj') endVisit(st, 'night', ev);
      else if (weather(t, st) === 'rain' && st.visit.id !== 'bivoj') endVisit(st, 'rain', ev);
      else {
        st.visit = fixVisit(st.visit, t, st);
        if (!st.visit) return;
        const V = st.visit;
        // does she know about it? In the garden at once; awake at home she hears it about 10 min after it came (drawn from
        // its arrival); asleep or out on a walk she does not
        if (!V.noticed) {
          if (st.yard || gardenAlone(st)) V.noticed = t;
          else if (!st.out && !st.asleep) {
            const hear = V.since + Math.round(expDraw(st, V.since, 68) * NOTICE.hear * MIN);
            if (t + dt >= hear) { V.noticed = Math.max(t, hear); if (watching) ev.push({ type: 'visitorNoticed', id: V.id }); }
          }
        }
        const U = st.visit.until;
        if (U > t) programme(st, t, Math.min(dt, U - t), watching, ev);   // up to the visit's end exactly, whatever the step
        if (t + dt >= U) endVisit(st, 'time', ev);
      }
      return;
    }
    if (st.guest) return;                     // a friend sleeps over: nobody else comes
    if (weather(t, st) === 'rain' && !night) return;
    const F = st.furniture, cushion = (F.sillCushion && F.sillCushion.room === 'garden') || (F.bedDeluxe && F.bedDeluxe.room === 'garden');
    const rate = night ? VISIT.night : VISIT.day * (F.visitorBowl ? VISIT.bowl : 1) * (cushion ? VISIT.cushion : 1);
    if (!(rnd(st) < 1 - Math.exp(-rate * h))) return;
    const id = night ? 'bivoj' : pickVisitor(st, t, rnd(st));
    const stay = VISIT.stay[0] + Math.floor(rnd(st) * (VISIT.stay[1] - VISIT.stay[0]));
    // she sees it come: always in the garden; awake at home through the window by day phase (drawn from the arrival)
    const sees = !!st.yard || gardenAlone(st) || (!st.out && !st.asleep && rndSeed(st.seed, Math.floor(t / 1000), 69) < NOTICE[dayPhase(t)]);
    st.visit = { id, since: t, until: t + stay * MIN, gain: 0, palGain: 0, greeted: false, ready: null, act: { kind: 'arrive', since: t, with: null },
      pet: 0, treat: false, play: 0, playGain: 0, hurt: false, noticed: sees ? t : 0 };
    const kits = smallKits(st, id, t);   // a mother brings her small kittens
    if (kits.length) st.visit.kits = kits;
    ev.push(Object.assign({ type: 'visitor', id, reaction: st.out && st.out.walk ? 'away' : reaction(st, id), noticed: sees }, kits.length ? { kits: kits.slice() } : {}));
    kitsArrive(st, id, kits, t, ev);
    const R = vrec(st, id); R.visits = Math.min(CMAX, R.visits + 1);
    if (watching) ev.push({ type: 'visitAct', id, kind: 'arrive', with: null });
  }
  // who comes in the daytime: the eight (weight 1; a mother with small kittens more, one away with new kittens never) and
  // the young cats from 21 days (together at most KIT.kitsW); with no kittens exactly the old even pick
  function pickVisitor(st, t, r) {
    const ids = VISITOR_IDS.slice(), w = ids.map(id => pickWeight(st, id, t));
    const alone = st.kits.filter(k => t - k.born >= KIT.alone * DAY);
    for (const k of alone) { ids.push(k.id); w.push(Math.min(KIT.kitW, KIT.kitsW / alone.length)); }
    let x = r * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ids.length; i++) { if (x < w[i]) return ids[i]; x -= w[i]; }
    return ids[ids.length - 1];
  }
  // Koxa can do something with the visitor: in the garden, awake, not up the tree, on the lap or in the arms
  // (not while she sulks or is cross: a joint act ends at the next step, none starts, no jealousy; SPEC §13.3)
  const palAwake = st => !!(st.yard && !st.out && !st.yard.tree && !st.asleep && !st.lap && !st.held && !teasing(st));
  const palAsleep = st => !!(st.yard && !st.out && !st.yard.tree && st.asleep);
  const pondFrozen = t => season(t) === 'winter';
  function pickSolo(st, cur, t, r) {
    const tr = SOLO_TRAIT[visitor(st, st.visit.id).trait] || {};
    let ks = Object.keys(SOLO_W).filter(k => (k !== 'bowl' || st.furniture.visitorBowl) && (k !== 'drink' || !pondFrozen(t)));
    if (ks.length > 1) ks = ks.filter(k => k !== cur);
    const w = ks.map(k => SOLO_W[k] * (tr[k] || 1)), sum = w.reduce((a, b) => a + b, 0);
    let x = r * sum;
    for (let i = 0; i < ks.length; i++) { if (x < w[i]) return ks[i]; x -= w[i]; }
    return ks[ks.length - 1];
  }
  // together (after greeting, not hissing): chase and wrestle with a playful, curious or bold cat from 1 heart (Čiperka at once),
  // groom and snuggle from 3 hearts (old and sleepy cats prefer to snuggle); null = nothing fits
  function pickJoint(st, cur, r) {
    const id = st.visit.id, V = visitor(st, id), trait = V.trait, p = palOf(st.visitors[id]);
    const ks = [], w = [];
    const add = (k, x) => { if (k !== cur) { ks.push(k); w.push(x); } };
    if (['playful', 'curious', 'bold'].includes(trait) && (p >= 1 || id === 'ciperka' || V.kit > 0)) { add('chase', trait === 'playful' ? 3 : 2); add('wrestle', trait === 'bold' ? 2.5 : 1.5); }
    if (p >= 3) { add('groom', 2); add('snuggle', trait === 'old' || trait === 'sleepy' ? 4 : 1); }
    if (!ks.length) return null;
    let x = r * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ks.length; i++) { if (x < w[i]) return ks[i]; x -= w[i]; }
    return ks[ks.length - 1];
  }
  // with the mother's small kittens: they play with Koxa (kitPlay) or she escapes from them (kitFlee: more often when she
  // and the mother are not friends yet, and when she does not like her belly touched, st.traits.bellyOk); she licks one
  // (kitGroom) from 3 hearts with the mother
  function pickKit(st, cur, r) {
    const p = palOf(st.visitors[st.visit.id]), tol = clamp((st.traits.bellyOk - 0.15) / 0.25, 0, 1);
    const W = {};
    if (cur !== 'kitPlay') W.kitPlay = p < 1 ? 1 : 3;
    if (cur !== 'kitFlee') W.kitFlee = (p < 1 ? 3 : p < 3 ? 1.5 : 0.5) * (1.5 - tol);
    if (cur !== 'kitGroom' && p >= 3) W.kitGroom = 2.5;
    return pickW(W, r);
  }
  function addPal(st, id, t, ev, kit) {
    const V = st.visit, g = Math.min(PAL_STEP, PAL_VISIT - V.palGain);
    if (g <= 0) return;
    V.palGain += g;
    bumpPal(st, id, g, t, ev);
    if (kit) bumpPal(st, kit, g, t, ev);   // the kitten she played with or licked: the same quarter
  }
  function bumpPal(st, id, g, t, ev) {
    const R = vrec(st, id), before = Math.floor(R.pal);
    R.pal = Math.round(clamp(R.pal + g, 0, 5) * 4) / 4;
    if (Math.floor(R.pal) > before) ev.push({ type: 'palUp', id, pal: Math.floor(R.pal) });
    if (R.pal >= 3) palFound(st, 'palFirst', id, t, ev);
  }
  // a pal* or sleepover diary entry and its cat (st.diaryCat keeps the fixed order of CAT_DIARY, as repair does)
  function palFound(st, dk, id, t, ev) {
    if (st.diary[dk]) return;
    const o = {}, C = st.diaryCat || {};
    for (const k of CAT_DIARY) if (k === dk) o[k] = id; else if (Object.prototype.hasOwnProperty.call(C, k)) o[k] = C[k];
    st.diaryCat = o;
    find(st, dk, t, ev);
  }
  function setAct(st, kind, t, watching, ev) {
    const V = st.visit, K = VISIT_ACTS[kind], joint = K.joint;
    V.act = { kind, since: t, with: joint ? 'koxa' : null };
    // the kitten partner: drawn from the act's start (salt 52)
    if (K.partner) V.act.kit = V.kits[Math.floor(rndSeed(st.seed, Math.floor(t / 1000), 52) * V.kits.length)];
    if (joint) V.greeted = true;
    if (watching) ev.push(Object.assign({ type: 'visitAct', id: V.id, kind, with: V.act.with }, K.partner ? { kit: V.act.kit } : {}));
    if (!joint || kind === 'standoff' || kind === 'kitFlee') return;
    // a save from before Phase A may already have 3+ hearts: the first friend comes before grooming or snuggling
    if (palOf(st.visitors[V.id]) >= 3) palFound(st, 'palFirst', V.id, t, ev);
    addPal(st, V.id, t, ev, V.act.kit);
    const dk = kind === 'groom' ? 'palGroom' : kind === 'snuggle' ? 'palSnuggle' : null;
    if (dk) palFound(st, dk, V.id, t, ev);
  }
  // the moment an act ends by itself: `min` minutes, then an exponential time with its rate, drawn once from its start
  const actEnd = (seed, A) => { const K = VISIT_ACTS[A.kind];
    return A.since + K.min * MIN + (-Math.log(1 - rndSeed(seed, Math.floor(A.since / 1000), 21)) / K.rate) * MIN; };
  // she comes to say hello about 3 min (rate 0.3 per minute) after she could first (V.ready) or after the visitor's last act began
  const greetAt = (seed, from) => from + (-Math.log(1 - rndSeed(seed, Math.floor(from / 1000), 26)) / 0.3) * MIN;
  // a joint act ends: the visitor goes on alone (after a standoff one of them walked away: Koxa is a little upset)
  function apart(st, t, watching, ev) {
    const A = st.visit.act;
    if (A.kind === 'standoff') st.needs.love = Math.max(0, st.needs.love - 2);
    setAct(st, pickSolo(st, A.kind, t, rndSeed(st.seed, Math.floor(A.since / 1000), 25)), t, watching, ev);
  }
  // Koxa's needs from a joint act for ms milliseconds
  function actFx(st, A, ms) {
    const fx = A.with && VISIT_ACTS[A.kind].fx;
    if (!fx || ms <= 0) return;
    const N = st.needs;
    for (const n of Object.keys(fx)) N[n] = clamp(N[n] + fx[n] * ms / HOUR, 0, 100);
  }
  // one step of a visit: every act that ends within [t, t + dt) is followed by the next one at its exact moment, and the
  // effects are split at those moments, so 10-minute steps and many short ones give the same acts
  function programme(st, t, dt, watching, ev) {
    const V = st.visit, end = t + dt;
    const awake = palAwake(st), asleep = palAsleep(st), hiss = reaction(st, V.id) === 'hiss';
    if (V.act.with && !(awake || (asleep && V.act.kind === 'snuggle'))) apart(st, t, watching, ev);   // she went in, fell asleep, …
    V.ready = awake && !V.greeted ? (V.ready === null ? t : V.ready) : null;
    let cur = t;
    for (let guard = 0; guard < 100; guard++) {
      const A = V.act, greeting = !A.with && awake && !V.greeted;
      let at;
      if ((A.kind === 'bowl' && !st.furniture.visitorBowl) || (A.kind === 'drink' && pondFrozen(cur))) at = cur;
      else if (greeting) at = greetAt(st.seed, Math.max(V.ready, A.since));
      else at = actEnd(st.seed, A);
      if (at >= end) break;
      at = Math.max(at, cur);
      actFx(st, A, at - cur); cur = at;
      if (A.kind === 'standoff') { apart(st, at, watching, ev); continue; }
      const r = salt => rndSeed(st.seed, Math.floor(A.since / 1000), salt);   // one act always leads to the same next one
      let next = null;
      if (greeting) next = r(22) < 0.9 ? (hiss ? 'standoff' : 'greet') : null;
      else if (awake && !hiss && V.kits && r(50) < 0.55) next = pickKit(st, A.kind, r(51));   // the kittens are here
      else if (awake && !hiss && r(22) < 0.5) next = pickJoint(st, A.kind, r(23));
      else if (asleep && !hiss && palOf(st.visitors[V.id]) >= 3 && A.kind !== 'snuggle' && r(22) < 0.4) next = 'snuggle';
      if (!next) next = pickSolo(st, A.kind, at, r(24));
      setAct(st, next, at, watching, ev);
    }
    actFx(st, V.act, end - cur);
    if (V.greeted) V.ready = null;
  }
  // a canonical visit or null (repair and states made by hand); an unknown act or one that does not fit = 'wander' alone
  // st: the kittens (a kitten's visit, the mother's small kittens in S.kits)
  function fixVisit(S, t, st) {
    const okT = v => typeof v === 'number' && Number.isFinite(v) && v >= T_MIN && v <= T_MAX;
    const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
    if (!(S && typeof S === 'object' && isVisitor(st, S.id) && okT(S.since) && S.since <= t && okT(S.until) && S.until > S.since &&
      S.until <= S.since + (VISIT.stay[1] + 2 * VISIT.fedStay) * MIN)) return null;
    if (kitUnder(st, S.id, S.since, KIT.alone)) return null;   // a small kitten never comes alone
    const fin = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    // the mother's kittens with her: known ones of hers, born by now, in the order of st.kits
    const kits = Array.isArray(S.kits) ? st.kits.filter(k => k.mother === S.id && k.born <= t && S.since - k.born < KIT.alone * DAY && S.kits.includes(k.id)).map(k => k.id) : [];
    const A = S.act && typeof S.act === 'object' ? S.act : {}, K = own(VISIT_ACTS, A.kind) ? VISIT_ACTS[A.kind] : null;
    const okA = K && (K.joint ? A.with === 'koxa' : A.with === null) && (!K.kits || kits.length > 0) && (!K.partner || kits.includes(A.kit));
    const act = okA ? { kind: A.kind, since: okT(A.since) && A.since >= S.since && A.since <= t ? A.since : S.since, with: A.with }
      : { kind: 'wander', since: S.since, with: null };
    if (okA && K.partner) act.kit = A.kit;
    const greeted = S.greeted === true || act.with === 'koxa';
    const when = v => (okT(v) && v >= S.since && v <= t ? v : 0);
    const q = v => Math.round(clamp(fin(v), 0, VISIT.perVisitLiked) * 4) / 4;
    const out = {
      id: S.id, since: S.since, until: S.until, gain: Math.round(clamp(fin(S.gain), 0, VISIT.perVisitLiked) * 4) / 4,
      palGain: Math.round(clamp(fin(S.palGain), 0, PAL_VISIT) * 4) / 4, greeted,
      ready: !greeted && okT(S.ready) && S.ready >= S.since && S.ready <= t ? S.ready : null, act,
      // Phase B: the last stroke that counted (one a minute), the treat given, the last feather game and what it gave,
      // Rambo's swipe already cost a quarter heart this visit
      pet: when(S.pet), treat: S.treat === true, play: when(S.play), playGain: Math.round(clamp(fin(S.playGain), 0, PLAY_VISIT) * 4) / 4, hurt: S.hurt === true,
      noticed: when(S.noticed),   // when Koxa noticed the visitor (seen or heard from the house, or in the garden); 0 = not yet
    };
    if (!kits.length) return out;
    out.kits = kits;
    // the player and each kitten (strokes, a treat, the feather): as the visit's own fields, only for kittens touched
    const P = S.kp && typeof S.kp === 'object' && !Array.isArray(S.kp) ? S.kp : {}, kp = {};
    for (const k of kits) {
      const p = own(P, k) && P[k] && typeof P[k] === 'object' ? P[k] : null;
      if (p) kp[k] = { gain: q(p.gain), pet: when(p.pet), treat: p.treat === true, play: when(p.play), playGain: Math.round(clamp(fin(p.playGain), 0, PLAY_VISIT) * 4) / 4 };
    }
    if (Object.keys(kp).length) out.kp = kp;
    return out;
  }
  // the player's state with a kitten of the visit (created in the order of the visit's kits, as fixVisit keeps it)
  function kitPlayer(st, id) {
    const V = st.visit, P = V.kp || {};
    if (!P[id]) {
      const o = {};
      for (const k of V.kits) if (k === id) o[k] = { gain: 0, pet: 0, treat: false, play: 0, playGain: 0 }; else if (P[k]) o[k] = P[k];
      V.kp = o;
    }
    return V.kp[id];
  }
  function addFriend(st, id, d, ev) {
    const R = vrec(st, id), before = Math.floor(R.friend);
    R.friend = Math.round(clamp(R.friend + d, 0, 5) * 4) / 4;
    if (Math.floor(R.friend) > before) ev.push({ type: 'visitorFriend', id, hearts: Math.floor(R.friend) });
  }
  // feedVisitor / strokeVisitor / treatVisitor / playVisitor / photo / deletePhoto; returns a refusal or null
  function socialAct(st, action, a, t, ev) {
    if (action === 'photo') {
      if (st.album.length >= ALBUM_MAX) return refusal('albumFull', { max: ALBUM_MAX });
      const str = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
      const room = PHOTO_ROOMS.includes(a.room) ? a.room : st.yard ? 'garden' : st.lap ? 'lap' : 'living';
      // who else is in the photographed place: the visitor in the garden (also on the bench lap), the guest in the living
      // room (never on the lap indoors: the lap photo shows only her and the player)
      const outside = room === 'garden' || (room === 'lap' && !!st.yard), inside = room === 'living';
      const vis = outside && st.visit ? st.visit.id : inside && st.guest ? st.guest.id : null;
      const nokoxa = !!st.out || a.nokoxa === true;
      if (nokoxa && !vis) return refusal(st.out ? 'outside' : 'photoEmpty');
      const p = {
        t, pose: str(a.pose, 20) || (st.asleep ? 'sleep' : 'sit'), room,
        mood: ['happy', 'calm', 'grumpy', 'sad'].includes(a.mood) ? a.mood : mood(st),
        phase: ['night', 'morning', 'day', 'evening'].includes(a.phase) ? a.phase : dayPhase(t),
        season: ['spring', 'summer', 'autumn', 'winter'].includes(a.season) ? a.season : season(t),
        note: str(a.note, 60) || '', visitor: vis,
      };
      if (vis) photoVisitor(p, { vpose: str(a.vpose, 20), vx: a.vx, vflip: a.vflip });
      if (nokoxa) p.nokoxa = true;
      if (outside && st.visit && st.visit.kits) photoKits(st, p, st.visit.kits);   // the mother's small kittens are in it too
      st.album.push(p);
      ev.push({ type: 'photo', n: st.album.length });
      return null;
    }
    if (action === 'deletePhoto') {
      const i = st.album.findIndex(p => p.t === a.t);
      if (i < 0) return refusal('noPhoto');
      st.album.splice(i, 1);
      ev.push({ type: 'photoDeleted', n: st.album.length });
      return null;
    }
    if (st.visit) st.visit = fixVisit(st.visit, t, st);
    const id = isVisitor(st, a.id) ? a.id : null;
    if (!id) return refusal('noCat');
    const V = visitor(st, id);
    if (st.guest && st.guest.id === id) {   // the guest in the living room: strokes only, they change no hearts
      if (action !== 'strokeVisitor') return refusal('guestWaits', { vis: id });
      const k = strokeKind(st, id, a);
      if (k.slow) return null;
      ev.push(k.why ? { type: 'visitorDislike', id, region: k.region, why: k.why, away: V.trait === 'shy' } : Object.assign({ type: 'visitorPurr', id }, k.region ? { region: k.region, liked: k.liked } : {}));
      return null;
    }
    // a small kitten is here with its mother: it has its own strokes, treat and games of this visit (st.visit.kp)
    const inKits = !!(st.visit && st.visit.kits && st.visit.kits.includes(id));
    if (!st.visit || (st.visit.id !== id && !inKits)) return refusal('notHere', { vis: id });
    const R = vrec(st, id), S = inKits ? kitPlayer(st, id) : st.visit, wild = !V.small && !inKits;   // a small kitten never runs off or swipes
    if (!R.met) R.met = t;
    const [strokeGain, foodGain] = BY_TRAIT[V.trait];
    if (action === 'feedVisitor') {
      const today = dkey(t);
      if (R.fed === today) return refusal('fedToday', { vis: id });
      R.fed = today;
      if (!inKits && (V.trait === 'greedy' || V.trait === 'sleepy')) S.until += VISIT.fedStay * MIN;   // stays longer
      ev.push({ type: 'visitorFed', id });
      addFriend(st, id, foodGain, ev);
      if (palAwake(st)) addPal(st, id, t, ev);   // Koxa sees you are friends with it
      return null;
    }
    if (action === 'treatVisitor') {   // a pamlsek from the hand: once a visit, friendship as food; it counts as fed today
      if (S.treat) return refusal('treatGiven', { vis: id });
      if (st.pamlsky < 1) return refusal('noTreats');
      st.pamlsky -= 1; S.treat = true; R.fed = dkey(t);
      ev.push({ type: 'visitorTreat', id });
      addFriend(st, id, foodGain, ev);
      if (palAwake(st)) addPal(st, id, t, ev);
      jealousy(st, id, t, ev);
      return null;
    }
    if (action === 'playVisitor') {   // the feather for two: one game a minute; Koxa plays along when she is with them
      if (S.play && t - S.play < MIN) return refusal('resting', { vis: id });
      S.play = t;
      const koxa = palAwake(st), caught = koxa && a.caught === 'koxa' ? 'koxa' : 'visitor';
      ev.push({ type: 'visitorPlay', id, caught, koxa });
      const g = Math.min(PAL_STEP, PLAY_VISIT - S.playGain);
      if (g > 0) { S.playGain += g; addFriend(st, id, g, ev); }
      if (koxa) {
        const N = st.needs;
        N.fun = Math.min(100, N.fun + (caught === 'koxa' ? 12 : 8)); N.energy = Math.max(0, N.energy - 3);
        memToy(st, 'feather');
        addPal(st, id, t, ev);
      }
      if (caught === 'visitor') jealousy(st, id, t, ev);   // the other cat got the feather
      return null;
    }
    // strokeVisitor
    let liked = false;
    const k = strokeKind(st, id, a);
    if (!k.region) {   // the menu's Pohladit (or an unknown region): shy ones may run off, grumpy ones may swipe
      if (wild && V.trait === 'shy' && R.friend < 2 && rnd(st) < 0.6) { endVisit(st, 'shy', ev); return null; }
      if (wild && V.trait === 'grumpy' && R.friend < 2 && rnd(st) < 0.5) { ev.push({ type: 'visitorHiss', id }); addFriend(st, id, -0.25, ev); return null; }
      ev.push({ type: 'visitorPurr', id });
    } else {
      if (k.slow) return null;   // too slow: it does not notice
      const swipe = () => { ev.push({ type: 'visitorHiss', id, region: k.region }); if (!S.hurt) { S.hurt = true; addFriend(st, id, -0.25, ev); } return null; };
      if (k.why) {
        if (wild && V.trait === 'shy' && R.friend < 2) { endVisit(st, 'shy', ev); return null; }
        if (wild && V.trait === 'grumpy' && R.friend < 3) return swipe();
        ev.push({ type: 'visitorDislike', id, region: k.region, why: k.why, away: wild && V.trait === 'shy' });
        return null;
      }
      liked = k.liked;
      // grumpy Rambo under 2 hearts: half the minutes he swipes even at a neutral spot (the same answer all that minute)
      if (!liked && wild && V.trait === 'grumpy' && R.friend < 2 && rndSeed(st.seed, Math.floor(t / MIN), 30) < 0.5) return swipe();
      ev.push({ type: 'visitorPurr', id, region: k.region, liked });
    }
    if (S.pet && t - S.pet < MIN) return null;   // friendship from strokes at most once a minute, however many strokes come
    S.pet = t;
    const g = Math.min(strokeGain + (liked ? PAL_STEP : 0), (liked ? VISIT.perVisitLiked : VISIT.perVisit) - S.gain);
    if (g > 0) { S.gain += g; addFriend(st, id, g, ev); }
    if (palAwake(st)) addPal(st, id, t, ev);
    jealousy(st, id, t, ev);
    return null;
  }
  // a finger stroke on a visitor: { region (null = none or unknown), slow, why (dislike: 'fast' | 'against' | 'region'), liked }
  function strokeKind(st, id, a) {
    const region = regionOf(a.region, null);
    if (!region) return { region: null, slow: false, why: null, liked: false };
    const L = likesOf(st, id);
    const sp = typeof a.speed === 'number' ? (a.speed < 120 ? 'slow' : a.speed > L.max ? 'fast' : 'good') : ['slow', 'fast'].includes(a.speed) ? a.speed : 'good';
    const dir = a.along === false || a.along === 'against' ? 'against' : a.along === 'sideways' ? 'sideways' : 'along';
    const why = sp === 'fast' ? 'fast' : dir === 'against' ? 'against' : L.dislikes.includes(region) ? 'region' : null;
    return { region, slow: sp === 'slow', why, liked: !why && dir === 'along' && L.likes.includes(region) };
  }
  // the visitor's place in a photo: vpose (≤ 20 characters), vx (0–400, whole), vflip (only when true); none = not stored
  function photoVisitor(p, o) {
    if (typeof o.vpose === 'string' && o.vpose) p.vpose = o.vpose.slice(0, 20);
    if (typeof o.vx === 'number' && Number.isFinite(o.vx)) p.vx = Math.round(clamp(o.vx, 0, 400));
    if (o.vflip === true) p.vflip = true;
  }
  // Koxa may get jealous when she sees you with a visitor (in the garden, awake, not up the tree, held or on the lap; from
  // bond level Známá): a seeded chance from the moment (salt 31), at most once every 20 minutes
  function jealousy(st, id, t, ev) {
    if (!palAwake(st) || st.lvl < 1 || st.jealous || (st.jealousAt && t - st.jealousAt < JEALOUS.every * MIN)) return;
    const p = palOf(st.visitors[id]), chance = JEALOUS.p[p < 1 ? 0 : p < 3 ? 1 : 2];
    if (rndSeed(st.seed, Math.floor(t / 1000), 31) >= chance) return;
    st.jealous = { since: t, id }; st.jealousAt = t;
    ev.push({ type: 'jealous', id });
  }
  // the next 7:00 local time after t (a sleepover ends then)
  function next7(t) {
    const d = new Date(t); d.setHours(7, 0, 0, 0);
    if (d.getTime() <= t) { d.setDate(d.getDate() + 1); d.setHours(7, 0, 0, 0); }
    return d.getTime();
  }
  // why the visitor cannot be invited in for the night now (a refusal), or null
  function inviteWhy(st, id, t) {
    if (!isVisitor(st, id)) return refusal('noCat');
    const V = visitor(st, id), R = st.visitors[id];
    if (st.guest) return st.guest.id === id ? refusal('guestHere', { vis: id }) : refusal('guestOther', { vis: st.guest.id });
    if (V.kit > 0) return refusal('tooSmall', { vis: id });   // a kitten under 60 days
    if (!st.visit || st.visit.id !== id || st.visit.until <= t) return refusal('notHere', { vis: id });
    if (smallKits(st, id, t).length) return refusal('hasKits', { vis: id });
    if (st.out) return refusal('outside');
    if (st.yard && st.yard.tree) return refusal('onTree');
    if (!R || R.friend < 5) return refusal('notFriend', { vis: id });
    if (palOf(R) < 3) return refusal('notPals', { vis: id });
    const h = new Date(t).getHours();
    if (h < 18 || h >= 22) return refusal('inviteHours', { from: 18, to: 22 });
    if (st.invDay === dkey(t)) return refusal('guestToday');
    return null;
  }
  // for the UI (the button and its reason); does not change st
  function canInvite(st, id, now) {
    const why = inviteWhy(st, id, typeof now === 'number' && Number.isFinite(now) ? Math.max(now, st.t) : st.t);
    return Object.assign({ ok: !why, reason: null }, why);
  }
  // the guest: sleeping together at night when Koxa sleeps in the house and has 4+ hearts for it; goes home at `until`
  function guestStep(st, t, dt, ev) {
    const G = st.guest, ms = Math.min(t + dt, G.until) - t;
    if (ms > 0 && st.asleep && !st.out && !st.yard && palOf(st.visitors[G.id]) >= 4) {
      if (!G.slept) { G.slept = true; ev.push({ type: 'guestSleep', id: G.id }); }
      const N = st.needs;
      N.love = clamp(N.love + GUEST.love * ms / HOUR, 0, 100); N.energy = clamp(N.energy + GUEST.energy * ms / HOUR, 0, 100);
    }
    if (t + dt >= G.until) guestOut(st, t + dt, ev);
  }
  function guestOut(st, t, ev) {
    const G = st.guest;
    st.guest = null;
    ev.push({ type: 'guestOut', id: G.id, slept: G.slept });
    addFriend(st, G.id, PAL_STEP, ev);       // a good night: +¼ heart from the cat, +¼ of Koxa's
    bumpPal(st, G.id, PAL_STEP, t, ev);
  }
  // where the cat likes to be stroked (null for an unknown id); line = which help line the UI shows: the cat's id for the
  // eight, 'small' for a small kitten, else the young cat's trait
  // st: needed for a kitten ('k1'…)
  function visitorLikes(id, st) {
    const L = st ? likesOf(st, id) : typeof id === 'string' && Object.prototype.hasOwnProperty.call(VISITOR_LIKES, id) ? VISITOR_LIKES[id] : null;
    if (!L) return null;
    return { likes: L.likes.slice(), dislikes: L.dislikes.slice(), gentle: L.max < 900, max: L.max, line: L.line || id };
  }
  // the likes of any visitor: the table for the eight; a small kitten likes it everywhere; a young cat by its trait
  function likesOf(st, id) {
    if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(VISITOR_LIKES, id)) return Object.assign({ line: id }, VISITOR_LIKES[id]);
    const V = visitor(st, id);
    if (!V) return null;
    if (V.small) return { likes: Object.keys(REGIONS), dislikes: [], max: 900, line: 'small' };
    const L = KIT_LIKES[V.trait] || KIT_LIKES.playful;
    return { likes: L.likes, dislikes: L.dislikes, max: L.max, line: KIT_LIKES[V.trait] ? V.trait : 'playful' };
  }
  function repairSocial(st, t) {
    const okT = v => typeof v === 'number' && Number.isFinite(v) && v >= T_MIN && v <= T_MAX;
    const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
    repairKits(st, t);
    const V = st.visitors && typeof st.visitors === 'object' && !Array.isArray(st.visitors) ? st.visitors : {};
    st.visitors = {};
    for (const k of Object.keys(V)) {
      const r = V[k];
      if (!isVisitor(st, k) || !r || typeof r !== 'object') continue;
      const friend = typeof r.friend === 'number' && Number.isFinite(r.friend) ? Math.round(clamp(r.friend, 0, 5) * 4) / 4 : 0;
      st.visitors[k] = {
        friend, pal: typeof r.pal === 'number' && Number.isFinite(r.pal) ? Math.round(clamp(r.pal, 0, 5) * 4) / 4 : friend,   // an older save: Koxa's = the player's
        met: okT(r.met) ? Math.min(r.met, t) : 0,
        visits: Number.isInteger(r.visits) ? clamp(r.visits, 0, CMAX) : 0,
        fed: isKey(r.fed) && r.fed <= dkey(t) ? r.fed : 0,
      };
    }
    st.visit = fixVisit(st.visit, t, st);
    const G = st.guest;
    st.guest = G && typeof G === 'object' && isVisitor(st, G.id) && okT(G.since) && G.since <= t && okT(G.until) && G.until > t &&
      G.until - G.since <= GUEST.max * HOUR && !kitUnder(st, G.id, G.since, KIT.grown) ? { id: G.id, since: G.since, until: G.until, slept: G.slept === true } : null;
    if (st.guest && st.visit && st.visit.id === st.guest.id) st.visit = null;
    st.invDay = isKey(st.invDay) && st.invDay <= dkey(t) ? st.invDay : 0;
    const J = st.jealous;
    st.jealous = J && typeof J === 'object' && isVisitor(st, J.id) && okT(J.since) && J.since <= t && J.since > t - JEALOUS.ok * MIN ? { since: J.since, id: J.id } : null;
    st.jealousAt = okT(st.jealousAt) && st.jealousAt <= t ? st.jealousAt : 0;
    const A = Array.isArray(st.album) ? st.album : [];
    st.album = [];
    for (const p of A) {
      if (st.album.length >= ALBUM_MAX) break;
      if (!p || typeof p !== 'object' || !okT(p.t)) continue;
      const str = (v, n, def) => (typeof v === 'string' ? v.slice(0, n) : def);
      const q = {
        t: Math.min(p.t, t), pose: str(p.pose, 20, 'sit'), room: PHOTO_ROOMS.includes(p.room) ? p.room : 'living',
        mood: ['happy', 'calm', 'grumpy', 'sad'].includes(p.mood) ? p.mood : 'calm',
        phase: ['night', 'morning', 'day', 'evening'].includes(p.phase) ? p.phase : 'day',
        season: ['spring', 'summer', 'autumn', 'winter'].includes(p.season) ? p.season : 'spring',
        note: str(p.note, 60, ''), visitor: isVisitor(st, p.visitor) ? p.visitor : null,
      };
      // Phase B fields only when present (an older photo stays as it was); the visitor's place only with a visitor
      if (q.visitor) photoVisitor(q, p);
      if (p.nokoxa === true && q.visitor) q.nokoxa = true;
      if (q.visitor && Array.isArray(p.kits)) photoKits(st, q, p.kits);
      st.album.push(q);
    }
  }
  // the kittens and the litter plan (SPEC §8b Phase C): a broken kitten is dropped, ids unique, at most 3 litters of 4
  // (a litter = a block of ids, kitLit: one mother, one birth, the first kitten kept decides), names cleaned, born by
  // now; the litter record agrees with the kittens
  function repairKits(st, t) {
    const okT = v => typeof v === 'number' && Number.isFinite(v) && v >= T_MIN && v <= T_MAX;
    const A = Array.isArray(st.kits) ? st.kits : [], ids = new Set(), lit = new Set();
    st.kits = [];
    for (const k of A) {
      if (!k || typeof k !== 'object' || !isKitId(k.id) || ids.has(k.id) || !MOTHERS.includes(k.mother) || !okT(k.born) || k.born > t) continue;
      const head = st.kits.find(o => kitLit(o.id) === kitLit(k.id));
      if (head && head.mother !== k.mother) continue;
      lit.add(kitLit(k.id));
      ids.add(k.id);
      const born = head ? head.born : k.born, named = typeof k.name === 'string' && !!k.name.trim();
      st.kits.push({
        id: k.id, mother: k.mother, name: named ? cleanName(k.name) : kitNamesNow.kitten,
        named: named && k.named === true, fem: k.fem === true,
        coat: k.coat === k.mother || TOMS.includes(k.coat) ? k.coat : k.mother, born,
        trait: Object.prototype.hasOwnProperty.call(KIT_TRAITS, k.trait) ? k.trait : 'playful',
        solo: okT(k.solo) && k.solo >= born + KIT.alone * DAY && k.solo <= t ? k.solo : 0,
      });
    }
    const L = st.litter, n = st.kits.reduce((m, k) => Math.max(m, kitLit(k.id)), lit.size);
    const last = st.kits.reduce((b, k) => (!b || k.born > b.born ? k : b), null);
    if (L && typeof L === 'object' && MOTHERS.includes(L.mother) && okT(L.since) && L.since <= t && okT(L.back) && L.back >= L.since + 2 * DAY &&
      L.back <= L.since + 3 * DAY) {
      st.litter = { mother: L.mother, since: L.since, back: L.back, count: clamp(Math.max(Number.isInteger(L.count) ? L.count : 1, n, 1), 1, KIT.max) };
    } else st.litter = last ? { mother: last.mother, since: last.born, back: last.born + 2 * DAY, count: clamp(n, 1, KIT.max) } : null;
  }
  // the small kittens in a photo with their mother (only known kittens of hers)
  function photoKits(st, p, kits) {
    const ks = st.kits.filter(k => k.mother === p.visitor && kits.includes(k.id)).map(k => k.id);
    if (ks.length) p.kits = ks;
  }
  function shiftSocial(st, d, now) {
    const today = dkey(now);
    for (const k of Object.keys(st.visitors)) { const r = st.visitors[k]; if (r.met > now) r.met = now; if (r.fed > today) r.fed = today; }
    // the kittens keep their age and the litter plan its days: they move with the clock (a birth is never in the future,
    // and two litters of one mother never become one)
    for (const k of st.kits) { k.born = Math.max(T_MIN, k.born + d); if (k.solo) k.solo = Math.max(k.born + KIT.alone * DAY, k.solo + d); }
    if (st.litter) st.litter = { mother: st.litter.mother, since: st.litter.since + d, back: st.litter.back + d, count: st.litter.count };
    if (st.visit) {
      const V = st.visit, A = V.act && typeof V.act === 'object' ? V.act : {}, kp = {};
      for (const k of Object.keys(V.kp || {})) { const p = V.kp[k]; kp[k] = Object.assign({}, p, { pet: p.pet ? p.pet + d : 0, play: p.play ? p.play + d : 0 }); }
      st.visit = fixVisit(Object.assign({}, V, { since: V.since + d, until: V.until + d, ready: typeof V.ready === 'number' ? V.ready + d : null,
        act: Object.assign({}, A, { since: A.since + d }), pet: V.pet ? V.pet + d : 0, play: V.play ? V.play + d : 0, noticed: V.noticed ? V.noticed + d : 0, kp }), now, st);
    }
    if (st.guest) st.guest = { id: st.guest.id, since: st.guest.since + d, until: st.guest.until + d, slept: st.guest.slept };
    if (st.invDay > today) st.invDay = today;
    if (st.jealous) st.jealous = { since: st.jealous.since + d, id: st.jealous.id };
    if (st.jealousAt) st.jealousAt += d;
    for (const p of st.album) if (p.t > now) p.t = now;
  }
  // the Album screen: photos (newest first), postcards, the neighbour cats met, presents
  // (Phase C: grown kittens once seen are visitors too; kittens = every kitten seen, with its mother and age)
  function album(st) {
    const vis = VISITOR_IDS.concat(st.kits.filter(k => visitor(st, k.id).kit === 0).map(k => k.id));
    return {
      photos: st.album.slice().reverse(), max: ALBUM_MAX,
      postcards: st.postcards.slice(),
      visitors: vis.filter(id => st.visitors[id] && (st.visitors[id].met || (isKitId(id) && st.visitors[id].visits))).map(id => ({
        id, name: visitor(st, id).name, trait: visitor(st, id).trait, hearts: Math.floor(st.visitors[id].friend), pal: Math.floor(palOf(st.visitors[id])), met: st.visitors[id].met, visits: st.visitors[id].visits,
      })),
      kittens: st.kits.filter(k => kitSeen(st, k)).map(k => {
        const V = visitor(st, k.id), R = st.visitors[k.id];
        return { id: k.id, name: k.name, named: k.named, mother: k.mother, ageDays: V.ageDays, kit: V.kit, coat: k.coat, fem: k.fem,
          trait: k.trait, hearts: Math.floor(R.friend), pal: Math.floor(palOf(R)) };
      }),
      presents: Object.assign({}, st.presents),
    };
  }

  // pamlsky from the launcher link (§10): n = the number the launcher counted
  function consumeTreats(st, n, now) {
    const ev = advance(st, now).events;
    const k = typeof n === 'number' && Number.isFinite(n) ? Math.floor(clamp(n, 0, 1000)) : 0;
    if (k > 0) { st.pamlsky = Math.min(99999, st.pamlsky + k); ev.push({ type: 'gift', n: k }); }
    return { st, events: ev };
  }

  return {
    NEEDS, FOODS, TOYS, REGIONS, FEARS, QUIRKS, ILLS, LEVELS, HOLIDAYS, ACTIONS, CROPS, PRESENTS, WEATHERS, POSTCARDS, BEDS,
    SHOP, GAMES, TRICKS, ROOMS, EARN_CAP, VISITORS, VISIT_ACTS, VISITOR_LIKES, ALBUM_MAX, album, canInvite, visitorLikes,
    KIT, KIT_NAMES, setKitNames, kitNames, visitor, visitorIds, kitsNew, TEASE, patTempo, BOWL, DISH, SLEEP_PLACES, bowls, mealTime, mealTimes, SLEEP, CALL, NOTICE,
    create, valid, repair, rename, advance, act, consumeTreats, minigameResult, shop, tricks,
    mood, moodValue, wants, needs, health, bondLevel, diary,
    dayPhase, season, holiday, easter, weather, postcardAt, bedCount,
    WX, wmoChar, wxParse, wxValid, setWx, sky,
    HIDE, CATCH, LEAF, MEM, DREAMS, hideSpots, hideScore, dream, leafPile,
  };
}
