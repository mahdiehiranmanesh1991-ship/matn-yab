// Headless end-to-end test at iPhone size (390x844) on generated Persian fixtures — reports CER per file.
// Serve the PARENT folder so the app lives under the same sub-path as on GitHub Pages:
//   (cd .. && python3 -m http.server 8813 &)  then  PW_DIR=/tmp/pw node tests/e2e.mjs http://127.0.0.1:8813/matn-yab/
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { cer } from '../lib/cer.js';
const require = createRequire((process.env.PW_DIR || '/tmp/pw') + '/');
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'http://127.0.0.1:8813/matn-yab/';
const FX = new URL('./fixtures/', import.meta.url).pathname;
const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
const T = JSON.parse(fs.readFileSync(FX + 'texts.json'));
fs.mkdirSync(SHOTS, { recursive: true });
const results = []; const report = { images: {}, pdfs: {} };
const check = (name, ok, extra = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fa-IR', timezoneId: 'Asia/Tehran',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await ctx.newPage();
const errors = []; const external = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
ctx.on('request', (r) => { const u = r.url(); if (!u.startsWith(new URL(BASE).origin) && !/^(data|blob):/.test(u)) external.push(u); });
const shot = async (name, full = false) => { await page.evaluate(() => { document.getElementById('toast').hidden = true; }); await page.waitForTimeout(300); await page.screenshot({ path: SHOTS + name + '.png', fullPage: full }); };
const ready = () => page.waitForSelector('body[data-ready="1"]', { timeout: 20000 });
const runAndWait = async (timeout = 180000) => { const before = await page.evaluate(() => document.body.dataset.done || ''); await page.click('#runBtn');
  await page.waitForFunction((b) => (document.body.dataset.done || '') !== b, before, { timeout }); };
const resultTexts = () => page.evaluate(() => window.__matn.state.results.map((r) => ({ name: r.name, pages: r.pages.map((p) => ({ text: p.text, source: p.source, confidence: p.confidence, ms: p.ms, used: p.used, skew: p.skew })) })));

// 1. first launch
await page.goto(BASE); await ready();
check('RTL + Persian', await page.evaluate(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'fa'));
check('Vazirmatn (local font) loaded', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Vazirmatn'); }));
check('extract button disabled when empty', await page.isDisabled('#runBtn'));
await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 30000 }).catch(() => {});
await shot('01-start');

// 2. images: several at once
const imgs = ['clean.png', 'small.png', 'chat.png', 'legal.png', 'photo.jpg'];
await page.setInputFiles('#fileInput', imgs.map((f) => FX + f));
await page.waitForFunction((n) => window.__matn.state.queue.length === n, imgs.length);
check('multi-select adds 5 images to queue', (await page.locator('.qitem').count()) === 5);
await shot('02-queue');
let t0 = Date.now(); const pShot = page.waitForSelector('#progress:not([hidden])').then(() => page.waitForTimeout(700)).then(() => page.screenshot({ path: SHOTS + '03-progress.png' }));
await runAndWait(); await pShot; const imgSecs = (Date.now() - t0) / 1000;
let res = await resultTexts();
const limits = { clean: 0.02, small: 0.06, chat: 0.08, legal: 0.1, photo: 0.06 };
for (const f of imgs) {
  const k = f.split('.')[0]; const r = res.find((x) => x.name === f); const e = cer(r.pages[0].text, T[k]);
  report.images[k] = { cer: +e.toFixed(3), ms: r.pages[0].ms, conf: r.pages[0].confidence, pass: r.pages[0].used, skew: r.pages[0].skew };
  check(`OCR ${f} CER ≤ ${limits[k]}`, e <= limits[k], `CER ${e.toFixed(3)} · ${r.pages[0].ms} ms · ${r.pages[0].used} · conf ${r.pages[0].confidence}`);
}
check('no Arabic ي/ك in output', !res.some((r) => /[يك]/.test(r.pages[0].text)));
check('progress shows done', (await page.textContent('#progText')).includes('تمام شد'), `${imgSecs.toFixed(1)} s total (incl. first engine load)`);
await page.evaluate(() => window.scrollTo(0, 0)); await page.locator('.result').last().scrollIntoViewIfNeeded();
await page.evaluate(() => document.querySelector('.result[data-id]') && [...document.querySelectorAll('.result')].find((c) => c.querySelector('h2').textContent.includes('legal')).scrollIntoView());
await shot('04-result-image');

