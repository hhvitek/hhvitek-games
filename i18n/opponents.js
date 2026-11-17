// Texts of the computer opponents (games/_opponents/opponents.js). cs is the source; other languages are filled by the
// translation pass (CLAUDE.md, Texts and languages).
// The names are a comma-separated list per gender and language: each language uses its own names (user's decision
// 2026-11-17: English opponents get English names), the gender stays (it decides the Czech past tense and the face).
// A list may have any length; a saved opponent whose name is not in the list of the current language is replaced.
I18N.add({
  'opponents.names.m':     { cs: 'Pepa, Honza, Franta, Karel, Jirka, Mirek, Láďa, Tonda, Venca, Standa, Vašek, Petr',
                             en: 'Tom, Jack, Harry, Charlie, George, Sam, Mike, Joe, Bill, Pete, Danny, Fred',
                             note: 'male first names, short and friendly as among neighbours, comma-separated' },
  'opponents.names.f':     { cs: 'Jarka, Marie, Hanka, Věra, Zdena, Jana, Alena, Eva, Božena, Libuše, Milena, Dáša',
                             en: 'Mary, Kate, Annie, Sue, Lucy, Jenny, Ellie, Molly, Betty, Rose, Emma, Grace',
                             note: 'female first names, short and friendly as among neighbours, comma-separated' },
  // aria-label of the level stars: "Zkušený hráč, 2 hvězdičky ze 3"
  'opponents.levelSpoken': { cs: '{title}, {n, plural, one {# hvězdička} few {# hvězdičky} many {# hvězdičky} other {# hvězdiček}} {total, select, 2 {ze 2} 3 {ze 3} 4 {ze 4} other {z {total}}}',
                             en: '{title}, {n} of {total} stars',
                             note: 'title = the name of the level, n = its stars, total = all stars' },
  'opponents.heading':     { cs: 'Soupeř', en: 'Opponent', note: 'heading of the settings card and of the help section about the opponent' },
  'opponents.speed':       { cs: 'Rychlost soupeře', en: 'Opponent speed' },
  'opponents.speed.slow':  { cs: 'Pomalu', en: 'Slow' },
  'opponents.speed.fast':  { cs: 'Rychle', en: 'Fast' },
  'opponents.playAgainst': { cs: 'Hraješ proti soupeři: {level}', en: 'Your opponent: {level}', note: 'toast after the level was changed; level = e.g. "Mistr ★★★"' },
});
