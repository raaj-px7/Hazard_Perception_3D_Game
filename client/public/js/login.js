import { api, showMsg } from '/static/js/api.js';

const form = document.getElementById('login-form');
const msg = document.getElementById('msg');
const btn = form.querySelector('button');

if (new URLSearchParams(location.search).get('registered')) {
  showMsg(msg, 'Registration successful. Please log in with your new account.', 'ok');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  try {
    const { redirect } = await api('/api/auth/login', {
      method: 'POST',
      body: { email: form.email.value, password: form.password.value },
    });
    location.replace(redirect);
  } catch (err) {
    showMsg(msg, err.message);
    btn.disabled = false;
  }
});
