const express = require('express');
const mongoose = require('mongoose');
const Attempt = require('../models/Attempt');
const Question = require('../models/Question');
const { requireAuth } = require('../middleware/auth');
const { employeeSummary } = require('../lib/history');
const { RULES, snapshot, elapsedSeconds, finalize, publicResult } = require('../lib/inspection');
const { HAZARD_BY_ID, SAFE_BY_ID } = require('../lib/catalog');
const { generateLayout, publicLayout } = require('../lib/layout');
const cert = require('../lib/certification');
const { certificatePdf } = require('../lib/certificatePdf');
const { COMPANY } = require('../lib/company');

const router = express.Router();
router.use(requireAuth(['employee']));

const QUIZ_SIZE = 5;
const fail500 = (res, err) => { console.error(err); res.status(500).json({ error: 'Something went wrong. Please try again.' }); };
const byIdMap = (docs) => new Map(docs.map((d) => [String(d._id), d]));

async function ownAttempt(req, res) {
  const notFound = () => { res.status(404).json({ error: 'Attempt not found.' }); return null; };
  if (!mongoose.isValidObjectId(req.params.id)) return notFound();
  return (await Attempt.findOne({ _id: req.params.id, userId: req.user._id })) || notFound();
}

// What the employee sees about an object once it has been inspected.
const cardOf = (kind, ref) => {
  const o = (kind === 'hazard' ? HAZARD_BY_ID : SAFE_BY_ID).get(ref);
  return kind === 'hazard'
    ? { title: o.title, category: o.category, severity: o.severity, description: o.description, tip: o.tip }
    : { title: o.title, description: o.description, tip: o.tip };
};

// Objects already inspected (by layout id), so a reload shows them as done. Kind and card are fine to reveal here.
const inspectedOf = (a) => {
  const done = new Set([...a.foundHazardIds, ...a.safeClickedIds]);
  return a.layout.filter((e) => done.has(e.ref)).map((e) => ({ id: e.oid, kind: e.kind, card: cardOf(e.kind, e.ref) }));
};

const stateOf = (a) => ({
  startedAt: a.startedAt,
  elapsedSeconds: Math.floor(elapsedSeconds(a)),
  timeLimitSeconds: RULES.timeLimitSeconds,
  layout: publicLayout(a.layout),
  inspected: inspectedOf(a),
  ...snapshot(a),
});

// The employee's most recent saved hazard set, so the next draw can avoid repeating it.
async function previousHazardRefs(userId, exceptId) {
  const prev = await Attempt.findOne({ userId, _id: { $ne: exceptId }, 'layout.0': { $exists: true } }).sort({ createdAt: -1 }).lean();
  return prev ? prev.layout.filter((e) => e.kind === 'hazard').map((e) => e.ref) : [];
}

async function drawLayout(a) {
  const { layout, relaxed } = generateLayout({ prevHazardRefs: await previousHazardRefs(a.userId, a._id) });
  if (relaxed.length) console.warn(`Layout for attempt ${a._id} relaxed: ${relaxed.join(', ')}`);
  a.layout = layout;
}

// Start a new attempt: picks the quiz questions. Any attempt left open is closed first.
router.post('/', async (req, res) => {
  try {
    // Retake limits. Checked first, so a refused start leaves any inspection already open untouched.
    const allowance = await cert.allowanceFor(req.user._id);
    if (!allowance.allowed) return res.status(429).json({ error: allowance.message, retryAt: allowance.retryAt, reason: allowance.reason });
    const open = await Attempt.find({ userId: req.user._id, status: { $in: ['quiz', 'inspecting'] } });
    for (const o of open) {
      if (o.status === 'inspecting' && o.startedAt) await finalize(o); // keeps its score as an early exit
      else { o.status = 'abandoned'; o.finishedAt = new Date(); await o.save(); }
    }
    const questions = await Question.aggregate([{ $match: { active: true } }, { $sample: { size: QUIZ_SIZE } }]);
    if (questions.length < QUIZ_SIZE) return res.status(503).json({ error: 'The quiz is not ready yet. Please contact your admin.' });
    const attemptNo = (await Attempt.countDocuments({ userId: req.user._id })) + 1;
    const attempt = await Attempt.create({
      userId: req.user._id,
      employeeId: req.user.employeeId,
      attemptNo,
      quiz: { questionIds: questions.map((q) => q._id), total: QUIZ_SIZE },
    });
    res.status(201).json({ attemptId: attempt._id });
  } catch (err) { fail500(res, err); }
});

