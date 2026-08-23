import * as THREE from 'three';
import { hash01, mixSeed } from '../core/rng';
import {
  CELL,
  CIVIC_SERVICES,
  LEVELS,
  SEED,
  SERVICES,
  type Service,
} from '../sim/config';
import { ZONE } from '../sim/citygen';
import { cohortStart, cohortTotal, levelAt } from '../sim/economy';
import {
  createPlacement,
  worldX,
  worldZ,
  type CityLayout,
  type Coord,
  type Placement,
} from '../sim/layout';
import type { GameState, LevelCohort, ZoneKind } from '../sim/state';
import { Glow } from './glow';
import { GrowableInstancedMesh } from './growable';
import { GrowthSchedule } from './growth';
import { PALETTE } from './palette';

const GROW_SECONDS = 0.55;
const GROW_SECONDS_REDUCED = 0.12;

/** Most buildings that arrive at once are animated; a huge backlog is capped. */
const WAVE_BUDGET = 320;

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * What a home looks like at each level.
 *
 * These used to be fields on `Tier` in sim config, which was the wrong home for
 * them: a footprint width and a roof pitch change nothing the simulation can
 * observe. The capacities they sat beside are still simulation and stayed there
 * as LEVEL_CAPACITY; the geometry is the renderer's business and lives here.
 */
interface LevelStyle {
  /** Footprint width in world units (must stay under CELL). */
  readonly width: number;
  readonly height: number;
  /** Pitched roofs read as houses; flat roofs read as blocks. */
  readonly pitched: boolean;
  /** Tall levels get an aircraft warning light, which is what sells their scale. */
  readonly beacon: boolean;
}

const HOME_STYLES: readonly LevelStyle[] = [
  { width: 2.2, height: 1.6, pitched: true, beacon: false },
  { width: 2.6, height: 4.6, pitched: false, beacon: false },
  { width: 2.8, height: 11.5, pitched: false, beacon: true },
  { width: 3.0, height: 22.0, pitched: false, beacon: true },
];

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

/** A slight warm/cool tint per building, on top of the shade. */
const tintJitter = (slot: number): number => 0.94 + variety(slot, 0x3d) * 0.12;

/**
 * Roof shapes. Three of them, shared by every level and both zones.
 *
 * Shared is the point. Three variants across four levels and two zones would be
 * 24 growable meshes and 24 draw calls for what is fundamentally the same box —
 * so instead the geometry is a *unit* shape and the level's width and height
 * arrive as an instance scale, the same way a building's own jitter does. Three
 * meshes total, whatever the city is made of.
 */
const ROOF = { pitched: 0, flat: 1, parapet: 2 } as const;
const ROOF_VARIANTS = 3;

/**
 * Which roof a building wears, from its slot and its level.
 *
 * Level-aware rather than free: a pitched roof is what makes a detached house
 * read as a house, and the same shape on an arcology reads as a mistake. So the
 * bottom of the ladder is mostly pitched and everything above it is flat or
 * parapeted, with the mix — not the rule — coming from the hash.
 */
function roofVariant(slot: number, level: number): number {
  const roll = variety(slot, 0x53);
  if (level <= 0) return roll < 0.72 ? ROOF.pitched : ROOF.parapet;
  return roll < 0.55 ? ROOF.flat : ROOF.parapet;
}

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
 * The city's roofs: three unit shapes, instanced, shared by every level.
 *
 * Instances are packed per variant rather than per building, so an instance
 * index here has nothing to do with a slot index — `Buildings` keeps the map.
 * Rebuilt whole whenever the skyline moves, which is the same rule the bodies
 * follow and the reason there is nothing to keep in step.
 */
class Roofs {
  private readonly meshes: readonly GrowableInstancedMesh[];
  private readonly counts = new Int32Array(ROOF_VARIANTS);

  constructor(scene: THREE.Scene, capacity: number) {
    const material = (color: number): THREE.Material =>
      new THREE.MeshLambertMaterial({ color });
    // Unit shapes: 1 x 1 x 1 before the instance scale, so one geometry covers
    // a cottage roof and an arcology parapet alike.
    const pitched = new THREE.ConeGeometry(0.72, 1, 4);
    // A four-sided cone is a hipped roof only once it is turned onto the grid,
    // and baking the turn into the geometry keeps it out of every write.
    pitched.rotateY(Math.PI / 4);
    this.meshes = [
      new GrowableInstancedMesh(scene, pitched, material(PALETTE.tile), capacity, {
        castShadow: true,
        name: 'roof:pitched',
      }),
      new GrowableInstancedMesh(scene, new THREE.BoxGeometry(0.62, 1, 0.62), material(PALETTE.parapet), capacity, {
        castShadow: true,
        name: 'roof:flat',
      }),
      new GrowableInstancedMesh(scene, new THREE.BoxGeometry(1.04, 1, 1.04), material(PALETTE.parapet), capacity, {
        castShadow: true,
        name: 'roof:parapet',
      }),
    ];
  }

