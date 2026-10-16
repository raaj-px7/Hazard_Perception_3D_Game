// js/interaction.js - Raycasting, Hover Effects, Object Clicks & Camera Focus

import * as THREE from 'three';
import { sound } from './audio.js';
import { SCORING, CONFIG } from './config.js';

export class InteractionManager {
    constructor(camera, scene, player, objects, scoreKeeper, uiManager, session, onFinish) {
        this.camera = camera;
        this.scene = scene;
        this.player = player;
        this.nearby = null; // the hotspot close enough to inspect with E
        this.objects = objects;
        this.scoreKeeper = scoreKeeper;
        this.uiManager = uiManager;
        this.session = session;
        this.onFinish = onFinish;
        this.pending = new Set(); // objects whose click is waiting for the server

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredObject = null;
        this.hoverOriginalEmissive = null;
        this.isCameraAnimating = false;
        this.pointerDown = { x: 0, y: 0 };
        this.isDragging = false;
        this.beaconRings = []; // Track found-hazard beacon rings so they can be cleared on restart

        this.initEventListeners();
    }

    initEventListeners() {
        const domElement = window;

        domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
        domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        domElement.addEventListener('pointerup', (e) => this.onPointerUp(e));
        window.addEventListener('keydown', (e) => { if (e.code === 'KeyE' && !e.repeat) this.inspectNearby(); });
    }

