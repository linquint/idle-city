import { describe, expect, it } from 'vitest';
import {
  BASE_IGNITION_PER_BUILDING_HOUR,
  BURN_OUT_SECONDS,
  CATCHUP_MAX_LOSSES,
  EXTINGUISH_MAX,
  EXTINGUISH_MIN,
  FIRE_SUPPRESSION,
  FIRE_UNHAPPINESS,
  MAX_ACTIVE_FIRES,
  OFFLINE_CAP_SECONDS,
  SERVICES,
} from '../src/sim/config';
import {
  burnableBuildings,
  extinguishSeconds,
  fireCoverage,
  happinessTarget,
  ignitionRate,
  income,
  wouldBurnOut,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { createState, type GameState } from '../src/sim/state';
import { built, housed, powered } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });
const at = (patch: Partial<GameState> = {}): Game => new Game({ ...createState(0), ...patch });

/** `advance` clamps a single call to a quarter second, so time is taken in ticks. */
const run = (game: Game, seconds: number): Game => {
  for (let i = 0; i < Math.round(seconds * 10); i++) game.advance(0.1);
  return game;
};

/** A city with fire cover it has had time to staff. */
const covered = (patch: Partial<GameState> = {}): Partial<GameState> => ({
  fire: 3,
  fireStaff: 1,
  ...patch,
});

describe('the ignition rate', () => {
  it('is strictly positive with buildings and no fire service at all', () => {
    const bare = state(built(19, 10));
    expect(fireCoverage(bare)).toBe(0);
    expect(ignitionRate(bare)).toBeGreaterThan(0);
    // Per building per hour, converted to per second. Nothing else in it.
    expect(ignitionRate(bare)).toBeCloseTo(
      (BASE_IGNITION_PER_BUILDING_HOUR * burnableBuildings(bare)) / 3600,
      15,
    );
  });

  /**
   * Not zero, deliberately: a city that had bought its way out of fires would
   * never see one again and the fire station would go back to being a number.
   * What full coverage buys is a rate near zero and a response that always
   * beats BURN_OUT_SECONDS, so a covered city sees fires and never loses a
   * building to one.
   */
  it('is at or near zero at full fire coverage', () => {
    const safe = state({ ...housed(4), ...covered() });
    expect(fireCoverage(safe)).toBe(1);
    const bare = state(housed(4));
    expect(ignitionRate(safe)).toBeLessThanOrEqual(ignitionRate(bare) * (1 - FIRE_SUPPRESSION));
    expect(ignitionRate(safe)).toBeLessThan(ignitionRate(bare) * 0.1);
  });

  it('falls monotonically as coverage rises', () => {
    // One station against 1,600 residents, so even fully staffed it covers
    // 94% rather than saturating the clamp partway up the sweep.
    let last = Infinity;
    for (const fireStaff of [0, 0.2, 0.5, 0.8, 1]) {
      const rate = ignitionRate(state({ ...housed(100, 1), fire: 1, fireStaff }));
      expect(rate).toBeLessThan(last);
      last = rate;
    }
  });

  it('is zero for a city with nothing to burn', () => {
    expect(ignitionRate(state())).toBe(0);
    expect(ignitionRate(state({ hospitals: 1, police: 1, fire: 1 }))).toBe(0);
  });
});

describe('the response', () => {
  it('runs from EXTINGUISH_MAX uncovered to EXTINGUISH_MIN covered', () => {
    expect(extinguishSeconds(state(housed(19)))).toBeCloseTo(EXTINGUISH_MAX, 12);
    expect(extinguishSeconds(state({ ...housed(4), ...covered() }))).toBeCloseTo(EXTINGUISH_MIN, 12);
  });

  /**
   * The threshold the whole mechanic turns on. Below it every fire costs a
   * building; above it, none do — which is the argument for the fire station,
   * stated in one number rather than in a coverage percentage.
   */
  it('crosses BURN_OUT_SECONDS at a coverage a player can reach', () => {
    const crossover = (EXTINGUISH_MAX - BURN_OUT_SECONDS) / (EXTINGUISH_MAX - EXTINGUISH_MIN);
    expect(crossover).toBeGreaterThan(0);
    expect(crossover).toBeLessThan(0.5);
    expect(wouldBurnOut(state(housed(19)))).toBe(true);
    expect(wouldBurnOut(state({ ...housed(4), ...covered() }))).toBe(false);
  });
});

