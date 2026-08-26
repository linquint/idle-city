import { describe, expect, it } from 'vitest';
import {
  HAPPINESS_SERVICES,
  LANDMARKS,
  LANDMARK_MOOD,
  MAX_DISTRICTS,
  RECREATION_WEIGHT,
  type Landmark,
} from '../src/sim/config';
import {
  canBuildLandmark,
  happinessTarget,
  homeCapacity,
  housingPlots,
  landmarkBlocker,
  landmarkCost,
  landmarkCount,
  landmarkCoverage,
  landmarkReadings,
  landmarkSiteCapacity,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import {
  LANDMARK_LARGE_SITES_PER_DISTRICT,
  LANDMARK_SMALL_SITES_PER_DISTRICT,
} from '../src/sim/layout';
import { rng } from '../src/core/rng';
import { createState, type GameState } from '../src/sim/state';
import { housedOn, served } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });
const at = (patch: Partial<GameState> = {}): Game => new Game(state(patch));

const MUSEUM = LANDMARKS[0] as Landmark;
const STADIUM = LANDMARKS[1] as Landmark;

/** A city with `districts` districts, every housing plot developed. */
const city = (districts: number, patch: Partial<GameState> = {}): GameState => {
  const bare = state({ districts });
  return state({ ...housedOn(homeCapacity(bare)), districts, ...patch });
};

describe('landmark sites', () => {
  it('gives every district one of each size, and never more', () => {
    for (const districts of [1, 4, 10, MAX_DISTRICTS]) {
      const s = state({ districts });
      expect(landmarkSiteCapacity(s, 'museum')).toBe(districts * LANDMARK_SMALL_SITES_PER_DISTRICT);
      expect(landmarkSiteCapacity(s, 'stadium')).toBe(districts * LANDMARK_LARGE_SITES_PER_DISTRICT);
    }
  });

  it('refuses to build past the land, whatever the treasury says', () => {
    const game = at({ districts: 3, cash: 1e12 });
    for (const landmark of LANDMARKS) {
      for (let i = 0; i < 40; i++) game.buildLandmark(landmark);
      expect(landmarkCount(game.state, landmark.key)).toBe(
        landmarkSiteCapacity(game.state, landmark.key),
      );
      expect(canBuildLandmark(game.state, landmark)).toBe(false);
      expect(landmarkBlocker(game.state, landmark)).toBe('No sites left');
    }
  });

  it('compounds its price, and blocks on land rather than on cash', () => {
    const poor = state({ districts: 9, cash: 0 });
    expect(landmarkCost(poor, MUSEUM)).toBe(MUSEUM.base);
    // Same convention as `serviceBlocker`: the price is on the button and the
    // button is disabled, so the blocker names the thing money cannot fix.
    expect(landmarkBlocker(poor, MUSEUM)).toBeNull();
    expect(canBuildLandmark(poor, MUSEUM)).toBe(false);
    for (let n = 1; n < 9; n++) {
      const s = state({ districts: 9, museums: n });
      expect(landmarkCost(s, MUSEUM)).toBeGreaterThan(landmarkCost({ ...s, museums: n - 1 }, MUSEUM));
    }
    // A stadium is the dear one at every count, which is what the 3x3 costs.
    expect(STADIUM.base).toBeGreaterThan(MUSEUM.base);
  });

  it('reports the same numbers to the panel that the gates use', () => {
    const s = state({ districts: 4, museums: 2, stadiums: 1, cash: 1e9 });
    for (const reading of landmarkReadings(s)) {
      expect(reading.built).toBe(landmarkCount(s, reading.landmark.key));
      expect(reading.allowed).toBe(landmarkSiteCapacity(s, reading.landmark.key));
      expect(reading.cost).toBe(landmarkCost(s, reading.landmark));
    }
  });
});

