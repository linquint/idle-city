import { describe, expect, it } from 'vitest';
import {
  CIVIC_RAMP_SECONDS,
  HAPPINESS_FLOOR,
  CIVIC_SERVICES,
  HAPPINESS_MIN_BUILD,
  HAPPINESS_SERVICES,
  LEVEL_CAPACITY,
  LEVEL_EDUCATION,
  LEVELS,
  MAX_DISTRICTS,
  SERVICES,
  DEMAND_TERMS,
  DEMAND_TERM_MAX,
  TAX_NEUTRAL,
  TAX_STEPS,
} from '../src/sim/config';
import {
  bindingTerm,
  canBuildHome,
  civicBuildings,
  covered,
  coverage,
  demandLift,
  demandTargets,
  demandTerms,
  educationCoverage,
  taxPressure,
  ZONE_KINDS,
  happinessTarget,
  homeBlocker,
  income,
  incomeMultiplier,
  residents,
  industryCapacity,
  homeCapacity,
  housingPlots,
  parkCapacity,
  recreationCoverage,
  serviceAllowed,
  serviceCount,
  shopCapacity,
  siteCapacity,
  staffAfterBuild,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { BUILDABLE_RESIDENTIAL_PER_DISTRICT, CityLayout } from '../src/sim/layout';
import { createState, type GameState, type ZoneKind } from '../src/sim/state';
import { built, housed, housedOn } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });
const at = (patch: Partial<GameState> = {}): Game => new Game({ ...createState(0), ...patch });

/** `advance` clamps a single call to a quarter second, so time is taken in ticks. */
const run = (game: Game, seconds: number): Game => {
  for (let i = 0; i < Math.round(seconds * 10); i++) game.advance(0.1);
  return game;
};

/** One of each, fully staffed — what a covered city looks like as a patch. */
const staffed = (patch: Partial<GameState> = {}): Partial<GameState> => ({
  hospitals: 1,
  police: 1,
  fire: 1,
  hospitalStaff: 1,
  policeStaff: 1,
  fireStaff: 1,
  ...patch,
});

const hospital = SERVICES[0]!;

describe('coverage', () => {
  it('is nothing at all with residents and nothing built', () => {
    const bare = state(housed(10));
    for (const service of SERVICES) expect(coverage(bare, service)).toBe(0);
    expect(happinessTarget(bare)).toBe(0);
  });

  /**
   * The alternative deadlocks the game on its own tutorial: happiness would be
   * 0 before the first house, the housing gate would refuse to open it, and
   * there would be no income to buy the hospital that lifts the gate.
   */
  it('is everybody when there is nobody', () => {
    const empty = state();
    expect(residents(empty)).toBe(0);
    for (const service of SERVICES) expect(coverage(empty, service)).toBe(1);
    expect(happinessTarget(empty)).toBeCloseTo(1, 12);
  });

  it('never exceeds 1, and never exceeds what the buildings can reach', () => {
    for (const plots of [2, 4, 12, 24]) {
      for (let level = 0; level < LEVELS; level++) {
        for (const built of [0, 1, 3, 40]) {
          for (const staff of [0, 0.37, 1]) {
            const s = state({
              ...housedOn(plots, level),
              hospitals: built,
              hospitalStaff: staff,
            });
            const land = housingPlots(s);
            expect(land).toBeGreaterThan(0);
            const reach = coverage(s, hospital);
            expect(reach).toBeLessThanOrEqual(1);
            expect(reach).toBeLessThanOrEqual((built * hospital.plots) / land + 1e-12);
            expect(reach).toBeCloseTo(Math.min(1, covered(s, hospital) / land), 12);
          }
        }
      }
    }
  });

  /**
   * The regression test for the ceiling Part 0 removed, and the reason the
   * denominator is land. Before it, a maxed-out city read 34% happiness at
   * every size — residents per plot climb 4 -> 300 while the civic sites the
   * services stand on are fixed at six a district.
   */
  it('is untouched by levelling and by merging', () => {
    for (const plots of [12, 24, 96, 240]) {
      const staffing = { ...staffed(), schools: 3, universities: 2, depots: 3,
        schoolStaff: 1, universityStaff: 1, depotStaff: 1, parks: 6 };
      const flat = state({ ...housedOn(plots, 0), ...staffing });
      for (let level = 1; level < LEVELS; level++) {
        const climbed = state({ ...housedOn(plots, level), ...staffing });
        expect(housingPlots(climbed)).toBe(housingPlots(flat));
        for (const service of SERVICES) {
          expect(coverage(climbed, service)).toBe(coverage(flat, service));
        }
        expect(recreationCoverage(climbed)).toBe(recreationCoverage(flat));
        expect(educationCoverage(climbed)).toBe(educationCoverage(flat));
        expect(happinessTarget(climbed)).toBe(happinessTarget(flat));
      }
    }
  });

  it('goes short again when the city builds out under it', () => {
    // One hospital reaches exactly 20 plots, and four parks reach 24, so this
    // is a city that has everything: 1 is reachable only with the fourth term
    // too. What takes it short again is *land* now, not levels — the same one
    // hospital over four districts of housing is stretched four ways.
    const before = state({ ...housedOn(hospital.plots), parks: 4, ...staffed() });
    const after = state({ ...housedOn(hospital.plots * 4), parks: 4, ...staffed() });
    expect(happinessTarget(before)).toBeCloseTo(1, 12);
    expect(happinessTarget(after)).toBeLessThan(1);
  });

  /**
   * The panel's whole value: which shortfall is costing the most right now.
   * Recreation is one of the four now, so the panel can name it too — without
   * that, a fully served city with no parks would sit at 82% behind three green
   * lines and no explanation.
   */
  it('names the term holding happiness back', () => {
    const s = state({ ...housedOn(240), parks: 4, ...staffed({ police: 3, fire: 4 }) });
    expect(bindingTerm(s).key).toBe('hospital');
    const policed = { ...s, hospitals: 9, police: 0 };
    expect(bindingTerm(policed).key).toBe('police');
    const served = { ...s, hospitals: 9, police: 9, fire: 9, parks: 0 };
    expect(bindingTerm(served).key).toBe('recreation');
  });
});

