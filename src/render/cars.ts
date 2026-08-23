import * as THREE from 'three';
import { mixSeed, rng } from '../core/rng';
import { DISTRICT_SPAN, SEED } from '../sim/config';
import { residents } from '../sim/economy';
import {
  DISTRICT_WIDTH,
  worldX,
  worldZ,
  type CityLayout,
  type Coord,
  type District,
} from '../sim/layout';
import type { GameState } from '../sim/state';
import { Glow } from './glow';
import { ROAD_H, ROAD_W } from './ground';
import { GrowableInstancedMesh } from './growable';
import { PALETTE } from './palette';

/**
 * Traffic, and nothing else.
 *
 * Not a word of this reaches `GameState`, and that is the point rather than an
 * oversight: a car is a readout of the resident count in exactly the way a
 * building is a readout of `homes`. A car that needed saving would be a bug —
 * it would mean the view had started holding a number the simulation could not
 * reproduce, which is the same failure as storing a building's coordinates.
 */

/**
 * The fleet ceiling.
 *
 * At 160 instances the per-frame matrix loop is about 160 trig-free writes and
 * one buffer upload, and the whole fleet is one draw call. The number that
 * would actually cost something is the *light* count, which is why the
 * headlights below are geometry rather than lights.
 */
export const MAX_CARS = 160;

/** Cars per thousand residents. A city of 26,000 saturates the budget. */
export const CARS_PER_1000 = 6;

/**
 * Traffic once anything at all is standing.
 *
 * Four detached houses are sixteen residents and, at the rate above, a tenth of
 * a car. An empty street outside an occupied house reads as a bug; a handful of
 * cars reads as a town too small to have rush hour.
 */
export const MIN_CARS = 8;

/**
 * Half the gap between the two lanes of a carriageway.
 *
 * ROAD_W is 2.4, so ±0.6 puts each direction on the quarter point of its own
 * side — far enough apart to read as two lanes, near enough that a 0.8-wide car
 * never overhangs the kerb. Right-hand traffic, which is what makes a junction
 * legible without a lane graph: the offset flips with the direction of travel.
 */
const LANE = ROAD_W / 4;

const CAR_LENGTH = 1.9;
const CAR_WIDTH = 0.8;
const CAR_HEIGHT = 0.55;
/** Wheels on the carriageway, not sunk into it. */
const CAR_Y = ROAD_H + CAR_HEIGHT / 2;

const SPEED_MIN = 5.5;
const SPEED_MAX = 9;

/**
 * How far from what the player is looking at a car is still worth drawing.
 *
 * Distance from the camera focus, not district index: the focus is where the
 * detail is, and a district's ordinal says nothing about whether it is on
 * screen — district 1 is as likely to be off the far edge of a seven-ring city
 * as district 40 is.
 */
const VIEW_RADIUS = 180;

/** Tries at finding a route near the focus before settling for any district. */
const ROUTE_TRIES = 5;

/** Headlights are geometry, so they cost nothing to leave off in daylight. */
const HEADLIGHT_NIGHT = 0.15;

/** One vehicle's whole state. Pooled and mutated; never allocated in a frame. */
interface Car {
  /** The lane's constant coordinate: z for a car driving along x, x for one along z. */
  fixed: number;
  /** Where the run starts along the driving axis. */
  from: number;
  /** Length of the run, in world units. Always one district edge to the other. */
  length: number;
  /** +1 or -1 along the driving axis. */
  dir: number;
  /** True when the driving axis is x, false when it is z. */
  alongX: boolean;
  /** Rotation about y that turns the body's own +x axis onto the direction of travel. */
  heading: number;
  speed: number;
  travelled: number;
  /** False until the car has been given its first route. */
  routed: boolean;
}

/** The full row and column streets of one district, in global grid coordinates. */
interface RoadLines {
  readonly rows: number[];
  readonly cols: number[];
}

/**
 * Which of a district's streets run the whole way across it.
 *
 * A district's road cells are the union of its full rows and its full columns,
 * so a line is exactly a coordinate that contributes DISTRICT_SPAN cells. Any
 * other row picks up only the cells where the column streets cross it. Measured
 * over the 49 districts of a full city: the count picks out the generator's own
 * rowRoad/colRoad masks exactly, every district has 2 or 3 lines on each axis,
 * and the largest count a *non*-line ever reaches is 3 against a threshold of
 * 12. Derived once per district and cached; districts are append-only.
 */