// The attempt in progress. While in the quiz stage it includes the questions (never the answers).
router.get('/current', async (req, res) => {
  try {
    const a = await Attempt.findOne({ userId: req.user._id, status: { $in: ['quiz', 'inspecting'] } }).sort({ createdAt: -1 });
    if (!a) return res.status(404).json({ error: 'No active attempt.' });
    const out = { attemptId: a._id, status: a.status, attemptNo: a.attemptNo };
    if (a.status === 'quiz') {
      const qs = byIdMap(await Question.find({ _id: { $in: a.quiz.questionIds } }));
      out.questions = a.quiz.questionIds.map((id) => qs.get(String(id))).filter(Boolean)
        .map((q) => ({ id: q._id, text: q.text, options: q.options }));
    }
    res.json(out);
  } catch (err) { fail500(res, err); }
});

// Certification status and retake allowance, for the welcome page.
router.get('/certification', async (req, res) => {
  try {
    const [certificate, allowance] = await Promise.all([cert.currentFor(req.user), cert.allowanceFor(req.user._id)]);
    res.json({
      certificate,
      allowance,
      rules: { validityMonths: cert.CERT.validityMonths, expiringSoonDays: cert.CERT.expiringSoonDays, maxAttemptsPerDay: cert.CERT.maxAttemptsPerDay, cooldownMinutes: cert.CERT.cooldownMinutes },
    });
  } catch (err) { fail500(res, err); }
});

// The employee's current certificate as a PDF. Expired certificates are not issued again: retake the inspection.
router.get('/certificate.pdf', async (req, res) => {
  try {
    const c = await cert.currentFor(req.user);
    if (!c) return res.status(404).json({ error: 'You do not have a certificate yet. Qualify with a score of 60% or more.' });
    if (c.status === 'expired') return res.status(409).json({ error: 'Your certificate has expired. Retake the inspection to renew it.' });
    const pdf = certificatePdf({ company: req.user.company || COMPANY, name: req.user.name, employeeId: req.user.employeeId, ...c });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${String(req.user.employeeId || 'employee').replace(/[^A-Za-z0-9-]/g, '')}.pdf"`);
    res.send(pdf);
  } catch (err) { fail500(res, err); }
});

// Dashboard data: summary numbers plus the employee's 5 most recent inspections.
router.get('/mine', async (req, res) => {
  try {
    res.json(await employeeSummary(req.user._id, 5));
  } catch (err) { fail500(res, err); }
});

// Grade the quiz on the server, then unlock the inspection.
router.post('/:id/quiz', async (req, res) => {
  try {
    const a = await ownAttempt(req, res);
    if (!a) return;
    if (a.status !== 'quiz') return res.status(409).json({ error: 'This quiz was already submitted.' });
    // Counts here too, so two start requests sent at once cannot both get through.
    const allowance = await cert.allowanceFor(req.user._id, { exceptId: a._id });
    if (!allowance.allowed) {
      a.status = 'abandoned'; a.finishedAt = new Date(); await a.save();
      return res.status(429).json({ error: allowance.message, retryAt: allowance.retryAt, reason: allowance.reason });
    }

    const ids = a.quiz.questionIds;
    const answers = req.body.answers;
    if (!Array.isArray(answers) || answers.length !== ids.length || !answers.every((n) => Number.isInteger(n) && n >= 0 && n <= 3)) {
      return res.status(400).json({ error: 'Please answer every question.' });
    }
    const qs = byIdMap(await Question.find({ _id: { $in: ids } }));
    let correctCount = 0;
    const review = ids.map((id, i) => {
      const q = qs.get(String(id));
      const correct = !!q && q.correctIndex === answers[i];
      if (correct) correctCount++;
      return { text: q.text, options: q.options, selected: answers[i], correctIndex: q.correctIndex, explanation: q.explanation, correct };
    });

    a.quiz.answers = answers;
    a.quiz.correctCount = correctCount;
    a.quiz.submittedAt = new Date();
    a.status = 'inspecting';
    await drawLayout(a);
    await a.save();
    res.json({ correctCount, total: ids.length, review });
  } catch (err) { fail500(res, err); }
});

