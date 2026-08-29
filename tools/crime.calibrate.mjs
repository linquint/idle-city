/**
 * Measures crime, so CRIME_MOOD and the two source weights can be set from
 * numbers rather than from a feel. Same contract as the other calibrators: it
 * prints, it does not assert.
 *
 * The feature this belongs to is a *re-calibration* and not an addition: police
 * used to carry 0.26 in the weighted happiness sum, and crime replaces it. So
 * the first thing printed is the choice that was made and the arithmetic behind
 * it, because that is the decision a reader of this file most needs to check.
 *
 * Five questions:
 *
 *   - what the weights were and what they became, and what option (a) — police
 *     keeping its weight with crime on top — would have cost instead;
 *   - what the pressure is made of, across every district count and level. A
 *     term that is zero for the first three rungs of the ladder is a term that
 *     only exists in a city nobody has reached;
 *   - what share of the city's housing is affected, which is the number the
 *     brief asks for;
 *   - what it costs the mood, against the modifiers already in the bracket;
 *   - the happiness ceiling at every district count, which is the guard. A city
 *     that has done everything available to it must get back to ~1.
 *
 *   node tools/crime.calibrate.mjs
 */
import {
  CRIME_CROWDING_FULL,
  CRIME_FROM_CROWDING,
  CRIME_FROM_IDLENESS,
  CRIME_MOOD,
  CONGESTION_MOOD,
  FRONTAGE_TARGET,
  HAPPINESS_SERVICES,
  LANDMARK_MOOD,
  LEVELS,
  LEVEL_FOOTPRINT,
  MAX_DISTRICTS,
  OCCUPANCY_FULL,
  RECREATION_WEIGHT,
  SERVICES,
  TAX_STEPS,
} from '../src/sim/config.ts';
import {
  coverage,
  crime,
  crimeCrowding,
  crimeMood,
  crimePressure,
  garbage,
  happinessTarget,
  housingPlots,
  jobs,
  parkCapacity,
  recreationCoverage,
  residents,
  serviceAllowed,
  unemployment,
  workers,
} from '../src/sim/economy.ts';
import { createState } from '../src/sim/state.ts';

const SIZES = [1, 4, 10, 25, MAX_DISTRICTS];

const pad = (v, w) => String(v).padStart(w);
const fixed = (v, w, d = 2) => pad(Number(v).toFixed(d), w);

/**
 * A city of `districts` districts built out to its own frontage at `level`.
 *
 * `serve` decides how much of it is covered, so the same fixture prints both a
 * neglected city and the fully served one the ceiling is measured on.
 */
function city(districts, level, serve = 0) {
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
    plants: districts,
    plantStaff: 1,
  });
  if (serve > 0) {
    s.parks = Math.round(parkCapacity(s) * serve);
    for (const service of SERVICES) {
      const n = Math.round(serviceAllowed(s, service) * serve);
      if (service.key === 'hospital') s.hospitals = n;
      else if (service.key === 'police') s.police = n;
      else if (service.key === 'fire') s.fire = n;
      else if (service.key === 'school') s.schools = n;
      else if (service.key === 'transit') s.depots = n;
      else s.universities = n;
    }
    s.hospitalStaff = 1;
    s.policeStaff = 1;
    s.fireStaff = 1;
    s.schoolStaff = 1;
    s.universityStaff = 1;
    s.depotStaff = 1;
  }
  return s;
}

// ------------------------------------------------------------------- part 1

console.log('the weight decision, and the option not taken\n');
{
  const police = SERVICES.find((service) => service.key === 'police');
  const before = { hospital: 0.34, police: 0.26, fire: 0.22, recreation: 0.18 };
  console.log('  term          was    now   note');
  console.log(`  hospital     ${fixed(before.hospital, 6, 2)} ${fixed(
    SERVICES.find((x) => x.key === 'hospital')?.weight ?? 0,
    6,
    2,
  )}   re-normalised over 0.74`);
  console.log(`  police       ${fixed(before.police, 6, 2)} ${fixed(police?.weight ?? 0, 6, 2)}   crime carries it now`);
  console.log(`  fire         ${fixed(before.fire, 6, 2)} ${fixed(
    SERVICES.find((x) => x.key === 'fire')?.weight ?? 0,
    6,
    2,
  )}   re-normalised over 0.74`);
  console.log(`  recreation   ${fixed(before.recreation, 6, 2)} ${fixed(RECREATION_WEIGHT, 6, 2)}   re-normalised over 0.74`);
  const sum = HAPPINESS_SERVICES.reduce((n, x) => n + x.weight, 0) + RECREATION_WEIGHT;
  console.log(`  sum          ${fixed(1, 6, 2)} ${fixed(sum, 6, 2)}`);
  console.log('');
  console.log('  exact re-normalisation is 0.4595 / 0.2973 / 0.2432; the table rounds to');
  console.log('  0.46 / 0.30 / 0.24, which sums to 1.00 exactly and is within half a point');
  console.log('  of the ratio everywhere.');
  console.log('');
  console.log('  option (a), which was rejected: police keeps 0.26 and crime is charged on');
  console.log('  top of it. What that costs a city with no police at all, by level:\n');
  console.log('    level   (a) police shortfall + crime   (b) crime alone   (a) as a share of (b)');
  for (let level = 0; level < LEVELS; level++) {
    const s = city(10, level);
    const bare = 1 - coverage(s, police);
    const a = 0.26 * bare + CRIME_MOOD * crime(s);
    const b = CRIME_MOOD * crime(s);
    console.log(
      `    ${pad(level, 5)}${fixed(a, 30, 3)}${fixed(b, 19, 3)}${fixed(b > 0 ? a / b : 0, 22, 2)}x`,
    );
  }
  console.log('');
  console.log('  (a) charges the same purchase twice, and the ratio is what that is worth:');
  console.log('  a police station is between one and a half and two stations of mood. That');
  console.log('  is not a sizing problem to be tuned away, it is two models of the same');
  console.log('  thing running at once.');
}
console.log('');

