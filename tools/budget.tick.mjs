/**
 * What a simulation tick is allowed to cost, and how that is asserted on a
 * machine nobody controls.
 *
 * Like `budget.size.mjs` and unlike the calibrators, this **asserts**: it exits
 * non-zero on a breach and CI runs it.
 *
 *   npm run budget:tick
 *
 * ---
 *
 * **Why not frame time.** A frame-time assertion on a shared GitHub runner with
 * software WebGL measures the runner. It is not a close call: this repository
 * has already watched two ordinary vitest cases time out on CI at 3.3s and
 * 3.1s locally, purely because the runner is slower and noisier than a laptop —
 * see the commit that budgeted them. A number that flakes gets muted, and a
 * muted budget is worse than none.
 *
 * **What is worth asserting instead.** The tick, and one property of it. The
 * simulation runs at 10 Hz and several of its parts are O(districts) or
 * O(levels); the regression that would hurt and would never be noticed is one
 * of them quietly becoming O(buildings), because at the top of the map that is
 * a factor of 49 and the game would still look and test correct. That failure
 * is visible in the *shape* of the cost curve rather than in its height.
 *
 * **So the budget is a ratio.** Two cities are measured in the same process,
 * interleaved — one district built out, and MAX_DISTRICTS built out — and what
 * is asserted is `t(49) / t(1)` rather than either number. A slow runner slows
 * both halves and the ratio cancels; a noisy one is answered by taking medians
 * of interleaved samples, so drift across the run falls out too. Measured here
 * it runs 1.59 to 1.68 across repeated runs on the same machine.
 *
 * **And that ratio does catch the thing it is for.** The 49-district city
 * carries 4,018 buildings against the one-district city's 82, so a loop over
 * buildings costing `c` per building would make it
 * `(10.4 + 4018c) / (6.6 + 82c)`. Setting that equal to the 2.2 budget gives
 * `c = 1.07 ns` — about the cost of a single array read and an add. There is no
 * O(buildings) loop that can be added to this path and stay inside the number.
 *
 * **What is printed but not asserted.** How the tick varies with how *built up*
 * the city is, at a fixed 49 districts, from 7 buildings to 4,018. It is worth
 * looking at and it is not worth asserting, because it does not measure what it
 * looks like it measures: a busy city genuinely runs code an empty one skips —
 * fires burn and are resolved, buildings promote, parcels merge — so the curve
 * has a real slope that is branch-taking rather than complexity. What the table
 * does show is that the slope is falling: 4.4 ns a building over the first
 * forty and 0.84 ns over four thousand, which is what sub-linear looks like when
 * the underlying work is bounded by static tables and the counts are read
 * rather than walked.
 *
 * **And a ceiling, loosely.** A ratio cannot see a regression that slows every
 * city equally — someone putting a sort inside `income`, say. So there is an
 * absolute ceiling as a backstop, set an order of magnitude above the
 * measurement precisely so it never has an opinion about which runner it is on.
 * It is there to catch a catastrophe, not a percentage.
 */
import {
  FRONTAGE_TARGET,
  LEVELS,
  LEVEL_FOOTPRINT,
  MAX_DISTRICTS,
  OCCUPANCY_FULL,
  SERVICES,
} from '../src/sim/config.ts';
import { serviceAllowed } from '../src/sim/economy.ts';
import { Game } from '../src/sim/game.ts';
import { createState } from '../src/sim/state.ts';

/**
 * How sensitive the tick may be to the size of the city.
 *
 * Measured at 1.59 to 1.68 across repeated runs on one machine — the spread is
 * the simulation itself rather than the clock, since a city is not the same
 * city four hundred simulated seconds later and the fire process is drawing
 * against a cursor throughout. 2.2 is 31% of headroom over the worst of those,
 * which is enough that neither an ordinary new O(districts) read nor a slower
 * runner argues with it, and tight enough that a loop over buildings costing
 * more than 1.07 ns a building cannot fit inside it. See the header.
 */
const SCALE_BUDGET = 2.2;

