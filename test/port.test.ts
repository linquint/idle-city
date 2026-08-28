import { describe, expect, it } from 'vitest';
import {
  AIRPORT_VISITORS,
  CARGO_EXPORT_LIFT,
  EXPORT_BASE,
  FRONTAGE_TARGET,
  LEVELS,
  LEVEL_FOOTPRINT,
  OCCUPANCY_FULL,
  ROAD_VISITORS,
  SERVICES,
  SPEND_PER_RESIDENT,
  VISITOR_TRIPS,
  EXPORT_PER_DISTRICT,
  MAX_DISTRICTS,
  TERMINALS,
  VISITOR_SPEND,
  VISITORS_PER_RESIDENT,
  type Terminal,
} from '../src/sim/config';
import {
  berthsLanding,
  canBuildTerminal,
  cruiseIncome,
  landmarkCoverage,
  serviceAllowed,
  visitorShare,
  visitorSources,
  demandTargets,
  exportMarket,
  hasCoast,
  income,
  residents,
  terminalBlocker,
  terminalCapacity,
  terminalCost,
  terminalCount,
  terminalReadings,
  visitors,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { coastalDistricts, districtCoord, districtIsCoastal, portDistrict } from '../src/sim/layout';
import { migrate } from '../src/sim/save';
import { createState, type GameState } from '../src/sim/state';
import { housed, housedOn, making, trading } from './levels';

const cruise = TERMINALS.find((t) => t.key === 'cruise') as Terminal;
const cargo = TERMINALS.find((t) => t.key === 'cargo') as Terminal;

/** The first district count at which the city owns a coastal district. */
const FIRST_COAST = portDistrict(MAX_DISTRICTS) + 1;

/** A city of `districts` districts with `homes` top-level homes in it. */
function city(districts: number, patch: Partial<GameState> = {}): GameState {
  const s = createState(0);
  s.districts = districts;
  s.cash = 1e12;
  s.happiness = 1;
  return Object.assign(s, patch);
}

describe('where a port may be built', () => {
  it('offers no berth until the city has annexed a coastal district', () => {
    expect(FIRST_COAST).toBeGreaterThan(1);
    for (let n = 1; n < FIRST_COAST; n++) {
      const s = city(n);
      expect(hasCoast(s)).toBe(false);
      expect(terminalCapacity(s)).toBe(0);
      expect(canBuildTerminal(s, cruise)).toBe(false);
      expect(canBuildTerminal(s, cargo)).toBe(false);
      expect(terminalBlocker(s, cruise)).toBe('No coast yet');
    }
    const reached = city(FIRST_COAST);
    expect(hasCoast(reached)).toBe(true);
    expect(terminalCapacity(reached)).toBe(1);
    expect(canBuildTerminal(reached, cruise)).toBe(true);
    expect(terminalBlocker(reached, cruise)).toBeNull();
  });

  it('gives one berth of each kind per coastal district, and no more', () => {
    for (let n = 1; n <= MAX_DISTRICTS; n++) {
      const s = city(n);
      let coastal = 0;
      for (let i = 0; i < n; i++) {
        const c = districtCoord(i);
        if (districtIsCoastal(c.x, c.z)) coastal++;
      }
      expect(terminalCapacity(s)).toBe(coastal);
      expect(coastalDistricts(n)).toBe(coastal);
    }
  });

  it('stops selling berths once every quay is taken', () => {
    const s = city(MAX_DISTRICTS);
    const berths = terminalCapacity(s);
    expect(berths).toBeGreaterThan(1);
    s.cruiseTerminals = berths;
    expect(canBuildTerminal(s, cruise)).toBe(false);
    expect(terminalBlocker(s, cruise)).toBe('No berths left');
    // The two kinds are counted apart: filling the cruise berths does not use
    // up the cargo ones, since a quay carries one of each.
    expect(canBuildTerminal(s, cargo)).toBe(true);
    expect(terminalBlocker(s, cargo)).toBeNull();
  });

  it('prices a berth on its own count, exponentially', () => {
    const s = city(MAX_DISTRICTS);
    for (const terminal of TERMINALS) {
      let previous = 0;
      for (let built = 0; built < 6; built++) {
        const at = city(MAX_DISTRICTS, {
          cruiseTerminals: terminal.key === 'cruise' ? built : 0,
          cargoTerminals: terminal.key === 'cargo' ? built : 0,
        });
        const cost = terminalCost(at, terminal);
        expect(cost).toBeGreaterThan(previous);
        previous = cost;
      }
      expect(terminalCost(s, terminal)).toBe(terminal.base);
    }
  });

  it('takes the cash and the berth when one is built', () => {
    const game = new Game(city(MAX_DISTRICTS));
    const before = game.state.cash;
    const price = terminalCost(game.state, cruise);
    expect(game.buildTerminal(cruise)).toBe(true);
    expect(game.state.cruiseTerminals).toBe(1);
    expect(game.state.cargoTerminals).toBe(0);
    expect(game.state.cash).toBeCloseTo(before - price, 6);
    expect(terminalCount(game.state, 'cruise')).toBe(1);
  });

  it('refuses one the city cannot pay for or has no coast for', () => {
    const broke = new Game(city(MAX_DISTRICTS, { cash: 1 }));
    expect(broke.buildTerminal(cruise)).toBe(false);
    expect(broke.state.cruiseTerminals).toBe(0);

    const inland = new Game(city(1));
    expect(inland.buildTerminal(cargo)).toBe(false);
    expect(inland.state.cargoTerminals).toBe(0);
  });

  it('reports both kinds in one read for the panel', () => {
    const s = city(MAX_DISTRICTS, { cruiseTerminals: 2 });
    const rows = terminalReadings(s);
    expect(rows.map((row) => row.terminal.key)).toEqual(['cruise', 'cargo']);
    expect(rows[0]?.built).toBe(2);
    expect(rows[1]?.built).toBe(0);
    for (const row of rows) expect(row.allowed).toBe(terminalCapacity(s));
  });
});

describe('what a cruise terminal earns', () => {
  const populous = (patch: Partial<GameState> = {}): GameState =>
    city(MAX_DISTRICTS, { ...housedOn(200, 2), ...patch });

  it('lands nobody until a berth is open', () => {
    expect(visitors(populous())).toBe(0);
    expect(cruiseIncome(populous())).toBe(0);
  });

  it('scales with the city it serves and with its mood', () => {
    const happy = populous({ cruiseTerminals: 1 });
    expect(visitors(happy)).toBeCloseTo(residents(happy) * VISITORS_PER_RESIDENT, 6);
    expect(cruiseIncome(happy)).toBeCloseTo(visitors(happy) * VISITOR_SPEND, 6);

    const half = populous({ cruiseTerminals: 1, happiness: 0.5 });
    expect(visitors(half)).toBeCloseTo(visitors(happy) / 2, 6);

    // The one income line that goes to zero rather than to HAPPINESS_FLOOR.
    const grim = populous({ cruiseTerminals: 1, happiness: 0 });
    expect(visitors(grim)).toBe(0);
    expect(income(grim)).toBeGreaterThan(0);
  });

  it('adds to the ledger, and a second berth adds as much again', () => {
    const none = populous();
    const one = populous({ cruiseTerminals: 1 });
    const two = populous({ cruiseTerminals: 2 });
    expect(income(one)).toBeGreaterThan(income(none));
    expect(income(two) - income(one)).toBeCloseTo(income(one) - income(none), 6);
  });

  it('stays outside the multipliers rent goes through', () => {
    // Tourism is not rent, so it must not pick up the shop, industry or
    // district bonus — the same rule fares are held to.
    const plain = populous({ cruiseTerminals: 1 });
    const shoppy = populous({ cruiseTerminals: 1, shops: 40, shopLevels: [40, 0, 0, 0, 0] });
    expect(cruiseIncome(shoppy)).toBeCloseTo(cruiseIncome(plain), 6);
  });
});

describe('what a cargo terminal moves', () => {
  it('lifts the export tap rather than opening a second one', () => {
    const base = city(MAX_DISTRICTS);
    const tap = EXPORT_BASE + EXPORT_PER_DISTRICT * (MAX_DISTRICTS - 1);
    expect(exportMarket(base)).toBeCloseTo(tap, 6);
    for (let berths = 1; berths <= 4; berths++) {
      const with_ = city(MAX_DISTRICTS, { cargoTerminals: berths });
      expect(exportMarket(with_)).toBeCloseTo(tap * (1 + CARGO_EXPORT_LIFT * berths), 6);
    }
  });

  it('pushes industrial demand up and leaves the other two alone', () => {
    const supplied = { ...city(MAX_DISTRICTS), ...housedOn(60, 1), shops: 30, industry: 20 };
    supplied.shopLevels = [30, 0, 0, 0, 0];
    supplied.industryLevels = [20, 0, 0, 0, 0];
    const before = demandTargets(supplied);
    const after = demandTargets({ ...supplied, cargoTerminals: 2 });
    expect(after.i).toBeGreaterThan(before.i);
    expect(after.r).toBeCloseTo(before.r, 9);
    expect(after.c).toBeCloseTo(before.c, 9);
  });

  it('earns nothing directly', () => {
    const populous = { ...city(MAX_DISTRICTS), ...housedOn(200, 2) };
    expect(income({ ...populous, cargoTerminals: 3 })).toBeCloseTo(income(populous), 6);
  });
});

describe('a port across a save', () => {
  it('defaults to none for every save written before there was a coast', () => {
    const back = migrate({ cash: 10, homes: 4, districts: 2 }, 1_000) as GameState;
    expect(back.cruiseTerminals).toBe(0);
    expect(back.cargoTerminals).toBe(0);
    expect(visitors(back)).toBe(0);
    expect(exportMarket(back)).toBeCloseTo(EXPORT_BASE + EXPORT_PER_DISTRICT, 6);
  });

  it('carries what was built, and clamps it to the berths the city owns', () => {
    const kept = migrate(
      { homes: 9, districts: MAX_DISTRICTS, cruiseTerminals: 2, cargoTerminals: 1 },
      0,
    ) as GameState;
    expect(kept.cruiseTerminals).toBe(2);
    expect(kept.cargoTerminals).toBe(1);

    // A save claiming more berths than its districts carry loses the extras,
    // exactly as one claiming more hospitals than sites does.
    const trimmed = migrate(
      { homes: 9, districts: FIRST_COAST, cruiseTerminals: 99, cargoTerminals: 99 },
      0,
    ) as GameState;
    expect(trimmed.cruiseTerminals).toBe(terminalCapacity(trimmed));
    expect(trimmed.cargoTerminals).toBe(terminalCapacity(trimmed));
  });

  it('gives an inland save no berths whatever it claims', () => {
    const inland = migrate({ homes: 4, districts: 1, cruiseTerminals: 5 }, 0) as GameState;
    expect(inland.cruiseTerminals).toBe(0);
    expect(hasCoast(inland)).toBe(false);
  });
});

/**
 * Road tourism: the third source, folded into the one arrivals expression.
 *
 * Landmark-driven rather than terminal-driven, which is what makes it worth
 * having: a quay needs a coastal district and a runway needs the highway's
 * fourteen, so a landlocked young city had no tourism at all.
 */
/** A city of `districts` built out to its frontage at `level`, fully served. */
function builtOut(districts: number, level: number, patch: Partial<GameState> = {}): GameState {
  const s = createState(0);
  s.districts = districts;
  const foot = LEVEL_FOOTPRINT[level] ?? 1;
  const fit = (per: number): number => Math.floor((districts * per) / foot);
  const cohort = (n: number): number[] => {
    const levels = new Array<number>(LEVELS).fill(0);
    levels[level] = n;
    return levels;
  };
  const homes = fit(FRONTAGE_TARGET.residential);
  const shops = fit(FRONTAGE_TARGET.commercial);
  const works = fit(FRONTAGE_TARGET.industrial);
  Object.assign(s, {
    homes,
    shops,
    industry: works,
    homeLevels: cohort(homes),
    shopLevels: cohort(shops),
    industryLevels: cohort(works),
    mergedR: foot > 1 ? homes : 0,
    mergedC: foot > 1 ? shops : 0,
    mergedI: foot > 1 ? works : 0,
    occupancyR: OCCUPANCY_FULL,
    occupancyC: OCCUPANCY_FULL,
    occupancyI: OCCUPANCY_FULL,
    happiness: 1,
    parks: districts * 4,
    plants: districts,
    plantStaff: 1,
    cityHall: true,
  });
  for (const service of SERVICES) {
    const n = serviceAllowed(s, service);
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
  Object.assign(s, patch);
  return s;
}

describe('tourists who arrive by road', () => {
  it('lands through the one arrivals expression, not a second one', () => {
    // The rule the airport already followed: `visitors` is berths x residents x
    // VISITORS_PER_RESIDENT x happiness, and every source is berths. A second
    // path would be a second place for the happiness scaling to be got wrong.
    const s = builtOut(4, 1, { museums: 4, stadiums: 4, cruiseTerminals: 1, airport: true });
    expect(berthsLanding(s)).toBeCloseTo(
      s.cruiseTerminals + AIRPORT_VISITORS + ROAD_VISITORS * landmarkCoverage(s),
      9,
    );
    expect(visitors(s)).toBeCloseTo(
      berthsLanding(s) * residents(s) * VISITORS_PER_RESIDENT * s.happiness,
      6,
    );
  });

  it('gives a landlocked city tourism from district one', () => {
    // The whole point. No coast, no highway, no runway — and a museum.
    const bare = builtOut(1, 1);
    expect(terminalCapacity(bare)).toBe(0);
    expect(bare.highway).toBe(false);
    expect(visitors(bare)).toBe(0);

    const marked = builtOut(1, 1, { museums: 1, stadiums: 1 });
    expect(landmarkCoverage(marked)).toBeGreaterThan(0);
    expect(visitors(marked)).toBeGreaterThan(0);
    expect(visitorSources(marked).road).toBeCloseTo(visitors(marked), 6);
    expect(visitorSources(marked).quay).toBe(0);
    expect(visitorSources(marked).air).toBe(0);
  });

  it('goes to nothing at happiness zero, coach included', () => {
    // Nobody's holiday is somewhere grim, and that has to stay true of a coach.
    for (const patch of [
      { museums: 4, stadiums: 4 },
      { cruiseTerminals: 1 },
      { airport: true },
      { museums: 4, stadiums: 4, cruiseTerminals: 1, airport: true },
    ]) {
      const grim = builtOut(4, 1, { ...patch, happiness: 0 });
      expect(visitors(grim)).toBe(0);
      expect(cruiseIncome(grim)).toBe(0);
      const sources = visitorSources(grim);
      expect(sources.road).toBe(0);
      expect(sources.quay).toBe(0);
      expect(sources.air).toBe(0);
    }
  });

  it('splits one number three ways rather than modelling it three times', () => {
    const s = builtOut(25, 2, { museums: 25, stadiums: 25, cruiseTerminals: 2, airport: true });
    const from = visitorSources(s);
    expect(from.total).toBeCloseTo(visitors(s), 6);
    expect(from.quay + from.air + from.road).toBeCloseTo(from.total, 6);
    for (const part of [from.quay, from.air, from.road]) expect(part).toBeGreaterThan(0);
  });

  it('rises with the landmarks, and stops at what the sites allow', () => {
    let last = 0;
    for (const n of [0, 1, 2, 4, 8]) {
      const s = builtOut(8, 1, { museums: n, stadiums: n });
      expect(visitorSources(s).road).toBeGreaterThanOrEqual(last);
      last = visitorSources(s).road;
    }
    // Bounded by ROAD_VISITORS berths times the coverage, whatever is built:
    // landmarks saturate against the *sites* the land holds, so a city cannot
    // buy its way past the coverage its districts allow.
    const covered = builtOut(8, 1, { museums: 80, stadiums: 80 });
    expect(landmarkCoverage(covered)).toBeLessThanOrEqual(1);
    expect(berthsLanding(covered)).toBeCloseTo(ROAD_VISITORS * landmarkCoverage(covered), 6);
    expect(berthsLanding(covered)).toBeLessThanOrEqual(ROAD_VISITORS + 1e-9);
  });
});

/**
 * Where tourism actually reaches the ledger.
 *
 * Not through its own line, which is asymptotically nothing — see VISITOR_TRIPS
 * for the measurement — but through commercial demand, the shops it justifies
 * and SHOP_BONUS, which is how every other resident's spending reaches it.
 */
describe('what a visitor is worth', () => {
  const city = (districts: number, patch: Partial<GameState> = {}): GameState =>
    ({ ...createState(0), districts, ...patch });

  it('lifts commercial demand rather than opening a line of its own', () => {
    const base = {
      ...housed(96),
      ...trading(45),
      districts: 4,
      occupancyR: 1,
      occupancyC: 1,
      happiness: 1,
      museums: 4,
      stadiums: 4,
    };
    const touristed = city(4, base);
    const closed = city(4, { ...base, museums: 0, stadiums: 0 });
    expect(visitors(touristed)).toBeGreaterThan(0);
    expect(visitors(closed)).toBe(0);
    // Commerce is what moves. Housing and industry read the visitors not at all
    // — they are shoppers, not residents and not a market for goods.
    expect(demandTargets(touristed).c).toBeGreaterThan(demandTargets(closed).c);
    expect(demandTargets(touristed).r).toBeCloseTo(demandTargets(closed).r, 9);
  });

  it('is a share of the shopping the panel can name', () => {
    const s = city(4, {
      ...housed(96),
      ...trading(45),
      occupancyR: 1,
      happiness: 1,
      museums: 4,
      stadiums: 4,
      cruiseTerminals: 1,
    });
    const guests = visitors(s) * VISITOR_TRIPS;
    const locals = residents(s) * SPEND_PER_RESIDENT;
    expect(visitorShare(s)).toBeCloseTo(guests / (guests + locals), 9);
    expect(visitorShare(s)).toBeGreaterThan(0);
    expect(visitorShare(s)).toBeLessThan(1);
    // Zero for a city with no visitors, rather than a divide by nothing.
    expect(visitorShare(city(4, { ...housed(96), occupancyR: 1 }))).toBe(0);
    expect(visitorShare(city(1))).toBe(0);
  });

  it('never pins commerce that was not already pinned', () => {
    // The bound VISITOR_TRIPS was chosen against. Commerce is the signal
    // nearest its upper bound — DEMAND_TERMS says so — so a tourism term that
    // pinned it would have taken a decision away rather than added one.
    // The same {1,4,12,25,49} x {0..4} grid of *built-out, fully served* cities
    // the constant was chosen against — see VISITOR_TRIPS, which carries the
    // table. A city with no services and no industry sits somewhere no real
    // city does, and would be measuring the fixture rather than the term.
    let pinned = 0;
    for (const districts of [1, 4, 12, 25, MAX_DISTRICTS]) {
      for (let level = 0; level < LEVELS; level++) {
        const closed = builtOut(districts, level);
        const touristed = builtOut(districts, level, {
          museums: districts,
          stadiums: districts,
          cruiseTerminals: terminalCapacity(closed),
          airport: districts >= 14,
        });
        const before = demandTargets(closed).c;
        const after = demandTargets(touristed).c;
        expect(after).toBeGreaterThanOrEqual(before - 1e-9);
        if (before < 0.999 && after >= 0.999) pinned++;
      }
    }
    expect(pinned).toBe(0);
  });

  it('is still a vanishing line on its own, which is why it goes through commerce', () => {
    // The measurement the design turns on, asserted rather than described:
    // tourism sits outside the income bracket, so its own spend line shrinks
    // against a ledger that compounds. This is what a fourth berth would have
    // been worth if it had been left there.
    const share = (districts: number, level: number): number => {
      const foot = LEVEL_FOOTPRINT[level] ?? 1;
      const s = city(districts, {
        ...housed(Math.floor((24 * districts) / foot), level),
        ...trading(Math.floor((45 * districts) / foot), level),
        ...making(Math.floor((13 * districts) / foot), level),
        districts,
        occupancyR: 1,
        occupancyC: 1,
        occupancyI: 1,
        happiness: 1,
        museums: districts,
        stadiums: districts,
      });
      return cruiseIncome(s) / income(s);
    };
    // Falls by orders of magnitude across the map and the ladder.
    expect(share(1, 0)).toBeGreaterThan(share(MAX_DISTRICTS, LEVELS - 1) * 100);
    expect(share(MAX_DISTRICTS, LEVELS - 1)).toBeLessThan(1e-4);
  });
});
