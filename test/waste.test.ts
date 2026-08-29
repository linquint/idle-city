import { describe, expect, it } from 'vitest';
import {
  CIVIC_SERVICES,
  GARBAGE_MOOD,
  LEVELS,
  MAX_DISTRICTS,
  SERVICES,
  WASTE_RECYCLING,
} from '../src/sim/config';
import {
  GARBAGE_COLLECTORS,
  garbage,
  garbageCollection,
  garbageLoad,
  garbageRate,
  happinessTarget,
  parkCapacity,
  recyclingCoverage,
  serviceAllowed,
  serviceCount,
  siteCapacity,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { BUILDABLE_RESIDENTIAL_PER_DISTRICT, CityLayout } from '../src/sim/layout';
import { migrate } from '../src/sim/save';
import { createState, SAVE_VERSION, type GameState } from '../src/sim/state';
import { built, housedOn, zoning } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

const WASTE = SERVICES.find((service) => service.key === 'waste')!;

/** A city of `districts` built out at `level`, with nothing civic in it. */
const city = (districts: number, level = 0, patch: Partial<GameState> = {}): GameState =>
  state({
    ...zoning(districts),
    ...built(
      Math.floor((24 * districts) / (level >= 2 ? 2 : 1)),
      Math.floor((45 * districts) / (level >= 2 ? 2 : 1)),
      Math.floor((13 * districts) / (level >= 2 ? 2 : 1)),
      level,
    ),
    districts,
    occupancyR: 1,
    occupancyC: 1,
    occupancyI: 1,
    happiness: 1,
    ...patch,
  });

describe('the sixth civic type', () => {
  it('is on the interleave, and the interleave divides the list exactly', () => {
    expect(CIVIC_SERVICES.map((service) => service.key)).toContain('waste');
    expect(CIVIC_SERVICES.length).toBe(6);
    for (const districts of [1, 2, 5, 12, MAX_DISTRICTS]) {
      const s = state({ districts });
      const shared = CIVIC_SERVICES.reduce(
        (sum, service) => sum + siteCapacity(s, service.key),
        0,
      );
      expect(shared).toBe(districts * 6);
    }
  });

  /**
   * The half of the divisor change a player sees. Six types over six sites a
   * district is one each — the hospital's second square is gone.
   */
  it('gives every type exactly one site a district', () => {
    for (const districts of [1, 4, 12, MAX_DISTRICTS]) {
      const s = state({ districts });
      for (const service of CIVIC_SERVICES) {
        expect(siteCapacity(s, service.key)).toBe(districts);
      }
    }
  });

  it('never hands two types the same square', () => {
    const layout = new CityLayout().ensure(city(6));
    const cells = new Set<string>();
    CIVIC_SERVICES.forEach((_service, offset) => {
      for (let i = 0; i < 6; i++) {
        const c = layout.civicSiteFor(offset, i);
        const key = `${c.x},${c.z}`;
        expect(cells.has(key)).toBe(false);
        cells.add(key);
      }
    });
  });
});

describe('what a waste depot does', () => {
  /**
   * It is not a second collector, and that is the measurement rather than a
   * preference: `garbageCollection` is a plot count over the housing land
   * clamped at 1, so one finished collector already covers the city.
   */
  it('does not join the collectors', () => {
    expect(GARBAGE_COLLECTORS).toEqual(['transit']);
    const bare = city(12, LEVELS - 1);
    const wasted = { ...bare, wasteDepots: 12, wasteStaff: 1 };
    expect(garbageCollection(wasted)).toBe(garbageCollection(bare));
  });

  it('cuts what the city puts out, at source', () => {
    const bare = city(12, LEVELS - 1);
    const wasted = { ...bare, wasteDepots: serviceAllowed(bare, WASTE), wasteStaff: 1 };
    expect(recyclingCoverage(wasted)).toBe(1);
    expect(garbageRate(wasted)).toBeCloseTo(garbageRate(bare) * (1 - WASTE_RECYCLING), 6);
    expect(garbageLoad(wasted)).toBeLessThan(garbageLoad(bare));
  });

  /**
   * The whole reason it cuts the rate rather than raising the collection:
   * `garbage` is load times uncollected share, so the two move different
   * factors and a city with both is better off than a city with either.
   */
  it('stacks with the bus rather than competing with it', () => {
    const bare = city(12, LEVELS - 1);
    const transit = SERVICES.find((service) => service.key === 'transit')!;
    const half = Math.floor(serviceAllowed(bare, transit) / 2);
    const bussed = { ...bare, depots: half, depotStaff: 1 };
    const wasted = { ...bare, wasteDepots: serviceAllowed(bare, WASTE), wasteStaff: 1 };
    const both = { ...bussed, wasteDepots: wasted.wasteDepots, wasteStaff: 1 };
    expect(garbage(bussed)).toBeLessThan(garbage(bare));
    expect(garbage(wasted)).toBeLessThan(garbage(bare));
    expect(garbage(both)).toBeLessThan(garbage(bussed));
    expect(garbage(both)).toBeLessThan(garbage(wasted));
    // And the two really are different factors: the product of the two
    // reductions is what the pair achieves.
    expect(garbage(both)).toBeCloseTo(
      garbageLoad(wasted) * (1 - garbageCollection(bussed)),
      9,
    );
  });

  it('carries no happiness weight, and leaves the ceiling where it was', () => {
    expect(WASTE.weight).toBe(0);
    for (let districts = 1; districts <= MAX_DISTRICTS; districts++) {
      const s = state({
        ...housedOn(BUILDABLE_RESIDENTIAL_PER_DISTRICT * districts, LEVELS - 1),
        districts,
      });
      s.parks = parkCapacity(s);
      for (const service of SERVICES) {
        const n = serviceAllowed(s, service);
        if (service.key === 'hospital') { s.hospitals = n; s.hospitalStaff = 1; }
        if (service.key === 'police') { s.police = n; s.policeStaff = 1; }
        if (service.key === 'fire') { s.fire = n; s.fireStaff = 1; }
        if (service.key === 'school') { s.schools = n; s.schoolStaff = 1; }
        if (service.key === 'transit') { s.depots = n; s.depotStaff = 1; }
        if (service.key === 'waste') { s.wasteDepots = n; s.wasteStaff = 1; }
        if (service.key === 'university') { s.universities = n; s.universityStaff = 1; }
      }
      expect(happinessTarget(s)).toBeGreaterThanOrEqual(0.95);
      // A covered city reads no rubbish at all either way, so the depot cannot
      // have moved the ceiling — the same construction `crime` relies on.
      expect(garbage(s)).toBe(0);
      expect(GARBAGE_MOOD * garbage(s)).toBe(0);
    }
  });

  it('ramps in like every other civic type', () => {
    const game = new Game(city(4, 1, { cash: 1e9 }));
    expect(game.buildService(WASTE)).toBe(true);
    expect(game.state.wasteDepots).toBe(1);
    // Staffing starts at nothing and is what the coverage is multiplied by.
    expect(game.state.wasteStaff).toBe(0);
    expect(recyclingCoverage(game.state)).toBe(0);
    for (let i = 0; i < 3_000; i++) game.advance(0.1);
    expect(game.state.wasteStaff).toBeGreaterThan(0.9);
    expect(recyclingCoverage(game.state)).toBeGreaterThan(0);
  });
});

describe('the sixth type across a save', () => {
  it('opens a save that predates it with none', () => {
    const back = migrate({ version: 14, cash: 10, homes: 4, districts: 2 }, 0)!;
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.wasteDepots).toBe(0);
    expect(back.wasteStaff).toBe(0);
  });

  /**
   * The expensive half of the divisor change, and the reason `migrate` refunds
   * rather than deleting: a city that had filled its old allowance is over the
   * new one, and `abandonedR` already settled what taking a building away in
   * silence does to an idle game.
   */
  it('refunds the civic buildings the new interleave has no site for', () => {
    // A 12-district city with more of everything than six types allow.
    const over = {
      version: 14,
      districts: 12,
      homes: 288,
      cash: 1_000,
      hospitals: 15,
      police: 15,
      fire: 14,
      schools: 14,
      depots: 14,
    };
    const back = migrate(over, 0)!;
    // The save's own field names, which are not the service keys: `police` and
    // `fire` are already plural and `transit` is spelled `depots`.
    const field: Record<string, string> = {
      hospital: 'hospitals',
      police: 'police',
      fire: 'fire',
      school: 'schools',
      transit: 'depots',
      waste: 'wasteDepots',
      university: 'universities',
    };
    let refunded = 0;
    for (const service of SERVICES) {
      const had = (over as Record<string, number>)[field[service.key] as string];
      if (had === undefined) continue;
      const kept = serviceCount(back, service.key);
      expect(kept).toBeLessThanOrEqual(had);
      // Bounded the way `migrate` bounds it: by every civic square there is,
      // not by today's `siteCapacity`. A v14 city could hold 15 hospitals at 12
      // districts — five types over 72 squares — and those three extra were
      // bought and paid for.
      const owned = Math.min(had, 12 * 6);
      for (let k = kept; k < owned; k++) refunded += service.base * service.growth ** k;
    }
    expect(refunded).toBeGreaterThan(0);
    expect(back.cash).toBeCloseTo(1_000 + refunded, 4);
  });

  /**
   * The refund walks a list, so the list has to be bounded by the *land* rather
   * than by whatever the file said — a doctored count would otherwise run a
   * billion iterations on the load path.
   */
  it('bounds the refund by the land, so a doctored count cannot hang the load', () => {
    const started = Date.now();
    const back = migrate(
      { version: 14, districts: 2, homes: 20, cash: 5, hospitals: 1e9 },
      0,
    )!;
    // The load path walks the refund, so the walk has to be bounded by
    // something other than the number in the file. A billion would take four
    // minutes; every civic square a two-district city has is twelve.
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(back.hospitals).toBe(serviceAllowed(back, SERVICES[0]!));
    const hospital = SERVICES[0]!;
    let most = 0;
    for (let k = 0; k < 2 * 6; k++) most += hospital.base * hospital.growth ** k;
    expect(back.cash).toBeGreaterThan(5);
    expect(back.cash).toBeLessThanOrEqual(5 + most);
  });

  it('clamps a doctored waste count to the sites the land offers', () => {
    const back = migrate(
      { version: 15, districts: 4, homes: 96, wasteDepots: 900 },
      0,
    )!;
    expect(back.wasteDepots).toBe(serviceAllowed(back, WASTE));
    expect(back.wasteDepots).toBeLessThanOrEqual(siteCapacity(back, 'waste'));
  });

  it('round-trips what was built', () => {
    const s = city(12, 1, { wasteDepots: 5, wasteStaff: 0.5 });
    const back = migrate(JSON.parse(JSON.stringify(s)), 0)!;
    expect(back.wasteDepots).toBe(5);
    expect(back.wasteStaff).toBeCloseTo(0.5, 6);
  });
});
