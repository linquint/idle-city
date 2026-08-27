import { describe, expect, it } from 'vitest';
import {
  ABANDON_SECONDS,
  CATCHUP_MAX_ABANDONED,
  CATCHUP_STEP_SECONDS,
  COVERAGE_GRACE_PLOTS,
  HAPPINESS_MIN_OCCUPANCY,
  LEVEL_CAPACITY,
  LEVEL_EDUCATION,
  LEVEL_FOOTPRINT,
  LEVEL_HOUSING,
  LEVEL_NAMES,
  LEVEL_SCALE,
  LEVEL_UP_HAPPINESS,
  LEVEL_UP_OCCUPANCY,
  LEVELS,
  OCCUPANCY_EMPTY,
  OCCUPANCY_FLOOR,
  OCCUPANCY_TAU,
  SERVICES,
  type Service,
  ZONE_LEVEL_NAMES,
} from '../src/sim/config';
import {
  cohortStart,
  cohortTotal,
  income,
  levelAt,
  mergedCohort,
  mergeCapacity,
  plotsOf,
  capacityOf,
  mergedOf,
  occupancyStep,
  occupancyTarget,
  residents,
  standingOf,
  ZONE_KINDS,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { hash01 } from '../src/core/rng';
import { cohortOf, createState, type GameState, type ZoneKind } from '../src/sim/state';
import { migrate } from '../src/sim/save';
import { built, cohort, housed, served, trading } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });
const at = (patch: Partial<GameState> = {}): Game => new Game({ ...createState(0), ...patch });

/** `advance` clamps a single call to a quarter second, so time is taken in ticks. */
const run = (game: Game, seconds: number): Game => {
  for (let i = 0; i < Math.round(seconds * 10); i++) game.advance(0.1);
  return game;
};

/** The level of every slot of a zone, oldest first. The skyline, as a list. */
const skyline = (s: Readonly<GameState>, kind: ZoneKind): number[] => {
  const levels = kind === 'home' ? s.homeLevels : kind === 'shop' ? s.shopLevels : s.industryLevels;
  const count = kind === 'home' ? s.homes : kind === 'shop' ? s.shops : s.industry;
  return Array.from({ length: count }, (_, slot) => levelAt(levels, slot));
};

/**
 * Why a state's cohorts are not balanced, or null when they are.
 *
 * A predicate rather than a pile of `expect`s because the sweeps below check it
 * after every one of tens of thousands of ticks, and an assertion library call
 * per tick turns a two-second test into a thirty-second one. The message is
 * what a failing `expect` would have printed.
 */
const unbalanced = (s: Readonly<GameState>): string | null => {
  for (const kind of ZONE_KINDS) {
    const levels =
      kind === 'home' ? s.homeLevels : kind === 'shop' ? s.shopLevels : s.industryLevels;
    if (levels.length !== LEVELS) return `${kind}: ${levels.length} levels, wanted ${LEVELS}`;
    for (const n of levels) {
      if (!Number.isInteger(n) || n < 0) return `${kind}: cohort holds ${n}`;
    }
    const total = cohortTotal(levels);
    if (total !== standingOf(s, kind)) {
      return `${kind}: cohorts sum to ${total}, standing stock is ${standingOf(s, kind)}`;
    }
    // The parcel half of the same invariant. Merged parcels are the oldest
    // slots and ruins are taken from the newest end, so the buildings standing
    // on a merged parcel are exactly `min(merged, standing)` — they fall short
    // of the parcel count only while one of them is boarded up.
    const merged = mergedOf(s, kind);
    const held = mergedCohort(levels);
    if (held !== Math.min(merged, total)) {
      return `${kind}: ${held} merged buildings against ${merged} parcels and ${total} standing`;
    }
    if (merged > mergeCapacity(s, kind)) {
      return `${kind}: ${merged} merged parcels, land offers ${mergeCapacity(s, kind)}`;
    }
    if (plotsOf(s, kind) > capacityOf(s, kind)) {
      return `${kind}: ${plotsOf(s, kind)} plots taken of ${capacityOf(s, kind)}`;
    }
  }
  return null;
};

const assertBalanced = (s: Readonly<GameState>): void => expect(unbalanced(s)).toBeNull();