/**
 * The backstop, in microseconds per tick at MAX_DISTRICTS.
 *
 * Measured at 10.4 us here. 100 is nearly ten times that, which is the point:
 * a runner three or four times slower than a laptop still lands at 30-40 and
 * the number never has to be re-argued because CI changed its hardware. What it
 * catches is an order of magnitude, and an order of magnitude is a bug.
 */
const CEILING_US = 100;

/** Ticks per sample. Long enough that the clock's own resolution is noise. */
const TICKS = 4_000;
/** Samples per city, interleaved between them so drift cancels. */
const SAMPLES = 25;
const WARMUP = 6;

/**
 * A city on `districts` of land, built out to `share` of its own frontage at
 * `level`, fully served and staffed.
 *
 * A share rather than a flag, because the diagnostic below wants the whole
 * curve and a part-built city is a real state — annexing is a purchase of its
 * own and a player can own a great deal of land with very little on it.
 */
function city(districts, level, share = 1) {
  const s = createState(0);
  s.districts = districts;
  const foot = LEVEL_FOOTPRINT[level] ?? 1;
  const fit = (per) => Math.max(1, Math.floor((districts * per * share) / foot));
  const cohort = (n) => {
    const levels = new Array(LEVELS).fill(0);
    levels[level] = n;
    return levels;
  };
  const homes = fit(FRONTAGE_TARGET.residential);
  const shops = fit(FRONTAGE_TARGET.commercial);
  const works = fit(FRONTAGE_TARGET.industrial);
  Object.assign(s, {
    homes,
    shops,
    industry: works,
    homeLevels: cohort(homes),
    shopLevels: cohort(shops),
    industryLevels: cohort(works),
    mergedR: foot > 1 ? homes : 0,
    mergedC: foot > 1 ? shops : 0,
    mergedI: foot > 1 ? works : 0,
    occupancyR: OCCUPANCY_FULL,
    occupancyC: OCCUPANCY_FULL,
    occupancyI: OCCUPANCY_FULL,
    happiness: 1,
    parks: districts * 4,
    plants: districts,
    plantStaff: 1,
    cityHall: true,
    museums: districts,
    stadiums: districts,
    // Deep enough that no tick spends its time in the arrears path, which is a
    // different measurement from the one this is making.
    cash: 1e12,
    // One zoning entry a district, which is what a city of this size carries.
    surveyedR: new Array(districts).fill(s.surveyedR[0]),
    surveyedC: new Array(districts).fill(s.surveyedC[0]),
    surveyedI: new Array(districts).fill(s.surveyedI[0]),
  });
  for (const service of SERVICES) {
    const allowed = serviceAllowed(s, service);
    if (service.key === 'hospital') s.hospitals = allowed;
    else if (service.key === 'police') s.police = allowed;
    else if (service.key === 'fire') s.fire = allowed;
    else if (service.key === 'school') s.schools = allowed;
    else if (service.key === 'transit') s.depots = allowed;
    else s.universities = allowed;
  }
  s.hospitalStaff = 1;
  s.policeStaff = 1;
  s.fireStaff = 1;
  s.schoolStaff = 1;
  s.universityStaff = 1;
  s.depotStaff = 1;
  return s;
}

const tick = (game) => {
  for (let i = 0; i < TICKS; i++) game.advance(0.1);
};

const median = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const buildings = (s) => s.homes + s.shops + s.industry;

/**
 * Microseconds a tick costs for each city, sampled alternately.
 *
 * Two things here are the measurement rather than tidiness.
 *
 * The games are rebuilt for every sample, because four thousand ticks is nearly
 * seven simulated minutes and a city *changes* over them — buildings climb
 * levels, pairs merge, the surveyor rezones. Reusing one game would have every
 * sample measure a different city from the last, and the three would drift
 * apart at different rates, which is precisely the comparison this is trying to
 * make. Construction happens outside the clock.
 *
 * And the samples are interleaved rather than run city by city: a noisy
 * neighbour, a thermal step or a GC pause that lands in the middle of the run
 * then hits all three equally and the ratios do not move. Measuring one to
 * completion and then the next would let a slowdown that started halfway
 * through land entirely on the second.
 */
