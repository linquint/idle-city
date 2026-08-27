import * as THREE from 'three';
import {
  districtCoord,
  DISTRICT_WIDTH,
  type Coord,
} from '../sim/layout';
import { ESTATE_FAR, ESTATE_ROAD_U, ESTATE_SPAN, estateReach } from '../sim/estates';
import type { GameState } from '../sim/state';
import { WATERS, type Shore } from '../sim/water';
import { ROAD_H } from './ground';
import { GrowableInstancedMesh } from './growable';
import { PALETTE } from './palette';

/**
 * The road out of town: a spur down the axis and a band road along the estates.
 *
 * Built the way `ground.ts` builds a street — a carriageway strip with verges
 * flanking it, boxes scaled per instance, no rotation anywhere — at the scale a
 * road between towns is rather than the scale of a street. Two runs, so four
 * boxes of carriageway and verge in total, which is two instanced meshes.
 *
 * The geometry is also what the trucks drive, and that is why the lanes are
 * exported rather than kept: `cars.ts` should not have a second opinion about
 * where the road is, for the same reason `render/water.ts` does not have one
 * about where the water is.
 */

/** Carriageway and verge, against ROAD_W's 2.4 in the city. Two lanes each way. */
export const HIGHWAY_W = 7;
const VERGE_W = 3.2;
const VERGE_H = 0.26;
const TUCK = 0.06;

/**
 * Where the band road runs, in the coast frame. Read by the trucks.
 *
 * Taken from the layout rather than decided here: the two rows of parcels are
 * placed either side of this line, so a road the renderer picked for itself
 * would be one the estates had no reason to front onto. See ESTATE_ROAD_U.
 */
export const BAND_U = ESTATE_ROAD_U;

/**
 * One straight run of road, in world terms, filled in place.
 *
 * The shape `cars.ts` already routes on — an axis, a fixed cross-coordinate, a
 * start and a length — which is why a truck needs no router of its own. Both
 * runs are axis-aligned in world space because the coast frame is: see
 * `Waters.coast`.
 */
export interface Lane {
  /** True when the run goes along world x. */
  alongX: boolean;
  /** The other world coordinate, constant along the run. */
  fixed: number;
  /** Where the run starts, on the driving axis. */
  from: number;
  length: number;
}

const at: Shore = { x: 0, z: 0 };

/** Whether the coast frame's `u` runs along world x. `v` runs along the other. */
const uIsX = (): boolean => WATERS.coast.axis === 'x';

/**
 * How far inland the city reaches, in the coast frame, along the axis the spur
 * runs down.
 *
 * Only the districts in the column the spur runs through count: the spur has to
 * meet the city at a district's own edge rather than stop in a field beside
 * one, and a district two columns over says nothing about where that edge is.
 */
function cityEdge(districts: number): number {
  let inland = 0;
  for (let i = 0; i < districts; i++) {
    const coord = districtCoord(i) as Coord;
    const x = coord.x * DISTRICT_WIDTH;
    const z = coord.z * DISTRICT_WIDTH;
    if (Math.abs(WATERS.v(x, z)) > DISTRICT_WIDTH / 2) continue;
    inland = Math.min(inland, WATERS.u(x, z));
  }
  return inland - DISTRICT_WIDTH / 2;
}

/** The spur, from the city's inland edge out to the band road. */
export function spurLane(districts: number, out: Lane): Lane {
  const edge = cityEdge(districts);
  WATERS.toWorld(BAND_U, 0, at);
  out.alongX = uIsX();
  out.fixed = out.alongX ? at.z : at.x;
  // `u` grows toward the sea and both ends of the spur are negative, so the
  // run starts at the band and finishes at the city.
  const near = out.alongX ? at.x : at.z;
  WATERS.toWorld(edge, 0, at);
  const far = out.alongX ? at.x : at.z;
  out.from = Math.min(near, far);
  out.length = Math.abs(far - near);
  return out;
}

/**
 * The band road, as long as the estates it serves.
 *
 * It crosses the river where the river crosses the band — the parcels there are
 * skipped as wet, but the road is one run and is not. Drawn as a flat deck over
 * the water rather than stopped short or given a span of its own: the surface
 * sits a fifth of a unit above the water and reads as the low causeway it would
 * be, and severing the band at the river would leave the far half of it with no
 * road at all.
 */
