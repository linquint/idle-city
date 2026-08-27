import * as THREE from 'three';
import { hash01, mixSeed } from '../core/rng';
import { CELL, MAX_DISTRICTS, SEED } from '../sim/config';
import {
  DISTRICT_WIDTH,
  isRoad,
  worldX,
  worldZ,
  type CityLayout,
  type District,
} from '../sim/layout';
import { cityRadius } from '../sim/layout';
import { GrowableInstancedMesh } from './growable';
import { PALETTE } from './palette';

/**
 * A road cell is a carriageway plus the footways that flank it. The footway
 * must never span the whole cell or it simply buries the road inside it:
 *
 *   straight cell -> 1 carriageway strip + 2 footway strips
 *   junction      -> 1 carriageway square + 4 corner footways
 *
 * The kerb is nothing but the height difference between the two. Both use a
 * unit box scaled per instance, so orientation is a scale swap and no rotation
 * is needed anywhere.
 */
export const ROAD_W = 2.4;
export const ROAD_H = 0.18;
const FOOT_W = (CELL - ROAD_W) / 2;
const FOOT_OFF = (CELL - FOOT_W) / 2;
const PAVE_H = 0.3;
const TUCK = 0.04;
const LAND_H = 1.2;
const MAX_FOOTWAYS_PER_CELL = 4;

/** How far a newly annexed district starts below grade before it rises in. */
const LIFT = 14;
const RISE_SECONDS = 1.1;

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

interface Range {
  readonly district: District;
  readonly asphaltFrom: number;
  readonly asphaltTo: number;
  readonly paveFrom: number;
  readonly paveTo: number;
  birth: number;
}

/**
 * How far the grassland reaches from the origin, in world units.
 *
 * The old build had no ground beyond the districts at all, on the argument that
 * an infinite plane sits inside the near fog distance wherever the camera is
 * and reads as a bright wedge across half the frame. That was true of a plane
 * lit for a permanently dusk sky. It stops being true once the plane and the
 * fog are the same colour family and the fog has somewhere bright to fade into,
 * which is what the lifted keyframes in `daylight.ts` are for — the two are one
 * change and must be tuned together.
 *
 * Sized against the largest city rather than the current one, so it is built
 * once and never resized: the camera's far plane is `radius * 8 + 600`, and at
 * MAX_DISTRICTS this comfortably outruns it in every direction.
 */
export const GRASS_REACH = cityRadius(MAX_DISTRICTS) * 8 + 1_200;

/**
 * How far the grassland sits below the districts' own ground.
 *
 * It used to be a hair — enough to keep the plane out of a z-fight with the
 * land tiles and no more. Water is what made the number matter: the sea sits
 * between the two, so this is the depth of the water at the shore, and a hair
 * of it would have read as a wet sheet laid over the grass rather than as
 * something with a bottom. See WATER_Y in `water.ts`, which is derived from it.
 */
export const GRASS_Y = -0.3;

/**
 * Cells across the plane. 160 puts a vertex every ~24 world units, which is
 * about half a district — coarse enough to stay one cheap mesh and fine enough
 * that a sandy patch reads as a patch rather than as a quadrant.
 */
const GRASS_SEGMENTS = 160;

/** How wide a noise feature is, in world units. Two districts across. */
const GRASS_NOISE_SCALE = 104;

/** Seeded value noise: one lattice, smoothstepped, in [0, 1]. */
function valueNoise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const at = (ix: number, iz: number): number => hash01(mixSeed(SEED, ix * 73_856_093 ^ iz * 19_349_663));
  const a = at(xi, zi);
  const b = at(xi + 1, zi);
  const c = at(xi, zi + 1);
  const d = at(xi + 1, zi + 1);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}

/**
 * The land the city was built on: one plane, one draw call, coloured per vertex.
 *
 * Two octaves of seeded value noise pick between three colours — two greens and
 * a dry sand — so the ground reads as grassland with bare patches rather than as
 * a billiard table. Vertex colours rather than a texture because the whole world
 * is a pure function of SEED already, and a texture would be the only asset in
 * the project.
 *
 * It receives shadows, and only inside the shadow frustum: three's shadow lookup
 * reports "lit" for anything outside the light's camera, so the bounded span
 * `focusShadows` keeps is exactly the span that darkens. That is what stops a
 * plane this size from either crawling or swallowing the map.
 */
