import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_COUNT,
  ACHIEVEMENT_GROUPS,
  ACHIEVEMENT_TEST_SECONDS,
  achievementReadings,
  unlockedAt,
  unlockedCount,
} from '../src/sim/achievements';
import { LEVELS, MAX_DISTRICTS, MERGE_LEVEL, TAX_STEPS } from '../src/sim/config';
import { annexCost, homeCapacity, industryCapacity, shopCapacity } from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { migrate } from '../src/sim/save';
import { createState, SAVE_VERSION, type GameState } from '../src/sim/state';
import { housedOn, making, served, trading, zoning } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/**
 * A city at the top of everything: all the land, all the buildings, all the
 * services, at the top of the ladder.
 *
 * Built from the capacities rather than from literals so it stays a *full* city
 * if the plot budget ever moves.
 */
function fullCity(patch: Partial<GameState> = {}): GameState {
  const bare = state({ ...zoning(MAX_DISTRICTS) });
  return state({
    ...zoning(MAX_DISTRICTS),
    ...housedOn(homeCapacity(bare), LEVELS - 1),
    ...trading(shopCapacity(bare), LEVELS - 1),
    ...making(industryCapacity(bare), LEVELS - 1),
    ...served(),
    // `served()` is sized for a district or two; a 49-district city has 1,176
    // housing plots and needs an order of magnitude more of everything before
    // any coverage reads a full 1. Deliberately far past what the land holds —
    // `migrate` is what clamps a save, and a state built by hand is not one.
    hospitals: 400,
    police: 400,
    fire: 400,
    schools: 400,
    universities: 400,
    parks: 4_000,
    depots: 400,
    depotStaff: 1,
    cityHall: true,
    highway: true,
    airport: true,
    estates: 4,
    happiness: 1,
    cash: 1e15,
    earned: 1e15,
    ...patch,
  });
}

/**
 * Advances a game by `seconds` of wall clock, a frame at a time.
 *
 * `Game.advance` clamps a single call to 0.25s — a frame that long is a stall,
 * and crediting a tab-switch worth of time in one go is what `catchUp` is for —
 * so a test that wants a second of simulated time has to ask for it in frames.
 */
function run(game: Game, seconds: number): void {
  const frames = Math.ceil(seconds / 0.1);
  for (let i = 0; i < frames; i++) game.advance(0.1);
}

/** Every array and object in a state, frozen, so a test that writes throws. */
function deepFreeze(s: GameState): GameState {
  Object.freeze(s.homeLevels);
  Object.freeze(s.shopLevels);
  Object.freeze(s.industryLevels);
  Object.freeze(s.surveyedR);
  Object.freeze(s.surveyedC);
  Object.freeze(s.surveyedI);
  Object.freeze(s.fires);
  Object.freeze(s.unlocked);
  return Object.freeze(s);
}

describe('the achievement table', () => {
  it('has a unique key for every row', () => {
    const keys = new Set(ACHIEVEMENTS.map((a) => a.key));
    expect(keys.size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENT_COUNT).toBe(ACHIEVEMENTS.length);
  });

  it('puts every row in a group the panel knows how to head', () => {
    const groups = new Set(ACHIEVEMENT_GROUPS.map((g) => g.key));
    for (const achievement of ACHIEVEMENTS) {
      expect(groups.has(achievement.group)).toBe(true);
    }
    // Every group earns its heading — an empty section would be a heading with
    // nothing under it.
    for (const group of ACHIEVEMENT_GROUPS) {
      expect(ACHIEVEMENTS.some((a) => a.group === group.key)).toBe(true);
    }
  });

  it('gives every row a name and an instruction', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.name.length).toBeGreaterThan(0);
      expect(achievement.note.length).toBeGreaterThan(0);
      expect(achievement.key).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('grants nothing: a row carries a test and no payout', () => {
    for (const achievement of ACHIEVEMENTS) {
      // The shape is the guarantee. A bonus would have to arrive as a field,
      // and there is nowhere for one to go.
      expect(Object.keys(achievement).sort()).toEqual(['group', 'key', 'name', 'note', 'test']);
    }
  });
});

describe('a test is a pure read over the state', () => {
  it('never writes to the state it is handed, and answers the same twice', () => {
    for (const build of [state(), fullCity(), state({ ...housedOn(24), districts: 3 })]) {
      const frozen = deepFreeze(build);
      for (const achievement of ACHIEVEMENTS) {
        const first = achievement.test(frozen);
        const second = achievement.test(frozen);
        expect(second).toBe(first);
        expect(typeof first).toBe('boolean');
      }
    }
  });

  it('reads nothing the save does not carry', () => {
    // Two states built from the same fields are the same city, so every test
    // has to agree about them. A test reaching for a tally on `Game`, a wall
    // clock or a renderer would disagree here.
    const a = fullCity();
    const b = fullCity();
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.test(b)).toBe(achievement.test(a));
    }
  });
});

