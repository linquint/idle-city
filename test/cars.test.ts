import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Cars, MAX_CARS } from '../src/render/cars';
import { CELL, DISTRICT_SPAN } from '../src/sim/config';
import { CityLayout, worldX, worldZ } from '../src/sim/layout';
import { congestion } from '../src/sim/economy';
import { createState, type GameState } from '../src/sim/state';
import { housed, making, served, trading } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/**
 * The pool, reached through the class rather than exported.
 *
 * A route is view state and stays private — nothing outside the renderer has
 * any business knowing where a car is — but a test that could only see the
 * instance count could not tell a car driving down a street from one driving
 * through a block. This is the one place that line is crossed, and it is
 * crossed by the test rather than by the API.
 */
interface PooledCar {
  fixed: number;
  from: number;
  length: number;
  dir: number;
  alongX: boolean;
  speed: number;
  travelled: number;
  routed: boolean;
  bus: boolean;
  truck: boolean;
  tram: boolean;
  train: boolean;
  legsLeft: number;
  district: number;
  line: number;
  at: number;
  to: number;
}

function drive(patch: Partial<GameState>, frames = 200): { cars: PooledCar[]; state: GameState } {
  const root = new THREE.Scene();
  const cars = new Cars(root, new CityLayout(), true);
  const s = state({
    ...housed(96, 1),
    ...trading(60),
    ...making(20),
    ...served(),
    districts: 4,
    occupancyR: 1,
    occupancyC: 1,
    happiness: 1,
    ...patch,
  });
  cars.sync(s);
  for (let i = 0; i < frames; i++) cars.update(1 / 60, new THREE.Vector3(0, 0, 0), 1);
  const inner = cars as unknown as { pool: PooledCar[]; active: number };
  return { cars: inner.pool.slice(0, inner.active), state: s };
}

