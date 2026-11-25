// Interface texts in Polish and English. t('key', { n: 3 }) fills in {n}.
// Every key must exist in both languages (test/i18n.test.js checks it).

export const MESSAGES = {
  pl: {
    // library
    lead: 'Czyta na głos artykuły, prace dyplomowe i inne PDF-y: całe albo wybrany rozdział.',
    open: 'Otwórz PDF',
    urlPlaceholder: 'albo link lub numer arXiv',
    urlLabel: 'Adres PDF-u lub numer arXiv',
    fetch: 'Pobierz',
    noSynthesis: 'Ta przeglądarka nie ma syntezy mowy, więc Lektor nie przeczyta tekstu na głos.',
    recent: 'Ostatnio czytane',
    emptyLibrary: 'PDF-y, które otworzysz, zostają na tym urządzeniu.',
    pages: '{n} str.',
    readPercent: 'przeczytane {n}%',
    delete: 'Usuń',
    cancel: 'Anuluj',
    deleteTitle: 'Usuń „{title}”',
    settings: 'Ustawienia',
    library: 'Biblioteka',
    contents: 'Spis treści',
    close: 'Zamknij',
    // opening files
    opening: 'Otwieram plik…',
    downloading: 'Pobieram PDF…',
    readingPage: 'Czytam PDF: strona {n} z {total}…',
    findingSections: 'Szukam rozdziałów…',
    noStorage: 'Ta przeglądarka nie pozwala zapisywać plików (tryb prywatny?). PDF da się otworzyć, ale nie zostanie zapamiętany.',
    saveFailed: 'Nie udało się zapisać PDF-u w pamięci przeglądarki; zniknie po zamknięciu strony.',
    noText: 'Ten PDF nie ma warstwy tekstowej (to skan). Lektor nie rozpoznaje tekstu na obrazach.',
    password: 'Ten PDF jest chroniony hasłem.',
    notPdf: 'To nie jest plik PDF albo jest uszkodzony.',
    readFailed: 'Nie udało się odczytać PDF-u ({error}).',
    badUrl: 'Wklej adres PDF-u (https://…) albo numer arXiv, np. 1706.03762.',
    cors: 'Ten serwer nie pozwala pobierać plików z innych stron. Pobierz PDF i otwórz go przyciskiem „Otwórz PDF”.',
    fetchFailed: 'Nie udało się pobrać PDF-u ({error}).',
    // reader
    docMeta: '{pages} str. · {lang} · {sections} rozdz.',
    unknownLang: 'język nieznany',
    askVoice: 'Powiedz albo wpisz: „rozdział 2”, „metody”, „3.1”',
    askTyped: 'Np. „rozdział 2”, „metody”, „3.1”',
    askLabel: 'Czego posłuchać? Np. rozdział 2, metody, 3.1, strona 10',
    listening: 'Słucham… (zatrzymaj)',
    speak: 'Powiedz, czego posłuchać',
    read: 'Czytaj',
    fromStart: 'Od początku',
    noContents: 'Ten PDF nie ma rozpoznanych rozdziałów.',
    fromOutline: 'Rozdziały z zakładek PDF-u.',
    fromLook: 'Rozdziały rozpoznane po wyglądzie nagłówków.',
    tap: 'Dotknij, żeby posłuchać.',
    tapToEnd: 'Dotknij, żeby posłuchać (do końca rozdziału).',
    // answers
    reading: 'Czytam: {title}',
    readingOn: 'Czytam: {title} i dalej',
    fromPage: 'Czytam od strony {page}.',
    nothingFromPage: 'Na stronie {page} i dalej nie ma tekstu do czytania.',
    emptySection: '„{title}” nie ma tekstu do czytania (same tabele, wzory albo przypisy).',
    notFoundSuggest: 'Nie znalazłem „{q}”. Może chodzi o:',
    notFound: 'Nie znalazłem „{q}”. Wybierz rozdział ze spisu.',
    noSections: 'Nie znalazłem rozdziałów w tym PDF-ie; da się czytać od początku albo od wybranego zdania.',
    notAllowed: 'Przeglądarka zatrzymała czytanie. Naciśnij ▶, żeby czytać dalej.',
    voiceUnavailable: 'Głos jest niedostępny. Wybierz inny w ustawieniach.',
    micDenied: 'Brak dostępu do mikrofonu.',
    heardNothing: 'Nic nie usłyszałem.',
    // player
    page: 'str. {page}',
    untilEnd: 'do końca rozdziału',
    prevSection: 'Poprzedni rozdział',
    nextSection: 'Następny rozdział',
    prevSentence: 'Poprzednie zdanie',
    nextSentence: 'Następne zdanie',
    pause: 'Pauza',
    play: 'Czytaj',
    speed: 'Tempo',
    // kinds of skipped text
    'kind.caption': 'podpis',
    'kind.note': 'przypis',
    'kind.table': 'tabela',
    'kind.math': 'wzór',
    'kind.toc': 'spis',
    'kind.front': 'strona tytułowa',
    // settings
    voice: 'Głos',
    voiceFor: 'Głos (język dokumentu: {lang})',
    noVoices: 'Brak głosów w systemie',
    otherLangs: 'Inne języki',
    whatToRead: 'Co czytać',
    readCaptions: 'Podpisy rysunków i tabel',
    readNotes: 'Przypisy',
    readCitations: 'Odwołania do literatury',
    readCitationsHint: '„(Smith i in., 2020)”, „[12]” — domyślnie pomijane',
    readReferences: 'Bibliografię przy czytaniu po kolei',
    readReferencesHint: 'wybrana wprost jest czytana zawsze',
    readingGroup: 'Czytanie',
    stopAtEnd: 'Wybrany rozdział czytaj do końca i zatrzymaj się',
    keepAwake: 'Nie wygaszaj ekranu podczas czytania',
    keepAwakeHint: 'na telefonach czytanie często staje po wygaszeniu ekranu',
    askLang: 'Język poleceń głosowych',
    asBrowser: 'jak w przeglądarce ({lang})',
    voicesHint:
      'Głosy pochodzą z systemu. Lepsze brzmią naturalniej: na iPhonie Ustawienia → Dostępność → Treść mówiona → Głosy (pobierz wersję „Ulepszony” lub „Premium”); na Androidzie Ustawienia → Zamiana tekstu na mowę; w Chrome na komputerze są głosy „Google”, w Edge „Natural”.',
  },
  en: {
    lead: 'Reads papers, theses and other PDFs aloud: the whole text or the chapter you ask for.',
    open: 'Open PDF',
    urlPlaceholder: 'or a link or arXiv number',
    urlLabel: 'PDF address or arXiv number',
    fetch: 'Fetch',
    noSynthesis: 'This browser has no speech synthesis, so Lektor cannot read aloud.',
    recent: 'Recently read',
    emptyLibrary: 'PDFs you open stay on this device.',
    pages: '{n} pages',
    readPercent: '{n}% read',
    delete: 'Delete',
    cancel: 'Cancel',
    deleteTitle: 'Delete “{title}”',
    settings: 'Settings',
    library: 'Library',
    contents: 'Contents',
    close: 'Close',
    opening: 'Opening the file…',
    downloading: 'Downloading the PDF…',
    readingPage: 'Reading the PDF: page {n} of {total}…',
    findingSections: 'Looking for chapters…',
    noStorage: 'This browser does not let pages store files (private mode?). The PDF opens, but will not be kept.',
    saveFailed: 'The PDF could not be stored in the browser; it will be gone when the page closes.',
    noText: 'This PDF has no text layer (it is a scan). Lektor does not recognise text in images.',
    password: 'This PDF is protected by a password.',
    notPdf: 'This is not a PDF file, or it is damaged.',
    readFailed: 'The PDF could not be read ({error}).',
    badUrl: 'Paste a PDF address (https://…) or an arXiv number, such as 1706.03762.',
    cors: 'This server does not let other sites download its files. Download the PDF and open it with “Open PDF”.',
    fetchFailed: 'The PDF could not be downloaded ({error}).',
    docMeta: '{pages} pages · {lang} · {sections} sections',
    unknownLang: 'unknown language',
    askVoice: 'Say or type: “chapter 2”, “methods”, “3.1”',
    askTyped: 'E.g. “chapter 2”, “methods”, “3.1”',
    askLabel: 'What to listen to? E.g. chapter 2, methods, 3.1, page 10',
    listening: 'Listening… (stop)',
    speak: 'Say what to listen to',
    read: 'Read',
    fromStart: 'From the start',
    noContents: 'No chapters were recognised in this PDF.',
    fromOutline: 'Chapters from the PDF’s bookmarks.',
    fromLook: 'Chapters recognised from the look of the headings.',
    tap: 'Tap one to listen.',
    tapToEnd: 'Tap one to listen to it, to its end.',
    reading: 'Reading: {title}',
    readingOn: 'Reading: {title} and on',
    fromPage: 'Reading from page {page}.',
    nothingFromPage: 'There is no text to read from page {page} on.',
    emptySection: '“{title}” has no text to read (only tables, equations or notes).',
    notFoundSuggest: 'Nothing called “{q}”. Did you mean:',
    notFound: 'Nothing called “{q}”. Pick a chapter from the contents.',
    noSections: 'No chapters found in this PDF; you can read from the start or from any sentence.',
    notAllowed: 'The browser stopped the reading. Press ▶ to go on.',
    voiceUnavailable: 'This voice is unavailable. Choose another in Settings.',
    micDenied: 'No access to the microphone.',
    heardNothing: 'I heard nothing.',
    page: 'p. {page}',
    untilEnd: 'to the end of the section',
    prevSection: 'Previous section',
    nextSection: 'Next section',
    prevSentence: 'Previous sentence',
    nextSentence: 'Next sentence',
    pause: 'Pause',
    play: 'Read',
    speed: 'Speed',
    'kind.caption': 'caption',
    'kind.note': 'note',
    'kind.table': 'table',
    'kind.math': 'equation',
    'kind.toc': 'contents',
    'kind.front': 'title page',
    voice: 'Voice',
    voiceFor: 'Voice (document language: {lang})',
    noVoices: 'No voices on this system',
    otherLangs: 'Other languages',
    whatToRead: 'What to read',
    readCaptions: 'Figure and table captions',
    readNotes: 'Footnotes',
    readCitations: 'Citations',
    readCitationsHint: '“(Smith et al., 2020)”, “[12]”: skipped by default',
    readReferences: 'The reference list when reading on',
    readReferencesHint: 'when you ask for it, it is always read',
    readingGroup: 'Reading',
    stopAtEnd: 'Stop at the end of a chosen section',
    keepAwake: 'Keep the screen on while reading',
    keepAwakeHint: 'on phones, reading often stops when the screen turns off',
    askLang: 'Language of spoken requests',
    asBrowser: 'as in the browser ({lang})',
    voicesHint:
      'Voices come from your system, and better ones sound more natural: on an iPhone, Settings → Accessibility → Spoken Content → Voices (download an “Enhanced” or “Premium” voice); on Android, Settings → Text-to-speech output; Chrome on a computer has “Google” voices, Edge has “Natural” ones.',
  },
};

export const LANGUAGES = Object.keys(MESSAGES);

let lang = 'en';

/** The interface language: the one chosen, else Polish for a Polish browser, else English. */
export function chooseLanguage(chosen, browser = '') {
  if (MESSAGES[chosen]) return chosen;
  return /^pl\b/i.test(browser) ? 'pl' : 'en';
}

export function setLanguage(l) {
  lang = MESSAGES[l] ? l : 'en';
}

export function language() {
  return lang;
}

export function t(key, params = {}) {
  const text = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));
}

/** A decimal number as written in the interface language: "1,25" or "1.25". */
export function decimal(n) {
  return lang === 'pl' ? String(n).replace('.', ',') : String(n);
}

/** A language's name in the interface language: "angielski", "English". */
export function languageName(code, inLanguage = lang) {
  if (!code) return '';
  try {
    return new Intl.DisplayNames([inLanguage], { type: 'language' }).of(code) || code;
  } catch {
    return code;
  }
}
