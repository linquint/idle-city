/**
 * Measures congestion, so CONGESTION_SCALE and CONGESTION_DENSITY_EXPONENT can
 * be set from numbers rather than from a feel. Same contract as the other
 * calibrators: it prints, it does not assert, and what it prints belongs in the
 * config comments.
 *
 * Four questions, and the second is the one that decided the exponent.
 *
 *   - what the road supply actually is. Every district carves out the same
 *     number of road cells because the rejection sampler forces exactly
 *     TARGET_PLOTS buildable plots — so congestion is a city-wide scalar and a
 *     per-district reading would be a fabrication. Printed first because every
 *     other number here rests on it;
 *   - how hard trips pin against that fixed supply. Raw trips per road cell
 *     span two orders of magnitude over the level ladder, which is the failure
 *     DEMAND_SCALE's comment describes; dividing by `cityScale` outright
 *     overcorrects and *inverts* the sign, so towers would reduce congestion.
 *     The table of candidate exponents is what the choice was read off;
 *   - where the constant puts a balanced, transit-free city. It should read
 *     about half, so there is room to get worse and room to buy the way out;
 *   - what the lever is worth. Congestion exists to give a depot a mood story,
 *     so the grid of transit states is the point of the feature rather than a
 *     footnote to it.
 *
 *   node tools/traffic.calibrate.mjs
 */
import {
  CONGESTION_DENSITY_EXPONENT,
  CONGESTION_MOOD,
  CONGESTION_SCALE,
  DISTRICT_SPAN,
  FRONTAGE_TARGET,
  LEVELS,
  LEVEL_FOOTPRINT,
  MAX_DISTRICTS,
  OCCUPANCY_FULL,
  ROAD_CELLS_PER_DISTRICT,
  SERVICES,
  TARGET_PLOTS,
  TAX_STEPS,
  TRIPS_PER_RESIDENT,
} from '../src/sim/config.ts';
import {
  cityScale,
  congestion,
  jobs,
  residents,
  roadTrips,
  serviceAllowed,
  transitCoverage,
  transitShare,
  trips,
  workers,
} from '../src/sim/economy.ts';
import { districtCoord, districtLayoutAt } from '../src/sim/layout.ts';
import { createState } from '../src/sim/state.ts';

const SIZES = [1, 4, 12, 25, 49];
const EXPONENTS = [0.5, 0.6, 0.75, 0.85, 1.0];

const pad = (v, w) => String(v).padStart(w);
const fixed = (v, w, d = 2) => pad(Number(v).toFixed(d), w);

/**
 * A city of `districts` districts built out to its own frontage at `level`.
 *
 * Same shape as `builtOut` in tools/power.calibrate.mjs, and built against
 * FRONTAGE_TARGET rather than against the zoning arrays for the same reason: a
 * state assembled by hand has no surveyor, and what is being measured here is
 * the road against a finished district rather than whatever split a particular
 * city happened to survey.
 *
 * Fully served and fully staffed, because a city short of a hospital would be
 * reading its own unhappiness through occupancy and into the trip count.
 */
function city(districts, level, patch = {}) {
  const s = createState(0);
  s.districts = districts;
  const foot = LEVEL_FOOTPRINT[level] ?? 1;
  const fit = (per) => Math.floor((districts * per) / foot);
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
  // The depots are the variable this file is about, so they are the one type
  // that does not arrive fully staffed by default.
  s.depots = 0;
  s.depotStaff = 0;
  Object.assign(s, patch);
  return s;
}

// ------------------------------------------------------------------- part 1

console.log('road supply: what every district carves out\n');
{
  let cells = 0;
  let rows = 0;
  let cols = 0;
  const masks = new Set();
  let minCells = Infinity;
  let maxCells = 0;
  for (let i = 0; i < MAX_DISTRICTS; i++) {
    const at = districtCoord(i);
    const plan = districtLayoutAt(at.x, at.z);
    let road = 0;
    for (let c = 0; c < plan.zone.length; c++) if (plan.zone[c] === 0) road++;
    let r = 0;
    let k = 0;
    for (let n = 0; n < DISTRICT_SPAN; n++) {
      if (plan.rowRoad[n]) r++;
      if (plan.colRoad[n]) k++;
    }
    cells += road;
    rows += r;
    cols += k;
    minCells = Math.min(minCells, road);
    maxCells = Math.max(maxCells, road);
    masks.add(`${plan.rowRoad.join('')}|${plan.colRoad.join('')}`);
  }
  console.log(`  road cells a district      ${minCells} to ${maxCells}, mean ${(cells / MAX_DISTRICTS).toFixed(2)}`);
  console.log(`  full row / column lines    ${(rows / MAX_DISTRICTS).toFixed(2)} / ${(cols / MAX_DISTRICTS).toFixed(2)}`);
  console.log(`  distinct line placements   ${masks.size} of ${MAX_DISTRICTS}`);
  console.log(`  buildable plots            ${TARGET_PLOTS}, every district (the sampler forces it)`);
  console.log(`  ROAD_CELLS_PER_DISTRICT    ${ROAD_CELLS_PER_DISTRICT} (derived: ${DISTRICT_SPAN}^2 - ${TARGET_PLOTS})`);
  console.log('');
  console.log('  Supply does not vary. Congestion is a city-wide scalar.');
}
console.log('');

