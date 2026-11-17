---
name: translate
description: The translation pass of this project (mobile games) - fills the missing or stale translations of the texts (en and other languages) and adds a new language. Use it when the user says "přelož", "překlad", "translate", asks for a new language, or before a release while `node tools/i18n.js` reports translation debt for a ready language.
---

# Translation pass

Development writes only `cs` (CLAUDE.md, "Texts and languages"); this pass writes everything else. You are the
orchestrator: subagents translate, you verify. Never edit a `cs` text here.

1. `node tools/i18n.js` shows the debt per language. `node tools/i18n.js --todo en [ids…]` prints JSON of what to
   translate: `{ key, game, cs, oldCs?, oldText?, note? }` (ids: game ids, `shared`, `launcher`; none = all).
2. Split it into batches of about 300 messages, one game (or `shared`) at a time, and give each batch to a subagent
   (Agent tool, `model: opus`: the strongest model, never a smaller one; user's decision 2026-11-17). The brief: the batch, `i18n/glossary.md` and these rules:
   - keep the ICU syntax and every `{param}`, `#`, `[marker]` and HTML tag exactly; use the plural categories of the
     target language (English: `one`, `other`); a `{fem, select, …}` may be dropped where the language has no gender;
   - same meaning, natural wording, informal "you", short button labels; no Czech diacritics in `en`;
   - write the `en` field into the game's `games/<id>/texts.js` (or `i18n/*.js` for shared texts) next to the `cs`,
     never touching `cs`; a stale translation (`oldText`) is rewritten from the new `cs`.
   Batches in different files may run in parallel (they use no Playwright).
3. Independent review (user's decision 2026-11-17): a fresh read-only subagent (`model: opus`, never a fork, none of
   the translator's notes) gets the diff and `i18n/glossary.md` and reads it as a native editor (still sounds
   translated, meaning lost, glossary broken, too long for a button). Send the real findings back to the translator
   and review again until nothing real is left (at most 3 rounds).
   Verify: `node tools/check.js` passes (params equal, no Czech in `en`), then record what was translated:
   `node tools/i18n.js --mark-translated en <ids>`, then `node tools/i18n.js <ids>` must show 0 debt for those.
4. Look at the games with much new text: `.playwright-mcp/shots.json` = `{"ids": [...], "langs": ["en"]}`, run
   `tools/shots.js` and read the sheets (check titles and buttons).
5. Report what was translated and what is still open; commit only when the user asks.

**A new language:** add `{ code, name, ready: false }` to `i18n/languages.js` (and its flag to `i18n/flags.js`), run the
pass for it, and set `ready: true` only when `node tools/i18n.js` shows no debt for it (the launcher's flag button and
language card then appear by themselves). Before the first release with a ready language the release gate must exist
(`node tools/i18n.js --strict`, TODO.md).