  /** Starts a rebuild. Every variant's instance list is written from scratch. */
  begin(): void {
    this.counts.fill(0);
  }

  /** Appends one roof and hands back the instance index it landed on. */
  place(variant: number, matrix: THREE.Matrix4): number {
    const mesh = this.meshes[variant];
    if (!mesh) return 0;
    const index = this.counts[variant] ?? 0;
    this.counts[variant] = index + 1;
    mesh.ensure(index + 1);
    mesh.setMatrixAt(index, matrix);
    return index;
  }

  /** Rewrites one roof already placed. Used by the growth animation. */
  move(variant: number, index: number, matrix: THREE.Matrix4): void {
    this.meshes[variant]?.setMatrixAt(index, matrix);
  }

  end(): void {
    for (let v = 0; v < ROOF_VARIANTS; v++) {
      const mesh = this.meshes[v];
      if (!mesh) continue;
      mesh.count = this.counts[v] ?? 0;
      mesh.flush();
    }
  }

  flush(): void {
    for (const mesh of this.meshes) mesh.flush();
  }
}

/**
 * One InstancedMesh set per building level.
 *
 * A level's buildings are a *contiguous run of slots* — the oldest hold the
 * highest levels — so each set draws one range and a promotion is a range
 * boundary moving by one. Instance index and slot index are therefore different
 * numbers, and every per-building hash below takes the slot: a building's
 * height jitter and shade must not change when the cohort under it shifts.
 */
class LevelMeshes {
  private readonly body: GrowableInstancedMesh;
  private readonly beacon: GrowableInstancedMesh | null;
  /** Only levels tall enough to carry a warning light have one to ramp. */
  private readonly beaconGlow: Glow | null;
  /** Zone colour while the overlay is on, null for the city's own palette. */
  private overlay: number | null = null;

  constructor(scene: THREE.Scene, readonly style: LevelStyle, level: number, capacity: number) {
    const w = style.width;
    this.body = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(w, style.height, w),
      new THREE.MeshLambertMaterial({ color: PALETTE.concrete }),
      capacity,
      { castShadow: true, receiveShadow: true, name: `home:${level}` },
    );
    // A warning light is nearly invisible at midday and the whole silhouette
    // after dark, so it gets the lowest floor of the three lit surfaces.
    this.beaconGlow = style.beacon ? new Glow(PALETTE.sodium, 0.3) : null;
    this.beacon = this.beaconGlow
      ? new GrowableInstancedMesh(
          scene,
          new THREE.BoxGeometry(0.34, 0.34, 0.34),
          this.beaconGlow.material,
          capacity,
        )
      : null;
  }

  setNight(night: number): void {
    this.beaconGlow?.setNight(night);
  }

  ensure(capacity: number): void {
    this.body.ensure(capacity);
    this.beacon?.ensure(capacity);
  }

  setOverlay(hex: number | null): void {
    this.overlay = hex;
  }

  /**
   * The colour of one building.
   *
   * A ruin is the one case that is not a jitter: desaturated toward the concrete
   * it is made of and darkened well below anything a lived-in building reaches,
   * so a boarded-up plot is legible from the play camera without opening an
   * overlay. It keeps the plot and loses everything else.
   */
  private bodyColor(slot: number, level: number, out: THREE.Color): THREE.Color {
    const base =
      this.overlay === null
        ? out.setHex(PALETTE.concrete)
        : against(this.overlay, PALETTE.concrete, out);
    if (level < 0) {
      // Toward grey, then down. The zone overlay survives it — a ruin is still
      // standing on residential land and the overlay states zoning.
      const grey = (base.r + base.g + base.b) / 3;
      return base.setRGB(
        (base.r + grey * 3) * 0.14,
        (base.g + grey * 3) * 0.14,
        (base.b + grey * 3) * 0.14,
      );
    }
    // The per-building shade and tint survive the overlay, so the plan still
    // reads as buildings rather than as a flat sheet of one colour.
    return base.multiplyScalar(shade(slot) * tintJitter(slot));
  }

  /** Rewrites colours only. Matrices are untouched, so this is one buffer pass. */
  recolor(from: number, count: number, standing: number, tint: THREE.Color): void {
    for (let i = 0; i < count; i++) {
      const slot = from + i;
      this.body.setColorAt(i, this.bodyColor(slot, slot < standing ? 0 : -1, tint));
    }
    this.body.flush();
  }

  /**
   * Writes one building, and hands its roof to the shared bank.
   *
   * Returns the roof's instance index so the caller can find it again when a
   * growth animation rewrites this slot: roofs are packed per variant, so the
   * index has nothing to do with the slot it came from.
   */
  write(
    index: number,
    slot: number,
    level: number,
    at: Placement,
    scale: number,
    dummy: THREE.Object3D,
    tint: THREE.Color,
    roofs: Roofs,
    roofIndex: number,
  ): number {
    const stretch = heightJitter(slot);
    const height = this.style.height * stretch;
    // A merged parcel is drawn by stretching the level's own box along the
    // parcel's axis rather than by a second geometry, exactly as the roofs and
    // the jitter already do. One extra multiply, no extra draw call.
    const span = at.plots > 1 ? MERGED_SPAN / this.style.width : 1;
    const sx = widthJitter(slot) * (at.alongX ? span : 1);
    const sz = depthJitter(slot) * (at.alongX ? 1 : span);

    dummy.rotation.set(0, 0, 0);
    dummy.position.set(at.x, (height / 2) * scale, at.z);
    dummy.scale.set(sx, stretch * scale, sz);
    dummy.updateMatrix();
    this.body.setMatrixAt(index, dummy.matrix);
    this.body.setColorAt(index, this.bodyColor(slot, level, tint));

    // A ruin wears the flattest thing in the bank: whatever it had is gone.
    const variant = level < 0 ? ROOF.flat : roofVariant(slot, level);
    const rise = variant === ROOF.pitched ? 1.15 : 0.5;
    dummy.position.y = (height + rise / 2) * scale;
    dummy.scale.set(this.style.width * sx, rise * scale, this.style.width * sz);
    dummy.updateMatrix();
    const placed = roofIndex < 0 ? roofs.place(variant, dummy.matrix) : roofIndex;
    if (roofIndex >= 0) roofs.move(variant, roofIndex, dummy.matrix);

    if (this.beacon) {
      dummy.position.y = (height + rise + 0.35) * scale;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      this.beacon.setMatrixAt(index, dummy.matrix);
    }
    return placed;
  }

  setCount(n: number): void {
    this.body.count = n;
    if (this.beacon) this.beacon.count = n;
  }

  flush(): void {
    this.body.flush();
    this.beacon?.flush();
  }
}

