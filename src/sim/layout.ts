import { mixSeed } from '../core/rng.ts';
import { generateDistrict, zoneBudget, ZONE, type DistrictLayout, type Zone } from './citygen.ts';
import { CELL, DISTRICT_SPAN, SEED, TARGET_PLOTS } from './config.ts';

export interface Coord {
  /** Global grid column. Districts tile this space, so it goes negative. */
  readonly x: number;
  /** Global grid row. */
  readonly z: number;
}

export interface District {
  readonly index: number;
  /** District-space coordinate, spiralling out from (0, 0). */
  readonly coord: Coord;
  /** World-space centre of the district's land tile. */
  readonly centreX: number;
  readonly centreZ: number;
  readonly roads: readonly Coord[];
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/**
 * Every district's street plan, keyed by district-space coordinate.
 *
 * Keying on the *coordinate* rather than the annexation index is what lets
 * `isRoad` answer for land nobody has bought yet — the renderer needs the
 * neighbouring district's streets to tell a T-junction from a straight run at
 * a boundary, and a district's layout must not depend on when it was annexed.
 */
const layouts = new Map<string, DistrictLayout>();

export function districtLayoutAt(dx: number, dz: number): DistrictLayout {
  const key = `${dx},${dz}`;
  let layout = layouts.get(key);
  if (!layout) {
    layout = generateDistrict(mixSeed(mixSeed(SEED, dx * 2 + 1), dz * 2 + 1));
    layouts.set(key, layout);
  }
  return layout;
}

/**
 * Streets are a lookup against two per-district masks, not arithmetic: spacing
 * is irregular now, so there is no modulus that answers this.
 *
 * Local line 0 is always a road and local line DISTRICT_SPAN is the *next*
 * district's line 0. Sharing that boundary line rather than giving every
 * district its own perimeter keeps district edges a single-width street, and is
 * what makes streets still meet across districts.
 */
export function isRoad(x: number, z: number): boolean {
  const layout = districtLayoutAt(Math.floor(x / DISTRICT_SPAN), Math.floor(z / DISTRICT_SPAN));
  return (
    layout.rowRoad[mod(z, DISTRICT_SPAN)] === 1 || layout.colRoad[mod(x, DISTRICT_SPAN)] === 1
  );
}

/** Zoning of a global cell. Roads report ZONE.road. */
export function zoneAt(x: number, z: number): Zone {
  const layout = districtLayoutAt(Math.floor(x / DISTRICT_SPAN), Math.floor(z / DISTRICT_SPAN));
  const local = mod(z, DISTRICT_SPAN) * DISTRICT_SPAN + mod(x, DISTRICT_SPAN);
  return layout.zone[local] as Zone;
}

/** Grid cell -> world-space centre, with district (0, 0) straddling the origin. */
const OFFSET = (DISTRICT_SPAN - 1) / 2;
export const worldX = (x: number): number => (x - OFFSET) * CELL;
export const worldZ = (z: number): number => (z - OFFSET) * CELL;

/** Side length of one district in world units. */
export const DISTRICT_WIDTH = DISTRICT_SPAN * CELL;

/**
 * A district's plot count is a constant even though its streets are not: the
 * generator rejection-samples until it carves out exactly TARGET_PLOTS. That is
 * what lets the economy reason about capacity without building layouts.
 */
export const PLOTS_PER_DISTRICT = TARGET_PLOTS;

const BUDGET = zoneBudget(PLOTS_PER_DISTRICT);
export const RESIDENTIAL_PER_DISTRICT = BUDGET.residential;
export const COMMERCIAL_PER_DISTRICT = BUDGET.commercial;
export const INDUSTRIAL_PER_DISTRICT = BUDGET.industrial;

/**
 * The order in which a ring of districts gets annexed.
 *
 * Walking the perimeter in order would grow the city as a lopsided arc, with
 * every new district stuck to the last. Pairing each position with the one
 * directly opposite it instead means the city expands north, then south, then
 * north-east, then south-west — balanced around its own centre at every step.
 */
function ringCoords(r: number): Coord[] {
  if (r === 0) return [{ x: 0, z: 0 }];

  const edge: Coord[] = [];
  for (let x = -r; x <= r; x++) edge.push({ x, z: -r });
  for (let z = -r + 1; z <= r; z++) edge.push({ x: r, z });
  for (let x = r - 1; x >= -r; x--) edge.push({ x, z: r });
  for (let z = r - 1; z >= -r + 1; z--) edge.push({ x: -r, z });

  // Rotate so the ring opens due north, then interleave the two halves.
  const north = edge.findIndex((c) => c.x === 0 && c.z === -r);
  const walk = edge.slice(north).concat(edge.slice(0, north));
  const half = walk.length / 2;

  const order: Coord[] = [];
  for (let i = 0; i < half; i++) {
    order.push(walk[i] as Coord, walk[i + half] as Coord);
  }
  return order;
}

const coordCache: Coord[] = [];
let cachedRings = 0;

/** District index -> district-space coordinate. Stable forever. */
export function districtCoord(index: number): Coord {
  while (coordCache.length <= index) coordCache.push(...ringCoords(cachedRings++));
  return coordCache[index] as Coord;
}

/**
 * Where the built world sits. Districts spiral outward but a partial ring is
 * off-centre, so the camera has to look at the city rather than at the origin.
 */
export function cityCentre(districts: number): { x: number; z: number } {
  let x = 0;
  let z = 0;
  for (let i = 0; i < districts; i++) {
    const c = districtCoord(i);
    x += c.x;
    z += c.z;
  }
  return { x: (x / districts) * DISTRICT_WIDTH, z: (z / districts) * DISTRICT_WIDTH };
}

/** How far the built world reaches, in world units. Drives fog, shadows, camera. */
export function cityRadius(districts: number): number {
  let ring = 0;
  for (let i = 0; i < districts; i++) {
    const c = districtCoord(i);
    ring = Math.max(ring, Math.abs(c.x), Math.abs(c.z));
  }
  return (ring + 0.5) * DISTRICT_WIDTH;
}

interface DistrictPlots {
  readonly residential: Coord[];
  readonly commercial: Coord[];
  readonly industrial: Coord[];
  readonly roads: Coord[];
}

/**
 * Lifts one district's generated layout into global coordinates. The generator
 * has already zoned block-wise and shuffled the build order inside each zone,
 * so there is nothing to decide here.
 */
function placeDistrict(index: number): DistrictPlots {
  const c = districtCoord(index);
  const ox = c.x * DISTRICT_SPAN;
  const oz = c.z * DISTRICT_SPAN;
  const layout = districtLayoutAt(c.x, c.z);

  const toGlobal = (local: number): Coord => ({
    x: ox + (local % DISTRICT_SPAN),
    z: oz + Math.floor(local / DISTRICT_SPAN),
  });

  const roads: Coord[] = [];
  for (let lz = 0; lz < DISTRICT_SPAN; lz++) {
    for (let lx = 0; lx < DISTRICT_SPAN; lx++) {
      if (layout.zone[lz * DISTRICT_SPAN + lx] === ZONE.road) roads.push({ x: ox + lx, z: oz + lz });
    }
  }

  return {
    residential: layout.residential.map(toGlobal),
    commercial: layout.commercial.map(toGlobal),
    industrial: layout.industrial.map(toGlobal),
    roads,
  };
}

/**
 * The city's plot book. Districts are appended, never rewritten, so a building
 * placed in district 1 keeps its exact plot after you annex district 20.
 */
export class CityLayout {
  private materialised = 0;
  private readonly _residential: Coord[] = [];
  private readonly _commercial: Coord[] = [];
  private readonly _industrial: Coord[] = [];
  private readonly _districts: District[] = [];