describe('the router', () => {
  it('keeps every vehicle on a street the district actually has', () => {
    const { cars } = drive({});
    expect(cars.length).toBeGreaterThan(0);
    for (const car of cars) {
      // The four that are not on a district street: two on the highway and two
      // on the network, which runs between district centres rather than along
      // the grid. See `routeHighway` and `routeLine`.
      if (car.truck || car.tram || car.train) continue;
      expect(car.routed).toBe(true);
      // The street it is on and both junctions it runs between are grid
      // coordinates the generator laid down, not arbitrary world positions.
      expect(Number.isInteger(car.line)).toBe(true);
      expect(Number.isInteger(car.at)).toBe(true);
      expect(Number.isInteger(car.to)).toBe(true);
      expect(car.at).not.toBe(car.to);
      // And the lane is one half-width off the centre line, on the correct side.
      const centre = car.alongX ? worldZ(car.line) : worldX(car.line);
      expect(Math.abs(car.fixed - centre)).toBeCloseTo(0.6, 6);
      // A leg is never longer than a district and never zero.
      expect(car.length).toBeGreaterThan(0);
      expect(car.length).toBeLessThanOrEqual(DISTRICT_SPAN * CELL + 1e-6);
    }
  });

  it('turns rather than driving one street end to end', () => {
    const root = new THREE.Scene();
    const cars = new Cars(root, new CityLayout(), true);
    const s = state({
      ...housed(96, 1),
      ...trading(60),
      ...served(),
      districts: 4,
      occupancyR: 1,
      happiness: 1,
      depots: 0,
      depotStaff: 0,
    });
    cars.sync(s);
    const inner = cars as unknown as { pool: PooledCar[]; active: number };
    const watched = inner.pool.slice(0, inner.active).filter((car) => !car.bus && !car.truck);
    expect(watched.length).toBeGreaterThan(0);
    const before = watched.map((car) => `${car.district}:${car.alongX}:${car.line}`);
    let turned = 0;
    for (let f = 0; f < 3_000; f++) {
      cars.update(1 / 60, new THREE.Vector3(0, 0, 0), 1);
      watched.forEach((car, i) => {
        const now = `${car.district}:${car.alongX}:${car.line}`;
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
      { highway: true, estates: 40, districts: 25 },
    ]) {
      const root = new THREE.Scene();
      const cars = new Cars(root, new CityLayout(), true);
      const s = state({ ...housed(96, 1), ...served(), districts: 4, occupancyR: 1, ...patch });
      cars.sync(s);
      for (let i = 0; i < 100; i++) cars.update(1 / 60, new THREE.Vector3(0, 0, 0), 1);
      const inner = cars as unknown as { pool: PooledCar[]; active: number };
      expect(inner.pool).toHaveLength(MAX_CARS);
      expect(inner.active).toBeLessThanOrEqual(MAX_CARS);
    }
  });
});

describe('congestion drives the speed', () => {
  /** Mean speed of the cars — buses and lorries run to their own numbers. */
  const meanCarSpeed = (cars: PooledCar[]): number => {
    const plain = cars.filter((car) => !car.bus && !car.truck);
    return plain.reduce((sum, car) => sum + car.speed, 0) / Math.max(1, plain.length);
  };

  it('runs a jammed city slower than a clear one', () => {
    // A city big enough to jam, on land that can hold it: 1,200 towers over 25
    // districts is a full map rather than an impossible one, which matters
    // because congestion clamps at 1 and a clamped reading compares to nothing.
    const many = { homes: 300, homeLevels: [0, 0, 300, 0, 0], mergedR: 300, districts: 25 };
    const jammed = drive({ ...many, depots: 0, depotStaff: 0 });
    // Enough depots to cover 600 housing plots at 24 a depot, and few enough
    // that their buses do not fill the pool and leave no cars to measure.
    const clear = drive({
      ...many,
      depots: 26,
      depotStaff: 1,
      cityHall: true,
      freeTransport: true,
    });
    expect(congestion(jammed.state)).toBeGreaterThan(congestion(clear.state) + 0.3);
    // Measured on this fixture: 4.26 against 7.22, which is the interpolation
    // doing what it says. The bound is loose because the speeds carry
    // SPEED_JITTER and the fleet is re-rolled per leg — what is being asserted
    // is the direction and the rough size, not a particular draw.
    expect(meanCarSpeed(jammed.cars)).toBeLessThan(meanCarSpeed(clear.cars) * 0.75);
  });

  it('slows a bus less than a car, which is the argument for the depot', () => {
    // Depots enough for buses to exist, and a city jammed enough for the
    // difference to show: the buses are the things still moving.
    const { cars } = drive({
      homes: 1200,
      homeLevels: [0, 0, 1200, 0, 0],
      mergedR: 1200,
      depots: 2,
      depotStaff: 1,
    });
    const buses = cars.filter((car) => car.bus);
    const plain = cars.filter((car) => !car.bus && !car.truck);
    expect(buses.length).toBeGreaterThan(0);
    expect(plain.length).toBeGreaterThan(0);
    const busSpeed = buses.reduce((sum, car) => sum + car.speed, 0) / buses.length;
    expect(busSpeed).toBeGreaterThan(meanCarSpeed(plain));
  });

  it('leaves the lorries alone, because the highway is not a city street', () => {
    const jammed = drive({
      homes: 1200,
      homeLevels: [0, 0, 1200, 0, 0],
      mergedR: 1200,
      highway: true,
      estates: 20,
      districts: 25,
    });
    const clear = drive({
      homes: 1200,
      homeLevels: [0, 0, 1200, 0, 0],
      mergedR: 1200,
      highway: true,
      estates: 20,
      districts: 25,
      // Enough depots to clear the roads and few enough to leave room in the
      // pool for the lorries, which take the back of it.
      depots: 20,
      depotStaff: 1,
      cityHall: true,
      freeTransport: true,
    });
    const speedOf = (cars: PooledCar[]): number => {
      const trucks = cars.filter((car) => car.truck);
      expect(trucks.length).toBeGreaterThan(0);
      return trucks.reduce((sum, car) => sum + car.speed, 0) / trucks.length;
    };
    expect(speedOf(jammed.cars)).toBeCloseTo(speedOf(clear.cars), 6);
  });
});

describe('the network fleet', () => {
  /**
   * A tram and a train are a readout of two counts, exactly as a bus is a
   * readout of `depots`. Nothing here reaches `GameState` and nothing here is
   * stored: where a line runs comes back out of `linePairAt`, which is the same
   * pure function the simulation costed the line against.
   */
  const wired = (patch: Partial<GameState>) =>
    drive({ districts: 12, depots: 0, depotStaff: 0, ...patch });

  it('runs nothing at all with no line laid', () => {
    const { cars } = wired({});
    expect(cars.some((car) => car.tram || car.train)).toBe(false);
  });

  it('puts vehicles on the network the city has bought', () => {
    const { cars } = wired({ tramLines: 4, railLines: 4 });
    expect(cars.filter((car) => car.tram).length).toBeGreaterThan(0);
    expect(cars.filter((car) => car.train).length).toBeGreaterThan(0);
    // And they are never the same vehicle, whatever else they share.
    for (const car of cars) expect(car.tram && car.train).toBe(false);
  });

  it('runs both between the centres of the districts their line joins', () => {
    const { cars } = wired({ tramLines: 6, railLines: 6 });
    const layout = new CityLayout();
    layout.ensure(state({ districts: 12 }));
    const centres = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const d = layout.districts[i]!;
      centres.add(`x${d.centreX.toFixed(4)}`);
      centres.add(`z${d.centreZ.toFixed(4)}`);
    }
    for (const car of cars) {
      if (!car.tram && !car.train) continue;
      expect(car.length).toBeGreaterThan(0);
      // Each leg of the L starts and ends on a district centre coordinate. A
      // tram is offset half a lane off it because it is on a street; a train is
      // on its own deck and runs down the middle.
      const end = car.from + car.dir * car.length;
      expect(centres.has(`${car.alongX ? 'x' : 'z'}${car.from.toFixed(4)}`)).toBe(true);
      expect(centres.has(`${car.alongX ? 'x' : 'z'}${end.toFixed(4)}`)).toBe(true);
    }
  });

  it('runs a train faster than a tram, and neither backwards', () => {
    const { cars } = wired({ tramLines: 6, railLines: 6 });
    const trams = cars.filter((car) => car.tram);
    const trains = cars.filter((car) => car.train);
    const mean = (xs: PooledCar[]) => xs.reduce((a, b) => a + b.speed, 0) / Math.max(1, xs.length);
    expect(mean(trains)).toBeGreaterThan(mean(trams));
    for (const car of [...trams, ...trains]) expect(Math.abs(car.dir)).toBe(1);
  });

  it('lays a deck under every leg of every rail line and none under a tram', () => {
    const root = new THREE.Scene();
    const cars = new Cars(root, new CityLayout(), true);
    cars.sync(state({ ...housed(96, 1), ...served(), districts: 12, railLines: 5 }));
    cars.update(1 / 60, new THREE.Vector3(0, 0, 0), 1);
    const deck = root.getObjectByName('traffic:viaduct') as THREE.InstancedMesh | undefined;
    expect(deck).toBeDefined();
    const withRail = deck!.count;
    expect(withRail).toBeGreaterThan(0);
    expect(withRail).toBeLessThanOrEqual(2 * 5);

    const trams = new Cars(new THREE.Scene(), new CityLayout(), true);
    const tramRoot = (trams as unknown as { decks: { mesh: THREE.InstancedMesh } }).decks;
    trams.sync(state({ ...housed(96, 1), ...served(), districts: 12, tramLines: 8 }));
    trams.update(1 / 60, new THREE.Vector3(0, 0, 0), 1);
    expect(tramRoot.mesh.count).toBe(0);
  });

  it('keeps the network out of the save, like every other vehicle', () => {
    const { state: s } = wired({ tramLines: 4, railLines: 4 });
    // The fleet is a function of the counts and nothing writes back to them.
    expect(s.tramLines).toBe(4);
    expect(s.railLines).toBe(4);
  });
});
