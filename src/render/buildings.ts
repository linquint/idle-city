import * as THREE from 'three';
import { hash01, mixSeed } from '../core/rng.ts';
import {
  CELL,
  CIVIC_SERVICES,
  LANDMARKS,
  LEVEL_FOOTPRINT,
  LEVELS,
  SEED,
  SERVICES,
  type Landmark,
  type Service,
} from '../sim/config.ts';
import { ZONE, type Zone } from '../sim/citygen.ts';
import {
  cohortStart,
  cohortTotal,
  countOf,
  levelAt,
  levelsOf,
  mergedOf,
  zoneOf,
} from '../sim/economy.ts';
import {
  DISTRICT_WIDTH,
  EMPTY_ZONING,
  type Zoning,
  cityCentre,
  cityRadius,
  createPlacement,
  districtCoord,
  worldX,
  worldZ,
  type CityLayout,
  type Coord,
  type Placement,
} from '../sim/layout.ts';
import type { GameState, LevelCohort, ZoneKind } from '../sim/state.ts';
import { Glow } from './glow.ts';
import { GrowableInstancedMesh, SlotRanges } from './growable.ts';
import { GrowthSchedule } from './growth.ts';
import { PALETTE } from './palette.ts';
import {
  HOSPITAL_PARTS,
  FIRE_STATION_PARTS,
  BUS_DEPOT_PARTS,
  POLICE_STATION_PARTS,
  MUSEUM_PARTS,
  STADIUM_PARTS,
  SCHOOL_PARTS,
  CAMPUS_PARTS,
} from './civicModels.ts';
import { mergeByMaterial, type ModelPart } from './model.ts';
import {
  MODEL_EXTENT,
  MODEL_JITTER_MAX,
  MODEL_LIT,
  MODEL_LIT_MAX,
  MODEL_STYLES,
  MODELLED_KINDS,
  type ModelExtent,
  modelledAt,
  ModelMeshes,
  QUARTER,
  modelFacing,
  type LitBox,
  type ModelledKind,
} from './modelled.ts';
import { Scaffold } from './scaffold.ts';
import type { OverlaySource } from './zones.ts';

const GROW_SECONDS = 0.55;
const GROW_SECONDS_REDUCED = 0.12;

/** Most buildings that arrive at once are animated; a huge backlog is capped. */
const WAVE_BUDGET = 320;

/**
 * How many construction cages can stand at once.
 *
 * Three waves, because there are three zone ladders and each caps a single
 * `stage` at WAVE_BUDGET — so the worst frame the game can produce is a
 * twelve-hour catch-up landing a full wave in all three at once. It is bounded
 * by the *budget*, never by the city: a 49-district map with 4,000 buildings
 * standing draws no more cages than the first district does, because a settled
 * building is not in `GrowthSchedule`'s active set and has nothing to draw.
 */
const SCAFFOLD_CAPACITY = WAVE_BUDGET * 3;

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The long side of a building standing on a merged parcel, in world units.
 *
 * Two plots less the same kerb gutter every other building leaves, so a tower
 * spans its whole parcel rather than reading as two boxes touching. The short
 * side stays the level's own width, which is what makes a merged building
 * legible as one thing at a glance: nothing else in the city is oblong.
 */
const MERGED_SPAN = 2 * CELL - 1.2;

/**
 * Everything that makes one building look unlike its neighbour, from its slot.
 *
 * A pure function of the slot index and the seed, and that is the whole design:
 * nothing here is stored, so a save is still counts, a building keeps its own
 * proportions forever, and changing SEED reshuffles the city's character along
 * with its streets. The alternative — a variant field per building — would put
 * the look of the city in the save file, which is the one thing this codebase
 * will not do.
 */
const variety = (slot: number, salt: number): number => hash01(mixSeed(SEED, slot * 31 + salt));

/** Per-building height jitter. A uniform skyline reads as a spreadsheet. */
const heightJitter = (i: number): number => 0.82 + hash01(i ^ 0x5bf03635) * 0.42;

/** Per-building concrete shade, so the mass does not flatten out. */
const shade = (i: number): number => 0.84 + hash01(i ^ 0x2545f491) * 0.28;

/**
 * Per-building footprint jitter, +-12% on each axis independently.
 *
 * Independent axes rather than one scalar, so a terrace comes out of a mix of
 * narrow-deep and wide-shallow plots rather than of big and small copies of one
 * box. It is applied to the *scale* of an instance, which costs nothing: the
 * geometry is shared and the matrix was being written anyway.
 */
const widthJitter = (slot: number): number => 0.88 + variety(slot, 0x11) * 0.24;
const depthJitter = (slot: number): number => 0.88 + variety(slot, 0x27) * 0.24;

/** The top of each jitter's range, which is what the plot bound is checked at. */
const JITTER_MAX = 1.12;
const HEIGHT_JITTER_MAX = 1.24;

/**
 * Whether a building is drawn from a model rather than massed from the ladder.
 *
 * The first rung of every zone and the second of housing, plus the ruins, which
 * are drawn in the first rung's set because a boarded-up plot still holds a
 * plot. Everything above is a box with dressing on it.
 *
 * The kind decides as much as the level now — housing models two rungs and the
 * other two zones model one — so this delegates the "how far up" half to
 * `modelledAt` in `modelled.ts`, where the tables that answer it live. A zone
 * arriving without a table of models is a type error there.
 *
 * A ruin is level -1 and is folded onto the first rung here rather than in
 * `modelledAt`, because that is a fact about how `Buildings` draws a boarded-up
 * plot rather than about which rungs have models. See `modelLevel`.
 *
 * A predicate rather than a field on `LevelShape`, because what it selects is
 * not a *shape* — it is which of two write paths a building takes, and the two
 * have different meshes, different bookkeeping and different jitter.
 */
const modelled = (kind: ZoneKind, level: number): boolean =>
  (MODELLED_KINDS as readonly string[]).includes(kind) &&
  modelledAt(kind as ModelledKind, Math.max(0, level));

/**
 * Which rung's models draw a building at this level.
 *
 * The level itself, except for a ruin: level -1 is drawn from the first rung's
 * set, because a boarded-up plot is still a plot and the alternative is a mesh
 * set that exists only to draw dark buildings. A ruined walk-up therefore
 * reverts to a house on the way down, which is the one visible consequence and
 * the right one — a ruin is a plot the city lost, and losing the building it
 * had climbed to is what that should look like.
 */
const modelLevel = (level: number): number => Math.max(0, level);

/**
 * Per-building height jitter for a model, deliberately a fifth of a block's.
 *
 * A box has no proportions to break, so the massed rungs take 0.82 to 1.24 and
 * read as a skyline. A model does: it has a roof pitch, a chimney, a fascia and
 * a door at a door's height, and stretching one 24% taller is not a taller
 * building — it is the same building drawn wrong. The five silhouettes a zone
 * are where a street's variety comes from now, so this only has to stop a
 * terrace or a parade from being a ruler.
 */
const modelHeightJitter = (slot: number): number => 0.94 + variety(slot, 0x6b) * 0.12;
const MODEL_HEIGHT_JITTER_MAX = 1.06;

/**
 * A modelled building's footprint jitter, clamped by the plot it stands on.
 *
 * The same +-12% every massed body takes, capped at whatever its own model can
 * afford — see `MODEL_JITTER_MAX`. The cap is a no-op for a house and a shop
 * and binds on industry, which is the widest thing on the map and has the least
 * room to grow.
 */
const modelWidthJitter = (kind: ModelledKind, level: number, slot: number): number =>
  Math.min(widthJitter(slot), cap(kind, level, slot));
const modelDepthJitter = (kind: ModelledKind, level: number, slot: number): number =>
  Math.min(depthJitter(slot), cap(kind, level, slot));

const cap = (kind: ModelledKind, level: number, slot: number): number =>
  (MODEL_JITTER_MAX[kind][modelLevel(level)] as readonly number[])[
    modelStyleOf(kind, slot)
  ] as number;

/**
 * Which way a modelled building turns to face its street, in quarter turns.
 *
 * Salted per zone like the style is, so a shop and a house on facing corners of
 * the same junction do not both take the same side of their identical choice.
 */
const MODEL_TURN_SALT: Readonly<Record<ModelledKind, number>> = {
  home: 0x8f,
  shop: 0xb3,
  industry: 0x2d,
};

/**
 * `alongX` for a placement, or null where the building turns freely.
 *
 * A merged parcel is oblong and a model built to it has to lie along it — see
 * `modelFacing`. `plots` rather than `parcelPlots` is the question, because
 * what constrains the turn is the land the building *covers* now: a level-2
 * walk-up standing on a pair that has not merged yet is still on one plot and
 * still turns freely.
 */
const modelAxis = (at: Placement): boolean | null => (at.plots > 1 ? at.alongX : null);

const modelTurn = (kind: ModelledKind, at: Placement, slot: number): number =>
  modelFacing(at.x, at.z, variety(slot, MODEL_TURN_SALT[kind]), modelAxis(at));

/** A quarter turn applied to a model-space offset, exactly. */
function turnXZ(
  x: number,
  z: number,
  turn: number,
  out: { x: number; z: number },
): { x: number; z: number } {
  out.x = turn === 0 ? x : turn === 1 ? z : turn === 2 ? -x : -z;
  out.z = turn === 0 ? z : turn === 1 ? -x : turn === 2 ? -z : x;
  return out;
}

const SCRATCH_TURN = { x: 0, z: 0 };

/** A slight warm/cool tint per building, on top of the shade. */
const tintJitter = (slot: number): number => 0.94 + variety(slot, 0x3d) * 0.12;

const targetColor = new THREE.Color();
const materialColor = new THREE.Color();

/**
 * The instance colour that makes a mesh render as `target` even though its
 * material is already tinted `material` — the shader multiplies the two, so a
 * zone colour laid straight over the dark shop blue comes out near black.
 * Dividing it back out is what keeps the overlay legible on every mesh.
 */
function against(target: number, material: number, out: THREE.Color): THREE.Color {
  targetColor.setHex(target);
  materialColor.setHex(material);
  const ratio = (t: number, m: number): number => Math.min(t / Math.max(m, 0.02), 6);
  return out.setRGB(
    ratio(targetColor.r, materialColor.r),
    ratio(targetColor.g, materialColor.g),
    ratio(targetColor.b, materialColor.b),
  );
}

/**
 * Lit unit boxes one building may wear, and the index slots reserved for them.
 *
 * Two is what a *massed* style wears: lit floor bands up the body, and no style
 * has ever wanted a third. A *modelled* building wears its model's own lit
 * pieces through the same mesh — a shopfront and a sign, and on two of the five
 * shops a projecting fin or a menu board as well — so the models can want more,
 * and the reserved stride has to be whichever is larger.
 *
 * Derived rather than typed for exactly that reason: `PART_SLOTS` is a fixed
 * stride the growth animation indexes into long after the pack order was
 * decided, so a remodel that adds a second sign to a style must widen it. A
 * constant here would instead drop the sign silently.
 */
const BANDS_MAX = Math.max(2, MODEL_LIT_MAX);

/**
 * The shared detail bank: eight unit shapes, instanced, worn by every zone and
 * every level.
 *
 * Shared is the point, and it is the whole reason the massed variants cost a
 * handful of meshes rather than one apiece. Three styles across five levels and
 * three zones would be forty-five growable meshes and forty-five draw calls for
 * what is fundamentally the same box — so instead every shape here is a *unit*
 * shape and the building's own proportions arrive as an instance scale, the
 * same way a building's jitter does. Eight meshes total, whatever the city is
 * made of.
 *
 * It was nine until housing's first rung was modelled. The hipped cone in it
 * was worn by exactly one thing — a level-1 house, which is what made a
 * detached house read as a house — and the five models carry their own roofs,
 * so the shape had no wearer left. See `ModelMeshes`.
 *
 * Instances are packed per part rather than per building, so an instance index
 * here has nothing to do with a slot index — `Buildings` keeps the map, in
 * `partAt`. Two of the eight are lit and ramp with the daylight cycle, and one
 * of those two is what a modelled house borrows for its own lit band.
 */
const PART = {
  flat: 0,
  parapet: 1,
  awning: 2,
  stack: 3,
  setback: 4,
  plant: 5,
  /** A lit floor band girdling the body. Glow material, so it ramps at dusk. */
  band: 6,
  /** The aircraft warning light tall levels carry. Glow material. */
  beacon: 7,
} as const;

const PART_COUNT = 8;

/**
 * Index slots reserved per building, in the order `writeParts` fills them:
 * roof, awning, stack, setback, plant, two bands, beacon.
 *
 * A fixed stride rather than a list, because the growth animation rewrites one
 * slot at a time long after the pack order was decided and has to find the same
 * instances again. -1 means the building does not wear that part.
 */
const PART_SLOTS = 5 + BANDS_MAX + 1;

/**
 * What one level of one zone is, before a style or a jitter touches it.
 *
 * These used to be fields on `Tier` in sim config, which was the wrong home for
 * them: a footprint width and a roof pitch change nothing the simulation can
 * observe. The capacities they sat beside are still simulation and stayed there
 * as LEVEL_CAPACITY; the geometry is the renderer's business and lives here.
 *
 * One row per level per zone, and the body geometry is built from it — so this
 * is the *only* thing that costs a mesh. Everything else a building can look
 * like is an instance scale on top. See `BuildStyle`.
 */
interface LevelShape {
  /** Footprint width in world units (must stay under CELL once jittered). */
  readonly width: number;
  readonly height: number;
  /** Depth as a share of the width. Industry is oblong; the rest are square. */
  readonly depth: number;
  /** Tall levels get an aircraft warning light, which is what sells their scale. */
  readonly beacon: boolean;
}

/**
 * The ladder, drawn. Five rungs a zone, and the shape of each is what the zone
 * is trying to say.
 *
 * Housing climbs on *height*: 1.6 to 30 world units, which is the whole of how
 * a district reads as having grown. Commerce climbs too but stays well under
 * housing at every rung — 2.4 to 8.0 against 1.6 to 30 — because height is
 * housing's signal and a shop that competed on it would read as a stunted
 * apartment block. Industry barely climbs at all and holds one width: it is the
 * anti-tower, wide and low, and its levels show in the plant on the roof rather
 * than in the silhouette.
 *
 * Widths are bounded by the plot, and that bound is what sets them rather than
 * taste: `widthJitter` reaches 1.12 and a style's own multiplier is at most
 * 1.10, so a body can come out at width x 1.23 and has to stay under CELL (4)
 * or it crosses its own kerb. Housing tops out at 3.1 x 1.10 x 1.12 = 3.82 and
 * industry holds 3.5 against a style bound of 1.00, so 3.92 — which is why the
 * industrial styles differ in height and plant rather than in width, and why
 * industry is still the widest thing on the map. Asserted in
 * test/skyline.test.ts, along with the ordering.
 *
 * The top rung was checked for slenderness rather than assumed. The tallest
 * body the ladder can produce is the housing slab at level 4: 27 x 1.12 (its
 * style) x 1.24 (its jitter) = 37.5 tall. It stands on a merged parcel, so the
 * side actually seen is 37.5 against MERGED_SPAN's 6.8 — an aspect of 5.5,
 * against the arcology below it at 4.5. The ladder gets slenderer as it climbs,
 * which is what a ladder of towers should do, and it stops well short of a
 * needle. A height of 30 was measured first and came out at 6.1.
 */
const ZONE_SHAPES: Readonly<Record<ZoneKind, readonly LevelShape[]>> = {
  home: [
    // **Housing is modelled at every rung, so not one width or height in this
    // row is drawn.** They stay for three reasons and it is worth being precise
    // about which, because a row of dead numbers invites someone to change one:
    //
    //   - `LEVELS` indexes straight into this array, and the ladder's shape is
    //     stated here;
    //   - `beacon` is live. `writeModelParts` reads it off this row to decide
    //     whether a modelled building carries a warning light, so the flags in
    //     the last three entries are load-bearing where the numbers beside them
    //     are not;
    //   - the models were *built* to these numbers, one rung at a time — a
    //     house's body is 2.2 x 1.6 x 2.2, a walk-up's 2.6 x 4.6, and the three
    //     merged rungs are MERGED_SPAN by 11.5, 22 and 27. The row is the brief
    //     the modeller worked to, so changing one here now means re-exporting a
    //     model rather than moving a building.
    //
    // What a housing rung is actually bounded by is its models' own reach: see
    // `bodyExtent`, which takes this branch for every level of this zone.
    { width: 2.2, height: 1.6, depth: 1, beacon: false },
    { width: 2.6, height: 4.6, depth: 1, beacon: false },
    { width: 2.8, height: 11.5, depth: 1, beacon: true },
    { width: 3.0, height: 22.0, depth: 1, beacon: true },
    { width: 3.1, height: 27.0, depth: 1, beacon: true },
  ],
  shop: [
    // Modelled, like housing's first rung and for the same reason — see the
    // note on `home` above. Every one of the five shops is built to a 3.0-wide
    // shell, so the row is still what the ladder steps from.
    { width: 3.0, height: 2.4, depth: 1, beacon: false },
    { width: 3.0, height: 3.2, depth: 1, beacon: false },
    { width: 3.1, height: 4.4, depth: 1, beacon: false },
    { width: 3.2, height: 6.0, depth: 1, beacon: false },
    { width: 3.2, height: 8.0, depth: 1, beacon: true },
  ],
  industry: [
    { width: 3.5, height: 1.3, depth: 0.86, beacon: false },
    { width: 3.5, height: 1.7, depth: 0.86, beacon: false },
    { width: 3.5, height: 2.2, depth: 0.86, beacon: false },
    { width: 3.5, height: 2.8, depth: 0.86, beacon: false },
    { width: 3.5, height: 3.4, depth: 0.86, beacon: false },
  ],
};

