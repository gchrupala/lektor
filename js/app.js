// User interface: the library of PDFs, the reading view with its contents
// and player, the request box ("rozdział 3", "metody") and settings.

import { readPdf, NoTextError } from './pdfread.js';
import { buildDocument, PARSER_VERSION } from './layout.js';
import { DEFAULT_OPTIONS, pieces, plan, readable, sectionEnd } from './speech.js';
import { interpret, pdfUrl } from './navigate.js';
import { Player, pickVoice } from './player.js';
import * as L from './library.js';

const ICON = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5Z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke-width="3.2"/></svg>',
  prevSec: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M18 6l-8 6 8 6Z"/></svg>',
  nextSec: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14M6 6l8 6-8 6Z"/></svg>',
  back10: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/></svg>',
  fwd10: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg>',
};

const KIND_LABEL = {
  caption: 'podpis',
  note: 'przypis',
  table: 'tabela',
  math: 'wzór',
  toc: 'spis',
  front: 'nagłówek strony tytułowej',
};
const LANG_NAMES = { en: 'angielski', pl: 'polski', nl: 'niderlandzki', de: 'niemiecki', fr: 'francuski', es: 'hiszpański', it: 'włoski' };
const RATES = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2];

// ---------- preferences (this device only) ----------

const PREFS_KEY = 'lektor:prefs';
const prefs = {
  ...DEFAULT_OPTIONS,
  rate: 1,
  voices: {}, // language -> voiceURI
  stopAtEnd: true, // a chosen section is read to its end, then reading stops
  keepAwake: true,
  askLang: '', // language of spoken requests; '' = the browser's
  ...readJson(PREFS_KEY),
};

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? {};
  } catch {
    return {};
  }
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Settings then last until the page closes.
  }
}

// ---------- state ----------

const ui = {
  view: 'library', // 'library' | 'reader'
  docs: [],
  busy: '', // progress of an import
  error: '',
  record: null, // the open document (library record with model)
  units: [],
  unitAt: new Map(), // "block:piece" -> unit index
  firstUnitOfBlock: [], // block -> first unit at or after it
  answer: '',
  suggestions: [],
  listening: false,
  confirmDelete: null,
  followUntil: 0, // no automatic scrolling before this time (the user scrolled)
};

const app = document.getElementById('app');
const bar = document.getElementById('player');
const sheet = document.getElementById('sheet');
const tocSheet = document.getElementById('toc-sheet');
const synth = window.speechSynthesis;
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const player = new Player({
  synth: synth ?? { speak() {}, cancel() {}, speaking: false, pending: false },
  makeUtterance: (text) => new SpeechSynthesisUtterance(text),
  onChange: () => onPlayerChange(),
  onError: (error) => {
    if (error === 'not-allowed') setAnswer('Przeglądarka zatrzymała czytanie. Naciśnij ▶, żeby czytać dalej.');
    else if (error === 'synthesis-unavailable' || error === 'voice-unavailable') setAnswer('Głos jest niedostępny. Wybierz inny w ustawieniach.');
  },
});
player.setRate(prefs.rate);

// ---------- library ----------

async function refreshLibrary() {
  try {
    ui.docs = await L.listDocs();
  } catch {
    ui.docs = [];
    ui.error = 'Ta przeglądarka nie pozwala zapisywać plików (tryb prywatny?). PDF da się otworzyć, ale nie zostanie zapamiętany.';
  }
}

const isPdf = (bytes) => bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF

async function parse(bytes) {
  const raw = await readPdf(bytes.slice(), {
    onProgress: (n, total) => {
      if (n === 1 || n % 5 === 0 || n === total) showBusy(`Czytam PDF: strona ${n} z ${total}…`);
    },
  });
  showBusy('Szukam rozdziałów…');
  await new Promise((r) => setTimeout(r, 0));
  return buildDocument(raw);
}

async function importBlob(blob, name = 'dokument.pdf') {
  ui.error = '';
  showBusy('Otwieram plik…');
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (!isPdf(bytes)) throw new Error('not-pdf');
    const id = await L.fileId(bytes);
    const existing = await L.getDoc(id).catch(() => null);
    if (existing?.model?.v === PARSER_VERSION) {
      ui.busy = '';
      return openDoc(existing);
    }
    const model = await parse(bytes);
    const record = {
      id,
      name,
      title: model.title || name.replace(/\.pdf$/i, ''),
      author: model.author,
      lang: model.lang,
      pages: model.pages,
      size: bytes.length,
      addedAt: Date.now(),
      model,
    };
    try {
      await L.putFile(id, blob);
      await L.putDoc(record);
      L.persist();
    } catch {
      ui.error = 'Nie udało się zapisać PDF-u w pamięci przeglądarki; zniknie po zamknięciu strony.';
    }
    ui.busy = '';
    openDoc(record);
  } catch (err) {
    ui.busy = '';
    ui.error = importError(err);
    render();
  }
}

