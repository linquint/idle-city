import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LEVELS,
  MAX_ACTIVE_FIRES,
  MAX_DISTRICTS,
  OCCUPANCY_EMPTY,
  OCCUPANCY_FULL,
  SERVICES,
  TAX_STEPS,
} from '../src/sim/config';
import {
  civicBuildings,
  cohortTotal,
  mergeCapacity,
  mergedCohort,
  plotsOf,
  happinessTarget,
  homeCapacity,
  industryCapacity,
  landmarkCoverage,
  landmarkSiteCapacity,
  parkCapacity,
  residents,
  serviceAllowed,
  taxStep,
  serviceCount,
  shopCapacity,
  siteCapacity,
} from '../src/sim/economy';
import { BUILDABLE_PARKS_PER_DISTRICT } from '../src/sim/layout';
import { load, migrate, save, SAVE_KEY, secondsAway } from '../src/sim/save';
import { createState, SAVE_VERSION, type GameState } from '../src/sim/state';
import { built, cohort, housed, mix, trading } from './levels';

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
    // 24 towers on three districts: 48 of its 72 housing plots, and inside the
    // ~31 pairs the land offers. A merged level is two plots a building now, so
    // a round trip is only a round trip for a city that fits.
    const state = { ...createState(0), cash: 1234.5, ...housed(24, 2), ...trading(7), districts: 3 };
    const at = save(state, 5_000);
    const back = load(6_000);
    expect(back).not.toBeNull();
    expect(back).toMatchObject({ cash: 1234.5, homes: 24, shops: 7, districts: 3 });
    expect(back?.homeLevels).toEqual(cohort(24, 2));
    expect(back?.mergedR).toBe(24);
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
    expect(back).toMatchObject({ cash: 10, homes: 4, shops: 0, districts: 1 });
    expect(back?.homeLevels).toEqual(cohort(4, 0));
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
    expect(back!.districts).toBe(MAX_DISTRICTS);
    // Plots, not buildings: `tier: 99` clamps to the top level, every building
    // there stands on two plots, and the land is what bounds the pair of them.
    expect(plotsOf(back!, 'home')).toBe(homeCapacity(back!));
    expect(plotsOf(back!, 'shop')).toBe(shopCapacity(back!));
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
    expect(back).toMatchObject({ cash: 12_345.6, homes: 30, shops: 9, districts: 3 });
    // A v1 save's global tier becomes a cohort, exactly as a v4 one does.
    expect(back!.homeLevels).toEqual(cohort(30, 2));
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
      version: SAVE_VERSION,
      hospitals: 1e9,
      police: 1e9,
      fire: 1e9,
      schools: 1e9,
      universities: 1e9,
      depots: 1e9,
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
    const back = migrate({ hospitals: 400, ...housed(19), occupancyR: 1 })!;
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
    const neglected = migrate({ ...housed(12), occupancyR: 1 })!;
    expect(neglected.happiness).toBe(0);
    expect(neglected.happiness).toBe(happinessTarget(neglected));

    const empty = migrate({ cash: 5 })!;
    expect(empty.happiness).toBe(1);

    const doctored = migrate({ ...housed(12), happiness: 4 })!;
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
    save({ ...createState(0), ...housed(40), ...trading(12), districts: 3 }, 1_000);
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

  /**
   * Fires *are* in the save, and have to be — a burning building earns nothing
   * and may be gone when it stops, which is simulation, not decoration. What is
   * not in the save is where the fire is: an ordinal and a start time, and the
   * renderer works the rest out from the seed like it does for everything else.
   */
  it('stores a fire as an ordinal and a clock, never as a place', () => {
    save(
      {
        ...createState(0),
        ...housed(19),
        elapsed: 500,
        fires: [{ kind: 'home', index: 7, startedAt: 480 }],
      },
      1_000,
    );
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) as string) as Record<string, unknown>;
    const fires = parsed['fires'] as Array<Record<string, unknown>>;
    expect(fires).toHaveLength(1);
    expect(Object.keys(fires[0] ?? {}).sort()).toEqual(['index', 'kind', 'startedAt']);
  });

  it('round-trips a state the renderer has been driving from', () => {
    const before = { ...createState(0), ...built(19, 9), elapsed: 4_812.5, districts: 2 };
    save(before, 2_000);
    const after = load(2_000);
    // Time of day is a read over `elapsed`, so this one field is the whole of
    // what the day/night cycle persists — and it is one the game already had.
    expect(after?.elapsed).toBe(4_812.5);
    expect(Object.keys(after ?? {}).sort()).toEqual(Object.keys(createState(0)).sort());
  });
});

