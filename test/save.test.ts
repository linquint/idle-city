import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_DISTRICTS, TIERS } from '../src/sim/config';
import {
  civicBuildings,
  homeCapacity,
  industryCapacity,
  residentialPlots,
  shopCapacity,
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

  it('makes civic counts legal before it clamps homes', () => {
    // The other order puts a house on a school: `homeCapacity` subtracts the
    // civic count, so clamping homes first would clamp against a number that
    // was still a fiction.
    const back = migrate({ schools: 1e9, clinics: 1e9, stations: 1e9, homes: 1e9, industry: 1e9 });
    expect(civicBuildings(back!)).toBe(residentialPlots(back!));
    expect(back!.homes).toBe(0);
    expect(back!.homes).toBeLessThanOrEqual(homeCapacity(back!));
    expect(back!.industry).toBe(industryCapacity(back!));
  });

  it('leaves room for both when the zone is only partly civic', () => {
    const back = migrate({ schools: 4, homes: 1e9 });
    expect(back!.schools).toBe(4);
    expect(back!.homes).toBe(homeCapacity(back!));
    expect(back!.homes + civicBuildings(back!)).toBe(residentialPlots(back!));
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
