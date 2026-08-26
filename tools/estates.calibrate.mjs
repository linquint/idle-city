/**
 * Measures what the industrial estates do to the demand cycle, so ESTATE_PLOTS
 * and ESTATE_YIELD can be set from numbers rather than from a feel. Same
 * contract as the other calibrators: it prints, it does not assert.
 *
 * The question it exists to answer is the drift. An estate is industry the city
 * builds on land it does not own, so it lands on all three signals at once —
 * jobs push residential demand up, goods push industrial demand down, and the
 * income multiplier moves the ledger under both. What matters is that a band
 * built out at any point on the level ladder leaves all three signals off their
 * bounds, because a pinned signal is a price that has stopped responding.
 *
 * It reports, for a city built out to its own frontage at each rung:
 *   - R / C / I demand with no estates, at the band's cap, the drift, and the
 *     drift before `clampDemand` takes it
 *   - what an estate is worth to the ledger, and the whole band
 *   - how much of the band the water takes, and what the last parcel costs
 *
 *   node tools/estates.calibrate.mjs
 */
import {
  ESTATE_BASE,
  ESTATE_GROWTH,
  ESTATE_PLOTS,
  ESTATE_YIELD,
  HIGHWAY_MIN_DISTRICTS,
  LEVEL_NAMES,
  MAX_DISTRICTS,
} from '../src/sim/config.ts';
import {
  demandScale,
  demandTargets,
  estateCapacity,
  estateJobs,
  estateSupply,
  income,
  industryScale,
} from '../src/sim/economy.ts';
import { ESTATE_CELLS, ESTATE_ROWS } from '../src/sim/estates.ts';
import { createState } from '../src/sim/state.ts';

/**
 * A city built out to its own frontage with housing all at one level.
 *
 * The same shape the port calibrator uses, and for the same reason: the level
 * ladder spans 300x and is the only variable that can make a constant right at
 * one end and wrong at the other. Industry is held at its own frontage so the
 * reading is about the estates rather than about an empty industrial zone.
 */
function city(level, districts) {
  const s = createState(0);
  s.districts = districts;
  s.cash = 1e12;
  s.happiness = 1;
  const footprint = level >= 2 ? 2 : 1;
  s.homes = Math.floor((24 * districts) / footprint);
  s.mergedR = footprint === 2 ? s.homes : 0;
  s.homeLevels = Array.from({ length: 5 }, (_, l) => (l === level ? s.homes : 0));
  s.shops = 45 * districts;
  s.shopLevels = Array.from({ length: 5 }, (_, l) => (l === level ? s.shops : 0));
  s.industry = 13 * districts;
  s.industryLevels = Array.from({ length: 5 }, (_, l) => (l === level ? s.industry : 0));
  s.hospitals = 6 * districts;
  s.police = districts;
  s.fire = districts;
  s.depots = districts;
  s.depotStaff = 1;
  s.parks = 4 * districts;
  s.highway = true;
  return s;
}

const f = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '-');
const sign = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;

console.log(
  `estate band: ${ESTATE_CELLS} dry parcels of ${ESTATE_ROWS} rows, ` +
    `${ESTATE_PLOTS} plots each at ${ESTATE_YIELD}x yield`,
);
console.log(
  `unlocks at ${HIGHWAY_MIN_DISTRICTS} districts; parcel 1 costs ` +
    `${ESTATE_BASE.toExponential(2)}, parcel ${ESTATE_CELLS} ` +
    `${(ESTATE_BASE * ESTATE_GROWTH ** (ESTATE_CELLS - 1)).toExponential(2)}`,
);

for (const districts of [HIGHWAY_MIN_DISTRICTS, MAX_DISTRICTS]) {
  const cap = estateCapacity(city(0, districts));
  console.log(`\n${districts} districts — ${cap} parcels allowed`);
  console.log(
    `  ${'housing'.padEnd(16)} ${'R'.padStart(6)} ${'C'.padStart(6)} ${'I'.padStart(6)}` +
      `   ${'R'.padStart(6)} ${'C'.padStart(6)} ${'I'.padStart(6)}` +
      `   ${'drift R/C/I'.padStart(20)}  ${'raw R/I'.padStart(13)}  ${'ledger'.padStart(8)} ${'scale'.padStart(6)}`,
  );
  for (let level = 0; level < 5; level++) {
    const bare = city(level, districts);
    const full = { ...bare, estates: cap };
    const a = demandTargets(bare);
    const b = demandTargets(full);
    const lift = (income(full) - income(bare)) / income(bare);
    console.log(
      `  ${(LEVEL_NAMES[level] ?? '').padEnd(16)}` +
        ` ${sign(a.r).padStart(6)} ${sign(a.c).padStart(6)} ${sign(a.i).padStart(6)}` +
        `   ${sign(b.r).padStart(6)} ${sign(b.c).padStart(6)} ${sign(b.i).padStart(6)}` +
        `   ${`${sign(b.r - a.r)} ${sign(b.c - a.c)} ${sign(b.i - a.i)}`.padStart(20)}` +
        // Before `clampDemand`. A built-out city sits on its bounds under this
        // model already, so the clamped drift understates what the band did —
        // and it is the raw number the constants were set from.
        `  ${`${sign(estateJobs(full) / demandScale(full))} ${sign(-estateSupply(full) / demandScale(full))}`.padStart(13)}` +
        `  ${`+${(lift * 100).toFixed(0)}%`.padStart(8)} ${f(industryScale(bare), 0).padStart(6)}`,
    );
  }
}

console.log('\nwhat one parcel is worth to the ledger, at MAX_DISTRICTS');
for (let level = 0; level < 5; level++) {
  const bare = city(level, MAX_DISTRICTS);
  const one = { ...bare, estates: 1 };
  console.log(
    `  ${(LEVEL_NAMES[level] ?? '').padEnd(16)} ` +
      `+${(((income(one) - income(bare)) / income(bare)) * 100).toFixed(2)}%`,
  );
}
