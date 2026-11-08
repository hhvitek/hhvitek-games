---
name: new-game
description: Procedure for making a new game in this project (games for seniors) or for a bigger rebuild of an existing game. Use it whenever the user asks for a new game ("udělej novou hru", "přidej hru", "nová hra", "hra jako …") or for a large change of a game's layout, rules or controls. It makes sure the CLAUDE.md rules, the patterns, the screenshot check and the independent review are not forgotten.
---

# New game (or a bigger rebuild)

Work through these steps in order and keep them on your task list. Do not report "done" before step 9.
CLAUDE.md is the source of the rules; this file only says what to do when.

## 1. Read first
- `CLAUDE.md` completely: the rules, both "Decisions…" sections (the user's choices), "Patterns every game follows", Testing.
- `games/_template/index.html` completely: it is the skeleton every game copies (contract, storage, Back button,
  `nothingOpen()`/`whenFree()`, settings, help, start block, test hook).

## 2. Create the game
- `<id>` = the game's Czech name without diacritics in kebab-case (`games/zavri-cisla/`).
- Copy `games/_template/` to `games/<id>/`, then replace only the parts marked as game logic. Keep everything marked "rule" or "contract".
- Add `games/<id>/icon.svg` (`viewBox="0 0 512 512"`), one line in `games/registry.js`, a Czech row in `README.md`.
- After every edit the hook runs `node tools/check.js <id>`; fix what it reports before going on.

## 3. Write the game: copy each pattern from the game that does it best
| Pattern | Copy from |
|---|---|
| records per variant (`bests[rulesKey]`) + `bb` in history, Undo puts the record back | `games/spojovani-cisel/` |
| randomness after a move from `G.seed` (saved with the game and in every history entry) | `games/zavri-cisla/` (dice), `games/spoj-tri/` (stones) |
| `busy` (generating, animation): taps explain themselves "Chvilku, …", a second Nová hra is ignored | `games/cesta-ven/` `newGame` |
| hint: a tap on the hinted piece and on its place does the hinted move | `games/hanojske-veze/`, `games/pavouk/` |
| settings that need a new game: notice in Settings and toast after returning, both with `!isFresh()` | `games/patnactka/` `closeSettings` |
| saved game validated, the end derived from the board, a broken history only loses Undo | `games/zavri-cisla/` `validGame` |
| end dialog only for its game, never over Settings/Help | `whenFree(g0, ms, fn)` from the template |
| sizes from the room left (no scrolling); sizes in px from a CSS variable, never `%` padding | template `layout()`, `games/zavri-cisla/` dice |
| a computer opponent: own AI and `LEVELS`, the name, face, stars and head from `games/_opponents/opponents.js` (never drawn again in the game) | `games/oko-bere/` (small head), `games/kostky/` (big panel), `games/prsi/` (play styles, two opponents) |

Senior rules to keep in mind while writing: Czech, "ty" only in the imperative, no time pressure (unless the user
decided otherwise), targets ≥ 45 px, text ≥ 18 px, unavailable actions dimmed + a toast, Zpět, help only behind "?".

## 4. Teach the screenshot pass the game
Add an entry for `<id>` to `play` in `tools/shots.js`: a move, the hint (if any), a tap on the hinted piece and on its place.

## 5. Check
- `node tools/check.js <id>` must pass.
- Start a server in the repo root (`node tools/serve.js`, port 8765), write `.playwright-mcp/shots.json` = `{"ids": ["<id>"]}`,
  run the Playwright MCP tool `browser_run_code_unsafe` with `filename: tools/shots.js`, delete `shots.json`.
  Use the project's headless Playwright MCP from `.mcp.json` (see "Playwright" in CLAUDE.md), never a visible
  browser window. Use it while building the game too, not only at this step.

## 6. Look at the pictures (do not skip: scripts miss layout problems)
Open `.playwright-mcp/sheet-<id>.png` with the Read tool and check:
- big empty areas or one part far too large; everything sized to the screen at 393×873 and at 393×760 (picture 5short),
- anything too small to see or hit: dice pips, labels, numbers, targets under 45 px,
- overlaps, text cut off, a toast or dialog over Settings/Help,
- after play (picture 2play): the move happened, the hint shows clearly what to do,
- settings and help: the light shared look, readable, the game name on top.
Then switch through every theme in Settings (one shot each, or a quick script) and look again.

## 7. Independent review
Start the `game-review` subagent on `games/<id>/`. Verify each finding in the code yourself, fix the real ones,
then repeat steps 5–6 for what changed.

## 8. Record the user's decisions
What the user decided about this game goes to CLAUDE.md "Decisions for single games"; open questions to TODO.md.

## 9. Report
Send the user the sheet (SendUserFile with `.playwright-mcp/sheet-<id>.png`), say what was checked and what was not.
Commit only when the user asks.
