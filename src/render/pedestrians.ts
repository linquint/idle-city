import * as THREE from 'three';
// Explicit .ts extensions, per the convention `tsconfig.json` documents:
// `tools/pedestrians.calibrate.mjs` is what set MAX_PEDESTRIANS, and it has to
// be able to load this module with plain Node.
import { mixSeed, rng } from '../core/rng.ts';
import { SEED } from '../sim/config.ts';
import { congestion, roadTrips, trips } from '../sim/economy.ts';
import { worldX, worldZ, type CityLayout, type District } from '../sim/layout.ts';
import type { GameState } from '../sim/state.ts';
import { FOOT_OFF, FOOT_W, PAVE_H } from './ground.ts';
import { GrowableInstancedMesh } from './growable.ts';
import { PALETTE } from './palette.ts';
import { roadLines, type RoadLines } from './streets.ts';

/**
 * People on the pavement, and nothing else.
 *
 * Built to the shape `cars.ts` establishes, and for the same reason: a walker
 * is a readout of the city's trip count in exactly the way a car is a readout
 * of its resident count. Not a word of this reaches `GameState`. A pedestrian
 * that needed saving would be the same bug as a stored building coordinate —
 * the view holding a number the simulation could not reproduce.
 *
 * What the two fleets say between them is the whole design: `cars.ts` draws the
 * trips that are on the road, and this draws the ones that are not. A city with
 * no buses is a city where every trip is a car trip, and its pavements are
 * empty by construction rather than by oversight — see `walkingTrips`.
 */

/**
 * The fleet ceiling.
 *
 * Measured, not felt. `tools/pedestrians.calibrate.mjs` times the body of
 * `update` — advance, one distance test, one position write, one matrix
 * compose, one instance write — over 4,000 frames, best of three, at instance
 * counts from 160 to 2,000. It is linear above about 320, and on this machine
 * one walker costs **0.099 µs** a frame in the shape chosen here. So:
 *
 *   480 instances (this)              0.048 ms/frame — 0.29% of a 60 Hz frame
 *   160 instances (MAX_CARS's shape)  0.022 ms/frame — 0.13%
 *
 * Three times the car fleet for a fortieth of a millisecond, which is what
 * "smaller and slower than a car" buys. Two things make a walker cheaper than a
 * car rather than merely equal:
 *
 *   - no rotation. The body is square in plan (0.34 x 0.34), so there is no
 *     facing to show and `dummy.rotation` is written once in the constructor and
 *     never again. That takes the Euler-to-quaternion conversion off every
 *     instance of every frame, and it is 28% of the loop: 0.099 µs against
 *     0.138 µs with the rotation left in;
 *   - no shadow. The shadow map is 2048px over the 300-unit span `focusShadows`
 *     keeps, so one texel is 0.146 world units and a walker is 2.3 of them
 *     across. What it would cast is PCF noise rather than a shadow, so it stays
 *     out of the depth pass entirely.
 *
 * The ceiling is a ceiling and not a target, and the view radius below is what
 * decides how much of it is ever written. Measured over 300 frames with the
 * focus on the city centre: 100% of the pool drawn at one district, 93% at ten,
 * 76% at forty-nine. The last is the interesting one — a seven-ring city is 660
 * units across against a 120-unit radius, and what keeps three quarters of the
 * fleet on screen is that `route` samples districts near the focus.
 */
export const MAX_PEDESTRIANS = 480;

/**
 * Walkers per thousand trips the road does not carry.
 *
 * 30, so the fleet saturates at 16,000 walking trips a second. At the transit
 * network's own ceiling — TRANSIT_ROAD_SHARE and the free-fare ridership lift
 * together carry 94.5% of trips, against TRIPS_PER_RESIDENT of 1.05 — that is
 * almost exactly one walking trip per resident, so a fully bussed city of
 * 16,000 fills the pavements. The car fleet saturates at 26,700 residents, so a
 * saturated city runs three walkers to every car: pavements carry more bodies
 * than a carriageway carries cars, which is the thing being drawn.
 */
export const WALKERS_PER_1000_TRIPS = 30;

/**
 * People outside once anything at all is standing.
 *
 * The same floor MIN_CARS is, for the same reason: an empty pavement outside an
 * occupied house reads as a bug. It is doing more work here than it does for
 * the cars, because a city with no depots has no walking trips at all and would
 * otherwise draw nobody at any size — see `walkingTrips` for why that is the
 * intended reading rather than a hole in it.
 */
