// Image pre-processing for OCR — pure functions on grayscale/RGBA arrays (testable in node, used by the app on canvases).
// Benchmarked choices (see README): upscale small screenshots, grayscale + 2–98 % contrast stretch, auto-invert dark mode;
// adaptive (Sauvola) binarisation only as a second pass for dark / multi-coloured screenshots (chat bubbles).

/** Scale factor so Persian glyphs reach a height Tesseract likes, capped to keep phones from running out of memory. */
export function scaleFor(w, h, maxPixels = 9e6) {
  const s = w < 500 ? 3 : w < 900 ? 2 : w < 1300 ? 1.5 : 1;
  return Math.max(0.25, Math.min(s, Math.sqrt(maxPixels / (w * h))));
}

export function toGray(rgba, n) {
  const g = new Uint8ClampedArray(n);
  for (let i = 0, j = 0; j < n; i += 4, j++) g[j] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  return g;
}

/** Contrast stretch between the 2nd and 98th percentile; inverts dark-mode images so text is dark on light. */
export function stretch(gray, { invert = 'auto' } = {}) {
  const n = gray.length, h = new Uint32Array(256); let sum = 0;
  for (let i = 0; i < n; i++) { h[gray[i]]++; sum += gray[i]; }
  // 2–98 % percentile stretch; sparse pages (a few lines of text on white, <2 % ink) would collapse lo == hi,
  // so fall back to thinner tails until there is real contrast left.
  let lo = 0, hi = 255;
  for (const tail of [0.02, 0.005, 0.0005, 0]) {
    let acc = 0; for (let v = 0; v < 256; v++) { acc += h[v]; if (acc > n * tail) { lo = v; break; } }
    acc = 0; for (let v = 255; v >= 0; v--) { acc += h[v]; if (acc > n * tail) { hi = v; break; } }
    if (hi - lo >= 64) break;
  }
  const inv = invert === 'auto' ? sum / n < 128 : !!invert; const k = 255 / Math.max(1, hi - lo);
  const out = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) { const y = (gray[i] - lo) * k; out[i] = inv ? 255 - y : y; }
  return { gray: out, inverted: inv, lo, hi };
}

/** Sauvola-style adaptive threshold using integral images (O(n)). */
export function sauvola(gray, W, H, { k = 0.2, radius } = {}) {
  const W1 = W + 1, I = new Float64Array(W1 * (H + 1)), I2 = new Float64Array(W1 * (H + 1));
  for (let y = 0; y < H; y++) { let r = 0, r2 = 0; for (let x = 0; x < W; x++) { const v = gray[y * W + x]; r += v; r2 += v * v;
    I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + r; I2[(y + 1) * W1 + x + 1] = I2[y * W1 + x + 1] + r2; } }
  const R = radius || Math.max(12, Math.round(Math.min(W, H) / 30)); const out = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) { const y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1);
    for (let x = 0; x < W; x++) { const x0 = Math.max(0, x - R), x1 = Math.min(W, x + R + 1), n = (x1 - x0) * (y1 - y0);
      const S = I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
      const S2 = I2[y1 * W1 + x1] - I2[y0 * W1 + x1] - I2[y1 * W1 + x0] + I2[y0 * W1 + x0];
      const m = S / n, sd = Math.sqrt(Math.max(0, S2 / n - m * m));
      out[y * W + x] = gray[y * W + x] < m * (1 + k * (sd / 128 - 1)) && sd > 8 ? 0 : 255; } }
  return out;
}

export function otsu(gray) {
  const h = new Float64Array(256); for (let i = 0; i < gray.length; i++) h[gray[i]]++;
  const n = gray.length; let sum = 0; for (let v = 0; v < 256; v++) sum += v * h[v];
  let sB = 0, wB = 0, best = 0, t = 128;
  for (let v = 0; v < 256; v++) { wB += h[v]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += v * h[v];
    const mB = sB / wB, mF = (sum - sB) / wF, between = wB * wF * (mB - mF) ** 2; if (between > best) { best = between; t = v; } }
  return t;
}

/**
 * Skew estimate in degrees (positive = text rotated clockwise) by projection-profile variance.
 * Works on a light-background grayscale image; ±maxDeg search, 0.25° steps refined to 0.1°.
 */
export function estimateSkew(gray, W, H, { maxDeg = 10 } = {}) {
  // downsample to ≤700 px wide, binarise adaptively (robust to uneven lighting), project dark pixels
  const f = Math.max(1, Math.ceil(W / 700)), w = Math.floor(W / f), h = Math.floor(H / f); const small = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) s += gray[(y * f + j) * W + x * f + i]; small[y * w + x] = s / (f * f); }
  const bin = sauvola(small, w, h, { radius: Math.max(8, Math.round(Math.min(w, h) / 20)) }); const pts = []; const step = 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!bin[y * w + x]) pts.push(x, y);
  if (pts.length < 200) return 0;
  const score = (deg) => { const a = (deg * Math.PI) / 180, s = Math.sin(a), c = Math.cos(a); const bins = new Map();
    for (let i = 0; i < pts.length; i += 2) { const r = Math.round((pts[i + 1] * c - pts[i] * s) / step); bins.set(r, (bins.get(r) || 0) + 1); }
    let e = 0; for (const v of bins.values()) e += v * v; return e; };
  let best = 0, bestS = -1;
  for (let d = -maxDeg; d <= maxDeg + 1e-9; d += 0.25) { const s = score(d); if (s > bestS) { bestS = s; best = d; } }
  for (let d = best - 0.25; d <= best + 0.25 + 1e-9; d += 0.05) { const s = score(d); if (s > bestS) { bestS = s; best = d; } }
  return Math.round(best * 10) / 10;
}

/**
 * Is this a "hard" screenshot (dark mode, or several background colours like chat bubbles)?
 * Those get a second, binarised OCR pass — the benchmark showed it turns chat CER 0.55 → 0.02.
 */
export function analyze(gray, W, H) {
  const T = 24, tw = Math.max(1, Math.floor(W / T)), th = Math.max(1, Math.floor(H / T)); const meds = []; let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) { const h = new Uint16Array(32); let n = 0;
    for (let y = ty * th; y < Math.min(H, (ty + 1) * th); y += 2) for (let x = tx * tw; x < Math.min(W, (tx + 1) * tw); x += 2) { h[gray[y * W + x] >> 3]++; n++; }
    let acc = 0; for (let b = 0; b < 32; b++) { acc += h[b]; if (acc >= n / 2) { meds.push(b * 8 + 4); break; } } }
  const levels = new Set(meds.map((m) => m >> 5)); // background clusters (32-level buckets)
  const counts = {}; meds.forEach((m) => { counts[m >> 5] = (counts[m >> 5] || 0) + 1; });
  const major = Object.values(counts).filter((c) => c >= meds.length * 0.08).length;
  const mean = sum / gray.length;
  return { mean, dark: mean < 110, backgrounds: major, levels: levels.size, hard: mean < 110 || major >= 3 };
}
