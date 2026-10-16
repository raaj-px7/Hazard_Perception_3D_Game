// js/ui.js - DOM Controller for HUD, Modals, Toasts, & Drawer Checklist

import { sound } from './audio.js';
import { CONFIG, SCORING } from './config.js';

export class UIManager {
    constructor(objects, session, scoreKeeper, onRestartCallback, onTimeUpCallback) {
        this.objects = objects;
        this.session = session;
        this.scoreKeeper = scoreKeeper;
        this.onRestartCallback = onRestartCallback;
        this.onTimeUpCallback = onTimeUpCallback;

        this.initDOMElements();
        this.bindEvents();
    }

    initDOMElements() {
        // Cache DOM elements
        this.hudScore = document.getElementById('hud-score');
        this.hudTimer = document.getElementById('hud-timer');
        this.toastContainer = document.getElementById('toast-container');
        this.startModal = document.getElementById('start-modal');
        this.helpModal = document.getElementById('help-modal');
        this.hazardModal = document.getElementById('hazard-modal');
        this.victoryModal = document.getElementById('victory-modal');
        this.qualificationModal = document.getElementById('qualification-modal');
        this.checklistContainer = document.getElementById('hazard-checklist');

        // Buttons
        this.btnStart = document.getElementById('btn-start-game');
        this.btnRestart = document.getElementById('btn-restart');
        this.btnRestartHud = document.getElementById('btn-restart-hud');
        this.btnMute = document.getElementById('btn-mute');
        this.btnFullscreen = document.getElementById('btn-fullscreen');
        this.btnHelp = document.getElementById('btn-help');
        this.btnCloseHelp = document.getElementById('btn-close-help');
        this.btnHint = document.getElementById('btn-hint');
        this.btnCloseQualification = document.getElementById('btn-close-qualification');

        // Render initial hazard checklist badges
        this.renderChecklist();
    }

