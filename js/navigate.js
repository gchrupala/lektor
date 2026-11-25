// Understands what the listener asks for, typed or spoken, in Polish or
// English: "rozdział 3", "chapter three", "trzeci rozdział", "metody",
// "3.2", "dodatek B", "strona 12", "dalej", "pauza". Pure logic.

import { headingName, normalize } from './layout.js';

const COMMANDS = [
  ['next', ['dalej', 'nastepny', 'nastepna', 'nastepne', 'nastepna sekcja', 'nastepny rozdzial', 'nastepny punkt', 'pomin', 'next', 'next section', 'next chapter', 'skip']],
  ['prev', ['wstecz', 'poprzedni', 'poprzednia', 'poprzednie', 'poprzednia sekcja', 'poprzedni rozdzial', 'cofnij', 'previous', 'previous section', 'previous chapter', 'back', 'go back']],
  ['pause', ['pauza', 'stop', 'zatrzymaj', 'przerwij', 'cisza', 'wstrzymaj', 'pause', 'stop reading', 'be quiet']],
  ['resume', ['wznow', 'graj', 'czytaj', 'czytaj dalej', 'kontynuuj', 'resume', 'continue', 'play', 'go on', 'read']],
  ['start', ['od poczatku', 'poczatek', 'od samego poczatku', 'start', 'from the beginning', 'from the start', 'beginning', 'start over']],
  ['repeat', ['powtorz', 'jeszcze raz', 'repeat', 'again', 'say again']],
];

// Words that only wrap the request: "przeczytaj mi", "go to the".
const FILLER = new Set(
  (
    'przeczytaj przeczytac czytaj poczytaj mi prosze prosilbym prosilabym chce chcialbym chcialabym posluchac sluchac ' +
    'przejdz idz skocz wroc otworz pokaz zacznij zaczynij od do z ze na ' +
    'read me the a an go to jump skip open play start from at please could you can i want would like listen'
  ).split(' '),
);

const KIND_WORDS = [
  ['chapter', /^(?:rozdzial\w*|chapter|chap|ch|hoofdstuk|kapitel)$/],
  ['section', /^(?:sekcj\w*|podrozdzial\w*|punkt\w*|paragraf\w*|section|sec|subsection|paragraph|par|sectie)$/],
  ['part', /^(?:czesc|czesci|czescia|part|deel|teil)$/],
  ['appendix', /^(?:dodat\w*|aneks\w*|zalacznik\w*|appendix|appendices|bijlage|anhang)$/],
  ['page', /^(?:stron\w*|str|page|p|pagina|blz|seite)$/],
];

const CARDINALS = {
  jeden: 1, jedna: 1, jedno: 1, jedynka: 1, one: 1,
  dwa: 2, dwie: 2, dwojka: 2, two: 2,
  trzy: 3, trojka: 3, three: 3,
  cztery: 4, czworka: 4, four: 4,
  piec: 5, piatka: 5, five: 5,
  szesc: 6, szostka: 6, six: 6,
  siedem: 7, siodemka: 7, seven: 7,
  osiem: 8, osemka: 8, eight: 8,
  dziewiec: 9, dziewiatka: 9, nine: 9,
  dziesiec: 10, dziesiatka: 10, ten: 10,
  jedenascie: 11, eleven: 11,
  dwanascie: 12, twelve: 12,
  trzynascie: 13, thirteen: 13,
  czternascie: 14, fourteen: 14,
  pietnascie: 15, fifteen: 15,
  szesnascie: 16, sixteen: 16,
  siedemnascie: 17, seventeen: 17,
  osiemnascie: 18, eighteen: 18,
  dziewietnascie: 19, nineteen: 19,
  dwadziescia: 20, twenty: 20,
};
const ORDINALS = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, last: -1, ostatni: -1, ostatnia: -1,
};
// Polish ordinals by stem, in any case: "trzeci", "trzeciego", "trzeciej".
const PL_ORDINAL_STEMS = [
  ['pierwsz', 1], ['drug', 2], ['trzec', 3], ['czwart', 4], ['piat', 5], ['szost', 6], ['siodm', 7], ['osm', 8],
  ['dziewiat', 9], ['dziesiat', 10], ['jedenast', 11], ['dwunast', 12], ['trzynast', 13], ['czternast', 14], ['pietnast', 15],
];
const POINT_WORDS = new Set(['kropka', 'przecinek', 'point', 'dot', 'punkt']);