/**
 * A v3 save is a save with no fires in it at all, which is exactly the state a
 * city that has never burned is in — so bringing one forward is a matter of
 * defaulting rather than of reconstructing anything.
 */
describe('the v4 migration', () => {
  const v3 = {
    version: 3,
    cash: 12_345,
    elapsed: 9_000,
    homes: 19,
    shops: 20,
    industry: 7,
    hospitals: 1,
    police: 1,
    fire: 1,
    hospitalStaff: 1,
    policeStaff: 1,
    fireStaff: 1,
    happiness: 0.77,
    demandR: 0.4,
    demandC: -0.2,
    demandI: 0.1,
    tier: 1,
    districts: 1,
    earned: 40_000,
    autoDevelop: true,
    savedAt: 1_000,
  };

  it('opens a v3 save with everything that was in it intact', () => {
    const state = migrate(v3, 2_000);
    expect(state).not.toBeNull();
    expect(state).toMatchObject({
      version: SAVE_VERSION,
      cash: 12_345,
      homes: 19,
      shops: 20,
      industry: 7,
      districts: 1,
      demandR: 0.4,
      demandC: -0.2,
      demandI: 0.1,
      happiness: 0.77,
      autoDevelop: true,
    });
  });

  it('defaults the fire fields rather than inventing a fire', () => {
    const state = migrate(v3, 2_000);
    expect(state?.fires).toEqual([]);
    expect(state?.fireCursor).toBe(0);
    expect(state?.fireHazard).toBe(0);
  });

  it('defaults parks to none, which is the state a v3 city was in', () => {
    const state = migrate(v3, 2_000);
    expect(state?.parks).toBe(0);
    // And the housing gate still opens for it: no parks caps happiness at 0.82.
    expect(state?.happiness).toBe(0.77);
    expect(happinessTarget(state as GameState)).toBeGreaterThan(0.35);
  });

  it('clamps parks to the courtyard land the city owns', () => {
    const state = migrate({ ...v3, districts: 2, parks: 900 }, 2_000);
    expect(state?.parks).toBe(2 * BUILDABLE_PARKS_PER_DISTRICT);
    expect(migrate({ ...v3, parks: -4 }, 0)?.parks).toBe(0);
    expect(migrate({ ...v3, parks: 'lots' }, 0)?.parks).toBe(0);
  });

  it('reads a v4 save back exactly as it was written', () => {
    const written = {
      ...v3,
      version: 4,
      fires: [{ kind: 'shop', index: 3, startedAt: 8_950 }],
      fireCursor: 42,
      fireHazard: 0.31,
    };
    const state = migrate(written, 2_000);
    expect(state?.fires).toEqual([{ kind: 'shop', index: 3, startedAt: 8_950 }]);
    expect(state?.fireCursor).toBe(42);
    expect(state?.fireHazard).toBeCloseTo(0.31, 12);
  });

  it('finds a v3 save under its own key when there is no v4 one', () => {
    localStorage.setItem('idle-city/save/v3', JSON.stringify(v3));
    const state = load(2_000);
    expect(state?.homes).toBe(19);
    expect(state?.version).toBe(SAVE_VERSION);
    expect(state?.fires).toEqual([]);
  });
});

