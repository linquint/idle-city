import * as THREE from 'three';
import { mixSeed, rng } from '../core/rng.ts';
import { CELL, SEED } from '../sim/config.ts';
import { congestion, landmarkCoverage, residents } from '../sim/economy.ts';
import {
  DISTRICT_WIDTH,
  worldX,
  worldZ,
  type CityLayout,
  type District,
} from '../sim/layout.ts';
import type { GameState } from '../sim/state.ts';
import { Glow } from './glow.ts';
import { ROAD_H, ROAD_W } from './ground.ts';
import { GrowableInstancedMesh } from './growable.ts';
import { bandLane, spurLane, type Lane } from './highway.ts';
import { PALETTE } from './palette.ts';
// The district's street graph, which the pavements read as well. Moved out of
// this file rather than exported from it: a street belongs to neither fleet.
import { roadLines, type RoadLines } from './streets.ts';

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
 * What a jammed street does to a car.
 *
 * The free-flowing speed is SPEED_MAX and the crawl is a third of SPEED_MIN, so
 * a fully congested city runs at about a fifth of an empty one — far enough
 * apart to read from the play camera without the fleet looking parked. The
 * simulation's `congestion` is the only input, which is what makes this a
 * readout: the number is decided in `sim/` and drawn here.
 */
const CAR_CRAWL = SPEED_MIN / 3;

/**
 * Per-vehicle speed spread, re-rolled on every leg.
 *
 * Re-rolled rather than fixed at route time, which is what turns a slow street
 * into a stop-start one: a car that turns four times over a route drives each
 * leg at a slightly different speed, so a queue bunches and thins the way a
 * queue does instead of gliding along in formation.
 */
const SPEED_JITTER = 0.35;

/**
 * Waiting at the lights, and how likely it is at full congestion.
 *
 * The other half of the stop-start read, and nearly free: a junction is already
 * where a car stops being on one street and starts being on another, so a pause
 * there costs one comparison and reuses the field a bus stop already uses.
 * Scaled by congestion, so an empty city never waits at all.
 */
const JUNCTION_WAIT_CHANCE = 0.55;
const JUNCTION_WAIT_SECONDS = 1.1;

/**
 * Legs in one route, before the vehicle is retired and sent somewhere new.
 *
 * Two to four. One would be the old behaviour with extra bookkeeping; more than
 * four and a car spends long enough on screen that the eye starts following it,
 * which is when a bias toward housing at one end stops reading as a commute and
 * starts reading as a car that cannot make up its mind.
 */
const ROUTE_LEGS_MIN = 2;
const ROUTE_LEGS_MAX = 4;

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

/**
 * Buses, out of the same pool.
 *
 * Not a second fleet and not a second router: a bus is a car with a longer body
 * and a route that stops. It shares the pool, the lane offsets, the culling and
 * the headlights, and costs exactly one more instanced mesh — a separate
 * traffic layer for eight vehicles would be a second copy of all of that for
 * nothing anyone can see from the play camera.
 *
 * Nothing about a bus reaches `GameState`. They are a readout of `depots` in
 * precisely the way a building is a readout of `homes`.
 */
const BUS_LENGTH = 3.4;
const BUS_HEIGHT = 0.95;
const BUS_WIDTH = 0.95;

/** Buses put on the road per depot, once the depot is staffed. */
const BUSES_PER_DEPOT = 3;

/** How far a bus runs between stops, and how long it sits at one. */
const STOP_SPACING = CELL * 3;
const STOP_SECONDS = 1.6;

/** Buses run slower than cars, which is most of what makes them read as buses. */
const BUS_SPEED = 4.2;

/**
 * How much of the city's congestion a bus actually suffers, and how far down it
 * takes one.
 *
 * Less than half, and this is the visual argument for the depot: on a jammed
 * street the buses are the things still moving. It is a claim about bus lanes
 * and priority at the lights rather than about the road being emptier for them.
 * A bus is already the slowest thing on the street, so its crawl is shallower
 * than a car's — three quarters of its free speed rather than a fifth.
 */
