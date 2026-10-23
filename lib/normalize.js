// Persian text normalisation helpers for «متن‌یاب». Pure functions, no DOM — shared by the app and node tests.
export const ZWNJ = '\u200c';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const BIDI_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\u061c\ufeff]/g;
export const ARABIC_LETTER = /[\u0620-\u064a\u066e-\u06d3\u06d5\u06fa-\u06fc\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufefc]/;
export const isPresentationForm = (ch) => { const c = ch.codePointAt(0); return (c >= 0xfb50 && c <= 0xfdff) || (c >= 0xfe70 && c <= 0xfefc); };

/** Remove invisible bidi control marks (Tesseract/Word/Chrome insert LRM/RLM around Latin runs). */
export const stripBidiMarks = (s) => s.replace(BIDI_MARKS, '');

/** Arabic presentation forms (ﻪ ﻻ ﺧ …) → base letters, only inside the presentation-form blocks. */
export const fromPresentationForms = (s) => s.replace(/[\ufb50-\ufdff\ufe70-\ufefc]/g, (c) => c.normalize('NFKC'));

/** Arabic ي/ى/ك/ە → Persian ی/ک, kashida removed, Arabic-Indic digits → Persian digits. */
export function persianLetters(s) {
  return s.replace(/[يىۍې]/g, 'ی').replace(/ك/g, 'ک').replace(/ە/g, 'ه').replace(/\u0640/g, '')
    .replace(/[٠-٩]/g, (d) => FA_DIGITS[AR_DIGITS.indexOf(d)]);
}

/** Convert digits. to = 'fa' | 'en'. Tokens that contain Latin letters (emails, URLs, A4, v2) keep their digits ASCII when to='fa'. */
export function convertDigits(s, to) {
  if (to === 'en') return s.replace(/[۰-۹٠-٩]/g, (d) => String((FA_DIGITS.indexOf(d) + 1 || AR_DIGITS.indexOf(d) + 1) - 1));
  return s.replace(/\S+/g, (tok) => (/[A-Za-z@]/.test(tok) ? tok : tok.replace(/[0-9]/g, (d) => FA_DIGITS[+d]).replace(/[٠-٩]/g, (d) => FA_DIGITS[AR_DIGITS.indexOf(d)])));
}
export const hasPersianDigits = (s) => /[۰-۹]/.test(s);

/** Join hard-wrapped lines into paragraphs. Blank lines stay paragraph breaks. English soft hyphens are merged. */
export function joinLines(s) {
  return s.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n+/).map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean)
    .reduce((acc, l) => (!acc ? l : /[A-Za-z]-$/.test(acc) && /^[a-z]/.test(l) ? acc.slice(0, -1) + l : acc + ' ' + l), '')).filter(Boolean).join('\n\n');
}

const FA = '[\u0622-\u063a\u0641-\u064a\u067e\u0686\u0698\u06a9\u06af\u06cc]';
const END = '(?=$|[\\s.،؛:!?؟»)\\]\\-])';
// verb stems after an attached «می/نمی»: present stems need a personal ending (so «میدان»، «میز» stay untouched)
const PRESENT = 'خواه|شو|کن|گوی|گو|توان|دان|رو|آی|بین|گیر|ده|زن|باش|نویس|خوان|رس|گذار|ساز|یاب|پرداز|کش|افت|گرد|مان|پذیر|دار|فرست|پرس|شناس|بر|آور|خور|گذر|ترس|نشین|ایست';
const PAST = 'خواست|شد|کرد|گفت|توانست|دانست|رفت|آمد|دید|گرفت|داد|زد|بود|نوشت|خواند|رسید|گذاشت|ساخت|یافت|پرداخت|کشید|افتاد|گشت|ماند|پذیرفت|داشت|فرستاد|پرسید|شناخت|برد|آورد|خورد|گذشت|ترسید|نشست|ایستاد';
const W_END = '(?=$|[\\s.،؛:!?؟»)\\]])';
/** «نیم‌فاصله» fixer — the common, safe Persian ZWNJ rules (می/نمی, ها/های, تر/ترین, ه + ای/ام/اند …). */
export function fixHalfSpace(s) {
  let t = s.replace(/[ \t]*\u200c+[ \t]*/g, ZWNJ).replace(/\u200c{2,}/g, ZWNJ);
  t = t.replace(new RegExp(`(^|[\\s«(])(ن?می)[ \\t]+(?=${FA})`, 'gm'), `$1$2${ZWNJ}`);
  t = t.replace(new RegExp(`(^|[\\s«(])(ن?می)(?=(?:(?:${PRESENT})(?:م|ی|د|یم|ید|ند)|(?:${PAST})(?:م|ی|یم|ید|ند)?)${W_END})`, 'gm'), `$1$2${ZWNJ}`);
  t = t.replace(new RegExp(`(${FA})[ \\t]+(ها|های|هایی|هایم|هایت|هایش|هایمان|هایتان|هایشان|تر|ترین|تری|ترها)${END}`, 'g'), `$1${ZWNJ}$2`);
  t = t.replace(new RegExp(`(${FA}ه)[ \\t]+(ای|ام|ات|اش|اید|ایم|اند|ایی)${END}`, 'g'), `$1${ZWNJ}$2`);
  t = t.replace(/(^|\s)(آن|این)(ها|های|هایی)(?=$|\s|[.،؛!؟])/gm, `$1$2${ZWNJ}$3`);
  t = t.replace(/(^|[\s«(])(بی)[ \t]+(?=[\u0622-\u06cc]{3,})/gm, `$1$2${ZWNJ}`);
  // a ZWNJ after a non-joining letter, or at word edges, is meaningless
  t = t.replace(/([اآأإدذرزژوؤ])\u200c/g, '$1').replace(/(^|\s)\u200c|\u200c(?=\s|$)/gm, '$1');
  return t;
}

/** Tidy punctuation spacing the way Persian typesetting expects. */
export function tidyPunctuation(s) {
  return s.replace(/[ \t]+([،؛:.!؟?»)\]])/g, '$1').replace(/([«(\[])[ \t]+/g, '$1').replace(/([،؛])(?=[^\s\d])/g, '$1 ')
    .replace(/[ \t]*,[ \t]*(?=[\u0600-\u06ff])/g, '، ');
}

/** Default clean-up applied to every OCR/PDF result. */
export function cleanText(s) {
  return persianLetters(stripBidiMarks(fromPresentationForms(s.normalize('NFC'))))
    .replace(/\r\n?/g, '\n').replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n')
    .split('\n').map(stripBorderJunk).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** OCR reads chat-bubble / table borders as stray | [ ] { } at the edges of a line — drop those lone glyphs. */
export function stripBorderJunk(line) {
  return line.replace(/^(?:[|\[\]{}¦]\s+)+/, '').replace(/(?:\s+[|\[\]{}¦])+$/, '').replace(/^[|\[\]{}¦]$/, '');
}

/** Text statistics shown under the editor. */
export function stats(s) {
  const t = s.trim();
  return { chars: [...t.replace(/\s/g, '')].length, words: t ? t.split(/\s+/).length : 0, lines: t ? t.split('\n').length : 0 };
}