describe('the v6 migration', () => {
  /** What a v4 save looks like: one global tier, no cohorts, no occupancy. */
  const v4 = {
    version: 4,
    cash: 90_000,
    elapsed: 9_000,
    homes: 19,
    shops: 20,
    industry: 7,
    parks: 3,
    hospitals: 1,
    police: 1,
    fire: 1,
    hospitalStaff: 1,
    policeStaff: 1,
    fireStaff: 1,
    happiness: 0.77,
    demandR: 0.4,
    demandC: -0.2,
    demandI: 0.1,
    fires: [{ kind: 'shop', index: 3, startedAt: 8_950 }],
    fireCursor: 42,
    fireHazard: 0.31,
    // Tier 1 rather than 2, so this city still fits its one district under v6.
    // A tier-2 city of 19 homes wants 38 plots of the 24 a district sells; the
    // clamp that follows from that has a test of its own below.
    tier: 1,
    districts: 1,
    earned: 400_000,
    autoDevelop: true,
    savedAt: 1_000,
  };

  it('turns a global tier into a cohort of every standing building', () => {
    const back = migrate(v4, 2_000)!;
    expect(back.homeLevels).toEqual(cohort(19, 1));
    expect(back.shopLevels).toEqual(cohort(20, 1));
    expect(back.industryLevels).toEqual(cohort(7, 1));
    expect(back.version).toBe(SAVE_VERSION);
    // Nothing below MERGE_LEVEL has merged, so no parcels are claimed either.
    expect([back.mergedR, back.mergedC, back.mergedI]).toEqual([0, 0, 0]);
    // And the field itself is gone rather than carried along dead.
    expect('tier' in back).toBe(false);
  });

  it('gives a tier the parcels its footprint implies', () => {
    // A v5 or v4 city above MERGE_LEVEL was never told how much land it was
    // standing on, because merging did not exist. The cohorts are believed and
    // the parcels are raised to match, which is what opens such a save with its
    // skyline intact rather than flattened.
    const back = migrate({ ...v4, tier: 2, homes: 10, shops: 10, industry: 3 }, 0)!;
    expect(back.homeLevels).toEqual(cohort(10, 2));
    expect(back.mergedR).toBe(10);
    expect(plotsOf(back, 'home')).toBe(20);
  });

  it('flattens a city taller than the land can now carry', () => {
    // 19 towers want 38 plots and 19 pairs; a district sells 24 plots and offers
    // about ten pairs. What cannot stand is demoted tallest-first and what still
    // does not fit is shed from the newest end.
    const back = migrate({ ...v4, tier: 2 }, 0)!;
    expect(plotsOf(back, 'home')).toBeLessThanOrEqual(homeCapacity(back));
    expect(mergedCohort(back.homeLevels)).toBe(back.mergedR);
    expect(back.mergedR).toBeLessThanOrEqual(mergeCapacity(back, 'home'));
    expect(cohortTotal(back.homeLevels)).toBe(back.homes - back.abandonedR);
  });

  it('opens a v4 save with its city intact', () => {
    const back = migrate(v4, 2_000)!;
    expect(back).toMatchObject({
      cash: 90_000,
      homes: 19,
      shops: 20,
      industry: 7,
      parks: 3,
      districts: 1,
      demandR: 0.4,
      demandC: -0.2,
      demandI: 0.1,
      happiness: 0.77,
      autoDevelop: true,
    });
    expect(civicBuildings(back)).toBe(3);
    expect(back.fires).toEqual([{ kind: 'shop', index: 3, startedAt: 8_950 }]);
    expect(back.fireCursor).toBe(42);
  });

  it('hands a returning city the hall its policies imply', () => {
    // The one field in this file that defaults to *true* for an older save. A
    // v8 city may have a punitive rate set, fares waived and the away switch on,
    // and all three are gated on a building that did not exist when it chose
    // them. Defaulting the hall to false would revert every one of them
    // silently: the settings would still read as chosen and would no longer do
    // anything, and the ledger would quietly change.
    const old = migrate({ version: 8, taxRate: 3, freeTransport: true, autoDevelop: true });
    expect(old?.cityHall).toBe(true);
    expect(old?.taxRate).toBe(3);
    expect(old?.freeTransport).toBe(true);
    expect(taxStep(old as GameState)).toBe(TAX_STEPS[3]);

    // A save with no version at all is older still, and gets the same answer.
    expect(migrate({ homes: 3 })?.cityHall).toBe(true);

    // A save written by this version says for itself, either way.
    expect(migrate({ version: SAVE_VERSION, cityHall: true })?.cityHall).toBe(true);
    expect(migrate({ version: SAVE_VERSION })?.cityHall).toBe(false);
    expect(migrate({ version: SAVE_VERSION, cityHall: 'yes' })?.cityHall).toBe(false);
  });

  it('leaves a fresh city to earn its own', () => {
    expect(createState(0).cityHall).toBe(false);
  });

  it('brings back the last building of a zone written off to nothing', () => {
    // A state the current build cannot produce and an older one could: every
    // home written off. It houses nobody and earns exactly zero, and with
    // residents at zero the occupancy target sits under OCCUPANCY_EMPTY forever
    // — so nothing ever recovers and the save has nothing left to press. The
    // repair is the one `isAbandoning` now enforces: the last ruin comes back.
    const state = migrate({ version: 8, homes: 6, abandonedR: 6, shops: 4, abandonedC: 4 });
    expect(state).not.toBeNull();
    expect(state?.abandonedR).toBe(5);
    expect(state?.abandonedC).toBe(3);
    expect(residents({ ...(state as GameState), occupancyR: 0.5 })).toBeGreaterThan(0);
  });

  it('opens occupied rather than reading as a city being abandoned', () => {
    // Zero would start every returning save's vacancy clock on the first tick.
    const back = migrate(v4, 2_000)!;
    for (const filled of [back.occupancyR, back.occupancyC, back.occupancyI]) {
      expect(filled).toBe(OCCUPANCY_FULL);
      expect(filled).toBeGreaterThan(OCCUPANCY_EMPTY);
    }
    expect([back.vacantR, back.vacantC, back.vacantI]).toEqual([0, 0, 0]);
    expect([back.abandonedR, back.abandonedC, back.abandonedI]).toEqual([0, 0, 0]);
    expect([back.driftR, back.driftC, back.driftI]).toEqual([0, 0, 0]);
  });

  it('clamps counts to the capacities of the build it opens on', () => {
    // The guard that has to hold across every version bump, whichever way the
    // land moved. A save is never trusted about how much of it there is: a
    // count over the capacity is cut to the capacity and its cohort with it,
    // and a count under it is carried whole.
    const over = industryCapacity(createState(0)) + 40;
    const stuffed = migrate({ ...v4, homes: 19, shops: 20, industry: over }, 0)!;
    expect(stuffed.industry).toBe(industryCapacity(stuffed));
    expect(stuffed.industry).toBeLessThan(over);
    expect(stuffed.homes).toBe(19);
    expect(stuffed.shops).toBe(20);
    // And the cohort follows the clamp rather than outliving it.
    expect(cohortTotal(stuffed.industryLevels)).toBe(stuffed.industry);
  });

  it('keeps every cohort summing to its standing stock', () => {
    for (const raw of [
      v4,
      { ...v4, homes: 1e9, shops: 1e9, industry: 1e9 },
      { ...v4, homeLevels: mix(3, 3, 3, 3), homes: 4 },
      { ...v4, homeLevels: mix(1), homes: 12 },
      { ...v4, homeLevels: 'not an array' },
      { ...v4, homeLevels: [1, 2, 'x', null, 99, 99], homes: 9 },
      { ...v4, homes: 12, abandonedR: 5 },
      { ...v4, homes: 12, abandonedR: 900 },
      { ...v4, homes: 0, abandonedR: 4 },
    ]) {
      const back = migrate(raw, 0)!;
      expect(back.homeLevels).toHaveLength(LEVELS);
      expect(back.abandonedR).toBeLessThanOrEqual(back.homes);
      expect(cohortTotal(back.homeLevels)).toBe(back.homes - back.abandonedR);
      expect(cohortTotal(back.shopLevels)).toBe(back.shops - back.abandonedC);
      expect(cohortTotal(back.industryLevels)).toBe(back.industry - back.abandonedI);
      for (const n of back.homeLevels) expect(n).toBeGreaterThanOrEqual(0);
    }
  });

  it('clamps a doctored occupancy, vacancy clock and accumulator', () => {
    const back = migrate(
      {
        ...v4,
        occupancyR: 9,
        occupancyC: -4,
        occupancyI: Number.NaN,
        vacantR: -100,
        driftR: 900,
        driftC: -900,
      },
      0,
    )!;
    expect(back.occupancyR).toBe(1);
    expect(back.occupancyC).toBe(0);
    expect(back.occupancyI).toBe(OCCUPANCY_FULL);
    expect(back.vacantR).toBe(0);
    expect(back.driftR).toBe(1);
    expect(back.driftC).toBe(-1);
  });

  it('finds a v4 save under its own key when there is no v6 one', () => {
    localStorage.setItem('idle-city/save/v4', JSON.stringify(v4));
    const state = load(2_000)!;
    expect(state.homes).toBe(19);
    expect(state.version).toBe(SAVE_VERSION);
    expect(state.homeLevels).toEqual(cohort(19, 1));
  });

  /**
   * The upgrade the player actually takes: a v5 city, written before parcels
   * existed, opening on a build that has them.
   */
  it('opens a v5 save with everything it had', () => {
    const v5 = {
      version: 5,
      cash: 4_321,
      elapsed: 12_000,
      homes: 20,
      shops: 12,
      industry: 5,
      homeLevels: mix(8, 12),
      shopLevels: [12, 0, 0, 0],
      industryLevels: mix(5),
      districts: 2,
      parks: 4,
      hospitals: 2,
      police: 1,
      fire: 1,
      schools: 1,
      universities: 0,
      happiness: 0.81,
      demandR: 0.25,
      demandC: -0.15,
      demandI: 0.05,
      fires: [{ kind: 'home', index: 2, startedAt: 11_950 }],
      fireCursor: 15,
      earned: 55_000,
      savedAt: 1_000,
    };
    const back = migrate(v5, 2_000)!;
    expect(back).toMatchObject({
      cash: 4_321,
      homes: 20,
      shops: 12,
      industry: 5,
      districts: 2,
      demandR: 0.25,
      demandC: -0.15,
      demandI: 0.05,
      happiness: 0.81,
    });
    expect(back.homeLevels).toEqual(mix(8, 12));
    expect(back.fires).toEqual([{ kind: 'home', index: 2, startedAt: 11_950 }]);
    // The fields v6 added, at the defaults a city that has never merged has.
    expect([back.mergedR, back.mergedC, back.mergedI]).toEqual([0, 0, 0]);
    expect(back.version).toBe(SAVE_VERSION);
  });
});