/**
 * The direct regression test for Part 0.
 *
 * The bug it pins: with coverage measured per resident, a city with every
 * housing plot at the top level and every service built to the cap the land
 * allows read 25% / 16% / 15% / 15% health coverage at 1 / 4 / 10 / 25
 * districts, and 35% / 34% / 34% / 34% happiness. The city could not reach 40%
 * at any size, however it was played, because need scaled with density and
 * supply scaled with land.
 */
describe('the happiness ceiling', () => {
  /** Every housing plot developed to the top level, every service at its cap. */
  const maxed = (districts: number): GameState => {
    const s = state({ ...housedOn(BUILDABLE_RESIDENTIAL_PER_DISTRICT * districts, LEVELS - 1), districts });
    s.parks = parkCapacity(s);
    // `serviceAllowed` reads the housing land, which the cohort above has
    // already fixed, so one pass over the table is enough.
    for (const service of SERVICES) {
      const n = serviceAllowed(s, service);
      if (service.key === 'hospital') { s.hospitals = n; s.hospitalStaff = 1; }
      if (service.key === 'police') { s.police = n; s.policeStaff = 1; }
      if (service.key === 'fire') { s.fire = n; s.fireStaff = 1; }
      if (service.key === 'school') { s.schools = n; s.schoolStaff = 1; }
      if (service.key === 'transit') { s.depots = n; s.depotStaff = 1; }
      if (service.key === 'university') { s.universities = n; s.universityStaff = 1; }
    }
    return s;
  };

  it('is reached at every size a city can be', () => {
    for (const districts of [1, 4, 10, 25]) {
      const s = maxed(districts);
      for (const service of HAPPINESS_SERVICES) {
        expect(coverage(s, service)).toBeGreaterThanOrEqual(0.95);
      }
      expect(recreationCoverage(s)).toBeGreaterThanOrEqual(0.95);
      expect(happinessTarget(s)).toBeGreaterThanOrEqual(0.95);
    }
  });

  /**
   * The floor holds at *every* district count, not just the four in the report.
   * The site interleave hands the five 2x2 types 2/1/1/1/1 in a one-district
   * city and evens out from there, so the awkward sizes are the small ones —
   * which is exactly why police and fire carry more reach per building than the
   * hospital does. See SERVICES.
   */
  it('holds for every district count the map allows', () => {
    for (let districts = 1; districts <= MAX_DISTRICTS; districts++) {
      const s = maxed(districts);
      for (const service of HAPPINESS_SERVICES) {
        expect(coverage(s, service)).toBeGreaterThanOrEqual(0.95);
      }
    }
  });

  /**
   * And education clears its top rung, which the old denominator also put out
   * of reach: 1.2 schools and one university against a district of arcologies
   * covered 60% of 7,200 residents against LEVEL_EDUCATION's 0.85.
   */
  it('leaves the top of the level ladder reachable', () => {
    for (const districts of [1, 4, 10, 25]) {
      expect(educationCoverage(maxed(districts))).toBeGreaterThanOrEqual(
        LEVEL_EDUCATION[LEVELS - 1] ?? 1,
      );
    }
  });
});

