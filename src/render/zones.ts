import * as THREE from 'three';
import { hash01 } from '../core/rng';
import { ZONE } from '../sim/citygen';
import { CELL, CIVIC_SERVICES } from '../sim/config';
import { serviceCount } from '../sim/economy';
import {
  BUILDABLE_PARKS_PER_DISTRICT as PARKS_PER_DISTRICT,
  worldX,
  worldZ,
  type CityLayout,
  type Coord,
} from '../sim/layout';
import type { GameState } from '../sim/state';
import { GrowableInstancedMesh } from './growable';
import { PALETTE } from './palette';

/** A gutter under the pad so plots read as plots rather than as a colour wash. */
const PAD = CELL - 0.8;
const PAD_H = 0.1;
/** The land tile's top face sits at y = 0; clear it rather than z-fight it. */
const PAD_Y = 0.06;

/**
 * Quantisation of demand for the rebuild stamp: 20 steps across [-1, 1].
 *
 * Demand moves on a 25-second constant, so an unquantised stamp would differ on
 * every single frame and rebuild the whole instance buffer for a colour shift
 * nobody can see. A twentieth of the range is finer than the eye reads off a
 * pad and coarse enough that the rebuild fires a handful of times a minute.
 */
const DEMAND_STEPS = 10;
const quantise = (d: number): number => Math.round(d * DEMAND_STEPS);

/**
 * Zoned land that will never carry a building, drawn so it does not read as a
 * hole punched in the block.
 *
 * Two kinds end up here, and they look the same from above because they are the
 * same thing — land the city owns and is not building on:
 *
 *   - the interior of a deep block, which no longer appears in any build list
 *     now that every building has to front a street;
 *   - the 2x2 civic sites still standing empty. There are seven a district and
 *     they are reserved from the moment the land is annexed, so without this a
 *     new district would open as a grid of 28 gaps.
 *
 * Interior plots carrying a park are drawn by `Parks` instead, so this class
 * draws the tail of the courtyard list rather than all of it.
 *
 * Always on, unlike the zoning overlay, and rebuilt only when a count it draws
 * from actually moves.
 */
export class Courtyards {
  private readonly pads: GrowableInstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly tint = new THREE.Color(PALETTE.courtyard);
  private stamp = '';

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
  ) {
    this.pads = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(PAD, PAD_H, PAD),
      new THREE.MeshLambertMaterial({ color: PALETTE.courtyard }),
      256,
      { receiveShadow: true },
    );
  }

  sync(state: Readonly<GameState>): void {
    const built = SERVICE_KEYS.map((key) => serviceCount(state, key));
    const stamp =
      `${state.districts}:${state.parks}:${state.cityHall}:${state.plants}:${built.join(',')}`;
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    this.layout.ensure(state);

    const courtyards = this.layout.courtyards;
    // Parks are the front of the courtyard list, so the plots still standing
    // empty are the tail past `parks` — the same rule the build lists use.
    const laid = Math.min(state.parks, courtyards.length);
    // A site is empty until the building indexed onto it exists. The interleave
    // is fixed, so "site i is taken" is pure arithmetic over three counts.
    const types = SERVICE_KEYS.length;
    const taken = (site: number): boolean =>
      (built[site % types] as number) > Math.floor(site / types);

    let n = 0;
    const write = (cell: Coord): void => {
      this.dummy.position.set(worldX(cell.x), PAD_Y, worldZ(cell.z));
      this.dummy.updateMatrix();
      this.pads.setMatrixAt(n, this.dummy.matrix);
      this.pads.setColorAt(n, this.tint);
      n++;
    };

    // The city hall's squares are reserved in every district and built on in
    // exactly one, so every one past the first is land nothing will ever stand
    // on. Drawn for the same reason an empty civic site is: a reserved square
    // left bare reads as a hole in the block rather than as held ground.
    const halls = Math.max(0, this.layout.cityHallSites - (state.cityHall ? 1 : 0));
    // Plant squares the city owns and has not built on. Unlike the hall's, these
    // are all buildable — a district needs about 0.78 of a plant at the top of
    // the level ladder — so this list empties as the city grows into it.
    const plants = Math.max(0, this.layout.powerPlantSites - state.plants);
    let empty = 0;
    for (let i = 0; i < this.layout.civicSites; i++) if (!taken(i)) empty++;
    this.pads.ensure(courtyards.length - laid + (empty + halls + plants) * 4);

    const quad = (c: Coord): void => {
      write(c);
      write({ x: c.x + 1, z: c.z });
      write({ x: c.x, z: c.z + 1 });
      write({ x: c.x + 1, z: c.z + 1 });
    };

    for (let i = laid; i < courtyards.length; i++) write(courtyards[i] as Coord);
    for (let i = 0; i < this.layout.civicSites; i++) {
      // The site's four plots, from its lower-left corner.
      if (!taken(i)) quad(this.layout.civicSiteCell(i));
    }
    for (let i = state.cityHall ? 1 : 0; i < this.layout.cityHallSites; i++) {
      quad(this.layout.cityHallSiteCell(i));
    }
    for (let i = state.plants; i < this.layout.powerPlantSites; i++) {
      quad(this.layout.powerPlantCell(i));
    }

    this.pads.count = n;
    this.pads.flush();
  }
}

