const Attempt = require('../models/Attempt');
const { RULES } = require('./inspection');

// An attempt counts once the inspection has started and a result has been saved.
const FINISHED = { startedAt: { $ne: null }, 'result.endReason': { $exists: true } };

// Summary numbers plus the most recent attempts (5 by default) for one employee.
async function employeeSummary(userId, limit = 5) {
  const match = { ...FINISHED, userId };
  const [recent, agg] = await Promise.all([
    Attempt.find(match).sort({ startedAt: -1 }).limit(limit).lean(),
    Attempt.aggregate([
      { $match: match },
      { $group: { _id: null, attempts: { $sum: 1 }, best: { $max: '$result.score' }, avg: { $avg: '$result.score' } } },
    ]),
  ]);
  const s = agg[0] || { attempts: 0, best: 0, avg: 0 };
  return {
    stats: {
      attempts: s.attempts,
      bestScore: s.best,
      averageScore: Math.round(s.avg),
      qualified: s.attempts > 0 && s.best >= RULES.qualifyPercent,
    },
    history: recent.map((a) => ({
      attemptNo: a.attemptNo,
      date: a.startedAt,
      quizCorrect: a.quiz.correctCount,
      quizTotal: a.quiz.total,
      ...a.result,
    })),
  };
}

module.exports = { FINISHED, employeeSummary };
