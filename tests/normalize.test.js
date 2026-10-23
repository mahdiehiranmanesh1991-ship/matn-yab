import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripBidiMarks, fromPresentationForms, persianLetters, convertDigits, joinLines, fixHalfSpace, tidyPunctuation, cleanText, stats } from '../lib/normalize.js';

test('bidi marks removed', () => { assert.equal(stripBidiMarks('\u200fشماره\u200e 123\u200e'), 'شماره 123'); });
test('presentation forms → base letters (incl. lam-alef ligature)', () => {
  assert.equal(fromPresentationForms('ﺧﺮﺩ'), 'خرد'); assert.equal(fromPresentationForms('ﻻ'), 'لا'); assert.equal(fromPresentationForms('ﮔﻞ'), 'گل');
  assert.equal(fromPresentationForms('abc ١٢'), 'abc ١٢');
});
test('Arabic ي/ك/ى → Persian, kashida removed, Arabic-Indic digits → Persian', () => {
  assert.equal(persianLetters('انديشه كرمان مصطفى'), 'اندیشه کرمان مصطفی');
  assert.equal(persianLetters('مـــحـکمه'), 'محکمه'); assert.equal(persianLetters('٠١٢٣٤٥٦٧٨٩'), '۰۱۲۳۴۵۶۷۸۹');
});
test('digit conversion both ways; Latin tokens keep ASCII digits', () => {
  assert.equal(convertDigits('چک ۱۲۳ و 456', 'en'), 'چک 123 و 456');
  assert.equal(convertDigits('چک 123 مورخ 1405/03/15', 'fa'), 'چک ۱۲۳ مورخ ۱۴۰۵/۰۳/۱۵');
  assert.equal(convertDigits('info2@example.com A4 و 12', 'fa'), 'info2@example.com A4 و ۱۲');
  assert.equal(convertDigits('٣ و ۴', 'en'), '3 و 4');
});
test('join lines keeps paragraphs and merges English hyphenation', () => {
  assert.equal(joinLines('سطر اول\nسطر دوم\n\nبند دوم\nادامه'), 'سطر اول سطر دوم\n\nبند دوم ادامه');
  assert.equal(joinLines('docu-\nment text'), 'document text');
});
test('half-space (ZWNJ) fixer', () => {
  const Z = '\u200c';
  assert.equal(fixHalfSpace('می شود'), `می${Z}شود`);
  assert.equal(fixHalfSpace('نمی خواهم'), `نمی${Z}خواهم`);
  assert.equal(fixHalfSpace('میخواهم بروم'), `می${Z}خواهم بروم`);
  assert.equal(fixHalfSpace('کتاب ها و خانه ای بزرگ تر'), `کتاب${Z}ها و خانه${Z}ای بزرگ${Z}تر`);
  assert.equal(fixHalfSpace('آنها رفته اند.'), `آن${Z}ها رفته${Z}اند.`);
  assert.equal(fixHalfSpace('میز و میدان'), 'میز و میدان'); // not a prefix
  assert.equal(fixHalfSpace('دارو\u200cها'), 'داروها'); // ZWNJ after a non-joining letter is meaningless
  assert.equal(fixHalfSpace('میدانم'), `می${Z}دانم`);
  assert.equal(fixHalfSpace('میزد'), `می${Z}زد`);
});
test('punctuation spacing', () => { assert.equal(tidyPunctuation('سلام ، خوبی ؟ « متن »'), 'سلام، خوبی؟ «متن»'); });
test('cleanText = all safe fixes', () => {
  assert.equal(cleanText('\u200fﺑﻪ  نام\u200e   خداوند\n\n\n\nكرمان  '), 'به نام خداوند\n\nکرمان');
});
test('stats', () => { assert.deepEqual(stats('سلام دنیا\nخط دوم'), { chars: 13, words: 4, lines: 2 }); });

test('cleanText drops lone border glyphs from chat bubbles, keeps real brackets', async () => {
  const { cleanText } = await import('../lib/normalize.js');
  assert.equal(cleanText('| جلسه دادگاه کی برگزار میشه؟ ]'), 'جلسه دادگاه کی برگزار میشه؟');
  assert.equal(cleanText('[ مدارک رو همراه خودتون'), 'مدارک رو همراه خودتون');
  assert.equal(cleanText('سامانه ثنا (Sana) [۱]'), 'سامانه ثنا (Sana) [۱]');
});