const BUS_CONGESTION_SHARE = 0.45;
const BUS_CRAWL = BUS_SPEED * 0.55;

/**
 * Lorries, out of the same pool again.
 *
 * A lorry is a car with a longer body and a route that is not in the city: it
 * runs the highway between the estates and the town, and it shares the pool,
 * the lane offsets, the culling and the headlights. One more instanced mesh,
 * for the same reason the buses cost one — a third traffic layer for a dozen
 * vehicles would be a third copy of all of that.
 *
 * They take the *back* of the pool where the buses take the front, so a fleet
 * that shrinks with the population loses cars from the middle and keeps both
 * services running. Nothing about a lorry reaches `GameState`: they are a
 * readout of `estates` in the way a bus is a readout of `depots`.
 */
const TRUCK_LENGTH = 4.4;
const TRUCK_HEIGHT = 1.15;
const TRUCK_WIDTH = 1.05;

/** Lorries on the road per estate, and the most the highway ever carries. */
const TRUCKS_PER_ESTATE = 0.6;
const MAX_TRUCKS = 16;

/**
 * Tourist coaches on the highway, at full landmark coverage.
 *
 * Road tourism arrives by coach — see ROAD_VISITORS, which is the number this
 * draws — and a coach is a bus that is not doing a bus route. So it reuses the
 * bus mesh rather than taking one of its own: a fourth vehicle type for six
 * vehicles would be a fourth instanced mesh, a fourth material and a fourth
 * count for something the player would read as a bus anyway. What tells it
 * apart is where it is, which is out of town.
 *
 * They need the road, and road tourism does not: `landmarkCoverage` lands
 * visitors from district one. A city under HIGHWAY_MIN_DISTRICTS has tourists
 * and no coaches, which is a number without a vehicle and is fine — the same
 * way a cruise berth's visitors have never had a person drawn for them.
 */
const COACHES_AT_FULL_LANDMARKS = 6;