describe('the staffing ramp', () => {
  it('covers nobody the instant a hospital opens, and everybody later', () => {
    const early = at({ ...housed(19), cash: 1e9 });
    expect(early.buildService(hospital)).toBe(true);
    expect(early.state.hospitalStaff).toBe(0);

    run(early, 1);
    const afterASecond = coverage(early.state, hospital);
    const late = at({ ...housed(19), cash: 1e9 });
    late.buildService(hospital);
    run(late, 600);
    const afterTenMinutes = coverage(late.state, hospital);

    expect(afterASecond).toBeLessThan(afterTenMinutes * 0.5);
    expect(afterTenMinutes).toBeCloseTo(1, 6);
  });

  /**
   * The property that makes offline catch-up safe: the ramp is exponential in
   * dt, so it saturates at 1 for any step size rather than overshooting.
   */
  it('lands in the same place however coarsely it is stepped', () => {
    const whole = at({ ...housed(19), cash: 1e9 });
    whole.buildService(hospital);
    whole.catchUp(600);

    const pieces = at({ ...housed(19), cash: 1e9 });
    pieces.buildService(hospital);
    for (let i = 0; i < 600; i++) pieces.catchUp(1);

    const a = whole.state.hospitalStaff;
    const b = pieces.state.hospitalStaff;
    expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.max(a, b) * 0.01);
    expect(Math.abs(whole.state.happiness - pieces.state.happiness)).toBeLessThanOrEqual(0.01);
  });

  /**
   * The brief called for a slight dip here. The honest weighted average does
   * better than that and by the same rule: four staffed hospitals plus one
   * empty one is four fifths of a payroll across five buildings, so
   * `built x staffing` is unchanged and the cover the city already had is not
   * taken away from it. What the new building costs is time, not coverage.
   */
  it('holds coverage where it was when another one lands, then climbs', () => {
    expect(staffAfterBuild(1, 4)).toBeCloseTo(0.8, 12);
    expect(staffAfterBuild(1, 0)).toBe(0);
    expect(staffAfterBuild(0.5, 1)).toBeCloseTo(0.25, 12);

    // Measured in plots *reached* rather than in coverage, because
    // `built x staffing x plots` is the quantity `staffAfterBuild` is actually
    // a statement about and coverage caps at 1 on top of it.
    //
    // Nine districts of housing, so the land entitles the city to a second
    // hospital: `serviceAllowed` is one ahead of what the housing plots need,
    // and one district's worth would cap the allowance at 2 before the ramp.
    const game = at({ ...housedOn(24 * 9, 3), districts: 9, cash: 1e12 });
    game.buildService(hospital);
    run(game, CIVIC_RAMP_SECONDS * 8);
    const before = covered(game.state, hospital);
    expect(before / hospital.plots).toBeCloseTo(1, 3);

    expect(game.buildService(hospital)).toBe(true);
    expect(covered(game.state, hospital)).toBeCloseTo(before, 9);
    expect(game.state.hospitalStaff).toBeCloseTo(0.5, 3);

    run(game, CIVIC_RAMP_SECONDS * 8);
    expect(covered(game.state, hospital) / before).toBeCloseTo(2, 2);
  });
});

