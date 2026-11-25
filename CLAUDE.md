# Lektor

Aplikacja webowa (PWA), która czyta na głos PDF-y (artykuły, prace dyplomowe), całe albo wybrany rozdział. Statyczne pliki w katalogu głównym, bez budowania; jedyna zależność to pdf.js w `vendor/pdfjs/`. Układ plików jak w Doczytaniach (gchrupala/doczytania).

- `js/pdfread.js`: pdf.js → surowe dane (fragmenty tekstu z pozycją, stopniem, nazwą fontu; zakładki; etykiety stron). Nazwy fontów są znane dopiero po `getOperatorList()`.
- `js/layout.js`: surowe dane → `{ blocks, sections }`. Czysta logika, bez DOM.
- `js/speech.js`, `js/navigate.js`, `js/player.js`: plan czytania, rozumienie próśb, czytanie przez Web Speech API (syntezator przekazywany z zewnątrz). Czysta logika, z testami.
- `js/app.js`: widoki i zdarzenia. `js/library.js`: IndexedDB. `js/i18n.js`: teksty interfejsu.
- `sw.js`: nowe pliki dopisz do `APP_FILES`; przy każdej zmianie plików aplikacji podbij `VERSION`.

## Zasady

- Interfejs po polsku i po angielsku: każdy tekst w `js/i18n.js`, w obu językach (sprawdza to `test/i18n.test.js`); w `app.js` tylko `t('klucz')`. Język: wybrany przełącznikiem PL | EN w nagłówku, inaczej polski dla przeglądarki po polsku, angielski dla innych. Komentarze w kodzie po angielsku. Prośby („rozdział 3”, „chapter 3”) rozumiane w obu językach niezależnie od języka interfejsu.
- Gdy zmienia się wynik `buildDocument` dla tego samego PDF-u, podbij `PARSER_VERSION`: zapisane dokumenty zostaną przetworzone ponownie z zapisanego pliku.
- Zmiany w `layout.js` sprawdzaj na prawdziwych PDF-ach: `node tools/inspect.mjs plik.pdf` (`--sections`, `--lines N`, `--speech`), przed i po zmianie. Tabela sprawdzonych PDF-ów jest w README; PDF-ów nie dodawaj do repozytorium (prawa autorskie), testy generują własne w `test/makepdf.js`.
- pdf.js: build „legacy” (zwykły wymaga `Promise.try`, którego nie ma w starszych Safari). Przy aktualizacji zmień `vendor/pdfjs/VERSION` i podbij `VERSION` w `sw.js`.
- Timery w przeglądarce owijaj w funkcje strzałkowe: `setTimeout` wywołany jako metoda innego obiektu rzuca „Illegal invocation” (w Node nie).
- PDF-y i ustawienia zostają na urządzeniu; nic nie jest wysyłane.
- Przed wypchnięciem: `npm test`.
- Strona działa pod https://grzegorz.chrupala.me/lektor/ (GitHub Pages z gałęzi `main`). Po każdej poprawce: `npm test`, wypchnij gałąź roboczą i od razu zaktualizuj `main` (fast-forward, bez pytania), potem sprawdź, że strona ma nową wersję (`VERSION` w `sw.js`).
