# متن‌یاب — Matn-Yab

**متن عکس، اسکرین‌شات و PDF را روی خود گوشی بیرون بکشید — فارسی و English، بدون اینترنت، بدون سرور.**
*On-device text extraction from screenshots, photos and PDFs — Persian + English, offline, no server, no API key.*

نسخهٔ وب‌اپ (PWA) برای آیفون/اندروید/دسکتاپ. همهٔ پردازش داخل مرورگر انجام می‌شود؛ هیچ فایلی آپلود نمی‌شود.

---

## فارسی

### چه می‌کند
- **ورودی:** انتخاب از Photos یا Files (چند فایل با هم)، دوربین، **چسباندن** اسکرین‌شات (دکمهٔ «چسباندن» یا نگه‌داشتن انگشت ← Paste)، کشیدن و رها کردن در دسکتاپ.
- **PDF چندصفحه‌ای:** اگر PDF متن داخلی داشته باشد همان متن (با **اصلاح ترتیب راست‌به‌چپ**، حروف «ي/ك» عربی، شکل‌های نمایشی ﻣﻰ‌ﺷﻮﺩ و بازسازی نیم‌فاصله) برداشته می‌شود؛ اگر متن داخلی نداشته باشد (اسکن) یا خراب باشد (نویسه‌های بی‌معنا)، صفحه رندر و OCR می‌شود.
- **OCR فارسی + English** (برای متن کاملاً فارسی گزینهٔ «فقط فارسی» دقیق‌ترین است) با Tesseract (LSTM) داخل مرورگر و پیش‌پردازش هوشمند: بزرگ‌نمایی متن ریز، خاکستری، کشش کنتراست، معکوس کردن حالت تاریک، **صاف کردن عکس کج**، و برای اسکرین‌شات‌های سخت (حالت تاریک/حباب چت رنگی) یک دور دوم با آستانه‌گذاری تطبیقی Sauvola — بهترینِ دو دور انتخاب می‌شود.
- **چرخش ۹۰ درجه و برش** هر تصویر پیش از استخراج.
- **نتیجهٔ قابل‌ویرایش** با «کپی همه»، کپی هر صفحه، اشتراک (Share Sheet)، دانلود **txt** و **Word (.docx راست‌به‌چپ)**.
- **ابزار تمیزکاری:** تبدیل ارقام ۱۲۳ ⇄ 123 (ایمیل/شماره‌های لاتین دست نمی‌خورند)، پیوستن سطرها، اصلاح نیم‌فاصله (می‌شود، کتاب‌ها، خانه‌ای …)، فاصله‌گذاری علائم، بازگردانی.
- **تاریخچه** در IndexedDB خود دستگاه با حذف تکی/همه (قابل خاموش کردن).
- **آفلاین کامل** بعد از اولین باز شدن (service worker موتور، مدل‌ها و فونت را نگه می‌دارد). فونت وزیرمتن داخل اپ است.

### نصب روی آیفون
Safari ← باز کردن لینک ← دکمهٔ Share ← **Add to Home Screen**. یک بار با اینترنت باز کنید تا موتور (~۱۵ مگابایت) ذخیره شود؛ بعد از آن بدون اینترنت کار می‌کند.

### محدودیت‌ها (صادقانه)
- iOS از **Web Share Target** پشتیبانی نمی‌کند؛ پس در منوی Share عکس‌ها «متن‌یاب» دیده نمی‌شود. راه جایگزین: اسکرین‌شات ← Copy ← در متن‌یاب «چسباندن»، یا انتخاب از Photos/Files.
- دست‌خط، فونت‌های خیلی تزئینی (نستعلیق)، عکس‌های تار یا خیلی کج (>۱۰°) دقت پایینی دارند. Google Lens (ابری) در این موارد بهتر است.
- اعراب و جدول‌های پیچیده حفظ نمی‌شوند؛ خروجی متن ساده است.
- PDFهایی که متن داخلی‌شان با فونت Type3/نقشهٔ ToUnicode خراب ساخته شده (مثلاً «چاپ به PDF» در Chrome) تشخیص داده شده و OCR می‌شوند — کندتر از متن داخلی.
- هر صفحه حدود ۰٫۳ تا ۱ ثانیه روی لپ‌تاپ ۸ هسته‌ای؛ روی آیفون ۲ تا ۴ برابر کندتر انتظار داشته باشید. صفحات PDF برای مصرف حافظه با عرض ۲۰۰۰ پیکسل رندر می‌شوند.

---

## English

