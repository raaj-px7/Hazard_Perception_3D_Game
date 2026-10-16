// js/modelLoader.js - Model Loader & Procedural Asset Generators

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelLoader {
    constructor() {
        this.loader = new GLTFLoader();
        this.cache = new Map();
        this.textureCanvasCache = new Map();
    }

    // Load external GLTF/GLB file with fallback callback
    async loadGLTF(url, fallbackFn) {
        if (this.cache.has(url)) {
            return this.cache.get(url).clone();
        }
        try {
            const gltf = await new Promise((resolve, reject) => {
                this.loader.load(url, resolve, undefined, reject);
            });
            const model = gltf.scene;
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            this.cache.set(url, model);
            return model.clone();
        } catch (err) {
            console.warn(`[ModelLoader] Model ${url} not found or failed to load. Using procedural model fallback.`, err);
            if (fallbackFn) return fallbackFn();
            return new THREE.Group();
        }
    }

    // Canvas-generated procedural textures for realism
    createBoxTexture(label = "FRAGILE") {
        const key = `box_${label}`;
        if (this.textureCanvasCache.has(key)) return this.textureCanvasCache.get(key);

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Cardboard base color
        ctx.fillStyle = '#c68b59';
        ctx.fillRect(0, 0, 512, 512);

        // Texture grain / noise
        ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
        for (let i = 0; i < 3000; i++) {
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
        }

        // Tape seams
        ctx.fillStyle = '#b07548';
        ctx.fillRect(0, 246, 512, 20);
        ctx.fillStyle = '#9e6238';
        ctx.fillRect(246, 0, 20, 512);

        // Stamp details
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 4;
        ctx.strokeRect(40, 40, 432, 432);

        // Caution text / symbol
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, 256, 120);

        ctx.font = '24px sans-serif';
        ctx.fillText('THIS SIDE UP ↑↑', 256, 180);
        ctx.fillText('HANDLE WITH CARE', 256, 380);

        // Barcode
        ctx.fillStyle = '#000000';
        let bx = 160;
        for (let i = 0; i < 20; i++) {
            const w = Math.random() > 0.5 ? 8 : 4;
            ctx.fillRect(bx, 410, w, 40);
            bx += w + 4;
        }

        const texture = new THREE.CanvasTexture(canvas);
        this.textureCanvasCache.set(key, texture);
        return texture;
    }

    createCautionTapeTexture() {
        const key = 'caution_tape';
        if (this.textureCanvasCache.has(key)) return this.textureCanvasCache.get(key);

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(0, 0, 256, 64);

        ctx.fillStyle = '#111111';
        for (let i = -64; i < 256; i += 32) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + 16, 0);
            ctx.lineTo(i - 16, 64);
            ctx.lineTo(i - 32, 64);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(10, 1);
        this.textureCanvasCache.set(key, texture);
        return texture;
    }

    // --- PROCEDURAL 3D ASSETS ---

    createPallet(width = 2.4, length = 2.4, height = 0.3) {
        const group = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: 0xa87c4f, roughness: 0.85, metalness: 0.1 });

        // Bottom boards (3 boards)
        for (let z of [-1, 0, 1]) {
            const board = new THREE.Mesh(
                new THREE.BoxGeometry(width, 0.04, 0.3),
                woodMat
            );
            board.position.set(0, 0.02, z * (length / 2.4 - 0.2));
            board.castShadow = true;
            board.receiveShadow = true;
            group.add(board);
        }

        // Bearer blocks / Stringers (3 stringers)
        for (let x of [-1.1, 0, 1.1]) {
            const stringer = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, height - 0.08, length),
                woodMat
            );
            stringer.position.set(x, height / 2, 0);
            stringer.castShadow = true;
            stringer.receiveShadow = true;
            group.add(stringer);
        }

        // Top deck boards (7 boards)
        const numBoards = 7;
        const step = (length - 0.2) / (numBoards - 1);
        for (let i = 0; i < numBoards; i++) {
            const z = -length / 2 + 0.1 + i * step;
            const topBoard = new THREE.Mesh(
                new THREE.BoxGeometry(width, 0.04, 0.26),
                woodMat
            );
            topBoard.position.set(0, height - 0.02, z);
            topBoard.castShadow = true;
            topBoard.receiveShadow = true;
            group.add(topBoard);
        }

        return group;
    }

    createCardboardBox(width = 1.2, height = 1.0, depth = 1.2, label = "HANDLE WITH CARE") {
        const tex = this.createBoxTexture(label);
        const mat = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.7,
            metalness: 0.05
        });
        const geo = new THREE.BoxGeometry(width, height, depth);
        const box = new THREE.Mesh(geo, mat);
        box.castShadow = true;
        box.receiveShadow = true;
        return box;
    }

    createChemicalDrum(color = 0x1d528f) {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.6 });

        const bodyGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.4, 32);
        const body = new THREE.Mesh(bodyGeo, mat);
        body.position.y = 0.7;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // Rib rings
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
        for (let y of [0.35, 0.7, 1.05]) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.03, 16, 32), ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = y;
            group.add(ring);
        }

        // Hazard symbol decal disk
        const hazardMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const diamond = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), hazardMat);
        diamond.rotation.z = Math.PI / 4;
        diamond.position.set(0, 0.9, 0.51);
        group.add(diamond);

        return group;
    }

    createForklift() {
        const group = new THREE.Group();
        const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf5b041, roughness: 0.3, metalness: 0.7 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.5 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.2, metalness: 0.9 });
        const orangeLightMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });

        // Main chassis
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 3.2), yellowMat);
        body.position.set(0, 0.9, 0);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // Counterweight (back)
        const counterweight = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.0, 0.8), darkMat);
        counterweight.position.set(0, 0.9, 1.8);
        counterweight.castShadow = true;
        group.add(counterweight);

        // Cabin cage
        const cageGeo = new THREE.BoxGeometry(2.0, 1.8, 1.8);
        const cageEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(cageGeo),
            new THREE.LineBasicMaterial({ color: 0x111111, linewidth: 3 })
        );
        cageEdges.position.set(0, 2.3, 0.2);
        group.add(cageEdges);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 1.8), darkMat);
        roof.position.set(0, 3.2, 0.2);
        group.add(roof);

        // Beacon light
        const lightMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 16), orangeLightMat);
        lightMesh.position.set(0, 3.35, 0.9);
        group.add(lightMesh);

        // Seat
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), darkMat);
        seat.position.set(0, 1.7, 0.2);
        group.add(seat);

        // Wheels (4 wheels)
        const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 24);
        wheelGeo.rotateZ(Math.PI / 2);
        const wheelPositions = [
            [-1.1, 0.45, 1.1],
            [1.1, 0.45, 1.1],
            [-1.1, 0.45, -1.1],
            [1.1, 0.45, -1.1]
        ];
        wheelPositions.forEach(([x, y, z]) => {
            const wheel = new THREE.Mesh(wheelGeo, darkMat);
            wheel.position.set(x, y, z);
            wheel.castShadow = true;
            group.add(wheel);
        });

        // Mast Assembly
        const mast = new THREE.Group();
        mast.name = "forklift_mast";
        const mastBeam1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.5, 0.15), darkMat);
        mastBeam1.position.set(-0.7, 1.75, -1.65);
        const mastBeam2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.5, 0.15), darkMat);
        mastBeam2.position.set(0.7, 1.75, -1.65);
        mast.add(mastBeam1);
        mast.add(mastBeam2);

        // Carriage & Forks
        const carriage = new THREE.Group();
        carriage.name = "forklift_carriage";
        
        const backplate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.1), darkMat);
        backplate.position.set(0, 0.5, -1.75);
        carriage.add(backplate);

        // Forks (2 prongs)
        const fork1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 1.8), metalMat);
        fork1.position.set(-0.4, 0.04, -2.6);
        fork1.castShadow = true;
        const fork2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 1.8), metalMat);
        fork2.position.set(0.4, 0.04, -2.6);
        fork2.castShadow = true;
        carriage.add(fork1);
        carriage.add(fork2);

        mast.add(carriage);
        group.add(mast);

        return group;
    }

    createWorker(isImproperPosture = false) {
        const group = new THREE.Group();
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0a98b, roughness: 0.6 });
        const vestMat = new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.5 }); // High-vis vest
        const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2b3e50, roughness: 0.7 });
        const helmetMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.3, metalness: 0.2 });
        const bootMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
        const gloveMat = new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: 0.6 });
        const strapMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.6 });
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });

        // Feet & Boots
        const bootLeft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.5), bootMat);
        bootLeft.position.set(-0.35, 0.125, 0.1);
        bootLeft.castShadow = true;
        const bootRight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.5), bootMat);
        bootRight.position.set(0.35, 0.125, 0.1);
        bootRight.castShadow = true;
        group.add(bootLeft, bootRight);

        // Boot lace detail
        const laceMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
        [-0.35, 0.35].forEach((x) => {
            const lace = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.02), laceMat);
            lace.position.set(x, 0.24, -0.05);
            group.add(lace);
        });

        // Legs
        const legLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.2), pantsMat);
        legLeft.position.set(-0.35, 0.8, 0);
        legLeft.castShadow = true;
        const legRight = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.2), pantsMat);
        legRight.position.set(0.35, 0.8, 0);
        legRight.castShadow = true;
        group.add(legLeft, legRight);

        // Belt detail
        const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16), strapMat);
        belt.position.set(0, 1.35, 0);
        group.add(belt);

        // Torso & Upper Body
        const torsoGroup = new THREE.Group();
        torsoGroup.name = 'worker_torso'; // Referenced by the lift-strain animation loop
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.5), vestMat);
        torso.position.set(0, 0.65, 0);
        torso.castShadow = true;
        torsoGroup.add(torso);

        // Reflective stripes on the vest, front and back
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const stripeFront = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.1), stripeMat);
        stripeFront.position.set(0, 0.8, 0.26);
        torsoGroup.add(stripeFront);
        const stripeBack = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.1), stripeMat);
        stripeBack.position.set(0, 0.8, -0.26);
        stripeBack.rotation.y = Math.PI;
        torsoGroup.add(stripeBack);
        const stripeDiagLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.6), stripeMat);
        stripeDiagLeft.position.set(-0.3, 0.42, 0.26);
        stripeDiagLeft.rotation.z = 0.4;
        torsoGroup.add(stripeDiagLeft);
        const stripeDiagRight = stripeDiagLeft.clone();
        stripeDiagRight.position.x = 0.3;
        stripeDiagRight.rotation.z = -0.4;
        torsoGroup.add(stripeDiagRight);

        // Head & simple strained face (eyes + a clenched mouth line)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), skinMat);
        head.position.set(0, 1.5, 0);
        head.castShadow = true;
        torsoGroup.add(head);

        const eyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeMat);
        eyeLeft.position.set(-0.08, 1.52, 0.22);
        const eyeRight = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeMat);
        eyeRight.position.set(0.08, 1.52, 0.22);
        torsoGroup.add(eyeLeft, eyeRight);

        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), eyeMat);
        mouth.position.set(0, 1.42, 0.235);
        torsoGroup.add(mouth);

        // Hard Hat
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), helmetMat);
        helmet.position.set(0, 1.54, 0);
        helmet.castShadow = true;
        torsoGroup.add(helmet);

        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 16), helmetMat);
        brim.position.set(0, 1.52, 0.05);
        torsoGroup.add(brim);

        // Chin strap detail
        const strapLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), strapMat);
        strapLeft.position.set(-0.2, 1.38, 0.12);
        strapLeft.rotation.set(0.3, 0, 0.5);
        const strapRight = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), strapMat);
        strapRight.position.set(0.2, 1.38, 0.12);
        strapRight.rotation.set(0.3, 0, -0.5);
        torsoGroup.add(strapLeft, strapRight);

        // Two-segment arms (upper arm + forearm + gloved hand) reaching for the box
        const armLeft = this.createWorkerArm(vestMat, skinMat, gloveMat, -1);
        const armRight = this.createWorkerArm(vestMat, skinMat, gloveMat, 1);
        armLeft.name = 'worker_arm_left';   // Referenced by the lift-strain animation loop
        armRight.name = 'worker_arm_right'; // Referenced by the lift-strain animation loop
        torsoGroup.add(armLeft, armRight);

        // Heavy crate held by worker
        const liftedBox = this.createCardboardBox(0.9, 0.7, 0.8, "HEAVY 50LBS");
        liftedBox.name = 'worker_box'; // Referenced by the lift-strain animation loop
        liftedBox.position.set(0, 0.45, 0.75);
        torsoGroup.add(liftedBox);

        torsoGroup.position.set(0, 1.4, 0);

        if (isImproperPosture) {
            // Dangerous bending at waist forward (spine bent 55 degrees, legs straight)
            torsoGroup.rotation.x = Math.PI / 3.2;
            torsoGroup.position.set(0, 1.2, -0.3);
        }

        group.add(torsoGroup);
        return group;
    }

    // Two-segment arm (upper arm + forearm) ending in a gloved hand, angled down
    // toward a held box. `side` is -1 for the left arm, +1 for the right arm.
    // Builds one arm as a real kinematic chain: shoulder -> upper arm -> elbow
    // -> forearm -> hand, where each joint is parented to the END of the
    // previous segment. This guarantees the pieces always stay visually
    // connected, no matter what rotation is applied at any joint (unlike
    // independently-positioned sibling meshes, which can drift apart).
    // `side` is -1 for the left arm, +1 for the right arm.
    createWorkerArm(vestMat, skinMat, gloveMat, side) {
        const upperLen = 0.45;
        const foreLen = 0.42;

        // Shoulder pivot: anchors the whole arm on the torso. This is also
        // the joint the lift-strain animation rotates for the tremor effect.
        const shoulderGroup = new THREE.Group();
        shoulderGroup.position.set(side * 0.48, 1.15, 0.1);
        // Static "reach" pose: swings the whole arm down and forward from the
        // shoulder. Read by hazards.js so the tremor animation can ADD to
        // this instead of overwriting it.
        shoulderGroup.rotation.set(1.9, 0, side * 0.1);
        shoulderGroup.userData.baseRotationX = 1.9;

        const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.095, upperLen), vestMat);
        // Offset so the TOP of the cylinder sits at the shoulder pivot
        // (local origin) and it hangs down the local +Y axis before
        // shoulderGroup's rotation carries it down and forward.
        upperArm.position.set(0, upperLen / 2, 0);
        upperArm.castShadow = true;
        shoulderGroup.add(upperArm);

        // Elbow pivot: parented to the shoulder, placed at the far end of
        // the upper arm. Being a child here means it automatically inherits
        // the shoulder's rotation, so it always sits at the true end of the
        // upper arm - never independently placed.
        const elbowGroup = new THREE.Group();
        elbowGroup.position.set(0, upperLen, 0);
        elbowGroup.rotation.x = 0.45; // additional forward bend, reaching toward the box
        shoulderGroup.add(elbowGroup);

        const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, foreLen), skinMat);
        forearm.position.set(0, foreLen / 2, 0);
        forearm.castShadow = true;
        elbowGroup.add(forearm);

        // Hand: parented to the far end of the forearm, so it is always
        // exactly where the forearm ends - never a disconnected floating part.
        const handGroup = new THREE.Group();
        handGroup.position.set(0, foreLen, 0);
        elbowGroup.add(handGroup);

        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), gloveMat);
        handGroup.add(hand);

        return shoulderGroup;
    }

    createStepladder() {
        const group = new THREE.Group();
        const metalMat = new THREE.MeshStandardMaterial({ color: 0xd0d5dd, roughness: 0.3, metalness: 0.8 });

        // 4 Legs
        const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2), metalMat);
        leg1.position.set(-0.6, 1.5, -0.5);
        leg1.rotation.z = -0.15;
        leg1.rotation.x = -0.12;

        const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2), metalMat);
        leg2.position.set(0.6, 1.5, -0.5);
        leg2.rotation.z = 0.15;
        leg2.rotation.x = -0.12;

        const leg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2), metalMat);
        leg3.position.set(-0.6, 1.5, 0.5);
        leg3.rotation.z = -0.15;
        leg3.rotation.x = 0.12;

        const leg4 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2), metalMat);
        leg4.position.set(0.6, 1.5, 0.5);
        leg4.rotation.z = 0.15;
        leg4.rotation.x = 0.12;

        group.add(leg1, leg2, leg3, leg4);

        // Steps
        for (let y = 0.6; y <= 2.6; y += 0.5) {
            const step = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.15), metalMat);
            step.position.set(0, y, -0.2);
            group.add(step);
        }

        // Top platform
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.5), metalMat);
        top.position.set(0, 3.0, 0);
        group.add(top);

        return group;
    }
}
