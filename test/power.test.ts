import { describe, expect, it } from 'vitest';
import {
  FRONTAGE_TARGET,
  LEVELS,
  LEVEL_CAPACITY,
  LEVEL_UP_OCCUPANCY,
  MAX_DISTRICTS,
  OCCUPANCY_EMPTY,
  OCCUPANCY_FULL,
  POWER_BASE,
  POWER_EXPONENT,
  POWER_FLOOR,
  POWER_PER_PLOT,
} from '../src/sim/config';
import {
  canBuildPlant,
  cityScale,
  income,
  occupancyTarget,
  plantBlocker,
  plantCapacity,
  plantCost,
  population,
  powerCap,
  powerDemand,
  powerRatio,
  powerSupply,
  upkeep,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { migrate } from '../src/sim/save';
import { createState, SAVE_VERSION, type GameState } from '../src/sim/state';
import { built, cohort, housed, housedOn, making, powered, served, trading } from './levels';

/**
 * The grid: the city's second resource, and the first thing in the game that
 * can be short.
 *
 * Most of this file is about the failure mode rather than the feature. A
 * shortfall caps occupancy, occupancy is what fills the houses, and what fills
 * the houses is what pays for the plant — so the loop closes on itself and the
 * only question that really matters is whether it has a fixed point at nothing.
 * It must not, and it must not have one when the wage bill is browning the same
 * plants out at the same time.
 */
const at = (patch: Partial<GameState> = {}): Game => new Game({ ...createState(0), ...patch });
const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

const play = (game: Game, seconds: number): Game => {
  for (let i = 0; i < seconds * 10; i++) game.advance(0.1);
  return game;
};

/** One district's frontage, built out at `level` with `plants` plants. */
const district = (level: number, plants = 0, districts = 1): Partial<GameState> => {
  const foot = level >= 2 ? 2 : 1;
  const fit = (per: number): number => Math.floor((districts * per) / foot);
  return {
    districts,
    ...built(
      fit(FRONTAGE_TARGET.residential),
      fit(FRONTAGE_TARGET.commercial),
      fit(FRONTAGE_TARGET.industrial),
      level,
    ),
    plants,
    plantStaff: plants > 0 ? 1 : 0,
    happiness: 1,
  };
};

describe('the draw', () => {
  it('is a grid connection and nothing else for a city with nothing on it', () => {
    const fresh = createState(0);
    expect(powerDemand(fresh)).toBe(0);
    expect(powerSupply(fresh)).toBe(POWER_BASE);
    // One rather than infinity: a city that draws nothing is not short of
    // anything, and the cap has to leave the opening alone.
    expect(powerRatio(fresh)).toBe(1);
    expect(powerCap(fresh)).toBe(1);
  });

  it('charges each zone its own rate, per plot', () => {
    const homes = state(housed(10));
    const shops = state(trading(10));
    const works = state(making(10));
    expect(powerDemand(homes)).toBeCloseTo(10 * POWER_PER_PLOT.residential, 9);
    expect(powerDemand(shops)).toBeCloseTo(10 * POWER_PER_PLOT.commercial, 9);
    expect(powerDemand(works)).toBeCloseTo(10 * POWER_PER_PLOT.industrial, 9);
    expect(powerDemand(works)).toBeGreaterThan(powerDemand(shops));
    expect(powerDemand(shops)).toBeGreaterThan(powerDemand(homes));
  });

  it('climbs the level ladder faster than the ladder does', () => {
    // The whole point of the exponent: a megastructure holds four arcologies'
    // worth of people and draws more than four arcologies' worth of power.
    const land = 24;
    for (let level = 1; level < LEVELS; level++) {
      const below = powerDemand(state(housedOn(land, level - 1)));
      const here = powerDemand(state(housedOn(land, level)));
      const people =
        (LEVEL_CAPACITY[level] ?? 1) / (LEVEL_CAPACITY[level - 1] ?? 1);
      expect(here / below).toBeGreaterThan(people * 0.999);
    }
    // And exactly the exponent the config states, over the whole ladder.
    const bottom = powerDemand(state(housedOn(land, 0)));
    const top = powerDemand(state(housedOn(land, LEVELS - 1)));
    const span = (LEVEL_CAPACITY[LEVELS - 1] ?? 1) / (LEVEL_CAPACITY[0] ?? 1);
    expect(top / bottom).toBeCloseTo(span ** POWER_EXPONENT, 6);
  });

  it('is charged on what is standing, not on who is in', () => {
    // The load-bearing choice. If draw fell with occupancy a brownout would
    // cure itself and there would be no decision in it.
    const full = state({ ...housed(20), occupancyR: 1 });
    const empty = state({ ...housed(20), occupancyR: 0.1 });
    expect(powerDemand(empty)).toBe(powerDemand(full));
    // A ruin is different: it holds no level, so it is in no cohort and draws
    // nothing. A boarded-up house is not on the grid.
    const ruined = state({ homes: 20, abandonedR: 8, homeLevels: cohort(12), occupancyR: 1 });
    expect(powerDemand(ruined)).toBeCloseTo(12 * POWER_PER_PLOT.residential, 9);
  });

  it('counts the estates, which are works on somebody else\'s land', () => {
    const bare = state({ ...making(10), highway: true });
    const band = state({ ...making(10), highway: true, estates: 3 });
    expect(powerDemand(band)).toBeGreaterThan(powerDemand(bare));
  });
});

describe('the supply', () => {
  it('is built to the standard of the city around it', () => {
    // A plant has no level of its own to climb, so it is built to whatever the
    // city is built to — the same argument the estates make about `industryScale`.
    const low = state({ ...district(0, 1) });
    const high = state({ ...district(LEVELS - 1, 1) });
    expect(cityScale(high)).toBeGreaterThan(cityScale(low));
    expect(powerSupply(high) - POWER_BASE).toBeCloseTo(
      (powerSupply(low) - POWER_BASE) * (cityScale(high) / cityScale(low)),
      6,
    );
  });

  it('ramps in like a payroll rather than arriving whole', () => {
    const game = at({ ...district(1), cash: 1e9 });
    const before = powerSupply(game.state);
    expect(game.buildPlant()).toBe(true);
    // The instant it lands it is carrying nothing at all.
    expect(powerSupply(game.state)).toBe(before);
    play(game, 300);
    expect(game.state.plantStaff).toBeGreaterThan(0.9);
    expect(powerSupply(game.state)).toBeGreaterThan(before);
  });

  it('is bounded by one square a district', () => {
    const s = state({ districts: 4, cash: 1e12 });
    expect(plantCapacity(s)).toBe(4);
    const game = at({ districts: 4, cash: 1e12 });
    for (let i = 0; i < 4; i++) expect(game.buildPlant()).toBe(true);
    expect(game.buildPlant()).toBe(false);
    expect(plantBlocker(game.state)).toBe('No sites left');
    expect(canBuildPlant(game.state)).toBe(false);
  });
});

describe('what the land can carry', () => {
  /**
   * The measurement that sets POWER_EXPONENT, as an assertion.
   *
   * A district reserves exactly one square for a plant, so the exponent is only
   * viable if one plant still carries a district built out at the top of the
   * ladder. At 1.30 it does not — see the table in the config — and this is what
   * would catch a later change to the ladder, the per-plot rates or the plant's
   * output that quietly made the top of the skyline unreachable.
   */
  it('powers a fully built city at every rung, with room to spare', () => {
    for (const districts of [1, 12, MAX_DISTRICTS]) {
      for (let level = 0; level < LEVELS; level++) {
        const s = state(district(level, districts, districts));
        expect(powerRatio(s)).toBeGreaterThan(1);
        expect(powerCap(s)).toBe(1);
      }
    }
    // And the tightest case is the top of the ladder on a full map, which is
    // what the 22% of headroom in the config comment is a statement about.
    const full = state(district(LEVELS - 1, MAX_DISTRICTS, MAX_DISTRICTS));
    expect(powerRatio(full)).toBeGreaterThan(1.2);
    expect(powerRatio(full)).toBeLessThan(1.5);
  });

  it('leaves the opening on the grid alone', () => {
    // POWER_BASE has to cover a district at level 0 outright, or a fresh city is
    // short of a resource it has no way to make yet and the opening is a
    // brownout nobody caused.
    expect(powerRatio(state(district(0)))).toBeGreaterThan(1);
    // And it has to be outgrown, or the resource would never once be short.
    expect(powerRatio(state(district(1)))).toBeLessThan(1);
  });
});

describe('the cap', () => {
  it('is proportional below one and nothing above it', () => {
    const short = state({ ...district(LEVELS - 1), plants: 0 });
    expect(powerRatio(short)).toBeLessThan(1);
    expect(powerCap(short)).toBeCloseTo(
      POWER_FLOOR + (1 - POWER_FLOOR) * powerRatio(short),
      9,
    );
    const spare = state(district(0, 1));
    expect(powerRatio(spare)).toBeGreaterThan(1);
    expect(powerCap(spare)).toBe(1);
  });

  it('costs residents and never buildings', () => {
    // The derivation POWER_FLOOR is set by: a blacked-out but otherwise happy
    // city has to settle *above* OCCUPANCY_EMPTY, or a brownout starts the
    // vacancy clock and the failure stops being reversible.
    expect(OCCUPANCY_FULL * POWER_FLOOR).toBeGreaterThan(OCCUPANCY_EMPTY);
    const dark = state({
      ...district(LEVELS - 1, 0, 12),
      happiness: 1,
      demandR: 0,
    });
    expect(powerRatio(dark)).toBeLessThan(0.05);
    expect(occupancyTarget(dark, 'home')).toBeGreaterThan(OCCUPANCY_EMPTY);
  });

  it('applies to every zone, because a shop with no power does not trade', () => {
    const lit = state({ ...district(LEVELS - 1, 12, 12), happiness: 1 });
    const dark = { ...lit, plants: 0, plantStaff: 0 };
    for (const kind of ['home', 'shop', 'industry'] as const) {
      expect(occupancyTarget(dark, kind)).toBeLessThan(occupancyTarget(lit, kind));
    }
  });

  it('holds the city under the promotion gate rather than stopping it dead', () => {
    // The consequence a player actually meets: a city that ignores power stops
    // climbing. Same shape as the happiness gate — something the city can
    // suddenly not do, with the reason on screen and the fix one purchase away.
    const game = at({ ...district(1, 0, 4), ...served(), plants: 0, plantStaff: 0, cash: 0 });
    // `served` lights the city, and this test is about what happens when it is
    // not lit — so the grid is taken back out after the rest of the coverage
    // has been handed over.
    expect(game.state.plants).toBe(0);

    // Settled before it is measured. `built` opens at full occupancy and the
    // integrator takes OCCUPANCY_TAU to answer, so a city snapshotted at t=0
    // promotes for the first few minutes on an occupancy the cap has not caught
    // up with yet. What the gate is a statement about is where it *settles*.
    play(game, 900);
    expect(powerRatio(game.state)).toBeLessThan(1);
    expect(game.state.occupancyR).toBeLessThan(LEVEL_UP_OCCUPANCY);
    const dark = cityScale(game.state);
    play(game, 3_600);
    expect(cityScale(game.state)).toBeCloseTo(dark, 9);

    // Lit, and it climbs again.
    Object.assign(game.state, powered());
    play(game, 1_800);
    expect(game.state.occupancyR).toBeGreaterThan(LEVEL_UP_OCCUPANCY);
    expect(cityScale(game.state)).toBeGreaterThan(dark);
  });
});

describe('the death spiral', () => {
  /**
   * The failure the whole feature has to not have. Less power caps occupancy,
   * which loses residents, which loses income, which is what a plant is bought
   * with. Every one of these runs the loop and asks whether it bottoms out.
   */
  const blackout = (patch: Partial<GameState> = {}): Game =>
    at({ ...district(LEVELS - 1, 0, 12), cash: 0, plants: 0, plantStaff: 0, ...patch });

  it('leaves a blacked-out city earning', () => {
    const game = blackout();
    expect(powerRatio(game.state)).toBeLessThan(0.05);
    play(game, 600);
    expect(income(game.state)).toBeGreaterThan(0);
    expect(population(game.state)).toBeGreaterThan(0);
  });

  it('lets it buy its way back out', () => {
    const game = blackout();
    const marks: number[] = [];
    for (let hour = 0; hour < 3; hour++) {
      play(game, 3_600);
      marks.push(game.state.cash);
    }
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i] as number).toBeGreaterThan(marks[i - 1] as number);
    }
    expect(game.state.cash).toBeGreaterThan(plantCost(game.state));
  });

  it('recovers when the plants go in', () => {
    const game = blackout({ cash: 1e12 });
    play(game, 600);
    const dark = game.state.occupancyR;
    while (game.buildPlant());
    expect(game.state.plants).toBe(plantCapacity(game.state));
    play(game, 1_800);
    expect(powerRatio(game.state)).toBeGreaterThan(1);
    expect(game.state.occupancyR).toBeGreaterThan(dark);
  });

  it('survives the wage bill browning out the plants at the same time', () => {
    // The one place two of this cycle's features touch. Plants are on the
    // payroll, so arrears decay `plantStaff`, which cuts supply, which caps
    // occupancy, which cuts the income the wages come out of. Both ends are
    // bounded — POWER_FLOOR holds occupancy at a third and UPKEEP_KEEP_SHARE
    // keeps the treasury growing — and this is the pair run together.
    const game = at({
      ...district(LEVELS - 1, 12, 12),
      universities: 40,
      universityStaff: 1,
      cash: 0,
      happiness: 1,
    });
    const marks: number[] = [];
    for (let hour = 0; hour < 4; hour++) {
      play(game, 3_600);
      marks.push(game.state.cash);
    }
    expect(game.state.cash).toBeGreaterThan(0);
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i] as number).toBeGreaterThan(marks[i - 1] as number);
    }
    expect(game.state.plantStaff).toBeGreaterThan(0);
    expect(powerCap(game.state)).toBeGreaterThanOrEqual(POWER_FLOOR);
    expect(Number.isFinite(game.state.cash)).toBe(true);
  });

  it('does not compound across a twelve-hour absence', () => {
    const game = blackout();
    const report = game.catchUp(12 * 3_600);
    expect(Number.isFinite(game.state.cash)).toBe(true);
    expect(game.state.cash).toBeGreaterThan(0);
    expect(game.state.occupancyR).toBeGreaterThan(0);
    expect(report.earned).toBeGreaterThan(0);
  });
});