// ------------------------------------------------------------------- part 2

console.log('what the pressure is made of\n');
for (const districts of SIZES) {
  console.log(`  ${districts} districts`);
  console.log('    level   residents/plot   crowding   jobs/worker   idle   pressure');
  for (let level = 0; level < LEVELS; level++) {
    const s = city(districts, level);
    const plots = housingPlots(s);
    console.log(
      `    ${pad(level, 5)}${fixed(plots > 0 ? residents(s) / plots : 0, 17, 1)}` +
        `${fixed(crimeCrowding(s), 11, 3)}${fixed(workers(s) > 0 ? jobs(s) / workers(s) : 0, 14, 3)}` +
        `${fixed(unemployment(s), 7, 3)}${fixed(crimePressure(s), 11, 3)}`,
    );
  }
  console.log('');
}
console.log(`  CRIME_CROWDING_FULL ${CRIME_CROWDING_FULL} residents a plot; ` +
  `${CRIME_FROM_CROWDING} crowding + ${CRIME_FROM_IDLENESS} idleness`);
console.log('');

// ------------------------------------------------------------------- part 3

console.log('the share of the housing affected, by police coverage\n');
for (const districts of SIZES) {
  console.log(`  ${districts} districts` + '        police coverage');
  console.log('    level' + [0, 0.25, 0.5, 0.75, 1].map((c) => pad(`${c * 100}%`, 10)).join(''));
  for (let level = 0; level < LEVELS; level++) {
    const row = [0, 0.25, 0.5, 0.75, 1].map((serve) => crime(city(districts, level, serve)));
    console.log(`    ${pad(level, 5)}` + row.map((v) => fixed(v, 10, 3)).join(''));
  }
  console.log('');
}

// ------------------------------------------------------------------- part 4

console.log('what it costs the mood, against the bracket it joins\n');
{
  const worst = TAX_STEPS.reduce((low, step) => Math.min(low, step.mood), 0);
  console.log(`  punitive tax          ${fixed(worst, 7, 3)}`);
  console.log(`  fully jammed          ${fixed(-CONGESTION_MOOD, 7, 3)}`);
  console.log(`  full landmark reach   ${fixed(LANDMARK_MOOD, 7, 3)}`);
  console.log(`  wholly criminal       ${fixed(-CRIME_MOOD, 7, 3)}   <- this`);
  console.log('');
  console.log('  and what an actual city pays, at 10 districts:\n');
  console.log('    level   no police   quarter   half   three quarters   all');
  for (let level = 0; level < LEVELS; level++) {
    const row = [0, 0.25, 0.5, 0.75, 1].map((serve) => crimeMood(city(10, level, serve)));
    console.log(`    ${pad(level, 5)}` + row.map((v) => fixed(v, 11, 3)).join(''));
  }
}
console.log('');

// ------------------------------------------------------------------- part 5

console.log('the guard: the happiness ceiling, fully served, both features on\n');
console.log('  districts' + Array.from({ length: LEVELS }, (_, l) => pad(`L${l}`, 8)).join('') + '   worst');
{
  let worst = 1;
  for (let districts = 1; districts <= MAX_DISTRICTS; districts++) {
    const row = [];
    for (let level = 0; level < LEVELS; level++) {
      const s = city(districts, level, 1);
      row.push(happinessTarget(s));
      worst = Math.min(worst, happinessTarget(s));
    }
    if (SIZES.includes(districts)) {
      console.log(`  ${pad(districts, 9)}` + row.map((v) => fixed(v, 8, 3)).join(''));
    }
  }
  console.log('');
  console.log(`  worst over every district count from 1 to ${MAX_DISTRICTS}, every level: ${worst.toFixed(4)}`);
  console.log('  The test asserts >= 0.95. Both terms are pressure times *uncovered*');
  console.log('  service, so a city with its police and its depots built reads exactly');
  console.log('  zero on each however crowded, idle or dirty it would otherwise be.');
  console.log('');
  const s = city(MAX_DISTRICTS, LEVELS - 1, 1);
  console.log(`  at ${MAX_DISTRICTS} districts, level ${LEVELS - 1}, fully served:`);
  console.log(`    police coverage   ${coverage(s, SERVICES.find((x) => x.key === 'police')).toFixed(4)}`);
  console.log(`    crime             ${crime(s).toFixed(6)}`);
  console.log(`    garbage           ${garbage(s).toFixed(6)}`);
  console.log(`    recreation        ${recreationCoverage(s).toFixed(4)}`);
  console.log(`    happiness target  ${happinessTarget(s).toFixed(4)}`);
}
