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
import {
  INDUSTRY_DOCK_PARTS,
  INDUSTRY_MILL_PARTS,
  INDUSTRY_SHED_PARTS,
  INDUSTRY_TANKS_PARTS,
  INDUSTRY_WORKS_PARTS,
} from './industryModels.ts';
import {
  WALKUP_CORE_PARTS,
  WALKUP_COURT_PARTS,
  WALKUP_DECK_PARTS,
  WALKUP_MAISONETTE_PARTS,
  WALKUP_MANSARD_PARTS,
} from './walkupModels.ts';
import {
  TOWER_BALCONY_PARTS,
  TOWER_CROSSWALL_PARTS,
  TOWER_GALLERY_PARTS,
  TOWER_TERRACE_PARTS,
  TOWER_TWIN_PARTS,
} from './towerModels.ts';
import { CELL, LEVEL_FOOTPRINT } from '../sim/config.ts';
import { cellX, cellZ, isRoad } from '../sim/layout.ts';
import type { ZoneKind } from '../sim/state.ts';

/**
 * The modelled rungs of the three ladders, and the meshes that draw them.
 *
 * The first rung of housing, of commerce and of industry, plus housing's
 * second: the rungs the city is mostly *made* of. Every plot a player buys
 * starts on a first rung, a district that has not been pushed up the ladder is
 * nothing but them, and they are what a new player spends their first hour
 * looking at. They were a box with a cone on it, a box with a canopy on it and
 * a box with a stack on it, which is the right answer for a rung the camera
 * flies past and the wrong one for the rung it lives at.
 *
 * So each is modelled, five times over, and a plot gets one of the five. What
 * that buys is a *street*: five silhouettes a rung, each with a front, standing
 * along a kerb in the order the seed put them in. What it costs is five meshes
 * a rung, and most of this file is about keeping it to five.
 *
 * **Housing is modelled three rungs up, and it is the only zone modelled above
 * its first.** That is not a step toward modelling everything: it is where the
 * cliffs were. A player's first promotion turned a street of five house
 * silhouettes into twenty-four copies of one 2.6 x 4.6 box, and the second
 * turned *that* into the same box twice as wide and twice as tall — the merge,
 * which is the most consequential thing a player does to a district and read as
 * the least. Commerce and industry climb too, but a district climbs *housing*
 * first and climbs it most — see `LEVEL_HOUSING` — so housing's second and
 * third rungs are the next most-looked-at surfaces in the game and the rungs
 * above them are seen from far enough out that a silhouette is all that lands.
 *
 * The third rung is also the first modelled anything that stands on a **merged
 * parcel**, which is a genuinely different footprint rather than a bigger one:
 * oblong, 6.8 by 2.8, and fixed in the world by which way the parcel runs. Two
 * rules follow from it and both live in this file — `jitterCap`, which bounds
 * the two axes against different amounts of land, and `modelFacing`, which
 * narrows an oblong model to the two quarter turns that lie along its parcel.
 *
 * Everything above is still massed, and that is the shape the ladder should
 * have: the rungs the game is played on get the geometry, and the rungs a
 * settled city has climbed to get proportions and dressing.
 */

/**
 * The zones whose first rung is modelled, which is now all of them.
 *
 * Kept as an alias rather than collapsed into `ZoneKind` at every use, because
 * what it *means* is "a zone this file has models for" — and the type is what
 * would catch a fourth zone arriving without any.
 */
export type ModelledKind = ZoneKind;

/**
 * Five models a rung, indexed `[kind][level][style]`.
 *
 * The level axis is a *prefix* of the ladder rather than a sparse map: a zone
 * models its rungs from the bottom up and stops, so the length of its row is
 * how far up it is modelled and everything past the end is massed. A hole in
 * the middle would be a fourth thing for `Buildings` to reason about and there
 * is no design in which one is wanted — a city whose second rung is modelled
 * and whose first is not would read as a district that got worse when it grew.
 */
