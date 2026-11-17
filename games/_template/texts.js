// Texts of Rozsviť (the template). cs is the source; other languages are filled by the translation pass (CLAUDE.md, Texts and languages).
// Keys start with the game's id. The name of the game is game.<id>.name in i18n/games.js; shared buttons and dialogs
// are common.* in i18n/common.js. A new game writes only cs (and a note when the key alone does not say enough).
I18N.add({
  '_template.theme.night':  { cs: 'Noc', en: 'Night' },
  '_template.theme.green':  { cs: 'Zelená', en: 'Green' },
  // a plural: one message with every Czech form (one = 1, few = 2–4, many = a fraction, other = 0 and 5+); # is the number
  '_template.moves':        { cs: '{n, plural, one {<b>#</b> tah} few {<b>#</b> tahy} many {<b>#</b> tahu} other {<b>#</b> tahů}}',
                              en: '{n, plural, one {<b>#</b> move} other {<b>#</b> moves}}', note: 'the score row under the top bar' },
  '_template.cell.on':      { cs: 'Svítí', en: 'Lit', note: 'aria-label of a light' },
  '_template.cell.off':     { cs: 'Nesvítí', en: 'Unlit', note: 'aria-label of a light' },
  '_template.hint.play':    { cs: 'Ťukni na světlo, přepne se i se sousedy', en: 'Tap a light, it switches along with its neighbours' },
  '_template.hint.won':     { cs: 'Všechno svítí!', en: 'All the lights are on!' },
  '_template.toast.won':    { cs: 'Všechno už svítí – ťukni na Nová hra', en: 'All the lights are on – tap New game' },
  '_template.toast.over':   { cs: 'Hra skončila – ťukni na Nová hra', en: 'The game is over – tap New game' },
  '_template.won.title':    { cs: 'Výborně! 🎉', en: 'Well done! 🎉' },
  // a whole sentence with a param, never glued from pieces
  '_template.won.text':     { cs: 'Všechno svítí. Tahy: <b>{n}</b>', en: 'All the lights are on. Moves: <b>{n}</b>' },
  '_template.size':         { cs: 'Velikost', en: 'Size' },
  '_template.size.small':   { cs: 'Snadné, velká světla.', en: 'Easy, big lights.' },
  '_template.size.large':   { cs: 'Těžší, víc světel.', en: 'Harder, more lights.' },
  '_template.size.notice':  { cs: 'Po návratu do hry začne <b>nová hra</b> s novou velikostí.', en: 'When you go back to the game, a <b>new game</b> starts with the new size.' },
  '_template.toast.newSize': { cs: 'Začala nová hra s novou velikostí', en: 'A new game started with the new size' },
  '_template.help.1':       { cs: 'Ťukni na světlo. Přepne se ono i sousední světla nahoře, dole, vlevo a vpravo.', en: 'Tap a light. It switches, and so do its neighbours above, below, left and right.' },
  '_template.help.2':       { cs: 'Rozsviť všechna světla. Každá hra jde vyřešit a nikam se nespěchá.', en: 'Turn all the lights on. Every game can be solved and there is no hurry.' },
  '_template.help.3':       { cs: '<b>Zpět</b> vrátí poslední tah. Dá se ťukat opakovaně.', en: '<b>Undo</b> takes back the last move. You can tap it again and again.' },
});
