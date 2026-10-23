// «متن‌یاب» — on-device Persian/English text extraction from images, screenshots and PDFs.
import { recognize, orient, warmUp } from './ocr.js';
import { openPdf, pdfPageText, renderPage } from './pdf.js';
import { saveDoc, listDocs, deleteDoc, clearDocs, getDoc } from './store.js';
import { convertDigits, joinLines, fixHalfSpace, tidyPunctuation, stats, hasPersianDigits } from '../lib/normalize.js';
import { buildDocx } from '../lib/docx.js';

export const VERSION = '1.0.0';
const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const jdate = (t) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(t));

const DEFAULTS = { lang: 'fa+en', mode: 'accurate', deskew: true, enhance: true, forceOcr: false, half: false, save: true, digits: 'keep' };
const settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('matn-yab:settings') || '{}') };
const saveSettings = () => localStorage.setItem('matn-yab:settings', JSON.stringify(settings));
const state = { queue: [], results: [], running: false };

function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms); }

// ---------- settings UI ----------
function bindSeg(id, key) {
  const seg = $(id); const paint = () => $$('button', seg).forEach((b) => { b.classList.toggle('on', b.dataset.v === settings[key]); b.setAttribute('aria-checked', b.dataset.v === settings[key]); });
  seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; settings[key] = b.dataset.v; saveSettings(); paint(); if (key === 'lang') warmUp(settings.lang); });
  paint();
}
function bindChk(id, key) { const el = $(id); el.checked = !!settings[key]; el.addEventListener('change', () => { settings[key] = el.checked; saveSettings(); }); }

// ---------- input ----------
async function decodeImage(blob) {
  try { return await createImageBitmap(blob); } catch {
    const url = URL.createObjectURL(blob); const img = new Image(); img.src = url; await img.decode(); URL.revokeObjectURL(url); return img; }
}
function thumbOf(src, size = 112) {
  const c = document.createElement('canvas'); const s = size / Math.max(src.width, src.height); c.width = Math.max(1, Math.round(src.width * s)); c.height = Math.max(1, Math.round(src.height * s));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.7);
}
const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
export async function addFiles(files) {
  let added = 0;
  for (const f of files) {
    try {
      if (isPdf(f)) {
        const bytes = new Uint8Array(await f.arrayBuffer()); const doc = await openPdf(bytes.slice());
        const first = await renderPage(doc, 1, 160); state.queue.push({ id: uid(), kind: 'pdf', name: f.name || 'document.pdf', bytes, pages: doc.numPages, thumb: first.toDataURL('image/jpeg', 0.7), rotate: 0 });
        doc.destroy();
      } else if (/^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp|heic|heif|tiff?)$/i.test(f.name || '')) {
        const bmp = await decodeImage(f); state.queue.push({ id: uid(), kind: 'image', name: f.name || 'image.png', bmp, pages: 1, thumb: thumbOf(bmp), rotate: 0, crop: null });
      } else { toast('این نوع فایل پشتیبانی نمی‌شود: ' + (f.name || f.type)); continue; }
      added++;
    } catch (e) { console.warn(e); toast('فایل باز نشد: ' + (f.name || '')); }
  }
  renderQueue(); if (added) { warmUp(settings.lang); }
  return added;
}
function renderQueue() {
  const q = $('#queue');
  q.innerHTML = state.queue.map((it) => `<div class="qitem${it.done ? ' done' : ''}" data-id="${it.id}">
    <img src="${it.thumb}" alt="" style="transform:rotate(${it.rotate}deg)">
    <div class="meta"><div class="name">${esc(it.name)}</div><div class="sub">${it.kind === 'pdf' ? `PDF · ${faNum(it.pages)} صفحه` : `تصویر · <bdi dir="ltr">${faNum(it.bmp.width)}×${faNum(it.bmp.height)}</bdi>`}${it.crop ? ' · برش‌خورده' : ''}${it.done ? ' · ✓' : ''}</div></div>
    <div class="acts"><button data-act="rot" title="چرخش ۹۰ درجه" aria-label="چرخش">↻</button>${it.kind === 'image' ? '<button data-act="crop" title="برش" aria-label="برش">✂︎</button>' : ''}<button data-act="del" title="حذف" aria-label="حذف">✕</button></div></div>`).join('');
  $('#runBtn').disabled = !state.queue.length || state.running;
  $('#runBtn').textContent = state.queue.length > 1 ? `✨ استخراج متن (${faNum(state.queue.length)} فایل)` : '✨ استخراج متن';
}
$('#queue').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]'); if (!b || state.running) return; const id = b.closest('.qitem').dataset.id; const it = state.queue.find((x) => x.id === id);
  if (b.dataset.act === 'del') state.queue = state.queue.filter((x) => x.id !== id);
  if (b.dataset.act === 'rot') { it.rotate = (it.rotate + 90) % 360; it.crop = null; }
  if (b.dataset.act === 'crop') return openCrop(it);
  renderQueue();
});