/**
 * The ladder is data, and every table hung off it has to agree about how long
 * it is.
 *
 * The rung that went from four to five found these by hand: a name table one
 * short leaves the HUD calling the top level `undefined`, and an education
 * table one short leaves it ungated. Asserting the lengths is what turns the
 * next rung into a config edit rather than a hunt.
 */
describe('the level ladder', () => {
  it('is as long as LEVELS says, in every table that indexes by level', () => {
    expect(LEVELS).toBeGreaterThanOrEqual(5);
    expect(LEVEL_CAPACITY).toHaveLength(LEVELS);
    expect(LEVEL_FOOTPRINT).toHaveLength(LEVELS);
    expect(LEVEL_HOUSING).toHaveLength(LEVELS);
    expect(LEVEL_SCALE).toHaveLength(LEVELS);
    expect(LEVEL_EDUCATION).toHaveLength(LEVELS);
    expect(LEVEL_NAMES).toHaveLength(LEVELS);
    for (const kind of ZONE_KINDS) expect(ZONE_LEVEL_NAMES[kind]).toHaveLength(LEVELS);
    expect(cohortOf()).toHaveLength(LEVELS);
  });

  it('climbs, and stands on land the parcels can offer', () => {
    for (let l = 1; l < LEVELS; l++) {
      expect(LEVEL_CAPACITY[l] ?? 0).toBeGreaterThan(LEVEL_CAPACITY[l - 1] ?? 0);
      expect(LEVEL_EDUCATION[l] ?? 0).toBeGreaterThanOrEqual(LEVEL_EDUCATION[l - 1] ?? 0);
      // Footprints never shrink, and never exceed the pair a parcel can hold —
      // `parcelOrder` measured that a district holds no residential quads.
      expect(LEVEL_FOOTPRINT[l] ?? 0).toBeGreaterThanOrEqual(LEVEL_FOOTPRINT[l - 1] ?? 0);
      expect(LEVEL_FOOTPRINT[l] ?? 0).toBeLessThanOrEqual(2);
    }
    // The top rung of education has to be reachable, or the top level is not.
    expect(LEVEL_EDUCATION[LEVELS - 1] ?? 0).toBeLessThanOrEqual(1);
  });
});

describe('the cohort invariant', () => {
  it('holds while the city is built, promoted and abandoned', () => {
    // One run that does all three: a served city climbs, then loses its
    // services and empties out, then gets them back and recovers. The sum is
    // checked after every tick rather than at the end, so a transient break
    // cannot hide behind a later repair.
    const game = at({ ...built(24, 20, 8), ...served(), cash: 1e9, happiness: 1 });
    let broke: string | null = null;
    const watch = (): void => {
      broke = broke ?? unbalanced(game.state);
    };

    for (let i = 0; i < 6_000; i++) {
      game.advance(0.1);
      game.buildHome();
      game.buildShop();
      watch();
    }
    expect(broke).toBeNull();
    // Climbed, without caring which rung it reached: the wave drains level 0
    // first, so ten minutes of a fully served city puts the whole stock at
    // level 2 rather than leaving a tidy split at level 1.
    expect(game.state.homeLevels[0]).toBeLessThan(game.state.homes);

    Object.assign(game.state, { hospitals: 0, police: 0, fire: 0, parks: 0 });
    for (let i = 0; i < 20_000; i++) {
      game.advance(0.1);
      watch();
    }
    expect(broke).toBeNull();
    expect(game.state.abandonedR).toBeGreaterThan(0);

    Object.assign(game.state, served());
    for (let i = 0; i < 30_000; i++) {
      game.advance(0.1);
      watch();
    }
    expect(broke).toBeNull();
    expect(game.state.abandonedR).toBe(0);
  });

  it('holds through migration, whatever the save claims', () => {
    for (let i = 0; i < 200; i++) {
      const roll = (salt: number): number => hash01(i * 977 + salt);
      const back = migrate(
        {
          homes: Math.floor(roll(1) * 60),
          shops: Math.floor(roll(2) * 60),
          industry: Math.floor(roll(3) * 60),
          districts: 1 + Math.floor(roll(4) * 3),
          abandonedR: Math.floor(roll(5) * 40),
          abandonedC: Math.floor(roll(6) * 40),
          homeLevels: [
            Math.floor(roll(7) * 40),
            Math.floor(roll(8) * 40),
            Math.floor(roll(9) * 40),
            Math.floor(roll(10) * 40),
          ],
          tier: Math.floor(roll(11) * 6),
        },
        0,
      );
      expect(back).not.toBeNull();
      assertBalanced(back as GameState);
    }
  });
});

