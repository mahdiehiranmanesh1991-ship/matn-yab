// Rebuild readable Persian text from a PDF.js text layer (page.getTextContent().items).
// Problems handled (all seen in real Persian PDFs):
//  • glyph-by-glyph items in VISUAL order (Chrome/Word "Save as PDF", old Acrobat) → logical order;
//  • Arabic presentation forms (ﺧ ﺮ ﺩ ﻻ) → base letters, and ZWNJ recovered from glyph shapes (ﻣﻰ‌ﺷﻮﺩ → می‌شود);
//  • justification gaps turning into fake spaces inside words; kashida (ـ);
//  • mirrored brackets in RTL runs; Arabic ي/ك → Persian ی/ک;
//  • broken ToUnicode maps (\0, U+FFFD, private-use) → page is flagged so the app falls back to OCR.
import { cleanText, isPresentationForm } from './normalize.js';

const RTL = /[\u0590-\u05ff\u0620-\u064a\u066e-\u06d3\u06d5\u06fa-\u06ff\u0750-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/; // letters only (digits are weak)
const RTL_G = new RegExp(RTL.source, 'g');
const LATIN = /[A-Za-z\u00c0-\u024f]/;
const DIGIT = /[0-9\u06f0-\u06f9\u0660-\u0669]/; // numbers run left-to-right inside RTL text but count as RTL for neutrals (UAX#9 N1)

// Presentation-form shape table, derived from Unicode itself (no hard-coded tables):
// consecutive code points with the same NFKC base are [isolated, final, initial, medial] (or [isolated, final]).
const FORM = new Map();
(function buildForms() {
  for (const [a, b] of [[0xfb50, 0xfbff], [0xfe70, 0xfefc]]) {
    let group = [];
    const flush = () => { const names = group.length === 4 ? ['isol', 'fina', 'init', 'medi'] : group.length === 2 ? ['isol', 'fina'] : ['isol'];
      group.forEach((c, i) => FORM.set(String.fromCodePoint(c), names[i] || 'isol')); group = []; };
    for (let c = a; c <= b; c++) {
      const base = String.fromCodePoint(c).normalize('NFKC');
      if (base === String.fromCodePoint(c)) { flush(); continue; }
      if (group.length && String.fromCodePoint(group[0]).normalize('NFKC') !== base) flush();
      group.push(c); if (group.length === 4) flush();
    }
    flush();
  }
})();
export const formOf = (ch) => FORM.get(ch) || null;
const NON_JOINING = /[اآأإٱدذرزژوؤة]/; // letters that never join to the following letter

/** Insert ZWNJ where glyph shapes prove a non-joined boundary inside a word (logical order, before NFKC). */
export function recoverZwnj(s) {
  const a = [...s]; let out = '';
  for (let i = 0; i < a.length; i++) {
    out += a[i];
    const f1 = formOf(a[i]); const f2 = a[i + 1] && formOf(a[i + 1]);
    if (!f1 || !f2) continue;
    const base = a[i].normalize('NFKC');
    if ((f1 === 'isol' || f1 === 'fina') && (f2 === 'isol' || f2 === 'init') && !NON_JOINING.test(base.slice(-1))) out += '\u200c';
  }
  return out;
}

const classOf = (str) => (RTL.test(str) ? 'R' : LATIN.test(str) ? 'L' : DIGIT.test(str) ? 'D' : 'N');

/** Group PDF.js items into lines (top→bottom) of tokens sorted by x (visual left→right). */
export function groupLines(items) {
  const toks = items.filter((it) => it.str !== undefined && it.str !== '').map((it) => {
    const [a, b, , d, x, y] = it.transform; const size = Math.hypot(c0(a), c0(b)) || Math.abs(d) || it.height || 10;
    return { str: it.str, x, y, w: it.width || 0, size, dir: it.dir };
  });
  toks.sort((p, q) => q.y - p.y || p.x - q.x);
  const lines = [];
  for (const t of toks) {
    const line = lines.find((l) => Math.abs(l.y - t.y) < Math.max(2, 0.45 * Math.min(l.size, t.size)));
    if (line) { line.toks.push(t); line.size = Math.max(line.size, t.size); } else lines.push({ y: t.y, size: t.size, toks: [t] });
  }
  lines.sort((p, q) => q.y - p.y);
  for (const l of lines) l.toks.sort((p, q) => p.x - q.x);
  return lines;
}
const c0 = (v) => v || 0;

/** One visual line → logical string. */
export function lineToLogical(line, pageRtl = false) {
  const toks = line.toks; const explicitSpaces = toks.some((t) => /^\s+$/.test(t.str));
  const gapMin = (explicitSpaces ? 0.55 : 0.22) * line.size;
  // visual token stream with synthetic spaces for real gaps
  const vis = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (i > 0) { const p = toks[i - 1]; const gap = t.x - (p.x + p.w);
      if (gap > gapMin && !/\s$/.test(p.str) && !/^\s/.test(t.str)) vis.push({ str: ' ', cls: 'N' }); }
    vis.push({ str: t.str, cls: classOf(t.str), rtlItem: t.dir === 'rtl' });
  }
  const all = vis.map((v) => v.str).join('');
  const nR = (all.match(RTL_G) || []).length; const nLatin = (all.match(/[A-Za-z\u00c0-\u024f]/g) || []).length;
  const isRtlLine = nR > 0 && (pageRtl || nR >= 0.5 * nLatin);
  if (!isRtlLine) return vis.map((v) => v.str).join('');
  // resolve neutrals: between two Latin tokens → L, between two numbers (۱۴۰۵/۰۳/۱۵) → D, otherwise R
  const strong = vis.map((v) => v.cls);
  for (let i = 0; i < vis.length; i++) if (strong[i] === 'N') {
    let l = i - 1; while (l >= 0 && vis[l].cls === 'N') l--; let r = i + 1; while (r < vis.length && vis[r].cls === 'N') r++;
    const L = l >= 0 && vis[l].cls, R = r < vis.length && vis[r].cls;
    strong[i] = L === 'L' && R === 'L' ? 'L' : L === 'D' && R === 'D' && !/\s/.test(vis[i].str) ? 'D' : 'R';
  }
  // split into runs, reverse run order; inside R runs reverse token order (each multi-char RTL item is already logical in PDF.js)
  const runs = [];
  vis.forEach((v, i) => { const c = strong[i]; if (runs.length && runs[runs.length - 1].c === c) runs[runs.length - 1].t.push(v); else runs.push({ c, t: [v] }); });
  return runs.reverse().map((r) => (r.c !== 'R' ? r.t.map((v) => v.str).join('')
    : r.t.slice().reverse().map((v) => (v.str.length > 1 && !v.rtlItem && v.cls === 'R' ? [...v.str].reverse().join('') : v.str)).join(''))).join('');
}

