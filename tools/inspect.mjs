// Shows what Lektor makes of a PDF: the sections, then every block with its
// kind and page, so a wrong heading or a skipped paragraph is easy to spot.
//
//   node tools/inspect.mjs paper.pdf            sections and blocks
//   node tools/inspect.mjs paper.pdf --sections sections only
//   node tools/inspect.mjs paper.pdf --speech   the sentences as they will be spoken
//   node tools/inspect.mjs paper.pdf --lines 3  the lines of page 3 with their kind and style
//   node tools/inspect.mjs paper.pdf --raw out.json   also save pdfread's raw data

import fs from 'node:fs';
import { buildDocument } from '../js/layout.js';
import { plan } from '../js/speech.js';

// pdf.js wants these for rendering, which we never do; without them it
// prints warnings while looking for a canvas package.
globalThis.DOMMatrix ??= class DOMMatrix {};
globalThis.Path2D ??= class Path2D {};
globalThis.ImageData ??= class ImageData {};

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('usage: node tools/inspect.mjs file.pdf|file.raw.json [--sections] [--speech] [--raw out.json]');
  process.exit(2);
}

let raw;
if (file.endsWith('.json')) raw = JSON.parse(fs.readFileSync(file, 'utf8'));
else {
  const { readPdf } = await import('../js/pdfread.js');
  raw = await readPdf(new Uint8Array(fs.readFileSync(file)));
  const at = flags.indexOf('--raw');
  if (at >= 0) fs.writeFileSync(flags[at + 1], JSON.stringify(raw));
}
const t0 = performance.now();
const doc = buildDocument(raw, { debug: true });
const ms = Math.round(performance.now() - t0);

console.log(`${doc.title} | ${doc.author} | lang ${doc.lang} | ${doc.pages} pages | outline ${doc.outline} | ${doc.blocks.length} blocks | ${ms} ms`);
console.log('\nSections:');
for (const s of doc.sections) console.log(`${'  '.repeat(s.l - 1)}${s.t}  [p${s.p}${s.n ? ` n=${s.n}` : ''}${s.k ? ` ${s.k}` : ''}]`);

const linesAt = flags.indexOf('--lines');
if (linesAt >= 0) {
  const page = Number(flags[linesAt + 1]);
  console.log(`\nLines of page ${page}:`);
  for (const l of doc.lines.filter((x) => x.p === page)) {
    const style = `${l.size}${l.bold ? 'b' : ''}${l.italic ? 'i' : ''}${l.caps ? 'C' : ''}`;
    console.log(`${l.kind.padEnd(9)} y${Math.round(l.y)} x${Math.round(l.x)}-${Math.round(l.x2)} ${style.padEnd(7)} ${l.font.slice(0, 18).padEnd(18)} ${l.t.slice(0, 90)}`);
  }
} else if (flags.includes('--speech')) {
  console.log('\nSpeech:');
  for (const u of plan(doc, {})) console.log(`${u.skip ? '-' : ' '} b${u.b} ${u.text}`);
} else if (!flags.includes('--sections')) {
  console.log('\nBlocks:');
  doc.blocks.forEach((b, i) => {
    const t = b.t.length > 110 ? `${b.t.slice(0, 80)} … ${b.t.slice(-25)}` : b.t;
    console.log(`${String(i).padStart(4)} p${String(b.p).padEnd(3)} ${b.k.padEnd(8)}${b.l ? `h${b.l} ` : ''}${t}`);
  });
}
