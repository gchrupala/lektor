// Reads a PDF with pdf.js into plain data: the text runs of each page with
// their position, size and font name, the outline (bookmarks) with page
// numbers, the page labels and the document information. Works in the
// browser and in Node (tests and tools/inspect.mjs).
//
// The data are raw: deciding what is a heading, a running head or a
// footnote is layout.js's job.

const PDFJS = '../vendor/pdfjs/pdf.min.mjs';
const WORKER = '../vendor/pdfjs/pdf.worker.min.mjs';

let pdfjsReady = null;

function loadPdfjs() {
  pdfjsReady ??= import(PDFJS).then((pdfjs) => {
    // Node's default points at a file next to pdf.min.mjs that we do not ship.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(WORKER, import.meta.url).href;
    return pdfjs;
  });
  return pdfjsReady;
}

export class NoTextError extends Error {
  constructor() {
    super('no text layer');
    this.name = 'NoTextError';
  }
}

// "ABCDEF+CMBX12" -> "CMBX12": the prefix only marks a font subset.
const fontName = (name) => (name || '').replace(/^[A-Z]{6}\+/, '');

const round = (n) => Math.round(n * 100) / 100;

/**
 * @param {Uint8Array} data the PDF file. pdf.js takes the buffer over, so pass a copy you do not need.
 * @param {{ onProgress?: (page: number, pages: number) => void, password?: string }} [options]
 */
export async function readPdf(data, { onProgress, password } = {}) {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data,
    password,
    // Keeps the font names, which tell bold, italic and maths fonts apart.
    fontExtraProperties: true,
    disableFontFace: true,
    isEvalSupported: false,
    stopAtErrors: false,
    verbosity: 0,
  });
  const pdf = await task.promise;
  try {
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const tc = await page.getTextContent();
      const items = tc.items.filter((it) => typeof it.str === 'string');
      let fonts = {};
      if (items.some((it) => it.str.trim())) {
        // Font names are known only once the page's fonts are loaded, which
        // building the operator list does (no rendering happens).
        await page.getOperatorList();
        for (const id of Object.keys(tc.styles)) {
          try {
            fonts[id] = fontName(page.commonObjs.get(id)?.name);
          } catch {
            fonts[id] = '';
          }
        }
      }
      const [x0, y0, x1, y1] = page.view;
      pages.push({
        box: [x0, y0, x1, y1].map(round),
        items: items.map((it) => {
          const [a, b, c, d, e, f] = it.transform;
          return {
            s: it.str,
            x: round(e),
            y: round(f),
            w: round(it.width),
            size: round(Math.hypot(c, d) || Math.abs(it.height)),
            font: fonts[it.fontName] || it.fontName,
            // Turned text: margin stamps (arXiv), sideways tables.
            rot: Math.abs(b) > 0.01 * Math.abs(a) || a < 0 ? 1 : 0,
            eol: it.hasEOL ? 1 : 0,
          };
        }),
      });
      page.cleanup();
      onProgress?.(n, pdf.numPages);
    }
    if (!pages.some((p) => p.items.some((it) => it.s.trim()))) throw new NoTextError();

    const outline = [];
    await flattenOutline(pdf, await pdf.getOutline().catch(() => null), 1, outline);
    const meta = await pdf.getMetadata().catch(() => null);
    const info = meta?.info ?? {};
    const labels = await pdf.getPageLabels().catch(() => null);
    return {
      numPages: pdf.numPages,
      info: {
        title: (info.Title || '').trim(),
        author: (info.Author || '').trim(),
        lang: (info.Language || '').trim(),
      },
      labels: labels && labels.some((l, i) => l !== String(i + 1)) ? labels : null,
      outline,
      pages,
    };
  } finally {
    await task.destroy();
  }
}

async function flattenOutline(pdf, items, level, out) {
  for (const it of items ?? []) {
    const entry = { title: (it.title || '').replace(/\s+/g, ' ').trim(), level, page: null, x: null, top: null };
    try {
      let dest = it.dest;
      if (typeof dest === 'string') dest = await pdf.getDestination(dest);
      if (Array.isArray(dest)) {
        const ref = dest[0];
        if (ref && typeof ref === 'object') entry.page = (await pdf.getPageIndex(ref)) + 1;
        else if (Number.isInteger(ref)) entry.page = ref + 1;
        const kind = dest[1]?.name;
        if (kind === 'XYZ') [entry.x, entry.top] = [dest[2], dest[3]];
        else if (kind === 'FitH' || kind === 'FitBH') entry.top = dest[2];
        else if (kind === 'FitR') [entry.x, entry.top] = [dest[2], dest[5]];
      }
    } catch {
      // A broken destination leaves the entry without a page.
    }
    if (entry.title) out.push(entry);
    await flattenOutline(pdf, it.items, level + 1, out);
  }
}
