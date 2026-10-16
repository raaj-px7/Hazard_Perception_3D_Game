// The pool of objects and the fixed floor slots. The SERVER owns this file: the browser only ever
// receives {id, model, position}, never the kind, title or tip (those come back when an object is inspected).
//
// To add content: add an entry to HAZARD_POOL / SAFE_POOL and a matching builder in
// client/game-assets/js/objects.js (BUILDERS). Run `npm run check:ids` and `npm run test:layout`.
// Never rename or remove an id that has been played: saved layouts and analytics refer to it.

const SPAWN = { x: 0, z: 21 };

// group = the coverage category used by the generator (display `category` is free text).
// model = the key of the client-side builder. needs = the slot tag the object must sit on.
// r = footprint radius used for spacing and fit checks; solid = the player cannot walk through it.
const HAZARD_POOL = [
  { id: 'water_spill', model: 'puddle', group: 'slips', difficulty: 'easy', needs: 'floor', r: 1.8, solid: false,
    title: 'Slippery Water Spill', category: 'Slips, Trips & Falls', severity: 'High',
    description: 'A large puddle of liquid lies on a walking path with no caution sign or barrier posted.',
    tip: 'OSHA 1910.22(a)(2): Keep workroom floors clean and dry. Always wipe spills immediately and deploy caution cones.' },
  { id: 'unstable_boxes', model: 'leaning_boxes', group: 'storage', difficulty: 'easy', needs: 'floor', r: 1.4, solid: true,
    title: 'Unstable Stacked Boxes', category: 'Struck-by Hazard', severity: 'Critical',
    description: 'Cardboard boxes are stacked too high and leaning dangerously over the pedestrian walkway.',
    tip: 'OSHA 1910.176(b): Material stored in tiers must be stacked, racked, blocked, or interlocked to prevent sliding or collapse.' },
  { id: 'blocked_exit', model: 'exit_pile', group: 'fire_exit', difficulty: 'easy', needs: 'near-exit', r: 1.8, solid: true,
    title: 'Blocked Emergency Exit', category: 'Fire & Life Safety', severity: 'Critical',
    description: 'Pallets and heavy wooden crates are stacked directly in front of the primary Emergency Exit door.',
    tip: 'OSHA 1910.37(a)(3): Exit routes must be kept free and unobstructed by any material or equipment at all times.' },
  { id: 'unsafe_forklift', model: 'forklift_raised', group: 'vehicles', difficulty: 'medium', needs: 'floor', r: 3.0, solid: true,
    title: 'Unattended Unsafe Forklift', category: 'Equipment Safety', severity: 'High',
    description: 'Forklift is left unattended with forks fully elevated and loaded pallet overhead without wheel chocks.',
    tip: 'OSHA 1910.178(m)(5)(i): When a powered industrial truck is unattended, load engaging means must be fully lowered.' },
  { id: 'bad_lifting', model: 'worker_bent', group: 'ergonomics', difficulty: 'medium', needs: 'floor', r: 1.4, solid: true,
    title: 'Incorrect Lifting Technique', category: 'Ergonomics', severity: 'Medium',
    description: 'A warehouse worker is bending forward at the waist with a rounded spine while lifting a 50lb crate.',
    tip: 'Ergonomic Best Practice: Lift with your legs, keep your back straight, load close to your body, and avoid twisting.' },
  { id: 'loose_cable', model: 'cable_run', group: 'electrical', difficulty: 'easy', needs: 'floor', r: 4.3, solid: false,
    title: 'Exposed Trailing Electrical Cable', category: 'Electrical & Trip Hazard', severity: 'High',
    description: 'A heavy power extension cable stretches across a walkway with no cord ramp or cover.',
    tip: 'OSHA 1910.303(b)(2): Protect electrical conductors from physical damage and eliminate trip hazards in walkways.' },
  { id: 'damaged_pallet', model: 'pallet_drums_tilted', group: 'storage', difficulty: 'hard', needs: 'floor', r: 1.8, solid: true,
    title: 'Broken / Cracked Wooden Pallet', category: 'Structural / Material Storage', severity: 'Medium',
    description: 'Splintered, fractured wooden pallet holding heavy chemical drums, threatening to collapse under load.',
    tip: 'Remove damaged pallets immediately from service. Inspect pallets for missing stringers, cracked deck boards, or loose nails.' },
  { id: 'blocking_walkway', model: 'crate_big', group: 'slips', difficulty: 'medium', needs: 'floor', r: 1.6, solid: true,
    title: 'Box Protruding into Walkway', category: 'Housekeeping', severity: 'Medium',
    description: 'A large wooden crate sticks out into a pedestrian walkway and narrows it.',
    tip: 'OSHA 1910.22(a): Permanent aisles and passageways must be kept clear of obstructions and appropriately marked.' },
  { id: 'unsafe_ladder', model: 'ladder_oil', group: 'slips', difficulty: 'medium', needs: 'floor', r: 1.5, solid: true,
    title: 'Unsecured Stepladder on Grease', category: 'Fall Hazard', severity: 'Critical',
    description: 'An aluminum stepladder is set up near greasy oil stains without rubber feet secured or spreader bars locked.',
    tip: 'OSHA 1910.23(c)(4): Ladders must be placed on stable and level surfaces and inspected for grease or slippery oil.' },
  { id: 'falling_hazard', model: 'toolbox_edge', group: 'storage', difficulty: 'hard', needs: 'rack-top', r: 0.8, solid: false,
    title: 'Dangling Overhead Shelf Item', category: 'Falling Objects', severity: 'Critical',
    description: 'A heavy metal toolbox is hanging half-off the top rack beam high above the aisle without retaining netting.',
    tip: 'OSHA 1910.28(c): Secure high elevated equipment and use toe-boards or netting to prevent items from falling on workers.' },
];