function importError(err) {
  if (err instanceof NoTextError) return 'Ten PDF nie ma warstwy tekstowej (to skan). Lektor nie rozpoznaje tekstu na obrazach.';
  if (err?.name === 'PasswordException') return 'Ten PDF jest chroniony hasłem.';
  if (err?.message === 'not-pdf' || err?.name === 'InvalidPDFException') return 'To nie jest plik PDF albo jest uszkodzony.';
  return `Nie udało się odczytać PDF-u (${err?.message || err}).`;
}

async function importUrl(input) {
  const url = pdfUrl(input);
  if (!url) {
    ui.error = 'Wklej adres PDF-u (https://…) albo numer arXiv, np. 1706.03762.';
    return render();
  }
  ui.error = '';
  showBusy('Pobieram PDF…');
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const name = decodeURIComponent(new URL(res.url || url).pathname.split('/').pop() || 'dokument') || 'dokument';
    await importBlob(blob, /\.pdf$/i.test(name) ? name : `${name}.pdf`);
  } catch (err) {
    ui.busy = '';
    ui.error =
      err instanceof TypeError
        ? 'Ten serwer nie pozwala pobierać plików z innych stron. Pobierz PDF i otwórz go przyciskiem „Otwórz PDF”.'
        : `Nie udało się pobrać PDF-u (${err.message}).`;
    render();
  }
}

function showBusy(text) {
  ui.busy = text;
  const el = document.getElementById('busy');
  if (el) el.textContent = text;
  else render();
}

async function removeDoc(id) {
  ui.confirmDelete = null;
  await L.removeDoc(id).catch(() => {});
  await refreshLibrary();
  render();
}

// ---------- the open document ----------

async function openDoc(record) {
  if (record.model?.v !== PARSER_VERSION) {
    // Made by an older parser: parse the stored PDF again.
    const blob = await L.getFile(record.id).catch(() => null);
    if (blob) {
      try {
        record.model = await parse(new Uint8Array(await blob.arrayBuffer()));
        record.title = record.model.title || record.title;
        await L.putDoc(record).catch(() => {});
      } catch (err) {
        ui.busy = '';
        ui.error = importError(err);
        return render();
      }
    }
    ui.busy = '';
  }
  ui.record = record;
  ui.view = 'reader';
  ui.answer = '';
  ui.suggestions = [];
  const state = await L.getState(record.id).catch(() => null);
  buildUnits(state?.pos);
  applyVoice();
  history.pushState({ view: 'reader' }, '');
  render();
  scrollToCurrent(true);
  if (!record.model.sections.length) setAnswer('Nie znalazłem rozdziałów w tym PDF-ie; da się czytać od początku albo od wybranego miejsca.');
}

/** Plans what to read; puts the player at `pos` ({ b, i }) or the start. */
function buildUnits(pos) {
  const doc = ui.record.model;
  ui.units = plan(doc, prefs);
  ui.unitAt = new Map(ui.units.map((u, k) => [`${u.b}:${u.i}`, k]));
  ui.firstUnitOfBlock = new Array(doc.blocks.length + 1).fill(ui.units.length);
  for (let b = doc.blocks.length - 1, k = ui.units.length - 1; b >= 0; b--) {
    while (k >= 0 && ui.units[k].b >= b) k--;
    ui.firstUnitOfBlock[b] = k + 1;
  }
  let index = 0;
  if (pos) index = ui.unitAt.get(`${pos.b}:${pos.i}`) ?? ui.firstUnitOfBlock[pos.b] ?? 0;
  player.load(ui.units, Math.min(index, Math.max(0, ui.units.length - 1)));
}

function currentUnit() {
  return ui.units[player.index];
}

function currentSection() {
  return currentUnit()?.sec ?? -1;
}

