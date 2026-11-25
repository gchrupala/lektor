// Turns the raw text runs of pdfread.js into a document to read aloud:
// lines, then blocks (title, headings, paragraphs, captions, footnotes,
// tables, equations, contents pages), then sections, from the PDF's outline
// when it has a usable one and from the headings otherwise.
//
// Pure logic without DOM. The ideas come from gchrupala/ibuki (book2epub.py:
// the body style is the most common one, running heads repeat in the
// margins, headings are short lines in another style followed by text) and
// gchrupala/reader (sections.py: numbered headings, the usual section names).

// Bump when the result for the same PDF changes: stored documents are then
// parsed again from their file.
export const PARSER_VERSION = 1;

const BOLD_RE = /bold|black|heavy|semibold|demi|medi|cmbx|cmb\d|sfbx|sfb\d|\bbx|-bd\b|bd$|-sb$/i;
const ITALIC_RE = /italic|oblique|ital\b|cmti|cmsl|sfti|sfsl|-it$|it$|-bi$|-boldit/i;
const MATH_RE =
  /^(cmmi|cmsy|cmex|cmbsy|cmmib|msam|msbm|eufm|eusm|rsfs|stmary|wasy|lasy|txsy|txex|txmi|pxsy|pxex|pxmi|mtsy|mtex|mtmi|esint|lmmath|lmsy|lmmi|zapfdingbats)|math|symbol|^mt\s?extra|^euclid/i;

const PAGE_NUMBER_RE = /^(?:page|p\.|strona|str\.|pagina|seite|blz\.)?\s*[\divxlc]{1,5}(?:\s*(?:\/|of|z|van|von)\s*\d+)?$/i;
const CAPTION_RE =
  /^(?:S\d+\s+(?:file|table|fig|figure|text|appendix|data|dataset|video|movie)\b|fig(?:ure|\.)?|table|tab\.|rys(?:unek|\.)?|ryc(?:ina|\.)?|tabela|wykres|schemat|algorithm|listing|figuur|tabel|abbildung|abb\.|tabelle|tableau|graph|chart|plate|box|exhibit)\s*(?:[A-Z]?\d+|[IVX]+)(?:[.-]\d+)*[a-z]?\s*(?:[:.|—–]|\s-\s)/i;
const TOC_LINE_RE = /(?:\.\s?){3,}\s*[\divxlc]+$|\s(?:\d{1,4}|[ivxlc]{1,6})$/i;
const LEADERS_RE = /(?:\.\s?){3,}\s*[\divxlc]+$/i;
const CONTENTS_RE =
  /^(?:(?:table of )?contents|spis treści|treść|inhoud(?:sopgave)?|inhaltsverzeichnis|table des matières|índice|indice|sommaire)$/i;
const BULLET_RE = /^(?:[•▪◦●∙·–—-]\s|\(?\d{1,2}[.)]\s|\(?[a-z][.)]\s|\([ivx]{1,4}\)\s)/;
const SENTENCE_END_RE = /[.!?:;"”’)\]]$/;

export const NUMBER_RE = /^(\d{1,2}(?:\.\d{1,2}){0,4})\.?\s+(?=\S)/;
const ROMAN_HEAD_RE = /^([IVXLC]{1,6})\.\s+(?=\S)/;
const LETTER_HEAD_RE = /^([A-Z](?:\.\d{1,2})+)\.?\s+(?=\S)|^([A-Z])\.\s+(?=[A-Z])/;
export const CHAPTER_RE =
  /^(chapter|rozdział|część|part|hoofdstuk|deel|kapitel|teil|chapitre|partie|appendix|appendices|dodatek|aneks|załącznik|bijlage|anhang|annexe)\s+([\dIVXLC]{1,6}|[A-Z])\b[.:]?\s*/i;

// Section names that mark whole sections, in the languages a reader is
// likely to meet. Names are compared after normalize().
const REFERENCE_NAMES = new Set([
  'references', 'reference', 'bibliography', 'literature cited', 'references and notes', 'works cited', 'cited literature',
  'bibliografia', 'literatura', 'literatura cytowana', 'spis literatury', 'piśmiennictwo', 'źródła',
  'literatuur', 'referenties', 'literatuurlijst', 'literatur', 'literaturverzeichnis', 'références', 'bibliographie',
  'referencias', 'bibliografía',
].map(normalize));
const LIST_NAMES = new Set([
  'contents', 'table of contents', 'list of figures', 'list of tables', 'list of abbreviations', 'abbreviations',
  'index', 'spis treści', 'spis rysunków', 'spis tabel', 'spis ilustracji', 'wykaz skrótów', 'indeks', 'skorowidz',
  'inhoud', 'inhoudsopgave', 'lijst van figuren', 'lijst van tabellen', 'inhaltsverzeichnis', 'abbildungsverzeichnis',
  'tabellenverzeichnis', 'table des matières',
].map(normalize));
const OPENING_NAMES = new Set([
  'abstract', 'summary', 'introduction', 'background', 'streszczenie', 'wstęp', 'wprowadzenie', 'samenvatting',
  'inleiding', 'zusammenfassung', 'einleitung', 'résumé', 'introducción', 'resumen',
].map(normalize));
const KNOWN_NAMES = new Set([
  ...OPENING_NAMES, ...REFERENCE_NAMES, ...LIST_NAMES,
  'related work', 'method', 'methods', 'materials and methods', 'methodology', 'experiments', 'experimental setup',
  'results', 'results and discussion', 'discussion', 'general discussion', 'conclusion', 'conclusions', 'limitations',
  'future work', 'acknowledgments', 'acknowledgements', 'acknowledgment', 'acknowledgement', 'preface', 'foreword',
  'appendix', 'appendices', 'supplementary material', 'supplementary materials', 'data availability',
  'data availability statement', 'funding', 'author contributions', 'competing interests', 'conflict of interest',
  'ethics statement', 'declaration', 'dedication', 'curriculum vitae', 'about the author',
  'metody', 'metodologia', 'wyniki', 'dyskusja', 'wnioski', 'podsumowanie', 'zakończenie', 'podziękowania',
  'methode', 'methoden', 'resultaten', 'discussie', 'conclusie', 'dankwoord',
].map(normalize));

/** Lower case, without diacritics, numbering or punctuation at the ends. */
export function normalize(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** A heading's name: normalized, without its number ("3.2 Data" -> "data"). */
export function headingName(title) {
  return normalize(stripNumber(title));
}

export function stripNumber(title) {
  return String(title)
    .replace(CHAPTER_RE, '')
    .replace(NUMBER_RE, '')
    .replace(ROMAN_HEAD_RE, '')
    .replace(LETTER_HEAD_RE, '')
    .trim();
}

/** The number of a heading: "3.2", "IV", "A", "A.1", or null. */
export function headingNumber(title) {
  const t = String(title).trim();
  let m;
  if ((m = CHAPTER_RE.exec(t))) return m[2].toUpperCase() === m[2] || /\d/.test(m[2]) ? m[2] : m[2].toUpperCase();
  if ((m = NUMBER_RE.exec(t))) return m[1];
  if ((m = LETTER_HEAD_RE.exec(t))) return m[1] || m[2];
  if ((m = ROMAN_HEAD_RE.exec(t))) return m[1];
  return null;
}

const letters = (s) => (s.match(/\p{L}/gu) || []).length;
const words = (s) => s.split(/\s+/).filter(Boolean);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

// ---------- lines ----------

function startLine(it, page) {
  return {
    p: page,
    t: '',
    x: it.x,
    x2: it.x,
    y: it.y,
    size: it.size,
    fonts: new Map(), // font -> letters
    sizes: new Map(), // size -> characters
    gaps: 0, // wide gaps between runs, as between table cells
    mark: '', // a raised marker before the line ("1" of a footnote)
    sup: '',
    space: false,
    firstFont: it.font,
  };
}

function relation(cur, it) {
  const ref = cur.size;
  const dy = it.y - cur.y;
  const back = it.x < cur.x2 - Math.max(ref, it.size) * 0.6;
  const near = it.x - cur.x2 < 1.5 * ref;
  if (Math.abs(dy) <= 0.25 * Math.min(ref, it.size) + 0.3 && !back) return 'same';
  // A drop capital: "F" two lines high, then "or more than four decades".
  if (cur.t.length === 1 && /\p{Lu}/u.test(cur.t) && ref > 2 * it.size && Math.abs(it.x - cur.x2) < it.size && dy > 0 && dy < ref * 1.2) return 'dropcap';
  if (it.size < 0.85 * ref && dy > 0.1 * ref && dy < 0.8 * ref && !back && near) return 'sup';
  if (it.size < 0.85 * ref && dy < -0.05 * ref && dy > -0.5 * ref && !back && near) return 'sub';
  // A small raised run alone, followed by the text it marks: a footnote's number.
  if (!cur.t.trim() && cur.mark === '' && cur.size < 0.85 * it.size && cur.y > it.y && cur.y - it.y < 0.7 * it.size && it.x >= cur.x2 - 1 && it.x - cur.x2 < it.size) {
    return 'promote';
  }
  return 'new';
}

function append(cur, it, sub = false) {
  const gap = it.x - cur.x2;
  const size = Math.min(cur.size, it.size);
  if (cur.t && !sub && (cur.space || gap > 0.12 * size) && !/\s$/.test(cur.t) && !/^[\s,.;:!?)\]]/.test(it.s)) cur.t += ' ';
  if (gap > 2 * size && cur.t) cur.gaps++;
  cur.t += it.s;
  cur.x2 = Math.max(cur.x2, it.x + it.w);
  const n = letters(it.s);
  cur.fonts.set(it.font, (cur.fonts.get(it.font) || 0) + n);
  if (!sub) cur.sizes.set(it.size, (cur.sizes.get(it.size) || 0) + it.s.length);
  cur.space = false;
}