/**
 * Parks: a green pad and a handful of trees, on land nothing else can use.
 *
 * The pad is the courtyard pad — same geometry, same height, same one-unit
 * gutter — because a park *is* a courtyard with something on it, and drawing it
 * any other way would make the interior of a block read as two different kinds
 * of land. What distinguishes it is the colour and the trees.
 *
 * Rebuilt only when the park count or the district count moves. Tree placement
 * is `hash01` over the park's ordinal, so a park scatters the same way on every
 * device and after every reload without a single coordinate being stored.
 */
class ParkTrees {
  /** Trees to a plot. Four reads as planting; more reads as woodland. */
  static readonly PER_PARK = 4;
  /** Kept inside the pad, so no canopy overhangs the kerb. */
  static readonly SPREAD = PAD / 2 - 0.55;
}

export class Parks {
  private readonly pads: GrowableInstancedMesh;
  private readonly trunks: GrowableInstancedMesh;
  private readonly canopies: GrowableInstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly tint = new THREE.Color(PALETTE.park);
  private stamp = '';

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
  ) {
    this.pads = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(PAD, PAD_H, PAD),
      new THREE.MeshLambertMaterial({ color: PALETTE.park }),
      64,
      { receiveShadow: true },
    );
    this.trunks = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(0.16, 0.55, 0.16),
      new THREE.MeshLambertMaterial({ color: PALETTE.trunk }),
      256,
      { castShadow: true },
    );
    this.canopies = new GrowableInstancedMesh(
      scene,
      new THREE.ConeGeometry(0.52, 1.15, 6),
      new THREE.MeshLambertMaterial({ color: PALETTE.canopy }),
      256,
      { castShadow: true },
    );
  }

  sync(state: Readonly<GameState>): void {
    const stamp = `${state.districts}:${state.parks}`;
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    this.layout.ensure(state);

    const n = Math.min(state.parks, state.districts * PARKS_PER_DISTRICT);
    this.pads.ensure(n);
    this.trunks.ensure(n * ParkTrees.PER_PARK);
    this.canopies.ensure(n * ParkTrees.PER_PARK);

    let tree = 0;
    for (let i = 0; i < n; i++) {
      const cell = this.layout.parkCell(i);
      const x = worldX(cell.x);
      const z = worldZ(cell.z);

      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.position.set(x, PAD_Y, z);
      this.dummy.updateMatrix();
      this.pads.setMatrixAt(i, this.dummy.matrix);
      this.pads.setColorAt(i, this.tint);

      for (let k = 0; k < ParkTrees.PER_PARK; k++) {
        const seed = i * ParkTrees.PER_PARK + k;
        const tx = x + (hash01(seed ^ 0x51ed270b) * 2 - 1) * ParkTrees.SPREAD;
        const tz = z + (hash01(seed ^ 0x2f9a3b17) * 2 - 1) * ParkTrees.SPREAD;
        // A little height variation, or four identical cones read as a fence.
        const grow = 0.78 + hash01(seed ^ 0x7c1a55d3) * 0.5;

        this.dummy.scale.set(1, grow, 1);
        this.dummy.position.set(tx, PAD_Y + (0.55 * grow) / 2, tz);
        this.dummy.updateMatrix();
        this.trunks.setMatrixAt(tree, this.dummy.matrix);

        this.dummy.position.y = PAD_Y + 0.55 * grow + (1.15 * grow) / 2;
        this.dummy.updateMatrix();
        this.canopies.setMatrixAt(tree, this.dummy.matrix);
        tree++;
      }
    }

    this.pads.count = n;
    this.trunks.count = tree;
    this.canopies.count = tree;
    this.pads.flush();
    this.trunks.flush();
    this.canopies.flush();
  }
}

/**
 * What the overlay is showing. `plan` is the zoning map; `demand` repaints the
 * same pads by how badly the city wants that type right now.
 */
export type ZoneMode = 'off' | 'plan' | 'demand';

