import * as THREE from 'three';
import { hash01 } from '../core/rng';
import { CELL, SERVICES, TIERS, type Service, type Tier } from '../sim/config';
import { worldX, worldZ, type CityLayout, type Coord } from '../sim/layout';
import type { GameState } from '../sim/state';
import { GrowableInstancedMesh } from './growable';
import { GrowthSchedule } from './growth';
import { PALETTE } from './palette';

const GROW_SECONDS = 0.55;
const GROW_SECONDS_REDUCED = 0.12;

/** Most buildings that arrive at once are animated; a huge backlog is capped. */
const WAVE_BUDGET = 320;

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Per-building height jitter. A uniform skyline reads as a spreadsheet. */
const heightJitter = (i: number): number => 0.82 + hash01(i ^ 0x5bf03635) * 0.42;

/** Per-building concrete shade, so the mass does not flatten out. */
const shade = (i: number): number => 0.84 + hash01(i ^ 0x2545f491) * 0.28;

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
 * A shared material whose brightness rides the day/night phase.
 *
 * Per *material*, never per instance. A city's lit surfaces — every shop
 * fascia, every beacon, every bay door — are thousands of instances sharing a
 * handful of materials, and ramping them individually would mark the instance
 * colour buffer dirty on every frame of the cycle, which is a full re-upload
 * sixty times a second for a change one colour can make. This is one multiply
 * per material per frame instead, and the instance buffers are never touched.
 *
 * The floor is what stops a lit sign from switching off at noon: a sodium band
 * in daylight is still a painted orange band, just not a light source.
 */
class Glow {
  readonly material: THREE.MeshBasicMaterial;
  private readonly base = new THREE.Color();

  constructor(
    hex: number,
    private readonly floor: number,
  ) {
    this.material = new THREE.MeshBasicMaterial({ color: hex });
    this.base.setHex(hex);
  }

  setNight(night: number): void {
    const k = this.floor + (1 - this.floor) * Math.max(0, Math.min(1, night));
    this.material.color.copy(this.base).multiplyScalar(k);
  }
}

/**
 * One InstancedMesh set per zoning tier.
 *
 * Rezoning does not rebuild geometry — it swaps which set has a non-zero count.
 * That is what makes "the whole city becomes towers" a change to one integer.
 */
class TierMeshes {
  private readonly body: GrowableInstancedMesh;
  private readonly roof: GrowableInstancedMesh;
  private readonly beacon: GrowableInstancedMesh | null;
  /** Only tiers tall enough to carry a warning light have one to ramp. */
  private readonly beaconGlow: Glow | null;
  private readonly roofRise: number;
  /** Zone colour while the overlay is on, null for the city's own palette. */
  private overlay: number | null = null;

  constructor(scene: THREE.Scene, readonly tier: Tier, capacity: number) {
    const w = tier.width;
    this.body = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(w, tier.height, w),
      new THREE.MeshLambertMaterial({ color: PALETTE.concrete }),
      capacity,
      { castShadow: true, receiveShadow: true },
    );
    this.roof = new GrowableInstancedMesh(
      scene,
      tier.pitched
        ? new THREE.ConeGeometry(w * 0.82, 1.15, 4)
        : new THREE.BoxGeometry(w * 0.62, 0.5, w * 0.62),
      new THREE.MeshLambertMaterial({ color: tier.pitched ? PALETTE.tile : PALETTE.parapet }),
      capacity,
      { castShadow: true },
    );
    this.roofRise = tier.pitched ? 0.55 : 0.25;
    // A warning light is nearly invisible at midday and the whole silhouette
    // after dark, so it gets the lowest floor of the three lit surfaces.
    this.beaconGlow = tier.beacon ? new Glow(PALETTE.sodium, 0.3) : null;
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
    this.roof.ensure(capacity);
    this.beacon?.ensure(capacity);
  }

  setOverlay(hex: number | null): void {
    this.overlay = hex;
  }

  private bodyColor(index: number, out: THREE.Color): THREE.Color {
    const base =
      this.overlay === null
        ? out.setHex(PALETTE.concrete)
        : against(this.overlay, PALETTE.concrete, out);
    // The per-instance shade survives the overlay, so the plan still reads as
    // buildings rather than as a flat sheet of one colour.
    return base.multiplyScalar(shade(index));
  }

  /** Rewrites colours only. Matrices are untouched, so this is one buffer pass. */
  recolor(count: number, tint: THREE.Color): void {
    for (let i = 0; i < count; i++) this.body.setColorAt(i, this.bodyColor(i, tint));
    this.body.flush();
  }

  write(index: number, cell: Coord, scale: number, dummy: THREE.Object3D, tint: THREE.Color): void {
    const x = worldX(cell.x);
    const z = worldZ(cell.z);
    const stretch = heightJitter(index);
    const height = this.tier.height * stretch;

    dummy.rotation.set(0, 0, 0);
    dummy.position.set(x, (height / 2) * scale, z);
    dummy.scale.set(1, stretch * scale, 1);
    dummy.updateMatrix();
    this.body.setMatrixAt(index, dummy.matrix);
    this.body.setColorAt(index, this.bodyColor(index, tint));

    dummy.position.y = (height + this.roofRise) * scale;
    dummy.scale.setScalar(scale);
    // A four-sided cone is a hipped roof only once it is turned onto the grid.
    if (this.tier.pitched) dummy.rotation.y = Math.PI / 4;
    dummy.updateMatrix();
    this.roof.setMatrixAt(index, dummy.matrix);
    dummy.rotation.y = 0;

    if (this.beacon) {
      dummy.position.y = (height + this.roofRise * 2 + 0.35) * scale;
      dummy.updateMatrix();
      this.beacon.setMatrixAt(index, dummy.matrix);
    }
  }

  setCount(n: number): void {
    this.body.count = n;
    this.roof.count = n;
    if (this.beacon) this.beacon.count = n;
  }

  flush(): void {
    this.body.flush();
    this.roof.flush();
    this.beacon?.flush();
  }
}