/** Reads section k: to its end, or on when "stop at end" is off. */
function playSection(k, announce = true) {
  const doc = ui.record.model;
  const s = doc.sections[k];
  const start = ui.firstUnitOfBlock[s.b];
  const stop = ui.firstUnitOfBlock[sectionEnd(doc, k)];
  if (start >= stop) {
    setAnswer(`„${s.t}” nie ma tekstu do czytania (same tabele, wzory albo przypisy).`);
    return;
  }
  ui.followUntil = 0;
  player.play(start, { end: prefs.stopAtEnd ? stop : null });
  if (announce) setAnswer(`Czytam: ${s.t}${prefs.stopAtEnd ? '' : ' i dalej'}`);
  scrollToCurrent(true);
}

function playPage(page) {
  const doc = ui.record.model;
  const b = doc.blocks.findIndex((x) => x.p >= page);
  const start = b < 0 ? ui.units.length : ui.firstUnitOfBlock[b];
  if (start >= ui.units.length) return setAnswer(`Na stronie ${page} i dalej nie ma tekstu do czytania.`);
  ui.followUntil = 0;
  player.play(start);
  setAnswer(`Czytam od strony ${pageLabel(page)}.`);
  scrollToCurrent(true);
}

const pageLabel = (p) => ui.record?.model.labels?.[p - 1] ?? String(p);

function nextSection(delta) {
  const doc = ui.record.model;
  if (!doc.sections.length) return player.step(delta * 10);
  const k = currentSection();
  if (delta < 0 && k >= 0 && player.index - ui.firstUnitOfBlock[doc.sections[k].b] > 2) return goSection(k);
  // The next (or previous) section that has something to read.
  for (let j = k + delta; j >= 0 && j < doc.sections.length; j += delta) {
    if (ui.firstUnitOfBlock[doc.sections[j].b] < ui.firstUnitOfBlock[sectionEnd(doc, j)]) return goSection(j);
  }
  if (delta < 0) {
    ui.followUntil = 0;
    player.seek(0);
  }
}

function goSection(k) {
  // Keep the mode: while reading a chosen section, the next one is read the same way.
  if (player.state === 'playing' && player.end != null) return playSection(k, false);
  ui.followUntil = 0;
  player.seek(ui.firstUnitOfBlock[ui.record.model.sections[k].b]);
  scrollToCurrent(true);
}

function ask(text) {
  const q = text.trim();
  if (!q || !ui.record) return;
  const doc = ui.record.model;
  const r = interpret(q, doc);
  ui.suggestions = [];
  if (r.type === 'command') {
    if (r.command === 'next') nextSection(1);
    else if (r.command === 'prev') nextSection(-1);
    else if (r.command === 'pause') player.pause();
    else if (r.command === 'resume') player.resume();
    else if (r.command === 'start') player.play(0);
    else if (r.command === 'repeat') player.play(player.index, { end: player.end });
    setAnswer('');
  } else if (r.type === 'section') {
    playSection(r.index);
  } else if (r.type === 'page') {
    playPage(r.page);
  } else {
    ui.suggestions = r.suggestions;
    setAnswer(r.suggestions.length ? `Nie znalazłem „${q}”. Może chodzi o:` : `Nie znalazłem „${q}”. Wybierz rozdział ze spisu.`);
    renderAsk();
    if (!r.suggestions.length && doc.sections.length) openToc();
  }
}

function setAnswer(text) {
  ui.answer = text;
  if (!text) ui.suggestions = [];
  renderAsk();
}

// ---------- voices ----------

let voices = [];

function loadVoices() {
  voices = synth?.getVoices?.() ?? [];
  applyVoice();
  if (sheet.open) renderSettings();
}

function docLang() {
  return ui.record?.model.lang || 'en';
}

function applyVoice() {
  const lang = docLang();
  const voice = pickVoice(voices, lang, prefs.voices[lang]);
  player.setVoice(voice, lang);
}

if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
}

// ---------- spoken requests ----------

let recognition = null;

function listen() {
  if (!Recognition || ui.listening) {
    recognition?.stop();
    return;
  }
  player.pause();
  recognition = new Recognition();
  recognition.lang = prefs.askLang || navigator.language || 'pl-PL';
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;
  const input = document.getElementById('ask-input');
  recognition.onresult = (e) => {
    const result = e.results[e.results.length - 1];
    if (input) input.value = result[0].transcript;
    if (!result.isFinal) return;
    // The first alternative that names something in the document.
    const alts = [...result].map((a) => a.transcript);
    const hit = alts.find((a) => interpret(a, ui.record.model).type !== 'none') ?? alts[0];
    if (input) input.value = hit;
    ask(hit);
  };
  recognition.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setAnswer('Brak dostępu do mikrofonu.');
    else if (e.error === 'no-speech') setAnswer('Nic nie usłyszałem.');
  };
  recognition.onend = () => {
    ui.listening = false;
    renderAsk();
  };
  ui.listening = true;
  renderAsk();
  try {
    recognition.start();
  } catch {
    ui.listening = false;
  }
}