export function bandLane(estates: number, out: Lane): Lane {
  const reach = estateReach(estates) + ESTATE_SPAN;
  WATERS.toWorld(BAND_U, -reach, at);
  out.alongX = !uIsX();
  out.fixed = out.alongX ? at.z : at.x;
  out.from = out.alongX ? at.x : at.z;
  out.length = reach * 2;
  return out;
}

const edge: Shore = { x: 0, z: 0 };

/**
 * How far from a point the road and the band reach, or 0 before the road is in.
 *
 * Asked by the camera rig for the same reason `portReach` is: the pan bounds
 * were the districts, and the estates sit half a district beyond the furthest
 * the districts can ever go.
 */
export function highwayReach(state: Readonly<GameState>, x: number, z: number): number {
  if (!state.highway) return 0;
  let reach = 0;
  const along = estateReach(state.estates) + ESTATE_SPAN;
  for (const v of [-along, along]) {
    WATERS.toWorld(ESTATE_FAR, v, edge);
    reach = Math.max(reach, Math.hypot(edge.x - x, edge.z - z));
  }
  return reach;
}

/** The road layer. Two meshes, rebuilt only when the two counts move. */
export class Highway {
  private readonly tarmac: GrowableInstancedMesh;
  private readonly verges: GrowableInstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly lane: Lane = { alongX: true, fixed: 0, from: 0, length: 0 };
  private shownDistricts = -1;
  private shownEstates = -1;
  private shownHighway = false;

  constructor(scene: THREE.Scene) {
    this.tarmac = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, ROAD_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
      2,
      { receiveShadow: true, name: 'highway:tarmac' },
    );
    // The verge throws the same hairline shadow the city's kerbs do, which is
    // most of what makes a strip of asphalt read as a road at this distance.
    this.verges = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, VERGE_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.kerb }),
      4,
      { castShadow: true, receiveShadow: true, name: 'highway:verge' },
    );
  }

  sync(state: Readonly<GameState>): void {
    if (
      state.highway === this.shownHighway &&
      state.districts === this.shownDistricts &&
      state.estates === this.shownEstates
    ) {
      return;
    }
    this.shownHighway = state.highway;
    this.shownDistricts = state.districts;
    this.shownEstates = state.estates;

    if (!state.highway) {
      this.tarmac.count = 0;
      this.verges.count = 0;
      return;
    }

    let verges = 0;
    verges = this.write(spurLane(state.districts, this.lane), 0, verges);
    verges = this.write(bandLane(state.estates, this.lane), 1, verges);
    this.tarmac.count = 2;
    this.verges.count = verges;
    this.tarmac.flush();
    this.verges.flush();
  }

  /** One run: a carriageway and the two verges flanking it. */
  private write(lane: Lane, slot: number, verge: number): number {
    const dummy = this.dummy;
    const along = lane.from + lane.length / 2;
    const x = lane.alongX ? along : lane.fixed;
    const z = lane.alongX ? lane.fixed : along;

    dummy.position.set(x, ROAD_H / 2, z);
    // A touch wider than the carriageway so its edge tucks under the verge
    // instead of sitting exactly coplanar with it — the same trick the city's
    // streets use, at the scale of a road that has a hard shoulder.
    if (lane.alongX) dummy.scale.set(lane.length, 1, HIGHWAY_W + TUCK);
    else dummy.scale.set(HIGHWAY_W + TUCK, 1, lane.length);
    dummy.updateMatrix();
    this.tarmac.setMatrixAt(slot, dummy.matrix);

    const off = (HIGHWAY_W + VERGE_W) / 2;
    for (const side of [-1, 1]) {
      dummy.position.set(
        lane.alongX ? x : x + side * off,
        VERGE_H / 2,
        lane.alongX ? z + side * off : z,
      );
      if (lane.alongX) dummy.scale.set(lane.length, 1, VERGE_W);
      else dummy.scale.set(VERGE_W, 1, lane.length);
      dummy.updateMatrix();
      this.verges.setMatrixAt(verge++, dummy.matrix);
    }
    dummy.scale.set(1, 1, 1);
    return verge;
  }
}
