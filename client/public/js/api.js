export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { status: res.status });
  return data;
}

export function showMsg(el, text, kind = 'error') {
  el.textContent = text;
  el.className = `msg show ${kind}`;
}

export async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } finally { location.replace('/login'); }
}

// Fills every [data-company] element (and [data-company-input]) with the company name from the server.
export async function loadCompany() {
  try {
    const { company } = await (await fetch('/api/config')).json();
    document.querySelectorAll('[data-company]').forEach((el) => { el.textContent = company; });
    document.querySelectorAll('[data-company-input]').forEach((el) => { el.value = company; });
    return company;
  } catch {
    return 'DeltaMagnus';
  }
}
loadCompany();
