/**
 * Measures the water field over thousands of seeds, so the constants in
 * src/sim/water.ts can be set from numbers rather than from a feel. Same
 * contract as the other calibrators: it prints, it does not assert.
 *
 * It reports, over the seed sweep:
 *   - how much of the annexable spiral the water costs, at 1 / 9 / 25 / 49
 *     districts, and how far the city has to reach to find them
 *   - when the first coastal district is annexed, which is when a port unlocks
 *   - whether a path of annexable tiles runs from the origin to a coastal one
 *   - how far the sea is from a coastal district, which is what a port looks at
 *   - how many lakes survive rejection
 *
 *   node tools/water.calibrate.mjs [seeds]
 */
import { DISTRICT_SPAN, CELL, MAX_DISTRICTS } from '../src/sim/config.ts';
import { Waters, WATER_TILE } from '../src/sim/water.ts';

const SEEDS = Number(process.argv[2] ?? 2000);
const TILE = WATER_TILE;

/** The unfiltered ring order, copied from layout.ts so this file stands alone. */
function ringCoords(r) {
  if (r === 0) return [{ x: 0, z: 0 }];
  const edge = [];
  for (let x = -r; x <= r; x++) edge.push({ x, z: -r });
  for (let z = -r + 1; z <= r; z++) edge.push({ x: r, z });
  for (let x = r - 1; x >= -r; x--) edge.push({ x, z: r });
  for (let z = r - 1; z >= -r + 1; z--) edge.push({ x: -r, z });
  const north = edge.findIndex((c) => c.x === 0 && c.z === -r);
  const walk = edge.slice(north).concat(edge.slice(0, north));
  const half = walk.length / 2;
  const order = [];
  for (let i = 0; i < half; i++) order.push(walk[i], walk[i + half]);
  return order;
}

/** The first `count` dry coordinates in ring order, plus the ring it took. */
function drySpiral(waters, count) {
  const out = [];
  let ring = 0;
  while (out.length < count) {
    for (const c of ringCoords(ring)) {
      if (waters.dry(c.x, c.z)) out.push(c);
    }
    ring++;
    if (ring > 40) throw new Error('runaway spiral');
  }
  return { coords: out.slice(0, count), rings: ring - 1 };
}

/** Whether annexable tiles connect the origin to a coastal one, 4-adjacent. */
function reachesCoast(waters, limit) {
  const seen = new Set(['0,0']);
  const queue = [{ x: 0, z: 0 }];
  let steps = 0;
  while (queue.length > 0) {
    const c = queue.shift();
    if (waters.coastal(c.x, c.z)) return true;
    if (++steps > limit) return false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: c.x + dx, z: c.z + dz };
      const key = `${n.x},${n.z}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (waters.dry(n.x, n.z)) queue.push(n);
    }
  }
  return false;
}

/** Nearest sea to a district tile, in world units. Sampled on a ring of rays. */
function seaDistance(waters, dx, dz) {
  let best = Infinity;
  for (let step = 1; step <= 200; step++) {
    const r = step * CELL;
    const n = Math.max(8, Math.round((2 * Math.PI * r) / CELL));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = dx * TILE + Math.cos(a) * r;
      const z = dz * TILE + Math.sin(a) * r;
      if (waters.sea(x, z)) best = Math.min(best, Math.max(0, r - TILE / 2));
    }
    if (best < Infinity) return best;
  }
  return best;
}

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const at = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  return {
    min: s[0],
    p50: at(0.5),
    p95: at(0.95),
    max: s[s.length - 1],
    mean: s.reduce((a, b) => a + b, 0) / s.length,
  };
};
const f = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '-');
const row = (name, xs) => {
  const t = stats(xs);
  console.log(
    `  ${name.padEnd(28)} min ${String(f(t.min)).padStart(6)}  p50 ${String(f(t.p50)).padStart(6)}` +
      `  p95 ${String(f(t.p95)).padStart(6)}  max ${String(f(t.max)).padStart(6)}  mean ${f(t.mean, 2)}`,
  );
};

console.log(`water field over ${SEEDS} seeds  ·  tile ${TILE}  ·  span ${DISTRICT_SPAN}`);

const firstCoastal = [];
const ringsFor49 = [];
const lakes = [];
const coastGap = [];
const blockedIn49 = [];
const radius49 = [];
const ringLoss = [[], [], [], []];
const sides = { 'x+': 0, 'x-': 0, 'z+': 0, 'z-': 0 };
let unreachable = 0;
let originWet = 0;
let noCoastalIn49 = 0;

for (let i = 0; i < SEEDS; i++) {
  const seed = (i * 2_654_435_761 + 12_345) | 0;
  const waters = new Waters(seed);
  sides[`${waters.coast.axis}${waters.coast.sign > 0 ? '+' : '-'}`]++;
  if (!waters.dry(0, 0)) originWet++;
  if (!reachesCoast(waters, 4_000)) unreachable++;
  lakes.push(waters.lakes.length);

  const { coords, rings } = drySpiral(waters, MAX_DISTRICTS);
  ringsFor49.push(rings);
  // How many of the first 49 ring positions the water cost the city.
  let ringOrder = [];
  for (let r = 0; ringOrder.length < MAX_DISTRICTS; r++) ringOrder.push(...ringCoords(r));
  ringOrder = ringOrder.slice(0, MAX_DISTRICTS);
  blockedIn49.push(ringOrder.filter((c) => !waters.dry(c.x, c.z)).length);
  for (let r = 1; r <= 3; r++) {
    ringLoss[r].push(ringCoords(r).filter((c) => !waters.dry(c.x, c.z)).length);
  }
  let ring = 0;
  for (const c of coords) ring = Math.max(ring, Math.abs(c.x), Math.abs(c.z));
  radius49.push((ring + 0.5) * TILE);

  const first = coords.findIndex((c) => waters.coastal(c.x, c.z));
  if (first < 0) noCoastalIn49++;
  else {
    firstCoastal.push(first + 1);
    const c = coords[first];
    coastGap.push(seaDistance(waters, c.x, c.z));
  }
}

console.log(`\ncoast side: ${JSON.stringify(sides)}`);
console.log(`origin district wet:            ${originWet} / ${SEEDS}`);
console.log(`no path origin -> coast:        ${unreachable} / ${SEEDS}`);
console.log(`no coastal district in first ${MAX_DISTRICTS}: ${noCoastalIn49} / ${SEEDS}`);
console.log('');
row('lakes kept', lakes);
row('city radius at 49 (units)', radius49);
for (let r = 1; r <= 3; r++) row(`ring ${r} lost of ${8 * r}`, ringLoss[r]);
row('ring positions lost of 49', blockedIn49);
row('rings needed for 49', ringsFor49);
row('first coastal district #', firstCoastal);
row('sea from that tile (units)', coastGap);
