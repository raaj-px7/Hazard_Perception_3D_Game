// Runs 1,000 draws per catalog and checks every layout rule. Exit code 1 on any failure.
// Run twice: against the real pool, and against a synthetic 20+8 pool that exercises the variety rules.
const cat = require('../lib/catalog');
const { RULES, generateLayout, reachable } = require('../lib/layout');

let seed = 12345;
const rng = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

let failures = 0;
const fail = (msg) => { failures++; if (failures <= 15) console.log('  FAIL:', msg); };

// 1) Static checks on the catalog itself.
function checkCatalog(c, label) {
  console.log(`\n[${label}] catalog: ${c.hazards.length} hazards, ${c.safe.length} safe, ${c.slots.length} slots`);
  const ids = [...c.hazards, ...c.safe].map((o) => o.id);
  if (new Set(ids).size !== ids.length) fail('duplicate object ids');
  if (new Set(c.slots.map((s) => s.id)).size !== c.slots.length) fail('duplicate slot ids');
  for (const o of [...c.hazards, ...c.safe]) {
    if (!cat.eligibleSlots(o, c.slots).length) fail(`${o.id} has no eligible slot`);
  }
  // every slot walkable-reachable on an empty floor
  for (const s of c.slots) {
    const obj = { r: 0.1, solid: false };
    if (!reachable([{ obj, slot: s }])) fail(`slot ${s.id} is not reachable on foot`);
  }
  for (const t of Object.keys(RULES.difficultyQuota)) {
    const n = c.hazards.filter((h) => h.difficulty === t).length;
    if (n < RULES.difficultyQuota[t]) fail(`not enough ${t} hazards (${n})`);
  }
}

// 2) 1,000 draws, each following the previous one (simulates one employee playing repeatedly).
function checkDraws(c, label, n = 1000) {
  let prev = [], minNewSeen = 99, relaxedCount = 0, shown = new Map();
  for (let i = 0; i < n; i++) {
    const { layout, relaxed } = generateLayout({ catalog: c, prevHazardRefs: prev, rng });
    if (relaxed.length) relaxedCount++;
    const hz = layout.filter((e) => e.kind === 'hazard'), sf = layout.filter((e) => e.kind === 'safe');
    const H = new Map(c.hazards.map((h) => [h.id, h])), A = new Map([...c.hazards, ...c.safe].map((o) => [o.id, o]));
    const Sl = new Map(c.slots.map((s) => [s.id, s]));
    if (hz.length !== RULES.hazardCount || sf.length !== RULES.safeCount) fail(`draw ${i}: wrong counts ${hz.length}/${sf.length}`);
    if (new Set(layout.map((e) => e.slot)).size !== layout.length) fail(`draw ${i}: two objects share a slot`);
    if (new Set(layout.map((e) => e.ref)).size !== layout.length) fail(`draw ${i}: repeated object`);
    if (new Set(layout.map((e) => e.oid)).size !== layout.length) fail(`draw ${i}: repeated oid`);
    // difficulty balance
    const tiers = {};
    hz.forEach((e) => { const d = H.get(e.ref).difficulty; tiers[d] = (tiers[d] || 0) + 1; });
    if (!relaxed.length) for (const [t, q] of Object.entries(RULES.difficultyQuota)) if ((tiers[t] || 0) !== q) fail(`draw ${i}: ${t} count ${tiers[t] || 0} != ${q}`);
    // category coverage
    const groups = new Set(hz.map((e) => H.get(e.ref).group));
    RULES.groups.forEach((g) => { if (!groups.has(g)) fail(`draw ${i}: no hazard from group ${g}`); });
    // novelty vs previous attempt
    const newCount = hz.filter((e) => !prev.includes(e.ref)).length;
    const newPossible = c.hazards.filter((h) => !prev.includes(h.id)).length;
    const need = Math.min(RULES.minNewHazards, newPossible, RULES.hazardCount);
    if (prev.length && newCount < need) fail(`draw ${i}: only ${newCount} new hazards, need ${need}`);
    if (prev.length) minNewSeen = Math.min(minNewSeen, newCount);
    // placement
    const placed = layout.map((e) => ({ obj: A.get(e.ref), slot: Sl.get(e.slot) }));
    placed.forEach((p) => {
      if (!cat.eligibleSlots(p.obj, c.slots).some((s) => s.id === p.slot.id)) fail(`draw ${i}: ${p.obj.id} on ineligible slot ${p.slot.id}`);
    });
    for (let a = 0; a < placed.length; a++) for (let b = a + 1; b < placed.length; b++) {
      const d = Math.hypot(placed[a].slot.x - placed[b].slot.x, placed[a].slot.z - placed[b].slot.z);
      if (d < RULES.minSpacing - 1e-9) fail(`draw ${i}: ${placed[a].obj.id} and ${placed[b].obj.id} only ${d.toFixed(1)} apart`);
    }
    placed.forEach((p) => { if (Math.hypot(p.slot.x - cat.SPAWN.x, p.slot.z - cat.SPAWN.z) < RULES.spawnClearance) fail(`draw ${i}: ${p.obj.id} near spawn`); });
    if (!reachable(placed)) fail(`draw ${i}: an object is not reachable on foot`);
    hz.forEach((e) => shown.set(e.ref, (shown.get(e.ref) || 0) + 1));
    prev = hz.map((e) => e.ref);
  }
  console.log(`[${label}] ${n} draws done. relaxed draws: ${relaxedCount}. min new hazards vs previous: ${minNewSeen === 99 ? '-' : minNewSeen}`);
  const counts = [...shown.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`[${label}] times shown: ${counts}`);
}

// Synthetic 20 hazards + 8 safe: real entries plus renamed copies (difficulty 8/8/4), to exercise the variety rules.
function expanded() {
  const extraH = cat.HAZARD_POOL.map((h, i) => ({ ...h, id: `${h.id}_x`, difficulty: i % 5 === 0 ? 'hard' : i % 2 ? 'medium' : 'easy' }));
  const extraS = cat.SAFE_POOL.slice(0, 3).map((s) => ({ ...s, id: `${s.id}_x` }));
  return { hazards: [...cat.HAZARD_POOL, ...extraH], safe: [...cat.SAFE_POOL, ...extraS], slots: cat.SLOTS };
}

checkCatalog(cat.CATALOG, 'real pool');
checkDraws(cat.CATALOG, 'real pool');
const big = expanded();
checkCatalog(big, 'synthetic 20+8');
checkDraws(big, 'synthetic 20+8');

console.log(failures ? `\n${failures} failure(s).` : '\nAll layout rules passed.');
process.exit(failures ? 1 : 0);