/**
 * A style is a parameter set, not a mesh.
 *
 * Five levels x three styles x three zones is 45 variants, and as meshes that
 * would be 45 draw calls for what is fundamentally the same box. So a style
 * changes only things an *instance* can carry — proportions, a colour band,
 * how many lit window bands it wears, and which of the shared detail parts it
 * puts on — and the level's own `LevelShape` is the geometry underneath it.
 * 45 looks, 15 bodies.
 *
 * Chosen by `hash(slot, SEED)` and never stored: a save is still counts, a
 * building keeps its own character forever, and changing SEED reshuffles the
 * city's look along with its streets.
 */
interface BuildStyle {
  /** What the panel would call it. Not shown anywhere; it names the row. */
  readonly name: string;
  /** Multipliers on the level's own footprint and height. */
  readonly width: number;
  readonly height: number;
  /** A colour band: a multiplier on the body's instance colour. */
  readonly tint: number;
  /** Roof shape from the shared bank. Not worn by modelled level-1 housing. */
  readonly roof: number;
  /** Street-level overhang, as a share of the footprint. 0 = not worn. */
  readonly awning: number;
  /** Mast or chimney, as a share of the body height. 0 = not worn. */
  readonly stack: number;
  /** Stepped upper block, as a share of the body height. 0 = not worn. */
  readonly setback: number;
  /** Rooftop equipment, as a share of the footprint. 0 = not worn. */
  readonly plant: number;
  /** Lit window bands up the body, at most BANDS_MAX. */
  readonly bands: number;
}

/**
 * Three styles a zone, and the three are meant to be told apart in silhouette
 * before colour: something plain, something stepped, and something with kit on
 * it. Read a street of one zone and it should look built over time rather than
 * stamped.
 */
const ZONE_STYLES: Readonly<Record<ZoneKind, readonly BuildStyle[]>> = {
  home: [
    // The baseline. A plain block with one lit floor band. It is never seen at
    // level 1, which is modelled — a style here first shows at level 2.
    { name: 'terrace', width: 1.0, height: 1.0, tint: 1.0, roof: PART.flat,
      awning: 0, stack: 0, setback: 0, plant: 0, bands: 1 },
    // Wider and shorter, stepping back near the top, with a little plant on the
    // set-back roof. The one that reads as a block of flats at every rung.
    { name: 'stepped', width: 1.1, height: 0.9, tint: 0.9, roof: PART.parapet,
      awning: 0, stack: 0, setback: 0.24, plant: 0.34, bands: 1 },
    // Narrow and tall with a mast and a canopy over the entrance. The one that
    // makes a run of towers read as a skyline rather than as a comb.
    { name: 'slab', width: 0.9, height: 1.12, tint: 1.1, roof: PART.flat,
      awning: 0.3, stack: 0.12, setback: 0, plant: 0, bands: 2 },
  ],
  shop: [
    // A canvas skirt at street level. The old default, kept as a style. Like
    // every style here it first shows at level 2: level 1 is modelled.
    { name: 'canopy', width: 1.0, height: 1.0, tint: 1.0, roof: PART.flat,
      awning: 0.4, stack: 0, setback: 0, plant: 0, bands: 1 },
    // A sign board standing above the roofline, turned onto the long axis so a
    // merged shop wears one long sign rather than two short ones.
    { name: 'fin', width: 0.96, height: 1.06, tint: 1.08, roof: PART.parapet,
      awning: 0, stack: 0.5, setback: 0, plant: 0, bands: 1 },
    // Deep and low, stepped back over a shallow arcade, with plant on the roof.
    { name: 'arcade', width: 1.08, height: 0.94, tint: 0.92, roof: PART.parapet,
      awning: 0.22, stack: 0, setback: 0.2, plant: 0.32, bands: 2 },
  ],
  industry: [
    // A shed with one tall stack. The old default.
    { name: 'shed', width: 1.0, height: 1.0, tint: 1.0, roof: PART.flat,
      awning: 0, stack: 1.35, setback: 0, plant: 0.7, bands: 0 },
    // Taller and narrower, with a stepped block and the tallest stack. The one
    // that reads as a works rather than as a warehouse.
    { name: 'works', width: 0.92, height: 1.2, tint: 0.9, roof: PART.parapet,
      awning: 0, stack: 1.9, setback: 0.2, plant: 0.4, bands: 1 },
    // Low and sprawling, loading canopy down one side, kit everywhere.
    { name: 'yard', width: 0.98, height: 0.88, tint: 1.1, roof: PART.flat,
      awning: 0.3, stack: 0.9, setback: 0, plant: 1.1, bands: 0 },
  ],
};

const STYLES_PER_ZONE = 3;

/** A per-zone salt, so the three zones do not all pick style 2 on slot 7. */
const ZONE_SALT: Readonly<Record<ZoneKind, number>> = {
  home: 0x53,
  shop: 0x61,
  industry: 0x95,
};

/**
 * Which of its zone's three styles a building wears.
 *
 * Exported so the tests can assert the one property that matters about it: it
 * is a pure function of the slot and the seed, and it is nowhere in the save.
 *
 * A pure function of the slot and the seed and nothing else — not of the level,
 * so a building keeps its character as it climbs, and not of anything in the
 * save, so there is nothing to store. `variety` already mixes SEED in.
 */
export function buildingStyle(kind: ZoneKind, slot: number): number {
  return Math.min(STYLES_PER_ZONE - 1, Math.floor(variety(slot, ZONE_SALT[kind]) * STYLES_PER_ZONE));
}

/** A per-zone salt, so a house and a shop on slot 7 are not both style 2. */
const MODEL_SALT: Readonly<Record<ModelledKind, number>> = {
  home: 0xd7,
  shop: 0x4e,
  industry: 0x1b,
};

/**
 * Which of its zone's five models a plot's modelled building is.
 *
 * The same contract `buildingStyle` keeps, for the same reasons: a pure
 * function of the slot and the seed, so a building keeps its character forever,
 * changing SEED reshuffles the street along with the streets, and there is
 * nothing to store — a save is still counts. Exported so the tests can assert
 * exactly that, and that all five are actually reached.
 *
 * Not a function of the *level* either, which is the same half of the contract
 * and now has something to say: housing models two rungs, and a plot draws the
 * same style index at both — the terrace becomes the deck block and stays
 * recognisably that plot through the promotion. `MODEL_STYLES` is one number a
 * zone rather than one a rung so that this can hold, and asserts it.
 *
 * Its own salt rather than `buildingStyle`'s, so which model a plot gets and
 * which massed style it takes when it climbs off the modelled rungs are
 * independent draws rather than the same draw read twice.
 */
export function modelStyleOf(kind: ModelledKind, slot: number): number {
  const styles = MODEL_STYLES[kind];
  return Math.min(styles - 1, Math.floor(variety(slot, MODEL_SALT[kind]) * styles));
}

function styleOf(kind: ZoneKind, slot: number): BuildStyle {
  const styles = ZONE_STYLES[kind];
  return styles[buildingStyle(kind, slot)] ?? (styles[0] as BuildStyle);
}

/**
 * The widest and tallest a body of one zone and level can come out, over every
 * style and the whole jitter range.
 *
 * Exported for the tests rather than used here: the bound it reports is the one
 * that stops a building crossing its own kerb, and a bound nothing checks is a
 * bound that quietly stops holding the next time a style is added.
 */
export function bodyExtent(kind: ZoneKind, level: number): { width: number; height: number } {
  // The modelled rung is bounded by its models rather than by its row, and by
  // the larger of each model's two horizontal spans: a house turns to face its
  // street, so the side that ends up across the frontage is whichever of its
  // width and depth the quarter turn put there.
  if (modelled(kind, level)) {
    const rung = modelLevel(level);
    const caps = MODEL_JITTER_MAX[kind as ModelledKind][rung] as readonly number[];
    // What this reports is the span across the *frontage*, which is the one the
    // kerb bounds — the same quantity the massed branch below reports, where a
    // merged body's stretch along its parcel is likewise not counted.
    //
    // For a single-plot model that is whichever span the turn puts there, and
    // either can be. For a merged one it is always the depth: the model is
    // built to an oblong parcel and lies along it at every turn it can take,
    // so its long span is never the one facing the street. `jitterCap` is what
    // bounds that long span, against two plots rather than one.
    const merged = (LEVEL_FOOTPRINT[level] ?? 1) > 1;
    let width = 0;
    let height = 0;
    (MODEL_EXTENT[kind as ModelledKind][rung] as readonly ModelExtent[]).forEach((model, style) => {
      const span = merged ? model.depth : Math.max(model.width, model.depth);
      width = Math.max(width, span * Math.min(JITTER_MAX, caps[style] as number));
      height = Math.max(height, model.height * MODEL_HEIGHT_JITTER_MAX);
    });
    return { width, height };
  }
  const shape = shapeOf(kind, level);
  let width = 0;
  let height = 0;
  for (const style of ZONE_STYLES[kind]) {
    width = Math.max(width, shape.width * style.width * JITTER_MAX);
    height = Math.max(height, shape.height * style.height * HEIGHT_JITTER_MAX);
  }
  return { width, height };
}

/** The model a slot's building is drawn from at a modelled rung. */
const modelOf = (kind: ModelledKind, level: number, slot: number): ModelExtent =>
  (MODEL_EXTENT[kind][modelLevel(level)] as readonly ModelExtent[])[
    modelStyleOf(kind, slot)
  ] as ModelExtent;

const shapeOf = (kind: ZoneKind, level: number): LevelShape => {
  const shapes = ZONE_SHAPES[kind];
  return shapes[Math.max(0, Math.min(shapes.length - 1, level))] ?? (shapes[0] as LevelShape);
};

/**
 * Which roof a building wears.
 *
 * The style decides, and there is no longer an override: it used to say that
 * level-1 housing takes a pitch whatever its style, because a pitched roof is
 * what makes a detached house read as a house. That rung is modelled now and
 * carries its own roof, so the rule went with it. A ruin wears the flattest
 * thing in the bank — whatever it had is gone.
 */
function roofOf(level: number, style: BuildStyle): number {
  return level < 0 ? PART.flat : style.roof;
}

class PartBank {
  private readonly meshes: readonly GrowableInstancedMesh[];
  private readonly counts = new Int32Array(PART_COUNT);
  private readonly glows: readonly Glow[];

  constructor(scene: THREE.Scene, capacity: number) {
    const lambert = (color: number): THREE.Material => new THREE.MeshLambertMaterial({ color });
    const unit = (): THREE.BufferGeometry => new THREE.BoxGeometry(1, 1, 1);
    // Unit shapes: 1 x 1 x 1 before the instance scale, so one geometry covers a
    // shopfront parapet and a megastructure parapet alike.
    // A band is nearly invisible at midday and most of what a street reads as
    // after dark; a warning light gets the lowest floor of the lit surfaces.
    const bandGlow = new Glow(PALETTE.sodium, 0.42);
    const beaconGlow = new Glow(PALETTE.sodium, 0.3);
    this.glows = [bandGlow, beaconGlow];
    const meshes: GrowableInstancedMesh[] = [];
    meshes[PART.flat] = new GrowableInstancedMesh(
      scene, new THREE.BoxGeometry(0.62, 1, 0.62), lambert(PALETTE.parapet), capacity,
      { castShadow: true, name: 'part:flat' },
    );
    meshes[PART.parapet] = new GrowableInstancedMesh(
      scene, new THREE.BoxGeometry(1.04, 1, 1.04), lambert(PALETTE.parapet), capacity,
      { castShadow: true, name: 'part:parapet' },
    );
    meshes[PART.awning] = new GrowableInstancedMesh(scene, unit(), lambert(PALETTE.awning), capacity, {
      castShadow: true,
      name: 'part:awning',
    });
    meshes[PART.stack] = new GrowableInstancedMesh(scene, unit(), lambert(PALETTE.stack), capacity, {
      castShadow: true,
      name: 'part:stack',
    });
    meshes[PART.setback] = new GrowableInstancedMesh(scene, unit(), lambert(PALETTE.concrete), capacity, {
      castShadow: true,
      name: 'part:setback',
    });
    meshes[PART.plant] = new GrowableInstancedMesh(scene, unit(), lambert(PALETTE.vent), capacity, {
      castShadow: true,
      name: 'part:plant',
    });
    meshes[PART.band] = new GrowableInstancedMesh(scene, unit(), bandGlow.material, capacity, {
      name: 'part:band',
    });
    meshes[PART.beacon] = new GrowableInstancedMesh(scene, unit(), beaconGlow.material, capacity, {
      name: 'part:beacon',
    });
    this.meshes = meshes;
  }

  setNight(night: number): void {
    for (const glow of this.glows) glow.setNight(night);
  }

  /**
   * Puts the dressing in or out of the shadow pass.
   *
   * The awning, the stack, the setback and the plant, and not the roofs: a roof
   * is the top of a building's silhouette, so a shadow without one is a
   * flat-topped shadow of a pitched house. The bands and the beacon are glow
   * materials and were never in the pass.
   *
   * Measured at 49 districts fully built: the four are 7,013 of the 16,396
   * casting instances and 84,156 of the 193,528 casting triangles — 43% of the
   * shadow pass, thrown by a canopy at knee height and a vent on a roof. See
   * SHADOW_STEPS, which is what decides when to spend it.
   */
  setDressingShadows(on: boolean): void {
    for (const part of [PART.awning, PART.stack, PART.setback, PART.plant]) {
      this.meshes[part]?.setCastShadow(on);
    }
  }

  /** States what the bank covers, so its nine meshes can be frustum-culled. */
  setBounds(x: number, z: number, reach: number, top: number): void {
    for (const mesh of this.meshes) mesh?.setBounds(x, z, reach, top);
  }

  /** Starts a rebuild. Every part's instance list is written from scratch. */
  begin(): void {
    this.counts.fill(0);
  }

  /** Appends one part and hands back the instance index it landed on. */
  place(part: number, matrix: THREE.Matrix4, color: THREE.Color | null): number {
    const mesh = this.meshes[part];
    if (!mesh) return -1;
    const index = this.counts[part] ?? 0;
    this.counts[part] = index + 1;
    mesh.ensure(index + 1);
    mesh.setMatrixAt(index, matrix);
    if (color) mesh.setColorAt(index, color);
    return index;
  }

  /** Rewrites one part already placed. Used by the growth animation. */
  move(part: number, index: number, matrix: THREE.Matrix4): void {
    if (index < 0) return;
    this.meshes[part]?.setMatrixAt(index, matrix);
  }

  end(): void {
    for (let p = 0; p < PART_COUNT; p++) {
      const mesh = this.meshes[p];
      if (!mesh) continue;
      mesh.count = this.counts[p] ?? 0;
      mesh.flush();
    }
  }

  flush(): void {
    for (const mesh of this.meshes) mesh.flush();
  }
}

/** The material colour a zone's bodies are made of. */
const ZONE_COLOR: Readonly<Record<ZoneKind, number>> = {
  home: PALETTE.concrete,
  shop: PALETTE.shop,
  industry: PALETTE.industry,
};

/**
 * One InstancedMesh per (zone, level). Fifteen in the city, and the only meshes
 * the ladder costs.
 *
 * A level's buildings are a *contiguous run of slots* — the oldest hold the
 * highest levels — so each mesh draws one range and a promotion is a range
 * boundary moving by one. Instance index and slot index are therefore different
 * numbers, and every per-building hash below takes the slot: a building's style,
 * height jitter and shade must not change when the cohort under it shifts.
 */
class BodyMeshes {
  readonly mesh: GrowableInstancedMesh;

  constructor(
    scene: THREE.Scene,
    readonly kind: ZoneKind,
    readonly level: number,
    capacity: number,
  ) {
    const shape = shapeOf(kind, level);
    this.mesh = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(shape.width, shape.height, shape.width * shape.depth),
      new THREE.MeshLambertMaterial({ color: ZONE_COLOR[kind] }),
      capacity,
      { castShadow: true, receiveShadow: true, name: `${kind}:${level}` },
    );
  }

  ensure(capacity: number): void {
    this.mesh.ensure(capacity);
  }

  setCount(n: number): void {
    this.mesh.count = n;
  }

  flush(): void {
    this.mesh.flush();
  }
}

/**
 * The colour of one building.
 *
 * The instance colour multiplies the material, so white is the identity and
 * every jitter is a nudge either side of it. The style's own band is one of
 * those nudges, which is what makes a run of one style read as a run.
 *
 * A ruin is the one case that is not a jitter: desaturated toward grey and
 * darkened well below anything a lived-in building reaches, so a boarded-up
 * plot is legible from the play camera without opening an overlay. It keeps the
 * plot and loses everything else.
 */
function bodyColor(
  kind: ZoneKind,
  slot: number,
  level: number,
  overlay: number | null,
  out: THREE.Color,
): THREE.Color {
  const base =
    overlay === null ? out.setRGB(1, 1, 1) : against(overlay, ZONE_COLOR[kind], out);
  if (level < 0) {
    // Toward grey, then down. The zone overlay survives it — a ruin is still
    // standing on the land it was zoned for, and the overlay states zoning.
    const grey = (base.r + base.g + base.b) / 3;
    return base.setRGB((base.r + grey) * 0.2, (base.g + grey) * 0.2, (base.b + grey) * 0.2);
  }
  // The per-building shade and tint survive the overlay, so the plan still reads
  // as buildings rather than as a flat sheet of one colour.
  //
  // A modelled house takes the shade and the tint and *not* a style band: the
  // band is a multiplier standing in for a style the eye cannot otherwise tell
  // apart on a plain box, and five silhouettes do not need one. What the
  // multiplier lands on is different too — a house's mesh is vertex-coloured,
  // so this scales its whole palette at once rather than one material, which is
  // what puts a whole house under an overlay instead of only its walls. That is
  // the right reading for an overlay about a *plot*, and the only one a
  // vertex-colour merge can give.
  const style = modelled(kind, level) ? 1 : styleOf(kind, slot).tint;
  return base.multiplyScalar(shade(slot) * tintJitter(slot) * style);
}