/**
 * The upgrade the fifth level costs a player: a v6 city, written against a
 * four-rung ladder, opening on a build with five.
 */
describe('the v7 migration', () => {
  /** A city at the *old* top of the ladder, with its parcels claimed. */
  const v6 = {
    version: 6,
    cash: 9_000,
    elapsed: 30_000,
    homes: 12,
    shops: 8,
    industry: 3,
    // Four wide, which is the whole point: written when LEVELS was 4.
    homeLevels: [0, 0, 0, 12],
    shopLevels: [2, 0, 6, 0],
    industryLevels: [3, 0, 0, 0],
    mergedR: 12,
    mergedC: 6,
    mergedI: 0,
    districts: 2,
    parks: 4,
    hospitals: 2,
    happiness: 0.9,
    savedAt: 1_000,
  };

  it('extends every cohort to the new width without inventing a level', () => {
    const back = migrate(v6, 2_000)!;
    for (const levels of [back.homeLevels, back.shopLevels, back.industryLevels]) {
      expect(levels).toHaveLength(LEVELS);
    }
    // The city was at the old top, and it stays at the old top. Promoting it on
    // load would hand a returning player a level they never earned — and one
    // LEVEL_EDUCATION's new rung says has to be paid for.
    expect(back.homeLevels).toEqual(cohort(12, 3));
    expect(back.homeLevels[LEVELS - 1]).toBe(0);
    expect(back.shopLevels).toEqual(mix(2, 0, 6));
    expect(back.industryLevels).toEqual(cohort(3, 0));
  });

  it('keeps the standing stock, the parcels and the version', () => {
    const back = migrate(v6, 2_000)!;
    expect(back).toMatchObject({ homes: 12, shops: 8, industry: 3, districts: 2 });
    expect(cohortTotal(back.homeLevels)).toBe(12);
    expect([back.mergedR, back.mergedC, back.mergedI]).toEqual([12, 6, 0]);
    expect(back.version).toBe(SAVE_VERSION);
  });

  it('re-clamps every count against the capacities of the build it opens on', () => {
    // The guard that matters across a version bump: the new build may hold less
    // of something than the old one did, and a save is never trusted about it.
    const back = migrate({ ...v6, homes: 9_999, hospitals: 99, parks: 99 }, 2_000)!;
    expect(plotsOf(back, 'home')).toBeLessThanOrEqual(homeCapacity(back));
    expect(back.hospitals).toBeLessThanOrEqual(siteCapacity(back, 'hospital'));
    expect(back.parks).toBeLessThanOrEqual(parkCapacity(back));
  });

  it('finds a v6 save under its own key when there is no v7 one', () => {
    localStorage.setItem('idle-city/save/v6', JSON.stringify(v6));
    const state = load(2_000)!;
    expect(state.homes).toBe(12);
    expect(state.homeLevels).toEqual(cohort(12, 3));
    expect(state.version).toBe(SAVE_VERSION);
  });
});

