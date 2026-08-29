import * as THREE from 'three';
import { GrowableInstancedMesh, SlotRanges } from './growable.ts';
import { mergeColoured, type ModelPart } from './model.ts';
import {
  HOUSE_COTTAGE_PARTS,
  HOUSE_MODERN_PARTS,
  HOUSE_SEMI_PARTS,
  HOUSE_TERRACE_PARTS,
  HOUSE_VERANDA_PARTS,
} from './houseModels.ts';
import {
  SHOP_ARCADE_PARTS,
  SHOP_CAFE_PARTS,
  SHOP_FIN_PARTS,
  SHOP_MARKET_PARTS,
  SHOP_PARADE_PARTS,
} from './shopModels.ts';
import { cellX, cellZ, isRoad } from '../sim/layout.ts';
import type { ZoneKind } from '../sim/state.ts';

/**
 * The rungs of the ladder that are drawn from models, and the meshes that draw
 * them.
 *
 * Level 1 of housing and level 1 of commerce: the two rungs the city is mostly
 * *made* of. Every plot a player buys starts on one of them, a district that
 * has not been pushed up the ladder is nothing but them, and they are what a
 * new player spends their first hour looking at. They were a box with a cone on
 * it and a box with a canopy on it, which is the right answer for a rung the
 * camera flies past and the wrong one for the rung it lives at.
 *
 * So each is modelled, five times over, and a plot gets one of the five. What
 * that buys is a *street*: five silhouettes a zone, each with a front, standing
 * along a kerb in the order the seed put them in. What it costs is five meshes
 * a zone, and most of this file is about keeping it to five.
 *
 * Industry is deliberately not here. It is the anti-tower — wide, low, and read
 * from above as a footprint rather than a facade — so what would show is a roof
 * the massed version already draws, and there are a third as many of them.
 */

/** The zones whose first rung is modelled. Industry's is not. */
export type ModelledKind = Extract<ZoneKind, 'home' | 'shop'>;

/** The five of each, in the order `modelStyleOf` indexes them. */
const MODELS: Readonly<Record<ModelledKind, readonly (readonly ModelPart[])[]>> = {
  home: [
    HOUSE_COTTAGE_PARTS,
    HOUSE_TERRACE_PARTS,
    HOUSE_VERANDA_PARTS,
    HOUSE_SEMI_PARTS,
    HOUSE_MODERN_PARTS,
  ],
  shop: [
    SHOP_PARADE_PARTS,
    SHOP_FIN_PARTS,
    SHOP_ARCADE_PARTS,
    SHOP_MARKET_PARTS,
    SHOP_CAFE_PARTS,
  ],
};

export const MODELLED_KINDS = Object.keys(MODELS) as readonly ModelledKind[];

/** How many models a zone's first rung is drawn from. Five each, and asserted. */
export const MODEL_STYLES: Readonly<Record<ModelledKind, number>> = {
  home: MODELS.home.length,
  shop: MODELS.shop.length,
};

/**
 * The materials that are lights rather than colours.
 *
 * A house has one, a shop has two: a shopfront glows and so does its sign, and
 * they are separate materials in the model even though the modeller gave them
 * the same sodium — which is the right way round, because what makes them two
 * things is what they *are*, not what colour they came out.
 */
const LIT = new Set(['window-light', 'shopfront-light', 'shop-sign']);

/** One lit box of a model, in the model's own coordinates. */
export interface LitBox {
  readonly at: readonly [number, number, number];
  readonly size: readonly [number, number, number];
}

/**
 * Every lit box a model carries, per zone and style.
 *
 * Pulled out of the model and handed to the *shared* band mesh in `PartBank`
 * rather than drawn by the model itself, and that is the trick that keeps this
 * at five meshes a zone. A merged vertex-coloured mesh can hold every colour a
 * building wears but it cannot hold a light: the night ramp is a property of a
 * material, and a vertex-colour merge has one material for the whole model. The
 * band was already a lit unit box that every other building in the city wears,
 * scaled per instance — so a modelled building wears its own lit pieces through
 * the mesh that already existed, and the ramp comes back for free.
 */
export const MODEL_LIT: Readonly<Record<ModelledKind, readonly (readonly LitBox[])[]>> = {
  home: MODELS.home.map((parts) => litOf(parts, 'home')),
  shop: MODELS.shop.map((parts) => litOf(parts, 'shop')),
};

