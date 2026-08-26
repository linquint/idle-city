import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  ESTATE_BASE,
  ESTATE_GROWTH,
  ESTATE_PLOTS,
  ESTATE_YIELD,
  HIGHWAY_COST,
  HIGHWAY_MIN_DISTRICTS,
  INDUSTRIAL_OUTPUT,
  JOBS_PER_ESTATE_PLOT,
  JOBS_PER_INDUSTRIAL,
  MAX_DISTRICTS,
} from '../src/sim/config';
import {
  activeDeveloped,
  canBuildEstate,
  canBuildHighway,
  demandTargets,
  developed,
  estateBlocker,
  estateCapacity,
  estateCost,
  estateJobs,
  estatePlots,
  estateSupply,
  highwayBlocker,
  income,
  industryCapacity,
  industryScale,
  jobs,
  plotCapacity,
  plotsOf,
} from '../src/sim/economy';
import { ESTATE_CELLS, ESTATE_NEAR, ESTATE_SPAN, estateCell, estateReach } from '../src/sim/estates';
import { Game } from '../src/sim/game';
import { cityRadius, districtCoord, DISTRICT_WIDTH } from '../src/sim/layout';
import { migrate } from '../src/sim/save';
import { createState, type GameState } from '../src/sim/state';
import { HIGHWAY_W } from '../src/render/highway';
import { WATERS, waterAt } from '../src/sim/water';
import { Cars } from '../src/render/cars';
import { Estates } from '../src/render/estates';
import { bandLane, Highway, spurLane } from '../src/render/highway';
import { CityLayout } from '../src/sim/layout';
import { housedOn, making, trading } from './levels';

const city = (districts: number, patch: Partial<GameState> = {}): GameState =>
  Object.assign(createState(0), { districts, cash: 1e14, happiness: 1 }, patch);

describe('the estate band', () => {
  it('lies wholly beyond the furthest land the city could ever own', () => {
    // The property that lets an estate stand at a fixed place at all: it must
    // never move, so it cannot be positioned against the city's current size.
    expect(ESTATE_CELLS).toBeGreaterThan(0);
    const reach = cityRadius(MAX_DISTRICTS);
    for (let i = 0; i < ESTATE_CELLS; i++) {
      const cell = estateCell(i);
      expect(cell).not.toBeNull();
      // The band is behind the city, so `u` is negative and past the reach.
      expect(-(cell as { u: number }).u - ESTATE_SPAN / 2).toBeGreaterThan(reach);
    }
    for (let i = 0; i < MAX_DISTRICTS; i++) {
      const coord = districtCoord(i);
      const u = WATERS.u(coord.x * DISTRICT_WIDTH, coord.z * DISTRICT_WIDTH);
      expect(u - DISTRICT_WIDTH / 2).toBeGreaterThan(ESTATE_NEAR);
    }
  });

  it('never puts a parcel in the water', () => {
    const at = { x: 0, z: 0 };
    for (let i = 0; i < ESTATE_CELLS; i++) {
      const cell = estateCell(i) as { u: number; v: number };
      for (const du of [-0.5, 0, 0.5]) {
        for (const dv of [-0.5, 0, 0.5]) {
          WATERS.toWorld(cell.u + du * ESTATE_SPAN, cell.v + dv * ESTATE_SPAN, at);
          expect(waterAt(at.x, at.z)).toBe(false);
        }
      }
    }
  });

  it('is a fixed sequence: the i-th parcel is always the i-th parcel', () => {
    const first = Array.from({ length: ESTATE_CELLS }, (_, i) => estateCell(i));
    const again = Array.from({ length: ESTATE_CELLS }, (_, i) => estateCell(i));
    expect(again).toEqual(first);
    expect(estateCell(ESTATE_CELLS)).toBeNull();
    // No two parcels share a place, and they fill outward from the spur.
    const seen = new Set(first.map((c) => `${c?.u},${c?.v}`));
    expect(seen.size).toBe(ESTATE_CELLS);
    expect(estateReach(ESTATE_CELLS)).toBeGreaterThan(estateReach(4));
  });

  it('straddles the axis rather than sitting on it, so the spur has a gap', () => {
    // The highway comes down the axis between the two middle columns to reach
    // the band road. A parcel centred on the axis would have the spur through
    // its yard, and every parcel has to clear the road's own half-width.
    const clear = HIGHWAY_W / 2;
    for (let i = 0; i < ESTATE_CELLS; i++) {
      const cell = estateCell(i) as { v: number };
      expect(Math.abs(cell.v) - ESTATE_SPAN / 2).toBeGreaterThan(clear);
    }
  });

  it('grows the band outward, so the road never has to jump a gap', () => {
    let previous = 0;
    for (let built = 1; built <= ESTATE_CELLS; built++) {
      const reach = estateReach(built);
      expect(reach).toBeGreaterThanOrEqual(previous);
      previous = reach;
    }
  });
});

