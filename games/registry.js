// List of games for the launcher (and for offline mode in sw.js): only the id and the order.
// The name and the description of each game are texts: game.<id>.name and game.<id>.desc in i18n/games.js.
// New game = folder games/<id>/ with index.html and icon.svg + one line here + its name and description in i18n/games.js.
// The launcher sorts tiles by how often each game is played, but only games opened at least
// 5 times move up; the rest (and ties) keep the order given here.
// texts: true = the game keeps its texts in games/<id>/texts.js (sw.js caches it; tools/check.js checks both ways).
globalThis.GAMES = [
  { id: 'logik', texts: true },
  { id: 'sudoku', texts: true },
  { id: 'skladani-kostek', texts: true },
  { id: 'padajici-tvary', texts: true },
  { id: 'barevne-kostky', texts: true },
  { id: 'mahjong', texts: true },
  { id: 'spojovani-obrazku', texts: true },
  { id: 'pexeso', texts: true },
  { id: 'spoj-tri', texts: true },
  { id: 'kocka', texts: true },
  { id: 'prelevani', texts: true },
  { id: 'hanojske-veze', texts: true },
  { id: 'spojovani-cisel', texts: true },
  { id: 'cesta-ven', texts: true },
  { id: 'patnactka', texts: true },
  { id: 'paprsek', texts: true },
  { id: 'kulicka', texts: true },
  { id: 'zavri-cisla', texts: true },
  // Board games against the computer.
  { id: 'dama', texts: true },
  { id: 'piskvorky', texts: true },
  // New games (user's rule 2026-11-12): right before Kostky, after the board games; the newest last.
  { id: 'sroubky', texts: true },
  { id: 'malovane-krizovky', texts: true },
  { id: 'sipky-ven', texts: true },
  { id: 'hledani-min', texts: true },
  { id: 'general', texts: true },
  { id: 'reversi', texts: true },
  { id: 'lode', texts: true },
  { id: 'mlyn', texts: true },
  { id: 'vezicky', texts: true },
  { id: 'pristani', texts: true },
  // Kostky (user's wish: at the start of the card games), then the card solitaires.
  { id: 'kostky', texts: true },
  { id: 'soliter', texts: true },
  { id: 'freecell', texts: true },
  { id: 'pyramida', texts: true },
  { id: 'pavouk', texts: true },
  // Card games against the computer.
  { id: 'oko-bere', texts: true },
  { id: 'oko-bere-plus-minus', texts: true },
  { id: 'prsi', texts: true },
];