// ---------- crop ----------
let cropItem = null, cropSel = null;
function openCrop(it) {
  cropItem = it; cropSel = null; const src = orient(it.bmp, { rotate: it.rotate }); const c = $('#cropCanvas');
  const s = Math.min(1, 1200 / Math.max(src.width, src.height)); c.width = Math.round(src.width * s); c.height = Math.round(src.height * s);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); $('#cropRect').hidden = true; $('#cropModal').hidden = false;
}
(function cropEvents() {
  const c = $('#cropCanvas'), r = $('#cropRect'); let start = null;
  const pt = (e) => { const b = c.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) }; };
  const draw = () => { if (!cropSel) return (r.hidden = true); const b = c.getBoundingClientRect(), w = c.parentElement.getBoundingClientRect();
    Object.assign(r.style, { left: b.left - w.left + cropSel.x * b.width + 'px', top: b.top - w.top + cropSel.y * b.height + 'px', width: cropSel.w * b.width + 'px', height: cropSel.h * b.height + 'px' }); r.hidden = false; };
  c.addEventListener('pointerdown', (e) => { start = pt(e); c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', (e) => { if (!start) return; const p = pt(e); cropSel = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }; draw(); });
  c.addEventListener('pointerup', () => { start = null; if (cropSel && (cropSel.w < 0.03 || cropSel.h < 0.02)) { cropSel = null; draw(); } });
  $('#cropOk').onclick = () => { if (cropItem) cropItem.crop = cropSel; $('#cropModal').hidden = true; renderQueue(); };
  $('#cropAll').onclick = () => { if (cropItem) cropItem.crop = null; $('#cropModal').hidden = true; renderQueue(); };
  $('#cropCancel').onclick = () => { $('#cropModal').hidden = true; };
})();

