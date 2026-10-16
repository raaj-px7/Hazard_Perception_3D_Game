const express = require('express');
const mongoose = require('mongoose');
const EmployeeId = require('../models/EmployeeId');
const User = require('../models/User');
const Attempt = require('../models/Attempt');
const { RULES } = require('../lib/inspection');
const { HAZARD_POOL, LEGACY_HAZARD_IDS } = require('../lib/catalog');
const { FINISHED, employeeSummary } = require('../lib/history');
const { COMPANY } = require('../lib/company');
const cert = require('../lib/certification');
const { certificatePdf } = require('../lib/certificatePdf');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth(['admin']));

const ID_RE = /^[A-Z0-9][A-Z0-9-]{2,19}$/;

// Create one or many Employee IDs.
router.post('/employee-ids', async (req, res) => {
  try {
    const raw = Array.isArray(req.body.ids) ? req.body.ids : [];
    const department = String(req.body.department || '').trim().slice(0, 60);
    const ids = [...new Set(raw.map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
    if (!ids.length || ids.length > 500) return res.status(400).json({ error: 'Enter between 1 and 500 Employee IDs.' });
    const bad = ids.filter((i) => !ID_RE.test(i));
    if (bad.length) return res.status(400).json({ error: `Invalid ID: ${bad.slice(0, 5).join(', ')}. Use 3-20 letters, numbers or dashes.` });

    const existing = new Set((await EmployeeId.find({ employeeId: { $in: ids } }).select('employeeId')).map((d) => d.employeeId));
    const fresh = ids.filter((i) => !existing.has(i));
    if (fresh.length) {
      await EmployeeId.insertMany(fresh.map((employeeId) => ({ employeeId, department, createdBy: req.user._id })), { ordered: false });
    }
    res.status(201).json({ created: fresh.length, skipped: [...existing] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.get('/employee-ids', async (req, res) => {
  try {
    const docs = await EmployeeId.find().sort({ createdAt: -1 }).limit(1000).populate('claimedBy', 'name email');
    res.json({
      ids: docs.map((d) => ({
        employeeId: d.employeeId,
        department: d.department,
        claimedBy: d.claimedBy ? { name: d.claimedBy.name, email: d.claimedBy.email } : null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

const fail500 = (res, err) => { console.error(err); res.status(500).json({ error: 'Something went wrong. Please try again.' }); };

// Overview numbers and the hazards employees miss most often.
router.get('/stats', async (req, res) => {
  try {
    const [employees, totals, qualifiedUsers, foundCounts, shownCounts] = await Promise.all([
      User.countDocuments({ role: 'employee' }),
      Attempt.aggregate([
        { $match: FINISHED },
        { $group: { _id: null, attempts: { $sum: 1 }, avg: { $avg: '$result.score' }, passed: { $sum: { $cond: ['$result.qualified', 1, 0] } } } },
      ]),
      Attempt.aggregate([{ $match: { ...FINISHED, 'result.qualified': true } }, { $group: { _id: '$userId' } }, { $count: 'n' }]),
      Attempt.aggregate([{ $match: FINISHED }, { $unwind: '$foundHazardIds' }, { $group: { _id: '$foundHazardIds', n: { $sum: 1 } } }]),
      // How often each hazard appeared. Attempts saved without a layout count as the original fixed set.
      Attempt.aggregate([
        { $match: FINISHED },
        { $project: { refs: { $cond: [
          { $gt: [{ $size: { $ifNull: ['$layout', []] } }, 0] },
          { $map: { input: { $filter: { input: '$layout', as: 'e', cond: { $eq: ['$$e.kind', 'hazard'] } } }, as: 'e', in: '$$e.ref' } },
          LEGACY_HAZARD_IDS,
        ] } } },
        { $unwind: '$refs' },
        { $group: { _id: '$refs', n: { $sum: 1 } } },
      ]),
    ]);
    const t = totals[0] || { attempts: 0, avg: 0, passed: 0 };
    const found = new Map(foundCounts.map((f) => [f._id, f.n]));
    const shown = new Map(shownCounts.map((f) => [f._id, f.n]));
    // "Missed when it appeared": the fair rate now that not every hazard is in every attempt.
    const mostMissed = HAZARD_POOL.filter((h) => shown.get(h.id))
      .map((h) => {
        const appeared = shown.get(h.id);
        const missed = Math.max(0, appeared - (found.get(h.id) || 0));
        return { id: h.id, title: h.title, difficulty: h.difficulty, appeared, missed, percent: Math.round((missed / appeared) * 100) };
      })
      .sort((a, b) => b.percent - a.percent || b.appeared - a.appeared)
      .slice(0, 5);
    res.json({
      employees,
      qualifiedEmployees: qualifiedUsers[0] ? qualifiedUsers[0].n : 0,
      attempts: t.attempts,
      averageScore: Math.round(t.avg),
      passRate: t.attempts ? Math.round((t.passed / t.attempts) * 100) : 0,
      mostMissed,
    });
  } catch (err) { fail500(res, err); }
});

// Certification overview: counts, plus everyone whose certificate is expiring soon or already expired (soonest first).
router.get('/certifications', async (req, res) => {
  try {
    const users = await User.find({ role: 'employee', isActive: true }).lean();
    const certs = await cert.currentForMany(users);
    const counts = { valid: 0, expiring: 0, expired: 0, none: 0 };
    const attention = [];
    for (const u of users) {
      const c = certs.get(String(u._id));
      if (!c) { counts.none++; continue; }
      if (c.status === 'valid') counts.valid++;
      else {
        counts[c.status]++;
        attention.push({ id: u._id, employeeId: u.employeeId, name: u.name, department: u.department, status: c.status, expiresAt: c.expiresAt, daysLeft: c.daysLeft, score: c.score });
      }
    }
    attention.sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));
    res.json({ counts, attention, rules: { validityMonths: cert.CERT.validityMonths, expiringSoonDays: cert.CERT.expiringSoonDays } });
  } catch (err) { fail500(res, err); }
});

// Every employee with summary numbers. Optional ?search= on name, email or Employee ID.
router.get('/employees', async (req, res) => {
  try {
    const q = String(req.query.search || '').trim().slice(0, 60);
    const filter = { role: 'employee' };
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { employeeId: rx }];
    }
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    const stats = await Attempt.aggregate([
      { $match: { ...FINISHED, userId: { $in: users.map((u) => u._id) } } },
      { $group: { _id: '$userId', attempts: { $sum: 1 }, best: { $max: '$result.score' }, avg: { $avg: '$result.score' }, last: { $max: '$startedAt' } } },
    ]);
    const byUser = new Map(stats.map((s) => [String(s._id), s]));
    const certs = await cert.currentForMany(users);
    res.json({
      employees: users.map((u) => {
        const s = byUser.get(String(u._id));
        const c = certs.get(String(u._id));
        return {
          certificate: c ? { status: c.status, expiresAt: c.expiresAt, daysLeft: c.daysLeft } : null,
          id: u._id, employeeId: u.employeeId, name: u.name, email: u.email, department: u.department, isActive: u.isActive,
          attempts: s ? s.attempts : 0,
          bestScore: s ? s.best : null,
          averageScore: s ? Math.round(s.avg) : null,
          lastAttempt: s ? s.last : null,
          qualified: !!s && s.best >= RULES.qualifyPercent,
        };
      }),
    });
  } catch (err) { fail500(res, err); }
});

// One employee: profile, summary and their 5 most recent attempts.
router.get('/employees/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Employee not found.' });
    const u = await User.findOne({ _id: req.params.id, role: 'employee' }).lean();
    if (!u) return res.status(404).json({ error: 'Employee not found.' });
    const { stats, history } = await employeeSummary(u._id, 5);
    const c = await cert.currentFor(u);
    res.json({
      certificate: c,
      employee: { id: u._id, company: u.company || COMPANY, employeeId: u.employeeId, name: u.name, email: u.email, department: u.department, isActive: u.isActive, lastLoginAt: u.lastLoginAt, registeredAt: u.createdAt },
      stats,
      history,
    });
  } catch (err) { fail500(res, err); }
});

// An employee's current certificate as a PDF (admins can print or file it).
router.get('/employees/:id/certificate.pdf', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Employee not found.' });
    const u = await User.findOne({ _id: req.params.id, role: 'employee' });
    if (!u) return res.status(404).json({ error: 'Employee not found.' });
    const c = await cert.currentFor(u);
    if (!c) return res.status(404).json({ error: 'This employee has no certificate.' });
    if (c.status === 'expired') return res.status(409).json({ error: 'This certificate has expired.' });
    const pdf = certificatePdf({ company: u.company || COMPANY, name: u.name, employeeId: u.employeeId, ...c });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${String(u.employeeId || 'employee').replace(/[^A-Za-z0-9-]/g, '')}.pdf"`);
    res.send(pdf);
  } catch (err) { fail500(res, err); }
});

// Disable or re-enable an employee account (takes effect on their next request).
router.patch('/employees/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || typeof req.body.isActive !== 'boolean') {
      return res.status(400).json({ error: 'Invalid request.' });
    }
    const u = await User.findOneAndUpdate({ _id: req.params.id, role: 'employee' }, { isActive: req.body.isActive }, { new: true });
    if (!u) return res.status(404).json({ error: 'Employee not found.' });
    res.json({ id: u._id, isActive: u.isActive });
  } catch (err) { fail500(res, err); }
});

// Every finished attempt of every employee, as a spreadsheet-friendly CSV.
const csvCell = (v) => {
  let s = v === undefined || v === null ? '' : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stops spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get('/export.csv', async (req, res) => {
  try {
    const attempts = await Attempt.find(FINISHED).sort({ startedAt: -1 }).limit(50000).lean();
    const ids = [...new Set(attempts.map((a) => String(a.userId)))];
    const users = new Map((await User.find({ _id: { $in: ids } }).lean()).map((u) => [String(u._id), u]));
    const rows = [['Company', 'Employee ID', 'Name', 'Email', 'Department', 'Attempt', 'Date', 'Quiz correct', 'Quiz total', 'Score %', 'Hazards found', 'Safe objects clicked', 'Time (s)', 'Grade', 'Qualified', 'Ended', 'Certificate no.', 'Certificate expires']];
    for (const a of attempts) {
      const u = users.get(String(a.userId)) || {};
      const r = a.result || {};
      const c = r.qualified ? cert.fromAttempt(a, u) : null;
      rows.push([u.company || COMPANY, u.employeeId, u.name, u.email, u.department, a.attemptNo, a.startedAt.toISOString(), a.quiz.correctCount, a.quiz.total, r.score, r.hazardsFound, r.safeMistakes, r.durationSeconds, r.grade, r.qualified ? 'Yes' : 'No', r.endReason, c ? c.number : '', c ? c.expiresAt.toISOString().slice(0, 10) : '']);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="hazard-hunt-results.csv"');
    res.send('\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'));
  } catch (err) { fail500(res, err); }
});

module.exports = router;
