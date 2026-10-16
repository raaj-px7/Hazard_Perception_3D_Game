// js/objects.js - Builds the scene objects from the layout the server sent.
// The browser only knows WHERE each object is and WHICH MODEL to draw. Whether it is a hazard, and its
// title / tip, arrive from the server when the employee inspects it.
//
// To add a model: add a builder below (key = the catalog's `model`), then run `npm run check:ids`.

import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, ...extra });

// Each builder returns a Group centred on its own origin; the layout position is applied afterwards.
const BUILDERS = {
    puddle: () => {
        const group = new THREE.Group();
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.bezierCurveTo(1.5, 0.5, 2.0, 1.8, 0.8, 2.5);
        shape.bezierCurveTo(-0.5, 2.8, -1.8, 1.5, -1.2, 0.5);
        shape.bezierCurveTo(-0.8, -0.4, -0.4, -0.5, 0, 0);
        const puddle = new THREE.Mesh(
            new THREE.ShapeGeometry(shape),
            mat(0x2471a3, { roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.85 })
        );
        puddle.rotation.x = -Math.PI / 2;
        puddle.position.y = 0.02;
        puddle.name = 'water_puddle_mesh';
        group.add(puddle);
        return group;
    },

    leaning_boxes: (ml) => {
        const group = new THREE.Group();
        const box1 = ml.createCardboardBox(1.2, 1.0, 1.2, 'TOP HEAVY');
        box1.position.set(0, 0.5, 0);
        group.add(box1);
        const box2 = ml.createCardboardBox(1.1, 0.9, 1.1, 'DANGER LEAN');
        box2.position.set(0.1, 1.45, 0.1);
        box2.rotation.z = 0.18;
        box2.rotation.x = 0.22;
        group.add(box2);
        const box3 = ml.createCardboardBox(1.0, 0.8, 1.0, 'FRAGILE');
        box3.position.set(0.35, 2.25, 0.35);
        box3.rotation.z = 0.38;
        box3.rotation.x = 0.45;
        group.add(box3);
        return group;
    },

    exit_pile: (ml) => {
        const group = new THREE.Group();
        const pallet1 = ml.createPallet(2.4, 2.4);
        pallet1.position.set(0, 0.1, 0);
        pallet1.rotation.y = 0.2;
        group.add(pallet1);
        const crate1 = ml.createCardboardBox(1.4, 1.2, 1.4, 'OVERFLOW');
        crate1.position.set(-0.2, 0.7, -0.2);
        group.add(crate1);
        const crate2 = ml.createCardboardBox(1.2, 1.1, 1.2, 'SCRAP WAREHOUSE');
        crate2.position.set(0.2, 1.8, 0.1);
        crate2.rotation.y = 0.4;
        group.add(crate2);
        return group;
    },

    forklift_raised: (ml) => {
        const group = new THREE.Group();
        const forklift = ml.createForklift();
        forklift.rotation.y = -Math.PI / 3;
        group.add(forklift);
        const carriage = forklift.getObjectByName('forklift_carriage');
        if (carriage) carriage.position.y = 2.4; // forks raised, left unattended
        const elevatedCrate = ml.createCardboardBox(1.5, 1.2, 1.4, 'UNATTENDED LOAD');
        elevatedCrate.position.set(-1.4, 3.2, 1.9);
        group.add(elevatedCrate);
        return group;
    },

    worker_bent: (ml) => {
        const group = new THREE.Group();
        const worker = ml.createWorker(true); // true = improper spine posture
        worker.rotation.y = Math.PI / 4;
        group.add(worker);
        return group;
    },

    cable_run: () => {
        const group = new THREE.Group();
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-4, 0.04, -1),
            new THREE.Vector3(-1.5, 0.04, 1.2),
            new THREE.Vector3(1.5, 0.04, -0.8),
            new THREE.Vector3(4, 0.04, 1)
        ]);
        const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.06, 12, false), mat(0xe67e22, { roughness: 0.5 }));
        cable.castShadow = true;
        group.add(cable);
        return group;
    },

    pallet_drums_tilted: (ml) => {
        const group = new THREE.Group();
        const pallet = ml.createPallet(2.4, 2.4);
        pallet.rotation.z = 0.15;
        pallet.position.set(0, 0.1, 0);
        group.add(pallet);
        const drum1 = ml.createChemicalDrum(0xc0392b);
        drum1.position.set(-0.5, 0.3, -0.4);
        drum1.rotation.z = 0.15;
        group.add(drum1);
        const drum2 = ml.createChemicalDrum(0x8e44ad);
        drum2.position.set(0.5, 0.3, 0.4);
        drum2.rotation.z = 0.15;
        group.add(drum2);
        return group;
    },

    crate_big: (ml) => {
        const group = new THREE.Group();
        const box = ml.createCardboardBox(2.2, 1.6, 2.2, 'OVERHANGING CRATE');
        box.position.set(0, 0.8, 0);
        box.rotation.y = 0.3;
        group.add(box);
        return group;
    },

    ladder_oil: (ml) => {
        const group = new THREE.Group();
        const ladder = ml.createStepladder();
        ladder.rotation.z = 0.25;
        group.add(ladder);
        const oil = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), mat(0x111111, { roughness: 0.1, metalness: 0.9 }));
        oil.rotation.x = -Math.PI / 2;
        oil.position.set(0, 0.01, 0);
        group.add(oil);
        return group;
    },

    toolbox_edge: () => {
        const group = new THREE.Group();
        const toolbox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.8), mat(0x2c3e50, { roughness: 0.3, metalness: 0.8 }));
        toolbox.position.set(0.6, 0, 0.5); // half overhanging the beam
        toolbox.rotation.z = -0.2;
        toolbox.castShadow = true;
        group.add(toolbox);
        return group;
    },

    forklift_parked: (ml) => {
        const group = new THREE.Group();
        group.add(ml.createForklift()); // forks stay lowered (default pose)
        const chockMat = mat(0xffcc00, { roughness: 0.6 });
        [-1.2, 1.2].forEach((x) => {
            const chock = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.24, 0.5), chockMat);
            chock.position.set(x, 0.12, 1.4);
            chock.castShadow = true;
            group.add(chock);
        });
        return group;
    },

    pallet_neat: (ml) => {
        const group = new THREE.Group();
        group.add(ml.createPallet(2.4, 2.4));
        [0.75, 1.65].forEach((y) => {
            [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(([x, z]) => {
                const box = ml.createCardboardBox(1.1, 0.9, 1.1, 'THIS SIDE UP');
                box.position.set(x, y, z);
                group.add(box);
            });
        });
        return group;
    },

    drum_tray: (ml) => {
        const group = new THREE.Group();
        const yellow = mat(0xffcc00, { roughness: 0.7 });
        const tray = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 2.4), yellow);
        tray.position.y = 0.07;
        tray.receiveShadow = true;
        group.add(tray);
        [[0, 1.2, 3.4, 0.1], [0, -1.2, 3.4, 0.1], [1.7, 0, 0.1, 2.4], [-1.7, 0, 0.1, 2.4]].forEach(([x, z, w, d]) => {
            const rim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), yellow);
            rim.position.set(x, 0.15, z);
            group.add(rim);
        });
        const drumA = ml.createChemicalDrum(0x1d528f);
        drumA.position.set(-0.8, 0.14, 0);
        const drumB = ml.createChemicalDrum(0x2e7d32);
        drumB.position.set(0.8, 0.14, 0);
        group.add(drumA, drumB);
        return group;
    },

    worker_upright: (ml) => {
        const group = new THREE.Group();
        const worker = ml.createWorker(false); // false = correct posture
        worker.rotation.y = -Math.PI / 4;
        group.add(worker);
        const crate = ml.createCardboardBox(0.9, 0.7, 0.9, '50 LB');
        crate.position.set(1.1, 0.35, 0.4);
        group.add(crate);
        return group;
    },

    extinguisher_wall: () => {
        const group = new THREE.Group();
        const board = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.5), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        board.position.set(0, 2.2, 0);
        group.add(board);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 16), mat(0xe74c3c, { roughness: 0.3 }));
        body.position.set(0, 1.9, 0.25);
        body.castShadow = true;
        group.add(body);
        const metal = mat(0x333333, { metalness: 0.7, roughness: 0.4 });
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.15), metal);
        bracket.position.set(0, 2.15, 0.18);
        group.add(bracket);
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.15, 12), metal);
        head.position.set(0, 2.38, 0.25);
        group.add(head);
        return group;
    }
};

