// Certification rules: how long a pass stays valid, and how often an employee may retake.
// Change the numbers here only; everything else (welcome page, admin, PDF) reads from CERT.
// The Attempt model is loaded only inside the database functions, so the pure rules can be tested without Mongo.
const attemptModel = () => require('../models/Attempt');
const { COMPANY } = require('./company');

const CERT = {
  validityMonths: 12, // a qualifying pass (60%+) is a valid certificate for this long
  expiringSoonDays: 30, // the admin dashboard flags certificates that end within this many days
  maxAttemptsPerDay: 3, // attempts whose quiz was submitted in any rolling 24 hours (0 = no limit)
  cooldownMinutes: 0, // wait after a failed attempt before the next one (0 = off)
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar-month addition in UTC that clamps the day (31 Jan + 1 month = 28/29 Feb).
function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

// valid | expiring (valid, but ends within expiringSoonDays) | expired
function statusOf(expiresAt, now = new Date()) {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return 'expired';
  return ms <= CERT.expiringSoonDays * DAY_MS ? 'expiring' : 'valid';
}

const daysLeft = (expiresAt, now = new Date()) => Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS);

const fmtUtc = (d) => `${d.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
const prefix = () => (COMPANY.replace(/[^A-Z]/g, '') || 'HH').slice(0, 4);
const pad = (n) => String(n).padStart(2, '0');
function certificateNumber(employeeId, issuedAt, attemptNo) {
  const d = new Date(issuedAt);
  return `${prefix()}-${employeeId || 'NA'}-${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${attemptNo}`;
}

// Stored on the attempt when it qualifies, so a later change to validityMonths never alters a certificate already issued.
function issueFor(attempt, issuedAt = new Date()) {
  return {
    number: certificateNumber(attempt.employeeId, issuedAt, attempt.attemptNo),
    issuedAt,
    expiresAt: addMonths(issuedAt, CERT.validityMonths),
  };
}

// Builds the certificate object from a qualified attempt. Attempts that qualified before certificates existed
// have none stored: their date is the finish date and their expiry is computed.
function fromAttempt(attempt, user, now = new Date()) {
  if (!attempt || !attempt.result || !attempt.result.qualified) return null;
  const stored = attempt.result.certificate && attempt.result.certificate.expiresAt ? attempt.result.certificate : null;
  const issuedAt = stored ? stored.issuedAt : attempt.finishedAt || attempt.startedAt;
  const expiresAt = stored ? stored.expiresAt : addMonths(issuedAt, CERT.validityMonths);
  const employeeId = (user && user.employeeId) || attempt.employeeId;
  return {
    number: stored && stored.number ? stored.number : certificateNumber(employeeId, issuedAt, attempt.attemptNo),
    issuedAt,
    expiresAt,
    status: statusOf(expiresAt, now),
    daysLeft: daysLeft(expiresAt, now),
    score: attempt.result.score,
    grade: attempt.result.grade,
    attemptNo: attempt.attemptNo,
  };
}

// An employee's current certificate = their most recent qualifying attempt.
async function currentFor(user, now = new Date()) {
  const a = await attemptModel().findOne({ userId: user._id, 'result.qualified': true }).sort({ finishedAt: -1 }).lean();
  return fromAttempt(a, user, now);
}

// Current certificate for many users at once (admin lists). Map of userId -> certificate.
async function currentForMany(users, now = new Date()) {
  const rows = await attemptModel().aggregate([
    { $match: { userId: { $in: users.map((u) => u._id) }, 'result.qualified': true } },
    { $sort: { finishedAt: -1 } },
    { $group: { _id: '$userId', attempt: { $first: '$$ROOT' } } },
  ]);
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return new Map(rows.map((r) => [String(r._id), fromAttempt(r.attempt, byId.get(String(r._id)), now)]));
}

// ---------- retake limits ----------
// Pure so it can be tested. submittedTimes: when the employee's recent quizzes were submitted.
// lastFailedAt: when their last non-qualifying attempt finished (or null).
function evaluateAllowance({ submittedTimes, lastFailedAt, now = new Date(), rules = CERT }) {
  const t = now.getTime();
  const recent = submittedTimes.map((d) => new Date(d).getTime()).filter((x) => x > t - DAY_MS).sort((a, b) => a - b);
  const out = { allowed: true, usedToday: recent.length, maxPerDay: rules.maxAttemptsPerDay, cooldownMinutes: rules.cooldownMinutes };
  if (rules.maxAttemptsPerDay > 0 && recent.length >= rules.maxAttemptsPerDay) {
    const retryAt = new Date(recent[recent.length - rules.maxAttemptsPerDay] + DAY_MS);
    return { ...out, allowed: false, reason: 'daily', retryAt, message: `You have used all ${rules.maxAttemptsPerDay} attempts allowed in 24 hours. You can try again after ${fmtUtc(retryAt)}.` };
  }
  if (rules.cooldownMinutes > 0 && lastFailedAt) {
    const retryAt = new Date(new Date(lastFailedAt).getTime() + rules.cooldownMinutes * 60000);
    if (retryAt.getTime() > t) {
      return { ...out, allowed: false, reason: 'cooldown', retryAt, message: `Please wait before your next attempt. You can try again after ${fmtUtc(retryAt)}.` };
    }
  }
  return out;
}

async function allowanceFor(userId, { exceptId, now = new Date() } = {}) {
  const Attempt = attemptModel();
  const since = new Date(now.getTime() - DAY_MS);
  const idFilter = exceptId ? { _id: { $ne: exceptId } } : {};
  const [recent, failed] = await Promise.all([
    Attempt.find({ userId, ...idFilter, 'quiz.submittedAt': { $gt: since } }, 'quiz.submittedAt').lean(),
    CERT.cooldownMinutes > 0
      ? Attempt.findOne({ userId, ...idFilter, 'result.endReason': { $exists: true }, 'result.qualified': false }).sort({ finishedAt: -1 }).lean()
      : null,
  ]);
  return evaluateAllowance({ submittedTimes: recent.map((a) => a.quiz.submittedAt), lastFailedAt: failed && failed.finishedAt, now });
}

module.exports = { CERT, DAY_MS, addMonths, statusOf, daysLeft, certificateNumber, issueFor, fromAttempt, currentFor, currentForMany, evaluateAllowance, allowanceFor };
