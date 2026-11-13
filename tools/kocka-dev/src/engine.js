// Koxa's life (SPEC §2–6, §9–10). Pure: no DOM, no clock, no global randomness: time comes in as `now` (ms) and every
// random draw comes from st.seed (+ the counter st.n, or a day number), so the same state and the same calls always
// give the same result. Runs in the browser and in Node (tools/kocka-test.js).
//
// Mutation: create() and repair() of a non-object return a new state; advance(), act(), consumeTreats(), rename()
// and valid()/repair() of an object change the given st in place and return it ({ st, events } for the first four).
// The constants (FOODS, TOYS, …) are frozen and never changed.
//
// Events, { type, … } (the UI decides what to show; "watching" = an advance over at most one hour):
//   ate { food, gain, left, fav }   she ate (left: she left the rest, the bowl was too full)
//   drank { tap }                   water poured; tap: she drank from the tap instead (quirk)
//   purr { region?, sleeping? }     a happy stroke, a favourite spot, a welcome belly rub, being held
//   bite                            a playful nip (belly, grumpy)
//   earsBack { rough? }             stroked against the fur or too fast
//   content { region } / tolerate { region }  a good stroke without a purr: she enjoys it (calm; grumpy or sad
//                                   30 %) / she puts up with it (grumpy or sad, or sideways); every stroke gets a reaction
//   wriggle                         she does not want to be held
//   held / put { place }            picked up / put down
//   played { toy, gain, fav }       a toy worked
//   ignore { reason }               she ignored a toy or a call (sad, tired, asleep)
//   brushed { gain } / flea         brushing; flea: she has fleas (coat +10 only)
//   clean                           the litter box was cleaned
//   litter                          she used the litter box (watching only)
//   treat                           she ate a treat (pamlsky −1)
//   pill                            the extra pill after a lost pill minigame was given
//   out { until } / back { minutes } let out / came home (letIn or by herself)
//   come / turnBack                 a call: she comes / turns her back (offended, once)
//   scared { what } / curious { what }  met a vacuum, a storm, fireworks (scared only when it is her fear)
//   sleep { place } / wake { early } she fell asleep ('bed' | 'sun' | 'box') / woke up (watching or caused by an act)
//   meow { want }                   she started to want something (watching only)
//   ill { kind } / cured { kind, by: 'vet' | 'time', paid?, short? }
//   weighed { kg, delta }           once a local day
//   levelUp { level, name }         a new bond level
//   birthday { age }                adoption anniversary (bond +10)
//   offended { days }               back from paní Nováková after more than 72 h away
//   lapOn / lapOff { dozing }       she settled on the lap / the player stood up (she gets down calmly)
//   lapLeave { reason, minutes }    she jumped down and ran off: 'hungry' | 'thirsty' | 'bored' | 'offended' |
//                                   'annoyed' | 'scared' | 'restless' (nothing in particular) | 'away' (the app was closed)
//   lapDoze                         she dozed off on the lap (stays until stroked awake or the player stands up)
//   garden { weather } / house      she goes out into the garden with the player / back into the house
//   wet / snowPaws                  rain soaked her (grumpy for 2 h, coat −) / she shakes snow off her paws
//   present { item }                a dárek: 'feather' (pírko) | 'leaf' (lísteček) | 'cone' (šiška); garden or a walk
//   climbStuck / climbDown { by }   stuck on the tree / down again: 'call' | 'fetch' | 'self' (after 30 min at most)
//   sown { bed, crop } / watered { n } / ripe { bed, crop } / harvested { bed, crop, n }   the beds
//   catnip                          šanta kočičí: fun +60, wild zoomies
//   (back gets { walk, postcard, present } after a walk: postcard = index 0–41 into IMAGE_SETS.nachod)
//   bought { id, kind } / placed { id, room } / sold { crop, n, earned }   the shop (Obchůdek) and furniture
//   earned { n, game?, trick? } / capReached / record { game, best, prev }  minigame and trick rewards
//   perform { trick, ok, shown?, understood?, reason? } / learned { trick } / trickLearned { trick } / trickRefused { trick, reason }
//                                   Výcvik: a wrong cue = understood false; a refused right cue = understood true with
//                                   reason 'tired' | 'grumpy' | 'notNow'; trickLearned = training an already learned trick
//   visitor { id, reaction } / visitorLeave { id, reason: 'time'|'shy'|'night'|'rain' } / visitorFed / visitorPurr /
//   visitorHiss / visitorFriend { id, hearts }   neighbour cats; reaction = Koxa's: 'hiss' | 'play' | 'friends' | 'watch' | 'away'
//   visitAct { id, kind, with }     the visitor started another act (st.visit.act; watching only, or Koxa left the garden):
//                                   kind of VISIT_ACTS, with = 'koxa' (together with her) | null (alone); 'arrive' follows 'visitor'
//   palUp { id, pal }               Koxa's own friendship with a neighbour cat reached another whole heart (pal 1–5)
//   photo { n } / photoDeleted { n }   the album
//   gift { n }                      pamlsky from the launcher link
//   found { id, text }              a new Deníček entry
//   quirk { id }                    her quirk was seen
//   refused { reason }              the action is not possible now (Czech reason)
function KockaEngine() {
  const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR, STEP = 10 * MIN;
  const AWAY = 72 * HOUR;          // longer absence: paní Nováková took her (§4); the rest is not simulated
  const HELP = 24 * HOUR;          // after a day without anybody paní Nováková looks in (any absence): food, water and litter
  const HELP_MIN = 20;             // kept ≥ 20: never ill from it, but never better off than a day earlier
  const T_MIN = Date.UTC(2000, 0, 1), T_MAX = Date.UTC(2200, 0, 1);
  const deep = o => { for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') deep(o[k]); return Object.freeze(o); };
  // needs falling per hour; [day, night or asleep] (fun: [morning/day, evening, night or asleep]); tuned so that two visits
  // a day with basic care keep her calm or happy (tools/kocka-test.js "Balance")
  const RATE = deep({ food: [4, 2], water: [3.5, 2], fun: [2.5, 3.5, 0.5], love: [2, 0.5], coat: 0.5, energy: [3, 8] });
  // the lap (SPEC §12d): leaving is a seeded hazard per minute, so the step length does not matter
  const LAP = deep({
    leave: 0.35,          // per minute when content: a session of about 3 min (median 2), with gentle stroking 0.6× (about 5 min)
    petted: 0.6, sleepyHappy: 0.5,                         // stroked within the last minute; energy < 50 and happy
    hungry: 3, bored: 2, offended: 3, scared: 6,           // food or water < 25; fun < 25; offended; a fright
    annoy: 2,             // + 2× per point of annoyance: against the fur / too fast +1, a belly rub +0.5, a bite +2
    calm: 0.5,            // annoyance fades by 0.5 a minute
    settle: 0.5,          // minutes after settling before she may leave (unless annoyed)
    doze: 0.5,            // per minute when energy < 60, calm or happy, not annoyed, 20 s – 2 min after the last stroke (or night);
                          // ×2 when energy < 35, ×2 at night; while dozing she never leaves, wakes when stroked or rested
    away: 15,             // minutes: an advance longer than this ends the lap (nobody sits in the chair any more)
    dozeMax: 90,          // minutes: a doze on the lap ends by itself (then she may leave as usual)
  });
  const TARGET_W = 4.2, FED_W = 4.5;   // a thin cat recovers to 4.2; plain food alone never makes her heavier than 4.5

  /* --- constants --- */
  const NEEDS = deep(['food', 'water', 'energy', 'fun', 'love', 'clean']);
  const FOODS = deep({
    kibble: { name: 'granule', acc: 'granule', gain: 35, price: 0 },
    pouch: { name: 'kapsička', acc: 'kapsičku', gain: 45, price: 2 },
    chicken: { name: 'kuře', acc: 'kuře', gain: 50, price: 3 },
    tuna: { name: 'tuňák', acc: 'tuňáka', gain: 55, price: 4 },
  });
  const CHARGE_FOOD = true;        // special food: a serving from st.stock, else FOODS[k].price pamlsky (granule free)
  const CHARGE_SEEDS = true;       // seeds: from st.stock ('seed_<crop>'), else CROPS[k].seed pamlsky
  // the garden beds (§12e, pulled forward from Etapa 3): growth = watered days (rain counts), none Dec–Feb, never dies
  const CROPS = deep({
    // yield = pieces per harvest; a pack of 3 seeds sells for 1.5× its price, a single seed for 1.2–1.33× (gardening pays a
    // little, about 0.5–0.7 pamlsku a bed a day: far less than the minigames)
    radish: { name: 'ředkvička', acc: 'ředkvičku', unripe: 'Ředkvička ještě není zralá.', days: 2, seed: 3, sell: 2, yield: 2 },
    carrot: { name: 'mrkev', acc: 'mrkev', unripe: 'Mrkev ještě není zralá.', days: 4, seed: 5, sell: 3, yield: 2 },
    strawberry: { name: 'jahody', acc: 'jahody', unripe: 'Jahody ještě nejsou zralé.', days: 5, seed: 8, sell: 5, yield: 2 },
    tomato: { name: 'rajče', acc: 'rajče', unripe: 'Rajče ještě není zralé.', days: 6, seed: 9, sell: 4, yield: 3 },
    catnip: { name: 'šanta kočičí', acc: 'šantu', unripe: 'Šanta kočičí ještě není zralá.', days: 3, seed: 7, sell: 0, yield: 1 },
  });
  const BEDS = 6;                  // 4 usable, 6 from bond level Parťačka (600)
  const PRESENTS = deep({ feather: { name: 'pírko', acc: 'pírko' }, leaf: { name: 'lísteček', acc: 'lísteček' }, cone: { name: 'šiška', acc: 'šišku' } });
  const POSTCARDS = 42;            // IMAGE_SETS.nachod has 42 photos
  const WEATHERS = deep({ clear: { name: 'jasno' }, cloudy: { name: 'zataženo' }, rain: { name: 'déšť' }, snow: { name: 'sníh' } });
  // the garden with the player, per hour: fun rises, the coat suffers; chances of a dárek and of getting stuck on the tree
  const GARDEN = deep({ fun: 10, coat: 1.5, rainCoat: 4, wetFor: 2 * 60, present: 0.2, tree: 0.15, treeMax: 30, alone: [60, 180] });
  const WALK_BOND = 2;             // toulky (letOut) from bond level Kamarádka (300)
  // toys: the four she has from the start (one is her favourite), and shop toys (bought: 'owned'); base = its kind
  const TOYS = deep({
    mouse: { name: 'myška', ins: 's myškou' }, feather: { name: 'peříčko', ins: 's peříčkem' },
    ball: { name: 'klubíčko', ins: 's klubíčkem' }, laser: { name: 'laser', ins: 's laserem' },
    catnipMouse: { name: 'myška se šantou', ins: 's myškou se šantou', base: 'mouse', shop: true, bonus: 15 },
    bellBall: { name: 'míček s rolničkou', ins: 's míčkem s rolničkou', base: 'ball', shop: true, bonus: 10 },
    featherWand: { name: 'udice s peříčkem', ins: 's udicí s peříčkem', base: 'feather', shop: true, bonus: 10 },
    tunnel: { name: 'tunel', ins: 's tunelem', base: 'tunnel', shop: true, bonus: 10 },
    box: { name: 'krabice', ins: 's krabicí', base: 'box', shop: true, bonus: 5 },
  });
  const BASE_TOYS = deep(['mouse', 'feather', 'ball', 'laser']);
  const ROOMS = deep(['living', 'kitchen', 'hall', 'garden']);
  // the shop (Obchůdek); bond = the bond level (0–4) from which it is offered; room: where furniture goes (fixed: only there)
  const SHOP = deep([
    { id: 'pouch5', kind: 'food', name: 'Kapsičky (5 porcí)', price: 8, bond: 0, room: null, stock: 'pouch', n: 5 },
    { id: 'chicken5', kind: 'food', name: 'Kuře (5 porcí)', price: 12, bond: 0, room: null, stock: 'chicken', n: 5 },
    { id: 'tuna5', kind: 'food', name: 'Tuňák (5 porcí)', price: 16, bond: 1, room: null, stock: 'tuna', n: 5 },
    { id: 'sticks5', kind: 'treat', name: 'Kočičí tyčinky (5 kusů)', price: 6, bond: 0, room: null, stock: 'stick', n: 5 },
    { id: 'catnipMouse', kind: 'toy', name: 'Myška se šantou', price: 10, bond: 0, room: null },
    { id: 'bellBall', kind: 'toy', name: 'Míček s rolničkou', price: 12, bond: 0, room: null },
    { id: 'box', kind: 'toy', name: 'Krabice', price: 10, bond: 0, room: 'living' },
    { id: 'featherWand', kind: 'toy', name: 'Udice s peříčkem', price: 15, bond: 1, room: null },
    { id: 'tunnel', kind: 'toy', name: 'Tunel', price: 20, bond: 1, room: 'living' },
    { id: 'scratcher', kind: 'furniture', name: 'Škrabadlo', price: 30, bond: 0, room: 'living' },
    { id: 'rug', kind: 'furniture', name: 'Koberec', price: 35, bond: 0, room: 'living' },
    { id: 'lamp', kind: 'furniture', name: 'Lampa', price: 30, bond: 0, room: 'living' },
    { id: 'birdFeeder', kind: 'furniture', name: 'Krmítko pro ptáky', price: 25, bond: 0, room: 'garden', fixed: true },
    { id: 'sillCushion', kind: 'furniture', name: 'Parapet s polštářem', price: 40, bond: 1, room: 'living' },
    { id: 'bedDeluxe', kind: 'furniture', name: 'Pelíšek deluxe', price: 60, bond: 1, room: 'living' },
    { id: 'catTree', kind: 'furniture', name: 'Kočičí strom', price: 120, bond: 2, room: 'living' },
    { id: 'catFlap', kind: 'furniture', name: 'Kočičí dvířka', price: 80, bond: 2, room: 'hall', fixed: true },
    { id: 'visitorBowl', kind: 'furniture', name: 'Miska pro návštěvy', price: 15, bond: 0, room: 'garden', fixed: true },
    { id: 'seedsRadish', kind: 'seed', name: 'Semínka ředkvičky (3 sáčky)', price: 8, bond: 0, room: null, stock: 'seed_radish', n: 3 },
    { id: 'seedsCarrot', kind: 'seed', name: 'Semínka mrkve (3 sáčky)', price: 12, bond: 0, room: null, stock: 'seed_carrot', n: 3 },
    { id: 'seedsStrawberry', kind: 'seed', name: 'Sazenice jahod (3 kusy)', price: 20, bond: 0, room: null, stock: 'seed_strawberry', n: 3 },
    { id: 'seedsTomato', kind: 'seed', name: 'Sazenice rajčat (3 kusy)', price: 24, bond: 1, room: null, stock: 'seed_tomato', n: 3 },
    { id: 'seedsCatnip', kind: 'seed', name: 'Semínka šanty (3 sáčky)', price: 18, bond: 1, room: null, stock: 'seed_catnip', n: 3 },
  ]);
  const SHOP_BY = {}; for (const it of SHOP) SHOP_BY[it.id] = it;
  const STOCK_KEYS = ['pouch', 'chicken', 'tuna', 'stick'].concat(Object.keys(CROPS).map(c => 'seed_' + c));
  // minigames (the UI plays them; the engine rewards): pamlsky = min(max, floor(score / per)); 30 a day from all of them
  const GAMES = deep({
    mouse: { name: 'Chyť myšku', per: 3, max: 10 }, laserRun: { name: 'Laserová honička', per: 1, max: 8 },
    feather: { name: 'Peříčko', per: 2, max: 10 }, fishing: { name: 'Rybaření', per: 1, max: 8 }, pill: { name: 'Pilulka', per: 1, max: 3 },
  });
  const EARN_CAP = 30;
  // Výcvik: bond needed (the value), the cue gesture the Input sends; 5 rewarded performances = learned
  const TRICKS = deep({
    sedni: { name: 'Sedni', bond: 100, cue: 'swipeUp' }, dejPac: { name: 'Dej pac', bond: 300, cue: 'tapPaw' },
    otocSe: { name: 'Otoč se', bond: 500, cue: 'circle' }, panacek: { name: 'Panáček', bond: 750, cue: 'swipeUp2' },
  });
  const TRICK_N = 5, TREAT_WINDOW = 1500;
  // Czech: 1 pamlsek, 2–4 pamlsky, 5+ pamlsků
  const pml = n => (n === 1 ? '1 pamlsek' : n >= 2 && n <= 4 ? `${n} pamlsky` : `${n} pamlsků`);
  // body regions (Input/Art use the same ids); spot: may be one of her favourite spots
  const REGIONS = deep({
    chin: { name: 'brada', loc: 'na bradě', spot: true, scratch: true },
    ears: { name: 'za ušima', loc: 'za ušima', spot: true, scratch: true },
    head: { name: 'hlava', loc: 'na hlavě', spot: true, scratch: true },
    back: { name: 'záda', loc: 'na zádech', spot: true },
    tailBase: { name: 'kořen ocasu', loc: 'u kořene ocasu', spot: true },
    belly: { name: 'bříško', loc: 'na bříšku' },
    tail: { name: 'ocas', loc: 'na ocase' }, paws: { name: 'tlapky', loc: 'na tlapkách' },
  });
  const REGION_ALIAS = deep({ paw: 'paws', side: 'back' });   // older or other spellings of the same region
  const regionOf = (r, def) => typeof r !== 'string' ? def : Object.prototype.hasOwnProperty.call(REGIONS, r) ? r : Object.prototype.hasOwnProperty.call(REGION_ALIAS, r) ? REGION_ALIAS[r] : def;
  const SPOTS = deep(Object.keys(REGIONS).filter(k => REGIONS[k].spot));
  const FEARS = deep({ vacuum: { name: 'vysavač', gen: 'vysavače' }, storm: { name: 'bouřka', gen: 'bouřky' }, fireworks: { name: 'ohňostroj', gen: 'ohňostroje' } });
  const QUIRKS = deep({
    wakesEarly: { name: 'budí ráno', text: n => `${n} ráno budí celý dům.` },
    box: { name: 'spí v krabici', text: n => `${n} nejraději spí v krabici.` },
    socks: { name: 'krade ponožky', text: n => `${n} krade ponožky.` },
    tap: { name: 'pije z kohoutku', text: n => `${n} nejraději pije z kohoutku.` },
  });
  const ILLS = deep({ fleas: { name: 'blechy' }, tummy: { name: 'bolavé bříško' }, cold: { name: 'rýma' } });
  const LEVELS = deep([{ min: 0, name: 'Nová' }, { min: 100, name: 'Známá' }, { min: 300, name: 'Kamarádka' }, { min: 600, name: 'Parťačka' }, { min: 900, name: 'Nejlepší kamarádka' }]);
  const HOLIDAYS = deep({
    advent: { name: 'Advent', prop: 'wreath' }, mikulas: { name: 'Mikuláš', prop: 'stocking' },
    vanoce: { name: 'Vánoce', prop: 'tree' }, silvestr: { name: 'Silvestr', prop: 'fireworks' },
    masopust: { name: 'Masopust', prop: 'mask' }, velikonoce: { name: 'Velikonoce', prop: 'eggs' },
    carodejnice: { name: 'Čarodějnice', prop: 'witchHat' }, dusicky: { name: 'Dušičky', prop: 'candle' },
    birthday: { name: 'Narozeniny', prop: 'cake' },
  });
  const ACTIONS = deep(['feed', 'water', 'stroke', 'scratch', 'pickUp', 'putDown', 'play', 'brush', 'cleanLitter', 'letOut', 'letIn', 'treat', 'vetCure', 'pill', 'call', 'vacuum', 'lapOn', 'lapOff',
    'goGarden', 'goHouse', 'fetchDown', 'sow', 'waterBeds', 'harvest', 'catnip', 'buy', 'place', 'sell', 'train', 'showTrick',
    'feedVisitor', 'strokeVisitor', 'photo', 'deletePhoto']);
  const CMAX = 1e6;  // counters saturate here (inc)
  const COUNTS = ['favFood', 'belly', 'toy', 'quirk'].concat(SPOTS.map(s => 'spot_' + s));
  // pal*: Koxa and a neighbour cat (the cat is st.diaryCat[id])
  const PAL_DIARY = ['palFirst', 'palGroom', 'palSnuggle'];
  const DIARY_IDS = ['favFood'].concat(SPOTS.map(s => 'spot_' + s), ['belly', 'toy', 'fear', 'quirk', 'weight', 'walk', 'birthday'], PAL_DIARY);

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
  const ymd = ms => { const d = new Date(ms); return [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]; };
  const dkey = ms => { const [y, m, d] = ymd(ms); return y * 10000 + (m + 1) * 100 + d; };   // local day, 20261112
  const dayNo = (y, m, d) => Math.round(Date.UTC(y, m, d) / DAY);                         // calendar day number
  const keyNo = k => dayNo(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100);
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
  function weather(ms, st) {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) return 'clear';
    const seed = st && Number.isInteger(st.seed) ? st.seed : 0, [y, m, d] = ymd(ms), no = dayNo(y, m, d);
    if (stormDay(seed, no, m)) return 'rain';
    let r = rndSeed(seed, no, 7);
    for (const [w, p] of WEATHER_P[season(ms)]) { if (r < p) return w; r -= p; }
    return 'clear';
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
  const freshDay = ms => ({ key: dkey(ms), ms: 0, food: 0, mood: 0, minE: 100, treats: 0, ttreats: 0, q: false, acted: false });

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
      visitors: {}, visit: null, album: [], diaryCat: {},
    };
    for (const k of COUNTS) st.cnt[k] = 0;
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
    const B = Array.isArray(st.beds) ? st.beds : [];
    st.beds = [];
    for (let i = 0; i < BEDS; i++) {
      const b = B[i];
      st.beds.push(b && typeof b === 'object' && has(CROPS, b.crop) && okT(b.sown) ? {
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
    st.litterAt = okT(st.litterAt) && st.litterAt >= t - 2 * DAY && st.litterAt <= t + 9 * HOUR ? st.litterAt : t + 8 * HOUR;
    st.walkMax = num(st.walkMax, 0, 0, 100 * DAY);
    const year = new Date(t).getFullYear();
    st.bday = Number.isInteger(st.bday) && st.bday >= 2000 && st.bday <= year ? st.bday : year;
    st.pill = isKey(st.pill) && st.pill <= dkey(t + DAY) ? st.pill : 0;
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
    for (const k of PAL_DIARY) if (st.diary[k] && has(VISITORS, DC[k])) st.diaryCat[k] = DC[k];
    const d = st.day;
    st.day = d && typeof d === 'object' && isKey(d.key) && d.key <= dkey(t) && typeof d.ms === 'number' && d.ms >= 0 && d.ms <= 26 * HOUR ? {
      key: d.key, ms: num(d.ms, 0, 0, 2 * DAY), food: num(d.food, 0, 0, 200 * DAY), mood: num(d.mood, 0, -200 * DAY, 200 * DAY),
      minE: num(d.minE, 100, 0, 100), treats: Math.floor(num(d.treats, 0, 0, 1000)), ttreats: Math.floor(num(d.ttreats, 0, 0, 1000)), q: d.q === true, acted: d.acted === true,
    } : freshDay(t);
    if (st.day.food > st.day.ms * 100 + 1) st.day.food = st.day.ms * 50;
    if (Math.abs(st.day.mood) > st.day.ms * 100 + 1) st.day.mood = 0;
    st.want = NEED_WANTS.includes(st.want) ? st.want : null;
    const W = st.wantAt && typeof st.wantAt === 'object' ? st.wantAt : {};
    st.wantAt = {}; for (const k of Object.keys(W)) if (NEED_WANTS.includes(k) && okT(W[k])) st.wantAt[k] = Math.min(W[k], t);
    for (const k of Object.keys(st)) if (!STATE_KEYS.includes(k)) delete st[k];
    return st;
  }
  const STATE_KEYS = ['v', 'seed', 'n', 't', 'born', 'name', 'needs', 'weight', 'bond', 'lvl', 'pamlsky', 'asleep', 'sleepAt', 'wokeAt', 'held', 'heldAt', 'pickAt', 'place', 'out', 'ill', 'acc', 'off', 'scared', 'litterAt', 'walkMax', 'bday', 'pill', 'traits', 'cnt', 'diary', 'day', 'want', 'wantAt', 'lap', 'yard', 'wet', 'beds', 'pantry', 'postcards', 'presents', 'stock', 'owned', 'furniture', 'records', 'tricks', 'earnDay', 'train', 'visitors', 'visit', 'album', 'diaryCat'];
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
    if (st.wet > st.t) m -= 15;                       // wet from the rain: grumpy for a while
    if (st.visit && !st.out) {   // a neighbour cat in the garden: what they do together, else how she takes it
      const A = st.visit.act;
      m += A && A.with === 'koxa' && Object.prototype.hasOwnProperty.call(VISIT_ACTS, A.kind) ? VISIT_ACTS[A.kind].mood : VISIT_MOOD[reaction(st, st.visit.id)];
    }
    if (st.yard && st.yard.tree) m -= 10;             // stuck on the tree
    return Math.round(clamp(m, -100, 100));
  }
  const moodName = v => v >= 50 ? 'happy' : v >= 10 ? 'calm' : v >= -30 ? 'grumpy' : 'sad';
  function mood(st) { return moodName(moodValue(st)); }
  function wants(st) {
    const v = needs(st);
    let best = null;
    for (const k of NEED_WANTS) if (v[k] < 40 && (best === null || v[k] < v[best])) best = k;
    return best;
  }
  function levelOf(bond) { let l = 0; for (let i = 0; i < LEVELS.length; i++) if (bond >= LEVELS[i].min) l = i; return l; }
  function bondLevel(st) {
    const l = st.lvl;
    return { level: l, name: LEVELS[l].name, bond: Math.round(st.bond), min: LEVELS[l].min, next: l + 1 < LEVELS.length ? LEVELS[l + 1].min : null };
  }
  function health(st) {
    const t = st.t;
    return {
      ill: st.ill ? st.ill.kind : null, illName: st.ill ? ILLS[st.ill.kind].name : null, illSince: st.ill ? st.ill.since : null,
      illDaysLeft: st.ill ? Math.max(0, Math.ceil((st.ill.since + 4 * DAY - t) / DAY)) : 0,
      weight: r2(st.weight), thin: st.weight < 3.6, chubby: st.weight > 5.0,
      offended: !!(st.off && t < st.off.until), scared: st.scared > t, asleep: st.asleep, out: !!st.out, held: st.held,
      lap: !!st.lap, lapSince: st.lap ? st.lap.since : null, lapDoze: !!(st.lap && st.lap.doze),
      garden: !!st.yard, wet: st.wet > t, tree: !!(st.yard && st.yard.tree), walk: !!(st.out && st.out.walk),
      pill: st.pill ? (dkey(t) >= st.pill ? 'today' : 'tomorrow') : null,
    };
  }

  /* --- bond, diary --- */
  function addBond(st, d, ev) {
    st.bond = clamp(st.bond + d, LEVELS[st.lvl].min, 1000);
    const l = levelOf(st.bond);
    if (l > st.lvl) { st.lvl = l; ev.push({ type: 'levelUp', level: l, name: LEVELS[l].name }); }
  }
  function find(st, id, t, ev) {
    if (st.diary[id]) return;
    st.diary[id] = t;
    ev.push({ type: 'found', id, text: entryText(st, id, st.name) });
  }
  function fmtDur(ms) { const m = Math.round(ms / MIN), h = Math.floor(m / 60); return h ? `${h} h ${m % 60} min` : `${m} min`; }
  function entryText(st, id, name) {
    const T = st.traits;
    if (id === 'favFood') return `${name} nejraději papá ${FOODS[T.favFood].acc}.`;
    if (id.startsWith('spot_')) return `${name} se moc ráda nechá hladit ${REGIONS[id.slice(5)].loc}.`;
    if (id === 'belly') return `${name} si někdy nechá podrbat bříško. Ale jen někdy!`;
    if (id === 'toy') return `${name} si nejraději hraje ${TOYS[T.toy].ins}.`;
    if (id === 'fear') return `${name} se bojí ${FEARS[T.fear].gen}.`;
    if (id === 'quirk') return QUIRKS[T.quirk].text(name);
    if (id === 'weight') return `${name} váží ${st.weight.toFixed(1).replace('.', ',')} kg.`;
    if (id === 'walk') return `Nejdelší toulka trvala ${fmtDur(st.walkMax)}.`;
    if (id === 'birthday') { const [y, m, d] = ymd(st.born); return `${name} k nám přišla ${d}. ${m + 1}. ${y}.`; }
    if (PAL_DIARY.includes(id)) {
      const c = st.diaryCat && Object.prototype.hasOwnProperty.call(VISITORS, st.diaryCat[id]) ? VISITORS[st.diaryCat[id]] : null;
      const f = c && c.fem;   // Koxa is a she: the plural is feminine only with a female cat
      if (id === 'palFirst') return c ? (f ? `${name} má první kamarádku: ${c.name}.` : `${name} má prvního kamaráda: ${c.name}.`) : `${name} má prvního kočičího kamaráda.`;
      if (id === 'palGroom') return c ? `${name} a ${c.name} si poprvé navzájem ${f ? 'umyly' : 'umyli'} kožíšky.` : `${name} a kamarád si poprvé navzájem umyli kožíšky.`;
      return c ? `${name} a ${c.name} si poprvé ${f ? 'zdřímly' : 'zdřímli'} schoulen${f ? 'é' : 'í'} u sebe.` : `${name} si poprvé zdřímla schoulená u kamaráda.`;
    }
    return '';
  }
  const HINTS = {
    favFood: 'Co nejraději papá? Zkoušej různé dobroty.', belly: 'Nechá si podrbat bříško?',
    toy: 'S čím si nejraději hraje?', fear: 'Čeho se bojí?', quirk: 'Jaký má zvláštní zvyk?',
    weight: 'Kolik váží? Uvidíš zítra.', walk: 'Ještě nebyla venku.', birthday: '',
    palFirst: 'Najde si kamaráda mezi kočkami od sousedů? Choď s ní na zahradu, když přijde návštěva.',
    palGroom: 'Budou si s kamarádem navzájem mýt kožíšek?', palSnuggle: 'Zdřímne si někdy schoulená u kamaráda?',
  };
  // Deníček: her two spots only; text = the fact when found, else a question
  function diary(st, name) {
    const nm = cleanName(name || st.name), ids = ['favFood'].concat(st.traits.spots.map(s => 'spot_' + s), ['belly', 'toy', 'fear', 'quirk', 'weight', 'walk', 'birthday'], PAL_DIARY);
    return ids.map(id => {
      const found = st.diary[id] || null;
      return { id, found, text: found ? entryText(st, id, nm) : (id.startsWith('spot_') ? 'Kde se ráda nechá hladit? Hlaď ji po srsti.' : HINTS[id]) };
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
      st.scared = t + 2 * HOUR; st.held = false; st.asleep = false; st.wokeAt = t;
      if (st.lap) leaveLap(st, t, 'scared', ev);
      ev.push({ type: 'scared', what });
      find(st, 'fear', t, ev);
    } else ev.push({ type: 'curious', what });
  }
  function leaveLap(st, t, reason, ev) {
    ev.push({ type: 'lapLeave', reason, minutes: Math.round((t - st.lap.since) / MIN) });
    st.lap = null;
  }
  // one step on the lap: annoyance fades; she may doze off, wake rested, or jump down and run off
  function lapStep(st, t, dt, night, ev) {
    const L = st.lap, N = st.needs, m = dt / MIN;
    L.annoy = Math.max(0, L.annoy - LAP.calm * m);
    if (L.doze) {
      if (N.energy >= 95 || t - L.dozeAt >= LAP.dozeMax * MIN) { L.doze = false; L.dozeAt = 0; L.pet = t; ev.push({ type: 'wake', early: false, lap: true }); }
      return;
    }
    const mv = moodValue(st);
    const sincePet = t - L.pet;   // she nods off when the stroking stops (20 s – 2 min after the last stroke), or at night
    if (N.energy < 60 && mv >= 10 && L.annoy < 1 && ((sincePet >= 20000 && sincePet <= 2 * MIN) || (night && sincePet >= 20000))) {
      const r = LAP.doze * (N.energy < 35 ? 2 : 1) * (night ? 2 : 1);
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
    if (N.energy < 50 && mv >= 50) rate *= LAP.sleepyHappy;
    if (t - L.pet <= MIN) rate *= LAP.petted;
    if (rnd(st) < 1 - Math.exp(-rate * m)) leaveLap(st, t + dt, reason, ev);
  }
  function getIll(st, kind, t, ev) {
    if (st.ill) return;
    st.ill = { kind, since: t };
    st.acc = { fleas: 0, tummy: 0, cold: 0 };
    if (st.out && kind === 'cold') comeBack(st, t, ev);
    if (st.yard && kind === 'cold' && !st.yard.tree) leaveYard(st, ev, 'house');
    ev.push({ type: 'ill', kind });
  }
  function cure(st, by, ev, extra) {
    const kind = st.ill.kind;
    st.ill = null; st.acc = { fleas: 0, tummy: 0, cold: 0 };
    if (kind === 'fleas') st.needs.coat = Math.max(st.needs.coat, 60);   // the flea comb: no flea loop
    ev.push(Object.assign({ type: 'cured', kind, by }, extra || {}));
  }
  function comeBack(st, t, ev) {
    const d = t - st.out.since, walk = st.out.walk;
    st.out = null; st.acc.cold = 0;
    const e = { type: 'back', minutes: Math.round(d / MIN), walk, postcard: null, present: null };
    if (walk) {
      // a walk (toulka): a postcard 60 %, a dárek 20 %, nothing 20 %
      if (d > st.walkMax) st.walkMax = d;
      const r = rnd(st);
      if (r < 0.6) { e.postcard = postcardAt(st.seed, st.postcards.length); st.postcards.push({ id: e.postcard, t }); }
      else if (r < 0.8) e.present = givePresent(st);
    }
    ev.push(e);
    if (walk) find(st, 'walk', t, ev);
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
  function growBeds(st, key, ev) {
    const y = Math.floor(key / 10000), m = Math.floor(key / 100) % 100 - 1, d = key % 100;
    if (m === 11 || m <= 1) return;
    const rained = weather(new Date(y, m, d, 12).getTime(), st) === 'rain';
    st.beds.forEach((b, i) => {
      if (!b || b.days >= CROPS[b.crop].days || !(b.watered === key || rained)) return;
      b.days++;
      if (b.days >= CROPS[b.crop].days) ev.push({ type: 'ripe', bed: i, crop: b.crop });
    });
  }
  function leaveYard(st, ev, type) {
    st.yard = null;
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
      if (!(st.wet > t)) { N.coat = Math.max(0, N.coat - 10); ev.push({ type: 'wet' }); }
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
    else if (N.energy > 30 && w !== 'snow' && !st.held && rnd(st) < 1 - Math.exp(-GARDEN.tree * h)) { Y.tree = { since: t, calls: 0 }; ev.push({ type: 'climbStuck' }); }
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
    const age = birthdayAge(st.born, t), y = new Date(t).getFullYear();
    if (age && st.bday < y) { st.bday = y; addBond(st, 10, ev); ev.push({ type: 'birthday', age }); }
  }
  // a storm (May–Aug afternoons, seeded per day) or the Silvestr fireworks inside [t, t + dt)
  function scareAt(st, t, dt) {
    const [y, m, d] = ymd(t);
    if (m >= 4 && m <= 7) {
      const no = dayNo(y, m, d);
      if (stormDay(st.seed, no, m)) {
        const at = new Date(y, m, d, 14).getTime() + Math.floor(rndDay(st, no, 6) * 6 * HOUR);
        if (at >= t && at < t + dt) return 'storm';
      }
    }
    if (m === 11 && d === 31) { const at = new Date(y, 11, 31, 23, 50).getTime(); if (at >= t && at < t + dt) return 'fireworks'; }
    return null;
  }
  function step(st, t, dt, helped, watching, ev) {
    st.t = t;
    if (dkey(t) !== st.day.key) newDay(st, t, ev);
    const ph = dayPhase(t), hr = new Date(t).getHours(), night = ph === 'night', N = st.needs, h = dt / HOUR;
    // sleeping and waking (on the lap: dozing, see lapStep)
    if (!st.out && !st.lap) {
      if (st.asleep) {
        let wake = false, early = false;
        if (night) { if (st.traits.quirk === 'wakesEarly' && hr === 5 && N.energy >= 60) wake = early = true; }
        else if (N.energy >= 95 || (N.energy >= 60 && (ph === 'morning' || t - st.sleepAt >= 2 * HOUR)) || (N.energy >= 40 && (N.food < 15 || N.water < 15))) wake = true;
        if (wake) { st.asleep = false; st.wokeAt = t; if (watching) ev.push({ type: 'wake', early }); }
      } else if (!st.held && st.scared <= t) {
        // an afternoon nap, but not within 2 h after waking up or after adoption (a new player meets her awake)
        const nap = ph === 'day' && hr >= 13 && N.energy < 75 && t - st.wokeAt >= 2 * HOUR;
        if (N.energy < 25 || nap || (night && t - st.wokeAt >= HOUR)) {
          st.asleep = true; st.sleepAt = t;
          if (watching) {
            const place = st.traits.quirk === 'box' || (nap && st.owned.box) ? 'box' : nap ? (st.owned.sillCushion ? 'sill' : 'sun') : 'bed';
            ev.push({ type: 'sleep', place });
            seenQuirk(st, 'box', t, ev);
          }
        }
      }
    }
    if (st.held && t - st.heldAt >= 5 * MIN) st.held = false;
    // needs (ill: everything falls 1.5× faster)
    const dozing = !!(st.lap && st.lap.doze), k = st.ill ? 1.5 : 1, rest = night || st.asleep || dozing;
    const fall = (n, r) => { N[n] = clamp(N[n] - r * h * k, 0, 100); };
    fall('food', RATE.food[night ? 1 : 0]);
    fall('water', RATE.water[night ? 1 : 0] * (st.out ? 0.5 : 1));
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
    // the litter box, about every 8 hours
    if (t + dt > st.litterAt) {
      if (!st.out) { N.litter = Math.max(0, N.litter - 30); if (watching) ev.push({ type: 'litter' }); }
      st.litterAt = Math.max(st.litterAt, t) + 7 * HOUR + Math.floor(rnd(st) * 2 * HOUR);
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
      else if (A.cold >= 30 * MIN) getIll(st, 'cold', t + dt, ev);
    }
    if (st.lap) lapStep(st, t, dt, night, ev);
    visitStep(st, t, dt, night, watching, ev);
    if (st.yard) gardenStep(st, t, dt, night, ev);
    // the cat flap: while the player is away she goes on a walk by herself (0.2 per daytime hour; bond Kamarádka, placed in the předsíň)
    else if (!watching && st.furniture.catFlap && st.lvl >= WALK_BOND && !st.out && !st.asleep && !st.lap && !st.ill && !night &&
      rnd(st) < 1 - Math.exp(-0.2 * h)) {
      st.out = { since: t, until: t + 2 * HOUR + Math.floor(rnd(st) * 6 * HOUR), walk: true, byPlayer: false };
      ev.push({ type: 'out', until: st.out.until, walk: true, flap: true });
    }
    // storms and fireworks; coming home by herself
    const s = scareAt(st, t, dt);
    if (s && !st.out) { meet(st, s, t, ev); if (st.yard && s === 'storm' && !st.yard.tree) leaveYard(st, ev, 'house'); }
    if (st.out && (t + dt >= st.out.until || N.energy < 25 || (!st.out.byPlayer && night && season(t) === 'winter'))) comeBack(st, t + dt, ev);
    if (st.off && t >= st.off.until) st.off = null;
    // the day's averages (weight, bond)
    const D = st.day;
    D.ms += dt; D.food += N.food * dt; D.mood += moodValue(st) * dt; D.minE = Math.min(D.minE, N.energy);
    for (const n of Object.keys(N)) N[n] = Math.round(N[n] * 1e6) / 1e6;    // tidy JSON; fine enough for frequent acts
  }
  // the clock moved back by now - st.t: every stored moment moves with it, so waiting times stay as long as they were
  function shiftTimes(st, now) {
    const d = now - st.t;
    if (!d) return;
    const mv = v => (v ? v + d : v);
    st.t = now;
    st.sleepAt = mv(st.sleepAt); st.wokeAt = mv(st.wokeAt); st.heldAt = mv(st.heldAt); st.pickAt = mv(st.pickAt);
    st.scared = mv(st.scared); st.litterAt = mv(st.litterAt);
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
    else if (st.day.ms > 0) {   // the replayed time must not count twice in the day's averages
      const D = st.day, k = Math.max(0, D.ms + d) / D.ms;
      D.ms *= k; D.food *= k; D.mood *= k;
    }
    st.bday = Math.min(st.bday, new Date(now).getFullYear());
    if (st.pill > dkey(now + DAY)) st.pill = dkey(now + DAY);
  }
  function advance(st, now) {
    const ev = [];
    if (typeof now !== 'number' || !Number.isFinite(now) || now < T_MIN || now > T_MAX) return { st, events: ev };   // a broken clock
    if (now <= st.t) { shiftTimes(st, now); return { st, events: ev }; }   // the clock moved back: nothing happens
    const start = st.t, gap = now - start, watching = gap <= HOUR;
    if (st.lap && gap > LAP.away * MIN) leaveLap(st, start, 'away', ev);   // nobody sat in the chair that long
    if (st.yard && gap > LAP.away * MIN && season(start) === 'winter' && dayPhase(start) !== 'day' && dayPhase(start) !== 'morning') {
      // a winter evening or night: she comes in with the player
      if (st.yard.tree) ev.push({ type: 'climbDown', by: 'self' });
      leaveYard(st, ev, 'house');
    }
    if (st.yard && gap > LAP.away * MIN) {   // the player went away: she stays in the garden alone, like letOut
      if (st.yard.tree) ev.push({ type: 'climbDown', by: 'self' });
      leaveYard(st, ev, null);
      st.asleep = false;
      st.out = { since: start, until: start + (GARDEN.alone[0] + Math.floor(rnd(st) * (GARDEN.alone[1] - GARDEN.alone[0]))) * MIN, walk: false, byPlayer: false };
      ev.push({ type: 'out', until: st.out.until, walk: false });
    }
    const end = gap > AWAY ? start + AWAY : now;
    for (let t = start; t < end;) {
      const dt = Math.min(STEP, end - t);
      step(st, t, dt, t - start >= HELP, watching, ev);
      t += dt;
    }
    st.t = end;
    if (gap > AWAY) {
      // paní Nováková had her (and looked after her from 24 h on); the time over 72 h is not simulated
      const days = gap / DAY;
      if (st.out) comeBack(st, end, ev);
      if (st.yard) leaveYard(st, ev, null);
      if (st.visit) endVisit(st, 'time', ev);
      endDay(st, ev);
      st.t = now; st.day = freshDay(now);
      st.needs.food = 40; st.needs.water = 40;
      st.weight = r2(clamp(st.weight - Math.min(0.4, 0.1 * Math.max(0, Math.floor(days) - 3)), 3.0, 5.6));
      st.asleep = false; st.held = false; st.wokeAt = now; st.scared = 0;
      st.litterAt = now + 4 * HOUR;
      if (st.ill && now - st.ill.since >= 4 * DAY) cure(st, 'time', ev);
      st.off = { until: now + DAY, turned: false };
      addBond(st, -20, ev);
      ev.push({ type: 'offended', days: Math.floor(days) });
      const y = new Date(now).getFullYear();
      if (st.bday < y && birthdayAge(st.born, now)) { st.bday = y; addBond(st, 10, ev); ev.push({ type: 'birthday', age: birthdayAge(st.born, now) }); }
    }
    const w = wants(st);
    if (w && w !== st.want && watching) ev.push({ type: 'meow', want: w });
    st.want = w;
    return { st, events: ev };
  }

  /* --- care actions (§6) --- */
  function act(st, action, arg, now) {
    const ev = advance(st, now).events;
    const t = st.t, N = st.needs, name = st.name, nm = moodName(moodValue(st));
    const no = reason => { ev.push({ type: 'refused', reason }); return { st, events: ev }; };
    if (typeof action !== 'string' || !ACTIONS.includes(action)) return no('Tohle teď nejde.');
    const before = wants(st), a = arg && typeof arg === 'object' ? arg : {};
    const home = ['cleanLitter', 'letIn', 'call', 'vacuum', 'sow', 'waterBeds', 'harvest', 'feedVisitor', 'strokeVisitor', 'deletePhoto', 'buy', 'sell', 'place'];
    // up the tree: only calling her, fetching her down, the garden, the shop and the camera
    const TREE_OK = ['call', 'fetchDown', 'vetCure', 'goHouse', 'sow', 'waterBeds', 'harvest', 'buy', 'sell', 'place', 'photo', 'feedVisitor', 'strokeVisitor', 'deletePhoto'];
    if (st.yard && st.yard.tree && !TREE_OK.includes(action)) return no(`${name} je na stromě.`);
    // on the lap: stroking, scratching, a treat from the hand and calling keep her there; anything else = standing up
    if (st.lap && !['stroke', 'scratch', 'treat', 'call', 'lapOn', 'lapOff'].includes(action)) {
      ev.push({ type: 'lapOff', dozing: st.lap.doze }); st.lap = null;
    }
    const onLap = !!st.lap, lapK = onLap ? 1.5 : 1;
    // stroking a dozing cat on the lap wakes her (she stays)
    const lapWake = () => { if (onLap && st.lap.doze) { st.lap.doze = false; ev.push({ type: 'wake', early: false, lap: true }); } };
    const annoy = d => { if (st.lap) st.lap.annoy = Math.min(10, st.lap.annoy + d); };
    if (st.out && !home.includes(action)) return no(`${name} je venku.`);
    const wakeUp = () => { if (st.asleep) { st.asleep = false; st.wokeAt = t; ev.push({ type: 'wake', early: false }); } };
    const sleeping = () => { if (st.asleep) { seenQuirk(st, 'box', t, ev); no(`${name} spí, nebuď ji.`); return true; } return false; };
    const hr = new Date(t).getHours();
    if (hr >= 5 && hr < 10 && !st.day.acted && !st.out && !st.asleep) {   // the first thing in the morning: she woke them
      st.day.acted = true;
      seenQuirk(st, 'wakesEarly', t, ev);
    }
    const sad = nm === 'sad';
    const useStock = k => { if (--st.stock[k] <= 0) delete st.stock[k]; };
    // training treats (small pieces) count half for the tummy rule and not for the weight
    const giveTreat = (stick, training) => {
      wakeUp();
      if (stick) useStock('stick'); else st.pamlsky -= 1;
      if (training) st.day.ttreats++; else st.day.treats++;
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
      case 'feed': {
        const kind = typeof arg === 'string' && Object.prototype.hasOwnProperty.call(FOODS, arg) ? arg : 'kibble';
        if (N.food > 90) return no(`${name} je sytá.`);
        const price = CHARGE_FOOD ? FOODS[kind].price : 0;
        if (price && !(st.stock[kind] > 0) && st.pamlsky < price) return no(`Na ${FOODS[kind].acc} nemáš dost pamlsků (${price}).`);
        if (price && st.stock[kind] > 0) useStock(kind); else st.pamlsky -= price;
        wakeUp();
        const tummy = st.ill && st.ill.kind === 'tummy', amt = FOODS[kind].gain * (tummy ? 0.5 : 1);
        const gain = Math.min(amt, 100 - N.food), fav = kind === st.traits.favFood;
        N.food += gain; N.love = Math.min(100, N.love + (fav ? 7 : 2));
        ev.push({ type: 'ate', food: kind, gain: Math.round(gain), left: amt - gain > 10, fav });
        if (fav) {
          addBond(st, 1, ev); ev.push({ type: 'purr' });
          if (!tummy && inc(st, 'favFood') >= 3) find(st, 'favFood', t, ev);
        }
        break;
      }
      case 'water': {
        if (N.water >= 95) return no('Miska s vodou je plná.');
        N.water = 100;                           // the jug fills the bowl to the top
        const tap = st.traits.quirk === 'tap' && rnd(st) < 0.5;
        ev.push({ type: 'drank', tap });
        if (tap) seenQuirk(st, 'tap', t, ev);
        break;
      }
      case 'stroke': {
        const region = regionOf(a.region, 'back');
        const dir = a.along === false || a.along === 'against' ? 'against' : a.along === 'sideways' ? 'sideways' : 'along';
        const sp = typeof a.speed === 'number' ? (a.speed < 120 ? 'slow' : a.speed > 900 ? 'fast' : 'good') : ['slow', 'fast'].includes(a.speed) ? a.speed : 'good';
        if (sp === 'slow') break;                // too slow: she does not notice
        const half = sad ? 0.5 : 1;
        if (region === 'belly') { belly(); break; }
        if (st.asleep) { N.love = Math.min(100, N.love + 1); ev.push({ type: 'purr', region, sleeping: true }); seenQuirk(st, 'box', t, ev); break; }
        lapWake();
        if (sp === 'fast' || dir === 'against') { N.love = Math.max(0, N.love - 1); ev.push({ type: 'earsBack', rough: sp === 'fast' }); annoy(1); break; }
        if (dir === 'sideways') { N.love = Math.min(100, N.love + 1 * half); ev.push({ type: 'tolerate', region }); break; }
        const spot = st.traits.spots.includes(region);
        N.love = Math.min(100, N.love + (spot ? 4 : 2) * half * lapK);
        if (onLap) st.lap.pet = t;
        if (spot || nm === 'happy' || (onLap && nm !== 'sad')) ev.push({ type: 'purr', region });
        else if (nm === 'calm' || rnd(st) < 0.3) ev.push({ type: 'content', region });
        else ev.push({ type: 'tolerate', region });
        if (REGIONS[region].spot) { const c = 'spot_' + region; if (inc(st, c) >= 10 && spot) find(st, c, t, ev); }
        break;
      }
      case 'scratch': {
        const region = regionOf(a.region, 'head');
        const sec = typeof a.seconds === 'number' && Number.isFinite(a.seconds) ? clamp(a.seconds, 0, 5) : 1;
        if (region === 'belly') { belly(); break; }
        const per = REGIONS[region].scratch ? 4 : 1, half = sad || st.asleep ? 0.5 : 1;
        lapWake(); if (onLap) st.lap.pet = t;
        N.love = Math.min(100, N.love + per * sec * half * lapK);
        ev.push({ type: 'purr', region, sleeping: st.asleep });
        if (st.asleep) seenQuirk(st, 'box', t, ev);
        if (st.traits.spots.includes(region) && REGIONS[region].scratch) {
          const c = 'spot_' + region; st.cnt[c] = Math.min(CMAX, st.cnt[c] + Math.round(sec));
          if (st.cnt[c] >= 10) find(st, c, t, ev);
        }
        break;
      }
      case 'pickUp': {
        if (sleeping()) return { st, events: ev };
        if (st.held) break;
        if (moodValue(st) >= 10 && N.energy >= 20 && !(st.off && t < st.off.until && !st.off.turned) && st.scared <= t) {
          st.held = true; st.heldAt = t;
          if (t - st.pickAt >= 10 * MIN) { N.love = Math.min(100, N.love + 5); st.pickAt = t; }
          ev.push({ type: 'held' }, { type: 'purr' });
        } else ev.push({ type: 'wriggle' });
        break;
      }
      case 'putDown': {
        if (!st.held) return no(`${name} není v náruči.`);
        st.held = false; st.place = typeof arg === 'string' && arg.length <= 20 ? arg : null;
        ev.push({ type: 'put', place: st.place });
        break;
      }
      case 'play': {
        if (sleeping()) return { st, events: ev };
        const toy = typeof arg === 'string' && Object.prototype.hasOwnProperty.call(TOYS, arg) ? arg : 'mouse';
        if (TOYS[toy].shop && !st.owned[toy]) return no('Tuhle hračku nemáš. Je v obchůdku.');
        if (N.energy < 10) { ev.push({ type: 'ignore', reason: `${name} je moc unavená.` }); break; }
        if (st.scared > t) { ev.push({ type: 'ignore', reason: `${name} se schovává.` }); break; }
        if (sad && rnd(st) < 0.5) { ev.push({ type: 'ignore', reason: `${name} si teď nechce hrát.` }); break; }
        const fav = (TOYS[toy].base || toy) === st.traits.toy;
        let gain = 20 + Math.floor(rnd(st) * 21) + (fav ? 10 : 0) + (TOYS[toy].bonus || 0);
        if (dayPhase(t) === 'evening') gain = Math.round(gain * 1.25);
        N.fun = Math.min(100, N.fun + gain); N.energy = Math.max(0, N.energy - 5);
        ev.push({ type: 'played', toy, gain, fav });
        if (fav && inc(st, 'toy') >= 5) find(st, 'toy', t, ev);
        if (st.traits.quirk === 'socks' && rnd(st) < 0.3) seenQuirk(st, 'socks', t, ev);
        break;
      }
      case 'brush': {
        if (sleeping()) return { st, events: ev };
        if (N.coat >= 98 && !(st.ill && st.ill.kind === 'fleas')) return no(`${name} je krásně učesaná.`);
        const fleas = st.ill && st.ill.kind === 'fleas', gain = Math.min(fleas ? 10 : 25, 100 - N.coat);
        N.coat += gain; N.love = Math.min(100, N.love + 1);
        ev.push(fleas ? { type: 'flea' } : { type: 'brushed', gain });
        break;
      }
      case 'cleanLitter': {
        if (N.litter >= 100) return no('Kočičí záchod je čistý.');
        N.litter = 100; ev.push({ type: 'clean' });
        break;
      }
      case 'letOut': {   // toulky: a walk of 2–8 h beyond the garden gate
        if (st.lvl < WALK_BOND) return no(`Na toulky může ${name} až od přátelství ${LEVELS[WALK_BOND].name} (${LEVELS[WALK_BOND].min}).`);
        if (st.ill) return no(`${name} je nemocná, zůstane doma.`);
        if (st.yard && st.yard.tree) return no(`${name} je na stromě.`);
        if (sleeping()) return { st, events: ev };
        st.held = false; leaveYard(st, ev, null);
        st.out = { since: t, until: t + 2 * HOUR + Math.floor(rnd(st) * 6 * HOUR), walk: true, byPlayer: true };
        ev.push({ type: 'out', until: st.out.until, walk: true });
        break;
      }
      case 'goGarden': {
        if (st.yard) break;
        if (st.ill && st.ill.kind === 'cold') return no(`${name} má rýmu, zůstane doma.`);
        if (sleeping()) return { st, events: ev };
        st.held = false;
        st.yard = { since: t, snow: false, tree: null };
        ev.push({ type: 'garden', weather: weather(t, st) });
        gardenStep(st, t, 0, dayPhase(t) === 'night', ev);    // rain or snow at once
        break;
      }
      case 'goHouse': {
        if (!st.yard) return no(`${name} není na zahradě.`);
        if (st.yard.tree) return no(`${name} je na stromě – zavolej ji, nebo ji sundej.`);
        leaveYard(st, ev, 'house');
        break;
      }
      case 'fetchDown': {
        if (!st.yard || !st.yard.tree) return no(`${name} není na stromě.`);
        st.yard.tree = null; N.love = Math.min(100, N.love + 2);
        ev.push({ type: 'climbDown', by: 'fetch' }, { type: 'purr' });
        break;
      }
      case 'sow': {
        const i = a.bed, crop = a.crop;
        if (!Number.isInteger(i) || i < 0 || i >= BEDS) return no('Takový záhon tu není.');
        if (i >= bedCount(st)) return no(`Další záhony budou od přátelství ${LEVELS[3].name}.`);
        if (typeof crop !== 'string' || !Object.prototype.hasOwnProperty.call(CROPS, crop)) return no('Taková semínka nemáme.');
        if (bedSleeps(t)) return no('Záhony spí pod sněhem.');
        if (st.beds[i]) return no('Na záhonu už něco roste.');
        const sp = CHARGE_SEEDS ? CROPS[crop].seed : 0, sk = 'seed_' + crop;
        if (sp && !(st.stock[sk] > 0) && st.pamlsky < sp) return no(`Na ${CROPS[crop].acc} nemáš dost pamlsků (${sp}).`);
        if (sp && st.stock[sk] > 0) useStock(sk); else st.pamlsky -= sp;
        st.beds[i] = { crop, sown: t, days: 0, watered: 0 };
        ev.push({ type: 'sown', bed: i, crop });
        break;
      }
      case 'waterBeds': {
        if (bedSleeps(t)) return no('Záhony spí pod sněhem.');
        const k = dkey(t), todo = st.beds.filter(b => b && b.days < CROPS[b.crop].days);
        if (!todo.length) return no('Není co zalévat.');
        if (todo.every(b => b.watered === k)) return no('Dnes už je zalito.');
        for (const b of todo) b.watered = k;
        ev.push({ type: 'watered', n: todo.length });
        break;
      }
      case 'harvest': {
        const i = a.bed, b = Number.isInteger(i) && i >= 0 && i < BEDS ? st.beds[i] : null;
        if (!b) return no('Na záhonu nic neroste.');
        if (b.days < CROPS[b.crop].days) return no(CROPS[b.crop].unripe);
        st.beds[i] = null;
        const yld = CROPS[b.crop].yield;
        ev.push({ type: 'harvested', bed: i, crop: b.crop, n: yld });
        if (b.crop === 'catnip' && !st.out && !st.asleep) catnip();
        else st.pantry[b.crop] = Math.min(CMAX, (st.pantry[b.crop] || 0) + yld);
        break;
      }
      case 'catnip': {
        if (!st.pantry.catnip) return no('Nemáš žádnou šantu.');
        if (sleeping()) return { st, events: ev };
        if (--st.pantry.catnip === 0) delete st.pantry.catnip;
        catnip();
        break;
      }
      case 'lapOn': {
        if (st.lap) break;
        if (sleeping()) return { st, events: ev };
        const off = st.off && t < st.off.until, tummy = st.ill && st.ill.kind === 'tummy';
        if (off || tummy || st.scared > t || N.food < 15 || N.water < 15 || moodValue(st) < -30) { st.held = false; ev.push({ type: 'wriggle' }); break; }
        st.held = false;
        st.lap = { since: t, annoy: 0, doze: false, pet: t, dozeAt: 0 };
        ev.push({ type: 'lapOn' });
        if (nm === 'happy' || nm === 'calm') ev.push({ type: 'purr' });
        break;
      }
      case 'lapOff': {
        if (!st.lap) return no(`${name} ti nesedí na klíně.`);
        ev.push({ type: 'lapOff', dozing: st.lap.doze });
        st.lap = null;
        break;
      }
      case 'letIn': {
        if (!st.out) return no(`${name} je doma.`);
        comeBack(st, t, ev);
        break;
      }
      case 'treat': {   // a pamlsek from the hand, or arg 'stick': a kočičí tyčinka from the stock (love +5)
        const stick = arg === 'stick';
        if (stick ? !(st.stock.stick > 0) : st.pamlsky < 1) return no(stick ? 'Nemáš žádné tyčinky.' : 'Nemáš žádné pamlsky.');
        giveTreat(stick, !!st.train && t - st.train.at <= TREAT_WINDOW && t >= st.train.at);
        if (st.train) rewardTrick(st, t, ev);       // the treat right after a trick: a training success
        break;
      }
      case 'buy': {
        const id = typeof arg === 'string' ? arg : a.id, it = typeof id === 'string' && Object.prototype.hasOwnProperty.call(SHOP_BY, id) ? SHOP_BY[id] : null;
        if (!it) return no('Tohle v obchůdku nemají.');
        if (st.lvl < it.bond) return no(`Tohle bude k mání od přátelství ${LEVELS[it.bond].name}.`);
        if (!it.stock && st.owned[it.id]) return no('Tohle už máš.');
        if (st.pamlsky < it.price) return no(`${it.name} stojí ${pml(it.price)}, tolik nemáš.`);
        st.pamlsky -= it.price;
        if (it.stock) st.stock[it.stock] = Math.min(CMAX, (st.stock[it.stock] || 0) + it.n); else st.owned[it.id] = true;
        ev.push({ type: 'bought', id: it.id, kind: it.kind });
        break;
      }
      case 'place': {
        const it = typeof a.id === 'string' && Object.prototype.hasOwnProperty.call(SHOP_BY, a.id) ? SHOP_BY[a.id] : null;
        if (!it || !st.owned[it.id]) return no('Tohle nemáš.');
        if (!it.room) return no('Tohle se nikam nestaví.');
        if (!ROOMS.includes(a.room)) return no('Takové místo v domě není.');
        if (it.fixed && a.room !== it.room) return no(`${it.name}: patří ${ROOM_TO[it.room]}.`);
        const c = v => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, 0, 1) : 0.5);
        st.furniture[it.id] = { room: a.room, x: c(a.x), y: c(a.y) };
        ev.push({ type: 'placed', id: it.id, room: a.room });
        break;
      }
      case 'sell': {
        const crop = typeof a.crop === 'string' && Object.prototype.hasOwnProperty.call(CROPS, a.crop) ? a.crop : null;
        if (!crop || !(st.pantry[crop] > 0)) return no('Tohle ve spíži nemáš.');
        if (!CROPS[crop].sell) return no('Šantu nikdo nekoupí, ta je pro kočku.');
        const n = Math.min(st.pantry[crop], Number.isInteger(a.n) && a.n >= 1 ? a.n : 1), got = n * CROPS[crop].sell;
        st.pantry[crop] -= n; if (!st.pantry[crop]) delete st.pantry[crop];
        st.pamlsky = Math.min(99999, st.pamlsky + got);
        ev.push({ type: 'sold', crop, n, earned: got });
        break;
      }
      case 'train': {
        const tr = typeof a.trick === 'string' && Object.prototype.hasOwnProperty.call(TRICKS, a.trick) ? a.trick : null;
        if (!tr) return no('Takový trik neznáme.');
        if (st.bond < TRICKS[tr].bond) { ev.push({ type: 'trickRefused', trick: tr, reason: `Na tenhle trik je potřeba přátelství ${TRICKS[tr].bond}.` }); break; }
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
          if (st.pamlsky < 1) { ev.push({ type: 'trickRefused', trick: tr, reason: 'Nemáš pamlsek na odměnu.' }); break; }
          giveTreat(false, true);
          rewardTrick(st, a.treatAt, ev);
        }
        break;
      }
      case 'feedVisitor': case 'strokeVisitor': case 'photo': case 'deletePhoto': {
        const why = socialAct(st, action, a, t, ev);
        if (why) return no(why);
        break;
      }
      case 'showTrick': {
        const tr = typeof a.trick === 'string' && Object.prototype.hasOwnProperty.call(TRICKS, a.trick) ? a.trick : null;
        if (!tr) return no('Takový trik neznáme.');
        const P = st.tricks[tr];
        if (!P || !P.learned) { ev.push({ type: 'trickRefused', trick: tr, reason: `Tenhle trik ${name} ještě neumí.` }); break; }
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
        if (!st.ill) return no(`${name} je zdravá.`);
        const paid = Math.min(15, st.pamlsky);
        st.pamlsky -= paid;
        cure(st, 'vet', ev, { paid, short: paid < 15 });
        const tm = new Date(t); tm.setDate(tm.getDate() + 1);
        st.pill = a.won === true ? 0 : dkey(tm.getTime());
        break;
      }
      case 'pill': {
        if (!st.pill) return no(`${name} žádnou pilulku nepotřebuje.`);
        if (dkey(t) < st.pill) return no('Pilulka je až na zítra.');
        st.pill = 0; N.love = Math.max(0, N.love - 1);
        ev.push({ type: 'pill' });
        break;
      }
      case 'call': {
        if (st.out) { ev.push({ type: 'ignore', reason: `${name} je venku.` }); break; }
        if (st.asleep) { ev.push({ type: 'ignore', reason: `${name} spí.` }); break; }
        if (st.yard && st.yard.tree) {
          const T = st.yard.tree;
          if (++T.calls >= 3 || rnd(st) < 0.5) { st.yard.tree = null; ev.push({ type: 'climbDown', by: 'call' }); }
          else ev.push({ type: 'ignore', reason: `${name} se bojí slézt. Zkus to znovu.` });
          break;
        }
        if (st.off && t < st.off.until && !st.off.turned) { st.off.turned = true; ev.push({ type: 'turnBack' }); break; }
        ev.push({ type: 'come' });
        break;
      }
      case 'vacuum': {
        if (st.out) { ev.push({ type: 'curious', what: 'vacuum' }); break; }
        wakeUp();
        meet(st, 'vacuum', t, ev);
        break;
      }
    }
    // a satisfied want: bond +1, at most once an hour for each need
    if (before && needs(st)[before] >= 40 && !(t - (st.wantAt[before] || 0) < HOUR)) { st.wantAt[before] = t; addBond(st, 1, ev); }
    st.want = wants(st);
    return { st, events: ev };
  }

  const ROOM_TO = { living: 'do obýváku', kitchen: 'do kuchyně', hall: 'do předsíně', garden: 'na zahradu' };
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
    const no = reason => { ev.push({ type: 'refused', reason }); return { st, events: ev }; };
    if (typeof game !== 'string' || !Object.prototype.hasOwnProperty.call(GAMES, game)) return no('Takovou hru neznáme.');
    if (st.out) return no(`${st.name} je venku.`);
    if (st.yard && st.yard.tree) return no(`${st.name} je na stromě.`);
    if (st.lap) { ev.push({ type: 'lapOff', dozing: st.lap.doze }); st.lap = null; }
    const sc = typeof score === 'number' && Number.isFinite(score) ? Math.floor(clamp(score, 0, 999)) : 0, G = GAMES[game];
    const today = dkey(t);
    if (st.earnDay.key < today) st.earnDay = { key: today, n: 0 };
    // a day already paid in the future (the clock went back): nothing more today
    const want = Math.min(G.max, Math.floor(sc / G.per)), n = st.earnDay.key > today ? 0 : Math.min(want, EARN_CAP - st.earnDay.n);
    if (n > 0) { st.pamlsky = Math.min(99999, st.pamlsky + n); st.earnDay.n += n; ev.push({ type: 'earned', n, game }); }
    if (want > n) ev.push({ type: 'capReached' });
    const N = st.needs;
    if (game !== 'pill') { N.fun = Math.min(100, N.fun + 30); N.energy = Math.max(0, N.energy - 10); st.asleep = false; }
    const prev = st.records[game] ? st.records[game].best : 0;
    if (sc > prev) { st.records[game] = { best: sc, t }; ev.push({ type: 'record', game, best: sc, prev }); }
    st.want = wants(st);
    return { st, events: ev };
  }
  // the shop for the UI: items offered at her bond level, with owned / affordable
  function shop(st) {
    return SHOP.filter(it => st.lvl >= it.bond).map(it => ({ id: it.id, kind: it.kind, name: it.name, price: it.price, room: it.room,
      owned: !it.stock && !!st.owned[it.id], have: it.stock ? st.stock[it.stock] || 0 : null, affordable: st.pamlsky >= it.price }));
  }
  // Výcvik for the UI
  function tricks(st) {
    return Object.keys(TRICKS).map(id => { const P = st.tricks[id] || { progress: 0, learned: 0 };
      return { id, name: TRICKS[id].name, cue: TRICKS[id].cue, bond: TRICKS[id].bond, available: st.bond >= TRICKS[id].bond, progress: P.progress, of: TRICK_N, learned: P.learned || null }; });
  }

  /* --- Phase 5: neighbour cats over the fence and the album (SPEC §8 Visitors, Album, §12e) --- */
  // trait: how they take a stroke and food; fem: Czech forms (dostal / dostala)
  const VISITORS = deep({
    mourek: { name: 'Mourek', trait: 'curious', fem: false }, liza: { name: 'Líza', trait: 'shy', fem: true },
    bivoj: { name: 'Bivoj', trait: 'bold', fem: false }, ciperka: { name: 'Čiperka', trait: 'playful', fem: true },
    pacicka: { name: 'Pacička', trait: 'greedy', fem: true }, rambo: { name: 'Rambo', trait: 'grumpy', fem: false },
    sedivka: { name: 'Šedivka', trait: 'old', fem: true }, fousek: { name: 'Fousek', trait: 'sleepy', fem: false },
  });
  const VISITOR_IDS = Object.keys(VISITORS);
  // per hour: a visit in the daytime (×2.5 with the miska pro návštěvy in the garden, ×1.5 with a cushion there);
  // only Bivoj comes at night; a visit lasts 20–90 min (greedy and sleepy ones +30 min when fed)
  const VISIT = deep({ day: 0.05, night: 0.03, bowl: 2.5, cushion: 1.5, stay: [20, 90], fedStay: 30, perVisit: 1 });
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
  });
  const PAL_STEP = 0.25, PAL_VISIT = 0.5;   // Koxa's hearts: +¼ for each joint act (not a standoff), at most +½ a visit
  const SOLO_W = deep({ wander: 3, drink: 2, bench: 2, tree: 2, nap: 1, bowl: 3 });
  const SOLO_TRAIT = deep({
    sleepy: { nap: 4, bench: 3, tree: 0.3 }, old: { nap: 4, bench: 3, tree: 0.3 }, playful: { wander: 2.5, tree: 2.5, nap: 0.5 },
    curious: { wander: 2.5, tree: 2.5, nap: 0.5 }, greedy: { bowl: 4 }, bold: { tree: 1.5 }, shy: { bench: 1.5, wander: 0.7 },
  });
  const ALBUM_MAX = 200;
  const PHOTO_ROOMS = ['living', 'kitchen', 'hall', 'garden', 'lap', 'walk'];
  // Koxa's own hearts for a cat (a record from before Phase A has only the player's: she takes those over)
  const palOf = R => (!R ? 0 : typeof R.pal === 'number' && Number.isFinite(R.pal) ? R.pal : typeof R.friend === 'number' && Number.isFinite(R.friend) ? R.friend : 0);
  function reaction(st, id) {
    const h = palOf(st.visitors[id]);
    if (id === 'bivoj' && h < 3) return 'hiss';
    if (id === 'rambo' && h < 2) return 'hiss';
    if (id === 'ciperka') return 'play';
    return h >= 3 ? 'friends' : 'watch';
  }
  function vrec(st, id) {
    const R = st.visitors[id];
    if (!R) return (st.visitors[id] = { friend: 0, pal: 0, met: 0, visits: 0, fed: 0 });
    if (typeof R.pal !== 'number') st.visitors[id] = { friend: R.friend, pal: palOf(R), met: R.met, visits: R.visits, fed: R.fed };
    return st.visitors[id];
  }
  function endVisit(st, reason, ev) {
    ev.push({ type: 'visitorLeave', id: st.visit.id, reason });
    st.visit = null;
  }
  // one step: a visitor may come (seeded), Koxa reacts, the visit ends after its time (never forever)
  function visitStep(st, t, dt, night, watching, ev) {
    const h = dt / HOUR;
    if (st.visit) {
      if (night && st.visit.id !== 'bivoj') endVisit(st, 'night', ev);
      else if (weather(t, st) === 'rain' && st.visit.id !== 'bivoj') endVisit(st, 'rain', ev);
      else {
        st.visit = fixVisit(st.visit, t);
        if (!st.visit) return;
        const U = st.visit.until;
        if (U > t) programme(st, t, Math.min(dt, U - t), watching, ev);   // up to the visit's end exactly, whatever the step
        if (t + dt >= U) endVisit(st, 'time', ev);
      }
      return;
    }
    if (weather(t, st) === 'rain' && !night) return;
    const F = st.furniture, cushion = (F.sillCushion && F.sillCushion.room === 'garden') || (F.bedDeluxe && F.bedDeluxe.room === 'garden');
    const rate = night ? VISIT.night : VISIT.day * (F.visitorBowl ? VISIT.bowl : 1) * (cushion ? VISIT.cushion : 1);
    if (!(rnd(st) < 1 - Math.exp(-rate * h))) return;
    const id = night ? 'bivoj' : VISITOR_IDS[Math.floor(rnd(st) * VISITOR_IDS.length)];
    const stay = VISIT.stay[0] + Math.floor(rnd(st) * (VISIT.stay[1] - VISIT.stay[0]));
    st.visit = { id, since: t, until: t + stay * MIN, gain: 0, palGain: 0, greeted: false, ready: null, act: { kind: 'arrive', since: t, with: null } };
    const R = vrec(st, id); R.visits = Math.min(CMAX, R.visits + 1);
    ev.push({ type: 'visitor', id, reaction: st.out ? 'away' : reaction(st, id) });
    if (watching) ev.push({ type: 'visitAct', id, kind: 'arrive', with: null });
  }
  // Koxa can do something with the visitor: in the garden, awake, not up the tree, on the lap or in the arms
  const palAwake = st => !!(st.yard && !st.out && !st.yard.tree && !st.asleep && !st.lap && !st.held);
  const palAsleep = st => !!(st.yard && !st.out && !st.yard.tree && st.asleep);
  const pondFrozen = t => season(t) === 'winter';
  function pickSolo(st, cur, t, r) {
    const tr = SOLO_TRAIT[VISITORS[st.visit.id].trait] || {};
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
    const id = st.visit.id, trait = VISITORS[id].trait, p = palOf(st.visitors[id]);
    const ks = [], w = [];
    const add = (k, x) => { if (k !== cur) { ks.push(k); w.push(x); } };
    if (['playful', 'curious', 'bold'].includes(trait) && (p >= 1 || id === 'ciperka')) { add('chase', trait === 'playful' ? 3 : 2); add('wrestle', trait === 'bold' ? 2.5 : 1.5); }
    if (p >= 3) { add('groom', 2); add('snuggle', trait === 'old' || trait === 'sleepy' ? 4 : 1); }
    if (!ks.length) return null;
    let x = r * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ks.length; i++) { if (x < w[i]) return ks[i]; x -= w[i]; }
    return ks[ks.length - 1];
  }
  function addPal(st, id, t, ev) {
    const V = st.visit, g = Math.min(PAL_STEP, PAL_VISIT - V.palGain);
    if (g <= 0) return;
    V.palGain += g;
    const R = vrec(st, id), before = Math.floor(R.pal);
    R.pal = Math.round(clamp(R.pal + g, 0, 5) * 4) / 4;
    if (Math.floor(R.pal) > before) ev.push({ type: 'palUp', id, pal: Math.floor(R.pal) });
    if (R.pal >= 3) palFound(st, 'palFirst', id, t, ev);
  }
  // a pal* diary entry and its cat (st.diaryCat keeps the fixed order of PAL_DIARY, as repair does)
  function palFound(st, dk, id, t, ev) {
    if (st.diary[dk]) return;
    const o = {}, C = st.diaryCat || {};
    for (const k of PAL_DIARY) if (k === dk) o[k] = id; else if (Object.prototype.hasOwnProperty.call(C, k)) o[k] = C[k];
    st.diaryCat = o;
    find(st, dk, t, ev);
  }
  function setAct(st, kind, t, watching, ev) {
    const V = st.visit, joint = VISIT_ACTS[kind].joint;
    V.act = { kind, since: t, with: joint ? 'koxa' : null };
    if (joint) V.greeted = true;
    if (watching) ev.push({ type: 'visitAct', id: V.id, kind, with: V.act.with });
    if (!joint || kind === 'standoff') return;
    // a save from before Phase A may already have 3+ hearts: the first friend comes before grooming or snuggling
    if (palOf(st.visitors[V.id]) >= 3) palFound(st, 'palFirst', V.id, t, ev);
    addPal(st, V.id, t, ev);
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
      else if (awake && !hiss && r(22) < 0.5) next = pickJoint(st, A.kind, r(23));
      else if (asleep && !hiss && palOf(st.visitors[V.id]) >= 3 && A.kind !== 'snuggle' && r(22) < 0.4) next = 'snuggle';
      if (!next) next = pickSolo(st, A.kind, at, r(24));
      setAct(st, next, at, watching, ev);
    }
    actFx(st, V.act, end - cur);
    if (V.greeted) V.ready = null;
  }
  // a canonical visit or null (repair and states made by hand); an unknown act or one that does not fit = 'wander' alone
  function fixVisit(S, t) {
    const okT = v => typeof v === 'number' && Number.isFinite(v) && v >= T_MIN && v <= T_MAX;
    const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
    if (!(S && typeof S === 'object' && own(VISITORS, S.id) && okT(S.since) && S.since <= t && okT(S.until) && S.until > S.since &&
      S.until <= S.since + (VISIT.stay[1] + 2 * VISIT.fedStay) * MIN)) return null;
    const fin = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const A = S.act && typeof S.act === 'object' ? S.act : {};
    const okA = own(VISIT_ACTS, A.kind) && (VISIT_ACTS[A.kind].joint ? A.with === 'koxa' : A.with === null);
    const act = okA ? { kind: A.kind, since: okT(A.since) && A.since >= S.since && A.since <= t ? A.since : S.since, with: A.with }
      : { kind: 'wander', since: S.since, with: null };
    const greeted = S.greeted === true || act.with === 'koxa';
    return {
      id: S.id, since: S.since, until: S.until, gain: clamp(fin(S.gain), 0, VISIT.perVisit),
      palGain: Math.round(clamp(fin(S.palGain), 0, PAL_VISIT) * 4) / 4, greeted,
      ready: !greeted && okT(S.ready) && S.ready >= S.since && S.ready <= t ? S.ready : null, act,
    };
  }
  function addFriend(st, id, d, ev) {
    const R = vrec(st, id), before = Math.floor(R.friend);
    R.friend = Math.round(clamp(R.friend + d, 0, 5) * 4) / 4;
    if (Math.floor(R.friend) > before) ev.push({ type: 'visitorFriend', id, hearts: Math.floor(R.friend) });
  }
  // feedVisitor / strokeVisitor / photo / deletePhoto; returns a Czech refusal or null
  function socialAct(st, action, a, t, ev) {
    if (action === 'photo') {
      if (st.out) return `${st.name} je venku.`;
      if (st.album.length >= ALBUM_MAX) return `Album je plné (${ALBUM_MAX} fotek). Nějakou fotku smaž.`;
      const str = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
      const p = {
        t, pose: str(a.pose, 20) || (st.asleep ? 'sleep' : 'sit'),
        room: PHOTO_ROOMS.includes(a.room) ? a.room : st.yard ? 'garden' : st.lap ? 'lap' : 'living',
        mood: ['happy', 'calm', 'grumpy', 'sad'].includes(a.mood) ? a.mood : mood(st),
        phase: ['night', 'morning', 'day', 'evening'].includes(a.phase) ? a.phase : dayPhase(t),
        season: ['spring', 'summer', 'autumn', 'winter'].includes(a.season) ? a.season : season(t),
        note: str(a.note, 60) || '', visitor: st.visit ? st.visit.id : null,
      };
      st.album.push(p);
      ev.push({ type: 'photo', n: st.album.length });
      return null;
    }
    if (action === 'deletePhoto') {
      const i = st.album.findIndex(p => p.t === a.t);
      if (i < 0) return 'Takovou fotku v albu nemáš.';
      st.album.splice(i, 1);
      ev.push({ type: 'photoDeleted', n: st.album.length });
      return null;
    }
    if (st.visit) st.visit = fixVisit(st.visit, t);
    const id = typeof a.id === 'string' && Object.prototype.hasOwnProperty.call(VISITORS, a.id) ? a.id : null;
    if (!id) return 'Takovou kočku neznáme.';
    const V = VISITORS[id];
    if (!st.visit || st.visit.id !== id) return `${V.name} tu teď není.`;
    const R = vrec(st, id);
    if (!R.met) R.met = t;
    const [strokeGain, foodGain] = BY_TRAIT[V.trait];
    if (action === 'feedVisitor') {
      const today = dkey(t);
      if (R.fed === today) return `${V.name} už dnes ${V.fem ? 'dostala' : 'dostal'}.`;
      R.fed = today;
      if (V.trait === 'greedy' || V.trait === 'sleepy') st.visit.until += VISIT.fedStay * MIN;   // stays longer
      ev.push({ type: 'visitorFed', id });
      addFriend(st, id, foodGain, ev);
      if (palAwake(st)) addPal(st, id, t, ev);   // Koxa sees you are friends with it
      return null;
    }
    // strokeVisitor: shy ones may run off, grumpy ones may swipe while they do not know you
    if (V.trait === 'shy' && R.friend < 2 && rnd(st) < 0.6) { endVisit(st, 'shy', ev); return null; }
    if (V.trait === 'grumpy' && R.friend < 2 && rnd(st) < 0.5) { ev.push({ type: 'visitorHiss', id }); addFriend(st, id, -0.25, ev); return null; }
    ev.push({ type: 'visitorPurr', id });
    const g = Math.min(strokeGain, VISIT.perVisit - st.visit.gain);
    if (g > 0) { st.visit.gain += g; addFriend(st, id, g, ev); }
    if (palAwake(st)) addPal(st, id, t, ev);
    return null;
  }
  function repairSocial(st, t) {
    const okT = v => typeof v === 'number' && Number.isFinite(v) && v >= T_MIN && v <= T_MAX;
    const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
    const V = st.visitors && typeof st.visitors === 'object' && !Array.isArray(st.visitors) ? st.visitors : {};
    st.visitors = {};
    for (const k of Object.keys(V)) {
      const r = V[k];
      if (!own(VISITORS, k) || !r || typeof r !== 'object') continue;
      const friend = typeof r.friend === 'number' && Number.isFinite(r.friend) ? Math.round(clamp(r.friend, 0, 5) * 4) / 4 : 0;
      st.visitors[k] = {
        friend, pal: typeof r.pal === 'number' && Number.isFinite(r.pal) ? Math.round(clamp(r.pal, 0, 5) * 4) / 4 : friend,   // an older save: Koxa's = the player's
        met: okT(r.met) ? Math.min(r.met, t) : 0,
        visits: Number.isInteger(r.visits) ? clamp(r.visits, 0, CMAX) : 0,
        fed: isKey(r.fed) && r.fed <= dkey(t) ? r.fed : 0,
      };
    }
    st.visit = fixVisit(st.visit, t);
    const A = Array.isArray(st.album) ? st.album : [];
    st.album = [];
    for (const p of A) {
      if (st.album.length >= ALBUM_MAX) break;
      if (!p || typeof p !== 'object' || !okT(p.t)) continue;
      const str = (v, n, def) => (typeof v === 'string' ? v.slice(0, n) : def);
      st.album.push({
        t: Math.min(p.t, t), pose: str(p.pose, 20, 'sit'), room: PHOTO_ROOMS.includes(p.room) ? p.room : 'living',
        mood: ['happy', 'calm', 'grumpy', 'sad'].includes(p.mood) ? p.mood : 'calm',
        phase: ['night', 'morning', 'day', 'evening'].includes(p.phase) ? p.phase : 'day',
        season: ['spring', 'summer', 'autumn', 'winter'].includes(p.season) ? p.season : 'spring',
        note: str(p.note, 60, ''), visitor: own(VISITORS, p.visitor) ? p.visitor : null,
      });
    }
  }
  function shiftSocial(st, d, now) {
    const today = dkey(now);
    for (const k of Object.keys(st.visitors)) { const r = st.visitors[k]; if (r.met > now) r.met = now; if (r.fed > today) r.fed = today; }
    if (st.visit) {
      const V = st.visit, A = V.act && typeof V.act === 'object' ? V.act : {};
      st.visit = fixVisit(Object.assign({}, V, { since: V.since + d, until: V.until + d, ready: typeof V.ready === 'number' ? V.ready + d : null,
        act: Object.assign({}, A, { since: A.since + d }) }), now);
    }
    for (const p of st.album) if (p.t > now) p.t = now;
  }
  // the Album screen: photos (newest first), postcards, the neighbour cats met, presents
  function album(st) {
    return {
      photos: st.album.slice().reverse(), max: ALBUM_MAX,
      postcards: st.postcards.slice(),
      visitors: VISITOR_IDS.filter(id => st.visitors[id] && st.visitors[id].met).map(id => ({
        id, name: VISITORS[id].name, trait: VISITORS[id].trait, hearts: Math.floor(st.visitors[id].friend), pal: Math.floor(palOf(st.visitors[id])), met: st.visitors[id].met, visits: st.visitors[id].visits,
      })),
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
    SHOP, GAMES, TRICKS, ROOMS, EARN_CAP, VISITORS, VISIT_ACTS, ALBUM_MAX, album,
    create, valid, repair, rename, advance, act, consumeTreats, minigameResult, shop, tricks,
    mood, moodValue, wants, needs, health, bondLevel, diary,
    dayPhase, season, holiday, easter, weather, postcardAt, bedCount,
  };
}
