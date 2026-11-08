# TODO

Things left to do, roughly in order of importance. Delete an item when it is done (git keeps the history).
The user's decisions on how things should be are in CLAUDE.md ("Decisions…" sections), not here.

## Publishing

- [ ] Turn on GitHub Pages (the user, in the browser): Settings → Pages → Build and deployment → Source: **GitHub Actions**.
- [ ] Settings → Environments → `github-pages` → Deployment branches and tags → add a rule for the tag pattern `v*` (by default only master may deploy, and the release tags would be refused).
- [ ] First release `1.0.0` when the user says so (`node tools/release.js`, see Deployment in CLAUDE.md), then check the Actions run and `https://hhvitek.github.io/hhvitek-games/`.

## Testing on the real phone

- [ ] Open the launcher on the target phone (Xiaomi 13T/14T/15T), add it to the home screen and play each game once.
- [ ] Turn on airplane mode and check that all games and the image sets (Mahjong: Kočky, Náchodsko, Znaky obcí, Houby, Ptáci, Ovoce a zelenina) still load offline.
- [ ] Check that an old game in progress survives the update (old `hry.*.rozehrano` and `<id>.v1` keys are migrated).
- [ ] Open a game straight from disk once (double-click `games/<id>/index.html`): the Playwright MCP blocks `file:///`, so this is not tested automatically.

## Open questions for the user

- [ ] Small targets: Barevné kostky at 10 × 14 has stones of about 0.6 cm (under the 0.8 cm rule; the settings note says
  they are small), and Logik holes go down to about 0.75 cm on short screens with 10–12 attempts. Keep, drop the
  largest board / the most attempts, or make the boards scroll?
- [ ] Zavři čísla: the dice come from the saved seed, so after a roll the player can press Zpět, close other tiles and see the same dice again; repeated, this shows the coming rolls. Keep it, or allow Undo only within the current roll?

## Ideas

- [ ] New game "Drápky" (Figury) from the user's sheet "Pravidla her v kostky": up to 3 rolls per turn to make one of 14 figures, unused rolls carry over ("čárky k dobru"); could reuse the Kostky opponent.
- [ ] New game "Spojování" (Shisen-Sho / Mahjong Connect): flat grid, connect pairs with a line with at most two bends.
- [ ] Patnáctka: a picture variant (a photo cut into tiles). Needs larger images than the shared ones (about 132×176 px).
- [ ] Mahjong: a closer photo of the Náchod castle (the current one is a telephoto view from a distance).
- [ ] Mahjong: optional "no dead ends" mode (each picture only twice, so wrong choices can never get the game stuck).
- [ ] Launcher: play counts never go down; consider giving older plays less weight so a newly loved game can move up faster.