// ---------- player side effects: highlight, media keys, wake lock, position ----------

let saveTimer = 0;
let lastHighlighted = null;
let wakeLock = null;

function onPlayerChange() {
  if (ui.view !== 'reader') return;
  renderPlayer();
  highlight();
  updateMediaSession();
  keepAwake(player.state === 'playing' && prefs.keepAwake);
  clearTimeout(saveTimer);
  const unit = currentUnit();
  if (unit && ui.record) {
    const id = ui.record.id;
    saveTimer = setTimeout(() => L.savePosition(id, { b: unit.b, i: unit.i }).catch(() => {}), 1500);
  }
}

function highlight() {
  const unit = currentUnit();
  lastHighlighted?.classList.remove('now');
  lastHighlighted = null;
  if (!unit) return;
  const el = document.querySelector(`[data-u="${player.index}"]`);
  if (!el) return;
  el.classList.add('now');
  lastHighlighted = el;
  if (player.state === 'playing' && Date.now() > ui.followUntil) scrollToCurrent(false);
}

function scrollToCurrent(force) {
  const el = document.querySelector(`[data-u="${player.index}"]`);
  if (!el) return;
  const r = el.getBoundingClientRect();
  const bottom = window.innerHeight - (bar.offsetHeight || 0) - 16;
  if (force || r.top < 72 || r.bottom > bottom) {
    programmaticScroll = Date.now();
    el.scrollIntoView({ block: 'center', behavior: force ? 'auto' : 'smooth' });
  }
}

let programmaticScroll = 0;
addEventListener(
  'scroll',
  () => {
    // The listener scrolled away: do not pull the page back for a while.
    if (Date.now() - programmaticScroll > 800 && player.state === 'playing') ui.followUntil = Date.now() + 10000;
  },
  { passive: true },
);

function updateMediaSession() {
  const ms = navigator.mediaSession;
  if (!ms || !ui.record) return;
  const doc = ui.record.model;
  const sec = doc.sections[currentSection()];
  try {
    ms.metadata = new MediaMetadata({ title: sec?.t || ui.record.title, artist: ui.record.title, album: 'Lektor' });
    ms.playbackState = player.state === 'playing' ? 'playing' : 'paused';
  } catch {
    // Not supported here.
  }
}

if (navigator.mediaSession) {
  const handlers = {
    play: () => player.resume(),
    pause: () => player.pause(),
    stop: () => player.pause(),
    nexttrack: () => nextSection(1),
    previoustrack: () => nextSection(-1),
    seekforward: () => player.step(3),
    seekbackward: () => player.step(-3),
  };
  for (const [action, fn] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, fn);
    } catch {
      // Unsupported action.
    }
  }
}

async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') keepAwake(player.state === 'playing' && prefs.keepAwake);
});

// ---------- rendering ----------

function render() {
  if (ui.view === 'reader' && ui.record) renderReader();
  else renderLibrary();
}

