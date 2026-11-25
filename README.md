# Lektor

*Reads PDFs aloud — papers, theses, reports — whole or the chapter you ask for (“chapter 3”, “methods”, “3.2”, “page 40”). The interface is in English and Polish.*

Czyta na głos PDF-y: artykuły, prace dyplomowe, raporty. Cały tekst albo wybrany rozdział: wystarczy wpisać lub powiedzieć „rozdział 3”, „metody”, „3.2” albo „strona 40”. Działa w przeglądarce telefonu i komputera, da się go zainstalować (PWA) i po pierwszym otwarciu działa bez internetu. PDF-y zostają na urządzeniu.

Szkic. Struktura jest sprawdzona na pięciu prawdziwych PDF-ach (niżej), czytanie w przeglądarce na zastępczym syntezatorze; na telefonie z prawdziwymi głosami jeszcze nie.

## Co robi

- **Otwieranie.** Przycisk „Otwórz PDF”, przeciągnięcie pliku, adres PDF-u albo numer arXiv (`1706.03762`). Android: po instalacji Lektor jest na liście „Udostępnij” (plik PDF albo link). Komputer: „Otwórz za pomocą → Lektor” po instalacji w Chrome lub Edge. Link `…/lektor/?url=<adres PDF-u>` otwiera PDF od razu (np. z Doczytań).
- **Wybór fragmentu.** Pole na dole ekranu rozumie po polsku i po angielsku:
  - rozdziały: „rozdział 3”, „trzeci rozdział”, „chapter three”, „ostatni rozdział”, „część druga”, „dodatek B”;
  - sekcje: „3.2”, „sekcja trzy kropka dwa”, „section 4.1.2”;
  - nazwy: „metody”, „wnioski”, „wstęp”, „bibliografia”, „attention” (także z literówkami i między językami: „wyniki” znajdzie „Results”);
  - strony: „strona 40” (numer drukowany, jeśli PDF ma etykiety stron);
  - polecenia: „dalej”, „wstecz”, „pauza”, „czytaj dalej”, „od początku”, „powtórz”.
  Mikrofon obok pola (Chrome, Edge, Safari) przyjmuje to samo głosem. Spis treści pod ikoną listy; dotknięcie zdania w tekście czyta od niego.
- **Czytanie.** Wybrany rozdział jest czytany do końca i czytanie staje (da się wyłączyć). Odtwarzacz: poprzedni/następny rozdział, poprzednie/następne zdanie, tempo. Czytane zdanie jest podświetlone, tekst przewija się sam. Słuchawki i ekran blokady sterują przez Media Session tam, gdzie przeglądarka to pozwala. Miejsce, w którym czytanie stanęło, jest zapamiętane.
- **Co jest pomijane.** Nagłówki i numery stron, znaki wodne, przypisy, podpisy rysunków, tabele, wzory, spisy treści, odwołania do literatury („(Smith i in., 2020)”, „[12]”), a przy czytaniu po kolei także bibliografia. Przypisy, podpisy, odwołania i bibliografię można włączyć w ustawieniach. Pominięte fragmenty są widoczne w tekście, przygaszone.
- **Język interfejsu:** polski albo angielski, przełącznik PL | EN w nagłówku każdego ekranu; domyślnie polski w przeglądarce ustawionej na polski, angielski w pozostałych. Prośby są rozumiane w obu językach niezależnie od tego ustawienia.
- **Głosy** pochodzą z systemu (Web Speech API); aplikacja wybiera najlepszy dla języka dokumentu („Natural”, „Premium”, „Enhanced”), w ustawieniach można wybrać inny.

## Skąd się biorą rozdziały

1. **Zakładki PDF-u** (outline), jeśli są: tak jest w prawie każdej pracy z LaTeX-a i w wielu artykułach. Każda zakładka jest dopasowana do nagłówka w tekście (także kilka stron dalej, gdy zakładki są niedokładne). Numerowane nagłówki głębsze niż zakładki, a także „Abstract” i „References”, których w zakładkach często brak, są dodawane.
2. **Wygląd nagłówków**, gdy zakładek nie ma (pomysł z `gchrupala/ibuki`, `book2epub.py`): krój i stopień tekstu głównego to najczęstszy styl; nagłówek to krótka linia większa lub pogrubiona, osobno, z tekstem pod spodem. Poziomy dają numery („3.2.1”), styl (najczęstszy poziom numerowanych nagłówków tego stylu) i zagnieżdżenie; zwykłe nazwy sekcji („Introduction”, „Wnioski”) są najwyższym poziomem, poza częściami ustrukturyzowanego streszczenia. Do tego numerowane linie i znane nazwy w stylu tekstu (jak w `gchrupala/reader`, `sections.py`).
3. Rozdział bez numeru („Introduction” nad „1.1 …”) dostaje numer od pierwszej podsekcji, więc „rozdział 1” działa.

