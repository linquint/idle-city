import * as THREE from 'three';
import { mixSeed, rng } from '../core/rng.ts';
import { SEED } from '../sim/config.ts';
import type { GameState } from '../sim/state.ts';
import { WATERS, type Shore } from '../sim/water.ts';
import { GrowableInstancedMesh } from './growable.ts';
import { PALETTE } from './palette.ts';

/**
 * Shipping, and nothing else.
 *
 * The same shape as `cars.ts` down to the pool, the focus cull and the "not a
 * word of this reaches GameState" rule, because it is the same kind of thing: a
 * ship is a readout of `cruiseTerminals` and `cargoTerminals` in exactly the
 * way a car is a readout of the resident count. A ship that needed saving would
 * be a bug.
 *
 * What is different from a car is the route. A car drives a street that runs
 * dead straight between two junctions; a ship follows a coastline that bends.
 * So a ship holds its distance *offshore* rather than a fixed coordinate, and
 * where it is at any moment is `shore(v) + offset` — which means it can never
 * run aground however the seed drew the coast, and it takes the coast's own
 * curve for free. Its heading comes from a second sample of the same function,
 * which is two sines and no state.
 */

/**
 * The fleet ceiling.
 *
 * Far under MAX_CARS, and not for cost: there are at most a handful of berths
 * in a whole city, and a coast with forty ships on it reads as a blockade.
 */
const MAX_SHIPS = 24;

/** Ships at sea per terminal. Cargo runs busier than cruise, as it does. */
const SHIPS_PER_CRUISE = 2;
const SHIPS_PER_CARGO = 3;

/** How far offshore the lanes run. The near one passes the quays. */
const LANE_NEAR = 34;
const LANE_FAR = 150;

/** How far along the coast a run goes before the ship is given a new one. */
const RUN_LENGTH = 620;

const SPEED_MIN = 3.2;
const SPEED_MAX = 5.4;

/** Hulls, and what stands on them. Cruise runs long and pale, cargo short and stacked. */
const CRUISE_LENGTH = 17;
const CRUISE_BEAM = 3.4;
const CARGO_LENGTH = 13;
const CARGO_BEAM = 4.2;
const HULL_H = 1.7;
/** Waterline. The hull sits half in, which is what makes it float rather than hover. */
const HULL_Y = -0.55;

const HOUSE_H = 2.6;
const STACK_H = 2.2;

/**
 * How far from what the player is looking at a ship is still worth drawing.
 *
 * Wider than the cars' radius because the sea is empty: a car that vanishes has
 * a street left behind it and a ship that vanishes leaves nothing at all.
 */
const VIEW_RADIUS = 320;

/** How far apart two samples of the shore are taken to get a heading. */
const HEADING_STEP = 12;

/** One vessel's whole state. Pooled and mutated; never allocated in a frame. */
interface Ship {
  /** Along the shore, in the coast frame. The only coordinate that advances. */
  v: number;
  /** Where the run started, so it can be retired after RUN_LENGTH. */
  from: number;
  /** How far offshore this one holds. */
  offset: number;
  /** +1 or -1 along the shore. */
  dir: number;
  speed: number;
  /** True for a liner: a longer hull and a white house instead of a stack. */
  cruise: boolean;
  routed: boolean;
}

/** The shipping layer. Three meshes, exactly as the traffic layer has three. */
export class Ships {
  private readonly hulls: GrowableInstancedMesh;
  private readonly houses: GrowableInstancedMesh;
  private readonly stacks: GrowableInstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly point: Shore = { x: 0, z: 0 };
  private readonly ahead: Shore = { x: 0, z: 0 };
  private readonly pool: Ship[] = [];
  private readonly random = rng(mixSeed(SEED, 0x5b17));

  private active = 0;
  /** How many of the pool are liners. They take the front of it. */
  private liners = 0;

