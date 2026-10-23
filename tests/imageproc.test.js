import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleFor, stretch, sauvola, estimateSkew, analyze, otsu, toGray } from '../lib/imageproc.js';

function lines(W, H, deg, { bg = 245, fg = 20 } = {}) { // synthetic "text lines", rotated by deg (clockwise)
  const g = new Uint8ClampedArray(W * H).fill(bg); const a = (deg * Math.PI) / 180;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const yy = (y - H / 2) * Math.cos(a) - (x - W / 2) * Math.sin(a) + H / 2, xx = (x - W / 2) * Math.cos(a) + (y - H / 2) * Math.sin(a) + W / 2;
    if (xx > 40 && xx < W - 40 && yy > 30 && yy < H - 30 && (yy % 40) < 12 && (Math.floor(xx / 9) % 5) !== 0) g[y * W + x] = fg; }
  return g;
}
test('scale: small screenshots upscaled, large photos capped by pixel budget', () => {
  assert.equal(scaleFor(390, 800), 3); assert.equal(scaleFor(800, 600), 2); assert.equal(scaleFor(2000, 1000), 1);
  assert.ok(scaleFor(4032, 3024) < 1);
});
test('stretch auto-inverts dark mode', () => {
  const g = new Uint8ClampedArray(1000).fill(20); for (let i = 0; i < 100; i++) g[i] = 230;
  const s = stretch(g); assert.equal(s.inverted, true); assert.ok(s.gray[500] > 200 && s.gray[5] < 50);
});
test('otsu + sauvola separate text from background', () => {
  const W = 200, H = 120, g = lines(W, H, 0); const t = otsu(g); assert.ok(t >= 20 && t < 245, String(t));
  const b = sauvola(g, W, H); assert.equal(b[0], 255); const dark = b.filter((v) => v === 0).length; assert.ok(dark > 500, String(dark));
});
for (const deg of [0, 3.5, -5, 7]) test(`deskew estimates ${deg}°`, () => {
  const W = 500, H = 320; const est = estimateSkew(lines(W, H, deg), W, H); assert.ok(Math.abs(est - deg) <= 0.6, `est ${est}`);
});
test('analyze flags dark / multi-background screenshots', () => {
  const W = 240, H = 240; const light = new Uint8ClampedArray(W * H).fill(250); assert.equal(analyze(light, W, H).hard, false);
  const dark = new Uint8ClampedArray(W * H).fill(30); assert.equal(analyze(dark, W, H).hard, true);
  const multi = new Uint8ClampedArray(W * H); for (let i = 0; i < W * H; i++) multi[i] = [250, 160, 90][Math.floor((i % W) / 80)]; assert.equal(analyze(multi, W, H).hard, true);
});
test('toGray', () => { assert.deepEqual([...toGray(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]), 2)], [255, 0]); });

test('stretch keeps sparse text on a white page (regression: <2 % ink)', async () => {
  const { stretch } = await import('../lib/imageproc.js');
  const g = new Uint8ClampedArray(10000).fill(255); for (let i = 0; i < 100; i++) g[i * 7] = 30; // 1 % ink
  const r = stretch(g, { invert: false }); assert.ok(r.hi - r.lo >= 64); assert.ok(r.gray[0] < 60 && r.gray[1] > 250);
});
