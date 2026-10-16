import { api, showMsg, logout } from '/static/js/api.js';

const stage = document.getElementById('stage');
const msg = document.getElementById('msg');
document.getElementById('logout').addEventListener('click', logout);

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

async function main() {
  let attempt;
  try {
    attempt = await api('/api/attempts/current');
  } catch (err) {
    return location.replace(err.status === 401 ? '/login' : '/welcome');
  }
  if (attempt.status !== 'quiz') return location.replace('/game');
  runQuiz(attempt);
}

function runQuiz({ attemptId, questions }) {
  const answers = [];
  let i = 0;

  function show() {
    const q = questions[i];
    stage.replaceChildren();
    stage.append(el('p', 'progress', `Question ${i + 1} of ${questions.length}`), el('h1', 'qtext', q.text));

    let chosen = null;
    const next = el('button', 'primary quiz-actions', i === questions.length - 1 ? 'Submit quiz' : 'Next question');
    next.type = 'button';
    next.disabled = true;

    q.options.forEach((text, idx) => {
      const label = el('label', 'opt');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'answer';
      radio.addEventListener('change', () => { chosen = idx; next.disabled = false; });
      label.append(radio, el('span', '', text));
      stage.append(label);
    });

    next.addEventListener('click', () => {
      answers[i] = chosen;
      if (i < questions.length - 1) { i++; show(); } else submit();
    });
    stage.append(next);
  }

  async function submit() {
    stage.replaceChildren(el('p', 'progress', 'Grading your answers...'));
    try {
      const result = await api(`/api/attempts/${attemptId}/quiz`, { method: 'POST', body: { answers } });
      showReview(result);
    } catch (err) {
      showMsg(msg, err.message);
      if (err.status === 409) location.replace('/game');
    }
  }

  function showReview({ correctCount, total, review }) {
    stage.replaceChildren(el('h1', 'score-line', `Quiz result: ${correctCount} of ${total} correct`));
    review.forEach((r) => {
      const card = el('div', `rev ${r.correct ? 'good' : 'bad'}`);
      card.append(el('h3', '', r.text));
      card.append(el('p', '', `Your answer: ${r.options[r.selected]}`));
      if (!r.correct) card.append(el('p', '', `Correct answer: ${r.options[r.correctIndex]}`));
      card.append(el('p', '', r.explanation));
      stage.append(card);
    });
    const go = el('a', 'primary quiz-actions', 'Begin inspection');
    go.href = '/game';
    stage.append(go, el('p', 'hint', 'The timer starts when the inspection opens.'));
  }

  show();
}

main();