const SHOP_H = 2.4;
const SHOP_W = 3;

/**
 * Two ways to dress a shopfront, out of one unit box.
 *
 * A *canopy* is a wide thin skirt at street level; a *fin* is a sign board
 * standing above the roofline. Which one a shop wears comes from its slot, so a
 * parade reads as a parade rather than as one block repeated — and both are
 * instances of the same 1x1x1 geometry, scaled, exactly as the roof bank does.
 * That is the whole budget for commercial variety: one extra draw call, shared
 * by every level and every shop in the city.
 */
const SHOPFRONT = { canopy: 0, fin: 1 } as const;

/** Which one this shop wears. Roughly two canopies to every fin. */
const shopfront = (slot: number): number =>
  variety(slot, 0x61) < 0.66 ? SHOPFRONT.canopy : SHOPFRONT.fin;

/**
 * Shops are a single tier: a low box wearing a lit fascia under a dark cap.
 *
 * The obvious version puts the sodium slab on top, which from an overhead
 * camera turns every shop into a solid orange square and swamps the district.
 * Banding it below the roofline means commerce glows from street level and
 * reads as dark roofs from above, which is what a high street actually does.
 */
class ShopMeshes {
  private readonly body: GrowableInstancedMesh;
  private readonly fascia: GrowableInstancedMesh;
  private readonly cap: GrowableInstancedMesh;
  /** Canopy or sign fin, one instance per shop. See SHOPFRONT. */
  private readonly front: GrowableInstancedMesh;
  private readonly fasciaGlow = new Glow(PALETTE.sodium, 0.42);
  private overlay: number | null = null;
  /** How many of the shops written are still trading. The rest are ruins. */
  private standing = 0;