// Section names in several languages that mean the same thing.
const SYNONYMS = [
  ['abstract', 'summary', 'streszczenie', 'abstrakt', 'samenvatting', 'zusammenfassung', 'resume'],
  ['introduction', 'wstep', 'wprowadzenie', 'intro', 'inleiding', 'einleitung', 'einfuhrung'],
  ['background', 'tlo', 'kontekst'],
  ['related work', 'previous work', 'literature review', 'przeglad literatury', 'powiazane prace', 'stan badan', 'stan wiedzy'],
  ['method', 'methods', 'methodology', 'materials and methods', 'metody', 'metoda', 'metodologia', 'metodyka', 'methode', 'methoden'],
  ['experiments', 'experiment', 'experimental setup', 'eksperymenty', 'eksperyment', 'badania', 'badanie'],
  ['results', 'result', 'findings', 'wyniki', 'rezultaty', 'resultaten', 'ergebnisse'],
  ['discussion', 'general discussion', 'dyskusja', 'omowienie', 'discussie', 'diskussion'],
  ['conclusion', 'conclusions', 'concluding remarks', 'wnioski', 'podsumowanie', 'zakonczenie', 'conclusie', 'fazit'],
  ['limitations', 'ograniczenia'],
  ['future work', 'dalsze prace', 'dalsze badania'],
  ['acknowledgments', 'acknowledgements', 'acknowledgment', 'podziekowania', 'dankwoord'],
  ['references', 'bibliography', 'bibliografia', 'literatura', 'piśmiennictwo', 'zrodla', 'literatuur', 'literatur'],
  ['appendix', 'appendices', 'dodatek', 'aneks', 'zalacznik', 'bijlage', 'anhang'],
  ['contents', 'table of contents', 'spis tresci', 'inhoud', 'inhoudsopgave'],
  ['preface', 'foreword', 'przedmowa', 'wstep od autora', 'voorwoord'],
].map((group) => group.map(normalize));

const STOP = new Set(['the', 'of', 'and', 'a', 'an', 'in', 'on', 'for', 'to', 'i', 'w', 'z', 'o', 'na', 'oraz', 'de', 'het', 'van', 'en']);

function roman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) [out, n] = [out + s, n - v];
  return out;
}

function fromRoman(s) {
  const v = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let n = 0;
  const t = s.toUpperCase();
  for (let i = 0; i < t.length; i++) n += v[t[i]] < (v[t[i + 1]] || 0) ? -v[t[i]] : v[t[i]];
  return n;
}

function numberWord(w) {
  if (w in CARDINALS) return CARDINALS[w];
  if (w in ORDINALS) return ORDINALS[w];
  const m = /^(\d+)(?:st|nd|rd|th|\.|-?(?:ty|go|ego|ej|im|ym|a|y|i))?$/.exec(w);
  if (m) return Number(m[1]);
  if (/^ostatni/.test(w)) return -1;
  for (const [stem, n] of PL_ORDINAL_STEMS) if (new RegExp(`^${stem}(?:i|y|a|e|ego|iego|ej|iej|emu|im|ym)$`).test(w)) return n;
  return null;
}

/** Parses a request into { command } or { kind, number, letter, name }. */
export function parseRequest(text) {
  // "3.2" and "3,2" survive normalize() as "3 2"; mark them first.
  const raw = String(text).trim().replace(/(\d)\s*[.,]\s*(?=\d)/g, '$1§');
  const norm = normalize(raw.replace(/§/g, 'DOT'))
    .replace(/(\d)dot(?=\d)/g, '$1.')
    .replace(/[?!]/g, '')
    .trim();
  for (const [command, phrases] of COMMANDS) {
    if (phrases.includes(norm) || phrases.includes(norm.replace(/^(?:prosze|please)\s+|\s+(?:prosze|please)$/g, ''))) return { command };
  }
  const tokens = norm.split(/\s+/).filter(Boolean);
  let kind = null;
  const numbers = [];
  let letter = null;
  const rest = [];
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    const k = KIND_WORDS.find(([, re]) => re.test(w));
    if (k && !kind) {
      kind = k[0];
      continue;
    }
    if (/^\d+(?:\.\d+)+$/.test(w)) {
      numbers.push(...w.split('.').map(Number));
      continue;
    }
    if (POINT_WORDS.has(w) && numbers.length && i + 1 < tokens.length && numberWord(tokens[i + 1]) != null) continue;
    const n = numberWord(w);
    if (n != null && !(w === 'i' && !kind)) {
      numbers.push(n);
      continue;
    }
    if (/^[ivx]{1,4}$/.test(w) && (kind === 'part' || kind === 'chapter') && w !== 'i') {
      numbers.push(fromRoman(w));
      continue;
    }
    if (w === 'i' && (kind === 'part' || kind === 'chapter')) {
      numbers.push(1);
      continue;
    }
    if (/^[a-h]$/.test(w) && kind === 'appendix') {
      letter = w.toUpperCase();
      continue;
    }
    if (FILLER.has(w) && !rest.length) continue;
    rest.push(w);
  }
  while (rest.length && FILLER.has(rest[rest.length - 1])) rest.pop();
  // Without "chapter" or "section", numbers may belong to the name: "experiment two".
  const words = tokens.filter((w) => !KIND_WORDS.some(([, re]) => re.test(w)));
  while (words.length && FILLER.has(words[0])) words.shift();
  while (words.length && FILLER.has(words[words.length - 1])) words.pop();
  return { kind, numbers, letter, name: rest.join(' '), full: words.join(' ') };
}