// 3. tools on the "legal" result
const legalCard = page.locator('.result', { hasText: 'legal.png' });
await legalCard.locator('[data-act="digits"]').click();
let txt = await legalCard.locator('textarea').inputValue();
check('digit toggle → Latin digits', /\d{6}/.test(txt) && !/[۰-۹]/.test(txt));
await page.locator('.result', { hasText: 'legal.png' }).locator('[data-act="digits"]').click();
txt = await page.locator('.result', { hasText: 'legal.png' }).locator('textarea').inputValue();
check('digit toggle back → Persian digits (email/latin kept)', /[۰-۹]{3}/.test(txt) && /info@example\.com/.test(txt));
await page.locator('.result', { hasText: 'clean.png' }).locator('[data-act="join"]').click();
const joined = await page.locator('.result', { hasText: 'clean.png' }).locator('textarea').inputValue();
check('join lines', !joined.includes('\n'), joined.slice(0, 40));
await page.locator('.result', { hasText: 'clean.png' }).locator('[data-act="undo"]').click();
check('undo restores lines', (await page.locator('.result', { hasText: 'clean.png' }).locator('textarea').inputValue()).includes('\n'));
await page.locator('.result', { hasText: 'clean.png' }).locator('textarea').fill('می شود کتاب ها را دید');
await page.locator('.result', { hasText: 'clean.png' }).locator('[data-act="half"]').click();
check('half-space fix', (await page.locator('.result', { hasText: 'clean.png' }).locator('textarea').inputValue()) === 'می\u200cشود کتاب\u200cها را دید');
await page.locator('.result', { hasText: 'small.png' }).locator('[data-act="copy"]').click();
const clip = await page.evaluate(() => navigator.clipboard.readText());
check('one-tap copy → clipboard', cer(clip, T.small) <= 0.06, clip.slice(0, 30));
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.result', { hasText: 'small.png' }).locator('[data-act="txt"]').click()]);
const dlPath = await dl.path(); const dlTxt = fs.readFileSync(dlPath, 'utf8');
check('.txt download (UTF-8 BOM)', dl.suggestedFilename() === 'small.txt' && dlTxt.charCodeAt(0) === 0xfeff);
const [dx] = await Promise.all([page.waitForEvent('download'), page.locator('.result', { hasText: 'small.png' }).locator('[data-act="docx"]').click()]);
const dxBuf = fs.readFileSync(await dx.path());
check('.docx download is a zip', dx.suggestedFilename() === 'small.docx' && dxBuf.readUInt32LE(0) === 0x04034b50);
await page.locator('.result', { hasText: 'legal.png' }).scrollIntoViewIfNeeded();
await shot('05-tools');

// 4. PDFs
await page.evaluate(() => { window.__matn.state.results.length = 0; });
const pdfs = ['office.pdf', 'legacy.pdf', 'textlayer.pdf', 'scanned.pdf'];
await page.setInputFiles('#fileInput', pdfs.map((f) => FX + f));
await page.waitForFunction(() => window.__matn.state.queue.length === 4);
check('PDF page counts', (await page.textContent('#queue')).includes('۲ صفحه'));
t0 = Date.now(); await runAndWait(); const pdfSecs = (Date.now() - t0) / 1000;
res = await resultTexts();
const pr = (n) => res.find((x) => x.name === n);
let e;
e = cer(pr('office.pdf').pages[0].text, T.legal); report.pdfs.office = { cer: +e.toFixed(3), source: pr('office.pdf').pages[0].source };
check('Office PDF: text layer used + RTL fixed', pr('office.pdf').pages[0].source === 'pdf-text' && e === 0, `CER ${e.toFixed(3)}`);
e = cer(pr('legacy.pdf').pages[0].text, T.clean); report.pdfs.legacy = { cer: +e.toFixed(3), source: pr('legacy.pdf').pages[0].source };
check('legacy PDF (visual order, presentation forms, ي/ك): fixed', pr('legacy.pdf').pages[0].source === 'pdf-text' && e === 0, `CER ${e.toFixed(3)}`);
e = cer(pr('textlayer.pdf').pages[0].text, T.legal); report.pdfs.textlayer = { cer: +e.toFixed(3), source: pr('textlayer.pdf').pages[0].source, ms: pr('textlayer.pdf').pages[0].ms };
check('broken text layer → OCR fallback', pr('textlayer.pdf').pages[0].source !== 'pdf-text' && e <= 0.1, `CER ${e.toFixed(3)} · ${pr('textlayer.pdf').pages[0].source}`);
const sc = pr('scanned.pdf').pages; const e1 = cer(sc[0].text, T.photo), e2 = cer(sc[1].text, T.clean);
report.pdfs.scanned = { cer: [+e1.toFixed(3), +e2.toFixed(3)], ms: sc.map((p) => p.ms) };
check('scanned 2-page PDF → OCR per page', sc.length === 2 && sc.every((p) => p.source === 'ocr') && e1 <= 0.08 && e2 <= 0.03, `CER p1 ${e1.toFixed(3)}, p2 ${e2.toFixed(3)} · ${pdfSecs.toFixed(1)} s for 4 PDFs`);
check('copy per page button on multi-page result', (await page.locator('.result', { hasText: 'scanned.pdf' }).locator('[data-act="copyp"]').count()) === 2);
await page.evaluate(() => [...document.querySelectorAll('.result')].find((c) => c.querySelector('h2').textContent.includes('office')).scrollIntoView());
await shot('06-result-pdf');