describe('ignition is reproducible', () => {
  /**
   * The reason the cursor is in the save. Without it a reload would reshuffle
   * every fire, and offline catch-up would invent a city that watching would
   * never have produced.
   */
  it('gives the same fires from the same state and the same cursor', () => {
    const patch = { ...built(19, 20, 8), cash: 0 };
    const a = at(patch);
    const b = at(patch);
    run(a, 1_200);
    run(b, 1_200);
    expect(a.state.fires).toEqual(b.state.fires);
    expect(a.state.fireCursor).toBe(b.state.fireCursor);
    expect(a.state.fireHazard).toBeCloseTo(b.state.fireHazard, 12);
    expect(a.state.homes).toBe(b.state.homes);
  });

  it('carries on rather than restarting when a save is reopened', () => {
    const patch = { ...built(19, 20, 8), cash: 0 };
    const straight = at(patch);
    run(straight, 900);

    // The same 900 seconds, taken as two sessions with a reload in the middle.
    const first = at(patch);
    run(first, 400);
    const reopened = new Game({ ...first.state, fires: [...first.state.fires] });
    run(reopened, 500);

    expect(reopened.state.fireCursor).toBe(straight.state.fireCursor);
    expect(reopened.state.homes).toBe(straight.state.homes);
    expect(reopened.state.fires).toEqual(straight.state.fires);
  });

  /**
   * Step-size invariance, at the tolerance the demand loop is held to. A
   * Bernoulli trial per tick would fail this outright: sixty trials at a second
   * and one at sixty are different distributions.
   */
  it('gives catch-up and real time the same fire history, within 1%', () => {
    // Chosen so the rate is genuinely near-constant across the hour, which is
    // the only condition under which two step sizes are comparable at all. That
    // is harder than it was: residents are `cohort x capacity x occupancy` now,
    // so a city whose mood is still moving has a moving population and a moving
    // fire coverage underneath it. Three things pin it:
    //
    //   - every home is already at the top level, so `promotable` is zero and
    //     no cohort can move. A climbing city is the destabiliser here — a
    //     promotion moves the population the occupancy target is read from;
    //   - hospitals, police and parks all cover the housing land outright, so
    //     happiness settles rather than oscillating, and occupancy with it;
    //   - fire alone is left short: one station reaches 31 of the 110 housing
    //     plots, coverage 0.28, which puts the response at 70.3s — inside
    //     BURN_OUT_SECONDS, so nothing burns down and the counts never move.
    //
    // That leaves 72% of the base rate over 622 buildings, about 22 fires an
    // hour. Every ignition attempt costs exactly three draws, so the cursor is
    // the fire history in one number. Measured: 22 ignitions either way, gap 0.
    //
    // The housing count moved when coverage became land-denominated and the
    // shape did not. Coverage no longer collapses under a levelled city, so
    // leaving fire short takes housing *land* rather than housing density: 55
    // top-level homes on 110 plots against one station. Commerce and industry
    // carry the rest of the building count, which is what keeps the ignition
    // rate where it was.
    const patch = (): Partial<GameState> => ({
      districts: 49,
      ...built(55, 427, 140, 3),
      occupancyR: 0.7,
      occupancyC: 0.7,
      occupancyI: 0.7,
      hospitals: 6,
      hospitalStaff: 1,
      police: 5,
      policeStaff: 1,
      fire: 1,
      fireStaff: 1,
      parks: 19,
      cash: 0,
      // Lit. This is a test about ignition being reproducible, and a browned-out
      // city boards buildings up and reopens them at a lower level — which is a
      // difference between the two runs that has nothing to do with fire.
      ...powered(),
    });
    const away = at(patch());
    const watched = at(patch());
    away.catchUp(3600);
    for (let i = 0; i < 3600; i++) watched.catchUp(1);

    const ignitions = (g: Game): number => g.state.fireCursor / 3;
    expect(ignitions(watched)).toBeGreaterThan(10);
    expect(away.state.homes).toBe(55);
    expect(away.state.homeLevels).toEqual(watched.state.homeLevels);
    const gap = Math.abs(ignitions(away) - ignitions(watched));
    expect(gap).toBeLessThanOrEqual(Math.max(1, ignitions(watched) * 0.01));
    // The pressure still sitting unspent agrees to well inside one fire. Not to
    // twelve figures any more: the rate is *near* constant rather than exactly
    // constant, because occupancy is still settling by a fraction of a percent
    // across the hour and the rate reads it. Under half a fire of accumulated
    // difference over 22 is the honest statement of that.
    expect(Math.abs(away.state.fireHazard - watched.state.fireHazard)).toBeLessThan(0.5);
  });
});

