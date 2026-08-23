import { describe, expect, it } from 'vitest';
import { OFFLINE_CAP_SECONDS, START_CASH, TICK_RATE, TIERS } from '../src/sim/config';
import { Game } from '../src/sim/game';
import {
  homeCapacity,
  homeCost,
  income,
  plotCapacity,
  residents,
  shopCapacity,
} from '../src/sim/economy';
import { createState, type GameState } from '../src/sim/state';

const at = (patch: Partial<GameState> = {}): Game => new Game({ ...createState(0), ...patch });

describe('purchases', () => {
  it('refuses what you cannot afford and takes nothing', () => {
    const game = at({ cash: 0 });
    expect(game.buildHome()).toBe(false);
    expect(game.state.cash).toBe(0);
    expect(game.state.homes).toBe(0);
  });

  it('charges the advertised price', () => {
    const game = at({ cash: 1000 });
    const price = homeCost(game.state);
    expect(game.buildHome()).toBe(true);
    expect(game.state.cash).toBeCloseTo(1000 - price, 9);
    expect(game.state.homes).toBe(1);
  });

  it('rezones the whole city at once, keeping every plot', () => {
    const game = at({ cash: 1e9, homes: 30 });
    const before = game.state.homes;
    expect(game.rezone()).toBe(true);
    expect(game.state.tier).toBe(1);
    expect(game.state.homes).toBe(before);
    expect(residents(game.state)).toBe(before * TIERS[1]!.capacity);
  });

  it('annexation adds plots without disturbing what is built', () => {
    // Housing alone no longer reaches the occupancy gate: a district is 48%
    // residential and 31% commercial, so filling every home leaves the city
    // only 61% developed. Annexing takes shops as well as houses now.
    const first = createState(0);
    const homes = homeCapacity(first);
    const game = at({ cash: 1e9, homes, shops: shopCapacity(first) });
    const before = plotCapacity(game.state);
    expect(game.annex()).toBe(true);
    expect(game.state.districts).toBe(2);
    expect(plotCapacity(game.state)).toBe(before * 2);
    expect(game.state.homes).toBe(homes);
  });
});

describe('the tick', () => {
  it('is frame-rate independent, to within the one tick it holds back', () => {
    // A fixed-timestep accumulator always carries a remainder of less than one
    // tick. What matters is that the remainder stays bounded rather than
    // compounding: a 144fps machine must not out-earn a 30fps one over time.
    const slow = at({ homes: 40, shops: 3 });
    const fast = at({ homes: 40, shops: 3 });
    const tickWorth = income(slow.state) / TICK_RATE;

    for (let seconds = 1; seconds <= 600; seconds++) {
      for (let i = 0; i < 4; i++) slow.advance(0.25);
      for (let i = 0; i < 144; i++) fast.advance(1 / 144);
      expect(Math.abs(fast.state.cash - slow.state.cash)).toBeLessThanOrEqual(tickWorth + 1e-9);
    }
  });

  it('earns exactly the advertised rate', () => {
    const game = at({ homes: 40, shops: 3 });
    const rate = income(game.state);
    for (let i = 0; i < 100; i++) game.advance(0.1);
    expect(game.state.cash - START_CASH).toBeCloseTo(rate * 10, 4);
  });

  it('does not run backwards on a stalled frame', () => {
    const game = at({ homes: 40 });
    game.advance(-5);
    expect(game.state.cash).toBe(START_CASH);
  });
});

describe('offline progress', () => {
  it('credits time away', () => {
    const game = at({ homes: 40, shops: 2 });
    const rate = income(game.state);
    const report = game.catchUp(3600);
    expect(report.seconds).toBe(3600);
    expect(report.earned).toBeCloseTo(rate * 3600, 2);
  });

  it('caps a long absence and says how much was forfeited', () => {
    const game = at({ homes: 40 });
    const report = game.catchUp(OFFLINE_CAP_SECONDS * 3);
    expect(report.seconds).toBe(OFFLINE_CAP_SECONDS);
    expect(report.forfeited).toBeCloseTo(OFFLINE_CAP_SECONDS * 2, 6);
  });

  it('leaves the city alone unless auto-development is on', () => {
    const game = at({ homes: 40, shops: 2, cash: 1e6 });
    const report = game.catchUp(3600);
    expect(report.homes).toBe(0);
    expect(report.shops).toBe(0);
  });

  it('builds while you are away once auto-development is on', () => {
    const game = at({ homes: 40, shops: 2, cash: 1e6, autoDevelop: true });
    const report = game.catchUp(3600);
    expect(report.homes + report.shops).toBeGreaterThan(0);
    expect(game.state.homes + game.state.shops).toBeLessThanOrEqual(plotCapacity(game.state));
  });

  it('never spends past the land it owns', () => {
    const game = at({ cash: 1e12, autoDevelop: true });
    game.catchUp(OFFLINE_CAP_SECONDS);
    expect(game.state.homes).toBeLessThanOrEqual(homeCapacity(game.state));
    expect(game.state.districts).toBe(1);
    expect(game.state.tier).toBe(0);
  });
});

describe('pacing', () => {
  /** Plays the opening as an attentive player would: buy the moment you can. */
  const playFor = (seconds: number): Game => {
    const game = new Game(createState(0));
    for (let t = 0; t < seconds; t += 0.1) {
      game.advance(0.1);
      while (game.buildHome() || game.buildShop());
    }
    return game;
  };

  it('lets the player spend immediately', () => {
    const game = new Game(createState(0));
    expect(game.buildHome()).toBe(true);
    expect(game.buildHome()).toBe(true);
  });

  it('does not open with a minute of nothing to do', () => {
    // The first house has to pay for itself fast enough that the second one is
    // a decision rather than a wait. This is the guard on that.
    const opening = playFor(60);
    expect(opening.state.homes).toBeGreaterThanOrEqual(8);
  });

  it('still takes real time to fill the first district', () => {
    const quarterHour = playFor(900);
    expect(quarterHour.state.homes + quarterHour.state.shops).toBeLessThan(
      plotCapacity(quarterHour.state),
    );
  });
});
