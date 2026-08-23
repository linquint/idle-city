import { describe, expect, it } from 'vitest';
import {
  DEMAND_TAU,
  HOME_BASE,
  HOME_GROWTH,
  INDUSTRIAL_OUTPUT,
  INDUSTRY_BASE,
  INDUSTRY_GROWTH,
  INDUSTRY_JOBS,
  INDUSTRY_OUTPUT,
  JOBS_PER_COMMERCIAL,
  JOBS_PER_INDUSTRIAL,
  LEVEL_FOOTPRINT,
  LEVELS,
  PRICE_DISCOUNT_MAX,
  PRICE_SURCHARGE_MAX,
  SHOP_BASE,
  SHOP_GROWTH,
  SHOP_JOBS,
  SHOP_SUPPLY,
  SHOP_THROUGHPUT,
  SHOP_TRIPS,
  SUPPLY_DRAW,
  ZONE_LEVEL_NAMES,
} from '../src/sim/config';
import {
  cohortAgainst,
  cohortFootprint,
  demandStep,
  demandTargets,
  effectiveOf,
  homeCost,
  industryCost,
  jobs,
  priceModifier,
  shopCost,
  workers,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { built, housed, making, trading } from './levels';
import { createState, type GameState } from '../src/sim/state';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });
const at = (patch: Partial<GameState> = {}): Game => new Game({ ...createState(0), ...patch });

/** Runs the game forward in normal ticks. */
const play = (game: Game, seconds: number): Game => {
  for (let i = 0; i < seconds * 10; i++) game.advance(0.1);
  return game;
};

describe('the price modifier', () => {
  it('is bounded by its constants, whatever it is handed', () => {
    const inputs = [-Infinity, -1e9, -50, -1, -0.5, 0, 0.5, 1, 50, 1e9, Infinity];
    for (let d = -2; d <= 2; d += 0.01) inputs.push(d);
    for (const d of inputs) {
      expect(priceModifier(d)).toBeGreaterThanOrEqual(1 - PRICE_DISCOUNT_MAX);
      expect(priceModifier(d)).toBeLessThanOrEqual(1 + PRICE_SURCHARGE_MAX);
    }
  });

  it('is exactly 1 at the balance point', () => {
    expect(priceModifier(0)).toBe(1);
  });

  it('hits its bounds only at saturation', () => {
    expect(priceModifier(1)).toBeCloseTo(1 - PRICE_DISCOUNT_MAX, 12);
    expect(priceModifier(-1)).toBeCloseTo(1 + PRICE_SURCHARGE_MAX, 12);
  });
});

describe('cost curves', () => {
  /**
   * The guardrail. The modifier is bounded by a constant, so the discounted
   * curve is still `base * growth ** n * (1 - PRICE_DISCOUNT_MAX)` — exponential
   * in n. If this ever fails, the discount has been allowed to scale with
   * something unbounded and the city builds itself for free.
   */
  it('are strictly increasing in n at maximum discount, for all three types', () => {
    for (let n = 0; n < 300; n++) {
      expect(homeCost(state({ homes: n + 1, demandR: 1 }))).toBeGreaterThan(
        homeCost(state({ homes: n, demandR: 1 })),
      );
      expect(shopCost(state({ shops: n + 1, demandC: 1 }))).toBeGreaterThan(
        shopCost(state({ shops: n, demandC: 1 })),
      );
      expect(industryCost(state({ industry: n + 1, demandI: 1 }))).toBeGreaterThan(
        industryCost(state({ industry: n, demandI: 1 })),
      );
    }
  });

  it('keep the discounted floor an exponential, not a rebate', () => {
    for (const n of [0, 7, 40, 120]) {
      const floor = 1 - PRICE_DISCOUNT_MAX;
      expect(homeCost(state({ homes: n, demandR: 1 }))).toBeCloseTo(
        HOME_BASE * HOME_GROWTH ** n * floor,
        6,
      );
      expect(shopCost(state({ shops: n, demandC: 1 }))).toBeCloseTo(
        SHOP_BASE * SHOP_GROWTH ** n * floor,
        6,
      );
      expect(industryCost(state({ industry: n, demandI: 1 }))).toBeCloseTo(
        INDUSTRY_BASE * INDUSTRY_GROWTH ** n * floor,
        6,
      );
    }
  });

  it('cannot be undercut by a doctored save', () => {
    const honest = homeCost(state({ homes: 20, demandR: 1 }));
    expect(homeCost(state({ homes: 20, demandR: 50 }))).toBe(honest);
    expect(homeCost(state({ homes: 20, demandR: Infinity }))).toBe(honest);
  });
});