    bindEvents() {
        if (this.btnCloseQualification) {
            this.btnCloseQualification.addEventListener('click', () => {
                sound.playClick();
                this.hideModal(this.qualificationModal);
            });
        }
        if (this.btnStart) {
            this.btnStart.addEventListener('click', () => {
                // Do not restart the countdown if the instructions modal was reopened mid-game.
                if (this.scoreKeeper.timerInterval) {
                    this.hideModal(this.startModal);
                    return;
                }
                sound.playClick();
                this.hideModal(this.startModal);
                this.scoreKeeper.startTimer(
                    (timeStr) => {
                        if (this.hudTimer) this.hudTimer.textContent = timeStr;
                    },
                    () => {
                        if (this.onTimeUpCallback) this.onTimeUpCallback();
                    }
                );
            });
        }

        if (this.btnHelp) {
            this.btnHelp.addEventListener('click', () => {
                sound.playClick();
                // Purely informational: shows movement/controls/objective only.
                // Does NOT touch score, hazards, camera, or the timer.
                this.showModal(this.helpModal);
            });
        }

        if (this.btnCloseHelp) {
            this.btnCloseHelp.addEventListener('click', () => {
                sound.playClick();
                this.hideModal(this.helpModal);
            });
        }

        if (this.btnMute) {
            this.btnMute.addEventListener('click', () => {
                const muted = sound.toggleMute();
                this.btnMute.textContent = muted ? '🔇' : '🔊';
                this.btnMute.title = muted ? 'Unmute Sound' : 'Mute Sound';
            });
        }

        if (this.btnFullscreen) {
            this.btnFullscreen.addEventListener('click', () => {
                sound.playClick();
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => {
                        console.warn("Fullscreen failed: ", err);
                    });
                } else {
                    document.exitFullscreen();
                }
            });
        }

        if (this.btnRestart) {
            this.btnRestart.addEventListener('click', () => {
                sound.playClick();
                this.hideModal(this.victoryModal);
                if (this.onRestartCallback) this.onRestartCallback();
            });
        }

        if (this.btnRestartHud) {
            this.btnRestartHud.addEventListener('click', () => {
                sound.playClick();
                // Close out any modal that might be open mid-game before restarting.
                this.hideModal(this.hazardModal);
                this.hideModal(this.qualificationModal);
                this.hideModal(this.victoryModal);
                if (this.onRestartCallback) this.onRestartCallback();
            });
        }

        // Close hazard detail modal button
        const btnCloseHazard = document.getElementById('btn-close-hazard');
        if (btnCloseHazard) {
            btnCloseHazard.addEventListener('click', () => {
                sound.playClick();
                this.hideModal(this.hazardModal);
            });
        }

        const btnCloseSafe = document.getElementById('btn-close-safe');
        if (btnCloseSafe) {
            btnCloseSafe.addEventListener('click', () => {
                sound.playClick();
                this.hideModal(document.getElementById('safe-modal'));
            });
        }

        // Hint system
        if (this.btnHint) {
            this.btnHint.addEventListener('click', () => {
                sound.playClick();
                this.provideHint();
            });
        }
    }

    // One badge per hazard to find: found ones show their title, the rest stay hidden ("which" is unknown until inspected).
    renderChecklist() {
        if (!this.checklistContainer) return;
        this.checklistContainer.innerHTML = '';
        const found = this.objects.hazardsFound();
        for (let i = 0; i < CONFIG.totalHazards; i++) {
            const rec = found[i];
            const badge = document.createElement('div');
            badge.className = `checklist-badge ${rec ? 'found' : ''}`;
            const icon = document.createElement('span');
            icon.className = 'badge-icon';
            icon.textContent = rec ? '✅' : '❓';
            const title = document.createElement('span');
            title.className = 'badge-title';
            title.textContent = rec ? rec.card.title : 'Unidentified Hazard';
            badge.append(icon, title);
            if (rec) badge.addEventListener('click', () => this.openHazardModal(rec.card));
            this.checklistContainer.appendChild(badge);
        }
    }

    updateScoreHUD(percent = 0, found = 0, total = CONFIG.totalHazards) {
        if (this.hudScore) {
            this.hudScore.textContent = `SCORE: ${percent}%  |  ${found}/${total} FOUND`;
            // Pulse animation on score change
            this.hudScore.classList.add('pulse');
            setTimeout(() => this.hudScore.classList.remove('pulse'), 400);
        }
        this.renderChecklist();
    }

    showToast(message, type = 'info') {
        if (!this.toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 400);
        }, 2200);
    }

    openHazardModal(data) {
        document.getElementById('hazard-title').textContent = data.title;
        document.getElementById('hazard-category').textContent = data.category;
        document.getElementById('hazard-severity').textContent = data.severity;
        document.getElementById('hazard-desc').textContent = data.description;
        document.getElementById('hazard-tip').textContent = data.tip;

        const severityBadge = document.getElementById('hazard-severity');
        if (severityBadge) {
            severityBadge.className = `severity-tag severity-${data.severity.toLowerCase()}`;
        }

        this.showModal(this.hazardModal);
    }

    showQualificationModal() {
        sound.playWin();
        this.showModal(this.qualificationModal);
    }

    openSafeModal(data) {
        document.getElementById('safe-title').textContent = data.title;
        document.getElementById('safe-desc').textContent = data.description;
        document.getElementById('safe-tip').textContent = data.tip;
        this.showModal(document.getElementById('safe-modal'));
    }

    // Final report card. Every number here comes from the server's saved result.
    showResultModal(result, timeUp = false) {
        const verdict = result.qualified
            ? '✅ WORKPLACE QUALIFIED'
            : `Not qualified yet (${SCORING.qualifyPercent}% needed)`;
        const certNote = result.certificate
            ? ` | Certificate issued, valid until ${new Date(result.certificate.expiresAt).toLocaleDateString([], { dateStyle: 'long' })}. Download it from the welcome page.`
            : '';
        document.getElementById('victory-subtitle').textContent = `${timeUp ? '⏰ TIME UP — ' : ''}${verdict}${certNote}`;

        const colors = { 'S+': '#00E676', A: '#29B6F6', B: '#FFCA28', C: '#FF7043', F: '#FF5252' };
        const gradeEl = document.getElementById('victory-grade');
        gradeEl.textContent = result.grade;
        gradeEl.style.color = colors[result.grade] || '#ffffff';
        document.getElementById('victory-rating-title').textContent = result.title;
        document.getElementById('victory-score').textContent = `${result.score}%`;
        document.getElementById('victory-found').textContent = `${result.hazardsFound}/${CONFIG.totalHazards}`;
        document.getElementById('victory-mistakes').textContent = String(result.safeMistakes);
        document.getElementById('victory-time').textContent = this.scoreKeeper.formatTime(result.durationSeconds);

        const body = document.getElementById('victory-hazards-list');
        body.replaceChildren();
        let n = 0;
        result.review.forEach((h) => {
            const row = document.createElement('tr');
            const sev = document.createElement('span');
            sev.className = `severity-tag severity-${h.severity.toLowerCase()}`;
            sev.textContent = h.severity;
            const cells = [`#${++n}`, h.title, sev, h.found ? '✅ Found' : '❌ Missed'];
            cells.forEach((c) => {
                const td = document.createElement('td');
                td.append(c);
                row.appendChild(td);
            });
            body.appendChild(row);
        });

        this.showModal(this.victoryModal);
    }

    // The server picks the hint, because the browser does not know which objects are hazards.
    async provideHint() {
        try {
            const h = await this.session.hint();
            if (h.done) { this.showToast('🎉 All hazards have already been identified!', 'success'); return; }
            this.showToast(`💡 HINT: Still to find: ${h.title.toLowerCase()} (${h.category}).`, 'info');
        } catch {
            this.showToast('⚠️ Could not get a hint. Check your connection.', 'error');
        }
    }

    showModal(modalEl) {
        if (modalEl) modalEl.classList.add('active');
    }

    hideModal(modalEl) {
        if (modalEl) modalEl.classList.remove('active');
    }
}