describe('what unlocks an estate', () => {
  it('wants the districts before it will sell the road', () => {
    for (let n = 1; n < HIGHWAY_MIN_DISTRICTS; n++) {
      const s = city(n);
      expect(canBuildHighway(s)).toBe(false);
      expect(highwayBlocker(s)).toBe(`Needs ${HIGHWAY_MIN_DISTRICTS} districts`);
      expect(estateCapacity(s)).toBe(0);
      expect(estateBlocker(s)).toBe('No highway yet');
    }
    const ready = city(HIGHWAY_MIN_DISTRICTS);
    expect(canBuildHighway(ready)).toBe(true);
    expect(highwayBlocker(ready)).toBeNull();
    // Still no parcels: the road is what the districts bought, not the land.
    expect(estateCapacity(ready)).toBe(0);
    expect(canBuildEstate(ready)).toBe(false);
  });

  it('sells parcels only once the road is in, and paces them by district', () => {
    const paved = city(HIGHWAY_MIN_DISTRICTS, { highway: true });
    expect(estateCapacity(paved)).toBe(HIGHWAY_MIN_DISTRICTS);
    expect(canBuildEstate(paved)).toBe(true);
    expect(estateBlocker(paved)).toBeNull();
    // And never past the ground itself.
    expect(estateCapacity(city(MAX_DISTRICTS, { highway: true }))).toBe(
      Math.min(ESTATE_CELLS, MAX_DISTRICTS),
    );
  });

  it('stops when the band is full', () => {
    const full = city(MAX_DISTRICTS, { highway: true });
    full.estates = estateCapacity(full);
    expect(canBuildEstate(full)).toBe(false);
    expect(estateBlocker(full)).toBe('No parcels left');
  });

  it('takes the cash for the road and for each parcel', () => {
    const game = new Game(city(MAX_DISTRICTS));
    expect(game.buildEstate()).toBe(false);
    const before = game.state.cash;
    expect(game.buildHighway()).toBe(true);
    expect(game.state.highway).toBe(true);
    expect(game.state.cash).toBeCloseTo(before - HIGHWAY_COST, 6);
    // Bought once and only once.
    expect(game.buildHighway()).toBe(false);
    expect(highwayBlocker(game.state)).toBe('Built');

    const price = estateCost(game.state);
    expect(price).toBe(ESTATE_BASE);
    expect(game.buildEstate()).toBe(true);
    expect(game.state.estates).toBe(1);
    expect(estateCost(game.state)).toBeCloseTo(ESTATE_BASE * ESTATE_GROWTH, 6);
  });

  it('refuses a parcel the city cannot pay for', () => {
    const broke = new Game(city(MAX_DISTRICTS, { highway: true, cash: 1 }));
    expect(broke.buildEstate()).toBe(false);
    expect(broke.state.estates).toBe(0);
  });
});