  constructor(scene: THREE.Scene, capacity: number) {
    this.body = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(SHOP_W, SHOP_H, SHOP_W),
      new THREE.MeshLambertMaterial({ color: PALETTE.shop }),
      capacity,
      { castShadow: true, receiveShadow: true, name: 'shop:body' },
    );
    this.fascia = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(3.08, 0.34, 3.08),
      this.fasciaGlow.material,
      capacity,
      { name: 'shop:fascia' },
    );
    this.cap = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(3.16, 0.26, 3.16),
      new THREE.MeshLambertMaterial({ color: PALETTE.parapet }),
      capacity,
      { castShadow: true },
    );
    // A unit box, so one geometry is both a canopy and a fin. The material is
    // the canvas colour and the instance colour is the per-shop jitter on top
    // of it — the same setColorAt path the bodies already use.
    this.front = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.awning }),
      capacity,
      { castShadow: true, name: 'shop:front' },
    );
  }

  ensure(capacity: number): void {
    this.body.ensure(capacity);
    this.fascia.ensure(capacity);
    this.cap.ensure(capacity);
    this.front.ensure(capacity);
  }

  setNight(night: number): void {
    this.fasciaGlow.setNight(night);
  }

  setOverlay(hex: number | null): void {
    this.overlay = hex;
  }

  /**
   * Per-shop tint, and the shuttered read for a ruin.
   *
   * The material is already the dark shop blue, so white is the identity for
   * the shader's multiply and the jitter is a nudge either side of it. A closed
   * shop goes well under that and loses its lit sign entirely — the fascia is a
   * separate instanced mesh, so the ruins simply fall off the end of its count
   * rather than needing a per-instance emissive the material cannot carry.
   */
  private bodyColor(slot: number, out: THREE.Color): THREE.Color {
    const closed = slot >= this.standing;
    const base =
      this.overlay === null ? out.setRGB(1, 1, 1) : against(this.overlay, PALETTE.shop, out);
    if (closed) return base.multiplyScalar(0.4);
    return base.multiplyScalar(shade(slot) * tintJitter(slot));
  }

  recolor(count: number, tint: THREE.Color): void {
    for (let i = 0; i < count; i++) this.body.setColorAt(i, this.bodyColor(i, tint));
    this.body.flush();
  }

  /**
   * The canvas shade of one shopfront. Not overlay-aware, and deliberately: the
   * zone overlay states zoning and only the bodies carry it, which is the rule
   * the roofs, caps and stacks already follow.
   */
  private frontColor(slot: number, out: THREE.Color): THREE.Color {
    return out.setRGB(1, 1, 1).multiplyScalar(shade(slot) * tintJitter(slot));
  }

  /** How many shops still trade. Everything past this is drawn shuttered. */
  setStanding(n: number): void {
    this.standing = n;
  }

  write(index: number, at: Placement, scale: number, dummy: THREE.Object3D, tint: THREE.Color): void {
    const span = at.plots > 1 ? MERGED_SPAN / SHOP_W : 1;
    const sx = widthJitter(index) * (at.alongX ? span : 1);
    const sz = depthJitter(index) * (at.alongX ? 1 : span);
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(at.x, (SHOP_H / 2) * scale, at.z);
    dummy.scale.set(sx, scale, sz);
    dummy.updateMatrix();
    this.body.setMatrixAt(index, dummy.matrix);
    this.body.setColorAt(index, this.bodyColor(index, tint));

    dummy.scale.set(sx * scale, scale, sz * scale);
    dummy.position.y = (SHOP_H - 0.42) * scale;
    dummy.updateMatrix();
    this.fascia.setMatrixAt(index, dummy.matrix);

    dummy.position.y = (SHOP_H + 0.13) * scale;
    dummy.updateMatrix();
    this.cap.setMatrixAt(index, dummy.matrix);

    // The dressing. A canopy is a skirt that overhangs the whole footprint at
    // street level; a fin is a board standing on the roof, turned onto the long
    // axis so a merged shop wears one long sign rather than two short ones.
    const long = SHOP_W * (at.alongX ? sx : sz);
    if (shopfront(index) === SHOPFRONT.canopy) {
      const reach = 1 + variety(index, 0x6f);
      dummy.scale.set(
        (SHOP_W * sx + reach) * scale,
        0.22 * scale,
        (SHOP_W * sz + reach) * scale,
      );
      dummy.position.y = SHOP_H * 0.46 * scale;
    } else {
      const rise = 0.7 + variety(index, 0x6f) * 0.7;
      const board = long * (0.5 + variety(index, 0x7b) * 0.35);
      dummy.scale.set(
        (at.alongX ? board : 0.18) * scale,
        rise * scale,
        (at.alongX ? 0.18 : board) * scale,
      );
      dummy.position.y = (SHOP_H + 0.26 + rise / 2) * scale;
    }
    dummy.updateMatrix();
    this.front.setMatrixAt(index, dummy.matrix);
    this.front.setColorAt(index, this.frontColor(index, tint));
  }

  setCount(n: number): void {
    this.body.count = n;
    // The lit signs stop at the last trading shop. A shuttered high street with
    // its fascias still glowing would read as a rendering bug rather than as a
    // city in trouble.
    this.fascia.count = Math.min(n, this.standing);
    this.cap.count = n;
    this.front.count = n;
  }

  flush(): void {
    this.body.flush();
    this.fascia.flush();
    this.cap.flush();
    this.front.flush();
  }
}

const INDUSTRY_W = 3.5;
const INDUSTRY_H = 1.3;
const STACK_H = 1.9;

/**
 * Industry is the anti-tower: wide, low and flat, with one stack.
 *
 * Height is what the housing tiers use to say "bigger", so industry cannot
 * compete on it without reading as a stunted apartment block. It competes on
 * footprint instead — wider than anything else on the map and barely half a
 * shop tall — and the stack is the one vertical, which is what makes the type
 * legible at the zoom the player actually plays at.
 */