function pageLines(page, pageNo) {
  const out = [];
  let cur = null;
  for (const it of page.items) {
    if (it.rot) continue;
    if (!it.s.trim()) {
      if (cur && it.s) cur.space = true;
      continue;
    }
    const rel = cur ? relation(cur, it) : 'new';
    if (rel === 'new') {
      if (cur) out.push(cur);
      cur = startLine(it, pageNo);
      append(cur, it);
    } else if (rel === 'sup') {
      cur.sup += it.s;
      cur.x2 = Math.max(cur.x2, it.x + it.w);
      cur.space = true;
    } else if (rel === 'dropcap') {
      const [letter, x] = [cur.t, cur.x];
      cur = startLine(it, pageNo);
      append(cur, { ...it, s: letter + it.s });
      cur.x = x;
    } else if (rel === 'promote') {
      const mark = cur.t;
      cur = startLine(it, pageNo);
      cur.mark = mark.trim();
      append(cur, it);
    } else {
      append(cur, it, rel === 'sub');
    }
  }
  if (cur) out.push(cur);
  return out.map(finishLine).filter((l) => l.t);
}

function finishLine(l) {
  let total = 0;
  let bold = 0;
  let italic = 0;
  let math = 0;
  let best = ['', -1];
  for (const [font, n] of l.fonts) {
    total += n;
    if (MATH_RE.test(font)) math += n;
    else if (BOLD_RE.test(font)) bold += n;
    if (ITALIC_RE.test(font) && !MATH_RE.test(font)) italic += n;
    if (n > best[1]) best = [font, n];
  }
  let size = l.size;
  let most = -1;
  for (const [s, n] of l.sizes) if (n > most) [size, most] = [s, n];
  const t = l.t.replace(/\s+/g, ' ').trim();
  const nonSpace = t.replace(/\s/g, '').length || 1;
  const lt = letters(t);
  const upper = (t.match(/\p{Lu}/gu) || []).length;
  return {
    p: l.p,
    t,
    x: l.x,
    x2: l.x2,
    y: l.y,
    size: Math.round(size * 4) / 4,
    font: best[0],
    bold: total > 0 && bold / total > 0.6,
    boldShare: total > 0 ? bold / total : 0,
    italic: total > 0 && italic / total > 0.6,
    math: total > 0 ? math / total : 0,
    caps: lt >= 3 && upper / lt > 0.9,
    alpha: lt / nonSpace,
    gaps: l.gaps,
    mark: l.mark,
    sup: l.sup,
    kind: 'text',
  };
}

// ---------- letter-spaced capitals ----------

// "C O M P U TAT I O N A L L I N G U I S T I C S" (spaced small capitals, as
// in classicthesis) loses its word breaks; the document's own words put
// them back: "Computational Linguistics".
const SPACED_RE = /(?<!\S)(?:\p{Lu}{1,3} ){3,}\p{Lu}{1,3}(?!\S)/gu;
const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with', 'i', 'w', 'z', 'na', 'do', 'oraz', 'en', 'van', 'het', 'de', 'een']);

