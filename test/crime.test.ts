import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CRIME_CROWDING_FULL,
  CRIME_FROM_CROWDING,
  CRIME_FROM_IDLENESS,
  CRIME_MOOD,
  COVERAGE_GRACE_PLOTS,
  GARBAGE_MOOD,
  GARBAGE_SATURATION,
  HAPPINESS_SERVICES,
  LEVELS,
  MAX_DISTRICTS,
  RECREATION_WEIGHT,
  SERVICES,
  type Service,
} from '../src/sim/config';
import {
  bindingTerm,
  coverage,
  crime,
  crimeCrowding,
  crimeMood,
  crimePressure,
  garbage,
  garbageCollection,
  garbageLoad,
  garbageMood,
  garbageRate,
  happinessFix,
  happinessTarget,
  happinessTerms,
  housingPlots,
  parkCapacity,
  recreationCoverage,
  residents,
  serviceAllowed,
  unemployment,
} from '../src/sim/economy';
import { CityLayout } from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';
import { Zones } from '../src/render/zones';
import { housedOn, making, trading } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

const POLICE = SERVICES.find((s) => s.key === 'police') as Service;
const TRANSIT = SERVICES.find((s) => s.key === 'transit') as Service;

/** Every housing plot developed to `level`, and every service at `serve` of its cap. */
function city(districts: number, level: number, serve = 0): GameState {
  const s = state({
    ...housedOn(24 * districts, level),
    ...trading(45 * districts),
    ...making(13 * districts),
    districts,
    occupancyR: 1,
    occupancyC: 1,
    occupancyI: 1,
    happiness: 1,
  });
  if (serve <= 0) return s;
  s.parks = Math.round(parkCapacity(s) * serve);
  for (const service of SERVICES) {
    const n = Math.round(serviceAllowed(s, service) * serve);
    if (service.key === 'hospital') s.hospitals = n;
    else if (service.key === 'police') s.police = n;
    else if (service.key === 'fire') s.fire = n;
    else if (service.key === 'school') s.schools = n;
    else if (service.key === 'transit') s.depots = n;
    else s.universities = n;
  }
  s.hospitalStaff = 1;
  s.policeStaff = 1;
  s.fireStaff = 1;
  s.schoolStaff = 1;
  s.universityStaff = 1;
  s.depotStaff = 1;
  return s;
}

describe('crime is a quantity, not an absence of police', () => {
  it('has sources, and they sum to a whole', () => {
    expect(CRIME_FROM_CROWDING + CRIME_FROM_IDLENESS).toBeCloseTo(1, 12);
    // A maximally crowded, wholly idle city reads exactly 1, which is what
    // makes CRIME_MOOD mean what its comment says it means.
    //
    // Wholly idle means *no employers*, and it has to be said out loud now.
    // `city` trades and makes on every district, so this fixture was never
    // actually idle — it held 18,425 jobs against 396,000 workers and read 1
    // only because `unemployment` divided by `demandScale`, which a level-4
    // city of twenty-five districts dwarfed. Since the ratio became the honest
    // one (see `unemployment`), the same fixture reads 0.95, which is the
    // correct answer to a question this test is not asking. So the shops and
    // the works come out, and the claim in the line above is the one measured.
    const pinned = {
      ...city(25, LEVELS - 1),
      ...trading(0),
      ...making(0),
      police: 0,
      policeStaff: 0,
    };
    expect(crimeCrowding(pinned)).toBe(1);
    expect(unemployment(pinned)).toBe(1);
    expect(crimePressure(pinned)).toBe(1);
    expect(crime(pinned)).toBe(1);
  });

  it('differs between two cities with the same police coverage', () => {
    // The abstraction this feature exists to remove: under `1 - coverage` these
    // two would be identical, and they are not remotely the same city.
    const quiet = { ...city(4, 0), police: 0, policeStaff: 0 };
    const crowded = { ...city(4, LEVELS - 1), police: 0, policeStaff: 0 };
    expect(coverage(quiet, POLICE)).toBe(coverage(crowded, POLICE));
    expect(crime(crowded)).toBeGreaterThan(crime(quiet) * 5);
  });

  it('reads crowding off the middle rung of the ladder', () => {
    const plots = 24;
    for (let level = 0; level < LEVELS; level++) {
      const s = city(1, level);
      const per = residents(s) / housingPlots(s);
      expect(crimeCrowding(s)).toBeCloseTo(Math.min(1, per / CRIME_CROWDING_FULL), 9);
    }
    void plots;
    // A village of detached houses is barely crowded; towers are the whole of it.
    expect(crimeCrowding(city(1, 0))).toBeLessThan(0.1);
    expect(crimeCrowding(city(1, 2))).toBeGreaterThan(0.8);
  });

  it('goes to exactly zero once the police reach the whole city', () => {
    for (const districts of [1, 4, 10, 25, MAX_DISTRICTS]) {
      for (let level = 0; level < LEVELS; level++) {
        const s = city(districts, level, 1);
        expect(coverage(s, POLICE)).toBeGreaterThanOrEqual(1);
        expect(crime(s)).toBe(0);
        expect(crimeMood(s)).toBe(-0);
      }
    }
  });

  it('falls as the stations open, monotonically', () => {
    let last = Number.POSITIVE_INFINITY;
    for (const serve of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      const now = crime(city(10, 2, serve));
      expect(now).toBeLessThanOrEqual(last);
      last = now;
    }
    expect(last).toBe(0);
  });

  it('charges a village nothing worth charging, without needing a grace to', () => {
    // The grace congestion does without, and this does without for the same
    // reason. `unemployment` is normalised by `demandScale` rather than by the
    // workforce, so a one-house city reads under a percent idle where a naive
    // jobs-over-workers ratio would have read it as wholly idle — and its
    // crime comes out at three points of a possible hundred. There was nothing
    // to excuse. See `crime`.
    const village = state({ ...housedOn(1), occupancyR: 1 });
    expect(unemployment(village)).toBeLessThan(0.02);
    expect(crimePressure(village)).toBeLessThan(0.05);
    expect(crimeMood(village)).toBeGreaterThan(-0.01);
    // And no grace anywhere in it: crime is exactly the pressure the police do
    // not answer, at any city size.
    for (const plots of [1, 4, COVERAGE_GRACE_PLOTS, 24, 240]) {
      const s = state({ ...housedOn(plots), occupancyR: 1 });
      expect(crime(s)).toBeCloseTo(crimePressure(s), 12);
    }
  });

  it('reads no unemployment from a bus route, which creates no jobs', () => {
    const bare = city(10, 2, 0.5);
    const bussed = { ...bare, depots: bare.depots + 20, depotStaff: 1 };
    expect(unemployment(bussed)).toBe(unemployment(bare));
  });
});

