// PDF: use the embedded text layer when it is trustworthy (fixed for Persian), otherwise render the page and OCR it.
import { pageText } from '../lib/pdftext.js';
let lib;
async function pdfjs() {
  if (lib) return lib;
  lib = await import('../vendor/pdfjs/pdf.min.mjs');
  lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  return lib;
}
export async function openPdf(bytes) {
  const L = await pdfjs();
  return L.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false, standardFontDataUrl: new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href }).promise;
}
export async function pdfPageText(doc, n) { const page = await doc.getPage(n); const tc = await page.getTextContent(); return pageText(tc.items); }
/** Render page n to a canvas ~targetWidth px wide (≈300 dpi for A4/A5, capped for phone memory). */
export async function renderPage(doc, n, targetWidth = 2000) {
  const page = await doc.getPage(n); const v1 = page.getViewport({ scale: 1 });
  const scale = Math.min(4, targetWidth / v1.width); const v = page.getViewport({ scale });
  const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: g, viewport: v }).promise; page.cleanup(); return c;
}