describe('landmark coverage', () => {
  it('is nothing at all with no landmarks, and nothing with no housing', () => {
    expect(landmarkCoverage(city(4))).toBe(0);
    // The opposite convention to a service coverage, and deliberately: a service
    // coverage is the share it *fails*, so an empty city reads as covered. This
    // is a bonus, and an empty city has not earned it.
    expect(landmarkCoverage(state({ districts: 4, museums: 4, stadiums: 4 }))).toBe(0);
  });

  it('rises with every landmark and never exceeds 1', () => {
    for (const districts of [1, 4, 10]) {
      let last = -1;
      for (let n = 0; n <= districts; n++) {
        const share = landmarkCoverage(city(districts, { museums: n, stadiums: n }));
        expect(share).toBeGreaterThanOrEqual(0);
        expect(share).toBeLessThanOrEqual(1);
        expect(share).toBeGreaterThanOrEqual(last);
        last = share;
      }
    }
  });

  /**
   * The property the whole design rests on. Landmarks are an area-of-effect and
   * the obvious implementation is a per-building modifier — which would mean
   * per-instance state, a save that grows with the city, and the end of
   * "positions derive from counts". Modelling it as a covered *share* keeps the
   * answer a pure function of four counts and the seed.
   */
  it('is identical across a thousand randomised build orders', () => {
    const reference = new Map<string, number>();
    for (let run = 0; run < 1_000; run++) {
      const random = rng(run + 1);
      const game = at({ cash: 1e15, ...served(), happiness: 1 });
      // Interleave annexing, housing and both landmark types in a random order.
      // Whatever order they arrive in, the city they add up to is the same city.
      for (let step = 0; step < 24; step++) {
        const roll = random();
        if (roll < 0.2) game.annex();
        else if (roll < 0.55) game.buildHome();
        else if (roll < 0.8) game.buildLandmark(MUSEUM);
        else game.buildLandmark(STADIUM);
        Object.assign(game.state, { cash: 1e15 });
      }
      const s = game.state;
      const key = `${s.districts}:${s.museums}:${s.stadiums}:${housingPlots(s)}`;
      const share = landmarkCoverage(s);
      const seen = reference.get(key);
      if (seen === undefined) reference.set(key, share);
      else expect(share).toBe(seen);
    }
    // The runs have to actually reach a spread of cities, or this asserts
    // nothing at all.
    expect(reference.size).toBeGreaterThan(5);
  });

  it('does not move when the city climbs a level or merges', () => {
    // Land, not buildings: promoting halves the building count and leaves the
    // plots exactly where they were, so the covered share cannot notice.
    const plots = homeCapacity(state({ districts: 4 }));
    const flat = state({ ...housedOn(plots, 0), districts: 4, museums: 4, stadiums: 2 });
    for (const level of [1, 2, 3, 4]) {
      const climbed = state({ ...housedOn(plots, level), districts: 4, museums: 4, stadiums: 2 });
      expect(housingPlots(climbed)).toBe(housingPlots(flat));
      expect(landmarkCoverage(climbed)).toBe(landmarkCoverage(flat));
    }
  });

  it('answers the same on a repeat read, and notices when a count moves', () => {
    // The memo is keyed on the counts it depends on. A cache that went stale
    // here would freeze happiness at whatever the city looked like first.
    const s = city(6, { museums: 2, stadiums: 1 });
    const first = landmarkCoverage(s);
    expect(landmarkCoverage(s)).toBe(first);
    expect(landmarkCoverage({ ...s, museums: 5 })).not.toBe(first);
    expect(landmarkCoverage(s)).toBe(first);
  });

  it('needs both sizes for the last stretch of the city', () => {
    // Neither type alone gets past the mid-eighties, which is what keeps the
    // cheap one worth buying after the dear one exists. See LANDMARKS.
    for (const districts of [4, 10, 25]) {
      const museums = landmarkCoverage(city(districts, { museums: districts }));
      const stadiums = landmarkCoverage(city(districts, { stadiums: districts }));
      const both = landmarkCoverage(city(districts, { museums: districts, stadiums: districts }));
      expect(museums).toBeLessThan(0.7);
      expect(stadiums).toBeLessThan(0.9);
      expect(both).toBeGreaterThan(stadiums);
      expect(both).toBeGreaterThan(0.85);
    }
  });
});

describe('landmarks and happiness', () => {
  it('is a modifier on earned coverage, not a fifth weight', () => {
    // The four weights still sum to exactly 1. A landmark changes how the city
    // feels about the coverage it has, not what that coverage is worth.
    const weights = HAPPINESS_SERVICES.reduce((sum, s) => sum + s.weight, 0) + RECREATION_WEIGHT;
    expect(weights).toBeCloseTo(1, 12);

    const bare = city(4, { parks: 0 });
    const marked = { ...bare, museums: 4, stadiums: 4 };
    const share = landmarkCoverage(marked);
    expect(share).toBeGreaterThan(0);
    expect(happinessTarget(marked)).toBeCloseTo(
      happinessTarget(bare) + LANDMARK_MOOD * share,
      12,
    );
  });

  it('cannot push a city past 1, and cannot rescue one with no services', () => {
    const covered = city(4, { ...served(), parks: 99, museums: 4, stadiums: 4 });
    expect(happinessTarget(covered)).toBeLessThanOrEqual(1);
    // Worth less than the cheapest service weight, so it is not a way to skip
    // the hospital: a city with nothing but landmarks stays under the housing
    // gate the services exist to open.
    const only = city(4, { parks: 0, museums: 4, stadiums: 4 });
    expect(happinessTarget(only)).toBeLessThan(RECREATION_WEIGHT);
  });

  it('is worth nothing to a city that has already earned 1.00', () => {
    const full = city(4, { ...served(), parks: 99 });
    expect(happinessTarget(full)).toBeCloseTo(1, 12);
    expect(happinessTarget({ ...full, museums: 4, stadiums: 4 })).toBeCloseTo(1, 12);
  });
});