### Research (verified 2026-10-23, iTunes Lookup API US / store pages)
| App | Rating (count) | Persian? | Notes |
|---|---|---|---|
| Google (Lens) — iOS id284815942 | 4.65 (5.26 M) · Play Lens 4.7 (2.87 M) | ✅ cloud | Quality reference; needs internet + Google |
| Apple Live Text | built-in | ❌ no Persian | |
| Adobe Scan — id1199564834 | 4.88 (1.6 M) | ❌ | |
| CamScanner — id388627783 | 4.84 (1.96 M) | ✅ cloud, paid | privacy concerns, uploads |
| ABBYY FineReader — id534203582 | 4.75 (19 k) | partial | subscription |
| Genius Scan — id377672876 | 4.9 (1.37 M) | ❌ OCR | |
| Prizmo Go — id1183367390 | 4.36 (278) | cloud only | |
| Text Scanner OCR — id1588056235 | 4.37 (114) | listed | |
| OCR Scanner — id1457704919 | 4.64 (107) | PRO online | |
| Aspose.OCR — id1639797292 | 1.0 | | |
| ایبو (Bazaar eboo.free.ocr) | 4.4 (2,218) · 500 k+ installs | ✅ | complaints: app won't open, ads |
| اسکنیفای (Bazaar com.solu.ocr) | 4.0 (371) · 84 k installs | ✅ online+offline | IAP |
| Google Drive "Open with Docs" | — | ✅ | desktop, ≤2 MB, needs Google |

Gap: nothing on iPhone in Iran that is **Persian-accurate, offline, private, free and handles PDF text layers properly**. Matn-Yab targets exactly that.

### REA notes (reverse-engineering the reference)
- **Google Lens** (cloud): text detection → script identification → line recognition (LSTM/Transformer) → reading-order & paragraph layout → language-aware post-correction. We can't run that model offline, so we reproduce the *pipeline shape* on-device: preprocessing (scale/contrast/invert/deskew) → Tesseract LSTM line recognition with Persian + English models → page-segmentation reading order → Persian post-normalisation (ی/ک, digits, ZWNJ, border-glyph cleanup).
- **Offline modes of Iranian apps** (ایبو/اسکنیفای) are Tesseract-based; their common complaints (dark screenshots, crashes, ads) are addressed by the adaptive second pass and by being a lightweight PWA.
- **PDF text layer**: most "copy from PDF" tools in Persian break word order (visual vs logical), spit presentation forms, Arabic ي/ك and lose ZWNJ. We rebuild lines from glyph positions, apply a small UAX#9-style reorder (digits = weak LTR runs), map presentation forms with NFKC and recover ZWNJ from the shaping form (final/isolated followed by initial). Broken ToUnicode layers (\0 / U+FFFD / PUA > 8 %) fall back to OCR.

### Engine benchmark (headless Chrome, 8 cores, in-app pipeline, CER = char error rate)
| Fixture | fas_best (= «فقط فارسی») | fas_fast | fas_best+eng | **fas_fast+eng (default «فارسی + English»)** |
|---|---|---|---|---|
| clean doc | 0 | 0 | 0 | **0** |
| small UI screenshot | 0 | 0 | 0.144 | **0.032** |
| dark chat screenshot | 0.028 | 0.028 | 0.150 | **0.028** |
| legal text w/ Latin email | 0.099 (email lost) | 0.099 | 0.043 | **0.030** |
| skewed phone photo (−3.6°) | 0 | 0.010 | 0.118 | **0.020** |

Without the adaptive Sauvola second pass the dark chat screenshot is 0.55; without border-glyph cleanup 0.084. Tip: for pure-Persian text «فقط فارسی» is the most accurate. PaddleOCR (v3/v5 Arabic) and transformers.js VLMs were tested/considered and rejected (worse Persian CER, 3–10× larger downloads). Scribe.js has no RTL handling.

PDF text layer (naive pdf.js join → fixed): LibreOffice PDF 0.052 → **0**; legacy visual-order/presentation-forms PDF 0.763 → **0**; Chrome "Print to PDF" (broken ToUnicode) → detected → OCR **0.052**; scanned 2-page → OCR **0.069 / 0**.

Speed: 5 screenshots/photos in **2.3 s** including engine start (263–672 ms each); 4 PDFs (5 pages) in **2.7 s**.

### Tech
Vanilla ES modules, no build step. Tesseract.js 6.0.1 (wasm SIMD/LSTM core, Apache-2.0), PDF.js 4.10.38 legacy build (Apache-2.0), tessdata_best `fas` + tessdata_fast `fas`/`eng` (Apache-2.0), Vazirmatn (OFL-1.1). All self-hosted under `vendor/`, `tessdata/`, `fonts/` — zero external requests (verified by e2e).

```
js/app.js      UI, queue, crop/rotate, results, history, paste, share
js/ocr.js      Tesseract worker + adaptive 2-pass pipeline
js/pdf.js      PDF.js text layer vs render-and-OCR
lib/*.js       pure, unit-tested: normalize (fa text), pdftext (RTL repair), imageproc, docx, cer
sw.js          offline cache (shell + engine cache)
```

### Test
```bash
node --test tests/*.test.js                # 29 unit tests: normalisation, RTL/PDF, image processing, docx
(cd .. && python3 -m http.server 8813 &)    # serve under /matn-yab/ like GitHub Pages
PW_DIR=/path/to/playwright-core node tests/e2e.mjs http://127.0.0.1:8813/matn-yab/   # 35 checks, iPhone 390×844, CER report → tests/e2e-report.json
```
Screenshots: `screenshots/`.

### Deploy
Push to `main` → `.github/workflows/pages.yml` runs unit tests and publishes to GitHub Pages (relative paths; works under `/matn-yab/`).

### Licences
App code MIT. Third-party: see `vendor/*/LICENSE.txt`, `tessdata/README.md`, `fonts/OFL.txt`.