describe('rubbish is a rate, not a stock', () => {
  it('is made by residents, shops and works, and by nothing else', () => {
    const empty = state();
    expect(garbageRate(empty)).toBe(0);
    const housedOnly = state({ ...housedOn(24), occupancyR: 1 });
    expect(garbageRate(housedOnly)).toBeGreaterThan(0);
    // Adding works adds rubbish; adding a police station does not.
    const working = { ...housedOnly, ...making(13), occupancyI: 1 };
    expect(garbageRate(working)).toBeGreaterThan(garbageRate(housedOnly));
    expect(garbageRate({ ...housedOnly, police: 9, policeStaff: 1 })).toBe(garbageRate(housedOnly));
  });

  it('reads nothing back from the save, because there is nothing to read', () => {
    // The fourth save exception the brief refuses: a stock would have to be
    // integrated. Two states with the same counts have the same rubbish however
    // long either has been running.
    const young = city(10, 2);
    const old = { ...young, elapsed: 40 * 3_600 };
    expect(garbageRate(old)).toBe(garbageRate(young));
    expect(garbage(old)).toBe(garbage(young));
  });

  it('never clamps, so it is a quantity at both ends of the ladder', () => {
    let last = -1;
    for (let level = 0; level < LEVELS; level++) {
      const now = garbageLoad(city(10, level));
      expect(now).toBeGreaterThan(last);
      expect(now).toBeLessThan(1);
      last = now;
    }
    // Right up the ladder, and still short of the clamp at the top of it.
    expect(last).toBeGreaterThan(0.6);
    // And the shape is the one the constant names.
    const s = city(10, 2);
    expect(garbageLoad(s)).toBeCloseTo(
      Math.sqrt(garbageRate(s) / housingPlots(s) / GARBAGE_SATURATION),
      9,
    );
  });

  it('is collected by the depot, and goes to exactly zero when it is covered', () => {
    for (const districts of [1, 4, 10, 25, MAX_DISTRICTS]) {
      for (let level = 0; level < LEVELS; level++) {
        const s = city(districts, level, 1);
        expect(coverage(s, TRANSIT)).toBeGreaterThanOrEqual(1);
        expect(garbageCollection(s)).toBe(1);
        expect(garbage(s)).toBe(0);
        expect(garbageMood(s)).toBe(-0);
      }
    }
  });

  it('is answered by the one building that answers it, and no other', () => {
    const bare = { ...city(10, 2, 0.5), depots: 0, depotStaff: 0 };
    expect(garbage(bare)).toBeGreaterThan(0);
    const policed = { ...bare, police: bare.police + 40, policeStaff: 1 };
    expect(garbage(policed)).toBe(garbage(bare));
    const bussed = { ...bare, depots: 40, depotStaff: 1 };
    expect(garbage(bussed)).toBe(0);
  });
});

