import {
  FRONTAGE_TARGET,
  LEVELS,
  LEVEL_FOOTPRINT,
  LEVEL_HOUSING,
  MAX_DISTRICTS,
  MERGE_LEVEL,
  RANKS,
  type CityRank,
} from '../src/sim/config';
import { districtLand, type Zoning } from '../src/sim/layout';
import { cohortOf, type GameState, type LevelCohort } from '../src/sim/state';

/**
 * Test helpers for building states with a known level mix.
 *
 * Every test that used to write `{ homes: 19, tier: 3 }` needs two fields now —
 * the count and the cohort that has to agree with it — and getting them out of
 * step is exactly the bug the invariant tests exist to catch. Writing the pair
 * in one place means no test can introduce it by accident.
 */

/** A cohort with `count` buildings all standing at `level`. */
export function cohort(count: number, level = 0): LevelCohort {
  const levels = cohortOf();
  levels[0] = 0;
  levels[Math.max(0, Math.min(LEVELS - 1, level))] = Math.max(0, count);
  return levels;
}

/**
 * How many parcels a cohort at one level has merged.
 *
 * The third field a level now implies. Every standing building at MERGE_LEVEL
 * or above is one merged parcel, so a state built by hand has to say so or it
 * describes a city whose land accounting disagrees with its skyline — which is
 * exactly what the invariant sweep in cohorts.test.ts refuses.
 */
const mergedFor = (count: number, level: number): number =>
  level >= MERGE_LEVEL ? Math.max(0, count) : 0;

/**
 * The direct replacement for `{ homes: n, tier: l }`.
 *
 * Occupancy is pinned at 1 rather than left at its default, so `residents` is
 * exactly `homes x capacity` and a test asserting a population is asserting the
 * cohort maths rather than the occupancy integrator's resting point.
 */
export const housed = (homes: number, level = 0): Partial<GameState> => ({
  homes,
  homeLevels: cohort(homes, level),
  mergedR: mergedFor(homes, level),
  occupancyR: 1,
});

/**
 * A cohort written level by level, padded to whatever LEVELS is.
 *
 * The literal-array form these replaced — `[8, 12, 0, 0]` — is exactly what
 * acceptance criterion 3 forbids: it says "four levels" in a file that has no
 * business knowing the number, and every one of them had to be found and
 * widened by hand when the ladder grew to five. Anything past the levels the
 * game has is dropped rather than silently making a longer cohort than the
 * simulation can read.
 */
export function mix(...counts: readonly number[]): LevelCohort {
  const levels = cohortOf();
  for (let l = 0; l < LEVELS; l++) levels[l] = Math.max(0, counts[l] ?? 0);
  return levels;
}

/**
 * The same *land*, developed at one level: as many buildings as `plots` holds.
 *
 * The primitive coverage is now measured against, and the one `housed` cannot
 * express. `housed(24, 3)` is 24 arcologies standing on 48 plots — a bigger
 * city, not a taller one — so a test that promotes with it is comparing two
 * different amounts of land and every land-denominated reading moves under it.
 * `housedOn(24, l)` is one district's housing at whatever level, which is what
 * "promoting every building leaves coverage unchanged" is a statement about.
 */
export const housedOn = (plots: number, level = 0): Partial<GameState> => {
  const clamped = Math.max(0, Math.min(LEVELS - 1, level));
  const homes = Math.floor(Math.max(0, plots) / (LEVEL_FOOTPRINT[clamped] ?? 1));
  return housed(homes, clamped);
};

export const trading = (shops: number, level = 0): Partial<GameState> => ({
  shops,
  shopLevels: cohort(shops, level),
  mergedC: mergedFor(shops, level),
  occupancyC: 1,
});

export const making = (industry: number, level = 0): Partial<GameState> => ({
  industry,
  industryLevels: cohort(industry, level),
  mergedI: mergedFor(industry, level),
  occupancyI: 1,
});

/** All three zones at one level, with occupancy pinned. */
export const built = (
  homes: number,
  shops = 0,
  industry = 0,
  level = 0,
): Partial<GameState> => ({
  ...housed(homes, level),
  ...trading(shops, level),
  ...making(industry, level),
});

