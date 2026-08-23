import { describe, expect, it } from 'vitest';
import {
  CIVIC_RAMP_SECONDS,
  HAPPINESS_FLOOR,
  HAPPINESS_MIN_BUILD,
  SERVICES,
  TIERS,
} from '../src/sim/config';
import {
  bindingTerm,
  canBuildHome,
  civicBuildings,
  covered,
  coverage,
  demandTargets,
  happinessTarget,
  homeBlocker,
  income,
  incomeMultiplier,
  residents,
  industryCapacity,
  homeCapacity,
  serviceAllowed,
  serviceCount,
  shopCapacity,
  siteCapacity,
  staffAfterBuild,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { CityLayout } from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';

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
    const bare = state({ homes: 10 });
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
    for (const homes of [1, 4, 12, 19]) {
      for (const tier of [0, 1, 2, 3]) {
        for (const built of [0, 1, 3, 40]) {
          for (const staff of [0, 0.37, 1]) {
            const s = state({
              homes,
              tier,
              hospitals: built,
              hospitalStaff: staff,
            });
            const people = residents(s);
            expect(people).toBeGreaterThan(0);
            const reach = coverage(s, hospital);
            expect(reach).toBeLessThanOrEqual(1);
            expect(reach).toBeLessThanOrEqual((built * hospital.capacity) / people + 1e-12);
            expect(reach).toBeCloseTo(Math.min(1, covered(s, hospital) / people), 12);
          }
        }
      }
    }
  });

  it('goes short again when the city rezones under it', () => {
    // A district's four parks cover its nineteen homes outright, so this is a
    // city that has everything: 1 is reachable only with the fourth term too.
    const before = state({ homes: 19, parks: 4, ...staffed() });
    const after = { ...before, tier: 3 };
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
    const s = state({ homes: 19, tier: 3, parks: 4, ...staffed({ police: 3, fire: 4 }) });
    expect(bindingTerm(s).key).toBe('hospital');
    const policed = { ...s, hospitals: 9, police: 0 };
    expect(bindingTerm(policed).key).toBe('police');
    const served = { ...s, hospitals: 9, police: 9, fire: 9, parks: 0 };
    expect(bindingTerm(served).key).toBe('recreation');
  });
});

