import * as THREE from 'three';
import { mixSeed, rng } from '../core/rng.ts';
import { CELL, MAX_DISTRICTS, SEED } from '../sim/config.ts';
import { congestion, landmarkCoverage, residents } from '../sim/economy.ts';
import {
  DISTRICT_WIDTH,
  linePairAt,
  linePairCapacity,
  worldX,
  worldZ,
  type CityLayout,
  type District,
  type LineKind,
} from '../sim/layout.ts';
import type { GameState } from '../sim/state.ts';
import { BUS_PARTS } from './civicModels.ts';
import { Glow } from './glow.ts';
import { ROAD_H, ROAD_W } from './ground.ts';
import { GrowableInstancedMesh } from './growable.ts';
import { bandLane, spurLane, type Lane } from './highway.ts';
import { mergeColoured, type ModelPart } from './model.ts';
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
 * Not a second fleet and not a second router: a bus is a car with a modelled
 * body and a route that stops. It shares the pool, the lane offsets and the
 * culling, and it is the one vehicle that comes out of `models/` — see
 * `BUS_PARTS`, and `mergeColoured` for why a thing that is rewritten every
 * frame cannot be split into a mesh per material the way a building is.
 *
 * Three meshes rather than the box's one: the body, with every colour on it
 * baked into its vertices; the destination blind; and its own headlights, which
 * are in the model and so replace the shared lamp quad on a bus rather than
 * doubling it. Two of those are lights and could not have been baked.
 *
 * Nothing about a bus reaches `GameState`. They are a readout of `depots` in
 * precisely the way a building is a readout of `homes`.
 */
/** How dim the destination blind sits at noon. It is a display, not paint. */
const BLIND_FLOOR = 0.3;

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
 * the lane offsets, the culling and the headlights. One more instanced mesh and
 * still a box, because nothing about a lorry needs to be told from a bus at
 * this distance except that it is on the highway — a third traffic layer for a
 * dozen vehicles would be a third copy of all of that.
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

/**
 * Trams and trains, out of the same pool a third and fourth time.
 *
 * Two body shapes and two routers, not two fleets. What they share with every
 * vehicle above is the whole discipline: pooled, instanced, culled at
 * VIEW_RADIUS, and not one word of them reaches `GameState` — a tram is a
 * readout of `tramLines` in exactly the way a bus is a readout of `depots`.
 *
 * What separates them is where they run, and it is the same thing that
 * separates the two rungs in the simulation. A tram runs *on a street*, at road
 * height and in the right-hand lane, between two neighbouring districts. A
 * train runs on *its own alignment*, which is drawn: an elevated viaduct at
 * RAIL_Y over whatever is under it, between two districts that need not be
 * neighbours. Putting a train on the ground between district centres would run
 * it through the middle of four blocks, and putting it on the streets would
 * make it a long tram.
 *
 * Both take the route straight from `linePairAt` rather than sampling the map
 * the city router does: a line's two ends are a pure function of its ordinal
 * and the seed, so the view can ask where the k-th line runs and get the same
 * answer the simulation costed it against.
 */
const TRAM_LENGTH = 3.4;
const TRAM_WIDTH = 0.95;
const TRAM_HEIGHT = 0.8;
const TRAIN_LENGTH = 9;
const TRAIN_WIDTH = 1.15;
const TRAIN_HEIGHT = 1.3;

/** How high the viaduct runs, and how thick its deck is. */
const RAIL_Y = 7.2;
const DECK_H = 0.45;
const DECK_W = 2.2;

/**
 * Vehicles per line, and the ceilings.
 *
 * More trams than trains per line, because a tram is the frequent thing and a
 * train is the fast one — the same statement `TransitLine.carries` makes in the
 * simulation, drawn. The ceilings are what keeps this inside the pool: at
 * MAX_DISTRICTS a city can own 44 tram lines and 48 rail ones, and drawing a
 * vehicle for each would be most of MAX_CARS spent on transport.
 */