  constructor(
    scene: THREE.Scene,
    /** Reduced motion parks the fleet. Ships at anchor still read as a port. */
    private readonly moving: boolean,
  ) {
    this.hulls = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, HULL_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.hull }),
      MAX_SHIPS,
      { castShadow: true, name: 'sea:hull' },
    );
    this.houses = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, HOUSE_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.concrete }),
      MAX_SHIPS,
      { castShadow: true, name: 'sea:house' },
    );
    this.stacks = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, STACK_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.container }),
      MAX_SHIPS,
      { castShadow: true, name: 'sea:containers' },
    );

    for (let i = 0; i < MAX_SHIPS; i++) {
      this.pool.push({
        v: 0,
        from: 0,
        offset: LANE_NEAR,
        dir: 1,
        speed: SPEED_MIN,
        cruise: false,
        routed: false,
      });
    }
  }

  /**
   * How much shipping the port has earned.
   *
   * Terminals, not districts: an empty coast has nothing to sail to, and the
   * first ship arriving with the first berth is most of what makes buying one
   * feel like it did something. Nothing here is stored.
   */
  private static fleet(state: Readonly<GameState>): number {
    return Math.min(
      MAX_SHIPS,
      state.cruiseTerminals * SHIPS_PER_CRUISE + state.cargoTerminals * SHIPS_PER_CARGO,
    );
  }

  /** Reads the counts. Nothing here is stored; it is all recomputed from state. */
  sync(state: Readonly<GameState>): void {
    this.active = Ships.fleet(state);
    const wanted = Math.min(state.cruiseTerminals * SHIPS_PER_CRUISE, this.active);
    if (wanted === this.liners) return;
    for (let i = 0; i < MAX_SHIPS; i++) {
      const ship = this.pool[i] as Ship;
      const cruise = i < wanted;
      if (ship.cruise === cruise) continue;
      ship.cruise = cruise;
      // Re-routed rather than left mid-run, exactly as a car that becomes a bus
      // is: a hull that changed length halfway along would jump.
      ship.routed = false;
    }
    this.liners = wanted;
  }

  /**
   * Gives a ship a stretch of coast to run.
   *
   * Biased toward what the player is looking at in the same way a car's route
   * is, and by the same trick: the focus is projected into the coast frame and
   * the run is started a little back along it. There is no need to sample and
   * retry here — unlike a district, a coastline is continuous, so the right
   * stretch can simply be computed.
   */
  private route(ship: Ship, focusV: number): void {
    ship.dir = this.random() < 0.5 ? 1 : -1;
    ship.offset = LANE_NEAR + this.random() * (LANE_FAR - LANE_NEAR);
    ship.speed = SPEED_MIN + this.random() * (SPEED_MAX - SPEED_MIN);
    // Start behind the focus in the direction of travel, so a newly routed
    // ship sails into view rather than appearing in the middle of it. Parked
    // fleets are scattered along the run instead.
    const back = this.moving ? RUN_LENGTH / 2 : this.random() * RUN_LENGTH - RUN_LENGTH / 2;
    ship.from = focusV - ship.dir * back;
    ship.v = ship.from;
    ship.routed = true;
  }

  /**
   * Advances and draws the fleet. Allocates nothing.
   *
   * Culled ships are skipped rather than drawn small, and the visible ones are
   * written into the front of the instance buffers — the same arrangement the
   * traffic layer uses, for the same reason.
   */
  update(dt: number, focus: THREE.Vector3): void {
    if (this.active === 0) {
      this.hulls.count = 0;
      this.houses.count = 0;
      this.stacks.count = 0;
      return;
    }

    const focusV = WATERS.v(focus.x, focus.z);
    const dummy = this.dummy;
    let hulls = 0;
    let houses = 0;
    let stacks = 0;

    for (let i = 0; i < this.active; i++) {
      const ship = this.pool[i] as Ship;
      if (!ship.routed) this.route(ship, focusV);
      if (this.moving) {
        ship.v += ship.dir * ship.speed * dt;
        if (Math.abs(ship.v - ship.from) >= RUN_LENGTH) this.route(ship, focusV);
      }

      // The lane is a constant distance from a shore that bends, so both the
      // position and the heading come out of the same function. Two samples,
      // six sines, no state.
      const u = WATERS.shore(ship.v) + ship.offset;
      WATERS.toWorld(u, ship.v, this.point);
      const dx = this.point.x - focus.x;
      const dz = this.point.z - focus.z;
      if (dx * dx + dz * dz > VIEW_RADIUS * VIEW_RADIUS) continue;

      const nextV = ship.v + ship.dir * HEADING_STEP;
      WATERS.toWorld(WATERS.shore(nextV) + ship.offset, nextV, this.ahead);
      const heading = Math.atan2(this.ahead.x - this.point.x, this.ahead.z - this.point.z);

      const length = ship.cruise ? CRUISE_LENGTH : CARGO_LENGTH;
      const beam = ship.cruise ? CRUISE_BEAM : CARGO_BEAM;
      // The body's own +z runs the length of the hull, so `heading` is measured
      // off +z rather than +x — which is why this is atan2(dx, dz) above.
      dummy.rotation.set(0, heading, 0);
      dummy.position.set(this.point.x, HULL_Y, this.point.z);
      dummy.scale.set(beam, 1, length);
      dummy.updateMatrix();
      this.hulls.setMatrixAt(hulls++, dummy.matrix);

      if (ship.cruise) {
        dummy.position.set(this.point.x, HULL_Y + HULL_H / 2 + HOUSE_H / 2, this.point.z);
        dummy.scale.set(beam * 0.8, 1, length * 0.72);
        dummy.updateMatrix();
        this.houses.setMatrixAt(houses++, dummy.matrix);
      } else {
        dummy.position.set(this.point.x, HULL_Y + HULL_H / 2 + STACK_H / 2, this.point.z);
        dummy.scale.set(beam * 0.72, 1, length * 0.6);
        dummy.updateMatrix();
        this.stacks.setMatrixAt(stacks++, dummy.matrix);
      }
    }

    this.hulls.count = hulls;
    this.houses.count = houses;
    this.stacks.count = stacks;
    this.hulls.flush();
    this.houses.flush();
    this.stacks.flush();
  }
}