function measure(cities, samples_ = SAMPLES) {
  const warm = cities.map((make) => new Game(make()));
  for (let i = 0; i < WARMUP; i++) for (const game of warm) tick(game);
  const samples = cities.map(() => []);
  for (let round = 0; round < samples_; round++) {
    cities.forEach((make, i) => {
      const game = new Game(make());
      const at = performance.now();
      tick(game);
      samples[i].push(((performance.now() - at) * 1000) / TICKS);
    });
  }
  return samples.map(median);
}

const CITIES = [
  { name: '1 district, built out', make: () => city(1, 0) },
  { name: `${MAX_DISTRICTS} districts, built out`, make: () => city(MAX_DISTRICTS, 0) },
];

/**
 * How built up a 49-district city is, printed rather than asserted.
 *
 * See the header: the slope here is real work rather than complexity, so it is
 * a diagnostic. What it is a diagnostic *of* is the per-building cost in the
 * last column — a number that stops falling is the thing to look at.
 */
const DENSITIES = [0.002, 0.01, 0.05, 0.25, 1];

const [small, large] = measure(CITIES.map((entry) => entry.make));
const scale = large / small;

const fixed = (v, w, d = 2) => String(Number(v).toFixed(d)).padStart(w);
const thou = (v, w) => String(Number(v).toLocaleString('en-GB')).padStart(w);

console.log('\nSimulation tick budget\n');
console.log(
  `  ${TICKS.toLocaleString('en-GB')} ticks a sample, ${SAMPLES} samples a city, medians, interleaved\n`,
);
console.log('  city                        buildings    us/tick');
console.log('  ------------------------------------------------');
[small, large].forEach((us, i) => {
  const entry = CITIES[i];
  console.log(`  ${entry.name.padEnd(26)} ${thou(buildings(entry.make()), 9)} ${fixed(us, 10)}`);
});
console.log('');
console.log(
  `  scale    t(${MAX_DISTRICTS}d) / t(1d)           ${fixed(scale, 6)}   budget ${SCALE_BUDGET.toFixed(2)}`,
);
console.log(
  `  ceiling  at ${MAX_DISTRICTS} districts         ${fixed(large, 6)}   budget ${CEILING_US.toFixed(2)} us`,
);

// The diagnostic. Fewer samples, because nothing is asserted off it and it is
// the one part of this script whose cost is not paid for by a failure it can
// produce.
const densities = measure(
  DENSITIES.map((share) => () => city(MAX_DISTRICTS, 0, share)),
  10,
);
const bare = densities[0] ?? 0;
console.log(`\n  How the tick varies with how built up ${MAX_DISTRICTS} districts are (not asserted)`);
console.log('  --------------------------------------------------------------------');
console.log('  buildings    us/tick     over bare      ns a building');
DENSITIES.forEach((share, i) => {
  const us = densities[i] ?? 0;
  const count = buildings(city(MAX_DISTRICTS, 0, share));
  const over = us - bare;
  console.log(
    `  ${thou(count, 9)} ${fixed(us, 10)} ${fixed(over, 13, 3)}` +
      `${i === 0 ? '                  —' : fixed((over * 1000) / count, 19, 2)}`,
  );
});

const failures = [];
if (scale > SCALE_BUDGET) {
  failures.push(
    `tick scale: budget ${SCALE_BUDGET.toFixed(2)}x, actual ${scale.toFixed(2)}x, ` +
      `over by ${(scale - SCALE_BUDGET).toFixed(2)}x — the tick has become more sensitive to ` +
      `the size of the city. Something on the 10 Hz path is walking what it used to count.`,
  );
}
if (large > CEILING_US) {
  failures.push(
    `tick ceiling: budget ${CEILING_US.toFixed(0)} us, actual ${large.toFixed(2)} us, ` +
      `over by ${(large - CEILING_US).toFixed(2)} us at ${MAX_DISTRICTS} districts.`,
  );
}

if (failures.length === 0) {
  console.log('\n  The tick is inside both budgets.\n');
  process.exit(0);
}

console.error('\n  Over budget:\n');
for (const line of failures) console.error(`    ${line}`);
console.error(
  '\n  These are shape budgets rather than speed budgets — see the header. A\n' +
    '  breach means the cost curve moved, not that the runner was slow.\n',
);
process.exit(1);