// ------------------------------------------------------------------- part 2

console.log('the pin: trips per road cell on a fully built city, by level\n');
console.log('  level  residents/district      trips  per road cell   cityScale');
for (let level = 0; level < LEVELS; level++) {
  const s = city(1, level);
  const per = trips(s) / ROAD_CELLS_PER_DISTRICT;
  console.log(
    `  ${pad(level, 5)}${fixed(residents(s), 20, 0)}${fixed(trips(s), 11, 1)}` +
      `${fixed(per, 16)}${fixed(cityScale(s), 12)}`,
  );
}
console.log('');
console.log('  Worker-rich, which is why trips are driven by residents:');
console.log('  workers      jobs   at 49 districts, level 4');
{
  const s = city(MAX_DISTRICTS, LEVELS - 1);
  console.log(`  ${fixed(workers(s), 7, 0)}${fixed(jobs(s), 10, 0)}`);
}
console.log('');

console.log('candidate exponents: trips per road cell / cityScale ** p\n');
console.log('  p     ' + Array.from({ length: LEVELS }, (_, l) => pad(`L${l}`, 8)).join('') + pad('L4/L0', 9));
for (const p of EXPONENTS) {
  const row = [];
  for (let level = 0; level < LEVELS; level++) {
    const s = city(1, level);
    row.push(trips(s) / ROAD_CELLS_PER_DISTRICT / cityScale(s) ** p);
  }
  const ratio = (row[LEVELS - 1] ?? 0) / (row[0] || 1);
  const mark = p === CONGESTION_DENSITY_EXPONENT ? '  <- chosen' : '';
  console.log(
    `  ${p.toFixed(2)}` + row.map((v) => fixed(v, 8)).join('') + fixed(ratio, 8) + 'x' + mark,
  );
}
console.log('');

// ------------------------------------------------------------------- part 3

console.log(`congestion at CONGESTION_SCALE ${CONGESTION_SCALE}, transit-free\n`);
console.log('  districts' + Array.from({ length: LEVELS }, (_, l) => pad(`L${l}`, 8)).join(''));
for (const districts of SIZES) {
  const row = [];
  for (let level = 0; level < LEVELS; level++) row.push(congestion(city(districts, level)));
  console.log(`  ${pad(districts, 9)}` + row.map((v) => fixed(v, 8)).join(''));
}
console.log('');

// ------------------------------------------------------------------- part 4

console.log('the lever: what transit is worth, at 12 districts\n');
/**
 * The four transit states, as a *staffing* share rather than a depot count.
 *
 * Coverage saturates well below the depots the land allows, so "half covered"
 * cannot be expressed as half the buildings — it is the ramp, which is the same
 * scalar `covered` multiplies by. Depots are set to what the sites allow and the
 * staffing is what varies.
 */
const STATES = [
  ['no transit', 0, false],
  ['half covered', 0.5, false],
  ['fully covered', 1, false],
  ['free transport', 1, true],
];

/** One of the four states, applied to a city of `districts` at `level`. */
function withTransit(districts, level, staff, free) {
  const s = city(districts, level);
  s.depots = serviceAllowed(s, SERVICES.find((x) => x.key === 'transit'));
  s.depotStaff = staff;
  s.freeTransport = free;
  return s;
}
console.log('  state             reach   carried' + Array.from({ length: LEVELS }, (_, l) => pad(`L${l}`, 8)).join(''));
for (const [name, staff, free] of STATES) {
  const probe = withTransit(12, 1, staff, free);
  const row = [];
  for (let level = 0; level < LEVELS; level++) {
    row.push(congestion(withTransit(12, level, staff, free)));
  }
  console.log(
    `  ${name.padEnd(16)}${fixed(transitCoverage(probe), 7)}${fixed(transitShare(probe), 10)}` +
      row.map((v) => fixed(v, 8)).join(''),
  );
}
console.log('');

console.log('what it costs the mood, against the modifiers already in the bracket\n');
{
  const worst = TAX_STEPS.reduce((low, step) => Math.min(low, step.mood), 0);
  console.log(`  punitive tax          ${fixed(worst, 7)}`);
  console.log(`  fully jammed          ${fixed(-CONGESTION_MOOD, 7)}`);
  for (const [name, staff, free] of STATES) {
    const s = withTransit(12, 2, staff, free);
    console.log(
      `  ${name.padEnd(16)}      ${fixed(-CONGESTION_MOOD * congestion(s), 7)}` +
        `   (${(congestion(s) * 100).toFixed(0)}% jammed, ${roadTrips(s).toFixed(0)} trips on the road)`,
    );
  }
}
console.log('');
console.log(`  TRIPS_PER_RESIDENT ${TRIPS_PER_RESIDENT} (WORKING_SHARE + SPEND_PER_RESIDENT)`);