function litOf(parts: readonly ModelPart[], kind: ModelledKind): readonly LitBox[] {
  const lit = parts.filter((part) => LIT.has(part.mtl));
  // Thrown rather than defaulted. A remodel that dropped every lit piece would
  // otherwise put a building on screen that is simply dark after dusk, which is
  // the kind of wrong nobody notices until a night shot.
  if (lit.length === 0) throw new Error(`a ${kind} model carries no lit part`);
  return lit.map((part) => {
    if (part.shape !== 'box') throw new Error(`a ${kind} model lights a non-box`);
    return { at: part.at, size: part.size };
  });
}

/**
 * The most lit boxes any one model carries.
 *
 * What this sizes is the reserved part slots per building, so it is derived
 * rather than typed: a remodel that adds a second sign must not silently lose
 * it, and a stride the models can outgrow is exactly how that would happen.
 * See `BANDS_MAX`, which takes the larger of this and what a massed style
 * wears.
 */
export const MODEL_LIT_MAX = Math.max(
  ...MODELLED_KINDS.flatMap((kind) => MODEL_LIT[kind].map((lit) => lit.length)),
);

/** How far a model reaches, in its own coordinates. */
export interface ModelExtent {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

/**
 * How far each model reaches, per zone and style.
 *
 * The whole model, forecourts and gardens included: what this bounds is the
 * *plot* a building occupies, and a hedge standing in the street is as wrong as
 * a wall standing in it. Read by `bodyFootprint` for the selection outline and
 * the fire layer, and by the kerb assertion in test/skyline.test.ts.
 *
 * Symmetric about the model's origin rather than a raw AABB, because that is
 * what a plot has to contain: a building is placed centred on its plot, so what
 * matters is the furthest any part reaches from the middle, doubled.
 *
 * `height` is the top of the model rather than of its walls — a chimney, a fin
 * sign. That is what the outline should wrap, and a flame on a burning building
 * rising from the chimney is not the wrong place for it either.
 */
export const MODEL_EXTENT: Readonly<Record<ModelledKind, readonly ModelExtent[]>> = {
  home: MODELS.home.map(extentOf),
  shop: MODELS.shop.map(extentOf),
};

function extentOf(parts: readonly ModelPart[]): ModelExtent {
  let width = 0;
  let depth = 0;
  let height = 0;
  for (const part of parts) {
    if (part.shape !== 'box') continue;
    const [x, y, z] = part.at;
    const [w, h, d] = part.size;
    width = Math.max(width, 2 * Math.abs(x) + w);
    depth = Math.max(depth, 2 * Math.abs(z) + d);
    height = Math.max(height, y + h / 2);
  }
  return { width, depth, height };
}

/**
 * The four sides a plot's street can be on, in quarter turns about +Y.
 *
 * The models are built facing +z — door, sign, path and forecourt on that side
 * — and a plot's street can be on any of the four. Nothing in the city needed
 * this before, because nothing in the city had a front: a box is a box at every
 * turn. A modelled building is not, and a run of front gardens backing onto
 * each other is the single most visible thing that would say these were dropped
 * in rather than built. A shop wants it more than a house does — a shopfront
 * facing away from the street is not a shop, it is a wall.
 *
 * Quarter turns as a count rather than an angle, because every consumer wants
 * it exactly: a turn of 1 or 3 swaps a model's width and its depth, and asking
 * that question of a float is asking it of `cos(Math.PI / 2)`, which is not 0.
 */
const FACING: readonly { readonly dx: number; readonly dz: number }[] = [
  { dx: 0, dz: 1 }, // 0: the model's own front, +z
  { dx: 1, dz: 0 }, // 1: +x
  { dx: 0, dz: -1 }, // 2: -z
  { dx: -1, dz: 0 }, // 3: -x
];

/** Quarter turns -> radians, the four values `dummy.rotation.y` ever takes. */
export const QUARTER: readonly number[] = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

/**
 * Which way the building standing at a world position faces, in quarter turns.
 *
 * A corner plot has two streets and both are correct, so the seed picks: it is
 * the one place in the layout where a building has a genuine choice, and taking
 * the first every time would line every corner in the city up the same way.
 *
 * Every sellable plot fronts a street by construction — `plotsFor` is defined
 * as exactly that — so the no-street miss is unreachable, and facing the
 * model's own way is the formality that covers it.
 */
export function modelFacing(x: number, z: number, pick: number): number {
  const gx = cellX(x);
  const gz = cellZ(z);
  let found = 0;
  let turn = 0;
  for (let q = 0; q < FACING.length; q++) {
    const side = FACING[q] as { dx: number; dz: number };
    if (!isRoad(gx + side.dx, gz + side.dz)) continue;
    found++;
    // Reservoir sampling over the sides that are streets: one pass, no array,
    // and a uniform draw among however many a plot turns out to have.
    if (found === 1 || pick * found < 1) turn = q;
  }
  return turn;
}

/**
 * One zone's five model meshes, packed per style.
 *
 * One `GrowableInstancedMesh` a style, merged by *vertex colour* rather than by
 * material — the choice the bus already makes, for the mirror of the bus's
 * reason. A vehicle merges by colour because a mesh per material multiplies the
 * renderer's hottest per-frame loop; these merge by colour because a mesh per
 * material multiplies the most numerous buildings in the city. Nine materials
 * across five houses and ten across five shops is 42 and 44 draw calls for the
 * two rungs a district is made of. Vertex colours collapse each to five, and
 * the one thing a material could have given that any of these parts needed —
 * the night ramp on the lit pieces — is bought back through the shared band
 * mesh instead. See `MODEL_LIT`.
 *
 * Packed per style rather than per level, so an instance index here has nothing
 * to do with a slot index — this class keeps the map both ways, exactly as
 * `PartBank` and `partAt` do between them. `slotOf` is what a raycast hit
 * resolves through and `indexOf` is what the growth animation rewrites through.
 *
 * **What this costs is triangles, not draw calls, and it is the largest single
 * cost in the renderer.** Measured (tools/lod.calibrate.mjs, part 1b) at 49
 * districts of nothing but first-rung buildings, which is the city these *make*
 * — a player who annexes widely and promotes little:
 *
 *     1,176 houses   266,904 triangles     (227 each)
 *     2,205 shops    564,024 triangles     (256 each)
 *     massed, the same 3,381 would be 81,144 — a box and a roof each
 *
 * so the scene goes from 601,980 triangles to 1,351,764. It is 2.2x, 61% of
 * everything that city submits, and 1.1M of it is also in the shadow pass.
 * There are twice as many shops as houses because a district carries 45
 * commercial plots against 24 residential, so commerce is most of this.
 *
 * That is a real number and it is deliberately not hidden: the two rungs the
 * game is played on are now the two most expensive things in it. Whether it
 * *matters* is a frame-time question this harness cannot answer — Node has no
 * GPU — and 1.35M triangles is not obviously too many for one. What it does
 * mean is that the next optimisation the renderer needs is almost certainly
 * here rather than anywhere else.
 *
 * Two moves are available and neither is made, so the reasoning survives:
 *
 *   - **Split each style into a casting half and a flat half**, keeping the
 *     second out of the depth pass the way `setDressingShadows` already does
 *     for awnings and roof vents. Most of these triangles throw no shadow
 *     anybody can see — a window 6cm proud of a wall, a forecourt 6cm off the
 *     ground. It costs a second mesh per style: twenty instead of ten, which is
 *     the whole of the saving the vertex-colour merge just bought.
 *   - **Give each style a silhouette geometry and let `DetailMask` choose**,
 *     dropping the street furniture — a shop's crates, tables and bollards are
 *     a fifth of a metre across and sub-pixel from the orbit camera. This is
 *     the bigger win and the bigger change: it is a second mesh per style
 *     *and* instances moving between the two on every repack.
 *
 * Both want measuring against a GPU first. A mesh spent against an unmeasured
 * worry is a mesh spent twice.
 */
export class ModelMeshes {
  private readonly meshes: readonly GrowableInstancedMesh[];
  private readonly styles: number;
  private readonly counts: Int32Array;
  /** Per style, instance -> slot. Grown with the city; read by `register`. */
  private readonly slotOf: Int32Array[];
  /** slot -> instance in its own style's mesh. -1 for a slot not drawn here. */
  private indexOf = new Int32Array(0);