/** Lorries run slower than cars and do not stop. */
const TRUCK_SPEED = 5;

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
  /** True for a bus: a longer body, a slower run and a route that stops. */
  bus: boolean;
  /** True for a lorry: a longer body again, and a route out of town. */
  truck: boolean;
  /**
   * True for a tourist coach: a bus body on a route out of town.
   *
   * Both flags, not one: `bus` decides which mesh draws it and `coach` decides
   * which router points it, which is exactly the split that lets a coach cost
   * no mesh of its own.
   */
  coach: boolean;
  /** Seconds left at the current stop, or at a junction in heavy traffic. */
  waiting: number;
  /** How far along the run the next stop is. */
  nextStop: number;
  /**
   * Legs left in the route, this one included. Zero means retire and re-route.
   *
   * A count rather than a list of legs, which is the whole of what keeps a
   * turning route allocation-free: the next leg is arithmetic over the junction
   * this one ends at, so there is nothing to store ahead of time.
   */
  legsLeft: number;
  /** Which district the route is in, so a turn does not re-sample the map. */
  district: number;
  /** Grid coordinate of the street being driven along — a row's z, a column's x. */
  line: number;
  /** Grid coordinate of the junction this leg started at, along the driving axis. */
  at: number;
  /** Grid coordinate of the junction it ends at. Never equal to `at`. */
  to: number;
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
  /** The one extra mesh buses cost. Same pool, same lanes, a longer box. */
  private readonly coaches: GrowableInstancedMesh;
  /** The one extra mesh lorries cost. Same pool, same lanes, a longer box. */
  private readonly lorries: GrowableInstancedMesh;
  private readonly lamps: GrowableInstancedMesh;
  private readonly headlights = new Glow(PALETTE.headlight, 0);
  private readonly dummy = new THREE.Object3D();
  private readonly pool: Car[] = [];
  private readonly lines: RoadLines[] = [];
  private readonly random = rng(mixSeed(SEED, 0x0c47));

  private districts = 0;
  private active = 0;
  /** How many of the pool are buses. They take the front of it. */
  private buses = 0;
  /** How many are lorries. They take the back, so the two services never fight. */
  private trucks = 0;
  /** How many are tourist coaches. Directly behind the buses — see `sync`. */
  private coachCount = 0;
  /** Reused by the truck router. A route must not allocate, per frame or otherwise. */
  private readonly lane: Lane = { alongX: true, fixed: 0, from: 0, length: 0 };
  /** What the highway looked like last sync. Lorries re-route when it moves. */
  private highwayDistricts = -1;
  private highwayEstates = -1;
  /**
   * How jammed the city's streets are, straight off the simulation.
   *
   * Read in `sync` and held, rather than read per car: it is a city-wide scalar
   * — see ROAD_CELLS_PER_DISTRICT for why it has to be — so asking for it once
   * a sync is asking for it as often as it can change. Nothing is written back.
   */
  private jam = 0;

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
      { castShadow: true, name: 'traffic:car' },
    );
    // 160 point lights would take the frame rate apart. A lit quad on the nose
    // is the whole effect at this camera distance, and it costs one material.
    this.lamps = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(0.08, 0.18, CAR_WIDTH * 0.78),
      this.headlights.material,
      MAX_CARS,
    );
    this.coaches = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(BUS_LENGTH, BUS_HEIGHT, BUS_WIDTH),
      new THREE.MeshLambertMaterial({ color: PALETTE.bus }),
      MAX_CARS,
      { castShadow: true, name: 'traffic:bus' },
    );
    this.lorries = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(TRUCK_LENGTH, TRUCK_HEIGHT, TRUCK_WIDTH),
      new THREE.MeshLambertMaterial({ color: PALETTE.industryRoof }),
      MAX_CARS,
      { castShadow: true, name: 'traffic:truck' },
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
        bus: false,
        truck: false,
        coach: false,
        waiting: 0,
        nextStop: STOP_SPACING,
        legsLeft: 0,
        district: 0,
        line: 0,
        at: 0,
        to: 0,
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

  /**
   * How many buses the depots put on the road.
   *
   * Staffed depots, not built ones: a depot that opened ten seconds ago has no
   * drivers, and its buses arriving instantly would be the one place the view
   * disagreed with the ramp the simulation is running. Nothing here is stored.
   */
  private static coaches(state: Readonly<GameState>): number {
    return Math.round(state.depots * state.depotStaff * BUSES_PER_DEPOT);
  }

  /**
   * How many lorries the estates put on the highway.
   *
   * Estates, not the road: a highway with nothing at the end of it carries no
   * freight, and the first lorry arriving with the first parcel is most of what
   * makes the purchase read as having done something.
   */
  private static freight(state: Readonly<GameState>): number {
    if (!state.highway) return 0;
    return Math.min(MAX_TRUCKS, Math.round(state.estates * TRUCKS_PER_ESTATE));
  }

  /**
   * How many coaches the landmarks put on the highway.
   *
   * Landmarks, not a terminal, because that is what road tourism is driven by —
   * see ROAD_VISITORS. And the road, because a coach needs one: a city with
   * museums and no highway lands its road tourists all the same and simply has
   * nothing to draw for them.
   */
  private static coachFleet(state: Readonly<GameState>): number {
    if (!state.highway) return 0;
    return Math.round(landmarkCoverage(state) * COACHES_AT_FULL_LANDMARKS);
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
    // The one number the simulation hands the router. A readout, like the fleet
    // size above it: the streets are slow because `congestion` says so, and the
    // view has no opinion of its own about traffic.
    this.jam = congestion(state);
    const freight = Cars.freight(state);
    // The fleet has to make room for the services rather than crowd them out:
    // a city whose population would only justify eight cars still runs whatever
    // buses and lorries it has paid for.
    this.active = Math.min(
      MAX_CARS,
      this.lines.length > 0
        ? Math.max(Cars.fleet(state), Cars.coaches(state) + Cars.coachFleet(state) + freight)
        : 0,
    );
    const buses = Math.min(Cars.coaches(state), this.active);
    const trucks = Math.min(freight, this.active - buses);
    // Coaches sit directly behind the buses: they draw with the bus mesh, so
    // keeping them adjacent keeps that mesh's instances contiguous in the pool
    // and costs the culling nothing.
    const coaches = Math.min(Cars.coachFleet(state), Math.max(0, this.active - buses - trucks));
    if (buses !== this.buses || trucks !== this.trucks || coaches !== this.coachCount) {
      for (let i = 0; i < MAX_CARS; i++) {
        const car = this.pool[i] as Car;
        const coach = i >= buses && i < buses + coaches;
        const bus = i < buses || coach;
        const truck = i >= this.active - trucks && i < this.active && !bus;
        if (car.bus === bus && car.truck === truck && car.coach === coach) continue;
        car.bus = bus;
        car.truck = truck;
        car.coach = coach;
        // Re-routed rather than left mid-run: a car that became a bus would
        // otherwise finish its run at the wrong speed and stop nowhere, and one
        // that became a lorry would finish it on the wrong road entirely.
        car.routed = false;
      }
      this.buses = buses;
      this.trucks = trucks;
      this.coachCount = coaches;
    }
    // The highway's own geometry moves — the spur follows the city's inland
    // edge and the band road follows the estates — so a lorry routed against
    // yesterday's road has to be sent round again.
    if (state.districts !== this.highwayDistricts || state.estates !== this.highwayEstates) {
      this.highwayDistricts = state.districts;
      this.highwayEstates = state.estates;
      for (let i = 0; i < MAX_CARS; i++) {
        const car = this.pool[i] as Car;
        if (car.truck || car.coach) car.routed = false;
      }
    }
  }

  /**
   * Puts a lorry on the highway: the spur out of town, or the band road.
   *
   * No sampling and no fallback, unlike the city router — there are exactly two
   * runs and both are straight, so the right one can simply be chosen. The lane
   * geometry comes from `highway.ts` rather than being worked out again here,
   * for the reason the water's does: two opinions about where the road is would
   * eventually be one lorry driving through a field.
   */
  private routeHighway(car: Car): void {
    const lane =
      this.random() < 0.4 ?
        spurLane(this.districts, this.lane)
      : bandLane(this.highwayEstates, this.lane);
    const dir = this.random() < 0.5 ? 1 : -1;
    car.alongX = lane.alongX;
    car.dir = dir;
    car.length = lane.length;
    car.speed = this.speedFor(car);
    car.waiting = 0;
    // No stops. A coach draws with the bus mesh and would otherwise inherit the
    // bus route's pull-ups, which on an open road would read as a breakdown.
    car.nextStop = Infinity;
    // One leg, always. A highway run is the road end to end and there is
    // nothing to turn onto — see `turn`, which the leg counter keeps it out of.
    car.legsLeft = 1;
    // The same right-hand lane offsets the streets use, so a lorry meeting a
    // car at the edge of town is on the side of the road it should be.
    if (lane.alongX) {
      car.from = dir > 0 ? lane.from : lane.from + lane.length;
      car.fixed = lane.fixed + dir * LANE;
      car.heading = dir > 0 ? 0 : Math.PI;
    } else {
      car.from = dir > 0 ? lane.from : lane.from + lane.length;
      car.fixed = lane.fixed - dir * LANE;
      car.heading = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    car.travelled = this.moving ? 0 : this.random() * car.length;
    car.routed = true;
  }

  /**
   * The speed one vehicle runs at, at the city's current congestion.
   *
   * Interpolated rather than switched, so a city that is buying its way out of
   * a jam sees the fleet pick up gradually as the depots open rather than all
   * at once. Re-rolled per *leg* rather than per route — see SPEED_JITTER.
   *
   * Lorries are exempt. They run the highway between the estates and the town,
   * which is not a city street and is not what `congestion` measures: it is
   * trips against the road cells inside the districts. A lorry slowed by
   * downtown traffic would be the view claiming something the simulation does
   * not say.
   */
  private speedFor(car: Car): number {
    // Both the vehicles that run the highway rather than the streets. It is not
    // what `congestion` measures — that is trips against the road cells inside
    // the districts — so slowing them by downtown traffic would be the view
    // claiming something the simulation does not say.
    if (car.truck) return TRUCK_SPEED;
    if (car.coach) return BUS_SPEED;
    const jam = Math.max(0, Math.min(1, car.bus ? this.jam * BUS_CONGESTION_SHARE : this.jam));
    const free = car.bus ? BUS_SPEED : SPEED_MAX;
    const crawl = car.bus ? BUS_CRAWL : CAR_CRAWL;
    return (free + (crawl - free) * jam) * (1 - SPEED_JITTER * this.random());
  }

  /**
   * Picks one of a street's junctions, weighted toward what it fronts.
   *
   * A running-sum draw over at most four entries, which is why it can afford to
   * be a weighted pick at all: no sorting, no array, one pass. `floor` is the
   * share every candidate gets whatever it fronts, so a district with no
   * housing yet still has somewhere for a car to start rather than dividing by
   * zero — the bias is a lean, not a rule.
   */
  private pickWeighted(weights: readonly number[], exclude: number, floor: number): number {
    let total = 0;
    for (let i = 0; i < weights.length; i++) {
      if (i === exclude) continue;
      total += (weights[i] ?? 0) + floor;
    }
    if (total <= 0) {
      // Every candidate is excluded, which only happens with a single junction.
      return exclude === 0 ? Math.min(1, weights.length - 1) : 0;
    }
    let roll = this.random() * total;
    for (let i = 0; i < weights.length; i++) {
      if (i === exclude) continue;
      roll -= (weights[i] ?? 0) + floor;
      if (roll <= 0) return i;
    }
    return exclude === 0 ? Math.min(1, weights.length - 1) : 0;
  }

  /** One of `count` junctions, never `exclude`. A leg of zero length is not a leg. */
  private pickUniform(count: number, exclude: number): number {
    if (count <= 1) return 0;
    const roll = Math.floor(this.random() * (count - 1));
    return roll >= exclude ? roll + 1 : roll;
  }

  /**
   * Points a car down one leg: a street, and the two junctions it runs between.
   *
   * Everything the renderer draws a car from — the world start, the lane offset,
   * the heading, the length — falls out of three grid numbers, so a turn is
   * three assignments and this call rather than a route to look up.
   */
  private setLeg(car: Car, alongX: boolean, line: number, at: number, to: number): void {
    const start = alongX ? worldX(at) : worldZ(at);
    const end = alongX ? worldX(to) : worldZ(to);
    car.alongX = alongX;
    car.line = line;
    car.at = at;
    car.to = to;
    car.dir = end >= start ? 1 : -1;
    car.length = Math.abs(end - start);
    car.from = start;
    if (alongX) {
      // Right-hand traffic: heading +x, the near kerb is +z; heading -x, -z.
      car.fixed = worldZ(line) + car.dir * LANE;
      car.heading = car.dir > 0 ? 0 : Math.PI;
    } else {
      // Heading +z the near kerb is -x, so the lane offset flips against dir.
      car.fixed = worldX(line) - car.dir * LANE;
      car.heading = car.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    car.speed = this.speedFor(car);
    car.travelled = 0;
  }

  /**
   * Turns onto a crossing street at the junction the last leg ended on.
   *
   * The whole of the junction model, and it needs no lane graph because every
   * row line crosses every column line by construction — a district's streets
   * are a grid. The car was driving along `line` and stopped at `to`; the
   * crossing street *is* `to`, and the position along it is the line it came in
   * on. Two numbers swap places.
   *
   * The last leg of a route is aimed at workplaces rather than at nothing in
   * particular, which is what makes the whole thing read as a commute — see
   * `RoadLines.rowWork`.
   */
  private turn(car: Car): void {
    const lines = this.lines[car.district] as RoadLines;
    const alongX = !car.alongX;
    // The junctions along the *new* driving axis, which are the crossing
    // streets of the one the car is turning onto.
    const junctions = alongX ? lines.cols : lines.rows;
    const line = car.to;
    // Where on the new street the car already is: the street it just drove.
    const at = junctions.indexOf(car.line);
    if (at < 0) {
      // The crossing street is not one this district lists, which can only
      // happen if the caches ever disagreed. Start again rather than drive off.
      car.routed = false;
      return;
    }
    const last = car.legsLeft <= 1;
    const weights = last ? (alongX ? lines.colWork : lines.rowWork) : (alongX ? lines.colHomes : lines.rowHomes);
    const to = this.pickWeighted(weights, at, last ? 1 : 4);
    this.setLeg(car, alongX, line, junctions[at] as number, junctions[to] as number);
  }

  /**
   * Gives a car a whole route: a district, a street with houses on it, and two
   * to four legs' worth of turns.
   *
   * Districts are sampled rather than searched: a handful of draws biased
   * toward the camera focus keeps the fleet where it can be seen without
   * sorting anything, and the fallback means a player looking at empty land
   * still gets traffic somewhere rather than none at all.
   */
  private route(car: Car, focusX: number, focusZ: number): void {
    if (car.truck || car.coach) {
      this.routeHighway(car);
      return;
    }
    let chosen = 0;
    for (let i = 0; i < ROUTE_TRIES; i++) {
      chosen = Math.floor(this.random() * this.lines.length);
      const d = this.layout.districts[chosen] as District;
      const dx = d.centreX - focusX;
      const dz = d.centreZ - focusZ;
      if (dx * dx + dz * dz <= VIEW_RADIUS * VIEW_RADIUS) break;
    }
    const lines = this.lines[chosen] as RoadLines;

    car.district = chosen;
    car.legsLeft = ROUTE_LEGS_MIN + Math.floor(this.random() * (ROUTE_LEGS_MAX - ROUTE_LEGS_MIN + 1));
    car.waiting = 0;
    // The first stop is a fraction of the way in, so a line of buses on one
    // street does not pull up in formation.
    car.nextStop = car.bus ? STOP_SPACING * (0.4 + this.random() * 0.6) : Infinity;

    // A district always has at least one of each — line 0 of both axes is a
    // street — but the fallback keeps this honest if that ever stops holding.
    const alongX = lines.rows.length > 0 && (lines.cols.length === 0 || this.random() < 0.5);
    const axis = alongX ? lines.rows : lines.cols;
    const cross = alongX ? lines.cols : lines.rows;
    // The street the commute starts on, leaning toward the one with houses on
    // it. A weighted draw with a floor rather than a hard rule — see
    // `pickWeighted`, and `RoadLines.rowHomes` for why it is zoning rather than
    // buildings that decides.
    const homes = alongX ? lines.rowHomes : lines.colHomes;
    const line = axis[this.pickWeighted(homes, -1, 2)] as number;
    const at = Math.floor(this.random() * cross.length);
    // A one-leg route would finish where a commute finishes, so the first leg
    // is only aimed at work when it is also the last. `cross.map(() => 0)` for
    // the uniform case would be an array a frame, which is exactly what this
    // router is not allowed to do.
    const to =
      car.legsLeft <= 1
        ? this.pickWeighted(alongX ? lines.colWork : lines.rowWork, at, 1)
        : this.pickUniform(cross.length, at);
    this.setLeg(car, alongX, line, cross[at] as number, cross[to] as number);
    // A parked fleet is placed along its streets rather than stacked on the
    // kerb it would have entered from; a moving one always enters at a junction.
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
      this.coaches.count = 0;
      this.lorries.count = 0;
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
    let coaches = 0;
    let trucks = 0;
    let lights = 0;

    for (let i = 0; i < this.active; i++) {
      const car = this.pool[i] as Car;
      if (!car.routed) this.route(car, fx, fz);
      if (this.moving) {
        if (car.waiting > 0) {
          // At a stop. The one thing that makes a bus a bus rather than a long
          // car: it is the only vehicle in the city that ever stands still on
          // a street, which is what reads as a service at this distance.
          car.waiting -= dt;
        } else {
          car.travelled += car.speed * dt;
          if (car.bus && car.travelled >= car.nextStop) {
            car.waiting = STOP_SECONDS;
            car.nextStop += STOP_SPACING;
          }
        }
        if (car.travelled >= car.length) {
          // Arrived at a junction. The overshoot is carried onto the next leg
          // rather than dropped, so a short leg at speed does not cost the car
          // a frame's worth of travel every time it turns.
          const over = car.travelled - car.length;
          car.legsLeft--;
          if (car.legsLeft > 0) {
            this.turn(car);
            if (car.routed) {
              car.travelled = Math.min(over, car.length);
              // Waiting at the lights, and only in traffic worth waiting in.
              // Buses are exempt: they already stop, and a bus that queued as
              // well would be the one vehicle on screen that never moved.
              if (!car.bus && this.random() < this.jam * JUNCTION_WAIT_CHANCE) {
                car.waiting = JUNCTION_WAIT_SECONDS * (0.4 + this.random());
              }
            } else {
              this.route(car, fx, fz);
            }
          } else {
            this.route(car, fx, fz);
          }
        }
      }

      const along = car.from + car.dir * car.travelled;
      const x = car.alongX ? along : car.fixed;
      const z = car.alongX ? car.fixed : along;
      const dx = x - fx;
      const dz = z - fz;
      if (dx * dx + dz * dz > VIEW_RADIUS * VIEW_RADIUS) continue;

      const length = car.bus ? BUS_LENGTH : car.truck ? TRUCK_LENGTH : CAR_LENGTH;
      const height = car.bus ? BUS_HEIGHT : car.truck ? TRUCK_HEIGHT : CAR_HEIGHT;
      dummy.position.set(x, ROAD_H + height / 2, z);
      dummy.rotation.set(0, car.heading, 0);
      dummy.updateMatrix();
      if (car.bus) this.coaches.setMatrixAt(coaches++, dummy.matrix);
      else if (car.truck) this.lorries.setMatrixAt(trucks++, dummy.matrix);
      else this.bodies.setMatrixAt(drawn++, dummy.matrix);

      if (lit) {
        // The nose, in the direction of travel. Same rotation, so the quad
        // faces the way the vehicle is going without a second trig call. All
        // three body types share the lamp mesh — an instance index there
        // answers to nothing but its own count — and they share the height too,
        // because a headlamp is at headlamp height whatever is behind it.
        dummy.position.set(
          car.alongX ? x + car.dir * (length / 2) : x,
          CAR_Y,
          car.alongX ? z : z + car.dir * (length / 2),
        );
        dummy.updateMatrix();
        this.lamps.setMatrixAt(lights++, dummy.matrix);
      }
    }

    this.bodies.count = drawn;
    this.bodies.flush();
    this.coaches.count = coaches;
    this.coaches.flush();
    this.lorries.count = trucks;
    this.lorries.flush();
    if (lit) {
      this.lamps.count = lights;
      this.lamps.flush();
    } else {
      this.lamps.count = 0;
    }
  }
}
