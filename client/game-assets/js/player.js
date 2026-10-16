// js/player.js - Walkable inspector avatar with a third-person follow camera

import * as THREE from 'three';
import { CONFIG } from './config.js';

const P = CONFIG.player;
const AVATAR_LAYER = 1; // the avatar sits on layer 1, so mouse rays pass through it (the camera draws both layers)
const clamp = THREE.MathUtils.clamp;
const turnToward = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, t);

export class Player {
    constructor(scene, camera, domElement) {
        this.scene = scene;
        this.camera = camera;
        this.dom = domElement;
        this.obstacles = [];
        this.position = new THREE.Vector3(P.spawn.x, 0, P.spawn.z);
        this.yaw = 0;            // camera heading: 0 looks toward -z, into the warehouse
        this.pitch = 0.45;       // camera height angle
        this.distance = P.cameraDistance;
        this.facing = Math.PI;   // avatar heading (PI faces -z)
        this.walkPhase = 0;
        this.swing = 0;
        this.moving = false;

        camera.layers.enable(AVATAR_LAYER);
        this.buildAvatar();
        this.bindPointer();
        this.syncAvatar();
        this.updateCamera();
    }

    // ---------- avatar ----------
    buildAvatar() {
        const mat = (color, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
        const skin = mat(0xe0a98b), vest = mat(0xff5500, 0.5), pants = mat(0x2b3e50, 0.7);
        const helmet = mat(0xffcc00, 0.3, 0.2), boot = mat(0x222222, 0.8), glove = mat(0x33383f), tape = mat(0xdde3ea, 0.3, 0.4);

        const avatar = new THREE.Group();
        const part = (geo, material, x, y, z, parent = avatar) => {
            const m = new THREE.Mesh(geo, material);
            m.position.set(x, y, z);
            m.castShadow = true;
            parent.add(m);
            return m;
        };
        const limb = (x, y, upperLen, upperMat, tipMat, tipGeo, tipY) => {
            const pivot = new THREE.Group();
            pivot.position.set(x, y, 0);
            part(new THREE.CylinderGeometry(0.12, 0.11, upperLen, 10), upperMat, 0, -upperLen / 2, 0, pivot);
            part(tipGeo, tipMat, 0, tipY, tipMat === boot ? 0.07 : 0, pivot);
            avatar.add(pivot);
            return pivot;
        };

        this.legL = limb(-0.2, 0.95, 0.8, pants, boot, new THREE.BoxGeometry(0.26, 0.18, 0.42), -0.84);
        this.legR = limb(0.2, 0.95, 0.8, pants, boot, new THREE.BoxGeometry(0.26, 0.18, 0.42), -0.84);
        this.armL = limb(-0.46, 1.65, 0.7, vest, glove, new THREE.SphereGeometry(0.1, 10, 8), -0.74);
        this.armR = limb(0.46, 1.65, 0.7, vest, glove, new THREE.SphereGeometry(0.1, 10, 8), -0.74);

        part(new THREE.BoxGeometry(0.7, 0.75, 0.4), vest, 0, 1.3, 0);                 // torso (high-vis vest)
        part(new THREE.BoxGeometry(0.72, 0.07, 0.42), tape, 0, 1.2, 0);               // reflective stripes
        part(new THREE.BoxGeometry(0.72, 0.07, 0.42), tape, 0, 1.45, 0);
        part(new THREE.SphereGeometry(0.2, 14, 12), skin, 0, 1.9, 0);                 // head
        part(new THREE.SphereGeometry(0.235, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), helmet, 0, 1.93, 0); // hard hat
        part(new THREE.BoxGeometry(0.42, 0.04, 0.22), helmet, 0, 1.94, 0.2);          // brim marks the front (+z)

        avatar.traverse((o) => o.layers.set(AVATAR_LAYER));
        this.avatar = avatar;
        this.scene.add(avatar);
    }

    syncAvatar() {
        const bob = this.moving ? Math.abs(Math.sin(this.walkPhase)) * 0.05 : 0;
        this.avatar.position.set(this.position.x, bob, this.position.z);
        this.avatar.rotation.y = this.facing;
    }

    // ---------- collisions ----------
    // Solid objects the player cannot walk through: anything that reaches body height and is not a wall or floor.
    collectObstacles(objects) {
        const box = new THREE.Box3();
        const size = new THREE.Vector3();
        this.obstacles = [];
        objects.forEach((obj) => {
            obj.updateMatrixWorld(true);
            box.setFromObject(obj);
            if (box.isEmpty()) return;
            box.getSize(size);
            if (box.min.y < 1.0 && box.max.y > 0.5 && size.x < 22 && size.z < 22) this.obstacles.push(box.clone());
        });
        this.placeFree();
    }

    hits(x, z) {
        const r = P.radius;
        return this.obstacles.some((b) => x > b.min.x - r && x < b.max.x + r && z > b.min.z - r && z < b.max.z + r);
    }

    bounds() {
        return { hw: CONFIG.warehouse.width / 2 - 1.2, hl: CONFIG.warehouse.length / 2 - 1.2 };
    }

    // If the spawn point overlaps something, step outward to the nearest free floor.
    placeFree() {
        if (!this.hits(this.position.x, this.position.z)) return;
        const { hw, hl } = this.bounds();
        for (let r = 1; r <= 14; r++) {
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                const x = this.position.x + Math.cos(a) * r;
                const z = this.position.z + Math.sin(a) * r;
                if (Math.abs(x) <= hw && Math.abs(z) <= hl && !this.hits(x, z)) { this.position.set(x, 0, z); return; }
            }
        }
    }

