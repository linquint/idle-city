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
import { cellX, cellZ, isRoad } from '../sim/layout.ts';
import type { ZoneKind } from '../sim/state.ts';

/**
 * The five modelled level-1 houses, and the meshes that draw them.
 *
 * Level 1 of the housing ladder is the one rung the city is mostly made of: it
 * is what every plot starts as, and a district that has not been pushed up the
 * ladder is nothing but these. It was a 2.2-unit box with a cone on it, which
 * is the right answer for a rung the camera flies past and the wrong one for
 * the building a new player spends their first hour looking at.
 *
 * So it is modelled, five times over, and a plot gets one of the five. What
 * that buys is a *street*: five silhouettes, each with a front, standing along
 * a kerb in the order the seed put them in. What it costs is five meshes, and
 * the rest of this file is about keeping it to five.
 */

/** The five, in the order `houseStyleOf` indexes them. */
const HOUSE_PARTS: readonly (readonly ModelPart[])[] = [
  HOUSE_COTTAGE_PARTS,
  HOUSE_TERRACE_PARTS,
  HOUSE_VERANDA_PARTS,
  HOUSE_SEMI_PARTS,
  HOUSE_MODERN_PARTS,
];

export const HOUSE_STYLES = HOUSE_PARTS.length;

/** The one material in a house model that is a light rather than a colour. */
const LIT = 'window-light';

/**
 * The lit box a house model carries, in the model's own coordinates.
 *
 * Every table carries exactly one part in `window-light` and this is it —
 * asserted rather than assumed, because the whole night ramp for a thousand
 * houses hangs off it. See `HouseMeshes` for why it is pulled out of the merge.
 */
export interface LitBand {
  readonly at: readonly [number, number, number];
  readonly size: readonly [number, number, number];
}

/**
 * A house's lit band, per style.
 *
 * Pulled out of the model and handed to the *shared* band mesh in `PartBank`
 * rather than drawn by the house itself, and that is the trick that keeps this
 * at five meshes. A merged vertex-coloured mesh can hold every colour a house
 * wears but it cannot hold a light: the night ramp is a property of a material,
 * and a vertex-colour merge has one material for the whole model. The band was
 * already a lit unit box that every other building in the city wears, scaled
 * per instance — so a modelled house wears its model's own band through the
 * mesh that already existed, and the ramp comes back for free.
 */
export const HOUSE_LIT: readonly LitBand[] = HOUSE_PARTS.map((parts, style) => {
  const lit = parts.filter((part) => part.mtl === LIT);
  // Thrown rather than defaulted. A remodel that dropped the lit band would
  // otherwise put a house on screen that is simply dark after dusk, which is
  // the kind of wrong nobody notices until a night shot.
  if (lit.length !== 1) {
    throw new Error(`house style ${style} carries ${lit.length} '${LIT}' parts, expected 1`);
  }
  const part = lit[0] as ModelPart;
  if (part.shape !== 'box') throw new Error(`house style ${style} lights a non-box`);
  return { at: part.at, size: part.size };
});

/**
 * How far a house model reaches, per style, in the model's own coordinates.
 *
 * The whole model, gardens included: what this bounds is the *plot* a house
 * occupies, and a hedge standing in the street is as wrong as a wall standing
 * in it. Read by `bodyFootprint` for the selection outline and the fire layer,
 * and by the kerb assertion in test/skyline.test.ts.
 *
 * `height` is the top of the model rather than of its walls, so it is the
 * chimney on the four styles that have one. That is what the outline should
 * wrap, and a flame on a burning house rising from the chimney is not the
 * wrong place for it either.
 */
export const HOUSE_EXTENT: readonly {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}[] = HOUSE_PARTS.map((parts) => {
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
});

/**
 * The four sides a plot's street can be on, in quarter turns about +Y.
 *
 * The models are built facing +z — door, path and hedge on that side — and a
 * plot's street can be on any of the four. Nothing in the city needed this
 * before, because nothing in the city had a front: a box is a box at every
 * turn. A house is not, and a run of front gardens backing onto each other is
 * the single most visible thing that would say these were dropped in rather
 * than built.
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
 * Which way the house standing at a world position faces, in quarter turns.
 *
 * A corner plot has two streets and both are correct, so the seed picks: it is
 * the one place in the layout where a house has a genuine choice, and taking
 * the first every time would line every corner in the city up the same way.
 *
 * Every sellable plot fronts a street by construction — `plotsFor` is defined
 * as exactly that — so the no-street miss is unreachable, and facing the
 * model's own way is the formality that covers it.
 */
