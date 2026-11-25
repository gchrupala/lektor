// What is read aloud, in what pieces: each block split into sentences, and
// each sentence cleaned for a speech synthesizer (citations, web addresses,
// abbreviations, stray footnote marks). Pure logic without DOM.

export const DEFAULT_OPTIONS = {
  readCaptions: false, // "Figure 3: ..."
  readNotes: false, // footnotes
  readCitations: false, // "(Smith et al., 2020)", "[12]"
  readReferences: false, // the reference list, when reading on from an earlier section
};

// Words before a full stop that does not end a sentence.
const ABBREVIATIONS = new Set(
  (
    'e.g i.e et al al cf fig figs eq eqs sec sect ch chap tab no nos vol vols pp p ed eds dr mr mrs ms prof vs etc approx ' +
    'resp ca st jr sr inc ltd co dept univ ref refs suppl app art ex esp incl min max ' +
    'np tj tzn tzw itd itp m.in ok rys ryc tab por zob wg ww jw dr hab inż mgr prof doc św ul nr r w ' +
    'bijv o.a d.w.z e.d m.b.t z.b d.h u.a bzw vgl'
  ).split(' '),
);

const EXPANSIONS = {
  en: [
    ['e.g.', 'for example'],
    ['i.e.', 'that is'],
    ['cf.', 'compare'],
    ['w.r.t.', 'with respect to'],
    ['Figs.', 'Figures'],
    ['Fig.', 'Figure'],
    ['Eqs.', 'Equations'],
    ['Eq.', 'Equation'],
    ['Sect.', 'Section'],
    ['Sec.', 'Section'],
    ['Ch.', 'Chapter'],
    ['Tab.', 'Table'],
    ['vs.', 'versus'],
    ['approx.', 'approximately'],
    ['resp.', 'respectively'],
    ['et al.', 'et al'],
  ],
  pl: [
    ['np.', 'na przykład'],
    ['tj.', 'to jest'],
    ['tzn.', 'to znaczy'],
    ['tzw.', 'tak zwany'],
    ['itd.', 'i tak dalej'],
    ['itp.', 'i tym podobne'],
    ['m.in.', 'między innymi'],
    ['ok.', 'około'],
    ['rys.', 'rysunek'],
    ['Rys.', 'Rysunek'],
    ['ryc.', 'rycina'],
    ['Ryc.', 'Rycina'],
    ['tab.', 'tabela'],
    ['Tab.', 'Tabela'],
    ['por.', 'porównaj'],
    ['zob.', 'zobacz'],
    ['wg', 'według'],
    ['et al.', 'i współpracownicy'],
  ],
  nl: [
    ['bijv.', 'bijvoorbeeld'],
    ['o.a.', 'onder andere'],
    ['d.w.z.', 'dat wil zeggen'],
    ['e.d.', 'en dergelijke'],
    ['m.b.t.', 'met betrekking tot'],
    ['et al.', 'et al'],
  ],
  de: [
    ['z.B.', 'zum Beispiel'],
    ['d.h.', 'das heißt'],
    ['u.a.', 'unter anderem'],
    ['bzw.', 'beziehungsweise'],
    ['vgl.', 'vergleiche'],
    ['et al.', 'et al'],
  ],
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EXPANSION_RES = Object.fromEntries(
  Object.entries(EXPANSIONS).map(([lang, pairs]) => [
    lang,
    pairs.map(([from, to]) => [new RegExp(`(?<![\\p{L}.])${escape(from)}(?![\\p{L}])`, 'gu'), to]),
  ]),
);

const MAX_PIECE = 220; // Some voices stop on long utterances (Chrome's online voices after ~15 s).
const MIN_PIECE = 20;

/** Splits text into sentences, keeping "et al.", "Fig. 3" and initials whole. */
export function sentences(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const out = [];
  let start = 0;
  const re = /[.!?…]+["”’)\]]*\s+(?=["“‘(\[]?[\p{Lu}\d])/gu;
  let m;
  while ((m = re.exec(t))) {
    const end = m.index + m[0].length;
    const before = t.slice(start, m.index + 1);
    const word = (before.match(/([\p{L}.]+)\.$/u) || [])[1];
    if (word && /[.]/.test(m[0][0]) && !/[!?]/.test(m[0])) {
      const w = word.toLowerCase();
      if (ABBREVIATIONS.has(w) || ABBREVIATIONS.has(w.replace(/^.*\./, '')) || /^\p{Lu}$/u.test(word)) continue;
    }
    out.push(t.slice(start, end).trim());
    start = end;
  }
  if (start < t.length) out.push(t.slice(start).trim());
  // Very short pieces join their neighbour; long ones are cut at commas.
  const merged = [];
  for (const s of out) {
    if (merged.length && (s.length < MIN_PIECE || merged[merged.length - 1].length < MIN_PIECE)) merged[merged.length - 1] += ` ${s}`;
    else merged.push(s);
  }
  return merged.flatMap(cutLong);
}

function cutLong(s) {
  if (s.length <= MAX_PIECE) return [s];
  const mid = s.length / 2;
  let best = -1;
  for (const re of [/[;:]\s/g, /,\s/g, /\s(?:and|but|or|which|while|whereas|because|i|oraz|ale|lub|który|która|które|ponieważ|en|maar|of|die|dat)\s/g, /\s/g]) {
    let m;
    while ((m = re.exec(s))) {
      const at = m.index + (m[0][0] === ' ' ? 0 : 1);
      if (at < MIN_PIECE || s.length - at < MIN_PIECE) continue;
      if (best < 0 || Math.abs(at - mid) < Math.abs(best - mid)) best = at;
    }
    if (best >= 0) break;
  }
  if (best < 0) return [s];
  return [...cutLong(s.slice(0, best).trim()), ...cutLong(s.slice(best).trim())];
}

const YEAR = '(?:1[6-9]|20)\\d{2}[a-z]?';
const NUMERIC_CITATION_RE = /\s?\[\s*\d+(?:\s*[-–,]\s*\d+)*\s*\]/g;
const YEAR_ONLY_RE = new RegExp(`\\s?\\(\\s*(?:${YEAR}|in press|forthcoming)(?:\\s*[,;]\\s*(?:${YEAR}))*(?:,\\s*pp?\\.\\s*\\d+(?:[-–]\\d+)?)?\\s*\\)`, 'g');
const AUTHOR_YEAR_RE = new RegExp(`\\s?\\((?=[^()]*\\p{Lu}[\\p{L}'’-]+)(?=[^()]*\\b${YEAR}\\b)[^()]{1,250}\\)`, 'gu');
const BRACKET_AUTHOR_RE = new RegExp(`\\s?\\[(?=[^\\]]*\\p{Lu}[\\p{L}'’-]+)(?=[^\\]]*\\b${YEAR}\\b)[^\\]]{1,250}\\]`, 'gu');

/** A sentence as it should be spoken. */
export function spoken(text, lang = 'en', options = {}) {
  const o = { ...DEFAULT_OPTIONS, ...options };
  let t = ` ${text} `;
  if (!o.readCitations) {
    t = t.replace(NUMERIC_CITATION_RE, '').replace(AUTHOR_YEAR_RE, '').replace(BRACKET_AUTHOR_RE, '').replace(YEAR_ONLY_RE, '');
  }
  t = t
    .replace(/\b(?:https?:\/\/|www\.)[^\s)\]]+/g, (url) => {
      // A web address is read as its site: "github.com".
      const trail = url.match(/[.,;:]+$/)?.[0] ?? '';
      return url.replace(/^(?:https?:\/\/)?(?:www\.)?/, '').split('/')[0].replace(/[.,;:]+$/, '') + trail;
    })
    .replace(/\b(?:doi:\s*|https?:\/\/doi\.org\/)?10\.\d{4,9}\/\S+/gi, '')
    .replace(/\S+@\S+\.\w+/g, '')
    .replace(/[∗*†‡§¶•▪◦]/g, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, '');
  for (const [re, to] of EXPANSION_RES[lang] || EXPANSION_RES.en) t = t.replace(re, to);
  t = t
    .replace(/\s+([,.;:!?)\]])/g, '$1')
    .replace(/([(\[])\s+/g, '$1')
    .replace(/,\s*([.;:])/g, '$1')
    .replace(/(?<!\.)\.\.(?!\.)/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
  return /\p{L}|\d/u.test(t) ? t : '';
}

/** For each block, the index of the innermost section it is in (-1 before the first). */
export function sectionOfBlocks(doc) {
  const out = new Array(doc.blocks.length).fill(-1);
  let k = -1;
  for (let b = 0; b < doc.blocks.length; b++) {
    while (k + 1 < doc.sections.length && doc.sections[k + 1].b <= b) k++;
    out[b] = k;
  }
  return out;
}

/** The block where section k ends (exclusive): the next section at the same or a higher level. */
export function sectionEnd(doc, k) {
  const s = doc.sections[k];
  const next = doc.sections.slice(k + 1).find((x) => x.l <= s.l);
  return next ? next.b : doc.blocks.length;
}

const READ_ALWAYS = new Set(['title', 'heading', 'text']);

export function readable(block, options = {}) {
  const o = { ...DEFAULT_OPTIONS, ...options };
  return READ_ALWAYS.has(block.k) || (block.k === 'caption' && o.readCaptions) || (block.k === 'note' && o.readNotes);
}

/** The pieces of a block as displayed: headings whole, other blocks by sentence. */
export function pieces(block) {
  return block.k === 'heading' || block.k === 'title' ? [block.t] : sentences(block.t);
}

/**
 * Everything to read, in order: [{ b: block, i: piece in block, text, sec, skip? }].
 * `skip` marks pieces in the reference list and in lists of contents, which
 * reading on from an earlier section passes over.
 */
export function plan(doc, options = {}) {
  const o = { ...DEFAULT_OPTIONS, ...options };
  const secOf = sectionOfBlocks(doc);
  // A list section's subsections are skipped with it.
  const skipBlock = new Array(doc.blocks.length).fill(false);
  doc.sections.forEach((s, k) => {
    if (s.k === 'list' || (s.k === 'refs' && !o.readReferences)) skipBlock.fill(true, s.b, sectionEnd(doc, k));
  });
  const units = [];
  doc.blocks.forEach((block, b) => {
    if (!readable(block, o)) return;
    pieces(block).forEach((piece, i) => {
      let text = spoken(piece, doc.lang, o);
      if (!text) return;
      if (block.k === 'heading' || block.k === 'title') text = /[.!?:]$/.test(text) ? text : `${text}.`;
      const unit = { b, i, text, sec: secOf[b] };
      if (skipBlock[b]) unit.skip = 1;
      units.push(unit);
    });
  });
  return units;
}
