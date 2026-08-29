import * as THREE from 'three';
import { CELL, CIVIC_SERVICES, LEVELS, MAX_ACTIVE_FIRES } from '../sim/config.ts';

/** Where fire stations sit in the 2x2 site interleave. See `civicSiteFor`. */
const FIRE_SITE_OFFSET = CIVIC_SERVICES.findIndex((service) => service.key === 'fire');
import { ZONE } from '../sim/citygen.ts';
import { countOf, levelAt, levelsOf, mergedOf, ZONE_KINDS } from '../sim/economy.ts';
import {
  createPlacement,
  worldX,
  worldZ,
  type CityLayout,
  type Placement,
} from '../sim/layout.ts';
import type { Fire, GameState, ZoneKind } from '../sim/state.ts';
import { bodyFootprint, roofline } from './buildings.ts';
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
  /**
   * How wide and deep the building underneath actually stands.
   *
   * Not used by the flame, which is a fixed-width column — kept because it is
   * the only record of the *shape* of a building a fire is about to destroy,
   * and the collapse animation has to be the size of what fell. Refreshed
   * wherever `top` is, and for the same reason.
   */
  width: number;
  depth: number;
  /** Stable per-fire offset, so six fires do not flicker in unison. */
  offset: number;
}

/**
 * A building a fire has just destroyed, and where it was standing.
 *
 * A position rather than a slot, and captured rather than looked up, because by
 * the time anything draws this the building is gone from the simulation and its
 * slot means a different building — or nothing at all. See `Collapse`.
 */
export interface Loss {
  readonly kind: ZoneKind;
  /** The slot the flames were on. Still valid this frame; not for long. */
  readonly slot: number;
  readonly x: number;
  readonly z: number;
  /** Top of what was standing there, from `roofline`. */
  readonly top: number;
  /** And how wide and deep, from `bodyFootprint`. */
  readonly width: number;
  readonly depth: number;
}

/** Returned when nothing was lost, so the common path allocates nothing. */
const EMPTY_LOSSES: readonly Loss[] = [];

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
  /**
   * What each zone last held, so a loss can be told from a merge.
   *
   * Three pairs of integers, and they are what makes the demolition animation
   * possible without the simulation recording anything. Both a merge and a
   * fatal fire take one off a zone's count; what separates them is that a merge
   * raises `merged` by one and a loss does not, so
   * `(count fallen) - (merged risen)` is the number of buildings that were
   * *destroyed* between two syncs. See `losses`.
   */
  private readonly shownCount: Record<ZoneKind, number> = { home: -1, shop: -1, industry: -1 };
  private readonly shownMerged: Record<ZoneKind, number> = { home: -1, shop: -1, industry: -1 };
  /**
   * Buildings destroyed since the last drain, with where they stood.
   *
   * Filled by `sync` and taken by the view, which owns the collapse animation.
   * Captured here because this is the layer that knows *which plot* — the fire
   * list is the only record of it and the simulation drops it the moment the
   * fire ends.
   */
  private readonly lost: Loss[] = [];

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
    /** Reduced motion holds the flame steady and puts the truck straight there. */
    private moving: boolean,
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
      this.blazes.push({
        kind: '',
        index: -1,
        startedAt: -1,
        x: 0,
        z: 0,
        top: 0,
        width: 0,
        depth: 0,
        offset: i * 1.37,
      });
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
   * Notices buildings the fire destroyed, and where they were standing.
   *
   * This is the one place in the renderer that has to *infer* something the
   * simulation did rather than read it, and it is worth being precise about
   * what the inference is and where it can be wrong.
   *
   * What is read: a zone's count and its merged-parcel count, against what they
   * were at the last sync, and the fire list against the one this layer already
   * mirrors slot for slot. Three things take a building off a zone's count and
   * they are separable:
   *
   *   - a **merge** takes one off the count and puts one on `merged`;
   *   - a **fatal fire** takes one off the count and leaves `merged` alone;
   *   - an **abandonment** takes nothing off the count at all — a ruin keeps
   *     its plot and its slot, which is what `abandonedR` is for.
   *
   * So `(count fallen) - (merged risen)` is exactly the number of buildings
   * destroyed, and the fires that vanished from the list this sync are which
   * ones. `resolveFires` decides `wouldBurnOut` once for the whole tick, so
   * when several end together they were all fatal or none were, and pairing
   * them in list order is not a guess.
   *
   * Where it is wrong: `demolish` clamps `merged` down when the zone has no
   * unmerged building left to lose, which happens only in a zone whose every
   * standing building is a merged tower. There the loss is undercounted by one
   * and the collapse simply does not play. A missing animation on a
   * fully-merged zone is the right way for this to fail.
   *
   * Nothing here is stored, read back or told to the simulation. Delete the
   * whole method and the city is identical.
   */
  private recordLosses(state: Readonly<GameState>): void {
    for (const kind of ZONE_KINDS) {
      const count = countOf(state, kind);
      const merged = mergedOf(state, kind);
      const wasCount = this.shownCount[kind];
      const wasMerged = this.shownMerged[kind];
      this.shownCount[kind] = count;
      this.shownMerged[kind] = merged;
      // The first sync of a session, and a `reset` or an ascension, both arrive
      // as an enormous drop. Neither is a fire.
      if (wasCount < 0 || wasMerged < 0) continue;
      let losses = wasCount - count - (merged - wasMerged);
      if (losses <= 0) continue;
      for (const blaze of this.blazes) {
        if (losses <= 0) break;
        if (blaze.kind !== kind || blaze.index < 0) continue;
        // Still in the list means it is still burning, so it is not this.
        if (state.fires.some((fire) => fire.kind === kind && fire.index === blaze.index)) continue;
        losses--;
        this.lost.push({
          kind,
          slot: blaze.index,
          x: blaze.x,
          z: blaze.z,
          top: blaze.top,
          width: blaze.width,
          depth: blaze.depth,
        });
      }
    }
  }

  /**
   * Takes what was destroyed since the last call.
   *
   * Drained rather than read, so a frame that does nothing with it cannot make
   * the same building fall down twice. Bounded by MAX_ACTIVE_FIRES a sync,
   * because only a fire ending can add to it.
   */
  drainLosses(): readonly Loss[] {
    if (this.lost.length === 0) return EMPTY_LOSSES;
    const taken = this.lost.slice();
    this.lost.length = 0;
    return taken;
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
    this.recordLosses(state);
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
      const level = levelAt(levelsOf(state, fire.kind), fire.index);
      blaze.top = roofline(fire.kind, fire.index, level);
      bodyFootprint(fire.kind, fire.index, level, at.plots, at.alongX, blaze);
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
