import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_DISTRICTS, SERVICES, TIERS } from '../src/sim/config';
import {
  civicBuildings,
  happinessTarget,
  homeCapacity,
  industryCapacity,
  serviceAllowed,
  serviceCount,
  shopCapacity,
  siteCapacity,
} from '../src/sim/economy';
import { load, migrate, save, SAVE_KEY, secondsAway } from '../src/sim/save';
import { createState, SAVE_VERSION } from '../src/sim/state';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('round trip', () => {
  it('restores every field', () => {
    const state = { ...createState(0), cash: 1234.5, homes: 40, shops: 7, tier: 2, districts: 3 };
    const at = save(state, 5_000);
    const back = load(6_000);
    expect(back).not.toBeNull();
    expect(back).toMatchObject({ cash: 1234.5, homes: 40, shops: 7, tier: 2, districts: 3 });
    expect(back?.savedAt).toBe(at);
    expect(secondsAway(back!, 6_000)).toBe(1);
  });

  it('does not mutate the state handed to it', () => {
    const state = createState(0);
    save(state, 9_999);
    expect(state.savedAt).toBe(0);
  });

  it('returns null when there is nothing saved', () => {
    expect(load()).toBeNull();
  });

  it('survives a corrupted save rather than refusing to start', () => {
    localStorage.setItem(SAVE_KEY, '{not json');
    expect(load()).toBeNull();
  });

  it('runs without any storage at all', () => {
    Reflect.deleteProperty(globalThis, 'localStorage');
    expect(() => save(createState(0))).not.toThrow();
    expect(load()).toBeNull();
  });
});

describe('migration', () => {
  it('rejects things that are not saves', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('nope')).toBeNull();
    expect(migrate(42)).toBeNull();
  });

  it('fills in fields a older save never had', () => {
    const back = migrate({ cash: 10, homes: 4 }, 1_000);
    expect(back).toMatchObject({ cash: 10, homes: 4, shops: 0, tier: 0, districts: 1 });
    expect(back?.autoDevelop).toBe(false);
  });

  it('clamps a doctored save into something legal', () => {
    const back = migrate({
      cash: -5,
      homes: 1e9,
      shops: 1e9,
      tier: 99,
      districts: 1e6,
      elapsed: -1,
    });
    expect(back).not.toBeNull();
    expect(back!.cash).toBe(0);
    expect(back!.elapsed).toBe(0);
    expect(back!.tier).toBe(TIERS.length - 1);
    expect(back!.districts).toBe(MAX_DISTRICTS);
    expect(back!.homes).toBe(homeCapacity(back!));
    expect(back!.shops).toBe(shopCapacity(back!));
  });

  it('never leaves buildings on land the save no longer owns', () => {
    const back = migrate({ homes: 5_000, shops: 5_000, districts: 2 });
    expect(back!.homes).toBe(homeCapacity(back!));
    expect(back!.shops).toBe(shopCapacity(back!));
  });

  it('opens a v1 save and keeps what it had', () => {
    // What a v1 save actually looked like: no industry, no services, no demand.
    // 30 homes fits inside three districts' 57 housing plots, so the city comes
    // back whole rather than clamped.
    const v1 = {
      version: 1,
      cash: 12_345.6,
      elapsed: 900,
      homes: 30,
      shops: 9,
      tier: 2,
      districts: 3,
      earned: 50_000,
      autoDevelop: true,
      savedAt: 1_000,
    };
    const back = migrate(v1, 2_000);
    expect(back).toMatchObject({ cash: 12_345.6, homes: 30, shops: 9, tier: 2, districts: 3 });
    expect(back!.version).toBe(SAVE_VERSION);
    expect(back!.industry).toBe(0);
    expect(civicBuildings(back!)).toBe(0);
    expect(back!.hospitalStaff).toBe(0);
    expect([back!.demandR, back!.demandC, back!.demandI]).toEqual([0, 0, 0]);
  });

  it('reads a v1 save out of the key it was written under', () => {
    // A version bump moves the save; a player coming back to a new build has
    // not agreed to lose their city over it.
    localStorage.setItem('idle-city/save/v1', JSON.stringify({ cash: 77, homes: 5, districts: 2 }));
    expect(load(0)).toMatchObject({ cash: 77, homes: 5, districts: 2 });
  });

  it('clamps a doctored demand rather than handing out free buildings', () => {
    const back = migrate({ demandR: 50, demandC: -900, demandI: NaN });
    expect(back!.demandR).toBe(1);
    expect(back!.demandC).toBe(-1);
    expect(back!.demandI).toBe(0);
  });

  it('clamps homes before it clamps civic counts', () => {
    // This order, and not the other: `serviceAllowed` is measured against the
    // population, so a save claiming a million homes would otherwise buy itself
    // a million residents' worth of hospitals on the way past.
    const back = migrate({
      hospitals: 1e9,
      police: 1e9,
      fire: 1e9,
      homes: 1e9,
      industry: 1e9,
    })!;
    expect(back.homes).toBe(homeCapacity(back));
    expect(back.industry).toBe(industryCapacity(back));
    for (const service of SERVICES) {
      expect(serviceCount(back, service.key)).toBe(serviceAllowed(back, service));
      expect(serviceCount(back, service.key)).toBeLessThanOrEqual(siteCapacity(back, service.key));
    }
  });

  it('clamps a doctored civic count to what the population allows', () => {
    // 400 hospitals in a city of 76 people gets the one it is entitled to.
    const back = migrate({ hospitals: 400, homes: 19 })!;
    expect(back.hospitals).toBe(1);
    expect(back.hospitals).toBe(serviceAllowed(back, SERVICES[0]!));
  });

  it('clamps staffing into [0, 1] and defaults it to nothing', () => {
    const doctored = migrate({ hospitals: 1, hospitalStaff: 9, policeStaff: -4 })!;
    expect(doctored.hospitalStaff).toBe(1);
    expect(doctored.policeStaff).toBe(0);
    expect(doctored.fireStaff).toBe(0);
    expect(migrate({ hospitalStaff: NaN })!.hospitalStaff).toBe(0);
  });

  it('defaults happiness to the cover the city actually has', () => {
    // Not to the fresh-city 1: that would be ninety seconds of free housing
    // every time the player reloaded.
    const neglected = migrate({ homes: 12 })!;
    expect(neglected.happiness).toBe(0);
    expect(neglected.happiness).toBe(happinessTarget(neglected));

    const empty = migrate({ cash: 5 })!;
    expect(empty.happiness).toBe(1);

    const doctored = migrate({ homes: 12, happiness: 4 })!;
    expect(doctored.happiness).toBe(1);
  });

  it('keeps a v2 city its civic buildings instead of deleting them', () => {
    // v2 called them clinics, schools and stations on single plots. Same slot,
    // so the counts carry across by weight and are then clamped legal.
    const v2 = { version: 2, homes: 19, shops: 9, clinics: 1, schools: 1, stations: 1 };
    const back = migrate(v2)!;
    expect(back.hospitals).toBe(1);
    expect(back.police).toBe(1);
    expect(back.fire).toBe(1);
    expect(civicBuildings(back)).toBe(3);
  });

  it('reads a v2 save out of the key it was written under', () => {
    localStorage.setItem('idle-city/save/v2', JSON.stringify({ cash: 88, homes: 6, districts: 2 }));
    expect(load(0)).toMatchObject({ cash: 88, homes: 6, districts: 2 });
  });

  it('treats a clock that has gone backwards as no time away', () => {
    const state = createState(10_000);
    expect(secondsAway(state, 5_000)).toBe(0);
  });

  it('discards NaN and Infinity', () => {
    const back = migrate({ cash: NaN, homes: Infinity, elapsed: -Infinity });
    expect(Number.isFinite(back!.cash)).toBe(true);
    expect(Number.isFinite(back!.homes)).toBe(true);
    expect(Number.isFinite(back!.elapsed)).toBe(true);
  });
});