const SAFE_POOL = [
  { id: 'safe_forklift', model: 'forklift_parked', needs: 'floor', r: 2.6, solid: true,
    title: 'Parked Forklift (Forks Lowered)',
    description: 'This forklift is parked properly: forks fully lowered, no load overhead, and wheel chocks in place.',
    tip: 'OSHA 1910.178(m)(5): When unattended, lower the forks to the floor, neutralise the controls and set the brakes.' },
  { id: 'safe_stack', model: 'pallet_neat', needs: 'floor', r: 1.9, solid: true,
    title: 'Neatly Stacked Pallet Load',
    description: 'Boxes are stacked evenly on an intact pallet, squarely aligned and well within a safe height.',
    tip: 'OSHA 1910.176(b): Stored material must be stacked so it is stable and secure against sliding or collapse.' },
  { id: 'safe_drums', model: 'drum_tray', needs: 'floor', r: 2.1, solid: true,
    title: 'Labelled Drums in Containment Bay',
    description: 'Chemical drums stand upright, closed and labelled, inside a marked containment tray that catches leaks.',
    tip: 'OSHA 1910.1200: Keep hazardous chemicals labelled and closed, and store them with spill containment.' },
  { id: 'safe_lifting', model: 'worker_upright', needs: 'floor', r: 1.7, solid: true,
    title: 'Correct Manual Lifting',
    description: 'This worker follows safe manual-handling practice: straight back, bent knees and the load held close.',
    tip: 'Ergonomic best practice: Lift with your legs, keep the load close to your body and avoid twisting.' },
  { id: 'safe_extinguisher', model: 'extinguisher_wall', needs: 'wall', r: 0.6, solid: false,
    title: 'Mounted Fire Extinguisher Station',
    description: 'The extinguisher is wall-mounted at a reachable height, clearly signed and not blocked by stock.',
    tip: 'OSHA 1910.157(c): Portable extinguishers must be mounted and located so employees can reach them readily.' },
];