export const MIN_PEDESTRIANS = 12;

/** Half the footway's width, less half a body, so a walker never overhangs. */
const WALK_W = 0.34;
const WALK_H = 0.72;
const DRIFT = FOOT_W / 2 - WALK_W / 2;

/** Feet on the pavement, not sunk into it. */
const WALK_Y = PAVE_H + WALK_H / 2;

/**
 * Walking pace, in world units a second.
 *
 * Set against the cars rather than against a real person: SPEED_MAX is 9 and a
 * town car does about seven times a walking pace, so 1.05 to 1.55 puts a walker
 * where a walker belongs relative to the traffic beside it. Deriving it from
 * CELL and a metres-per-second figure instead would have made the whole city
 * agree to a scale it has never claimed.
 */
const WALK_MIN = 1.05;
const WALK_MAX = 1.55;

/**
 * The bob, and how fast it runs.
 *
 * The only thing that says "walking" rather than "sliding" once the body is a
 * box with no facing, and it is not free: one `sin` an instance a frame is
 * 0.043 µs of the 0.099, so the gait is 44% of the loop and the largest single
 * cost in it. Kept anyway, and the calibrator prints the alternative in its
 * "plain" column so the trade is on the page rather than in someone's memory —
 * 0.048 ms a frame against 0.027 is not a trade worth taking to lose the one
 * cue that says these are people.
 *
 * The phase is per walker so a pavement is not a chorus line, and the frequency
 * runs on the walker's own distance travelled rather than on a clock, so a slow
 * walker bobs slowly and a stopped one stands still.
 */
const BOB = 0.028;
const BOB_RATE = 5.5;

/**
 * How far from what the player is looking at a walker is still worth drawing.
 *
 * Tighter than the cars' 180, and the body size is the whole argument: at 120
 * units a 0.34-wide box subtends about four pixels on a 1080-line display at
 * the camera's 42-degree vertical field, and at 180 it is under three. Same
 * form as `cars.ts` — distance from the camera focus, because that is where the
 * detail is and a district's ordinal says nothing about whether it is on
 * screen.
 */
const VIEW_RADIUS = 120;

/** Tries at finding a street near the focus before settling for any district. */
const ROUTE_TRIES = 6;

/**
 * The share every junction gets whatever its street fronts.
 *
 * Larger than the cars' floor of 1 to 4 because both frontage counts are summed
 * here rather than read one at a time, so the same lean over a doubled weight
 * needs a doubled floor. A district with nothing built on it still has
 * somewhere for a walker to go rather than dividing by zero.
 */
const FRONTAGE_FLOOR = 6;

/**
 * Legs in one walk before the walker is retired and put down somewhere else.
 *
 * Longer than a car's two-to-four, because a leg is a block and a walker covers
 * one in about forty seconds where a car covers it in six. Two legs would be a
 * walker that spent its whole life being re-routed.
 */
const WALK_LEGS_MIN = 3;
const WALK_LEGS_MAX = 6;

/**
 * Waiting at the kerb, and how likely it is at full congestion.
 *
 * The pedestrian half of what JUNCTION_WAIT_CHANCE does for the cars, and it
 * reads the same field: `congestion` is trips against road cells, and a street
 * with more cars on it is a street that takes longer to cross. An empty city
 * never waits at all, which is what makes the two ends of the scale read.
 */
const CROSSING_WAIT_CHANCE = 0.5;
const CROSSING_WAIT_SECONDS = 1.8;

/** One walker's whole state. Pooled and mutated; never allocated in a frame. */
interface Walker {
  /** The pavement's constant coordinate: z for a walker along x, x for one along z. */
  fixed: number;
  /** Where the leg starts along the walking axis. */
  from: number;
  /** Length of the leg, in world units. One junction to the next. */
  length: number;
  /** +1 or -1 along the walking axis. */
  dir: number;
  /** True when the walking axis is x, false when it is z. */
  alongX: boolean;
  speed: number;
  travelled: number;
  /** False until the walker has been given its first leg. */
  routed: boolean;
  /** Seconds left at a crossing. */
  waiting: number;
  /** Legs left in the walk, this one included. Zero means retire and re-route. */
  legsLeft: number;
  /** Which district the walk is in, so a turn does not re-sample the map. */
  district: number;
  /** Grid coordinate of the street being walked along — a row's z, a column's x. */
  line: number;
  /** Grid coordinate of the junction this leg started at. */
  at: number;
  /** Grid coordinate of the junction it ends at. Never equal to `at`. */
  to: number;
  /**
   * Phase of the bob, in radians. Fixed per walker for its whole life, which is
   * what keeps a busy pavement from stepping in time.
   */
  phase: number;
}