    onPointerMove(event) {
        // Prevent pointer raycasting if user is clicking on UI overlay modals/buttons
        if (event.target.closest('#hud-container') || event.target.closest('.modal-overlay')) {
            document.body.style.cursor = 'default';
            this.clearHover();
            return;
        }

        // Ignore the release of a mouse drag; OrbitControls owns that interaction.
        // A click is only processed when the pointer moved less than 6px.
        const movedX = event.clientX - this.pointerDown.x;
        const movedY = event.clientY - this.pointerDown.y;
        if (Math.hypot(movedX, movedY) > 6) {
            this.isDragging = true;
            return;
        }

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
            let hitObject = intersects[0].object;
            // Ignore floor, walls, ceiling grid from cursor highlight
            if (hitObject.name === "warehouse_environment" || hitObject.geometry instanceof THREE.PlaneGeometry) {
                document.body.style.cursor = 'default';
                this.clearHover();
                return;
            }

            document.body.style.cursor = 'pointer';
            this.setHover(hitObject);
        } else {
            document.body.style.cursor = 'default';
            this.clearHover();
        }
    }

    setHover(object) {
        if (this.hoveredObject === object) return;
        this.clearHover();

        this.hoveredObject = object;
        if (object.material && object.material.emissive) {
            this.hoverOriginalEmissive = object.material.emissive.getHex();
            object.material.emissive.setHex(0x444422); // Mild golden hover glow
        }
    }

    clearHover() {
        if (this.hoveredObject) {
            if (this.hoveredObject.material && this.hoveredObject.material.emissive && this.hoverOriginalEmissive !== null) {
                this.hoveredObject.material.emissive.setHex(this.hoverOriginalEmissive);
            }
            this.hoveredObject = null;
            this.hoverOriginalEmissive = null;
        }
    }

    onPointerDown(event) {
        // Store the pointer position. We wait for pointerup before deciding
        // whether this was a click or an OrbitControls drag.
        this.pointerDown.x = event.clientX;
        this.pointerDown.y = event.clientY;
        this.isDragging = false;

        if (event.target.closest('#hud-container') || event.target.closest('.modal-overlay')) {
            return;
        }
    }

    onPointerUp(event) {
        if (event.target.closest('#hud-container') || event.target.closest('.modal-overlay')) {
            this.isDragging = false;
            return;
        }

        const movedX = event.clientX - this.pointerDown.x;
        const movedY = event.clientY - this.pointerDown.y;
        if (Math.hypot(movedX, movedY) > 6) {
            this.isDragging = false;
            return;
        }

        // A click only matters when the ray hits a hazard. Everything else is silent.
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        if (intersects.length === 0) {
            this.isDragging = false;
            return;
        }

        const target = intersects[0].object.userData;
        if (target && target.inspectable) {
            if (!this.inRange(target.data.position)) {
                this.uiManager.showToast('🚶 Walk closer to inspect this object.', 'info');
            } else {
                this.inspect(target);
            }
        }

        this.isDragging = false;
    }

    // Sends a click to the server, which decides the points. Returns null on failure.
    async reportClick(objectId) {
        this.pending.add(objectId);
        try {
            return await this.session.click(objectId);
        } catch (err) {
            if (err.data && err.data.timeUp) this.onFinish();
            else this.uiManager.showToast('⚠️ Connection problem. Please click again.', 'error');
            return null;
        } finally {
            this.pending.delete(objectId);
        }
    }

    // Inspect one object. The server says what it is (hazard or safe) and sends the card text.
    async inspect(target) {
        // No interaction is allowed after the countdown has ended.
        if (this.scoreKeeper.isFinished) return;
        const id = target.objectId;
        const rec = this.objects.map.get(id);
        if (!rec || this.pending.has(id)) return;

        if (rec.state) {
            sound.playClick();
            const label = rec.card.title;
            this.uiManager.showToast(rec.state === 'hazard' ? `⚠️ Already Found: ${label}` : `Already checked: ${label}`, 'info');
            return;
        }

        const res = await this.reportClick(id);
        if (!res || this.scoreKeeper.isFinished) return;
        const kind = res.kind || res.result;
        if (res.result === 'repeat') { this.objects.markInspected(id, kind, res.card); return; }

        this.objects.markInspected(id, kind, res.card);
        this.scoreKeeper.applyServerState(res);
        this.uiManager.updateScoreHUD(res.score, res.hazardsFound, this.scoreKeeper.totalHazards);

        if (kind === 'hazard') {
            sound.playCorrect();
            this.scoreKeeper.addPoint({ id, ...res.card });
            this.uiManager.showToast(`✅ CORRECT! +${SCORING.hazardPoints}%: ${res.card.title}`, 'success');
            this.uiManager.openHazardModal(res.card);
            this.createFoundBeaconRing(rec.data.position);

            const milestone = this.scoreKeeper.getMilestoneFeedback(res.hazardsFound);
            if (milestone) setTimeout(() => this.uiManager.showToast(milestone.text, 'info'), 600);

            // All 10 found: the server closes the inspection and shows the result.
            if (res.hazardsFound >= this.scoreKeeper.totalHazards) {
                setTimeout(() => { sound.playWin(); this.onFinish(); }, 1200);
            }
        } else {
            // A safe object: costs points (once per object) but teaches why it is fine.
            sound.playIncorrect();
            this.uiManager.showToast(`❌ That one is SAFE: ${res.card.title}. Penalty -${SCORING.safePenalty}%`, 'error');
            this.uiManager.openSafeModal(res.card);
            this.createFoundBeaconRing(rec.data.position, 0xffb800);
        }
    }

    handleNormalClick() {
        // Safe objects and empty space are intentionally silent: no score change,
        // no toast, no sound, and no visual click effect.
    }

    // Green beacon ring on identified hazard
    createFoundBeaconRing(position, color = 0x00e676) {
        const ringGeo = new THREE.RingGeometry(1.2, 1.5, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(position.x, 0.05, position.z);
        ring.rotation.x = Math.PI / 2;
        this.scene.add(ring);
        this.beaconRings.push(ring);
    }

    // Remove all found-hazard beacon rings from the scene (called on restart / return-to-start)
    clearBeaconRings() {
        this.beaconRings.forEach((ring) => {
            this.scene.remove(ring);
            ring.geometry.dispose();
            ring.material.dispose();
        });
        this.beaconRings = [];
    }

    inRange(position) {
        return this.player.distanceTo(position) <= CONFIG.player.interactRange;
    }

    // Each frame: find the closest hotspot not yet inspected and show the prompt.
    update(frozen) {
        let best = null;
        let bestDist = CONFIG.player.promptRange;
        if (!frozen && !this.scoreKeeper.isFinished) {
            this.objects.map.forEach((rec) => {
                if (rec.state) return;
                const d = this.player.distanceTo(rec.data.position);
                if (d < bestDist) { bestDist = d; best = rec.group.userData; }
            });
        }
        this.nearby = best;
        const prompt = document.getElementById('interact-prompt');
        if (prompt) prompt.hidden = !best;
    }

    // E key: inspect the hotspot the player is standing next to.
    inspectNearby() {
        if (!this.nearby || document.querySelector('.modal-overlay.active')) return;
        this.inspect(this.nearby);
    }
}