function renderLibrary() {
  bar.hidden = true;
  document.title = 'Lektor';
  const docs = ui.docs
    .map((d) => {
      const meta = [
        d.author ? esc(d.author.length > 60 ? `${d.author.slice(0, 57)}…` : d.author) : '',
        `${d.pages} str.`,
        d.progress > 0.01 ? `przeczytane ${Math.round(d.progress * 100)}%` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const confirm = ui.confirmDelete === d.id;
      return `<li class="doc">
        <button class="doc-open" data-open="${esc(d.id)}">
          <span class="doc-title">${esc(d.title)}</span>
          <span class="doc-meta">${meta}</span>
          ${d.progress > 0.01 ? `<span class="progress"><span style="width:${Math.round(d.progress * 100)}%"></span></span>` : ''}
        </button>
        ${
          confirm
            ? `<span class="confirm"><button class="btn small danger" data-delete="${esc(d.id)}">Usuń</button><button class="btn small" data-cancel>Anuluj</button></span>`
            : `<button class="icon-btn small" data-ask-delete="${esc(d.id)}" aria-label="Usuń „${esc(d.title)}”">${ICON.trash}</button>`
        }
      </li>`;
    })
    .join('');
  app.innerHTML = `
    <header class="bar">
      <h1>Lektor</h1>
      <div class="bar-actions"><button class="icon-btn" data-settings aria-label="Ustawienia">${ICON.gear}</button></div>
    </header>
    <section class="open-box" id="drop">
      <p class="lead">Czyta na głos artykuły, prace dyplomowe i inne PDF-y: całe albo wybrany rozdział.</p>
      <label class="btn primary big">${ICON.file}<span>Otwórz PDF</span><input type="file" id="file" accept="application/pdf,.pdf" hidden></label>
      <form class="url-form" id="url-form">
        <input type="text" id="url" inputmode="url" autocomplete="off" placeholder="albo adres PDF-u lub numer arXiv" aria-label="Adres PDF-u lub numer arXiv">
        <button class="btn" type="submit">Pobierz</button>
      </form>
      ${ui.busy ? `<p class="busy" id="busy" role="status">${esc(ui.busy)}</p>` : ''}
      ${ui.error ? `<p class="error" role="alert">${esc(ui.error)}</p>` : ''}
      ${synth ? '' : '<p class="error">Ta przeglądarka nie ma syntezy mowy, więc Lektor nie przeczyta tekstu na głos.</p>'}
    </section>
    ${docs ? `<h2 class="list-head">Ostatnio czytane</h2><ul class="docs">${docs}</ul>` : '<p class="empty">PDF-y, które otworzysz, zostają na tym urządzeniu.</p>'}
  `;
}

function sectionTitle(k) {
  return ui.record.model.sections[k]?.t ?? '';
}

function renderReader() {
  const record = ui.record;
  document.title = `${record.title} – Lektor`;
  app.innerHTML = `
    <header class="bar reader-bar">
      <button class="icon-btn" data-home aria-label="Biblioteka">${ICON.back}</button>
      <div class="doc-head"><h1 title="${esc(record.title)}">${esc(record.title)}</h1>
        <span class="doc-meta">${record.model.pages} str. · ${esc(LANG_NAMES[record.model.lang] || record.model.lang || 'język nieznany')} · ${record.model.sections.length} rozdz.</span></div>
      <div class="bar-actions">
        <button class="icon-btn" data-toc aria-label="Spis treści">${ICON.list}</button>
        <button class="icon-btn" data-settings aria-label="Ustawienia">${ICON.gear}</button>
      </div>
    </header>
    <article class="text" id="text">${renderText()}</article>
  `;
  bar.innerHTML = '<div class="player-inner"><div id="bar-ask"></div><div id="bar-play"></div></div>';
  bar.hidden = false;
  renderAsk();
  renderPlayer();
  highlight();
}

function renderAsk() {
  const box = document.getElementById('bar-ask');
  if (!box || !ui.record) return;
  const value = document.getElementById('ask-input')?.value ?? '';
  box.innerHTML = `
    ${ui.answer ? `<p class="answer" role="status">${esc(ui.answer)}</p>` : ''}
    ${ui.suggestions.length ? `<div class="chips">${ui.suggestions.map((k) => `<button class="chip" data-section="${k}">${esc(sectionTitle(k))}</button>`).join('')}</div>` : ''}
    <form class="ask" id="ask-form" role="search">
      <input id="ask-input" type="text" autocomplete="off" enterkeyhint="go" value="${esc(value)}"
        placeholder="${Recognition ? 'Powiedz albo wpisz: ' : 'Np. '}„rozdział 2”, „metody”, „3.1”" aria-label="Czego posłuchać? Np. rozdział 2, metody, 3.1, strona 10">
      ${Recognition ? `<button type="button" class="icon-btn${ui.listening ? ' listening' : ''}" data-listen aria-label="${ui.listening ? 'Słucham… (zatrzymaj)' : 'Powiedz, czego posłuchać'}">${ICON.mic}</button>` : ''}
      <button type="submit" class="btn primary">Czytaj</button>
    </form>`;
}

function openToc() {
  const doc = ui.record.model;
  const cur = currentSection();
  const items = doc.sections
    .map(
      (s, k) =>
        `<li class="lvl${Math.min(s.l, 4)}${k === cur ? ' current' : ''}${s.k ? ' muted' : ''}"><button data-section="${k}"><span>${esc(s.t)}</span><span class="pg">${esc(pageLabel(s.p))}</span></button></li>`,
    )
    .join('');
  tocSheet.innerHTML = `
    <div class="toc">
      <div class="sheet-head"><h2>Spis treści</h2>
        <span><button class="btn small" data-from-start>Od początku</button><button class="icon-btn" data-close aria-label="Zamknij">${ICON.close}</button></span></div>
      ${items ? `<ul>${items}</ul>` : '<p class="empty">Ten PDF nie ma rozpoznanych rozdziałów.</p>'}
      <p class="hint">${doc.outline ? 'Rozdziały z zakładek PDF-u.' : 'Rozdziały rozpoznane po wyglądzie nagłówków.'} Dotknij, żeby posłuchać${prefs.stopAtEnd ? ' (do końca rozdziału)' : ''}.</p>
    </div>`;
  tocSheet.showModal();
  tocSheet.querySelector('.current')?.scrollIntoView({ block: 'center' });
}

function renderText() {
  const doc = ui.record.model;
  const out = [];
  doc.blocks.forEach((block, b) => {
    const read = readable(block, prefs);
    if (!read) {
      const label = KIND_LABEL[block.k] || block.k;
      out.push(`<p class="skipped k-${block.k}" data-b="${b}"><span class="tag">${esc(label)}</span>${esc(block.t)}</p>`);
      return;
    }
    const spans = pieces(block)
      .map((piece, i) => {
        const u = ui.unitAt.get(`${b}:${i}`);
        return u == null ? `<span>${esc(piece)}</span> ` : `<span class="piece${ui.units[u].skip ? ' muted' : ''}" data-u="${u}">${esc(piece)}</span> `;
      })
      .join('');
    if (block.k === 'heading') {
      const level = Math.min((block.l || 1) + 1, 5);
      out.push(`<h${level} data-b="${b}">${spans}</h${level}>`);
    } else if (block.k === 'title') out.push(`<p class="doc-title-block" data-b="${b}">${spans}</p>`);
    else out.push(`<p class="k-${block.k}" data-b="${b}">${spans}</p>`);
  });
  return out.join('\n');
}

function renderPlayer() {
  if (ui.view !== 'reader' || !ui.record) return;
  const unit = currentUnit();
  const doc = ui.record.model;
  const sec = unit ? doc.sections[unit.sec] : null;
  const page = unit ? doc.blocks[unit.b]?.p : null;
  const playing = player.state === 'playing';
  const until = player.end != null && playing ? ' · do końca rozdziału' : '';
  const box = document.getElementById('bar-play');
  if (!box) return;
  box.innerHTML = `
      <div class="now-line"><span class="now-title">${esc(sec?.t || ui.record.title)}</span><span class="now-meta">${page ? `str. ${esc(pageLabel(page))}` : ''}${until}</span></div>
      <div class="controls">
        <button class="icon-btn" data-prev-section aria-label="Poprzedni rozdział">${ICON.prevSec}</button>
        <button class="icon-btn" data-step="-1" aria-label="Poprzednie zdanie">${ICON.back10}</button>
        <button class="play" data-toggle aria-label="${playing ? 'Pauza' : 'Czytaj'}">${playing ? ICON.pause : ICON.play}</button>
        <button class="icon-btn" data-step="1" aria-label="Następne zdanie">${ICON.fwd10}</button>
        <button class="icon-btn" data-next-section aria-label="Następny rozdział">${ICON.nextSec}</button>
        <button class="rate" data-rate aria-label="Tempo">${String(prefs.rate).replace('.', ',')}×</button>
      </div>`;
}

function renderSettings() {
  const lang = docLang();
  const chosen = player.voice?.voiceURI || '';
  const mine = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(lang));
  const others = voices.filter((v) => !(v.lang || '').toLowerCase().startsWith(lang));
  const option = (v) => `<option value="${esc(v.voiceURI)}"${v.voiceURI === chosen ? ' selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`;
  const check = (key, label, hint = '') =>
    `<label class="check"><input type="checkbox" data-pref="${key}"${prefs[key] ? ' checked' : ''}><span>${label}${hint ? `<small>${hint}</small>` : ''}</span></label>`;
  sheet.innerHTML = `
    <form method="dialog" class="settings">
      <div class="sheet-head"><h2>Ustawienia</h2><button class="icon-btn" value="close" aria-label="Zamknij">${ICON.close}</button></div>
      <label class="field"><span>Głos${ui.record ? ` (język dokumentu: ${esc(LANG_NAMES[lang] || lang)})` : ''}</span>
        <select id="voice">
          ${voices.length ? '' : '<option value="">Brak głosów w systemie</option>'}
          ${mine.length ? `<optgroup label="${esc(LANG_NAMES[lang] || lang)}">${mine.map(option).join('')}</optgroup>` : ''}
          ${others.length ? `<optgroup label="Inne języki">${others.map(option).join('')}</optgroup>` : ''}
        </select>
      </label>
      <label class="field"><span>Tempo: <b id="rate-value">${String(prefs.rate).replace('.', ',')}×</b></span>
        <input type="range" id="rate" min="0.6" max="2.5" step="0.05" value="${prefs.rate}">
      </label>
      <fieldset>
        <legend>Co czytać</legend>
        ${check('readCaptions', 'Podpisy rysunków i tabel')}
        ${check('readNotes', 'Przypisy')}
        ${check('readCitations', 'Odwołania do literatury', '„(Smith i in., 2020)”, „[12]” — domyślnie pomijane')}
        ${check('readReferences', 'Bibliografię przy czytaniu po kolei', 'wybrana wprost jest czytana zawsze')}
      </fieldset>
      <fieldset>
        <legend>Czytanie</legend>
        ${check('stopAtEnd', 'Wybrany rozdział czytaj do końca i zatrzymaj się')}
        ${check('keepAwake', 'Nie wygaszaj ekranu podczas czytania', 'na telefonach czytanie często staje po wygaszeniu ekranu')}
      </fieldset>
      ${
        Recognition
          ? `<label class="field"><span>Język poleceń głosowych</span>
        <select id="ask-lang">
          ${[['', `jak w przeglądarce (${esc(navigator.language)})`], ['pl-PL', 'polski'], ['en-US', 'angielski'], ['nl-NL', 'niderlandzki']]
            .map(([v, l]) => `<option value="${v}"${prefs.askLang === v ? ' selected' : ''}>${l}</option>`)
            .join('')}
        </select></label>`
          : ''
      }
      <p class="hint">Głosy pochodzą z systemu. Lepsze brzmią naturalniej: na iPhonie Ustawienia → Dostępność → Treść mówiona → Głosy (pobierz wersję „Ulepszony” lub „Premium”); na Androidzie Ustawienia → Zamiana tekstu na mowę; w Chrome na komputerze są głosy „Google”, w Edge „Natural”.</p>
    </form>`;
}