const MODELS: Readonly<Record<ModelledKind, readonly (readonly (readonly ModelPart[])[])[]>> = {
  home: [
    [
      HOUSE_COTTAGE_PARTS,
      HOUSE_TERRACE_PARTS,
      HOUSE_VERANDA_PARTS,
      HOUSE_SEMI_PARTS,
      HOUSE_MODERN_PARTS,
    ],
    [
      WALKUP_CORE_PARTS,
      WALKUP_DECK_PARTS,
      WALKUP_MAISONETTE_PARTS,
      WALKUP_COURT_PARTS,
      WALKUP_MANSARD_PARTS,
    ],
    [
      TOWER_BALCONY_PARTS,
      TOWER_CROSSWALL_PARTS,
      TOWER_GALLERY_PARTS,
      TOWER_TERRACE_PARTS,
      TOWER_TWIN_PARTS,
    ],
  ],
  shop: [
    [
      SHOP_PARADE_PARTS,
      SHOP_FIN_PARTS,
      SHOP_ARCADE_PARTS,
      SHOP_MARKET_PARTS,
      SHOP_CAFE_PARTS,
    ],
  ],
  industry: [
    [
      INDUSTRY_SHED_PARTS,
      INDUSTRY_WORKS_PARTS,
      INDUSTRY_DOCK_PARTS,
      INDUSTRY_TANKS_PARTS,
      INDUSTRY_MILL_PARTS,
    ],
  ],
};

export const MODELLED_KINDS = Object.keys(MODELS) as readonly ModelledKind[];

/**
 * How many rungs from the bottom each zone draws from models.
 *
 * Three for housing and one for the other two. Read by `modelledAt`, which is
 * the only thing that should ever ask.
 */
export const MODEL_LEVELS: Readonly<Record<ModelledKind, number>> = {
  home: MODELS.home.length,
  shop: MODELS.shop.length,
  industry: MODELS.industry.length,
};

/**
 * Whether a zone draws this level from models rather than massing it.
 *
 * Takes a level off the bottom of the ladder only — a ruin is level -1 and is
 * drawn in the first rung's set by `Buildings`, which is that caller's business
 * rather than this table's.
 */
export const modelledAt = (kind: ModelledKind, level: number): boolean =>
  level >= 0 && level < MODEL_LEVELS[kind];

/**
 * How many models a zone is drawn from at every rung it models. Five each.
 *
 * One number per zone rather than one per rung, and that is load-bearing:
 * `modelStyleOf` draws a style from the slot and the seed *without* the level,
 * so a plot keeps its character as it climbs — the terrace that was style 1 is
 * the deck block that is style 1. It is the same contract `buildingStyle`
 * keeps for the massed rungs, and it only holds while every rung of a zone
 * offers the same number of styles to draw from, so that is asserted here
 * rather than left to hold by luck.
 */
export const MODEL_STYLES: Readonly<Record<ModelledKind, number>> = {
  home: stylesOf('home'),
  shop: stylesOf('shop'),
  industry: stylesOf('industry'),
};

function stylesOf(kind: ModelledKind): number {
  const styles = (MODELS[kind][0] as readonly (readonly ModelPart[])[]).length;
  for (const rung of MODELS[kind]) {
    if (rung.length !== styles) {
      throw new Error(`${kind} models ${styles} styles at one rung and ${rung.length} at another`);
    }
  }
  return styles;
}

/**
 * A table derived per (kind, level, style), which is the shape of every one.
 *
 * Written out a zone at a time rather than mapped over `MODELLED_KINDS`, which
 * is the same choice `MODELS` itself makes and for the same reason: a `Record`
 * built by `Object.fromEntries` is a `Record<string, T>` however it is cast, so
 * a fourth zone would arrive here silently. Three named keys make it a type
 * error, which is where this file wants to catch it.
 */
const rungsOf = <T>(
  make: (parts: readonly ModelPart[], kind: ModelledKind, level: number) => T,
): Readonly<Record<ModelledKind, readonly (readonly T[])[]>> => {
  const of = (kind: ModelledKind): readonly (readonly T[])[] =>
    MODELS[kind].map((rung, level) => rung.map((parts) => make(parts, kind, level)));
  return { home: of('home'), shop: of('shop'), industry: of('industry') };
};

/**
 * The materials that are lights rather than colours.
 *
 * A house has one, a shop has two — a shopfront glows and so does its sign —
 * and the mill has seven, five of them a sawtooth of north lights. They are
 * separate materials in the models even where the modeller gave them the same
 * sodium, which is the right way round: what makes them different things is
 * what they *are*, not what colour they came out.
 */
