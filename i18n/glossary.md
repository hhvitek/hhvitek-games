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
- Same meaning, natural English, no word-for-word Czech; one sentence stays one sentence.
- Never change `cs`; write only the language field you were asked for.