describe('smoothing', () => {
  /**
   * The regression this whole file exists for. `d += (target - d) * dt / TAU`
   * overshoots as dt approaches TAU and diverges past it, and catch-up steps
   * whole minutes against a 25-second constant. The exponential form saturates
   * at any step size, which is the only reason offline progress is safe.
   */
  it('lands in the same place at any step size', () => {
    const chase = (target: number, dt: number, total: number): number => {
      let d = 0;
      for (let elapsed = 0; elapsed < total - 1e-9; elapsed += dt) {
        d += (target - d) * demandStep(dt);
      }
      return d;
    };

    for (const target of [0.8, -0.35]) {
      // One hour in one step against one hour in 3600.
      expect(chase(target, 3600, 3600)).toBeCloseTo(chase(target, 1, 3600), 6);
      // And partway to the asymptote, where the two forms differ most.
      const coarse = chase(target, DEMAND_TAU, DEMAND_TAU * 2);
      const fine = chase(target, 0.05, DEMAND_TAU * 2);
      expect(Math.abs(coarse - fine)).toBeLessThan(Math.abs(target) * 0.01);
    }
  });

  it('never closes more than the whole gap', () => {
    for (const dt of [0.1, 1, 25, 60, 1800, 43_200]) {
      expect(demandStep(dt)).toBeGreaterThan(0);
      expect(demandStep(dt)).toBeLessThanOrEqual(1);
    }
  });

  /**
   * The same property through the game itself, so a `Game.step` that stopped
   * using `demandStep` would be caught too: catch-up runs 60-second steps,
   * `advance` runs tenth-of-a-second ticks, and an hour of either has to land
   * on the same city.
   */
  it('gives catch-up and real time the same demand, within 1%', () => {
    const patch = { homes: 24, shops: 6, industry: 3, cash: 0, hospitals: 1, police: 1, fire: 1 };
    const away = at(patch);
    const watched = play(at(patch), 3600);
    away.catchUp(3600);

    for (const key of ['demandR', 'demandC', 'demandI'] as const) {
      const gap = Math.abs(away.state[key] - watched.state[key]);
      expect(gap).toBeLessThanOrEqual(Math.max(0.01, Math.abs(watched.state[key]) * 0.01));
    }
  });
});

