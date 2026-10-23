// OCR engine: self-hosted Tesseract.js (LSTM) + adaptive pre-processing, fully on-device.
import { scaleFor, toGray, stretch, sauvola, estimateSkew, analyze } from '../lib/imageproc.js';
import { cleanText } from '../lib/normalize.js';

const abs = (p) => new URL(p, document.baseURI).href;
// fas = tessdata_best Persian (most accurate alone); fas_fast = tessdata_fast Persian (best together with English, see README benchmark)
export const LANGS = { 'fa+en': ['fas_fast', 'eng'], fa: ['fas'], en: ['eng'] };
let worker = null, workerKey = '', onProgress = null, busy = Promise.resolve();

async function getWorker(lang) {
  const langs = window.__matnLangs?.[lang] || LANGS[lang]; const key = langs.join('+');
  if (worker && workerKey === key) return worker;
  if (worker) { await worker.terminate(); worker = null; }
  const T = window.Tesseract;
  worker = await T.createWorker(langs, 1 /* OEM LSTM */, {
    workerPath: abs('./vendor/tesseract/worker.min.js'), corePath: abs('./vendor/tesseract/core'), langPath: abs('./tessdata'),
    gzip: false, cacheMethod: 'none', // the service worker caches the models; no second copy in IndexedDB
    logger: (m) => onProgress && onProgress(m),
  });
  await worker.setParameters({ tessedit_pageseg_mode: '3', user_defined_dpi: '300' });
  workerKey = key; return worker;
}
export const warmUp = (lang) => (busy = busy.then(() => getWorker(lang)).catch(() => {}));

/** Draw a source (ImageBitmap/canvas/img) with rotation (deg, multiples of 90) and optional crop {x,y,w,h} in 0..1. */
export function orient(src, { rotate = 0, crop = null } = {}) {
  const sw = src.width, sh = src.height; const cx = crop ? Math.round(crop.x * sw) : 0, cy = crop ? Math.round(crop.y * sh) : 0;
  const cw = crop ? Math.max(8, Math.round(crop.w * sw)) : sw, ch = crop ? Math.max(8, Math.round(crop.h * sh)) : sh;
  const r = ((rotate % 360) + 360) % 360; const c = document.createElement('canvas');
  c.width = r % 180 ? ch : cw; c.height = r % 180 ? cw : ch; const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2); g.rotate((r * Math.PI) / 180); g.drawImage(src, cx, cy, cw, ch, -cw / 2, -ch / 2, cw, ch);
  return c;
}

function grayCanvas(gray, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const d = g.createImageData(W, H);
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) { d.data[j] = d.data[j + 1] = d.data[j + 2] = gray[i]; d.data[j + 3] = 255; }
  g.putImageData(d, 0, 0); return c;
}

/** Pre-process: upscale small text, deskew, grayscale + contrast stretch (+ auto-invert). Returns canvases for both passes. */
export function preprocess(canvas, { deskew = true, enhance = true } = {}) {
  const s = scaleFor(canvas.width, canvas.height);
  let c = document.createElement('canvas'); c.width = Math.round(canvas.width * s); c.height = Math.round(canvas.height * s);
  let g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high';
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(canvas, 0, 0, c.width, c.height);
  let W = c.width, H = c.height; let gray = toGray(g.getImageData(0, 0, W, H).data, W * H);
  const info = analyze(gray, W, H); let st = stretch(gray);
  let skew = 0;
  if (deskew) { skew = estimateSkew(st.gray, W, H); if (Math.abs(skew) >= 0.6 && Math.abs(skew) < 9.9) {
    const base = grayCanvas(st.gray, W, H); const rad = (-skew * Math.PI) / 180, cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
    const r = document.createElement('canvas'); r.width = Math.round(W * cos + H * sin); r.height = Math.round(W * sin + H * cos);
    const rg = r.getContext('2d', { willReadFrequently: true }); rg.fillStyle = '#fff'; rg.fillRect(0, 0, r.width, r.height);
    rg.translate(r.width / 2, r.height / 2); rg.rotate(rad); rg.drawImage(base, -W / 2, -H / 2);
    W = r.width; H = r.height; st = { ...st, gray: toGray(rg.getImageData(0, 0, W, H).data, W * H) };
  } else skew = 0; }
  const main = enhance ? grayCanvas(st.gray, W, H) : c;
  return { main, W, H, info: { ...info, skew, scale: s, inverted: st.inverted }, bin: () => grayCanvas(sauvola(st.gray, W, H), W, H) };
}

const letters = (t) => t.replace(/[^\p{L}\p{N}]/gu, '').length;

/**
 * Recognise one image/canvas. mode: 'accurate' (adaptive second pass for hard screenshots) | 'fast'.
 * Returns { text, confidence, passes, info, ms }.
 */
export function recognize(canvas, { lang = 'fa+en', mode = 'accurate', deskew = true, enhance = true, progress } = {}) {
  const run = async () => {
    const t0 = performance.now(); const w = await getWorker(lang);
    const pp = preprocess(canvas, { deskew, enhance }); const passes = [];
    const pass = async (img, name, base, span) => {
      onProgress = (m) => { if (progress && m.status === 'recognizing text') progress(base + span * m.progress, 'ocr'); };
      const { data } = await w.recognize(img); const text = cleanText(data.text || '');
      const p = { name, text, confidence: Math.round(data.confidence || 0), n: letters(text) }; passes.push(p); return p;
    };
    const second = mode === 'accurate' && enhance && (pp.info.hard);
    const a = await pass(pp.main, 'enhanced', 0, second ? 0.5 : 1);
    let best = a;
    if (second || (mode === 'accurate' && enhance && (a.confidence < 70 || a.n < 15))) {
      const b = await pass(pp.bin(), 'binarized', 0.5, 0.5);
      if (b.n > a.n * 1.25 || (b.confidence > a.confidence + 6 && b.n >= a.n * 0.9)) best = b;
    }
    onProgress = null; progress && progress(1, 'ocr');
    return { text: best.text, confidence: best.confidence, used: best.name, passes: passes.map(({ text, ...p }) => p), info: pp.info, ms: Math.round(performance.now() - t0) };
  };
  const p = busy.then(run); busy = p.catch(() => {}); return p;
}
