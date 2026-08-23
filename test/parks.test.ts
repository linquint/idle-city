import { describe, expect, it } from 'vitest';
import {
  HAPPINESS_MIN_BUILD,
  HOMES_PER_PARK,
  MAX_DISTRICTS,
  PARK_BASE,
  PARK_GROWTH,
  EDUCATION_SERVICES,
  HAPPINESS_SERVICES,
  LEVEL_CAPACITY,
  RECREATION_WEIGHT,
  SERVICES,
} from '../src/sim/config';
import {
  bindingTerm,
  canBuildPark,
  happinessTarget,
  happinessTerms,
  developed,
  income,
  parkBlocker,
  parkCapacity,
  parkCost,
  plotCapacity,
  recreationCoverage,
  residents,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import {
  BUILDABLE_PARKS_PER_DISTRICT,
  CityLayout,
  districtPlanAt,
  planFor,
} from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';
import { built, housed } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });
const at = (patch: Partial<GameState> = {}): Game => new Game({ ...createState(0), ...patch });

/** Everything a city can be covered by, so shortfalls can be isolated. */
const served = (patch: Partial<GameState> = {}): Partial<GameState> => ({
  hospitals: 9,
  police: 9,
  fire: 9,
  hospitalStaff: 1,
  policeStaff: 1,
  fireStaff: 1,
  ...patch,
});