/**
 * Trips the road is not carrying, which is what a pavement is.
 *
 * `trips` minus `roadTrips` is exactly `trips * transitShare`, and that is the
 * honest statement rather than a proxy for one: the simulation has no walking
 * mode, so every trip it makes is either in a car or on a bus, and the bus trip
 * is the one with a person walking at each end of it. The car fleet already
 * draws the other half.
 *
 * The consequence is deliberate and worth saying out loud: a city with no
 * depots draws MIN_PEDESTRIANS and no more, at any size. That is the same
 * visual argument for the depot that BUS_CONGESTION_SHARE makes from the other
 * side — buying transit is what puts people on the street.
 */
export const walkingTrips = (s: Readonly<GameState>): number =>
  Math.max(0, trips(s) - roadTrips(s));

/**
 * How many walkers the city has earned. Nothing here is stored.
 *
 * A module function rather than a private static so the calibrator can read it
 * without standing a scene up — the same reason `Cars.fleet` would want to be
 * one, and it is the only thing in this file the tests and the tools need.
 */
export const pedestrianFleet = (s: Readonly<GameState>): number => {
  const built = s.homes + s.shops + s.industry + s.hospitals + s.police + s.fire;
  if (built <= 0) return 0;
  const wanted = Math.round((walkingTrips(s) * WALKERS_PER_1000_TRIPS) / 1000);
  return Math.min(MAX_PEDESTRIANS, Math.max(MIN_PEDESTRIANS, wanted));
};

/**
 * The pedestrian layer.
 *
 * One InstancedMesh, sized once to MAX_PEDESTRIANS and never grown, and one
 * draw call. Routing is the cars' router with the turns made cheaper: a walker
 * picks a street, a pavement and a direction, walks junction to junction, and
 * turns onto a crossing street at the far kerb. Unlike a car it has no lane to
 * be on the correct side of — which pavement it is on is a coin, not a rule,
 * because both pavements of a street carry people in both directions.
 */
export class Pedestrians {
  private readonly bodies: GrowableInstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly pool: Walker[] = [];
  private readonly lines: RoadLines[] = [];
  private readonly random = rng(mixSeed(SEED, 0x0fe7));