// ---------- events ----------

app.addEventListener('click', (e) => {
  const t = e.target.closest('button, [data-u]');
  if (!t) return;
  if (t.dataset.open) {
    L.getDoc(t.dataset.open).then((r) => r && openDoc(r));
  } else if (t.dataset.askDelete) {
    ui.confirmDelete = t.dataset.askDelete;
    render();
  } else if (t.dataset.delete) {
    removeDoc(t.dataset.delete);
  } else if ('cancel' in t.dataset) {
    ui.confirmDelete = null;
    render();
  } else if ('settings' in t.dataset) {
    renderSettings();
    sheet.showModal();
  } else if ('home' in t.dataset) {
    history.back();
  } else if ('toc' in t.dataset) {
    openToc();
  } else if (t.dataset.u != null) {
    // A tap on a sentence reads from there on.
    ui.followUntil = 0;
    player.play(Number(t.dataset.u));
  }
});

bar.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.section != null) {
    ui.suggestions = [];
    playSection(Number(t.dataset.section));
  } else if ('listen' in t.dataset) listen();
  else if ('toggle' in t.dataset) {
    ui.followUntil = 0;
    if (player.state !== 'playing') scrollToCurrent(false);
    player.toggle();
  } else if (t.dataset.step) player.step(Number(t.dataset.step));
  else if ('prevSection' in t.dataset) nextSection(-1);
  else if ('nextSection' in t.dataset) nextSection(1);
  else if ('rate' in t.dataset) {
    const i = RATES.findIndex((r) => r >= prefs.rate - 0.001);
    setRate(RATES[(i + 1) % RATES.length]);
  }
});