describe("a building's level", () => {
  it('is a pure function of its slot and the cohorts', () => {
    // The claim cohorts rest on: nothing about *how* a skyline was reached can
    // show up in it. A thousand randomised orders of building, promoting and
    // abandoning are each replayed against a state carrying only the resulting
    // counts, and the two skylines have to agree slot for slot.
    for (let seed = 0; seed < 1_000; seed++) {
      const game = at({ ...housed(6), ...served(), cash: 1e9, happiness: 1 });
      for (let op = 0; op < 12; op++) {
        const roll = hash01(seed * 4_099 + op);
        if (roll < 0.4) game.buildHome();
        else if (roll < 0.8) game.catchUp(120);
        else Object.assign(game.state, { happiness: roll < 0.9 ? 0.05 : 1 });
      }
      const live = game.state;
      const rebuilt = state({
        homes: live.homes,
        homeLevels: [...live.homeLevels],
        abandonedR: live.abandonedR,
      });
      expect(skyline(rebuilt, 'home')).toEqual(skyline(live, 'home'));
    }
  });

  it('runs oldest-highest down to the ruins at the newest end', () => {
    const s = state({ homes: 12, homeLevels: [2, 3, 1, 4], abandonedR: 2 });
    // 4 arcologies, then 1 tower, then 3 apartments, then 2 houses, then ruins.
    expect(skyline(s, 'home')).toEqual([3, 3, 3, 3, 2, 1, 1, 1, 0, 0, -1, -1]);
    // Never climbs as it walks: a newer building is never taller than an older.
    const levels = skyline(s, 'home').filter((l) => l >= 0);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] as number);
    }
  });

  it('agrees with the cohort boundaries the renderer draws from', () => {
    const starts = new Array<number>(LEVELS).fill(0);
    for (let seed = 0; seed < 200; seed++) {
      const levels = Array.from({ length: LEVELS }, (_, l) =>
        Math.floor(hash01(seed * 31 + l) * 9),
      );
      cohortStart(levels, starts);
      for (let l = 0; l < LEVELS; l++) {
        for (let i = 0; i < (levels[l] ?? 0); i++) {
          expect(levelAt(levels, (starts[l] ?? 0) + i)).toBe(l);
        }
      }
      expect(levelAt(levels, cohortTotal(levels))).toBe(-1);
    }
  });
});