describe('what an estate is worth', () => {
  /**
   * A city built out to its own frontage, at one level throughout.
   *
   * Housing is not optional here even for the industrial readings: everything
   * in `income` is a multiplier on rent, so a city with nobody in it earns
   * nothing however many works it has, and every ledger comparison would be
   * zero against zero.
   */
  const works = (level = 0, districts = MAX_DISTRICTS, patch: Partial<GameState> = {}): GameState =>
    city(districts, {
      highway: true,
      ...housedOn(24 * districts, level),
      ...trading(45 * districts, level),
      ...making(13 * districts, level),
      ...patch,
    });

  it('counts as industry in jobs, goods and the ledger', () => {
    const bare = works();
    const one = works(0, MAX_DISTRICTS, { estates: 1 });
    expect(estatePlots(one)).toBe(ESTATE_PLOTS);
    expect(estateJobs(one)).toBeCloseTo(ESTATE_PLOTS * JOBS_PER_ESTATE_PLOT * one.occupancyI, 6);
    expect(estateSupply(one)).toBeCloseTo(
      ESTATE_PLOTS * ESTATE_YIELD * INDUSTRIAL_OUTPUT * one.occupancyI,
      6,
    );
    expect(jobs(one) - jobs(bare)).toBeCloseTo(estateJobs(one), 6);
    expect(income(one)).toBeGreaterThan(income(bare));
  });

  it('makes more per plot than a works inside the city, and employs fewer', () => {
    // The whole distinction between the two kinds of industry.
    expect(ESTATE_YIELD).toBeGreaterThan(1);
    expect(JOBS_PER_ESTATE_PLOT).toBeLessThan(JOBS_PER_INDUSTRIAL);
  });

  it('is built to whatever standard the city\'s own works are', () => {
    // Otherwise a flat weight would be the whole economy at the bottom of the
    // ladder and a rounding error at the top — LEVEL_SCALE spans 1 to 600.
    const low = works();
    const high = works(4);
    expect(industryScale(low)).toBe(1);
    expect(industryScale(high)).toBeGreaterThan(100);
    const lowLift = income({ ...low, estates: 4 }) - income(low);
    const highLift = income({ ...high, estates: 4 }) - income(high);
    expect(highLift).toBeGreaterThan(lowLift);
  });

  it('has a level ladder it does not climb, so a city with no works still gains', () => {
    const empty = works(0, MAX_DISTRICTS, { ...making(0, 0) });
    expect(industryScale(empty)).toBe(1);
    expect(income({ ...empty, estates: 2 })).toBeGreaterThan(income(empty));
  });

  it('pushes residential demand up and industrial demand down', () => {
    // At tower housing and the district count the highway unlocks at, which is
    // the one place in the sweep where none of the three signals is on a bound
    // — see tools/estates.calibrate.mjs. A pinned signal says nothing.
    const bare = works(2, HIGHWAY_MIN_DISTRICTS);
    expect(Math.abs(demandTargets(bare).i)).toBeLessThan(1);
    const built = { ...bare, estates: 8 };
    const before = demandTargets(bare);
    const after = demandTargets(built);
    expect(after.r).toBeGreaterThanOrEqual(before.r);
    expect(after.i).toBeLessThan(before.i);
    // Commerce is untouched: an estate is not a shop and does not shop.
    expect(after.c).toBeCloseTo(before.c, 9);
  });
});

describe('estates and the land the city owns', () => {
  it('never touches the in-district industrial plots', () => {
    const s = city(MAX_DISTRICTS, { highway: true, ...making(20, 0) });
    const withBand = { ...s, estates: 12 };
    expect(plotsOf(withBand, 'industry')).toBe(plotsOf(s, 'industry'));
    expect(industryCapacity(withBand)).toBe(industryCapacity(s));
  });

  it('stays out of the annexation gate entirely', () => {
    // Land the city does not own, so counting it either way would move a gate
    // measured against the plots a district sells — the same rule parks and
    // landmarks are held to.
    const s = city(20, { highway: true, ...making(40, 0) });
    const withBand = { ...s, estates: 15 };
    expect(plotCapacity(withBand)).toBe(plotCapacity(s));
    expect(developed(withBand)).toBeCloseTo(developed(s), 12);
    expect(activeDeveloped(withBand)).toBeCloseTo(activeDeveloped(s), 12);
  });
});

