/**
 * Measures rubbish, so GARBAGE_MOOD and the accumulation rates can be set from
 * numbers rather than from a feel. Same contract as the other calibrators: it
 * prints, it does not assert.
 *
 * Four questions:
 *
 *   - what the city actually puts out, and which of the three sources dominates
 *     at each rung of the ladder. A term carried entirely by one source is a
 *     term with one input and two decorations;
 *   - what share of the housing is affected, at every district count and level
 *     and at every depot coverage — the number the brief asks for;
 *   - what the depot is worth as a purchase, since it is now the answer to two
 *     problems rather than one;
 *   - the happiness ceiling, before and after, which is the guard.
 *
 *   node tools/garbage.calibrate.mjs
 */
import {
  CONGESTION_MOOD,
  FRONTAGE_TARGET,
  GARBAGE_MOOD,
  GARBAGE_PER_RESIDENT,
  GARBAGE_PER_SHOP,
  GARBAGE_PER_WORKS,
  GARBAGE_SATURATION,
  LANDMARK_MOOD,
  LEVELS,
  LEVEL_FOOTPRINT,
  MAX_DISTRICTS,
  OCCUPANCY_FULL,
  RECREATION_WEIGHT,
  SERVICES,
} from '../src/sim/config.ts';
import {
  activeOf,
  congestion,
  coverage,
  crime,
  effectiveOf,
  garbage,
  garbageCollection,
  garbageLoad,
  garbageMood,
  garbageRate,
  happinessTarget,
  housingPlots,
  parkCapacity,
  recreationCoverage,
  residents,
  serviceAllowed,
  serviceCost,
} from '../src/sim/economy.ts';
import { createState } from '../src/sim/state.ts';

const SIZES = [1, 4, 10, 25, MAX_DISTRICTS];
const COVERS = [0, 0.25, 0.5, 0.75, 1];

const pad = (v, w) => String(v).padStart(w);
const fixed = (v, w, d = 2) => pad(Number(v).toFixed(d), w);

/** A city of `districts` districts at `level`, served to `serve` of its cap. */
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

/**
 * The happiness target the old model would have given, for the before column.
 *
 * The four weights as they stood at 4b9dae6 — hospital 0.34, police 0.26, fire
 * 0.22, recreation 0.18 — with no crime and no rubbish. Written out rather than
 * imported, because the constants it needs no longer exist.
 */
function ceilingBefore(s) {
  const plots = housingPlots(s);
  const share = Math.min(1, plots / 12);
  const cover = (key) => {
    const service = SERVICES.find((x) => x.key === key);
    return service ? coverage(s, service) : 0;
  };
  let short = 0;
  short += 0.34 * (1 - cover('hospital'));
  short += 0.26 * (1 - cover('police'));
  short += 0.22 * (1 - cover('fire'));
  short += 0.18 * (1 - recreationCoverage(s));
  const covered = 1 - share * short;
  return Math.max(0, Math.min(1, covered - CONGESTION_MOOD * congestion(s)));
}

// ------------------------------------------------------------------- part 1

console.log('what the city puts out\n');
console.log(`  ${GARBAGE_PER_RESIDENT} a resident, ${GARBAGE_PER_SHOP} a trading premises,` +
  ` ${GARBAGE_PER_WORKS} a working industry\n`);
console.log('  level   from homes   from shops   from works        total   per plot   load');
for (let level = 0; level < LEVELS; level++) {
  const s = city(10, level);
  const plots = housingPlots(s);
  const homes = residents(s) * GARBAGE_PER_RESIDENT;
  const shops = effectiveOf(s, 'shop') * GARBAGE_PER_SHOP;
  const works = activeOf(s, 'industry') * GARBAGE_PER_WORKS;
  console.log(
    `  ${pad(level, 5)}${fixed(homes, 13, 0)}${fixed(shops, 13, 0)}${fixed(works, 13, 0)}` +
      `${fixed(garbageRate(s), 13, 0)}${fixed(plots > 0 ? garbageRate(s) / plots : 0, 11, 1)}` +
      `${fixed(garbageLoad(s), 7, 3)}`,
  );
}
console.log('');
console.log(`  GARBAGE_SATURATION ${GARBAGE_SATURATION} a plot, read on a square root — so the term has`);
console.log('  range at both ends of the ladder rather than only at one, and is never');
console.log('  clamped. The three coefficients are set so no one source carries it: a');
console.log("  village's rubbish is mostly industrial, because industry is flat per plot");
console.log('  and everything else is small; by arcologies the people and shops have');
console.log('  taken it over.');
console.log('');

// ------------------------------------------------------------------- part 2

