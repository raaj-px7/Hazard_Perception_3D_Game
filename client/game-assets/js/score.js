// js/score.js - Score Keeper & Safety Rating Report Engine

import { CONFIG } from './config.js';

export class ScoreKeeper {
    constructor() {
        this.score = 0;
        this.totalHazards = CONFIG.totalHazards;
        this.attempts = 0;
        this.foundHazards = [];
        this.startTime = null;
        this.elapsedSeconds = 0;
        this.timerInterval = null;
        this.timeLimitSeconds = CONFIG.gameTimeLimit;
        this.isFinished = false;
        this.safeMistakes = 0;
        this.resumeElapsed = 0; // seconds already used when the page is reloaded mid-inspection
    }

    startTimer(onTickCallback, onTimeUpCallback) {
        this.startTime = Date.now() - this.resumeElapsed * 1000;
        this.elapsedSeconds = this.resumeElapsed;
        this.isFinished = false;
        if (this.timerInterval) clearInterval(this.timerInterval);

        const tick = () => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            this.elapsedSeconds = Math.min(elapsed, this.timeLimitSeconds);
            const remaining = Math.max(0, this.timeLimitSeconds - this.elapsedSeconds);

            if (onTickCallback) onTickCallback(this.formatTime(remaining));

            if (remaining <= 0) {
                this.finish();
                if (onTimeUpCallback) onTimeUpCallback();
            }
        };

        tick();
        this.timerInterval = setInterval(tick, 250);
    }

    finish() {
        this.isFinished = true;
        this.stopTimer();
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    reset() {
        this.score = 0;
        this.attempts = 0;
        this.foundHazards = [];
        this.safeMistakes = 0;
        this.resumeElapsed = 0;
        this.stopTimer();
        this.elapsedSeconds = 0;
        this.isFinished = false;
    }

    // Remembers which hazards were found. `score` is the official PERCENTAGE, set from the server.
    addPoint(hazardData) {
        if (!this.foundHazards.some(h => h.id === hazardData.id)) {
            this.foundHazards.push(hazardData);
        }
    }

    applyServerState(state) {
        this.score = state.score;
        this.safeMistakes = state.safeMistakes;
    }

    getMilestoneFeedback(score) {
        switch (score) {
            case 1: return { text: "Good start! First safety hazard identified.", qualified: false };
            case 2: return { text: "Keep scanning! 2 hazards marked safe.", qualified: false };
            case 3: return { text: "Great progress! 3/10 hazards spotted.", qualified: false };
            case 4: return { text: "Safety awareness improving! 4/10.", qualified: false };
            case 5: return { text: "Halfway there! 5/10 hazards found.", qualified: false };
            case 6: return { text: "6/10 hazards found. Keep going, and avoid the safe objects!", qualified: false };
            case 7: return { text: "Advanced inspector status! 7/10 hazards found.", qualified: false };
            case 8: return { text: "Almost a safety master! 8/10.", qualified: false };
            case 9: return { text: "Only 1 hazard remaining! Final stretch!", qualified: false };
            case 10: return { text: "All 10 hazards found!", qualified: false };
            default: return null;
        }
    }

    recordAttempt() {
        // Kept for compatibility with older code. Non-hazard clicks do not count.
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}