// ---------- extraction ----------
function setProgress(frac, text) { $('#progress').hidden = false; $('#progBar').style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%'; if (text) $('#progText').textContent = text; }
const post = (t) => { let s = t; if (settings.half) s = fixHalfSpace(s); if (settings.digits !== 'keep') s = convertDigits(s, settings.digits); return s; };

export async function extract() {
  if (state.running || !state.queue.length) return; state.running = true; renderQueue();
  const jobs = state.queue.filter((x) => !x.done); const totalPages = jobs.reduce((n, j) => n + j.pages, 0); let donePages = 0; const t0 = performance.now();
  const ocrOpts = (base) => ({ lang: settings.lang, mode: settings.mode, deskew: settings.deskew, enhance: settings.enhance,
    progress: (p) => setProgress((donePages + p) / totalPages, `${base} — ${faNum(Math.round(p * 100))}٪`) });
  try {
    setProgress(0, 'بارگذاری موتور OCR و مدل فارسی (فقط بار اول کمی طول می‌کشد)…');
    for (const job of jobs) {
      const res = { id: uid(), name: job.name, kind: job.kind, date: Date.now(), thumb: job.thumb, pages: [] };
      if (job.kind === 'image') {
        const label = `${job.name}`; const src = orient(job.bmp, { rotate: job.rotate, crop: job.crop });
        const r = await recognize(src, ocrOpts(`خواندن ${label}`));
        res.pages.push({ n: 1, text: post(r.text), source: 'ocr', confidence: r.confidence, ms: r.ms, used: r.used, skew: r.info.skew });
        donePages++;
      } else {
        const doc = await openPdf(job.bytes.slice());
        for (let n = 1; n <= doc.numPages; n++) {
          const base = `${job.name} — صفحه ${faNum(n)} از ${faNum(doc.numPages)}`;
          setProgress(donePages / totalPages, base);
          const tl = settings.forceOcr ? null : await pdfPageText(doc, n);
          if (tl && tl.usable && !job.rotate) { res.pages.push({ n, text: post(tl.text), source: 'pdf-text', confidence: 100, ms: 0 }); }
          else { let c = await renderPage(doc, n); if (job.rotate) c = orient(c, { rotate: job.rotate });
            const r = await recognize(c, ocrOpts(`OCR ${base}`)); res.pages.push({ n, text: post(r.text), source: tl && tl.letters ? 'ocr-broken-text' : 'ocr', confidence: r.confidence, ms: r.ms, used: r.used }); }
          donePages++;
        }
        doc.destroy();
      }
      job.done = true; state.results.unshift(res); renderResults(); renderQueue();
      if (settings.save) await saveDoc(res).catch(() => {});
    }
    const secs = (performance.now() - t0) / 1000;
    setProgress(1, `تمام شد ✓ — ${faNum(totalPages)} صفحه در ${faNum(secs.toFixed(1))} ثانیه`);
    state.queue = state.queue.filter((x) => !x.done);
  } catch (e) { console.error(e); setProgress(1, 'خطا: ' + (e && e.message ? e.message : e)); toast('مشکلی پیش آمد؛ دوباره امتحان کنید'); }
  finally { state.running = false; renderQueue(); document.body.dataset.done = String(Date.now()); }
}

// ---------- results ----------
const docText = (r) => r.pages.map((p) => p.text).join('\n\n');
function renderResults() {
  $('#results').innerHTML = state.results.map((r) => `<div class="card result" data-id="${r.id}">
    <div class="head"><h2>📄 ${esc(r.name)}</h2><span class="muted">${jdate(r.date)}</span></div>
    <div class="toolbar">
      <button class="btn primary" data-act="copy">📋 کپی همه</button>
      <button class="btn" data-act="share">📤 اشتراک</button>
      <button class="btn" data-act="txt">⬇︎ txt</button>
      <button class="btn" data-act="docx">⬇︎ Word</button>
    </div>
    <div class="tools" aria-label="ابزار اصلاح متن">
      <button class="btn" data-act="digits">۱۲۳ ⇄ 123</button>
      <button class="btn" data-act="join">↤ پیوستن سطرها</button>
      <button class="btn" data-act="half">نیم‌فاصله</button>
      <button class="btn" data-act="punct">، ویرگول/فاصله</button>
      <button class="btn ghost" data-act="undo" ${r.undo ? '' : 'disabled'}>↶ بازگردانی</button>
    </div>
    ${r.pages.map((p, i) => `<div class="page"><div class="ph"><span>${r.pages.length > 1 ? `صفحه ${faNum(p.n)}` : ''}
      ${p.source === 'pdf-text' ? '<span class="tag pdf">متن داخلی PDF</span>' : `<span class="tag ${p.confidence < 65 ? 'low' : ''}">OCR · اطمینان ${faNum(p.confidence)}٪</span>`}</span>
      <button class="btn small" data-act="copyp" data-i="${i}">کپی${r.pages.length > 1 ? ' صفحه' : ''}</button></div>
      <textarea class="out" data-i="${i}" spellcheck="false" aria-label="متن استخراج‌شده">${esc(p.text)}</textarea></div>`).join('')}
    <div class="stats">${statsLine(r)}</div></div>`).join('');
}
const statsLine = (r) => { const s = stats(docText(r)); return `${faNum(s.words)} کلمه، ${faNum(s.chars)} نویسه، ${faNum(r.pages.length)} صفحه`; };
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); } catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast('کپی شد ✓');
}
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
const baseName = (n) => n.replace(/\.[^.]+$/, '') || 'matn';
function transform(r, fn) { r.undo = r.pages.map((p) => p.text); r.pages.forEach((p) => (p.text = fn(p.text))); }
$('#results').addEventListener('input', (e) => { const ta = e.target.closest('textarea.out'); if (!ta) return; const r = state.results.find((x) => x.id === ta.closest('.result').dataset.id);
  r.pages[+ta.dataset.i].text = ta.value; ta.closest('.result').querySelector('.stats').textContent = statsLine(r); clearTimeout(r.t); r.t = setTimeout(() => settings.save && saveDoc(strip(r)).catch(() => {}), 600); });
const strip = ({ undo, t, ...r }) => r;
$('#results').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return; const card = b.closest('.result'); const r = state.results.find((x) => x.id === card.dataset.id); const act = b.dataset.act;
  if (act === 'copy') return copyText(docText(r));
  if (act === 'copyp') return copyText(r.pages[+b.dataset.i].text);
  if (act === 'txt') return download(baseName(r.name) + '.txt', new Blob(['\ufeff' + docText(r)], { type: 'text/plain;charset=utf-8' }));
  if (act === 'docx') return download(baseName(r.name) + '.docx', new Blob([buildDocx(r.pages.map((p) => ({ title: r.pages.length > 1 ? `صفحه ${faNum(p.n)}` : '', text: p.text })))], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  if (act === 'share') { const text = docText(r); if (navigator.share) { try { await navigator.share({ title: r.name, text }); } catch {} } else copyText(text); return; }
  if (act === 'digits') { const to = hasPersianDigits(docText(r)) ? 'en' : 'fa'; transform(r, (t) => convertDigits(t, to)); toast(to === 'fa' ? 'ارقام فارسی شد' : 'ارقام انگلیسی شد'); }
  if (act === 'join') { transform(r, joinLines); toast('سطرها به هم پیوستند'); }
  if (act === 'half') { transform(r, fixHalfSpace); toast('نیم‌فاصله‌ها اصلاح شد'); }
  if (act === 'punct') { transform(r, tidyPunctuation); toast('فاصله‌گذاری علائم اصلاح شد'); }
  if (act === 'undo' && r.undo) { r.pages.forEach((p, i) => (p.text = r.undo[i])); r.undo = null; }
  renderResults(); if (settings.save) saveDoc(strip(r)).catch(() => {});
});

