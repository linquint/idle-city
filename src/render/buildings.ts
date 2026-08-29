import * as THREE from 'three';
import { hash01, mixSeed } from '../core/rng.ts';
import {
  CELL,
  CIVIC_SERVICES,
  LANDMARKS,
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
} from '../sim/layout.ts';
import type { GameState, LevelCohort, ZoneKind } from '../sim/state.ts';
import { Glow } from './glow.ts';
import { GrowableInstancedMesh, SlotRanges } from './growable.ts';
import { GrowthSchedule } from './growth.ts';
import { PALETTE } from './palette.ts';
import { HOSPITAL_PARTS, FIRE_STATION_PARTS } from './civicModels.ts';
import { mergeByMaterial, type ModelPart } from './model.ts';
import type { OverlaySource } from './zones.ts';

const GROW_SECONDS = 0.55;
const GROW_SECONDS_REDUCED = 0.12;

/** Most buildings that arrive at once are animated; a huge backlog is capped. */
const WAVE_BUDGET = 320;

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

/** Bands a style may wear. Two index slots are reserved per building for them. */
const BANDS_MAX = 2;

/**
 * The shared detail bank: nine unit shapes, instanced, worn by every zone and
 * every level.
 *
 * Shared is the point, and it is the whole reason 45 building variants cost 24
 * meshes rather than 45. Three variants across five levels and three zones would
 * be forty-five growable meshes and forty-five draw calls for what is
 * fundamentally the same box — so instead every shape here is a *unit* shape and
 * the building's own proportions arrive as an instance scale, the same way a
 * building's jitter does. Nine meshes total, whatever the city is made of.
 *
 * Instances are packed per part rather than per building, so an instance index
 * here has nothing to do with a slot index — `Buildings` keeps the map, in
 * `partAt`. Two of the nine are lit and ramp with the daylight cycle.
 */
const PART = {
  pitched: 0,
  flat: 1,
  parapet: 2,
  awning: 3,
  stack: 4,
  setback: 5,
  plant: 6,
  /** A lit floor band girdling the body. Glow material, so it ramps at dusk. */
  band: 7,
  /** The aircraft warning light tall levels carry. Glow material. */
  beacon: 8,
} as const;

const PART_COUNT = 9;

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
    { width: 2.2, height: 1.6, depth: 1, beacon: false },
    { width: 2.6, height: 4.6, depth: 1, beacon: false },
    { width: 2.8, height: 11.5, depth: 1, beacon: true },
    { width: 3.0, height: 22.0, depth: 1, beacon: true },
    { width: 3.1, height: 27.0, depth: 1, beacon: true },
  ],
  shop: [
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
  /** Roof shape from the shared bank. Level-0 housing overrides it — see `roofOf`. */
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
    // The baseline. A plain block with one lit floor band, and a pitched roof
    // at level 0 — which is what makes a detached house read as a house.
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
    // A canvas skirt at street level. The old default, kept as a style.
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
  const shape = shapeOf(kind, level);
  let width = 0;
  let height = 0;
  for (const style of ZONE_STYLES[kind]) {
    width = Math.max(width, shape.width * style.width * JITTER_MAX);
    height = Math.max(height, shape.height * style.height * HEIGHT_JITTER_MAX);
  }
  return { width, height };
}

const shapeOf = (kind: ZoneKind, level: number): LevelShape => {
  const shapes = ZONE_SHAPES[kind];
  return shapes[Math.max(0, Math.min(shapes.length - 1, level))] ?? (shapes[0] as LevelShape);
};

/**
 * Which roof a building wears.
 *
 * The style decides, with one override: a pitched roof is what makes a detached
 * house read as a house, and the same shape on a megastructure reads as a
 * mistake. So level-0 housing takes the pitch unless its style is the slab, and
 * everything above it wears whatever its style says. A ruin wears the flattest
 * thing in the bank — whatever it had is gone.
 */
function roofOf(kind: ZoneKind, level: number, style: BuildStyle): number {
  if (level < 0) return PART.flat;
  if (kind === 'home' && level === 0) return style.roof === PART.flat ? PART.pitched : PART.parapet;
  return style.roof;
}

