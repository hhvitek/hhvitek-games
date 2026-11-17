// The languages of the app (CLAUDE.md, Texts and languages). cs is the source language and always ready.
// A language is offered to the players only when ready: true (every message translated; tools/i18n.js --strict
// is the release gate). Plain script: it works in a page, from file://, in the service worker and in a Node vm.
globalThis.LANGS = [
  { code: 'cs', name: 'Čeština', ready: true },
  { code: 'en', name: 'English', ready: true },
];
