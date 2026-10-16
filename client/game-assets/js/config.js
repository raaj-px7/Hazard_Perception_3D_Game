// js/config.js - Game Configuration (hazard and safe-object content now lives on the server)

export const CONFIG = {
    totalHazards: 10,
    targetScore: 10,
    gameTimeLimit: 120, // 2 minutes (countdown)
    camera: {
        initialPos: { x: 0, y: 12, z: 22 },
        targetPos: { x: 0, y: 3, z: 0 },
        fov: 60,
        near: 0.1,
        far: 1000,
        minDistance: 4,
        maxDistance: 45,
        maxPolarAngle: Math.PI / 2 - 0.02 // Don't clip below floor
    },
    warehouse: {
        width: 36,
        length: 48,
        height: 14
    }
};

// Percentage scoring (display only: the server calculates the official score).
export const SCORING = {
    hazardPoints: 10,   // each hazard adds 10%
    safePenalty: 5,     // each safe object clicked costs 5% (once per object)
    qualifyPercent: 60
};

// Walking inspector (third-person). Distances are in warehouse units (about 1 metre).
CONFIG.player = {
    spawn: { x: 0, z: 21 },   // just inside the entrance, facing into the warehouse
    radius: 0.55,
    walkSpeed: 6.5,
    runSpeed: 10.5,           // hold Shift
    cameraDistance: 5.5,
    minDistance: 3,
    maxDistance: 9,
    interactRange: 9,         // a click only counts when the player is this close
    promptRange: 4.5          // the "press E" prompt appears this close to a hotspot
};