  /** Materialises districts up to `count`. Idempotent and cheap to over-call. */
  ensure(count: number): this {
    for (let i = this.materialised; i < count; i++) {
      const { residential, commercial, industrial, roads } = placeDistrict(i);
      this._residential.push(...residential);
      this._commercial.push(...commercial);
      this._industrial.push(...industrial);
      const c = districtCoord(i);
      this._districts.push({
        index: i,
        coord: c,
        // worldX already folds OFFSET in, so the centre of a district's cells
        // is just its coordinate scaled up. Adding OFFSET again here slides
        // every land tile half a district off its own streets.
        centreX: c.x * DISTRICT_WIDTH,
        centreZ: c.z * DISTRICT_WIDTH,
        roads,
      });
    }
    this.materialised = Math.max(this.materialised, count);
    return this;
  }

  get districts(): readonly District[] {
    return this._districts;
  }

  /** Plot for the i-th home ever built. Index is stable across expansion. */
  homeCell(i: number): Coord {
    return this._residential[i] as Coord;
  }

  /** Plot for the i-th shop ever opened. */
  shopCell(i: number): Coord {
    return this._commercial[i] as Coord;
  }

  /** Plot for the i-th industrial building. */
  industryCell(i: number): Coord {
    return this._industrial[i] as Coord;
  }

  /**
   * Plot for the i-th civic building, taken from the *back* of the residential
   * list.
   *
   * Civic buildings sit in neighbourhoods rather than on land of their own, so
   * they share the residential zone with housing. Housing fills that list from
   * the front and services fill it from the back, which is what makes "a school
   * and a home can never land on the same plot" true by construction rather than
   * by a collision check: `homeCapacity` subtracts the civic count, so the two
   * runs meet in the middle and never cross.
   *
   * The cost of the trick is that the back of the list moves when land is
   * annexed, so a service relocates into the new district. That is a redraw, not
   * a save-format problem — the position is still a pure function of (index,
   * civic count, district count) — and the alternative, reserving plots by
   * index, would move *housing* every time a school went up, which is far worse.
   */
  civicCell(i: number): Coord {
    return this._residential[this._residential.length - 1 - i] as Coord;
  }

  /** Every plot of one zone, in build order. Used by the zone overlay. */
  zoneCells(zone: Zone): readonly Coord[] {
    if (zone === ZONE.commercial) return this._commercial;
    if (zone === ZONE.industrial) return this._industrial;
    return this._residential;
  }
}
