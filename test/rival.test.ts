import { describe, expect, it } from 'vitest';
import {
  CATCHUP_STEP_SECONDS,
  DEMAND_TERMS,
  GOODS_TRADE_ANSWER,
  GOODS_TRADE_LIFT,
  HIGHWAY_MIN_DISTRICTS,
  LEVELS,
  MAX_DISTRICTS,
  POWER_EXPORT_CAP,
  POWER_TRADES,
  POWER_TRADE_NEUTRAL,
  RIVAL_MATCH_DISTRICTS,
  RANK_GATES,
  RIVAL_SETTLE_SECONDS,
  type PowerTrade,
} from '../src/sim/config';
import {
  cityRank,
  demandLift,
  demandTargets,
  exportMarket,
  goodsTraded,
  income,
  netIncome,
  ownPowerSupply,
  powerDemand,
  powerImported,
  powerRatio,
  powerSupply,
  powerSurplus,
  powerTradeCost,
  powerTradeIncome,
  powerTradeStep,
  priceModifier,
  rivalDemand,
  rivalStrength,
  tradeUpkeep,
  upkeep,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { migrate } from '../src/sim/save';
import { createState, SAVE_VERSION, type GameState } from '../src/sim/state';
import { atFrontage, built, powered, served } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/** A city with something to trade, a hall to sign with, and an hour behind it. */
const city = (patch: Partial<GameState> = {}): GameState =>
  state({
    districts: 4,
    ...built(40, 20, 8, 1),
    ...served(),
    cityHall: true,
    elapsed: 3_600,
    happiness: 0.9,
    ...patch,
  });

describe('the city next door', () => {
  it('arrives rather than appearing', () => {
    // Nothing at the moment the city is founded, and no step anywhere: the
    // shape is a saturation, so there is no tick at which the rival suddenly
    // is one.
    expect(rivalStrength(city({ elapsed: 0 }))).toBe(0);
    let last = -1;
    for (const elapsed of [0, 60, 300, RIVAL_SETTLE_SECONDS, 7_200, 86_400]) {
      const now = rivalStrength(city({ elapsed }));
      expect(now).toBeGreaterThan(last);
      expect(now).toBeLessThanOrEqual(1);
      last = now;
    }
    // Half established at RIVAL_SETTLE_SECONDS, by construction of age/(1+age).
    // At one district, because the other factor is already eating into it by
    // four — which is the next test.
    expect(rivalStrength(city({ districts: 1, elapsed: RIVAL_SETTLE_SECONDS }))).toBeCloseTo(0.5, 9);
  });

  it('is outgrown, which is what makes it a feature and not a tax', () => {
    const old = { elapsed: 86_400, goodsTrade: false };
    let last = Infinity;
    for (let districts = 1; districts <= RIVAL_MATCH_DISTRICTS; districts++) {
      const now = rivalStrength(city({ ...old, districts }));
      expect(now).toBeLessThanOrEqual(last);
      last = now;
    }
    expect(rivalStrength(city({ ...old, districts: RIVAL_MATCH_DISTRICTS }))).toBe(0);
    // And it stays gone: a conurbation does not re-acquire a rival by growing.
    expect(rivalStrength(city({ ...old, districts: MAX_DISTRICTS }))).toBe(0);
    expect(RIVAL_MATCH_DISTRICTS).toBe(HIGHWAY_MIN_DISTRICTS);
  });

  it('takes from trade and industry, never from housing', () => {
    const s = city({ elapsed: 86_400, districts: 1 });
    expect(rivalDemand(s, 'home')).toBe(0);
    expect(rivalDemand(s, 'shop')).toBeLessThan(0);
    expect(rivalDemand(s, 'industry')).toBeLessThan(0);
    // Industry takes more of it: a works sells to whoever will buy and a shop
    // sells to the people standing in front of it.
    expect(rivalDemand(s, 'industry')).toBeLessThan(rivalDemand(s, 'shop'));
  });

  it('moves the two targets by exactly what the table says', () => {
    // The same city on its first second and a day later. `elapsed` is the only
    // input that differs and the rival is the only term that reads it, so the
    // whole of the difference is the rival — which is what makes this an
    // assertion about the table rather than about the fixture.
    const young = city({ elapsed: 0, districts: 1 });
    const settled = { ...young, elapsed: 86_400 };
    for (const zone of ['shop', 'industry'] as const) {
      expect(demandLift(settled, zone) - demandLift(young, zone)).toBeCloseTo(
        rivalDemand(settled, zone),
        9,
      );
    }
    expect(demandLift(settled, 'home')).toBeCloseTo(demandLift(young, 'home'), 9);
    // And it reaches the targets themselves, which is the thing the player
    // feels. Housing does not move at all.
    const before = demandTargets(young);
    const after = demandTargets(settled);
    expect(after.c - before.c).toBeCloseTo(rivalDemand(settled, 'shop'), 6);
    expect(after.i - before.i).toBeCloseTo(rivalDemand(settled, 'industry'), 6);
    expect(after.r).toBeCloseTo(before.r, 9);
  });

  it('is in DEMAND_TERMS, so the HUD names it without a case of its own', () => {
    const rows = DEMAND_TERMS.filter((term) => term.key === 'rival');
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.zone).sort()).toEqual(['industry', 'shop']);
    for (const row of rows) {
      expect(row.weight).toBeLessThan(0);
      // Read from zero like the tax pressure, not centred like a coverage.
      expect(row.centred).toBe(false);
      expect(row.label).toBe('Rival city');
    }
  });

  it('never costs the surcharge a pinned signal would have', () => {
    // The trap the whole sizing is against: `priceModifier` is asymmetric, so a
    // rival that pinned a signal would not slow the city, it would make what it
    // pins 60% dearer forever. Worst case across the whole signal range.
    const s = city({ elapsed: 86_400, districts: 1 });
    let worst = 0;
    for (let base = -1; base <= 1; base += 0.05) {
      for (const zone of ['shop', 'industry'] as const) {
        const with_ = priceModifier(base + rivalDemand(s, zone));
        worst = Math.max(worst, with_ / priceModifier(base) - 1);
      }
    }
    expect(worst).toBeLessThan(0.15);
    // Against the surcharge a pinned signal would have carried, which is the
    // number the sizing is against. Negative is the dear end: `priceModifier`
    // is 1 + PRICE_SURCHARGE_MAX below zero and 1 - PRICE_DISCOUNT_MAX above.
    expect(priceModifier(-1) / priceModifier(0) - 1).toBeGreaterThan(0.5);
  });

  it('reads the same after a catch-up as it does watched', () => {
    // The property the whole derived-rather-than-stored decision buys: both
    // inputs only rise, so four CATCHUP_STEP_SECONDS steps land exactly where
    // four minutes of watched ticks do. `advance` clamps at a quarter of a
    // second a call, so the watched half is driven a frame at a time.
    const seconds = CATCHUP_STEP_SECONDS * 4;
    const watched = new Game(city({ elapsed: 0 }));
    const away = new Game(city({ elapsed: 0 }));
    for (let i = 0; i < seconds * 20; i++) watched.advance(0.05);
    away.catchUp(seconds);
    expect(away.state.elapsed).toBeCloseTo(watched.state.elapsed, 6);
    expect(rivalStrength(away.state)).toBeCloseTo(rivalStrength(watched.state), 9);
    // And it is a pure function of the two counts, which is what says it is not
    // an integrator wearing a getter's clothes.
    expect(rivalStrength(state({ elapsed: 5_000, districts: 3 }))).toBe(
      rivalStrength(state({ elapsed: 5_000, districts: 3, cash: 1e9, happiness: 0.1 })),
    );
  });
});