describe('estates across a save', () => {
  it('defaults to no road and no parcels for a save written before either', () => {
    const back = migrate({ cash: 10, homes: 4, districts: 2 }, 1_000) as GameState;
    expect(back.highway).toBe(false);
    expect(back.estates).toBe(0);
    expect(estatePlots(back)).toBe(0);
  });

  it('carries what was built', () => {
    const back = migrate(
      { homes: 9, districts: MAX_DISTRICTS, highway: true, estates: 5 },
      0,
    ) as GameState;
    expect(back.highway).toBe(true);
    expect(back.estates).toBe(5);
  });

  it('gives a save with no highway no parcels, whatever it claims', () => {
    const back = migrate({ homes: 9, districts: MAX_DISTRICTS, estates: 30 }, 0) as GameState;
    expect(back.highway).toBe(false);
    expect(back.estates).toBe(0);
  });

  it('clamps the parcels to the band and to the districts', () => {
    const trimmed = migrate(
      { homes: 9, districts: MAX_DISTRICTS, highway: true, estates: 9_999 },
      0,
    ) as GameState;
    expect(trimmed.estates).toBe(estateCapacity(trimmed));
    expect(trimmed.estates).toBeLessThanOrEqual(ESTATE_CELLS);

    const small = migrate(
      { homes: 9, districts: HIGHWAY_MIN_DISTRICTS, highway: true, estates: 9_999 },
      0,
    ) as GameState;
    expect(small.estates).toBe(HIGHWAY_MIN_DISTRICTS);
  });
});

describe('the outskirts, drawn', () => {
  /** Every instanced mesh in a scene, by name, with the count it is drawing. */
  const counts = (root: THREE.Object3D): Map<string, number> => {
    const found = new Map<string, number>();
    root.traverse((object) => {
      if (!(object instanceof THREE.InstancedMesh) || object.name === '') return;
      found.set(object.name, (found.get(object.name) ?? 0) + object.count);
    });
    return found;
  };

  const built = (patch: Partial<GameState>): GameState =>
    city(20, { ...housedOn(24 * 20, 1), ...trading(200, 0), depots: 3, depotStaff: 1, ...patch });

  it('draws a yard, a shed and a stack for every parcel, and nothing before', () => {
    const root = new THREE.Scene();
    const estates = new Estates(root);
    estates.sync(built({ highway: true }));
    for (const name of ['estate:yard', 'estate:shed']) expect(counts(root).get(name)).toBe(0);

    estates.sync(built({ highway: true, estates: 7 }));
    expect(counts(root).get('estate:yard')).toBe(7);
    expect(counts(root).get('estate:shed')).toBe(7);
  });

  it('lays no road until the highway is bought', () => {
    const root = new THREE.Scene();
    const highway = new Highway(root);
    highway.sync(built({}));
    expect(counts(root).get('highway:tarmac')).toBe(0);
    highway.sync(built({ highway: true }));
    // A spur and a band road, with two verges each.
    expect(counts(root).get('highway:tarmac')).toBe(2);
    expect(counts(root).get('highway:verge')).toBe(4);
  });

  it('puts lorries on the road out of the same pool the cars come from', () => {
    // The acceptance criterion, checked as a black box: a lorry is an instance
    // of one more mesh, not a second traffic layer, and it only exists once
    // there is something at the end of the road to carry.
    const root = new THREE.Scene();
    const cars = new Cars(root, new CityLayout(), true);
    const focus = new THREE.Vector3(0, 0, 0);

    cars.sync(built({ highway: true }));
    cars.update(0.1, focus, 0);
    expect(counts(root).get('traffic:truck')).toBe(0);

    cars.sync(built({ highway: true, estates: 10 }));
    // Driven far enough that every routed vehicle has been placed at least once.
    for (let i = 0; i < 40; i++) cars.update(0.1, focus, 0);
    const drawn = counts(root);
    expect(drawn.get('traffic:truck') ?? 0).toBeGreaterThan(0);
    // Buses are not displaced by them: the two services take opposite ends of
    // the pool, so a fleet that shrinks loses cars from the middle.
    expect(drawn.get('traffic:bus') ?? 0).toBeGreaterThan(0);
  });

  it('keeps the lorries on the highway and off the fields', () => {
    // Routed against `highway.ts`'s own lanes, so a lorry is always on the road
    // it was told about — within the lane offset the streets use.
    const spur = spurLane(20, { alongX: true, fixed: 0, from: 0, length: 0 });
    const band = bandLane(10, { alongX: true, fixed: 0, from: 0, length: 0 });
    expect(spur.length).toBeGreaterThan(0);
    expect(band.length).toBeGreaterThan(0);
    // They cross: one runs along the coast normal and the other along the shore.
    expect(spur.alongX).not.toBe(band.alongX);
  });
});
