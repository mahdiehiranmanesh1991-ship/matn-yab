// Renders the app icons with headless Chrome. Run: PW_DIR=/tmp/pw node scripts/icons.mjs
import { createRequire } from 'node:module';
const require = createRequire((process.env.PW_DIR || '/tmp/pw') + '/');
const { chromium } = require('playwright-core');
const root = new URL('../', import.meta.url).pathname;
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f3d3e"/><stop offset="1" stop-color="#16857c"/></linearGradient></defs>
<rect width="512" height="512" rx="${pad ? 0 : 112}" fill="url(#g)"/>
<g transform="translate(256 256) scale(${pad ? 0.78 : 1}) translate(-256 -256)">
<path d="M120 170v-38a22 22 0 0 1 22-22h38M332 110h38a22 22 0 0 1 22 22v38M392 342v38a22 22 0 0 1-22 22h-38M180 402h-38a22 22 0 0 1-22-22v-38" fill="none" stroke="#f2a541" stroke-width="26" stroke-linecap="round"/>
<text x="256" y="300" font-family="Vazirmatn" font-weight="800" font-size="150" fill="#fff" text-anchor="middle" direction="rtl">متن</text>
<rect x="170" y="330" width="172" height="16" rx="8" fill="#fff" opacity=".55"/></g></svg>`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-192', 192, false], ['icon-512', 512, false], ['icon-maskable-512', 512, true], ['apple-touch-icon', 180, true]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>@font-face{font-family:Vazirmatn;src:url(file://${root}fonts/Vazirmatn-Variable.woff2)}body{margin:0}</style><div style="width:${size}px;height:${size}px">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>`);
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
  await page.screenshot({ path: `${root}icons/${name}.png`, omitBackground: true });
}
await browser.close(); console.log('icons ok');
