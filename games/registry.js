// List of games for the launcher (and for offline mode in sw.js).
// New game = folder games/<id>/ with index.html and icon.svg + one line here.
// The launcher sorts tiles by how often each game is played, but only games opened at least
// 5 times move up; the rest (and ties) keep the order given here.
globalThis.GAMES = [
  { id: 'logik', name: 'Logik', description: 'Uhodni tajný barevný kód' },
  { id: 'sudoku', name: 'Sudoku', description: 'Doplň čísla do mřížky' },
  { id: 'skladani-kostek', name: 'Skládání kostek', description: 'Skládej tvary do mřížky' },
  { id: 'padajici-tvary', name: 'Padající tvary', description: 'Otáčej padající tvary a plň řady' },
  { id: 'barevne-kostky', name: 'Barevné kostky', description: 'Odebírej skupiny stejných barev' },
  { id: 'mahjong', name: 'Mahjong', description: 'Odebírej dvojice stejných kamenů' },
  { id: 'pexeso', name: 'Pexeso', description: 'Hledej dvojice stejných obrázků' },
  { id: 'spoj-tri', name: 'Spoj tři', description: 'Prohazuj kameny a skládej řady po třech' },
  { id: 'prelevani', name: 'Přelévání', description: 'Přelévej barvy, ať je v každé zkumavce jedna' },
  { id: 'hanojske-veze', name: 'Hanojské věže', description: 'Přenes věž z disků na pravou tyč' },
  { id: 'spojovani-cisel', name: 'Spojování čísel', description: 'Posouvej a spojuj stejná čísla' },
  { id: 'cesta-ven', name: 'Cesta ven', description: 'Posouvej auta, ať červené vyjede ven' },
  { id: 'patnactka', name: 'Patnáctka', description: 'Posouvej čísla, až budou po řadě' },
  { id: 'paprsek', name: 'Paprsek', description: 'Otáčej zrcadly a doveď světlo do terčů' },
  { id: 'kulicka', name: 'Kulička', description: 'Nakláněj telefon a doveď kuličku do cíle' },
  { id: 'zavri-cisla', name: 'Zavři čísla', description: 'Házej kostkami a zavírej čísla' },
  { id: 'kostky', name: 'Kostky', description: 'Házej kostkami proti soupeři' },
  // Board games against the computer.
  { id: 'dama', name: 'Dáma', description: 'Klasická dáma proti počítači' },
  // Card solitaires last.
  { id: 'soliter', name: 'Solitér', description: 'Skládej karty od esa po krále' },
  { id: 'freecell', name: 'FreeCell', description: 'Solitér se čtyřmi volnými políčky' },
  { id: 'pyramida', name: 'Pyramida', description: 'Odebírej dvojice karet se součtem 13' },
  { id: 'pavouk', name: 'Pavouk', description: 'Skládej řady od krále po eso' },
  // Card games against the computer.
  { id: 'oko-bere', name: 'Oko bere', description: 'Ber karty do 21 proti počítači' },
  { id: 'oko-bere-plus-minus', name: 'Oko bere plus mínus', description: 'Do 21 s kartami plus a mínus' },
  { id: 'prsi', name: 'Prší', description: 'Zbav se karet dřív než soupeři' },
];
