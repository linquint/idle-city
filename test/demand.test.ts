import { describe, expect, it } from 'vitest';
import {
  DEMAND_TAU,
  HOME_BASE,
  HOME_GROWTH,
  INDUSTRY_BASE,
  INDUSTRY_GROWTH,
  PRICE_DISCOUNT_MAX,
  PRICE_SURCHARGE_MAX,
  SHOP_BASE,
  SHOP_GROWTH,
} from '../src/sim/config';
import {
  demandStep,
  demandTargets,
  homeCost,
  industryCost,
  priceModifier,
  shopCost,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
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
    const game = at({ homes: 24, shops: 6, industry: 3, hospitals: 1, police: 1, fire: 1 });
    const target = demandTargets(game.state);

    let gap = Infinity;
    for (let i = 0; i < 12; i++) {
      play(game, DEMAND_TAU / 2);
      const now =
        Math.abs(game.state.demandR - target.r) +
        Math.abs(game.state.demandC - target.c) +
        Math.abs(game.state.demandI - target.i);
      expect(now).toBeLessThan(gap);
      gap = now;
    }
    play(game, DEMAND_TAU * 8);
    expect(game.state.demandR).toBeCloseTo(target.r, 5);
    expect(game.state.demandC).toBeCloseTo(target.c, 5);
    expect(game.state.demandI).toBeCloseTo(target.i, 5);
  });

  it('never leave [-1, 1], however lopsided the city gets', () => {
    // Deliberately absurd shapes: all housing and no jobs, then all jobs and no
    // housing, at the tier where the imbalance is largest.
    const shapes: Array<Partial<GameState>> = [
      { homes: 43, tier: 3 },
      { shops: 28, industry: 19 },
      { homes: 40, shops: 28, industry: 19, tier: 3, hospitals: 1, police: 1, fire: 1 },
      { homes: 1, shops: 28, industry: 19, districts: 4 },
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