function roadLines(district: District): RoadLines {
  const rowCount = new Int32Array(DISTRICT_SPAN);
  const colCount = new Int32Array(DISTRICT_SPAN);
  const ox = district.coord.x * DISTRICT_SPAN;
  const oz = district.coord.z * DISTRICT_SPAN;
  for (const cell of district.roads as readonly Coord[]) {
    const lz = cell.z - oz;
    const lx = cell.x - ox;
    if (lz >= 0 && lz < DISTRICT_SPAN) rowCount[lz] = (rowCount[lz] ?? 0) + 1;
    if (lx >= 0 && lx < DISTRICT_SPAN) colCount[lx] = (colCount[lx] ?? 0) + 1;
  }
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < DISTRICT_SPAN; i++) {
    if (rowCount[i] === DISTRICT_SPAN) rows.push(oz + i);
    if (colCount[i] === DISTRICT_SPAN) cols.push(ox + i);
  }
  return { rows, cols };
}

/**
 * The traffic layer.
 *
 * One InstancedMesh for the bodies and one for the headlights, both sized once
 * to MAX_CARS and never grown. Routing is the cheapest thing that reads as
 * traffic: pick a street, drive it end to end in the right-hand lane, take a
 * new one at the far kerb. No lane graph, no junctions, no turning — at the
 * distance this game is played from, what sells traffic is that things are
 * moving along the streets and not through the buildings.
 */
export class Cars {
  private readonly bodies: GrowableInstancedMesh;
  private readonly lamps: GrowableInstancedMesh;
  private readonly headlights = new Glow(PALETTE.headlight, 0);
  private readonly dummy = new THREE.Object3D();
  private readonly pool: Car[] = [];
  private readonly lines: RoadLines[] = [];
  private readonly random = rng(mixSeed(SEED, 0x0c47));

