import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpret, parseRequest, pdfUrl } from '../js/navigate.js';

const section = (t, l, n) => ({ t, l, b: 0, p: 1, ...(n ? { n } : {}) });

const paper = {
  pages: 12,
  labels: null,
  sections: [
    section('Abstract', 1),
    section('1 Introduction', 1, '1'),
    section('2 Related Work', 1, '2'),
    section('3 Model Architecture', 1, '3'),
    section('3.1 Encoder and Decoder Stacks', 2, '3.1'),
    section('3.2 Attention', 2, '3.2'),
    section('3.2.1 Scaled Dot-Product Attention', 3, '3.2.1'),
    section('4 Experiment Two: Symmetric Functions', 1, '4'),
    section('5 Conclusion', 1, '5'),
    section('References', 1),
    section('Appendix A. Proofs', 1, 'A'),
  ],
};

const thesis = {
  pages: 200,
  labels: Array.from({ length: 200 }, (_, i) => (i < 20 ? ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'][i] : String(i - 19))),
  sections: [
    section('Acknowledgements', 1),
    section('Contents', 1),
    section('Part I. Background', 1, 'I'),
    section('Introduction', 2, '1'),
    section('1.1 Aims', 3, '1.1'),
    section('Related Work', 2, '2'),
    section('Part II. Studies', 1, 'II'),
    section('Listening to Papers', 2, '3'),
    section('Conclusion', 2, '4'),
    section('Colophon', 2),
  ],
};

const ask = (q, doc = paper) => {
  const r = interpret(q, doc);
  return r.type === 'section' ? doc.sections[r.index].t : r.type === 'none' ? r.suggestions.map((i) => doc.sections[i].t) : r;
};

test('chapters by number, ordinal and word, in Polish and English', () => {
  assert.equal(ask('rozdział 3'), '3 Model Architecture');
  assert.equal(ask('Rozdział trzeci.'), '3 Model Architecture');
  assert.equal(ask('przeczytaj mi trzeci rozdział'), '3 Model Architecture');
  assert.equal(ask('chapter three'), '3 Model Architecture');
  assert.equal(ask('the second chapter'), '2 Related Work');
  assert.equal(ask('ostatni rozdział', thesis), 'Conclusion');
  assert.equal(ask('rozdział 1', thesis), 'Introduction');
  assert.equal(ask('część druga', thesis), 'Part II. Studies');
  assert.equal(ask('part 1', thesis), 'Part I. Background');
});

test('sections by number, spoken or typed', () => {
  assert.equal(ask('3.2'), '3.2 Attention');
  assert.equal(ask('3,2'), '3.2 Attention');
  assert.equal(ask('sekcja trzy kropka dwa'), '3.2 Attention');
  assert.equal(ask('section 3.2.1'), '3.2.1 Scaled Dot-Product Attention');
  assert.equal(ask('dodatek A'), 'Appendix A. Proofs');
  assert.equal(ask('appendix a'), 'Appendix A. Proofs');
});

test('sections by name, with synonyms across languages and small mistakes', () => {
  assert.equal(ask('wstęp'), '1 Introduction');
  assert.equal(ask('przeczytaj wnioski'), '5 Conclusion');
  assert.equal(ask('streszczenie'), 'Abstract');
  assert.equal(ask('bibliografia'), 'References');
  assert.equal(ask('powiązane prace'), '2 Related Work');
  assert.equal(ask('attention'), '3.2 Attention');
  assert.equal(ask('scaled dot product'), '3.2.1 Scaled Dot-Product Attention');
  assert.equal(ask('encoders'), '3.1 Encoder and Decoder Stacks');
  assert.equal(ask('experiment two'), '4 Experiment Two: Symmetric Functions');
  assert.equal(ask('listening', thesis), 'Listening to Papers');
});

test('pages by printed number, and commands', () => {
  assert.deepEqual(interpret('strona 12', thesis), { type: 'page', page: 32 });
  assert.deepEqual(interpret('page 5', paper), { type: 'page', page: 5 });
  assert.deepEqual(interpret('strona 99', paper), { type: 'none', suggestions: [] });
  for (const [q, command] of [['dalej', 'next'], ['Następny rozdział', 'next'], ['wstecz', 'prev'], ['pauza', 'pause'], ['stop', 'pause'], ['czytaj dalej', 'resume'], ['od początku', 'start'], ['powtórz', 'repeat']]) {
    assert.deepEqual(interpret(q, paper), { type: 'command', command }, q);
  }
});

test('unknown requests come back with the nearest names', () => {
  assert.deepEqual(ask('xyzzy encoder'), ['3.1 Encoder and Decoder Stacks']);
  assert.deepEqual(ask('kwiatki'), []);
});

test('the parts of a request', () => {
  assert.deepEqual(parseRequest('Przeczytaj mi rozdział trzeci, proszę'), { kind: 'chapter', numbers: [3], letter: null, name: '', full: 'trzeci' });
  assert.deepEqual(parseRequest('second language acquisition').name, 'language acquisition');
});

test('PDF addresses from links and arXiv numbers', () => {
  assert.equal(pdfUrl('1706.03762'), 'https://arxiv.org/pdf/1706.03762');
  assert.equal(pdfUrl('arXiv:2203.03469v1'), 'https://arxiv.org/pdf/2203.03469v1');
  assert.equal(pdfUrl('https://arxiv.org/abs/1706.03762'), 'https://arxiv.org/pdf/1706.03762');
  assert.equal(pdfUrl('https://example.org/a.pdf'), 'https://example.org/a.pdf');
  assert.equal(pdfUrl('nie adres'), null);
});