class IndustryMeshes {
  private readonly body: GrowableInstancedMesh;
  private readonly roof: GrowableInstancedMesh;
  private readonly stack: GrowableInstancedMesh;
  /** Roof plant: a vent, a hopper or a low housing. One instance per works. */
  private readonly vent: GrowableInstancedMesh;
  private overlay: number | null = null;

  constructor(scene: THREE.Scene, capacity: number) {
    this.body = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(INDUSTRY_W, INDUSTRY_H, INDUSTRY_W * 0.86),
      new THREE.MeshLambertMaterial({ color: PALETTE.industry }),
      capacity,
      { castShadow: true, receiveShadow: true },
    );
    this.roof = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(INDUSTRY_W + 0.12, 0.2, INDUSTRY_W * 0.86 + 0.12),
      new THREE.MeshLambertMaterial({ color: PALETTE.industryRoof }),
      capacity,
      { castShadow: true },
    );
    this.stack = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(0.42, STACK_H, 0.42),
      new THREE.MeshLambertMaterial({ color: PALETTE.stack }),
      capacity,
      { castShadow: true },
    );
    // The second and last mesh the variety budget buys: a unit box on the roof,
    // scaled per works into anything from a low housing to a tall vent. Shared
    // by every level, exactly as the shopfront and the roof bank are.
    this.vent = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.vent }),
      capacity,
      { castShadow: true, name: 'industry:vent' },
    );
  }

  ensure(capacity: number): void {
    this.body.ensure(capacity);
    this.roof.ensure(capacity);
    this.stack.ensure(capacity);
    this.vent.ensure(capacity);
  }

  setOverlay(hex: number | null): void {
    this.overlay = hex;
  }

  /**
   * Per-works tint. The same jitter the homes and shops have had all along —
   * industry was the one type still drawn as one flat colour, which is what
   * made a run of works read as a single slab from the play camera.
   */
  private bodyColor(slot: number, out: THREE.Color): THREE.Color {
    const base =
      this.overlay === null ? out.setRGB(1, 1, 1) : against(this.overlay, PALETTE.industry, out);
    return base.multiplyScalar(shade(slot) * tintJitter(slot));
  }

  recolor(count: number, tint: THREE.Color): void {
    for (let i = 0; i < count; i++) this.body.setColorAt(i, this.bodyColor(i, tint));
    this.body.flush();
  }

  write(index: number, at: Placement, scale: number, dummy: THREE.Object3D, tint: THREE.Color): void {
    const x = at.x;
    const z = at.z;
    const span = at.plots > 1 ? MERGED_SPAN / INDUSTRY_W : 1;
    // The same +-12% footprint jitter every other type has. A yard is not a
    // stamped rectangle, and the merged span multiplies on top of it.
    const sx = widthJitter(index) * (at.alongX ? span : 1);
    const sz = depthJitter(index) * (at.alongX ? 1 : span);
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(x, (INDUSTRY_H / 2) * scale, z);
    dummy.scale.set(sx, scale, sz);
    dummy.updateMatrix();
    this.body.setMatrixAt(index, dummy.matrix);
    this.body.setColorAt(index, this.bodyColor(index, tint));

    dummy.scale.set(sx * scale, scale, sz * scale);
    dummy.position.y = (INDUSTRY_H + 0.1) * scale;
    dummy.updateMatrix();
    this.roof.setMatrixAt(index, dummy.matrix);

    // Off to a corner rather than centred: a stack on the ridge reads as a lift
    // shaft, a stack at the edge reads as a chimney.
    const nudge = hash01(index ^ 0x1f3a55c1) < 0.5 ? -1 : 1;
    dummy.scale.setScalar(scale);
    dummy.position.set(
      x + nudge * INDUSTRY_W * 0.34 * sx,
      (INDUSTRY_H + STACK_H / 2) * scale,
      z - INDUSTRY_W * 0.28 * sz,
    );
    dummy.updateMatrix();
    this.stack.setMatrixAt(index, dummy.matrix);

    // Plant on the other end of the roof, so a merged works reads as one long
    // shed with equipment down its length rather than as two sheds touching.
    const tall = 0.4 + variety(index, 0x95) * 1.1;
    const wide = 0.5 + variety(index, 0xa3) * 0.9;
    dummy.scale.set(wide * scale, tall * scale, wide * scale);
    dummy.position.set(
      x - nudge * INDUSTRY_W * 0.3 * sx,
      (INDUSTRY_H + 0.2 + tall / 2) * scale,
      z + INDUSTRY_W * 0.22 * sz,
    );
    dummy.updateMatrix();
    this.vent.setMatrixAt(index, dummy.matrix);
  }

  setCount(n: number): void {
    this.body.count = n;
    this.roof.count = n;
    this.stack.count = n;
    this.vent.count = n;
  }

  flush(): void {
    this.body.flush();
    this.roof.flush();
    this.stack.flush();
    this.vent.flush();
  }
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
 * Top of whatever is standing on a plot, in world units.
 *
 * Exported so the fire layer can put a flame on a roof without a second copy
 * of the height rules — including the per-building jitter, which is the whole
 * reason this cannot simply be `tier.height`: a flame at the nominal height
 * floats above a short block and sinks into a tall one.
 */
