// Draws one attempt's layout: which 10 hazards and 5 safe objects appear, and where.
// Pure functions (no database), so scripts/testLayout.js can run thousands of draws.
const cat = require('./catalog');

const RULES = {
  hazardCount: 10,
  safeCount: 5,
  difficultyQuota: { easy: 4, medium: 4, hard: 2 }, // keeps a 70% comparable between attempts
  groups: ['slips', 'storage', 'electrical', 'fire_exit', 'vehicles', 'ergonomics'], // each must appear at least once
  minNewHazards: 5, // vs the employee's previous attempt (lowered automatically if the pool is too small)
  minSpacing: 6, // between object centres (also at least r1 + r2 + 0.8)
  spawnClearance: 6, // from the spawn point (plus the object's radius)
  maxTries: 400,
};

const shuffle = (arr, rng) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const sample = (arr, n, rng) => shuffle(arr, rng).slice(0, n);

// ---------- selection ----------
function pickHazards(pool, prevRefs, rng, rules, strict) {
  const prev = new Set(prevRefs);
  const newPossible = pool.filter((h) => !prev.has(h.id)).length;
  const minNew = Math.min(rules.minNewHazards, newPossible, rules.hazardCount);
  for (let t = 0; t < 300; t++) {
    let chosen = [];
    if (strict) {
      for (const [tier, n] of Object.entries(rules.difficultyQuota)) {
        const members = pool.filter((h) => h.difficulty === tier);
        if (members.length < n) return null; // pool cannot meet the quota
        chosen.push(...sample(members, n, rng));
      }
    } else chosen = sample(pool, rules.hazardCount, rng);
    if (chosen.length !== rules.hazardCount) return null;
    const groups = new Set(chosen.map((h) => h.group));
    const poolGroups = new Set(pool.map((h) => h.group));
    if (!rules.groups.every((g) => !poolGroups.has(g) || groups.has(g))) continue;
    if (chosen.filter((h) => !prev.has(h.id)).length < minNew) continue;
    return chosen;
  }
  return null;
}

// ---------- placement ----------
const gap = (a, b) => Math.max(RULES.minSpacing, a.r + b.r + 0.8);

function place(objects, slots, rng, rules) {
  // most constrained first (blocked exit has one slot), random among equals
  const eligible = new Map(objects.map((o) => [o, cat.eligibleSlots(o, slots)]));
  const order = shuffle(objects, rng).sort((a, b) => eligible.get(a).length - eligible.get(b).length);
  const placed = [];
  for (const o of order) {
    const options = shuffle(eligible.get(o), rng).filter((s) =>
      !placed.some((p) => p.slot.id === s.id || Math.hypot(p.slot.x - s.x, p.slot.z - s.z) < gap(p.obj, o)));
    if (!options.length) return null;
    placed.push({ obj: o, slot: options[0] });
  }
  return placed;
}

// Flood fill on a 0.5 grid from the spawn point: every object must have walkable floor within prompt range.
function reachable(placed) {
  const cell = 0.5, R = cat.PLAYER_RADIUS;
  const nx = Math.round((cat.WAREHOUSE.hw * 2) / cell), nz = Math.round((cat.WAREHOUSE.hl * 2) / cell);
  const toX = (i) => -cat.WAREHOUSE.hw + (i + 0.5) * cell, toZ = (j) => -cat.WAREHOUSE.hl + (j + 0.5) * cell;
  const solids = placed.filter((p) => p.obj.solid && p.slot.y < 1).map((p) => ({ x: p.slot.x, z: p.slot.z, r: p.obj.r }));
  const blocked = (x, z) =>
    Math.abs(x) > cat.WAREHOUSE.hw - 1.2 || Math.abs(z) > cat.WAREHOUSE.hl - 1.2 ||
    [...cat.RACKS, ...cat.COLUMNS].some((b) => cat.distToRect(x, z, b) < R) ||
    solids.some((s) => Math.hypot(x - s.x, z - s.z) < s.r + R);
  const seen = new Uint8Array(nx * nz);
  const si = Math.floor((cat.SPAWN.x + cat.WAREHOUSE.hw) / cell), sj = Math.floor((cat.SPAWN.z + cat.WAREHOUSE.hl) / cell);
  const stack = [[si, sj]];
  seen[sj * nx + si] = 1;
  const free = [];
  while (stack.length) {
    const [i, j] = stack.pop();
    const x = toX(i), z = toZ(j);
    if (blocked(x, z) && !(i === si && j === sj)) continue;
    free.push([x, z]);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz || seen[b * nx + a]) continue;
      seen[b * nx + a] = 1;
      stack.push([a, b]);
    }
  }
  const reach = cat.PROMPT_RANGE - 0.5;
  return placed.every((p) => free.some(([x, z]) => Math.hypot(x - p.slot.x, z - p.slot.z) <= reach));
}

// ---------- the draw ----------
// Returns { layout: [{oid, kind, ref, slot}], relaxed: [..rules that could not be met..] }
function generateLayout({ catalog = cat.CATALOG, prevHazardRefs = [], rng = Math.random, rules = RULES } = {}) {
  const relaxed = [];
  for (const strict of [true, false]) {
    for (let t = 0; t < rules.maxTries; t++) {
      const hazards = pickHazards(catalog.hazards, prevHazardRefs, rng, rules, strict);
      if (!hazards) break;
      const safe = sample(catalog.safe, rules.safeCount, rng);
      if (safe.length !== rules.safeCount) throw new Error('Safe pool is smaller than the draw size.');
      const placed = place([...hazards, ...safe], catalog.slots, rng, rules);
      if (!placed || !reachable(placed)) continue;
      if (!strict) relaxed.push('difficulty-quota');
      const layout = shuffle(placed, rng).map((p, i) => ({
        oid: `o${i + 1}`, kind: catalog.hazards.includes(p.obj) ? 'hazard' : 'safe', ref: p.obj.id, slot: p.slot.id,
      }));
      return { layout, relaxed };
    }
  }
  throw new Error('Could not build a valid layout. Check the pool and slots (npm run test:layout).');
}

// What the browser gets: where things are and which model to draw. Nothing about kind, title or tip.
function publicLayout(layout, catalog = cat.CATALOG) {
  const all = new Map([...catalog.hazards, ...catalog.safe].map((o) => [o.id, o]));
  const slots = new Map(catalog.slots.map((s) => [s.id, s]));
  return layout.map((e) => {
    const o = all.get(e.ref), s = slots.get(e.slot);
    return { id: e.oid, model: o.model, x: s.x, y: s.y, z: s.z, rotY: s.rotY };
  });
}

module.exports = { RULES, generateLayout, publicLayout, reachable, shuffle };