/**
 * The canvas shade of an awning, and the concrete of a setback.
 *
 * Not overlay-aware, and deliberately: the zone overlay states zoning and only
 * the bodies carry it, which is the rule the roofs and stacks already follow.
 */
function partColor(slot: number, out: THREE.Color): THREE.Color {
  return out.setRGB(1, 1, 1).multiplyScalar(shade(slot) * tintJitter(slot));
}

/**
 * Everything one zone draws: five body meshes, the cohort they are packed
 * against, and the part indices each building's dressing landed on.
 *
 * The three zones were three near-identical classes before the ladder reached
 * commerce and industry; they are one now, which is what makes "a shop climbs
 * the same rungs a house does" true in the renderer as well as in the config.
 */
class ZoneLayer {
  /**
   * One body mesh per level, except where the level is modelled.
   *
   * Null at every modelled rung, whose buildings are drawn by `ModelMeshes`
   * instead — a hole rather than an unused mesh, because an `InstancedMesh`
   * nothing ever writes to is still a draw call the budget has to answer for.
   */
  private readonly bodies: readonly (BodyMeshes | null)[];
  /**
   * The five models each of this zone's modelled rungs is drawn from, indexed
   * by level and null at every rung the zone masses.
   *
   * Parallel to `bodies` and exactly complementary to it: every level has one
   * or the other and never both, which is what makes "a building is drawn once"
   * a property of the arrays rather than of the code that reads them.
   *
   * Owned here rather than by `Buildings`, unlike the part bank beside it, and
   * the difference is what each is: the bank is one bank *shared* by every
   * zone, so only the layer above can know when to repack it; these are this
   * zone's own meshes and nothing else writes to them.
   */
  private readonly models: readonly (ModelMeshes | null)[];
  readonly growth: GrowthSchedule;
  /** The cohort the scene is drawing, and where each level's run of slots begins. */
  private readonly cohort: LevelCohort = new Array<number>(LEVELS).fill(0);
  private readonly starts: number[] = new Array<number>(LEVELS).fill(0);
  private shown = 0;
  private shownMerged = -1;
  /** The zoning the shown plots were placed against. See `CityLayout.ensure`. */
  private shownZoning: Zoning = EMPTY_ZONING;
  private ruins = 0;
  /**
   * The overlay's colour for each slot, or null when no overlay is on.
   *
   * A function rather than one hex per zone, which is what the modes about
   * *built* land needed: land value, coverage and build order all differ from
   * one building to the next, and `bodyColor` already took a hex per instance —
   * so widening this is the whole of the mesh layer's part in it.
   */
  private overlay: OverlaySource | null = null;
  /**
   * Which part instance each of a building's dressing pieces landed on.
   *
   * Parts are packed per part, so the index bears no relation to the slot — and
   * the growth animation rewrites one slot at a time, long after the pack order
   * was decided. PART_SLOTS wide, indexed by slot, grown with the city.
   */
  private partAt = new Int32Array(0);

  constructor(
    scene: THREE.Scene,
    readonly kind: ZoneKind,
    private readonly zone: Zone,
    private readonly layout: CityLayout,
    duration: number,
    capacity: number,
    /** Shared with every zone, because the part bank they pack into is shared. */
    private readonly detail: DetailMask,
  ) {
    this.growth = new GrowthSchedule(duration);
    this.bodies = Array.from({ length: LEVELS }, (_, level) =>
      modelled(kind, level) ? null : new BodyMeshes(scene, kind, level, capacity),
    );
    this.models = Array.from({ length: LEVELS }, (_, level) =>
      modelled(kind, level) ? new ModelMeshes(scene, kind as ModelledKind, level, capacity) : null,
    );
  }

  /** States what this zone's bodies cover, so they can be frustum-culled. */
  setBounds(x: number, z: number, reach: number, top: number): void {
    for (const body of this.bodies) body?.mesh.setBounds(x, z, reach, top);
    for (const models of this.models) models?.setBounds(x, z, reach, top);
  }

  /** Clears this zone's model instances, before a repack rewrites them all. */
  beginModels(): void {
    for (const models of this.models) models?.begin();
  }

  /** Publishes what the repack or the append wrote. Paired with `register`. */
  endModels(): void {
    for (const models of this.models) models?.end();
  }

  /** How many buildings this layer is drawing. The append path's `from`. */
  get shownCount(): number {
    return this.shown;
  }

  /**
   * Stages the growth animation for whatever arrived since the last write.
   *
   * This used to clear on any shrink, and the comment said why: a merge, an
   * abandonment or a demolition renumbers every slot above it, so an animation
   * keyed to the old numbering would play on the wrong buildings. Two of those
   * three turn out not to. It is worth writing down which, because the
   * demolition animation is built on the difference.
   *
   *   - **a merge does renumber.** `place(zone, slot, merged, ...)` maps slots
   *     `[0, merged)` onto the two-plot parcels, so raising `merged` by one
   *     shifts the plot every slot in the zone stands on. This is the case the
   *     clear is for, and it is now the only one;
   *   - **an abandonment does not.** It moves buildings out of the cohort and
   *     into the ruin count. A building's *level* changes, and therefore which
   *     mesh draws it — but a slot is a slot, and `writeOne` takes the slot;
   *   - **a demolition does not either.** `Game.demolish` takes the building
   *     off the *newest* end, so every slot below it means what it meant. That
   *     is the same property that makes the loss dishonest about which plot
   *     empties (see `Collapse`), and it is what lets an animation survive it.
   *
   * So the clear is on `merged` alone, and a demolition leaves whatever is in
   * flight alone — which is what makes the rebuild scheduled by `rebuild`
   * survive the very shrink that caused it.
   */
  stage(state: Readonly<GameState>, now: number): void {
    const count = countOf(state, this.kind);
    // `shownMerged` opens at -1, which is not a merge — it is a layer that has
    // not drawn anything yet, and the city it is about to draw for the first
    // time is the one that should animate in.
    const merged = mergedOf(state, this.kind);
    if (this.shownMerged >= 0 && merged !== this.shownMerged) this.growth.clear();
    else if (count > this.shown) this.growth.stage(this.shown, count, now, 1.4, WAVE_BUDGET);
  }

  /**
   * Puts one slot back up, after a delay.
   *
   * The whole of the rebuild half of the demolition animation, and it needs no
   * new machinery at all: `GrowthSchedule` stores a *birth time* and
   * `scaleAt` answers 0.001 for anything not yet born, so scheduling a slot in
   * the future is the same thing as hiding it and then growing it back. The
   * plot stands empty for `delay` and the building rises out of it on the
   * ordinary arrival curve.
   */
  rebuild(slot: number, at: number): void {
    if (slot < 0 || slot >= this.shown) return;
    this.growth.schedule(slot, at);
  }

  setOverlay(source: OverlaySource | null): void {
    this.overlay = source;
  }

  /**
   * Registers what each of this zone's meshes draws, so a raycast hit resolves.
   *
   * After `endModels`, always: the model bank's instance -> slot tables grow as
   * they fill, so registering before the write would hand the ranges buffers
   * nothing writes to any more.
   */
  register(ranges: SlotRanges<ZoneKind>): void {
    for (let l = 0; l < LEVELS; l++) {
      const body = this.bodies[l];
      if (body) ranges.set(body.mesh, this.kind, this.starts[l] ?? 0);
    }
    for (const models of this.models) models?.register(ranges);
  }

  /** How many instances a level's mesh draws: its cohort, plus the ruins. */
  private levelCount(l: number): number {
    return (this.cohort[l] ?? 0) + (l === 0 ? this.ruins : 0);
  }

  /** Whether anything about what this zone draws has moved. */
  changed(state: Readonly<GameState>): boolean {
    if (countOf(state, this.kind) !== this.shown) return true;
    if (mergedOf(state, this.kind) !== this.shownMerged) return true;
    const levels = levelsOf(state, this.kind);
    for (let l = 0; l < LEVELS; l++) if ((levels[l] ?? 0) !== this.cohort[l]) return true;
    return false;
  }

  /**
   * How many buildings were appended at the end and nothing else, or -1 if the
   * change needs the whole zone rewritten.
   *
   * A purchase adds at level 0 and moves nothing else, so its instances can be
   * written straight onto the end of the level-0 run — which is what keeps a
   * city being auto-developed from rewriting itself once a building. A
   * promotion, a merge or an abandonment shifts every slot above it and has no
   * incremental edit that is cheaper to get right.
   *
   * Ruins are the reason for the last clause: they are drawn at the end of the
   * level-0 run, so appending in front of them would shift every one.
   */
  appended(state: Readonly<GameState>): number {
    const count = countOf(state, this.kind);
    const grew = count - this.shown;
    if (grew <= 0) return -1;
    if (mergedOf(state, this.kind) !== this.shownMerged) return -1;
    if (this.ruins !== 0 || count - cohortTotal(levelsOf(state, this.kind)) !== 0) return -1;
    const levels = levelsOf(state, this.kind);
    if ((levels[0] ?? 0) !== (this.cohort[0] ?? 0) + grew) return -1;
    for (let l = 1; l < LEVELS; l++) if ((levels[l] ?? 0) !== this.cohort[l]) return -1;
    return grew;
  }

  /** Copies the state into the mirror the writes below are packed against. */
  adopt(state: Readonly<GameState>): void {
    const levels = levelsOf(state, this.kind);
    this.shown = countOf(state, this.kind);
    this.shownMerged = mergedOf(state, this.kind);
    this.shownZoning = state;
    this.ruins = this.shown - cohortTotal(levels);
    for (let l = 0; l < LEVELS; l++) this.cohort[l] = levels[l] ?? 0;
    cohortStart(this.cohort, this.starts);
    this.growth.ensure(this.shown);
    if (this.partAt.length < this.shown * PART_SLOTS) {
      this.partAt = new Int32Array(Math.max(64, this.shown * 2) * PART_SLOTS);
    }
  }

  /** Rewrites every building in the zone, level by level. */
  writeAll(bank: PartBank, dummy: THREE.Object3D, tint: THREE.Color, now: number): void {
    const standing = this.shown - this.ruins;
    for (const models of this.models) models?.ensure(this.shown);
    for (let l = 0; l < LEVELS; l++) {
      const body = this.bodies[l];
      const count = this.levelCount(l);
      const start = this.starts[l] ?? 0;
      body?.ensure(count);
      for (let i = 0; i < count; i++) {
        const slot = start + i;
        // Slots past the standing stock are the ruins. They live in the level-0
        // set because they hold a plot and have to be drawn on it, and -1 is
        // what tells the write they hold no level.
        this.writeOne(i, slot, slot < standing ? l : -1, bank, dummy, tint, now, true, null);
      }
      body?.setCount(count);
      body?.flush();
    }
  }

  /** Writes a run of newly appended buildings onto the end of the level-0 set. */
  writeRange(
    bank: PartBank,
    dummy: THREE.Object3D,
    tint: THREE.Color,
    from: number,
    to: number,
    now: number,
  ): void {
    const body = this.bodies[0];
    const start = this.starts[0] ?? 0;
    body?.ensure(to - start);
    for (const models of this.models) models?.ensure(to);
    for (let slot = from; slot < to; slot++) {
      this.writeOne(slot - start, slot, 0, bank, dummy, tint, now, true, null);
    }
    body?.setCount(to - start);
    body?.flush();
  }

  /** One building: its body, and its dressing out of the shared bank. */
  private writeOne(
    index: number,
    slot: number,
    level: number,
    bank: PartBank,
    dummy: THREE.Object3D,
    tint: THREE.Color,
    now: number,
    place: boolean,
    /** Where a cage goes if this building is still on its way up. Null on a rebuild. */
    scaffold: Scaffold | null,
  ): void {
    const at = this.layout.place(this.zone, slot, this.shownMerged, this.shownZoning, SCRATCH_AT);
    const scale = this.growth.scaleAt(slot, now);
    const colour = bodyColor(this.kind, slot, level, this.overlay?.(this.kind, slot) ?? null, tint);
    const models = this.models[modelLevel(level)];
    if (models && modelled(this.kind, level)) {
      this.writeModel(models, this.kind, slot, level, at, scale, colour, bank, dummy, place, scaffold);
      return;
    }
    const body = this.bodies[Math.max(0, level)] as BodyMeshes;
    const shape = shapeOf(this.kind, level);
    const style = styleOf(this.kind, slot);
    // A merged parcel is drawn by stretching the level's own box along the
    // parcel's axis rather than by a second geometry, exactly as the parts and
    // the jitter already do. One extra multiply, no extra draw call.
    const span = at.plots > 1 ? MERGED_SPAN / (shape.width * style.width) : 1;
    const sx = style.width * widthJitter(slot) * (at.alongX ? span : 1);
    const sz = style.width * depthJitter(slot) * (at.alongX ? 1 : span);
    const stretch = style.height * heightJitter(slot);
    const height = shape.height * stretch;

    dummy.rotation.set(0, 0, 0);
    dummy.position.set(at.x, (height / 2) * scale, at.z);
    dummy.scale.set(sx, stretch * scale, sz);
    dummy.updateMatrix();
    body.mesh.setMatrixAt(index, dummy.matrix);
    body.mesh.setColorAt(index, colour);

    // The cage, around the *finished* building rather than around the shell it
    // has reached. The test is `scale !== 1` rather than `scale < 1` and it has
    // to be: `easeOutBack` overshoots, so a building spends most of its
    // animation *above* 1 and `< 1` would take its cage down halfway up. This
    // is the exact condition `GrowthSchedule.update` retires an index on, which
    // is what makes the two happen on the same frame — the last write a
    // building gets is the one that leaves it out of the list, and a cage that
    // outlived its growth would be a cage nothing ever came back to take down.
    if (scaffold && scale !== 1) {
      scaffold.add(at.x, at.z, shape.width * sx, shape.width * shape.depth * sz, height);
    }

    writeParts(
      this.kind,
      slot,
      level,
      // Whether the building wears anything but its roof. A district the camera
      // is nowhere near keeps its silhouette and loses its dressing — see
      // `DetailMask`, which is what decides it.
      this.detail.dressed(at.x, at.z),
      at.x,
      at.z,
      at.alongX,
      shape.width * sx,
      shape.width * shape.depth * sz,
      height,
      scale,
      bank,
      dummy,
      tint,
      this.partAt,
      place,
    );
  }

  /**
   * One modelled building: the model, and the lit pieces it borrows.
   *
   * The other half of `writeOne`, and it is a separate method rather than a
   * branch inside it because almost nothing carries over: a different mesh, a
   * different jitter, a rotation, an origin on the ground rather than at the
   * body's centre, and no dressing to choose.
   *
   * A model is never *stretched* to a merged parcel, and it never has to be.
   * The massed path stretches its box along the parcel because one box has to
   * serve both footprints; a model is built to the footprint its rung stands
   * on, so a tower arrives 6.8 units long and a house arrives 3. What a merged
   * rung changes here is the *turn* rather than the scale — see `modelTurn`,
   * which narrows an oblong model to the two quarter turns that lie along its
   * parcel.
   *
   * The one case that is still merged and drawn from a rung built for a single
   * plot is a ruin: a parcel whose building was boarded up after it merged
   * reverts to the first rung's models, and a cottage standing on a double plot
   * is a better answer than a cottage stretched to fill one.
   */
  private writeModel(
    models: ModelMeshes,
    kind: ModelledKind,
    slot: number,
    level: number,
    at: Placement,
    scale: number,
    colour: THREE.Color,
    bank: PartBank,
    dummy: THREE.Object3D,
    place: boolean,
    scaffold: Scaffold | null,
  ): void {
    const style = modelStyleOf(kind, slot);
    const model = modelOf(kind, level, slot);
    const turn = modelTurn(kind, at, slot);
    const sx = modelWidthJitter(kind, level, slot);
    const sz = modelDepthJitter(kind, level, slot);
    const sy = modelHeightJitter(slot) * scale;

    // The model stands on y = 0, so it grows out of the ground by scaling about
    // its own origin — one fewer term than the massed path, which has to lift a
    // centred box by half its height as it rises.
    dummy.rotation.set(0, QUARTER[turn] ?? 0, 0);
    dummy.position.set(at.x, 0, at.z);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    if (place) models.place(style, slot, dummy.matrix, colour);
    else models.move(style, slot, dummy.matrix);

    if (scaffold && scale !== 1) {
      const turned = turn % 2 === 1;
      const along = model.width * sx;
      const across = model.depth * sz;
      scaffold.add(at.x, at.z, turned ? across : along, turned ? along : across, model.height * sy);
    }

    writeModelParts(
      kind,
      modelLevel(level),
      model.height,
      slot,
      style,
      // A ruin is dark and a building past the detail radius is undressed: the
      // two reasons `writeParts` goes bare, and the lit pieces are all there is
      // to lose — a shuttered shop with its sign still on would be a bug.
      level >= 0 && this.detail.dressed(at.x, at.z),
      at.x,
      at.z,
      turn,
      sx,
      sy,
      sz,
      bank,
      dummy,
      this.partAt,
      place,
    );
  }