/** Score how trustworthy a text layer is: share of characters that are broken / unmapped. */
export function brokenRatio(items) {
  const all = items.map((i) => i.str || '').join('');
  const bad = (all.match(/[\u0000\ufffd\ue000-\uf8ff]/g) || []).length;
  return all.replace(/\s/g, '').length ? bad / all.replace(/\s/g, '').length : 1;
}

/** Full page: items → clean logical Persian text + quality verdict. */
export function pageText(items, { fixZwnj = true } = {}) {
  const ratio = brokenRatio(items);
  const lines = groupLines(items.map((i) => ({ ...i, str: (i.str || '').replace(/[\u0000\ufffd]/g, '') })));
  const joined = items.map((i) => i.str || '').join('');
  const pageRtl = (joined.match(RTL_G) || []).length > (joined.match(/[A-Za-z]/g) || []).length;
  const text = lines.map((l) => { let s = lineToLogical(l, pageRtl); if (fixZwnj && [...s].some(isPresentationForm)) s = recoverZwnj(s); return s; })
    .join('\n');
  const clean = cleanText(text).replace(/(\S) {2,}(\S)/g, '$1 $2');
  const letters = clean.replace(/[^\p{L}\p{N}]/gu, '').length;
  return { text: clean, broken: ratio, letters, usable: letters >= 8 && ratio < 0.08 };
}
