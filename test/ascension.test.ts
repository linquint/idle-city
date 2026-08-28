import { describe, expect, it } from 'vitest';
import {
  LEGACY_YIELD,
  MAX_DISTRICTS,
  RANKS,
  RANK_GATES,
  START_CASH,
  type CityRank,
} from '../src/sim/config';
import {
  ascendBlocker,
  canAscend,
  cityRank,
  income,
  legacyGain,
  legacyMultiplier,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import {
  CityLayout,
  cityRadius,
  districtCoord,
  districtLayoutAt,
  isRoad,
  zoneAt,
} from '../src/sim/layout';
import { migrate } from '../src/sim/save';
import { WATERS } from '../src/sim/water';
import { createState, SAVE_VERSION, type GameState } from '../src/sim/state';
import { atRank, housed, served, trading } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/** A city big enough to be given up, with something in the treasury. */
const foundable = (patch: Partial<GameState> = {}): GameState =>
  state({
    ...atRank(RANK_GATES.ascend, 6),
    ...trading(40),
    ...served(),
    cash: 5_000,
    elapsed: 9_000,
    happiness: 0.9,
    cityHall: true,
    autoDevelop: true,
    taxRate: 3,
    unlocked: { 'first-home': 12 },
    ...patch,
  });

describe('the map is the same map, which is what the feature rests on', () => {
  /**
   * A fingerprint of everything the world is made of, at a given size.
   *
   * SEED is a compile-time constant, so this is meant to be identical for every
   * city that has ever been drawn — the water, the annexation spiral, the
   * street walks and the zoning. It is asserted anyway, because it is the
   * property the whole feature rests on and a property nobody checks is a
   * property that will be broken by something unrelated.
   */
  const fingerprint = (districts: number): string => {
    const parts: string[] = [];
    parts.push(`${WATERS.coast.axis}${WATERS.coast.sign}:${WATERS.riverSide}`);
    parts.push(WATERS.lakes.map((lake) => JSON.stringify(lake)).join(','));
    for (let i = 0; i < districts; i++) {
      const at = districtCoord(i);
      const plan = districtLayoutAt(at.x, at.z);
      parts.push(`${at.x},${at.z}|${plan.rowRoad.join('')}|${plan.colRoad.join('')}|${plan.zone.join('')}`);
    }
    parts.push(String(cityRadius(districts)));
    // And the global reads the renderer and the camera use, which go through
    // their own caches and could in principle disagree with the plans above.
    for (let x = -20; x <= 20; x += 3) {
      for (let z = -20; z <= 20; z += 3) parts.push(`${isRoad(x, z) ? 1 : 0}${zoneAt(x, z)}`);
    }
    return parts.join(';');
  };

  it('draws a city founded twice exactly as it draws one founded once', () => {
    const once = fingerprint(MAX_DISTRICTS);
    const game = new Game(foundable({ districts: 12 }));
    expect(game.ascend()).toBe(true);
    expect(game.state.foundings).toBe(2);
    expect(fingerprint(MAX_DISTRICTS)).toBe(once);
    // And again, five foundings deep.
    for (let i = 0; i < 4; i++) {
      // Re-grown into a city worth giving up again, keeping what the last
      // founding left behind — which is what a player would actually do.
      Object.assign(
        game.state,
        foundable({
          districts: 12,
          legacy: game.state.legacy,
          foundings: game.state.foundings,
        }),
      );
      expect(game.ascend()).toBe(true);
    }
    expect(game.state.foundings).toBe(6);
    expect(fingerprint(MAX_DISTRICTS)).toBe(once);
  });

  it('rolls the layout caches back with it, so nothing is left standing', () => {
    const layout = new CityLayout();
    const big = foundable({ districts: 12 });
    layout.ensure(big);
    const spread = layout.districts.length;
    expect(spread).toBe(12);

    const game = new Game(big);
    game.ascend();
    layout.ensure(game.state);
    expect(game.state.districts).toBe(1);
    expect(layout.districts.length).toBe(1);
    // And the first district is the first district, still: the land the second
    // city opens on is byte-for-byte the land the first one opened on.
    const fresh = new CityLayout().ensure(createState(0));
    expect(JSON.stringify(layout.districts[0])).toBe(JSON.stringify(fresh.districts[0]));
    expect(JSON.stringify(layout.courtyards)).toBe(JSON.stringify(fresh.courtyards));
  });
});

describe('what survives a founding', () => {
  it('keeps exactly two numbers and nothing else', () => {
    const before = foundable({ districts: 9 });
    const game = new Game(before);
    expect(game.ascend()).toBe(true);
    const after = game.state;

    expect(after.foundings).toBe(before.foundings + 1);
    expect(after.legacy).toBe(before.legacy + legacyGain(before));

    // Everything else is a fresh city, down to the opening treasury.
    const fresh = createState(0);
    for (const key of Object.keys(fresh) as Array<keyof GameState>) {
      if (key === 'foundings' || key === 'legacy' || key === 'savedAt') continue;
      expect(JSON.stringify(after[key])).toBe(JSON.stringify(fresh[key]));
    }
    expect(after.cash).toBe(START_CASH);
    expect(after.districts).toBe(1);
    expect(after.elapsed).toBe(0);
    expect(after.unlocked).toEqual({});
    expect(after.autoDevelop).toBe(false);
  });

  it('leaves `reset` alone, so clearing a city really clears it', () => {
    const game = new Game(foundable({ districts: 9, legacy: 40, foundings: 3 }));
    game.reset();
    expect(game.state.foundings).toBe(1);
    expect(game.state.legacy).toBe(0);
    expect(legacyMultiplier(game.state)).toBe(1);
  });

  it('refuses when the city is too small to be worth giving up', () => {
    const village = state({ districts: 1 });
    expect(canAscend(village)).toBe(false);
    const needed = RANKS[RANK_GATES.ascend] as CityRank;
    expect(ascendBlocker(village)).toBe(`Needs a ${needed.name.toLowerCase()}`);
    const game = new Game(village);
    expect(game.ascend()).toBe(false);
    expect(game.state.districts).toBe(1);
    expect(game.state.foundings).toBe(1);
  });

  it('opens the gate at the rank the ladder says', () => {
    const ready = foundable();
    expect(cityRank(ready).index).toBeGreaterThanOrEqual(RANK_GATES.ascend);
    expect(canAscend(ready)).toBe(true);
    expect(ascendBlocker(ready)).toBeNull();
  });
});

describe('the carryover', () => {
  it('is exactly 1 for a city that has never been founded again', () => {
    expect(legacyMultiplier(createState(0))).toBe(1);
    // Which is what keeps every constant in the game meaning what it was
    // measured with: run 1 is the game as it was before this existed.
    const plain = foundable({ legacy: 0 });
    const legacyless = income(plain);
    expect(legacyless).toBe(income({ ...plain, legacy: 0, foundings: 1 }));
  });

  it('compounds sublinearly, so four runs are not four times one', () => {
    const one = legacyMultiplier({ legacy: MAX_DISTRICTS }) - 1;
    const four = legacyMultiplier({ legacy: MAX_DISTRICTS * 4 }) - 1;
    expect(four).toBeCloseTo(one * 2, 6);
    // Monotone, and never below 1.
    let last = 0;
    for (const legacy of [0, 1, 10, 49, 200, 2_401]) {
      const m = legacyMultiplier({ legacy });
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeGreaterThan(last);
      last = m;
    }
    expect(legacyMultiplier({ legacy: MAX_DISTRICTS })).toBeCloseTo(
      1 + LEGACY_YIELD * Math.sqrt(MAX_DISTRICTS),
      9,
    );
  });

  it('multiplies the whole ledger and nothing else', () => {
    const plain = foundable({ legacy: 0, foundings: 1 });
    const legacied = { ...plain, legacy: MAX_DISTRICTS, foundings: 2 };
    expect(income(legacied)).toBeCloseTo(income(plain) * legacyMultiplier(legacied), 6);
    // It is not a cash grant: the second city opens on START_CASH like the first.
    const game = new Game(foundable({ districts: 12 }));
    game.ascend();
    expect(game.state.cash).toBe(START_CASH);
  });

  it('is bounded by what the runs before it could have given up', () => {
    // A doctored save cannot claim a legacy no run could have earned.
    const doctored = migrate({
      ...state({ districts: 4, ...housed(8) }),
      version: SAVE_VERSION,
      foundings: 2,
      legacy: 1e9,
    });
    expect(doctored).not.toBeNull();
    expect((doctored as GameState).legacy).toBe(MAX_DISTRICTS);
  });
});

describe('an older save opens as the city it was', () => {
  it('defaults a v12 city to one founding and nothing behind it', () => {
    const old = { ...state({ districts: 5, ...housed(20) }), version: 12 } as Record<string, unknown>;
    delete old['foundings'];
    delete old['legacy'];
    const back = migrate(old);
    expect(back).not.toBeNull();
    const s = back as GameState;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.foundings).toBe(1);
    expect(s.legacy).toBe(0);
    // Which is the only reading that could be right: the multiplier is 1, so
    // the city earns exactly what it earned before this feature existed.
    expect(legacyMultiplier(s)).toBe(1);
  });

  it('round-trips a founded city through the migration unchanged', () => {
    const s = state({ ...atRank(RANK_GATES.ascend, 6), foundings: 4, legacy: 90 });
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back).not.toBeNull();
    expect((back as GameState).foundings).toBe(4);
    expect((back as GameState).legacy).toBe(90);
  });
});