describe('landmarks across a save', () => {
  it('defaults to none for every save written before they existed', () => {
    const back = migrate({ cash: 10, homes: 4, districts: 2 }, 1_000)!;
    expect(back.museums).toBe(0);
    expect(back.stadiums).toBe(0);
    // And a city with none of them gets no mood for them, which is the only
    // reading that does not hand a returning player something they never built.
    expect(landmarkCoverage(back)).toBe(0);
  });

  it('carries what was built, and clamps it to the sites the city owns', () => {
    const kept = migrate({ homes: 9, districts: 5, museums: 3, stadiums: 2 }, 0)!;
    expect(kept.museums).toBe(3);
    expect(kept.stadiums).toBe(2);

    // One of each size a district, so a doctored save gets the land's answer.
    const stuffed = migrate({ homes: 9, districts: 2, museums: 900, stadiums: 900 }, 0)!;
    expect(stuffed.museums).toBe(landmarkSiteCapacity(stuffed, 'museum'));
    expect(stuffed.stadiums).toBe(landmarkSiteCapacity(stuffed, 'stadium'));
    expect(stuffed.museums).toBe(2);
  });

  it('survives a round trip with the rest of the city', () => {
    const before = { ...createState(0), districts: 4, museums: 3, stadiums: 1 };
    save(before, 5_000);
    const back = load(5_000)!;
    expect(back.museums).toBe(3);
    expect(back.stadiums).toBe(1);
  });

  /**
   * The property landmarks were designed around: the save carries two counts
   * and nothing per building. A field per landmark instance would be a save
   * that grows with the city and the end of "positions derive from counts".
   */
  it('stores two counts and nothing per building', () => {
    const s = { ...createState(0), districts: 9, museums: 9, stadiums: 9 };
    save(s, 0);
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) as string) as Record<string, unknown>;
    const landmarkKeys = Object.keys(raw).filter((k) => /museum|stadium|landmark/i.test(k));
    expect(landmarkKeys.sort()).toEqual(['museums', 'stadiums']);
    expect(typeof raw['museums']).toBe('number');
    expect(typeof raw['stadiums']).toBe('number');
  });
});

