import * as THREE from 'three';
import { CELL, CIVIC_SERVICES, LEVELS, MAX_ACTIVE_FIRES } from '../sim/config.ts';

/** Where fire stations sit in the 2x2 site interleave. See `civicSiteFor`. */
const FIRE_SITE_OFFSET = CIVIC_SERVICES.findIndex((service) => service.key === 'fire');
import { ZONE } from '../sim/citygen.ts';
import { levelAt } from '../sim/economy.ts';
import {
  createPlacement,
  worldX,
  worldZ,
  type CityLayout,
  type Placement,
} from '../sim/layout.ts';
import type { Fire, GameState } from '../sim/state.ts';
import { roofline } from './buildings.ts';
import { Glow } from './glow.ts';
import { ROAD_H } from './ground.ts';
import { GrowableInstancedMesh } from './growable.ts';
import { PALETTE } from './palette.ts';

/**
 * Flames, and the trucks that answer them.
 *
 * Read-only over `state.fires`, which is where the fire actually lives. The
 * simulation decides what is burning, for how long and whether it survives;
 * this layer decides what that looks like, and could be deleted mid-fire
 * without the city noticing. A truck in particular is pure consequence — it
 * carries no water, changes no timer, and exists to make the coverage number
 * on the happiness panel into something you can watch arrive.
 */

/** Flame body, standing on the roofline. */
const FLAME_W = 1.15;
const FLAME_H = 1.7;

/** The glow at the roofline: wide, flat and dim, so it reads from far off. */
const GLOW_W = CELL * 0.92;

/** Flicker, in Hz and as a share of the flame's height. */
const FLICKER_HZ = 2.6;
const FLICKER_DEPTH = 0.22;

const TRUCK_LENGTH = 2.4;
const TRUCK_WIDTH = 1.0;
const TRUCK_HEIGHT = 0.9;
const TRUCK_SPEED = 12;
/** Where a truck stops: at the plot's kerb rather than inside the building. */
const PARK_OFFSET = CELL * 0.55;

/** The bay doors face +z, so that is the side a truck rolls out of. */
const STATION_APRON = CELL;

interface Blaze {
  /** The fire this slot is drawing, so a change can be spotted without a key. */
  kind: string;
  index: number;
  startedAt: number;
  /** World position of the burning plot. */
  x: number;
  z: number;
  /** Top of the building underneath, so the flame sits on it. */
  top: number;
  /** Stable per-fire offset, so six fires do not flicker in unison. */
  offset: number;
}

interface Truck {
  /** Journey ends. A truck only ever runs between a station and a fire. */
  ax: number;
  az: number;
  bx: number;
  bz: number;
  total: number;
  travelled: number;
  homebound: boolean;
  /** False once the truck is back in the station and has nothing to do. */
  active: boolean;
  x: number;
  z: number;
  heading: number;
}