describe('the build gate', () => {
  it('allows exactly one of each with nobody living there', () => {
    const game = at({ cash: 1e12 });
    for (const service of SERVICES) {
      expect(serviceAllowed(game.state, service)).toBe(1);
      expect(game.buildService(service)).toBe(true);
      expect(game.buildService(service)).toBe(false);
      expect(serviceCount(game.state, service.key)).toBe(1);
    }
  });

  it('is never exceeded, at any housing stock or district count', () => {
    for (const districts of [1, 3, 9]) {
      for (let level = 0; level < LEVELS; level++) {
        const game = at({ ...housedOn(24 * districts, level), districts, cash: 1e15 });
        for (let i = 0; i < 400; i++) for (const service of SERVICES) game.buildService(service);
        const s = game.state;
        for (const service of SERVICES) {
          const built = serviceCount(s, service.key);
          expect(built).toBeLessThanOrEqual(Math.floor(housingPlots(s) / service.plots) + 1);
          expect(built).toBeLessThanOrEqual(siteCapacity(s, service.key));
        }
      }
    }
  });

  it('opens up as the housing land fills, and not as the city climbs', () => {
    const small = state({ ...housedOn(1), districts: 9 });
    expect(serviceAllowed(small, hospital)).toBe(1);
    const large = state({ ...housedOn(24 * 9, LEVELS - 1), districts: 9 });
    const plots = 24 * 9;
    expect(housingPlots(large)).toBe(plots);
    // One ahead of need, or the sites the land offers, whichever runs out
    // first. With five types sharing six sites a district it is the land that
    // does, which is the point of the second clamp rather than a bug in it.
    expect(serviceAllowed(large, hospital)).toBe(
      Math.min(Math.floor(plots / hospital.plots) + 1, siteCapacity(large, hospital.key)),
    );
    // And the allowance is the same however tall that land is built, which is
    // the whole of Part 0: it used to climb with the population and promise
    // buildings the six civic sites a district could never hold.
    for (let level = 0; level < LEVELS; level++) {
      const climbed = state({ ...housedOn(plots, level), districts: 9 });
      for (const service of SERVICES) {
        expect(serviceAllowed(climbed, service)).toBe(serviceAllowed(large, service));
      }
    }
  });

  it('never hands out more buildings than there are sites', () => {
    // Two site lists now, so two sums. The four 2x2 types share the civic
    // interleave and must divide it exactly — nothing stranded, nothing double
    // counted — and the university has a list of its own, one to a district.
    for (const districts of [1, 2, 5]) {
      const s = state({ districts });
      const layout = new CityLayout().ensure(districts);
      const civic = CIVIC_SERVICES.reduce((sum, svc) => sum + siteCapacity(s, svc.key), 0);
      expect(civic).toBe(layout.civicSites);
      expect(siteCapacity(s, 'university')).toBe(layout.universitySites);
      expect(siteCapacity(s, 'university')).toBe(districts);
    }
  });
});

describe('the income multiplier', () => {
  it('never drops below the floor, and never above 1', () => {
    for (const happiness of [-5, 0, 0.2, 0.61, 1, 9]) {
      const m = incomeMultiplier(state({ homes: 12, happiness }));
      expect(m).toBeGreaterThanOrEqual(HAPPINESS_FLOOR);
      expect(m).toBeLessThanOrEqual(1);
    }
  });

  it('is exactly the floor at zero happiness and 1 at full', () => {
    expect(incomeMultiplier(state({ ...housed(12), happiness: 0 }))).toBeCloseTo(HAPPINESS_FLOOR, 12);
    expect(incomeMultiplier(state({ ...housed(12), happiness: 1 }))).toBeCloseTo(1, 12);
  });

  it('leaves an unhappy city earning, just badly', () => {
    // Occupancy pinned: an unhappy city does empty out, and this test is about
    // the income *multiplier* being a floor rather than a zero. The emptying is
    // the occupancy integrator's job and is tested where it lives.
    const neglected = state({ ...built(12, 4), happiness: 0 });
    expect(income(neglected)).toBeGreaterThan(0);
    expect(income({ ...neglected, happiness: 1 })).toBeGreaterThan(income(neglected));
  });
});

