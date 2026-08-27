import * as THREE from 'three';
import { hash01, mixSeed } from '../core/rng';
import {
  CELL,
  CIVIC_SERVICES,
  LANDMARKS,
  LEVELS,
  SEED,
  SERVICES,
  type Landmark,
  type Service,
} from '../sim/config';
import { ZONE, type Zone } from '../sim/citygen';
import {
  cohortStart,
  cohortTotal,
  countOf,
  levelAt,
  levelsOf,
  mergedOf,
  zoneOf,
} from '../sim/economy';
import {
  createPlacement,
  worldX,
  worldZ,
  type CityLayout,
  type Coord,
} from '../sim/layout';
import type { GameState, LevelCohort, ZoneKind } from '../sim/state';
import { Glow } from './glow';
import { GrowableInstancedMesh, SlotRanges } from './growable';
import { GrowthSchedule } from './growth';
import { PALETTE } from './palette';

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
  private ruins = 0;
  private overlay: number | null = null;
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
  ) {
    this.growth = new GrowthSchedule(duration);
    this.bodies = Array.from(
      { length: LEVELS },
      (_, level) => new BodyMeshes(scene, kind, level, capacity),
    );
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

  setOverlay(hex: number | null): void {
    this.overlay = hex;
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
    const at = this.layout.place(this.zone, slot, this.shownMerged, SCRATCH_AT);
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
    body.mesh.setColorAt(index, bodyColor(this.kind, slot, level, this.overlay, tint));

    writeParts(
      this.kind,
      slot,
      level,
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
        body.mesh.setColorAt(i, bodyColor(this.kind, slot, slot < standing ? l : -1, this.overlay, tint));
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
 * its plot and loses everything else, lit bands included.
 */
function writeParts(
  kind: ZoneKind,
  slot: number,
  level: number,
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

  // 1. The roof. Every building has one, ruins included.
  const roof = roofOf(kind, level, style);
  const rise = roofRise(roof);
  dummy.rotation.set(0, 0, 0);
  dummy.position.set(x, (height + rise / 2) * scale, z);
  dummy.scale.set(footW * scale, rise * scale, footD * scale);
  putPart(bank, roof, base + PS.roof, partAt, dummy, null, place);

  // 2. An awning: a skirt overhanging the whole footprint at street level. What
  //    makes a parade of shops read as a parade rather than as one long block.
  if (!ruin && style.awning > 0) {
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
  if (!ruin && style.stack > 0) {
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
  if (!ruin && style.setback > 0) {
    const step = style.setback * height;
    dummy.position.set(x, (height + rise + step / 2) * scale, z);
    dummy.scale.set(footW * 0.72 * scale, step * scale, footD * 0.72 * scale);
    putPart(bank, PART.setback, base + PS.setback, partAt, dummy, partColor(slot, tint), place);
  } else if (place) partAt[base + PS.setback] = -1;

  // 5. Plant: equipment on the far end of the roof from the stack, so a merged
  //    building reads as one long thing with kit down its length rather than as
  //    two shorter ones touching.
  if (!ruin && style.plant > 0) {
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
    if (!ruin && b < style.bands) {
      const up = (b + 1) / (style.bands + 1);
      dummy.position.set(x, height * up * scale, z);
      dummy.scale.set((footW + 0.08) * scale, 0.3 * scale, (footD + 0.08) * scale);
      putPart(bank, PART.band, base + PS.band + b, partAt, dummy, null, place);
    } else if (place) partAt[base + PS.band + b] = -1;
  }

  // 7. The warning light the tall levels carry, which is what sells their scale.
  if (!ruin && shapeOf(kind, level).beacon) {
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
    return new CivicMeshes(
      scene,
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
  return new CivicMeshes(
    scene,
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
 * Hospital, police station, fire station — one mesh set each.
 *
 * The other types are told apart by colour because they all stand on one plot
 * and there is no room to do better. A 2x2 footprint is room, so each of these
 * gets a shape: the hospital is pale and carries a tower off its slab, the
 * police station is a low dark block with a deep parapet, and the fire station
 * is squat with a lit bay-door face on one side. Silhouette first, colour
 * second — that is what makes them findable from the play camera.
 */
class CivicMeshes {
  private readonly body: GrowableInstancedMesh;
  private readonly roof: GrowableInstancedMesh;
  /** Tower for the hospital, parapet for police, bay door for fire. */
  private readonly mark: GrowableInstancedMesh;
  private overlay: number | null = null;

  constructor(
    scene: THREE.Scene,
    private readonly style: CivicStyle,
    mark: THREE.BufferGeometry,
    markMaterial: THREE.Material,
    private readonly markOffset: THREE.Vector3,
    capacity: number,
    /** Set only where the mark is a lit surface — the fire station's doors. */
    private readonly glow: Glow | null = null,
    /** Footprint in world units. The civic quad's, or the university's. */
    width: number = CIVIC_W,
    /** Half the site's span in world units — how far the building sits off the
     *  lower-left plot it is indexed by. */
    private readonly offset: number = CELL / 2,
  ) {
    this.body = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(width, style.height, width),
      new THREE.MeshLambertMaterial({ color: style.body }),
      capacity,
      { castShadow: true, receiveShadow: true },
    );
    this.roof = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(width + 0.3, 0.34, width + 0.3),
      new THREE.MeshLambertMaterial({ color: style.roof }),
      capacity,
      { castShadow: true },
    );
    this.mark = new GrowableInstancedMesh(scene, mark, markMaterial, capacity, {
      castShadow: true,
    });
  }

  ensure(capacity: number): void {
    this.body.ensure(capacity);
    this.roof.ensure(capacity);
    this.mark.ensure(capacity);
  }

  setNight(night: number): void {
    this.glow?.setNight(night);
  }

  setOverlay(hex: number | null): void {
    this.overlay = hex;
  }

  private bodyColor(out: THREE.Color): THREE.Color {
    return this.overlay === null ? out.setRGB(1, 1, 1) : against(this.overlay, this.style.body, out);
  }

  recolor(count: number, tint: THREE.Color): void {
    for (let i = 0; i < count; i++) this.body.setColorAt(i, this.bodyColor(tint));
    this.body.flush();
  }

  /**
   * `cell` is the site's lower-left plot; the building straddles the whole
   * site, so the instance sits half a site along each axis from it.
   */
  write(index: number, cell: Coord, scale: number, dummy: THREE.Object3D, tint: THREE.Color): void {
    const x = worldX(cell.x) + this.offset;
    const z = worldZ(cell.z) + this.offset;
    const h = this.style.height;

    dummy.rotation.set(0, 0, 0);
    dummy.position.set(x, (h / 2) * scale, z);
    dummy.scale.set(1, scale, 1);
    dummy.updateMatrix();
    this.body.setMatrixAt(index, dummy.matrix);
    this.body.setColorAt(index, this.bodyColor(tint));

    dummy.scale.setScalar(scale);
    dummy.position.y = (h + 0.17) * scale;
    dummy.updateMatrix();
    this.roof.setMatrixAt(index, dummy.matrix);

    dummy.position.set(
      x + this.markOffset.x,
      (h + this.markOffset.y) * scale,
      z + this.markOffset.z,
    );
    dummy.updateMatrix();
    this.mark.setMatrixAt(index, dummy.matrix);
  }

  setCount(n: number): void {
    this.body.count = n;
    this.roof.count = n;
    this.mark.count = n;
  }

  flush(): void {
    this.body.flush();
    this.roof.flush();
    this.mark.flush();
  }
}

const TOWER_H = 3.4;
const UNIVERSITY_TOWER_H = 9.5;

/** How tall the city hall's clock tower stands above its slab. */
const HALL_TOWER_H = 8.5;

/**
 * The city hall: a low pale slab with a slim centred clock tower.
 *
 * Centred, and that is the whole distinction from the hospital — which carries
 * a *tower off one corner*, deliberately, so it reads as a wing rather than as
 * a spire. This one is the spire: narrower, taller, dead centre, with a lit band
 * near the top. From the play camera a building with something symmetrical on
 * top of it is the one thing on a 2x2 square that reads as a seat of government
 * rather than as another shed.
 *
 * There is one of these in the whole city, so it is the one civic type whose job
 * is to be *found* rather than merely told apart. Hence the tower rather than a
 * parapet, and hence a roof colour nothing else wears.
 */
function cityHallSet(scene: THREE.Scene, capacity: number): CivicMeshes {
  const clock = new Glow(PALETTE.sodium, 0.5);
  return new CivicMeshes(
    scene,
    { body: PALETTE.hall, roof: PALETTE.hallRoof, height: 2.4 },
    new THREE.BoxGeometry(1.5, HALL_TOWER_H, 1.5),
    clock.material,
    new THREE.Vector3(0, HALL_TOWER_H / 2, 0),
    capacity,
    clock,
  );
}

/** One mesh set per service, in SERVICES order. */
function civicSet(scene: THREE.Scene, service: Service, capacity: number): CivicMeshes {
  if (service.key === 'hospital') {
    return new CivicMeshes(
      scene,
      { body: PALETTE.hospital, roof: PALETTE.hospitalRoof, height: 2.6 },
      new THREE.BoxGeometry(2.4, TOWER_H, 2.4),
      new THREE.MeshLambertMaterial({ color: PALETTE.hospital }),
      // Off-centre, so the tower reads as a wing rather than as a spire.
      new THREE.Vector3(-1.4, TOWER_H / 2, -1.4),
      capacity,
    );
  }
  if (service.key === 'police') {
    return new CivicMeshes(
      scene,
      { body: PALETTE.police, roof: PALETTE.policeRoof, height: 1.7 },
      // A deep parapet ringing the roof: low and closed, the opposite of the
      // hospital's tower at the same footprint.
      new THREE.BoxGeometry(CIVIC_W + 0.7, 0.7, CIVIC_W + 0.7),
      new THREE.MeshLambertMaterial({ color: PALETTE.police }),
      new THREE.Vector3(0, 0.6, 0),
      capacity,
    );
  }
  if (service.key === 'fire') {
    // The bay doors: a lit band across one face, at ground level. The one civic
    // surface that is a light rather than a colour, so it ramps with the cycle.
    const doors = new Glow(PALETTE.sodium, 0.5);
    return new CivicMeshes(
      scene,
      { body: PALETTE.fire, roof: PALETTE.fireRoof, height: 2.0 },
      new THREE.BoxGeometry(CIVIC_W - 0.6, 1.2, 0.3),
      doors.material,
      new THREE.Vector3(0, -1.4, CIVIC_W / 2),
      capacity,
      doors,
    );
  }
  if (service.key === 'school') {
    // A long low hall with a lit clerestory band along its roofline. Read from
    // the play camera it is the flattest thing on a 2x2 site, which is what
    // tells it apart from the police station's parapet at the same footprint.
    const windows = new Glow(PALETTE.sodium, 0.34);
    return new CivicMeshes(
      scene,
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
    return new CivicMeshes(
      scene,
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
  return new CivicMeshes(
    scene,
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
 * Civic buildings, the city hall and landmarks are counted separately and are
 * not part of this: they stand on 2x2 and 3x3 sites, have no level ladder, and
 * are told apart by silhouette rather than by style. Nine types at three meshes
 * each — six services, the city hall and two landmark sizes — and the count
 * grows with the *table* rather than with the city. See `civicSet`,
 * `cityHallSet` and `landmarkSet`.
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
   * hall, and the two landmark sizes.
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

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
  ) {
    const duration = prefersReducedMotion() ? GROW_SECONDS_REDUCED : GROW_SECONDS;
    this.parts = new PartBank(scene, 128);
    this.zones = [
      new ZoneLayer(scene, 'home', ZONE.residential, layout, duration, 64),
      new ZoneLayer(scene, 'shop', ZONE.commercial, layout, duration, 32),
      new ZoneLayer(scene, 'industry', ZONE.industrial, layout, duration, 24),
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
    this.layout.ensure(state.districts);

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
      this.parts.begin();
      for (const zone of this.zones) {
        zone.stage(state, now);
        zone.adopt(state);
        zone.writeAll(this.parts, this.dummy, this.tint, now);
        zone.register(this.ranges);
      }
      this.parts.end();
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
   * Recolours the city by zone. Homes stand on residential plots and shops on
   * commercial ones by construction, so the zone of a building is known from
   * which list placed it — no per-plot lookup needed.
   */
  setZoneOverlay(on: boolean): void {
    const hex: Record<ZoneKind, number> = {
      home: PALETTE.zoneResidential,
      shop: PALETTE.zoneCommercial,
      industry: PALETTE.zoneIndustrial,
    };
    for (const zone of this.zones) {
      zone.setOverlay(on ? hex[zone.kind] : null);
      zone.recolor(this.tint);
    }
    // A civic site is carved out of the zone it sits in, so under the plan it
    // reads as that zone — the overlay states zoning, not what stands there.
    for (const set of this.civic) {
      set.meshes.setOverlay(on ? PALETTE.zoneResidential : null);
      set.meshes.recolor(set.shown, this.tint);
    }
  }

  /**
   * Ramps every lit surface in the city with the day/night phase.
   *
   * Called once a frame, and cheap enough to be: it touches four materials at
   * most — the shared band and beacon, the fire station's doors, the school's
   * clerestory — and never an instance buffer.
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
    const at = this.layout.place(zoneOf(ref.kind), ref.slot, mergedOf(state, ref.kind), SCRATCH_AT);
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