class PartBank {
  private readonly meshes: readonly GrowableInstancedMesh[];
  private readonly counts = new Int32Array(PART_COUNT);
  private readonly glows: readonly Glow[];

  constructor(scene: THREE.Scene, capacity: number) {
    const lambert = (color: number): THREE.Material => new THREE.MeshLambertMaterial({ color });
    const unit = (): THREE.BufferGeometry => new THREE.BoxGeometry(1, 1, 1);
    // Unit shapes: 1 x 1 x 1 before the instance scale, so one geometry covers a
    // cottage roof and a megastructure parapet alike.
    const pitched = new THREE.ConeGeometry(0.72, 1, 4);
    // A four-sided cone is a hipped roof only once it is turned onto the grid,
    // and baking the turn into the geometry keeps it out of every write.
    pitched.rotateY(Math.PI / 4);
    // A band is nearly invisible at midday and most of what a street reads as
    // after dark; a warning light gets the lowest floor of the lit surfaces.
    const bandGlow = new Glow(PALETTE.sodium, 0.42);
    const beaconGlow = new Glow(PALETTE.sodium, 0.3);
    this.glows = [bandGlow, beaconGlow];
    const meshes: GrowableInstancedMesh[] = [];
    meshes[PART.pitched] = new GrowableInstancedMesh(scene, pitched, lambert(PALETTE.tile), capacity, {
      castShadow: true,
      name: 'part:pitched',
    });
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
  return base.multiplyScalar(shade(slot) * tintJitter(slot) * styleOf(kind, slot).tint);
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
  private readonly bodies: readonly BodyMeshes[];
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
    this.bodies = Array.from(
      { length: LEVELS },
      (_, level) => new BodyMeshes(scene, kind, level, capacity),
    );
  }

  /** States what this zone's bodies cover, so they can be frustum-culled. */
  setBounds(x: number, z: number, reach: number, top: number): void {
    for (const body of this.bodies) body.mesh.setBounds(x, z, reach, top);
  }

  /** How many buildings this layer is drawing. The append path's `from`. */
  get shownCount(): number {
    return this.shown;
  }

  /**
   * Stages the growth animation for whatever arrived since the last write.
   *
   * A zone that lost buildings clears instead: a merge, an abandonment or a
   * demolition renumbers every slot above it, so an animation keyed to the old
   * numbering would play on the wrong buildings.
   */
  stage(state: Readonly<GameState>, now: number): void {
    const count = countOf(state, this.kind);
    if (count > this.shown) this.growth.stage(this.shown, count, now, 1.4, WAVE_BUDGET);
    else if (count < this.shown) this.growth.clear();
  }

  setOverlay(source: OverlaySource | null): void {
    this.overlay = source;
  }