function vocabulary(lines) {
  const vocab = new Map();
  const upper = new Map(); // words written in capitals: "SQL"
  let hyphen = false;
  for (const l of lines) {
    const ws = l.t.match(/\p{L}{2,}/gu) || [];
    // Halves of words broken at the end of a line are not words.
    if (hyphen) ws.shift();
    hyphen = /\p{L}-$/u.test(l.t);
    if (hyphen) ws.pop();
    for (const w of ws) {
      const lw = w.toLowerCase();
      vocab.set(lw, (vocab.get(lw) || 0) + 1);
      if (w === w.toUpperCase()) upper.set(lw, (upper.get(lw) || 0) + 1);
    }
  }
  for (const w of SMALL_WORDS) vocab.set(w, (vocab.get(w) || 0) + 1);
  vocab.acronyms = new Set([...upper].filter(([w, n]) => n >= 2 && n >= vocab.get(w) * 0.8).map(([w]) => w));
  return vocab;
}

function segment(letters, vocab) {
  const n = letters.length;
  const best = new Array(n + 1).fill(null);
  best[0] = { cost: 0, from: -1 };
  for (let i = 0; i < n; i++) {
    if (!best[i]) continue;
    for (let j = i + 1; j <= Math.min(n, i + 30); j++) {
      const w = letters.slice(i, j);
      const f = vocab.get(w) || 0;
      // Few words, frequent ones; an unknown word costs more, a short one too.
      const cost = best[i].cost + (f ? 1 - Math.min(0.5, Math.log(1 + f) / 20) + (w.length <= 2 && !SMALL_WORDS.has(w) ? 1 : 0) : 3 + w.length * 0.2);
      if (!best[j] || cost < best[j].cost) best[j] = { cost, from: i };
    }
  }
  const out = [];
  for (let j = n; j > 0; j = best[j].from) out.unshift(letters.slice(best[j].from, j));
  return out;
}

export function unspace(text, vocab) {
  return text.replace(SPACED_RE, (run) => {
    const tokens = run.split(' ');
    if (tokens.filter((t) => t.length === 1).length < tokens.length * 0.6) return run;
    const words = segment(run.replace(/ /g, '').toLowerCase(), vocab);
    return words
      .map((w, i) => (vocab.acronyms?.has(w) ? w.toUpperCase() : i > 0 && SMALL_WORDS.has(w) ? w : w[0].toUpperCase() + w.slice(1)))
      .join(' ');
  });
}

// ---------- page furniture: running heads, page numbers, watermarks ----------

const furnitureKey = (t) => t.toLowerCase().replace(/\d+/g, '#').replace(/\b[ivxlc]+\b/g, '#').replace(/\s+/g, ' ');

function markFurniture(pages, boxes) {
  const n = pages.length;
  const inMargin = new Map(); // key -> pages where it is in a margin
  const anywhere = new Map(); // key -> pages
  const candidates = [];
  pages.forEach((lines, pi) => {
    if (!lines.length) return;
    const [, y0, , y1] = boxes[pi];
    const h = y1 - y0;
    const ys = [...new Set(lines.map((l) => Math.round(l.y)))].sort((a, b) => b - a);
    const top = new Set(ys.slice(0, 3));
    const bottom = new Set(ys.slice(-3));
    const seen = new Set();
    for (const l of lines) {
      const key = furnitureKey(l.t);
      if (!seen.has(key)) {
        seen.add(key);
        anywhere.set(key, (anywhere.get(key) || 0) + 1);
      }
      const y = Math.round(l.y);
      if (PAGE_NUMBER_RE.test(l.t) && (l.y > y1 - 0.12 * h || l.y < y0 + 0.12 * h)) l.kind = 'furniture';
      // A running head with its page number: "2.4 Computational Linguistics Terms 17".
      const plain = l.boldShare < 0.5 && l.size <= median(lines.map((x) => x.size));
      if (y === ys[0] && plain && l.y > y1 - 0.12 * h && words(l.t).length <= 15 && /^(?:\d{1,4}|[ivxlc]{1,6})\s|\s(?:\d{1,4}|[ivxlc]{1,6})$/i.test(l.t)) {
        const next = ys[1];
        const spacing = median(ys.slice(1, 12).map((v, k) => v - ys[k + 2]).filter((d) => d > 0));
        if (next == null || !spacing || y - next > spacing * 1.5) l.kind = 'furniture';
      }
      const margin = (top.has(y) && l.y > y1 - 0.2 * h) || (bottom.has(y) && l.y < y0 + 0.2 * h);
      if (!margin) continue;
      candidates.push([l, key]);
      const k = `${key}`;
      if (!inMargin.has(k)) inMargin.set(k, new Set());
      inMargin.get(k).add(pi);
    }
  });
  const needed = n >= 6 ? 3 : 2;
  const sizes = median(pages.flat().map((l) => l.size)) || 10;
  for (const [l, key] of candidates) {
    const count = inMargin.get(key).size;
    // "Chapter 3" opens several pages, in big or bold type; running heads are small and plain.
    const plain = l.boldShare < 0.5 && l.size <= sizes * 1.05;
    if (PAGE_NUMBER_RE.test(l.t) || (n >= 2 && count >= needed && (plain || count >= Math.max(3, n * 0.5)))) l.kind = 'furniture';
  }
  // Watermarks and licence lines on most pages, wherever they are.
  if (n >= 3) {
    for (const lines of pages) {
      for (const l of lines) {
        if (words(l.t).length >= 3 && anywhere.get(furnitureKey(l.t)) >= Math.max(3, n * 0.5)) l.kind = 'furniture';
      }
    }
  }
}

// ---------- the body style ----------

function bodyStyle(lines) {
  const counts = new Map();
  for (const l of lines) {
    if (l.kind !== 'text' || l.math > 0.3 || letters(l.t) < 15) continue;
    const key = `${l.font}|${Math.round(l.size * 2) / 2}`;
    counts.set(key, (counts.get(key) || 0) + l.t.length);
  }
  let best = null;
  let most = -1;
  for (const [k, n] of counts) if (n > most) [best, most] = [k, n];
  if (!best) return { font: '', size: median(lines.map((l) => l.size)) || 10, lead: 12 };
  const [font, size] = [best.slice(0, best.lastIndexOf('|')), Number(best.slice(best.lastIndexOf('|') + 1))];
  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    const [a, b] = [lines[i - 1], lines[i]];
    if (a.p !== b.p || Math.abs(a.size - size) > 0.6 || Math.abs(b.size - size) > 0.6) continue;
    const dy = a.y - b.y;
    if (dy > 0.9 * size && dy < 2.2 * size) gaps.push(dy);
  }
  return { font, size, lead: median(gaps) || size * 1.2 };
}

