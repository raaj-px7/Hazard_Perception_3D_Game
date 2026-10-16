import { api, showMsg } from '/static/js/api.js';

const form = document.getElementById('register-form');
const msg = document.getElementById('msg');
const btn = form.querySelector('button');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (form.password.value !== form.confirm.value) return showMsg(msg, 'Passwords do not match.');
  btn.disabled = true;
  try {
    await api('/api/auth/register', {
      method: 'POST',
      body: { employeeId: form.employeeId.value, name: form.name.value, email: form.email.value, password: form.password.value },
    });
    location.replace('/login?registered=1');
  } catch (err) {
    showMsg(msg, err.message);
    btn.disabled = false;
  }
});
