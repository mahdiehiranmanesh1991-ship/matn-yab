export function normForCer(s) {
  return s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/\u200c/g, ' ').normalize('NFKC')
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 0x06F0)).replace(/\s+/g, ' ').trim();
}
export function lev(a, b) { a = [...a]; b = [...b]; let p = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] !== b[j - 1])); p = c; } return p[b.length]; }
export const cer = (h, r) => { const R = normForCer(r); return lev(normForCer(h), R) / Math.max(1, [...R].length); };