describe('occupancy', () => {
  it('is step-size invariant', () => {
    // The property that makes a 60-second catch-up step safe. Same exponential
    // form as demand and happiness, and checked the same way: one enormous step
    // and 3,600 small ones have to land in the same place.
    const target = 0.8;
    let whole = 0.1;
    whole += (target - whole) * occupancyStep(3_600);

    let pieces = 0.1;
    for (let i = 0; i < 3_600; i++) pieces += (target - pieces) * occupancyStep(1);

    expect(Math.abs(whole - pieces)).toBeLessThanOrEqual(target * 0.01);
    // Both are at the target rather than merely agreeing with each other.
    expect(whole).toBeCloseTo(target, 6);
    expect(pieces).toBeCloseTo(target, 6);

    // And it never overshoots, at any step size — the failure mode the linear
    // form has the moment dt approaches the time constant.
    for (const dt of [0.1, 1, 25, OCCUPANCY_TAU, 600, 3_600, 1e6]) {
      const k = occupancyStep(dt);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(1);
    }
  });

  it('runs from the floor at no happiness to nearly full at all of it', () => {
    const s = state(housed(24));
    expect(occupancyTarget({ ...s, happiness: 1 }, 'home')).toBeGreaterThan(0.8);
    expect(occupancyTarget({ ...s, happiness: 0 }, 'home')).toBe(OCCUPANCY_FLOOR);
    // The floor is under OCCUPANCY_EMPTY, so a thoroughly neglected zone still
    // runs its vacancy clock and still decays — the floor buys a trickle of
    // income to climb back with, not immunity.
    expect(OCCUPANCY_FLOOR).toBeLessThan(OCCUPANCY_EMPTY);
    // And HAPPINESS_MIN_OCCUPANCY is exactly where that crossing happens, which
    // is the whole reason it is derived from the other three rather than tuned.
    expect(occupancyTarget({ ...s, happiness: HAPPINESS_MIN_OCCUPANCY }, 'home')).toBeCloseTo(
      OCCUPANCY_EMPTY,
      12,
    );
    // A zone with nothing standing is not integrated at all: the number is
    // meaningless until something is built, and it is what the first building
    // will open at, so it is held rather than allowed to decay to nothing.
    const empty = at({ happiness: 0 });
    const held = empty.state.occupancyR;
    run(empty, 1_200);
    expect(empty.state.occupancyR).toBe(held);
    expect(empty.state.vacantR).toBe(0);
    // Monotonic in between, so there is no happiness worth being *less* happy at.
    let last = -1;
    for (const happiness of [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
      const now = occupancyTarget({ ...s, happiness }, 'home');
      expect(now).toBeGreaterThan(last);
      last = now;
    }
  });

  it('holds the floor against demand pushing down on it', () => {
    // OCCUPANCY_FLOOR is what a zone keeps *however bad things get*, and the
    // demand term is a modifier on the range above it rather than a way through
    // it. It used to be added outside the floor, so a zone that was miserable
    // and oversupplied at once sank to 0.047 — and the trickle of income the
    // floor exists to leave behind came out 40% short of what it promises.
    const s = state(housed(24));
    for (const demandR of [-1, -0.5, -0.25, 0]) {
      expect(occupancyTarget({ ...s, happiness: 0, demandR }, 'home')).toBe(OCCUPANCY_FLOOR);
    }
    // Above the floor the modifier still does its job in both directions —
    // flooring it must not flatten the term everywhere else.
    const happy = { ...s, happiness: 1 };
    expect(occupancyTarget({ ...happy, demandR: -1 }, 'home')).toBeLessThan(
      occupancyTarget({ ...happy, demandR: 1 }, 'home'),
    );
  });

  it('costs an unhappy city residents without costing it buildings', () => {
    // The mechanic, stated as the test: the houses stay, the people leave.
    const game = at({ ...housed(24), ...served(), happiness: 1 });
    run(game, 600);
    const before = residents(game.state);
    const homes = game.state.homes;
    expect(before).toBeGreaterThan(0);

    Object.assign(game.state, { hospitals: 0, police: 0, fire: 0, parks: 0 });
    run(game, 600);
    expect(residents(game.state)).toBeLessThan(before * 0.5);
    expect(game.state.homes).toBe(homes);
    expect(cohortTotal(game.state.homeLevels) + game.state.abandonedR).toBe(homes);
  });
});

describe('abandonment', () => {
  it('needs sustained vacancy, not a dip', () => {
    // Occupancy is pushed under the line, held there for well under
    // ABANDON_SECONDS, and let back up. Nothing may be written off.
    const game = at({ ...housed(24), ...served(), happiness: 1, occupancyR: 0.1 });
    expect(game.state.occupancyR).toBeLessThan(OCCUPANCY_EMPTY);
    // Held under the line rather than merely started there: occupancy climbs
    // back toward a happy city's target in well under ABANDON_SECONDS, so
    // without pinning it this would be testing the recovery instead.
    for (let i = 0; i < Math.round((ABANDON_SECONDS - 10) * 10); i++) {
      Object.assign(game.state, { occupancyR: 0.1 });
      game.advance(0.1);
    }
    expect(game.state.abandonedR).toBe(0);
    expect(game.state.vacantR).toBeGreaterThan(ABANDON_SECONDS / 2);

    // Back over the line, and the clock resets rather than pausing.
    run(game, 600);
    expect(game.state.occupancyR).toBeGreaterThan(OCCUPANCY_EMPTY);
    expect(game.state.vacantR).toBe(0);
    expect(game.state.abandonedR).toBe(0);
  });

  it('starts once the vacancy has lasted, and stops when it lifts', () => {
    const game = at({ ...housed(24), happiness: 0, occupancyR: 0 });
    run(game, ABANDON_SECONDS - 10);
    expect(game.state.abandonedR).toBe(0);

    run(game, 1_800);
    expect(game.state.abandonedR).toBeGreaterThan(0);
    expect(game.state.homes).toBe(24);
    assertBalanced(game.state);
  });

  it('brings ruins back when the city recovers', () => {
    const game = at({ ...housed(24), happiness: 0, occupancyR: 0 });
    run(game, ABANDON_SECONDS + 1_800);
    const ruins = game.state.abandonedR;
    expect(ruins).toBeGreaterThan(0);

    Object.assign(game.state, { ...served(), happiness: 1 });
    run(game, 3_600);
    expect(game.state.abandonedR).toBe(0);
    // Plots, not buildings: a recovered city goes straight back to climbing,
    // and climbing merges pairs, so the count falls while the land does not.
    expect(plotsOf(game.state, 'home')).toBe(24);
    assertBalanced(game.state);
  });

  it('never writes off more than the cap in one catch-up, however long', () => {
    const game = at({ ...housed(24), happiness: 0, occupancyR: 0 });
    const report = game.catchUp(12 * 3_600);
    expect(report.abandoned).toBeLessThanOrEqual(CATCHUP_MAX_ABANDONED);
    expect(game.state.abandonedR).toBeLessThanOrEqual(CATCHUP_MAX_ABANDONED);
    // The guard is per call, exactly like the one on fire, so a second absence
    // gets its own budget rather than inheriting a spent one.
    const again = game.catchUp(12 * 3_600);
    expect(again.abandoned).toBeGreaterThan(0);
    expect(again.abandoned).toBeLessThanOrEqual(CATCHUP_MAX_ABANDONED);
  });

  it('is reported rather than left to be noticed', () => {
    const game = at({ ...housed(24), happiness: 0, occupancyR: 0 });
    const report = game.catchUp(6 * 3_600);
    expect(report.abandoned).toBeGreaterThan(0);
    expect(report.recovered).toBe(0);
  });

  /**
   * The soft-lock this rule exists to prevent, and it is a hard one: a zone
   * written off to the last plot holds no level, houses nobody and earns
   * *exactly* zero. With residents at zero the rent line is zero, happiness has
   * nothing to be about, the occupancy target sits under OCCUPANCY_EMPTY forever
   * and `isRecovering` never opens. Measured before the guard: twelve simulated
   * hours at income 0.00e+0 with nothing the player could press.
   */
  it('never writes off the last building of a zone', () => {
    // A district's worth of housing, and the size is load-bearing: a shortfall
    // is only charged in full above COVERAGE_GRACE_PLOTS, and six hours of fire
    // takes a stock down as well as the write-offs do. A six-home version of
    // this fixture climbs back out instead of draining, and measures the ramp
    // rather than the guard.
    const game = at({
      ...housed(2 * COVERAGE_GRACE_PLOTS),
      ...trading(15),
      happiness: 0,
      occupancyR: 0,
      occupancyC: 0,
      cash: 0,
    });
    // Long enough to have written off many times over: ABANDON_SPREAD_SECONDS
    // is 1,200, and a stock of twenty-four drains to its last building in about
    // 3,800 seconds of it. Six hours is five times over.
    for (let i = 0; i < 6; i++) run(game, 3_600);
    expect(game.state.abandonedR).toBe(game.state.homes - 1);
    expect(game.state.abandonedC).toBe(game.state.shops - 1);
    expect(cohortTotal(game.state.homeLevels)).toBe(1);
    assertBalanced(game.state);
  });

  it('leaves a written-off city something to climb out on', () => {
    const game = at({
      ...housed(2 * COVERAGE_GRACE_PLOTS),
      ...trading(15),
      happiness: 0,
      occupancyR: 0,
      occupancyC: 0,
      cash: 0,
    });
    for (let i = 0; i < 6; i++) run(game, 3_600);
    // The whole point of the last building: a ledger that is not zero. At the
    // occupancy floor one home is a third of a resident, which is a hospital in
    // about an hour and a half — slow enough to read as a consequence, and not
    // a save to throw away.
    expect(residents(game.state)).toBeGreaterThan(0);
    expect(income(game.state)).toBeGreaterThan(0);
    const before = game.state.cash;
    run(game, 3_600);
    expect(game.state.cash).toBeGreaterThan(before);
    // The rate, not just the sign. `income > 0` passes at any trickle, which is
    // how the occupancy floor came to leak 40% of this without a test noticing:
    // the last home sat at 0.047 occupancy rather than the floor's 0.08, and the
    // hour and a half above was two and a half hours. One home at the floor is
    // `LEVEL_HOUSING[0]` x OCCUPANCY_FLOOR residents, and the hospital it is
    // saving for is the cheapest service in the game.
    expect(residents(game.state)).toBeCloseTo(
      (LEVEL_HOUSING[0] as number) * OCCUPANCY_FLOOR,
      6,
    );
    const hospital = SERVICES.find((service) => service.key === 'hospital') as Service;
    const hours = hospital.base / (game.state.cash - before);
    expect(hours).toBeLessThan(2);
  });
});

describe('promotion', () => {
  /** A city sitting exactly on both gates, with the cohort ready to climb. */
  const ready = (): Partial<GameState> => ({
    ...housed(24),
    ...served(),
    happiness: 1,
    occupancyR: 1,
  });

  it('climbs when both gates are open', () => {
    const game = at(ready());
    run(game, 900);
    expect(game.state.homeLevels[0]).toBeLessThan(24);
    expect(plotsOf(game.state, 'home')).toBe(24);
  });

  it('holds the cohort still when happiness is short', () => {
    const game = at({ ...ready(), happiness: LEVEL_UP_HAPPINESS - 0.01 });
    // Pinned every tick: happiness would otherwise climb back to its target and
    // open the gate the test is trying to hold shut.
    for (let i = 0; i < 9_000; i++) {
      Object.assign(game.state, { happiness: LEVEL_UP_HAPPINESS - 0.01 });
      game.advance(0.1);
    }
    expect(game.state.homeLevels).toEqual(cohort(24));
  });

  it('holds the cohort still when occupancy is short', () => {
    const game = at({ ...ready(), occupancyR: LEVEL_UP_OCCUPANCY - 0.01 });
    for (let i = 0; i < 9_000; i++) {
      Object.assign(game.state, { occupancyR: LEVEL_UP_OCCUPANCY - 0.01 });
      game.advance(0.1);
    }
    expect(game.state.homeLevels).toEqual(cohort(24));
    // And it is the gate doing it, not a lack of anything to promote.
    expect(game.state.homeLevels[0]).toBe(24);
  });

  it('never moves a building more than one level in a pass', () => {
    // The bug a naive accumulator has: bank sixty seconds of promotions and
    // spend them one at a time, and the first building walks from level 0 to
    // level 3 inside a single call. Checked at the coarsest step the game ever
    // takes, which is where the budget per pass is largest.
    const game = at(ready());
    let before = [...game.state.homeLevels];
    for (let i = 0; i < 60; i++) {
      // Exactly one pass: `catchUp` steps CATCHUP_STEP_SECONDS at a time, so a
      // longer call would be several passes and could legitimately move a
      // building twice.
      game.catchUp(CATCHUP_STEP_SECONDS);
      const after = game.state.homeLevels;
      for (let l = LEVELS - 1; l > 0; l--) {
        // Nothing can arrive at level l that was not sitting at l-1 beforehand.
        const arrived = (after[l] ?? 0) - (before[l] ?? 0);
        if (arrived > 0) expect(arrived).toBeLessThanOrEqual(before[l - 1] ?? 0);
      }
      before = [...after];
    }
    expect(cohortTotal(game.state.homeLevels)).toBe(game.state.homes);
  });

  it('raises the population it houses without adding a plot', () => {
    const game = at(ready());
    const before = residents(game.state);
    run(game, 1_800);
    // Not a plot. The building count falls as pairs merge; the land is exactly
    // what it was, which is the claim this test is making.
    expect(plotsOf(game.state, 'home')).toBe(24);
    expect(game.state.homes).toBeLessThan(24);
    expect(residents(game.state)).toBeGreaterThan(before);
    // And the population is exactly what the cohorts say it is.
    let people = 0;
    for (let l = 0; l < LEVELS; l++) {
      people += (game.state.homeLevels[l] ?? 0) * (LEVEL_HOUSING[l] ?? 0);
    }
    expect(residents(game.state)).toBeCloseTo(people * game.state.occupancyR, 9);
  });
});