describe('where the two land in the happiness model', () => {
  it('are modifiers, not weights', () => {
    const terms = happinessTerms(city(10, 2));
    const modifiers = terms.filter((term) => term.modifier === true).map((term) => term.key);
    expect(modifiers).toEqual(['congestion', 'crime', 'garbage']);
    const weighted = terms.filter((term) => term.modifier !== true);
    expect(weighted.reduce((sum, term) => sum + term.weight, 0)).toBeCloseTo(1, 12);
    expect(weighted.map((term) => term.key)).toEqual([
      ...HAPPINESS_SERVICES.map((service) => service.key),
      'recreation',
    ]);
  });

  it('take exactly what their constants say and nothing else', () => {
    const s = { ...city(10, 2, 0.5), depots: 0, depotStaff: 0 };
    expect(crimeMood(s)).toBeCloseTo(-CRIME_MOOD * crime(s), 12);
    expect(garbageMood(s)).toBeCloseTo(-GARBAGE_MOOD * garbage(s), 12);
    // Two cities identical but for their police: the difference in the target
    // is exactly the crime modifier, with nothing rescaled underneath it.
    const safe = { ...s, police: 400, policeStaff: 1 };
    expect(happinessTarget(safe) - happinessTarget(s)).toBeCloseTo(
      crimeMood(safe) - crimeMood(s),
      12,
    );
  });

  it('leaves the ceiling exactly where it was, at every district count', () => {
    // The guard. A city that has done everything available to it must get back
    // to ~1 — and it does, because both terms are pressure times *uncovered*
    // service and a fully served city has neither uncovered.
    for (let districts = 1; districts <= MAX_DISTRICTS; districts++) {
      for (let level = 0; level < LEVELS; level++) {
        const s = city(districts, level, 1);
        expect(crime(s)).toBe(0);
        expect(garbage(s)).toBe(0);
        expect(recreationCoverage(s)).toBeGreaterThanOrEqual(0.95);
        expect(happinessTarget(s)).toBeGreaterThanOrEqual(0.95);
      }
    }
  });

  it('are named by the panel, and answered by a button it can name', () => {
    // A city with everything but police: what is holding it back is crime, and
    // the fix is the station.
    const robbed = { ...city(10, 2, 1), police: 0, policeStaff: 0 };
    expect(bindingTerm(robbed).key).toBe('crime');
    expect(bindingTerm(robbed).coverLabel).toBe('Streets safe');
    const fix = happinessFix({ ...robbed, cash: 1e9 });
    expect(fix?.label).toBe(POLICE.buildLabel);
    expect(fix?.lift).toBeGreaterThan(0);

    // And a city with everything but depots: the depot is named, and its lift
    // is worth both of the things it answers.
    const filthy = { ...city(10, 2, 1), depots: 0, depotStaff: 0 };
    const bins = happinessFix({ ...filthy, cash: 1e9 });
    expect(bins?.label).toBe(TRANSIT.buildLabel);
    expect(bins?.lift).toBeGreaterThan(0);
  });

  it('leaves the recreation weight and the two services summing to 1', () => {
    const weights = HAPPINESS_SERVICES.reduce((sum, service) => sum + service.weight, 0);
    expect(weights + RECREATION_WEIGHT).toBeCloseTo(1, 12);
    expect(POLICE.weight).toBe(0);
  });
});

describe('the overlays draw what the simulation says', () => {
  /** Pads the overlay wrote for a mode, which is what a flat mode cannot have. */
  const padsFor = (mode: 'crime' | 'garbage', s: GameState): number => {
    const zones = new Zones(new THREE.Scene(), new CityLayout());
    zones.set(mode);
    zones.sync(s);
    return zones.instances;
  };

  it('draws something for both, on a city that has something to say', () => {
    // Land the city owns and has not built on, because that is what a pad is:
    // a built plot has a building on it and the *building* carries the colour.
    // See `Buildings.setOverlay`, which is the other half of every mode.
    const s = { ...city(4, 2, 0.5), homes: 12, homeLevels: [12, 0, 0, 0, 0], mergedR: 0 };
    expect(padsFor('crime', s)).toBeGreaterThan(0);
    expect(padsFor('garbage', s)).toBeGreaterThan(0);
  });

  it('colours the housing the answer reaches differently from the rest', () => {
    const s = { ...city(4, 2, 0.5), police: 1, policeStaff: 1, depots: 1, depotStaff: 1 };
    const zones = new Zones(new THREE.Scene(), new CityLayout());
    for (const mode of ['crime', 'garbage'] as const) {
      zones.set(mode);
      zones.sync(s);
      const source = zones.overlay(s);
      expect(source).not.toBeNull();
      // The first housing plot is inside the covered prefix and a far one is
      // not, which is the oldest-land-first ordering `coverage` established.
      const near = source?.('home', 0);
      const far = source?.('home', 90);
      expect(near).not.toBe(far);
      // And a shop has nothing to say about either: both are shares of the
      // *housing* land, exactly as land value is.
      expect(source?.('shop', 0)).toBe(source?.('shop', 12));
    }
  });
});