export function roofline(kind: ZoneKind, slot: number, level: number): number {
  if (kind === 'shop') return SHOP_H + 0.13;
  if (kind === 'industry') return INDUSTRY_H + 0.1;
  // A ruin keeps the shell it had at level 0, so a fire on one still lands on
  // a roof rather than in mid-air.
  const style = HOME_STYLES[Math.max(0, level)] ?? HOME_STYLES[0];
  if (!style) return 0;
  const rise = roofVariant(slot, level) === ROOF.pitched ? 1.15 : 0.5;
  return style.height * heightJitter(slot) + rise / 2;
}

/**
 * The building layer. It owns no game state: given counts, it reconciles the
 * scene toward them, and it can always rebuild itself from scratch.
 */
export class Buildings {
  private readonly levels: LevelMeshes[];
  /** Three shapes, shared by every level. See `Roofs`. */
  private readonly roofs: Roofs;
  /**
   * Which roof instance each slot's roof landed on.
   *
   * Roofs are packed per variant, so the index bears no relation to the slot —
   * and the growth animation rewrites one slot at a time, long after the pack
   * order was decided. Indexed by slot, grown with the city.
   */
  private roofSlot = new Int32Array(0);
  private readonly shops: ShopMeshes;
  private readonly industry: IndustryMeshes;
  /**
   * One entry per service, in SERVICES order, each owning its own mesh set,
   * growth schedule and shown count. Civic sites are reserved up front and
   * indexed by a fixed interleave, so unlike every earlier version of this the
   * three types never move and never need rewriting as a block.
   */
  private readonly civic: ReadonlyArray<{
    readonly service: Service;
    readonly meshes: CivicMeshes;
    readonly growth: GrowthSchedule;
    readonly site: (i: number) => Coord;
    shown: number;
  }>;
  private readonly homeGrowth: GrowthSchedule;
  private readonly shopGrowth: GrowthSchedule;
  private readonly industryGrowth: GrowthSchedule;
  private readonly dummy = new THREE.Object3D();
  private readonly tint = new THREE.Color();

