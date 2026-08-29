import * as THREE from 'three';
import { hash01, mixSeed } from '../core/rng.ts';
import { SEED } from '../sim/config.ts';
import {
  AIRPORT_DEPTH,
  AIRPORT_LENGTH,
  airportCell,
  ESTATE_SPAN,
  estateCell,
  type EstateCell,
} from '../sim/estates.ts';
import type { GameState } from '../sim/state.ts';
import { WATERS, type Shore } from '../sim/water.ts';
import { GrowableInstancedMesh } from './growable.ts';
import { PALETTE } from './palette.ts';

/**
 * The works beyond the city edge: a yard, a shed and a stack on each parcel.
 *
 * A readout of one count, like every other layer. What it draws is deliberately
 * *not* what `buildings.ts` draws — no ladder, no styles, no growth animation —
 * because an estate is not on the level ladder and never will be: it has no
 * education gate to clear and no neighbour to merge with, so a shed that grew a
 * storey would be showing something the simulation is not tracking.
 *
 * The variety instead comes from where the shed sits in its yard and how long
 * it is, which is `hash01` of the parcel's ordinal and the seed — the same rule
 * `buildingStyle` uses, and stored in exactly the same place, which is nowhere.
 */

/** How much of a parcel the yard covers. The rest is the verge to the road. */
const YARD = 0.88;
const YARD_H = 0.5;

/** The shed, as a share of the yard. Long, low and wide — that is what a shed is. */
const SHED_LONG = 0.78;
const SHED_WIDE = 0.46;
const SHED_H = 5.4;
/** How much the shed's length varies parcel to parcel. */
const SHED_JITTER = 0.22;

const ROOF_H = 0.4;
const ROOF_LIP = 0.6;

const STACK_W = 1.5;
const STACK_H = 9;

/** Instances one parcel wants of each mesh. One of everything. */
const PER_PARCEL = 1;

// ------------------------------------------------------------------ airport

/** The apron, as a share of the ground the airport stands on. */
const APRON = 0.96;
const APRON_H = 0.55;
/** The runway, as a share of the apron. Long and narrow — that is a runway. */
const RUNWAY_WIDE = 0.34;
const RUNWAY_H = 0.15;
/** Centreline dashes: how many, how long, how wide. */
const MARKS = 9;
const MARK_LONG = 0.055;
const MARK_WIDE = 0.035;
const MARK_H = 0.06;

/**
 * Everything the city builds beyond its own edge: the estates, and the airport.
 *
 * One layer rather than two, because they are the same drawing problem — flat
 * ground in the coast frame, placed by an ordinal and the seed, rebuilt only
 * when a count moves — and they share the `box` helper that turns a coast-frame
 * rectangle into a scaled world-space matrix. A second layer would be a second
 * copy of that.
 *
 * The airport is drawn with plain meshes rather than instanced ones, and that is
 * the one place it differs from everything around it. Instancing amortises a
 * per-instance cost over many instances; there is exactly one airport, and three
 * plain meshes toggled visible is both fewer objects and less machinery than one
 * instance of three instanced ones. It is outside BUILDING_MESH_BUDGET for the
 * same reason the estates and the port are: that budget is the three zone
 * ladders, which grow with the city, and these grow with the *table*.
 */
export class Estates {
  private readonly yards: GrowableInstancedMesh;
  private readonly sheds: GrowableInstancedMesh;
  private readonly roofs: GrowableInstancedMesh;
  private readonly stacks: GrowableInstancedMesh;
  /** The apron, the strip and the centreline. Built once, shown when built. */
  private readonly apron: THREE.Mesh;
  private readonly runway: THREE.Mesh;
  private readonly marks: GrowableInstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly point: Shore = { x: 0, z: 0 };
  private shown = -1;
  private shownAirport = false;