tocSheet.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (e.target === tocSheet) return tocSheet.close(); // a tap outside the sheet
  if (!t) return;
  tocSheet.close();
  if (t.dataset.section != null) {
    ui.suggestions = [];
    playSection(Number(t.dataset.section));
  } else if ('fromStart' in t.dataset) {
    ui.followUntil = 0;
    player.play(0);
    setAnswer('');
    scrollToCurrent(true);
  }
});

function setRate(rate) {
  prefs.rate = Math.round(rate * 100) / 100;
  savePrefs();
  player.setRate(prefs.rate);
  renderPlayer();
}

app.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'url-form') importUrl(document.getElementById('url').value);
});

bar.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('ask-input');
  ask(input.value);
  input.blur();
});

app.addEventListener('change', (e) => {
  if (e.target.id === 'file' && e.target.files[0]) importBlob(e.target.files[0], e.target.files[0].name);
});

sheet.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'voice') {
    prefs.voices[docLang()] = t.value;
    savePrefs();
    applyVoice();
    if (player.state !== 'playing' && ui.record) {
      // Let the new voice say something.
      player.play(player.index, { end: player.index + 1 });
    }
  } else if (t.id === 'ask-lang') {
    prefs.askLang = t.value;
    savePrefs();
  } else if (t.dataset.pref) {
    prefs[t.dataset.pref] = t.checked;
    savePrefs();
    if (ui.record && t.dataset.pref in DEFAULT_OPTIONS) {
      const unit = currentUnit();
      const playing = player.state === 'playing';
      buildUnits(unit ? { b: unit.b, i: unit.i } : null);
      renderReader();
      if (playing) player.resume();
    }
  }
});