Poza tym: nagłówki stron i numery stron (linie na marginesach powtarzające się z innymi liczbami), znaki wodne (ta sama linia na połowie stron), przypisy (drobny druk na dole strony lub kolumny), boczne kolumny (PLOS), podpisy, tabele (linie z szerokimi odstępami), wzory (fonty matematyczne, mało liter), strony spisów treści (kropki prowadzące, numery stron na końcu), inicjały (duża pierwsza litera rozdziału), kapitaliki z rozstrzelonymi literami (`C O M P U TAT I O N A L` → „Computational”, podział na słowa ze słownika samego dokumentu), przeniesienia wyrazów (łączone, chyba że dokument pisze słowo z łącznikiem), akapity przerwane kolumną, stroną, rysunkiem lub wzorem.

### Sprawdzone na

| PDF | Strony | Skąd rozdziały | Wynik |
|---|---|---|---|
| Vaswani i in., *Attention Is All You Need* (arXiv, LaTeX) | 15 | zakładki | 24 sekcje, poprawne poziomy |
| Chrupała i in., ACL 2017 (dwie kolumny) | 10 | wygląd (zakładka jest jedna, z tytułem tomu) | 18 sekcji z podsekcjami |
| PLOS ONE 2023 (boczna kolumna, nagłówki w dwóch krojach) | 21 | wygląd | 27 sekcji, ustrukturyzowane streszczenie |
| Praca doktorska, arXiv 2203.03469 (classicthesis, części) | 219 | zakładki | 145 sekcji, rozdziały 1–10 rozpoznawane po numerze |
| Praca doktorska, arXiv 1911.03731 (LaTeX report, zakładki częściowo błędne) | 119 | zakładki | 61 sekcji: rozdziały, dodatki A–D, bibliografia |

`node tools/inspect.mjs plik.pdf` pokazuje, co Lektor robi z PDF-em (sekcje, bloki, `--speech` zdania do przeczytania, `--lines 3` linie strony 3 z ich stylem).

## Praca nad kodem

Statyczne pliki, bez budowania. pdf.js jest w `vendor/pdfjs/` (wersja w `VERSION`, build „legacy” dla starszych telefonów).

```sh
npm start   # serwer lokalny na http://localhost:8080
npm test    # testy (Node 20+); PDF-y do testów są generowane w test/makepdf.js
node tools/inspect.mjs paper.pdf
```

| Plik | Co zawiera |
| --- | --- |
| `index.html`, `styles.css` | strona i wygląd (jasny i ciemny motyw) |
| `manifest.webmanifest` | instalacja, `share_target` (PDF-y z innych aplikacji), `file_handlers` |
| `js/pdfread.js` | pdf.js → fragmenty tekstu z pozycją, stopniem i nazwą fontu, zakładki, etykiety stron |
| `js/layout.js` | linie → bloki (tytuł, nagłówki, akapity, przypisy, podpisy, tabele…) → sekcje |
| `js/speech.js` | zdania, tekst do mówienia (odwołania, adresy, skróty), plan czytania |
| `js/navigate.js` | rozumienie próśb („rozdział trzeci”, „3.2”, „metody”, „strona 40”) |
| `js/player.js` | czytanie zdanie po zdaniu przez Web Speech API, wybór głosu |
| `js/library.js` | IndexedDB: PDF-y, ich struktura, miejsce czytania |
| `js/app.js` | widoki i zdarzenia |
| `js/i18n.js` | teksty interfejsu po polsku i po angielsku |
| `sw.js` | praca bez internetu, odbieranie udostępnionych PDF-ów |
| `tools/inspect.mjs` | podgląd struktury PDF-u w terminalu |

## Ograniczenia

- Skany bez warstwy tekstowej nie są czytane (brak OCR).
- Wzory i tabele są pomijane, nie odczytywane.
- Układy nietypowe (plakaty, gazety, wiele kolumn z ramkami) mogą mieć złą kolejność tekstu.
- Na telefonach synteza mowy w przeglądarce często staje po wygaszeniu ekranu, dlatego ekran domyślnie się nie wygasza (Wake Lock). Czytanie w tle wymagałoby nagranego dźwięku (np. głosu z usługi w chmurze).
- Firefox nie ma rozpoznawania mowy: prośby trzeba wpisać.
- PDF-y z adresu: tylko z serwerów, które pozwalają na pobieranie z innych stron (arXiv tak, większość wydawców nie). Wtedy trzeba pobrać plik i go otworzyć.
- Nie sprawdzone: prawdziwy polski PDF (logika polska jest w testach), iPhone, Android z prawdziwymi głosami, udostępnianie plików z Androida.

## Dalej

- Głosy z usługi w chmurze (naturalniejsze, czytanie przy zgaszonym ekranie przez `<audio>`).
- Przycisk „Posłuchaj” w Doczytaniach dla linków do PDF-ów (`?url=`).
- Nagłówki w tekście akapitu („**Participants.** We recruited…”).
- Zakładki płytsze niż nagłówki w tekście: podsekcje bez numerów.
