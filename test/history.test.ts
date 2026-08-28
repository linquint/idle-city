import { describe, expect, it } from 'vitest';
import {
  HISTORY_COARSE_SECONDS,
  HISTORY_FINE_SECONDS,
  HISTORY_SAMPLES,
  HISTORY_VALUE_MAX,
  advance,
  decodeMood,
  decodeValue,
  emptyHistory,
  emptyTier,
  encodeMood,
  encodeValue,
  migrateHistory,
  migrateTier,
  push,
  readTier,
  tierLength,
  type HistorySample,
} from '../src/sim/history';
import { LEVELS, MAX_DISTRICTS, OFFLINE_CAP_SECONDS } from '../src/sim/config';
import { homeCapacity, industryCapacity, shopCapacity } from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { migrate } from '../src/sim/save';
import { createState, SAVE_VERSION, type GameState } from '../src/sim/state';
import { housedOn, making, served, trading, zoning } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/** Advances a game in frames, since `Game.advance` clamps one call to 0.25s. */
function run(game: Game, seconds: number, step = 0.1): void {
  const frames = Math.round(seconds / step);
  for (let i = 0; i < frames; i++) game.advance(step);
}

const sample = (population: number, income: number, happiness: number): HistorySample => ({
  population,
  income,
  happiness,
});

