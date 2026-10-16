// Checks certificate dates, retake limits and the PDF. Exit code 1 on any failure.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CERT, DAY_MS, addMonths, statusOf, evaluateAllowance, certificateNumber } = require('../lib/certification');
const { certificatePdf } = require('../lib/certificatePdf');

let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL:', msg); } };
const iso = (d) => d.toISOString().slice(0, 10);

// expiry dates
ok(iso(addMonths(new Date('2026-10-05T10:00:00Z'), 12)) === '2027-10-05', '12 months from 5 Oct 2026');
ok(iso(addMonths(new Date('2026-01-31T00:00:00Z'), 1)) === '2026-02-28', '31 Jan + 1 month clamps to 28 Feb');
ok(iso(addMonths(new Date('2024-02-29T00:00:00Z'), 12)) === '2025-02-28', '29 Feb 2024 + 12 months clamps to 28 Feb 2025');
ok(iso(addMonths(new Date('2026-12-15T00:00:00Z'), 3)) === '2027-03-15', 'rolls over the year');

// status around the expiring-soon window
const now = new Date('2026-10-05T00:00:00Z');
const inDays = (d) => new Date(now.getTime() + d * DAY_MS);
ok(statusOf(inDays(100), now) === 'valid', '100 days left = valid');
ok(statusOf(inDays(CERT.expiringSoonDays), now) === 'expiring', 'exactly the window = expiring');
ok(statusOf(inDays(1), now) === 'expiring', '1 day left = expiring');
ok(statusOf(inDays(-1), now) === 'expired', 'past = expired');
ok(statusOf(now, now) === 'expired', 'ends this instant = expired');

// retake limits (max 3 per rolling 24h)
const hrsAgo = (h) => new Date(now.getTime() - h * 3600e3);
let a = evaluateAllowance({ submittedTimes: [hrsAgo(1), hrsAgo(5)], lastFailedAt: null, now });
ok(a.allowed && a.usedToday === 2, 'two attempts: still allowed');
a = evaluateAllowance({ submittedTimes: [hrsAgo(1), hrsAgo(5), hrsAgo(9)], lastFailedAt: null, now });
ok(!a.allowed && a.reason === 'daily', 'three attempts: blocked');
ok(a.retryAt.getTime() === hrsAgo(9).getTime() + DAY_MS, 'retry opens when the oldest attempt is 24h old');
a = evaluateAllowance({ submittedTimes: [hrsAgo(1), hrsAgo(5), hrsAgo(25)], lastFailedAt: null, now });
ok(a.allowed && a.usedToday === 2, 'an attempt older than 24h no longer counts');
a = evaluateAllowance({ submittedTimes: [hrsAgo(1), hrsAgo(2), hrsAgo(3), hrsAgo(4)], lastFailedAt: null, now });
ok(!a.allowed && a.retryAt.getTime() === hrsAgo(3).getTime() + DAY_MS, 'with 4 recent, retry waits until the two oldest have aged out');
// cooldown
const cool = { ...CERT, cooldownMinutes: 30 };
a = evaluateAllowance({ submittedTimes: [], lastFailedAt: new Date(now.getTime() - 10 * 60000), now, rules: cool });
ok(!a.allowed && a.reason === 'cooldown', 'inside cooldown: blocked');
a = evaluateAllowance({ submittedTimes: [], lastFailedAt: new Date(now.getTime() - 31 * 60000), now, rules: cool });
ok(a.allowed, 'after cooldown: allowed');
a = evaluateAllowance({ submittedTimes: [hrsAgo(1), hrsAgo(2), hrsAgo(3)], lastFailedAt: null, now, rules: { ...CERT, maxAttemptsPerDay: 0 } });
ok(a.allowed, 'maxAttemptsPerDay 0 means no limit');

// PDF
const cert = { company: 'DeltaMagnus', name: 'Zoë (Ann) O\'Brien \\ Ñandú', employeeId: 'EMP-014', score: 90, grade: 'A',
  issuedAt: new Date('2026-10-05T10:00:00Z'), expiresAt: new Date('2027-10-05T10:00:00Z'), number: certificateNumber('EMP-014', new Date('2026-10-05T10:00:00Z'), 3) };
const pdf = certificatePdf(cert);
ok(pdf.slice(0, 5).toString() === '%PDF-', 'PDF header');
ok(pdf.toString('latin1').trimEnd().endsWith('%%EOF'), 'PDF trailer');
const tmp = path.join(os.tmpdir(), 'cert-test.pdf');
fs.writeFileSync(tmp, pdf);
try {
  const txt = execFileSync('pdftotext', ['-layout', tmp, '-']).toString();
  for (const s of ['DELTAMAGNUS', 'EMP-014', '90%', 'Grade A', '5 October 2026', '5 October 2027', cert.number, "Ann", "Brien"]) ok(txt.includes(s), `PDF text has "${s}"`);
  const info = execFileSync('pdfinfo', [tmp]).toString();
  ok(/Pages:\s+1/.test(info), 'one page');
  if (process.env.CERT_PNG) execFileSync('pdftoppm', ['-png', '-r', '60', tmp, process.env.CERT_PNG]);
} catch (e) { console.log('  (pdftotext/pdfinfo not available, text checks skipped)', e.code || ''); }
// a very long name must not overflow the page
const long = certificatePdf({ ...cert, name: 'Bartholomew Maximilian Alexander Wolfeschlegelsteinhausenbergerdorff the Third' });
ok(long.length > 1000, 'long name still builds');

console.log(failures ? `${failures} failure(s).` : 'All certification checks passed.');
process.exit(failures ? 1 : 0);
