// The app version, shown in the launcher's Nastavení and used by sw.js to name its cache.
// Written by tools/release.js from CHANGELOG.md: never edit by hand.
globalThis.APP_VERSION = { version: '1.0.12', date: '2026-11-12' };
globalThis.APP_CHANGES = [
  {
    "version": "1.0.12",
    "date": "2026-11-12",
    "items": [
      "Nová hra Dáma: klasická česká dáma proti počítači. Soupeř je běžný hráč, nebo mistr, který propočítá mnoho tahů dopředu; tlačítka Poradit a Zpět."
    ]
  },
  {
    "version": "1.0.11",
    "date": "2026-11-11",
    "items": [
      "Sudoku: větší čísla poznámek psaných tužkou. Zvýraznění stejných čísel a počet zbývajících čísel na klávesách jsou teď zapnuté od začátku (jdou vypnout v nastavení)."
    ]
  },
  {
    "version": "1.0.10",
    "date": "2026-11-11",
    "items": [
      "Výběr her: po instalaci aplikace hláška poradí, co dělat, když se ikona na ploše neobjeví (telefony Xiaomi, Redmi a POCO)."
    ]
  },
  {
    "version": "1.0.9",
    "date": "2026-11-10",
    "items": [
      "Padající tvary: když otočíš telefon na šířku, hra se zastaví a počká. Druhé ťuknutí na šipku dolů tvar položí, i když chvilku počkáš.",
      "Logik: s barvami ve sloupci vpravo se hrací deska po každém tahu už nemění. Na tabletu a počítači se 7 a 8 barvami je hraný řádek vždy celý vidět.",
      "Solitér: Poradit už neposílá jednu kartu pořád tam a zpět.",
      "Pavouk: hra už neříká „Dál to nejde“, když ještě pomůže přesunout kartu na jinou stejně vysokou kartu. Poradit takový tah ukáže.",
      "Pyramida: hra pozná, že už nejde nic odebrat, i když v balíčku ještě zbývá král.",
      "Skládání kostek: druhé ťuknutí na stejné místo položí i kostky ve tvaru L.",
      "Zavři čísla: ťuknutí kamkoli na zavřenou destičku řekne, že už je zavřená.",
      "Kostky: kostky a stůl nemění velikost, když soupeř mluví. Nová hra, ve které ještě nikdo nehodil, nechá začínat stejného hráče.",
      "Patnáctka: Zpět při ukázaném cíli jen zavře cíl, tah už nevrací.",
      "Spojování čísel: na mřížce 3 × 3 jsou cíle 128, 256 a 512, protože 2048 se na ni nevejde. Okno „Výborně!“ se ukáže, i když hned táhneš dál.",
      "Prší: po novém otevření hry přijdou noví soupeři. Sedmy a osmy jdou v ruce dobře rozeznat, i když se karty překrývají.",
      "Oko bere a Oko bere plus mínus: když hra řekne „Stačí“ sama, chvilku nebere ťuknutí, aby se omylem nespustilo další kolo.",
      "Oko bere plus mínus: dvojité ťuknutí už nezahraje dvě karty plus a mínus najednou.",
      "Oko bere, Oko bere plus mínus a Kostky: okno s výsledkem se ukáže, i když hned po konci ťukneš na „Nová hra“ nahoře.",
      "Zavři čísla, Spoj tři, Pavouk, Solitér a Pyramida: pravidlo změněné v Nastavení platí, i když hru zavřeš dřív, než se z Nastavení vrátíš.",
      "Solitér a Pyramida: když změníš pravidla u hry, ve které ještě nebyl žádný tah, rozdá se rovnou nová hra.",
      "Sudoku, Mahjong a Logik: po dohrané nebo vzdané hře a změně nastavení hra řekne, že začala nová.",
      "Sudoku, Skládání kostek a Padající tvary: to, co zrovna nejde použít, je lépe čitelné (čárkovaný obrys místo vybledlé barvy).",
      "Mahjong: obrázek v nápovědě se vejde i na menší telefon.",
      "Opravené texty v Přelévání, Prší, FreeCellu, Padajících tvarech, Logiku, Pexesu, Mahjongu a Oko bere plus mínus."
    ]
  },
  {
    "version": "1.0.8",
    "date": "2026-11-10",
    "items": [
      "Logik: řádek s nápovědou nad barvami („Přetáhni barvy do jamek“) je teď schovaný, takže hrací deska je o kousek větší. Kdo ho chce, zapne ho v Nastavení („Řádek s nápovědou“)."
    ]
  },
  {
    "version": "1.0.7",
    "date": "2026-11-10",
    "items": [
      "Logik: nové rozložení jako ve staré počítačové hře. Hrací deska je větší, čísla řádků zmizela, černé a bílé kolíčky jsou vlevo od řádku a prázdné místo je jen malá šedá tečka, takže bílý kolíček nejde splést.",
      "Logik: tlačítka Vzdát se (vlajka), Zpět (šipka) a Zkontrolovat (fajfka) jsou vpravo jen jako obrázky. Tajný kód schovávají tmavá víčka s otazníkem a ťuknutí na ně je totéž jako vlajka.",
      "Logik: barvy jsou v pořadí červená, bílá, zelená, černá, modrá, žlutá a dole leží přesně pod jamkami. V Nastavení je jde přesunout do sloupce vpravo („Barvy ve sloupci vpravo“).",
      "Logik: nový výchozí vzhled „Klasika“ – jemně šedá deska s plochými jamkami. Kdo měl dosavadní výchozí vzhled, dostane ho jednou sám."
    ]
  },
  {
    "version": "1.0.6",
    "date": "2026-11-09",
    "items": [
      "Nastavení → O aplikaci: adresa her na internetu s tlačítkem „Kopírovat adresu“, aby šla snadno poslat dalším lidem."
    ]
  },
  {
    "version": "1.0.5",
    "date": "2026-11-09",
    "items": [
      "Oko bere, Oko bere plus mínus a Kostky: na konci zápasu se vždy ukáže okno s výsledkem, i když hned ťukneš na „Hrát znovu“ nebo „Nová hra“. Nová hra začne až z tohoto okna."
    ]
  },
  {
    "version": "1.0.4",
    "date": "2026-11-08",
    "items": [
      "Všechny hry: výška se řídí tím, co je na obrazovce opravdu vidět, takže spodní tlačítka nezajedou pod okraj ani v aplikaci nainstalované přes prohlížeč Brave."
    ]
  },
  {
    "version": "1.0.3",
    "date": "2026-11-08",
    "items": [
      "Nastavení: dočasně ukazuje údaje o obrazovce, aby šlo opravit zobrazení v aplikaci nainstalované přes prohlížeč Brave."
    ]
  },
  {
    "version": "1.0.2",
    "date": "2026-11-08",
    "items": [
      "Nainstalovaná aplikace: spodní tlačítka her už nezajedou pod lištu telefonu."
    ]
  },
  {
    "version": "1.0.1",
    "date": "2026-11-08",
    "items": [
      "Výběr her: nové tlačítko „Nainstalovat do zařízení“ dole pod hrami přidá hry na plochu telefonu jedním ťuknutím. Ukáže se jen v prohlížeči, který to umí, a po instalaci zmizí."
    ]
  },
  {
    "version": "1.0.0",
    "date": "2026-11-08",
    "items": [
      "Počáteční vydání: 22 her."
    ]
  }
];
