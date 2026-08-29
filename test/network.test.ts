import { describe, expect, it } from 'vitest';
import {
  FREE_TRANSPORT_RIDERSHIP,
  LEVELS,
  MAX_DISTRICTS,
  NETWORK_EXPORT_LIFT,
  NETWORK_ROAD_SHARE,
  NETWORK_WORKFORCE,
  RANK_GATES,
  TRANSIT_LINES,
  TRANSIT_MAX_SHARE,
  TRANSIT_ROAD_SHARE,
} from '../src/sim/config';
import {
  canBuildLine,
  congestion,
  coverage,
  exportMarket,
  happinessTarget,
  lineAllowed,
  lineCost,
  lineRoute,
  networkCapacity,
  networkReach,
  networkService,
  parkCapacity,
  reachableWorkers,
  serviceAllowed,
  transitShare,
  visitorSources,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import {
  districtCoord,
  linePairAt,
  linePairCapacity,
  networkedDistricts,
} from '../src/sim/layout';
import { SERVICES } from '../src/sim/config';
import { BUILDABLE_RESIDENTIAL_PER_DISTRICT } from '../src/sim/layout';
import { migrate } from '../src/sim/save';
import { createState, SAVE_VERSION, type GameState } from '../src/sim/state';
import { housedOn, making, served, trading, zoning } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/** What `save` writes and `load` reads back, without touching localStorage. */
const written = (s: GameState): Record<string, unknown> =>
  JSON.parse(JSON.stringify(s)) as Record<string, unknown>;

const SIZES = [1, 2, 4, 12, 25, MAX_DISTRICTS];

/** A city of `districts` built out at `level`, fully served, with `tram`/`rail` laid. */
function city(
  districts: number,
  level: number,
  patch: Partial<GameState> = {},
): GameState {
  const plots = 24 * districts;
  return state({
    ...zoning(districts),
    ...housedOn(plots, level),
    ...trading(Math.floor((45 * districts) / (level >= 2 ? 2 : 1)), level),
    ...making(Math.floor((13 * districts) / (level >= 2 ? 2 : 1)), level),
    ...served(),
    districts,
    happiness: 1,
    cityHall: true,
    ...patch,
  });
}

const TRAM = TRANSIT_LINES[0]!;
const RAIL = TRANSIT_LINES[1]!;

describe('where a line runs', () => {
  /**
   * The whole reason the save can be two counts. If the k-th line ever moved,
   * a returning player's network would re-route itself around a save that had
   * not changed — the failure `civicSiteFor` and `landmarkSiteCell` both exist
   * to avoid.
   */
  it('does not move when the city annexes', () => {
    for (const kind of ['tram', 'rail'] as const) {
      for (let k = 0; k < 20; k++) {
        const small = linePairAt(kind, k, 12);
        if (small === null) continue;
        for (const districts of [13, 25, 40, MAX_DISTRICTS]) {
          expect(linePairAt(kind, k, districts)).toEqual(small);
        }
      }
    }
  });

  /** Bounded on every read, so `reset` takes the network back with the city. */
  it('offers no pair the city does not own both ends of', () => {
    for (const districts of SIZES) {
      for (const kind of ['tram', 'rail'] as const) {
        const capacity = linePairCapacity(kind, districts);
        expect(capacity).toBeLessThanOrEqual(Math.max(0, districts - 1));
        for (let k = 0; k < capacity; k++) {
          const pair = linePairAt(kind, k, districts);
          expect(pair).not.toBeNull();
          expect(pair!.a).toBeLessThan(districts);
          expect(pair!.b).toBeLessThan(districts);
          expect(pair!.a).toBeLessThan(pair!.b);
        }
        expect(linePairAt(kind, capacity, districts)).toBeNull();
      }
    }
  });

  /**
   * The one thing that separates the two rungs in geometry rather than in
   * balance: a tram runs along a street and a train runs on its own alignment.
   */
  it('runs a tram between neighbours and a train as far as it can', () => {
    const gap = (a: number, b: number): number => {
      const p = districtCoord(a);
      const q = districtCoord(b);
      return Math.abs(p.x - q.x) + Math.abs(p.z - q.z);
    };
    for (let k = 0; k < linePairCapacity('tram', MAX_DISTRICTS); k++) {
      const pair = linePairAt('tram', k, MAX_DISTRICTS)!;
      expect(gap(pair.a, pair.b)).toBe(1);
    }
    // Rail takes the furthest earlier district there is, which is a short hop
    // only when nothing longer exists. Averaged, it is much longer than a tram.
    let railGap = 0;
    const rails = linePairCapacity('rail', MAX_DISTRICTS);
    for (let k = 0; k < rails; k++) {
      const pair = linePairAt('rail', k, MAX_DISTRICTS)!;
      railGap += gap(pair.a, pair.b);
    }
    expect(railGap / rails).toBeGreaterThan(3);
  });

  /** A one-district city has nowhere to run anything. */
  it('gives a village no line at all', () => {
    expect(linePairCapacity('tram', 1)).toBe(0);
    expect(linePairCapacity('rail', 1)).toBe(0);
    expect(networkReach(state({ districts: 1, tramLines: 5, railLines: 5 }))).toBe(0);
  });

  /** The oldest district is on the railway, which took a rule to get right. */
  it('puts district 0 on both networks', () => {
    expect(linePairAt('tram', 0, MAX_DISTRICTS)).toEqual({ a: 0, b: 1 });
    expect(linePairAt('rail', 0, MAX_DISTRICTS)).toEqual({ a: 0, b: 1 });
  });
});

describe('what a network serves', () => {
  it('is the lesser of what it reaches and what it can carry', () => {
    for (const districts of [4, 12, 25]) {
      for (const lines of [1, 3, 8, 30]) {
        for (const kind of ['tramLines', 'railLines'] as const) {
          const s = city(districts, 2, { [kind]: lines } as Partial<GameState>);
          expect(networkService(s)).toBe(Math.min(networkReach(s), networkCapacity(s)));
          expect(networkService(s)).toBeGreaterThanOrEqual(0);
          expect(networkService(s)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  /**
   * A tram carries less than a district and a train several, which is the whole
   * of the two rungs: trams run out of capacity long before they run out of
   * places to go, and trains do the opposite.
   */
  it('leaves a tram-only city short of capacity and a rail-only city short of reach', () => {
    const districts = 25;
    const trams = city(districts, 2, { tramLines: linePairCapacity('tram', districts) });
    expect(networkCapacity(trams)).toBeLessThan(networkReach(trams));
    const rails = city(districts, 2, { railLines: 8 });
    expect(networkReach(rails)).toBeLessThan(networkCapacity(rails));
  });

  it('never counts more districts than the city owns', () => {
    for (const districts of SIZES) {
      expect(networkedDistricts(99, 99, districts)).toBeLessThanOrEqual(districts);
    }
  });
});

describe('what a line may be laid on', () => {
  it('is bounded by the pairs of districts there are to join', () => {
    for (const districts of SIZES) {
      for (const line of TRANSIT_LINES) {
        const s = city(districts, 2, { cash: Number.MAX_SAFE_INTEGER });
        expect(lineAllowed(s, line)).toBe(linePairCapacity(line.key, districts));
      }
    }
  });

  it('is gated on rank, like the highway and the landmarks', () => {
    // A village has the land for a tram at two districts and the rank for
    // neither, which is the gate doing its job rather than the land.
    const village = city(4, 0, { cash: Number.MAX_SAFE_INTEGER, homes: 1 });
    expect(RANK_GATES.tram).toBeGreaterThan(0);
    expect(RANK_GATES.rail).toBeGreaterThan(RANK_GATES.tram);
    expect(canBuildLine(village, RAIL)).toBe(false);
  });

  it('is bought one at a time, compounding over its own count', () => {
    const game = new Game(city(12, 2, { cash: 1e12 }));
    const before = lineCost(game.state, RAIL);
    expect(game.buildLine(RAIL)).toBe(true);
    expect(game.state.railLines).toBe(1);
    expect(game.state.tramLines).toBe(0);
    expect(lineCost(game.state, RAIL)).toBeCloseTo(before * RAIL.growth, 6);
    expect(game.state.cash).toBeCloseTo(1e12 - before, 2);
  });

  it('refuses a line the city cannot afford or has no pair for', () => {
    expect(canBuildLine(city(12, 2, { cash: 0 }), TRAM)).toBe(false);
    const full = city(12, 2, {
      cash: Number.MAX_SAFE_INTEGER,
      tramLines: linePairCapacity('tram', 12),
    });
    expect(canBuildLine(full, TRAM)).toBe(false);
  });
});

describe('what a network buys', () => {
  /**
   * The design statement, and the one thing the feature must not breach.
   * TRANSIT_MAX_SHARE is TRANSIT_ROAD_SHARE x (1 + FREE_TRANSPORT_RIDERSHIP) —
   * exactly what a fully covered, fare-free city already reached — so a network
   * cannot take a single trip off the road that the fares could not.
   */
  it('never takes more off the road than free transport already could', () => {
    expect(TRANSIT_MAX_SHARE).toBeCloseTo(TRANSIT_ROAD_SHARE * (1 + FREE_TRANSPORT_RIDERSHIP), 10);
    for (const districts of [1, 4, 12, MAX_DISTRICTS]) {
      for (let level = 0; level < LEVELS; level++) {
        for (const freeTransport of [false, true]) {
          const s = city(districts, level, {
            freeTransport,
            tramLines: 99,
            railLines: 99,
          });
          expect(transitShare(s)).toBeLessThanOrEqual(TRANSIT_MAX_SHARE + 1e-12);
        }
      }
    }
  });

  it('leaves a city with no network exactly where it was', () => {
    for (const districts of [4, 12, 25]) {
      for (let level = 0; level < LEVELS; level++) {
        const s = city(districts, level);
        expect(networkService(s)).toBe(0);
        expect(transitShare(s)).toBeCloseTo(
          Math.min(TRANSIT_MAX_SHARE, TRANSIT_ROAD_SHARE * coverageOfTransit(s)),
          10,
        );
      }
    }
  });

  it('quietens the streets, and by less than the depots do', () => {
    const level = LEVELS - 1;
    const bare = city(12, level, { depots: 0, depotStaff: 0 });
    const railed = city(12, level, { depots: 0, depotStaff: 0, railLines: 12 });
    const bussed = city(12, level, { depots: 40, depotStaff: 1 });
    expect(congestion(railed)).toBeLessThan(congestion(bare));
    // A depot is the network the whole city can reach and a line joins two
    // districts, so a complete network does less of the daily work.
    expect(congestion(railed)).toBeGreaterThan(congestion(bussed));
  });

  /** Freight, on the tap `exportMarket` already is rather than a second one. */
  it('lifts the export tap and nothing else about it', () => {
    const bare = city(12, 1);
    const railed = city(12, 1, { railLines: 12 });
    expect(networkService(railed)).toBe(1);
    expect(exportMarket(railed) / exportMarket(bare)).toBeCloseTo(
      (1 + NETWORK_EXPORT_LIFT) / 1,
      6,
    );
  });

  /** Shoppers, on the one arrivals expression rather than a second one. */
  it('lands visitors as a fourth berth, with the happiness scaling kept', () => {
    const railed = city(12, 2, { railLines: 12 });
    const sources = visitorSources(railed);
    expect(sources.rail).toBeGreaterThan(0);
    expect(sources.quay + sources.air + sources.road + sources.rail).toBeCloseTo(
      sources.total,
      6,
    );
    const grim = city(12, 2, { railLines: 12, happiness: 0 });
    expect(visitorSources(grim).rail).toBe(0);
  });

  /**
   * The labour channel is 0 and is measured out rather than forgotten — see
   * NETWORK_WORKFORCE, which carries the played-run reading that decided it.
   */
  it('does not touch the labour pool the depots already reach', () => {
    expect(NETWORK_WORKFORCE).toBe(0);
    const bare = city(12, 2);
    const railed = city(12, 2, { railLines: 12 });
    expect(reachableWorkers(railed)).toBeCloseTo(reachableWorkers(bare), 6);
  });

  /**
   * The guard `TRANSIT_ROAD_SHARE` was set from: a city that has bought
   * everything the land allows reaches at least 0.95 happiness at every size.
   * A network may only ever raise that, because all it does to the bracket is
   * take congestion further toward zero.
   */
  it('does not lower the happiness ceiling anywhere', () => {
    // The same city `test/services.test.ts` builds, on purpose: this is a guard
    // that the network cannot move a promise that predates it, so it has to be
    // measured on the city that promise is about.
    const maxed = (districts: number): GameState => {
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
        if (service.key === 'university') { s.universities = n; s.universityStaff = 1; }
      }
      return s;
    };
    for (let districts = 1; districts <= MAX_DISTRICTS; districts++) {
      const bare = maxed(districts);
      const without = happinessTarget(bare);
      const with_ = happinessTarget({ ...bare, railLines: districts, tramLines: districts });
      expect(without).toBeGreaterThanOrEqual(0.95);
      expect(with_).toBeGreaterThanOrEqual(without - 1e-12);
    }
  });
});

const coverageOfTransit = (s: GameState): number => {
  const transit = SERVICES.find((service) => service.key === 'transit')!;
  return coverage(s, transit);
};

describe('the network across a save', () => {
  it('opens a save that predates it with no lines at all', () => {
    const old = written(city(12, 2));
    old['version'] = 14;
    delete old['tramLines'];
    delete old['railLines'];
    const back = migrate(old, 0)!;
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.tramLines).toBe(0);
    expect(back.railLines).toBe(0);
  });

  it('clamps a network the city no longer has the land to route', () => {
    const big = city(25, 2, { tramLines: 20, railLines: 20 });
    const raw = written(big);
    raw['districts'] = 4;
    const back = migrate(raw, 0)!;
    expect(back.tramLines).toBeLessThanOrEqual(linePairCapacity('tram', back.districts));
    expect(back.railLines).toBeLessThanOrEqual(linePairCapacity('rail', back.districts));
  });

  it('round-trips a network unchanged', () => {
    const s = city(12, 2, { tramLines: 3, railLines: 5 });
    const back = migrate(written(s), 0)!;
    expect(back.tramLines).toBe(3);
    expect(back.railLines).toBe(5);
    expect(networkService(back)).toBeCloseTo(networkService(s), 10);
  });
});

describe('the network under a catch-up step', () => {
  /**
   * The invariant, stated as what it actually is: the network banks nothing.
   *
   * Everything integrated in this game has an accumulator in the save —
   * `fireHazard` for ignition, `surveyClock` for the surveyor, `driftR` for
   * levelling — because a rate spent per tick is not the same distribution at
   * two step sizes. The network has none, and needs none, because it is two
   * integers and every expression that reads them is a pure function of them.
   * So a 60-second catch-up step and 600 tenth-second ticks cannot disagree
   * about the network itself, whatever they disagree about downstream.
   */
  it('is a pure function of two counts, with no clock in it', () => {
    const now = city(12, 2, { railLines: 6, tramLines: 4, elapsed: 0 });
    const later = { ...now, elapsed: 86_400 };
    expect(networkService(later)).toBe(networkService(now));
    expect(networkReach(later)).toBe(networkReach(now));
    expect(networkCapacity(later)).toBe(networkCapacity(now));
    expect(transitShare(later)).toBe(transitShare(now));
    expect(exportMarket(later)).toBe(exportMarket(now));
  });

  it('is never written by the simulation, at any step size', () => {
    for (const [dt, steps] of [[60, 1], [0.1, 600]] as const) {
      const game = new Game(city(12, 1, { cash: 0, railLines: 6, tramLines: 4 }));
      for (let i = 0; i < steps; i++) game.advance(dt);
      expect(game.state.railLines).toBe(6);
      expect(game.state.tramLines).toBe(4);
      expect(networkService(game.state)).toBe(networkService(city(12, 1, { railLines: 6, tramLines: 4 })));
    }
  });

  /**
   * And it does not make what it feeds any more step-size sensitive.
   *
   * The two step sizes already disagree on a city this size, and it is not this
   * file's doing: `congestion`'s own comment says so — traffic reads
   * `residents`, which is occupancy, so mood and occupancy are a coupled pair
   * and a coarse step lands somewhere slightly different. Measured here at the
   * top of the ladder with nothing to promote and nothing to buy, the gap in
   * happiness is 3.2e-2 with no network and 5.8e-3 with one: the network moves
   * congestion *toward* zero, so it damps the loop rather than tightening it.
   */
  it('does not widen the gap the coupled mood loop already opens', () => {
    const run = (lines: boolean, dt: number, steps: number): GameState => {
      const game = new Game(
        city(12, LEVELS - 1, {
          cash: 0,
          depots: 40,
          depotStaff: 1,
          railLines: lines ? 6 : 0,
          tramLines: lines ? 4 : 0,
        }),
      );
      for (let i = 0; i < steps; i++) game.advance(dt);
      return game.state;
    };
    const bare = Math.abs(run(false, 60, 1).happiness - run(false, 0.1, 600).happiness);
    const wired = Math.abs(run(true, 60, 1).happiness - run(true, 0.1, 600).happiness);
    expect(wired).toBeLessThanOrEqual(bare);
  });
});

describe('the network is view-free', () => {
  it('says where a line runs without the caller storing it', () => {
    const s = city(12, 2, { railLines: 3 });
    for (let k = 0; k < 3; k++) {
      const route = lineRoute(s, 'rail', k);
      expect(route).toEqual(linePairAt('rail', k, 12));
    }
    expect(lineRoute(s, 'rail', 99)).toBeNull();
  });

  it('carries no positions in the save at all', () => {
    const raw = written(city(12, 2, { railLines: 4, tramLines: 2 }));
    expect(typeof raw.railLines).toBe('number');
    expect(typeof raw.tramLines).toBe('number');
    expect(Object.keys(raw).some((key) => /route|track|alignment/i.test(key))).toBe(false);
  });
});

describe('NETWORK_ROAD_SHARE', () => {
  it('is under the share a complete bus network takes', () => {
    expect(NETWORK_ROAD_SHARE).toBeLessThan(TRANSIT_ROAD_SHARE);
  });
});