describe('a doctored save', () => {
  const doctored = (patch: Record<string, unknown>): Record<string, unknown> => ({
    homes: 19,
    shops: 10,
    industry: 5,
    elapsed: 500,
    ...patch,
  });

  it('cannot set four hundred buildings alight', () => {
    const fires = Array.from({ length: 400 }, (_, i) => ({
      kind: 'home',
      index: i % 19,
      startedAt: 0,
    }));
    const state = migrate(doctored({ fires }), 0);
    expect(state?.fires.length).toBeLessThanOrEqual(MAX_ACTIVE_FIRES);
    // And no plot is alight twice, which would double the damage.
    const keys = (state?.fires ?? []).map((f) => `${f.kind}:${f.index}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('cannot burn a building the city does not own', () => {
    const state = migrate(
      doctored({
        fires: [
          { kind: 'home', index: 900, startedAt: 0 },
          { kind: 'shop', index: -4, startedAt: 0 },
          { kind: 'industry', index: 2, startedAt: 0 },
          { kind: 'observatory', index: 0, startedAt: 0 },
          'not a fire',
          null,
        ],
      }),
      0,
    );
    expect(state?.fires).toEqual([{ kind: 'industry', index: 2, startedAt: 0 }]);
  });

  it('cannot run the fire cursor backwards', () => {
    const state = migrate(doctored({ fireCursor: -12, fireHazard: -900 }), 0);
    expect(state?.fireCursor).toBe(0);
    expect(state?.fireHazard).toBe(0);
  });

  it('cannot stamp a fire in the future, where it would never go out', () => {
    const state = migrate(
      doctored({ elapsed: 500, fires: [{ kind: 'home', index: 1, startedAt: 1e9 }] }),
      0,
    );
    expect(state?.fires[0]?.startedAt).toBe(500);
  });

  it('cannot hide a fire behind a nonsense cursor or a NaN hazard', () => {
    const state = migrate(doctored({ fireCursor: Number.NaN, fireHazard: Number.NaN }), 0);
    expect(state?.fireCursor).toBe(0);
    expect(state?.fireHazard).toBe(0);
  });
});