describe('the goods agreement', () => {
  it('needs somebody to sign it', () => {
    const hall = city({ goodsTrade: true, cityHall: false });
    expect(goodsTraded(hall)).toBe(false);
    expect(tradeUpkeep(hall)).toBe(0);
    // The stored choice survives, exactly as `freeTransport` does: a setting
    // made under a hall the save no longer has is not thrown away.
    expect(hall.goodsTrade).toBe(true);
    expect(goodsTraded({ ...hall, cityHall: true })).toBe(true);
  });

  it('refuses to be signed without a hall, and signs with one', () => {
    const game = new Game(city({ cityHall: false }));
    game.setGoodsTrade(true);
    expect(game.state.goodsTrade).toBe(false);
    const signed = new Game(city());
    signed.setGoodsTrade(true);
    expect(signed.state.goodsTrade).toBe(true);
    signed.setGoodsTrade(false);
    expect(signed.state.goodsTrade).toBe(false);
  });

  it('lifts the export tap in the same bracket the berths do', () => {
    const off = city({ goodsTrade: false });
    const on = { ...off, goodsTrade: true };
    expect(exportMarket(on) / exportMarket(off) - 1).toBeCloseTo(GOODS_TRADE_LIFT, 9);
    // Additive, so a city with cargo berths gets one tap raised twice rather
    // than the treaty multiplying what the berths already did.
    const berths = { ...off, cargoTerminals: 2 };
    expect(exportMarket({ ...berths, goodsTrade: true }) - exportMarket(berths)).toBeCloseTo(
      exportMarket(on) - exportMarket(off),
      6,
    );
  });

  it('answers most of the rival but not all of it', () => {
    const off = city({ elapsed: 86_400, districts: 1, goodsTrade: false });
    const on = { ...off, goodsTrade: true };
    expect(rivalStrength(on)).toBeCloseTo(rivalStrength(off) * (1 - GOODS_TRADE_ANSWER), 9);
    expect(rivalStrength(on)).toBeGreaterThan(0);
  });

  it('is paid for out of the ledger, at the same share at every size', () => {
    const shares = [1, 10, 25].map((districts) => {
      const s = city({ districts, goodsTrade: true, ...built(40 * districts, 20 * districts, 8 * districts, 1) });
      return tradeUpkeep(s) / income(s);
    });
    // A flat fee would be a decision for the first hour and a rounding error
    // after it. Within a tenth of a point across a 25x span.
    for (const share of shares) expect(share).toBeCloseTo(shares[0] as number, 3);
    expect(shares[0] as number).toBeGreaterThan(0);
    expect(shares[0] as number).toBeLessThan(0.1);
  });

  it('joins the wage bill, and is paid before it is earned', () => {
    const off = city({ goodsTrade: false });
    const on = { ...off, goodsTrade: true };
    expect(upkeep(on) - upkeep(off)).toBeCloseTo(tradeUpkeep(on), 6);
    // The honest shape of the trade, and it is worth an assertion because it is
    // the one a reader would get backwards: `exportMarket` feeds industrial
    // *demand* and nothing else, exactly as CARGO_EXPORT_LIFT does. So the
    // treaty adds nothing to `income` on the tick it is signed and takes the
    // fee immediately — a city signs it to grow into, not to cash.
    expect(income(on)).toBeCloseTo(income(off), 9);
    expect(netIncome(on)).toBeLessThan(netIncome(off));
    // What it buys is the target, and through it the price of breaking ground.
    expect(demandTargets(on).i).toBeGreaterThan(demandTargets(off).i);
    expect(priceModifier(demandTargets(on).i)).toBeLessThan(priceModifier(demandTargets(off).i));
  });
});