  constructor(
    scene: THREE.Scene,
    private readonly kind: ModelledKind,
    capacity: number,
  ) {
    const models = MODELS[kind];
    this.styles = models.length;
    this.counts = new Int32Array(this.styles);
    this.slotOf = models.map(() => new Int32Array(0));
    this.meshes = models.map(
      (parts, style) =>
        new GrowableInstancedMesh(
          scene,
          // The lit boxes are drawn by the shared band mesh, so they must not
          // also be baked in here — a building would wear two of each, one of
          // which never lights.
          mergeColoured(parts.filter((part) => !LIT.has(part.mtl))),
          new THREE.MeshLambertMaterial({ vertexColors: true }),
          capacity,
          { castShadow: true, receiveShadow: true, name: `model:${kind}:${style}` },
        ),
    );
  }

  /** States what these cover, so their five meshes can be frustum-culled. */
  setBounds(x: number, z: number, reach: number, top: number): void {
    for (const mesh of this.meshes) mesh.setBounds(x, z, reach, top);
  }

  /**
   * Room for `slots` buildings' worth of bookkeeping.
   *
   * The instance buffers grow themselves as `place` fills them; what this grows
   * is the slot -> instance map, which is indexed by slot and so has to be as
   * long as the zone is, not as long as any one style's run.
   */
  ensure(slots: number): void {
    if (this.indexOf.length >= slots) return;
    this.indexOf = new Int32Array(Math.max(64, slots * 2));
  }

