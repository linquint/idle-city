import { describe, expect, it } from 'vitest';
import { HAPPINESS_FLOOR, SERVICES, TIERS } from '../src/sim/config';
import {
  canBuildHome,
  canBuildService,
  civicBuildings,
  civicCapacity,
  coverage,
  demandTargets,
  happiness,
  homeCapacity,
  income,
  incomeMultiplier,
  residentialPlots,
  residents,
  serviceNeeded,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { CityLayout, RESIDENTIAL_PER_DISTRICT } from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });
const at = (patch: Partial<GameState> = {}): Game => new Game({ ...createState(0), ...patch });
const key = (c: { x: number; z: number }): string => `${c.x},${c.z}`;
const covered = (patch: Partial<GameState> = {}): Partial<GameState> => ({
  schools: 1,
  clinics: 1,
  stations: 1,
  ...patch,
});

describe('coverage', () => {
  it('is nothing at all with nothing built', () => {
    const bare = state({ homes: 10 });
    for (const service of SERVICES) expect(coverage(bare, service)).toBe(0);
    expect(happiness(bare)).toBe(0);
  });

  it('never counts past everybody', () => {
    const overserved = state({ homes: 1, schools: 40, clinics: 40, stations: 40 });
    for (const service of SERVICES) expect(coverage(overserved, service)).toBe(1);
    expect(happiness(overserved)).toBeCloseTo(1, 12);
  });

  it('goes short again when the city rezones under it', () => {
    const before = state({ homes: 30, ...covered() });
    const after = { ...before, tier: 1 };
    expect(happiness(before)).toBeCloseTo(1, 12);
    expect(happiness(after)).toBeLessThan(1);
    expect(serviceNeeded(after, SERVICES[0]!)).toBeGreaterThan(serviceNeeded(before, SERVICES[0]!));
  });
});

describe('the income multiplier', () => {
  /**
   * A neglected city is meant to read as one that has stopped growing, not one
   * that has been fined — so the floor is a floor at every tier and every size.
   */
  it('never drops below the floor', () => {
    for (let tier = 0; tier < TIERS.length; tier++) {
      for (const homes of [0, 1, 12, 43]) {
        for (const civic of [0, 1, 5]) {
          const s = state({ homes, tier, schools: civic, clinics: civic, stations: civic });
          expect(incomeMultiplier(s)).toBeGreaterThanOrEqual(HAPPINESS_FLOOR);
          expect(incomeMultiplier(s)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('is exactly the floor with no services, and 1 with full cover', () => {
    expect(incomeMultiplier(state({ homes: 20 }))).toBeCloseTo(HAPPINESS_FLOOR, 12);
    expect(incomeMultiplier(state({ homes: 20, ...covered() }))).toBeCloseTo(1, 12);
  });

  it('leaves an unhappy city earning, just badly', () => {
    const neglected = state({ homes: 20, shops: 4 });
    expect(income(neglected)).toBeGreaterThan(0);
    expect(income({ ...neglected, ...covered() })).toBeGreaterThan(income(neglected));
  });
});

describe('happiness as a ceiling on demand', () => {
  /**
   * The teaching moment. With no clinic the residential bar simply stops
   * climbing, whatever the job market is doing — and the services block is the
   * only thing on screen that says why.
   */
  it('caps residential demand, with no services and real residents', () => {
    const s = state({ homes: 10, shops: 20, industry: 15 });
    expect(residents(s)).toBeGreaterThan(0);
    expect(happiness(s)).toBe(0);
    // Uncapped, this city is deeply job-rich and would want housing badly.
    expect(demandTargets({ ...s, ...covered({ schools: 9, clinics: 9, stations: 9 }) }).r).toBeGreaterThan(0);
    expect(demandTargets(s).r).toBeLessThanOrEqual(happiness(s));
  });

  it('holds through the simulation, not just in the read', () => {
    const game = at({ homes: 10, shops: 20, industry: 15, cash: 0 });
    for (let i = 0; i < 3000; i++) {
      game.advance(0.1);
      expect(game.state.demandR).toBeLessThanOrEqual(happiness(game.state) + 1e-12);
    }
  });

  it('lifts the ceiling exactly as far as coverage reaches', () => {
    const partial = state({ homes: 10, shops: 20, industry: 15, schools: 1 });
    expect(happiness(partial)).toBeCloseTo(SERVICES[0]!.weight, 12);
    expect(demandTargets(partial).r).toBeCloseTo(SERVICES[0]!.weight, 12);
  });
});

describe('civic land', () => {
  it('comes out of housing, one plot for one plot', () => {
    const bare = state();
    expect(homeCapacity(bare)).toBe(residentialPlots(bare));
    const withCivic = state({ schools: 2, clinics: 1 });
    expect(homeCapacity(withCivic)).toBe(residentialPlots(bare) - 3);
  });

  it('refuses the last plot to whichever asks second', () => {
    const full = state({ homes: RESIDENTIAL_PER_DISTRICT, cash: Infinity });
    expect(civicCapacity(full)).toBe(0);
    for (const service of SERVICES) expect(canBuildService(full, service)).toBe(false);

    const civicFull = state({ schools: RESIDENTIAL_PER_DISTRICT, cash: Infinity });
    expect(homeCapacity(civicFull)).toBe(0);
    expect(canBuildHome(civicFull)).toBe(false);
  });

  it('cannot be spent past the zone by building through it', () => {
    const game = at({ cash: 1e12 });
    for (let i = 0; i < 200; i++) game.buildHome();
    for (let i = 0; i < 200; i++) for (const service of SERVICES) game.buildService(service);
    const s = game.state;
    expect(s.homes + civicBuildings(s)).toBeLessThanOrEqual(residentialPlots(s));
  });

  /**
   * The invariant the front/back allocation exists to make true: housing fills
   * the residential list from the front and services from the back, so the two
   * runs meet in the middle and can never overlap, for any civic count.
   */
  it('never lets a school and a house share a plot', () => {
    for (let districts = 1; districts <= 3; districts++) {
      const layout = new CityLayout().ensure(districts);
      const plots = RESIDENTIAL_PER_DISTRICT * districts;
      for (let civic = 0; civic <= plots; civic++) {
        const s = state({ districts, schools: civic });
        const seen = new Set<string>();
        for (let i = 0; i < homeCapacity(s); i++) seen.add(key(layout.homeCell(i)));
        expect(seen.size).toBe(homeCapacity(s));
        for (let i = 0; i < civic; i++) {
          const cell = key(layout.civicCell(i));
          expect(seen.has(cell)).toBe(false);
          seen.add(cell);
        }
        expect(seen.size).toBe(plots);
      }
    }
  });
});