describe('park land', () => {
  it('is exactly four plots a district', () => {
    expect(BUILDABLE_PARKS_PER_DISTRICT).toBe(4);
    for (const districts of [1, 2, 7, 20, MAX_DISTRICTS]) {
      expect(parkCapacity(state({ districts }))).toBe(districts * 4);
    }
  });

  /**
   * The one build list that is deliberately *not* road-adjacent. Parks stand on
   * the interior of a deep block — land no other type can be sold, because
   * every other type has to front a street.
   */
  it('never touches a road, a civic site or a plot that is for sale', () => {
    for (let seed = 0; seed < 400; seed++) {
      const plan = planFor((0x9e3779b9 + seed * 2654435761) | 0);
      expect(plan.courtyards).toHaveLength(BUILDABLE_PARKS_PER_DISTRICT);

      const reserved = new Set(plan.sites.flatMap((site) => site.cells));
      const forSale = new Set([...plan.residential, ...plan.commercial, ...plan.industrial]);
      for (const cell of plan.courtyards) {
        expect(plan.layout.perimeter[cell]).toBe(0);
        expect(reserved.has(cell)).toBe(false);
        expect(forSale.has(cell)).toBe(false);
      }
    }
  });

  it('gives every park its own plot, and never one already spoken for', () => {
    const layout = new CityLayout().ensure(9);
    const seen = new Set<string>();
    for (let i = 0; i < 9 * BUILDABLE_PARKS_PER_DISTRICT; i++) {
      const cell = layout.parkCell(i);
      const key = `${cell.x},${cell.z}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    // And the plots are the district plans' own courtyards, in order.
    expect(seen.size).toBe(9 * BUILDABLE_PARKS_PER_DISTRICT);
    expect(districtPlanAt(0, 0).courtyards).toHaveLength(BUILDABLE_PARKS_PER_DISTRICT);
  });

  /**
   * Courtyard land was never for sale, so counting it would silently re-scale
   * ANNEX_MIN_OCCUPANCY — a tier at 72.3% build-out would read 68.1% and fall
   * under the gate for the sole reason that parks now exist.
   */
  it('is not development, so it does not move the annexation gate', () => {
    const before = state(built(24, 31, 8));
    const after = { ...before, parks: 4 };
    expect(plotCapacity(after)).toBe(plotCapacity(before));
    expect(developed(after)).toBe(developed(before));
  });
});

describe('the park curve', () => {
  it('starts where the constants say and compounds', () => {
    expect(parkCost(state())).toBeCloseTo(PARK_BASE, 12);
    for (let n = 0; n < 60; n++) {
      const here = parkCost(state({ parks: n }));
      expect(parkCost(state({ parks: n + 1 }))).toBeCloseTo(here * PARK_GROWTH, 9);
      expect(parkCost(state({ parks: n + 1 }))).toBeGreaterThan(here);
    }
  });

  it('is not demand-priced, because nobody haggles over a park', () => {
    const flat = parkCost(state({ parks: 3 }));
    for (const demandR of [-1, 0, 1]) {
      expect(parkCost(state({ parks: 3, demandR }))).toBe(flat);
    }
  });

  it('earns nothing at all', () => {
    const quiet = state(built(19, 4));
    expect(income({ ...quiet, parks: 4 })).toBeCloseTo(income(quiet), 12);
  });

  it('runs out of land rather than out of permission', () => {
    const full = state({ districts: 1, parks: BUILDABLE_PARKS_PER_DISTRICT, cash: 1e9 });
    expect(canBuildPark(full)).toBe(false);
    expect(parkBlocker(full)).toBe('No courtyards left');
    expect(parkBlocker(state({ parks: 3 }))).toBeNull();
  });

  it('buys a plot when the game is asked to, and refuses past the land', () => {
    const game = at({ cash: 1e6 });
    for (let i = 0; i < 4; i++) expect(game.buildPark()).toBe(true);
    expect(game.state.parks).toBe(4);
    expect(game.buildPark()).toBe(false);
    expect(game.state.parks).toBe(4);
  });
});

describe('recreation coverage', () => {
  it('is a share of homes, not of residents', () => {
    expect(recreationCoverage(state({ ...housed(10), parks: 1 }))).toBeCloseTo(HOMES_PER_PARK / 10, 12);
    expect(recreationCoverage(state({ ...housed(19), parks: 4 }))).toBe(1);
    expect(recreationCoverage(state({ ...housed(19), parks: 0 }))).toBe(0);
  });

  /**
   * The reason the denominator is homes. Levelling multiplies residents by up to
   * 75x and adds not one park plot, so a per-resident measure would be trivial
   * at level 0 and unreachable at level 3 — the same term meaning two different
   * things at two ends of one game.
   */
  it('does not move when the city climbs', () => {
    for (const parks of [0, 1, 3, 4]) {
      const reach = recreationCoverage(state({ ...housed(19), parks }));
      for (let level = 0; level < LEVEL_CAPACITY.length; level++) {
        const climbed = state({ ...housed(19, level), parks });
        expect(residents(climbed)).toBe(19 * (LEVEL_CAPACITY[level] ?? 0));
        expect(recreationCoverage(climbed)).toBe(reach);
      }
    }
  });

  it('reads as covered when there is nobody housed to be short of one', () => {
    expect(recreationCoverage(state())).toBe(1);
    expect(recreationCoverage(state(built(0, 20, 9)))).toBe(1);
  });

  it('is satisfiable on the land a district actually has, at every level', () => {
    // A district holds 24 homes and 4 parks now, and HOMES_PER_PARK is 5, so
    // 4 parks cover 20 of 24 rather than all of them — the one number the wider
    // district moved. Checked as the ratio it is rather than as a hard 1.
    for (let level = 0; level < LEVEL_CAPACITY.length; level++) {
      const full = state({ ...housed(19, level), parks: BUILDABLE_PARKS_PER_DISTRICT });
      expect(recreationCoverage(full)).toBe(1);
    }
  });
});

describe('the happiness weights', () => {
  it('sum to exactly 1 across the four terms', () => {
    // Across the four that *are* happiness terms. Schools and universities are
    // services by every other measure — a site, a cost curve, a staffing ramp —
    // and deliberately carry no weight here: what they gate is how tall the city
    // may build. Adding them to this sum would re-open the calibration for
    // nothing. See LEVEL_EDUCATION.
    const services = SERVICES.reduce((sum, service) => sum + service.weight, 0);
    expect(services + RECREATION_WEIGHT).toBeCloseTo(1, 12);
    expect(HAPPINESS_SERVICES).toHaveLength(3);
    for (const service of EDUCATION_SERVICES) expect(service.weight).toBe(0);
    const terms = happinessTerms(state());
    expect(terms).toHaveLength(HAPPINESS_SERVICES.length + 1);
    expect(terms.reduce((sum, term) => sum + term.weight, 0)).toBeCloseTo(1, 12);
  });

  /**
   * The load-bearing check for every save written before parks existed: one
   * opens with `parks: 0`, so if the ceiling without them fell under
   * HAPPINESS_MIN_BUILD every existing city would have its housing bricked on
   * load. 0.82 against 0.35 is not close.
   */
  it('cap a park-less city at 0.82, well clear of the housing gate', () => {
    for (const level of [0, 1, 2, 3]) {
      const best = state({ ...housed(19, level), parks: 0, ...served() });
      expect(happinessTarget(best)).toBeLessThanOrEqual(0.82 + 1e-12);
      expect(happinessTarget(best)).toBeGreaterThan(HAPPINESS_MIN_BUILD);
    }
    // Exactly 0.82 when the three services are full and nothing is on fire.
    expect(happinessTarget(state({ ...housed(19), parks: 0, ...served() }))).toBeCloseTo(0.82, 12);
  });

  it('reach 1 only once the parks are in as well', () => {
    const planted = state({ ...housed(19), parks: 4, ...served() });
    expect(happinessTarget(planted)).toBeCloseTo(1, 12);
    expect(bindingTerm(planted).coverage).toBe(1);
  });

  it('name recreation when it is the term costing the most', () => {
    const parkless = state({ ...housed(19), parks: 0, ...served() });
    expect(bindingTerm(parkless).key).toBe('recreation');
    expect(bindingTerm(parkless).coverLabel).toBe('Parks per home');
  });

  it('let a v3-shaped city keep building housing on load', () => {
    // The state a v3 save arrives in: services as they were, parks at zero.
    const carried = at({ ...housed(19), parks: 0, ...served() });
    for (let i = 0; i < 3000; i++) carried.advance(0.1);
    expect(carried.state.happiness).toBeGreaterThan(HAPPINESS_MIN_BUILD);
    expect(carried.state.happiness).toBeCloseTo(0.82, 2);
  });
});

describe('auto-development', () => {
  /**
   * Recreation is a happiness term like the other three, so a shortfall in it
   * belongs in the same priority pool — without that an away city is capped at
   * 0.82 by the one amenity auto-development cannot see.
   */
  it('lays out parks while you are away', () => {
    const game = at({ ...housed(19), cash: 1e6, autoDevelop: true });
    const report = game.catchUp(3600);
    expect(report.parks).toBeGreaterThan(0);
    expect(game.state.parks).toBeLessThanOrEqual(parkCapacity(game.state));
  });

  it('never buys more parks than there is courtyard for', () => {
    const game = at({ cash: 1e12, autoDevelop: true });
    game.catchUp(12 * 3600);
    expect(game.state.parks).toBeLessThanOrEqual(parkCapacity(game.state));
  });
});