// Called when the game opens. The first call starts the server clock; later calls (page reload) resume it.
router.post('/:id/start', async (req, res) => {
  try {
    const a = await ownAttempt(req, res);
    if (!a) return;
    if (a.status !== 'inspecting') return res.status(409).json({ error: 'Finish the quiz first.' });
    if (!a.layout.length) {
      // Started before layouts existed. Not begun yet: draw one now. Already running: end it, it cannot continue.
      if (a.startedAt) { await finalize(a); return res.status(409).json({ error: 'This inspection was started before an update and has ended.' }); }
      await drawLayout(a);
    }
    if (!a.startedAt) { a.startedAt = new Date(); await a.save(); }
    res.json(stateOf(a));
  } catch (err) { fail500(res, err); }
});

// Records one click on a hazard or safe object. The server decides the points.
router.post('/:id/click', async (req, res) => {
  try {
    const a = await ownAttempt(req, res);
    if (!a) return;
    if (a.status !== 'inspecting' || !a.startedAt) return res.status(409).json({ error: 'This inspection is not active.' });

    const elapsed = elapsedSeconds(a);
    if (elapsed > RULES.timeLimitSeconds + RULES.graceSeconds) return res.status(409).json({ error: 'Time is up.', timeUp: true });

    // The click names an object in THIS attempt's layout. Anything else (forged or from another attempt) is refused.
    const entry = a.layout.find((e) => e.oid === String(req.body.objectId || ''));
    if (!entry) return res.status(400).json({ error: 'Unknown object.' });
    const { kind, ref } = entry;
    const card = cardOf(kind, ref);

    const field = kind === 'hazard' ? 'foundHazardIds' : 'safeClickedIds';
    const before = snapshot(a);
    const delta = kind === 'hazard' ? RULES.hazardPoints : -RULES.safePenalty;
    // Atomic: an object can only be counted once, even with a double click.
    const updated = await Attempt.findOneAndUpdate(
      { _id: a._id, status: 'inspecting', [field]: { $ne: ref } },
      { $push: { [field]: ref, events: { objectId: ref, kind, at: Math.round(elapsed * 1000), delta } } },
      { new: true }
    );
    if (!updated) {
      // Only an object already counted may echo its card back; otherwise the attempt ended meanwhile.
      if (!a[field].includes(ref)) return res.status(409).json({ error: 'This inspection is not active.' });
      return res.json({ result: 'repeat', kind, card, delta: 0, ...before });
    }
    const after = snapshot(updated);
    res.json({ result: kind, card, delta: after.score - before.score, ...after });
  } catch (err) { fail500(res, err); }
});

// A hint: names one hazard still to find (server side, so the browser never holds the answers).
router.post('/:id/hint', async (req, res) => {
  try {
    const a = await ownAttempt(req, res);
    if (!a) return;
    if (a.status !== 'inspecting' || !a.startedAt) return res.status(409).json({ error: 'This inspection is not active.' });
    const left = a.layout.filter((e) => e.kind === 'hazard' && !a.foundHazardIds.includes(e.ref));
    if (!left.length) return res.json({ done: true });
    const h = HAZARD_BY_ID.get(left[Math.floor(Math.random() * left.length)].ref);
    res.json({ category: h.category, title: h.title });
  } catch (err) { fail500(res, err); }
});

// Ends the inspection. The server works out why it ended (all found, time up, or left early).
router.post('/:id/finish', async (req, res) => {
  try {
    const a = await ownAttempt(req, res);
    if (!a) return;
    if (!a.startedAt || (a.status !== 'inspecting' && !(a.result && a.result.endReason))) {
      return res.status(409).json({ error: 'This inspection is not active.' });
    }
    await finalize(a);
    res.json(publicResult(a));
  } catch (err) { fail500(res, err); }
});

module.exports = router;
