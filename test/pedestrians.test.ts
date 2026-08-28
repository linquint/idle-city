import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  MAX_PEDESTRIANS,
  MIN_PEDESTRIANS,
  Pedestrians,
  pedestrianFleet,
  walkingTrips,
} from '../src/render/pedestrians';
import { FOOT_OFF, FOOT_W, ROAD_W } from '../src/render/ground';
import { CELL, DISTRICT_SPAN } from '../src/sim/config';
import { roadTrips, trips } from '../src/sim/economy';
import { CityLayout, worldX, worldZ } from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';
import { housed, making, served, trading } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/**
 * The pool, reached through the class rather than exported.
 *
 * Same line, crossed the same way `test/cars.test.ts` crosses it: a walk is
 * view state and stays private, but a test that could only see the instance
 * count could not tell a walker on the pavement from one crossing a block
 * diagonally. It is the test that reaches in, not the API that opens up.
 */
interface PooledWalker {
  fixed: number;
  from: number;
  length: number;
  dir: number;
  alongX: boolean;
  speed: number;
  travelled: number;
  routed: boolean;
  legsLeft: number;
  district: number;
  line: number;
  at: number;
  to: number;
}

function walk(
  patch: Partial<GameState>,
  frames = 200,
): { walkers: PooledWalker[]; layer: Pedestrians; state: GameState } {
  const root = new THREE.Scene();
  const layer = new Pedestrians(root, new CityLayout(), true);
  const s = state({
    ...housed(96, 1),
    ...trading(60),
    ...making(20),
    ...served(),
    districts: 4,
    occupancyR: 1,
    occupancyC: 1,
    happiness: 1,
    // The fleet reads the trips the road does not carry, so a test about where
    // walkers stand has to buy the buses that put them there.
    depots: 12,
    depotStaff: 1,
    ...patch,
  });
  layer.sync(s);
  for (let i = 0; i < frames; i++) layer.update(1 / 60, new THREE.Vector3(0, 0, 0));
  const inner = layer as unknown as { pool: PooledWalker[]; active: number };
  return { walkers: inner.pool.slice(0, inner.active), layer, state: s };
}

describe('the pavement', () => {
  it('keeps every walker on a footway of a street the district actually has', () => {
    const { walkers } = walk({});
    expect(walkers.length).toBeGreaterThan(0);
    for (const walker of walkers) {
      expect(walker.routed).toBe(true);
      // The street it is on and both junctions it walks between are grid
      // coordinates the generator laid down, not arbitrary world positions.
      expect(Number.isInteger(walker.line)).toBe(true);
      expect(Number.isInteger(walker.at)).toBe(true);
      expect(Number.isInteger(walker.to)).toBe(true);
      expect(walker.at).not.toBe(walker.to);
      // And it stands on the footway: FOOT_OFF off the centre line, give or
      // take the drift, which can never take it past the kerb at either end.
      const centre = walker.alongX ? worldZ(walker.line) : worldX(walker.line);
      const offset = Math.abs(walker.fixed - centre);
      expect(offset).toBeGreaterThanOrEqual(FOOT_OFF - FOOT_W / 2);
      expect(offset).toBeLessThanOrEqual(FOOT_OFF + FOOT_W / 2);
      // A leg is never longer than a district and never zero.
      expect(walker.length).toBeGreaterThan(0);
      expect(walker.length).toBeLessThanOrEqual(DISTRICT_SPAN * CELL + 1e-6);
    }
  });

  it('never puts a walker on the carriageway', () => {
    const { walkers } = walk({});
    for (const walker of walkers) {
      const centre = walker.alongX ? worldZ(walker.line) : worldX(walker.line);
      // Half the road, plus half a body: the near edge of the footway is where
      // the kerb is, and a walker's own width must clear it too.
      expect(Math.abs(walker.fixed - centre)).toBeGreaterThan(ROAD_W / 2);
    }
  });

  it('turns corners rather than walking one street end to end', () => {
    const root = new THREE.Scene();
    const layer = new Pedestrians(root, new CityLayout(), true);
    const s = state({
      ...housed(96, 1),
      ...trading(60),
      ...served(),
      districts: 4,
      occupancyR: 1,
      happiness: 1,
      depots: 12,
      depotStaff: 1,
    });
    layer.sync(s);
    const inner = layer as unknown as { pool: PooledWalker[]; active: number };
    const watched = inner.pool.slice(0, inner.active);
    expect(watched.length).toBeGreaterThan(0);
    const before = watched.map((w) => `${w.district}:${w.alongX}:${w.line}`);
    let turned = 0;
    for (let f = 0; f < 6_000; f++) {
      layer.update(1 / 60, new THREE.Vector3(0, 0, 0));
      watched.forEach((w, i) => {
        const now = `${w.district}:${w.alongX}:${w.line}`;
        if (now !== before[i]) {
          turned++;
          before[i] = now;
        }
      });
    }
    expect(turned).toBeGreaterThan(watched.length);
  });

  it('never grows the pool, whatever the city does', () => {
    for (const patch of [
      {},
      { depots: 400, depotStaff: 1 },
      { districts: 25, homes: 600, homeLevels: [0, 0, 600, 0, 0], mergedR: 600 },
    ]) {
      const root = new THREE.Scene();
      const layer = new Pedestrians(root, new CityLayout(), true);
      const s = state({ ...housed(96, 1), ...served(), districts: 4, occupancyR: 1, ...patch });
      layer.sync(s);
      for (let i = 0; i < 100; i++) layer.update(1 / 60, new THREE.Vector3(0, 0, 0));
      const inner = layer as unknown as { pool: PooledWalker[]; active: number };
      expect(inner.pool).toHaveLength(MAX_PEDESTRIANS);
      expect(inner.active).toBeLessThanOrEqual(MAX_PEDESTRIANS);
    }
  });
});