  /** Rewrites body colours only. Matrices are untouched, so this is one pass. */
  recolor(tint: THREE.Color): void {
    const standing = this.shown - this.ruins;
    let modelledAny = false;
    for (let l = 0; l < LEVELS; l++) {
      const body = this.bodies[l];
      const start = this.starts[l] ?? 0;
      for (let i = 0; i < this.levelCount(l); i++) {
        const slot = start + i;
        const level = slot < standing ? l : -1;
        const colour = bodyColor(
          this.kind,
          slot,
          level,
          this.overlay?.(this.kind, slot) ?? null,
          tint,
        );
        if (body) body.mesh.setColorAt(i, colour);
        else if (modelled(this.kind, level)) {
          // A modelled level has no body mesh; its instance lives in its own
          // style's run, which `ModelMeshes` is the only thing that can index.
          // A ruin is level -1 and draws from the first rung's set — the same
          // fold `writeOne` makes, so the two agree on which mesh holds it.
          this.models[modelLevel(level)]?.recolor(modelStyleOf(this.kind, slot), slot, colour);
          modelledAny = true;
        }
      }
      body?.flush();
    }
    if (modelledAny) for (const models of this.models) models?.flush();
  }

  /** Advances this zone's in-flight growth animations, and cages what is moving. */
  update(
    bank: PartBank,
    dummy: THREE.Object3D,
    tint: THREE.Color,
    now: number,
    scaffold: Scaffold | null,
  ): boolean {
    // Keyed by *slot*, not by instance, so an animation in flight survives a
    // promotion moving the building between two mesh sets. The level and
    // instance are recovered from the cohort the scene is drawing.
    const standing = this.shown - this.ruins;
    const moving = this.growth.update(now, (slot) => {
      // A slot the zone no longer has. `stage` no longer clears on a shrink —
      // see the note there — so a building that was in flight when the city
      // lost one can outlive its own slot by an animation's length. Skipping it
      // leaves it in the active set until its scale reaches 1 and it retires
      // itself, which costs one arithmetic test a frame and cannot write past
      // the end of a mesh.
      if (slot >= this.shown) return;
      const found = levelAt(this.cohort, slot);
      const level = slot < standing ? Math.max(0, found) : -1;
      this.writeOne(
        slot - (this.starts[Math.max(0, level)] ?? 0),
        slot,
        level,
        bank,
        dummy,
        tint,
        now,
        false,
        scaffold,
      );
    });
    if (moving) {
      for (const body of this.bodies) body?.flush();
      for (const models of this.models) models?.flush();
    }
    return moving;
  }
}

// -------------------------------------------------------------- detail level

/**
 * How close the camera has to be to what it is looking at before the dressing
 * is worth culling at all.
 *
 * The street camera is what made this a real question and the wide shot is what
 * bounds it. Measured (tools/lod.calibrate.mjs, at 49 districts with housing at
 * level 4): the dressing is 9,564 instances and 114,768 triangles, 30% of
 * everything the scene submits. From the street camera 17 of the 49 districts
 * are inside the frustum, so two thirds of that is work nobody can see. From
 * the orbit camera at its framing distance, all 49 are — there is nothing to
 * cull and this must not try.
 *
 * So the gate is the camera's own distance rather than a screen-space size.
 * Under 120 units the player is standing in a district and "far" means off the
 * edge of the frame; over it they are looking at the city, every band and
 * beacon in it is part of the picture, and the whole mechanism switches off. It
 * is not a subtle rule and it does not need to be: the two views want opposite
 * things and the distance is exactly what tells them apart.
 */
const DETAIL_ENGAGE = 120;

/**
 * How far from the focus a district still wears its dressing.
 *
 * Measured from the nearest face of the district's own tile rather than its
 * centre, so a district the focus is standing at the edge of is dressed whether
 * or not its centre is in range. 150 against the street camera's 17-district
 * frustum keeps about twenty dressed, which is the frustum plus a ring — the
 * margin is what stops a turn on the spot from popping the dressing in.
 */
const DETAIL_RADIUS = 150;

/**
 * How far the focus must move before the mask is rebuilt.
 *
 * A repack is 2.5 ms on the largest city — a sixth of a 60 Hz frame — so this
 * cannot be free-running. 30 units is half a district: walking a street at the
 * rig's own pan speed, that is a repack every few seconds rather than every
 * frame, and the DETAIL_RADIUS margin above is what makes the lag invisible.
 */
const DETAIL_HYSTERESIS = 30;

/**
 * Half the side of the grid the district mask is written into.
 *
 * `districtCoord` spirals out and steps over water, so a district's coordinate
 * is not bounded by the ring it is in — but it is bounded by the map, and 32
 * districts from the origin is five times the furthest MAX_DISTRICTS reaches.
 * Anything outside is read as dressed, which over-draws rather than under-draws.
 */
const MASK_HALF = 32;
const MASK_SIDE = MASK_HALF * 2;

/**
 * Which districts wear their buildings' dressing.
 *
 * The per-district test the brief asks for, and the reason it is per district
 * is arithmetic: 49 box tests against 4,000 building tests, and the answer is
 * the same because a building cannot be in two districts. What it produces is a
 * grid rather than a list, so the lookup a building does is a divide and an
 * array read.
 *
 * Distance rather than the frustum, deliberately. The frustum turns with the
 * camera and a repack costs milliseconds, so a frustum mask would repack on
 * every mouse drag; distance changes only when the camera *moves*, which is
 * what hysteresis can be applied to.
 */
class DetailMask {
  private readonly grid = new Uint8Array(MASK_SIDE * MASK_SIDE);
  /** True when nothing is culled, which is the state the wide shot is in. */
  private all = true;
  private atX = NaN;
  private atZ = NaN;
  private districts = -1;

  /** Whether the city is currently fully dressed. For the tests and the tools. */
  get dressingAll(): boolean {
    return this.all;
  }

  /**
   * Points the mask at a focus. Returns true when what it says has changed and
   * the part bank therefore has to be repacked.
   */
  aim(focusX: number, focusZ: number, distance: number, districts: number): boolean {
    if (distance > DETAIL_ENGAGE || districts <= 0) {
      if (this.all) return false;
      this.all = true;
      this.districts = -1;
      return true;
    }
    const moved = Math.hypot(focusX - this.atX, focusZ - this.atZ);
    if (!this.all && districts === this.districts && moved < DETAIL_HYSTERESIS) return false;

    this.all = false;
    this.atX = focusX;
    this.atZ = focusZ;
    this.districts = districts;
    this.grid.fill(0);
    const half = DISTRICT_WIDTH / 2;
    for (let i = 0; i < districts; i++) {
      const at = districtCoord(i);
      // Distance from the focus to the nearest point of the district's tile.
      const dx = Math.max(0, Math.abs(focusX - at.x * DISTRICT_WIDTH) - half);
      const dz = Math.max(0, Math.abs(focusZ - at.z * DISTRICT_WIDTH) - half);
      if (dx * dx + dz * dz > DETAIL_RADIUS * DETAIL_RADIUS) continue;
      const gx = at.x + MASK_HALF;
      const gz = at.z + MASK_HALF;
      if (gx < 0 || gx >= MASK_SIDE || gz < 0 || gz >= MASK_SIDE) continue;
      this.grid[gz * MASK_SIDE + gx] = 1;
    }
    return true;
  }

  /** Whether the building standing at (x, z) wears anything but its roof. */
  dressed(x: number, z: number): boolean {
    if (this.all) return true;
    const gx = Math.round(x / DISTRICT_WIDTH) + MASK_HALF;
    const gz = Math.round(z / DISTRICT_WIDTH) + MASK_HALF;
    if (gx < 0 || gx >= MASK_SIDE || gz < 0 || gz >= MASK_SIDE) return true;
    return this.grid[gz * MASK_SIDE + gx] === 1;
  }
}

/**
 * The highest anything the ladder can build reaches, in world units.
 *
 * Derived rather than stated, so a taller rung cannot quietly outgrow the
 * bounding sphere it is culled against — that failure mode is a tower that
 * vanishes when the camera looks up at it. The tallest is the housing slab at
 * level 4: 27 x 1.12 (its style) x 1.24 (the top of its jitter), plus its mast
 * and a roof.
 */
const MAX_BUILDING_TOP = (() => {
  let top = 0;
  for (const kind of ['home', 'shop', 'industry'] as const) {
    for (const shape of ZONE_SHAPES[kind]) {
      for (const style of ZONE_STYLES[kind]) {
        const height = shape.height * style.height * HEIGHT_JITTER_MAX;
        // A stack is a share of the body height and is the tallest thing above
        // it; the roof and the beacon's clearance sit on top of that.
        top = Math.max(top, height * (1 + style.stack) + 1.15 + 0.5);
      }
    }
  }
  return top;
})();

/**
 * One reusable placement. `place` fills it rather than returning a fresh object,
 * because a rebuild asks for one per building and `update` asks for one per
 * in-flight building per frame.
 */
const SCRATCH_AT = createPlacement();

/** One reusable footprint, for the same reason SCRATCH_AT is reusable. */
const SCRATCH_FOOT = { width: 0, depth: 0 };

/**
 * Where each of a building's pieces is recorded in `partAt`.
 *
 * A fixed stride rather than a list, because the growth animation rewrites one
 * building at a time long after the pack order was decided and has to find the
 * same instances again. -1 in a slot means the building does not wear that
 * piece — which is why the stride is walked even for the pieces it skips.
 */
const PS = {
  roof: 0,
  awning: 1,
  stack: 2,
  setback: 3,
  plant: 4,
  band: 5,
  beacon: 5 + BANDS_MAX,
} as const;

/**
 * How far above the body a roof rises.
 *
 * One number rather than a lookup since the hipped cone left the bank: the flat
 * cap and the parapet are the same height and always were, and the pitch that
 * differed was housing's first rung, which is modelled now.
 */
const ROOF_RISE = 0.5;

/**
 * Appends or rewrites one piece of dressing.
 *
 * A free function rather than a closure over the write, because `writeParts`
 * runs per in-flight building per frame and a pair of closures per call would
 * be an allocation on the frame path.
 */
function putPart(
  bank: PartBank,
  part: number,
  at: number,
  partAt: Int32Array,
  dummy: THREE.Object3D,
  color: THREE.Color | null,
  place: boolean,
): void {
  dummy.updateMatrix();
  if (place) partAt[at] = bank.place(part, dummy.matrix, color);
  else bank.move(part, partAt[at] ?? -1, dummy.matrix);
}

/**
 * The dressing on a modelled building: its lit pieces, and nothing else.
 *
 * A model carries its own roof, canopy, chimney and gardens in its geometry, so
 * every part slot but the *lit* ones is spent — and those cannot be in the
 * geometry, because a vertex-colour merge has no room for a second material.
 * A house wears one, a shop a shopfront and a sign, two of the shops a third
 * piece besides, and a walk-up one per floor. See `MODEL_LIT`.
 *
 * The beacon is the second of those and arrived with the towers, which are the
 * first modelled rung whose row asks for one. It is a light like the rest, so
 * it comes out of the bank for the same reason — and it is placed from the
 * model's own top rather than from the level's nominal height, because that is
 * what a model has: the massed path adds its roof's rise to the body, and a
 * model's roof is already inside the height `MODEL_EXTENT` reports.
 *
 * It still writes -1 into the slots it does not use, and that is not
 * housekeeping: `PART_SLOTS` is a fixed stride the growth animation reads long
 * after the pack order was decided, and a stale index left in a slot would
 * animate whatever piece of another building's dressing now lives there.
 */
function writeModelParts(
  kind: ModelledKind,
  /** The rung whose models are being drawn. A ruin has already been folded to 0. */
  level: number,
  /** How far the model reaches, so the beacon can sit on top of it. */
  top: number,
  slot: number,
  style: number,
  /** False for a ruin and past the detail radius — the same two `writeParts` bares. */
  lit: boolean,
  x: number,
  z: number,
  turn: number,
  sx: number,
  sy: number,
  sz: number,
  bank: PartBank,
  dummy: THREE.Object3D,
  partAt: Int32Array,
  place: boolean,
): void {
  const base = slot * PART_SLOTS;
  if (place) {
    partAt[base + PS.roof] = -1;
    partAt[base + PS.awning] = -1;
    partAt[base + PS.stack] = -1;
    partAt[base + PS.setback] = -1;
    partAt[base + PS.plant] = -1;
  }
  const boxes = lit
    ? ((MODEL_LIT[kind][level] as readonly (readonly LitBox[])[])[style] as readonly LitBox[])
    : EMPTY_LIT;
  dummy.rotation.set(0, QUARTER[turn] ?? 0, 0);
  for (let b = 0; b < BANDS_MAX; b++) {
    const box = boxes[b];
    if (!box) {
      if (place) partAt[base + PS.band + b] = -1;
      continue;
    }
    const [bx, by, bz] = box.at;
    const [bw, bh, bd] = box.size;
    // Each piece rides the building: its offset turns with the model and its
    // box is scaled by the same jitter, so it stays where the modeller put it.
    const offset = turnXZ(bx * sx, bz * sz, turn, SCRATCH_TURN);
    dummy.position.set(x + offset.x, by * sy, z + offset.z);
    dummy.scale.set(bw * sx, bh * sy, bd * sz);
    putPart(bank, PART.band, base + PS.band + b, partAt, dummy, null, place);
  }

  // The warning light the tall rungs carry, on the model's own top. `lit` bares
  // it with everything else: a ruin has no light on it, and a building past the
  // detail radius is a silhouette. Scaled by the height jitter alone, because a
  // beacon is a lamp rather than a part of the building — it does not get wider
  // when the footprint does.
  if (lit && shapeOf(kind, level).beacon) {
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(x, (top + 0.35) * sy, z);
    dummy.scale.setScalar(0.34 * sy);
    putPart(bank, PART.beacon, base + PS.beacon, partAt, dummy, null, place);
  } else if (place) partAt[base + PS.beacon] = -1;
}

const EMPTY_LIT: readonly LitBox[] = [];

/**
 * The dressing on one building, out of the shared bank.
 *
 * Which pieces it wears comes from its style and nothing else, so the same slot
 * wears the same dressing forever and none of it is stored. Every piece is the
 * same unit box scaled into place, which is why the whole variety budget costs
 * nine meshes rather than one shape per level per zone.
 *
 * `place` appends to the bank and records where each piece landed; the growth
 * animation passes false and rewrites the pieces already recorded, because the
 * bank is packed per part and an animation frame must not repack it.
 *
 * A ruin wears the flattest roof in the bank and nothing else at all: it keeps
 * its plot and loses everything else, lit bands included. `dressed` is false
 * takes the same branch for a different reason — see `DetailMask`.
 */
function writeParts(
  kind: ZoneKind,
  slot: number,
  level: number,
  /** False past the detail radius: roof only, which is the whole silhouette. */
  dressed: boolean,
  x: number,
  z: number,
  alongX: boolean,
  footW: number,
  footD: number,
  height: number,
  scale: number,
  bank: PartBank,
  dummy: THREE.Object3D,
  tint: THREE.Color,
  partAt: Int32Array,
  place: boolean,
): void {
  const base = slot * PART_SLOTS;
  const style = styleOf(kind, slot);
  const ruin = level < 0;
  // A ruin and a building past the detail radius want exactly the same thing —
  // the roof and nothing else — so they take the same branch. The roof is not
  // dressing: it is the top of the silhouette, and a city of headless boxes is
  // a different city rather than a cheaper one.
  const bare = ruin || !dressed;

  // 1. The roof. Every building has one, ruins included.
  const roof = roofOf(level, style);
  const rise = ROOF_RISE;
  dummy.rotation.set(0, 0, 0);
  dummy.position.set(x, (height + rise / 2) * scale, z);
  dummy.scale.set(footW * scale, rise * scale, footD * scale);
  putPart(bank, roof, base + PS.roof, partAt, dummy, null, place);

  // 2. An awning: a skirt overhanging the whole footprint at street level. What
  //    makes a parade of shops read as a parade rather than as one long block.
  if (!bare && style.awning > 0) {
    const reach = style.awning * footW;
    dummy.position.set(x, height * 0.32 * scale, z);
    dummy.scale.set((footW + reach) * scale, 0.22 * scale, (footD + reach) * scale);
    putPart(bank, PART.awning, base + PS.awning, partAt, dummy, partColor(slot, tint), place);
  } else if (place) partAt[base + PS.awning] = -1;

  // 3. A stack. Square and off to a corner for housing and industry — a stack on
  //    the ridge reads as a lift shaft, a stack at the edge reads as a chimney —
  //    and for commerce a thin board turned onto the long axis instead, so a
  //    merged shop wears one long sign rather than two short ones.
  const nudge = variety(slot, 0xc1) < 0.5 ? -1 : 1;
  if (!bare && style.stack > 0) {
    const tall = style.stack * height;
    if (kind === 'shop') {
      const board = (alongX ? footW : footD) * (0.5 + variety(slot, 0x7b) * 0.35);
      dummy.position.set(x, (height + rise + tall / 2) * scale, z);
      dummy.scale.set(
        (alongX ? board : 0.18) * scale,
        tall * scale,
        (alongX ? 0.18 : board) * scale,
      );
    } else {
      dummy.position.set(x + nudge * footW * 0.32, (height + tall / 2) * scale, z - footD * 0.3);
      dummy.scale.set(0.42 * scale, tall * scale, 0.42 * scale);
    }
    putPart(bank, PART.stack, base + PS.stack, partAt, dummy, null, place);
  } else if (place) partAt[base + PS.stack] = -1;

  // 4. A setback: a stepped upper block, narrower than the body it stands on.
  if (!bare && style.setback > 0) {
    const step = style.setback * height;
    dummy.position.set(x, (height + rise + step / 2) * scale, z);
    dummy.scale.set(footW * 0.72 * scale, step * scale, footD * 0.72 * scale);
    putPart(bank, PART.setback, base + PS.setback, partAt, dummy, partColor(slot, tint), place);
  } else if (place) partAt[base + PS.setback] = -1;

  // 5. Plant: equipment on the far end of the roof from the stack, so a merged
  //    building reads as one long thing with kit down its length rather than as
  //    two shorter ones touching.
  if (!bare && style.plant > 0) {
    const wide = style.plant * footW * 0.34;
    const tall = wide * (0.5 + variety(slot, 0xa3) * 0.9);
    dummy.position.set(
      x - nudge * footW * 0.28,
      (height + rise + tall / 2) * scale,
      z + footD * 0.24,
    );
    dummy.scale.set(wide * scale, tall * scale, wide * scale);
    putPart(bank, PART.plant, base + PS.plant, partAt, dummy, null, place);
  } else if (place) partAt[base + PS.plant] = -1;

  // 6. Lit floor bands. Banded *below* the roofline rather than laid on top:
  //    from an overhead camera a lit roof turns every building into a solid
  //    orange square and swamps the district, where a band glows from street
  //    level and still reads as a dark roof from above.
  for (let b = 0; b < BANDS_MAX; b++) {
    if (!bare && b < style.bands) {
      const up = (b + 1) / (style.bands + 1);
      dummy.position.set(x, height * up * scale, z);
      dummy.scale.set((footW + 0.08) * scale, 0.3 * scale, (footD + 0.08) * scale);
      putPart(bank, PART.band, base + PS.band + b, partAt, dummy, null, place);
    } else if (place) partAt[base + PS.band + b] = -1;
  }

  // 7. The warning light the tall levels carry, which is what sells their scale.
  if (!bare && shapeOf(kind, level).beacon) {
    dummy.position.set(x, (height + rise + 0.35) * scale, z);
    dummy.scale.setScalar(0.34 * scale);
    putPart(bank, PART.beacon, base + PS.beacon, partAt, dummy, null, place);
  } else if (place) partAt[base + PS.beacon] = -1;
}