/**
 * The 2x2 civic types, in the interleave's own order.
 *
 * `CityLayout.civicSiteFor` hands type `offset` the sites at `i * n + offset`
 * where n is the number of 2x2 types, so "is site s taken" is arithmetic over
 * this list — and it has to be *this* list. It read three types and a modulo 3
 * for two cycles after schools and depots joined the pool, which drew a pad
 * under two buildings in every five and left two genuinely empty sites without
 * one. Derived from CIVIC_SERVICES rather than typed out, so the next type to
 * join cannot leave it behind again.
 */
const SERVICE_KEYS = CIVIC_SERVICES.map((service) => service.key);

const CYCLE: readonly ZoneMode[] = ['off', 'plan', 'demand'];

/**
 * The zone plan: every plot that is zoned but not yet built on, as a flat
 * coloured pad at ground level. One InstancedMesh, one draw call, and it only
 * rebuilds when the counts it draws from actually move.
 *
 * Unlit on purpose — an overlay that the key light rakes across is a worse
 * diagram than one that just states the colour.
 */
export class Zones {
  private readonly pads: GrowableInstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly tint = new THREE.Color();
  private readonly high = new THREE.Color(PALETTE.demandHigh);
  private readonly neutral = new THREE.Color(PALETTE.demandNeutral);
  private readonly low = new THREE.Color(PALETTE.demandLow);
  private mode: ZoneMode = 'off';
  /** What the pads were last built for. Empty forces a rebuild. */
  private stamp = '';

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
  ) {
    this.pads = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(PAD, PAD_H, PAD),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      256,
    );
    this.pads.mesh.visible = false;
  }

  get enabled(): boolean {
    return this.mode !== 'off';
  }

  /** Steps to the next mode. The pads themselves are rebuilt by the next `sync`. */
  cycle(): ZoneMode {
    const next = CYCLE[(CYCLE.indexOf(this.mode) + 1) % CYCLE.length] as ZoneMode;
    this.mode = next;
    this.pads.mesh.visible = next !== 'off';
    this.stamp = '';
    if (next === 'off') this.pads.count = 0;
    return next;
  }

  /**
   * Demand -> pad colour: green at a live discount, red at oversupply, grey at
   * the balance point. Interpolating through a neutral rather than straight
   * from red to green keeps "nearly balanced" from reading as a weak yes.
   */
  private demandColor(d: number, out: THREE.Color): THREE.Color {
    const t = Math.min(1, Math.abs(d));
    return out.copy(this.neutral).lerp(d >= 0 ? this.high : this.low, t);
  }

  sync(state: Readonly<GameState>): void {
    if (this.mode === 'off') return;
    const counts = `${state.districts}:${state.homes}:${state.shops}:${state.industry}`;
    const stamp =
      this.mode === 'plan'
        ? `plan:${counts}`
        : `demand:${counts}:${quantise(state.demandR)}:${quantise(state.demandC)}:${quantise(state.demandI)}`;
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    this.layout.ensure(state);

    const residential = this.layout.zoneCells(ZONE.residential);
    const commercial = this.layout.zoneCells(ZONE.commercial);
    const industrial = this.layout.zoneCells(ZONE.industrial);

    // Built plots are the *front* of each zone's build order, so "unbuilt" is
    // simply the tail past the count the simulation reports. Civic sites were
    // taken out of these lists before the city ever saw them, so there is no
    // longer a second run at the far end to work around.
    const homes = Math.min(state.homes, residential.length);
    const shops = Math.min(state.shops, commercial.length);
    const industry = Math.min(state.industry, industrial.length);
    const total =
      (residential.length - homes) + (commercial.length - shops) + (industrial.length - industry);
    this.pads.ensure(total);

    let n = 0;
    const write = (cells: readonly Coord[], from: number, to: number, hex: number, d: number): void => {
      if (this.mode === 'plan') this.tint.setHex(hex);
      else this.demandColor(d, this.tint);
      for (let i = from; i < to; i++) {
        const cell = cells[i] as Coord;
        this.dummy.position.set(worldX(cell.x), PAD_Y, worldZ(cell.z));
        this.dummy.updateMatrix();
        this.pads.setMatrixAt(n, this.dummy.matrix);
        this.pads.setColorAt(n, this.tint);
        n++;
      }
    };

    write(residential, homes, residential.length, PALETTE.zoneResidential, state.demandR);
    write(commercial, shops, commercial.length, PALETTE.zoneCommercial, state.demandC);
    write(industrial, industry, industrial.length, PALETTE.zoneIndustrial, state.demandI);

    this.pads.count = n;
    this.pads.flush();
  }
}