describe('the staffing ramp', () => {
  it('covers nobody the instant a hospital opens, and everybody later', () => {
    const early = at({ homes: 19, cash: 1e9 });
    expect(early.buildService(hospital)).toBe(true);
    expect(early.state.hospitalStaff).toBe(0);

    run(early, 1);
    const afterASecond = coverage(early.state, hospital);
    const late = at({ homes: 19, cash: 1e9 });
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
    const whole = at({ homes: 19, cash: 1e9 });
    whole.buildService(hospital);
    whole.catchUp(600);

    const pieces = at({ homes: 19, cash: 1e9 });
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

    // Arcologies, so two hospitals are still short of the population and the
    // clamp at 1 cannot hide the arithmetic.
    const game = at({ homes: 19, tier: 3, cash: 1e12 });
    game.buildService(hospital);
    run(game, CIVIC_RAMP_SECONDS * 8);
    const before = coverage(game.state, hospital);
    expect(before).toBeCloseTo(hospital.capacity / residents(game.state), 3);

    expect(game.buildService(hospital)).toBe(true);
    expect(coverage(game.state, hospital)).toBeCloseTo(before, 9);
    expect(game.state.hospitalStaff).toBeCloseTo(0.5, 3);

    run(game, CIVIC_RAMP_SECONDS * 8);
    expect(coverage(game.state, hospital)).toBeCloseTo(before * 2, 3);
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

  it('is never exceeded, at any population or district count', () => {
    for (const districts of [1, 3, 9]) {
      for (const tier of [0, 1, 2, 3]) {
        const game = at({ districts, tier, homes: 19 * districts, cash: 1e15 });
        for (let i = 0; i < 400; i++) for (const service of SERVICES) game.buildService(service);
        const s = game.state;
        for (const service of SERVICES) {
          const built = serviceCount(s, service.key);
          expect(built).toBeLessThanOrEqual(Math.floor(residents(s) / service.capacity) + 1);
          expect(built).toBeLessThanOrEqual(siteCapacity(s, service.key));
        }
      }
    }
  });

  it('opens up as the population grows past a capacity', () => {
    const small = state({ homes: 1, districts: 9 });
    expect(serviceAllowed(small, hospital)).toBe(1);
    const large = state({ homes: 19, tier: 3, districts: 9 });
    expect(residents(large)).toBe(19 * 300);
    expect(serviceAllowed(large, hospital)).toBe(
      Math.floor((19 * 300) / hospital.capacity) + 1,
    );
  });

  it('never hands out more buildings than there are sites', () => {
    for (const districts of [1, 2, 5]) {
      const s = state({ districts });
      const total = SERVICES.reduce((sum, svc) => sum + siteCapacity(s, svc.key), 0);
      expect(total).toBe(new CityLayout().ensure(districts).civicSites);
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
    expect(incomeMultiplier(state({ homes: 12, happiness: 0 }))).toBeCloseTo(HAPPINESS_FLOOR, 12);
    expect(incomeMultiplier(state({ homes: 12, happiness: 1 }))).toBeCloseTo(1, 12);
  });

  it('leaves an unhappy city earning, just badly', () => {
    const neglected = state({ homes: 12, shops: 4, happiness: 0 });
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
    const s = state({ homes: 12, ...staffed({ police: 0, fire: 0 }) });
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
    const s = state({ homes: 10, shops: 20, industry: 15, happiness: 0 });
    expect(residents(s)).toBeGreaterThan(0);
    // Uncapped this city is deeply job-rich and would want housing badly.
    expect(demandTargets({ ...s, happiness: 1 }).r).toBeGreaterThan(0);
    expect(demandTargets(s).r).toBeLessThanOrEqual(0);
  });

  it('holds through the simulation, not just in the read', () => {
    const game = at({ homes: 10, shops: 20, industry: 15, cash: 0 });
    for (let i = 0; i < 3000; i++) {
      game.advance(0.1);
      expect(game.state.demandR).toBeLessThanOrEqual(game.state.happiness + 1e-12);
      expect(game.state.happiness).toBeGreaterThanOrEqual(0);
      expect(game.state.happiness).toBeLessThanOrEqual(1);
    }
  });

  it('lags rather than snapping when the city rezones under it', () => {
    const game = at({ homes: 19, cash: 1e12, ...staffed(), happiness: 1 });
    run(game, 1);
    expect(game.state.happiness).toBeGreaterThan(0.95);
    game.rezone();
    game.rezone();
    game.rezone();
    // The population just went up 75x, so coverage has collapsed under it.
    expect(happinessTarget(game.state)).toBeLessThan(0.3);
    run(game, 1);
    // The residents have not noticed yet. That is the whole point of the lag.
    expect(game.state.happiness).toBeGreaterThan(0.9);
    run(game, 600);
    expect(game.state.happiness).toBeCloseTo(happinessTarget(game.state), 3);
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
    const patch = { districts: 3, tier: 2, homes: 19 * 3, cash: 1e12 };
    const forwards = at(patch);
    for (let i = 0; i < 8; i++) for (const service of SERVICES) forwards.buildService(service);

    const backwards = at(patch);
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
      for (let i = 0; i < s.hospitals; i++) add(layout.hospitalSite(i));
      for (let i = 0; i < s.police; i++) add(layout.policeSite(i));
      for (let i = 0; i < s.fire; i++) add(layout.fireSite(i));
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
    const game = at({ homes: 19, tier: 3, cash: 1e15 });
    for (let i = 0; i < 500; i++) for (const service of SERVICES) game.buildService(service);
    expect(civicBuildings(game.state)).toBeLessThanOrEqual(
      new CityLayout().ensure(game.state.districts).civicSites,
    );
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
      tier: TIERS.length - 1,
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
