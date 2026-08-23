import { describe, expect, it } from 'vitest';
import {
  CATCHUP_MAX_STEPS,
  CATCHUP_STEP_SECONDS,
  OFFLINE_CAP_SECONDS,
  START_CASH,
  TICK_RATE,
  TIERS,
} from '../src/sim/config';
import { Game } from '../src/sim/game';
import {
  homeCapacity,
  homeCost,
  income,
  industryCapacity,
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
    // Housing alone no longer reaches the occupancy gate: of the 65 plots a
    // district sells, 19 are housing and 28 are shops, so filling every home
    // leaves the city 29% developed. Annexing takes shops as well as houses.
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
    // Happiness has to start where it will end, or the rate moves under the
    // test: income scales with it, and a serviceless city settles at zero.
    const game = at({ homes: 40, shops: 3, happiness: 0 });
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
    const game = at({ homes: 40, shops: 2, happiness: 0 });
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
    expect(game.state.shops).toBeLessThanOrEqual(shopCapacity(game.state));
    expect(game.state.industry).toBeLessThanOrEqual(industryCapacity(game.state));
    expect(game.state.districts).toBe(1);
    expect(game.state.tier).toBe(0);
  });

  it('steps a fixed size, so an hour away is an hour away however it is taken', () => {
    // The composability a fixed step size buys, and the thing a fixed chunk
    // count breaks: with `credited / 24` a twelve-hour absence stepped 1800
    // seconds at a time and a one-minute absence stepped 2.5, so the same
    // elapsed time developed two different cities. Demand is a feedback loop
    // now, so that difference compounds rather than cancelling out.
    const patch = { homes: 20, shops: 4, cash: 3_000, autoDevelop: true };
    const whole = at(patch);
    whole.catchUp(60 * CATCHUP_STEP_SECONDS);

    const pieces = at(patch);
    for (let i = 0; i < 60; i++) pieces.catchUp(CATCHUP_STEP_SECONDS);

    expect(pieces.state.homes).toBe(whole.state.homes);
    expect(pieces.state.shops).toBe(whole.state.shops);
    expect(pieces.state.cash).toBeCloseTo(whole.state.cash, 6);
    expect(pieces.state.demandR).toBeCloseTo(whole.state.demandR, 9);
    expect(pieces.state.demandC).toBeCloseTo(whole.state.demandC, 9);
  });

  it('credits the whole cap without running away with the iteration count', () => {
    const game = at({ homes: 30, cash: 1e6, autoDevelop: true });
    const report = game.catchUp(OFFLINE_CAP_SECONDS);
    expect(report.seconds).toBe(OFFLINE_CAP_SECONDS);
    expect(game.state.elapsed).toBeCloseTo(OFFLINE_CAP_SECONDS, 6);
    expect(OFFLINE_CAP_SECONDS / CATCHUP_STEP_SECONDS).toBeLessThanOrEqual(CATCHUP_MAX_STEPS);
  });

  /**
   * `spentSince` used to reconstruct this by replaying the cost curve, which
   * cannot be right any more: a price now depends on the demand at the moment
   * of purchase, and the replay only ever sees the demand at the end. The check
   * is against `earned`, the ledger's own accumulator, which knows nothing about
   * the spend accounting at all.
   */
  it('reports spend that matches what was actually deducted', () => {
    const game = at({ homes: 24, shops: 4, cash: 4_000, autoDevelop: true });
    const cashBefore = game.state.cash;
    const earnedBefore = game.state.earned;

    const report = game.catchUp(6 * 3600);
    expect(report.spent).toBeGreaterThan(0);

    const trueEarned = game.state.earned - earnedBefore;
    const trueSpent = trueEarned - (game.state.cash - cashBefore);
    expect(report.earned).toBeCloseTo(trueEarned, 6);
    expect(report.spent).toBeCloseTo(trueSpent, 6);
  });

  it('will not build into a zone the city is already oversupplied in', () => {
    // Far more shops than the residents can fill, so commercial demand is deep
    // in surcharge. The away player has to leave it alone.
    const game = at({ homes: 4, shops: 20, cash: 1e9, autoDevelop: true });
    game.catchUp(3600);
    expect(game.state.demandC).toBeLessThan(0);
    expect(game.state.shops).toBe(20);
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