describe('happiness as a gate on housing', () => {
  /**
   * The teaching moment, and it has no text: housing stalls, the panel names
   * the service that is short, and the player works out the rest.
   */
  it('stops housing below the floor and says why', () => {
    const unhappy = state({ homes: 12, cash: 1e9, happiness: HAPPINESS_MIN_BUILD - 0.01 });
    expect(canBuildHome(unhappy)).toBe(false);
    expect(homeBlocker(unhappy)).toBe('Residents are leaving');
    expect(homeBlocker(unhappy)).not.toBe('');

    const happy = { ...unhappy, happiness: HAPPINESS_MIN_BUILD };
    expect(canBuildHome(happy)).toBe(true);
    expect(homeBlocker(happy)).toBeNull();
  });

  it('lets a fresh city build before it has anything at all', () => {
    // An empty city is at 1, so the opening is not gated by a hospital it has
    // no way to pay for yet.
    const game = new Game(createState(0));
    expect(game.buildHome()).toBe(true);
  });

  /**
   * A hospital used to be worth 0.4 on its own and so cleared the 0.35 gate by
   * itself. Recreation's 0.18 came out of the three service weights, which puts
   * a hospital at 0.34 — a hair under. The tutorial still works and is still
   * short, it is just two purchases rather than one: a hospital plus either the
   * park the panel is about to name or the police station it names first. Both
   * pairs clear the gate with room, and every one of them is cheaper than the
   * hospital was.
   */
  it('needs two purchases to lift the gate, and names one of them', () => {
    const s = state({ ...housed(12), ...staffed({ police: 0, fire: 0 }) });
    expect(happinessTarget(s)).toBeCloseTo(hospital.weight, 12);
    expect(happinessTarget(s)).toBeLessThan(HAPPINESS_MIN_BUILD);

    // The panel points at the biggest shortfall, which is the police station.
    expect(bindingTerm(s).key).toBe('police');
    const policed = { ...s, police: 1, policeStaff: 1 };
    expect(happinessTarget(policed)).toBeGreaterThan(HAPPINESS_MIN_BUILD);

    // And the cheapest fix, a single park, clears it too: five homes covered
    // out of twelve is 0.42 of the recreation term.
    const planted = { ...s, parks: 1 };
    expect(happinessTarget(planted)).toBeGreaterThan(HAPPINESS_MIN_BUILD);
  });

  it('caps residential demand at whatever coverage has reached', () => {
    const s = state({ ...built(10, 20, 15), happiness: 0 });
    expect(residents(s)).toBeGreaterThan(0);
    // Uncapped this city is deeply job-rich and would want housing badly.
    expect(demandTargets({ ...s, happiness: 1 }).r).toBeGreaterThan(0);
    expect(demandTargets(s).r).toBeLessThanOrEqual(0);
  });

  it('holds through the simulation, not just in the read', () => {
    const game = at({ ...built(10, 20, 15), cash: 0 });
    for (let i = 0; i < 3000; i++) {
      game.advance(0.1);
      expect(game.state.demandR).toBeLessThanOrEqual(game.state.happiness + 1e-12);
      expect(game.state.happiness).toBeGreaterThanOrEqual(0);
      expect(game.state.happiness).toBeLessThanOrEqual(1);
    }
  });

  it('lags rather than snapping when the city outgrows it', () => {
    const game = at({ ...housedOn(20), cash: 1e12, ...staffed(), happiness: 1 });
    run(game, 1);
    expect(game.state.happiness).toBeGreaterThan(0.95);
    // Twelve districts of housing appearing at once, which is what an annex and
    // a build-out do over minutes. The state is set directly: what is under
    // test is the happiness lag, not how long the land takes to fill.
    Object.assign(game.state, housedOn(20 * 12));
    // The same three buildings are stretched twelve ways, so coverage has
    // collapsed under them. Levelling no longer does this, and that is the fix
    // — a city is taken short by the land it takes on, not by succeeding on the
    // land it has.
    expect(happinessTarget(game.state)).toBeLessThan(0.3);
    run(game, 1);
    // The residents have not noticed yet. That is the whole point of the lag.
    expect(game.state.happiness).toBeGreaterThan(0.9);
    // Converged, and measured before the city starts boarding plots up: at this
    // happiness occupancy is heading for its floor, and 300 seconds under
    // OCCUPANCY_EMPTY starts writing housing off — which moves the population,
    // which moves coverage, which moves the very target being converged to.
    run(game, 250);
    expect(game.state.happiness).toBeCloseTo(happinessTarget(game.state), 2);
  });
});

