import * as THREE from 'three';
import { CELL } from '../sim/config';
import {
  DISTRICT_WIDTH,
  isRoadCol,
  isRoadRow,
  worldX,
  worldZ,
  type CityLayout,
  type District,
} from '../sim/layout';
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
const ROAD_W = 2.4;
const FOOT_W = (CELL - ROAD_W) / 2;
const FOOT_OFF = (CELL - FOOT_W) / 2;
const PAVE_H = 0.3;
const ROAD_H = 0.18;
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

/** Land tiles and the street grid. Districts are appended, never rebuilt. */
export class Ground {
  private readonly land: GrowableInstancedMesh;
  private readonly asphalt: GrowableInstancedMesh;
  private readonly pavement: GrowableInstancedMesh;
  private readonly ranges: Range[] = [];
  private readonly dummy = new THREE.Object3D();
  private rising = false;

  /**
   * There is deliberately no ground beyond the districts. An infinite plane
   * sits inside the near fog distance wherever the camera is, so it reads as a
   * bright wedge across half the frame — and the void makes a better point:
   * the world really is only as big as the land you have bought.
   */
  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
  ) {
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
    this.layout.ensure(districts);

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
      const alongX = isRoadRow(cell.z);
      const alongZ = isRoadCol(cell.x);

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
