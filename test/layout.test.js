// Layout analysis on hand-made text runs (the shape pdfread.js returns).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDocument, detectLang, headingName, headingNumber, stripNumber, unspace } from '../js/layout.js';

const item = (s, x, y, size = 10, font = 'Times-Roman') => ({ s, x, y, w: s.length * size * 0.45, size, font, rot: 0, eol: 0 });
const raw = (pages, extra = {}) => ({
  numPages: pages.length,
  info: { title: '', author: '', lang: '' },
  labels: null,
  outline: [],
  pages: pages.map((items) => ({ box: [0, 0, 595, 842], items })),
  ...extra,
});
let n = 0;
const sentence = () => `Line ${++n} of the body text talks about reading papers aloud to listeners`;
const body = (x, y, count) => Array.from({ length: count }, (_, i) => item(sentence(), x, y - i * 12));

test('heading numbers and names', () => {
  assert.equal(headingNumber('3.2 Data and Methods'), '3.2');
  assert.equal(headingNumber('III. RESULTS'), 'III');
  assert.equal(headingNumber('Chapter 4: Experiments'), '4');
  assert.equal(headingNumber('Rozdział 2. Metody'), '2');
  assert.equal(headingNumber('Appendix B Proofs'), 'B');
  assert.equal(headingNumber('A.1 Details'), 'A.1');
  assert.equal(headingNumber('Introduction'), null);
  assert.equal(headingName('2.1 Participants'), 'participants');
  assert.equal(headingName('Wstęp'), 'wstep');
  assert.equal(stripNumber('Chapter 4: Experiments'), 'Experiments');
});

test('letter-spaced capitals get their word breaks back from the document', () => {
  const vocab = new Map([['computational', 3], ['linguistics', 2], ['terms', 5], ['sql', 4]]);
  vocab.acronyms = new Set(['sql']);
  assert.equal(unspace('2.4 C O M P U TAT I O N A L L I N G U I S T I C S T E R M S 17', vocab), '2.4 Computational Linguistics Terms 17');
  assert.equal(unspace('S Q L T E R M S', vocab), 'SQL Terms');
  assert.equal(unspace('the SQL RE CFG tools', vocab), 'the SQL RE CFG tools'); // acronyms stay
});

test('raised footnote marks leave the text; footnotes and page numbers are set apart', () => {
  const page = [
    item('1 Introduction', 72, 760, 12, 'Times-Bold'),
    item('Reading aloud is old', 72, 740),
    item('1', 72 + 'Reading aloud is old'.length * 4.5, 743, 6),
    item(', and listening to papers is a way to read them on the move or with tired eyes.', 72 + 'Reading aloud is old'.length * 4.5 + 3, 740),
    ...body(72, 728, 8),
    item('1 First told by the ancients, as a footnote says.', 72, 90, 8),
    item('5', 295, 40),
  ];
  const doc = buildDocument(raw([page]));
  const texts = doc.blocks.map((b) => [b.k, b.t]);
  assert.ok(texts.some(([k, t]) => k === 'text' && t.startsWith('Reading aloud is old, and listening')));
  assert.deepEqual(
    texts.find(([, t]) => t.startsWith('1 First')),
    ['note', '1 First told by the ancients, as a footnote says.'],
  );
  assert.ok(!texts.some(([, t]) => t === '5'));
});

test('a paragraph goes on in the next column; line-break hyphens are joined', () => {
  const left = [item('2 Methods', 72, 760, 12, 'Times-Bold'), ...body(72, 740, 5), item('and then the listener came back to the begin-', 72, 680)];
  const right = [item('ning of the paragraph, which is what happened.', 320, 760), ...body(320, 748, 4), item('The end.', 320, 700)];
  const doc = buildDocument(raw([[...left, ...right]]));
  const para = doc.blocks.find((b) => b.t.includes('begin'));
  assert.match(para.t, /back to the beginning of the paragraph, which/);
});

test('captions, tables and contents pages are kinds of their own', () => {
  const page = [
    ...body(72, 760, 4),
    item('Figure 2: Listening time by chapter.', 72, 700),
    item('Model', 72, 660),
    item('23.5', 200, 660),
    item('41.0', 300, 660),
    item('Ours', 72, 648),
    item('24.1', 200, 648),
    item('42.3', 300, 648),
    ...body(72, 620, 4),
  ];
  const doc = buildDocument(raw([page]));
  assert.equal(doc.blocks.find((b) => b.t.startsWith('Figure 2')).k, 'caption');
  assert.equal(doc.blocks.find((b) => b.t.startsWith('Model')).k, 'table');
  const toc = buildDocument(
    raw([
      [item('A Thesis on Listening', 100, 600, 24, 'Times-Bold')],
      [
        item('Contents', 72, 760, 16, 'Times-Bold'),
        item('1 Introduction . . . . . . . . 1', 72, 730),
        item('2 Methods . . . . . . . . . . 7', 72, 718),
        item('3 Results . . . . . . . . . 12', 72, 706),
      ],
      body(72, 760, 10),
    ]),
  );
  assert.ok(toc.blocks.filter((b) => b.k === 'toc').length >= 1);
  assert.ok(!toc.sections.some((s) => s.t.startsWith('1 Introduction')));
});

test('the language of the text', () => {
  assert.equal(detectLang('The model is trained on the data and we show that it works for the task in this paper.'), 'en');
  assert.equal(detectLang('W tej pracy pokazujemy, że model jest dobry i nie jest za duży, a dane są w tabeli do tego.'), 'pl');
  assert.equal(detectLang('In dit proefschrift laten we zien dat het model niet groot is en dat de data van een studie zijn.'), 'nl');
  assert.equal(detectLang('x y z'), '');
});
