// The server is the only place that decides an official score.
// What counts as a hazard is that attempt's own layout (see lib/layout.js), never a fixed list.
const { HAZARD_BY_ID, LEGACY_HAZARD_IDS } = require('./catalog');
const { issueFor } = require('./certification');

const RULES = {
  hazardCount: 10, // hazards in every layout
  timeLimitSeconds: 120,
  graceSeconds: 5, // network slack for the last click
  hazardPoints: 10, // each hazard is worth 10% of the total
  safePenalty: 5, // each safe object clicked costs 5% (once per object)
  qualifyPercent: 60,
};

const percentScore = (found, mistakes) =>
  Math.max(0, Math.min(100, found * RULES.hazardPoints - mistakes * RULES.safePenalty));

function gradeFor(percent) {
  if (percent >= 100) return { grade: 'S+', title: 'MASTER SAFETY INSPECTOR' };
  if (percent >= 85) return { grade: 'A', title: 'CERTIFIED SAFETY OFFICER' };
  if (percent >= 70) return { grade: 'B', title: 'SAFETY APPRENTICE' };
  if (percent >= RULES.qualifyPercent) return { grade: 'C', title: 'HAZARD AWARE' };
  return { grade: 'F', title: 'HIGH RISK WORKPLACE' };
}

function snapshot(attempt) {
  const hazardsFound = attempt.foundHazardIds.length;
  const safeMistakes = attempt.safeClickedIds.length;
  const total = hazardsFound + safeMistakes;
  return {
    score: percentScore(hazardsFound, safeMistakes),
    hazardsFound,
    safeMistakes,
    accuracy: total ? Math.round((hazardsFound / total) * 100) : 100,
  };
}

const elapsedSeconds = (attempt) => (attempt.startedAt ? Math.max(0, (Date.now() - attempt.startedAt.getTime()) / 1000) : 0);

function deriveReason(attempt) {
  if (attempt.foundHazardIds.length >= RULES.hazardCount) return 'completed';
  if (elapsedSeconds(attempt) >= RULES.timeLimitSeconds - 3) return 'timeup';
  return 'exit';
}

// Locks in the result. Safe to call twice: a finished attempt is returned unchanged.
async function finalize(attempt) {
  if (attempt.result && attempt.result.endReason) return attempt;
  const reason = deriveReason(attempt);
  const snap = snapshot(attempt);
  const g = gradeFor(snap.score);
  const qualified = snap.score >= RULES.qualifyPercent;
  attempt.result = {
    ...snap,
    grade: g.grade,
    title: g.title,
    qualified,
    durationSeconds: Math.min(Math.round(elapsedSeconds(attempt)), RULES.timeLimitSeconds),
    endReason: reason,
    ...(qualified ? { certificate: issueFor(attempt) } : {}),
  };
  attempt.status = reason === 'exit' ? 'abandoned' : 'completed';
  attempt.finishedAt = new Date();
  await attempt.save();
  return attempt;
}

// Hazards that were in this attempt (old attempts: the original fixed set), for the end-of-game review.
function hazardRefs(attempt) {
  return attempt.layout && attempt.layout.length
    ? attempt.layout.filter((e) => e.kind === 'hazard').map((e) => e.ref)
    : LEGACY_HAZARD_IDS;
}

function publicResult(attempt) {
  const found = new Set(attempt.foundHazardIds);
  return {
    ...attempt.result.toObject(),
    review: hazardRefs(attempt).map((ref) => {
      const h = HAZARD_BY_ID.get(ref);
      return { title: h ? h.title : ref, severity: h ? h.severity : 'Medium', found: found.has(ref) };
    }),
    quiz: { correctCount: attempt.quiz.correctCount, total: attempt.quiz.total },
  };
}

module.exports = { RULES, hazardRefs, percentScore, gradeFor, snapshot, elapsedSeconds, finalize, publicResult };