sheet.addEventListener('input', (e) => {
  if (e.target.id === 'rate') {
    document.getElementById('rate-value').textContent = `${String(Number(e.target.value)).replace('.', ',')}×`;
  }
});

sheet.addEventListener('change', (e) => {
  if (e.target.id === 'rate') setRate(Number(e.target.value));
});

// Drag and drop a PDF anywhere on the library page.
addEventListener('dragover', (e) => {
  if (ui.view === 'library') e.preventDefault();
});
addEventListener('drop', (e) => {
  if (ui.view !== 'library') return;
  e.preventDefault();
  const file = [...(e.dataTransfer?.files || [])].find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  if (file) importBlob(file, file.name);
});

addEventListener('keydown', (e) => {
  if (ui.view !== 'reader' || e.target.closest?.('input, select, textarea') || sheet.open || tocSheet.open) return;
  if (e.key === ' ' || e.key === 'k') {
    e.preventDefault();
    player.toggle();
  } else if (e.key === 'ArrowRight') player.step(1);
  else if (e.key === 'ArrowLeft') player.step(-1);
  else if (e.key === 'ArrowDown' && e.altKey) nextSection(1);
  else if (e.key === 'ArrowUp' && e.altKey) nextSection(-1);
  else if (e.key === '/') {
    e.preventDefault();
    document.getElementById('ask-input')?.focus();
  }
});

addEventListener('popstate', () => {
  if (ui.view === 'reader') {
    player.stop();
    keepAwake(false);
    ui.view = 'library';
    ui.record = null;
    refreshLibrary().then(render);
  }
});

// ---------- start ----------

async function receiveShared() {
  // A PDF shared from another app (Android), kept by the service worker.
  try {
    const cache = await caches.open('lektor-share');
    const res = await cache.match('shared.pdf');
    if (!res) return false;
    const name = decodeURIComponent(res.headers.get('x-name') || 'dokument.pdf');
    const blob = await res.blob();
    await cache.delete('shared.pdf');
    await importBlob(blob, name);
    return true;
  } catch {
    return false;
  }
}

async function start() {
  await refreshLibrary();
  const params = new URLSearchParams(location.search);
  history.replaceState({ view: 'library' }, '', location.pathname);
  render();
  if (params.has('shared') && (await receiveShared())) return;
  // ?url=... from a link (Doczytania) or text shared from another app.
  const shared = params.get('url') || (params.get('text') || '').match(/https?:\/\/\S+/)?.[0];
  if (shared) importUrl(shared);
  // Files opened with the installed app (desktop).
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(async (params) => {
      const handle = params.files?.[0];
      if (handle) {
        const file = await handle.getFile();
        importBlob(file, file.name);
      }
    });
  }
}

start();

if ('serviceWorker' in navigator && window.isSecureContext) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // A new version took over: reload into it, but not in the middle of reading.
    if (!hadController || reloading || player.state === 'playing') return;
    reloading = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
