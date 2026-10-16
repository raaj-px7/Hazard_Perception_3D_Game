// js/session.js - Talks to the server about this inspection. The server owns the official score.

export class AttemptSession {
    constructor(attemptId) {
        this.attemptId = attemptId;
    }

    async _post(path, body) {
        const res = await fetch(`/api/attempts/${this.attemptId}/${path}`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
        return data;
    }

    start() { return this._post('start'); }
    click(objectId) { return this._post('click', { objectId }); }
    hint() { return this._post('hint'); }
    finish() { return this._post('finish'); }
}