describe('the power agreement', () => {
  const traded = (i: number): PowerTrade => POWER_TRADES[i] as PowerTrade;

  it('starts off, and stays off without a hall', () => {
    expect(createState(0).powerTrade).toBe(POWER_TRADE_NEUTRAL);
    expect(traded(POWER_TRADE_NEUTRAL).imports).toBe(0);
    expect(traded(POWER_TRADE_NEUTRAL).sells).toBe(0);
    const s = city({ powerTrade: 1, cityHall: false });
    expect(powerTradeStep(s)).toBe(traded(POWER_TRADE_NEUTRAL));
    expect(powerImported(s)).toBe(0);
    expect(powerTradeCost(s)).toBe(0);
  });

  it('clamps rather than trusting the index', () => {
    const game = new Game(city());
    game.setPowerTrade(99);
    expect(game.state.powerTrade).toBe(POWER_TRADES.length - 1);
    game.setPowerTrade(-4);
    expect(game.state.powerTrade).toBe(0);
    game.setPowerTrade(1.9);
    expect(game.state.powerTrade).toBe(1);
  });

  it('buys a share of the draw rather than a fixed block', () => {
    const small = city({ districts: 1, ...built(10, 5, 2, 0), ...powered(), powerTrade: 1 });
    const big = city({ districts: 25, ...built(250, 120, 50, 3), ...powered(), powerTrade: 1 });
    for (const s of [small, big]) {
      expect(powerImported(s)).toBeCloseTo(traded(1).imports * powerDemand(s), 6);
      expect(powerTradeCost(s)).toBeCloseTo(traded(1).price * powerImported(s), 6);
    }
    // Which is the whole reason it is a share: a fixed block would be the whole
    // grid at one district and a rounding error at twenty-five.
    expect(powerImported(big)).toBeGreaterThan(powerImported(small));
  });

  it('is the answer to a brownout the city cannot build out of', () => {
    // Two plants against a city that needs far more, so the ratio is short.
    const dark = city({ districts: 10, ...built(400, 200, 80, 4), plants: 2, plantStaff: 1 });
    expect(powerRatio(dark)).toBeLessThan(1);
    const lit = { ...dark, powerTrade: 1 };
    expect(powerSupply(lit)).toBeCloseTo(powerSupply(dark) + powerImported(lit), 6);
    expect(powerRatio(lit)).toBeGreaterThan(powerRatio(dark));
    // And it costs every second it is on, which is the trade.
    expect(upkeep(lit) - upkeep(dark)).toBeCloseTo(powerTradeCost(lit), 6);
  });

  it('sells only what the city actually has spare, and never what it bought', () => {
    const dark = city({ districts: 10, ...built(400, 200, 80, 4), plants: 2, plantStaff: 1 });
    // Exporting in a brownout is inert rather than harmful.
    const selling = { ...dark, powerTrade: 2 };
    expect(powerSurplus(selling)).toBe(0);
    expect(powerTradeIncome(selling)).toBe(0);
    // And importing never creates a surplus to sell back — a money printer is
    // the one shape the two halves must not make together.
    const buying = { ...dark, powerTrade: 1 };
    expect(powerSurplus(buying)).toBe(0);
    const spare = city({ ...powered(), powerTrade: 2 });
    expect(powerSurplus(spare)).toBeGreaterThan(0);
    expect(powerTradeIncome(spare)).toBeCloseTo(traded(2).sells * powerSurplus(spare), 6);
  });

  it('caps the surplus at a share of the draw, so it cannot be arbitrage', () => {
    // A small city with a plant makes many times what it draws — POWER_BASE is
    // a floor under the grid and the draw is not. Uncapped, selling that was
    // several ledgers. See POWER_EXPORT_CAP.
    const spare = city({ districts: 1, ...built(8, 4, 1, 0), plants: 1, plantStaff: 1, powerTrade: 2 });
    const loose = ownPowerSupply(spare) - powerDemand(spare);
    expect(loose).toBeGreaterThan(powerDemand(spare) * 10);
    expect(powerSurplus(spare)).toBeCloseTo(POWER_EXPORT_CAP * powerDemand(spare), 6);
    expect(powerSurplus(spare) / loose).toBeLessThan(0.05);
  });

  it('is worth about a tenth of the ledger to any city that could sign it', () => {
    // The cap is only half the guard, and the smaller half — the rank gate is
    // the rest of it. A city rich in spare power is a *village*, and a village
    // has no hall to sign with. Swept over the whole map at the shape that
    // makes the most spare: full frontage, one plant a district.
    let worst = 0;
    for (let districts = 1; districts <= MAX_DISTRICTS; districts++) {
      for (let level = 0; level < LEVELS; level++) {
        const s = atFrontage(districts, level, { plants: districts, plantStaff: 1, powerTrade: 2, cityHall: true });
        if (cityRank(s).index < RANK_GATES.cityHall) continue;
        worst = Math.max(worst, powerTradeIncome(s) / income(s));
      }
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThan(0.12);
  });

  it('earns outside the rent bracket, and is switched off by the hall going', () => {
    const off = city({ ...powered(), powerTrade: 0 });
    const on = { ...off, powerTrade: 2 };
    expect(income(on) - income(off)).toBeCloseTo(powerTradeIncome(on), 6);
    expect(powerTradeIncome({ ...on, cityHall: false })).toBe(0);
  });
});

describe('an older save opens as the city it was', () => {
  it('defaults a v13 city to no agreements at all', () => {
    const old = { ...state({ districts: 5, ...built(20, 10, 4) }), version: 13 } as Record<string, unknown>;
    delete old['powerTrade'];
    delete old['goodsTrade'];
    const back = migrate(old);
    expect(back).not.toBeNull();
    const s = back as GameState;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.powerTrade).toBe(POWER_TRADE_NEUTRAL);
    expect(s.goodsTrade).toBe(false);
    // Which is the only reading that could be right: the city earns and pays
    // exactly what it did before either switch existed.
    expect(powerTradeIncome(s)).toBe(0);
    expect(powerTradeCost(s)).toBe(0);
    expect(tradeUpkeep(s)).toBe(0);
  });

  it('will not open on a step that is not in the table', () => {
    const doctored = migrate({
      ...state({ districts: 4, ...built(20, 10, 4), cityHall: true }),
      version: SAVE_VERSION,
      powerTrade: 97,
      goodsTrade: 'yes',
    });
    expect(doctored).not.toBeNull();
    expect((doctored as GameState).powerTrade).toBe(POWER_TRADES.length - 1);
    // Anything but a true boolean is off: a treaty is signed or it is not.
    expect((doctored as GameState).goodsTrade).toBe(false);
  });
});