// ---------- matching ----------

function editRatio(a, b) {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

function wordScore(q, w) {
  if (q === w) return 1;
  let common = 0;
  while (common < Math.min(q.length, w.length) && q[common] === w[common]) common++;
  // Same stem: "metody" / "metodologia", "results" / "result".
  if (common >= Math.max(4, Math.min(q.length, w.length) * 0.7)) return 0.85;
  const r = editRatio(q, w);
  return r >= 0.75 ? 0.7 : 0;
}

/** How well a request names a heading (both normalized), 0 to 1. */
export function nameScore(query, name) {
  if (!query || !name) return 0;
  if (query === name) return 1;
  if (name.startsWith(`${query} `) || (query.length >= 4 && name.startsWith(query))) return 0.9;
  if (` ${name} `.includes(` ${query} `)) return 0.8;
  const qs = query.split(' ').filter((w) => !STOP.has(w));
  const ns = name.split(' ').filter((w) => !STOP.has(w));
  if (!qs.length || !ns.length) return 0;
  const scores = qs.map((q) => Math.max(...ns.map((n) => wordScore(q, n))));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const covered = ns.filter((n) => qs.some((q) => wordScore(q, n) > 0)).length / ns.length;
  return scores.every((s) => s > 0) ? avg * (0.75 + 0.2 * covered) : avg * 0.4;
}

function alternatives(name) {
  // 0.75 lets inflected forms in: "o wynikach" -> results, "metodach" -> methods.
  const group = SYNONYMS.find((g) => g.some((s) => nameScore(name, s) >= 0.75));
  return group ? [name, ...group.filter((s) => s !== name)] : [name];
}

const FRONT_BACK = new Set(
  [...SYNONYMS[0], ...SYNONYMS[11], ...SYNONYMS[12], ...SYNONYMS[13], ...SYNONYMS[14], ...SYNONYMS[15]].concat(
    ['declaration', 'dedication', 'publications', 'list of figures', 'list of tables', 'acronyms', 'abbreviations', 'index', 'curriculum vitae', 'about the author', 'listings', 'colophon', 'glossary', 'nomenclature', 'preamble', 'keywords', 'key words', 'propositions', 'stellingen', 'oswiadczenie', 'dedykacja', 'slowa kluczowe', 'indeks', 'skorowidz'].map(normalize),
  ),
);

const isPart = (s) => /^(?:part|część|czesc|deel|teil)\b/i.test(s.t);
const isAppendix = (s) => /^(?:appendix|appendices|dodatek|aneks|załącznik|bijlage|anhang)\b/i.test(s.t);
const isChapterLike = (s) => !isPart(s) && !isAppendix(s) && !FRONT_BACK.has(headingName(s.t));

/**
 * The level of chapters: the highest level with at least two of them. Not
 * always 1: parts sit above chapters, and many PDFs put the whole document
 * under one bookmark with its title.
 */
export function chapterLevel(doc) {
  const levels = [...new Set(doc.sections.map((s) => s.l))].sort((a, b) => a - b);
  return levels.find((l) => doc.sections.filter((s) => s.l === l && isChapterLike(s)).length >= 2) ?? levels[0] ?? 1;
}

function byNumber(doc, kind, numbers, letter) {
  const secs = doc.sections;
  const wanted = letter ? [letter, ...numbers].join('.') : numbers.join('.');
  if (!wanted) return null;
  const level = chapterLevel(doc);
  const candidates = secs
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => {
      if (!s.n) return false;
      const n = s.n.toUpperCase();
      if (kind === 'part') return isPart(s) && (n === wanted || n === roman(Number(wanted)));
      if (kind === 'appendix') return /^[A-Z]/.test(n) && n === wanted;
      // "Rozdział III" is chapter 3.
      const asRoman = numbers.length === 1 && /^[IVX]+$/.test(n) && n === roman(numbers[0]);
      if (kind === 'chapter' && /^[A-Z]$/.test(n) && !asRoman) return false; // appendix A
      if (kind === 'chapter') return !isPart(s) && (n === wanted || asRoman);
      return n === wanted || (asRoman && !isPart(s));
    })
    // Chapters first, then higher levels.
    .sort((a, b) => (a.s.l === level ? 0 : 1) - (b.s.l === level ? 0 : 1) || a.s.l - b.s.l);
  if (candidates.length) return candidates[0].i;
  // "A Questionnaires" under an appendix part.
  if (kind === 'appendix' && letter && !numbers.length) {
    const i = secs.findIndex((s) => new RegExp(`^${letter}\\s+\\p{Lu}`, 'u').test(s.t));
    if (i >= 0) return i;
  }
  // Unnumbered chapters and parts: counted in order, without front and back matter.
  if (numbers.length === 1 && (kind === 'chapter' || kind === 'part' || kind === 'appendix')) {
    const list = secs
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => (kind === 'part' ? isPart(s) : kind === 'appendix' ? isAppendix(s) : s.l === level && isChapterLike(s)));
    // Where chapters are numbered, only numbered ones count ("Colophon" is not the last chapter).
    const numbered = list.filter(({ s }) => /^(?:\d+|[IVXLC]+)$/.test(s.n || ''));
    const pick = numbered.length && kind === 'chapter' ? numbered : list.filter(({ s }) => !/^[A-Z]\s+\p{Lu}/u.test(s.t));
    const k = numbers[0] === -1 ? pick.length - 1 : numbers[0] - 1;
    if (pick[k]) return pick[k].i;
  }
  return null;
}