export class Fires {
  private readonly flames: GrowableInstancedMesh;
  private readonly glows: GrowableInstancedMesh;
  private readonly trucks: GrowableInstancedMesh;
  private readonly beacons: GrowableInstancedMesh;
  /**
   * Fire is a light source in its own right, so it ramps the *other* way from
   * the city's lamps: bright enough to see in daylight, and at 3am the only
   * thing in the district you can see. Floors chosen so the flame never goes
   * dull and the roofline wash is a hint by day and a beacon at night.
   */
  private readonly flameGlow = new Glow(PALETTE.flame, 0.72);
  private readonly haloGlow = new Glow(PALETTE.flameGlow, 0.22);
  private readonly dummy = new THREE.Object3D();
  private readonly blazes: Blaze[] = [];
  private readonly fleet: Truck[] = [];
  /** One reusable placement, filled in place. See `Buildings`. */
  private readonly at = createPlacement();
  private burning = 0;
  /**
   * What the rooflines were last computed against.
   *
   * The cohort's total level count — sum of level x buildings — which moves by
   * exactly one on any single promotion or abandonment and by nothing else.
   * Cheaper than comparing four numbers and enough to notice by, because a
   * roofline can only change when a building's level does.
   */
  private shownSkyline = -1;

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
    /** Reduced motion holds the flame steady and puts the truck straight there. */
    private readonly moving: boolean,
  ) {
    this.flames = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(FLAME_W, FLAME_H, FLAME_W),
      this.flameGlow.material,
      MAX_ACTIVE_FIRES,
    );
    this.glows = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(GLOW_W, 0.08, GLOW_W),
      this.haloGlow.material,
      MAX_ACTIVE_FIRES,
    );
    this.trucks = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(TRUCK_LENGTH, TRUCK_HEIGHT, TRUCK_WIDTH),
      new THREE.MeshLambertMaterial({ color: PALETTE.fireRoof }),
      MAX_ACTIVE_FIRES,
      { castShadow: true },
    );
    // A light bar is on in daylight too, so it is a plain unlit material rather
    // than something that ramps with the sky.
    this.beacons = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(0.9, 0.18, TRUCK_WIDTH * 0.6),
      new THREE.MeshBasicMaterial({ color: PALETTE.flame }),
      MAX_ACTIVE_FIRES,
    );

    for (let i = 0; i < MAX_ACTIVE_FIRES; i++) {
      this.blazes.push({ kind: '', index: -1, startedAt: -1, x: 0, z: 0, top: 0, offset: i * 1.37 });
      this.fleet.push({
        ax: 0,
        az: 0,
        bx: 0,
        bz: 0,
        total: 0,
        travelled: 0,
        homebound: false,
        active: false,
        x: 0,
        z: 0,
        heading: 0,
      });
    }
  }

  /**
   * Centre of the building an ordinal names, whatever kind it is.
   *
   * The parcel's centre, not a plot's: a merged building spans two plots and a
   * flame on one of them would be burning half a tower.
   */
  private placeOf(fire: Fire, state: Readonly<GameState>): Placement {
    if (fire.kind === 'shop') {
      return this.layout.place(ZONE.commercial, fire.index, state.mergedC, state, this.at);
    }
    if (fire.kind === 'industry') {
      return this.layout.place(ZONE.industrial, fire.index, state.mergedI, state, this.at);
    }
    return this.layout.place(ZONE.residential, fire.index, state.mergedR, state, this.at);
  }

  /**
   * The station that answers a fire: the nearest one the city has actually
   * built. With none built no truck rolls, and the fire simply takes
   * EXTINGUISH_MAX — which is the lesson, and it is the simulation's to teach,
   * not this layer's.
   */
  private nearestStation(built: number, x: number, z: number, truck: Truck): boolean {
    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < built; i++) {
      const site = this.layout.civicSiteFor(FIRE_SITE_OFFSET, i);
      // The site's lower-left plot; the building straddles all four.
      const sx = worldX(site.x) + CELL / 2;
      const sz = worldZ(site.z) + CELL / 2 + STATION_APRON;
      const d = Math.abs(sx - x) + Math.abs(sz - z);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    if (best < 0) return false;
    const site = this.layout.civicSiteFor(FIRE_SITE_OFFSET, best);
    truck.ax = worldX(site.x) + CELL / 2;
    truck.az = worldZ(site.z) + CELL / 2 + STATION_APRON;
    return true;
  }

  private static leg(truck: Truck): void {
    truck.total = Math.abs(truck.bx - truck.ax) + Math.abs(truck.bz - truck.az);
    truck.travelled = 0;
  }

  /**
   * Reconciles flames and trucks against the simulation's fire list.
   *
   * Slot-for-slot: `state.fires` is compacted in place by the simulation and
   * capped at MAX_ACTIVE_FIRES, so slot i is a stable handle, and comparing the
   * three fields of a fire against what the slot last drew catches the case
   * where one fire replaces another in the same slot between two frames.
   * Comparing fields rather than building a key string is what keeps this — the
   * one method here that runs on every frame of a city that is not on fire —
   * free of per-frame allocation.
   */
  sync(state: Readonly<GameState>): void {
    const fires = state.fires;
    // A promotion rebuilds the roofline underneath a flame without the fire
    // itself changing, so the slots have to be invalidated when the housing
    // cohort moves. The top cohort is enough to notice by: a building can only
    // climb, so if nothing reached a new level nothing under a flame grew.
    let skyline = 0;
    for (let l = 1; l < LEVELS; l++) skyline += l * (state.homeLevels[l] ?? 0);
    const grown = skyline !== this.shownSkyline;
    this.shownSkyline = skyline;
    this.burning = Math.min(fires.length, MAX_ACTIVE_FIRES);

    for (let i = 0; i < MAX_ACTIVE_FIRES; i++) {
      const truck = this.fleet[i] as Truck;
      const blaze = this.blazes[i] as Blaze;
      const fire = i < this.burning ? (fires[i] as Fire) : undefined;

      if (fire === undefined) {
        // Nothing here any more. A truck that was out drives back from wherever
        // it had got to rather than teleporting into its bay.
        if (blaze.index >= 0 && truck.active && !truck.homebound) {
          truck.bx = truck.ax;
          truck.bz = truck.az;
          truck.ax = truck.x;
          truck.az = truck.z;
          truck.homebound = true;
          Fires.leg(truck);
        }
        blaze.kind = '';
        blaze.index = -1;
        blaze.startedAt = -1;
        continue;
      }

      const same =
        blaze.kind === fire.kind &&
        blaze.index === fire.index &&
        blaze.startedAt === fire.startedAt;
      if (same && !grown) continue;

      this.layout.ensure(state);
      const at = this.placeOf(fire, state);
      blaze.x = at.x;
      blaze.z = at.z;
      blaze.top = roofline(fire.kind, fire.index, levelAt(state.homeLevels, fire.index));
      if (same) continue;
      blaze.kind = fire.kind;
      blaze.index = fire.index;
      blaze.startedAt = fire.startedAt;

      const targetX = blaze.x - PARK_OFFSET;
      const targetZ = blaze.z;
      if (state.fire <= 0) {
        // No station, no truck. The fire still burns; it just burns alone.
        truck.active = false;
        continue;
      }
      // A truck already out re-routes from where it is; a fresh one rolls from
      // the nearest station's apron.
      if (!truck.active && !this.nearestStation(state.fire, targetX, targetZ, truck)) {
        truck.active = false;
        continue;
      }
      if (truck.active) {
        truck.ax = truck.x;
        truck.az = truck.z;
      }
      truck.bx = targetX;
      truck.bz = targetZ;
      truck.homebound = false;
      truck.active = true;
      Fires.leg(truck);
      if (!this.moving) truck.travelled = truck.total;
    }
  }

  /**
   * Walks a truck along its leg and leaves it at `truck.x/z`.
   *
   * Two straight runs, x then z, rather than a diagonal: there is no lane graph
   * here any more than there is for the cars, and a vehicle that moves along
   * the axes reads as one following streets while a diagonal reads as one
   * driving through the houses.
   */
  private static place(truck: Truck): void {
    const dx = truck.bx - truck.ax;
    const dz = truck.bz - truck.az;
    const run = Math.abs(dx);
    if (truck.travelled <= run) {
      truck.x = truck.ax + Math.sign(dx) * truck.travelled;
      truck.z = truck.az;
      truck.heading = dx >= 0 ? 0 : Math.PI;
      if (run === 0) truck.heading = dz >= 0 ? -Math.PI / 2 : Math.PI / 2;
      return;
    }
    truck.x = truck.bx;
    truck.z = truck.az + Math.sign(dz) * Math.min(Math.abs(dz), truck.travelled - run);
    truck.heading = dz >= 0 ? -Math.PI / 2 : Math.PI / 2;
  }

  /** Advances the flicker and the fleet, and writes both. Allocates nothing. */
  update(dt: number, elapsed: number, night: number): void {
    this.flameGlow.setNight(night);
    this.haloGlow.setNight(night);

    const dummy = this.dummy;
    for (let i = 0; i < this.burning; i++) {
      const blaze = this.blazes[i] as Blaze;
      // One sine per fire, offset so six roofs do not pulse together. Six
      // instances, so the cost of doing this per frame is not measurable.
      const flicker = this.moving
        ? 1 + FLICKER_DEPTH * Math.sin(elapsed * FLICKER_HZ + blaze.offset)
        : 1;
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(blaze.x, blaze.top + (FLAME_H / 2) * flicker, blaze.z);
      dummy.scale.set(1, flicker, 1);
      dummy.updateMatrix();
      this.flames.setMatrixAt(i, dummy.matrix);

      dummy.position.set(blaze.x, blaze.top + 0.05, blaze.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.glows.setMatrixAt(i, dummy.matrix);
    }
    this.flames.count = this.burning;
    this.glows.count = this.burning;
    this.flames.flush();
    this.glows.flush();

    let rolling = 0;
    for (let i = 0; i < MAX_ACTIVE_FIRES; i++) {
      const truck = this.fleet[i] as Truck;
      if (!truck.active) continue;
      if (this.moving && truck.travelled < truck.total) {
        truck.travelled = Math.min(truck.total, truck.travelled + TRUCK_SPEED * dt);
      }
      Fires.place(truck);
      // Home again with nothing to answer: back in the bay, off the road.
      if (truck.homebound && truck.travelled >= truck.total) {
        truck.active = false;
        continue;
      }

      dummy.position.set(truck.x, ROAD_H + TRUCK_HEIGHT / 2, truck.z);
      dummy.rotation.set(0, truck.heading, 0);
      dummy.updateMatrix();
      this.trucks.setMatrixAt(rolling, dummy.matrix);

      dummy.position.y = ROAD_H + TRUCK_HEIGHT + 0.09;
      dummy.updateMatrix();
      this.beacons.setMatrixAt(rolling, dummy.matrix);
      rolling++;
    }
    this.trucks.count = rolling;
    this.beacons.count = rolling;
    this.trucks.flush();
    this.beacons.flush();
  }
}