/**
 * A landmark's mesh set: pale stone, and an outline that says which size it is.
 *
 * Reuses `CivicMeshes` rather than getting a class of its own, because a
 * landmark is exactly what that class already draws — a building that straddles
 * a reserved square, indexed by the square's lower-left plot. What it does not
 * reuse is the palette: landmarks are the one thing on the map meant to be
 * picked out from across the city, so they are pale stone where everything
 * civic is blue, teal or warm grey.
 *
 * Both sizes are modelled, so this is a dispatch and nothing else: the museum
 * on a 2x2 square, the stadium on a 3x3. They are told apart by outline at the
 * zoom the player actually plays at rather than by reading a colour — a
 * colonnaded hall against a bowl with four masts on it.
 */
function landmarkSet(scene: THREE.Scene, landmark: Landmark, capacity: number): CivicMeshes {
  return landmark.span === 2 ? museumSet(scene, capacity) : stadiumSet(scene, capacity);
}

/**
 * How wide and deep a building actually stands, in world units.
 *
 * The same numbers `writeOne` scales its body by and `highlight` wraps its
 * outline around — the level's footprint, the style's multiplier, the
 * per-building jitter, and MERGED_SPAN along a merged parcel's own axis.
 * Exported so the collapse animation can be the size of the building that fell
 * rather than the size of a plot: a cottage and an arcology come down very
 * differently and a heap sized for the wrong one reads as a bug.
 *
 * Takes the whole placement rather than the two fields it used to, because a
 * modelled house needs the position too: which way it turned to face its street
 * decides which of its two spans is across the frontage.
 *
 * Fills `out` rather than returning a fresh object, for the reason SCRATCH_AT
 * does: this is asked for on the frame a building is destroyed and there is no
 * reason for it to allocate.
 */
export function bodyFootprint(
  kind: ZoneKind,
  slot: number,
  level: number,
  at: Placement,
  out: { width: number; depth: number },
): { width: number; depth: number } {
  if (modelled(kind, level)) {
    const model = modelOf(kind, level, slot);
    const along = model.width * modelWidthJitter(kind, level, slot);
    const across = model.depth * modelDepthJitter(kind, level, slot);
    // An odd quarter turn puts the model's depth across the world's x. A model
    // is never *stretched* to a merged parcel — see `writeModel` — but a merged
    // one is built to it, and `modelTurn` reads `at` for exactly that.
    const turned = modelTurn(kind, at, slot) % 2 === 1;
    out.width = turned ? across : along;
    out.depth = turned ? along : across;
    return out;
  }
  const shape = shapeOf(kind, level);
  const style = styleOf(kind, slot);
  out.width = shape.width * style.width * widthJitter(slot);
  out.depth = shape.width * shape.depth * style.width * depthJitter(slot);
  if (at.plots > 1) {
    if (at.alongX) out.width = MERGED_SPAN;
    else out.depth = MERGED_SPAN;
  }
  return out;
}

/**
 * Top of whatever is standing on a plot, in world units.
 *
 * Exported so the fire layer can put a flame on a roof without a second copy of
 * the height rules — including the per-building jitter and the style's own
 * proportions, which is the whole reason this cannot simply be a level's
 * height: a flame at the nominal height floats above a short block and sinks
 * into a tall one.
 */
export function roofline(kind: ZoneKind, slot: number, level: number): number {
  // A ruin keeps the shell it had at level 1, so a fire on one still lands on a
  // roof rather than in mid-air. For the modelled rung that shell is the model,
  // whose own top already includes its roof — there is no separate rise to add.
  if (modelled(kind, level)) return modelOf(kind, level, slot).height * modelHeightJitter(slot);
  const shape = shapeOf(kind, level);
  const style = styleOf(kind, slot);
  return shape.height * style.height * heightJitter(slot) + ROOF_RISE / 2;
}

/**
 * A civic building spans two plots on each axis, less the usual street margin —
 * the same 1-unit gutter a shop leaves, so a hospital sits in its block the way
 * everything else does rather than rendering as a slab pushed into the kerb.
 */
const CIVIC_W = 2 * CELL - 1;

interface CivicStyle {
  readonly body: number;
  readonly roof: number;
  /** Body height in world units. */
  readonly height: number;
}

/**
 * How a part follows its building's growth animation.
 *
 * `rise` is a volume standing on the ground: it stretches up out of the ground
 * in Y alone, at full width from the first frame. `ride` is scaled whole, with
 * its height riding the scale, so whatever carries it is still under it the
 * whole way up rather than leaving it hanging in the air.
 *
 * A part whose geometry carries its own placement — the hospital's, which is a
 * composed design rather than a slab — rides with a zero offset, and that comes
 * out as the whole assembly scaling about the site's ground centre. Every piece
 * of it stays in the right place relative to every other at each frame, which
 * is the thing a fixed offset cannot give a building made of eighteen boxes.
 */
type CivicGrow = 'rise' | 'ride';

/** One instanced mesh in a civic building's set: a shape, and how it grows. */
interface CivicPart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
  /**
   * Where the part's centre sits relative to the site centre, at full size.
   * Zero for a part whose geometry already carries its own placement.
   */
  readonly offset: THREE.Vector3;
  readonly grow: CivicGrow;
  /**
   * The colour the zone overlay is resolved against, or null for a part the
   * overlay leaves alone. Only a building's own walls take the tint: a roof, a
   * lit surface and a painted marking read as themselves under every overlay,
   * and tinting them would cost the silhouette the type is told apart by.
   */
  readonly tint: number | null;
  /** Scene-graph name, so the tests can walk the layer as a black box. */
  readonly name: string;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
}

/** No offset: the part's geometry says where it stands. Never written to. */
const PART_AT_SITE = new THREE.Vector3(0, 0, 0);

/**
 * A civic building — one instanced mesh per part, one instance per building.
 *
 * Hospital, police station, fire station, school, depot, university, the city
 * hall, a power plant and the two landmark sizes: one set each. The zone types
 * are told apart by colour because they all stand on one plot and there is no
 * room to do better. A 2x2 footprint is room, so each of these gets a *shape*.
 * Silhouette first, colour second — that is what makes them findable from the
 * play camera.
 *
 * A set is a list of parts rather than a fixed body-roof-mark triple, because
 * the types have grown apart. Two of them are a slab with one thing standing on
 * it and say exactly that through `civicTrio` — the city hall and the power
 * plant, and nothing else is left; the other eight are modelled, assembled from
 * part tables generated out of `models/` and merged by material, to between
 * five meshes and nine. A list is what both kinds are, and the cost still grows
 * with the *table* rather than with the city: every mesh is built once, in this
 * constructor, and a hundred hospitals are a hundred instances in it rather
 * than a hundred draw calls.
 */
class CivicMeshes {
  private readonly meshes: readonly GrowableInstancedMesh[];
  /**
   * One hex, not a source: a civic building has no slot in any build list, so
   * there is nothing per-slot for it to read. See `Buildings.setZoneOverlay`.
   */
  private overlay: number | null = null;

  constructor(
    scene: THREE.Scene,
    private readonly parts: readonly CivicPart[],
    capacity: number,
    /** Every lit material in the set, for the day/night ramp. */
    private readonly glows: readonly Glow[] = [],
    /** Half the site's span in world units — how far the building sits off the
     *  lower-left plot it is indexed by. */
    private readonly offset: number = CELL / 2,
  ) {
    this.meshes = parts.map(
      (part) =>
        new GrowableInstancedMesh(scene, part.geometry, part.material, capacity, {
          castShadow: part.castShadow ?? true,
          receiveShadow: part.receiveShadow ?? false,
          name: part.name,
        }),
    );
  }

  ensure(capacity: number): void {
    for (const mesh of this.meshes) mesh.ensure(capacity);
  }

  setNight(night: number): void {
    for (const glow of this.glows) glow.setNight(night);
  }

  /** States what this set covers, so its meshes can be frustum-culled. */
  setBounds(x: number, z: number, reach: number, top: number): void {
    for (const mesh of this.meshes) mesh.setBounds(x, z, reach, top);
  }

  setOverlay(hex: number | null): void {
    this.overlay = hex;
  }

  private colorOf(part: CivicPart, out: THREE.Color): THREE.Color {
    if (part.tint === null || this.overlay === null) return out.setRGB(1, 1, 1);
    return against(this.overlay, part.tint, out);
  }

  recolor(count: number, tint: THREE.Color): void {
    for (let p = 0; p < this.parts.length; p++) {
      const part = this.parts[p];
      const mesh = this.meshes[p];
      if (!part || !mesh || part.tint === null) continue;
      for (let i = 0; i < count; i++) mesh.setColorAt(i, this.colorOf(part, tint));
      mesh.flush();
    }
  }

  /**
   * `cell` is the site's lower-left plot; the building straddles the whole
   * site, so the instance sits half a site along each axis from it.
   */
  write(index: number, cell: Coord, scale: number, dummy: THREE.Object3D, tint: THREE.Color): void {
    const x = worldX(cell.x) + this.offset;
    const z = worldZ(cell.z) + this.offset;

    for (let p = 0; p < this.parts.length; p++) {
      const part = this.parts[p];
      const mesh = this.meshes[p];
      if (!part || !mesh) continue;

      dummy.rotation.set(0, 0, 0);
      dummy.position.set(x + part.offset.x, part.offset.y * scale, z + part.offset.z);
      if (part.grow === 'rise') dummy.scale.set(1, scale, 1);
      else dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (part.tint !== null) mesh.setColorAt(index, this.colorOf(part, tint));
    }
  }

  setCount(n: number): void {
    for (const mesh of this.meshes) mesh.count = n;
  }

  flush(): void {
    for (const mesh of this.meshes) mesh.flush();
  }
}

/**
 * A slab, the roof on it, and one thing standing on that: two of the ten types.
 *
 * The body rises out of the ground and the other two ride up on it, which is
 * the growth animation every civic building had when there was only one shape
 * of them. Kept exactly, because it is still right for a slab.
 */
function civicTrio(
  scene: THREE.Scene,
  key: string,
  style: CivicStyle,
  mark: THREE.BufferGeometry,
  markMaterial: THREE.Material,
  markOffset: THREE.Vector3,
  capacity: number,
  glow: Glow | null = null,
  /** Footprint in world units. The civic quad's, or the university's. */
  width: number = CIVIC_W,
  offset: number = CELL / 2,
): CivicMeshes {
  return new CivicMeshes(
    scene,
    [
      {
        geometry: new THREE.BoxGeometry(width, style.height, width),
        material: new THREE.MeshLambertMaterial({ color: style.body }),
        offset: new THREE.Vector3(0, style.height / 2, 0),
        grow: 'rise',
        tint: style.body,
        name: `${key}:body`,
        receiveShadow: true,
      },
      {
        geometry: new THREE.BoxGeometry(width + 0.3, 0.34, width + 0.3),
        material: new THREE.MeshLambertMaterial({ color: style.roof }),
        offset: new THREE.Vector3(0, style.height + 0.17, 0),
        grow: 'ride',
        tint: null,
        name: `${key}:roof`,
      },
      {
        geometry: mark,
        material: markMaterial,
        offset: new THREE.Vector3(markOffset.x, style.height + markOffset.y, markOffset.z),
        grow: 'ride',
        tint: null,
        name: `${key}:mark`,
      },
    ],
    capacity,
    glow ? [glow] : [],
    offset,
  );
}
/** How tall the city hall's clock tower stands above its slab. */
const HALL_TOWER_H = 8.5;

/**
 * The city hall: a low pale slab with a slim centred clock tower.
 *
 * Centred, and that centring is the whole of it: narrow, tall, dead centre,
 * with a lit band near the top. Nothing else on a civic quad is symmetrical
 * about its own middle — the hospital is an L of two volumes, the plant's stack
 * stands off to one side, and the rest are a slab with a parapet or a band. So
 * from the play camera a building with something symmetrical on top of it is
 * the one thing on a 2x2 square that reads as a seat of government rather than
 * as another shed.
 *
 * There is one of these in the whole city, so it is the one civic type whose job
 * is to be *found* rather than merely told apart. Hence the tower rather than a
 * parapet, and hence a roof colour nothing else wears.
 */
function cityHallSet(scene: THREE.Scene, capacity: number): CivicMeshes {
  const clock = new Glow(PALETTE.sodium, 0.5);
  return civicTrio(
    scene,
    'hall',
    { body: PALETTE.hall, roof: PALETTE.hallRoof, height: 2.4 },
    new THREE.BoxGeometry(1.5, HALL_TOWER_H, 1.5),
    clock.material,
    new THREE.Vector3(0, HALL_TOWER_H / 2, 0),
    capacity,
    clock,
  );
}

/** How tall a cooling tower stands above the plant's slab. */
const PLANT_STACK_H = 6.5;

/**
 * A power plant: a low industrial slab with a lit vent standing off centre.
 *
 * Industrial concrete rather than a civic colour, because that is what it is —
 * the one 2x2 building on the map that is not civic. What tells it apart from a
 * works is that it is on a 2x2 square at all, and the lit stack standing off
 * one corner of it: the other lit civic surfaces are all *doors, bands or a
 * beacon* — down on the building or on top of it — and none of them is a mass
 * of light standing beside the roof.
 *
 * The stack stands off centre deliberately: dead centre reads as a spire, which
 * is the city hall's silhouette and has to stay the city hall's.
 */
function powerPlantSet(scene: THREE.Scene, capacity: number): CivicMeshes {
  const vent = new Glow(PALETTE.sodium, 0.42);
  return civicTrio(
    scene,
    'plant',
    { body: PALETTE.plant, roof: PALETTE.plantRoof, height: 1.9 },
    new THREE.BoxGeometry(1.8, PLANT_STACK_H, 1.8),
    vent.material,
    new THREE.Vector3(1.5, PLANT_STACK_H / 2, -1.5),
    capacity,
    vent,
  );
}

/**
 * How a modelled building's surfaces are drawn.
 *
 * Deliberately not in the part tables. The model states shape, material and
 * colour; whether a surface casts a shadow, receives one, is a light, or takes
 * the zone overlay is a *renderer* decision, and holding it in `civicModels.ts`
 * would mean the next regeneration threw it away without saying so. Keyed on
 * the material name for the same reason the merge is — see `mergeByMaterial`.
 */
interface Finish {
  readonly name: string;
  /** Set where the surface is a light rather than a colour, and so ramps. */
  readonly glow?: Glow;
  /** Whether the zone overlay resolves against this material. Walls only. */
  readonly tint?: boolean;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
}

/**
 * A civic building assembled from its model: one instanced mesh per material.
 *
 * The eight composed types come through here and the two slabs go through
 * `civicTrio`; the only thing that makes this different is that the geometry
 * came out of a file. Growth is `ride` with no offset throughout, which comes
 * out as the whole assembly scaling about the site's ground centre — the one
 * thing that keeps twenty-odd pieces in register with each other on the way up.
 */
function modelSet(
  scene: THREE.Scene,
  parts: readonly ModelPart[],
  finishes: ReadonlyMap<string, Finish>,
  capacity: number,
  /** Half the site's span: the 2x2 default, or `CELL` for the 3x3 stadium. */
  offset: number = CELL / 2,
): CivicMeshes {
  const glows: Glow[] = [];
  const meshes = mergeByMaterial(parts).map(({ mtl, colour, geometry }): CivicPart => {
    const finish = finishes.get(mtl);
    // A material in the model with nothing said about how to draw it. Thrown
    // rather than defaulted: it means a remodel introduced a surface, and a
    // guessed finish would put it on screen looking almost right.
    if (!finish) throw new Error(`no finish for material '${mtl}'`);
    if (finish.glow && !glows.includes(finish.glow)) glows.push(finish.glow);
    return {
      geometry,
      material: finish.glow?.material ?? new THREE.MeshLambertMaterial({ color: colour }),
      offset: PART_AT_SITE,
      grow: 'ride',
      tint: finish.tint === true ? colour : null,
      name: finish.name,
      castShadow: finish.castShadow ?? true,
      receiveShadow: finish.receiveShadow ?? false,
    };
  });
  return new CivicMeshes(scene, meshes, capacity, glows, offset);
}

