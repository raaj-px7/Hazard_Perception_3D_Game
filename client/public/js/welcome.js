import { api, logout, showMsg } from '/static/js/api.js';

try {
  const { user } = await api('/api/auth/me');
  if (user.role !== 'employee') location.replace('/admin');
  document.getElementById('first-name').textContent = user.name.split(' ')[0];
  document.getElementById('who').textContent = `${user.company} | Employee ID ${user.employeeId} | ${user.email}`;
} catch {
  location.replace('/login');
}
document.getElementById('logout').addEventListener('click', logout);

const startBtn = document.getElementById('start');
startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  try {
    await api('/api/attempts', { method: 'POST' });
    location.assign('/quiz');
  } catch (err) {
    showMsg(document.getElementById('msg'), err.message);
    startBtn.disabled = false;
  }
});

const fmtDay = (d) => new Date(d).toLocaleDateString([], { dateStyle: 'long' });
const fmtWhen = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

// Certification status, the retake allowance, and whether Start is available right now.
async function loadCertification() {
  const { certificate: c, allowance: a, rules } = await api('/api/attempts/certification');
  const status = document.getElementById('cert-status');
  const detail = document.getElementById('cert-detail');
  const dl = document.getElementById('cert-download');
  const parts = [];
  if (!c) {
    status.textContent = 'Not certified yet';
    parts.push('Score 60% or more in an inspection to earn your certificate.');
  } else if (c.status === 'expired') {
    status.textContent = `Certificate expired on ${fmtDay(c.expiresAt)}`;
    parts.push('Retake the inspection and score 60% or more to renew it.');
  } else {
    status.textContent = c.status === 'expiring' ? `Certified, expires in ${c.daysLeft} day${c.daysLeft === 1 ? '' : 's'}` : `Certified until ${fmtDay(c.expiresAt)}`;
    parts.push(`Certificate ${c.number}, score ${c.score}%. Valid for ${rules.validityMonths} months from the date of the pass.`);
  }
  dl.hidden = !(c && c.status !== 'expired');
  if (rules.maxAttemptsPerDay > 0) parts.push(`Attempts used in the last 24 hours: ${a.usedToday} of ${rules.maxAttemptsPerDay}.`);
  detail.textContent = parts.join(' ');
  if (!a.allowed) {
    startBtn.disabled = true;
    showMsg(document.getElementById('msg'), `${a.reason === 'cooldown' ? 'Please wait before your next attempt.' : `You have used all ${rules.maxAttemptsPerDay} attempts allowed in 24 hours.`} You can try again after ${fmtWhen(a.retryAt)}.`);
  }
}
loadCertification().catch(() => {});

const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

async function loadHistory() {
  const { stats, history } = await api('/api/attempts/mine');
  const has = stats.attempts > 0;
  const cards = [
    ['Attempts', String(stats.attempts)],
    ['Best score', has ? `${stats.bestScore}%` : '-'],
    ['Average score', has ? `${stats.averageScore}%` : '-'],
    ['Qualified so far', !has ? 'Not started' : stats.qualified ? 'Yes' : 'Not yet'],
  ];
  const statsEl = document.getElementById('stats');
  statsEl.replaceChildren();
  for (const [label, value] of cards) {
    const tile = document.createElement('div');
    tile.className = 'tile stat';
    const big = document.createElement('b');
    big.textContent = value;
    const small = document.createElement('span');
    small.textContent = label;
    tile.append(big, small);
    statsEl.append(tile);
  }

  document.getElementById('no-history').hidden = has;
  document.getElementById('history-wrap').hidden = !has;
  const tbody = document.querySelector('#history tbody');
  tbody.replaceChildren();
  for (const h of history) {
    const result = h.endReason === 'exit' ? 'Left early' : h.qualified ? 'Qualified' : 'Not qualified';
    const cells = [
      `#${h.attemptNo}`,
      new Date(h.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
      `${h.quizCorrect ?? 0}/${h.quizTotal ?? 5}`,
      `${h.score}% (${h.grade})`,
      `${h.hazardsFound}/10`,
      String(h.safeMistakes),
      mmss(h.durationSeconds),
      result,
    ];
    const tr = document.createElement('tr');
    for (const c of cells) {
      const td = document.createElement('td');
      td.textContent = c;
      tr.append(td);
    }
    tbody.append(tr);
  }
}
loadHistory().catch(() => {});