// ---------- footnotes, captions, contents pages, tables, equations ----------

function markSmallPrint(pages, boxes, body) {
  pages.forEach((lines, pi) => {
    const [, y0, , y1] = boxes[pi];
    const h = y1 - y0;
    const isContents = lines.some((l) => CONTENTS_RE.test(l.t.trim()));
    const ending = lines.filter((l) => l.kind === 'text' && TOC_LINE_RE.test(l.t)).length;
    const leaders = lines.filter((l) => LEADERS_RE.test(l.t)).length;
    const tocPage = (isContents && ending >= 3) || (lines.length >= 6 && ending / lines.length > 0.5) || leaders >= 3;
    for (const l of lines) {
      if (l.kind !== 'text') continue;
      if (LEADERS_RE.test(l.t) || (tocPage && TOC_LINE_RE.test(l.t))) l.kind = 'toc';
      else if (l.gaps >= 2) l.kind = 'table';
      else if (l.alpha < 0.4 || l.math > 0.4) l.kind = 'math';
    }
    // Footnotes: a run of small lines low on the page, after a gap or
    // starting with a marker, ending where the page or the column ends.
    let i = 0;
    while (i < lines.length) {
      if (lines[i].kind === 'furniture' || !(lines[i].size < 0.92 * body.size) || CAPTION_RE.test(lines[i].t)) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < lines.length && lines[j + 1].kind !== 'furniture' && lines[j + 1].size < 0.92 * body.size && lines[j + 1].y < lines[j].y + 2) j++;
      const first = lines[i];
      const next = lines.slice(j + 1).find((l) => l.kind !== 'furniture');
      const prev = lines.slice(0, i).reverse().find((l) => l.kind !== 'furniture');
      const low = lines.slice(i, j + 1).every((l) => l.y < y0 + 0.45 * h);
      const ends = !next || next.y > first.y + body.size;
      const marked = first.mark !== '' || /^[\d*†‡§¶]/.test(first.t);
      const gap = !prev || prev.y - first.y > body.lead * 1.3 || prev.y < first.y;
      if (low && ends && (marked || gap)) for (let k = i; k <= j; k++) if (lines[k].kind !== 'toc') lines[k].kind = 'note';
      i = j + 1;
    }
  });
}

// ---------- side columns (PLOS's first pages) ----------

function markMargins(all, body) {
  // The columns of running text start at a few x positions; small print
  // entirely to the left of them is a sidebar.
  const lefts = new Map();
  let n = 0;
  for (const l of all) {
    if (l.kind !== 'text' || Math.abs(l.size - body.size) > 0.6 || l.t.length < 30) continue;
    const x = Math.round(l.x / 5) * 5;
    lefts.set(x, (lefts.get(x) || 0) + 1);
    n++;
  }
  const columns = [...lefts].filter(([, c]) => c >= n * 0.1).map(([x]) => x);
  if (!columns.length) return;
  const left = Math.min(...columns);
  for (const l of all) {
    if (l.kind === 'text' && l.size < body.size * 0.95 && l.x2 < left - 5) l.kind = 'front';
  }
}

// ---------- headings ----------

function styleKey(l) {
  return `${Math.round(l.size * 2) / 2}|${l.bold ? 1 : 0}|${l.caps ? 1 : 0}|${l.italic ? 1 : 0}|${l.font.replace(/[-,].*$/, '')}`;
}

// Bigger styles first: size, then weight, capitals, upright.
function styleRank(key) {
  const [size, bold, caps, italic] = key.split('|').map(Number);
  return -size * 100 - bold * 10 - caps * 5 + italic;
}

function plausibleTitle(t) {
  const w = words(t);
  const lt = letters(t);
  if (w.length === 0 || w.length > 16 || t.length > 140 || lt < 2 || lt < t.replace(/\s/g, '').length * 0.45) return false;
  if (/[,;-]$/.test(t) || /^\(.*\)$/.test(t) || CAPTION_RE.test(t) || LEADERS_RE.test(t)) return false;
  if (/[.]$/.test(t) && w.length > 7 && !NUMBER_RE.test(t)) return false;
  return true;
}

function headingStyled(l, body) {
  if (l.kind !== 'text' || l.gaps > 0) return false;
  // A bold label followed by plain text ("Funding: ...") is not a heading.
  return l.size >= body.size * 1.12 || (l.boldShare > 0.9 && l.size >= body.size * 0.88) || ((l.caps || l.spaced) && l.size >= body.size * 0.88 && words(l.t).length <= 8);
}