// Fixed positions. y is the base height (builders add their own small offsets). rotY turns wall objects to face inward.
// Tags: floor | aisle | near-rack | near-exit | wall | rack-top.  Slots marked (orig) are the old fixed positions.
const S = (id, x, z, tags, extra = {}) => ({ id, x, y: 0, z, rotY: 0, tags: ['floor', ...tags], ...extra });
const SLOTS = [
  // cross aisle between the rack rows
  S('x1', -7, -10, ['near-rack']), // (orig forklift)
  S('x2', 8, -8, ['near-rack']), // (orig boxes)
  S('x3', -12, -2, ['near-rack']), // (orig walkway)
  S('x4', 11, -3.5, ['near-rack']),
  S('x5', -4, -5, []),
  // central fork lane
  S('a1', 0, 12, ['aisle']), // (orig cable)
  S('a2', 0.2, -6, ['aisle']),
  S('a3', 0, 8, ['aisle']),
  // open area at the front of the warehouse
  S('f1', -6, 4.2, ['near-rack']), // (orig spill)
  S('f2', 4, 6, ['near-rack']), // (orig lifting)
  S('f3', 10, 8, []), // (orig pallet)
  S('f4', 14, 4.5, ['near-rack']), // (orig ladder)
  S('f5', -13, 8, []),
  S('f6', -6, 10, []),
  S('f7', 7, 13, []),
  S('f8', -12, 16, []), // (orig safe forklift)
  S('f9', 12, 16, []), // (orig safe stack)
  S('f10', -7, 17, []),
  S('f11', 7, 18, []),
  // back area
  S('b1', -14, -20, []), // (orig drums)
  S('b2', -6, -19, []),
  S('b3', 6, -19, []),
  S('b4', 14, -20, []),
  // special slots
  { id: 'exit', x: 17.5, y: 0, z: -10, rotY: 0, tags: ['near-exit'] }, // (orig blocked exit; the only exit door)
  { id: 'rk1', x: -12.4, y: 5.2, z: -13.3, rotY: 0, tags: ['rack-top'] }, // empty top bay, rack row 1
  { id: 'rk2', x: -12.4, y: 5.2, z: 2.7, rotY: 0, tags: ['rack-top'] }, // empty top bay, rack row 2
  { id: 'w1', x: 6, y: 0, z: -23.9, rotY: 0, tags: ['wall'] }, // (orig extinguisher)
  { id: 'w2', x: -6, y: 0, z: -23.9, rotY: 0, tags: ['wall'] },
  { id: 'w3', x: -17.9, y: 0, z: 10, rotY: Math.PI / 2, tags: ['wall'] },
  { id: 'w4', x: 17.9, y: 0, z: 10, rotY: -Math.PI / 2, tags: ['wall'] },
];

// Static geometry, mirroring client/game-assets/js/warehouseBuilder.js. Used for fit and reachability checks.
const WAREHOUSE = { hw: 18, hl: 24 };
const RACKS = [-16, 2].flatMap((x0) => [-14, 2].map((z0) => ({ x0, x1: x0 + 14.4, z0: z0 - 1.2, z1: z0 + 1.2 })));
const COLUMNS = [-17.5, 17.5].flatMap((x) => [-18, -6, 6, 18].map((z) => ({ x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4 })));
const PLAYER_RADIUS = 0.55;
const PROMPT_RANGE = 4.5; // CONFIG.player.promptRange on the client

const distToRect = (x, z, b) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));

// Does an object of footprint r sit clear of the building at this slot?
function fitsStatic(slot, r) {
  if (slot.tags.includes('rack-top')) return true; // sits on a rack bay by design
  const inRoom = Math.abs(slot.x) + r <= WAREHOUSE.hw + 0.01 && Math.abs(slot.z) + r <= WAREHOUSE.hl + 0.01;
  const wallOk = slot.tags.includes('wall') || slot.tags.includes('near-exit') || inRoom;
  if (!wallOk) return false;
  return [...RACKS, ...COLUMNS].every((b) => distToRect(slot.x, slot.z, b) >= r);
}

const CATALOG = { hazards: HAZARD_POOL, safe: SAFE_POOL, slots: SLOTS };

// Slots an object may use: right tag, fits the building, not beside the spawn point.
function eligibleSlots(obj, slots = SLOTS) {
  return slots.filter((s) => s.tags.includes(obj.needs) && fitsStatic(s, obj.r)
    && Math.hypot(s.x - SPAWN.x, s.z - SPAWN.z) >= 6 + obj.r);
}

const byId = (list) => new Map(list.map((o) => [o.id, o]));
const HAZARD_BY_ID = byId(HAZARD_POOL);
const SAFE_BY_ID = byId(SAFE_POOL);
const SLOT_BY_ID = byId(SLOTS);

// The original fixed set: old attempts (saved with no layout) are treated as this.
const LEGACY_HAZARD_IDS = ['water_spill', 'unstable_boxes', 'blocked_exit', 'unsafe_forklift', 'bad_lifting', 'loose_cable', 'damaged_pallet', 'blocking_walkway', 'unsafe_ladder', 'falling_hazard'];
const LEGACY_SAFE_IDS = ['safe_forklift', 'safe_stack', 'safe_drums', 'safe_lifting', 'safe_extinguisher'];

module.exports = {
  SPAWN, HAZARD_POOL, SAFE_POOL, SLOTS, CATALOG, WAREHOUSE, RACKS, COLUMNS, PLAYER_RADIUS, PROMPT_RANGE,
  HAZARD_BY_ID, SAFE_BY_ID, SLOT_BY_ID, LEGACY_HAZARD_IDS, LEGACY_SAFE_IDS, eligibleSlots, fitsStatic, distToRect,
};