export class ObjectManager {
    constructor(scene, modelLoader) {
        this.scene = scene;
        this.modelLoader = modelLoader;
        // objectId -> { group, data: {id, position}, model, state: null | 'hazard' | 'safe', card }
        this.map = new Map();
    }

    // layout: [{ id, model, x, y, z, rotY }] exactly as the server sent it.
    build(layout) {
        layout.forEach((o) => {
            const builder = BUILDERS[o.model];
            if (!builder) { console.error(`No builder for model "${o.model}"`); return; }
            const group = builder(this.modelLoader);
            group.position.set(o.x, o.y, o.z);
            group.rotation.y = o.rotY || 0;
            group.name = `OBJ_${o.id}`;
            const position = { x: o.x, y: o.y, z: o.z };
            group.userData = { inspectable: true, objectId: o.id, data: { id: o.id, position } };
            group.traverse((child) => { if (child.isMesh) child.userData = group.userData; });
            this.scene.add(group);
            this.map.set(o.id, { group, data: group.userData.data, model: o.model, state: null, card: null });
        });
    }

    // Called once the server has revealed what an object is (after a click, or when restoring a reload).
    markInspected(id, kind, card) {
        const rec = this.map.get(id);
        if (!rec) return null;
        rec.state = kind;
        rec.card = card;
        return rec;
    }

