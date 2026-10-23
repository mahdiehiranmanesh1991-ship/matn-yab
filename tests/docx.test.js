import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, buildDocx } from '../lib/docx.js';
test('crc32 known vector', () => { assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926); });
test('docx is a valid zip with RTL paragraphs', () => {
  const z = buildDocx([{ title: 'صفحه ۱', text: 'سلام دنیا\nHello' }]);
  assert.equal(new DataView(z.buffer).getUint32(0, true), 0x04034b50);
  const s = new TextDecoder().decode(z); assert.ok(s.includes('word/document.xml')); assert.ok(s.includes('<w:bidi/>')); assert.ok(s.includes('سلام دنیا'));
  assert.ok(s.includes('<w:t xml:space="preserve">Hello</w:t>'));
});