describe('the away pass', () => {
  it('buys a plant when the grid is short', () => {
    // Anything that can compound while away needs the same treatment, and a
    // city left developing itself into a brownout would come back emptier than
    // it was left with nothing on screen to say why.
    const game = at({
      ...district(1, 0, 4),
      ...served(),
      plants: 0,
      plantStaff: 0,
      cash: 1e6,
      autoDevelop: true,
      cityHall: true,
    });
    expect(powerRatio(game.state)).toBeLessThan(1);
    const report = game.catchUp(3_600);
    expect(report.plants).toBeGreaterThan(0);
    expect(powerRatio(game.state)).toBeGreaterThanOrEqual(1);
  });

  it('leaves the plants of a lit city alone', () => {
    const game = at({
      ...district(0, 4, 4),
      ...served(),
      cash: 1e6,
      autoDevelop: true,
      cityHall: true,
    });
    const before = game.state.plants;
    game.catchUp(600);
    expect(game.state.plants).toBe(before);
  });
});

describe('plants on the payroll', () => {
  it('join the wage bill and can be browned out by it', () => {
    const bare = state({ ...district(1), plants: 0, plantStaff: 0 });
    const lit = state({ ...district(1, 1) });
    expect(upkeep(lit)).toBeGreaterThan(upkeep(bare));
    // Staffing is a factor on both sides, so an unpaid payroll is both a cheaper
    // bill and a smaller grid — which is what makes the two features interact
    // rather than merely coexist.
    const half = { ...lit, plantStaff: 0.5 };
    expect(upkeep(half)).toBeLessThan(upkeep(lit));
    expect(powerSupply(half)).toBeLessThan(powerSupply(lit));
  });
});

describe('a plant across a save', () => {
  it('carries what was built, and clamps it to the squares the city owns', () => {
    const carried = migrate({ version: SAVE_VERSION, districts: 3, plants: 2, plantStaff: 0.5 });
    expect(carried?.plants).toBe(2);
    expect(carried?.plantStaff).toBe(0.5);
    // One square a district, so a save carried over from a larger city sheds
    // the plants whose ground it no longer owns.
    expect(migrate({ version: SAVE_VERSION, districts: 2, plants: 40 })?.plants).toBe(2);
  });

  it('opens an older save on the grid rather than in the dark', () => {
    // Power arrived with v9, so a v8 city has no plants — and POWER_BASE is what
    // stops that reading as a blackout the instant it loads. A small city is
    // covered outright; a big one is not, which is the same shortfall it would
    // have met by playing forward and is fixed the same way.
    const small = migrate({ version: 8, homes: 12, homeLevels: [12, 0, 0, 0, 0] });
    expect(small?.plants).toBe(0);
    expect(powerRatio(small as GameState)).toBeGreaterThan(1);
  });
});
