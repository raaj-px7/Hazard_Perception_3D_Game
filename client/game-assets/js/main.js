// js/main.js - Hazard Hunt 3D Main Entry Point & App Lifecycle

import * as THREE from 'three';

import { CONFIG } from './config.js';
import { ModelLoader } from './modelLoader.js';
import { buildWarehouse } from './warehouseBuilder.js';
import { ObjectManager } from './objects.js';
import { AttemptSession } from './session.js';
import { Player } from './player.js';
import { InteractionManager } from './interaction.js';
import { ScoreKeeper } from './score.js';
import { UIManager } from './ui.js';

class HazardHuntApp {
    constructor(session, state) {
        this.session = session;
        this.layout = state.layout;
        this.ended = false;
        this.container = document.getElementById('canvas-container');
        
        this.clock = new THREE.Clock();
        this.initThree();
        this.initManagers();
        this.restoreProgress(state);
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    initThree() {
        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0e1117);
        this.scene.fog = new THREE.FogExp2(0x0e1117, 0.015);

        // 2. Camera
        const { initialPos, fov, near, far } = CONFIG.camera;
        this.camera = new THREE.PerspectiveCamera(
            fov,
            window.innerWidth / window.innerHeight,
            near,
            far
        );
        this.camera.position.set(initialPos.x, initialPos.y, initialPos.z);

        // 3. Renderer with PBR shadows & tone mapping
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.container.appendChild(this.renderer.domElement);

        // 4. Keyboard state (movement keys are read by the Player every frame)
        this.keys = {};
        const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        window.addEventListener('keydown', (e) => {
            if (movementKeys.includes(e.code)) { e.preventDefault(); this.keys[e.code] = true; }
            if (e.key === 'Shift') this.keys.Shift = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.key === 'Shift') this.keys.Shift = false;
        });
        window.addEventListener('blur', () => { this.keys = {}; });

        // 5. Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const mainSunLight = new THREE.DirectionalLight(0xfff5ea, 1.2);
        mainSunLight.position.set(15, 25, 10);
        mainSunLight.castShadow = true;
        mainSunLight.shadow.mapSize.width = 2048;
        mainSunLight.shadow.mapSize.height = 2048;
        mainSunLight.shadow.camera.near = 0.5;
        mainSunLight.shadow.camera.far = 60;
        mainSunLight.shadow.camera.left = -25;
        mainSunLight.shadow.camera.right = 25;
        mainSunLight.shadow.camera.top = 25;
        mainSunLight.shadow.camera.bottom = -25;
        this.scene.add(mainSunLight);
    }

    initManagers() {
        this.modelLoader = new ModelLoader();
        
        // Build 3D Warehouse Environment
        this.warehouse = buildWarehouse(this.scene, this.modelLoader);

        // Build every object from the layout the server drew for this attempt. The browser does not know
        // which are hazards: that is revealed one object at a time when the employee inspects it.
        this.objects = new ObjectManager(this.scene, this.modelLoader);
        this.objects.build(this.layout);

        // The inspector the employee walks around with. Racks, vehicles and crates are solid.
        this.player = new Player(this.scene, this.camera, this.renderer.domElement);
        this.player.collectObstacles([
            ...this.warehouse.children,
            ...Array.from(this.objects.map.values(), (r) => r.group)
        ]);

        // Score Keeper
        this.scoreKeeper = new ScoreKeeper();

        // UI Manager
        this.uiManager = new UIManager(
            this.objects,
            this.session,
            this.scoreKeeper,
            () => this.restartGame(),
            () => this.handleTimeUp()
        );

        // Interaction & Raycaster
        this.interactionManager = new InteractionManager(
            this.camera,
            this.scene,
            this.player,
            this.objects,
            this.scoreKeeper,
            this.uiManager,
            this.session,
            () => this.endInspection()
        );
    }

    // After a page reload the server tells us what was already found and how much time is used.
    restoreProgress(state) {
        state.inspected.forEach(({ id, kind, card }) => {
            const rec = this.objects.markInspected(id, kind, card);
            if (!rec) return;
            if (kind === 'hazard') this.scoreKeeper.addPoint({ id, ...card });
            this.interactionManager.createFoundBeaconRing(rec.data.position, kind === 'hazard' ? undefined : 0xffb800);
        });
        this.scoreKeeper.applyServerState(state);
        this.scoreKeeper.resumeElapsed = Math.min(state.elapsedSeconds, state.timeLimitSeconds);
        this.uiManager.updateScoreHUD(state.score, state.hazardsFound, CONFIG.totalHazards);
    }

    // Closes the inspection on the server and shows the official result.
    async endInspection() {
        if (this.ended) return;
        this.ended = true;
        this.scoreKeeper.finish();
        ['hazardModal', 'qualificationModal'].forEach((m) => this.uiManager.hideModal(this.uiManager[m]));
        this.uiManager.hideModal(document.getElementById('safe-modal'));
        try {
            const result = await this.session.finish();
            this.uiManager.showResultModal(result, result.endReason === 'timeup');
        } catch {
            this.ended = false;
            this.uiManager.showToast('⚠️ Could not save your result. Check your connection and reload this page.', 'error');
        }
    }

    // Restart is no longer allowed: leaving ends this attempt and a new one starts with a new quiz.
    async restartGame() {
        if (!this.ended) {
            if (!confirm('Leaving ends this attempt and keeps your current score. Go back to the welcome screen?')) return;
            try { await this.session.finish(); } catch { /* the next attempt closes it */ }
        }
        location.assign('/welcome');
    }

    handleTimeUp() {
        // Ignore duplicate timeout calls.
        if (!this.scoreKeeper.isFinished) return;

        if (this.uiManager.hudTimer) this.uiManager.hudTimer.textContent = '00:00';
        this.uiManager.showToast('⏰ TIME UP! Inspection ended.', 'info');
        setTimeout(() => this.endInspection(), 500);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        const elapsedTime = this.clock.getElapsedTime();

        // Movement and interaction pause while a pop-up is open or the inspection has ended.
        const frozen = this.ended || !!document.querySelector('.modal-overlay.active');
        this.player.update(delta, this.keys, frozen);
        this.interactionManager.update(frozen);
        this.objects.animate(elapsedTime);
        this.renderer.render(this.scene, this.camera);
    }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', async () => {
    // The game opens only for an attempt whose quiz is finished (the server guards the page too).
    let session, state;
    try {
        const res = await fetch('/api/attempts/current', { credentials: 'same-origin' });
        if (res.status === 401) { location.replace('/login'); return; }
        if (res.status === 403) { location.replace('/admin'); return; }
        if (res.status === 404) { location.replace('/welcome'); return; }
        const attempt = await res.json();
        if (attempt.status !== 'inspecting') { location.replace('/quiz'); return; }
        session = new AttemptSession(attempt.attemptId);
        state = await session.start(); // starts (or resumes) the server-side clock
    } catch {
        location.replace('/login');
        return;
    }

    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); }
        finally { location.replace('/login'); }
    });

    new HazardHuntApp(session, state);
    // The welcome screen and quiz replace the old start modal: begin the inspection immediately.
    document.getElementById('btn-start-game').click();
});