  constructor(scene: THREE.Scene) {
    // Made ground, in the same colour the districts stand on: an estate is a
    // yard laid over a field, which is what a district is over a larger one.
    this.yards = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, YARD_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.land }),
      4,
      { receiveShadow: true, name: 'estate:yard' },
    );
    this.sheds = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, SHED_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.industry }),
      4,
      { castShadow: true, receiveShadow: true, name: 'estate:shed' },
    );
    this.roofs = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, ROOF_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.industryRoof }),
      4,
      { castShadow: true },
    );
    this.stacks = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(STACK_W, STACK_H, STACK_W),
      new THREE.MeshLambertMaterial({ color: PALETTE.stack }),
      4,
      { castShadow: true },
    );

    // Flat plates rather than boxes with a silhouette, which is the whole of
    // what an airport looks like from above — the runway reads because it is
    // dark against pale made ground and because of the dashes down it, not
    // because anything stands up.
    // Height baked into the geometry rather than into the scale, exactly as
    // every mesh above does it — `box` writes a scale of (alongU, 1, alongV),
    // so anything expecting to be scaled vertically would come out one unit
    // tall whatever it asked for.
    const plate = (color: number, height: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, height, 1),
        new THREE.MeshLambertMaterial({ color }),
      );
      mesh.receiveShadow = true;
      mesh.visible = false;
      scene.add(mesh);
      return mesh;
    };
    this.apron = plate(PALETTE.apron, APRON_H);
    this.runway = plate(PALETTE.runway, RUNWAY_H);
    this.marks = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, MARK_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.marking }),
      MARKS,
      { name: 'airport:marks' },
    );
    this.marks.count = 0;
    this.marks.flush();
  }

  sync(state: Readonly<GameState>): void {
    this.syncAirport(state);
    if (state.estates === this.shown) return;
    this.shown = state.estates;

    const want = Math.max(1, state.estates * PER_PARCEL);
    this.yards.ensure(want);
    this.sheds.ensure(want);
    this.roofs.ensure(want);
    this.stacks.ensure(want);

    let built = 0;
    for (let i = 0; i < state.estates; i++) {
      const cell = estateCell(i);
      // Counted as written rather than assumed, the same way the port counts
      // its berths: `estateCapacity` holds the count inside the band, and if
      // one ever got past it the answer has to be a missing shed rather than a
      // yard drawn on last frame's matrix.
      if (!cell) continue;
      this.parcel(cell, i, built++);
    }

    this.yards.count = built;
    this.sheds.count = built;
    this.roofs.count = built;
    this.stacks.count = built;
    this.yards.flush();
    this.sheds.flush();
    this.roofs.flush();
    this.stacks.flush();
  }

  /**
   * The airport, which is either there or not.
   *
   * Written once when the boolean turns over rather than every frame, exactly
   * as the estates are rebuilt only when their count moves. A `null` cell means
   * the water took every candidate site, which `airportAllowed` already refuses
   * to sell — this is the belt to that braces.
   */
  private syncAirport(state: Readonly<GameState>): void {
    if (state.airport === this.shownAirport) return;
    this.shownAirport = state.airport;
    const cell = state.airport ? airportCell() : null;
    this.apron.visible = cell !== null;
    this.runway.visible = cell !== null;
    if (!cell) {
      this.marks.count = 0;
      this.marks.flush();
      return;
    }

    this.box(cell.u, cell.v, AIRPORT_DEPTH * APRON, AIRPORT_LENGTH * APRON, APRON_H / 2);
    this.apron.position.copy(this.dummy.position);
    this.apron.scale.copy(this.dummy.scale);

    this.box(
      cell.u,
      cell.v,
      AIRPORT_DEPTH * RUNWAY_WIDE,
      AIRPORT_LENGTH * APRON,
      APRON_H + RUNWAY_H / 2,
    );
    this.runway.position.copy(this.dummy.position);
    this.runway.scale.copy(this.dummy.scale);

    // Dashes down the middle, evenly spaced and inset from both thresholds, so
    // the strip reads as a runway rather than as a long dark yard.
    this.marks.ensure(MARKS);
    const run = AIRPORT_LENGTH * APRON;
    for (let i = 0; i < MARKS; i++) {
      const along = cell.v + (((i + 0.5) / MARKS) * run - run / 2);
      this.box(
        cell.u,
        along,
        AIRPORT_DEPTH * MARK_WIDE,
        AIRPORT_LENGTH * MARK_LONG,
        APRON_H + RUNWAY_H + MARK_H / 2,
      );
      this.marks.setMatrixAt(i, this.dummy.matrix);
    }
    this.marks.count = MARKS;
    this.marks.flush();
  }

  private parcel(cell: EstateCell, ordinal: number, slot: number): void {
    const seed = mixSeed(SEED, 0x5ed0 + ordinal);
    const long = ESTATE_SPAN * SHED_LONG * (1 - SHED_JITTER * hash01(seed));
    const wide = ESTATE_SPAN * SHED_WIDE;
    // Set back from the road side of the yard by whatever is left over, so the
    // sheds along a band do not line up on one edge like a row of teeth.
    const room = ESTATE_SPAN * YARD - long;
    const shift = (hash01(mixSeed(seed, 1)) - 0.5) * room;
    // Half the parcels stand their shed across the band rather than along it,
    // which is what stops a long row reading as one very long building.
    const across = hash01(mixSeed(seed, 2)) < 0.5;

    this.box(cell.u, cell.v, ESTATE_SPAN * YARD, ESTATE_SPAN * YARD, YARD_H / 2);
    this.yards.setMatrixAt(slot, this.dummy.matrix);

    const u = cell.u + (across ? 0 : shift);
    const v = cell.v + (across ? shift : 0);
    const alongU = across ? wide : long;
    const alongV = across ? long : wide;

    this.box(u, v, alongU, alongV, YARD_H + SHED_H / 2);
    this.sheds.setMatrixAt(slot, this.dummy.matrix);
    this.box(u, v, alongU + ROOF_LIP, alongV + ROOF_LIP, YARD_H + SHED_H + ROOF_H / 2);
    this.roofs.setMatrixAt(slot, this.dummy.matrix);

    // At one corner of the shed, so the stack reads as part of it rather than
    // as a mast standing in the yard on its own.
    const corner = (alongU - STACK_W) / 2 - 1;
    const side = (alongV - STACK_W) / 2 - 1;
    WATERS.toWorld(u - corner, v + side, this.point);
    this.dummy.position.set(this.point.x, YARD_H + STACK_H / 2, this.point.z);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    this.stacks.setMatrixAt(slot, this.dummy.matrix);
  }

  /**
   * One axis-aligned box in the coast frame, written into `dummy`.
   *
   * Scaled rather than rotated, exactly as the port's boxes are: the coast runs
   * along a world axis by construction, so "along the band" is either x or z
   * and the transform is a scale swap.
   */
  private box(u: number, v: number, alongU: number, alongV: number, y: number): void {
    WATERS.toWorld(u, v, this.point);
    this.dummy.position.set(this.point.x, y, this.point.z);
    if (WATERS.coast.axis === 'x') this.dummy.scale.set(alongU, 1, alongV);
    else this.dummy.scale.set(alongV, 1, alongU);
    this.dummy.updateMatrix();
  }
}
