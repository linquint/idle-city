import { LEVELS, MERGE_LEVEL } from '../src/sim/config';
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
 * Everything a city can be covered by: happiness near 1 *and* education past
 * every rung of LEVEL_EDUCATION, so promotion is gated only on what a test is
 * actually about.
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
});