  private districts = 0;
  private active = 0;
  /**
   * How jammed the streets are, straight off the simulation. Read once a sync
   * rather than once a walker, for the reason `Cars.jam` is: it is a city-wide
   * scalar, so asking for it once a sync is asking for it as often as it can
   * change. Nothing is written back.
   */
  private jam = 0;

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
    /** Reduced motion parks the fleet. People standing on a pavement still read as a city. */
    private moving: boolean,
  ) {
    this.bodies = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(WALK_W, WALK_H, WALK_W),
      new THREE.MeshLambertMaterial({ color: PALETTE.pedestrian }),
      MAX_PEDESTRIANS,
      // No shadow. See MAX_PEDESTRIANS: a walker is 2.3 shadow-map texels
      // across, so what it would cast is noise rather than a shadow, and
      // staying out of the depth pass is most of what the fleet saves.
      { name: 'traffic:pedestrian' },
    );
    // Written once, for the whole life of the renderer. The body is square in
    // plan so there is no facing to show, and this is what keeps the Euler
    // conversion out of the per-instance loop — see MAX_PEDESTRIANS.
    this.dummy.rotation.set(0, 0, 0);

    for (let i = 0; i < MAX_PEDESTRIANS; i++) {
      this.pool.push({
        fixed: 0,
        from: 0,
        length: 0,
        dir: 1,
        alongX: true,
        speed: WALK_MIN,
        travelled: 0,
        routed: false,
        waiting: 0,
        legsLeft: 0,
        district: 0,
        line: 0,
        at: 0,
        to: 0,
        phase: 0,
      });
    }
  }

  /**
   * Turns the animation on or off under the running game.
   *
   * The pool is untouched: what `moving` decides is whether a mover advances
   * along its route each frame and whether a fresh one is placed at the start
   * of its run or somewhere random along it. Held still, everything is exactly
   * where it was, which is what makes the switch a switch rather than a
   * rebuild.
   */
  setMoving(on: boolean): void {
    this.moving = on;
  }

  /** Walkers written into the instance buffer last frame, for the calibrator. */
  get instances(): number {
    return this.bodies.count;
  }

  /** Reads the counts. Nothing here is stored; it is all recomputed from state. */
  sync(state: Readonly<GameState>): void {
    if (state.districts !== this.districts) {
      this.layout.ensure(state);
      for (let i = this.lines.length; i < state.districts; i++) {
        this.lines.push(roadLines(this.layout.districts[i] as District));
      }
      this.districts = state.districts;
    }
    this.jam = congestion(state);
    this.active = this.lines.length > 0 ? pedestrianFleet(state) : 0;
  }

  /**
   * Picks one of a street's junctions, weighted toward what it fronts.
   *
   * The cars' `pickWeighted` with one difference: a walker is drawn toward
   * *everything* a street fronts rather than toward housing at one end and work
   * at the other. A commute is a route with two ends; a walk past a parade of
   * shops is a walk along the street they are on.
   */
  private pickWeighted(lines: RoadLines, alongX: boolean, exclude: number): number {
    const homes = alongX ? lines.colHomes : lines.rowHomes;
    const work = alongX ? lines.colWork : lines.rowWork;
    const count = alongX ? lines.cols.length : lines.rows.length;
    let total = 0;
    for (let i = 0; i < count; i++) {
      if (i === exclude) continue;
      total += (homes[i] ?? 0) + (work[i] ?? 0) + FRONTAGE_FLOOR;
    }
    if (total <= 0) return exclude === 0 ? Math.min(1, count - 1) : 0;
    let roll = this.random() * total;
    for (let i = 0; i < count; i++) {
      if (i === exclude) continue;
      roll -= (homes[i] ?? 0) + (work[i] ?? 0) + FRONTAGE_FLOOR;
      if (roll <= 0) return i;
    }
    return exclude === 0 ? Math.min(1, count - 1) : 0;
  }

  /**
   * Points a walker down one leg: a street, a pavement, and two junctions.
   *
   * Everything drawn falls out of three grid numbers and a coin, exactly as it
   * does for a car, so a turn is this call rather than a route to look up.
   */
  private setLeg(walker: Walker, alongX: boolean, line: number, at: number, to: number): void {
    const start = alongX ? worldX(at) : worldZ(at);
    const end = alongX ? worldX(to) : worldZ(to);
    walker.alongX = alongX;
    walker.line = line;
    walker.at = at;
    walker.to = to;
    walker.dir = end >= start ? 1 : -1;
    walker.length = Math.abs(end - start);
    walker.from = start;
    // Which pavement is a coin and not a rule, and it is re-tossed on every leg
    // because turning a corner is where a person would cross anyway. The drift
    // spreads the walker across the footway's own width so a busy street is a
    // pavement rather than a queue.
    const side = this.random() < 0.5 ? 1 : -1;
    const drift = (this.random() * 2 - 1) * DRIFT;
    const centre = alongX ? worldZ(line) : worldX(line);
    walker.fixed = centre + side * FOOT_OFF + drift;
    walker.speed = WALK_MIN + this.random() * (WALK_MAX - WALK_MIN);
    walker.travelled = 0;
  }

  /**
   * Turns onto a crossing street at the junction the last leg ended on.
   *
   * The cars' junction model unchanged, because it is the streets' own
   * geometry rather than anything about a vehicle: every row line crosses every
   * column line by construction, so the street being turned onto *is* `to` and
   * the position along it is the line the walker came in on.
   */
  private turn(walker: Walker): void {
    const lines = this.lines[walker.district] as RoadLines;
    const alongX = !walker.alongX;
    const junctions = alongX ? lines.cols : lines.rows;
    const line = walker.to;
    const at = junctions.indexOf(walker.line);
    if (at < 0) {
      // The crossing street is not one this district lists, which can only
      // happen if the caches ever disagreed. Start again rather than walk off.
      walker.routed = false;
      return;
    }
    const to = this.pickWeighted(lines, alongX, at);
    this.setLeg(walker, alongX, line, junctions[at] as number, junctions[to] as number);
  }

  /**
   * Gives a walker a whole walk: a district, a street with something on it, and
   * three to six legs' worth of corners.
   *
   * Districts are sampled rather than searched, exactly as the cars' are: a
   * handful of draws biased toward the camera focus keeps the fleet where it
   * can be seen without sorting anything.
   */
  private route(walker: Walker, focusX: number, focusZ: number): void {
    let chosen = 0;
    for (let i = 0; i < ROUTE_TRIES; i++) {
      chosen = Math.floor(this.random() * this.lines.length);
      const d = this.layout.districts[chosen] as District;
      const dx = d.centreX - focusX;
      const dz = d.centreZ - focusZ;
      if (dx * dx + dz * dz <= VIEW_RADIUS * VIEW_RADIUS) break;
    }
    const lines = this.lines[chosen] as RoadLines;

    walker.district = chosen;
    walker.legsLeft = WALK_LEGS_MIN + Math.floor(this.random() * (WALK_LEGS_MAX - WALK_LEGS_MIN + 1));
    walker.waiting = 0;
    walker.phase = this.random() * Math.PI * 2;

    const alongX = lines.rows.length > 0 && (lines.cols.length === 0 || this.random() < 0.5);
    const axis = alongX ? lines.rows : lines.cols;
    const cross = alongX ? lines.cols : lines.rows;
    const line = axis[Math.floor(this.random() * axis.length)] as number;
    const at = Math.floor(this.random() * cross.length);
    const to = this.pickWeighted(lines, alongX, at);
    this.setLeg(walker, alongX, line, cross[at] as number, cross[to] as number);
    // A parked fleet stands along its pavements rather than bunched at the
    // corner it would have entered from; a moving one always enters at one.
    walker.travelled = this.moving ? 0 : this.random() * walker.length;
    walker.routed = true;
  }

  /**
   * Advances and draws the fleet. Allocates nothing.
   *
   * Culled walkers are skipped rather than drawn small, exactly as the cars
   * are: the visible ones are written into the front of the instance buffer and
   * the count is trimmed to however many that was.
   */
  update(dt: number, focus: THREE.Vector3): void {
    if (this.lines.length === 0 || this.active === 0) {
      this.bodies.count = 0;
      return;
    }

    const dummy = this.dummy;
    const fx = focus.x;
    const fz = focus.z;
    let drawn = 0;

    for (let i = 0; i < this.active; i++) {
      const walker = this.pool[i] as Walker;
      if (!walker.routed) this.route(walker, fx, fz);
      if (this.moving) {
        if (walker.waiting > 0) {
          walker.waiting -= dt;
        } else {
          walker.travelled += walker.speed * dt;
        }
        if (walker.travelled >= walker.length) {
          const over = walker.travelled - walker.length;
          walker.legsLeft--;
          if (walker.legsLeft > 0) {
            this.turn(walker);
            if (walker.routed) {
              walker.travelled = Math.min(over, walker.length);
              // Waiting at the kerb, and only in traffic worth waiting for.
              if (this.random() < this.jam * CROSSING_WAIT_CHANCE) {
                walker.waiting = CROSSING_WAIT_SECONDS * (0.4 + this.random());
              }
            } else {
              this.route(walker, fx, fz);
            }
          } else {
            this.route(walker, fx, fz);
          }
        }
      }

      const along = walker.from + walker.dir * walker.travelled;
      const x = walker.alongX ? along : walker.fixed;
      const z = walker.alongX ? walker.fixed : along;
      const dx = x - fx;
      const dz = z - fz;
      if (dx * dx + dz * dz > VIEW_RADIUS * VIEW_RADIUS) continue;

      // A stopped walker stands still: the bob is a gait, so it belongs to the
      // distance covered rather than to the clock.
      const bob = walker.waiting > 0 ? 0 : Math.sin(walker.phase + walker.travelled * BOB_RATE) * BOB;
      dummy.position.set(x, WALK_Y + bob, z);
      dummy.updateMatrix();
      this.bodies.setMatrixAt(drawn++, dummy.matrix);
    }

    this.bodies.count = drawn;
    this.bodies.flush();
  }
}