function grassland(scene: THREE.Scene): void {
  const geometry = new THREE.PlaneGeometry(
    GRASS_REACH * 2,
    GRASS_REACH * 2,
    GRASS_SEGMENTS,
    GRASS_SEGMENTS,
  );
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const grass = new THREE.Color(PALETTE.grass);
  const deep = new THREE.Color(PALETTE.grassDeep);
  const sand = new THREE.Color(PALETTE.sand);
  const mixed = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / GRASS_NOISE_SCALE;
    const z = position.getZ(i) / GRASS_NOISE_SCALE;
    // Two octaves: the coarse one decides where the dry ground is, the fine one
    // breaks up its edge so a patch has a ragged border rather than a contour.
    const broad = valueNoise(x, z);
    const fine = valueNoise(x * 3.1 + 11.3, z * 3.1 - 7.7);
    const dryness = Math.max(0, Math.min(1, (broad * 0.75 + fine * 0.25 - 0.46) * 3.4));
    mixed.copy(deep).lerp(grass, Math.min(1, fine * 1.2)).lerp(sand, dryness);
    colors[i * 3] = mixed.r;
    colors[i * 3 + 1] = mixed.g;
    colors[i * 3 + 2] = mixed.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  // Under the district tiles, whose top face sits at y = 0, so the grassland is
  // only ever visible on land nobody has bought. How far under is GRASS_Y.
  mesh.position.y = GRASS_Y;
  mesh.receiveShadow = true;
  // It is always under the camera, so a per-object frustum test can only cost.
  mesh.frustumCulled = false;
  scene.add(mesh);
}

