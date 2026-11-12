# TODO

Things left to do, roughly in order of importance. Delete an item when it is done (git keeps the history).
The user's decisions on how things should be are in CLAUDE.md ("Decisions…" sections), not here.

## Testing on the real phone

- [ ] Dáma: how long the Mistr thinks on the Xiaomi (on a computer about 0.5 s on average, 2.7 s at most; it stops at 20 s at the latest (8 s without a worker), and only then could the same position give a different move after Zpět).

- [ ] Brave on Android (the Samsung S25 of the report): check that the bottom buttons are no longer cut off in the app installed by Brave; Nastavení → "Údaje o obrazovce" in the launcher shows what the last game measured. By the table in CLAUDE.md ("Visible height") Brave reports the same height for `visualViewport` as for `100dvh`, so the 1.0.4 rule alone may not be enough. When it is settled, remove both TEMPORARY parts: the card in `index.html` and the `games.launcher.diag` write in every game and the template.
- [ ] Kočka: listen to the meows, purr and the other sounds on the phone (synthesized, never heard by anyone yet) — if they still don't sound like a cat, record a few meows of the real cat and use them instead; feel the stroking, the two-finger scratch, the long press and the trick cues on a real touch screen (thresholds in src/input.js `T`); tilt rolling the yarn; the microphone call (Android and iOS permission paths); vibration patterns; animation smoothness and battery with the game left open.
- [ ] Kulička: try the tilt on the Xiaomi (sensitivity, dead zone, auto-levelling when coming back); the iOS permission path was never run on iOS.
- [ ] Open the launcher on the target phone (Xiaomi 13T/14T/15T), add it to the home screen and play each game once.
- [ ] Turn on airplane mode and check that all games and the image sets (Mahjong: Kočky, Náchodsko, Znaky obcí, Houby, Ptáci, Ovoce a zelenina) still load offline.
- [ ] Check that an old game in progress survives the update (old `hry.*.rozehrano` and `<id>.v1` keys are migrated).
- [ ] Open a game straight from disk once (double-click `games/<id>/index.html`): the Playwright MCP blocks `file:///`, so this is not tested automatically.

## Open questions for the user

- [ ] Kočka (choices made while building, keep?): two tray rows (care items above, toys + Laser + Zavolat + Víc below; labels 12.5 px); the toast at the top of the room; "Vysát pokoj" in Nastavení → Pokoj; the Veterinář button only while she is ill; toys stay on the floor until picked up; a wide short window shows the room narrower with the wall continuing at the sides; neighbour cats are stroked with a button (no gesture); the album shows the newest 24 photos; gardening pays a little (a seed pack sells for 1.5× its price) but far less than the minigames.

- [ ] Dáma: is the default opponent "Běžný hráč" about right for the players (not too easy, not frustrating)? It looks two half-moves ahead with noise and sometimes plays the second best move; tune it after playing on the phone.

- [ ] Zavři čísla: the dice come from the saved seed, so after a roll the player can press Zpět, close other tiles and see the same dice again; repeated, this shows the coming rolls. Keep it, or allow Undo only within the current roll?

- [ ] Spojování čísel: on the 3 × 3 grid the goals are now a quarter (128 / 256 / 512 instead of 512 / 1024 / 2048), because nine cells can hold at most 1024. Chosen by the agent while fixing the review findings (2026-11-10): keep, or other goals?

- [ ] Paprsek: default theme "Noc" (others Břidlice, Papír)? "Nová hra" restarts the current level (other levels in Settings → Úroveň)? Show "Nejméně" (fewest turns) from the start, or only after the win? Zpět unavailable after a win?
- [ ] Kulička: the neutral tilt is re-taken every time play resumes; default theme "Dřevo" (also Papír, Zelená); holes only off the way to the goal (gentler than a real labyrinth); fixed sizes 5×7 / 7×10 / 9×13. Keep?

- [ ] Spojování obrázků: chosen by the agent (2026-11-12): sizes 6 × 8 / 7 × 10 / 8 × 12 (Velký has tiles about 0.8 cm wide on a short screen), the Mahjong defaults (Znaky obcí on Dřevo), Zamíchat any time without asking, Zpět also after the win. Keep? A gravity variant (tiles slide down after a pair) could come later.

- [ ] Šroubky: chosen by the agent (2026-11-12): levels Lehká 4 colours × 4 nuts / Střední 6 × 4 (default) / Těžká 8 × 5 / Mistr 10 × 5, always 2 empty bolts; default theme Papír (also Dílna, Ocel, Bílá); "Značky na matkách" off; Zpět not after a win; "Od začátku" replays the same deal (can improve the record); the record (fewest moves) never counts a game in which Poradit was used; the game says "odsud už to vyřešit nejde" as soon as the solver proves a position lost (may spoil the challenge); random deals are solvable at once, so even Mistr may feel easy to experienced players (harder deals could be picked by solution length); Mistr on a tall phone is 3 rows of 4 bolts. Keep?

- [ ] Malované křížovky: chosen by the agent (2026-11-12), keep? 36 own pictures (8 × 5×5, 16 × 10×10, 12 × 15×15, every one uniquely solvable by line logic, rather gentle); default theme "Papír" (also Noc, Břidlice); "Upozorňovat na chyby" and "Doplňovat křížky" off by default; "Nová hra" opens the list of pictures and switching never asks, because the progress of every started picture is kept (only the open one keeps Zpět); a solved picture tapped in the list starts again empty (its solved mark stays); Zpět and Poradit unavailable after the win; the ★ only for a picture solved without Poradit and without the mistake warnings; no times or records; Zvětšit only on 15 × 15 (cells about 0.45 cm wide on the phone without it); a picture's name is shown only after it is solved.

## Ideas

New games (user's picks 2026-11-12 from the genres popular on Google Play; our own version of the genre, never a copy of a particular game's name, look or levels; the user does not want Člověče, nezlob se nor any game that needs a word list):
- [ ] Šipky ven (arrow puzzle): pieces with arrows on the board; a tapped piece slides off in its arrow's direction when nothing blocks the way; clear the board. In fashion now, simple rules, puzzles can be generated so they are always solvable.
- [ ] Šestiúhelníkové věžičky (hexa sort): stacks of hexagons are placed on the board and matching colours move together; ten of one colour vanish. A bit more complex.
- [ ] Hledání min (minesweeper): simple and well known; the first tap never explodes.
- [ ] Generál (dice with a score sheet: three of a kind, straight, generál) against the computer; goes well with Kostky.
- [ ] Reversi, Mlýn, Lodě against the computer; follow on from Dáma and Piškvorky.

- [ ] Patnáctka: a picture variant (a photo cut into tiles). Needs larger images than the shared ones (about 132×176 px).
- [ ] Mahjong: a closer photo of the Náchod castle (the current one is a telephoto view from a distance).
- [ ] Mahjong: optional "no dead ends" mode (each picture only twice, so wrong choices can never get the game stuck).
- [ ] Launcher: play counts never go down; consider giving older plays less weight so a newly loved game can move up faster.