/** Groups of heading lines: [{ lines, text, key, num, level }] in reading order. */
function findHeadings(all, body) {
  let before = null;
  for (const l of all) {
    if (l.kind === 'furniture' || l.kind === 'note') continue;
    l.after = before;
    before = l;
  }
  const groups = [];
  let top = 0; // the last top-level number, so "3 participants were excluded" is not a heading
  for (let i = 0; i < all.length; i++) {
    const l = all[i];
    if (l.kind !== 'text') continue;
    const prev = l.after;
    const styled = headingStyled(l, body);
    const numbered = NUMBER_RE.test(l.t) || ROMAN_HEAD_RE.test(l.t) || CHAPTER_RE.test(l.t);
    const known = KNOWN_NAMES.has(headingName(l.t));
    const standaloneAbove = !prev || prev.p !== l.p || prev.y - l.y > body.lead * 1.3 || prev.y < l.y || prev.kind !== 'text';
    if (!styled && !((numbered || known) && standaloneAbove && l.size >= body.size * 0.88)) continue;
    // Lines in the same style continue the heading.
    const lines = [l];
    let j = i;
    while (j + 1 < all.length) {
      const n = all[j + 1];
      if (n.kind !== 'text' || n.p !== l.p || styleKey(n) !== styleKey(l) || n.y >= all[j].y || all[j].y - n.y > n.size * 1.9) break;
      if (lines.length >= 3 || NUMBER_RE.test(n.t) || CHAPTER_RE.test(n.t)) break;
      if (!styled) break;
      lines.push(n);
      j++;
    }
    // "Chapter 3" over the chapter's title.
    if (CHAPTER_RE.test(l.t) && stripNumber(l.t) === '' && j + 1 < all.length) {
      const n = all[j + 1];
      if (n.kind === 'text' && n.p === l.p && headingStyled(n, body) && plausibleTitle(n.t)) {
        lines.push(n);
        j++;
        while (j + 1 < all.length && all[j + 1].kind === 'text' && all[j + 1].p === l.p && styleKey(all[j + 1]) === styleKey(n) && lines.length < 4 && n.y - all[j + 1].y < n.size * 2.2) {
          lines.push(all[j + 1]);
          j++;
        }
      }
    }
    const text = joinHeading(lines);
    if (!plausibleTitle(text)) continue;
    const next = all.slice(j + 1).find((n) => n.kind !== 'furniture' && n.kind !== 'note');
    if (!next) continue;
    // Followed by text or another heading; not by a caption (labels inside a figure).
    const nextOk = next.kind === 'text' && !CAPTION_RE.test(next.t) && (headingStyled(next, body) || (Math.abs(next.size - body.size) <= body.size * 0.15 && words(next.t).length >= 2));
    if (!nextOk) continue;
    if (!styled) {
      // A body-style line: only numbered in sequence or a known name, alone.
      const below = next.p !== l.p || l.y - next.y > body.lead * 1.25;
      if (!below && !known) continue;
      if (/[.:]$/.test(text) && !known) continue;
      if (/^\d{1,2}\.\s/.test(text) && words(text).length > 8) continue; // a numbered list item
    }
    let num = headingNumber(text);
    if (num && /^\d+$/.test(num) && !CHAPTER_RE.test(text)) {
      const n = Number(num);
      if (n !== top + 1 && n !== 1 && n !== top) {
        if (!styled) continue;
      }
      top = n;
    } else if (num && /^\d+\./.test(num)) {
      if (!styled && Number(num.split('.')[0]) !== top) continue;
    }
    if (num && /^\d{1,2}$/.test(num) && words(text).length === 1 && !CHAPTER_RE.test(text)) continue; // a bare number
    groups.push({ lines, text, key: styleKey(l), num, chapter: CHAPTER_RE.test(text), level: 0 });
    for (const x of lines) x.kind = 'heading';
    lines[0].head = groups[groups.length - 1];
    for (const x of lines.slice(1)) x.headCont = true;
    i = j;
  }
  assignLevels(groups);
  return groups;
}

function joinHeading(lines) {
  const parts = lines.map((l) => l.t);
  if (lines.length > 1 && CHAPTER_RE.test(parts[0]) && stripNumber(parts[0]) === '') {
    return `${parts[0].replace(/[.:]$/, '')}. ${joinText(parts.slice(1))}`;
  }
  return joinText(parts);
}

function joinText(parts) {
  let out = '';
  for (const p of parts) {
    if (!out) out = p;
    else if (/[A-Za-zÀ-ž]-$/.test(out) && /^\p{Ll}/u.test(p)) out = out.slice(0, -1) + p;
    else out += ` ${p}`;
  }
  return out;
}

function depth(num) {
  if (!num) return null;
  return num.split('.').length;
}

function assignLevels(groups) {
  // Numbered headings have their depth; each style takes the most common
  // depth of its numbered headings; the usual section names are top level.
  const byKey = new Map();
  for (const g of groups) {
    const n = g.num || '';
    g.depth = g.chapter ? 1 : /^\d/.test(n) || /^[A-Z]\.\d/.test(n) ? depth(n) : n ? 1 : null;
    if (g.depth == null) continue;
    if (!byKey.has(g.key)) byKey.set(g.key, new Map());
    const m = byKey.get(g.key);
    m.set(g.depth, (m.get(g.depth) || 0) + 1);
  }
  const levelOf = new Map();
  for (const [k, m] of byKey) levelOf.set(k, [...m].sort((a, b) => b[1] - a[1])[0][0]);
  // Two styles of the same size and weight: the one that comes right under
  // the other is the lower level ("Results" over "Recommendations development").
  const lower = new Set();
  for (let i = 1; i < groups.length; i++) {
    const [a, b] = [groups[i - 1], groups[i]];
    if (a.key !== b.key && styleRank(a.key) === styleRank(b.key) && b.lines[0].after === a.lines[a.lines.length - 1]) lower.add(b.key);
  }
  const rank = (k) => styleRank(k) + (lower.has(k) ? 0.5 : 0);
  // The rest by nesting: under the nearest heading in a bigger style.
  const stack = [];
  let abstract = null; // rank of an "Abstract" heading we are under
  for (const g of groups) {
    const r = rank(g.key);
    let level = g.depth ?? levelOf.get(g.key);
    const name = headingName(g.text);
    // The usual names are top level, except the parts of a structured
    // abstract: the style of the first heading under it.
    let part = false;
    if (abstract && r > abstract.r && (abstract.sub == null || abstract.sub === g.key)) {
      abstract.sub = g.key;
      part = true;
    } else abstract = null;
    if (level == null && KNOWN_NAMES.has(name) && !part) level = 1;
    if (level == null) {
      while (stack.length && stack[stack.length - 1].r >= r) stack.pop();
      level = stack.length ? stack[stack.length - 1].level + 1 : 1;
    }
    g.level = Math.min(level, 6);
    if (g.level === 1) abstract = ['abstract', 'summary', 'streszczenie', 'samenvatting', 'zusammenfassung'].includes(name) ? { r, sub: null } : null;
    while (stack.length && stack[stack.length - 1].level >= g.level) stack.pop();
    stack.push({ r, level: g.level });
  }
  const min = Math.min(...groups.map((g) => g.level));
  if (min > 1) for (const g of groups) g.level -= min - 1;
}

// ---------- the first page: title, authors, affiliations ----------