/**
 * The hospital: a ward slab across the back of the site and a low treatment
 * wing across the front of it, in an L around the ambulance bay.
 *
 * It is the first of the eight types that are *composed* rather than
 * massed, and it earns that by being the building the city is told to buy
 * first — the anchor of the service ladder, on the site the player looks at
 * longest. What it has to do from the play camera is read as a hospital rather
 * than as a pale 2x2 shed, and three things do that, in the order they become
 * visible as the camera comes down:
 *
 *  - The **massing**. Two volumes at two heights, not one: a 3.3-tall ward with
 *    a helipad and plant on its roof, and a 1.65-tall wing in front of it. From
 *    overhead that L is unlike anything else on a civic quad.
 *  - The **roof**, which is a working surface rather than a lid — helipad, deck
 *    markings, and the plant housings beside them. The play camera looks down,
 *    so the roof is most of what a building actually shows.
 *  - The **cross**, painted on the wing where the ward does not overshadow it,
 *    and read last because it is the smallest. It is the only literal sign
 *    anywhere in the city, which is why it is the hospital that gets one: the
 *    building whose name a new player has to learn before any other.
 *
 * Twenty-one pieces, eight meshes. The pale walls and mint cap are the two
 * colours the hospital always wore, so a city built before this design still
 * reads as the same city afterwards.
 */
function hospitalSet(scene: THREE.Scene, capacity: number): CivicMeshes {
  // The ambulance bay doors, the one lit surface on the building. The same
  // sodium the fire station's doors wear, and for the same reason: the two
  // buildings people are sent to at night are the two that stay lit.
  const doors = new Glow(PALETTE.sodium, 0.5);
  return modelSet(
    scene,
    HOSPITAL_PARTS,
    new Map<string, Finish>([
      // The ward, the wing and the entrance columns.
      ['clinic-white', { name: 'hospital:walls', tint: true, receiveShadow: true }],
      // Banded storeys on both volumes, and the entrance canopy, which is the
      // same dark glass and reads as one material with them. Proud of the walls
      // by 3cm and so never shadow-cast: a surface that close to the one behind
      // it buys acne and nothing else.
      ['glazing', { name: 'hospital:glazing', castShadow: false }],
      // The mint caps. They overhang their walls, so they cast the eave line
      // that tells the two volumes apart from above — and they carry the roof
      // clutter, which the play camera is looking straight down at.
      ['mint-roof', { name: 'hospital:caps', receiveShadow: true }],
      ['plant-grey', { name: 'hospital:plant' }],
      ['sodium-glow', { name: 'hospital:doors', glow: doors, castShadow: false }],
      // The helipad deck, in the near-black the airport's runways use, because
      // it is the same thing: made ground for an aircraft.
      ['deck-asphalt', { name: 'hospital:helipad', castShadow: false }],
      ['marking-white', { name: 'hospital:mark', castShadow: false }],
      ['emergency-red', { name: 'hospital:cross', castShadow: false }],
    ]),
    capacity,
  );
}

/**
 * The fire station: an appliance hall on the street, a dormitory block behind
 * it, and a hose tower on the back corner.
 *
 * The second composed type, and it is composed for the opposite reason to the
 * hospital's. The hospital had to stop reading as a pale shed; this one has to
 * stop reading as the *police station*, which is the same dark 2x2 block a
 * player meets in the same first hour. Height is what separates them, and this
 * has it three ways: a hall, a taller dorm behind, and a 5.3-unit tower over
 * both — 1.3 units square, so it reads as a *mass*. The police station's radio
 * mast goes higher, and that is the distinction rather than a collision with
 * it: a 0.16-unit spike reads as a line at every distance a tower of brick
 * reads as a volume, so the two never trade places at any camera angle.
 *
 * The two lit surfaces are the appliance bay doors and the beacon on the tower
 * cap. Both are what a fire station *is* at night, and the beacon is the only
 * lit surface in the city that is not sodium — a red light on the highest point
 * of the building, which is the one cue that carries when the city is dark and
 * the massing has stopped reading at all.
 *
 * Twenty pieces, nine meshes: the beacon needs a mesh of its own because it
 * wears the same red as the roof caps and has to glow when they do not.
 */
function fireStationSet(scene: THREE.Scene, capacity: number): CivicMeshes {
  const doors = new Glow(PALETTE.sodium, 0.5);
  // A lower floor than the doors: a beacon that stayed bright at noon would
  // read as painted, and the whole point of it is that it comes *on*.
  const beacon = new Glow(PALETTE.fireRoof, 0.3);
  return modelSet(
    scene,
    FIRE_STATION_PARTS,
    new Map<string, Finish>([
      // The hall, the dorm and the hose tower.
      ['engine-brick', { name: 'fire:walls', tint: true, receiveShadow: true }],
      // Door surrounds and the band along the hall's roofline: the pale trim
      // that keeps a dark red building from reading as one unlit mass.
      ['trim-concrete', { name: 'fire:trim' }],
      ['bay-door-light', { name: 'fire:doors', glow: doors, castShadow: false }],
      ['roof-red', { name: 'fire:caps', receiveShadow: true }],
      ['glazing', { name: 'fire:glazing', castShadow: false }],
      ['beacon-red', { name: 'fire:beacon', glow: beacon, castShadow: false }],
      // The apron the appliances pull out onto, and the bay guides painted on
      // it. Ground rather than building, so it receives and never casts.
      ['apron-asphalt', { name: 'fire:apron', castShadow: false, receiveShadow: true }],
      ['marking-white', { name: 'fire:markings', castShadow: false }],
      ['plant-grey', { name: 'fire:plant' }],
    ]),
    capacity,
  );
}

/**
 * The transit depot: a bus shed across the back of the site and the yard in
 * front of it, under a canopy, with the fleet parked on it.
 *
 * The third composed type, and the one whose subject is not the building. A
 * depot is what it is because of the *buses*: they are what the player bought,
 * they are the thing the HUD talks about, and they are what the type shares
 * with the traffic already running past the site. So the model gives two thirds
 * of the footprint to an apron, parks three coaches on it in the same green the
 * streets' buses wear, and keeps the shed itself low — a 2.4-unit box against
 * the fire station's 5.3-unit tower — so nothing hides them from the play
 * camera.
 *
 * Told apart from the other 2x2 types by how much of the site is *not* the
 * building. The police station is the only other one with a yard and gives it a
 * fifth of the square; this gives two thirds, which is what makes it read from
 * overhead as a yard with a shed at the back rather than as a building with
 * some ground left over — bays painted across the tarmac, a coach in three of
 * them and the fourth left to the fuel pump, and a lit canopy across the mouth
 * of the shed.
 *
 * The lime is the depot's own livery and is worn three times on purpose: the
 * shed cap, a band down each bus, and the sign on the pylon. That is what makes
 * the buses read as *this depot's* buses rather than as three green boxes
 * parked on a civic site, and it is the only colour in the city that repeats
 * across a building and its vehicles.
 *
 * Thirty-two pieces, nine meshes.
 */
function busDepotSet(
  scene: THREE.Scene,
  capacity: number,
  /**
   * Which type's meshes these are.
   *
   * The waste depot draws the bus depot's model, and that is a statement rather
   * than a saving: `garbageCollection`'s own comment calls the depot "the
   * municipal yard — where the city keeps the vehicles that go out on a round",
   * and a waste depot is that yard with different lorries in it. What it cannot
   * share is the mesh *names*: a `CivicMeshes` set is one instance list per
   * material per type, so two types on one set would draw one type's buildings
   * on the other's sites. The prefix is what keeps them apart.
   */
  prefix = 'transit',
): CivicMeshes {
  // The bay lights strung under the canopy, and the only lit surface here. A
  // low floor for the reason the fire station's beacon has one: a depot at
  // night is a lit yard with the fleet in it, and that only reads if the lights
  // were dim at noon.
  const bays = new Glow(PALETTE.sodium, 0.3);
  return modelSet(
    scene,
    BUS_DEPOT_PARTS,
    new Map<string, Finish>([
      // The shed and the fuel pump standing on the yard's far corner.
      ['depot-teal', { name: `${prefix}:walls`, tint: true, receiveShadow: true }],
      // The shed's clerestory band and the coaches' windows: one material,
      // because at this distance a bus window and a shed window are the same
      // dark glass. Proud of what they sit on, so never shadow-casting.
      ['glazing', { name: `${prefix}:glazing`, castShadow: false }],
      ['livery-lime', { name: `${prefix}:livery`, receiveShadow: true }],
      ['bus-green', { name: `${prefix}:buses`, receiveShadow: true }],
      // The yard: made ground, so it receives the shed's shadow and casts none.
      ['apron-asphalt', { name: `${prefix}:apron`, castShadow: false, receiveShadow: true }],
      ['marking-white', { name: `${prefix}:markings`, castShadow: false }],
      // The canopy over the bays, the one over the pump, and the roof plant.
      ['plant-grey', { name: `${prefix}:canopies`, receiveShadow: true }],
      // What holds those up, and the sign pylon on the street corner.
      ['trim-concrete', { name: `${prefix}:columns` }],
      ['bay-light', { name: `${prefix}:lights`, glow: bays, castShadow: false }],
    ]),
    capacity,
  );
}

/**
 * The police station: a banded block on the street, a low cell wing behind it,
 * and the patrol yard alongside.
 *
 * The fourth composed type, and the other half of the pair the fire station was
 * remodelled against: those two shared a dark palette and a footprint, and the
 * fire station answered it by going up. This answers it by spreading out — a
 * block on the street, a lower wing behind it, and a working yard beside both.
 *
 * What carries the type, in the order the camera finds it:
 *
 *  - The **banding**. Two stone courses around a navy block, and a blue head
 *    band under the roof slab. A dark 2x2 mass reads as one unlit lump from the
 *    play camera, and three horizontals are what break it up without touching
 *    the silhouette.
 *  - The **yard**, walled on three sides with the two patrol cars parked in it.
 *    The traffic outside is slate, the buses green and the lorries grey-blue, so
 *    a white body is the one nothing else on the map is wearing — which is what
 *    keeps them reading as police cars at the size a car is two units long.
 *  - The **mast**, which is the type's signature from across the district: a
 *    0.16-unit spike with a cross-arm and a blue light on top. It goes higher
 *    than the fire station's tower and reads as a *line* rather than as a mass,
 *    so the two never trade places at any camera angle.
 *
 * Twenty-nine pieces, nine meshes. The blue is worn twice and merged by name:
 * the head band and the cell cap are paint and the lights are lights, exactly
 * as the fire station's roof caps and beacon are.
 */
function policeStationSet(scene: THREE.Scene, capacity: number): CivicMeshes {
  // The lamp over the door, the mast head, and a bar on each patrol car. A low
  // floor because the whole of a blue light is that it comes on.
  const blues = new Glow(PALETTE.policeRoof, 0.3);
  return modelSet(
    scene,
    POLICE_STATION_PARTS,
    new Map<string, Finish>([
      // The street block and the cell wing behind it.
      ['station-navy', { name: 'police:walls', tint: true, receiveShadow: true }],
      // The two stone courses. Proud of the walls by 3cm, so never casting.
      ['band-stone', { name: 'police:bands', castShadow: false }],
      // The head band and the cell wing's cap: paint, and the same blue as the
      // lights, which is why the merge is keyed on the material name.
      ['police-blue', { name: 'police:caps', receiveShadow: true }],
      ['glazing', { name: 'police:glazing', castShadow: false }],
      // The roof slab, the mast, and the plant sitting beside it.
      ['mast-grey', { name: 'police:mast' }],
      // The steps, the door canopy, and the wall around the yard.
      ['trim-concrete', { name: 'police:trim', receiveShadow: true }],
      ['yard-asphalt', { name: 'police:yard', castShadow: false, receiveShadow: true }],
      // The patrol cars, in the white the airport paints its markings with.
      // Shared deliberately: it is the brightest surface the city has, and two
      // of them parked in a dark yard are what the eye lands on first.
      ['patrol-white', { name: 'police:cars', receiveShadow: true }],
      ['signal-blue', { name: 'police:lights', glow: blues, castShadow: false }],
    ]),
    capacity,
  );
}

/**
 * The museum: a colonnaded hall between two lower wings, on a stone plinth.
 *
 * The fifth composed type and the first that is not a service. A landmark's
 * whole job is to be picked out from across the city — it is bought once a
 * district and it is what the player looks for to know where they are — and the
 * slab it used to be could not do that job: pale stone, a brown lid and a lit
 * box on top read at distance as the city hall with the tower taken off.
 *
 * What it has instead is the one piece of architecture in the city, and each
 * part of it is doing a job the massing could not:
 *
 *  - The **plinth**. Half a unit of grey under the whole 7x7 footprint, which
 *    is what lifts a landmark off the ground plane every other building sits
 *    flat on. From overhead it is a second outline around the first.
 *  - The **portico** — four columns, a step up, and a roof over them. It is the
 *    only colonnade on the map, so it survives being three pixels tall.
 *  - The **massing**: a 3.6-tall hall between two 2.4-tall wings, each with its
 *    own cornice. Three heights and two cornice lines, where the slab had one
 *    of each.
 *  - The **lantern**, kept from the slab because it was the one part of it that
 *    worked: a lit box above the roofline, and now with a cornice cap of its
 *    own so it reads as built rather than as a lamp left on the roof.
 *
 * Twenty-seven pieces, five meshes — the fewest of any modelled type, because a
 * museum is stone, trim, glass, a plinth and a light, and that is all it is.
 */
function museumSet(scene: THREE.Scene, capacity: number): CivicMeshes {
  // The roof lantern. The same floor the landmark's lit band carried, and for
  // the reason that band existed: a landmark has to still say where it is after
  // dark, when its neighbours have gone flat.
  const lantern = new Glow(PALETTE.sodium, 0.44);
  return modelSet(
    scene,
    MUSEUM_PARTS,
    new Map<string, Finish>([
      // The plinth and the two steps up to the portico. Ground rather than
      // building: it is what everything else here stands on.
      ['plinth-grey', { name: 'museum:plinth', castShadow: false, receiveShadow: true }],
      // The hall, the wings and the four columns.
      ['landmark-stone', { name: 'museum:walls', tint: true, receiveShadow: true }],
      // Both cornices, the portico roof and the lantern's cap: the trim that
      // draws every horizontal on the building.
      ['cornice-brown', { name: 'museum:cornice', receiveShadow: true }],
      ['glazing', { name: 'museum:glazing', castShadow: false }],
      ['lantern-light', { name: 'museum:lantern', glow: lantern, castShadow: false }],
    ]),
    capacity,
  );
}

/**
 * The stadium: four stands around a marked pitch, on a concourse, under four
 * floodlight masts.
 *
 * The sixth composed type and the only one on a 3x3 square, which is what it
 * has always been for: the biggest thing the city builds short of a university,
 * bought once and looked for from across the map.
 *
 * The slab it replaces was a pale bowl with one mast off a corner, and the
 * comment on it recorded that a rim around the whole roof had been tried and
 * abandoned — from overhead a rim wide enough to read as a rim covered the
 * building, and a stadium became a brown square. The model settles that a third
 * way: the ring is *stands*, 2.6 units of stone with the seating tiers stepping
 * down inside them, and what the camera looks into from above is the pitch. So
 * the outline is a ring and the middle is green, which is a stadium at any zoom
 * and from any angle.
 *
 * Four masts rather than one, at the four corners where a real ground puts
 * them. That is the silhouette from the side, and it is the only place in the
 * city where the sodium is up in the air rather than on a wall — the airport's
 * approach lights are the nearest thing and they are on the ground.
 *
 * Thirty-four pieces, eight meshes. The pitch is the park green, because it is
 * the same thing the parks are: cut grass the city maintains.
 */
function stadiumSet(scene: THREE.Scene, capacity: number): CivicMeshes {
  // The floodlights. A higher floor than a beacon or a bay light: these are
  // lamps aimed down at a pitch, so they read as lit fittings by day rather
  // than as lights that are off.
  const floods = new Glow(PALETTE.sodium, 0.44);
  return modelSet(
    scene,
    STADIUM_PARTS,
    new Map<string, Finish>([
      // The concourse the whole thing stands on, and the seating tiers inside
      // the stands. One material: both are the grey a kerb is, which is what
      // the city already uses for made ground with people on it.
      ['seating-grey', { name: 'stadium:concourse', castShadow: false, receiveShadow: true }],
      ['pitch-green', { name: 'stadium:pitch', castShadow: false, receiveShadow: true }],
      ['marking-white', { name: 'stadium:markings', castShadow: false }],
      ['landmark-stone', { name: 'stadium:stands', tint: true, receiveShadow: true }],
      // The facade band around the stands and the canopy over them.
      ['roof-brown', { name: 'stadium:roof', receiveShadow: true }],
      ['gate-dark', { name: 'stadium:gates', castShadow: false }],
      ['mast-grey', { name: 'stadium:masts' }],
      ['floodlight', { name: 'stadium:floods', glow: floods, castShadow: false }],
    ]),
    capacity,
    // A 3x3 site, so the assembly sits a whole cell off the plot it is indexed
    // by rather than the half-cell every 2x2 type uses.
    CELL,
  );
}