export function houseFacing(x: number, z: number, pick: number): number {
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
 * The five house meshes, packed per style.
 *
 * One `GrowableInstancedMesh` a style, merged by *vertex colour* rather than by
 * material — the choice the bus already makes, for the mirror of the bus's
 * reason. A vehicle merges by colour because a mesh per material multiplies the
 * renderer's hottest per-frame loop; a house merges by colour because a mesh
 * per material multiplies the most numerous building in the city. Nine
 * materials across five styles is 42 draw calls for the rung a district is made
 * of. Vertex colours collapse that to five, and the one thing a material could
 * have given that any of these parts needed — the night ramp on the lit band —
 * is bought back through the shared band mesh instead. See `HOUSE_LIT`.
 *
 * Packed per style rather than per level, so an instance index here has nothing
 * to do with a slot index — this class keeps the map both ways, exactly as
 * `PartBank` and `partAt` do between them. `slotOf` is what a raycast hit
 * resolves through and `indexOf` is what the growth animation rewrites through.
 *
 * **What this costs is triangles, not draw calls, and it is not small.**
 * Measured (tools/lod.calibrate.mjs, part 1b, at 49 districts of nothing but
 * level-1 housing — the city that is made of these): 1,176 houses are 266,904
 * triangles where the box and roof they replace were 28,224, so the worst scene
 * the game can build goes from 619,332 triangles to 858,012. That is 38.5%, and
 * all of it is also in the shadow pass.
 *
 * It is spent rather than optimised, and the option not taken is worth naming
 * so the next person does not have to rediscover why. Most of those triangles
 * throw no shadow anybody can see — a window 6cm proud of a wall, a garden path
 * 6cm off the ground — so the obvious move is to split each style into a
 * casting half and a flat half and keep the second out of the depth pass, the
 * way `setDressingShadows` already does for awnings and roof vents. That split
 * costs a second mesh per style: ten instead of five, which is the whole of the
 * saving the vertex-colour merge just bought. If the shadow pass ever becomes
 * the measured bottleneck at this rung, that is the trade to make, and part 1b
 * is the number to make it against — but a mesh spent against an unmeasured
 * worry is a mesh spent twice.
 */
export class HouseMeshes {
  private readonly meshes: readonly GrowableInstancedMesh[];
  private readonly counts = new Int32Array(HOUSE_STYLES);
  /** Per style, instance -> slot. Grown with the city; read by `register`. */
  private readonly slotOf: Int32Array[] = HOUSE_PARTS.map(() => new Int32Array(0));
  /** slot -> instance in its own style's mesh. -1 for a slot not drawn here. */
  private indexOf = new Int32Array(0);

  constructor(scene: THREE.Scene, capacity: number) {
    this.meshes = HOUSE_PARTS.map(
      (parts, style) =>
        new GrowableInstancedMesh(
          scene,
          // The lit band is drawn by the shared band mesh, so it must not also
          // be baked in here — a house would wear two of them, one of which
          // never lights.
          mergeColoured(parts.filter((part) => part.mtl !== LIT)),
          new THREE.MeshLambertMaterial({ vertexColors: true }),
          capacity,
          { castShadow: true, receiveShadow: true, name: `house:${style}` },
        ),
    );
  }

  /** States what the houses cover, so their five meshes can be frustum-culled. */
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

  /** Appends one house, and records where it landed so both maps stay true. */
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
   * Rewrites one house already placed. The growth animation's path.
   *
   * Colour is left alone: a building's colour does not change on the way up,
   * and rewriting it every frame would dirty the instance colour buffer for
   * nothing.
   */
  move(style: number, slot: number, matrix: THREE.Matrix4): void {
    const mesh = this.meshes[style];
    const index = slot < this.indexOf.length ? (this.indexOf[slot] as number) : -1;
    if (!mesh || index < 0 || index >= (this.counts[style] ?? 0)) return;
    mesh.setMatrixAt(index, matrix);
  }

  /** Rewrites one house's colour in place. The overlay's path. */
  recolor(style: number, slot: number, colour: THREE.Color): void {
    const mesh = this.meshes[style];
    const index = slot < this.indexOf.length ? (this.indexOf[slot] as number) : -1;
    if (!mesh || index < 0 || index >= (this.counts[style] ?? 0)) return;
    mesh.setColorAt(index, colour);
  }

  end(): void {
    for (let s = 0; s < HOUSE_STYLES; s++) {
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
   * interleaved across the level's slots: a house's instance index is where its
   * style's run happened to reach, not its position in the zone.
   */
  register(ranges: SlotRanges<ZoneKind>, tag: ZoneKind): void {
    for (let s = 0; s < HOUSE_STYLES; s++) {
      const mesh = this.meshes[s];
      if (mesh) ranges.setMapped(mesh, tag, this.slotOf[s] as Int32Array);
    }
  }
}