describe('the demand signals', () => {
  it('converge toward their targets', () => {
    // Settled first, then perturbed. A target is only a fixed point once the
    // city under it has stopped moving: housing that is still climbing changes
    // the population every few seconds, so a snapshot taken at t=0 is not the
    // thing the integrator is heading for. Every home starts at the top level
    // so nothing can promote, and the run below lets occupancy find its resting
    // point before the signals are knocked off theirs.
    const game = at({
      ...built(24, 6, 3, 3),
      hospitals: 40,
      police: 40,
      fire: 40,
      hospitalStaff: 1,
      policeStaff: 1,
      fireStaff: 1,
      parks: 40,
    });
    play(game, 3_000);
    Object.assign(game.state, { demandR: 0, demandC: 0, demandI: 0 });
    const target = demandTargets(game.state);

    // Stops once the gap is inside a thousandth rather than running a fixed
    // twelve. The target is not actually still: occupancy chases demand and
    // residents feed back into it, so once the signal is that close the target's
    // own drift is the larger of the two movements and a strict monotone check
    // is measuring the feedback loop rather than the integrator. The assertions
    // after the loop are what say it lands.
    let gap = Infinity;
    for (let i = 0; i < 12; i++) {
      play(game, DEMAND_TAU / 2);
      const now =
        Math.abs(game.state.demandR - target.r) +
        Math.abs(game.state.demandC - target.c) +
        Math.abs(game.state.demandI - target.i);
      if (now < 1e-3) break;
      expect(now).toBeLessThan(gap);
      gap = now;
    }
    play(game, DEMAND_TAU * 8);
    expect(game.state.demandR).toBeCloseTo(target.r, 3);
    expect(game.state.demandC).toBeCloseTo(target.c, 3);
    expect(game.state.demandI).toBeCloseTo(target.i, 3);
  });

  it('never leave [-1, 1], however lopsided the city gets', () => {
    // Deliberately absurd shapes: all housing and no jobs, then all jobs and no
    // housing, at the level where the imbalance is largest.
    const shapes: Array<Partial<GameState>> = [
      housed(43, 3),
      built(0, 28, 19),
      { ...built(40, 28, 19, 3), hospitals: 1, police: 1, fire: 1 },
      { ...built(1, 28, 19), districts: 4 },
    ];
    for (const shape of shapes) {
      const game = at({ ...shape, cash: 0 });
      for (let i = 0; i < 200; i++) {
        game.advance(0.1);
        for (const key of ['demandR', 'demandC', 'demandI'] as const) {
          expect(game.state[key]).toBeGreaterThanOrEqual(-1);
          expect(game.state[key]).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('survives a doctored save without ever leaving the band', () => {
    const game = at({ homes: 20, demandR: 5, demandC: -9, demandI: 40 });
    play(game, 5);
    for (const key of ['demandR', 'demandC', 'demandI'] as const) {
      expect(game.state[key]).toBeGreaterThanOrEqual(-1);
      expect(game.state[key]).toBeLessThanOrEqual(1);
    }
  });
});

describe('the cycle', () => {
  /**
   * industry -> jobs -> residents -> shoppers -> commerce -> jobs. Each type
   * has to push its own demand down and at least one other's somewhere, or the
   * loop is three unconnected numbers and the build order stops mattering.
   */
  const settled = (patch: Partial<GameState>): Game =>
    play(
      at({
        // Three districts, because a district only sells 19 housing plots now
        // and these cases have to have room left to build into.
        districts: 3,
        homes: 30,
        shops: 10,
        industry: 5,
        hospitals: 1,
        police: 1,
        fire: 1,
        cash: 1e9,
        ...patch,
      }),
      400,
    );

  const readings = (game: Game): [number, number, number] => [
    game.state.demandR,
    game.state.demandC,
    game.state.demandI,
  ];

  const cases: Array<[string, (game: Game) => void, 0 | 1 | 2]> = [
    ['homes', (game) => { for (let i = 0; i < 5; i++) game.buildHome(); }, 0],
    ['shops', (game) => { for (let i = 0; i < 5; i++) game.buildShop(); }, 1],
    ['industry', (game) => { for (let i = 0; i < 5; i++) game.buildIndustry(); }, 2],
  ];

  /**
   * The lag is the mechanic, and it has to work in both directions. An earlier
   * cut of this clamped residential demand to its own target every tick, which
   * looks harmless and quietly makes that one signal derived rather than
   * integrated — it tracked downward moves instantly and only lagged upward.
   */
  it('eases down as well as up, rather than snapping to the target', () => {
    const game = play(
      at({ districts: 3, homes: 20, shops: 10, industry: 5, hospitals: 1, police: 1, fire: 1, cash: 1e9 }),
      400,
    );
    const before = game.state.demandR;
    for (let i = 0; i < 8; i++) game.buildHome();
    const target = demandTargets(game.state).r;
    expect(target).toBeLessThan(before);

    play(game, 2);
    expect(game.state.demandR).toBeLessThan(before);
    expect(game.state.demandR).toBeGreaterThan(target);
  });

  for (const [name, build, own] of cases) {
    it(`building ${name} cools its own demand and moves another`, () => {
      const control = settled({});
      const changed = settled({});
      build(changed);
      play(control, 40);
      play(changed, 40);

      const before = readings(control);
      const after = readings(changed);
      expect(after[own]).toBeLessThan(before[own]);

      const moved = [0, 1, 2]
        .filter((i) => i !== own)
        .some((i) => Math.abs((after[i] ?? 0) - (before[i] ?? 0)) > 1e-4);
      expect(moved).toBe(true);
    });
  }
});

/**
 * What levels do to commerce and industry.
 *
 * The claim the per-level ladders make: jobs, trips, supply and output are
 * constant *per plot* at every level, so ZONE_SHARE's tier-0 equilibrium
 * 14R = 8C + 20I is the equilibrium at every level rather than only the first.
 * Income is the thing a level moves, and it moves it by LEVEL_SCALE.
 */
describe('commercial and industrial levels', () => {
  const perPlot = (s: GameState, kind: 'shop' | 'industry', ladder: readonly number[]): number =>
    cohortAgainst(kind === 'shop' ? s.shopLevels : s.industryLevels, ladder) /
    cohortFootprint(kind === 'shop' ? s.shopLevels : s.industryLevels);

  it('employ, serve and make the same per plot at every level', () => {
    for (let level = 0; level < LEVELS; level++) {
      const shops = state({ ...trading(8, level), occupancyC: 1 });
      expect(perPlot(shops, 'shop', SHOP_JOBS)).toBeCloseTo(JOBS_PER_COMMERCIAL, 9);
      expect(perPlot(shops, 'shop', SHOP_TRIPS)).toBeCloseTo(SHOP_THROUGHPUT, 9);
      expect(perPlot(shops, 'shop', SHOP_SUPPLY)).toBeCloseTo(SUPPLY_DRAW, 9);

      const works = state({ ...making(6, level), occupancyI: 1 });
      expect(perPlot(works, 'industry', INDUSTRY_JOBS)).toBeCloseTo(JOBS_PER_INDUSTRIAL, 9);
      expect(perPlot(works, 'industry', INDUSTRY_OUTPUT)).toBeCloseTo(INDUSTRIAL_OUTPUT, 9);
    }
  });

  it('leave the labour market where ZONE_SHARE put it, at every level', () => {
    // The zoning budget solves 14 workers a housing plot against 8 jobs a
    // commercial one and 20 an industrial one. Building a district out on that
    // split at each level has to leave the job side of the balance untouched:
    // only the worker side moves, which is the arc WORKING_SHARE describes.
    const split = { r: 48, c: 31, i: 21 };
    let previous = -1;
    for (let level = 0; level < LEVELS; level++) {
      // Plot counts, not building counts: a merged level covers two plots each.
      const plots = LEVEL_FOOTPRINT[level] ?? 1;
      const s = state({
        ...housed(split.r / plots, level),
        ...trading(split.c / plots, level),
        ...making(split.i / plots, level),
        occupancyR: 1,
        occupancyC: 1,
        occupancyI: 1,
      });
      expect(jobs(s)).toBeCloseTo(split.c * JOBS_PER_COMMERCIAL + split.i * JOBS_PER_INDUSTRIAL, 6);
      // And the worker side climbs, which is what carries the city from
      // job-rich to worker-rich rather than pinning it at one or the other.
      expect(workers(s)).toBeGreaterThan(previous);
      previous = workers(s);
    }
  });

  it('raise what a plot earns even though they leave what it employs alone', () => {
    // The other half of the claim: a level has to be worth buying. Per plot,
    // earnings climb the LEVEL_SCALE ladder while jobs sit still.
    let previous = 0;
    for (let level = 0; level < LEVELS; level++) {
      const plots = LEVEL_FOOTPRINT[level] ?? 1;
      const s = state({ ...trading(8 / plots, level), occupancyC: 1 });
      const earned = effectiveOf(s, 'shop') / cohortFootprint(s.shopLevels);
      expect(earned).toBeGreaterThan(previous);
      previous = earned;
    }
  });

  it('names every level of every zone', () => {
    for (const names of Object.values(ZONE_LEVEL_NAMES)) {
      expect(names).toHaveLength(LEVELS);
      for (const name of names) expect(name.length).toBeGreaterThan(0);
    }
  });
});
