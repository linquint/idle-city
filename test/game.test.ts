import { describe, expect, it } from 'vitest';
import {
  CATCHUP_MAX_ANNEXES,
  CATCHUP_MAX_STEPS,
  CATCHUP_STEP_SECONDS,
  MAX_DISTRICTS,
  OFFLINE_CAP_SECONDS,
  START_CASH,
  TICK_RATE,
} from '../src/sim/config';
import { Game } from '../src/sim/game';
import {
  homeCapacity,
  homeCost,
  income,
  industryCapacity,
  plotCapacity,
  shopCapacity,
} from '../src/sim/economy';
import { createState, type GameState } from '../src/sim/state';
import { built, cohort, housed, trading } from './levels';

const at = (patch: Partial<GameState> = {}): Game => new Game({ ...createState(0), ...patch });

/**
 * A city with every amenity, built fresh each call.
 *
 * Fresh matters: a cohort is an array, so a patch object reused across two
 * games would hand both the same skyline to mutate. `Game` copies them on the
 * way in for exactly that reason, and these helpers do not rely on it.
 */
const served = (): Partial<GameState> => ({
  ...built(40, 2),
  hospitals: 1,
  police: 1,
  fire: 1,
  hospitalStaff: 1,
  policeStaff: 1,
  fireStaff: 1,
  parks: 4,
});

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

  it('puts every new building in the level-0 cohort', () => {
    const game = at({ cash: 1e9 });
    for (let i = 0; i < 5; i++) expect(game.buildHome()).toBe(true);
    expect(game.state.homes).toBe(5);
    expect(game.state.homeLevels).toEqual(cohort(5, 0));
  });

  it('annexation adds plots without disturbing what is built', () => {
    // Housing alone no longer reaches the occupancy gate: of the 65 plots a
    // district sells, 19 are housing and 28 are shops, so filling every home
    // leaves the city 29% developed. Annexing takes shops as well as houses.
    const first = createState(0);
    const homes = homeCapacity(first);
    const game = at({ cash: 1e9, ...housed(homes), ...trading(shopCapacity(first)) });
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
    //
    // Measured against the *peak* rate rather than the opening one, which is
    // what changed with occupancy. Income no longer only falls: an empty house
    // has nobody to fail, so a serviceless city reads as covered, fills up, and
    // only then discovers it is unhappy — income rises to 2.2x its opening rate
    // before it turns. One tick out of phase during that climb is worth more
    // than one tick at the start, and the bound has to say which tick it means.
    const slow = at(built(40, 3));
    const fast = at(built(40, 3));
    let peak = 0;

    for (let seconds = 1; seconds <= 600; seconds++) {
      for (let i = 0; i < 4; i++) slow.advance(0.25);
      for (let i = 0; i < 144; i++) fast.advance(1 / 144);
      peak = Math.max(peak, income(slow.state));
      expect(Math.abs(fast.state.cash - slow.state.cash)).toBeLessThanOrEqual(
        peak / TICK_RATE + 1e-9,
      );
    }
    // And the remainder is a phase offset, not a leak: after ten minutes the
    // two ledgers agree to within a rounding error rather than a tick.
    expect(Math.abs(fast.state.cash - slow.state.cash)).toBeLessThan(1);
  });

  it('earns exactly the advertised rate', () => {
    // One tick, and exactness. `step` credits `income(s) * dt` against the state
    // at the top of the tick, so a single tick is the largest window over which
    // "the advertised rate" is a fixed number at all — happiness, demand and
    // occupancy all move underneath it after that, which is the model working
    // rather than the ledger drifting.
    const game = at(built(40, 3));
    const rate = income(game.state);
    game.advance(1 / TICK_RATE);
    expect(game.state.cash - START_CASH).toBeCloseTo(rate / TICK_RATE, 9);

    // Over a longer run the ledger has to stay inside the rate's own range,
    // which is the honest version of the same claim once the rate can move.
    let low = rate;
    let high = rate;
    for (let i = 0; i < 100; i++) {
      game.advance(0.1);
      low = Math.min(low, income(game.state));
      high = Math.max(high, income(game.state));
    }
    const earned = game.state.cash - START_CASH;
    expect(earned).toBeGreaterThanOrEqual(low * 10);
    expect(earned).toBeLessThanOrEqual(high * 10 + rate / TICK_RATE);
  });

  it('does not run backwards on a stalled frame', () => {
    const game = at(housed(40));
    game.advance(-5);
    expect(game.state.cash).toBe(START_CASH);
  });
});