/**
 * The school: a teaching hall along the back of the site, a gym on one corner,
 * and the playground the two of them look onto.
 *
 * The seventh composed type and the last service. As a slab it was the flattest
 * thing on a civic quad, and that was the whole of it — a low pale box with a
 * lit band, told apart from its neighbours by being *less* than they were.
 * Nothing about it said school.
 *
 * What says it now is the playground, which is half the site: a marked court
 * with a hoop at each end and a hedge along the two sides that face the street.
 * The city has three other yards — the depot's apron, the police station's
 * patrol yard and the stadium's pitch — and this is the only one with a game
 * painted on it. The hedge is the only clipped planting anywhere on the map,
 * which is what keeps a low pale building with a yard from reading as the
 * depot's shed with the buses taken out.
 *
 * The clerestory is kept from the slab, and stays the one lit surface: a band
 * along the ridge of the hall rather than around a parapet, so what is lit
 * after dark is the classrooms rather than the outline of a box.
 *
 * Twenty-three pieces, eight meshes.
 */
function schoolSet(scene: THREE.Scene, capacity: number): CivicMeshes {
  // The clerestory over the hall. A lower floor than the slab's band carried:
  // that band was lighting an outline and this is lighting a roof, and a roof
  // that glowed at noon would read as painted.
  const clerestory = new Glow(PALETTE.sodium, 0.34);
  return modelSet(
    scene,
    SCHOOL_PARTS,
    new Map<string, Finish>([
      // The hall and the gym.
      ['school-stone', { name: 'school:walls', tint: true, receiveShadow: true }],
      // Banded classroom windows on both volumes, and the entrance glass, which
      // is the same dark glazing and reads as one material with them.
      ['glazing', { name: 'school:glazing', castShadow: false }],
      ['school-roof', { name: 'school:roofs', receiveShadow: true }],
      ['clerestory-light', { name: 'school:clerestory', glow: clerestory, castShadow: false }],
      // The entrance canopy and its posts, and the two hoops on the court.
      ['trim-grey', { name: 'school:trim' }],
      ['yard-asphalt', { name: 'school:yard', castShadow: false, receiveShadow: true }],
      ['marking-white', { name: 'school:markings', castShadow: false }],
      ['hedge-green', { name: 'school:hedge', receiveShadow: true }],
    ]),
    capacity,
  );
}

/**
 * The university: four ranges around a planted quad, with a campanile standing
 * on the back corner.
 *
 * The eighth composed type, the second on a 3x3 square, and the tallest thing
 * the city builds — 10.7 units to the top of the campanile's finial, against
 * the city hall's clock tower at 10.9, which is deliberate: the hall stays the
 * one building nothing else out-tops, and this comes as close as anything is
 * allowed to.
 *
 * As a slab it was a pale block with a tower off the middle of it, which is the
 * city hall's own silhouette at a bigger footprint — the two buildings on the
 * map most easily confused, and the confusion was between the one a player
 * builds once and the one they build every district. The quad settles it. A
 * range on each side and a green in the middle is a shape nothing else in the
 * city has, and it reads from directly overhead, where a tower reads as a dot.
 *
 * The campanile is off the corner rather than centred for the same reason the
 * power plant's stack is: dead centre is the city hall's, and it has to stay
 * the city hall's. Its belfry is the lit surface — two crossed openings, so the
 * light shows from any bearing rather than only from two.
 *
 * Thirty-five pieces, nine meshes.
 */
function universitySet(scene: THREE.Scene, capacity: number): CivicMeshes {
  // The belfry. The same floor the landmarks' lit fittings carry: this is the
  // highest light in the city and it has to be visible across it after dark.
  const belfry = new Glow(PALETTE.sodium, 0.44);
  return modelSet(
    scene,
    CAMPUS_PARTS,
    new Map<string, Finish>([
      // The terrace the whole campus stands on, which is made ground.
      ['trim-grey', { name: 'university:terrace', castShadow: false, receiveShadow: true }],
      ['quad-lawn', { name: 'university:lawn', castShadow: false, receiveShadow: true }],
      ['quad-path', { name: 'university:paths', castShadow: false, receiveShadow: true }],
      // The four ranges, the colonnade along the front one, and the campanile.
      ['campus-stone', { name: 'university:walls', tint: true, receiveShadow: true }],
      // Banded storeys on all four ranges, and the gateway glass under the
      // pediment, which reads as one material with them.
      ['glazing', { name: 'university:glazing', castShadow: false }],
      ['campus-roof', { name: 'university:caps', receiveShadow: true }],
      ['belfry-light', { name: 'university:belfry', glow: belfry, castShadow: false }],
      // The two trees on the quad. The same trunk and canopy the parks wear,
      // because they are the same thing: planting the city maintains.
      ['tree-trunk', { name: 'university:trunks' }],
      ['tree-canopy', { name: 'university:canopies' }],
    ]),
    capacity,
    // A 3x3 site, like the stadium's.
    CELL,
  );
}

/** One mesh set per service, in SERVICES order. */
function civicSet(scene: THREE.Scene, service: Service, capacity: number): CivicMeshes {
  if (service.key === 'hospital') return hospitalSet(scene, capacity);
  if (service.key === 'police') return policeStationSet(scene, capacity);
  if (service.key === 'fire') return fireStationSet(scene, capacity);
  if (service.key === 'school') return schoolSet(scene, capacity);
  if (service.key === 'transit') return busDepotSet(scene, capacity);
  // The waste depot draws the bus depot's yard under its own names — see
  // `busDepotSet`, which carries why that is the honest model rather than a
  // placeholder.
  if (service.key === 'waste') return busDepotSet(scene, capacity, 'waste');
  return universitySet(scene, capacity);
}

/**
 * A building the player has clicked on.
 *
 * The ordinal and nothing else — the same number a fire stores, and for the
 * same reason: everything else about a building is a read over the state and
 * the seed, so a selection that carried a level or a position would be a copy
 * that could go stale. It is view state and is never saved.
 */
export interface BuildingRef {
  readonly kind: ZoneKind;
  readonly slot: number;
}

/**
 * The outline that says which building is selected.
 *
 * Edges rather than a tint, and its own object rather than an instance colour:
 * a selection has to be legible on a ruin, under the zone overlay and at night,
 * and every one of those already owns the instance colour it would have had to
 * borrow. One `LineSegments` for the whole city, moved rather than rebuilt.
 */
class Outline {
  private readonly mesh: THREE.LineSegments;

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: PALETTE.select, transparent: true, opacity: 0.95 }),
    );
    this.mesh.name = 'select:outline';
    // Drawn over whatever it is around: an outline hidden inside the building it
    // is marking is not an outline.
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  hide(): void {
    this.mesh.visible = false;
  }

  /** Wraps a box of `size` centred on (x, top/2, z), with a little air around it. */
  show(x: number, z: number, width: number, depth: number, height: number): void {
    this.mesh.visible = true;
    this.mesh.position.set(x, height / 2, z);
    this.mesh.scale.set(width + 0.5, height + 0.4, depth + 0.5);
  }
}

/**
 * The instanced meshes the three zone ladders are allowed to cost, all told.
 *
 * Four bodies, eight shared detail parts, fifty-five models and the
 * construction cage. The alternative the styles were designed against is 45 meshes: five
 * levels by three styles by three zones, each a draw call for what is
 * fundamentally the same box. Asserted in test/skyline.test.ts, so a later
 * change cannot quietly double the draw calls.
 *
 * It was 25 before the first rungs were modelled, and it is worth setting out
 * every move since, because a budget that grows without an argument is a budget
 * that keeps growing:
 *
 *   - **+5, the five house models.** Five is the floor: an instanced mesh draws
 *     one geometry, and five silhouettes are five geometries. What is *not*
 *     spent is the 42 a mesh-per-material merge would have cost — nine
 *     materials across the five;
 *   - **-1, the body they replace.** `home:0` was a box and is now a hole in
 *     the body array rather than a mesh nothing writes to;
 *   - **-1, the pitched roof.** The hipped cone in the part bank was worn by
 *     level-1 housing and by nothing else in the city, so modelling that rung
 *     left it with no wearer. See `PART`;
 *   - **+5 -1, the shops** and `shop:0`. Nothing in the part bank died with it:
 *     the three shop styles still wear an awning, a fin and a setback from
 *     level 2 up;
 *   - **+5 -1, industry** and `industry:0`, on the same argument again. The
 *     stack and the plant survive it for the same reason;
 *   - **+5 -1, the walk-ups** and `home:1`. The one rung above a first rung
 *     that is modelled, and the argument for it is where the cliff was rather
 *     than symmetry: a player's first promotion turned a street of five house
 *     silhouettes into twenty-four copies of one box, at the hour they had just
 *     spent looking at the houses. Nothing left the part bank with it — the
 *     three massed housing styles still wear a parapet and a band from level 3
 *     up — so this is the first of these moves that is +4 rather than +3, and
 *     that is the honest price of it;
 *   - **+5 -1, the towers** and `home:2`. Housing's third, and the first
 *     modelled rung that stands on a *merged parcel* — which is the argument
 *     for it as much as the look is. The merge is the most consequential thing
 *     a player does to a district, and it read as the same box getting taller
 *     and twice as wide;
 *   - **+5 -1, the arcologies** and `home:3`. Housing's fourth, and the one
 *     spend on this list that was made against the note that used to stand
 *     here. That note said a fifth +4 had to say what a player would *see*, on
 *     the grounds that a district this far up the ladder is viewed from far
 *     enough out that a silhouette is most of what lands. It was asked for
 *     anyway, and the reasoning is worth keeping rather than quietly deleting:
 *     the caution was about *diminishing* returns, not absent ones, and what it
 *     mispriced is that a merged rung is the widest thing in a district and
 *     therefore the thing a distant skyline is mostly made of. Five silhouettes
 *     at 22 units read from further away than five at 4.6 do, not less far;
 *   - **+5 -1, the pinnacles** and `home:4`. Housing's top, which finishes the
 *     ladder: `home` is now the first zone in the city with no body mesh at
 *     any rung. The note that used to stand here said this was the one to
 *     leave, and what overturned it was the measurement rather than an
 *     argument — part 1e found a rung above the merge costs *negative*
 *     triangles, because the parcel count is fixed and a rung is then worth
 *     only the difference between two models. The cost of this one was never
 *     the geometry; it was four draw calls, and they were the only thing to
 *     weigh;
 *   - **+5 -1, the high streets** and `shop:1`. Commerce's second, and the
 *     first spend on this list made *against* the paragraph below rather than
 *     against a note above — which is why that paragraph now has to be
 *     rewritten rather than left standing as a warning nobody heeded. What it
 *     got right is the price: commerce is the zone where a rung of models costs
 *     most, because a district carries 45 commercial plots to 24 residential.
 *     What it mispriced is *which* rung. It weighed commerce's four open rungs
 *     as one class and read them all as late-game, and the second is not: it is
 *     the rung on the far side of the first promotion a player makes to a
 *     shopping street, and the cliff there was the same one that justified the
 *     walk-ups. Five shop silhouettes along a kerb became copies of one 3.0 x
 *     3.2 box, in the hour after the one the shops were built for;
 *   - **+5 -1, the retail parks** and `shop:2`. Commerce's third, and the
 *     paragraph below named this one in advance rather than being surprised by
 *     it: commerce's third rung *is* the merge, and the merge is the one
 *     argument that has overturned this note before. It is the same spend
 *     housing's third was, one zone over and for the same reason — two plots
 *     become one building, it is the most consequential thing a player does to
 *     a district, and massed it read as the same shop stretched to twice the
 *     width. It does not widen the test below, because it does not claim to
 *     pass it: the merge is the named exception to it, and this is the second
 *     and last zone that can invoke it;
 *   - **+5 -1, the exchanges** and `shop:3`. Commerce's fourth, on the
 *     *measurement* argument — the third of the three exceptions, and the one
 *     that carried housing's fourth and fifth: above a merge the parcel count
 *     is pinned, so a rung is worth only the difference between two models and
 *     the draw calls are the whole of what is being weighed.
 *
 *     It has to be recorded that the measurement came back **worse here than it
 *     ever has**, because the paragraph below is about to lean on it. Housing's
 *     fourth was -14,304 triangles; commerce's is +50,832, +11.9% on the
 *     commercial geometry and +3.9% on the whole scene (part 1i). An arcology
 *     is simpler than a tower and an exchange is not simpler than a retail
 *     park, which is a fact about those four models rather than about merged
 *     rungs — "free above the merge" was never the rule, it was one outcome of
 *     it. It was the most expensive rung on this list that is not a first rung
 *     for exactly one entry;
 *   - **+5 -1, the trade towers** and `shop:4`. Commerce's top, which finishes
 *     the ladder: `shop` joins `home` as a zone with no body mesh at any rung,
 *     and it is the first rung outside housing to carry a beacon. The
 *     measurement again, and it came back worse again — +155,436 triangles,
 *     +32.6% on the commercial geometry (part 1j), against the exchanges'
 *     +50,832. Four applications now read -14,304, -429,876, +50,832 and
 *     +155,436. **The argument has a direction and it is the wrong one**: each
 *     use has cost more than the last since the sign turned, because commerce's
 *     models get more complex as they climb where housing's got simpler. That
 *     is the sentence to read before applying it a fifth time.
 *
 * So 25 - 2 + 4 x 10 = 63... which is 68. The three first rungs a district is
 * made of get fifteen silhouettes for the price of thirteen boxes, and the
 * eight rungs above them — housing's other four and commerce's other four — get
 * forty more for thirty-two. Housing and commerce are no bodies and twenty-five
 * models each; industry is four bodies and five.
 *
 * **The test this note has applied six times needs restating, and the high
 * streets are why.** It was "a rung earns models by being a rung players look
 * at", and the paragraph that stood here read commerce's four open rungs off it
 * as one class and priced them all as late-game. That was too coarse by exactly
 * one rung. The sharper test, and the one every spend on the list above passes,
 * is: **a rung earns models by being the far side of a promotion a player
 * watches happen.** A first rung qualifies because a district is made of it; a
 * second qualifies because the player is looking straight at the street when it
 * arrives. Nothing above a second has ever qualified on that reading, and the
 * six rungs modelled above a second — housing's third, fourth and fifth and
 * commerce's third, fourth and fifth — were argued on the merge and on the
 * measurement instead, which is the exception being named rather than hidden.
 *
 * **The paragraph that stood here said both arguments were spent and that a
 * further spend needed a new one. It was wrong, and wrong by its own text.** It
 * counted two arguments where the sentence above it names three: the
 * far-side-of-a-promotion test, which reaches a second rung; the merge, which
 * reaches a third; and the *measurement*, which carried housing's fourth and
 * fifth and was sitting unlisted in the summary that declared the shelf bare.
 * The exchanges are that third argument applied where it always applied. No new
 * argument was needed and none was found, which is a correction to this note
 * rather than a discovery.
 *
 * **What is left is industry, and all three arguments reach it.** That is worth
 * stating plainly rather than leaving to be rediscovered, because this note has
 * already been wrong once about what was on the shelf: industry's second rung
 * is a second rung, its third is the merge, and its fourth and fifth sit above
 * that merge — so the far-side test, the merge and the measurement each apply
 * exactly where they applied to the other two zones. Nothing about the *shape*
 * of the argument stops industry being modelled to the top.
 *
 * What stops it is the two things those arguments never covered. The first is
 * value: industry's upper rungs are the least-looked-at surfaces in the game,
 * and every rung on the list above was defended by saying who was looking at
 * it. The second is the price, which is no longer a guess. The measurement has
 * been applied four times and returned -14,304, -429,876, +50,832 and +155,436
 * — it does not license a rung, it prices one, and since the sign turned each
 * use has cost more than the last. A zone whose models get more elaborate as
 * they climb is a zone where that argument gets *worse* every time it is used,
 * and commerce is the worked example. Industry's would want measuring before
 * its first rung above the first is modelled, not after.
 *
 * The three-argument ladder is now complete and its shape is worth keeping: a
 * first rung is earned by being what a district is made of, a second by being
 * the far side of a promotion a player watches happen, a third by being the
 * merge, and anything above that only by measurement — which is to say, only if
 * the models happen to get simpler. Nothing here is a licence to finish a zone
 * because the other two are finished.
 *
 * The cost that is *not* in this number is triangles rather than draw calls: a
 * modelled building is 14 to 241 boxes where the massed one was one, which is
 * measured by tools/lod.calibrate.mjs parts 1b to 1k rather than bounded here.
 * The towers are most of that range and the balcony slab is most of the towers.
 *
 * The cage is the twenty-fifth and it is worth saying what it costs, because a
 * budget nobody argues with is a budget that drifts: it is one mesh, it is
 * `visible = false` on every frame nothing is growing — which is nearly all of
 * them — and its instance count is bounded by SCAFFOLD_CAPACITY rather than by
 * the city. A settled city of any size submits the same 24 draw calls it did
 * before it existed. See `Scaffold`.
 *
 * Civic buildings, the city hall, power plants and landmarks are counted
 * separately and are not part of this: they stand on 2x2 and 3x3 sites, have no
 * level ladder, and are told apart by silhouette rather than by style. Eleven
 * types and eighty meshes — seven services, the city hall, the power plant and
 * two landmark sizes — two of them a slab, a roof and one mark at three meshes
 * each (the city hall and the power plant, which are all that is left of that
 * shape), plus the nine modelled ones: the museum at five meshes, the hospital,
 * the school and the stadium at eight, and the police station, the fire
 * station, the two depots and the university at nine each. The waste depot is
 * the ninth and it draws the transit depot's model under its own names, so it
 * costs a set of meshes without costing a table — see `busDepotSet`.
 *
 * The count grows with the *table* rather than with the city: a mesh is built
 * once per type and every hospital the player opens is another instance in the
 * ones that already exist. See `civicSet`, `modelSet`, `cityHallSet`,
 * `powerPlantSet` and `landmarkSet`.
 */
export const BUILDING_MESH_BUDGET = 68;

/**
 * The building layer. It owns no game state: given counts, it reconciles the
 * scene toward them, and it can always rebuild itself from scratch.
 */