  /** Starts a repack. Every style's instance list is written from scratch. */
  begin(): void {
    this.counts.fill(0);
  }

  /** Appends one building, and records where it landed so both maps stay true. */
  place(style: number, slot: number, matrix: THREE.Matrix4, colour: THREE.Color): void {
    const mesh = this.meshes[style];
    if (!mesh) return;
    const index = this.counts[style] ?? 0;
    this.counts[style] = index + 1;
    mesh.ensure(index + 1);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, colour);
    let slots = this.slotOf[style] as Int32Array;
    if (slots.length <= index) {
      const grown = new Int32Array(Math.max(64, (index + 1) * 2));
      grown.set(slots);
      this.slotOf[style] = grown;
      slots = grown;
    }
    slots[index] = slot;
    if (slot < this.indexOf.length) this.indexOf[slot] = index;
  }

  /**
   * Rewrites one building already placed. The growth animation's path.
   *
   * Colour is left alone: a building's colour does not change on the way up,
   * and rewriting it every frame would dirty the instance colour buffer for
   * nothing.
   */
  move(style: number, slot: number, matrix: THREE.Matrix4): void {
    const index = this.at(style, slot);
    if (index >= 0) this.meshes[style]?.setMatrixAt(index, matrix);
  }

  /** Rewrites one building's colour in place. The overlay's path. */
  recolor(style: number, slot: number, colour: THREE.Color): void {
    const index = this.at(style, slot);
    if (index >= 0) this.meshes[style]?.setColorAt(index, colour);
  }

  /** Where a slot's instance landed in its style's run, or -1 if it has none. */
  private at(style: number, slot: number): number {
    if (!this.meshes[style] || slot < 0 || slot >= this.indexOf.length) return -1;
    const index = this.indexOf[slot] as number;
    return index >= 0 && index < (this.counts[style] ?? 0) ? index : -1;
  }

  end(): void {
    for (let s = 0; s < this.styles; s++) {
      const mesh = this.meshes[s];
      if (!mesh) continue;
      mesh.count = this.counts[s] ?? 0;
      mesh.flush();
    }
  }

  flush(): void {
    for (const mesh of this.meshes) mesh.flush();
  }

  /**
   * Registers each style's instance -> slot map, so a raycast hit resolves.
   *
   * A mapped range rather than a contiguous one, because the five styles are
   * interleaved across the level's slots: a building's instance index is where
   * its style's run happened to reach, not its position in the zone.
   */
  register(ranges: SlotRanges<ZoneKind>): void {
    for (let s = 0; s < this.styles; s++) {
      const mesh = this.meshes[s];
      if (mesh) ranges.setMapped(mesh, this.kind, this.slotOf[s] as Int32Array);
    }
  }
}