describe('the value encoding', () => {
  it('round-trips three significant figures across the whole range', () => {
    for (const v of [1, 1.23, 9.99, 54.2, 719, 10_944, 1.85e6, 9.04e9, 1e12, 1e-6, 5.5e-11]) {
      const back = decodeValue(encodeValue(v));
      expect(back).toBeGreaterThan(0);
      // Three significant figures is half a percent at worst.
      expect(Math.abs(back - v) / v).toBeLessThanOrEqual(0.005);
    }
  });

  it('takes exactly three characters, whatever it is given', () => {
    for (const v of [0, 1, 1e-30, 1e30, Number.NaN, Number.POSITIVE_INFINITY, -5]) {
      expect(encodeValue(v)).toHaveLength(3);
    }
  });

  it('reads zero, NaN and anything negative as nothing', () => {
    for (const v of [0, -1, -1e9, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(encodeValue(v)).toBe('000');
      expect(decodeValue(encodeValue(v))).toBe(0);
    }
  });

  it('pins rather than wraps at both ends of the range', () => {
    // Above the top: the largest number the chart can draw, not a tiny one.
    expect(decodeValue(encodeValue(1e30))).toBeCloseTo(HISTORY_VALUE_MAX, -20);
    expect(decodeValue(encodeValue(Number.POSITIVE_INFINITY))).toBeCloseTo(HISTORY_VALUE_MAX, -20);
    // Below the bottom: zero, because a chart cannot show 1e-40 either way.
    expect(encodeValue(1e-40)).toBe('000');
  });

  it('carries a mantissa that rounds up into the next decade', () => {
    // 9.999 rounds to 1000, which is 1.00 a decade higher.
    const back = decodeValue(encodeValue(9.999));
    expect(back).toBeCloseTo(10, 5);
  });

  it('decodes junk as nothing rather than throwing', () => {
    for (const code of ['', 'a', 'abcd', '!!!', '00']) {
      expect(decodeValue(code)).toBe(0);
    }
  });
});

describe('the happiness encoding', () => {
  it('round-trips a share to within one step', () => {
    for (const v of [0, 0.01, 0.25, 0.5, 0.82, 0.99, 1]) {
      expect(Math.abs(decodeMood(encodeMood(v)) - v)).toBeLessThanOrEqual(1 / 35 / 2 + 1e-9);
    }
  });

  it('takes one character and clamps anything outside [0, 1]', () => {
    for (const v of [-1, 0, 1, 5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(encodeMood(v)).toHaveLength(1);
    }
    expect(decodeMood(encodeMood(-1))).toBe(0);
    expect(decodeMood(encodeMood(5))).toBe(1);
    expect(decodeMood(encodeMood(Number.NaN))).toBe(0);
  });
});

describe('the ring', () => {
  it('fills, then overwrites the oldest, and never grows', () => {
    const tier = emptyTier();
    for (let i = 1; i <= HISTORY_SAMPLES; i++) push(tier, sample(i, i, 0.5));
    expect(tierLength(tier)).toBe(HISTORY_SAMPLES);
    expect(tier.happiness).toHaveLength(HISTORY_SAMPLES);
    expect(tier.population).toHaveLength(HISTORY_SAMPLES * 3);

    let read = readTier(tier);
    expect(read).toHaveLength(HISTORY_SAMPLES);
    expect(read[0]?.population).toBeCloseTo(1, 5);
    expect(read[HISTORY_SAMPLES - 1]?.population).toBeCloseTo(HISTORY_SAMPLES, 5);

    // One more lap: the length is unchanged and the oldest is gone.
    for (let i = 1; i <= 10; i++) push(tier, sample(1000 + i, 1000 + i, 0.5));
    expect(tier.happiness).toHaveLength(HISTORY_SAMPLES);
    read = readTier(tier);
    expect(read).toHaveLength(HISTORY_SAMPLES);
    expect(read[0]?.population).toBeCloseTo(11, 5);
    expect(read[HISTORY_SAMPLES - 1]?.population).toBeCloseTo(1010, 5);
  });

  it('reads a partly filled ring oldest first', () => {
    const tier = emptyTier();
    for (const v of [3, 1, 4, 1, 5]) push(tier, sample(v, v * 2, 0.5));
    const read = readTier(tier);
    expect(read.map((r) => Math.round(r.population))).toEqual([3, 1, 4, 1, 5]);
    expect(read.map((r) => Math.round(r.income))).toEqual([6, 2, 8, 2, 10]);
  });

  it('banks time and spends whole intervals out of it', () => {
    const tier = emptyTier();
    expect(advance(tier, 59, HISTORY_FINE_SECONDS, sample(1, 1, 1))).toBe(0);
    expect(advance(tier, 1, HISTORY_FINE_SECONDS, sample(1, 1, 1))).toBe(1);
    expect(tier.clock).toBeCloseTo(0, 9);
    // A step worth ten intervals spends ten of them.
    expect(advance(tier, HISTORY_FINE_SECONDS * 10, HISTORY_FINE_SECONDS, sample(1, 1, 1))).toBe(10);
  });

  it('never spins more than one lap, however absurd the step', () => {
    const tier = emptyTier();
    expect(advance(tier, 1e9, HISTORY_FINE_SECONDS, sample(1, 1, 1))).toBe(HISTORY_SAMPLES);
    expect(tierLength(tier)).toBe(HISTORY_SAMPLES);
  });
});

describe('step-size invariance', () => {
  /**
   * A city with nothing left to promote, fully served, paying its wages.
   *
   * At the top of the ladder on purpose, and the measurement is the reason. The
   * *sampler* is invariant by construction — `advance` banks seconds and spends
   * whole intervals, exactly as `surveyClock` does — but the levelling pass is
   * not, and never has been: `spendDrift` makes one ordered sweep with whatever
   * budget the step banked, so a 60-second catch-up step promotes a cohort at a
   * time where 600 tenth-second ticks promote a building at a time and
   * recompute `promotable` in between. Measured over an hour of a level-0
   * city, that is worth 41% of income and 23% of population by the end of the
   * run — a real property of the simulation, and nothing to do with this file.
   *
   * So the city is put where promotion cannot run, and what is left to differ is
   * the encoding's own rounding. Measured there: 0.66% of income and 0.98% of
   * population at worst, against a quantisation step of half a percent each side.
   */
  const base = (): GameState =>
    state({
      ...zoning(4),
      ...housedOn(96, LEVELS - 1),
      ...trading(60, LEVELS - 1),
      ...making(24, LEVELS - 1),
      ...served(),
      cash: 1e12,
    });

  it('writes the same characters at two step sizes, given the same city', () => {
    // The sampler on its own, with the simulation taken out of it entirely: a
    // constant reading, banked at a tenth of a second and at a minute.
    const ticked = emptyTier();
    const stepped = emptyTier();
    const reading = sample(1234, 56.78, 0.5);
    for (let i = 0; i < 600 * 5; i++) advance(ticked, 0.1, HISTORY_FINE_SECONDS, reading);
    for (let i = 0; i < 5; i++) advance(stepped, 60, HISTORY_FINE_SECONDS, reading);
    expect(ticked.population).toBe(stepped.population);
    expect(ticked.income).toBe(stepped.income);
    expect(ticked.happiness).toBe(stepped.happiness);
    expect(ticked.head).toBe(stepped.head);
    expect(tierLength(ticked)).toBe(5);
  });

  it('samples the same number of points either way', () => {
    const watched = new Game(base());
    const away = new Game(base());
    run(watched, 3600);
    away.catchUp(3600);
    expect(tierLength(watched.state.history.fine)).toBe(3600 / HISTORY_FINE_SECONDS);
    expect(tierLength(away.state.history.fine)).toBe(tierLength(watched.state.history.fine));
    expect(watched.state.elapsed).toBeCloseTo(away.state.elapsed, 6);
  });

  it('lands on the same series, to within a quantisation step', () => {
    const watched = new Game(base());
    const away = new Game(base());
    run(watched, 3600);
    away.catchUp(3600);
    const a = readTier(watched.state.history.fine);
    const b = readTier(away.state.history.fine);
    expect(b).toHaveLength(a.length);
    for (let i = 0; i < a.length; i++) {
      const left = a[i] as HistorySample;
      const right = b[i] as HistorySample;
      // One quantisation step of the encoding: three significant figures, so
      // half a percent, doubled to allow each side its own rounding.
      expect(Math.abs(right.population - left.population)).toBeLessThanOrEqual(
        Math.max(1e-9, left.population * 0.01),
      );
      expect(Math.abs(right.income - left.income)).toBeLessThanOrEqual(
        Math.max(1e-9, left.income * 0.01),
      );
      expect(Math.abs(right.happiness - left.happiness)).toBeLessThanOrEqual(1 / 35 + 1e-9);
    }
  });

  it('gives the coarse tier a view a full absence cannot erase', () => {
    const game = new Game(base());
    game.catchUp(OFFLINE_CAP_SECONDS);
    // Twelve hours is 24 coarse samples against a ring of 120, so the long view
    // survives being away — which is the whole reason there are two tiers.
    const written = OFFLINE_CAP_SECONDS / HISTORY_COARSE_SECONDS;
    expect(written).toBeLessThan(HISTORY_SAMPLES);
    expect(tierLength(game.state.history.coarse)).toBe(written);
    // And the fine tier is completely overwritten by the same absence, which is
    // the thing the coarse tier exists to survive.
    expect(tierLength(game.state.history.fine)).toBe(HISTORY_SAMPLES);
  });
});

describe('the chart never reaches the simulation', () => {
  it('runs a city identically whether its rings are full or empty', () => {
    const base = (): GameState =>
      state({ ...housedOn(24), ...trading(20), ...served(), cash: 5e4 });
    const blank = new Game(base());
    const charted = new Game(base());
    // Fill one game's rings by hand before either runs.
    for (let i = 0; i < HISTORY_SAMPLES; i++) {
      push(charted.state.history.fine, sample(i, i * 10, i / HISTORY_SAMPLES));
      push(charted.state.history.coarse, sample(i, i * 10, i / HISTORY_SAMPLES));
    }
    run(blank, 60);
    run(charted, 60);
    const numbers = (s: Readonly<GameState>): Record<string, number> => ({
      cash: s.cash,
      earned: s.earned,
      homes: s.homes,
      happiness: s.happiness,
      demandR: s.demandR,
      occupancyR: s.occupancyR,
    });
    expect(numbers(charted.state)).toEqual(numbers(blank.state));
  });

  it('does not share rings between two states spread from one patch', () => {
    const shared: Partial<GameState> = { ...housedOn(24), history: emptyHistory() };
    const a = new Game(state(shared));
    const b = new Game(state(shared));
    run(a, HISTORY_FINE_SECONDS + 1);
    expect(tierLength(a.state.history.fine)).toBe(1);
    expect(tierLength(b.state.history.fine)).toBe(0);
  });
});

describe('migration', () => {
  it('opens a v11 save with empty rings', () => {
    const loaded = migrate({ version: 11, homes: 3, homeLevels: [3, 0, 0, 0, 0] }, 0);
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(tierLength(loaded?.history.fine ?? emptyTier())).toBe(0);
    expect(tierLength(loaded?.history.coarse ?? emptyTier())).toBe(0);
  });

  it('round-trips a full ring through JSON', () => {
    const game = new Game(state({ ...zoning(4), ...housedOn(96), ...served() }));
    game.catchUp(HISTORY_FINE_SECONDS * 30);
    const before = readTier(game.state.history.fine);
    expect(before.length).toBe(30);
    const loaded = migrate(JSON.parse(JSON.stringify(game.state)), 0);
    expect(loaded).not.toBeNull();
    if (!loaded) return;
    const after = readTier(loaded.history.fine);
    expect(after).toEqual(before);
    expect(loaded.history.fine.head).toBe(game.state.history.fine.head);
  });

  it('drops a ring rather than throwing on anything malformed', () => {
    const good = { head: 0, clock: 0, population: '100', income: '100', happiness: 'z' };
    expect(tierLength(migrateTier(good, HISTORY_FINE_SECONDS))).toBe(1);
    for (const bad of [
      null,
      7,
      'ring',
      {},
      // Series that disagree about how many samples they hold.
      { ...good, income: '100100' },
      // Longer than the ring.
      {
        head: 0,
        clock: 0,
        population: '100'.repeat(HISTORY_SAMPLES + 1),
        income: '100'.repeat(HISTORY_SAMPLES + 1),
        happiness: 'z'.repeat(HISTORY_SAMPLES + 1),
      },
      // Characters outside base36.
      { ...good, population: '1!0' },
      { ...good, happiness: 'Z' },
    ]) {
      expect(tierLength(migrateTier(bad, HISTORY_FINE_SECONDS))).toBe(0);
    }
  });

  it('clamps a head and a bank a doctored save put out of range', () => {
    const full = emptyTier();
    for (let i = 0; i < HISTORY_SAMPLES; i++) push(full, sample(i + 1, i + 1, 0.5));
    const loaded = migrateTier({ ...full, head: 9_999, clock: 1e9 }, HISTORY_FINE_SECONDS);
    expect(loaded.head).toBeLessThan(HISTORY_SAMPLES);
    expect(loaded.clock).toBeLessThanOrEqual(HISTORY_FINE_SECONDS);
    // And a partly filled ring writes at its end whatever the save claims.
    const partial = emptyTier();
    push(partial, sample(1, 1, 1));
    expect(migrateTier({ ...partial, head: 77 }, HISTORY_FINE_SECONDS).head).toBe(1);
  });

  it('survives a history that is not an object', () => {
    for (const junk of [null, 7, 'no', [1, 2]]) {
      const h = migrateHistory(junk);
      expect(tierLength(h.fine)).toBe(0);
      expect(tierLength(h.coarse)).toBe(0);
    }
  });
});

describe('what it costs the save', () => {
  /** A full 49-district city, at the top of the ladder, with both rings full. */
  function charted(): Game {
    const bare = state({ ...zoning(MAX_DISTRICTS) });
    const game = new Game(
      state({
        ...zoning(MAX_DISTRICTS),
        ...housedOn(homeCapacity(bare), LEVELS - 1),
        ...trading(shopCapacity(bare), LEVELS - 1),
        ...making(industryCapacity(bare), LEVELS - 1),
        ...served(),
        cash: 1e12,
        earned: 1e15,
      }),
    );
    for (let i = 0; i < HISTORY_SAMPLES; i++) {
      const s: HistorySample = {
        population: 700_000 * (i / HISTORY_SAMPLES),
        income: 9.04e9 * (i / HISTORY_SAMPLES),
        happiness: i / HISTORY_SAMPLES,
      };
      push(game.state.history.fine, s);
      push(game.state.history.coarse, s);
    }
    return game;
  }

  it('stays inside its budget with both rings full', () => {
    const game = charted();
    const bytes = JSON.stringify(game.state).length;
    const rings = JSON.stringify(game.state.history).length;
    // Printed rather than only asserted: the budget is the reason the encoding
    // exists, so a change to it should be visible in the run rather than only in
    // a failure. Measured at the time of writing: 3,196 bytes total, of which
    // 1,760 are the two rings.
    // eslint-disable-next-line no-console
    console.log(`save: ${bytes} B total, ${rings} B of rings`);
    expect(rings).toBeLessThan(2_048);
    expect(bytes).toBeLessThan(3_400);
  });

  it('is far smaller than the same series as JSON numbers', () => {
    const game = charted();
    const packed = JSON.stringify(game.state.history).length;
    const raw = JSON.stringify({
      fine: readTier(game.state.history.fine),
      coarse: readTier(game.state.history.coarse),
    }).length;
    // The measurement the encoding was chosen off: raw numbers are several
    // times the size of the rest of the save.
    expect(packed).toBeLessThan(raw / 3);
  });
});