export class Buildings {
  /** One layer per zone, each owning its five body meshes. */
  private readonly zones: readonly ZoneLayer[];
  /** Eight unit shapes, shared by every zone and every level. See `PartBank`. */
  private readonly parts: PartBank;
  /**
   * Cages around whatever is mid-growth.
   *
   * Built whatever the motion preference says and *gated* by `caged`, so the
   * preference is a switch rather than a restart — one hidden mesh with no
   * instances in it costs nothing, and a settings toggle that needed a reload
   * to take effect would be a settings toggle nobody believes.
   */
  private readonly scaffold: Scaffold;
  /**
   * Whether cages are drawn at all. False under reduced motion.
   *
   * Skipped rather than shortened, and that is the honest answer to the
   * preference: reduced motion runs the whole animation in
   * GROW_SECONDS_REDUCED, which is 0.12s — about seven frames. A cage that
   * appears and vanishes inside seven frames is not an animation the player
   * reads, it is a flash, which is the exact thing the preference is set to
   * stop. Shortening it further would make it a one-frame flicker and leaving
   * it at full length would mean scaffolding standing after the building it
   * wrapped had finished. Nothing at all is the only version that respects what
   * was asked for.
   */
  private caged: boolean;
  /**
   * One entry per service, in SERVICES order, each owning its own mesh set,
   * growth schedule and shown count. Civic sites are reserved up front and
   * indexed by a fixed interleave, so unlike every earlier version of this the
   * types never move and never need rewriting as a block.
   */
  /**
   * Every building that stands on a reserved square: the six services, the city
   * hall, the power plants and the two landmark sizes.
   *
   * One list rather than two, because from here they are the same thing — a
   * count, a site list to index into, and a mesh set. What tells them apart is
   * upstream: a service has a coverage and a staffing ramp, a landmark has a
   * reach. Neither of those reaches the renderer.
   */
  private readonly civic: ReadonlyArray<{
    readonly meshes: CivicMeshes;
    readonly growth: GrowthSchedule;
    readonly site: (i: number) => Coord;
    readonly count: (state: Readonly<GameState>) => number;
    shown: number;
  }>;
  private readonly dummy = new THREE.Object3D();
  private readonly tint = new THREE.Color();
  /**
   * Which slots each body mesh is drawing, so a raycast hit can be turned back
   * into a building. Rewritten wherever the runs move, which is exactly where
   * the counts are written.
   */
  private readonly ranges = new SlotRanges<ZoneKind>();
  private readonly outline: Outline;
  /** Reused across clicks: `intersectObjects` fills it rather than returning one. */
  private readonly hits: THREE.Intersection[] = [];
  /**
   * Which districts are dressed. One object shared by all three zones, because
   * the part bank they pack into is shared and a mask that disagreed between
   * them would renumber one zone's instances out from under another's.
   */
  private readonly detail = new DetailMask();
  /** The city the meshes' bounds were stated for. See `fitBounds`. */
  private shownDistricts = -1;

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
    /**
     * Whether the animation is held back. Defaults to the media query, which is
     * the read this used to make inline — so a layer built without an opinion
     * behaves exactly as it always did, and the settings panel is the only
     * thing that ever passes one.
     */
    reduced: boolean = prefersReducedMotion(),
  ) {
    const duration = reduced ? GROW_SECONDS_REDUCED : GROW_SECONDS;
    this.parts = new PartBank(scene, 128);
    this.scaffold = new Scaffold(scene, SCAFFOLD_CAPACITY);
    this.caged = !reduced;
    this.zones = [
      new ZoneLayer(scene, 'home', ZONE.residential, layout, duration, 64, this.detail),
      new ZoneLayer(scene, 'shop', ZONE.commercial, layout, duration, 32, this.detail),
      new ZoneLayer(scene, 'industry', ZONE.industrial, layout, duration, 24, this.detail),
    ];
    this.outline = new Outline(scene);
    for (const zone of this.zones) zone.register(this.ranges);
    this.civic = [
      ...SERVICES.map((service) => ({
        meshes: civicSet(scene, service, 8),
        growth: new GrowthSchedule(duration),
        // The five 2x2 types read one interleaved list by their position in it;
        // the university has a list of its own and does not touch the interleave.
        site:
          service.span === 3
            ? (i: number) => this.layout.universitySiteCell(i)
            : ((offset) => (i: number) => this.layout.civicSiteFor(offset, i))(
                CIVIC_SERVICES.findIndex((entry) => entry.key === service.key),
              ),
        count: (state: Readonly<GameState>) => Buildings.serviceCount(state, service),
        shown: 0,
      })),
      // The city hall. One per city on a list of its own — a square reserved in
      // every district and built on in exactly one — so it needs no interleave
      // either, and adding it here rather than to SERVICES is what keeps every
      // existing civic building on the site it was already standing on.
      {
        meshes: cityHallSet(scene, 1),
        growth: new GrowthSchedule(duration),
        site: (i: number) => this.layout.cityHallSiteCell(i),
        count: (state: Readonly<GameState>) => (state.cityHall ? 1 : 0),
        shown: 0,
      },
      // Power plants, one square a district and the i-th plant on the i-th — the
      // same shape as a landmark and, like the hall, sliced clear of the civic
      // interleave so nothing already standing moves.
      {
        meshes: powerPlantSet(scene, 8),
        growth: new GrowthSchedule(duration),
        site: (i: number) => this.layout.powerPlantCell(i),
        count: (state: Readonly<GameState>) => state.plants,
        shown: 0,
      },
      // Landmarks stand on squares of their own, one of each size a district, so
      // the i-th landmark is the i-th district's and needs no interleave.
      ...LANDMARKS.map((landmark) => ({
        meshes: landmarkSet(scene, landmark, 8),
        growth: new GrowthSchedule(duration),
        site:
          landmark.span === 3
            ? (i: number) => this.layout.landmarkLargeSiteCell(i)
            : (i: number) => this.layout.landmarkSmallSiteCell(i),
        count: (state: Readonly<GameState>) =>
          landmark.key === 'museum' ? state.museums : state.stadiums,
        shown: 0,
      })),
    ];
  }

  /** How many of a service the state has, without a lookup table per caller. */
  private static serviceCount(state: Readonly<GameState>, service: Service): number {
    return service.key === 'hospital' ? state.hospitals
      : service.key === 'police' ? state.police
      : service.key === 'fire' ? state.fire
      : service.key === 'school' ? state.schools
      : service.key === 'transit' ? state.depots
      : service.key === 'waste' ? state.wasteDepots
      : state.universities;
  }

  /** Brings the scene in line with the simulation. Cheap when nothing changed. */
  sync(state: Readonly<GameState>, now: number): void {
    this.layout.ensure(state);
    if (state.districts !== this.shownDistricts) {
      this.shownDistricts = state.districts;
      this.fitBounds(state.districts);
    }

    // One decision for the whole city, because the detail parts are one bank.
    // A purchase appends to it and disturbs nothing already in it, so it can be
    // written straight onto the end; anything that *reorders* a zone — a
    // promotion, a merge, an abandonment — repacks the bank and therefore has
    // to rewrite every zone, not only the one that moved.
    let rebuild = false;
    let appending = false;
    for (const zone of this.zones) {
      if (!zone.changed(state)) continue;
      if (zone.appended(state) > 0) appending = true;
      else rebuild = true;
    }

    if (rebuild) {
      for (const zone of this.zones) {
        zone.stage(state, now);
        zone.adopt(state);
      }
      this.repack(now);
    } else if (appending) {
      for (const zone of this.zones) {
        const grew = zone.changed(state) ? zone.appended(state) : 0;
        if (grew <= 0) continue;
        const from = zone.shownCount;
        zone.stage(state, now);
        zone.adopt(state);
        zone.writeRange(this.parts, this.dummy, this.tint, from, from + grew, now);
        zone.endModels();
        zone.register(this.ranges);
      }
      this.parts.end();
    }

    for (const set of this.civic) {
      const count = set.count(state);
      if (count > set.shown) {
        set.growth.stage(set.shown, count, now, 1.4, WAVE_BUDGET);
        this.writeCivic(set, set.shown, count, now);
      } else if (count < set.shown) {
        set.growth.clear();
        this.writeCivic(set, 0, count, now);
      }
      set.shown = count;
    }
  }

  /**
   * States what every mesh in the layer covers, so the frustum test can be on.
   *
   * The city's own extent, which the simulation already knows: `cityRadius`
   * moves only when land is annexed, so this runs once a district rather than
   * once a frame. See `GrowableInstancedMesh.setBounds` for why it is stated
   * rather than derived from the instance buffers.
   *
   * One sphere for the whole layer, and it is worth being blunt about what that
   * buys: nothing, today. A body mesh holds one (zone, level) across every
   * district, so a sphere around the city is a sphere around every one of them,
   * and measured at 1, 10 and 49 districts from both cameras
   * (tools/lod.calibrate.mjs) the per-object test rejects **0 of 51** draw
   * calls. Tight per-mesh bounds would reject up to 14 at one district from the
   * street camera — and would cost three's own O(instances) recomputation every
   * frame anything moved, nine thousand matrix decompositions on the pavement
   * mesh alone, to save fourteen draw calls. That is not a trade.
   *
   * So the flag is on because it is *correct* and costs 51 sphere tests a
   * frame, and because a stale justification for having it off was worse than
   * either. Where the street camera actually pays is `DetailMask`, which takes
   * 69% of the dressing off a city it cannot see.
   */
  private fitBounds(districts: number): void {
    const centre = cityCentre(districts);
    // A margin of one plot: a building stands on a plot at the district's edge
    // and its own jitter can reach past the tile's nominal corner.
    const reach = cityRadius(districts) + CELL;
    for (const zone of this.zones) {
      zone.setBounds(centre.x, centre.z, reach, MAX_BUILDING_TOP);
    }
    this.parts.setBounds(centre.x, centre.z, reach, MAX_BUILDING_TOP);
    this.scaffold.setBounds(centre.x, centre.z, reach, MAX_BUILDING_TOP);
    for (const set of this.civic) set.meshes.setBounds(centre.x, centre.z, reach, MAX_BUILDING_TOP);
  }

  /**
   * Points the detail mask at what the camera is looking at.
   *
   * Returns true when the answer moved, which is the caller's cue to repack —
   * it is not done here, because a repack is 2.5 ms on the largest city and the
   * caller is the one that knows what else the frame is already doing.
   */
  setDetail(focusX: number, focusZ: number, distance: number, districts: number): boolean {
    return this.detail.aim(focusX, focusZ, distance, districts);
  }

  /** Whether the city is currently fully dressed. For the tests and the tools. */
  get dressingAll(): boolean {
    return this.detail.dressingAll;
  }

  /**
   * Takes one building down and puts it back up, after a delay.
   *
   * Called when a fire has just destroyed a building. What it animates is the
   * plot the flames were on, and the plot that actually empties is the newest
   * one in the zone — see `Collapse` for why the two are different and why this
   * is nonetheless the right thing to draw.
   */
  rebuild(kind: ZoneKind, slot: number, at: number): void {
    for (const zone of this.zones) {
      if (zone.kind === kind) zone.rebuild(slot, at);
    }
  }

  /** Whether the dressing joins the shadow pass. See `PartBank.setDressingShadows`. */
  setDressingShadows(on: boolean): void {
    this.parts.setDressingShadows(on);
  }

  /** Construction cages standing. For the tests and the calibrators. */
  get scaffolds(): number {
    return this.scaffold.standing;
  }

  /**
   * Answers the motion preference, under the running game.
   *
   * Both halves of it: how long an animation runs, and whether it is dressed.
   * `GrowthSchedule` stores a birth time and derives the scale from the age, so
   * shortening the duration finishes what is already in the air on the next
   * frame rather than stranding it — see `setDuration`.
   */
  setMotion(reduced: boolean): void {
    const duration = reduced ? GROW_SECONDS_REDUCED : GROW_SECONDS;
    for (const zone of this.zones) zone.growth.setDuration(duration);
    for (const set of this.civic) set.growth.setDuration(duration);
    this.caged = !reduced;
  }

  /**
   * Rewrites every zone's instances against the state already adopted.
   *
   * Split out of `sync` because the *detail level* is a second reason to
   * rewrite and it has nothing to do with the counts having moved: the city can
   * be exactly the city it was and still need its dressing repacked, because
   * the camera walked somewhere else. Nothing here re-reads the state, and
   * nothing here re-stages an animation — a repack must not replay a growth
   * that already played.
   *
   * The bank is packed per part rather than per building, so this has to be all
   * three zones or none: dropping one zone's dressing renumbers the instances
   * every other zone's `partAt` points at.
   */
  repack(now: number): void {
    this.parts.begin();
    for (const zone of this.zones) zone.beginModels();
    for (const zone of this.zones) zone.writeAll(this.parts, this.dummy, this.tint, now);
    this.parts.end();
    // Registered after the write, like the part bank is published after it: a
    // zone's model bank grows its instance -> slot tables as they fill, so
    // registering mid-write would hand the ranges a buffer that is about to be
    // replaced.
    for (const zone of this.zones) {
      zone.endModels();
      zone.register(this.ranges);
    }
  }

  private writeCivic(
    set: (typeof this.civic)[number],
    from: number,
    to: number,
    now: number,
  ): void {
    set.meshes.ensure(to);
    set.growth.ensure(to);
    for (let i = from; i < to; i++) {
      set.meshes.write(i, set.site(i), set.growth.scaleAt(i, now), this.dummy, this.tint);
    }
    set.meshes.setCount(to);
    set.meshes.flush();
  }

  /**
   * Recolours the city under whatever overlay is on.
   *
   * `source` decides the colour of the k-th building of a zone, so a mode about
   * built land — land value, coverage, build order — states itself on the
   * buildings where the pads cannot: a pad under a building is a pad nobody can
   * see. Null turns the overlay off.
   *
   * Homes stand on residential plots and shops on commercial ones by
   * construction, so the *zone* of a building is known from which list placed
   * it; anything finer than that is `source`'s to resolve.
   */
  setZoneOverlay(source: OverlaySource | null): void {
    for (const zone of this.zones) {
      zone.setOverlay(source);
      zone.recolor(this.tint);
    }
    // A civic site is carved out of the zone it sits in, so under the plan it
    // reads as that zone — the overlay states zoning, not what stands there.
    // Civic buildings have no slot of their own in a build list, so they take
    // the residential reading at slot 0 rather than a colour of their own.
    for (const set of this.civic) {
      set.meshes.setOverlay(source === null ? null : source('home', 0));
      set.meshes.recolor(set.shown, this.tint);
    }
  }

  /**
   * Ramps every lit surface in the city with the day/night phase.
   *
   * Called once a frame, and cheap enough to be: it touches a handful of
   * materials — the shared band and beacon, the fire station's bay doors and
   * tower beacon, the school's clerestory — and never an instance buffer.
   */
  setNight(night: number): void {
    this.parts.setNight(night);
    for (const set of this.civic) set.meshes.setNight(night);
  }

  /**
   * The building under a ray, or null for ground, a civic site or the sky.
   *
   * Only the three zone types are targets. A hospital has nothing per-building
   * to say — its coverage is a city-wide scalar and its staffing is a per-type
   * average — so a click on one clears the selection exactly as a click on
   * grass does, rather than opening a card with nothing in it.
   */
  pick(raycaster: THREE.Raycaster): BuildingRef | null {
    this.hits.length = 0;
    raycaster.intersectObjects(this.ranges.targets(), false, this.hits);
    for (const hit of this.hits) {
      if (hit.instanceId === undefined) continue;
      const found = this.ranges.resolve(hit.object, hit.instanceId);
      if (found) return { kind: found.tag, slot: found.slot };
    }
    return null;
  }

  /**
   * Draws the selection outline around one building, or hides it.
   *
   * Re-read from the state every sync rather than stamped when the click
   * happened: the building under the outline can merge, climb a level or be
   * boarded up while it is selected, and the outline has to follow it.
   */
  highlight(ref: BuildingRef | null, state: Readonly<GameState>): void {
    if (!ref || ref.slot < 0 || ref.slot >= countOf(state, ref.kind)) {
      this.outline.hide();
      return;
    }
    const at = this.layout.place(zoneOf(ref.kind), ref.slot, mergedOf(state, ref.kind), state, SCRATCH_AT);
    const level = levelAt(levelsOf(state, ref.kind), ref.slot);
    const foot = bodyFootprint(ref.kind, ref.slot, level, at, SCRATCH_FOOT);
    this.outline.show(at.x, at.z, foot.width, foot.depth, roofline(ref.kind, ref.slot, level));
  }

  /** Advances in-flight growth animations. Returns true while any are running. */
  update(now: number): boolean {
    let moving = false;
    // Rebuilt from scratch rather than reconciled, every frame, because that is
    // what makes a cage come down on the same frame its growth retires: the
    // list is exactly what was written this pass, so a building that finished
    // is simply not in it. Free when nothing is moving — `begin` is an integer
    // and `end` early-returns on a list that was empty last frame too.
    this.scaffold.begin();
    for (const zone of this.zones) {
      moving =
        zone.update(this.parts, this.dummy, this.tint, now, this.caged ? this.scaffold : null) ||
        moving;
    }
    // Closed whether or not anything was written, and that is what takes the
    // cages down the frame the preference changes as well as the frame a
    // building finishes: the list is only ever what this pass put in it.
    this.scaffold.end();
    if (moving) this.parts.flush();

    for (const set of this.civic) {
      const civicMoving = set.growth.update(now, (i, s) => {
        set.meshes.write(i, set.site(i), s, this.dummy, this.tint);
      });
      if (civicMoving) set.meshes.flush();
      moving = moving || civicMoving;
    }
    return moving;
  }
}
