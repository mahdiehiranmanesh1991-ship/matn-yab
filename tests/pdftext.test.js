import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pageText, recoverZwnj, formOf, lineToLogical } from '../lib/pdftext.js';
import { cer } from '../lib/cer.js';

const T = JSON.parse(fs.readFileSync(new URL('./fixtures/texts.json', import.meta.url)));
const pdfjs = await import('../vendor/pdfjs/pdf.min.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
async function items(name) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(new URL(`./fixtures/${name}.pdf`, import.meta.url))), isEvalSupported: false }).promise;
  const out = []; for (let p = 1; p <= doc.numPages; p++) out.push((await (await doc.getPage(p)).getTextContent()).items); await doc.destroy(); return out;
}
const naive = (its) => its.map((i) => i.str + (i.hasEOL ? '\n' : '')).join('');

test('presentation-form shape table derived from Unicode', () => {
  assert.equal(formOf('ﺏ'), 'isol'); assert.equal(formOf('ﺐ'), 'fina'); assert.equal(formOf('ﺑ'), 'init'); assert.equal(formOf('ﺒ'), 'medi');
  assert.equal(formOf('ﺩ'), 'isol'); assert.equal(formOf('ﺪ'), 'fina'); assert.equal(formOf('ﯽ'), 'fina'); assert.equal(formOf('ب'), null);
});
test('ZWNJ recovered from glyph shapes: ﻣﻰ + ﺷﻮﺩ → می‌شود; ﮐﺘﺎﺏ + ﻫﺎ → کتاب‌ها', () => {
  assert.equal(recoverZwnj('ﻣﻰﺷﻮﺩ').normalize('NFKC').replace(/ى/g, 'ی'), 'می\u200cشود');
  assert.equal(recoverZwnj('ﮐﺘﺎﺏﻫﺎ').normalize('NFKC'), 'کتاب\u200cها');
  assert.equal(recoverZwnj('ﺩﺍﺭﻭﻫﺎ').normalize('NFKC'), 'داروها'); // و never joins: no ZWNJ
});
test('visual-order line with Latin + digits → logical order', () => {
  // visual (left→right): "Sana" "(" ... what a viewer sees for: «ثنا (Sana) ۱۲۳»
  const mk = (str, x, w, dir = 'ltr') => ({ str, x, y: 100, w, size: 12, dir });
  const line = { size: 12, toks: [mk('۱۲۳', 0, 20), mk(' ', 20, 4), mk(')', 24, 4), mk('Sana', 28, 26), mk('(', 54, 4), mk(' ', 58, 4), mk('ثنا', 62, 20, 'rtl')] };
  assert.equal(lineToLogical(line, true), 'ثنا (Sana) ۱۲۳');
});
test('Office/LibreOffice PDF (logical runs): fixed text is exact', async () => {
  const [p] = await items('office'); const r = pageText(p);
  assert.ok(r.usable); assert.equal(cer(r.text, T.legal), 0, r.text);
  assert.ok(cer(naive(p), T.legal) > 0.03); // naive PDF.js join gets digits/Latin order wrong
});
test('legacy PDF (glyph-by-glyph, visual order, presentation forms, Arabic ي/ك): fixed text is exact', async () => {
  const [p] = await items('legacy'); const r = pageText(p);
  assert.ok(r.usable); assert.equal(cer(r.text, T.clean), 0, r.text); assert.ok(cer(naive(p), T.clean) > 0.5);
  assert.ok(!/[يك]/.test(r.text));
});
test('Chrome-printed PDF with broken ToUnicode is flagged → OCR fallback', async () => {
  const [p] = await items('textlayer'); const r = pageText(p); assert.equal(r.usable, false); assert.ok(r.broken > 0.08);
});
test('scanned PDF has no text layer → OCR', async () => {
  const pages = await items('scanned'); assert.equal(pages.length, 2); for (const p of pages) assert.equal(pageText(p).usable, false);
});
