// List of games for the launcher (and for offline mode in sw.js).
// New game = folder games/<id>/ with index.html and icon.svg + one line here.
// The launcher sorts tiles by how often each game is played, but only games opened at least
// 5 times move up; the rest (and ties) keep the order given here.
globalThis.GAMES = [
  { id: 'logik', name: 'Logik', description: 'Uhodni tajný barevný kód' },
  { id: 'sudoku', name: 'Sudoku', description: 'Doplň čísla do mřížky' },
  { id: 'malovane-krizovky', name: 'Malované křížovky', description: 'Vybarvi políčka podle čísel a odhal obrázek' },
  { id: 'skladani-kostek', name: 'Skládání kostek', description: 'Skládej tvary do mřížky' },
  { id: 'padajici-tvary', name: 'Padající tvary', description: 'Otáčej padající tvary a plň řady' },
  { id: 'barevne-kostky', name: 'Barevné kostky', description: 'Odebírej skupiny stejných barev' },
  { id: 'mahjong', name: 'Mahjong', description: 'Odebírej dvojice stejných kamenů' },
  { id: 'spojovani-obrazku', name: 'Spojování obrázků', description: 'Spojuj dvojice čárou nejvýš se dvěma ohyby' },
  { id: 'pexeso', name: 'Pexeso', description: 'Hledej dvojice stejných obrázků' },
  { id: 'spoj-tri', name: 'Spoj tři', description: 'Prohazuj kameny a skládej řady po třech' },
  { id: 'kocka', name: 'Kočka', description: 'Starej se o kočku Koxu a její zahrádku' },
  { id: 'prelevani', name: 'Přelévání', description: 'Přelévej barvy, ať je v každé zkumavce jedna' },
  { id: 'sroubky', name: 'Šroubky', description: 'Přesouvej matky, ať je na každém šroubu jedna barva' },
  { id: 'hanojske-veze', name: 'Hanojské věže', description: 'Přenes věž z disků na pravou tyč' },
  { id: 'spojovani-cisel', name: 'Spojování čísel', description: 'Posouvej a spojuj stejná čísla' },
  { id: 'cesta-ven', name: 'Cesta ven', description: 'Posouvej auta, ať červené vyjede ven' },
  { id: 'sipky-ven', name: 'Šipky ven', description: 'Pouštěj šipky z plochy, ať do sebe nenarazí' },
  { id: 'patnactka', name: 'Patnáctka', description: 'Posouvej čísla, až budou po řadě' },
  { id: 'paprsek', name: 'Paprsek', description: 'Otáčej zrcadly a doveď světlo do terčů' },
  { id: 'kulicka', name: 'Kulička', description: 'Nakláněj telefon a doveď kuličku do cíle' },
  { id: 'zavri-cisla', name: 'Zavři čísla', description: 'Házej kostkami a zavírej čísla' },
  // Board games against the computer.
  { id: 'dama', name: 'Dáma', description: 'Klasická dáma proti počítači' },
  { id: 'piskvorky', name: 'Piškvorky', description: 'Pět v řadě proti počítači' },
  // Kostky (user's wish: at the start of the card games), then the card solitaires.
  { id: 'kostky', name: 'Kostky', description: 'Házej kostkami proti soupeři' },
  { id: 'soliter', name: 'Solitér', description: 'Skládej karty od esa po krále' },
  { id: 'freecell', name: 'FreeCell', description: 'Solitér se čtyřmi volnými políčky' },
  { id: 'pyramida', name: 'Pyramida', description: 'Odebírej dvojice karet se součtem 13' },
  { id: 'pavouk', name: 'Pavouk', description: 'Skládej řady od krále po eso' },
  // Card games against the computer.
  { id: 'oko-bere', name: 'Oko bere', description: 'Ber karty do 21 proti počítači' },
  { id: 'oko-bere-plus-minus', name: 'Oko bere plus mínus', description: 'Do 21 s kartami plus a mínus' },
  { id: 'prsi', name: 'Prší', description: 'Zbav se karet dřív než soupeři' },
];
