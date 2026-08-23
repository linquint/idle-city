/**
 * Measures what shapes a district's frontage can actually be merged into.
 *
 * The question this answers is whether 2x2 merging is possible on this land.
 * It is not: greedily pairing frontage into 2x1 dominoes and then pairing those
 * into 2x2 quads finds dominoes in quantity and quads almost never, because the
 * university and civic passes are ranked on dead land and take exactly the
 * deep-block interiors — what is left for sale is a one-plot-wide ring. The
 * numbers this prints are the ones quoted in `parcelOrder` in src/sim/layout.ts.
 *
 *   node tools/parcels.calibrate.mjs [districts]
 */
import { DISTRICT_SPAN } from '../src/sim/config.ts';
import { districtPlanAt, parcelOrder } from '../src/sim/layout.ts';

const DISTRICTS = Number(process.argv[2] ?? 100);

/** The quad pass: pair two dominoes that sit alongside each other. */
function quads(cells, sizes) {
  const pairs = [];
  let at = 0;
  for (const size of sizes) {
    if (size === 2) pairs.push([cells[at], cells[at + 1]]);
    at += size;
  }
  const key = (a, b) => `${a},${b}`;
  const byLow = new Map(pairs.map((p) => [Math.min(p[0], p[1]), p]));
  const taken = new Set();
  let found = 0;
  for (const low of [...byLow.keys()].sort((a, b) => a - b)) {
    if (taken.has(low)) continue;
    const pair = byLow.get(low);
    const horizontal = Math.abs(pair[0] - pair[1]) === 1;
    // A horizontal domino quads with the one directly below it; a vertical one
    // with the one directly to its right.
    const mate = low + (horizontal ? DISTRICT_SPAN : 1);
    const other = byLow.get(mate);
    if (!other || taken.has(mate)) continue;
    const alsoHorizontal = Math.abs(other[0] - other[1]) === 1;
    if (alsoHorizontal !== horizontal) continue;
    taken.add(low);
    taken.add(mate);
    found++;
  }
  return found;
}

const zones = ['residential', 'commercial', 'industrial'];
const tally = Object.fromEntries(zones.map((z) => [z, { plots: 0, pairs: 0, singles: 0, quads: 0, minPairs: Infinity, maxSingles: 0 }]));

for (let i = 0; i < DISTRICTS; i++) {
  // Straight along one axis of district space: any walk over distinct
  // coordinates samples the same seed stream the game does.
  const plan = districtPlanAt(i % 7, Math.floor(i / 7));
  for (const zone of zones) {
    const { cells, sizes } = parcelOrder(plan[zone]);
    const pairs = sizes.filter((s) => s === 2).length;
    const singles = sizes.length - pairs;
    const t = tally[zone];
    t.plots += cells.length;
    t.pairs += pairs;
    t.singles += singles;
    t.quads += quads(cells, sizes);
    t.minPairs = Math.min(t.minPairs, pairs);
    t.maxSingles = Math.max(t.maxSingles, singles);
  }
}

console.log(`${DISTRICTS} districts\n`);
console.log('zone          plots  dominoes (min)  singles (max)   quads');
for (const zone of zones) {
  const t = tally[zone];
  const n = DISTRICTS;
  console.log(
    `${zone.padEnd(13)} ${(t.plots / n).toFixed(1).padStart(5)}` +
      `  ${(t.pairs / n).toFixed(1).padStart(8)} (${String(t.minPairs).padStart(2)})` +
      `  ${(t.singles / n).toFixed(1).padStart(7)} (${String(t.maxSingles).padStart(2)})` +
      `  ${(t.quads / n).toFixed(1).padStart(6)}`,
  );
}
