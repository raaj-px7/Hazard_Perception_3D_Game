import { api, logout, showMsg } from '/static/js/api.js';

const $ = (id) => document.getElementById(id);
document.getElementById('logout').addEventListener('click', logout);

try {
  const { user } = await api('/api/auth/me');
  if (user.role !== 'admin') location.replace('/welcome');
  $('who').textContent = `${user.name} | ${user.company} | ID ${user.employeeId} | ${user.email}`;
} catch {
  location.replace('/login');
}

// ---------- helpers (all text goes in via textContent, never innerHTML) ----------
const fmtDate = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const pct = (n) => (n === null || n === undefined ? '-' : `${n}%`);

function tag(text, cls) {
  const s = document.createElement('span');
  s.className = `tag ${cls || ''}`;
  s.textContent = text;
  return s;
}

function fillRows(tbody, rows, onRowClick) {
  tbody.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const c of row.cells) {
      const td = document.createElement('td');
      td.append(c);
      tr.append(td);
    }
    if (onRowClick) {
      tr.className = 'clickable';
      tr.tabIndex = 0;
      tr.addEventListener('click', () => onRowClick(row));
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') onRowClick(row); });
    }
    tbody.append(tr);
  }
}

function fillStats(el, cards) {
  el.replaceChildren();
  for (const [label, value] of cards) {
    const tile = document.createElement('div');
    tile.className = 'tile stat';
    const big = document.createElement('b');
    big.textContent = value;
    const small = document.createElement('span');
    small.textContent = label;
    tile.append(big, small);
    el.append(tile);
  }
}

// ---------- overview ----------
async function loadStats() {
  const s = await api('/api/admin/stats');
  fillStats($('a-stats'), [
    ['Employees', String(s.employees)],
    ['Qualified employees', String(s.qualifiedEmployees)],
    ['Finished attempts', String(s.attempts)],
    ['Average score', s.attempts ? `${s.averageScore}%` : '-'],
    ['Attempt pass rate', s.attempts ? `${s.passRate}%` : '-'],
  ]);
  const has = s.mostMissed.length > 0;
  $('miss-empty').hidden = has;
  $('miss-wrap').hidden = !has;
  fillRows(document.querySelector('#miss-table tbody'), s.mostMissed.map((m) => ({ cells: [m.title, m.difficulty, `${m.percent}% (${m.missed} of ${m.appeared})`] })));
}

// ---------- certification ----------
const fmtDay = (d) => new Date(d).toLocaleDateString([], { dateStyle: 'medium' });
const certTag = (c) => (!c ? tag('None') : c.status === 'valid' ? tag(`Valid to ${fmtDay(c.expiresAt)}`, 'free') : c.status === 'expiring' ? tag(`Expires ${fmtDay(c.expiresAt)}`, 'bad') : tag(`Expired ${fmtDay(c.expiresAt)}`, 'bad'));
const timeLeft = (d) => (d > 0 ? `${d} day${d === 1 ? '' : 's'}` : `${-d} day${d === -1 ? '' : 's'} ago`);

async function loadCertifications() {
  const { counts, attention, rules } = await api('/api/admin/certifications');
  fillStats($('c-stats'), [
    ['Certified', String(counts.valid + counts.expiring)],
    [`Expiring within ${rules.expiringSoonDays} days`, String(counts.expiring)],
    ['Expired', String(counts.expired)],
    ['Not yet certified', String(counts.none)],
  ]);
  $('c-empty').hidden = attention.length > 0;
  $('c-wrap').hidden = attention.length === 0;
  fillRows(document.querySelector('#c-table tbody'), attention.map((r) => ({
    id: r.id,
    cells: [r.employeeId || '-', r.name, r.department || '-', fmtDay(r.expiresAt), timeLeft(r.daysLeft), r.status === 'expired' ? tag('Expired', 'bad') : tag('Expiring soon', 'bad')],
  })), (r) => r.id && openDetail(r.id));
  $('c-rules').textContent = `Certificates are valid for ${rules.validityMonths} months from the date of the pass. Counts cover active employee accounts.`;
}

// ---------- employees ----------
let openId = null;