describe('a fire while it burns', () => {
  const burning = (n: number): GameState =>
    state({
      ...built(19, 10),
      fires: Array.from({ length: n }, (_, i) => ({
        kind: 'home' as const,
        index: i,
        startedAt: 0,
      })),
    });

  it('takes the burning building off the ledger', () => {
    const quiet = burning(0);
    const alight = burning(1);
    expect(income(alight)).toBeLessThan(income(quiet));
    // One home in nineteen, and the shop multiplier is untouched.
    expect(income(alight)).toBeCloseTo((income(quiet) * 18) / 19, 9);
  });

  it('takes a shop bonus off the ledger when the shop is the one alight', () => {
    const quiet = state(built(19, 10));
    const alight = state({
      ...built(19, 10),
      fires: [{ kind: 'shop', index: 3, startedAt: 0 }],
    });
    expect(income(alight)).toBeLessThan(income(quiet));
  });

  it('costs happiness in proportion, and never enough to brick housing', () => {
    const clear = happinessTarget(state({ ...housed(4), hospitals: 1, hospitalStaff: 1, police: 1, policeStaff: 1, ...covered() }));
    for (let n = 1; n <= MAX_ACTIVE_FIRES; n++) {
      const hit = happinessTarget({
        ...state({ ...housed(4), hospitals: 1, hospitalStaff: 1, police: 1, policeStaff: 1, ...covered() }),
        fires: Array.from({ length: n }, (_, i) => ({ kind: 'home' as const, index: i, startedAt: 0 })),
      });
      expect(hit).toBeCloseTo(clear - FIRE_UNHAPPINESS * n, 9);
    }
    expect(clear - FIRE_UNHAPPINESS * MAX_ACTIVE_FIRES).toBeGreaterThan(0.35);
  });

  it('never exceeds the cap, however long an uncovered city is left', () => {
    const game = at({ ...built(19, 28, 11), cash: 0 });
    for (let i = 0; i < 24; i++) {
      game.catchUp(1800);
      expect(game.state.fires.length).toBeLessThanOrEqual(MAX_ACTIVE_FIRES);
    }
  });

  it('never burns the same building twice at once', () => {
    const game = at({ ...built(19, 28, 11), cash: 0 });
    for (let i = 0; i < 200; i++) {
      run(game, 30);
      const keys = game.state.fires.map((f) => `${f.kind}:${f.index}`);
      expect(new Set(keys).size).toBe(keys.length);
      for (const fire of game.state.fires) expect(fire.index).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the destruction guard', () => {
  /**
   * The single most annoying thing an idle game can do is delete a city you did
   * not watch burn. However many fires resolve badly across a twelve-hour
   * absence, one call comes back at most one building smaller.
   */
  it('never destroys more than one building per catchUp, however long the absence', () => {
    for (const seconds of [3600, 6 * 3600, OFFLINE_CAP_SECONDS, OFFLINE_CAP_SECONDS * 4]) {
      const game = at({ ...built(19, 28, 11), cash: 0 });
      const before = burnableBuildings(game.state);
      const report = game.catchUp(seconds);
      expect(report.firesLost).toBeLessThanOrEqual(CATCHUP_MAX_LOSSES);
      expect(before - burnableBuildings(game.state)).toBeLessThanOrEqual(CATCHUP_MAX_LOSSES);
    }
  });

  it('puts out the fires it refuses to lose rather than leaving them burning', () => {
    const game = at({ ...built(19, 28, 11), cash: 0 });
    const report = game.catchUp(OFFLINE_CAP_SECONDS);
    expect(report.firesStarted).toBeGreaterThan(MAX_ACTIVE_FIRES);
    // Everything that started is accounted for: out, lost, or still alight.
    expect(report.firesExtinguished + report.firesLost + game.state.fires.length).toBe(
      report.firesStarted,
    );
    expect(report.firesLost).toBe(CATCHUP_MAX_LOSSES);
  });

  it('resets the budget for the next absence rather than spending it once', () => {
    const game = at({ ...built(19, 28, 11), cash: 0 });
    const first = game.catchUp(OFFLINE_CAP_SECONDS);
    const second = game.catchUp(OFFLINE_CAP_SECONDS);
    expect(first.firesLost).toBe(1);
    expect(second.firesLost).toBe(1);
  });

  it('loses nothing at all when the fire service can reach the fire in time', () => {
    const game = at({ ...housed(4), cash: 0, ...covered() });
    const report = game.catchUp(OFFLINE_CAP_SECONDS);
    expect(report.firesLost).toBe(0);
    expect(game.state.homes).toBe(4);
  });
});

describe('the away report', () => {
  it('says what started, what was put out and what was lost', () => {
    const game = at({ ...built(19, 28, 11), cash: 0 });
    const report = game.catchUp(6 * 3600);
    expect(report.firesStarted).toBeGreaterThan(0);
    expect(report.firesExtinguished).toBeGreaterThan(0);
    expect(report.firesLost).toBeGreaterThanOrEqual(0);
    expect(report.firesLost).toBeLessThanOrEqual(CATCHUP_MAX_LOSSES);
  });

  it('reports nothing at all for a city that cannot burn', () => {
    const report = at({ cash: 1e6 }).catchUp(3600);
    expect(report.firesStarted).toBe(0);
    expect(report.firesExtinguished).toBe(0);
    expect(report.firesLost).toBe(0);
  });

  it('counts only this absence, not every fire the city has ever had', () => {
    const game = at({ ...built(19, 28, 11), cash: 0 });
    game.catchUp(6 * 3600);
    const second = game.catchUp(60);
    expect(second.firesStarted).toBeLessThan(10);
  });
});

describe('fires resolve inside the catch-up loop', () => {
  /**
   * Not as a post-hoc correction. If fires were settled after the loop, the
   * income lost while they burned would never have been taken off, happiness
   * would never have dipped, and auto-development would have been spending
   * against a city that was not the one on fire.
   */
  it('leaves an uncovered city no worse off than a covered one', () => {
    const bare = at({ ...built(19, 28, 11), cash: 0 });
    const safe = at({ ...built(19, 28, 11), cash: 0, fire: 2, fireStaff: 1 });
    bare.catchUp(6 * 3600);
    safe.catchUp(6 * 3600);
    expect(safe.state.cash).toBeGreaterThan(bare.state.cash);
    expect(safe.state.happiness).toBeGreaterThan(bare.state.happiness);
  });

  it('leaves no fire older than the response time when the absence ends', () => {
    const game = at({ ...built(19, 28, 11), cash: 0 });
    game.catchUp(6 * 3600);
    const limit = Math.min(extinguishSeconds(game.state), BURN_OUT_SECONDS);
    for (const fire of game.state.fires) {
      // Within one catch-up step: resolution is checked on step boundaries.
      expect(game.state.elapsed - fire.startedAt).toBeLessThan(limit + 60);
    }
  });
});

describe('a fire never outlives its building', () => {
  it('drops fires whose building was destroyed under them', () => {
    const game = at({ ...housed(1), cash: 0 });
    run(game, 6 * 3600);
    for (const fire of game.state.fires) {
      const of = fire.kind === 'home' ? game.state.homes : fire.kind === 'shop' ? game.state.shops : game.state.industry;
      expect(fire.index).toBeLessThan(of);
    }
  });

  it('leaves a city that burned down completely in a legal state', () => {
    const game = at({ ...housed(2), cash: 0 });
    run(game, 12 * 3600);
    expect(game.state.homes).toBeGreaterThanOrEqual(0);
    expect(game.state.fires.length).toBeLessThanOrEqual(game.state.homes);
    expect(income(game.state)).toBeGreaterThanOrEqual(0);
  });
});

describe('the fire service is the fix', () => {
  it('is one of the three the happiness panel can name', () => {
    expect(SERVICES.some((service) => service.key === 'fire')).toBe(true);
  });
});
