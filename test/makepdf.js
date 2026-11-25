// Writes small PDFs for the tests: text lines in Times (regular or bold) at
// given positions, and an optional outline. ASCII text only.

const esc = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);

/**
 * @param {{ pages: { lines: { text: string, x?: number, y: number, size?: number, bold?: boolean }[] }[],
 *           outline?: { title: string, page: number, y: number }[], title?: string }} spec
 * @returns {Uint8Array}
 */
export function makePdf({ pages, outline = [], title = '' }) {
  const objects = []; // index i holds object i + 1
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const catalog = add(null);
  const pagesObj = add(null);
  const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>');
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds = [];
  for (const page of pages) {
    const ops = page.lines
      .map((l) => `BT /${l.bold ? 'F2' : 'F1'} ${l.size ?? 10} Tf 1 0 0 1 ${l.x ?? 72} ${l.y} Tm (${esc(l.text)}) Tj ET`)
      .join('\n');
    const content = add(`<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`);
    pageIds.push(
      add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`),
    );
  }
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let outlines = '';
  if (outline.length) {
    const root = add(null);
    const ids = outline.map(() => add(null));
    outline.forEach((o, i) => {
      const links = [i > 0 ? `/Prev ${ids[i - 1]} 0 R` : '', i < ids.length - 1 ? `/Next ${ids[i + 1]} 0 R` : ''].join(' ');
      objects[ids[i] - 1] = `<< /Title (${esc(o.title)}) /Parent ${root} 0 R ${links} /Dest [${pageIds[o.page - 1]} 0 R /XYZ 72 ${o.y} 0] >>`;
    });
    objects[root - 1] = `<< /Type /Outlines /First ${ids[0]} 0 R /Last ${ids[ids.length - 1]} 0 R /Count ${ids.length} >>`;
    outlines = ` /Outlines ${root} 0 R`;
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R${outlines} >>`;
  const info = title ? add(`<< /Title (${esc(title)}) >>`) : 0;

  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R${info ? ` /Info ${info} 0 R` : ''} >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

const WORDS = (
  'reading listening papers voices chapters sections results methods students theses speech readers authors pages ' +
  'sentences words texts studies models ideas questions answers data tables figures notes'
).split(' ');

let seed = 0;

/** A line of ordinary body text, different every time (identical lines on many pages are taken for watermarks). */
export function filler() {
  seed++;
  const pick = (k) => WORDS[(seed * 7 + k * 13) % WORDS.length];
  return `This line about ${pick(1)} and ${pick(2)} is ordinary body text, long enough to look like a line of ${pick(3)} in a paper`;
}

/** Body lines from y downwards, 12 points apart, ending a paragraph. */
export function bodyLines(y, n) {
  return Array.from({ length: n }, (_, i) => ({ text: i === n - 1 ? `${filler().slice(0, 40)}.` : filler(), y: y - i * 12 }));
}