const TRAMS_PER_LINE = 1.4;
const TRAINS_PER_LINE = 0.8;
const MAX_TRAMS = 14;
const MAX_TRAINS = 10;

/** A tram is slower than a car in traffic and a train is faster than anything. */
const TRAM_SPEED = 5.6;
const TRAIN_SPEED = 14;

/**
 * How much of the city's congestion a tram suffers.
 *
 * Less than a bus's, which is less than a car's: a tram has its own reserved
 * strip down the middle of the street more often than a bus has a bus lane. A
 * train suffers none at all, for the reason a lorry does not — `congestion` is
 * trips against the road cells *inside* the districts, and a viaduct is not one.
 */
const TRAM_CONGESTION_SHARE = 0.3;
const TRAM_CRAWL = TRAM_SPEED * 0.6;

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
  /**
   * True for a tram, and for a train.
   *
   * Two flags rather than one with a kind, because they are read in the hot
   * loop and a branch on a boolean is what every other body type here costs.
   * `line` is reused to hold which line of that kind the vehicle is working,
   * and `at` to hold which leg of its L it is on — see `routeLine`.
   */
  tram: boolean;
  train: boolean;
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
  /** A bus's body: the model, less its two lit parts, in one geometry. */
  private readonly coaches: GrowableInstancedMesh;
  /** Its destination blind, and its headlights. Written with the body. */
  private readonly blinds: GrowableInstancedMesh;
  private readonly busLamps: GrowableInstancedMesh;
  private readonly blind = new Glow(PALETTE.sodium, BLIND_FLOOR);
  /** The one extra mesh lorries cost. Same pool, same lanes, a longer box. */
  private readonly lorries: GrowableInstancedMesh;
  /** Two more: a tram on a street, a train on the viaduct above it. */
  private readonly tramCars: GrowableInstancedMesh;
  private readonly trainCars: GrowableInstancedMesh;
  /**
   * The viaduct itself, which is the one piece of *static* geometry this file
   * draws: a deck per leg of every rail line, written in `sync` and left alone
   * until the line count or the district count moves. A unit box scaled per
   * instance, so a leg of any length is one matrix.
   */
  private readonly decks: GrowableInstancedMesh;
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
  /** How many are trams, and how many trains. Behind the coaches, before the lorries. */
  private tramCount = 0;
  private trainCount = 0;
  /** Lines the city owns, read in `sync` and held. A readout, like `jam`. */
  private tramLines = 0;
  private railLines = 0;
  /** What the network looked like last sync, so the decks are rebuilt only when it moves. */
  private deckRails = -1;
  private deckDistricts = -1;
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
    private moving: boolean,
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
    // The body is every part of the model that is not a light, welded into one
    // geometry that carries its own colours. One mesh, so a bus still costs one
    // matrix write a frame — see `mergeColoured`.
    const lit = (part: ModelPart): boolean =>
      part.mtl === 'destination-blind' || part.mtl === 'headlight';
    this.coaches = new GrowableInstancedMesh(
      scene,
      mergeColoured(BUS_PARTS.filter((part) => !lit(part))),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      MAX_CARS,
      { castShadow: true, name: 'traffic:bus' },
    );
    this.blinds = new GrowableInstancedMesh(
      scene,
      mergeColoured(BUS_PARTS.filter((part) => part.mtl === 'destination-blind')),
      this.blind.material,
      MAX_CARS,
      { name: 'traffic:bus:blind' },
    );
    // On the shared headlight glow, so a bus lights up with the traffic around
    // it rather than on a ramp of its own.
    this.busLamps = new GrowableInstancedMesh(
      scene,
      mergeColoured(BUS_PARTS.filter((part) => part.mtl === 'headlight')),
      this.headlights.material,
      MAX_CARS,
      { name: 'traffic:bus:lamps' },
    );
    this.lorries = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(TRUCK_LENGTH, TRUCK_HEIGHT, TRUCK_WIDTH),
      new THREE.MeshLambertMaterial({ color: PALETTE.industryRoof }),
      MAX_CARS,
      { castShadow: true, name: 'traffic:truck' },
    );
    this.tramCars = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(TRAM_LENGTH, TRAM_HEIGHT, TRAM_WIDTH),
      new THREE.MeshLambertMaterial({ color: PALETTE.tram }),
      MAX_TRAMS,
      { castShadow: true, name: 'traffic:tram' },
    );
    this.trainCars = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(TRAIN_LENGTH, TRAIN_HEIGHT, TRAIN_WIDTH),
      new THREE.MeshLambertMaterial({ color: PALETTE.train }),
      MAX_TRAINS,
      { castShadow: true, name: 'traffic:train' },
    );
    // A unit box, scaled per instance: a deck is a length and a place, and the
    // matrix carries both. Capacity is two legs a line, which is the most an L
    // can have, at MAX_DISTRICTS lines.
    this.decks = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, DECK_H, DECK_W),
      new THREE.MeshLambertMaterial({ color: PALETTE.viaduct }),
      2 * MAX_DISTRICTS,
      { castShadow: true, receiveShadow: true, name: 'traffic:viaduct' },
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
        tram: false,
        train: false,
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
    this.tramLines = Math.min(state.tramLines, linePairCapacity('tram', state.districts));
    this.railLines = Math.min(state.railLines, linePairCapacity('rail', state.districts));
    const freight = Cars.freight(state);
    const trams = Cars.tramFleet(state);
    const trains = Cars.trainFleet(state);
    // The fleet has to make room for the services rather than crowd them out:
    // a city whose population would only justify eight cars still runs whatever
    // buses, lorries, trams and trains it has paid for.
    this.active = Math.min(
      MAX_CARS,
      this.lines.length > 0
        ? Math.max(
            Cars.fleet(state),
            Cars.coaches(state) + Cars.coachFleet(state) + freight + trams + trains,
          )
        : 0,
    );
    const buses = Math.min(Cars.coaches(state), this.active);
    const trucks = Math.min(freight, this.active - buses);
    // Coaches sit directly behind the buses: they draw with the bus mesh, so
    // keeping them adjacent keeps that mesh's instances contiguous in the pool
    // and costs the culling nothing.
    const coaches = Math.min(Cars.coachFleet(state), Math.max(0, this.active - buses - trucks));
    // Then the network, in the band between the coaches and the lorries. Each
    // has a mesh of its own, so contiguity buys nothing here — what the band
    // does buy is that a fleet shrinking with the population loses *cars* from
    // the middle and keeps every service the player paid for running.
    const tramFrom = buses + coaches;
    const tramCount = Math.min(trams, Math.max(0, this.active - tramFrom - trucks));
    const trainFrom = tramFrom + tramCount;
    const trainCount = Math.min(trains, Math.max(0, this.active - trainFrom - trucks));
    if (
      buses !== this.buses ||
      trucks !== this.trucks ||
      coaches !== this.coachCount ||
      tramCount !== this.tramCount ||
      trainCount !== this.trainCount
    ) {
      for (let i = 0; i < MAX_CARS; i++) {
        const car = this.pool[i] as Car;
        const coach = i >= buses && i < buses + coaches;
        const bus = i < buses || coach;
        const tram = i >= tramFrom && i < tramFrom + tramCount;
        const train = i >= trainFrom && i < trainFrom + trainCount;
        const truck = i >= this.active - trucks && i < this.active && !bus && !tram && !train;
        if (
          car.bus === bus &&
          car.truck === truck &&
          car.coach === coach &&
          car.tram === tram &&
          car.train === train
        ) {
          continue;
        }
        car.bus = bus;
        car.truck = truck;
        car.coach = coach;
        car.tram = tram;
        car.train = train;
        // Which line this one works, and which way round it runs it. Spread
        // over the lines rather than drawn, so two trams on one line is what a
        // city with one line looks like and never what a city with six does.
        car.district = i;
        car.at = 0;
        car.to = i % 2 === 0 ? 1 : -1;
        // Re-routed rather than left mid-run: a car that became a bus would
        // otherwise finish its run at the wrong speed and stop nowhere, and one
        // that became a lorry would finish it on the wrong road entirely.
        car.routed = false;
      }
      this.buses = buses;
      this.trucks = trucks;
      this.coachCount = coaches;
      this.tramCount = tramCount;
      this.trainCount = trainCount;
    }
    // A line the city just bought is a line the vehicles on the older ones
    // should be able to move to, and a district annexed moves nothing already
    // laid — but the *pairs* a later line takes only exist once the land does.
    if (this.railLines !== this.deckRails || state.districts !== this.deckDistricts) {
      for (let i = 0; i < MAX_CARS; i++) {
        const car = this.pool[i] as Car;
        if (car.tram || car.train) car.routed = false;
      }
      this.buildDecks();
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
   * Lays the viaduct: one deck per leg of every rail line the city owns.
   *
   * The one piece of static geometry in this file, and it is here rather than
   * in `ground.ts` for the reason the highway's spur is where it is: the thing
   * that decides where it runs is the same `linePairAt` the trains on it are
   * routed by, and two files working that out separately would eventually be a
   * train beside its own track.
   *
   * Written on a change to the rail count or the district count and left alone
   * otherwise. A tram gets no deck: it runs on a street the city already has,
   * which is exactly what makes it the cheap rung.
   */
  private buildDecks(): void {
    this.deckRails = this.railLines;
    this.deckDistricts = this.districts;
    const dummy = this.dummy;
    let n = 0;
    for (let k = 0; k < this.railLines; k++) {
      const pair = linePairAt('rail', k, this.districts);
      if (pair === null) break;
      if (pair.a >= this.layout.districts.length || pair.b >= this.layout.districts.length) break;
      const a = this.layout.districts[pair.a] as District;
      const b = this.layout.districts[pair.b] as District;
      // The same L the trains run, so the deck is under them by construction.
      // Legs of zero length are the tram's case and are skipped here too.
      const legs: [number, number, number, number][] = [
        [a.centreX, a.centreZ, b.centreX, a.centreZ],
        [b.centreX, a.centreZ, b.centreX, b.centreZ],
      ];
      for (const [x0, z0, x1, z1] of legs) {
        const dx = x1 - x0;
        const dz = z1 - z0;
        const length = Math.abs(dx) + Math.abs(dz);
        if (length <= 0) continue;
        dummy.position.set((x0 + x1) / 2, RAIL_Y - DECK_H, (z0 + z1) / 2);
        dummy.rotation.set(0, dx !== 0 ? 0 : Math.PI / 2, 0);
        dummy.scale.set(length, 1, 1);
        dummy.updateMatrix();
        this.decks.setMatrixAt(n++, dummy.matrix);
      }
    }
    // The scale is per instance and every other write in this file is not, so
    // it has to go back or the next vehicle drawn is a hundred metres long.
    dummy.scale.set(1, 1, 1);
    this.decks.count = n;
    this.decks.flush();
  }

  /**
   * How many trams and trains the network has earned.
   *
   * Lines, not districts: a vehicle on screen is a vehicle the player bought,
   * which is the same rule `coaches` follows for the depots and `freight` for
   * the estates. Clamped, because a full map holds far more lines than the pool
   * holds slots — see MAX_TRAMS.
   */
  private static tramFleet(state: Readonly<GameState>): number {
    const lines = Math.min(state.tramLines, linePairCapacity('tram', state.districts));
    return Math.min(MAX_TRAMS, Math.round(lines * TRAMS_PER_LINE));
  }

  private static trainFleet(state: Readonly<GameState>): number {
    const lines = Math.min(state.railLines, linePairCapacity('rail', state.districts));
    return Math.min(MAX_TRAINS, Math.round(lines * TRAINS_PER_LINE));
  }

  /**
   * Puts a tram or a train on one leg of one line.
   *
   * The route is an L between the two district centres `linePairAt` names —
   * along x, then along z — and both legs are axis-aligned, which is what lets
   * a line reuse the same `Car` a street does. A diagonal run would have meant
   * a direction vector on every vehicle in the pool and a second form of the
   * hot loop, for two body types out of six.
   *
   * A tram's two districts are neighbours, so one of its legs is always zero
   * long and it runs straight; a train's need not be, so it turns once. Zero
   * legs are skipped rather than drawn, which is the whole of the difference.
   *
   * Nothing is sampled. `linePairAt` is the same pure function of the ordinal,
   * the district count and the seed that the simulation costed the line
   * against, so the view and the ledger cannot disagree about where a line is.
   */
  private routeLine(car: Car): void {
    const kind: LineKind = car.train ? 'rail' : 'tram';
    const owned =
      kind === 'rail' ? this.railLines : this.tramLines;
    if (owned <= 0) {
      // Nothing to run on. Park it off the pool's working set rather than
      // leaving it unrouted, which would re-enter this every frame.
      car.routed = true;
      car.length = 0;
      car.travelled = 0;
      car.from = 0;
      car.fixed = 0;
      return;
    }
    const which = car.district % owned;
    const pair = linePairAt(kind, which, this.districts);
    if (pair === null || pair.a >= this.layout.districts.length || pair.b >= this.layout.districts.length) {
      car.routed = true;
      car.length = 0;
      return;
    }
    const a = this.layout.districts[pair.a] as District;
    const b = this.layout.districts[pair.b] as District;
    // Which end it started from, so two vehicles on one line pass each other.
    const back = car.to < 0;
    const fromX = back ? b.centreX : a.centreX;
    const fromZ = back ? b.centreZ : a.centreZ;
    const toX = back ? a.centreX : b.centreX;
    const toZ = back ? a.centreZ : b.centreZ;
    // Leg 0 runs along x at the starting z; leg 1 along z at the ending x.
    const alongX = car.at === 0;
    const start = alongX ? fromX : fromZ;
    const end = alongX ? toX : toZ;
    if (start === end) {
      // A zero leg. Take the other one rather than drawing a vehicle standing
      // on a junction — a tram's route is one leg by construction.
      if (car.at === 0) {
        car.at = 1;
        this.routeLine(car);
        return;
      }
      this.retireLine(car);
      return;
    }
    const dir = end > start ? 1 : -1;
    car.alongX = alongX;
    car.dir = dir;
    car.from = start;
    car.length = Math.abs(end - start);
    // A tram is on a street and takes the right-hand lane with everything else;
    // a train is on its own deck and runs down the middle of it.
    const line = alongX ? fromZ : toX;
    car.fixed = car.train ? line : alongX ? line + dir * LANE : line - dir * LANE;
    car.heading =
      alongX ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    car.speed = this.speedFor(car);
    car.waiting = 0;
    // A tram calls at stops like a bus; a train runs between two districts and
    // does not stop in between, which is most of what makes it read as a train.
    car.nextStop = car.tram ? STOP_SPACING * (0.4 + this.random() * 0.6) : Infinity;
    car.legsLeft = 1;
    car.travelled = this.moving ? 0 : this.random() * car.length;
    car.routed = true;
  }

  /** End of a leg: take the other one, or turn round and run the line back. */
  private retireLine(car: Car): void {
    if (car.at === 0) {
      car.at = 1;
    } else {
      car.at = 0;
      car.to = -car.to;
    }
    car.routed = false;
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
    // A train is the third: it runs on a viaduct, which is not a road cell in
    // any district, so nothing `congestion` measures reaches it.
    if (car.train) return TRAIN_SPEED * (1 - SPEED_JITTER * this.random() * 0.5);
    const share =
      car.tram ? TRAM_CONGESTION_SHARE
      : car.bus ? BUS_CONGESTION_SHARE
      : 1;
    const jam = Math.max(0, Math.min(1, this.jam * share));
    const free = car.tram ? TRAM_SPEED : car.bus ? BUS_SPEED : SPEED_MAX;
    const crawl = car.tram ? TRAM_CRAWL : car.bus ? BUS_CRAWL : CAR_CRAWL;
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
    if (car.tram || car.train) {
      this.routeLine(car);
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
      this.blinds.count = 0;
      this.busLamps.count = 0;
      this.lorries.count = 0;
      this.tramCars.count = 0;
      this.trainCars.count = 0;
      this.lamps.count = 0;
      return;
    }

    this.headlights.setNight(night);
    this.blind.setNight(night);
    const lit = night > HEADLIGHT_NIGHT;
    this.lamps.mesh.visible = lit;
    this.busLamps.mesh.visible = lit;

    const dummy = this.dummy;
    const fx = focus.x;
    const fz = focus.z;
    let drawn = 0;
    let coaches = 0;
    let trucks = 0;
    let trams = 0;
    let trains = 0;
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
          if ((car.bus || car.tram) && car.travelled >= car.nextStop) {
            car.waiting = STOP_SECONDS;
            car.nextStop += STOP_SPACING;
          }
        }
        if (car.travelled >= car.length) {
          // The end of a line's leg is the other leg, or the same line run back
          // the other way. It never turns onto a street: a tram is on its own
          // route and a train is on its own deck, and neither has a junction to
          // take. See `retireLine`.
          if (car.tram || car.train) {
            this.retireLine(car);
            this.route(car, fx, fz);
            continue;
          }
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

      const length =
        car.truck ? TRUCK_LENGTH
        : car.train ? TRAIN_LENGTH
        : car.tram ? TRAM_LENGTH
        : CAR_LENGTH;
      const height =
        car.truck ? TRUCK_HEIGHT
        : car.train ? TRAIN_HEIGHT
        : car.tram ? TRAM_HEIGHT
        : CAR_HEIGHT;
      // A box is centred on its own middle and the model stands on the road, so
      // the two sit at different heights for the same vehicle on the same road.
      // A train sits on the deck rather than on the ground.
      const base = car.train ? RAIL_Y : ROAD_H;
      dummy.position.set(x, car.bus ? ROAD_H : base + height / 2, z);
      dummy.rotation.set(0, car.heading, 0);
      dummy.updateMatrix();
      if (car.train) this.trainCars.setMatrixAt(trains++, dummy.matrix);
      else if (car.tram) this.tramCars.setMatrixAt(trams++, dummy.matrix);
      else if (car.bus) {
        // One transform, three meshes, and the same index in each: the blind
        // and the lamps are parts of this bus and never move relative to it.
        this.coaches.setMatrixAt(coaches, dummy.matrix);
        this.blinds.setMatrixAt(coaches, dummy.matrix);
        if (lit) this.busLamps.setMatrixAt(coaches, dummy.matrix);
        coaches++;
      } else if (car.truck) this.lorries.setMatrixAt(trucks++, dummy.matrix);
      else this.bodies.setMatrixAt(drawn++, dummy.matrix);

      // A bus brings its own headlights, so it is the one vehicle that does not
      // take a quad off the shared lamp mesh. Nor does a train: a headlamp at
      // RAIL_Y would be a light with nothing under it, and the deck already
      // reads at night because it catches the key.
      if (lit && !car.bus && !car.train) {
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
    this.blinds.count = coaches;
    this.blinds.flush();
    this.busLamps.count = lit ? coaches : 0;
    if (lit) this.busLamps.flush();
    this.lorries.count = trucks;
    this.lorries.flush();
    this.tramCars.count = trams;
    this.tramCars.flush();
    this.trainCars.count = trains;
    this.trainCars.flush();
    if (lit) {
      this.lamps.count = lights;
      this.lamps.flush();
    } else {
      this.lamps.count = 0;
    }
  }
}