    hazardsFound() {
        return Array.from(this.map.values()).filter((r) => r.state === 'hazard');
    }

    // Small ambient animations, looked up by model so they follow the object wherever it was placed.
    animate(elapsedTime) {
        this.map.forEach((rec) => {
            if (rec.model === 'puddle') {
                const puddle = rec.group.getObjectByName('water_puddle_mesh');
                if (puddle) puddle.material.opacity = 0.75 + Math.sin(elapsedTime * 3) * 0.1;
            } else if (rec.model === 'worker_bent') {
                this.animateBadLifting(rec.group, elapsedTime);
            }
        });
    }

    // Loops the bent-over worker through a straining lift cycle.
    animateBadLifting(group, elapsedTime) {
        const torso = group.getObjectByName('worker_torso');
        const box = group.getObjectByName('worker_box');
        const armLeft = group.getObjectByName('worker_arm_left');
        const armRight = group.getObjectByName('worker_arm_right');
        const heave = Math.sin(elapsedTime * 1.6);
        const tremor = Math.sin(elapsedTime * 11) * 0.012;
        if (torso) {
            torso.rotation.x = Math.PI / 3.2 - Math.max(0, heave) * 0.12 + tremor;
            torso.position.y = 1.2 + Math.max(0, heave) * 0.06;
        }
        if (box) {
            box.rotation.z = Math.sin(elapsedTime * 3.2) * 0.05 + tremor * 2;
            box.position.y = 0.45 + Math.max(0, heave) * 0.03;
        }
        [armLeft, armRight].forEach((arm) => {
            if (arm && arm.userData.baseRotationX !== undefined) arm.rotation.x = arm.userData.baseRotationX + tremor * 3;
        });
    }
}