  /** Registers every body mesh's slot run, so a raycast hit resolves. */
  register(ranges: SlotRanges<ZoneKind>): void {
    for (let l = 0; l < LEVELS; l++) {
      const body = this.bodies[l];
      if (body) ranges.set(body.mesh, this.kind, this.starts[l] ?? 0);
    }
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
    for (let l = 0; l < LEVELS; l++) {
      const body = this.bodies[l];
      if (!body) continue;
      const count = this.levelCount(l);
      const start = this.starts[l] ?? 0;
      body.ensure(count);
      for (let i = 0; i < count; i++) {
        const slot = start + i;
        // Slots past the standing stock are the ruins. They live in the level-0
        // set because they hold a plot and have to be drawn on it, and -1 is
        // what tells the write they hold no level.
        this.writeOne(body, i, slot, slot < standing ? l : -1, bank, dummy, tint, now, true);
      }
      body.setCount(count);
      body.flush();
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
    if (!body) return;
    const start = this.starts[0] ?? 0;
    body.ensure(to - start);
    for (let slot = from; slot < to; slot++) {
      this.writeOne(body, slot - start, slot, 0, bank, dummy, tint, now, true);
    }
    body.setCount(to - start);
    body.flush();
  }

  /** One building: its body, and its dressing out of the shared bank. */
  private writeOne(
    body: BodyMeshes,
    index: number,
    slot: number,
    level: number,
    bank: PartBank,
    dummy: THREE.Object3D,
    tint: THREE.Color,
    now: number,
    place: boolean,
  ): void {
    const at = this.layout.place(this.zone, slot, this.shownMerged, this.shownZoning, SCRATCH_AT);
    const scale = this.growth.scaleAt(slot, now);
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
    body.mesh.setColorAt(
      index,
      bodyColor(this.kind, slot, level, this.overlay?.(this.kind, slot) ?? null, tint),
    );

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

  /** Rewrites body colours only. Matrices are untouched, so this is one pass. */
  recolor(tint: THREE.Color): void {
    const standing = this.shown - this.ruins;
    for (let l = 0; l < LEVELS; l++) {
      const body = this.bodies[l];
      if (!body) continue;
      const start = this.starts[l] ?? 0;
      for (let i = 0; i < this.levelCount(l); i++) {
        const slot = start + i;
        body.mesh.setColorAt(
          i,
          bodyColor(
            this.kind,
            slot,
            slot < standing ? l : -1,
            this.overlay?.(this.kind, slot) ?? null,
            tint,
          ),
        );
      }
      body.flush();
    }
  }

  /** Advances this zone's in-flight growth animations. */
  update(bank: PartBank, dummy: THREE.Object3D, tint: THREE.Color, now: number): boolean {
    // Keyed by *slot*, not by instance, so an animation in flight survives a
    // promotion moving the building between two mesh sets. The level and
    // instance are recovered from the cohort the scene is drawing.
    const standing = this.shown - this.ruins;
    const moving = this.growth.update(now, (slot) => {
      const found = levelAt(this.cohort, slot);
      const level = slot < standing ? Math.max(0, found) : -1;
      const body = this.bodies[Math.max(0, level)];
      if (!body) return;
      this.writeOne(
        body,
        slot - (this.starts[Math.max(0, level)] ?? 0),
        slot,
        level,
        bank,
        dummy,
        tint,
        now,
        false,
      );
    });
    if (moving) for (const body of this.bodies) body.flush();
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

/** How far above the body a roof of each kind rises. */
const roofRise = (part: number): number => (part === PART.pitched ? 1.15 : 0.5);

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
  const roof = roofOf(kind, level, style);
  const rise = roofRise(roof);
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
 * A landmark's mesh set: a pale stone block with a lit band at its base and a
 * mark on the roof that says which size it is.
 *
 * Reuses `CivicMeshes` rather than getting a class of its own, because a
 * landmark is exactly what that class already draws — a building that straddles
 * a reserved square, indexed by the square's lower-left plot. What it does not
 * reuse is the palette: landmarks are the one thing on the map meant to be
 * picked out from across the city, so they are pale stone where everything
 * civic is blue, teal or warm grey.
 *
 * A museum is squat and wide with a shallow lantern; a stadium is a low drum
 * with a tall rim, so the two are told apart by outline at the zoom the player
 * actually plays at rather than by reading a colour.
 */
function landmarkSet(scene: THREE.Scene, landmark: Landmark, capacity: number): CivicMeshes {
  const width = landmark.span * CELL - 1;
  const lit = new Glow(PALETTE.sodium, 0.44);
  if (landmark.span === 2) {
    return civicTrio(
      scene,
      landmark.key,
      { body: PALETTE.landmark, roof: PALETTE.landmarkRoof, height: 3.2 },
      // A lantern set back from the parapet: small, bright, and above the roof
      // line, which is what reads as a museum rather than as another 2x2 slab.
      new THREE.BoxGeometry(width - 2.6, 1.5, width - 2.6),
      lit.material,
      new THREE.Vector3(0, 0.9, 0),
      capacity,
      lit,
      width,
      CELL / 2,
    );
  }
  // A floodlight mast off one corner of a low bowl. The obvious shape — a tall
  // rim around the whole thing — was tried and is worse from the play camera:
  // the rim has to be wider than the roof to read as a rim, which means from
  // overhead it covers the building completely and a stadium is a brown square.
  // A mast leaves the pale bowl showing and is legible from any angle.
  const mast = 7.5;
  return civicTrio(
    scene,
    landmark.key,
    { body: PALETTE.landmark, roof: PALETTE.landmarkRoof, height: 2.0 },
    new THREE.BoxGeometry(0.7, mast, 0.7),
    lit.material,
    new THREE.Vector3(width / 2 - 0.9, mast / 2, width / 2 - 0.9),
    capacity,
    lit,
    width,
    CELL,
  );
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
  // A ruin keeps the shell it had at level 0, so a fire on one still lands on a
  // roof rather than in mid-air.
  const shape = shapeOf(kind, level);
  const style = styleOf(kind, slot);
  const rise = roofRise(roofOf(kind, level, style));
  return shape.height * style.height * heightJitter(slot) + rise / 2;
}

/**
 * A civic building spans two plots on each axis, less the usual street margin —
 * the same 1-unit gutter a shop leaves, so a hospital sits in its block the way
 * everything else does rather than rendering as a slab pushed into the kerb.
 */
const CIVIC_W = 2 * CELL - 1;

/** A university straddles three plots on each axis, less the same gutter. */
const UNIVERSITY_W = 3 * CELL - 1;

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
 * the types have grown apart. Eight of them are a slab with one thing standing
 * on it and say exactly that through `civicTrio`; the hospital and the fire
 * station are modelled — assembled from part tables generated out of `models/`
 * and merged by material, to eight and nine meshes. A list is what both kinds
 * are, and the cost still grows with the *table* rather than with the city:
 * every mesh is built once, in this constructor, and a hundred hospitals are a
 * hundred instances in it rather than a hundred draw calls.
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
 * A slab, the roof on it, and one thing standing on that: nine of the ten types.
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
const UNIVERSITY_TOWER_H = 9.5;

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
 * The two composed types come through here and the eight slabs go through
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
  return new CivicMeshes(scene, meshes, capacity, glows);
}

/**
 * The hospital: a ward slab across the back of the site and a low treatment
 * wing across the front of it, in an L around the ambulance bay.
 *
 * It is one of the two civic types that are *composed* rather than massed, and
 * it earns that by being the building the city is told to buy first — the
 * anchor of the service ladder, on the site the player looks at longest. What
 * it has to do from the play camera is read as a hospital rather than as a pale
 * 2x2 shed, and three things do that, in the order they become visible as the
 * camera comes down:
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
 * The other composed type, and it is composed for the opposite reason to the
 * hospital's. The hospital had to stop reading as a pale shed; this one has to
 * stop reading as the *police station*, which is the same dark 2x2 block a
 * player meets in the same first hour. Height is what separates them, and this
 * has it three ways: a hall, a taller dorm behind, and a 5.3-unit tower over
 * both. The police station is the flattest thing on a civic quad and this is
 * now the tallest, which is a difference that survives any camera angle.
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

/** One mesh set per service, in SERVICES order. */
function civicSet(scene: THREE.Scene, service: Service, capacity: number): CivicMeshes {
  if (service.key === 'hospital') return hospitalSet(scene, capacity);
  if (service.key === 'police') {
    return civicTrio(
      scene,
      service.key,
      { body: PALETTE.police, roof: PALETTE.policeRoof, height: 1.7 },
      // A deep parapet ringing the roof: one closed square block, which is the
      // opposite of the hospital's two-volume L at the same footprint.
      new THREE.BoxGeometry(CIVIC_W + 0.7, 0.7, CIVIC_W + 0.7),
      new THREE.MeshLambertMaterial({ color: PALETTE.police }),
      new THREE.Vector3(0, 0.6, 0),
      capacity,
    );
  }
  if (service.key === 'fire') return fireStationSet(scene, capacity);
  if (service.key === 'school') {
    // A long low hall with a lit clerestory band along its roofline. Read from
    // the play camera it is the flattest thing on a 2x2 site, which is what
    // tells it apart from the police station's parapet at the same footprint.
    const windows = new Glow(PALETTE.sodium, 0.34);
    return civicTrio(
      scene,
      service.key,
      { body: PALETTE.school, roof: PALETTE.schoolRoof, height: 1.5 },
      new THREE.BoxGeometry(CIVIC_W - 1.2, 0.42, CIVIC_W - 1.2),
      windows.material,
      new THREE.Vector3(0, 0.5, 0),
      capacity,
      windows,
    );
  }
  if (service.key === 'transit') {
    // A depot is a long shed with a lit apron down one side: the bays the buses
    // pull out of. Low and open where the police station is low and closed, so
    // the two are told apart at the same footprint by what is on the ground
    // rather than by colour.
    const apron = new Glow(PALETTE.sodium, 0.28);
    return civicTrio(
      scene,
      service.key,
      { body: PALETTE.depot, roof: PALETTE.depotRoof, height: 1.6 },
      new THREE.BoxGeometry(CIVIC_W, 0.16, 1.6),
      apron.material,
      new THREE.Vector3(0, -1.5, -CIVIC_W / 2 + 0.8),
      capacity,
      apron,
    );
  }
  // The university: three plots a side and a tower off the middle of it, taller
  // than anything else the city builds until it reaches arcologies. It is the
  // one civic building meant to be visible from across the map.
  return civicTrio(
    scene,
    'university',
    { body: PALETTE.university, roof: PALETTE.universityRoof, height: 3.2 },
    new THREE.BoxGeometry(3.0, UNIVERSITY_TOWER_H, 3.0),
    new THREE.MeshLambertMaterial({ color: PALETTE.universityRoof }),
    new THREE.Vector3(0, UNIVERSITY_TOWER_H / 2, 0),
    capacity,
    null,
    UNIVERSITY_W,
    CELL,
  );
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
 * Fifteen bodies — one per (zone, level) — and nine shared detail parts. The
 * alternative the styles were designed against is 45 meshes: five levels by
 * three styles by three zones, each a draw call for what is fundamentally the
 * same box. Asserted in test/skyline.test.ts, so a later change cannot quietly
 * double the draw calls.
 *
 * Civic buildings, the city hall, power plants and landmarks are counted
 * separately and are not part of this: they stand on 2x2 and 3x3 sites, have no
 * level ladder, and are told apart by silhouette rather than by style. Ten
 * types — six services, the city hall, the power plant and two landmark sizes
 * — eight of them a slab, a roof and one mark at three meshes each, plus the
 * two modelled ones: the hospital at eight meshes and the fire station at nine.
 * The count grows with the *table* rather than with the city: a mesh is built
 * once per type and every hospital the player opens is another instance in the
 * ones that already exist. See `civicSet`, `modelSet`, `cityHallSet`,
 * `powerPlantSet` and `landmarkSet`.
 */
export const BUILDING_MESH_BUDGET = 24;

/**
 * The building layer. It owns no game state: given counts, it reconciles the
 * scene toward them, and it can always rebuild itself from scratch.
 */
export class Buildings {
  /** One layer per zone, each owning its five body meshes. */
  private readonly zones: readonly ZoneLayer[];
  /** Nine unit shapes, shared by every zone and every level. See `PartBank`. */
  private readonly parts: PartBank;
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
  ) {
    const duration = prefersReducedMotion() ? GROW_SECONDS_REDUCED : GROW_SECONDS;
    this.parts = new PartBank(scene, 128);
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
    for (const zone of this.zones) {
      zone.writeAll(this.parts, this.dummy, this.tint, now);
      zone.register(this.ranges);
    }
    this.parts.end();
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
    const shape = shapeOf(ref.kind, level);
    const style = styleOf(ref.kind, ref.slot);
    let width = shape.width * style.width * widthJitter(ref.slot);
    let depth = shape.width * shape.depth * style.width * depthJitter(ref.slot);
    if (at.plots > 1) {
      if (at.alongX) width = MERGED_SPAN;
      else depth = MERGED_SPAN;
    }
    this.outline.show(at.x, at.z, width, depth, roofline(ref.kind, ref.slot, level));
  }

  /** Advances in-flight growth animations. Returns true while any are running. */
  update(now: number): boolean {
    let moving = false;
    for (const zone of this.zones) {
      moving = zone.update(this.parts, this.dummy, this.tint, now) || moving;
    }
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