describe('the fleet reads the trips the road does not carry', () => {
  const city = (patch: Partial<GameState>): GameState =>
    state({
      ...housed(240, 2),
      ...trading(120),
      ...served(),
      districts: 12,
      occupancyR: 1,
      happiness: 1,
      ...patch,
    });

  it('is exactly trips minus road trips', () => {
    const s = city({ depots: 20, depotStaff: 1 });
    expect(walkingTrips(s)).toBeCloseTo(trips(s) - roadTrips(s), 9);
  });

  it('draws nobody but the floor when every trip is a car trip', () => {
    const s = city({ depots: 0, depotStaff: 0 });
    expect(walkingTrips(s)).toBe(0);
    expect(pedestrianFleet(s)).toBe(MIN_PEDESTRIANS);
  });

  it('fills the pavements as the buses arrive', () => {
    const none = pedestrianFleet(city({ depots: 0, depotStaff: 0 }));
    const some = pedestrianFleet(city({ depots: 6, depotStaff: 1 }));
    const many = pedestrianFleet(city({ depots: 20, depotStaff: 1 }));
    const free = pedestrianFleet(
      city({ depots: 20, depotStaff: 1, cityHall: true, freeTransport: true }),
    );
    expect(some).toBeGreaterThan(none);
    expect(many).toBeGreaterThan(some);
    // Free transport lifts both the reach and the ridership, so it moves the
    // pavements as well as the roads — see FREE_TRANSPORT_RIDERSHIP.
    expect(free).toBeGreaterThanOrEqual(many);
  });

  it('draws nobody at all before anything is built', () => {
    expect(pedestrianFleet(state({ districts: 1 }))).toBe(0);
  });

  it('never exceeds the ceiling, however large the city gets', () => {
    const s = city({
      districts: 49,
      homes: 1_176,
      homeLevels: [0, 0, 0, 0, 1_176],
      mergedR: 1_176,
      depots: 60,
      depotStaff: 1,
      cityHall: true,
      freeTransport: true,
    });
    expect(pedestrianFleet(s)).toBe(MAX_PEDESTRIANS);
  });
});

describe('nothing about a walker reaches the simulation', () => {
  it('leaves the state it is handed untouched', () => {
    const s = state({ ...housed(96, 1), ...served(), districts: 4, depots: 8, depotStaff: 1 });
    const before = JSON.stringify(s);
    const root = new THREE.Scene();
    const layer = new Pedestrians(root, new CityLayout(), true);
    layer.sync(s);
    for (let i = 0; i < 300; i++) layer.update(1 / 60, new THREE.Vector3(0, 0, 0));
    expect(JSON.stringify(s)).toBe(before);
  });

  it('draws the same fleet from the same counts, whatever it did in between', () => {
    const s = state({ ...housed(96, 1), ...served(), districts: 4, depots: 8, depotStaff: 1 });
    const fleetOf = (frames: number): number => {
      const layer = new Pedestrians(new THREE.Scene(), new CityLayout(), true);
      layer.sync(s);
      for (let i = 0; i < frames; i++) layer.update(1 / 60, new THREE.Vector3(0, 0, 0));
      const inner = layer as unknown as { active: number };
      return inner.active;
    };
    expect(fleetOf(0)).toBe(fleetOf(1_000));
  });
});