describe('what a city has earned', () => {
  it('unlocks nothing at all for a fresh city', () => {
    const fresh = state();
    expect(fresh.unlocked).toEqual({});
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.test(fresh)).toBe(false);
    }
  });

  it('unlocks the stated subset for a fully built city', () => {
    const s = fullCity();
    const earned = ACHIEVEMENTS.filter((a) => a.test(s)).map((a) => a.key);
    for (const key of [
      'first-home',
      'homes-10',
      'homes-100',
      'homes-1000',
      'first-merge',
      'first-tower',
      'top-level',
      'districts-2',
      'districts-5',
      'districts-14',
      'districts-max',
      'coastal',
      'highway',
      'airport',
      'first-estate',
      'first-hospital',
      'city-hall',
      'all-civic',
      'educated',
      'model-city',
      'earned-1k',
      'earned-1m',
      'earned-1b',
    ]) {
      expect(earned, `${key} should be earned by a fully built city`).toContain(key);
    }
    // Nothing is burning and nothing is boarded up, so the two adversity rows
    // that are about being *in* trouble stay locked however complete the city is.
    expect(earned).not.toContain('fire-held');
    expect(earned).not.toContain('recovering');
    // And `funded` is about being able to buy the *next* district, which a city
    // at the limit has no way to be — see the row below, which is where it fires.
    expect(earned).not.toContain('funded');
  });

  it('unlocks "funded" when the treasury covers the next district', () => {
    const row = ACHIEVEMENTS.find((a) => a.key === 'funded');
    expect(row).toBeDefined();
    if (!row) return;
    const growing = state({ ...zoning(3), ...housedOn(72) });
    expect(row.test({ ...growing, cash: 0 })).toBe(false);
    expect(row.test({ ...growing, cash: annexCost(growing) })).toBe(true);
    // One district is not an annexation, however deep the treasury is.
    const opening = state({ ...housedOn(24), cash: 1e12 });
    expect(row.test(opening)).toBe(false);
  });

  it('unlocks the punitive row only at the top rate with the mood to match', () => {
    const punitive = TAX_STEPS.reduce(
      (top, step, i) => (step.income > (TAX_STEPS[top]?.income ?? 0) ? i : top),
      0,
    );
    const row = ACHIEVEMENTS.find((a) => a.key === 'punitive-and-happy');
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.test(fullCity({ cityHall: true, taxRate: punitive, happiness: 0.9 }))).toBe(true);
    expect(row.test(fullCity({ cityHall: true, taxRate: punitive, happiness: 0.7 }))).toBe(false);
    // No hall, no policy: `taxStep` reads neutral however the field is set.
    expect(row.test(fullCity({ cityHall: false, taxRate: punitive, happiness: 0.9 }))).toBe(false);
  });

  it('counts what is unlocked, and reports when', () => {
    const s = state({ unlocked: { 'first-home': 42 } });
    expect(unlockedCount(s)).toBe(1);
    expect(unlockedAt(s, 'first-home')).toBe(42);
    expect(unlockedAt(s, 'homes-10')).toBeUndefined();
    const readings = achievementReadings(s);
    expect(readings).toHaveLength(ACHIEVEMENT_COUNT);
    expect(readings.find((r) => r.achievement.key === 'first-home')?.at).toBe(42);
    expect(readings.find((r) => r.achievement.key === 'homes-10')?.at).toBeNull();
  });
});

