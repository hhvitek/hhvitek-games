# Glossary for the translation pass (skill `translate`)

Czech (`cs`) is the source. Target: English unless a section says otherwise. Players are addressed informally ("you"),
gender-neutral. Button labels are short. No Czech diacritics in `en` (names of places and the author excepted).

| Czech | English |
|---|---|
| Poradit | Hint |
| Zpět | Undo |
| Nová hra | New game |
| Rozehráno | In progress |
| Nastavení | Settings |
| Jak hrát | How to play |
| Vítkovy hry | Vítek's Games |
| Papír (theme) | Paper |

Mariáš cards (anglicized, user's decision 2026-11-17): spodek = Under, svršek = Over, král = King, eso = Ace;
suits: srdce = Hearts, zvonky = Bells, listy / zelené = Leaves, žaludy = Acorns.

Opponents get English names in `en` (see `i18n/opponents.js`).

Game names (approved by the user 2026-11-17; never brand names such as Tetris, Mastermind, Yahtzee, Battleship,
Minesweeper): they are `game.<id>.name` in `i18n/games.js`; use them in every text that names a game.
Logik = Code Breaker, Skládání kostek = Block Puzzle, Padající tvary = Falling Blocks, Barevné kostky = Colour Blocks,
Spojování obrázků = Picture Pairs, Pexeso = Memory, Spoj tři = Match Three, Kočka = Cat, Přelévání = Water Sort,
Hanojské věže = Tower of Hanoi, Spojování čísel = Number Merge, Cesta ven = Way Out, Patnáctka = Fifteen Puzzle,
Paprsek = Light Beam, Kulička = Ball Maze, Zavři čísla = Shut the Box, Dáma = Draughts, Piškvorky = Five in a Row,
Šroubky = Nuts and Bolts, Malované křížovky = Nonograms, Šipky ven = Arrows Out, Hledání min = Mine Finder,
Generál = General, Lodě = Sea Battle, Mlýn = Mill, Věžičky = Towers, Přistání = Landing, Kostky = Dice,
Solitér = Solitaire, Pyramida = Pyramid, Pavouk = Spider, Oko bere = Twenty-One, Oko bere plus mínus = Twenty-One
Plus Minus; Sudoku, Mahjong, Reversi, FreeCell and Prší stay as they are. A new game's English name is the user's call.

## Rules for the translator
- Keep the ICU syntax and every `{param}`, `#` (inside a plural) and `[marker]` (button pictures in the help) exactly; keep HTML tags.
- Use the plural categories of the target language (English: `one`, `other`); a `{fem, select, …}` may be dropped when the language has no gender.
  A number that Czech writes as "{n}×" or "chyb {n}" gets a real English plural (`{n, plural, one {once} other {# times}}`), never "1 times".
- Write what a native speaker would have written from scratch, not the Czech sentence in English words: rebuild the
  sentence, join or split sentences inside the message, drop Czech filler. Keep the meaning, every piece of
  information and every param. One message stays one message.
- Never change `cs`; write only the language field you were asked for.

## English style (user's decisions 2026-11-17, after a native-speaker review of the first translation)

- **British English:** colour, grey, favourite, neighbour, centre, chequerboard, any more, towards, litter tray,
  mum. Dates stay `{d}/{m}/{y}`.
- **Tone:** casual and friendly, with contractions everywhere (can't, don't, it's, you'll); "you" is the player.
  A computer opponent has a human name and face: call them **they / their**, never "it".
- **No comma splices** (Czech puts a comma between two sentences, English does not): use a full stop, a semicolon,
  a dash, a colon or "so". "Tap the first card, it lights up." → "Tap the first card to select it."
- **Prefer the active voice and the player as the subject:** "The tower is moved!" → "Tower moved!" / "You moved the tower!".
- **Picture markers in the help** come before the noun: "the [undo] button", "the [check] tick", "the [flag] flag".
- **Times:** "6 am to 10 pm", never "6 to 22 h". **Numbers in a sentence:** "3 times", never "3×" (a "×" is fine in a short badge).
- **Button and label lengths:** about as long as the Czech; a line shown during play (Přistání) as short as possible.
- **Help texts:** explain like a friend at the table, in short clear sentences; use the real terms of the genre.

### Set phrases (use exactly these)

| Czech | English |
|---|---|
| hra s Poradit se nepočítá (toast; toasts have no final full stop) | You used a hint, so this game won't count towards your statistics (records: "…towards your best") |
| hra s Poradit se nepočítá (end dialog of that game) | You used a hint, so this game doesn't count towards your statistics. |
| hra se nová spustí (Settings notice) | A <b>new game</b> … will start when you close Settings. |
| nová hra začala (toast) | A new game has started with … |
| jen dohrané hry bez Poradit se počítají | Only finished games played without a hint count. |
| změna platí od další hry | Applies from the next game. The current game carries on. |
| Chvilku, … | Hang on, … |
| Dál to nejde | No moves left |
| Ještě se podívám | Keep looking |
| Prohlédnout (shared end-dialog button) | Take a look |
| Prohlédnout stůl / desku / plochu (a game's own button) | View the table / View the board |
| Vrátit tah zpět (end dialog) | Undo last move |
| Vyhrál(a) jsi / Vyhrál(a) {name} (end of a game) | You win! / {name} wins |
| Rekord / Nový rekord! / Předchozí rekord | Best / New best! / Previous best |
| Pomůcky (settings card) | Assists |
| Vzhled (settings card) | Appearance |
| Zelené sukno / Modré sukno | Green felt / Blue felt |
| Vínová | Burgundy |
| kraj | region |
| Vítkovy hry (the launcher) | Vítek's Games (never "launcher" in a text a player reads: "your other games", "the game list") |

### Terms of the genres

- **Solitaires:** stock, waste, foundation, column, run, pass (through the stock); Pyramid: "redeal". Ranks lowercase
  in sentences (ace, king) for French cards; the mariáš ranks Under / Over / King / Ace stay capitalized.
- **Twenty-One (Oko bere):** over 21 = **bust**; Stand; Another card; oko = "an oko" (two aces).
- **Prší:** eso = **miss a turn** (button "Skip turn"); never "stand" (that means "stop drawing" in English card games).
- **Reversi:** **pass** (not skip), outflank, flip, disc; scores "{me}–{foe}".
- **Falling Blocks:** a piece **lands** and is **locked**; ghost piece.
- **Mahjong, Picture Pairs:** **match** a pair, a tile is **free** or **blocked** (never "take").
- **General:** **score** a box (never "write"/"entry"), scratch, score sheet, "63+" for the bonus.
- **Dice (Kostky):** bank; "you need at least 350 to bank" (never "bank from 350").
- **Sea Battle:** the **grid** (never "sea"), hit, miss, "Hit and sunk!", afloat.
- **Nonograms:** **clues**, a **run** of filled cells (never "in a row"), cross out, Auto-cross.
- **Shut the Box:** **shut** the tiles.
- **Draughts:** man, king, crowned, jump, **jump again** (never "jump on" / "capture on"), compulsory capture.
- **Mill:** form a mill, take a stone, fly / flying.
- **Mine Finder:** reveal, flag, board (never "deal").
- **Zoom on a phone:** pinch to zoom, drag with one finger.
- **Landing (Přistání):** keep the engine on / cut the engine (never "hold the engine"), the engine **fires**, burn (noun),
  the legs **deploy**, relight, touchdown, pad.
- **Cat (Kočka):** groom (not wash), sulk / in a huff (not offended), press and hold (not "hold with your finger"),
  belly trap, the **jug** (konvice, for water) and the **watering can** (konev), litter tray, treats (the game's currency:
  never use "treats" for food in general).

### Names in Cat (user's decision 2026-11-17: English names like the opponents and the kittens)

Koxa stays Koxa. Neighbour cats: Mourek = Stripey, Líza = Lisa, Bivoj = Hercules, Čiperka = Zippy, Pacička = Mittens,
Rambo = Rambo, Šedivka = Silver, Fousek = Whiskers. Paní Nováková = Mrs Novak. Anička, Mrs Novak's granddaughter
(added 2026-11-21) = Annie (used since the pass of 2026-11-23, like the other English names; the user may still
change it). "Kočičko!" = "Here, kitty!"; the doorbell "Crrr!" = "Ding-dong!"; povaha (her hidden trait) = temperament.
