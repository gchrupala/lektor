// From PDF bytes to sections, through pdf.js: test/makepdf.js writes the PDFs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodyLines, makePdf } from './makepdf.js';
import { readPdf } from '../js/pdfread.js';
import { buildDocument } from '../js/layout.js';

// pdf.js looks for a canvas package to render with when these are missing.
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const head = (text) => ({ text: 'A Study of Reading Aloud', y: 815, size: 8 });
const folio = (n) => ({ text: String(n), x: 295, y: 40 });

function paper() {
  return makePdf({
    title: 'A Study of Reading Aloud',
    pages: [
      {
        lines: [
          { text: 'A Study of Reading Aloud', y: 780, size: 18, bold: true, x: 180 },
          { text: 'Jane Doe, University of Somewhere', y: 755, x: 200 },
          { text: 'Abstract', y: 720, size: 12, bold: true },
          ...bodyLines(700, 5),
          { text: '1 Introduction', y: 620, size: 12, bold: true },
          ...bodyLines(600, 3),
          { text: 'Listening to a paper helps the under-', y: 564 },
          { text: 'standing of the text, and understanding matters.', y: 552 },
          ...bodyLines(530, 4),
          folio(1),
        ],
      },
      {
        lines: [
          head(),
          { text: '2 Methods', y: 760, size: 12, bold: true },
          ...bodyLines(740, 6),
          { text: '2.1 Participants', y: 650, size: 10.5, bold: true },
          ...bodyLines(630, 6),
          { text: 'Figure 1: The participants listened to papers.', y: 540 },
          ...bodyLines(515, 4),
          folio(2),
        ],
      },
      {
        lines: [
          head(),
          { text: '3 Results', y: 760, size: 12, bold: true },
          ...bodyLines(740, 6),
          { text: 'References', y: 650, size: 12, bold: true },
          { text: 'Doe, J. (2020). Reading aloud in the lab. Journal of Listening, 1, 1-10.', y: 630 },
          { text: 'Roe, R. (2021). Voices and papers. Journal of Listening, 2, 11-20.', y: 615 },
          folio(3),
        ],
      },
    ],
  });
}

test('a paper without an outline: headings, levels, title, page furniture', async () => {
  const doc = buildDocument(await readPdf(paper()));
  assert.equal(doc.title, 'A Study of Reading Aloud');
  assert.equal(doc.lang, 'en');
  assert.equal(doc.outline, false);
  assert.deepEqual(
    doc.sections.map((s) => [s.t, s.l, s.p, s.n ?? null, s.k ?? null]),
    [
      ['Abstract', 1, 1, null, null],
      ['1 Introduction', 1, 1, '1', null],
      ['2 Methods', 1, 2, '2', null],
      ['2.1 Participants', 2, 2, '2.1', null],
      ['3 Results', 1, 3, '3', null],
      ['References', 1, 3, null, 'refs'],
    ],
  );
  const texts = doc.blocks.map((b) => b.t);
  // Running heads and page numbers are gone; the title is read once.
  assert.equal(texts.filter((t) => t === 'A Study of Reading Aloud').length, 1);
  assert.ok(!texts.some((t) => /^\d$/.test(t)));
  // Line-break hyphens are joined; the author line is front matter.
  assert.ok(texts.some((t) => t.includes('helps the understanding of the text')));
  assert.equal(doc.blocks.find((b) => b.t.startsWith('Jane Doe')).k, 'front');
  assert.equal(doc.blocks.find((b) => b.t.startsWith('Figure 1')).k, 'caption');
});

test('a thesis with an outline: chapters from bookmarks, deeper numbered headings added', async () => {
  const pdf = makePdf({
    outline: [
      { title: 'Introduction', page: 2, y: 790 },
      { title: 'Background', page: 3, y: 790 },
    ],
    pages: [
      { lines: [{ text: 'Listening to Theses', y: 600, size: 24, bold: true, x: 150 }, { text: 'A thesis by Jan Kowalski', y: 560, x: 200 }] },
      {
        lines: [
          { text: 'Chapter 1', y: 760, size: 16, bold: true },
          { text: 'Introduction', y: 730, size: 20, bold: true },
          ...bodyLines(700, 6),
          { text: '1.1 Aims of the Work', y: 610, size: 12, bold: true },
          ...bodyLines(590, 6),
        ],
      },
      {
        lines: [
          { text: 'Chapter 2', y: 760, size: 16, bold: true },
          { text: 'Background', y: 730, size: 20, bold: true },
          ...bodyLines(700, 8),
        ],
      },
    ],
  });
  const doc = buildDocument(await readPdf(pdf));
  assert.equal(doc.outline, true);
  assert.equal(doc.title, 'Listening to Theses');
  assert.deepEqual(
    doc.sections.map((s) => [s.t, s.l, s.p, s.n ?? null]),
    [
      ['Chapter 1. Introduction', 1, 2, '1'],
      ['1.1 Aims of the Work', 2, 2, '1.1'],
      ['Chapter 2. Background', 1, 3, '2'],
    ],
  );
});

test('a PDF without text is refused', async () => {
  const pdf = makePdf({ pages: [{ lines: [] }] });
  await assert.rejects(readPdf(pdf), { name: 'NoTextError' });
});