const SHOP_H = 2.4;

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
  private readonly fasciaGlow = new Glow(PALETTE.sodium, 0.42);
  private overlay: number | null = null;

  constructor(scene: THREE.Scene, capacity: number) {
    this.body = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(3, SHOP_H, 3),
      new THREE.MeshLambertMaterial({ color: PALETTE.shop }),
      capacity,
      { castShadow: true, receiveShadow: true },
    );
    this.fascia = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(3.08, 0.34, 3.08),
      this.fasciaGlow.material,
      capacity,
    );
    this.cap = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(3.16, 0.26, 3.16),
      new THREE.MeshLambertMaterial({ color: PALETTE.parapet }),
      capacity,
      { castShadow: true },
    );
  }

  ensure(capacity: number): void {
    this.body.ensure(capacity);
    this.fascia.ensure(capacity);
    this.cap.ensure(capacity);
  }

  setNight(night: number): void {
    this.fasciaGlow.setNight(night);
  }

  setOverlay(hex: number | null): void {
    this.overlay = hex;
  }

  private bodyColor(out: THREE.Color): THREE.Color {
    // White is the identity for the shader's multiply, so with no overlay the
    // shop renders in exactly the material colour it always has.
    return this.overlay === null
      ? out.setRGB(1, 1, 1)
      : against(this.overlay, PALETTE.shop, out);
  }

  recolor(count: number, tint: THREE.Color): void {
    for (let i = 0; i < count; i++) this.body.setColorAt(i, this.bodyColor(tint));
    this.body.flush();
  }

  write(index: number, cell: Coord, scale: number, dummy: THREE.Object3D, tint: THREE.Color): void {
    const x = worldX(cell.x);
    const z = worldZ(cell.z);
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(x, (SHOP_H / 2) * scale, z);
    dummy.scale.set(1, scale, 1);
    dummy.updateMatrix();
    this.body.setMatrixAt(index, dummy.matrix);
    this.body.setColorAt(index, this.bodyColor(tint));

    dummy.scale.setScalar(scale);
    dummy.position.y = (SHOP_H - 0.42) * scale;
    dummy.updateMatrix();
    this.fascia.setMatrixAt(index, dummy.matrix);

    dummy.position.y = (SHOP_H + 0.13) * scale;
    dummy.updateMatrix();
    this.cap.setMatrixAt(index, dummy.matrix);
  }

  setCount(n: number): void {
    this.body.count = n;
    this.fascia.count = n;
    this.cap.count = n;
  }

  flush(): void {
    this.body.flush();
    this.fascia.flush();
    this.cap.flush();
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
  }

  ensure(capacity: number): void {
    this.body.ensure(capacity);
    this.roof.ensure(capacity);
    this.stack.ensure(capacity);
  }

  setOverlay(hex: number | null): void {
    this.overlay = hex;
  }

  private bodyColor(out: THREE.Color): THREE.Color {
    return this.overlay === null ? out.setRGB(1, 1, 1) : against(this.overlay, PALETTE.industry, out);
  }

  recolor(count: number, tint: THREE.Color): void {
    for (let i = 0; i < count; i++) this.body.setColorAt(i, this.bodyColor(tint));
    this.body.flush();
  }

  write(index: number, cell: Coord, scale: number, dummy: THREE.Object3D, tint: THREE.Color): void {
    const x = worldX(cell.x);
    const z = worldZ(cell.z);
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(x, (INDUSTRY_H / 2) * scale, z);
    dummy.scale.set(1, scale, 1);
    dummy.updateMatrix();
    this.body.setMatrixAt(index, dummy.matrix);
    this.body.setColorAt(index, this.bodyColor(tint));

    dummy.scale.setScalar(scale);
    dummy.position.y = (INDUSTRY_H + 0.1) * scale;
    dummy.updateMatrix();
    this.roof.setMatrixAt(index, dummy.matrix);

    // Off to a corner rather than centred: a stack on the ridge reads as a lift
    // shaft, a stack at the edge reads as a chimney.
    const nudge = hash01(index ^ 0x1f3a55c1) < 0.5 ? -1 : 1;
    dummy.position.set(
      x + nudge * INDUSTRY_W * 0.34,
      (INDUSTRY_H + STACK_H / 2) * scale,
      z - INDUSTRY_W * 0.28,
    );
    dummy.updateMatrix();
    this.stack.setMatrixAt(index, dummy.matrix);
  }

  setCount(n: number): void {
    this.body.count = n;
    this.roof.count = n;
    this.stack.count = n;
  }

  flush(): void {
    this.body.flush();
    this.roof.flush();
    this.stack.flush();
  }
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
  ) {
    this.body = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(CIVIC_W, style.height, CIVIC_W),
      new THREE.MeshLambertMaterial({ color: style.body }),
      capacity,
      { castShadow: true, receiveShadow: true },
    );
    this.roof = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(CIVIC_W + 0.3, 0.34, CIVIC_W + 0.3),
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
   * `cell` is the site's lower-left plot; the building straddles all four, so
   * the instance sits half a cell along each axis from it.
   */
  write(index: number, cell: Coord, scale: number, dummy: THREE.Object3D, tint: THREE.Color): void {
    const x = worldX(cell.x) + CELL / 2;
    const z = worldZ(cell.z) + CELL / 2;
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

/**
 * The building layer. It owns no game state: given counts, it reconciles the
 * scene toward them, and it can always rebuild itself from scratch.
 */
export class Buildings {
  private readonly tiers: TierMeshes[];
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
  private shownShops = 0;
  private shownIndustry = 0;
  private shownTier = 0;

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
  ) {
    const duration = prefersReducedMotion() ? GROW_SECONDS_REDUCED : GROW_SECONDS;
    this.homeGrowth = new GrowthSchedule(duration);
    this.shopGrowth = new GrowthSchedule(duration);
    this.industryGrowth = new GrowthSchedule(duration);
    this.tiers = TIERS.map((tier) => new TierMeshes(scene, tier, 64));
    this.shops = new ShopMeshes(scene, 32);
    this.industry = new IndustryMeshes(scene, 24);
    this.civic = SERVICES.map((service) => ({
      service,
      meshes: civicSet(scene, service, 8),
      growth: new GrowthSchedule(duration),
      site:
        service.key === 'hospital'
          ? (i: number) => this.layout.hospitalSite(i)
          : service.key === 'police'
            ? (i: number) => this.layout.policeSite(i)
            : (i: number) => this.layout.fireSite(i),
      shown: 0,
    }));
  }

  /** How many of a service the state has, without a lookup table per caller. */
  private static count(state: Readonly<GameState>, service: Service): number {
    return service.key === 'hospital'
      ? state.hospitals
      : service.key === 'police'
        ? state.police
        : state.fire;
  }

  private get active(): TierMeshes {
    return this.tiers[this.shownTier] as TierMeshes;
  }

  /** Brings the scene in line with the simulation. Cheap when nothing changed. */
  sync(state: Readonly<GameState>, now: number): void {
    this.layout.ensure(state.districts);

    if (state.tier !== this.shownTier) {
      const previous = this.active;
      previous.setCount(0);
      previous.flush();
      this.shownTier = state.tier;
      this.shownHomes = 0;
      // The skyline is rebuilt in the new tier's meshes, then staged as a wave
      // so a rezone reads as a programme rolling across the city.
      this.writeHomes(0, state.homes, now, true);
      this.homeGrowth.stage(0, state.homes, now, 1.2, WAVE_BUDGET);
    } else if (state.homes > this.shownHomes) {
      const from = this.shownHomes;
      this.homeGrowth.stage(from, state.homes, now, 1.4, WAVE_BUDGET);
      this.writeHomes(from, state.homes, now, false);
    } else if (state.homes < this.shownHomes) {
      this.homeGrowth.clear();
      this.writeHomes(0, state.homes, now, true);
    }
    this.shownHomes = state.homes;

    if (state.shops > this.shownShops) {
      const from = this.shownShops;
      this.shopGrowth.stage(from, state.shops, now, 1.4, WAVE_BUDGET);
      this.writeShops(from, state.shops, now);
    } else if (state.shops < this.shownShops) {
      this.shopGrowth.clear();
      this.writeShops(0, state.shops, now);
    }
    this.shownShops = state.shops;

    if (state.industry > this.shownIndustry) {
      const from = this.shownIndustry;
      this.industryGrowth.stage(from, state.industry, now, 1.4, WAVE_BUDGET);
      this.writeIndustry(from, state.industry, now);
    } else if (state.industry < this.shownIndustry) {
      this.industryGrowth.clear();
      this.writeIndustry(0, state.industry, now);
    }
    this.shownIndustry = state.industry;

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

  private writeHomes(from: number, to: number, now: number, rewrite: boolean): void {
    const meshes = this.active;
    meshes.ensure(to);
    this.homeGrowth.ensure(to);
    const start = rewrite ? 0 : from;
    for (let i = start; i < to; i++) {
      meshes.write(i, this.layout.homeCell(i), this.homeGrowth.scaleAt(i, now), this.dummy, this.tint);
    }
    meshes.setCount(to);
    meshes.flush();
  }

  private writeShops(from: number, to: number, now: number): void {
    this.shops.ensure(to);
    this.shopGrowth.ensure(to);
    for (let i = from; i < to; i++) {
      this.shops.write(
        i,
        this.layout.shopCell(i),
        this.shopGrowth.scaleAt(i, now),
        this.dummy,
        this.tint,
      );
    }
    this.shops.setCount(to);
    this.shops.flush();
  }

  private writeIndustry(from: number, to: number, now: number): void {
    this.industry.ensure(to);
    this.industryGrowth.ensure(to);
    for (let i = from; i < to; i++) {
      this.industry.write(
        i,
        this.layout.industryCell(i),
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
    for (const tier of this.tiers) tier.setOverlay(on ? PALETTE.zoneResidential : null);
    this.shops.setOverlay(on ? PALETTE.zoneCommercial : null);
    this.industry.setOverlay(on ? PALETTE.zoneIndustrial : null);
    // A civic site is carved out of the zone it sits in, so under the plan it
    // reads as that zone — the overlay states zoning, not what stands there.
    for (const set of this.civic) {
      set.meshes.setOverlay(on ? PALETTE.zoneResidential : null);
    }
    this.active.recolor(this.shownHomes, this.tint);
    this.shops.recolor(this.shownShops, this.tint);
    this.industry.recolor(this.shownIndustry, this.tint);
    for (const set of this.civic) set.meshes.recolor(set.shown, this.tint);
  }

  /**
   * Ramps every lit surface in the city with the day/night phase.
   *
   * Called once a frame, and cheap enough to be: it touches five materials at
   * most — one beacon per tall tier, the shop fascia, the fire station's doors
   * — and never an instance buffer.
   */
  setNight(night: number): void {
    for (const tier of this.tiers) tier.setNight(night);
    this.shops.setNight(night);
    for (const set of this.civic) set.meshes.setNight(night);
  }

  /** Advances in-flight growth animations. Returns true while any are running. */
  update(now: number): boolean {
    const meshes = this.active;
    const homesMoving = this.homeGrowth.update(now, (i, s) => {
      meshes.write(i, this.layout.homeCell(i), s, this.dummy, this.tint);
    });
    if (homesMoving) meshes.flush();

    const shopsMoving = this.shopGrowth.update(now, (i, s) => {
      this.shops.write(i, this.layout.shopCell(i), s, this.dummy, this.tint);
    });
    if (shopsMoving) this.shops.flush();

    const industryMoving = this.industryGrowth.update(now, (i, s) => {
      this.industry.write(i, this.layout.industryCell(i), s, this.dummy, this.tint);
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
