---
name: new-game
description: Procedure for making a new game in this project (mobile games) or for a bigger rebuild of an existing game. Use it whenever the user asks for a new game ("udělej novou hru", "přidej hru", "nová hra", "hra jako …") or for a large change of a game's layout, rules or controls. It makes sure the CLAUDE.md rules, the patterns, the screenshot check and the independent review are not forgotten.
---

# New game (or a bigger rebuild)

Work through these steps in order and keep them on your task list. Do not report "done" before step 9.
CLAUDE.md is the source of the rules; this file only says what to do when.

**You are the orchestrator** (user's decision, CLAUDE.md "Adding a game"): you plan, decide, talk to the user and check
results; subagents (Agent tool) do the analysis (rules, which game to copy from, engine design) and the implementation
(steps 2–4, the engine test, the fixes of step 7). Brief each one narrowly and tell it to read CLAUDE.md, the template
and this skill. Only one agent at a time uses the Playwright MCP. Steps 5–6 you verify yourself (check.js, reading the
sheet), and step 7 is always last and done by a fresh, independent agent. Before step 1 start the usage guard
(CLAUDE.md "Usage guard": check the limits, set up the 10-minute watcher) and keep to it until the end.

## 1. Read first
- `CLAUDE.md` completely: the rules, both "Decisions…" sections (the user's choices), "Patterns every game follows", Testing.
- `games/_template/index.html` completely: it is the skeleton every game copies (contract, storage, Back button,
  `nothingOpen()`/`whenFree()`, settings, help, start block, test hook).

## 2. Create the game
- `<id>` = the game's Czech name without diacritics in kebab-case (`games/zavri-cisla/`).
- Copy `games/_template/` to `games/<id>/`, then replace only the parts marked as game logic. Keep everything marked "rule" or "contract".
- Add `games/<id>/icon.svg` (`viewBox="0 0 512 512"`), one line in `games/registry.js` right before `kostky`
  (after the other new games; the user's rule, see CLAUDE.md), a Czech row in `README.md` right before the Kostky row.
- After every edit the hook runs `node tools/check.js <id>`; fix what it reports before going on.

## 3. Write the game: copy each pattern from the game that does it best
| Pattern | Copy from |
|---|---|
| records per variant (`bests[rulesKey]`) + `bb` in history, Undo puts the record back | `games/patnactka/` (`rulesKey`, `bb` in `move` and Undo) |
| randomness after a move from `G.seed` (saved with the game and in every history entry) | `games/zavri-cisla/` (dice), `games/spoj-tri/` (stones) |
| `busy` (generating, animation): taps explain themselves "Chvilku, …", a second Nová hra is ignored | `games/cesta-ven/` `newGame` |
| hint: a tap on the hinted piece and on its place does the hinted move | `games/pavouk/` (Hanojské věže plays it only from a tap on the disc) |
| settings that need a new game: notice in Settings and toast after returning, both with `!isFresh()` | `games/patnactka/` `closeSettings` |
| a new difficulty, size or opponent level applies from the next game, an untouched game is replaced at once (the template does not do this yet) | `games/hledani-min/` `closeSettings` and its start block |
| saved game validated, the end derived from the board, a broken history only loses Undo | `games/zavri-cisla/` `validGame` |
| end dialog only for its game, never over Settings/Help | `whenFree(g0, ms, fn)` from the template |
| sizes from the room left (no scrolling); sizes in px from a CSS variable, never `%` padding | template `layout()`, `games/zavri-cisla/` dice |
| `#app` as tall as the visible window (`height:var(--app-h,100dvh)` + the "Visible height" block, checked; see "Visible height" in CLAUDE.md) | template |
| a computer opponent: own AI and `LEVELS`, the name, face, stars and head from `games/_opponents/opponents.js` (never drawn again in the game) | `games/oko-bere/` (small head), `games/kostky/` (big panel), `games/prsi/` (play styles, two opponents) |

Keep in mind while writing: Czech player texts (informal "ty", gender-neutral), help behind "?", settings applied at
once. Any controls are allowed (gestures, long presses, multi-touch, time pressure; the senior rules were dropped on
2026-11-12); explain them in the help.

## 4. Teach the screenshot pass the game
Add an entry for `<id>` to `play` in `tools/shots.js`: a move, the hint (if any), a tap on the hinted piece and on its place.

## 5. Check
- `node tools/check.js <id>` must pass, and `node tools/saves-test.js --ids <id>` (broken saves never crash the game).
- Start a server in the repo root (`node tools/serve.js`, port 8765; another port when told so, e.g. `node tools/serve.js 8771`,
  then first navigate the Playwright page to `http://localhost:8771/` so the pass uses that server), write `.playwright-mcp/shots.json` = `{"ids": ["<id>"]}`,
  run the Playwright MCP tool `browser_run_code_unsafe` with `filename: tools/shots.js`, delete `shots.json`.
  Use the project's headless Playwright MCP from `.mcp.json` (see "Playwright" in CLAUDE.md), never a visible
  browser window. Use it while building the game too, not only at this step.

## 6. Look at the pictures (do not skip: scripts miss layout problems)
Open `.playwright-mcp/sheet-<id>.png` with the Read tool and check:
- big empty areas or one part far too large; everything sized to the screen at 393×873 and at 393×760 (picture 5short),
- anything too small to see or hit comfortably on the phone: dice pips, labels, numbers, targets,
- overlaps, text cut off, a toast or dialog over Settings/Help,
- after play (picture 2play): the move happened, the hint shows clearly what to do,
- settings and help: the light shared look, readable, the game name on top.
Then switch through every theme in Settings (one shot each, or a quick script) and look again.

## 7. Independent review
When everything else is done, start the `game-review` subagent fresh (not a fork) on `games/<id>/`, with only the
folder: none of your or the implementers' conclusions. Verify each finding in the code yourself, have a subagent fix the
real ones, then repeat steps 5–6 for what changed (and the review again when the fixes were large).

## 8. Record the user's decisions
What the user decided about this game goes to CLAUDE.md "Decisions for single games"; open questions to TODO.md.

## 9. Report
Send the user the sheet (SendUserFile with `.playwright-mcp/sheet-<id>.png`), say what was checked and what was not.
Commit only when the user asks.