// ---------- history ----------
async function renderHistory() {
  const docs = await listDocs().catch(() => []); const el = $('#histList');
  el.innerHTML = docs.length ? docs.map((d) => `<div class="card hist" data-id="${d.id}">${d.thumb ? `<img src="${d.thumb}" alt="">` : ''}
    <div class="meta"><b>${esc(d.name)}</b><div class="muted">${jdate(d.date)}، ${faNum(d.pages.length)} صفحه</div><div class="snip">${esc(docText(d).slice(0, 140))}</div></div>
    <div class="row"><button class="btn small" data-act="open">باز کردن</button><button class="btn small" data-act="copy">کپی</button><button class="btn small danger" data-act="del" aria-label="حذف">🗑</button></div></div>`).join('')
    : '<div class="empty">هنوز چیزی استخراج نشده است.</div>';
  $('#clearHist').disabled = !docs.length;
}
$('#histList').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return; const id = b.closest('.hist').dataset.id;
  if (b.dataset.act === 'del') { await deleteDoc(id); state.results = state.results.filter((r) => r.id !== id); renderResults(); toast('حذف شد'); return renderHistory(); }
  const d = await getDoc(id); if (!d) return;
  if (b.dataset.act === 'copy') return copyText(docText(d));
  if (!state.results.some((r) => r.id === id)) state.results.unshift(d); renderResults(); showTab('extract'); $(`.result[data-id="${id}"]`)?.scrollIntoView({ block: 'start' });
});
$('#clearHist').addEventListener('click', async () => { if (!confirm('همه تاریخچه پاک شود؟')) return; await clearDocs(); toast('تاریخچه پاک شد'); renderHistory(); });

// ---------- tabs, paste, drop ----------
function showTab(t) { $$('.view').forEach((v) => (v.hidden = v.dataset.view !== t)); $$('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t)); if (t === 'history') renderHistory(); window.scrollTo(0, 0); }
$('.tabbar').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
for (const id of ['#fileInput', '#camInput']) $(id).addEventListener('change', async (e) => { const n = await addFiles([...e.target.files]); e.target.value = ''; if (n) toast(`${faNum(n)} فایل اضافه شد`); });
$('#runBtn').addEventListener('click', extract);
document.addEventListener('paste', async (e) => {
  if (e.target.closest && e.target.closest('textarea')) return; const files = [...(e.clipboardData?.files || [])];
  if (files.length) { e.preventDefault(); const n = await addFiles(files.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `چسبانده-${faNum(i + 1)}.png`, { type: f.type })))); if (n) toast('تصویر چسبانده شد'); }
});
$('#pasteBtn').addEventListener('click', async () => {
  try {
    if (!navigator.clipboard?.read) throw new Error('no');
    const items = await navigator.clipboard.read(); const files = [];
    for (const it of items) { const type = it.types.find((t) => t.startsWith('image/')); if (type) files.push(new File([await it.getType(type)], `چسبانده-${faNum(files.length + 1)}.png`, { type })); }
    if (!files.length) return toast('در کلیپ‌بورد تصویری نیست. اول روی اسکرین‌شات «Copy» بزنید.', 3200);
    await addFiles(files); toast('تصویر چسبانده شد');
  } catch { toast('اجازه دسترسی به کلیپ‌بورد داده نشد؛ می‌توانید با نگه‌داشتن انگشت و «Paste» هم بچسبانید.', 3500); }
});
const pick = $('.pick');
['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => { e.preventDefault(); pick.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => { e.preventDefault(); pick.classList.remove('drag'); }));
document.addEventListener('drop', (e) => { const f = [...(e.dataTransfer?.files || [])]; if (f.length) addFiles(f); });
const net = () => { const b = $('#netBadge'); b.textContent = navigator.onLine ? '🔒 روی دستگاه' : '✈︎ آفلاین'; b.classList.toggle('off', !navigator.onLine); };
addEventListener('online', net); addEventListener('offline', net);

// ---------- boot ----------
bindSeg('#langSeg', 'lang'); bindSeg('#modeSeg', 'mode'); bindSeg('#digitSeg', 'digits');
bindChk('#optDeskew', 'deskew'); bindChk('#optEnhance', 'enhance'); bindChk('#optForceOcr', 'forceOcr'); bindChk('#optHalf', 'half'); bindChk('#optSave', 'save');
$('#ver').textContent = faNum(VERSION); net(); renderQueue();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
// download + cache the OCR engine and Persian model in the background so the app works offline afterwards
if (navigator.onLine) setTimeout(() => warmUp(settings.lang), 1200);
window.__matn = { state, settings, addFiles, extract, VERSION };
document.body.dataset.ready = '1';