describe('the record the simulation keeps', () => {
  it('fills in on the first pass and stamps the elapsed it fired at', () => {
    const game = new Game(state({ ...housedOn(24), cash: 0 }));
    expect(game.state.unlocked['first-home']).toBeUndefined();
    run(game, ACHIEVEMENT_TEST_SECONDS + 0.5);
    expect(game.state.unlocked['first-home']).toBeGreaterThanOrEqual(0);
    expect(game.state.unlocked['first-home']).toBeLessThanOrEqual(game.state.elapsed);
    expect(game.state.unlocked['homes-10']).toBeGreaterThanOrEqual(0);
    expect(game.state.unlocked['homes-100']).toBeUndefined();
  });

  it('announces each unlock once, and never merges two into one line', () => {
    const game = new Game(state({ ...housedOn(24) }));
    run(game, ACHIEVEMENT_TEST_SECONDS + 0.5);
    const first = game.drainEvents().filter((e) => e.kind === 'unlocked');
    expect(first.length).toBeGreaterThan(1);
    // Each carries its own name and a count of exactly one — see `sameSubject`.
    for (const event of first) expect(event.count).toBe(1);
    expect(new Set(first.map((e) => (e.kind === 'unlocked' ? e.key : ''))).size).toBe(first.length);
    // And a second pass over the same city says nothing new.
    run(game, ACHIEVEMENT_TEST_SECONDS * 4);
    expect(game.drainEvents().filter((e) => e.kind === 'unlocked')).toHaveLength(0);
  });

  it('is silent during a catch-up but still records', () => {
    const game = new Game(state({ ...housedOn(24) }));
    const report = game.catchUp(600);
    expect(report.seconds).toBe(600);
    expect(game.state.unlocked['first-home']).toBeGreaterThanOrEqual(0);
    // Nothing announced: the away sheet is where an absence is reported.
    expect(game.drainEvents().filter((e) => e.kind === 'unlocked')).toHaveLength(0);
  });

  it('never grows past the table, whatever the city does', () => {
    const game = new Game(fullCity({ unlocked: {} }));
    game.catchUp(3600);
    expect(Object.keys(game.state.unlocked).length).toBeLessThanOrEqual(ACHIEVEMENT_COUNT);
    for (const key of Object.keys(game.state.unlocked)) {
      expect(ACHIEVEMENTS.some((a) => a.key === key)).toBe(true);
    }
  });

  it('is never read back: a city with the record filled runs identically', () => {
    const base = (): GameState => state({ ...housedOn(24), ...trading(20), ...served(), cash: 5e4 });
    const blank = new Game(base());
    const filled = new Game({
      ...base(),
      unlocked: Object.fromEntries(ACHIEVEMENTS.map((a) => [a.key, 0])),
    });
    run(blank, 20);
    run(filled, 20);
    const numbers = (s: Readonly<GameState>): Record<string, number> => ({
      cash: s.cash,
      earned: s.earned,
      homes: s.homes,
      shops: s.shops,
      industry: s.industry,
      happiness: s.happiness,
      demandR: s.demandR,
      demandC: s.demandC,
      demandI: s.demandI,
      occupancyR: s.occupancyR,
    });
    expect(numbers(filled.state)).toEqual(numbers(blank.state));
  });

  it('does not share a record between two states spread from one patch', () => {
    // The case the constructor's copy defends against, and the same one the
    // cohort arrays have always defended against: a partial spread into two
    // states hands both of them the *same* object, so without the copy one
    // game's unlocks would appear in the other's save.
    const shared: Partial<GameState> = { ...housedOn(24), unlocked: {} };
    const a = new Game(state(shared));
    const b = new Game(state(shared));
    run(a, ACHIEVEMENT_TEST_SECONDS + 0.5);
    expect(Object.keys(a.state.unlocked).length).toBeGreaterThan(0);
    expect(Object.keys(b.state.unlocked)).toHaveLength(0);
    expect(shared.unlocked).toEqual({});
  });
});

describe('migration', () => {
  it('opens a v10 save with an empty record and back-fills on the first pass', () => {
    // Everything a v10 save carried, and nothing this version added.
    const raw = {
      version: 10,
      cash: 900,
      elapsed: 4_000,
      homes: 24,
      homeLevels: [24, 0, 0, 0, 0],
      districts: 3,
      earned: 5_000,
      occupancyR: 1,
    };
    const loaded = migrate(raw, 0);
    expect(loaded).not.toBeNull();
    if (!loaded) return;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.unlocked).toEqual({});

    const game = new Game(loaded);
    run(game, ACHIEVEMENT_TEST_SECONDS + 0.5);
    // A city that had already earned these unlocks them at once, stamped with
    // the elapsed it is at now rather than with a history it never recorded.
    for (const key of ['first-home', 'homes-10', 'districts-2', 'earned-1k']) {
      expect(game.state.unlocked[key], key).toBeGreaterThanOrEqual(4_000);
    }
  });

  it('keeps a v11 record, clamped to the table and into the past', () => {
    const loaded = migrate(
      {
        version: SAVE_VERSION,
        elapsed: 100,
        homes: 1,
        homeLevels: [1, 0, 0, 0, 0],
        unlocked: {
          'first-home': 30,
          // Out of range, and a key the table does not have.
          'homes-10': 9_999,
          'no-such-award': 5,
          'earned-1k': Number.NaN,
        },
      },
      0,
    );
    expect(loaded).not.toBeNull();
    if (!loaded) return;
    expect(loaded.unlocked['first-home']).toBe(30);
    expect(loaded.unlocked['homes-10']).toBe(100);
    expect(loaded.unlocked['no-such-award']).toBeUndefined();
    expect(loaded.unlocked['earned-1k']).toBeUndefined();
  });

  it('survives a record that is not an object at all', () => {
    for (const junk of [null, 7, 'yes', [1, 2, 3], undefined]) {
      const loaded = migrate({ version: SAVE_VERSION, unlocked: junk }, 0);
      expect(loaded?.unlocked).toEqual({});
    }
  });
});

describe('the merge rung', () => {
  it('reads "first tower" off the level that takes two plots', () => {
    const row = ACHIEVEMENTS.find((a) => a.key === 'first-tower');
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.test(state({ ...housedOn(24, MERGE_LEVEL - 1) }))).toBe(false);
    expect(row.test(state({ ...housedOn(24, MERGE_LEVEL) }))).toBe(true);
    // Any zone counts, not only housing.
    expect(row.test(state({ ...trading(6, MERGE_LEVEL) }))).toBe(true);
  });
});