/**
 * The line between the two halves of this codebase, asserted rather than
 * assumed. Traffic, fire trucks and the flames on a burning roof are all
 * readouts of numbers the simulation already holds — positions, headings and
 * animation clocks are recomputed from counts and the seed on every frame. The
 * moment one of them needed saving, offline progress would be holding state it
 * could not reproduce, and the save would stop being a handful of integers.
 */
describe('the view keeps nothing in the save', () => {
  const VIEW_WORDS = [
    'car',
    'truck',
    'vehicle',
    'traffic',
    'lane',
    'route',
    'heading',
    'speed',
    'flame',
    'glow',
    'ember',
    'smoke',
    'sprite',
    'mesh',
    'instance',
    'camera',
    'phase',
    'sky',
    'sun',
    'light',
    'x',
    'y',
    'z',
    'coord',
    'position',
  ];

  it('serialises no key belonging to the renderer', () => {
    save({ ...createState(0), homes: 40, shops: 12, districts: 3 }, 1_000);
    const raw = localStorage.getItem(SAVE_KEY);
    expect(raw).not.toBeNull();
    const keys = Object.keys(JSON.parse(raw as string) as Record<string, unknown>);
    for (const key of keys) {
      const word = key.toLowerCase();
      for (const banned of VIEW_WORDS) {
        // Whole-word, so `fires` is not caught by `fire` being a substring of
        // something else and `elapsed` is not caught by `lane`.
        expect(word === banned || word === `${banned}s`).toBe(false);
      }
    }
  });

  it('round-trips a state the renderer has been driving from', () => {
    const before = { ...createState(0), homes: 19, shops: 9, elapsed: 4_812.5, districts: 2 };
    save(before, 2_000);
    const after = load(2_000);
    // Time of day is a read over `elapsed`, so this one field is the whole of
    // what the day/night cycle persists — and it is one the game already had.
    expect(after?.elapsed).toBe(4_812.5);
    expect(Object.keys(after ?? {}).sort()).toEqual(Object.keys(createState(0)).sort());
  });
});
