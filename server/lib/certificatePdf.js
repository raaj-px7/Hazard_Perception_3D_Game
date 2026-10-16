// Builds the certificate as a one-page landscape A4 PDF with no dependencies.
// Uses the built-in PDF fonts (Helvetica, Helvetica-Bold), so nothing is embedded and the file stays small.
// Text is converted to Latin-1; characters outside it print as "?".

// Glyph widths (per 1000 units) for ASCII 32..126, from the standard Helvetica metrics.
const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const HELV_B = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
const TABLES = { F1: HELV, F2: HELV_B };

const W = 842, H = 595; // A4 landscape in points

const clean = (s) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim();
const latin1 = (s) => Array.from(s).map((ch) => (ch.charCodeAt(0) <= 255 && ch.charCodeAt(0) >= 32 ? ch : '?')).join('');
const esc = (s) => latin1(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const widthOf = (s, font, size) => Array.from(latin1(s)).reduce((sum, ch) => {
  const c = ch.charCodeAt(0);
  return sum + (c >= 32 && c <= 126 ? TABLES[font][c - 32] : 556);
}, 0) * size / 1000;

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const n = (x) => (Math.round(x * 100) / 100).toString();

function certificatePdf(c) {
  const ops = [];
  const color = (hex, stroke) => {
    const v = [0, 2, 4].map((i) => (parseInt(hex.slice(1 + i, 3 + i), 16) / 255).toFixed(3)).join(' ');
    ops.push(`${v} ${stroke ? 'RG' : 'rg'}`);
  };
  const rect = (x, y, w, h, fill) => { color(fill); ops.push(`${n(x)} ${n(y)} ${n(w)} ${n(h)} re f`); };
  const frame = (x, y, w, h, hex, width) => { color(hex, true); ops.push(`${n(width)} w ${n(x)} ${n(y)} ${n(w)} ${n(h)} re S`); };
  const text = (s, x, y, font, size, hex, { center, maxWidth } = {}) => {
    s = clean(s);
    let sz = size;
    if (maxWidth) while (sz > 8 && widthOf(s, font, sz) > maxWidth) sz -= 0.5; // shrink long names to fit
    const px = center ? x - widthOf(s, font, sz) / 2 : x;
    color(hex);
    ops.push(`BT /${font} ${n(sz)} Tf ${n(px)} ${n(y)} Td (${esc(s)}) Tj ET`);
  };

  const NAVY = '#14202e', GOLD = '#d9a400', INK = '#1d2733', MUTED = '#5d6978';
  rect(0, 0, W, H, '#fbf9f3');
  rect(0, H - 14, W, 14, NAVY); // top and bottom bands
  rect(0, 0, W, 14, NAVY);
  frame(34, 34, W - 68, H - 68, GOLD, 3);
  frame(42, 42, W - 84, H - 84, NAVY, 0.8);

  const cx = W / 2;
  text(c.company.toUpperCase(), cx, 500, 'F2', 15, GOLD, { center: true });
  text('CERTIFICATE OF COMPLETION', cx, 458, 'F2', 36, NAVY, { center: true });
  text('Workplace Safety Hazard Inspection', cx, 432, 'F1', 15, MUTED, { center: true });
  text('This is to certify that', cx, 388, 'F1', 14, MUTED, { center: true });
  text(c.name, cx, 336, 'F2', 40, INK, { center: true, maxWidth: W - 200 });
  rect(cx - 190, 322, 380, 1.2, GOLD);
  text(`Employee ID ${c.employeeId}   |   ${c.company}`, cx, 298, 'F1', 13, MUTED, { center: true, maxWidth: W - 200 });
  text('has completed the hazard inspection assessment and qualified with a score of', cx, 260, 'F1', 14, INK, { center: true });
  text(`${c.score}%  (Grade ${c.grade})`, cx, 222, 'F2', 28, NAVY, { center: true });

  // three details across the bottom
  const cols = [[190, 'DATE ISSUED', fmtDate(c.issuedAt)], [cx, 'VALID UNTIL', fmtDate(c.expiresAt)], [W - 190, 'CERTIFICATE NO.', c.number]];
  cols.forEach(([x, label, value]) => {
    rect(x - 105, 148, 210, 0.8, MUTED);
    text(value, x, 156, 'F2', 13, INK, { center: true, maxWidth: 205 });
    text(label, x, 130, 'F1', 9, MUTED, { center: true });
  });
  text('Recertification is required before the valid-until date. This certificate records a result held by the issuing company.', cx, 78, 'F1', 9, MUTED, { center: true });

  const content = Buffer.from(ops.join('\n'), 'latin1');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  const offsets = [];
  let pos = chunks[0].length;
  const add = (buf) => { chunks.push(buf); pos += buf.length; };
  objs.forEach((body, i) => { offsets.push(pos); add(Buffer.from(`${i + 1} 0 obj\n${body}\nendobj\n`, 'latin1')); });
  offsets.push(pos);
  add(Buffer.concat([Buffer.from(`6 0 obj\n<< /Length ${content.length} >>\nstream\n`, 'latin1'), content, Buffer.from('\nendstream\nendobj\n', 'latin1')]));
  const xref = pos;
  let table = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { table += `${String(o).padStart(10, '0')} 00000 n \n`; });
  add(Buffer.from(`${table}trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R /Info << /Title (${esc(`Safety certificate ${c.number}`)}) /Producer (Hazard Hunt) >> >>\nstartxref\n${xref}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(chunks);
}

module.exports = { certificatePdf };
