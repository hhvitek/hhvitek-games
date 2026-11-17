// Texts of the shared card look (games/_cards/cards.js) and of the mariáš cards (games/_cards/marias.js).
// cs is the source; other languages are filled by the translation pass (CLAUDE.md, Texts and languages).
// The pictures on the cards stay the same in every language; only the names change (user's decision 2026-11-17:
// English mariáš names Under / Over / King / Ace and suits Hearts / Leaves / Bells / Acorns).
I18N.add({
  // tables (the paper table is common.theme.paper)
  'cards.table.green':      { cs: 'Zelené sukno', en: 'Green felt' },
  'cards.table.blue':       { cs: 'Modré sukno', en: 'Blue felt' },
  'cards.table.wine':       { cs: 'Vínová', en: 'Burgundy' },
  'cards.table.wood':       { cs: 'Dřevo', en: 'Wood' },
  'cards.table.slate':      { cs: 'Břidlice', en: 'Slate' },
  'cards.table.sand':       { cs: 'Písková', en: 'Sand' },
  'cards.table.night':      { cs: 'Noc', en: 'Night' },
  // card backs
  'cards.back.nachod':      { cs: 'Zámek Náchod', en: 'Náchod Castle', note: 'a photo of the castle' },
  'cards.back.nachod-coat': { cs: 'Erb Náchoda', en: 'Náchod coat of arms' },
  'cards.back.blue':        { cs: 'Modrá mřížka', en: 'Blue lattice' },
  'cards.back.red':         { cs: 'Červená mřížka', en: 'Red lattice' },
  'cards.back.green':       { cs: 'Zelené puntíky', en: 'Green dots' },
  'cards.back.purple':      { cs: 'Fialové kostky', en: 'Purple checks' },
  'cards.back.brown':       { cs: 'Hnědé proužky', en: 'Brown stripes' },
  'cards.back.cat':         { cs: 'Kočička', en: 'Kitty' },
  'cards.back.sun':         { cs: 'Sluníčko', en: 'Sunshine' },
  'cards.back.flower':      { cs: 'Kytička', en: 'Flower' },
  'cards.back.fish':        { cs: 'Rybička', en: 'Fish' },
  // card faces
  'cards.face.white':       { cs: 'Bílé', en: 'White' },
  'cards.face.cream':       { cs: 'Krémové', en: 'Cream' },
  'cards.face.contrast':    { cs: 'Kontrastní', en: 'High contrast' },
  // pictures in the middle of the cards
  'cards.pic.classic':      { cs: 'Klasické', en: 'Classic' },
  'cards.pic.classic.desc': { cs: 'Velký symbol barvy, u kluka, dámy a krále písmeno.', en: 'A big suit symbol, with a letter on the jack, queen and king.' },
  'cards.pic.stick':        { cs: 'Panďuláci', en: 'Stick figures' },
  'cards.pic.stick.desc':   { cs: 'Postavičky drží svou barvu. Kluk má kšiltovku, dáma korunku, král korunu a vousy.', en: 'Little figures holding their suit symbol. The jack wears a cap, the queen a tiara, the king a crown and a beard.' },
  'cards.pic.animals':      { cs: 'Zvířátka', en: 'Animals' },
  'cards.pic.animals.desc': { cs: 'Esa jsou sovičky, kluci pejsci, dámy kočičky a králové lvi. Čísla jsou broučci.', en: 'The aces are owls, jacks are dogs, queens are cats and kings are lions. The number cards are beetles.' },
  'cards.pic.smile':        { cs: 'Smajlíci', en: 'Smileys' },
  'cards.pic.smile.desc':   { cs: 'Veselé obličeje. Kluk má kšiltovku, dáma mašli, král korunu.', en: 'Happy faces. The jack wears a cap, the queen a bow, the king a crown.' },
  // the appearance part of the settings
  'cards.pics':             { cs: 'Obrázky na kartách', en: 'Card pictures' },
  'cards.pics.note':        { cs: 'Hodnota a barva v rohu karty zůstávají vždy stejné.', en: 'The rank and suit in the corner of a card always stay the same.' },
  'cards.table':            { cs: 'Stůl', en: 'Table' },
  'cards.back':             { cs: 'Rub karet', en: 'Card back' },
  'cards.credit.castle':    { cs: 'Fotka zámku Náchod: {author}, {license}, <a href="{source}" target="_blank" rel="noopener">zdroj</a>',
                              en: 'Photo of Náchod Castle: {author}, {license}, <a href="{source}" target="_blank" rel="noopener">source</a>' },
  'cards.credit.coat':      { cs: 'Erb Náchoda: {author}, {license}, <a href="{source}" target="_blank" rel="noopener">zdroj</a>',
                              en: 'Náchod coat of arms: {author}, {license}, <a href="{source}" target="_blank" rel="noopener">source</a>' },
  'cards.credit.commons':   { cs: 'Obrázky jsou z Wikimedia Commons.', en: 'The pictures are from Wikimedia Commons.' },
  'cards.face':             { cs: 'Barva líce', en: 'Card face' },
  // the statistics of the solitaires (CARDS.statsKit, CARDS.statsNote)
  'cards.stats.hinted':     { cs: 'S radou se tahle hra nepočítá do statistiky', en: 'You used a hint, so this game won\'t count towards your statistics' },
  'cards.stats.note':       { cs: 'Počítají se jen dohrané hry (vyhrané, nebo když už nejde žádný tah) bez Poradit.{mixed, select, true { Starší čísla zahrnují i hry, které nebyly dohrané: dřív se počítala každá rozehraná hra.} other {}}',
                              en: 'Only finished games (won, or with no moves left) played without a hint count.{mixed, select, true { The older figures also include unfinished games, because every game you started used to count.} other {}}' },
  // the mariáš cards (MARIAS.cardName): rank 0 sedma … 7 eso, suit 0 srdce, 1 listy (zelené), 2 kule, 3 žaludy
  'cards.marias.card':      { cs: '{rank, select, 0 {sedma} 1 {osma} 2 {devítka} 3 {desítka} 4 {spodek} 5 {svršek} 6 {král} other {eso}} {suit, select, 0 {srdce} 1 {listy} 2 {kule} other {žaludy}}',
                              en: '{rank, select, 0 {Seven} 1 {Eight} 2 {Nine} 3 {Ten} 4 {Under} 5 {Over} 6 {King} other {Ace}} of {suit, select, 0 {Hearts} 1 {Leaves} 2 {Bells} other {Acorns}}',
                              note: 'the name of one mariáš card, e.g. "eso srdce" (aria-label)' },
  'cards.marias.rank':      { cs: '{rank, select, 0 {sedma} 1 {osma} 2 {devítka} 3 {desítka} 4 {spodek} 5 {svršek} 6 {král} other {eso}}',
                              en: '{rank, select, 0 {Seven} 1 {Eight} 2 {Nine} 3 {Ten} 4 {Under} 5 {Over} 6 {King} other {Ace}}',
                              note: 'the name of a mariáš rank alone, rank 0 sedma … 7 eso (help pictures)' },
  'cards.faceDown':         { cs: 'karta rubem nahoru', en: 'card face down', note: 'aria-label of a card lying face down' },
});