const LIT = new Set(['window-light', 'shopfront-light', 'shop-sign', 'bay-light']);

/** One lit box of a model, in the model's own coordinates. */
export interface LitBox {
  readonly at: readonly [number, number, number];
  readonly size: readonly [number, number, number];
}

/**
 * Every lit box a model carries, per zone, level and style.
 *
 * Pulled out of the model and handed to the *shared* band mesh in `PartBank`
 * rather than drawn by the model itself, and that is the trick that keeps this
 * at five meshes a rung. A merged vertex-coloured mesh can hold every colour a
 * building wears but it cannot hold a light: the night ramp is a property of a
 * material, and a vertex-colour merge has one material for the whole model. The
 * band was already a lit unit box that every other building in the city wears,
 * scaled per instance — so a modelled building wears its own lit pieces through
 * the mesh that already existed, and the ramp comes back for free.
 */
export const MODEL_LIT: Readonly<Record<ModelledKind, readonly (readonly (readonly LitBox[])[])[]>> =
  rungsOf(litOf);

function litOf(parts: readonly ModelPart[], kind: ModelledKind, level: number): readonly LitBox[] {
  const lit = parts.filter((part) => LIT.has(part.mtl));
  // Thrown rather than defaulted. A remodel that dropped every lit piece would
  // otherwise put a building on screen that is simply dark after dusk, which is
  // the kind of wrong nobody notices until a night shot.
  if (lit.length === 0) throw new Error(`a ${kind} model at level ${level} carries no lit part`);
  return lit.map((part) => {
    if (part.shape !== 'box') throw new Error(`a ${kind} model at level ${level} lights a non-box`);
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
  ...MODELLED_KINDS.flatMap((kind) =>
    MODEL_LIT[kind].flatMap((rung) => rung.map((lit) => lit.length)),
  ),
);

/** How far a model reaches, in its own coordinates. */
export interface ModelExtent {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

/**
 * How far each model reaches, per zone, level and style.
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
export const MODEL_EXTENT: Readonly<Record<ModelledKind, readonly (readonly ModelExtent[])[]>> =
  rungsOf(extentOf);

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
 * The widest a modelled building may come out on one plot, once jittered.
 *
 * The plot less the same kerb gutter a massed body leaves. `ZONE_SHAPES` sets
 * the massed widths against exactly this bound — industry holds 3.5 against a
 * style bound of 1.00 and a jitter of 1.12, so 3.92 — and a model has to answer
 * to it too, because a building wider than its plot renders through the kerb
 * and into the street.
 */
const MODEL_SPAN_MAX = CELL - 0.2;

/** The same, along a merged parcel: two plots, and the one gutter still. */
const MERGED_SPAN_MAX = 2 * CELL - 0.2;

/**
 * The most a model's footprint may be jittered, per zone, level and style.
 *
 * Bounded by the plot rather than by taste, which is the only thing that makes
 * the jitter safe to apply to a *model*: a house is 3.06 across at its widest
 * and could take twice the jitter it is given, but a works is 3.56 and 12% of
 * that is 3.99 on a 4-unit plot — a building touching both its kerbs. So the
 * cap is whatever fits, and it bites on exactly the rungs where it has to.
 *
 * **Which axis answers to which bound depends on the footprint**, and that is
 * the whole of what a merged rung changed here:
 *
 *   - **on one plot**, both axes answer to the same bound, because the model
 *     turns freely to face its street and whichever of its width and depth the
 *     quarter turn puts across the frontage is the one that has to clear the
 *     kerb — and which one that is depends on the plot;
 *   - **on a merged parcel**, neither axis is free. The parcel is oblong and
 *     the model is built to it, so its long span lies along the parcel and its
 *     short span across, at every turn the building can take. They answer to
 *     two plots and to one respectively, and taking the smaller of the two
 *     ratios is what keeps both true at once.
 *
 * It binds on the towers, which is the first time this has bound anywhere but
 * industry: the crosswall block is 7.08 along its parcel against a bound of
 * 7.8, so its jitter caps at 1.10 rather than the 1.12 it would otherwise take.
 */
export const MODEL_JITTER_MAX: Readonly<Record<ModelledKind, readonly (readonly number[])[]>> = {
  home: MODEL_EXTENT.home.map(capsFor),
  shop: MODEL_EXTENT.shop.map(capsFor),
  industry: MODEL_EXTENT.industry.map(capsFor),
};

function capsFor(rung: readonly ModelExtent[], level: number): readonly number[] {
  return rung.map((extent) => jitterCap(extent, (LEVEL_FOOTPRINT[level] ?? 1) > 1));
}

function jitterCap(extent: ModelExtent, merged: boolean): number {
  if (!merged) return MODEL_SPAN_MAX / Math.max(extent.width, extent.depth);
  return Math.min(MERGED_SPAN_MAX / extent.width, MODEL_SPAN_MAX / extent.depth);
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
 * The turns that keep a model's long axis along its parcel.
 *
 * A model is built facing +z with its long axis on x, so turns 0 and 2 leave
 * that axis on the world's x and turns 1 and 3 put it on z. A building on one
 * plot may take any of the four; one on a merged parcel may take only the two
 * that lie the right way, and picks its front from within them.
 */
const ALONG_X: readonly number[] = [0, 2];
const ALONG_Z: readonly number[] = [1, 3];
const ALL_TURNS: readonly number[] = [0, 1, 2, 3];

/**
 * Which way the building standing at a world position faces, in quarter turns.
 *
 * A corner plot has two streets and both are correct, so the seed picks: it is
 * the one place in the layout where a building has a genuine choice, and taking
 * the first every time would line every corner in the city up the same way.
 *
 * `alongX` narrows that choice to two for a building on a merged parcel: the
 * parcel is oblong, the model is built to it, and only the turns that lay its
 * long axis along the parcel put it inside its own land. A tower still faces a
 * street where one of those two fronts one — which is most of them, since a
 * parcel is two plots that each front a street — and where neither does, the
 * seed picks between them rather than always taking the first. Pass null for a
 * building on a single plot, which turns freely.
 *
 * Every sellable plot fronts a street by construction — `plotsFor` is defined
 * as exactly that — so the no-street miss is unreachable for a single plot, and
 * facing the model's own way is the formality that covers it.
 */
export function modelFacing(
  x: number,
  z: number,
  pick: number,
  alongX: boolean | null = null,
): number {
  const gx = cellX(x);
  const gz = cellZ(z);
  const turns = alongX === null ? ALL_TURNS : alongX ? ALONG_X : ALONG_Z;
  let found = 0;
  let turn = turns[0] as number;
  for (const q of turns) {
    const side = FACING[q] as { dx: number; dz: number };
    if (!isRoad(gx + side.dx, gz + side.dz)) continue;
    found++;
    // Reservoir sampling over the sides that are streets: one pass, no array,
    // and a uniform draw among however many a plot turns out to have.
    if (found === 1 || pick * found < 1) turn = q;
  }
  // A merged parcel's centre sits between two cells, so the road test either
  // side of it is a weaker question than it is for a plot — and a parcel in the
  // interior of a block can genuinely front no street on the axis it lies
  // along. Either way the building still has to point one of its two ways, and
  // the seed is what stops every such parcel pointing the same one.
  if (found === 0 && alongX !== null) turn = turns[pick < 0.5 ? 0 : 1] as number;
  return turn;
}

/**
 * One rung's five model meshes, packed per style.
 *
 * One `GrowableInstancedMesh` a style, merged by *vertex colour* rather than by
 * material — the choice the bus already makes, for the mirror of the bus's
 * reason. A vehicle merges by colour because a mesh per material multiplies the
 * renderer's hottest per-frame loop; these merge by colour because a mesh per
 * material multiplies the most numerous buildings in the city. Nine materials
 * across the houses, ten across the shops and nine across the works is 42, 44
 * and 43 draw calls for the three rungs a district is made of. Vertex colours
 * collapse each set to five, and the one thing a material could have given that
 * any of these parts needed — the night ramp on the lit pieces — is bought back
 * through the shared band mesh instead. See `MODEL_LIT`.
 *
 * One of these covers a single (zone, level), and a zone that models two rungs
 * owns two of them: the meshes are the *geometry*, and a walk-up shares nothing
 * with the house that was on the plot before it. What a slot keeps across the
 * promotion is its style index, which `modelStyleOf` draws without the level —
 * so the terrace becomes the deck block and stays recognisably that plot.
 *
 * Packed per style rather than per slot, so an instance index here has nothing
 * to do with a slot index — this class keeps the map both ways, exactly as
 * `PartBank` and `partAt` do between them. `slotOf` is what a raycast hit
 * resolves through and `indexOf` is what the growth animation rewrites through.
 *
 * **What this costs is triangles, not draw calls, and it is the largest single
 * cost in the renderer.** Measured (tools/lod.calibrate.mjs, part 1b) at 49
 * districts of nothing but first-rung buildings, which is the city the *first
 * rungs* make — a player who annexes widely and promotes little:
 *
 *     1,176 houses   266,904 triangles     (227 each)
 *     2,205 shops    564,024 triangles     (256 each)
 *       441 works    105,336 triangles     (239 each)
 *     massed, the same 3,822 would be 91,728 — a box and a roof each
 *
 * so the scene goes from 571,680 triangles to 1,416,216. It is 2.5x, 66% of
 * everything that city submits, and 1.2M of it is also in the shadow pass.
 * Commerce is most of it and industry is the least, and that is the *plot*
 * count rather than the models: a district carries 45 commercial plots against
 * 24 residential and 9 industrial once the eleventh square is taken out of the
 * works reserve, so the zone with the fewest buildings costs the least however
 * elaborate its models are.
 *
 * That is a real number and it is deliberately not hidden: the rungs the game is
 * played on are now the most expensive thing in it. Whether it *matters* is a
 * frame-time question this harness cannot answer — Node has no GPU — and 1.5M
 * triangles is not obviously too many for one. What it does mean is that the
 * next optimisation the renderer needs is almost certainly here rather than
 * anywhere else.
 *
 * Modelling housing's rungs above the first buys no new buildings, which is the
 * one thing worth knowing about their cost. A plot holds one building and a
 * parcel holds one building, so a district that climbs *trades* what it has:
 *
 *     1,176 houses     266,904 triangles     (  227 each)   part 1b
 *     1,176 walk-ups   407,184 triangles     (  346 each)   part 1c
 *       588 towers     840,120 triangles     (1,429 each)   part 1d
 *
 * The walk-ups are a straight swap on the same plots — +140,280, which is 52.6%
 * on the housing and 11.3% on the whole scene, 1,416,216 to 1,575,768.
 *
 * The towers are the interesting one, and they are the reason this note exists
 * rather than a rule of thumb. A tower is **4.13x** the model a walk-up is —
 * they are the largest models in the city, 67 to 241 boxes against a house's 17
 * to 23 — but promotion to that rung is the *merge*, so 1,176 walk-ups become
 * 588 towers. Halving the count against quadrupling the model leaves the rung
 * costing 2.06x the one below it: +432,936, rather than the +2.4M a naive
 * reading of the model size would predict. The merge is what makes a model that
 * size affordable at all, and it is why the rungs above — which merge too, but
 * are seen from further out — are the wrong place to spend the same again.
 *
 * Two moves are available and neither is made, so the reasoning survives:
 *
 *   - **Split each style into a casting half and a flat half**, keeping the
 *     second out of the depth pass the way `setDressingShadows` already does
 *     for awnings and roof vents. Most of these triangles throw no shadow
 *     anybody can see — a window 6cm proud of a wall, a forecourt 6cm off the
 *     ground, a hazard marking painted on an apron. It costs a second mesh per
 *     style: thirty instead of fifteen, which is the whole of the saving the
 *     vertex-colour merge just bought.
 *   - **Give each style a silhouette geometry and let `DetailMask` choose**,
 *     dropping the street furniture — a shop's crates, tables and bollards and
 *     a works's pallets and tank bands are a fifth of a metre across and
 *     sub-pixel from the orbit camera. This is the bigger win and the bigger
 *     change: it is a second mesh per style *and* instances moving between the
 *     two on every repack.
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
    level: number,
    capacity: number,
  ) {
    const models = MODELS[kind][level] as readonly (readonly ModelPart[])[];
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
          { castShadow: true, receiveShadow: true, name: `model:${kind}:${level}:${style}` },
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