/** Land tiles and the street grid. Districts are appended, never rebuilt. */
export class Ground {
  private readonly land: GrowableInstancedMesh;
  private readonly asphalt: GrowableInstancedMesh;
  private readonly pavement: GrowableInstancedMesh;
  private readonly ranges: Range[] = [];
  private readonly dummy = new THREE.Object3D();
  private rising = false;

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
  ) {
    // Built once, added to the scene, and never touched again: it has no
    // per-district state to reconcile and nothing about it depends on the game.
    grassland(scene);
    this.land = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(DISTRICT_WIDTH, LAND_H, DISTRICT_WIDTH),
      new THREE.MeshLambertMaterial({ color: PALETTE.land }),
      4,
      { receiveShadow: true },
    );
    this.asphalt = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, ROAD_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
      256,
      { receiveShadow: true },
    );
    // The kerb throws a hairline shadow, which is most of what sells the street.
    this.pavement = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, PAVE_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.kerb }),
      1024,
      { castShadow: true, receiveShadow: true },
    );
  }

  /**
   * Appends any districts not yet on screen.
   *
   * `animate` is false for the city that is already there when the game opens —
   * land you loaded should simply exist. Only land you actually annex rises in.
   */
  sync(districts: number, now: number, animate: boolean): void {
    if (this.ranges.length >= districts) {
      if (this.ranges.length > districts) this.rebuild(districts);
      return;
    }
    this.layout.ensureFixed(districts);

    for (let i = this.ranges.length; i < districts; i++) {
      const district = this.layout.districts[i] as District;
      const cells = district.roads.length;
      const asphaltFrom = this.asphalt.count;
      const paveFrom = this.pavement.count;

      this.land.ensure(i + 1);
      this.asphalt.ensure(asphaltFrom + cells);
      this.pavement.ensure(paveFrom + cells * MAX_FOOTWAYS_PER_CELL);

      // A district that is not animating has to be written where it belongs
      // right now: nothing will come back to lower it into place.
      const birth = animate ? now : -Infinity;
      const lift = animate ? LIFT : 0;

      const written = this.writeRoads(district, asphaltFrom, paveFrom, lift);
      this.land.count = i + 1;
      this.asphalt.count = written.asphalt;
      this.pavement.count = written.pavement;

      this.ranges.push({
        district,
        asphaltFrom,
        asphaltTo: written.asphalt,
        paveFrom,
        paveTo: written.pavement,
        birth,
      });
      this.writeLand(i, lift);
      if (animate) this.rising = true;
    }

    this.flush();
  }

  /** Only ever needed after a reset, which drops the city back to one district. */
  private rebuild(districts: number): void {
    this.ranges.length = 0;
    this.asphalt.count = 0;
    this.pavement.count = 0;
    this.land.count = 0;
    this.sync(districts, -Infinity, false);
  }

  /** Animates districts that are still rising. Returns true while any move. */
  update(now: number): boolean {
    if (!this.rising) return false;
    let moving = false;
    for (let i = 0; i < this.ranges.length; i++) {
      const range = this.ranges[i] as Range;
      const age = now - range.birth;
      if (age >= RISE_SECONDS) continue;
      const lift = LIFT * (1 - easeOutCubic(Math.max(0, age) / RISE_SECONDS));
      this.writeLand(i, lift);
      this.writeRoads(range.district, range.asphaltFrom, range.paveFrom, lift);
      moving = true;
    }
    this.rising = moving;
    this.flush();
    return moving;
  }

  private flush(): void {
    this.land.flush();
    this.asphalt.flush();
    this.pavement.flush();
  }

  private writeLand(index: number, lift: number): void {
    const d = this.layout.districts[index] as District;
    this.dummy.position.set(d.centreX, -LAND_H / 2 - lift, d.centreZ);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    this.land.setMatrixAt(index, this.dummy.matrix);
  }

  private writeRoads(
    district: District,
    asphaltFrom: number,
    paveFrom: number,
    lift: number,
  ): { asphalt: number; pavement: number } {
    const dummy = this.dummy;
    let a = asphaltFrom;
    let p = paveFrom;

    const footway = (x: number, z: number, sx: number, sz: number): void => {
      dummy.position.set(x, PAVE_H / 2 - lift, z);
      dummy.scale.set(sx, 1, sz);
      dummy.updateMatrix();
      this.pavement.setMatrixAt(p++, dummy.matrix);
    };

    for (const cell of district.roads) {
      const x = worldX(cell.x);
      const z = worldZ(cell.z);
      // Spacing is irregular, so orientation cannot come from arithmetic on the
      // cell's own coordinates any more — it comes from what the neighbours
      // are. Both true is a junction (including a T where a street dead-ends on
      // a district boundary); one true is a straight run.
      const alongX = isRoad(cell.x - 1, cell.z) || isRoad(cell.x + 1, cell.z);
      const alongZ = isRoad(cell.x, cell.z - 1) || isRoad(cell.x, cell.z + 1);

      // The carriageway is a touch wider than ROAD_W so its edge tucks under
      // the kerb instead of sitting exactly coplanar with it.
      dummy.position.set(x, ROAD_H / 2 - lift, z);
      if (alongX && alongZ) dummy.scale.set(CELL, 1, CELL);
      else if (alongX) dummy.scale.set(CELL, 1, ROAD_W + TUCK);
      else dummy.scale.set(ROAD_W + TUCK, 1, CELL);
      dummy.updateMatrix();
      this.asphalt.setMatrixAt(a++, dummy.matrix);

      // Footways are exactly CELL long so they meet their neighbours edge to
      // edge; at a junction they become four corner squares, which is what
      // closes the pavement around a crossing.
      if (alongX && alongZ) {
        for (const dx of [-1, 1])
          for (const dz of [-1, 1]) footway(x + dx * FOOT_OFF, z + dz * FOOT_OFF, FOOT_W, FOOT_W);
      } else if (alongX) {
        for (const dz of [-1, 1]) footway(x, z + dz * FOOT_OFF, CELL, FOOT_W);
      } else {
        for (const dx of [-1, 1]) footway(x + dx * FOOT_OFF, z, FOOT_W, CELL);
      }
    }

    dummy.scale.set(1, 1, 1);
    return { asphalt: a, pavement: p };
  }
}