// 5. paste a screenshot (ClipboardEvent with a File)
await page.evaluate(async () => { const b = await (await fetch('tests/fixtures/small.png')).blob(); const dt = new DataTransfer(); dt.items.add(new File([b], 'image.png', { type: 'image/png' }));
  document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })); });
await page.waitForFunction(() => window.__matn.state.queue.length === 1);
check('paste adds image', (await page.textContent('#queue')).includes('چسبانده'));

// 6. crop UI
await page.click('.qitem [data-act="crop"]'); await page.waitForSelector('#cropModal:not([hidden])');
const box = await page.locator('#cropCanvas').boundingBox();
await page.mouse.move(box.x + 5, box.y + 5); await page.mouse.down(); await page.mouse.move(box.x + box.width - 5, box.y + box.height * 0.45, { steps: 6 }); await page.mouse.up();
await shot('07-crop');
await page.click('#cropOk');
check('crop applied', (await page.textContent('#queue')).includes('برش‌خورده'));
await runAndWait();
res = await resultTexts(); const cropTxt = res[0].pages[0].text;
check('cropped OCR only has the top part', cropTxt.length > 5 && cropTxt.length < T.small.length * 0.75, JSON.stringify(cropTxt.slice(0, 50)));

// 7. history
await page.click('.tabbar [data-tab="history"]'); await page.waitForSelector('#histList .hist');
const nHist = await page.locator('#histList .hist').count();
check('history saved in IndexedDB', nHist >= 10, String(nHist));
await shot('08-history');
await page.locator('#histList .hist').first().locator('[data-act="del"]').click(); await page.waitForTimeout(300);
check('history delete', (await page.locator('#histList .hist').count()) === nHist - 1);
await page.click('.tabbar [data-tab="help"]'); await shot('09-help');
await page.click('.tabbar [data-tab="extract"]');

// 8. offline: reload with network off, OCR still works (engine + models from the service-worker cache)
const swOk = await page.evaluate(() => !!navigator.serviceWorker.controller);
check('service worker controls page', swOk);
await ctx.setOffline(true);
await page.reload(); await ready();
await page.setInputFiles('#fileInput', [FX + 'clean.png']); await page.waitForFunction(() => window.__matn.state.queue.length === 1);
await runAndWait();
res = await resultTexts(); e = cer(res[0].pages[0].text, T.clean);
check('works fully offline after first load', e <= 0.02, `CER ${e.toFixed(3)}`);
await page.setInputFiles('#fileInput', [FX + 'office.pdf']); await page.waitForFunction(() => window.__matn.state.queue.length === 1);
await runAndWait(); res = await resultTexts();
check('PDF text layer offline', res[0].pages[0].source === 'pdf-text');
await ctx.setOffline(false);

check('no external network requests', external.length === 0, external.slice(0, 3).join(' '));
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
fs.writeFileSync(new URL('./e2e-report.json', import.meta.url), JSON.stringify({ date: new Date().toISOString(), imgSecs, pdfSecs, ...report, results }, null, 1));
const fail = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fail}/${results.length} passed`); process.exit(fail ? 1 : 0);
