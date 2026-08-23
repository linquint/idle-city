import * as THREE from 'three';
import { hash01 } from '../core/rng';
import { TIERS, type Tier } from '../sim/config';
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
 * One InstancedMesh set per zoning tier.
 *
 * Rezoning does not rebuild geometry — it swaps which set has a non-zero count.
 * That is what makes "the whole city becomes towers" a change to one integer.
 */
class TierMeshes {
  private readonly body: GrowableInstancedMesh;
  private readonly roof: GrowableInstancedMesh;
  private readonly beacon: GrowableInstancedMesh | null;
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
    this.beacon = tier.beacon
      ? new GrowableInstancedMesh(
          scene,
          new THREE.BoxGeometry(0.34, 0.34, 0.34),
          new THREE.MeshBasicMaterial({ color: PALETTE.sodium }),
          capacity,
        )
      : null;
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
      new THREE.MeshBasicMaterial({ color: PALETTE.sodium }),
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

/**
 * The building layer. It owns no game state: given counts, it reconciles the
 * scene toward them, and it can always rebuild itself from scratch.
 */
export class Buildings {
  private readonly tiers: TierMeshes[];
  private readonly shops: ShopMeshes;
  private readonly homeGrowth: GrowthSchedule;
  private readonly shopGrowth: GrowthSchedule;
  private readonly dummy = new THREE.Object3D();
  private readonly tint = new THREE.Color();

  private shownHomes = 0;
  private shownShops = 0;
  private shownTier = 0;

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
  ) {
    const duration = prefersReducedMotion() ? GROW_SECONDS_REDUCED : GROW_SECONDS;
    this.homeGrowth = new GrowthSchedule(duration);
    this.shopGrowth = new GrowthSchedule(duration);
    this.tiers = TIERS.map((tier) => new TierMeshes(scene, tier, 64));
    this.shops = new ShopMeshes(scene, 32);
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

  /**
   * Recolours the city by zone. Homes stand on residential plots and shops on
   * commercial ones by construction, so the zone of a building is known from
   * which list placed it — no per-plot lookup needed.
   */
  setZoneOverlay(on: boolean): void {
    for (const tier of this.tiers) tier.setOverlay(on ? PALETTE.zoneResidential : null);
    this.shops.setOverlay(on ? PALETTE.zoneCommercial : null);
    this.active.recolor(this.shownHomes, this.tint);
    this.shops.recolor(this.shownShops, this.tint);
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

    return homesMoving || shopsMoving;
  }
}