  private shownHomes = 0;
  private shownMergedHomes = -1;
  private shownShops = 0;
  private shownTrading = -1;
  private shownMergedShops = -1;
  private shownIndustry = 0;
  private shownMergedIndustry = -1;
  /**
   * One reusable placement. `place` fills it rather than returning a fresh
   * object, because `update` asks for one per in-flight building per frame.
   */
  private readonly at = createPlacement();
  /**
   * The cohort the scene is currently drawing, and where each level's run of
   * slots begins.
   *
   * Held rather than re-read because `update` runs every frame and has no state
   * to consult: an in-flight growth animation is identified by slot, and
   * turning a slot back into a level and an instance needs exactly these.
   */
  private readonly shownHomeLevels: LevelCohort = new Array<number>(LEVELS).fill(0);
  private readonly homeStart: number[] = new Array<number>(LEVELS).fill(0);
  private shownRuins = 0;

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
  ) {
    const duration = prefersReducedMotion() ? GROW_SECONDS_REDUCED : GROW_SECONDS;
    this.homeGrowth = new GrowthSchedule(duration);
    this.shopGrowth = new GrowthSchedule(duration);
    this.industryGrowth = new GrowthSchedule(duration);
    this.levels = HOME_STYLES.map((style, level) => new LevelMeshes(scene, style, level, 64));
    this.roofs = new Roofs(scene, 128);
    this.shops = new ShopMeshes(scene, 32);
    this.industry = new IndustryMeshes(scene, 24);
    this.civic = SERVICES.map((service) => ({
      service,
      meshes: civicSet(scene, service, 8),
      growth: new GrowthSchedule(duration),
      // The four 2x2 types read one interleaved list by their position in it;
      // the university has a list of its own and does not touch the interleave.
      site:
        service.span === 3
          ? (i: number) => this.layout.universitySiteCell(i)
          : ((offset) => (i: number) => this.layout.civicSiteFor(offset, i))(
              CIVIC_SERVICES.findIndex((entry) => entry.key === service.key),
            ),
      shown: 0,
    }));
  }

  /** How many of a service the state has, without a lookup table per caller. */
  private static count(state: Readonly<GameState>, service: Service): number {
    return service.key === 'hospital' ? state.hospitals
      : service.key === 'police' ? state.police
      : service.key === 'fire' ? state.fire
      : service.key === 'school' ? state.schools
      : state.universities;
  }

  /** How many instances a level's mesh set draws: its cohort, plus the ruins. */
  private levelCount(l: number): number {
    return (this.shownHomeLevels[l] ?? 0) + (l === 0 ? this.shownRuins : 0);
  }

  /** Brings the scene in line with the simulation. Cheap when nothing changed. */
  sync(state: Readonly<GameState>, now: number): void {
    this.layout.ensure(state.districts);

    // One test for the whole skyline: a build, a promotion and an abandonment
    // all move the cohort, and all three need the same rewrite. Cheap to ask —
    // four integers — and it is asked once a frame rather than per building.
    if (this.homesChanged(state)) {
      if (state.homes > this.shownHomes) {
        this.homeGrowth.stage(this.shownHomes, state.homes, now, 1.4, WAVE_BUDGET);
      } else if (state.homes < this.shownHomes) {
        this.homeGrowth.clear();
      }
      this.shownHomes = state.homes;
      this.shownMergedHomes = state.mergedR;
      this.shownRuins = state.homes - cohortTotal(state.homeLevels);
      for (let l = 0; l < LEVELS; l++) this.shownHomeLevels[l] = state.homeLevels[l] ?? 0;
      cohortStart(this.shownHomeLevels, this.homeStart);
      this.writeHomes(now);
    }

    // A shop closing changes no count the loop below would notice — the plot is
    // still there and still has a shop on it — so the ruin count is part of
    // what "changed" means for commerce.
    // A merge is a rewrite as surely as a purchase is: it moves a shop onto a
    // two-plot footprint and shifts every slot behind it down the list.
    const tradingShops = state.shops - state.abandonedC;
    const shopsMerged = state.mergedC !== this.shownMergedShops;
    if (state.shops > this.shownShops && !shopsMerged) {
      const from = this.shownShops;
      this.shopGrowth.stage(from, state.shops, now, 1.4, WAVE_BUDGET);
      this.shops.setStanding(tradingShops);
      this.writeShops(from, state.shops, state.mergedC, now);
    } else if (
      state.shops !== this.shownShops ||
      shopsMerged ||
      tradingShops !== this.shownTrading
    ) {
      if (state.shops < this.shownShops) this.shopGrowth.clear();
      this.shops.setStanding(tradingShops);
      this.writeShops(0, state.shops, state.mergedC, now);
    }
    this.shownShops = state.shops;
    this.shownMergedShops = state.mergedC;
    this.shownTrading = tradingShops;

    const worksMerged = state.mergedI !== this.shownMergedIndustry;
    if (state.industry > this.shownIndustry && !worksMerged) {
      const from = this.shownIndustry;
      this.industryGrowth.stage(from, state.industry, now, 1.4, WAVE_BUDGET);
      this.writeIndustry(from, state.industry, state.mergedI, now);
    } else if (state.industry !== this.shownIndustry || worksMerged) {
      if (state.industry < this.shownIndustry) this.industryGrowth.clear();
      this.writeIndustry(0, state.industry, state.mergedI, now);
    }
    this.shownIndustry = state.industry;
    this.shownMergedIndustry = state.mergedI;

    for (const set of this.civic) {
      const count = Buildings.count(state, set.service);
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

  /** Whether anything about the housing stock the scene is drawing has moved. */
  private homesChanged(state: Readonly<GameState>): boolean {
    if (state.homes !== this.shownHomes) return true;
    if (state.mergedR !== this.shownMergedHomes) return true;
    for (let l = 0; l < LEVELS; l++) {
      if ((state.homeLevels[l] ?? 0) !== this.shownHomeLevels[l]) return true;
    }
    return false;
  }

  /**
   * Rewrites every home, level by level.
   *
   * Whole-skyline rather than incremental, because a promotion moves one
   * building between two sets and shifts the instance index of every building
   * above it — there is no incremental edit that is cheaper to get right. It
   * runs only when the cohort actually moves, which is a handful of times a
   * minute, and it is O(homes) with no allocation.
   */
  private writeHomes(now: number): void {
    this.homeGrowth.ensure(this.shownHomes);
    if (this.roofSlot.length < this.shownHomes) {
      this.roofSlot = new Int32Array(Math.max(64, this.shownHomes * 2));
    }
    const standing = this.shownHomes - this.shownRuins;
    this.roofs.begin();
    for (let l = 0; l < LEVELS; l++) {
      const meshes = this.levels[l];
      if (!meshes) continue;
      const count = this.levelCount(l);
      const start = this.homeStart[l] ?? 0;
      meshes.ensure(count);
      for (let i = 0; i < count; i++) {
        const slot = start + i;
        // Slots past the standing stock are the ruins. They live in the level-0
        // set because they hold a plot and have to be drawn on it, and -1 is
        // what tells the write they hold no level.
        this.roofSlot[slot] = meshes.write(
          i,
          slot,
          slot < standing ? l : -1,
          this.layout.place(ZONE.residential, slot, this.shownMergedHomes, this.at),
          this.homeGrowth.scaleAt(slot, now),
          this.dummy,
          this.tint,
          this.roofs,
          -1,
        );
      }
      meshes.setCount(count);
      meshes.flush();
    }
    this.roofs.end();
  }

  private writeShops(from: number, to: number, merged: number, now: number): void {
    this.shops.ensure(to);
    this.shopGrowth.ensure(to);
    for (let i = from; i < to; i++) {
      this.shops.write(
        i,
        this.layout.place(ZONE.commercial, i, merged, this.at),
        this.shopGrowth.scaleAt(i, now),
        this.dummy,
        this.tint,
      );
    }
    this.shops.setCount(to);
    this.shops.flush();
  }

  private writeIndustry(from: number, to: number, merged: number, now: number): void {
    this.industry.ensure(to);
    this.industryGrowth.ensure(to);
    for (let i = from; i < to; i++) {
      this.industry.write(
        i,
        this.layout.place(ZONE.industrial, i, merged, this.at),
        this.industryGrowth.scaleAt(i, now),
        this.dummy,
        this.tint,
      );
    }
    this.industry.setCount(to);
    this.industry.flush();
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
    for (const level of this.levels) level.setOverlay(on ? PALETTE.zoneResidential : null);
    this.shops.setOverlay(on ? PALETTE.zoneCommercial : null);
    this.industry.setOverlay(on ? PALETTE.zoneIndustrial : null);
    // A civic site is carved out of the zone it sits in, so under the plan it
    // reads as that zone — the overlay states zoning, not what stands there.
    for (const set of this.civic) {
      set.meshes.setOverlay(on ? PALETTE.zoneResidential : null);
    }
    const standing = this.shownHomes - this.shownRuins;
    for (let l = 0; l < LEVELS; l++) {
      this.levels[l]?.recolor(this.homeStart[l] ?? 0, this.levelCount(l), standing, this.tint);
    }
    this.shops.recolor(this.shownShops, this.tint);
    this.industry.recolor(this.shownIndustry, this.tint);
    for (const set of this.civic) set.meshes.recolor(set.shown, this.tint);
  }

  /**
   * Ramps every lit surface in the city with the day/night phase.
   *
   * Called once a frame, and cheap enough to be: it touches five materials at
   * most — one beacon per tall level, the shop fascia, the fire station's doors
   * — and never an instance buffer.
   */
  setNight(night: number): void {
    for (const level of this.levels) level.setNight(night);
    this.shops.setNight(night);
    for (const set of this.civic) set.meshes.setNight(night);
  }

  /** Advances in-flight growth animations. Returns true while any are running. */
  update(now: number): boolean {
    // Keyed by *slot*, not by instance, so an animation in flight survives a
    // promotion moving the building between two mesh sets. The level and
    // instance are recovered from the cohort the scene is drawing.
    const standing = this.shownHomes - this.shownRuins;
    const homesMoving = this.homeGrowth.update(now, (slot, scale) => {
      const found = levelAt(this.shownHomeLevels, slot);
      const level = slot < standing ? Math.max(0, found) : -1;
      const meshes = this.levels[Math.max(0, level)];
      if (!meshes) return;
      const index = slot - (this.homeStart[Math.max(0, level)] ?? 0);
      meshes.write(
        index,
        slot,
        level,
        this.layout.place(ZONE.residential, slot, this.shownMergedHomes, this.at),
        scale,
        this.dummy,
        this.tint,
        this.roofs,
        this.roofSlot[slot] ?? 0,
      );
    });
    if (homesMoving) {
      for (const level of this.levels) level.flush();
      this.roofs.flush();
    }

    const shopsMoving = this.shopGrowth.update(now, (i, s) => {
      const at = this.layout.place(ZONE.commercial, i, this.shownMergedShops, this.at);
      this.shops.write(i, at, s, this.dummy, this.tint);
    });
    if (shopsMoving) this.shops.flush();

    const industryMoving = this.industryGrowth.update(now, (i, s) => {
      const at = this.layout.place(ZONE.industrial, i, this.shownMergedIndustry, this.at);
      this.industry.write(i, at, s, this.dummy, this.tint);
    });
    if (industryMoving) this.industry.flush();

    let civicMoving = false;
    for (const set of this.civic) {
      const moving = set.growth.update(now, (i, s) => {
        set.meshes.write(i, set.site(i), s, this.dummy, this.tint);
      });
      if (moving) set.meshes.flush();
      civicMoving = civicMoving || moving;
    }

    return homesMoving || shopsMoving || industryMoving || civicMoving;
  }
}