describe('civic land', () => {
  it('no longer comes out of housing', () => {
    const bare = state();
    const withCivic = state({ hospitals: 2, police: 1 });
    expect(civicBuildings(withCivic)).toBe(3);
    // Sites are reserved before the housing list is drawn, so opening one
    // cannot move a plot a house is already standing on.
    expect(homeCapacity(withCivic)).toBe(homeCapacity(bare));
  });

  /**
   * The invariant reservation exists to make true, checked against the plot
   * book itself: a home and a civic building can never be handed the same cell,
   * for any count of either, at any city size.
   */
  it('never lets a hospital and a house share a plot', () => {
    for (const districts of [1, 2, 4]) {
      const layout = new CityLayout().ensure(districts);
      const seen = new Set<string>();
      const key = (c: { x: number; z: number }): string => `${c.x},${c.z}`;
      const s = state({ districts });

      for (let i = 0; i < homeCapacity(s); i++) seen.add(key(layout.homeCell(i)));
      for (let i = 0; i < shopCapacity(s); i++) seen.add(key(layout.shopCell(i)));
      for (let i = 0; i < industryCapacity(s); i++) seen.add(key(layout.industryCell(i)));
      const forSale = seen.size;

      for (let i = 0; i < layout.civicSites; i++) {
        const c = layout.civicSiteCell(i);
        for (const cell of [c, { x: c.x + 1, z: c.z }, { x: c.x, z: c.z + 1 }, { x: c.x + 1, z: c.z + 1 }]) {
          expect(seen.has(key(cell))).toBe(false);
          seen.add(key(cell));
        }
      }
      expect(seen.size).toBe(forSale + layout.civicSites * 4);
    }
  });

  /**
   * The determinism trap the fixed interleave exists to avoid: a save stores
   * counts, so if the i-th hospital's site depended on the state when it was
   * built, the city would rearrange itself on the next reload.
   */
  it('places by index, never by build order', () => {
    // Towers, so the population gate allows a dozen buildings rather than three
    // and the two orders have something to disagree about.
    const layout = new CityLayout().ensure(3);
    const patch = (): Partial<GameState> => ({ ...housed(19 * 3, 2), districts: 3, cash: 1e12 });
    const forwards = at(patch());
    for (let i = 0; i < 8; i++) for (const service of SERVICES) forwards.buildService(service);

    const backwards = at(patch());
    for (let i = 0; i < 8; i++) {
      for (const service of [...SERVICES].reverse()) backwards.buildService(service);
    }

    // Where each city's buildings actually stand, as a set of occupied plots.
    const occupied = (s: GameState): Set<string> => {
      const cells = new Set<string>();
      const add = (c: { x: number; z: number }): void => {
        // Also catches two types being handed the same site by the interleave.
        expect(cells.has(`${c.x},${c.z}`)).toBe(false);
        cells.add(`${c.x},${c.z}`);
      };
      // Every 2x2 type, by its own offset in the shared interleave, plus the
      // university's separate list — which must not collide with any of them.
      CIVIC_SERVICES.forEach((service, offset) => {
        for (let i = 0; i < serviceCount(s, service.key); i++) {
          add(layout.civicSiteFor(offset, i));
        }
      });
      for (let i = 0; i < s.universities; i++) add(layout.universitySiteCell(i));
      return cells;
    };

    expect(backwards.state.hospitals).toBe(forwards.state.hospitals);
    expect(civicBuildings(backwards.state)).toBe(civicBuildings(forwards.state));
    expect(civicBuildings(forwards.state)).toBeGreaterThan(3);
    expect([...occupied(backwards.state)].sort()).toEqual([...occupied(forwards.state)].sort());
  });

  it('keeps a site put when the city expands', () => {
    const small = new CityLayout().ensure(1);
    const large = new CityLayout().ensure(9);
    for (let i = 0; i < small.civicSites; i++) {
      expect(large.civicSiteCell(i)).toEqual(small.civicSiteCell(i));
    }
  });

  it('cannot be spent past the sites the city owns', () => {
    const game = at({ ...housed(19, 3), cash: 1e15 });
    for (let i = 0; i < 500; i++) for (const service of SERVICES) game.buildService(service);
    const layout = new CityLayout().ensure(game.state.districts);
    expect(civicBuildings(game.state)).toBeLessThanOrEqual(
      layout.civicSites + layout.universitySites,
    );
    expect(game.state.universities).toBeLessThanOrEqual(layout.universitySites);
  });
});