console.log('the share of the housing affected, by depot coverage\n');
for (const districts of SIZES) {
  console.log(`  ${districts} districts` + '        depot coverage');
  console.log('    level' + COVERS.map((c) => pad(`${c * 100}%`, 10)).join(''));
  for (let level = 0; level < LEVELS; level++) {
    const row = COVERS.map((serve) => garbage(city(districts, level, serve)));
    console.log(`    ${pad(level, 5)}` + row.map((v) => fixed(v, 10, 3)).join(''));
  }
  console.log('');
}
console.log('  Collection is the depot, in the plots-covered form `covered` already uses:');
console.log('  a plot count over the housing land, with nothing anywhere deciding which');
console.log('  plots. A circle round a depot would put a number on screen that the');
console.log('  services panel does not have — see `garbageCollection`.');
console.log('');

// ------------------------------------------------------------------- part 3

console.log('what a depot is worth now that it answers two things\n');
console.log('  districts   level   depots   price   congestion lift   rubbish lift    total');
for (const districts of [4, 10, 25]) {
  for (const level of [2, 4]) {
    const s = city(districts, level, 0.5);
    const transit = SERVICES.find((x) => x.key === 'transit');
    const more = { ...s, depots: s.depots + 1, depotStaff: 1 };
    const jam = CONGESTION_MOOD * (congestion(s) - congestion(more));
    const bins = GARBAGE_MOOD * (garbage(s) - garbage(more));
    console.log(
      `  ${pad(districts, 9)}${pad(level, 8)}${pad(s.depots, 9)}` +
        `${fixed(transit ? serviceCost(s, transit) : 0, 8, 0)}${fixed(jam, 18, 4)}` +
        `${fixed(bins, 15, 4)}${fixed(jam + bins, 9, 4)}`,
    );
  }
}
console.log('');
console.log(`  GARBAGE_MOOD ${GARBAGE_MOOD}, against CONGESTION_MOOD ${CONGESTION_MOOD}. Under it on purpose:`);
console.log('  an uncollected street is unpleasant and a jammed one wastes an hour a day.');
console.log('');

// ------------------------------------------------------------------- part 4

console.log('the guard: the happiness ceiling, before and after\n');
console.log('  districts   level   before    after   crime   rubbish');
{
  let worstAfter = 1;
  let worstDrift = 0;
  for (let districts = 1; districts <= MAX_DISTRICTS; districts++) {
    for (let level = 0; level < LEVELS; level++) {
      const s = city(districts, level, 1);
      const after = happinessTarget(s);
      const before = ceilingBefore(s);
      worstAfter = Math.min(worstAfter, after);
      worstDrift = Math.max(worstDrift, Math.abs(after - before));
      if (SIZES.includes(districts) && (level === 0 || level === LEVELS - 1)) {
        console.log(
          `  ${pad(districts, 9)}${pad(level, 8)}${fixed(before, 9, 4)}${fixed(after, 9, 4)}` +
            `${fixed(crime(s), 8, 4)}${fixed(garbage(s), 10, 4)}`,
        );
      }
    }
  }
  console.log('');
  console.log(`  worst ceiling over every district count and level: ${worstAfter.toFixed(4)}`);
  console.log(`  largest before/after difference anywhere:          ${worstDrift.toFixed(6)}`);
  console.log('');
  console.log('  The ceiling does not move, and it cannot: a fully served city has every');
  console.log('  coverage at 1, so the weighted half is 1 whichever weights it is made of —');
  console.log('  and crime and rubbish are both pressure times *uncovered* service, so both');
  console.log('  read exactly zero. What the re-calibration moved is everything *below* the');
  console.log('  ceiling, which is where a game is played.');
  console.log('');
  console.log('  and below it, at 10 districts with half its services:\n');
  console.log('    level   before    after   difference');
  for (let level = 0; level < LEVELS; level++) {
    const s = city(10, level, 0.5);
    const before = ceilingBefore(s);
    const after = happinessTarget(s);
    console.log(
      `    ${pad(level, 5)}${fixed(before, 9, 4)}${fixed(after, 9, 4)}${fixed(after - before, 13, 4)}`,
    );
  }
  console.log('');
  console.log('    A half-served village is happier than it was — it is not failing anybody');
  console.log('    and it has no crime to speak of. A half-served city of towers is less');
  console.log('    happy, because it is crowded, idle and nobody is emptying the bins.');
  console.log('    That is the re-calibration doing what it is for.');
}
console.log('');
console.log(`  garbage mood at full load, uncollected: ${(-GARBAGE_MOOD).toFixed(3)};` +
  ` landmarks give back ${LANDMARK_MOOD.toFixed(3)}; recreation weighs ${RECREATION_WEIGHT.toFixed(2)}`);
console.log(`  a fully collected city reads ${garbageMood(city(10, LEVELS - 1, 1)).toFixed(6)}` +
  `, and its collection is ${garbageCollection(city(10, LEVELS - 1, 1)).toFixed(4)}`);