async function loadEmployees() {
  const { employees } = await api(`/api/admin/employees?search=${encodeURIComponent($('search').value.trim())}`);
  const rows = employees.map((e) => ({
    id: e.id,
    cells: [
      e.employeeId || '-', e.name, e.department || '-', String(e.attempts), pct(e.bestScore), pct(e.averageScore), fmtDate(e.lastAttempt),
      e.attempts === 0 ? tag('No attempts') : e.qualified ? tag('Qualified', 'free') : tag('Not qualified'),
      certTag(e.certificate),
      e.isActive ? tag('Active', 'free') : tag('Disabled', 'bad'),
    ],
  }));
  if (!rows.length) rows.push({ cells: ['No employees found.', '', '', '', '', '', '', '', '', ''] });
  fillRows(document.querySelector('#emp-table tbody'), rows, (r) => r.id && openDetail(r.id));
}

async function openDetail(id) {
  openId = id;
  const { employee: e, stats, history, certificate: c } = await api(`/api/admin/employees/${id}`);
  $('detail').hidden = false;
  $('d-name').textContent = e.name;
  $('d-meta').textContent = [e.company, `ID ${e.employeeId}`, e.email, e.department, `Registered ${fmtDate(e.registeredAt)}`, `Last login ${fmtDate(e.lastLoginAt)}`].filter(Boolean).join('  |  ');
  const has = stats.attempts > 0;
  $('d-cert').hidden = !(c && c.status !== 'expired');
  $('d-cert').href = `/api/admin/employees/${id}/certificate.pdf`;
  fillStats($('d-stats'), [
    ['Attempts', String(stats.attempts)],
    ['Best score', has ? `${stats.bestScore}%` : '-'],
    ['Average score', has ? `${stats.averageScore}%` : '-'],
    ['Qualified so far', !has ? 'No attempts' : stats.qualified ? 'Yes' : 'Not yet'],
    ['Certificate', !c ? 'None' : c.status === 'expired' ? `Expired ${fmtDay(c.expiresAt)}` : `Valid to ${fmtDay(c.expiresAt)}`],
  ]);
  $('d-empty').hidden = has;
  $('d-wrap').hidden = !has;
  fillRows(document.querySelector('#d-table tbody'), history.map((h) => ({
    cells: [`#${h.attemptNo}`, fmtDate(h.date), `${h.quizCorrect ?? 0}/${h.quizTotal ?? 5}`, `${h.score}% (${h.grade})`, `${h.hazardsFound}/10`, String(h.safeMistakes), mmss(h.durationSeconds),
      h.endReason === 'exit' ? 'Left early' : h.qualified ? 'Qualified' : 'Not qualified'],
  })));
  $('d-toggle').textContent = e.isActive ? 'Disable account' : 'Enable account';
  $('d-toggle').dataset.active = String(e.isActive);
  $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

$('d-close').addEventListener('click', () => { $('detail').hidden = true; openId = null; });

$('d-toggle').addEventListener('click', async () => {
  const makeActive = $('d-toggle').dataset.active !== 'true';
  if (!makeActive && !confirm('Disable this account? The employee will be logged out and cannot log in until you enable it again.')) return;
  try {
    await api(`/api/admin/employees/${openId}`, { method: 'PATCH', body: { isActive: makeActive } });
    await Promise.all([openDetail(openId), loadEmployees(), loadCertifications()]);
  } catch (err) {
    showMsg($('emp-msg'), err.message);
  }
});

let timer;
$('search').addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => loadEmployees().catch((err) => showMsg($('emp-msg'), err.message)), 250);
});

// ---------- employee IDs ----------
async function loadIds() {
  const { ids } = await api('/api/admin/employee-ids');
  const rows = ids.map((r) => ({
    cells: [r.employeeId, r.department || '-', r.claimedBy ? tag(`Registered: ${r.claimedBy.name} (${r.claimedBy.email})`, 'used') : tag('Available', 'free')],
  }));
  if (!rows.length) rows.push({ cells: ['No Employee IDs yet.', '', ''] });
  fillRows(document.querySelector('#id-table tbody'), rows);
}

$('id-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const ids = $('ids').value.split(/[\s,;]+/).filter(Boolean);
  try {
    const r = await api('/api/admin/employee-ids', { method: 'POST', body: { ids, department: $('dept').value } });
    const skipped = r.skipped.length ? ` Already existed: ${r.skipped.join(', ')}.` : '';
    showMsg($('msg'), `Created ${r.created} ID(s).${skipped}`, 'ok');
    $('ids').value = '';
    await loadIds();
  } catch (err) {
    showMsg($('msg'), err.message);
  }
});

Promise.all([loadStats(), loadCertifications(), loadEmployees(), loadIds()]).catch((err) => showMsg($('emp-msg'), err.message));
