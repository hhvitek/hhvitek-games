# TODO

Things left to do, roughly in order of importance. Delete an item when it is done (git keeps the history).
The user's decisions on how things should be are in CLAUDE.md ("Decisions…" sections), not here.

## Testing on the real phone

- [ ] Dáma: how long the Mistr thinks on the Xiaomi (on a computer about 0.5 s on average, 2.7 s at most; it stops at 20 s at the latest (8 s without a worker), and only then could the same position give a different move after Zpět).

- [ ] Brave on Android (the Samsung S25 of the report): check that the bottom buttons are no longer cut off in the app installed by Brave; Nastavení → "Údaje o obrazovce" in the launcher shows what the last game measured. By the table in CLAUDE.md ("Visible height") Brave reports the same height for `visualViewport` as for `100dvh`, so the 1.0.4 rule alone may not be enough. When it is settled, remove both TEMPORARY parts: the card in `index.html` and the `games.launcher.diag` write in every game and the template.
- [ ] Open the launcher on the target phone (Xiaomi 13T/14T/15T), add it to the home screen and play each game once.
- [ ] Turn on airplane mode and check that all games and the image sets (Mahjong: Kočky, Náchodsko, Znaky obcí, Houby, Ptáci, Ovoce a zelenina) still load offline.
- [ ] Check that an old game in progress survives the update (old `hry.*.rozehrano` and `<id>.v1` keys are migrated).
- [ ] Open a game straight from disk once (double-click `games/<id>/index.html`): the Playwright MCP blocks `file:///`, so this is not tested automatically.

## Open questions for the user

- [ ] Dáma: is the default opponent "Běžný hráč" about right for the players (not too easy, not frustrating)? It looks two half-moves ahead with noise and sometimes plays the second best move; tune it after playing on the phone.
- [ ] Dáma: on 360 px wide phones the squares are about 42 px (0.75 cm), just under the 0.8 cm rule (like Logik on short screens). Keep?

- [ ] Small targets: Barevné kostky at 10 × 14 has stones of about 0.6 cm (under the 0.8 cm rule; the settings note says
  they are small), and Logik holes go down to about 0.75 cm on short screens with 10–12 attempts. Keep, drop the
  largest board / the most attempts, or make the boards scroll?
- [ ] Zavři čísla: the dice come from the saved seed, so after a roll the player can press Zpět, close other tiles and see the same dice again; repeated, this shows the coming rolls. Keep it, or allow Undo only within the current roll?

- [ ] Spojování čísel: on the 3 × 3 grid the goals are now a quarter (128 / 256 / 512 instead of 512 / 1024 / 2048), because nine cells can hold at most 1024. Chosen by the agent while fixing the review findings (2026-11-10): keep, or other goals?

## Ideas

- [ ] New game "Drápky" (Figury) from the user's sheet "Pravidla her v kostky": up to 3 rolls per turn to make one of 14 figures, unused rolls carry over ("čárky k dobru"); could reuse the Kostky opponent.
- [ ] New game "Spojování" (Shisen-Sho / Mahjong Connect): flat grid, connect pairs with a line with at most two bends.
- [ ] Patnáctka: a picture variant (a photo cut into tiles). Needs larger images than the shared ones (about 132×176 px).
- [ ] Mahjong: a closer photo of the Náchod castle (the current one is a telephoto view from a distance).
- [ ] Mahjong: optional "no dead ends" mode (each picture only twice, so wrong choices can never get the game stuck).
- [ ] Launcher: play counts never go down; consider giving older plays less weight so a newly loved game can move up faster.