describe('the tier arc', () => {
  it('never leaves the endgame below the housing gate', () => {
    // Arcologies outrun the civic land on purpose, but the squeeze has to stay
    // survivable: a fully built city at the top tier with every site used must
    // still be able to build the next house.
    const districts = 9;
    const layout = new CityLayout().ensure(districts);
    const perType = Math.ceil(layout.civicSites / 3);
    const s = state({
      districts,
      ...housed(19, LEVEL_CAPACITY.length - 1),
      homes: 19 * districts,
      hospitals: perType,
      police: perType - 1,
      fire: perType - 1,
      hospitalStaff: 1,
      policeStaff: 1,
      fireStaff: 1,
      // Recreation is tier-invariant, so the endgame squeeze is entirely on the
      // three services: the parks that covered this land at tier 0 still cover
      // it at tier 3.
      parks: 4 * districts,
    });
    expect(happinessTarget(s)).toBeGreaterThan(HAPPINESS_MIN_BUILD);
  });
});

/** Which field of `DemandTargets` a zone's signal lives in. */
const TARGET_OF: Record<ZoneKind, 'r' | 'c' | 'i'> = { home: 'r', shop: 'c', industry: 'i' };

describe('services as a demand channel', () => {
  /**
   * A city with land, housing and nothing else. Four districts so the coverages
   * have somewhere to fall short, and happiness pinned at 1 so the residential
   * ceiling is never the thing being measured.
   */
  const bare = (patch: Partial<GameState> = {}): GameState => ({
    ...createState(0),
    districts: 4,
    ...housed(40, 0),
    occupancyR: 0.92,
    happiness: 1,
    cash: 1e9,
    ...patch,
  });

  it('leaves a fresh save exactly where it was', () => {
    // The whole compatibility claim, and the reason `demandLift` is gated on
    // housing at all. Every coverage in this game reads 1 against no housing —
    // it is the share a service *fails*, and it fails nothing when nothing is
    // built — so an ungated table would hand the opening +0.225 of residential
    // demand on its first tick and the export-tap bootstrap would be gone.
    const fresh = createState(0);
    expect(demandLift(fresh, 'home')).toBe(0);
    expect(demandLift(fresh, 'shop')).toBe(0);
    expect(demandLift(fresh, 'industry')).toBe(0);
    const target = demandTargets(fresh);
    expect(target.r).toBe(0);
    expect(target.c).toBe(0);
    // Industry is the one signal a fresh city has, and it is the export tap.
    expect(target.i).toBeGreaterThan(0);
    for (const kind of ZONE_KINDS) expect(demandTerms(fresh, kind)).toHaveLength(0);
  });

  it('moves the signal each service is meant to move, and only that one', () => {
    const before = demandTargets(bare());
    const cases: Array<[Partial<GameState>, ZoneKind]> = [
      [{ police: 2, policeStaff: 1 }, 'home'],
      [{ hospitals: 2, hospitalStaff: 1 }, 'home'],
      [{ parks: 8 }, 'home'],
      [{ museums: 4 }, 'shop'],
    ];
    for (const [patch, moved] of cases) {
      const after = demandTargets(bare(patch));
      expect(after[TARGET_OF[moved]]).toBeGreaterThan(before[TARGET_OF[moved]]);
      // Nothing else stirs. Transit is deliberately not in this list: it has a
      // second, older channel through `labourReach` and moves all three.
      for (const other of ZONE_KINDS) {
        if (other === moved) continue;
        expect(after[TARGET_OF[other]]).toBeCloseTo(before[TARGET_OF[other]], 9);
      }
    }
  });

  it('lets schools reach industry and the tax rate reach both trading zones', () => {
    const before = demandTargets(bare());
    const taught = demandTargets(bare({ schools: 3, schoolStaff: 1 }));
    expect(taught.i).toBeGreaterThan(before.i);
    expect(taught.c).toBeGreaterThan(before.c);
    expect(taught.r).toBeCloseTo(before.r, 9);

    // Tax needs a hall, because a rate is policy and policy needs somebody to
    // set it — a save with the switch flipped and no hall runs at neutral.
    const punitive = demandTargets(bare({ cityHall: true, taxRate: TAX_STEPS.length - 1 }));
    const low = demandTargets(bare({ cityHall: true, taxRate: 0 }));
    expect(punitive.c).toBeLessThan(before.c);
    expect(punitive.i).toBeLessThan(before.i);
    expect(low.c).toBeGreaterThan(before.c);
    expect(low.i).toBeGreaterThan(before.i);
    // And it reaches housing through mood alone, exactly as it did before.
    expect(punitive.r).toBeCloseTo(before.r, 9);
  });

  it('reads the tax table on both sides of neutral', () => {
    const at = (rate: number): number => taxPressure(bare({ cityHall: true, taxRate: rate }));
    expect(at(TAX_NEUTRAL)).toBe(0);
    expect(at(0)).toBeCloseTo(-1, 9);
    expect(at(TAX_STEPS.length - 1)).toBeCloseTo(1, 9);
    // Monotone in the rate, so a step up is never a step down for business.
    for (let i = 1; i < TAX_STEPS.length; i++) expect(at(i)).toBeGreaterThan(at(i - 1));
    // And neutral is what a city with no hall is on, whatever it has stored.
    expect(taxPressure(bare({ taxRate: TAX_STEPS.length - 1 }))).toBe(0);
  });

  it('gives no single term enough weight to pin a signal', () => {
    expect(DEMAND_TERM_MAX).toBeLessThan(1);
    // Nor the whole table for one zone, at either extreme of every reading.
    for (const kind of ZONE_KINDS) {
      let span = 0;
      for (const term of DEMAND_TERMS) {
        if (term.zone === kind) span += Math.abs(term.weight) * (term.centred ? 0.5 : 1);
      }
      expect(span).toBeLessThan(1);
    }
  });

  it('keeps the happiness ceiling on housing', () => {
    // The hospital tutorial depends on it: a city with no hospital cannot want
    // more people however covered it is in everything else. The service terms
    // push at the target from underneath and must never lift it past mood.
    const covered = bare({
      police: 4, policeStaff: 1, parks: 20, happiness: 0.2,
    });
    expect(demandLift(covered, 'home')).toBeGreaterThan(0);
    expect(demandTargets(covered).r).toBeLessThanOrEqual(covered.happiness + 1e-12);
  });

  it('adds up to what the breakdown says it does', () => {
    // The panel and the simulation read one table, so they cannot disagree —
    // this is what asserts they are actually the same table.
    const city = bare({
      police: 3, policeStaff: 1, hospitals: 3, hospitalStaff: 1, parks: 10,
      depots: 2, depotStaff: 1, museums: 4, schools: 3, schoolStaff: 1,
      cityHall: true, taxRate: 2,
    });
    for (const kind of ZONE_KINDS) {
      const rows = demandTerms(city, kind);
      const summed = rows.reduce((total, row) => total + row.value, 0);
      expect(summed).toBeCloseTo(demandLift(city, kind), 12);
      expect(rows).toHaveLength(DEMAND_TERMS.filter((term) => term.zone === kind).length);
    }
  });

  it('gives catch-up and real time the same demand, with the terms live', () => {
    // The table adds no lag of its own — it is read off the state every tick and
    // `Game.step` remains the only thing that integrates — so an hour away and
    // an hour watched still have to land on the same city. Catch-up runs
    // 60-second steps against a 25-second constant, which is exactly the case a
    // term with a hidden integrator in it would break.
    // No schools, and that is a property of the *probe* rather than of the
    // terms: a school opens LEVEL_EDUCATION's first rung, the cohort starts
    // promoting, and whole buildings promote at slightly different moments under
    // 60-second steps than under tenths — which is a levelling question this
    // test has no business measuring. The education term is covered by the
    // breakdown test instead, which reads it directly.
    const patch = {
      cash: 0,
      police: 2, policeStaff: 1, hospitals: 1, hospitalStaff: 1,
      museums: 2, depots: 1, depotStaff: 1,
      cityHall: true, taxRate: TAX_STEPS.length - 1,
    };
    const away = new Game(bare(patch));
    const watched = new Game(bare(patch));
    away.catchUp(3_600);
    for (let i = 0; i < 36_000; i++) watched.advance(0.1);

    for (const key of ['demandR', 'demandC', 'demandI'] as const) {
      const gap = Math.abs(away.state[key] - watched.state[key]);
      expect(gap).toBeLessThanOrEqual(Math.max(0.01, Math.abs(watched.state[key]) * 0.01));
    }
  });
});