  private districts = 0;
  private active = 0;

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
    /** Reduced motion parks the fleet. Static cars on a street still read as a city. */
    private readonly moving: boolean,
  ) {
    this.bodies = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(CAR_LENGTH, CAR_HEIGHT, CAR_WIDTH),
      new THREE.MeshLambertMaterial({ color: PALETTE.car }),
      MAX_CARS,
      { castShadow: true },
    );
    // 160 point lights would take the frame rate apart. A lit quad on the nose
    // is the whole effect at this camera distance, and it costs one material.
    this.lamps = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(0.08, 0.18, CAR_WIDTH * 0.78),
      this.headlights.material,
      MAX_CARS,
    );
    this.lamps.mesh.visible = false;

    for (let i = 0; i < MAX_CARS; i++) {
      this.pool.push({
        fixed: 0,
        from: 0,
        length: DISTRICT_WIDTH,
        dir: 1,
        alongX: true,
        heading: 0,
        speed: SPEED_MIN,
        travelled: 0,
        routed: false,
      });
    }
  }

  /**
   * How much traffic the city has earned. Population sets it, exactly as
   * population sets everything else the view draws.
   */
  private static fleet(state: Readonly<GameState>): number {
    const built =
      state.homes + state.shops + state.industry + state.hospitals + state.police + state.fire;
    if (built <= 0) return 0;
    const wanted = Math.round((residents(state) * CARS_PER_1000) / 1000);
    return Math.min(MAX_CARS, Math.max(MIN_CARS, wanted));
  }

  /** Reads the counts. Nothing here is stored; it is all recomputed from state. */
  sync(state: Readonly<GameState>): void {
    if (state.districts !== this.districts) {
      this.layout.ensure(state.districts);
      for (let i = this.lines.length; i < state.districts; i++) {
        this.lines.push(roadLines(this.layout.districts[i] as District));
      }
      this.districts = state.districts;
    }
    this.active = Math.min(Cars.fleet(state), this.lines.length > 0 ? MAX_CARS : 0);
  }

  /**
   * Gives a car a street to drive.
   *
   * Districts are sampled rather than searched: a handful of draws biased
   * toward the camera focus keeps the fleet where it can be seen without
   * sorting anything, and the fallback means a player looking at empty land
   * still gets traffic somewhere rather than none at all.
   */
  private route(car: Car, focusX: number, focusZ: number): void {
    let chosen = 0;
    for (let i = 0; i < ROUTE_TRIES; i++) {
      chosen = Math.floor(this.random() * this.lines.length);
      const d = this.layout.districts[chosen] as District;
      const dx = d.centreX - focusX;
      const dz = d.centreZ - focusZ;
      if (dx * dx + dz * dz <= VIEW_RADIUS * VIEW_RADIUS) break;
    }
    const district = this.layout.districts[chosen] as District;
    const lines = this.lines[chosen] as RoadLines;

    // A district always has at least one of each — line 0 of both axes is a
    // street — but the fallback keeps this honest if that ever stops holding.
    const useX = lines.rows.length > 0 && (lines.cols.length === 0 || this.random() < 0.5);
    const dir = this.random() < 0.5 ? 1 : -1;
    const half = DISTRICT_WIDTH / 2;

    car.alongX = useX;
    car.dir = dir;
    car.length = DISTRICT_WIDTH;
    car.speed = SPEED_MIN + this.random() * (SPEED_MAX - SPEED_MIN);
    // Start and finish at the district's own edges, which are streets in their
    // own right: a car is only ever created or retired at a junction on the
    // boundary, never halfway down a block with nothing to have come from.
    if (useX) {
      const row = lines.rows[Math.floor(this.random() * lines.rows.length)] as number;
      car.from = dir > 0 ? district.centreX - half : district.centreX + half;
      // Right-hand traffic: heading +x, the near kerb is +z; heading -x, -z.
      car.fixed = worldZ(row) + dir * LANE;
      car.heading = dir > 0 ? 0 : Math.PI;
    } else {
      const col = lines.cols[Math.floor(this.random() * lines.cols.length)] as number;
      car.from = dir > 0 ? district.centreZ - half : district.centreZ + half;
      // Heading +z the near kerb is -x, so the lane offset flips against dir.
      car.fixed = worldX(col) - dir * LANE;
      car.heading = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    // A parked fleet is placed along its streets rather than stacked on the
    // kerb it would have entered from; a moving one always enters at the edge.
    car.travelled = this.moving ? 0 : this.random() * car.length;
    car.routed = true;
  }

  /**
   * Advances and draws the fleet. Allocates nothing.
   *
   * Culled cars are skipped rather than drawn small: the visible ones are
   * written into the front of the instance buffer and the count is trimmed to
   * however many that was, so a camera looking at one corner of a seven-ring
   * city submits the cars in that corner and no others.
   */
  update(dt: number, focus: THREE.Vector3, night: number): void {
    if (this.lines.length === 0 || this.active === 0) {
      this.bodies.count = 0;
      this.lamps.count = 0;
      return;
    }

    this.headlights.setNight(night);
    const lit = night > HEADLIGHT_NIGHT;
    this.lamps.mesh.visible = lit;

    const dummy = this.dummy;
    const fx = focus.x;
    const fz = focus.z;
    let drawn = 0;

    for (let i = 0; i < this.active; i++) {
      const car = this.pool[i] as Car;
      if (!car.routed) this.route(car, fx, fz);
      if (this.moving) {
        car.travelled += car.speed * dt;
        if (car.travelled >= car.length) this.route(car, fx, fz);
      }

      const along = car.from + car.dir * car.travelled;
      const x = car.alongX ? along : car.fixed;
      const z = car.alongX ? car.fixed : along;
      const dx = x - fx;
      const dz = z - fz;
      if (dx * dx + dz * dz > VIEW_RADIUS * VIEW_RADIUS) continue;

      dummy.position.set(x, CAR_Y, z);
      dummy.rotation.set(0, car.heading, 0);
      dummy.updateMatrix();
      this.bodies.setMatrixAt(drawn, dummy.matrix);

      if (lit) {
        // The nose, in the direction of travel. Same rotation, so the quad
        // faces the way the car is going without a second trig call.
        dummy.position.set(
          car.alongX ? x + car.dir * (CAR_LENGTH / 2) : x,
          CAR_Y,
          car.alongX ? z : z + car.dir * (CAR_LENGTH / 2),
        );
        dummy.updateMatrix();
        this.lamps.setMatrixAt(drawn, dummy.matrix);
      }
      drawn++;
    }

    this.bodies.count = drawn;
    this.bodies.flush();
    if (lit) {
      this.lamps.count = drawn;
      this.lamps.flush();
    } else {
      this.lamps.count = 0;
    }
  }
}