    // One axis at a time, so the player slides along walls and racks instead of sticking.
    tryMove(dx, dz) {
        const { hw, hl } = this.bounds();
        const x = clamp(this.position.x + dx, -hw, hw);
        const z = clamp(this.position.z + dz, -hl, hl);
        if (!this.hits(x, z)) { this.position.x = x; this.position.z = z; }
    }

    distanceTo(pos) {
        return Math.hypot(pos.x - this.position.x, pos.z - this.position.z);
    }

    // ---------- camera input ----------
    bindPointer() {
        let last = null;
        this.dom.addEventListener('pointerdown', (e) => { last = { x: e.clientX, y: e.clientY }; });
        window.addEventListener('pointermove', (e) => {
            if (!last || !e.buttons) return;
            this.yaw -= (e.clientX - last.x) * 0.005;
            this.pitch = clamp(this.pitch + (e.clientY - last.y) * 0.004, 0.12, 1.15);
            last = { x: e.clientX, y: e.clientY };
        });
        window.addEventListener('pointerup', () => { last = null; });
        this.dom.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.distance = clamp(this.distance + Math.sign(e.deltaY) * 0.6, P.minDistance, P.maxDistance);
        }, { passive: false });
        this.dom.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // ---------- per-frame ----------
    update(delta, keys, frozen) {
        if (!frozen) {
            const turn = 1.8 * delta;
            if (keys.ArrowLeft) this.yaw += turn;
            if (keys.ArrowRight) this.yaw -= turn;
            if (keys.ArrowUp) this.pitch = Math.max(0.12, this.pitch - turn * 0.6);
            if (keys.ArrowDown) this.pitch = Math.min(1.15, this.pitch + turn * 0.6);
        }

        // WASD is relative to where the camera looks.
        const fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
        const st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
        const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
        let dx = -sin * fw + cos * st;
        let dz = -cos * fw - sin * st;
        const len = Math.hypot(dx, dz);

        this.moving = !frozen && len > 0;
        if (this.moving) {
            const speed = keys.Shift ? P.runSpeed : P.walkSpeed;
            dx = (dx / len) * speed * delta;
            dz = (dz / len) * speed * delta;
            this.tryMove(dx, 0);
            this.tryMove(0, dz);
            this.facing = turnToward(this.facing, Math.atan2(dx, dz), 12 * delta);
            this.walkPhase += speed * delta * 1.6;
        }

        // Swing legs and arms while walking, ease back to standing when stopped.
        const target = this.moving ? Math.sin(this.walkPhase) * 0.7 : 0;
        this.swing += (target - this.swing) * Math.min(1, delta * 12);
        this.legL.rotation.x = this.swing;
        this.legR.rotation.x = -this.swing;
        this.armL.rotation.x = -this.swing * 0.8;
        this.armR.rotation.x = this.swing * 0.8;

        this.syncAvatar();
        this.updateCamera();
    }

    updateCamera() {
        const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        const tx = this.position.x, ty = 1.6, tz = this.position.z;
        const { width, length, height } = CONFIG.warehouse;
        const cx = clamp(tx + Math.sin(this.yaw) * this.distance * cp, -width / 2 + 0.5, width / 2 - 0.5);
        const cz = clamp(tz + Math.cos(this.yaw) * this.distance * cp, -length / 2 + 0.5, length / 2 - 0.5);
        const cy = clamp(ty + this.distance * sp, 0.5, height - 0.5);
        this.camera.position.set(cx, cy, cz);
        this.camera.lookAt(tx, ty - 0.2, tz);
    }
}
