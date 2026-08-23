import { LEVELS } from '../src/sim/config';
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
 * The direct replacement for `{ homes: n, tier: l }`.
 *
 * Occupancy is pinned at 1 rather than left at its default, so `residents` is
 * exactly `homes x capacity` and a test asserting a population is asserting the
 * cohort maths rather than the occupancy integrator's resting point.
 */
export const housed = (homes: number, level = 0): Partial<GameState> => ({
  homes,
  homeLevels: cohort(homes, level),
  occupancyR: 1,
});

export const trading = (shops: number, level = 0): Partial<GameState> => ({
  shops,
  shopLevels: cohort(shops, level),
  occupancyC: 1,
});

export const making = (industry: number, level = 0): Partial<GameState> => ({
  industry,
  industryLevels: cohort(industry, level),
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