function markFront(all, body, hint) {
  const first = all.filter((l) => l.p === all[0]?.p);
  if (!first.length) return null;
  const biggest = Math.max(...first.filter((l) => l.kind !== 'furniture').map((l) => l.size));
  let title = null;
  // The title from the document information, where the page shows it.
  const wanted = hint ? normalize(hint) : '';
  if (wanted.split(' ').length >= 2) {
    for (let i = 0; i < first.length && !title; i++) {
      const lines = [];
      for (let j = i; j < first.length && lines.length < 5; j++) {
        const n = normalize(first[j].t);
        if (!n || !wanted.includes(n) || (lines.length && Math.abs(first[j].size - lines[0].size) > 0.3)) break;
        lines.push(first[j]);
      }
      const got = normalize(lines.map((l) => l.t).join(' '));
      if (lines.length && got.length >= wanted.length * 0.6) {
        title = joinText(lines.map((l) => l.t));
        for (const l of lines) {
          l.kind = 'title';
          if (l.head) l.head.dropped = true;
        }
      }
    }
  }
  if (!title && biggest >= body.size * 1.25) {
    const lines = [];
    for (const l of first) {
      if (l.kind === 'furniture') continue;
      if (Math.abs(l.size - biggest) < 0.3) lines.push(l);
      else if (lines.length) break;
    }
    if (lines.length && lines.length <= 4) {
      title = joinText(lines.map((l) => l.t));
      for (const l of lines) {
        l.kind = 'title';
        if (l.head) l.head.dropped = true;
      }
    }
  }
  // Everything above the abstract (or the first numbered heading, or the first paragraph) is front matter.
  let anchor = -1;
  for (let i = 0; i < first.length; i++) {
    const l = first[i];
    if (l.kind === 'heading' && l.head && (OPENING_NAMES.has(headingName(l.head.text)) || l.head.num === '1' || l.head.num === 'I')) {
      anchor = i;
      break;
    }
    if (l.kind === 'text' && !l.bold && Math.abs(l.size - body.size) < 0.6 && i + 2 < first.length && [first[i + 1], first[i + 2]].every((n) => n.kind === 'text' && Math.abs(n.size - body.size) < 0.6 && l.y - n.y < body.lead * 3) && letters(l.t) > 40) {
      anchor = i;
      break;
    }
  }
  if (anchor < 0) anchor = first.length;
  for (let i = 0; i < anchor; i++) {
    const l = first[i];
    if (l.kind !== 'text' && l.kind !== 'heading') continue;
    if (l.head) l.head.dropped = true;
    l.kind = 'front';
  }
  return title;
}

// ---------- the outline ----------

function usableOutline(outline, numPages) {
  const placed = outline.filter((o) => o.page);
  return placed.length >= 2 && new Set(placed.map((o) => o.page)).size >= Math.min(2, numPages) ? placed : null;
}

function similar(a, b) {
  const x = headingName(a);
  const y = headingName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.startsWith(y) || y.startsWith(x)) return Math.min(x.length, y.length) / Math.max(x.length, y.length) > 0.5 ? 0.9 : 0.6;
  const wx = new Set(x.split(' '));
  const wy = y.split(' ');
  return wy.filter((w) => wx.has(w)).length / Math.max(wx.size, wy.length);
}

/** Matches outline entries to lines; returns anchors [{ line, title, level, virtual }]. */
function placeOutline(entries, all, groups) {
  const byPage = new Map();
  all.forEach((l, i) => {
    if (!byPage.has(l.p)) byPage.set(l.p, []);
    byPage.get(l.p).push(i);
  });
  const anchors = [];
  for (const e of entries) {
    let found = null;
    // The heading may be a few pages on (a sloppy outline points at the page before).
    for (let p = e.page; p <= e.page + 6 && !found; p++) {
      const idx = byPage.get(p) || [];
      let best = null;
      for (const i of idx) {
        const l = all[i];
        if (['furniture', 'note', 'toc', 'front'].includes(l.kind) || l.headCont) continue;
        if (p === e.page && e.top != null && l.y > e.top + l.size * 1.5) continue;
        const text = l.head ? l.head.text : l.t;
        const s = similar(e.title, text);
        if (s < 0.75) continue;
        const dist = p === e.page && e.top != null ? Math.abs(e.top - l.y) : 1000 * (p - e.page);
        const score = s * 1000 - dist - (l.head ? 0 : 50);
        if (!best || score > best.score) best = { i, score };
      }
      if (best) found = best.i;
    }
    if (found == null) {
      // No line with the title: start where the destination points.
      const idx = (byPage.get(e.page) || []).filter((i) => !['furniture', 'note'].includes(all[i].kind));
      const below = idx.filter((i) => e.top == null || all[i].y <= e.top + 2).filter((i) => e.x == null || all[i].x2 >= e.x - 2);
      // The highest line under the destination.
      const i = below.reduce((a, b) => (a == null || all[b].y > all[a].y ? b : a), null) ?? idx[0];
      if (i == null) continue;
      anchors.push({ line: i, title: e.title, level: e.level, virtual: true });
      continue;
    }
    const l = all[found];
    if (!l.head) {
      const g = { lines: [l], text: l.t, key: styleKey(l), num: headingNumber(l.t), chapter: CHAPTER_RE.test(l.t), level: e.level };
      // Lines that continue the title.
      let k = found;
      while (g.text.length < e.title.length * 0.9 && all[k + 1] && all[k + 1].p === l.p && styleKey(all[k + 1]) === g.key && g.lines.length < 4) {
        g.lines.push(all[++k]);
        g.text = joinHeading(g.lines);
      }
      for (const x of g.lines) x.kind = 'heading';
      for (const x of g.lines.slice(1)) x.headCont = true;
      l.head = g;
      groups.push(g);
    }
    l.head.dropped = false;
    if (l.kind !== 'heading') {
      l.kind = 'heading';
    }
    anchors.push({ line: found, title: l.head.text, level: e.level, virtual: false, outlineTitle: e.title });
  }
  return anchors;
}

// ---------- blocks ----------

function hyphenJoiner(lines) {
  const counts = new Map();
  for (const l of lines) {
    for (const w of l.t.toLowerCase().match(/[\p{L}][\p{L}-]*[\p{L}]/gu) || []) counts.set(w, (counts.get(w) || 0) + 1);
  }
  // "seg-" + "ment" -> "segment", "state-of-the-" + "art" stays hyphenated.
  return (left, right) => {
    const a = (left.match(/([\p{L}-]+)-$/u) || [])[1];
    const [, b, more] = right.match(/^(\p{L}+)(-?)/u) || [];
    if (!a || !b || !/^\p{Ll}/u.test(b)) return null;
    if (more) return 'keep'; // "English-" + "to-German
    const joined = (a + b).toLowerCase();
    const hyphened = `${a}-${b}`.toLowerCase();
    if ((counts.get(hyphened) || 0) > (counts.get(joined) || 0)) return 'keep';
    if (a.includes('-')) return 'keep';
    return 'join';
  };
}

