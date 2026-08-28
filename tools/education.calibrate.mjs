/**
 * Measures what the industrial term is actually worth to the ledger, so
 * SKILL_YIELD can be set from numbers rather than from a feel. Same contract as
 * the other calibrators: it prints, it does not assert, and what it prints
 * belongs in the config comments.
 *
 * Three questions.
 *
 *   - what share of income the industrial bonus carries, across the whole map
 *     and the whole ladder. A multiplier on a term worth 3% of the ledger is a
 *     different purchase from one on a term worth 30%, and the answer is not
 *     obvious: `bonuses` is `1 + SHOP_BONUS x shops + INDUSTRY_BONUS x industry
 *     + DISTRICT_BONUS x (districts - 1)`, and which of the three dominates
 *     moves with the district count;
 *   - what a candidate SKILL_YIELD is worth against that share, at the coverage
 *     a city can actually reach. Schools and universities pool, so full
 *     coverage is buyable — see LEVEL_EDUCATION — and the endgame reading is
 *     the whole yield rather than a fraction of it;
 *   - whether it overtakes the shop bonus, which is the one bound the brief
 *     names. Commerce is the city's main multiplier and education must not
 *     quietly become a better one.
 *
 *   node tools/education.calibrate.mjs
 */
import {
  DISTRICT_BONUS,
  FRONTAGE_TARGET,
  INDUSTRY_BONUS,
  LEVELS,
  LEVEL_FOOTPRINT,
  MAX_DISTRICTS,
  OCCUPANCY_FULL,
  SERVICES,
  SHOP_BONUS,
  SKILL_YIELD,
} from '../src/sim/config.ts';
import {
  educationCoverage,
  effectiveOf,
  estateEarning,
  income,
  serviceAllowed,
  workforceSkill,
} from '../src/sim/economy.ts';
import { createState } from '../src/sim/state.ts';

const SIZES = [1, 4, 12, 25, MAX_DISTRICTS];
const CANDIDATES = [0.1, 0.2, 0.3, 0.5, 0.8];

const pad = (v, w) => String(v).padStart(w);
const fixed = (v, w, d = 2) => pad(Number(v).toFixed(d), w);
const pct = (v, w, d = 1) => pad(`${(v * 100).toFixed(d)}%`, w);

/**
 * A city of `districts` built out to its own frontage at `level`.
 *
 * Same shape as `builtOut` in tools/power.calibrate.mjs and the traffic one,
 * and built against FRONTAGE_TARGET for the same reason: a state assembled by
 * hand has no surveyor, so what is measured is a finished district rather than
 * whatever split one city happened to survey.
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
  s.depotStaff = 1;
  // Education is the variable, so it is the one type that does not arrive
  // staffed by default.
  s.schoolStaff = 0;
  s.universityStaff = 0;
  Object.assign(s, patch);
  return s;
}

/** The three terms of `bonuses`, so their shares can be compared. */
function split(s) {
  const shops = effectiveOf(s, 'shop');
  const works = effectiveOf(s, 'industry') + estateEarning(s);
  const shop = SHOP_BONUS * shops;
  const industry = INDUSTRY_BONUS * works;
  const district = DISTRICT_BONUS * (s.districts - 1);
  const total = 1 + shop + industry + district;
  return { shop, industry, district, total };
}

console.log(`education as industrial yield, at SKILL_YIELD ${SKILL_YIELD}\n`);

// ------------------------------------------------------------------- part 1

console.log('what the industrial term is worth: its share of the rent bracket\n');
console.log('  districts  level      income/s     shop    works  district      flat');
for (const districts of SIZES) {
  for (let level = 0; level < LEVELS; level++) {
    const s = city(districts, level);
    const b = split(s);
    console.log(
      `  ${pad(districts, 9)}${pad(level, 7)}${pad(income(s).toExponential(2), 14)}` +
        `${pct(b.shop / b.total, 9)}${pct(b.industry / b.total, 9)}` +
        `${pct(b.district / b.total, 10)}${pct(1 / b.total, 10)}`,
    );
  }
}
console.log('');
console.log('  The industrial term is the *second* multiplier, never the first:');
console.log('  commerce outweighs it everywhere, which is what a yield bonus');
console.log('  must not overturn.');
console.log('');

// ------------------------------------------------------------------- part 2

console.log('candidate yields: what full education adds to income\n');
console.log(
  '  yield' + SIZES.map((d) => pad(`${d}d`, 9)).join('') + '    added  works/shop',
);
for (const yieldAt of CANDIDATES) {
  const row = [];
  for (const districts of SIZES) {
    // Read at level 2, the middle of the ladder, where a city spends most of a
    // run. The lift is the industrial term multiplied against the whole bracket.
    const s = city(districts, 2);
    const b = split(s);
    row.push((b.industry * yieldAt) / b.total);
  }
  // The bound the design names, in two readings: what the yield *adds* against
  // the shop term, and — the one that actually matters — whether the industrial
  // term with the skill on it still sits under commerce.
  const s = city(12, 2);
  const b = split(s);
  const added = (b.industry * yieldAt) / b.shop;
  const against = (b.industry * (1 + yieldAt)) / b.shop;
  const mark =
    yieldAt === SKILL_YIELD ? '  <- chosen'
    : against >= 1 ? '  (overtakes commerce)'
    : '';
  console.log(
    `  ${yieldAt.toFixed(2)}` +
      row.map((v) => pct(v, 9)).join('') +
      fixed(added, 9) +
      'x' +
      fixed(against, 11) +
      'x' +
      mark,
  );
}
console.log('');

// ------------------------------------------------------------------- part 3

console.log('the ramp: what the multiplier reads as the schools open\n');
console.log('  staffing   coverage   multiplier    income/s at 12d L2      lift');
{
  const bare = city(12, 2);
  const base = income(bare);
  for (const staff of [0, 0.25, 0.5, 0.75, 1]) {
    const s = city(12, 2, { schoolStaff: staff, universityStaff: staff });
    console.log(
      `  ${fixed(staff, 8)}${pct(educationCoverage(s), 11)}${fixed(workforceSkill(s), 13, 3)}` +
        `${pad(income(s).toExponential(3), 22)}${pct(income(s) / base - 1, 10)}`,
    );
  }
}
console.log('');

console.log('and across the map, at full coverage\n');
console.log('  districts' + Array.from({ length: LEVELS }, (_, l) => pad(`L${l}`, 9)).join(''));
for (const districts of SIZES) {
  const row = [];
  for (let level = 0; level < LEVELS; level++) {
    const bare = city(districts, level);
    const taught = city(districts, level, { schoolStaff: 1, universityStaff: 1 });
    row.push(income(taught) / income(bare) - 1);
  }
  console.log(`  ${pad(districts, 9)}` + row.map((v) => pct(v, 9)).join(''));
}
