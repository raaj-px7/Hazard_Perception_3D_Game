// js/warehouseBuilder.js - 3D Warehouse Environment Construction

import * as THREE from 'three';
import { CONFIG } from './config.js';

export function buildWarehouse(scene, modelLoader) {
    const warehouseGroup = new THREE.Group();
    warehouseGroup.name = "warehouse_environment";

    const { width, length, height } = CONFIG.warehouse;

    // --- 1. FLOOR & WALKWAY MARKINGS ---
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 1024;
    floorCanvas.height = 1024;
    const fctx = floorCanvas.getContext('2d');

    // Concrete base
    fctx.fillStyle = '#2c3038';
    fctx.fillRect(0, 0, 1024, 1024);

    // Floor expansion joints grid
    fctx.strokeStyle = '#1e2127';
    fctx.lineWidth = 3;
    for (let i = 0; i <= 1024; i += 128) {
        fctx.beginPath(); fctx.moveTo(i, 0); fctx.lineTo(i, 1024); fctx.stroke();
        fctx.beginPath(); fctx.moveTo(0, i); fctx.lineTo(1024, i); fctx.stroke();
    }

    // Yellow Pedestrian Safety Lanes
    fctx.strokeStyle = '#ffcc00';
    fctx.lineWidth = 14;

    // Outer safety boundary loop
    fctx.strokeRect(64, 64, 896, 896);

    // Main central forklift lane
    fctx.beginPath();
    fctx.moveTo(512, 64);
    fctx.lineTo(512, 960);
    fctx.stroke();

    // Caution hatching at emergency exit area (Right side)
    fctx.fillStyle = '#ffcc00';
    for (let x = 850; x < 960; x += 30) {
        fctx.beginPath();
        fctx.moveTo(x, 260);
        fctx.lineTo(x + 15, 260);
        fctx.lineTo(x - 15, 380);
        fctx.lineTo(x - 30, 380);
        fctx.fill();
    }

    // Aisle Numbers
    fctx.fillStyle = '#ffffff';
    fctx.font = 'bold 36px sans-serif';
    fctx.fillText("AISLE 01", 200, 120);
    fctx.fillText("AISLE 02", 700, 120);
    fctx.fillText("FORK LANE", 430, 500);

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;

    const floorMat = new THREE.MeshStandardMaterial({
        map: floorTexture,
        roughness: 0.4,
        metalness: 0.2
    });

    const floorGeo = new THREE.PlaneGeometry(width, length);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    warehouseGroup.add(floor);

    // --- 2. WALLS & CEILING ROOF TRUSSES ---
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x48505c, roughness: 0.7, metalness: 0.3 });
    const darkWallMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.8 });

    // Back Wall
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    backWall.position.set(0, height / 2, -length / 2);
    backWall.receiveShadow = true;
    warehouseGroup.add(backWall);

    // Front Wall (with opening window/view)
    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    frontWall.position.set(0, height / 2, length / 2);
    frontWall.rotation.y = Math.PI;
    frontWall.receiveShadow = true;
    warehouseGroup.add(frontWall);

    // Left Wall
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(length, height), wallMat);
    leftWall.position.set(-width / 2, height / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    warehouseGroup.add(leftWall);

    // Right Wall (contains Emergency Exit)
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(length, height), wallMat);
    rightWall.position.set(width / 2, height / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    warehouseGroup.add(rightWall);

    // Structural Columns
    const colMat = new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 0.5, metalness: 0.7 });
    for (let x of [-width / 2 + 0.5, width / 2 - 0.5]) {
        for (let z = -length / 2 + 6; z <= length / 2 - 6; z += 12) {
            const col = new THREE.Mesh(new THREE.BoxGeometry(0.8, height, 0.8), colMat);
            col.position.set(x, height / 2, z);
            col.castShadow = true;
            col.receiveShadow = true;
            warehouseGroup.add(col);
        }
    }

    // Steel Roof Trusses across ceiling
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x333a45, roughness: 0.5, metalness: 0.8 });
    for (let z = -length / 2 + 4; z < length / 2; z += 8) {
        const trussBeam = new THREE.Mesh(new THREE.BoxGeometry(width, 0.4, 0.4), trussMat);
        trussBeam.position.set(0, height - 0.5, z);
        warehouseGroup.add(trussBeam);
    }

    // --- 3. HIGH-BAY INDUSTRIAL LIGHTING ---
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lightHousingMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

    const lightPositions = [
        [-8, height - 1.2, -12],
        [8, height - 1.2, -12],
        [-8, height - 1.2, 0],
        [8, height - 1.2, 0],
        [-8, height - 1.2, 12],
        [8, height - 1.2, 12]
    ];

    lightPositions.forEach(([x, y, z]) => {
        // High-bay dome mesh
        const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 0.5, 16), lightHousingMat);
        dome.position.set(x, y, z);
        warehouseGroup.add(dome);

        const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 16), lightMat);
        bulb.position.set(x, y - 0.25, z);
        warehouseGroup.add(bulb);

        // Actual Three.js Spotlight
        const spotLight = new THREE.SpotLight(0xfff5ea, 120);
        spotLight.position.set(x, y - 0.3, z);
        spotLight.angle = Math.PI / 3;
        spotLight.penumbra = 0.6;
        spotLight.decay = 1.5;
        spotLight.distance = 28;
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = 1024;
        spotLight.shadow.mapSize.height = 1024;
        warehouseGroup.add(spotLight);
    });

    // --- 4. RACKING SYSTEMS (4 RACK ROWS) ---
    function buildRackRow(startX, startZ, length, numTiers = 3) {
        const rackGroup = new THREE.Group();
        const blueFrameMat = new THREE.MeshStandardMaterial({ color: 0x1a5276, roughness: 0.4, metalness: 0.6 });
        const orangeBeamMat = new THREE.MeshStandardMaterial({ color: 0xeb5757, roughness: 0.4, metalness: 0.5 });
        const meshGridMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.8, wireframe: true });

        const rackDepth = 2.4;
        const sectionWidth = 3.6;
        const numSections = 4;
        const totalLen = numSections * sectionWidth;

        // Vertical Upright Frames
        for (let i = 0; i <= numSections; i++) {
            const rx = startX + i * sectionWidth;
            for (let dz of [-rackDepth / 2, rackDepth / 2]) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 7.5, 0.12), blueFrameMat);
                post.position.set(rx, 3.75, startZ + dz);
                post.castShadow = true;
                post.receiveShadow = true;
                rackGroup.add(post);
            }
            // Cross diagonal bracing between uprights
            const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, rackDepth), blueFrameMat);
            brace.position.set(rx, 3.75, startZ);
            rackGroup.add(brace);
        }

        // Horizontal Shelving Beams & Wire Decks
        const tierHeights = [0.4, 2.6, 4.8];
        tierHeights.forEach((y) => {
            // Front & Back Beams
            for (let dz of [-rackDepth / 2, rackDepth / 2]) {
                const beam = new THREE.Mesh(new THREE.BoxGeometry(totalLen, 0.16, 0.08), orangeBeamMat);
                beam.position.set(startX + totalLen / 2, y, startZ + dz);
                beam.castShadow = true;
                rackGroup.add(beam);
            }
            // Wire mesh shelf surface
            const shelfMesh = new THREE.Mesh(new THREE.PlaneGeometry(totalLen, rackDepth), meshGridMat);
            shelfMesh.position.set(startX + totalLen / 2, y + 0.08, startZ);
            shelfMesh.rotation.x = Math.PI / 2;
            rackGroup.add(shelfMesh);
        });

        return { rackGroup, totalLen, rackDepth, tierHeights };
    }

    // Place 4 Rack Rows (Left aisle and Right aisle)
    const rack1 = buildRackRow(-16, -14, 14);
    warehouseGroup.add(rack1.rackGroup);

    const rack2 = buildRackRow(-16, 2, 14);
    warehouseGroup.add(rack2.rackGroup);

    const rack3 = buildRackRow(2, -14, 14);
    warehouseGroup.add(rack3.rackGroup);

    const rack4 = buildRackRow(2, 2, 14);
    warehouseGroup.add(rack4.rackGroup);


    // --- 5. POPULATE RACKS WITH NORMAL SAFE OBJECTS ---
    // Helper to add stacked pallets & boxes on rack shelves
    function populateRack(startX, startZ, tierHeights) {
        for (let i = 0; i < 4; i++) {
            const bx = startX + 0.8 + i * 3.4;
            tierHeights.forEach((y, tierIdx) => {
                // Skip hazard specific spots
                if (startX < 0 && i === 1 && tierIdx === 2) return; // Overhead falling hazard spot
                if (startX > 0 && i === 3 && tierIdx === 0) return; // Unstable boxes spot

                const pallet = modelLoader.createPallet(2.2, 2.0);
                pallet.position.set(bx, y + 0.1, startZ);
                warehouseGroup.add(pallet);

                if (tierIdx === 0) {
                    // Drums on bottom shelf
                    const drum1 = modelLoader.createChemicalDrum(0x1d528f);
                    drum1.position.set(bx - 0.5, y + 0.4, startZ - 0.4);
                    const drum2 = modelLoader.createChemicalDrum(0x27ae60);
                    drum2.position.set(bx + 0.5, y + 0.4, startZ + 0.4);
                    warehouseGroup.add(drum1, drum2);
                } else {
                    // Cardboard boxes on upper shelves
                    const box1 = modelLoader.createCardboardBox(1.1, 0.9, 1.1, "PARTS A-102");
                    box1.position.set(bx - 0.5, y + 0.8, startZ - 0.3);
                    const box2 = modelLoader.createCardboardBox(1.0, 0.8, 1.0, "SAFETY GEAR");
                    box2.position.set(bx + 0.4, y + 0.7, startZ + 0.3);
                    warehouseGroup.add(box1, box2);
                }
            });
        }
    }

    populateRack(-16, -14, rack1.tierHeights);
    populateRack(-16, 2, rack2.tierHeights);
    populateRack(2, -14, rack3.tierHeights);
    populateRack(2, 2, rack4.tierHeights);

    // --- 6. EMERGENCY EXIT DOOR & SIGNS ---
    const exitDoorGroup = new THREE.Group();
    exitDoorGroup.name = "emergency_exit_door_structure";

    // Green glowing EXIT sign header
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256; signCanvas.height = 96;
    const sctx = signCanvas.getContext('2d');
    sctx.fillStyle = '#00aa44';
    sctx.fillRect(0, 0, 256, 96);
    sctx.fillStyle = '#ffffff';
    sctx.font = 'bold 52px sans-serif';
    sctx.textAlign = 'center';
    sctx.fillText("EXIT 🏃", 128, 66);

    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const exitSignMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.8), signMat);
    exitSignMesh.position.set(17.85, 4.2, -10);
    exitSignMesh.rotation.y = -Math.PI / 2;
    exitDoorGroup.add(exitSignMesh);

    // Red Emergency Door Frame
    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.4 });
    const doorLeafMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, roughness: 0.3, metalness: 0.8 });

    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.4, 2.0), doorFrameMat);
    doorFrame.position.set(17.9, 1.7, -10);
    exitDoorGroup.add(doorFrame);

    const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.2, 1.8), doorLeafMat);
    doorLeaf.position.set(17.86, 1.6, -10);
    exitDoorGroup.add(doorLeaf);

    // Push bar panic handle
    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 1.4), doorFrameMat);
    pushBar.position.set(17.78, 1.5, -10);
    exitDoorGroup.add(pushBar);

    warehouseGroup.add(exitDoorGroup);

    // --- 7. SAFETY EQUIPMENT & DECORATIONS ---
    // Fire Extinguisher Station on Left Wall
    const feGroup = new THREE.Group();
    const feMat = new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.3 });
    const feCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 16), feMat);
    feCylinder.position.set(-17.8, 2.0, 4);
    feGroup.add(feCylinder);

    // Backboard sign
    const feBackboard = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.4), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    feBackboard.position.set(-17.85, 2.2, 4);
    feBackboard.rotation.y = Math.PI / 2;
    feGroup.add(feBackboard);
    warehouseGroup.add(feGroup);

    scene.add(warehouseGroup);
    return warehouseGroup;
}