describe('offline progress', () => {
  /**
   * The rate is only constant across the hour if nothing burns, and fires mean
   * nothing is guaranteed not to. What is still exact is the direction: a fire
   * takes a building off the ledger for as long as it is alight and never puts
   * anything back, so an hour away credits an hour of income *less* whatever
   * was on fire, and the two agree to the cent when the hour was quiet.
   */
  it('credits time away with what watching would have earned', () => {
    // A flat `rate x seconds` is no longer the thing to compare against: four
    // lagged signals move over an hour, so the hour is an integral rather than a
    // rectangle. What must still hold — and is the whole promise of offline
    // progress — is that the integral catch-up computes is the one the player
    // would have watched, so it is checked against a twin that watched it.
    //
    // Within 10%, not to the cent, and the gap is honest rather than sloppy:
    // levelling is gated on thresholds, and a 60-second step reads each gate
    // once where watching reads it six hundred times. Measured over this hour
    // the two ledgers land 4.3% apart. Served, so the run is about the
    // integrators rather than about the decay cap — see the fixed-step test.
    const away = at(served());
    const report = away.catchUp(3600);
    expect(report.seconds).toBe(3600);

    const watched = at(served());
    for (let i = 0; i < 36_000; i++) watched.advance(0.1);
    const byHand = watched.state.cash - START_CASH;
    expect(report.earned).toBeGreaterThan(0);
    expect(Math.abs(report.earned - byHand)).toBeLessThan(byHand * 0.1);
  });

  it('caps a long absence and says how much was forfeited', () => {
    const game = at(housed(40));
    const report = game.catchUp(OFFLINE_CAP_SECONDS * 3);
    expect(report.seconds).toBe(OFFLINE_CAP_SECONDS);
    expect(report.forfeited).toBeCloseTo(OFFLINE_CAP_SECONDS * 2, 6);
  });

  /**
   * Auto-development is still the only thing that *builds* while you are away.
   * Fire is now the only thing that unbuilds, so the counts are allowed to move
   * — down, by exactly the number of buildings the away report says were lost,
   * and by nothing else.
   */
  it('leaves the city alone unless auto-development is on', () => {
    const game = at({ ...built(40, 2), cash: 1e6 });
    const report = game.catchUp(3600);
    expect(report.homes).toBeLessThanOrEqual(0);
    expect(report.shops).toBeLessThanOrEqual(0);
    expect(report.industry).toBeLessThanOrEqual(0);
    expect(report.homes + report.shops + report.industry).toBe(-report.firesLost);
    expect(report.services).toBe(0);
  });

  it('builds while you are away once auto-development is on', () => {
    const game = at({ ...built(20, 2), cash: 1e6, autoDevelop: true });
    const report = game.catchUp(3600);
    expect(report.homes + report.shops).toBeGreaterThan(0);
    // Per zone, which is the bound that actually exists. A single city-wide
    // total was only ever a proxy for it, and a proxy that a starting state
    // over its own housing capacity can breach without anything being wrong.
    expect(game.state.homes).toBeLessThanOrEqual(homeCapacity(game.state));
    expect(game.state.shops).toBeLessThanOrEqual(shopCapacity(game.state));
  });

  it('never spends past the land it owns', () => {
    const game = at({ cash: 1e12, autoDevelop: true });
    const report = game.catchUp(OFFLINE_CAP_SECONDS);
    expect(game.state.homes).toBeLessThanOrEqual(homeCapacity(game.state));
    expect(game.state.shops).toBeLessThanOrEqual(shopCapacity(game.state));
    expect(game.state.industry).toBeLessThanOrEqual(industryCapacity(game.state));
    // The city does take land on its own now, but only inside the guard: a
    // twelve-hour absence with a treasury this size would otherwise chain-annex
    // and hand back a city the player has never seen.
    expect(report.districts).toBeLessThanOrEqual(CATCHUP_MAX_ANNEXES);
    expect(game.state.districts).toBe(1 + report.districts);
  });

  it('steps a fixed size, so an hour away is an hour away however it is taken', () => {
    // The composability a fixed step size buys, and the thing a fixed chunk
    // count breaks: with `credited / 24` a twelve-hour absence stepped 1800
    // seconds at a time and a one-minute absence stepped 2.5, so the same
    // elapsed time developed two different cities. Demand is a feedback loop
    // now, so that difference compounds rather than cancelling out.
    // Served and staffed at the city limit, so nothing abandons and nothing can
    // be annexed. Both of those are capped *per catch-up call* by design — the
    // same guard CATCHUP_MAX_LOSSES puts on fire — so a city that is decaying
    // or expanding genuinely does come back different depending on how the
    // absence is chopped up. That is the guard working; this test is about the
    // integrators, so it takes both off the table.
    const patch = (): Partial<GameState> => ({
      ...served(),
      districts: MAX_DISTRICTS,
      cash: 3_000,
      autoDevelop: true,
    });
    const whole = at(patch());
    whole.catchUp(60 * CATCHUP_STEP_SECONDS);

    const pieces = at(patch());
    for (let i = 0; i < 60; i++) pieces.catchUp(CATCHUP_STEP_SECONDS);

    expect(pieces.state.homes).toBe(whole.state.homes);
    expect(pieces.state.shops).toBe(whole.state.shops);
    expect(pieces.state.cash).toBeCloseTo(whole.state.cash, 6);
    expect(pieces.state.demandR).toBeCloseTo(whole.state.demandR, 9);
    expect(pieces.state.demandC).toBeCloseTo(whole.state.demandC, 9);
  });

  it('credits the whole cap without running away with the iteration count', () => {
    const game = at({ ...housed(30), cash: 1e6, autoDevelop: true });
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
    const game = at({ ...built(24, 4), cash: 4_000, autoDevelop: true });
    const cashBefore = game.state.cash;
    const earnedBefore = game.state.earned;

    const report = game.catchUp(6 * 3600);
    expect(report.spent).toBeGreaterThan(0);

    // Three outgoings now, not two: what auto-development bought, and what the
    // city paid its civic buildings in wages. `earned` is the gross line, so the
    // ledger only closes when both come off it — a check with either one missing
    // would pass on a build that silently double-charged the other.
    expect(report.wages).toBeGreaterThan(0);
    const trueEarned = game.state.earned - earnedBefore;
    const trueSpent = trueEarned - (game.state.cash - cashBefore) - report.wages;
    // Relative rather than absolute: six hours of a levelling city runs the
    // ledger into the billions, where a double has about a millionth to give
    // and an absolute tolerance of 5e-7 is asking for more precision than the
    // number type has.
    expect(Math.abs(report.earned - trueEarned)).toBeLessThan(Math.abs(trueEarned) * 1e-12);
    expect(Math.abs(report.spent - trueSpent)).toBeLessThan(Math.abs(trueSpent) * 1e-12);
  });

  it('will not build into a zone the city is already oversupplied in', () => {
    // Far more shops than the residents can fill, so commercial demand is deep
    // in surcharge. The away player has to leave it alone.
    //
    // Checked step by step rather than at the end, because a city left long
    // enough climbs *out* of an oversupply on its own and buying shops then is
    // the right call rather than the bug this guards against. The claim is
    // about the decision, so it is tested where the decision is made: while the
    // surcharge is live, the shop count must not move.
    // Tick by tick, so the signal cannot cross zero inside the window being
    // judged: auto-development reads demand *after* the integrators have run,
    // so a coarse step can legitimately start oversupplied and buy by the end
    // of it. Only ticks that are surcharged at both ends are held to the rule.
    const game = at({ ...built(4, 25), cash: 1e9, autoDevelop: true });
    let surcharged = 0;
    for (let i = 0; i < 6_000; i++) {
      const shops = game.state.shops;
      const before = game.state.demandC;
      game.advance(0.1);
      if (before < 0 && game.state.demandC < 0) {
        surcharged++;
        expect(game.state.shops).toBe(shops);
      }
    }
    // And it really was oversupplied for most of the run, so the assertion above
    // was doing work rather than never firing.
    expect(surcharged).toBeGreaterThan(1_000);
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
    //
    // Counted in *purchases* rather than in homes, because commerce is now
    // priced beside housing rather than behind it: a player buying whatever is
    // cheapest gets 7 homes and 7 shops in the opening minute where they used
    // to get 8 homes and almost no shops. The opening got busier, not thinner —
    // but the guard has to say so, or "shops are affordable now" reads as a
    // regression in the one place it is most clearly an improvement.
    const opening = playFor(60);
    expect(opening.state.homes + opening.state.shops).toBeGreaterThanOrEqual(8);
    // And the pacing this was really guarding — how fast a house pays for
    // itself, which is RENT against HOME_BASE and nothing to do with shops —
    // measured on its own rather than through a mixed policy.
    const housingOnly = new Game(createState(0));
    for (let i = 0; i < 600; i++) {
      housingOnly.advance(0.1);
      while (housingOnly.buildHome());
    }
    expect(housingOnly.state.homes).toBeGreaterThanOrEqual(8);
  });

  it('still takes real time to fill the first district', () => {
    const quarterHour = playFor(900);
    expect(quarterHour.state.homes + quarterHour.state.shops).toBeLessThan(
      plotCapacity(quarterHour.state),
    );
  });
});