function byName(doc, name, kind) {
  const alts = alternatives(name);
  let best = null;
  doc.sections.forEach((s, i) => {
    const heading = headingName(s.t);
    let score = Math.max(...alts.map((a, k) => nameScore(a, heading) * (k === 0 ? 1 : 0.95)));
    if (kind === 'chapter' && s.l === chapterLevel(doc)) score += 0.02;
    // Earlier and higher sections win ties.
    score -= s.l * 0.001;
    if (!best || score > best.score) best = { i, score };
  });
  return best;
}

/** Physical page for a page number as printed (page labels) or counted. */
function pageFor(doc, n) {
  if (doc.labels) {
    const i = doc.labels.findIndex((l) => l === String(n));
    if (i >= 0) return i + 1;
  }
  return n >= 1 && n <= doc.pages ? n : null;
}

/**
 * What a request asks for:
 *   { type: 'command', command: 'next' | 'prev' | 'pause' | 'resume' | 'start' | 'repeat' }
 *   { type: 'section', index }       an index into doc.sections
 *   { type: 'page', page }           a physical page
 *   { type: 'none', suggestions }    section indices that came closest
 */
export function interpret(text, doc) {
  const req = parseRequest(text);
  if (req.command) return { type: 'command', command: req.command };
  const { kind, numbers, letter, name, full } = req;
  if (kind === 'page' && numbers.length) {
    const page = pageFor(doc, numbers[0]);
    return page ? { type: 'page', page } : { type: 'none', suggestions: [] };
  }
  if (!kind && name && numbers.length && full) {
    const best = byName(doc, normalize(full), kind);
    if (best && best.score >= 0.75) return { type: 'section', index: best.i };
  }
  if (numbers.length || letter) {
    const i = byNumber(doc, kind, numbers, letter);
    if (i != null) return { type: 'section', index: i };
  }
  const query = name || (kind && !numbers.length ? kind : '');
  if (query) {
    const best = byName(doc, normalize(query), kind);
    if (best && best.score >= 0.6) return { type: 'section', index: best.i };
  }
  // Nothing close enough: the nearest names as suggestions.
  const suggestions = query
    ? doc.sections
        .map((s, i) => ({ i, score: Math.max(...alternatives(normalize(query)).map((a) => nameScore(a, headingName(s.t)))) }))
        .filter((x) => x.score > 0.15)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((x) => x.i)
    : [];
  return { type: 'none', suggestions };
}

/** An address, an arXiv number or an arXiv link -> the PDF's address. */
export function pdfUrl(input) {
  const t = input.trim();
  const arxiv = /^(?:arxiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?)$/i.exec(t);
  if (arxiv) return `https://arxiv.org/pdf/${arxiv[1]}`;
  const abs = /^https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|html)\/([^?#]+?)\/?$/.exec(t);
  if (abs) return `https://arxiv.org/pdf/${abs[1]}`;
  try {
    const u = new URL(t);
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