function lineJoin(text, next, hyphen) {
  if (!text) return next;
  if (/­$/.test(text)) return text.slice(0, -1) + next;
  if (/\p{L}-$/u.test(text)) {
    const how = hyphen(text, next);
    if (how === 'join') return text.slice(0, -1) + next;
    if (how === 'keep') return text + next;
  }
  return `${text} ${next}`;
}

const SKIP_KINDS = new Set(['note', 'table', 'math', 'toc', 'front', 'caption']);

function buildBlocks(all, body, anchorsByLine) {
  const hyphen = hyphenJoiner(all.filter((l) => l.kind === 'text'));
  const blocks = [];
  let cur = null; // the block being built
  let prev = null; // its last line
  let lastText = -1; // index of the last text block

  const close = () => {
    if (!cur) return;
    if (cur.k === 'para') {
      const n = cur.lines.length;
      if (cur.wasText) cur.k = 'text';
      else cur.k = cur.tableLines >= 2 && cur.tableLines >= n / 2 ? 'table' : cur.mathLines >= Math.max(1, n / 2) ? 'math' : 'text';
    }
    const block = { k: cur.k, t: cur.t, p: cur.p };
    if (cur.level) block.l = cur.level;
    blocks.push(block);
    if (block.k === 'text') lastText = blocks.length - 1;
    cur = null;
    prev = null;
  };

  const open = (k, l) => {
    close();
    cur = { k, t: '', p: l.p, lines: [], tableLines: 0, mathLines: 0, right: l.x2 };
  };

  for (let i = 0; i < all.length; i++) {
    const l = all[i];
    const anchor = anchorsByLine.get(i);
    if (anchor?.virtual) {
      close();
      blocks.push({ k: 'heading', t: anchor.title, p: l.p, l: anchor.level, v: 1, o: 1 });
    }
    if (l.kind === 'furniture' || l.headCont) continue;
    if (l.kind === 'heading') {
      if (!l.head || (l.head.dropped && !anchor)) {
        // A heading-styled line that is not one after all (front matter): plain text.
        l.kind = 'front';
      } else {
        close();
        const block = { k: 'heading', t: l.head.text, p: l.p, l: anchor ? anchor.level : l.head.level };
        if (l.head.num) block.n = l.head.num;
        if (anchor || l.head.keep) block.o = 1;
        blocks.push(block);
        continue;
      }
    }
    if (l.kind === 'title' || l.kind === 'front' || l.kind === 'note' || l.kind === 'toc') {
      const gap = prev && (prev.p !== l.p || prev.y - l.y > body.lead * 1.6 || prev.y < l.y);
      if (!cur || cur.k !== l.kind || gap) open(l.kind, l);
      cur.t = lineJoin(cur.t, l.t, hyphen);
      cur.lines.push(l);
      prev = l;
      continue;
    }
    // Captions run until a gap or a change of size.
    if (CAPTION_RE.test(l.t) && (!cur || cur.k !== 'caption')) {
      open('caption', l);
      cur.size = l.size;
      cur.t = l.t;
      cur.lines.push(l);
      prev = l;
      continue;
    }
    if (cur?.k === 'caption') {
      const sameRun = prev && prev.p === l.p && prev.y > l.y && prev.y - l.y < body.lead * 1.5 * (l.size / body.size) + 1 && Math.abs(l.size - cur.size) < 0.6;
      if (sameRun && l.kind === 'text') {
        cur.t = lineJoin(cur.t, l.t, hyphen);
        cur.lines.push(l);
        prev = l;
        continue;
      }
      close();
    }
    // Paragraphs (text, table rows, display equations).
    if (l.kind === 'math' && l.math < 0.2 && cur?.k === 'para' && prev?.kind === 'text' && prev.p === l.p) {
      // "arXiv:1607.06450, 2016." under a line of text is text, not an equation.
      const dy = prev.y - l.y;
      if (dy > 0 && dy < body.lead * 1.45 && Math.abs(l.x - prev.x) < 1.5 * body.size) l.kind = 'text';
    }
    let fresh = true;
    let jumped = false;
    if (cur?.k === 'para') {
      const lead = body.lead * Math.max(1, l.size / body.size);
      const dy = prev.y - l.y;
      fresh = false;
      if (prev.p !== l.p || dy < -0.5 * l.size) fresh = jumped = true;
      else if (dy > lead * 1.45 || Math.abs(l.size - prev.size) > body.size * 0.15) fresh = true;
      else if (l.kind !== 'text' || prev.kind !== 'text') fresh = l.kind !== prev.kind;
      else if (l.x - prev.x > 0.7 * body.size && SENTENCE_END_RE.test(prev.t)) fresh = true;
      else if (SENTENCE_END_RE.test(prev.t) && prev.x2 < cur.right - 2.5 * body.size) fresh = true;
      else if (BULLET_RE.test(l.t)) fresh = true;
    }
    const bodyText = l.kind === 'text' && Math.abs(l.size - body.size) <= body.size * 0.15;
    if (fresh && jumped && bodyText && !SENTENCE_END_RE.test(cur.t) && (/^[\p{Ll}\d(]/u.test(l.t) || cur.lines.length >= 2)) {
      // The paragraph goes on in the next column or on the next page.
      cur.right = l.x2;
    } else if (fresh) {
      close();
      const last = blocks[lastText];
      if (last && bodyText && blocks.slice(lastText + 1).every((b) => SKIP_KINDS.has(b.k)) && !SENTENCE_END_RE.test(last.t) && /^\p{Ll}/u.test(l.t)) {
        // A paragraph interrupted by a figure, an equation or footnotes:
        // it goes on after them, so they are moved before it.
        const [para] = blocks.splice(lastText, 1);
        cur = { k: 'para', t: para.t, p: para.p, lines: [], tableLines: 0, mathLines: 0, right: l.x2, wasText: true };
        lastText = -1;
      } else {
        open('para', l);
      }
    }
    cur.t = lineJoin(cur.t, l.t, hyphen);
    cur.lines.push(l);
    cur.right = Math.max(cur.right, l.x2);
    if (l.kind === 'table') cur.tableLines++;
    if (l.kind === 'math') cur.mathLines++;
    prev = l;
  }
  close();
  return blocks;
}

// ---------- sections ----------

function sectionKind(title) {
  const name = headingName(title);
  if (REFERENCE_NAMES.has(name)) return 'refs';
  if (LIST_NAMES.has(name)) return 'list';
  return '';
}

function buildSections(blocks) {
  const sections = [];
  blocks.forEach((b, i) => {
    if (b.k !== 'heading') return;
    const s = { t: b.t, l: b.l || 1, b: i, p: b.p };
    const n = b.n ?? headingNumber(b.t);
    if (n) s.n = n;
    const kind = sectionKind(b.t);
    if (kind) s.k = kind;
    sections.push(s);
  });
  // A chapter printed as "Introduction" with its number set apart is
  // numbered by its first subsection: "1.1 Problem Description".
  sections.forEach((s, k) => {
    if (s.n) return;
    const child = sections[k + 1];
    const m = child && child.l > s.l && /^(\d{1,2}|[A-Z])\.\d{1,2}$/.exec(child.n || '');
    if (m && !sections.some((x) => x.l === s.l && x.n === m[1])) s.n = m[1];
  });
  return sections;
}

// ---------- language ----------

const STOPWORDS = {
  en: ['the', 'and', 'of', 'to', 'in', 'is', 'that', 'for', 'with', 'are', 'this', 'we', 'on', 'as'],
  pl: ['i', 'w', 'z', 'na', 'się', 'nie', 'jest', 'że', 'do', 'to', 'oraz', 'jak', 'od', 'są', 'przez'],
  nl: ['de', 'het', 'een', 'en', 'van', 'is', 'dat', 'niet', 'op', 'voor', 'zijn', 'met', 'te', 'wordt'],
  de: ['der', 'die', 'und', 'das', 'ist', 'nicht', 'mit', 'den', 'von', 'zu', 'ein', 'eine', 'auf', 'sich'],
  fr: ['le', 'la', 'les', 'et', 'des', 'est', 'une', 'du', 'en', 'que', 'pour', 'dans', 'pas', 'sur'],
  es: ['el', 'la', 'los', 'las', 'y', 'que', 'en', 'del', 'por', 'una', 'para', 'con', 'es', 'se'],
  it: ['il', 'la', 'di', 'che', 'e', 'per', 'un', 'una', 'del', 'della', 'sono', 'con', 'non', 'gli'],
};

/** The language of a text from its most common words: 'en', 'pl', 'nl', ... or ''. */
export function detectLang(text) {
  const counts = new Map();
  for (const w of text.toLowerCase().match(/\p{L}+/gu)?.slice(0, 20000) || []) counts.set(w, (counts.get(w) || 0) + 1);
  let best = '';
  let most = 0;
  for (const [lang, list] of Object.entries(STOPWORDS)) {
    const n = list.reduce((sum, w) => sum + (counts.get(w) || 0), 0);
    if (n > most) [best, most] = [lang, n];
  }
  return most >= 5 ? best : '';
}

// ---------- the whole document ----------

/**
 * @param raw the result of pdfread.readPdf
 * @returns {{ v, title, author, lang, pages, labels, blocks, sections, outline }}
 *   blocks: [{ k: kind, t: text, p: page, l?: level, n?: number, v?: 1 for a heading taken from the outline }]
 *   kinds: title, front, heading, text, caption, note, table, math, toc
 *   sections: [{ t: title, l: level, b: block index, p: page, n?: number, k?: 'refs' | 'list' }]
 */
export function buildDocument(raw, { debug = false } = {}) {
  const pages = raw.pages.map((page, i) => pageLines(page, i + 1));
  const vocab = vocabulary(pages.flat());
  for (const l of pages.flat()) {
    if (!SPACED_RE.test(l.t)) continue;
    SPACED_RE.lastIndex = 0;
    l.t = unspace(l.t, vocab);
    l.spaced = true;
  }
  const boxes = raw.pages.map((page) => page.box);
  markFurniture(pages, boxes);
  const all = pages.flat();
  const body = bodyStyle(all);
  markSmallPrint(pages, boxes, body);
  markMargins(all, body);
  const infoTitle = raw.info?.title || '';
  const usableInfo = infoTitle && words(infoTitle).length >= 2 && !/\.(docx?|pdf|tex|dvi)$|^untitled|^microsoft word/i.test(infoTitle);
  const groups = findHeadings(all, body);
  const firstTitle = markFront(all, body, usableInfo ? infoTitle : '');
  assignLevels(groups.filter((g) => !g.dropped));

  const entries = usableOutline(raw.outline || [], raw.numPages);
  const anchorsByLine = new Map();
  let fromOutline = false;
  if (entries) {
    fromOutline = true;
    const anchors = placeOutline(entries, all, groups);
    for (const a of anchors) anchorsByLine.set(a.line, a);
    // Headings found in the text but not in the outline stay as text breaks,
    // and as sections when they are deeper than the outline goes.
    const maxDepth = Math.max(...entries.map((e) => e.level));
    for (const g of groups) {
      const line = all.indexOf(g.lines[0]);
      if (anchorsByLine.has(line)) continue;
      if (KNOWN_NAMES.has(headingName(g.text)) && !g.dropped) {
        // "Abstract" and "References" are often left out of a paper's outline.
        g.level = 1;
        g.keep = true;
      } else if (g.num && depth(g.num) > maxDepth && /^\d/.test(g.num)) g.level = depth(g.num);
      else g.level = maxDepth + 1;
    }
  }
  const blocks = buildBlocks(all, body, anchorsByLine);
  let sections = buildSections(blocks);
  if (fromOutline) {
    // The outline's entries, and numbered headings deeper than it goes.
    const maxDepth = Math.max(...entries.map((e) => e.level));
    sections = sections.filter((s) => blocks[s.b].o || (/^\d/.test(s.n || '') && depth(s.n) > maxDepth));
  }

  const title = firstTitle || (usableInfo ? infoTitle : '') || sections[0]?.t || '';
  const sample = blocks.filter((b) => b.k === 'text').map((b) => b.t).join(' ').slice(0, 60000);
  const doc = {
    v: PARSER_VERSION,
    title,
    author: raw.info?.author || '',
    lang: detectLang(sample) || (raw.info?.lang || '').slice(0, 2).toLowerCase(),
    pages: raw.numPages,
    labels: raw.labels || null,
    outline: fromOutline,
    blocks,
    sections,
  };
  if (debug) Object.defineProperty(doc, 'lines', { value: all });
  return doc;
}