/**
 * Everything a city can be covered by: happiness near 1, education past every
 * rung of LEVEL_EDUCATION, *and* the grid — so promotion, occupancy and income
 * are gated only on what a test is actually about.
 *
 * Power joined this list rather than getting a helper of its own, because it is
 * the same kind of thing: something a city has to have and no test about the tax
 * rate or the education gate wants to be short of. A browned-out city caps its
 * occupancy at POWER_FLOOR, which holds it under LEVEL_UP_OCCUPANCY forever —
 * so without this every test that expects a city to climb would be measuring
 * the power cap instead.
 *
 * Deliberately far more of each than any land could hold — `migrate` is what
 * clamps a save, and a state built by hand for a test is not one.
 */
export const served = (): Partial<GameState> => ({
  hospitals: 40,
  police: 40,
  fire: 40,
  schools: 40,
  universities: 40,
  hospitalStaff: 1,
  policeStaff: 1,
  fireStaff: 1,
  schoolStaff: 1,
  universityStaff: 1,
  parks: 200,
  ...powered(),
});

/**
 * Enough grid for anything: every plant the map could ever hold, fully staffed.
 *
 * Its own helper as well as part of `served`, because plenty of tests want a
 * city that is *not* covered and is still lit — a test about the housing gate
 * has no business also being a test about the power cap.
 *
 * MAX_DISTRICTS rather than the absurd over-provision every other field here
 * uses, and the difference is upkeep: plants are on the payroll, so two hundred
 * of them is a wage bill no test city could pay, and the arrears would decay
 * the very staffing this helper exists to guarantee. One a district is what the
 * land allows and what a fully built city of megastructures needs — see
 * POWER_EXPONENT — so it is both realistic and sufficient.
 */
export const powered = (): Partial<GameState> => ({
  plants: MAX_DISTRICTS,
  plantStaff: 1,
});

/**
 * A city's zoning at the split every district had before zoning floated.
 *
 * What most tests want: they are about roads, sites, parcels or income, and the
 * split is scenery. `defaultZoning`'s own reasoning applies — every leftover
 * parcel taken by the zone the generator cut it from, which reproduces the old
 * 24 / 45 / 13 cell for cell.
 */
export function zonedAt(districts: number): Zoning {
  const surveyedR: number[] = [];
  const surveyedC: number[] = [];
  const surveyedI: number[] = [];
  for (let i = 0; i < districts; i++) {
    const land = districtLand(i);
    const shopPlots = FRONTAGE_TARGET.commercial - land.floor.shop;
    let shop = 0;
    while (shop < land.limits.shared && (land.sharedBack[shop] as number) < shopPlots) shop++;
    surveyedR.push(land.limits.shared - shop);
    surveyedC.push(shop);
    surveyedI.push(land.limits.works);
  }
  return { districts, surveyedR, surveyedC, surveyedI };
}

/** The same, folded into a partial state — for `{ ...city(9) }` in a fixture. */
export const zoning = (districts: number): Partial<GameState> => {
  const z = zonedAt(districts);
  return {
    districts,
    surveyedR: [...z.surveyedR],
    surveyedC: [...z.surveyedC],
    surveyedI: [...z.surveyedI],
  };
};

/**
 * A city big enough to be the given rank, and no bigger.
 *
 * `cityRank` asks for two things at once — districts *and* the population the
 * housing is built for — so a fixture that only set one of them would sit a
 * rung below where its author thought it did, and the failure would show up as
 * a disabled button in an unrelated test. This states both.
 *
 * The top of the level ladder rather than the bottom, and that is what keeps
 * the fixture land-legal: an arcology holds 2,400 on two plots, so the top rung
 * of the rank ladder is a few hundred plots rather than two hundred thousand —
 * and a state whose housing does not fit its districts is one `migrate` will
 * clamp out from under a round-trip test. What is being fixed is the rank, not
 * the skyline; a test that cares which level the housing is at should say so
 * with `housed` instead.
 */
export function atRank(index: number, districts?: number): Partial<GameState> {
  const rank = RANKS[Math.max(0, Math.min(RANKS.length - 1, index))] as CityRank;
  const homes = Math.ceil(rank.population / (LEVEL_HOUSING[LEVELS - 1] ?? 1));
  return {
    districts: Math.max(rank.districts, districts ?? 0),
    ...(homes > 0 ? housed(homes, LEVELS - 1) : {}),
  };
}
