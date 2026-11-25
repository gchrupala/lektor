import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, sectionEnd, sentences, spoken } from '../js/speech.js';

test('sentences keep abbreviations, initials and numbers whole', () => {
  assert.deepEqual(
    sentences('Smith et al. (2020) showed this in the lab. Fig. 3 shows the same for long texts. J. R. Doe agreed with them all! Then e.g. this one follows, as the 3.5 points say.'),
    [
      'Smith et al. (2020) showed this in the lab.',
      'Fig. 3 shows the same for long texts.',
      'J. R. Doe agreed with them all!',
      'Then e.g. this one follows, as the 3.5 points say.',
    ],
  );
  assert.deepEqual(sentences('Wyniki są np. w tabeli 2. Tak jest m.in. w pracy z 2020 r. Koniec tego zdania.'), [
    'Wyniki są np. w tabeli 2.',
    'Tak jest m.in. w pracy z 2020 r. Koniec tego zdania.',
  ]);
});

test('short pieces join a neighbour, long ones are cut at commas', () => {
  assert.deepEqual(sentences('Yes. This is the longer sentence that follows it.'), ['Yes. This is the longer sentence that follows it.']);
  const long = `${'This clause goes on about listening, '.repeat(9)}and it ends here.`;
  const parts = sentences(long);
  assert.ok(parts.length >= 2);
  assert.ok(parts.every((p) => p.length <= 220));
  assert.equal(parts.join(' '), long);
});

test('spoken text drops citations, web addresses and marks, and expands abbreviations', () => {
  assert.equal(spoken('As shown before (Smith et al., 2020; Doe, 2019) and in [3, 5-7], it works.'), 'As shown before and in, it works.');
  assert.equal(spoken('Smith (2020) found that, e.g., Fig. 2 holds.'), 'Smith found that, for example, Figure 2 holds.');
  assert.equal(spoken('Code is at https://github.com/foo/bar.'), 'Code is at github.com.');
  assert.equal(spoken('Speech∗ is fast†.'), 'Speech is fast.');
  assert.equal(spoken('Jest np. tak (Kowalski, 2019).', 'pl'), 'Jest na przykład tak.');
  assert.equal(spoken('Kept (Smith, 2020).', 'en', { readCitations: true }), 'Kept (Smith, 2020).');
  assert.equal(spoken('(Smith, 2020)'), '');
});

const doc = {
  lang: 'en',
  blocks: [
    { k: 'title', t: 'A Paper', p: 1 },
    { k: 'heading', t: '1 Introduction', p: 1, l: 1 },
    { k: 'text', t: 'Listening is useful for long papers. It saves the eyes of the reader.', p: 1 },
    { k: 'caption', t: 'Figure 1: A listener with a paper.', p: 1 },
    { k: 'note', t: '1 A footnote about listening.', p: 1 },
    { k: 'heading', t: '1.1 Details', p: 2, l: 2 },
    { k: 'text', t: 'The details of listening are many.', p: 2 },
    { k: 'heading', t: 'References', p: 3, l: 1 },
    { k: 'text', t: 'Doe, J. (2020). Listening. Journal of Ears.', p: 3 },
    { k: 'heading', t: 'Appendix A', p: 4, l: 1 },
    { k: 'text', t: 'More about listening comes in the appendix.', p: 4 },
  ],
  sections: [
    { t: '1 Introduction', l: 1, b: 1, p: 1, n: '1' },
    { t: '1.1 Details', l: 2, b: 5, p: 2, n: '1.1' },
    { t: 'References', l: 1, b: 7, p: 3, k: 'refs' },
    { t: 'Appendix A', l: 1, b: 9, p: 4, n: 'A' },
  ],
};

test('the plan reads text and headings, skips captions and notes, marks the references', () => {
  const units = plan(doc);
  assert.deepEqual(
    units.map((u) => [u.b, u.text, u.sec, u.skip ?? 0]),
    [
      [0, 'A Paper.', -1, 0],
      [1, '1 Introduction.', 0, 0],
      [2, 'Listening is useful for long papers.', 0, 0],
      [2, 'It saves the eyes of the reader.', 0, 0],
      [5, '1.1 Details.', 1, 0],
      [6, 'The details of listening are many.', 1, 0],
      [7, 'References.', 2, 1],
      [8, 'Doe, J. Listening. Journal of Ears.', 2, 1],
      [9, 'Appendix A.', 3, 0],
      [10, 'More about listening comes in the appendix.', 3, 0],
    ],
  );
  const all = plan(doc, { readCaptions: true, readNotes: true, readReferences: true });
  assert.ok(all.some((u) => u.text.startsWith('Figure 1')));
  assert.ok(all.some((u) => u.text.startsWith('1 A footnote')));
  assert.ok(!all.some((u) => u.skip));
});

test('a section ends at the next one of the same or a higher level', () => {
  assert.equal(sectionEnd(doc, 0), 7);
  assert.equal(sectionEnd(doc, 1), 7);
  assert.equal(sectionEnd(doc, 3), doc.blocks.length);
});
